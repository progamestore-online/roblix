import { useEffect, useRef, useCallback } from 'react'

interface TouchControlsProps {
  onMove: (dx: number, dz: number) => void
  onJump: () => void
  onLook: (dx: number) => void
  visible: boolean
}

export default function TouchControls({ onMove, onJump, onLook, visible }: TouchControlsProps) {
  const joystickRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const joystickTouchId = useRef<number | null>(null)
  const joystickCenter = useRef({ x: 0, y: 0 })
  const lookTouchId = useRef<number | null>(null)
  const lastLookX = useRef(0)
  const moveInterval = useRef<number | null>(null)
  const currentMove = useRef({ dx: 0, dz: 0 })

  const JOYSTICK_RADIUS = 50

  const startMoveLoop = useCallback(() => {
    if (moveInterval.current !== null) return
    moveInterval.current = window.setInterval(() => {
      const { dx, dz } = currentMove.current
      if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
        onMove(dx, dz)
      }
    }, 16)
  }, [onMove])

  const stopMoveLoop = useCallback(() => {
    if (moveInterval.current !== null) {
      clearInterval(moveInterval.current)
      moveInterval.current = null
    }
    currentMove.current = { dx: 0, dz: 0 }
    onMove(0, 0)
  }, [onMove])

  useEffect(() => {
    if (!visible) return

    const joystick = joystickRef.current
    if (!joystick) return

    function handleTouchStart(e: TouchEvent) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i]
        const target = t.target as HTMLElement

        if (joystick!.contains(target) || target === joystick) {
          e.preventDefault()
          joystickTouchId.current = t.identifier
          const rect = joystick!.getBoundingClientRect()
          joystickCenter.current = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          }
          startMoveLoop()
        } else if (target.closest('[data-jump]')) {
          e.preventDefault()
          onJump()
        } else if (!target.closest('[data-chat]') && !target.closest('[data-ui]')) {
          lookTouchId.current = t.identifier
          lastLookX.current = t.clientX
        }
      }
    }

    function handleTouchMove(e: TouchEvent) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i]

        if (t.identifier === joystickTouchId.current) {
          e.preventDefault()
          const rawDx = t.clientX - joystickCenter.current.x
          const rawDy = t.clientY - joystickCenter.current.y
          const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy)
          const clamp = Math.min(dist, JOYSTICK_RADIUS)
          const angle = Math.atan2(rawDy, rawDx)
          const nx = (Math.cos(angle) * clamp) / JOYSTICK_RADIUS
          const ny = (Math.sin(angle) * clamp) / JOYSTICK_RADIUS

          if (knobRef.current) {
            knobRef.current.style.transform = `translate(${nx * JOYSTICK_RADIUS}px, ${ny * JOYSTICK_RADIUS}px)`
          }

          currentMove.current = { dx: nx, dz: -ny }
        }

        if (t.identifier === lookTouchId.current) {
          const dx = t.clientX - lastLookX.current
          lastLookX.current = t.clientX
          onLook(dx * -0.005)
        }
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i]
        if (t.identifier === joystickTouchId.current) {
          joystickTouchId.current = null
          if (knobRef.current) {
            knobRef.current.style.transform = 'translate(0, 0)'
          }
          stopMoveLoop()
        }
        if (t.identifier === lookTouchId.current) {
          lookTouchId.current = null
        }
      }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: false })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd)
    document.addEventListener('touchcancel', handleTouchEnd)

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('touchcancel', handleTouchEnd)
      stopMoveLoop()
    }
  }, [visible, onMove, onJump, onLook, startMoveLoop, stopMoveLoop])

  if (!visible) return null

  return (
    <>
      {/* Joystick */}
      <div
        ref={joystickRef}
        className="absolute bottom-8 left-8 w-32 h-32 rounded-full bg-white/10 border-2 border-white/20 backdrop-blur-sm flex items-center justify-center touch-none select-none"
        data-ui
      >
        <div
          ref={knobRef}
          className="w-14 h-14 rounded-full bg-white/40 border-2 border-white/60 transition-none pointer-events-none"
        />
      </div>

      {/* Jump button */}
      <button
        data-jump
        className="absolute bottom-10 right-8 w-20 h-20 rounded-full bg-indigo-500/50 border-2 border-indigo-300/60 backdrop-blur-sm text-white font-bold text-lg active:bg-indigo-400/70 touch-none select-none flex items-center justify-center"
      >
        JUMP
      </button>
    </>
  )
}
