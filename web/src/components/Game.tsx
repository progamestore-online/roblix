import { useEffect, useRef, useState } from 'react'
import type { AvatarColors } from '../App.tsx'
import { createScene, resizeScene, disposeScene } from '../engine/Scene.ts'
import { createAvatar, animateWalk, disposeAvatar } from '../engine/Avatar.ts'
import type { AvatarMesh } from '../engine/Avatar.ts'
import { createBody, stepPhysics } from '../engine/Physics.ts'
import { createInputState, bindInputListeners, applyInput, updateCamera } from '../engine/Controls.ts'
import { createHubWorld, animateCoins, collectCoins } from '../engine/World.ts'
import { createMultiplayerClient } from '../multiplayer.ts'
import type { RemotePlayer, ChatMessage, ServerMessage } from '../multiplayer.ts'
import Chat from './Chat.tsx'

interface GameProps {
  roomId: string
  avatar: AvatarColors
  playerName: string
  onLeave: () => void
}

export default function Game({ roomId, avatar, playerName, onLeave }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [coins, setCoins] = useState(0)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatFocused, setChatFocused] = useState(false)
  const [playerCount, setPlayerCount] = useState(1)
  const chatFocusedRef = useRef(false)

  useEffect(() => {
    chatFocusedRef.current = chatFocused
  }, [chatFocused])

  // Multiplayer client ref for sending chat from outside the game loop
  const mpRef = useRef<ReturnType<typeof createMultiplayerClient> | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = createScene(canvas)
    const world = createHubWorld()
    ctx.scene.add(world.group)

    // Player avatar
    const myAvatar = createAvatar(avatar, playerName || undefined)
    ctx.scene.add(myAvatar.group)

    // Physics
    const body = createBody(0, 2, 0)

    // Controls
    const input = createInputState()
    const { cleanup: cleanupInput, getYaw } = bindInputListeners(
      input,
      canvas,
      () => chatFocusedRef.current,
    )

    // Remote players
    const remotePlayers = new Map<string, { data: RemotePlayer; avatar: AvatarMesh }>()

    // Multiplayer
    const mp = createMultiplayerClient()
    mpRef.current = mp

    mp.onMessage((msg: ServerMessage) => {
      if (msg.type === 'init') {
        for (const p of msg.players) {
          addRemotePlayer(p)
        }
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

    // Resize handler
    function onResize() {
      resizeScene(ctx, window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)
    onResize()

    // Game loop
    let animId: number
    let totalCoins = 0

    function loop() {
      animId = requestAnimationFrame(loop)
      const dt = Math.min(ctx.clock.getDelta(), 0.05)
      const elapsed = ctx.clock.getElapsedTime()
      const yaw = getYaw()

      // Input + physics
      applyInput(input, body, yaw)
      stepPhysics(body, dt, world.colliders)

      // Update player avatar position
      myAvatar.group.position.set(body.x, body.y, body.z)
      myAvatar.group.rotation.y = yaw

      // Walk animation
      const speed = Math.sqrt(body.vx * body.vx + body.vz * body.vz)
      animateWalk(myAvatar, elapsed, speed)

      // Camera
      updateCamera(ctx.camera, body, yaw, dt)

      // Coins
      animateCoins(world, elapsed)
      const collected = collectCoins(world, body.x, body.y, body.z)
      if (collected > 0) {
        totalCoins += collected
        setCoins(totalCoins)
      }

      // Sync remote players (interpolate positions)
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

      // Send position to server
      mp.sendPosition(
        { x: body.x, y: body.y, z: body.z },
        { y: yaw },
      )

      // Render
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
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm">
          <span className="text-yellow-400 font-bold">{coins}</span> coins
        </div>
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm">
          <span className="text-indigo-300 font-bold">{playerCount}</span> online
        </div>
      </div>

      {/* Room code */}
      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm">
        Room: <span className="font-mono font-bold text-indigo-300">{roomId}</span>
      </div>

      {/* Leave button */}
      <button
        onClick={onLeave}
        className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500/80 hover:bg-red-500 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm font-semibold transition"
      >
        Leave
      </button>

      {/* Controls hint */}
      <div className="absolute bottom-20 left-4 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2 text-white/60 text-xs">
        WASD to move | Space to jump | Click to look around | Enter to chat
      </div>

      {/* Chat overlay */}
      <Chat
        messages={messages}
        onSend={handleSendChat}
        onFocusChange={setChatFocused}
      />
    </div>
  )
}
