import * as THREE from 'three'
import type { AABB } from './Physics.ts'

export interface WorldData {
  group: THREE.Group
  colliders: AABB[]
  coinPositions: THREE.Vector3[]
  coinMeshes: THREE.Mesh[]
  coinRespawnTimers: number[]
}

const COIN_RESPAWN_TIME = 15

export function createHubWorld(): WorldData {
  const group = new THREE.Group()
  const colliders: AABB[] = []
  const coinPositions: THREE.Vector3[] = []
  const coinMeshes: THREE.Mesh[] = []
  const coinRespawnTimers: number[] = []

  // Ground plane
  const groundGeo = new THREE.BoxGeometry(120, 1, 120)
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x4caf50 })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.position.y = -0.5
  ground.receiveShadow = true
  group.add(ground)
  colliders.push({ minX: -60, maxX: 60, minY: -1, maxY: 0, minZ: -60, maxZ: 60 })

  // Grid
  const gridHelper = new THREE.GridHelper(120, 60, 0x388e3c, 0x388e3c)
  gridHelper.position.y = 0.01
  group.add(gridHelper)

  // Spawn platform (slightly raised, distinct color)
  addBox(group, colliders, 0, 0.15, 0, 8, 0.3, 8, 0x78909c)
  // Spawn beacon pillars
  for (const [sx, sz] of [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]]) {
    addBox(group, colliders, sx, 1.5, sz, 0.4, 3, 0.4, 0x6366f1)
  }

  // Platforms — a parkour course
  const platformDefs = [
    { x: 8, y: 2, z: -5, w: 6, h: 0.5, d: 6, color: 0x2196f3 },
    { x: -10, y: 4, z: -8, w: 5, h: 0.5, d: 5, color: 0x9c27b0 },
    { x: 0, y: 6, z: -15, w: 4, h: 0.5, d: 4, color: 0xff9800 },
    { x: 15, y: 3, z: 5, w: 8, h: 0.5, d: 3, color: 0xe91e63 },
    { x: -15, y: 1.5, z: 10, w: 5, h: 0.5, d: 5, color: 0x00bcd4 },
    { x: 5, y: 8, z: -25, w: 6, h: 0.5, d: 6, color: 0xffeb3b },
    { x: -20, y: 6, z: -20, w: 4, h: 0.5, d: 4, color: 0x8bc34a },
    { x: 20, y: 5, z: -15, w: 5, h: 0.5, d: 3, color: 0xff5722 },
    { x: -5, y: 10, z: -30, w: 5, h: 0.5, d: 5, color: 0x673ab7 },
    { x: 25, y: 2, z: 15, w: 6, h: 0.5, d: 4, color: 0x009688 },
    { x: -25, y: 3.5, z: 20, w: 4, h: 0.5, d: 6, color: 0xcddc39 },
  ]

  for (const p of platformDefs) {
    addBox(group, colliders, p.x, p.y, p.z, p.w, p.h, p.d, p.color)
  }

  // Ramps
  const rampDefs = [
    { x: 4, z: -2, rotY: 0, length: 6, height: 2, width: 3, color: 0x795548 },
    { x: -7, z: -5, rotY: Math.PI / 4, length: 5, height: 4, width: 2.5, color: 0x607d8b },
  ]
  for (const r of rampDefs) {
    const steps = 8
    for (let i = 0; i < steps; i++) {
      const stepH = r.height / steps
      const stepL = r.length / steps
      const localX = r.x + Math.sin(r.rotY) * (i * stepL - r.length / 2)
      const localZ = r.z + Math.cos(r.rotY) * (i * stepL - r.length / 2)
      const localY = (i + 0.5) * stepH
      addBox(group, colliders, localX, localY, localZ, r.width, stepH, stepL, r.color)
    }
  }

  // Trees
  const treeMat = new THREE.MeshLambertMaterial({ color: 0x2e7d32 })
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5d4037 })
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 3, 6)
  const foliageGeo = new THREE.ConeGeometry(2, 3.5, 6)
  const foliageGeo2 = new THREE.ConeGeometry(1.6, 2.8, 6)

  const treePositions = [
    [30, 15], [-30, 10], [35, -20], [-35, -15], [20, 30],
    [-20, 25], [40, -5], [-40, 5], [10, 35], [-10, -35],
    [25, -30], [-25, -25], [45, 25], [-45, 20], [35, 40],
    [-35, 35], [15, -40], [-15, 40], [50, 10], [-50, -10],
  ]

  for (const [tx, tz] of treePositions) {
    const treeGroup = new THREE.Group()
    const trunk = new THREE.Mesh(trunkGeo, trunkMat)
    trunk.position.y = 1.5
    trunk.castShadow = true
    treeGroup.add(trunk)
    const leaves = new THREE.Mesh(foliageGeo, treeMat)
    leaves.position.y = 4.5
    leaves.castShadow = true
    treeGroup.add(leaves)
    const leavesTop = new THREE.Mesh(foliageGeo2, treeMat)
    leavesTop.position.y = 6.5
    leavesTop.castShadow = true
    treeGroup.add(leavesTop)
    treeGroup.position.set(tx, 0, tz)
    treeGroup.rotation.y = Math.random() * Math.PI * 2
    group.add(treeGroup)
    colliders.push({
      minX: tx - 0.4, maxX: tx + 0.4,
      minY: 0, maxY: 3,
      minZ: tz - 0.4, maxZ: tz + 0.4,
    })
  }

  // Tower structure
  addBox(group, colliders, -30, 2, -30, 6, 4, 6, 0x546e7a)
  addBox(group, colliders, -30, 5, -30, 4, 2, 4, 0x607d8b)
  addBox(group, colliders, -30, 8, -30, 3, 1, 3, 0x78909c)

  // Bridge
  for (let i = 0; i < 8; i++) {
    addBox(group, colliders, 15 + i * 2, 3, -10, 2.2, 0.3, 3, 0x8d6e63)
  }

  // Coins
  const coinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16)
  const coinMat = new THREE.MeshLambertMaterial({ color: 0xffd700, emissive: 0xffa000, emissiveIntensity: 0.3 })

  const coinDefs = [
    { x: 3, y: 1.5, z: 3 },
    { x: -5, y: 1.5, z: 2 },
    { x: 8, y: 3.5, z: -5 },
    { x: -10, y: 5.5, z: -8 },
    { x: 0, y: 7.5, z: -15 },
    { x: 15, y: 4.5, z: 5 },
    { x: -15, y: 3, z: 10 },
    { x: 10, y: 1.5, z: -10 },
    { x: -3, y: 1.5, z: -7 },
    { x: 5, y: 9.5, z: -25 },
    { x: -20, y: 7.5, z: -20 },
    { x: 20, y: 6.5, z: -15 },
    { x: -5, y: 11.5, z: -30 },
    { x: 25, y: 3.5, z: 15 },
    { x: -25, y: 5, z: 20 },
    { x: -30, y: 9.5, z: -30 },
    { x: 20, y: 4.5, z: -10 },
    { x: -30, y: 3.5, z: -30 },
  ]

  for (const c of coinDefs) {
    const mesh = new THREE.Mesh(coinGeo, coinMat.clone())
    mesh.position.set(c.x, c.y, c.z)
    mesh.rotation.x = Math.PI / 2
    mesh.castShadow = true
    group.add(mesh)
    coinPositions.push(new THREE.Vector3(c.x, c.y, c.z))
    coinMeshes.push(mesh)
    coinRespawnTimers.push(0)
  }

  // Boundary walls
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x424242, transparent: true, opacity: 0.15 })
  const wallDefs = [
    { x: 0, y: 5, z: -60, w: 120, h: 10, d: 1 },
    { x: 0, y: 5, z: 60, w: 120, h: 10, d: 1 },
    { x: -60, y: 5, z: 0, w: 1, h: 10, d: 120 },
    { x: 60, y: 5, z: 0, w: 1, h: 10, d: 120 },
  ]
  for (const w of wallDefs) {
    const geo = new THREE.BoxGeometry(w.w, w.h, w.d)
    const mesh = new THREE.Mesh(geo, wallMat)
    mesh.position.set(w.x, w.y, w.z)
    group.add(mesh)
    colliders.push({
      minX: w.x - w.w / 2, maxX: w.x + w.w / 2,
      minY: w.y - w.h / 2, maxY: w.y + w.h / 2,
      minZ: w.z - w.d / 2, maxZ: w.z + w.d / 2,
    })
  }

  return { group, colliders, coinPositions, coinMeshes, coinRespawnTimers }
}

function addBox(
  group: THREE.Group, colliders: AABB[],
  x: number, y: number, z: number,
  w: number, h: number, d: number,
  color: number,
) {
  const geo = new THREE.BoxGeometry(w, h, d)
  const mat = new THREE.MeshLambertMaterial({ color })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  colliders.push({
    minX: x - w / 2, maxX: x + w / 2,
    minY: y - h / 2, maxY: y + h / 2,
    minZ: z - d / 2, maxZ: z + d / 2,
  })
}

export function animateCoins(world: WorldData, time: number, dt: number) {
  for (let i = 0; i < world.coinMeshes.length; i++) {
    const mesh = world.coinMeshes[i]
    if (!mesh.visible) {
      world.coinRespawnTimers[i] -= dt
      if (world.coinRespawnTimers[i] <= 0) {
        mesh.visible = true
        mesh.position.copy(world.coinPositions[i])
      }
      continue
    }
    mesh.rotation.z = time * 2
    mesh.position.y = world.coinPositions[i].y + Math.sin(time * 3 + i) * 0.3
  }
}

export function collectCoins(world: WorldData, px: number, py: number, pz: number): number {
  let collected = 0
  const COLLECT_RADIUS = 1.5
  for (let i = 0; i < world.coinMeshes.length; i++) {
    const mesh = world.coinMeshes[i]
    if (!mesh.visible) continue
    const cp = world.coinPositions[i]
    const dx = px - cp.x
    const dy = py + 1.5 - cp.y
    const dz = pz - cp.z
    if (dx * dx + dy * dy + dz * dz < COLLECT_RADIUS * COLLECT_RADIUS) {
      mesh.visible = false
      world.coinRespawnTimers[i] = COIN_RESPAWN_TIME
      collected++
    }
  }
  return collected
}
