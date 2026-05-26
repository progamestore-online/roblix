import { useEffect, useRef, useState, useCallback } from 'react'
import type { AvatarColors } from '../App.tsx'
import { createScene, resizeScene, disposeScene } from '../engine/Scene.ts'
import { createAvatar, animateWalk, disposeAvatar } from '../engine/Avatar.ts'
import type { AvatarMesh } from '../engine/Avatar.ts'
import { createBody, stepPhysics } from '../engine/Physics.ts'
import { createInputState, bindInputListeners, applyInput, updateCamera } from '../engine/Controls.ts'
import { createHubWorld, animateCoins, collectCoins } from '../engine/World.ts'
import { spawnCoinParticles, updateParticles, disposeAllParticles } from '../engine/Particles.ts'
import { playCoinSound, playJumpSound, playLandSound, playChatSound } from '../engine/Audio.ts'
import { createMultiplayerClient } from '../multiplayer.ts'
import type { RemotePlayer, ChatMessage, ServerMessage } from '../multiplayer.ts'
import Chat from './Chat.tsx'
import TouchControls from './TouchControls.tsx'

interface GameProps {
  roomId: string
  avatar: AvatarColors
  playerName: string
  onLeave: () => void
}

function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

export default function Game({ roomId, avatar, playerName, onLeave }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [coins, setCoins] = useState(0)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatFocused, setChatFocused] = useState(false)
  const [playerCount, setPlayerCount] = useState(1)
  const [showTouch] = useState(isTouchDevice)
  const chatFocusedRef = useRef(false)
  const inputRef = useRef(createInputState())
  const addYawRef = useRef<(delta: number) => void>(() => {})

  useEffect(() => {
    chatFocusedRef.current = chatFocused
  }, [chatFocused])

  const mpRef = useRef<ReturnType<typeof createMultiplayerClient> | null>(null)

  const handleTouchMove = useCallback((dx: number, dz: number) => {
    inputRef.current.touchMoveX = dx
    inputRef.current.touchMoveZ = dz
  }, [])

  const handleTouchJump = useCallback(() => {
    inputRef.current.jump = true
  }, [])

  const handleTouchLook = useCallback((dx: number) => {
    addYawRef.current(dx)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = createScene(canvas)
    const world = createHubWorld()
    ctx.scene.add(world.group)

    const myAvatar = createAvatar(avatar, playerName || undefined)
    ctx.scene.add(myAvatar.group)

    const body = createBody(0, 2, 0)
    const input = inputRef.current

    const { cleanup: cleanupInput, getYaw, addYaw } = bindInputListeners(
      input,
      canvas,
      () => chatFocusedRef.current,
    )
    addYawRef.current = addYaw

    const remotePlayers = new Map<string, { data: RemotePlayer; avatar: AvatarMesh }>()

    const mp = createMultiplayerClient()
    mpRef.current = mp

    let wasGrounded = false

    mp.onMessage((msg: ServerMessage) => {
      if (msg.type === 'init') {
        for (const p of msg.players) addRemotePlayer(p)
        setMessages(msg.messages)
        setPlayerCount(msg.players.length + 1)
      } else if (msg.type === 'player_joined') {
        addRemotePlayer(msg.player)
        setPlayerCount(remotePlayers.size + 1)
      } else if (msg.type === 'player_left') {
        removeRemotePlayer(msg.id)
        setPlayerCount(remotePlayers.size + 1)
      } else if (msg.type === 'player_moved') {
        const remote = remotePlayers.get(msg.id)
        if (remote) {
          remote.data.position = msg.position
          remote.data.rotation = msg.rotation
        }
      } else if (msg.type === 'player_updated') {
        const remote = remotePlayers.get(msg.id)
        if (remote) {
          remote.data.avatar = msg.avatar
          remote.data.name = msg.name
        }
      } else if (msg.type === 'chat') {
        setMessages(prev => [...prev.slice(-49), msg.message])
        playChatSound()
      }
    })

    mp.connect(roomId)
    mp.sendAvatarUpdate(avatar, playerName)

    function addRemotePlayer(p: RemotePlayer) {
      const rAvatar = createAvatar(p.avatar, p.name)
      rAvatar.group.position.set(p.position.x, p.position.y, p.position.z)
      ctx.scene.add(rAvatar.group)
      remotePlayers.set(p.id, { data: p, avatar: rAvatar })
    }

    function removeRemotePlayer(id: string) {
      const remote = remotePlayers.get(id)
      if (remote) {
        ctx.scene.remove(remote.avatar.group)
        disposeAvatar(remote.avatar)
        remotePlayers.delete(id)
      }
    }

    function onResize() {
      resizeScene(ctx, window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)
    onResize()

    let animId: number
    let totalCoins = 0

    function loop() {
      animId = requestAnimationFrame(loop)
      const dt = Math.min(ctx.clock.getDelta(), 0.05)
      const elapsed = ctx.clock.getElapsedTime()
      const yaw = getYaw()

      const wasAirborne = !body.grounded

      // Check if about to jump
      const wantsJump = input.jump && body.grounded
      if (wantsJump) playJumpSound()

      applyInput(input, body, yaw)
      stepPhysics(body, dt, world.colliders)

      // Land sound
      if (wasAirborne && body.grounded && !wasGrounded) {
        playLandSound()
      }
      wasGrounded = body.grounded

      myAvatar.group.position.set(body.x, body.y, body.z)
      myAvatar.group.rotation.y = yaw

      const speed = Math.sqrt(body.vx * body.vx + body.vz * body.vz)
      animateWalk(myAvatar, elapsed, speed)

      updateCamera(ctx.camera, body, yaw, dt)

      animateCoins(world, elapsed, dt)
      const collected = collectCoins(world, body.x, body.y, body.z)
      if (collected > 0) {
        totalCoins += collected
        setCoins(totalCoins)
        playCoinSound()
        spawnCoinParticles(ctx.scene, body.x, body.y + 1.5, body.z)
      }

      updateParticles(ctx.scene, dt)

      for (const [, remote] of remotePlayers) {
        const target = remote.data.position
        const g = remote.avatar.group
        g.position.x += (target.x - g.position.x) * 0.15
        g.position.y += (target.y - g.position.y) * 0.15
        g.position.z += (target.z - g.position.z) * 0.15
        g.rotation.y += (remote.data.rotation.y - g.rotation.y) * 0.15
        const rSpeed = Math.abs(target.x - g.position.x) + Math.abs(target.z - g.position.z)
        animateWalk(remote.avatar, elapsed, rSpeed)
      }

      mp.sendPosition(
        { x: body.x, y: body.y, z: body.z },
        { y: yaw },
      )

      ctx.renderer.render(ctx.scene, ctx.camera)
    }

    loop()

    return () => {
      cancelAnimationFrame(animId)
      cleanupInput()
      mp.disconnect()
      window.removeEventListener('resize', onResize)
      for (const [, remote] of remotePlayers) {
        disposeAvatar(remote.avatar)
      }
      disposeAvatar(myAvatar)
      disposeAllParticles(ctx.scene)
      disposeScene(ctx)
    }
  }, [roomId, avatar, playerName])

  function handleSendChat(text: string) {
    mpRef.current?.sendChat(text)
  }

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* HUD */}
      <div className="absolute top-4 left-4 flex flex-col gap-2" data-ui>
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm flex items-center gap-2">
          <span className="text-yellow-400 text-lg">*</span>
          <span className="text-yellow-400 font-bold text-lg">{coins}</span>
        </div>
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm">
          <span className="text-indigo-300 font-bold">{playerCount}</span> online
        </div>
      </div>

      {/* Room code */}
      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm" data-ui>
        Room: <span className="font-mono font-bold text-indigo-300">{roomId}</span>
      </div>

      {/* Leave button */}
      <button
        onClick={onLeave}
        className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500/80 hover:bg-red-500 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm font-semibold transition"
        data-ui
      >
        Leave
      </button>

      {/* Controls hint (desktop only) */}
      {!showTouch && (
        <div className="absolute bottom-20 left-4 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2 text-white/60 text-xs">
          WASD to move | Space to jump | Click to look around | Enter to chat
        </div>
      )}

      {/* Touch controls (mobile) */}
      <TouchControls
        onMove={handleTouchMove}
        onJump={handleTouchJump}
        onLook={handleTouchLook}
        visible={showTouch}
      />

      {/* Chat overlay */}
      <Chat
        messages={messages}
        onSend={handleSendChat}
        onFocusChange={setChatFocused}
      />
    </div>
  )
}
