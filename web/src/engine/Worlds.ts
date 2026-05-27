import * as THREE from 'three'
import type { AABB } from './Physics.ts'
import type { WorldData } from './World.ts'

export interface ObbyFeatures {
  finishCenter: THREE.Vector3
  finishRadius: number
}

function addBox(
  group: THREE.Group, colliders: AABB[],
  x: number, y: number, z: number,
  w: number, h: number, d: number,
  color: number, roughness = 0.7,
) {
  const geo = new THREE.BoxGeometry(w, h, d)
  const mat = new THREE.MeshStandardMaterial({ color, roughness })
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

export function createObbyWorld(): WorldData {
  const group = new THREE.Group()
  const colliders: AABB[] = []
  const coinPositions: THREE.Vector3[] = []
  const coinMeshes: THREE.Mesh[] = []
  const coinRespawnTimers: number[] = []

  // Start platform
  addBox(group, colliders, 0, 0, 0, 8, 1, 8, 0x4caf50)

  // Obstacle course — ascending platforms
  const course = [
    { x: 6, y: 2, z: 0, w: 3, d: 3, color: 0x2196f3 },
    { x: 12, y: 4, z: -2, w: 2.5, d: 2.5, color: 0xff9800 },
    { x: 16, y: 6, z: 2, w: 2, d: 2, color: 0xe91e63 },
    { x: 20, y: 5, z: 6, w: 3, d: 2, color: 0x9c27b0 },
    { x: 24, y: 7, z: 3, w: 2, d: 2, color: 0x00bcd4 },
    { x: 28, y: 9, z: 0, w: 2.5, d: 2.5, color: 0xffeb3b },
    { x: 24, y: 11, z: -4, w: 2, d: 2, color: 0x8bc34a },
    { x: 20, y: 13, z: -6, w: 3, d: 2, color: 0xff5722 },
    { x: 16, y: 15, z: -3, w: 2, d: 3, color: 0x673ab7 },
    { x: 12, y: 17, z: 0, w: 2.5, d: 2.5, color: 0x009688 },
    { x: 8, y: 19, z: 3, w: 2, d: 2, color: 0xcddc39 },
    { x: 4, y: 21, z: 0, w: 3, d: 3, color: 0x3f51b5 },
    // Thin planks
    { x: 0, y: 23, z: -4, w: 1.2, d: 4, color: 0x795548 },
    { x: -4, y: 25, z: -2, w: 4, d: 1.2, color: 0x795548 },
    { x: -8, y: 27, z: 0, w: 1.2, d: 3, color: 0x795548 },
    // Victory platform
    { x: -8, y: 29, z: 6, w: 6, d: 6, color: 0xffd700 },
  ]

  for (const p of course) {
    addBox(group, colliders, p.x, p.y, p.z, p.w, 0.5, p.d, p.color)
  }

  // Decorative hazard walls (visual only — kept transparent so players see through)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf44336, transparent: true, opacity: 0.5, roughness: 0.5 })
  for (const [wx, wy, wz] of [[14, 5, 0], [22, 8, 1], [18, 14, -4]]) {
    const wGeo = new THREE.BoxGeometry(0.3, 3, 4)
    const wall = new THREE.Mesh(wGeo, wallMat)
    wall.position.set(wx, wy, wz)
    group.add(wall)
  }

  // Finish flag on the gold victory platform
  const flagPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5, metalness: 0.5 }),
  )
  flagPole.position.set(-8, 31.5, 6)
  flagPole.castShadow = true
  group.add(flagPole)
  const flagCloth = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1),
    new THREE.MeshStandardMaterial({ color: 0xff5252, side: THREE.DoubleSide, emissive: 0x882020, emissiveIntensity: 0.4 }),
  )
  flagCloth.position.set(-7.2, 32.5, 6)
  group.add(flagCloth)
  const finishRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.5, 0.1, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffa000, emissiveIntensity: 0.7 }),
  )
  finishRing.position.set(-8, 30.1, 6)
  finishRing.rotation.x = -Math.PI / 2
  group.add(finishRing)

  // Coins along the course
  const coinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16)
  const coinMat = new THREE.MeshStandardMaterial({
    color: 0xffd700, emissive: 0xffa000, emissiveIntensity: 0.5,
    roughness: 0.2, metalness: 0.8,
  })

  for (const p of course) {
    const mesh = new THREE.Mesh(coinGeo, coinMat.clone())
    mesh.position.set(p.x, p.y + 2, p.z)
    mesh.rotation.x = Math.PI / 2
    mesh.castShadow = true
    group.add(mesh)
    coinPositions.push(new THREE.Vector3(p.x, p.y + 2, p.z))
    coinMeshes.push(mesh)
    coinRespawnTimers.push(0)
  }

  // Kill plane (lava — falling off means restart)
  colliders.push({ minX: -100, maxX: 100, minY: -2, maxY: -1, minZ: -100, maxZ: 100, type: 'lava' })

  return {
    group, colliders, coinPositions, coinMeshes, coinRespawnTimers, water: null,
    spawn: { x: 0, y: 2, z: 0 },
    obby: { finishCenter: new THREE.Vector3(-8, 30, 6), finishRadius: 3.5 },
  }
}

export function createSandboxWorld(): WorldData {
  const group = new THREE.Group()
  const colliders: AABB[] = []

  // Large flat ground
  const groundGeo = new THREE.BoxGeometry(200, 1, 200)
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.9 })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.position.y = -0.5
  ground.receiveShadow = true
  group.add(ground)
  colliders.push({ minX: -100, maxX: 100, minY: -1, maxY: 0, minZ: -100, maxZ: 100 })

  // Grid
  const grid = new THREE.GridHelper(200, 100, 0x6d4c41, 0x6d4c41)
  grid.position.y = 0.01
  group.add(grid)

  // Build area marker
  const markerGeo = new THREE.RingGeometry(0.5, 50, 64)
  const markerMat = new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.08, side: THREE.DoubleSide })
  const marker = new THREE.Mesh(markerGeo, markerMat)
  marker.rotation.x = -Math.PI / 2
  marker.position.y = 0.02
  group.add(marker)

  // Boundary walls (invisible)
  for (const w of [
    { x: 0, y: 5, z: -100, w: 200, h: 10, d: 1 },
    { x: 0, y: 5, z: 100, w: 200, h: 10, d: 1 },
    { x: -100, y: 5, z: 0, w: 1, h: 10, d: 200 },
    { x: 100, y: 5, z: 0, w: 1, h: 10, d: 200 },
  ]) {
    colliders.push({
      minX: w.x - w.w / 2, maxX: w.x + w.w / 2,
      minY: w.y - w.h / 2, maxY: w.y + w.h / 2,
      minZ: w.z - w.d / 2, maxZ: w.z + w.d / 2,
    })
  }

  return {
    group, colliders, coinPositions: [], coinMeshes: [], coinRespawnTimers: [], water: null,
    spawn: { x: 0, y: 2, z: 0 },
  }
}
