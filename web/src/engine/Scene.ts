import * as THREE from 'three'

export interface SceneContext {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  clock: THREE.Clock
  sun: THREE.DirectionalLight
  skyDome: THREE.Mesh
  clouds: THREE.Group
  ambientParticles: THREE.Points
}

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0xa8d8f0, 0.008)

  const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 500)
  camera.position.set(0, 5, 10)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(canvas.clientWidth, canvas.clientHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1

  // Sky dome
  const skyGeo = new THREE.SphereGeometry(250, 32, 16)
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x3a7bd5) },
      bottomColor: { value: new THREE.Color(0xc4e0f9) },
      offset: { value: 20 },
      exponent: { value: 0.4 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `,
  })
  const skyDome = new THREE.Mesh(skyGeo, skyMat)
  scene.add(skyDome)

  // Clouds
  const clouds = new THREE.Group()
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })
  for (let i = 0; i < 20; i++) {
    const cloudGroup = new THREE.Group()
    const puffCount = 3 + Math.floor(Math.random() * 4)
    for (let j = 0; j < puffCount; j++) {
      const size = 3 + Math.random() * 5
      const puffGeo = new THREE.SphereGeometry(size, 8, 6)
      const puff = new THREE.Mesh(puffGeo, cloudMat)
      puff.position.set(
        (Math.random() - 0.5) * size * 2,
        (Math.random() - 0.3) * size * 0.5,
        (Math.random() - 0.5) * size,
      )
      puff.scale.y = 0.4 + Math.random() * 0.2
      cloudGroup.add(puff)
    }
    cloudGroup.position.set(
      (Math.random() - 0.5) * 300,
      60 + Math.random() * 40,
      (Math.random() - 0.5) * 300,
    )
    clouds.add(cloudGroup)
  }
  scene.add(clouds)

  // Hemisphere light for natural sky/ground bounce
  const hemi = new THREE.HemisphereLight(0x87ceeb, 0x4caf50, 0.4)
  scene.add(hemi)

  // Ambient fill
  const ambient = new THREE.AmbientLight(0xffffff, 0.3)
  scene.add(ambient)

  // Sun
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.0)
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
  sun.shadow.bias = -0.001
  scene.add(sun)

  // Ambient floating particles
  const particleCount = 200
  const particleGeo = new THREE.BufferGeometry()
  const positions = new Float32Array(particleCount * 3)
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 120
    positions[i * 3 + 1] = 1 + Math.random() * 20
    positions[i * 3 + 2] = (Math.random() - 0.5) * 120
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const particleMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.15,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  })
  const ambientParticles = new THREE.Points(particleGeo, particleMat)
  scene.add(ambientParticles)

  const clock = new THREE.Clock()

  return { scene, camera, renderer, clock, sun, skyDome, clouds, ambientParticles }
}

export function updateScene(ctx: SceneContext, time: number, sprinting = false) {
  // Sprint FOV
  const targetFov = sprinting ? 72 : 60
  ctx.camera.fov += (targetFov - ctx.camera.fov) * 0.08
  ctx.camera.updateProjectionMatrix()

  // Day/night cycle (5 minutes full cycle)
  const dayPhase = (time % 300) / 300
  const sunAngle = dayPhase * Math.PI * 2
  const sunHeight = Math.sin(sunAngle)
  const isDaytime = sunHeight > -0.1

  ctx.sun.position.set(
    Math.cos(sunAngle) * 80,
    sunHeight * 80 + 10,
    30,
  )
  ctx.sun.intensity = isDaytime ? Math.max(0.2, sunHeight) * 1.0 : 0.05

  const skyMat = ctx.skyDome.material as THREE.ShaderMaterial
  if (sunHeight > 0.2) {
    skyMat.uniforms.topColor.value.setHex(0x3a7bd5)
    skyMat.uniforms.bottomColor.value.setHex(0xc4e0f9)
  } else if (sunHeight > -0.1) {
    const t = (sunHeight + 0.1) / 0.3
    skyMat.uniforms.topColor.value.lerpColors(new THREE.Color(0x0a1128), new THREE.Color(0x3a7bd5), t)
    skyMat.uniforms.bottomColor.value.lerpColors(new THREE.Color(0x1a1a2e), new THREE.Color(0xc4e0f9), t)
  } else {
    skyMat.uniforms.topColor.value.setHex(0x0a1128)
    skyMat.uniforms.bottomColor.value.setHex(0x1a1a2e)
  }

  // Drift clouds
  for (const cloud of ctx.clouds.children) {
    cloud.position.x += 0.02
    if (cloud.position.x > 160) cloud.position.x = -160
  }

  // Animate ambient particles (gentle drift + bob)
  const positions = ctx.ambientParticles.geometry.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i)
    positions.setY(i, y + Math.sin(time + i * 0.5) * 0.003)
    const x = positions.getX(i)
    positions.setX(i, x + 0.002)
    if (positions.getX(i) > 60) positions.setX(i, -60)
  }
  positions.needsUpdate = true
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
    if (obj instanceof THREE.Points) {
      obj.geometry.dispose()
      ;(obj.material as THREE.PointsMaterial).dispose()
    }
  })
}
