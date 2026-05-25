import type * as THREE from 'three'
import type { PhysicsBody } from './Physics.ts'
import { jump } from './Physics.ts'

export interface InputState {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  jump: boolean
}

const MOVE_SPEED = 8
const CAMERA_DISTANCE = 12
const CAMERA_HEIGHT = 6
const CAMERA_LERP = 5

export function createInputState(): InputState {
  return { forward: false, backward: false, left: false, right: false, jump: false }
}

export function bindInputListeners(
  input: InputState,
  canvas: HTMLCanvasElement,
  onChatFocus: () => boolean,
) {
  function onKeyDown(e: KeyboardEvent) {
    if (onChatFocus()) return
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': input.forward = true; break
      case 'KeyS': case 'ArrowDown': input.backward = true; break
      case 'KeyA': case 'ArrowLeft': input.left = true; break
      case 'KeyD': case 'ArrowRight': input.right = true; break
      case 'Space': input.jump = true; e.preventDefault(); break
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': input.forward = false; break
      case 'KeyS': case 'ArrowDown': input.backward = false; break
      case 'KeyA': case 'ArrowLeft': input.left = false; break
      case 'KeyD': case 'ArrowRight': input.right = false; break
      case 'Space': input.jump = false; break
    }
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  // Pointer lock for mouse-look
  canvas.addEventListener('click', () => {
    if (!onChatFocus()) {
      canvas.requestPointerLock()
    }
  })

  let yaw = 0
  function onMouseMove(e: MouseEvent) {
    if (document.pointerLockElement === canvas) {
      yaw -= e.movementX * 0.003
    }
  }
  document.addEventListener('mousemove', onMouseMove)

  function getYaw() { return yaw }

  function cleanup() {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    document.removeEventListener('mousemove', onMouseMove)
  }

  return { cleanup, getYaw }
}

export function applyInput(
  input: InputState,
  body: PhysicsBody,
  yaw: number,
) {
  let dx = 0
  let dz = 0

  if (input.forward) { dx += Math.sin(yaw); dz += Math.cos(yaw) }
  if (input.backward) { dx -= Math.sin(yaw); dz -= Math.cos(yaw) }
  if (input.left) { dx += Math.cos(yaw); dz -= Math.sin(yaw) }
  if (input.right) { dx -= Math.cos(yaw); dz += Math.sin(yaw) }

  // Normalize diagonal movement
  const len = Math.sqrt(dx * dx + dz * dz)
  if (len > 0) {
    dx = (dx / len) * MOVE_SPEED
    dz = (dz / len) * MOVE_SPEED
  }

  body.vx = dx
  body.vz = dz

  if (input.jump) {
    jump(body)
  }
}

export function updateCamera(
  camera: THREE.PerspectiveCamera,
  body: PhysicsBody,
  yaw: number,
  dt: number,
) {
  // Third-person camera behind and above the player
  const targetX = body.x - Math.sin(yaw) * CAMERA_DISTANCE
  const targetY = body.y + CAMERA_HEIGHT
  const targetZ = body.z - Math.cos(yaw) * CAMERA_DISTANCE

  const lerp = 1 - Math.exp(-CAMERA_LERP * dt)
  camera.position.x += (targetX - camera.position.x) * lerp
  camera.position.y += (targetY - camera.position.y) * lerp
  camera.position.z += (targetZ - camera.position.z) * lerp

  // Look at player
  camera.lookAt(body.x, body.y + 2, body.z)
}
