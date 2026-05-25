import * as THREE from 'three'

export interface AvatarColors {
  head: string
  torso: string
  arms: string
  legs: string
}

export interface AvatarMesh {
  group: THREE.Group
  head: THREE.Mesh
  torso: THREE.Mesh
  leftArm: THREE.Mesh
  rightArm: THREE.Mesh
  leftLeg: THREE.Mesh
  rightLeg: THREE.Mesh
  nameTag: THREE.Sprite | null
}

/** Create a blocky Roblox-style avatar from box geometries */
export function createAvatar(colors: AvatarColors, name?: string): AvatarMesh {
  const group = new THREE.Group()

  // Head (1.2 x 1.2 x 1.2)
  const headGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2)
  const headMat = new THREE.MeshLambertMaterial({ color: colors.head })
  const head = new THREE.Mesh(headGeo, headMat)
  head.position.y = 3.1
  head.castShadow = true
  group.add(head)

  // Torso (1.4 x 1.6 x 0.8)
  const torsoGeo = new THREE.BoxGeometry(1.4, 1.6, 0.8)
  const torsoMat = new THREE.MeshLambertMaterial({ color: colors.torso })
  const torso = new THREE.Mesh(torsoGeo, torsoMat)
  torso.position.y = 1.8
  torso.castShadow = true
  group.add(torso)

  // Arms (0.5 x 1.4 x 0.5)
  const armGeo = new THREE.BoxGeometry(0.5, 1.4, 0.5)
  const armMat = new THREE.MeshLambertMaterial({ color: colors.arms })

  const leftArm = new THREE.Mesh(armGeo, armMat.clone())
  leftArm.position.set(-0.95, 1.8, 0)
  leftArm.castShadow = true
  group.add(leftArm)

  const rightArm = new THREE.Mesh(armGeo, armMat.clone())
  rightArm.position.set(0.95, 1.8, 0)
  rightArm.castShadow = true
  group.add(rightArm)

  // Legs (0.6 x 1.4 x 0.6)
  const legGeo = new THREE.BoxGeometry(0.6, 1.4, 0.6)
  const legMat = new THREE.MeshLambertMaterial({ color: colors.legs })

  const leftLeg = new THREE.Mesh(legGeo, legMat.clone())
  leftLeg.position.set(-0.35, 0.5, 0)
  leftLeg.castShadow = true
  group.add(leftLeg)

  const rightLeg = new THREE.Mesh(legGeo, legMat.clone())
  rightLeg.position.set(0.35, 0.5, 0)
  rightLeg.castShadow = true
  group.add(rightLeg)

  // Name tag (floating text above head)
  let nameTag: THREE.Sprite | null = null
  if (name) {
    nameTag = createNameTag(name)
    nameTag.position.y = 4.2
    group.add(nameTag)
  }

  return { group, head, torso, leftArm, rightArm, leftLeg, rightLeg, nameTag }
}

function createNameTag(name: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.roundRect(0, 0, 256, 64, 8)
  ctx.fill()
  ctx.font = 'bold 28px system-ui'
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name.slice(0, 16), 128, 32)

  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(3, 0.75, 1)
  return sprite
}

export function updateAvatarColors(avatar: AvatarMesh, colors: AvatarColors) {
  ;(avatar.head.material as THREE.MeshLambertMaterial).color.set(colors.head)
  ;(avatar.torso.material as THREE.MeshLambertMaterial).color.set(colors.torso)
  ;(avatar.leftArm.material as THREE.MeshLambertMaterial).color.set(colors.arms)
  ;(avatar.rightArm.material as THREE.MeshLambertMaterial).color.set(colors.arms)
  ;(avatar.leftLeg.material as THREE.MeshLambertMaterial).color.set(colors.legs)
  ;(avatar.rightLeg.material as THREE.MeshLambertMaterial).color.set(colors.legs)
}

/** Simple walk animation — swing arms and legs */
export function animateWalk(avatar: AvatarMesh, time: number, speed: number) {
  if (speed < 0.01) {
    // Idle — reset to neutral
    avatar.leftArm.rotation.x = 0
    avatar.rightArm.rotation.x = 0
    avatar.leftLeg.rotation.x = 0
    avatar.rightLeg.rotation.x = 0
    return
  }
  const swing = Math.sin(time * 8) * 0.5
  avatar.leftArm.rotation.x = swing
  avatar.rightArm.rotation.x = -swing
  avatar.leftLeg.rotation.x = -swing
  avatar.rightLeg.rotation.x = swing
}

export function disposeAvatar(avatar: AvatarMesh) {
  avatar.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose()
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.dispose())
      } else {
        obj.material.dispose()
      }
    }
    if (obj instanceof THREE.Sprite) {
      obj.material.map?.dispose()
      obj.material.dispose()
    }
  })
}
