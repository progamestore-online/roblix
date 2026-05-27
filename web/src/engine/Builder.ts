import * as THREE from 'three'
import type { AABB } from './Physics.ts'

const BLOCK_SIZE = 2
const GRID_HALF = 60

export interface BlockData {
  x: number
  y: number
  z: number
  color: number
}

export interface BuilderState {
  group: THREE.Group
  blocks: Map<string, { mesh: THREE.Mesh; color: number }>
  colliders: AABB[]
  ghostBlock: THREE.Mesh
  selectedColor: number
  enabled: boolean
}

const BLOCK_COLORS = [
  0xe53935, 0xd81b60, 0x8e24aa, 0x5e35b1,
  0x3949ab, 0x1e88e5, 0x039be5, 0x00acc1,
  0x00897b, 0x43a047, 0x7cb342, 0xc0ca33,
  0xfdd835, 0xffb300, 0xfb8c00, 0xf4511e,
  0x6d4c41, 0x757575, 0x546e7a, 0xffffff,
]

export { BLOCK_COLORS }

function blockKey(x: number, y: number, z: number) {
  return `${x},${y},${z}`
}

function snapToGrid(v: number): number {
  return Math.round(v / BLOCK_SIZE) * BLOCK_SIZE
}

export function createBuilder(): BuilderState {
  const group = new THREE.Group()

  const ghostGeo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE)
  const ghostMat = new THREE.MeshStandardMaterial({
    color: 0x1e88e5,
    transparent: true,
    opacity: 0.35,
    roughness: 0.5,
  })
  const ghostBlock = new THREE.Mesh(ghostGeo, ghostMat)
  ghostBlock.visible = false
  group.add(ghostBlock)

  return {
    group,
    blocks: new Map(),
    colliders: [],
    ghostBlock,
    selectedColor: BLOCK_COLORS[5],
    enabled: false,
  }
}

export function updateGhostBlock(
  builder: BuilderState,
  playerX: number,
  playerY: number,
  playerZ: number,
  yaw: number,
) {
  if (!builder.enabled) {
    builder.ghostBlock.visible = false
    return
  }

  const dist = 5
  const px = snapToGrid(playerX + Math.sin(yaw) * dist)
  const py = snapToGrid(playerY + 1)
  const pz = snapToGrid(playerZ + Math.cos(yaw) * dist)

  const clamped = Math.max(-GRID_HALF, Math.min(GRID_HALF, px))
  const clampedZ = Math.max(-GRID_HALF, Math.min(GRID_HALF, pz))
  const clampedY = Math.max(0, py)

  builder.ghostBlock.position.set(clamped, clampedY + BLOCK_SIZE / 2, clampedZ)
  builder.ghostBlock.visible = true
  ;(builder.ghostBlock.material as THREE.MeshStandardMaterial).color.set(builder.selectedColor)
}

export function placeBlock(builder: BuilderState, worldColliders: AABB[]): BlockData | null {
  if (!builder.enabled || !builder.ghostBlock.visible) return null

  const pos = builder.ghostBlock.position
  const gx = snapToGrid(pos.x)
  const gy = snapToGrid(pos.y - BLOCK_SIZE / 2)
  const gz = snapToGrid(pos.z)
  const key = blockKey(gx, gy, gz)

  if (builder.blocks.has(key)) return null

  const geo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE)
  const mat = new THREE.MeshStandardMaterial({
    color: builder.selectedColor,
    roughness: 0.7,
    metalness: 0.05,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(gx, gy + BLOCK_SIZE / 2, gz)
  mesh.castShadow = true
  mesh.receiveShadow = true
  builder.group.add(mesh)

  builder.blocks.set(key, { mesh, color: builder.selectedColor })

  const collider: AABB = {
    minX: gx - BLOCK_SIZE / 2,
    maxX: gx + BLOCK_SIZE / 2,
    minY: gy,
    maxY: gy + BLOCK_SIZE,
    minZ: gz - BLOCK_SIZE / 2,
    maxZ: gz + BLOCK_SIZE / 2,
  }
  builder.colliders.push(collider)
  worldColliders.push(collider)

  return { x: gx, y: gy, z: gz, color: builder.selectedColor }
}

export function removeBlock(
  builder: BuilderState,
  worldColliders: AABB[],
): BlockData | null {
  if (!builder.enabled || !builder.ghostBlock.visible) return null

  const pos = builder.ghostBlock.position
  const gx = snapToGrid(pos.x)
  const gy = snapToGrid(pos.y - BLOCK_SIZE / 2)
  const gz = snapToGrid(pos.z)
  const key = blockKey(gx, gy, gz)

  const existing = builder.blocks.get(key)
  if (!existing) return null

  builder.group.remove(existing.mesh)
  existing.mesh.geometry.dispose()
  ;(existing.mesh.material as THREE.MeshStandardMaterial).dispose()
  builder.blocks.delete(key)

  const idx = builder.colliders.findIndex(c =>
    Math.abs(c.minX - (gx - BLOCK_SIZE / 2)) < 0.01 &&
    Math.abs(c.minY - gy) < 0.01 &&
    Math.abs(c.minZ - (gz - BLOCK_SIZE / 2)) < 0.01,
  )
  if (idx !== -1) {
    const removed = builder.colliders.splice(idx, 1)[0]
    const wi = worldColliders.indexOf(removed)
    if (wi !== -1) worldColliders.splice(wi, 1)
  }

  return { x: gx, y: gy, z: gz, color: existing.color }
}

export function setBuilderColor(builder: BuilderState, color: number) {
  builder.selectedColor = color
}

export function disposeBuilder(builder: BuilderState) {
  for (const [, block] of builder.blocks) {
    block.mesh.geometry.dispose()
    ;(block.mesh.material as THREE.MeshStandardMaterial).dispose()
  }
  builder.ghostBlock.geometry.dispose()
  ;(builder.ghostBlock.material as THREE.MeshStandardMaterial).dispose()
}
