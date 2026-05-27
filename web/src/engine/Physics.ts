export type BlockType = 'solid' | 'lava' | 'bounce' | 'ice' | 'glass'

export interface AABB {
  minX: number; maxX: number
  minY: number; maxY: number
  minZ: number; maxZ: number
  type?: BlockType
}

export interface PhysicsBody {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  width: number
  height: number
  depth: number
  grounded: boolean
  killed: boolean
  onIce: boolean
}

const GRAVITY = -25
const TERMINAL_VELOCITY = -40
const JUMP_VELOCITY = 14
const BOUNCE_VELOCITY = 22

export function createBody(x: number, y: number, z: number): PhysicsBody {
  return {
    x, y, z,
    vx: 0, vy: 0, vz: 0,
    width: 1.4,
    height: 3.8,
    depth: 1.4,
    grounded: false,
    killed: false,
    onIce: false,
  }
}

export function getAABB(body: PhysicsBody): AABB {
  const hw = body.width / 2
  const hd = body.depth / 2
  return {
    minX: body.x - hw,
    maxX: body.x + hw,
    minY: body.y,
    maxY: body.y + body.height,
    minZ: body.z - hd,
    maxZ: body.z + hd,
  }
}

export function aabbIntersects(a: AABB, b: AABB): boolean {
  return (
    a.minX < b.maxX && a.maxX > b.minX &&
    a.minY < b.maxY && a.maxY > b.minY &&
    a.minZ < b.maxZ && a.maxZ > b.minZ
  )
}

export function jump(body: PhysicsBody) {
  if (body.grounded) {
    body.vy = JUMP_VELOCITY
    body.grounded = false
  }
}

export function stepPhysics(body: PhysicsBody, dt: number, colliders: AABB[]) {
  // Apply gravity
  body.vy += GRAVITY * dt
  if (body.vy < TERMINAL_VELOCITY) body.vy = TERMINAL_VELOCITY

  // Move Y and resolve
  body.y += body.vy * dt
  body.grounded = false
  body.onIce = false

  const bodyAABB = getAABB(body)
  for (const col of colliders) {
    if (aabbIntersects(bodyAABB, col)) {
      if (col.type === 'lava') {
        body.killed = true
      }
      if (body.vy <= 0) {
        // Landing on top
        body.y = col.maxY
        if (col.type === 'bounce') {
          body.vy = BOUNCE_VELOCITY
          body.grounded = false
        } else {
          body.vy = 0
          body.grounded = true
          if (col.type === 'ice') body.onIce = true
        }
      } else {
        // Hit ceiling
        body.y = col.minY - body.height
        body.vy = 0
      }
      // Recompute after correction
      const corrected = getAABB(body)
      Object.assign(bodyAABB, corrected)
    }
  }

  // Move X and resolve
  body.x += body.vx * dt
  const afterX = getAABB(body)
  for (const col of colliders) {
    if (aabbIntersects(afterX, col)) {
      if (col.type === 'lava') body.killed = true
      if (body.vx > 0) {
        body.x = col.minX - body.width / 2
      } else {
        body.x = col.maxX + body.width / 2
      }
      body.vx = 0
      Object.assign(afterX, getAABB(body))
    }
  }

  // Move Z and resolve
  body.z += body.vz * dt
  const afterZ = getAABB(body)
  for (const col of colliders) {
    if (aabbIntersects(afterZ, col)) {
      if (col.type === 'lava') body.killed = true
      if (body.vz > 0) {
        body.z = col.minZ - body.depth / 2
      } else {
        body.z = col.maxZ + body.depth / 2
      }
      body.vz = 0
      Object.assign(afterZ, getAABB(body))
    }
  }

  // Prevent falling through the void
  if (body.y < -50) {
    body.killed = true
  }
}

export function respawnBody(body: PhysicsBody, x: number, y: number, z: number) {
  body.x = x
  body.y = y
  body.z = z
  body.vx = 0
  body.vy = 0
  body.vz = 0
  body.grounded = false
  body.killed = false
  body.onIce = false
}
