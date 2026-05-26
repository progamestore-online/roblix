import * as THREE from 'three'

interface Particle {
  mesh: THREE.Mesh
  vx: number
  vy: number
  vz: number
  life: number
  maxLife: number
}

const particles: Particle[] = []
const geo = new THREE.BoxGeometry(0.15, 0.15, 0.15)

export function spawnCoinParticles(scene: THREE.Scene, x: number, y: number, z: number) {
  for (let i = 0; i < 12; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: Math.random() > 0.5 ? 0xffd700 : 0xffa000,
      transparent: true,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, y, z)
    scene.add(mesh)
    const angle = (Math.PI * 2 * i) / 12
    const speed = 2 + Math.random() * 3
    particles.push({
      mesh,
      vx: Math.cos(angle) * speed * (0.5 + Math.random()),
      vy: 3 + Math.random() * 4,
      vz: Math.sin(angle) * speed * (0.5 + Math.random()),
      life: 0,
      maxLife: 0.4 + Math.random() * 0.3,
    })
  }
}

export function updateParticles(scene: THREE.Scene, dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.life += dt
    if (p.life >= p.maxLife) {
      scene.remove(p.mesh)
      ;(p.mesh.material as THREE.MeshBasicMaterial).dispose()
      particles.splice(i, 1)
      continue
    }
    p.vy -= 15 * dt
    p.mesh.position.x += p.vx * dt
    p.mesh.position.y += p.vy * dt
    p.mesh.position.z += p.vz * dt
    p.mesh.rotation.x += dt * 8
    p.mesh.rotation.z += dt * 6
    const alpha = 1 - p.life / p.maxLife
    ;(p.mesh.material as THREE.MeshBasicMaterial).opacity = alpha
    const scale = alpha * 0.8 + 0.2
    p.mesh.scale.setScalar(scale)
  }
}

export function disposeAllParticles(scene: THREE.Scene) {
  for (const p of particles) {
    scene.remove(p.mesh)
    ;(p.mesh.material as THREE.MeshBasicMaterial).dispose()
  }
  particles.length = 0
}
