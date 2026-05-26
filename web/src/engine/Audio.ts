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
