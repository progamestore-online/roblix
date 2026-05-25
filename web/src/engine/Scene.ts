import * as THREE from 'three'

export interface SceneContext {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  clock: THREE.Clock
}

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87ceeb) // sky blue
  scene.fog = new THREE.Fog(0x87ceeb, 80, 200)

  const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 500)
  camera.position.set(0, 5, 10)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(canvas.clientWidth, canvas.clientHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambient)

  const sun = new THREE.DirectionalLight(0xffffff, 0.8)
  sun.position.set(50, 80, 30)
  sun.castShadow = true
  sun.shadow.mapSize.width = 2048
  sun.shadow.mapSize.height = 2048
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far = 200
  sun.shadow.camera.left = -60
  sun.shadow.camera.right = 60
  sun.shadow.camera.top = 60
  sun.shadow.camera.bottom = -60
  scene.add(sun)

  const clock = new THREE.Clock()

  return { scene, camera, renderer, clock }
}

export function resizeScene(ctx: SceneContext, width: number, height: number) {
  ctx.camera.aspect = width / height
  ctx.camera.updateProjectionMatrix()
  ctx.renderer.setSize(width, height)
}

export function disposeScene(ctx: SceneContext) {
  ctx.renderer.dispose()
  ctx.scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose()
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.dispose())
      } else {
        obj.material.dispose()
      }
    }
  })
}
