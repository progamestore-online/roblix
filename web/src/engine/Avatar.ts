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

export function createAvatar(colors: AvatarColors, name?: string): AvatarMesh {
  const group = new THREE.Group()

  // Head (1.2 x 1.2 x 1.2)
  const headGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2)
  const headMat = new THREE.MeshStandardMaterial({ color: colors.head, roughness: 0.7, metalness: 0.0 })
  const head = new THREE.Mesh(headGeo, headMat)
  head.position.y = 3.1
  head.castShadow = true
  group.add(head)

  // Face — eyes and mouth on front of head
  const eyeGeo = new THREE.BoxGeometry(0.2, 0.2, 0.05)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a2e })
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat)
  leftEye.position.set(-0.25, 3.2, 0.61)
  group.add(leftEye)
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat)
  rightEye.position.set(0.25, 3.2, 0.61)
  group.add(rightEye)

  // Pupils (white highlights)
  const pupilGeo = new THREE.BoxGeometry(0.08, 0.08, 0.02)
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const lPupil = new THREE.Mesh(pupilGeo, pupilMat)
  lPupil.position.set(-0.2, 3.24, 0.63)
  group.add(lPupil)
  const rPupil = new THREE.Mesh(pupilGeo, pupilMat)
  rPupil.position.set(0.3, 3.24, 0.63)
  group.add(rPupil)

  // Smile
  const smileGeo = new THREE.BoxGeometry(0.4, 0.08, 0.05)
  const smileMat = new THREE.MeshBasicMaterial({ color: 0x1a1a2e })
  const smile = new THREE.Mesh(smileGeo, smileMat)
  smile.position.set(0, 2.9, 0.61)
  group.add(smile)

  // Torso (1.4 x 1.6 x 0.8)
  const torsoGeo = new THREE.BoxGeometry(1.4, 1.6, 0.8)
  const torsoMat = new THREE.MeshStandardMaterial({ color: colors.torso, roughness: 0.8, metalness: 0.0 })
  const torso = new THREE.Mesh(torsoGeo, torsoMat)
  torso.position.y = 1.8
  torso.castShadow = true
  group.add(torso)

  // Arms (0.5 x 1.4 x 0.5)
  const armGeo = new THREE.BoxGeometry(0.5, 1.4, 0.5)
  const armMat = new THREE.MeshStandardMaterial({ color: colors.arms, roughness: 0.7, metalness: 0.0 })

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
  const legMat = new THREE.MeshStandardMaterial({ color: colors.legs, roughness: 0.8, metalness: 0.0 })

  const leftLeg = new THREE.Mesh(legGeo, legMat.clone())
  leftLeg.position.set(-0.35, 0.5, 0)
  leftLeg.castShadow = true
  group.add(leftLeg)

  const rightLeg = new THREE.Mesh(legGeo, legMat.clone())
  rightLeg.position.set(0.35, 0.5, 0)
  rightLeg.castShadow = true
  group.add(rightLeg)

  // Name tag
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
  ;(avatar.head.material as THREE.MeshStandardMaterial).color.set(colors.head)
  ;(avatar.torso.material as THREE.MeshStandardMaterial).color.set(colors.torso)
  ;(avatar.leftArm.material as THREE.MeshStandardMaterial).color.set(colors.arms)
  ;(avatar.rightArm.material as THREE.MeshStandardMaterial).color.set(colors.arms)
  ;(avatar.leftLeg.material as THREE.MeshStandardMaterial).color.set(colors.legs)
  ;(avatar.rightLeg.material as THREE.MeshStandardMaterial).color.set(colors.legs)
}

export function animateWalk(avatar: AvatarMesh, time: number, speed: number, emote?: string | null) {
  if (emote) {
    animateEmote(avatar, time, emote)
    return
  }
  if (speed < 0.01) {
    avatar.leftArm.rotation.x *= 0.85
    avatar.rightArm.rotation.x *= 0.85
    avatar.leftLeg.rotation.x *= 0.85
    avatar.rightLeg.rotation.x *= 0.85
    avatar.leftArm.rotation.z = 0
    avatar.rightArm.rotation.z = 0
    return
  }
  const swing = Math.sin(time * 8) * 0.5
  avatar.leftArm.rotation.x = swing
  avatar.rightArm.rotation.x = -swing
  avatar.leftLeg.rotation.x = -swing
  avatar.rightLeg.rotation.x = swing
  avatar.leftArm.rotation.z = 0
  avatar.rightArm.rotation.z = 0
}

function animateEmote(avatar: AvatarMesh, time: number, emote: string) {
  switch (emote) {
    case 'wave':
      avatar.rightArm.rotation.x = 0
      avatar.rightArm.rotation.z = -Math.PI / 2 + Math.sin(time * 6) * 0.3
      avatar.leftArm.rotation.x = 0
      avatar.leftArm.rotation.z = 0
      avatar.leftLeg.rotation.x = 0
      avatar.rightLeg.rotation.x = 0
      break
    case 'dance':
      avatar.leftArm.rotation.x = Math.sin(time * 10) * 0.8
      avatar.rightArm.rotation.x = Math.sin(time * 10 + Math.PI) * 0.8
      avatar.leftArm.rotation.z = Math.sin(time * 5) * 0.3
      avatar.rightArm.rotation.z = -Math.sin(time * 5) * 0.3
      avatar.leftLeg.rotation.x = Math.sin(time * 10 + Math.PI) * 0.4
      avatar.rightLeg.rotation.x = Math.sin(time * 10) * 0.4
      break
    case 'sit':
      avatar.leftLeg.rotation.x = -Math.PI / 2
      avatar.rightLeg.rotation.x = -Math.PI / 2
      avatar.leftArm.rotation.x = -0.2
      avatar.rightArm.rotation.x = -0.2
      avatar.leftArm.rotation.z = 0
      avatar.rightArm.rotation.z = 0
      break
    case 'cheer':
      avatar.leftArm.rotation.x = 0
      avatar.rightArm.rotation.x = 0
      avatar.leftArm.rotation.z = Math.PI / 2 + Math.sin(time * 8) * 0.2
      avatar.rightArm.rotation.z = -Math.PI / 2 - Math.sin(time * 8) * 0.2
      avatar.leftLeg.rotation.x = Math.sin(time * 4) * 0.1
      avatar.rightLeg.rotation.x = -Math.sin(time * 4) * 0.1
      break
  }
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
