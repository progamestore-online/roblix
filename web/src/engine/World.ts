import * as THREE from 'three'
import type { AABB } from './Physics.ts'

export interface WorldData {
  group: THREE.Group
  colliders: AABB[]
  coinPositions: THREE.Vector3[]
  coinMeshes: THREE.Mesh[]
}

/** Build the Hub World — ground plane, platforms, ramps, coins */
export function createHubWorld(): WorldData {
  const group = new THREE.Group()
  const colliders: AABB[] = []
  const coinPositions: THREE.Vector3[] = []
  const coinMeshes: THREE.Mesh[] = []

  // Ground plane
  const groundGeo = new THREE.BoxGeometry(100, 1, 100)
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x4caf50 })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.position.y = -0.5
  ground.receiveShadow = true
  group.add(ground)
  colliders.push({ minX: -50, maxX: 50, minY: -1, maxY: 0, minZ: -50, maxZ: 50 })

  // Decorative grid pattern on ground
  const gridHelper = new THREE.GridHelper(100, 50, 0x388e3c, 0x388e3c)
  gridHelper.position.y = 0.01
  group.add(gridHelper)

  // Platforms
  const platformDefs = [
    { x: 8, y: 2, z: -5, w: 6, h: 0.5, d: 6, color: 0x2196f3 },
    { x: -10, y: 4, z: -8, w: 5, h: 0.5, d: 5, color: 0x9c27b0 },
    { x: 0, y: 6, z: -15, w: 4, h: 0.5, d: 4, color: 0xff9800 },
    { x: 15, y: 3, z: 5, w: 8, h: 0.5, d: 3, color: 0xe91e63 },
    { x: -15, y: 1.5, z: 10, w: 5, h: 0.5, d: 5, color: 0x00bcd4 },
    { x: 5, y: 8, z: -25, w: 6, h: 0.5, d: 6, color: 0xffeb3b },
  ]

  for (const p of platformDefs) {
    const geo = new THREE.BoxGeometry(p.w, p.h, p.d)
    const mat = new THREE.MeshLambertMaterial({ color: p.color })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(p.x, p.y, p.z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    colliders.push({
      minX: p.x - p.w / 2, maxX: p.x + p.w / 2,
      minY: p.y - p.h / 2, maxY: p.y + p.h / 2,
      minZ: p.z - p.d / 2, maxZ: p.z + p.d / 2,
    })
  }

  // Ramps
  const rampDefs = [
    { x: 4, z: -2, rotY: 0, length: 6, height: 2, width: 3, color: 0x795548 },
    { x: -7, z: -5, rotY: Math.PI / 4, length: 5, height: 4, width: 2.5, color: 0x607d8b },
  ]

  for (const r of rampDefs) {
    // Build ramp as a series of steps (simpler collisions)
    const steps = 8
    for (let i = 0; i < steps; i++) {
      const stepH = (r.height / steps)
      const stepL = (r.length / steps)
      const geo = new THREE.BoxGeometry(r.width, stepH, stepL)
      const mat = new THREE.MeshLambertMaterial({ color: r.color })
      const mesh = new THREE.Mesh(geo, mat)
      const localX = r.x + Math.sin(r.rotY) * (i * stepL - r.length / 2)
      const localZ = r.z + Math.cos(r.rotY) * (i * stepL - r.length / 2)
      const localY = (i + 0.5) * stepH
      mesh.position.set(localX, localY, localZ)
      mesh.rotation.y = r.rotY
      mesh.castShadow = true
      mesh.receiveShadow = true
      group.add(mesh)
      colliders.push({
        minX: localX - r.width / 2, maxX: localX + r.width / 2,
        minY: localY - stepH / 2, maxY: localY + stepH / 2,
        minZ: localZ - stepL / 2, maxZ: localZ + stepL / 2,
      })
    }
  }

  // Coins (collectible floating cylinders)
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
  ]

  for (const c of coinDefs) {
    const mesh = new THREE.Mesh(coinGeo, coinMat.clone())
    mesh.position.set(c.x, c.y, c.z)
    mesh.rotation.x = Math.PI / 2
    mesh.castShadow = true
    group.add(mesh)
    coinPositions.push(new THREE.Vector3(c.x, c.y, c.z))
    coinMeshes.push(mesh)
  }

  // Decorative walls / boundaries
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x424242, transparent: true, opacity: 0.3 })
  const wallDefs = [
    { x: 0, y: 5, z: -50, w: 100, h: 10, d: 1 },
    { x: 0, y: 5, z: 50, w: 100, h: 10, d: 1 },
    { x: -50, y: 5, z: 0, w: 1, h: 10, d: 100 },
    { x: 50, y: 5, z: 0, w: 1, h: 10, d: 100 },
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

  return { group, colliders, coinPositions, coinMeshes }
}

/** Animate coins (rotation + bobbing) */
export function animateCoins(world: WorldData, time: number) {
  for (let i = 0; i < world.coinMeshes.length; i++) {
    const mesh = world.coinMeshes[i]
    if (!mesh.visible) continue
    mesh.rotation.z = time * 2
    mesh.position.y = world.coinPositions[i].y + Math.sin(time * 3 + i) * 0.3
  }
}

/** Check if player is near a coin and collect it. Returns number of coins collected this frame. */
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
      collected++
    }
  }
  return collected
}
