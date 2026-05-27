let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  const ac = getCtx()
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(volume, ac.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start()
  osc.stop(ac.currentTime + duration)
}

export function playCoinSound() {
  playTone(880, 0.1, 'sine', 0.12)
  setTimeout(() => playTone(1320, 0.15, 'sine', 0.1), 80)
}

export function playJumpSound() {
  const ac = getCtx()
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(150, ac.currentTime)
  osc.frequency.exponentialRampToValueAtTime(400, ac.currentTime + 0.12)
  gain.gain.setValueAtTime(0.08, ac.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start()
  osc.stop(ac.currentTime + 0.15)
}

export function playLandSound() {
  playTone(120, 0.08, 'triangle', 0.1)
}

export function playChatSound() {
  playTone(600, 0.05, 'sine', 0.06)
}

export function playPlaceSound() {
  playTone(220, 0.06, 'square', 0.08)
  setTimeout(() => playTone(330, 0.08, 'square', 0.06), 40)
}

export function playRemoveSound() {
  playTone(330, 0.06, 'sawtooth', 0.06)
  setTimeout(() => playTone(180, 0.1, 'sawtooth', 0.05), 40)
}

export function playDeathSound() {
  const ac = getCtx()
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(440, ac.currentTime)
  osc.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 0.5)
  gain.gain.setValueAtTime(0.18, ac.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.55)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start()
  osc.stop(ac.currentTime + 0.55)
}

export function playBounceSound() {
  const ac = getCtx()
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(220, ac.currentTime)
  osc.frequency.exponentialRampToValueAtTime(880, ac.currentTime + 0.15)
  gain.gain.setValueAtTime(0.12, ac.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.18)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start()
  osc.stop(ac.currentTime + 0.18)
}

export function playFinishSound() {
  playTone(523, 0.15, 'triangle', 0.18)
  setTimeout(() => playTone(659, 0.15, 'triangle', 0.18), 130)
  setTimeout(() => playTone(784, 0.15, 'triangle', 0.18), 260)
  setTimeout(() => playTone(1047, 0.3, 'triangle', 0.18), 390)
}
