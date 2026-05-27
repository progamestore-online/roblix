import { useEffect, useRef, useState, useCallback } from 'react'
import type { AvatarColors } from '../App.tsx'
import { createScene, resizeScene, disposeScene, updateScene } from '../engine/Scene.ts'
import { createAvatar, animateWalk, disposeAvatar } from '../engine/Avatar.ts'
import type { AvatarMesh } from '../engine/Avatar.ts'
import { createBody, stepPhysics, respawnBody } from '../engine/Physics.ts'
import type { BlockType } from '../engine/Physics.ts'
import { createInputState, bindInputListeners, applyInput, updateCamera } from '../engine/Controls.ts'
import { createHubWorld, animateCoins, collectCoins } from '../engine/World.ts'
import { createObbyWorld, createSandboxWorld } from '../engine/Worlds.ts'
import { createBuilder, updateGhostBlock, placeBlock, removeBlock, setBuilderColor, setBuilderType, disposeBuilder, tickBlockAnimations, BLOCK_COLORS, BLOCK_TYPES, addBlockFromServer, removeBlockFromServer } from '../engine/Builder.ts'
import type { BuilderState } from '../engine/Builder.ts'
import { spawnCoinParticles, updateParticles, disposeAllParticles } from '../engine/Particles.ts'
import {
  playCoinSound, playJumpSound, playLandSound, playChatSound,
  playPlaceSound, playRemoveSound, playDeathSound, playBounceSound, playFinishSound,
} from '../engine/Audio.ts'
import { createMultiplayerClient } from '../multiplayer.ts'
import type { RemotePlayer, ChatMessage, ServerMessage, LeaderboardEntry, ObbyFinish } from '../multiplayer.ts'
import Chat from './Chat.tsx'
import TouchControls from './TouchControls.tsx'
import BuilderHUD from './BuilderHUD.tsx'
import Leaderboard from './Leaderboard.tsx'

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
  const [buildType, setBuildType] = useState<BlockType>('solid')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [obbyTimes, setObbyTimes] = useState<ObbyFinish[]>([])
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)
  const [activeEmote, setActiveEmote] = useState<string | null>(null)
  const [firstPerson, setFirstPerson] = useState(false)
  const [obbyTimeMs, setObbyTimeMs] = useState<number | null>(null)
  const [obbyBest, setObbyBest] = useState<number | null>(() => {
    const v = Number(localStorage.getItem('roblix-obby-best') || 'NaN')
    return Number.isFinite(v) && v > 0 ? v : null
  })
  const [respawnFlash, setRespawnFlash] = useState(false)
  const firstPersonRef = useRef(false)
  const chatFocusedRef = useRef(false)
  const inputRef = useRef(createInputState())
  const addYawRef = useRef<(delta: number) => void>(() => {})
  const builderRef = useRef<BuilderState | null>(null)
  const emoteRef = useRef<string | null>(null)
  const remoteEmotes = useRef<Map<string, string | null>>(new Map())

  useEffect(() => {
    chatFocusedRef.current = chatFocused
  }, [chatFocused])

  useEffect(() => {
    firstPersonRef.current = firstPerson
  }, [firstPerson])

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

  const handleSelectType = useCallback((type: BlockType) => {
    setBuildType(type)
    if (builderRef.current) setBuilderType(builderRef.current, type)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = createScene(canvas)
    const world =
      roomId === 'hub' ? createHubWorld() :
      roomId === 'obby' ? createObbyWorld() :
      roomId === 'sandbox' ? createSandboxWorld() :
      createSandboxWorld()
    ctx.scene.add(world.group)

    const spawn = world.spawn
    // Obby victory platform footprint (from Worlds.ts createObbyWorld).
    const OBBY_FINISH = { x: -8, y: 29, z: 6, w: 6, d: 6 }

    const builder = createBuilder()
    builderRef.current = builder
    ctx.scene.add(builder.group)

    const myAvatar = createAvatar(avatar, playerName || undefined)
    ctx.scene.add(myAvatar.group)

    const body = createBody(spawn.x, spawn.y, spawn.z)
    const input = inputRef.current
    // Obby timer starts lazily once the player leaves the start platform.
    let obbyStart: number | null = null
    let obbyFinished = false

    const { cleanup: cleanupInput, getYaw, addYaw } = bindInputListeners(
      input,
      canvas,
      () => chatFocusedRef.current,
    )
    addYawRef.current = addYaw

    // Key bindings for build mode + emotes
    function onGameKey(e: KeyboardEvent) {
      if (chatFocusedRef.current) return
      if (e.code === 'KeyB') {
        setBuildMode(prev => {
          const next = !prev
          builder.enabled = next
          return next
        })
      }
      if (e.code === 'KeyT' && builder.enabled) {
        const idx = BLOCK_TYPES.indexOf(builder.selectedType)
        const next = BLOCK_TYPES[(idx + 1) % BLOCK_TYPES.length]
        builder.selectedType = next
        setBuildType(next)
      }
      if (e.code === 'KeyV') {
        setFirstPerson(prev => !prev)
      }
      if (e.code === 'KeyR' && roomId === 'obby') {
        respawnBody(body, spawn.x, spawn.y, spawn.z)
        obbyStart = null
        obbyFinished = false
        setObbyTimeMs(null)
      }
      // Emotes: 1-4
      const emoteMap: Record<string, string> = {
        'Digit1': 'wave', 'Digit2': 'dance', 'Digit3': 'sit', 'Digit4': 'cheer',
      }
      if (emoteMap[e.code]) {
        const em = emoteMap[e.code]
        const current = emoteRef.current
        const next = current === em ? null : em
        emoteRef.current = next
        setActiveEmote(next)
        mpRef.current?.sendEmote(next || '')
      }
    }
    window.addEventListener('keydown', onGameKey)

    // Block place/remove
    function onMouseDown(e: MouseEvent) {
      if (!builder.enabled || chatFocusedRef.current) return
      if (e.button === 2) {
        e.preventDefault()
        const removed = removeBlock(builder, world.colliders)
        if (removed) {
          playRemoveSound()
          mpRef.current?.sendBlockRemove(removed.x, removed.y, removed.z)
        }
      }
    }
    function onMouseUp(e: MouseEvent) {
      if (!builder.enabled || chatFocusedRef.current) return
      if (e.button === 0 && document.pointerLockElement === canvas) {
        const placed = placeBlock(builder, world.colliders)
        if (placed) {
          playPlaceSound()
          mpRef.current?.sendBlockPlace(placed.x, placed.y, placed.z, placed.color, placed.type)
        }
      }
    }
    function onContextMenu(e: Event) {
      if (builder.enabled) e.preventDefault()
    }
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
    let prevVy = 0
    let timerUiAccum = 0

    mp.onMessage((msg: ServerMessage) => {
      if (msg.type === 'init') {
        setMyPlayerId(msg.playerId)
        for (const p of msg.players) addRemotePlayer(p)
        setMessages(msg.messages)
        setPlayerCount(msg.players.length + 1)
        setLeaderboard(msg.leaderboard)
        setObbyTimes(msg.obbyTimes)
        for (const b of msg.blocks) {
          addBlockFromServer(builder, world.colliders, b.x, b.y, b.z, b.color, b.blockType)
        }
      } else if (msg.type === 'block_placed') {
        addBlockFromServer(builder, world.colliders, msg.x, msg.y, msg.z, msg.color, msg.blockType)
        playPlaceSound()
      } else if (msg.type === 'block_removed') {
        removeBlockFromServer(builder, world.colliders, msg.x, msg.y, msg.z)
        playRemoveSound()
      } else if (msg.type === 'obby_times') {
        setObbyTimes(msg.obbyTimes)
      } else if (msg.type === 'player_joined') {
        addRemotePlayer(msg.player)
        setPlayerCount(remotePlayers.size + 1)
      } else if (msg.type === 'player_left') {
        removeRemotePlayer(msg.id)
        remoteEmotes.current.delete(msg.id)
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
      } else if (msg.type === 'player_emote') {
        remoteEmotes.current.set(msg.id, msg.emote)
      } else if (msg.type === 'chat') {
        setMessages(prev => [...prev.slice(-49), msg.message])
        playChatSound()
      } else if (msg.type === 'leaderboard') {
        setLeaderboard(msg.leaderboard)
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

      // Clear emote on movement
      if (emoteRef.current && (input.forward || input.backward || input.left || input.right || input.jump)) {
        emoteRef.current = null
        setActiveEmote(null)
        mp.sendEmote('')
      }

      const wantsJump = (input.jump || input.jumpTrigger) && body.grounded
      if (wantsJump) playJumpSound()

      applyInput(input, body, yaw)
      prevVy = body.vy
      stepPhysics(body, dt, world.colliders)

      // Bounce sound: was falling, now launched up by a bounce block.
      if (prevVy < 0 && body.vy > 10) playBounceSound()

      if (body.killed) {
        playDeathSound()
        respawnBody(body, spawn.x, spawn.y, spawn.z)
        if (roomId === 'obby') {
          obbyStart = null
          obbyFinished = false
          setObbyTimeMs(null)
        }
        setRespawnFlash(true)
        window.setTimeout(() => setRespawnFlash(false), 250)
      }

      if (!prevGrounded && body.grounded) playLandSound()
      prevGrounded = body.grounded

      // Obby timer: start when player moves off the start platform, stop on finish.
      if (roomId === 'obby' && !obbyFinished) {
        if (obbyStart === null && (body.x * body.x + body.z * body.z) > 16) {
          obbyStart = performance.now()
        }
        if (obbyStart !== null) {
          const ms = performance.now() - obbyStart
          timerUiAccum += dt
          if (timerUiAccum > 0.05) {
            timerUiAccum = 0
            setObbyTimeMs(ms)
          }
          const dx = Math.abs(body.x - OBBY_FINISH.x)
          const dz = Math.abs(body.z - OBBY_FINISH.z)
          if (dx < OBBY_FINISH.w / 2 && dz < OBBY_FINISH.d / 2 && body.y >= OBBY_FINISH.y) {
            obbyFinished = true
            const time = ms / 1000
            setObbyTimeMs(ms)
            playFinishSound()
            spawnCoinParticles(ctx.scene, body.x, body.y + 1.5, body.z)
            mp.sendObbyFinish(time)
            setObbyBest(prev => {
              if (prev === null || time < prev) {
                localStorage.setItem('roblix-obby-best', String(time))
                return time
              }
              return prev
            })
          }
        }
      }

      myAvatar.group.position.set(body.x, body.y, body.z)
      myAvatar.group.rotation.y = yaw
      myAvatar.group.visible = !firstPersonRef.current

      const speed = Math.sqrt(body.vx * body.vx + body.vz * body.vz)
      animateWalk(myAvatar, elapsed, speed, emoteRef.current)

      updateCamera(ctx.camera, body, yaw, dt, input.sprint && speed > 1, firstPersonRef.current)
      updateGhostBlock(builder, body.x, body.y, body.z, yaw)

      animateCoins(world, elapsed, dt)
      tickBlockAnimations(elapsed)
      const collected = collectCoins(world, body.x, body.y, body.z)
      if (collected > 0) {
        totalCoins += collected
        setCoins(totalCoins)
        playCoinSound()
        spawnCoinParticles(ctx.scene, body.x, body.y + 1.5, body.z)
        mp.sendCoinCollected(collected)
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
        const rEmote = remoteEmotes.current.get(remote.data.id) ?? null
        animateWalk(remote.avatar, elapsed, rSpeed, rEmote)
      }

      mp.sendPosition({ x: body.x, y: body.y, z: body.z }, { y: yaw })

      updateScene(ctx, elapsed, input.sprint && speed > 1)
      ctx.renderer.render(ctx.scene, ctx.camera)
    }

    loop()

    return () => {
      cancelAnimationFrame(animId)
      cleanupInput()
      mp.disconnect()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onGameKey)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('contextmenu', onContextMenu)
      canvas.removeEventListener('wheel', onWheel)
      for (const [, remote] of remotePlayers) disposeAvatar(remote.avatar)
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

      {respawnFlash && (
        <div className="absolute inset-0 bg-red-500/40 pointer-events-none" />
      )}

      {/* HUD */}
      <div className="absolute top-4 left-4 flex flex-col gap-2" data-ui>
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm flex items-center gap-2">
          <span className="text-yellow-400 text-lg">*</span>
          <span className="text-yellow-400 font-bold text-lg">{coins}</span>
        </div>
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm">
          <span className="text-indigo-300 font-bold">{playerCount}</span> online
        </div>
        {roomId === 'obby' && (
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm font-mono flex flex-col gap-0.5 min-w-32">
            <div className="flex justify-between gap-3">
              <span className="text-white/60">Time</span>
              <span className="text-emerald-300 font-bold">{obbyTimeMs === null ? '—' : (obbyTimeMs / 1000).toFixed(2) + 's'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-white/60">Best</span>
              <span className="text-yellow-300">{obbyBest === null ? '—' : obbyBest.toFixed(2) + 's'}</span>
            </div>
          </div>
        )}
        {activeEmote && (
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm">
            {activeEmote === 'wave' ? '👋' : activeEmote === 'dance' ? '💃' : activeEmote === 'sit' ? '🪑' : '🎉'} {activeEmote}
          </div>
        )}
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

      {/* Coin leaderboard — hidden in obby (which has its own time leaderboard) */}
      {roomId !== 'obby' && <Leaderboard entries={leaderboard} myId={myPlayerId} />}

      {/* Builder HUD */}
      <BuilderHUD
        enabled={buildMode}
        selectedColor={buildColor}
        selectedType={buildType}
        onToggle={handleToggleBuild}
        onSelectColor={handleSelectColor}
        onSelectType={handleSelectType}
      />

      {/* Controls hint (desktop only) */}
      {!showTouch && (
        <div className="absolute bottom-20 left-4 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2 text-white/60 text-xs">
          WASD move | Shift sprint | Space jump | B build | T type | V {firstPerson ? '3rd person' : '1st person'}{roomId === 'obby' ? ' | R reset' : ''} | 1-4 emotes | Enter chat
        </div>
      )}

      {/* Obby finish times */}
      {roomId === 'obby' && obbyTimes.length > 0 && (
        <div className="absolute top-24 left-4 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 w-44" data-ui>
          <div className="text-white/70 text-xs font-semibold mb-1 uppercase tracking-wider">Best Times</div>
          {obbyTimes.slice(0, 5).map((entry, i) => (
            <div
              key={entry.id}
              className={`flex items-center gap-2 text-xs py-0.5 ${
                entry.id === myPlayerId ? 'text-yellow-300 font-bold' : 'text-white/80'
              }`}
            >
              <span className="w-4 text-right text-white/40">{i + 1}.</span>
              <span className="flex-1 truncate">{entry.name || 'Player'}</span>
              <span className="text-green-400">{entry.time.toFixed(2)}s</span>
            </div>
          ))}
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
