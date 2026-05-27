import { useEffect, useRef, useState, useCallback } from 'react'
import type { AvatarColors } from '../App.tsx'
import { createScene, resizeScene, disposeScene, updateScene } from '../engine/Scene.ts'
import { createAvatar, animateWalk, disposeAvatar } from '../engine/Avatar.ts'
import type { AvatarMesh } from '../engine/Avatar.ts'
import { createBody, stepPhysics } from '../engine/Physics.ts'
import { createInputState, bindInputListeners, applyInput, updateCamera } from '../engine/Controls.ts'
import { createHubWorld, animateCoins, collectCoins } from '../engine/World.ts'
import { createBuilder, updateGhostBlock, placeBlock, removeBlock, setBuilderColor, disposeBuilder, BLOCK_COLORS } from '../engine/Builder.ts'
import type { BuilderState } from '../engine/Builder.ts'
import { spawnCoinParticles, updateParticles, disposeAllParticles } from '../engine/Particles.ts'
import { playCoinSound, playJumpSound, playLandSound, playChatSound, playPlaceSound, playRemoveSound } from '../engine/Audio.ts'
import { createMultiplayerClient } from '../multiplayer.ts'
import type { RemotePlayer, ChatMessage, ServerMessage } from '../multiplayer.ts'
import Chat from './Chat.tsx'
import TouchControls from './TouchControls.tsx'
import BuilderHUD from './BuilderHUD.tsx'

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
  const [copied, setCopied] = useState(false)
  const [showTouch] = useState(isTouchDevice)
  const [buildMode, setBuildMode] = useState(false)
  const [buildColor, setBuildColor] = useState(BLOCK_COLORS[5])
  const chatFocusedRef = useRef(false)
  const inputRef = useRef(createInputState())
  const addYawRef = useRef<(delta: number) => void>(() => {})
  const builderRef = useRef<BuilderState | null>(null)
  const worldCollidersRef = useRef<import('../engine/Physics.ts').AABB[]>([])

  useEffect(() => {
    chatFocusedRef.current = chatFocused
  }, [chatFocused])

  const mpRef = useRef<ReturnType<typeof createMultiplayerClient> | null>(null)

  const handleTouchMove = useCallback((dx: number, dz: number) => {
    inputRef.current.touchMoveX = dx
    inputRef.current.touchMoveZ = dz
  }, [])

  const handleTouchJump = useCallback(() => {
    inputRef.current.jumpTrigger = true
  }, [])

  const handleTouchLook = useCallback((dx: number) => {
    addYawRef.current(dx)
  }, [])

  const handleToggleBuild = useCallback(() => {
    setBuildMode(prev => {
      const next = !prev
      if (builderRef.current) builderRef.current.enabled = next
      return next
    })
  }, [])

  const handleSelectColor = useCallback((color: number) => {
    setBuildColor(color)
    if (builderRef.current) setBuilderColor(builderRef.current, color)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = createScene(canvas)
    const world = createHubWorld()
    ctx.scene.add(world.group)
    worldCollidersRef.current = world.colliders

    const builder = createBuilder()
    builderRef.current = builder
    ctx.scene.add(builder.group)

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

    // Build mode key binding
    function onBuildKey(e: KeyboardEvent) {
      if (chatFocusedRef.current) return
      if (e.code === 'KeyB') {
        setBuildMode(prev => {
          const next = !prev
          builder.enabled = next
          return next
        })
      }
    }
    window.addEventListener('keydown', onBuildKey)

    // Block place/remove via mouse
    function onMouseDown(e: MouseEvent) {
      if (!builder.enabled || chatFocusedRef.current) return
      if (e.button === 2) {
        e.preventDefault()
        const removed = removeBlock(builder, world.colliders)
        if (removed) playRemoveSound()
      }
    }

    function onMouseUp(e: MouseEvent) {
      if (!builder.enabled || chatFocusedRef.current) return
      if (e.button === 0 && document.pointerLockElement === canvas) {
        const placed = placeBlock(builder, world.colliders)
        if (placed) playPlaceSound()
      }
    }

    function onContextMenu(e: Event) {
      if (builder.enabled) e.preventDefault()
    }

    // Scroll to cycle colors
    function onWheel(e: WheelEvent) {
      if (!builder.enabled) return
      e.preventDefault()
      const dir = e.deltaY > 0 ? 1 : -1
      const idx = BLOCK_COLORS.indexOf(builder.selectedColor)
      const next = (idx + dir + BLOCK_COLORS.length) % BLOCK_COLORS.length
      builder.selectedColor = BLOCK_COLORS[next]
      setBuildColor(BLOCK_COLORS[next])
    }

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('contextmenu', onContextMenu)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    const remotePlayers = new Map<string, { data: RemotePlayer; avatar: AvatarMesh }>()

    const mp = createMultiplayerClient()
    mpRef.current = mp

    let prevGrounded = true

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

      const wantsJump = (input.jump || input.jumpTrigger) && body.grounded
      if (wantsJump) playJumpSound()

      applyInput(input, body, yaw)
      stepPhysics(body, dt, world.colliders)

      if (!prevGrounded && body.grounded) {
        playLandSound()
      }
      prevGrounded = body.grounded

      myAvatar.group.position.set(body.x, body.y, body.z)
      myAvatar.group.rotation.y = yaw

      const speed = Math.sqrt(body.vx * body.vx + body.vz * body.vz)
      animateWalk(myAvatar, elapsed, speed)

      updateCamera(ctx.camera, body, yaw, dt)

      // Builder ghost
      updateGhostBlock(builder, body.x, body.y, body.z, yaw)

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

      updateScene(ctx, elapsed)
      ctx.renderer.render(ctx.scene, ctx.camera)
    }

    loop()

    return () => {
      cancelAnimationFrame(animId)
      cleanupInput()
      mp.disconnect()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onBuildKey)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('contextmenu', onContextMenu)
      canvas.removeEventListener('wheel', onWheel)
      for (const [, remote] of remotePlayers) {
        disposeAvatar(remote.avatar)
      }
      disposeAvatar(myAvatar)
      disposeBuilder(builder)
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
      <button
        onClick={() => {
          const url = `${location.origin}?room=${roomId}`
          navigator.clipboard?.writeText(url).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          })
        }}
        className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm transition cursor-pointer"
        data-ui
      >
        Room: <span className="font-mono font-bold text-indigo-300">{roomId}</span>
        <span className="ml-2 text-white/50">{copied ? 'Copied!' : '(tap to share)'}</span>
      </button>

      {/* Leave button */}
      <button
        onClick={onLeave}
        className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500/80 hover:bg-red-500 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm font-semibold transition"
        data-ui
      >
        Leave
      </button>

      {/* Builder HUD */}
      <BuilderHUD
        enabled={buildMode}
        selectedColor={buildColor}
        onToggle={handleToggleBuild}
        onSelectColor={handleSelectColor}
      />

      {/* Controls hint (desktop only) */}
      {!showTouch && (
        <div className="absolute bottom-20 left-4 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2 text-white/60 text-xs">
          WASD move | Shift sprint | Space jump | B build | Click look | Enter chat
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
