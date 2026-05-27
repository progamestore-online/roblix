import * as THREE from 'three'
import type { AABB, BlockType } from './Physics.ts'

const BLOCK_SIZE = 2
const GRID_HALF = 60

export interface BlockData {
  x: number
  y: number
  z: number
  color: number
  type: BlockType
}

export interface BuilderState {
  group: THREE.Group
  blocks: Map<string, { mesh: THREE.Mesh; color: number; type: BlockType }>
  colliders: AABB[]
  ghostBlock: THREE.Mesh
  selectedColor: number
  selectedType: BlockType
  enabled: boolean
}

const BLOCK_COLORS = [
  0xe53935, 0xd81b60, 0x8e24aa, 0x5e35b1,
  0x3949ab, 0x1e88e5, 0x039be5, 0x00acc1,
  0x00897b, 0x43a047, 0x7cb342, 0xc0ca33,
  0xfdd835, 0xffb300, 0xfb8c00, 0xf4511e,
  0x6d4c41, 0x757575, 0x546e7a, 0xffffff,
]

export const BLOCK_TYPES: BlockType[] = ['solid', 'lava', 'bounce', 'ice', 'glass']

export { BLOCK_COLORS }

// Animatable surfaces (lava emissive pulse, ice shimmer) — game loop calls tickBlockAnimations.
const animatedMaterials: { mat: THREE.MeshStandardMaterial; type: BlockType }[] = []

export function tickBlockAnimations(elapsed: number) {
  for (const entry of animatedMaterials) {
    if (entry.type === 'lava') {
      entry.mat.emissiveIntensity = 0.6 + Math.sin(elapsed * 3) * 0.25
    }
  }
}

function makeBlockMaterial(color: number, type: BlockType): THREE.MeshStandardMaterial {
  switch (type) {
    case 'lava': {
      const m = new THREE.MeshStandardMaterial({
        color: 0xff5722,
        emissive: 0xff3300,
        emissiveIntensity: 0.7,
        roughness: 0.4,
        metalness: 0.1,
      })
      animatedMaterials.push({ mat: m, type: 'lava' })
      return m
    }
    case 'bounce':
      return new THREE.MeshStandardMaterial({
        color: 0x00e676,
        emissive: 0x00c853,
        emissiveIntensity: 0.2,
        roughness: 0.3,
        metalness: 0.2,
      })
    case 'ice':
      return new THREE.MeshStandardMaterial({
        color: 0xb3e5fc,
        roughness: 0.05,
        metalness: 0.3,
        transparent: true,
        opacity: 0.85,
      })
    case 'glass':
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.05,
        metalness: 0.0,
        transparent: true,
        opacity: 0.35,
      })
    case 'solid':
    default:
      return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05 })
  }
}

function disposeAnimatedMaterial(mat: THREE.MeshStandardMaterial) {
  const idx = animatedMaterials.findIndex(e => e.mat === mat)
  if (idx !== -1) animatedMaterials.splice(idx, 1)
}

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
    selectedType: 'solid',
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
  const ghostMat = builder.ghostBlock.material as THREE.MeshStandardMaterial
  // Ghost color reflects intended type for placement readability.
  switch (builder.selectedType) {
    case 'lava': ghostMat.color.set(0xff5722); break
    case 'bounce': ghostMat.color.set(0x00e676); break
    case 'ice': ghostMat.color.set(0xb3e5fc); break
    default: ghostMat.color.set(builder.selectedColor)
  }
}

export function placeBlock(builder: BuilderState, worldColliders: AABB[]): BlockData | null {
  if (!builder.enabled || !builder.ghostBlock.visible) return null

  const pos = builder.ghostBlock.position
  const gx = snapToGrid(pos.x)
  const gy = snapToGrid(pos.y - BLOCK_SIZE / 2)
  const gz = snapToGrid(pos.z)
  const key = blockKey(gx, gy, gz)

  if (builder.blocks.has(key)) return null

  const type = builder.selectedType
  const geo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE)
  const mat = makeBlockMaterial(builder.selectedColor, type)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(gx, gy + BLOCK_SIZE / 2, gz)
  mesh.castShadow = type !== 'glass' && type !== 'ice'
  mesh.receiveShadow = type !== 'glass'
  builder.group.add(mesh)

  builder.blocks.set(key, { mesh, color: builder.selectedColor, type })

  const collider: AABB = {
    minX: gx - BLOCK_SIZE / 2,
    maxX: gx + BLOCK_SIZE / 2,
    minY: gy,
    maxY: gy + BLOCK_SIZE,
    minZ: gz - BLOCK_SIZE / 2,
    maxZ: gz + BLOCK_SIZE / 2,
    type,
  }
  builder.colliders.push(collider)
  worldColliders.push(collider)

  return { x: gx, y: gy, z: gz, color: builder.selectedColor, type }
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
  const mat = existing.mesh.material as THREE.MeshStandardMaterial
  disposeAnimatedMaterial(mat)
  mat.dispose()
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

  return { x: gx, y: gy, z: gz, color: existing.color, type: existing.type }
}

export function addBlockFromServer(
  builder: BuilderState,
  worldColliders: AABB[],
  x: number, y: number, z: number, color: number, type: BlockType = 'solid',
) {
  const key = blockKey(x, y, z)
  if (builder.blocks.has(key)) return

  const geo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE)
  const mat = makeBlockMaterial(color, type)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, y + BLOCK_SIZE / 2, z)
  mesh.castShadow = type !== 'glass' && type !== 'ice'
  mesh.receiveShadow = type !== 'glass'
  builder.group.add(mesh)
  builder.blocks.set(key, { mesh, color, type })

  const collider: AABB = {
    minX: x - BLOCK_SIZE / 2, maxX: x + BLOCK_SIZE / 2,
    minY: y, maxY: y + BLOCK_SIZE,
    minZ: z - BLOCK_SIZE / 2, maxZ: z + BLOCK_SIZE / 2,
    type,
  }
  builder.colliders.push(collider)
  worldColliders.push(collider)
}

export function removeBlockFromServer(
  builder: BuilderState,
  worldColliders: AABB[],
  x: number, y: number, z: number,
) {
  const key = blockKey(x, y, z)
  const existing = builder.blocks.get(key)
  if (!existing) return

  builder.group.remove(existing.mesh)
  existing.mesh.geometry.dispose()
  const mat = existing.mesh.material as THREE.MeshStandardMaterial
  disposeAnimatedMaterial(mat)
  mat.dispose()
  builder.blocks.delete(key)

  const idx = builder.colliders.findIndex(c =>
    Math.abs(c.minX - (x - BLOCK_SIZE / 2)) < 0.01 &&
    Math.abs(c.minY - y) < 0.01 &&
    Math.abs(c.minZ - (z - BLOCK_SIZE / 2)) < 0.01,
  )
  if (idx !== -1) {
    const removed = builder.colliders.splice(idx, 1)[0]
    const wi = worldColliders.indexOf(removed)
    if (wi !== -1) worldColliders.splice(wi, 1)
  }
}

export function setBuilderColor(builder: BuilderState, color: number) {
  builder.selectedColor = color
}

export function setBuilderType(builder: BuilderState, type: BlockType) {
  builder.selectedType = type
}

export function disposeBuilder(builder: BuilderState) {
  for (const [, block] of builder.blocks) {
    block.mesh.geometry.dispose()
    const mat = block.mesh.material as THREE.MeshStandardMaterial
    disposeAnimatedMaterial(mat)
    mat.dispose()
  }
  builder.blocks.clear()
  builder.ghostBlock.geometry.dispose()
  ;(builder.ghostBlock.material as THREE.MeshStandardMaterial).dispose()
  // Defensive: clear leftover animated entries from any prior session.
  animatedMaterials.length = 0
}
