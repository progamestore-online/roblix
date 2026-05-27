import * as THREE from 'three'
import type { AABB } from './Physics.ts'

export interface WorldData {
  group: THREE.Group
  colliders: AABB[]
  coinPositions: THREE.Vector3[]
  coinMeshes: THREE.Mesh[]
  coinRespawnTimers: number[]
  water: THREE.Mesh | null
  spawn: { x: number; y: number; z: number }
  obby?: { finishCenter: THREE.Vector3; finishRadius: number }
}

const COIN_RESPAWN_TIME = 15

export function createHubWorld(): WorldData {
  const group = new THREE.Group()
  const colliders: AABB[] = []
  const coinPositions: THREE.Vector3[] = []
  const coinMeshes: THREE.Mesh[] = []
  const coinRespawnTimers: number[] = []

  // Ground
  const groundGeo = new THREE.BoxGeometry(120, 1, 120)
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x5cb85c, roughness: 0.9, metalness: 0.0 })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.position.y = -0.5
  ground.receiveShadow = true
  group.add(ground)
  colliders.push({ minX: -60, maxX: 60, minY: -1, maxY: 0, minZ: -60, maxZ: 60 })

  // Grass patches (darker/lighter spots for texture)
  const patchGeo = new THREE.CircleGeometry(3, 8)
  const patchColors = [0x4caf50, 0x66bb6a, 0x43a047, 0x388e3c]
  for (let i = 0; i < 60; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: patchColors[i % patchColors.length],
      roughness: 1.0,
      metalness: 0.0,
    })
    const patch = new THREE.Mesh(patchGeo, mat)
    patch.rotation.x = -Math.PI / 2
    patch.position.set(
      (Math.random() - 0.5) * 110,
      0.01,
      (Math.random() - 0.5) * 110,
    )
    patch.scale.setScalar(0.5 + Math.random() * 1.5)
    patch.receiveShadow = true
    group.add(patch)
  }

  // Spawn platform
  addBox(group, colliders, 0, 0.15, 0, 8, 0.3, 8, 0x78909c, 0.5, 0.3)
  for (const [sx, sz] of [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]]) {
    addBox(group, colliders, sx, 1.5, sz, 0.4, 3, 0.4, 0x6366f1, 0.4, 0.5)
    // Beacon light on top
    const lightGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3)
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0x818cf8,
      emissive: 0x6366f1,
      emissiveIntensity: 0.8,
      roughness: 0.3,
    })
    const lightMesh = new THREE.Mesh(lightGeo, lightMat)
    lightMesh.position.set(sx, 3.15, sz)
    group.add(lightMesh)
  }

  // Platforms
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
    addBox(group, colliders, p.x, p.y, p.z, p.w, p.h, p.d, p.color, 0.6, 0.2)
    // Edge glow strip on top
    const glowGeo = new THREE.BoxGeometry(p.w + 0.1, 0.05, p.d + 0.1)
    const glowMat = new THREE.MeshStandardMaterial({
      color: p.color,
      emissive: p.color,
      emissiveIntensity: 0.3,
      roughness: 0.3,
      transparent: true,
      opacity: 0.6,
    })
    const glow = new THREE.Mesh(glowGeo, glowMat)
    glow.position.set(p.x, p.y + p.h / 2 + 0.025, p.z)
    group.add(glow)
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
      addBox(group, colliders, localX, localY, localZ, r.width, stepH, stepL, r.color, 0.8, 0.0)
    }
  }

  // Trees — varied sizes and foliage colors
  const foliageColors = [0x2e7d32, 0x388e3c, 0x1b5e20, 0x4caf50, 0x33691e]
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 3, 6)
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 })
  const foliageGeo = new THREE.ConeGeometry(2, 3.5, 6)
  const foliageGeo2 = new THREE.ConeGeometry(1.6, 2.8, 6)

  const treePositions = [
    [30, 15], [-30, 10], [35, -20], [-35, -15], [20, 30],
    [-20, 25], [40, -5], [-40, 5], [10, 35], [-10, -35],
    [25, -30], [-25, -25], [45, 25], [-45, 20], [35, 40],
    [-35, 35], [15, -40], [-15, 40], [50, 10], [-50, -10],
  ]

  for (let ti = 0; ti < treePositions.length; ti++) {
    const [tx, tz] = treePositions[ti]
    const scale = 0.7 + Math.random() * 0.6
    const treeGroup = new THREE.Group()
    const trunk = new THREE.Mesh(trunkGeo, trunkMat)
    trunk.position.y = 1.5 * scale
    trunk.scale.setScalar(scale)
    trunk.castShadow = true
    treeGroup.add(trunk)
    const leafColor = foliageColors[ti % foliageColors.length]
    const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.8 })
    const leaves = new THREE.Mesh(foliageGeo, leafMat)
    leaves.position.y = 4.5 * scale
    leaves.scale.setScalar(scale)
    leaves.castShadow = true
    treeGroup.add(leaves)
    const leavesTop = new THREE.Mesh(foliageGeo2, leafMat)
    leavesTop.position.y = 6.5 * scale
    leavesTop.scale.setScalar(scale)
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

  // Rocks scattered around
  const rockGeo = new THREE.DodecahedronGeometry(1, 0)
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x757575, roughness: 0.95, metalness: 0.05 })
  const rockPositions = [
    [12, 8], [-18, 15], [38, -25], [-42, 30], [8, -38],
    [-8, 42], [28, 22], [-33, -18], [48, -15], [-48, 8],
    [5, 20], [-12, -22], [22, -35], [-38, -35], [42, 35],
  ]
  for (const [rx, rz] of rockPositions) {
    const s = 0.3 + Math.random() * 0.7
    const rock = new THREE.Mesh(rockGeo, rockMat)
    rock.position.set(rx, s * 0.4, rz)
    rock.scale.set(s, s * 0.6, s)
    rock.rotation.set(Math.random(), Math.random(), Math.random())
    rock.castShadow = true
    rock.receiveShadow = true
    group.add(rock)
  }

  // Flowers
  const flowerColors = [0xff4081, 0xffeb3b, 0x7c4dff, 0xff6e40, 0x69f0ae]
  const stemGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4)
  const stemMat = new THREE.MeshBasicMaterial({ color: 0x388e3c })
  const petalGeo = new THREE.SphereGeometry(0.12, 6, 4)
  for (let i = 0; i < 40; i++) {
    const fx = (Math.random() - 0.5) * 100
    const fz = (Math.random() - 0.5) * 100
    const flowerGroup = new THREE.Group()
    const stem = new THREE.Mesh(stemGeo, stemMat)
    stem.position.y = 0.25
    flowerGroup.add(stem)
    const petalMat = new THREE.MeshBasicMaterial({ color: flowerColors[i % flowerColors.length] })
    const petal = new THREE.Mesh(petalGeo, petalMat)
    petal.position.y = 0.55
    flowerGroup.add(petal)
    flowerGroup.position.set(fx, 0, fz)
    group.add(flowerGroup)
  }

  // Tower
  addBox(group, colliders, -30, 2, -30, 6, 4, 6, 0x546e7a, 0.7, 0.1)
  addBox(group, colliders, -30, 5, -30, 4, 2, 4, 0x607d8b, 0.7, 0.1)
  addBox(group, colliders, -30, 8, -30, 3, 1, 3, 0x78909c, 0.6, 0.15)
  // Tower flag
  const flagPoleGeo = new THREE.CylinderGeometry(0.05, 0.05, 3, 4)
  const flagPoleMat = new THREE.MeshStandardMaterial({ color: 0x9e9e9e, metalness: 0.8 })
  const flagPole = new THREE.Mesh(flagPoleGeo, flagPoleMat)
  flagPole.position.set(-30, 10, -30)
  group.add(flagPole)
  const flagGeo = new THREE.PlaneGeometry(1.5, 0.8)
  const flagMat = new THREE.MeshStandardMaterial({
    color: 0xe91e63,
    side: THREE.DoubleSide,
    roughness: 0.9,
  })
  const flag = new THREE.Mesh(flagGeo, flagMat)
  flag.position.set(-29.2, 10.8, -30)
  group.add(flag)

  // Bridge with railings
  for (let i = 0; i < 8; i++) {
    addBox(group, colliders, 15 + i * 2, 3, -10, 2.2, 0.3, 3, 0x8d6e63, 0.85, 0.0)
    // Railing posts
    if (i % 2 === 0) {
      const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 4)
      const postMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.8 })
      for (const side of [-1.3, 1.3]) {
        const post = new THREE.Mesh(postGeo, postMat)
        post.position.set(15 + i * 2, 3.75, -10 + side)
        post.castShadow = true
        group.add(post)
      }
    }
  }

  // Water pond
  const waterGeo = new THREE.CircleGeometry(8, 32)
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1e88e5,
    transparent: true,
    opacity: 0.6,
    roughness: 0.1,
    metalness: 0.3,
    side: THREE.DoubleSide,
  })
  const water = new THREE.Mesh(waterGeo, waterMat)
  water.rotation.x = -Math.PI / 2
  water.position.set(35, 0.05, 30)
  water.receiveShadow = true
  group.add(water)

  // Pond edge rocks
  for (let a = 0; a < Math.PI * 2; a += 0.5) {
    const r = 7.5 + Math.random() * 1.5
    const s = 0.3 + Math.random() * 0.5
    const edgeRock = new THREE.Mesh(rockGeo, rockMat)
    edgeRock.position.set(35 + Math.cos(a) * r, s * 0.3, 30 + Math.sin(a) * r)
    edgeRock.scale.set(s, s * 0.5, s)
    edgeRock.rotation.y = Math.random() * Math.PI
    edgeRock.castShadow = true
    group.add(edgeRock)
  }

  // Coins
  const coinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16)
  const coinMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xffa000,
    emissiveIntensity: 0.5,
    roughness: 0.2,
    metalness: 0.8,
  })

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

  // Boundary walls (invisible)
  const wallDefs = [
    { x: 0, y: 5, z: -60, w: 120, h: 10, d: 1 },
    { x: 0, y: 5, z: 60, w: 120, h: 10, d: 1 },
    { x: -60, y: 5, z: 0, w: 1, h: 10, d: 120 },
    { x: 60, y: 5, z: 0, w: 1, h: 10, d: 120 },
  ]
  for (const w of wallDefs) {
    colliders.push({
      minX: w.x - w.w / 2, maxX: w.x + w.w / 2,
      minY: w.y - w.h / 2, maxY: w.y + w.h / 2,
      minZ: w.z - w.d / 2, maxZ: w.z + w.d / 2,
    })
  }

  return {
    group, colliders, coinPositions, coinMeshes, coinRespawnTimers, water,
    spawn: { x: 0, y: 2, z: 0 },
  }
}

function addBox(
  group: THREE.Group, colliders: AABB[],
  x: number, y: number, z: number,
  w: number, h: number, d: number,
  color: number,
  roughness = 0.7,
  metalness = 0.0,
) {
  const geo = new THREE.BoxGeometry(w, h, d)
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness })
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

  // Animate water
  if (world.water) {
    world.water.position.y = 0.05 + Math.sin(time * 0.8) * 0.03
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
