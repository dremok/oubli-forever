/**
 * THE DARKROOM — develop memories into photographs
 *
 * A photographic darkroom where memories become images. Under red safelight,
 * you choose a memory (or write a new prompt), and the system "develops" it
 * into a photograph using fal.ai. The image emerges slowly — first as dark
 * nothing, then shapes appear in the developer tray, then the full image
 * resolves.
 *
 * The room maintains a gallery of developed prints that persists in
 * localStorage. Old prints yellow and fade over time. You can only develop
 * one print per visit (like a real darkroom session).
 *
 * Visual style: Deep red safelight, chemical trays, the slow magic of
 * analog photography. A meditation on how we develop memories into
 * fixed images, and how those images still decay.
 *
 * Inspired by: Analog photography, Man Ray's rayographs, Gerhard Richter's
 * photo-paintings, the darkroom as transformative space, developing as
 * metaphor for memory consolidation
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'
import { shareDarkroomPrint, fetchDarkroomPrints, type GhostPrint } from '../shared/FootprintReporter'

interface DarkroomDeps {
  getMemories: () => StoredMemory[]
  switchTo?: (name: string) => void
}

interface DevelopedPrint {
  id: string
  prompt: string
  imageUrl: string
  timestamp: number
  age: number // 0-1, how much the print has yellowed
}

const STORAGE_KEY = 'oubli-darkroom-prints'
const MAX_PRINTS = 12

const CULTURAL_INSCRIPTIONS = [
  'man ray held objects directly on photographic paper — the image was the thing itself, no camera needed',
  'gerhard richter painted over his own photographs, blurring the line between memory and invention',
  'the daguerreotype was a mirror that remembered — binh danh still uses the process, folding viewers into landscapes',
  'in a darkroom, you learn to see in reverse — what was light becomes shadow, what was shadow becomes form',
  'film photography sales up 127% since 2020 — gen z calls it "intentional seeing" — #filmtok at 2.8 billion views',
  'the decisive moment (cartier-bresson) — one click freezes time, but the photographer forgets everything before and after',
  'kidney cells form memories. nerve tissue activates memory genes. the body remembers what the brain cannot',
  'a boltzmann brain could fluctuate into existence with a complete set of false memories — are yours real?',
  'community darkrooms are reopening across the world — shared darkness as collective practice',
  'an ape chose a cup of imaginary juice over an empty one — the first pretend play outside human minds',
  'spider silk\'s strength comes from invisible molecular bonds — the glue you can\'t see holds everything together',
  'episodic and semantic memory are neurologically indistinguishable — knowing and remembering are the same act',
  'the helsinki analog festival theme is BODY — photography as something you do with your hands, in the dark',
  'empac\'s "staging grounds" restages experience across time — a thai myth evoked, a forbidden frontier field-recorded',
  'she speaks: black women artists encoding historical memory into art that outlives the forgetting',
  'every photograph is an act of embalming — you stop time, coat it in silver, and call it remembering',
  'rijksmuseum FAKE! (2026): photo manipulation existed in the 1860s. scissors, glue, ink, pencil.',
  'the composite photograph is older than the camera itself. every image was always a construction.',
  'parkinson\'s blood test: the brain decays 20 years before you notice. the darkroom develops what was always there.',
]

interface DustMote {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
}

export function createDarkroomRoom(deps: DarkroomDeps): Room {
  let overlay: HTMLElement | null = null
  let active = false
  let developing = false
  let prints: DevelopedPrint[] = loadPrints()

  // --- Audio state ---
  let audioInitialized = false
  let audioMaster: GainNode | null = null
  let droneOsc: OscillatorNode | null = null
  let droneFilter: BiquadFilterNode | null = null
  let droneGain: GainNode | null = null
  let dripInterval: ReturnType<typeof setTimeout> | null = null
  let tickInterval: ReturnType<typeof setInterval> | null = null
  let revealOsc: OscillatorNode | null = null
  let revealGain: GainNode | null = null

  // --- Visual state ---
  let safelightEl: HTMLElement | null = null
  let rippleCanvas: HTMLCanvasElement | null = null
  let rippleCtx: CanvasRenderingContext2D | null = null
  let dustCanvas: HTMLCanvasElement | null = null
  let dustCtx: CanvasRenderingContext2D | null = null
  let dustMotes: DustMote[] = []
  let ripples: { x: number; y: number; r: number; maxR: number; alpha: number }[] = []
  let animFrameId = 0

  // --- Cultural inscription state ---
  let inscriptionEl: HTMLElement | null = null
  let inscriptionIdx = 0
  let inscriptionTimer: ReturnType<typeof setInterval> | null = null

  // --- Chemical stain state ---
  interface ChemicalStain {
    x: number; y: number
    radius: number; maxRadius: number
    hue: number; alpha: number
    age: number
  }
  let stainCanvas: HTMLCanvasElement | null = null
  let stainCtx: CanvasRenderingContext2D | null = null
  let stains: ChemicalStain[] = []
  let lastStainTime = 0

  // --- Enlarger light cone state ---
  let enlargerCanvas: HTMLCanvasElement | null = null
  let enlargerCtx: CanvasRenderingContext2D | null = null
  let enlargerAngle = 0

  // Ghost prints from other visitors
  let ghostPrints: GhostPrint[] = []
  let ghostPrintsLoaded = false
  let ghostGalleryEl: HTMLElement | null = null

  function loadPrints(): DevelopedPrint[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const p = JSON.parse(stored) as DevelopedPrint[]
        // Age prints based on time elapsed
        const now = Date.now()
        for (const print of p) {
          const days = (now - print.timestamp) / (1000 * 60 * 60 * 24)
          print.age = Math.min(days * 0.05, 0.8) // 5% per day, max 80%
        }
        return p
      }
    } catch { /* */ }
    return []
  }

  function savePrints() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prints))
    } catch { /* */ }
  }

  // === AUDIO SYSTEM ===

  async function initAudio() {
    if (audioInitialized) return
    try {
      const ac = await getAudioContext()
      const dest = getAudioDestination()

      audioMaster = ac.createGain()
      audioMaster.gain.value = 0
      audioMaster.connect(dest)

      // Darkroom ambience: triangle wave 50Hz through lowpass 100Hz
      droneOsc = ac.createOscillator()
      droneOsc.type = 'triangle'
      droneOsc.frequency.value = 50

      droneFilter = ac.createBiquadFilter()
      droneFilter.type = 'lowpass'
      droneFilter.frequency.value = 100
      droneFilter.Q.value = 0.7

      droneGain = ac.createGain()
      droneGain.gain.value = 0

      droneOsc.connect(droneFilter)
      droneFilter.connect(droneGain)
      droneGain.connect(audioMaster)
      droneOsc.start()

      audioInitialized = true

      // Fade master in
      const now = ac.currentTime
      audioMaster.gain.setValueAtTime(0, now)
      audioMaster.gain.linearRampToValueAtTime(1, now + 2)

      // Fade drone in
      droneGain.gain.setValueAtTime(0, now)
      droneGain.gain.linearRampToValueAtTime(0.01, now + 3)

      // Start water drip loop
      scheduleDrip()
    } catch {
      // Audio not available — degrade gracefully
    }
  }

  function scheduleDrip() {
    if (!active) return
    const delay = 4000 + Math.random() * 6000 // 4-10 seconds
    dripInterval = setTimeout(() => {
      playDrip()
      scheduleDrip()
    }, delay)
  }

  function playDrip() {
    if (!audioInitialized || !audioMaster) return
    try {
      const ac = audioMaster.context as AudioContext
      const now = ac.currentTime

      // Short filtered noise burst — bandpass 2000Hz
      const bufferSize = Math.floor(ac.sampleRate * 0.01) // 10ms
      const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) // decaying noise
      }

      const source = ac.createBufferSource()
      source.buffer = buffer

      const filter = ac.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 2000
      filter.Q.value = 2

      const gain = ac.createGain()
      gain.gain.setValueAtTime(0.02, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)

      // Simple reverb tail via delay + feedback
      const delay = ac.createDelay(0.3)
      delay.delayTime.value = 0.12 + Math.random() * 0.08
      const fbGain = ac.createGain()
      fbGain.gain.value = 0.25
      const wetGain = ac.createGain()
      wetGain.gain.value = 0.015

      source.connect(filter)
      filter.connect(gain)
      gain.connect(audioMaster)

      // Wet path
      gain.connect(delay)
      delay.connect(fbGain)
      fbGain.connect(delay)
      delay.connect(wetGain)
      wetGain.connect(audioMaster)

      source.start(now)
      source.onended = () => {
        source.disconnect()
        filter.disconnect()
        gain.disconnect()
        // Let reverb tail ring out then disconnect
        setTimeout(() => {
          delay.disconnect()
          fbGain.disconnect()
          wetGain.disconnect()
        }, 500)
      }

      // Spawn a visual ripple in the tray area
      if (rippleCanvas) {
        ripples.push({
          x: rippleCanvas.width * (0.3 + Math.random() * 0.4),
          y: rippleCanvas.height * (0.3 + Math.random() * 0.4),
          r: 0,
          maxR: 20 + Math.random() * 30,
          alpha: 0.25,
        })
      }
    } catch { /* ignore */ }
  }

  function startTimerTick() {
    if (tickInterval || !audioInitialized || !audioMaster) return
    const ac = audioMaster.context as AudioContext
    tickInterval = setInterval(() => {
      if (!audioMaster || !active) return
      try {
        const now = ac.currentTime
        // 3ms noise burst
        const bufferSize = Math.floor(ac.sampleRate * 0.003)
        const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1)
        }
        const source = ac.createBufferSource()
        source.buffer = buffer
        const gain = ac.createGain()
        gain.gain.setValueAtTime(0.03, now)
        gain.gain.linearRampToValueAtTime(0, now + 0.02)
        source.connect(gain)
        gain.connect(audioMaster)
        source.start(now)
        source.onended = () => { source.disconnect(); gain.disconnect() }
      } catch { /* ignore */ }
    }, 1000)
  }

  function stopTimerTick() {
    if (tickInterval) {
      clearInterval(tickInterval)
      tickInterval = null
    }
  }

  function playChemicalSplash() {
    if (!audioInitialized || !audioMaster) return
    try {
      const ac = audioMaster.context as AudioContext
      const now = ac.currentTime

      // 200ms filtered noise — bandpass sweep 500-1500Hz
      const bufferSize = Math.floor(ac.sampleRate * 0.2)
      const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1
      }

      const source = ac.createBufferSource()
      source.buffer = buffer

      const filter = ac.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(500, now)
      filter.frequency.linearRampToValueAtTime(1500, now + 0.1)
      filter.frequency.linearRampToValueAtTime(800, now + 0.2)
      filter.Q.value = 1.5

      const gain = ac.createGain()
      // Quick attack, slow decay
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.02, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)

      source.connect(filter)
      filter.connect(gain)
      gain.connect(audioMaster)
      source.start(now)
      source.onended = () => {
        source.disconnect()
        filter.disconnect()
        gain.disconnect()
      }
    } catch { /* ignore */ }
  }

  function startRevealTone(durationMs: number) {
    if (!audioInitialized || !audioMaster) return
    try {
      const ac = audioMaster.context as AudioContext
      const now = ac.currentTime
      const dur = durationMs / 1000

      revealOsc = ac.createOscillator()
      revealOsc.type = 'sine'
      revealOsc.frequency.setValueAtTime(100, now)
      revealOsc.frequency.linearRampToValueAtTime(200, now + dur)

      revealGain = ac.createGain()
      revealGain.gain.setValueAtTime(0, now)
      revealGain.gain.linearRampToValueAtTime(0.01, now + dur * 0.2)
      revealGain.gain.setValueAtTime(0.01, now + dur * 0.8)
      revealGain.gain.linearRampToValueAtTime(0, now + dur)

      revealOsc.connect(revealGain)
      revealGain.connect(audioMaster)
      revealOsc.start(now)
      revealOsc.stop(now + dur + 0.1)
      revealOsc.onended = () => {
        revealOsc?.disconnect()
        revealGain?.disconnect()
        revealOsc = null
        revealGain = null
      }
    } catch { /* ignore */ }
  }

  function stopRevealTone() {
    if (revealOsc && revealGain) {
      try {
        const ac = revealOsc.context as AudioContext
        const now = ac.currentTime
        revealGain.gain.cancelScheduledValues(now)
        revealGain.gain.setValueAtTime(revealGain.gain.value, now)
        revealGain.gain.linearRampToValueAtTime(0, now + 0.2)
        revealOsc.stop(now + 0.3)
      } catch { /* ignore */ }
    }
  }

  function fadeAudioOut() {
    if (!audioMaster) return
    const ac = audioMaster.context as AudioContext
    const now = ac.currentTime
    audioMaster.gain.cancelScheduledValues(now)
    audioMaster.gain.setValueAtTime(audioMaster.gain.value, now)
    audioMaster.gain.linearRampToValueAtTime(0, now + 0.5)
    stopTimerTick()
    if (dripInterval) { clearTimeout(dripInterval); dripInterval = null }
  }

  function destroyAudio() {
    fadeAudioOut()
    stopRevealTone()
    setTimeout(() => {
      try { droneOsc?.stop() } catch { /* */ }
      droneOsc?.disconnect()
      droneFilter?.disconnect()
      droneGain?.disconnect()
      audioMaster?.disconnect()
      droneOsc = null
      droneFilter = null
      droneGain = null
      audioMaster = null
      audioInitialized = false
    }, 600)
  }

  // === VISUAL EFFECTS ===

  function initDustMotes() {
    dustMotes = []
    for (let i = 0; i < 6; i++) {
      dustMotes.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.0003,
        vy: -0.0001 - Math.random() * 0.0002, // drift upward
        size: 1 + Math.random() * 1.5,
        alpha: 0.15 + Math.random() * 0.25,
      })
    }
  }

  function renderVisualEffects() {
    if (!active) return
    animFrameId = requestAnimationFrame(renderVisualEffects)

    const now = performance.now() / 1000

    // Safelight flicker: 1-2% chance per frame
    if (safelightEl && Math.random() < 0.015) {
      const brightness = 0.6 + Math.random() * 0.8
      safelightEl.style.opacity = String(brightness)
      setTimeout(() => {
        if (safelightEl) safelightEl.style.opacity = '1'
      }, 50 + Math.random() * 100)
    }

    // Dust motes
    if (dustCtx && dustCanvas) {
      const dw = dustCanvas.width
      const dh = dustCanvas.height
      dustCtx.clearRect(0, 0, dw, dh)
      for (const mote of dustMotes) {
        mote.x += mote.vx
        mote.y += mote.vy
        // Wrap around
        if (mote.y < -0.02) mote.y = 1.02
        if (mote.x < -0.02) mote.x = 1.02
        if (mote.x > 1.02) mote.x = -0.02

        const px = mote.x * dw
        const py = mote.y * dh
        dustCtx.beginPath()
        dustCtx.arc(px, py, mote.size, 0, Math.PI * 2)
        dustCtx.fillStyle = `rgba(200, 80, 60, ${mote.alpha})`
        dustCtx.fill()
      }
    }

    // Chemical ripples
    if (rippleCtx && rippleCanvas) {
      const rw = rippleCanvas.width
      const rh = rippleCanvas.height
      rippleCtx.clearRect(0, 0, rw, rh)
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i]
        rip.r += 0.4
        rip.alpha *= 0.985
        if (rip.alpha < 0.01 || rip.r > rip.maxR) {
          ripples.splice(i, 1)
          continue
        }
        rippleCtx.beginPath()
        rippleCtx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2)
        rippleCtx.strokeStyle = `rgba(200, 80, 60, ${rip.alpha})`
        rippleCtx.lineWidth = 0.5
        rippleCtx.stroke()
      }
    }

    // Chemical stains — spawn new ones every 12-20 seconds
    if (stainCtx && stainCanvas) {
      const sw = stainCanvas.width
      const sh = stainCanvas.height

      if (now - lastStainTime > 12 + Math.random() * 8) {
        if (stains.length < 8) {
          stains.push({
            x: Math.random() * sw,
            y: Math.random() * sh,
            radius: 0,
            maxRadius: 15 + Math.random() * 35,
            hue: 350 + Math.random() * 20, // reddish-brown
            alpha: 0.03 + Math.random() * 0.04,
            age: 0,
          })
        }
        lastStainTime = now
      }

      // Don't clear — stains accumulate permanently
      for (const stain of stains) {
        if (stain.radius < stain.maxRadius) {
          stain.radius += 0.08
          stain.age += 0.016

          const grad = stainCtx.createRadialGradient(
            stain.x, stain.y, 0,
            stain.x, stain.y, stain.radius
          )
          const a = stain.alpha * (1 - stain.radius / stain.maxRadius)
          grad.addColorStop(0, `hsla(${stain.hue}, 60%, 25%, ${a})`)
          grad.addColorStop(0.6, `hsla(${stain.hue}, 50%, 18%, ${a * 0.5})`)
          grad.addColorStop(1, 'transparent')
          stainCtx.fillStyle = grad
          stainCtx.fillRect(stain.x - stain.radius, stain.y - stain.radius,
            stain.radius * 2, stain.radius * 2)
        }
      }
    }

    // Enlarger light cone — subtle swaying cone of red light from above
    if (enlargerCtx && enlargerCanvas) {
      const ew = enlargerCanvas.width
      const eh = enlargerCanvas.height
      enlargerCtx.clearRect(0, 0, ew, eh)

      enlargerAngle += 0.003
      const sway = Math.sin(enlargerAngle) * 15
      const cx = ew / 2 + sway
      const topW = 8
      const botW = 80 + Math.sin(enlargerAngle * 0.7) * 10
      const coneH = eh * 0.5

      const grad = enlargerCtx.createLinearGradient(cx, 0, cx, coneH)
      grad.addColorStop(0, 'rgba(180, 40, 30, 0.06)')
      grad.addColorStop(0.5, 'rgba(180, 40, 30, 0.03)')
      grad.addColorStop(1, 'rgba(180, 40, 30, 0)')

      enlargerCtx.fillStyle = grad
      enlargerCtx.beginPath()
      enlargerCtx.moveTo(cx - topW, 0)
      enlargerCtx.lineTo(cx + topW, 0)
      enlargerCtx.lineTo(cx + botW, coneH)
      enlargerCtx.lineTo(cx - botW, coneH)
      enlargerCtx.closePath()
      enlargerCtx.fill()

      // Bright point at top — the enlarger bulb
      const bulbGrad = enlargerCtx.createRadialGradient(cx, 4, 0, cx, 4, 12)
      bulbGrad.addColorStop(0, 'rgba(200, 60, 40, 0.12)')
      bulbGrad.addColorStop(1, 'transparent')
      enlargerCtx.fillStyle = bulbGrad
      enlargerCtx.fillRect(cx - 12, 0, 24, 16)
    }
  }

  function getRandomMemoryPrompt(): string {
    const memories = deps.getMemories()
    if (memories.length === 0) return ''
    const mem = memories[Math.floor(Math.random() * memories.length)]
    return mem.currentText
  }

  function generateProceduralPrint(prompt: string): string {
    // Create a procedural darkroom print from the text
    const size = 400
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')!

    // Seed RNG from prompt text
    let seed = 0
    for (let i = 0; i < prompt.length; i++) {
      seed = ((seed << 5) - seed + prompt.charCodeAt(i)) | 0
    }
    const rng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }

    // Dark background with subtle warmth
    const bgR = 8 + Math.floor(rng() * 12)
    const bgG = 4 + Math.floor(rng() * 8)
    const bgB = 2 + Math.floor(rng() * 6)
    ctx.fillStyle = `rgb(${bgR}, ${bgG}, ${bgB})`
    ctx.fillRect(0, 0, size, size)

    // Extract words for visual seeds
    const words = prompt.toLowerCase().split(/\s+/).filter(w => w.length > 2)

    // Layer 1: Large radial gradient washes (2-4)
    const washes = 2 + Math.floor(rng() * 3)
    for (let i = 0; i < washes; i++) {
      const cx = rng() * size
      const cy = rng() * size
      const radius = 80 + rng() * 180
      const warmth = rng()
      const r = Math.floor(120 + warmth * 80)
      const g = Math.floor(60 + warmth * 40)
      const b = Math.floor(30 + warmth * 20)
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.08 + rng() * 0.12})`)
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, size, size)
    }

    // Layer 2: Geometric shapes derived from words
    for (let i = 0; i < Math.min(words.length, 8); i++) {
      const word = words[i]
      const charSum = word.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
      const alpha = 0.03 + rng() * 0.08
      const warm = 100 + (charSum % 100)
      ctx.fillStyle = `rgba(${warm}, ${Math.floor(warm * 0.5)}, ${Math.floor(warm * 0.3)}, ${alpha})`

      const shape = charSum % 4
      const x = rng() * size
      const y = rng() * size
      const s = 30 + rng() * 120

      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rng() * Math.PI * 2)

      if (shape === 0) {
        // Circle
        ctx.beginPath()
        ctx.arc(0, 0, s / 2, 0, Math.PI * 2)
        ctx.fill()
      } else if (shape === 1) {
        // Rectangle
        ctx.fillRect(-s / 2, -s / 3, s, s * 0.66)
      } else if (shape === 2) {
        // Triangle
        ctx.beginPath()
        ctx.moveTo(0, -s / 2)
        ctx.lineTo(s / 2, s / 2)
        ctx.lineTo(-s / 2, s / 2)
        ctx.closePath()
        ctx.fill()
      } else {
        // Ellipse
        ctx.beginPath()
        ctx.ellipse(0, 0, s / 2, s / 3, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    // Layer 3: Fine line structures
    ctx.strokeStyle = `rgba(180, 140, 100, ${0.04 + rng() * 0.06})`
    ctx.lineWidth = 0.5
    for (let i = 0; i < 8 + Math.floor(rng() * 12); i++) {
      ctx.beginPath()
      ctx.moveTo(rng() * size, rng() * size)
      ctx.quadraticCurveTo(rng() * size, rng() * size, rng() * size, rng() * size)
      ctx.stroke()
    }

    // Layer 4: Text fragments scattered
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.textAlign = 'center'
    for (let i = 0; i < Math.min(words.length, 6); i++) {
      const alpha = 0.04 + rng() * 0.1
      ctx.fillStyle = `rgba(200, 160, 120, ${alpha})`
      ctx.save()
      ctx.translate(rng() * size, rng() * size)
      ctx.rotate((rng() - 0.5) * 0.6)
      ctx.fillText(words[i], 0, 0)
      ctx.restore()
    }

    // Layer 5: Film grain
    const imageData = ctx.getImageData(0, 0, size, size)
    const d = imageData.data
    for (let i = 0; i < d.length; i += 4) {
      const noise = (rng() - 0.5) * 16
      d[i] = Math.max(0, Math.min(255, d[i] + noise))
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + noise * 0.8))
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + noise * 0.6))
    }
    ctx.putImageData(imageData, 0, 0)

    // Layer 6: Vignette
    const vignette = ctx.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.7)
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.5)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, size, size)

    return c.toDataURL('image/jpeg', 0.85)
  }

  function renderGallery(galleryEl: HTMLElement) {
    galleryEl.innerHTML = ''

    if (prints.length === 0) {
      const empty = document.createElement('div')
      empty.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 13px; font-style: italic;
        color: rgba(200, 100, 100, 0.25);
        text-align: center; padding: 40px;
      `
      empty.textContent = 'no prints developed yet'
      galleryEl.appendChild(empty)
      return
    }

    // Grid of prints — newest first
    const grid = document.createElement('div')
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px; padding: 8px;
    `

    for (const print of [...prints].reverse()) {
      const card = document.createElement('div')
      card.style.cssText = `
        position: relative;
        aspect-ratio: 1;
        overflow: hidden;
        border: 1px solid rgba(200, 100, 100, 0.1);
        cursor: pointer;
        transition: border-color 0.3s ease;
      `
      card.addEventListener('mouseenter', () => {
        card.style.borderColor = 'rgba(200, 100, 100, 0.4)'
      })
      card.addEventListener('mouseleave', () => {
        card.style.borderColor = 'rgba(200, 100, 100, 0.1)'
      })

      const img = document.createElement('img')
      img.src = print.imageUrl
      // Age effect: sepia increases, contrast decreases
      // FAKE! exhibition inspired: old prints develop composite artifacts
      const sepia = print.age * 80
      const contrast = 100 - print.age * 30
      const brightness = 100 - print.age * 15
      const hueRotate = print.age > 0.4 ? Math.floor((print.age - 0.4) * 25) : 0
      img.style.cssText = `
        width: 100%; height: 100%; object-fit: cover;
        filter: sepia(${sepia}%) contrast(${contrast}%) brightness(${brightness}%) hue-rotate(${hueRotate}deg);
        transition: filter 0.3s ease;
      `
      card.appendChild(img)

      // Composite seam artifact for aged prints (Rijksmuseum FAKE! 2026)
      if (print.age > 0.3) {
        const seam = document.createElement('div')
        const seamY = 20 + ((print.id.charCodeAt(0) || 0) % 60)
        const seamAlpha = Math.min(0.15, (print.age - 0.3) * 0.2)
        seam.style.cssText = `
          position: absolute; left: 0; width: 100%;
          top: ${seamY}%; height: 1px;
          background: linear-gradient(90deg, transparent 5%, rgba(200,180,140,${seamAlpha}) 20%, rgba(200,180,140,${seamAlpha * 0.5}) 80%, transparent 95%);
          pointer-events: none;
        `
        card.appendChild(seam)
      }

      // Prompt label on hover
      const label = document.createElement('div')
      label.style.cssText = `
        position: absolute; bottom: 0; left: 0; width: 100%;
        background: rgba(0, 0, 0, 0.7);
        padding: 6px 8px;
        font-family: 'Cormorant Garamond', serif;
        font-size: 12px; font-style: italic;
        color: rgba(200, 100, 100, 0.5);
        opacity: 0; transition: opacity 0.3s ease;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      `
      label.textContent = print.prompt
      card.appendChild(label)
      card.addEventListener('mouseenter', () => { label.style.opacity = '1' })
      card.addEventListener('mouseleave', () => { label.style.opacity = '0' })

      // Click to view full
      card.addEventListener('click', () => showFullPrint(print))

      grid.appendChild(card)
    }

    galleryEl.appendChild(grid)
  }

  function showFullPrint(print: DevelopedPrint) {
    const viewer = document.createElement('div')
    viewer.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 400; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.95);
      animation: darkroomFadeIn 0.3s ease;
      cursor: pointer;
    `
    viewer.addEventListener('click', () => viewer.remove())

    const img = document.createElement('img')
    img.src = print.imageUrl
    const sepia = print.age * 80
    const contrast = 100 - print.age * 30
    img.style.cssText = `
      max-width: 80vw; max-height: 70vh;
      filter: sepia(${sepia}%) contrast(${contrast}%);
      box-shadow: 0 0 60px rgba(200, 100, 100, 0.1);
    `
    viewer.appendChild(img)

    const caption = document.createElement('div')
    caption.style.cssText = `
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300; font-size: 14px; font-style: italic;
      color: rgba(200, 100, 100, 0.4);
      margin-top: 20px; max-width: 400px;
      text-align: center; line-height: 1.6;
    `
    const date = new Date(print.timestamp).toLocaleDateString()
    const agePercent = Math.floor(print.age * 100)
    caption.textContent = `"${print.prompt}" — developed ${date} · ${agePercent}% yellowed`
    viewer.appendChild(caption)

    document.body.appendChild(viewer)
  }

  async function developPrint(
    prompt: string,
    trayEl: HTMLElement,
    statusEl: HTMLElement,
    galleryEl: HTMLElement
  ) {
    if (developing) return
    developing = true

    // Chemical splash sound — print enters the tray
    playChemicalSplash()

    // Phase 1: Darkness
    statusEl.textContent = 'exposing...'
    statusEl.style.color = 'rgba(200, 100, 100, 0.4)'

    // Show empty tray
    trayEl.innerHTML = ''
    const trayBg = document.createElement('div')
    trayBg.style.cssText = `
      width: 280px; height: 280px; max-width: 70vw; max-height: 40vh;
      background: rgba(20, 5, 5, 0.9);
      border: 1px solid rgba(200, 100, 100, 0.1);
      display: flex; align-items: center; justify-content: center;
      position: relative; overflow: hidden;
    `
    trayEl.appendChild(trayBg)

    // Chemical wash animation
    const wash = document.createElement('div')
    wash.style.cssText = `
      position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(200, 100, 100, 0.05), transparent);
      animation: chemicalWash 3s ease-in-out infinite;
    `
    trayBg.appendChild(wash)

    // Phase 2: Developing (procedural generation from text)
    await new Promise(r => setTimeout(r, 1500))
    statusEl.textContent = 'developing...'

    // Start timer tick during development
    startTimerTick()

    const imageUrl = generateProceduralPrint(prompt)

    // Phase 3: Image slowly appears — start reveal tone (~6.6s total reveal time)
    await new Promise(r => setTimeout(r, 500))
    statusEl.textContent = 'image emerging...'
    startRevealTone(6600)

    const img = new Image()
    img.src = imageUrl

    img.style.cssText = `
      width: 100%; height: 100%; object-fit: cover;
      opacity: 0; filter: contrast(30%) brightness(40%) blur(8px);
      transition: opacity 4s ease, filter 6s ease;
    `
    trayBg.innerHTML = ''
    trayBg.appendChild(img)

    // Slow reveal — like watching a print develop
    await new Promise(r => setTimeout(r, 100))
    img.style.opacity = '0.3'
    img.style.filter = 'contrast(50%) brightness(60%) blur(4px)'

    await new Promise(r => setTimeout(r, 2000))
    statusEl.textContent = 'fixing...'
    img.style.opacity = '0.7'
    img.style.filter = 'contrast(80%) brightness(80%) blur(1px)'

    await new Promise(r => setTimeout(r, 2500))
    img.style.opacity = '1'
    img.style.filter = 'contrast(100%) brightness(100%) blur(0px)'
    statusEl.textContent = 'print developed'

    // Stop timer tick and reveal tone — development complete
    stopTimerTick()
    stopRevealTone()

    // Save to gallery
    const print: DevelopedPrint = {
      id: Date.now().toString(36),
      prompt,
      imageUrl,
      timestamp: Date.now(),
      age: 0,
    }
    prints.push(print)
    if (prints.length > MAX_PRINTS) prints.shift()
    savePrints()
    renderGallery(galleryEl)

    // Share prompt to other visitors' ghost galleries
    shareDarkroomPrint(prompt)

    developing = false

    // Fade status
    await new Promise(r => setTimeout(r, 3000))
    if (statusEl) {
      statusEl.textContent = 'ready for another'
      statusEl.style.color = 'rgba(200, 100, 100, 0.2)'
    }
  }

  function loadGhostPrints() {
    fetchDarkroomPrints().then(data => {
      if (data && data.prints.length > 0) {
        ghostPrints = data.prints
        ghostPrintsLoaded = true
        if (ghostGalleryEl) renderGhostGallery(ghostGalleryEl)
      }
    })
  }

  function renderGhostGallery(el: HTMLElement) {
    el.innerHTML = ''
    if (ghostPrints.length === 0) return

    const label = document.createElement('div')
    label.style.cssText = `
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300; font-size: 12px; font-style: italic;
      color: rgba(100, 120, 160, 0.2);
      text-align: center; margin-bottom: 10px;
      letter-spacing: 2px;
    `
    label.textContent = `${ghostPrints.length} prints left by other visitors`
    el.appendChild(label)

    const grid = document.createElement('div')
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 10px; padding: 8px;
    `

    for (const gp of ghostPrints) {
      const card = document.createElement('div')
      card.style.cssText = `
        position: relative;
        aspect-ratio: 1;
        overflow: hidden;
        border: 1px solid rgba(80, 100, 140, 0.08);
        cursor: pointer;
        transition: border-color 0.3s ease;
      `
      card.addEventListener('mouseenter', () => {
        card.style.borderColor = 'rgba(100, 120, 160, 0.25)'
      })
      card.addEventListener('mouseleave', () => {
        card.style.borderColor = 'rgba(80, 100, 140, 0.08)'
      })

      // Regenerate the print from the prompt (deterministic)
      const imageUrl = generateProceduralPrint(gp.prompt)
      const img = document.createElement('img')
      img.src = imageUrl
      // Ghost tint — blue-shifted, faded, low contrast
      const ageHours = gp.age / (1000 * 60 * 60)
      const fade = Math.min(0.7, ageHours / 48)
      img.style.cssText = `
        width: 100%; height: 100%; object-fit: cover;
        filter: sepia(20%) contrast(${60 - fade * 20}%) brightness(${50 + fade * 10}%) hue-rotate(190deg) saturate(40%);
        opacity: ${0.5 - fade * 0.2};
      `
      card.appendChild(img)

      // Ghost label
      const lbl = document.createElement('div')
      lbl.style.cssText = `
        position: absolute; bottom: 0; left: 0; width: 100%;
        background: rgba(0, 0, 0, 0.7);
        padding: 4px 6px;
        font-family: 'Cormorant Garamond', serif;
        font-size: 10px; font-style: italic;
        color: rgba(100, 130, 170, 0.35);
        opacity: 0; transition: opacity 0.3s ease;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      `
      lbl.textContent = gp.prompt.slice(0, 40) + (gp.prompt.length > 40 ? '…' : '')
      card.appendChild(lbl)
      card.addEventListener('mouseenter', () => { lbl.style.opacity = '1' })
      card.addEventListener('mouseleave', () => { lbl.style.opacity = '0' })

      grid.appendChild(card)
    }

    el.appendChild(grid)
  }

  return {
    name: 'darkroom',
    label: 'the darkroom',

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        display: flex; flex-direction: column;
        align-items: center;
        height: 100%;
        pointer-events: auto;
        background: rgba(15, 2, 2, 0.95);
        overflow-y: auto;
        scrollbar-width: none;
      `

      // Add styles
      const style = document.createElement('style')
      style.textContent = `
        @keyframes darkroomFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes chemicalWash {
          0% { left: -100%; }
          50% { left: 100%; }
          100% { left: -100%; }
        }
        .darkroom-scroll::-webkit-scrollbar { display: none; }
        @keyframes trayRipple {
          0% { border-color: rgba(120, 30, 25, 0.25); }
          50% { border-color: rgba(180, 50, 40, 0.45); }
          100% { border-color: rgba(120, 30, 25, 0.25); }
        }
        @keyframes trayFlash {
          0% { background-color: rgba(200, 60, 50, 0.6); }
          100% { background-color: rgba(15, 2, 2, 0.9); }
        }
        .dev-tray { cursor: pointer; position: relative; }
        .dev-tray:hover { animation: trayRipple 2s ease-in-out infinite; }
        .dev-tray:hover .tray-silhouette { opacity: 0.4 !important; }
        .dev-tray .tray-silhouette { transition: opacity 2s ease; }
        .dev-tray .tray-label { transition: opacity 1.5s ease; }
        .dev-tray:hover .tray-label { opacity: 0.5 !important; }
        .dev-tray-flash { animation: trayFlash 200ms ease-out forwards; }
      `
      overlay.appendChild(style)
      overlay.classList.add('darkroom-scroll')

      // Safelight glow — red ambient light at top
      safelightEl = document.createElement('div')
      safelightEl.style.cssText = `
        position: absolute; top: -50px; left: 50%;
        transform: translateX(-50%);
        width: 300px; height: 200px;
        background: radial-gradient(ellipse, rgba(180, 40, 30, 0.08) 0%, transparent 70%);
        pointer-events: none;
        transition: opacity 0.05s ease;
      `
      overlay.appendChild(safelightEl)

      // Dust motes canvas — fullscreen overlay for floating particles
      dustCanvas = document.createElement('canvas')
      dustCanvas.width = 400
      dustCanvas.height = 800
      dustCanvas.style.cssText = `
        position: absolute; top: 0; left: 0;
        width: 100%; height: 100%;
        pointer-events: none; z-index: 1;
      `
      dustCtx = dustCanvas.getContext('2d')
      overlay.appendChild(dustCanvas)

      // Chemical stain canvas — accumulates over time
      stainCanvas = document.createElement('canvas')
      stainCanvas.width = 400
      stainCanvas.height = 800
      stainCanvas.style.cssText = `
        position: absolute; top: 0; left: 0;
        width: 100%; height: 100%;
        pointer-events: none; z-index: 0;
        opacity: 0.7;
      `
      stainCtx = stainCanvas.getContext('2d')
      overlay.appendChild(stainCanvas)

      // Enlarger light cone canvas — swaying cone of red light
      enlargerCanvas = document.createElement('canvas')
      enlargerCanvas.width = 300
      enlargerCanvas.height = 400
      enlargerCanvas.style.cssText = `
        position: absolute; top: 0; left: 50%;
        transform: translateX(-50%);
        width: 300px; height: 400px;
        pointer-events: none; z-index: 0;
        mix-blend-mode: screen;
      `
      enlargerCtx = enlargerCanvas.getContext('2d')
      overlay.appendChild(enlargerCanvas)

      // Title
      const title = document.createElement('div')
      title.style.cssText = `
        margin-top: 40px;
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 14px;
        color: rgba(200, 100, 100, 0.4);
        letter-spacing: 4px; text-transform: uppercase;
      `
      title.textContent = 'the darkroom'
      overlay.appendChild(title)

      const sub = document.createElement('div')
      sub.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 12px; font-style: italic;
        color: rgba(200, 100, 100, 0.2);
        margin-top: 6px; margin-bottom: 24px;
      `
      sub.textContent = 'develop memories into photographs'
      overlay.appendChild(sub)

      // Developer tray — where the image appears
      const tray = document.createElement('div')
      tray.style.cssText = `
        display: flex; align-items: center; justify-content: center;
        min-height: 120px;
        margin-bottom: 20px;
        position: relative;
      `
      overlay.appendChild(tray)

      // Chemical ripple canvas overlaid on the tray area
      rippleCanvas = document.createElement('canvas')
      rippleCanvas.width = 280
      rippleCanvas.height = 280
      rippleCanvas.style.cssText = `
        position: absolute; top: 0; left: 50%;
        transform: translateX(-50%);
        width: 280px; height: 280px; max-width: 70vw;
        pointer-events: none; z-index: 2;
      `
      rippleCtx = rippleCanvas.getContext('2d')
      tray.appendChild(rippleCanvas)

      // Status text
      const status = document.createElement('div')
      status.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 12px; font-style: italic;
        color: rgba(200, 100, 100, 0.2);
        margin-bottom: 20px;
        min-height: 18px;
        transition: color 0.5s ease;
      `
      overlay.appendChild(status)

      // Input area — prompt or use a memory
      const inputArea = document.createElement('div')
      inputArea.style.cssText = `
        display: flex; flex-direction: column;
        align-items: center; gap: 10px;
        margin-bottom: 24px;
        width: 360px; max-width: 90vw;
      `

      const input = document.createElement('input')
      input.type = 'text'
      input.placeholder = 'describe what you want to develop...'
      input.style.cssText = `
        width: 100%;
        background: transparent;
        border: none;
        border-bottom: 1px solid rgba(200, 100, 100, 0.15);
        color: rgba(200, 100, 100, 0.6);
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 15px;
        padding: 10px 0;
        outline: none;
        caret-color: rgba(200, 100, 100, 0.5);
      `
      input.addEventListener('keydown', (e) => {
        e.stopPropagation()
        if (e.key === 'Enter') {
          const text = input.value.trim()
          if (text && !developing) {
            developPrint(text, tray, status, gallery)
            input.value = ''
          }
        }
      })
      inputArea.appendChild(input)

      // Button row
      const btnRow = document.createElement('div')
      btnRow.style.cssText = `
        display: flex; gap: 12px; align-items: center;
      `

      const developBtn = document.createElement('button')
      developBtn.textContent = 'develop'
      developBtn.style.cssText = `
        background: transparent;
        border: 1px solid rgba(200, 100, 100, 0.2);
        color: rgba(200, 100, 100, 0.5);
        font-family: 'Cormorant Garamond', serif;
        font-size: 13px; padding: 6px 20px;
        cursor: pointer; border-radius: 2px;
        letter-spacing: 2px; text-transform: uppercase;
        transition: all 0.3s ease;
      `
      developBtn.addEventListener('mouseenter', () => {
        developBtn.style.borderColor = 'rgba(200, 100, 100, 0.5)'
        developBtn.style.color = 'rgba(200, 100, 100, 0.8)'
      })
      developBtn.addEventListener('mouseleave', () => {
        developBtn.style.borderColor = 'rgba(200, 100, 100, 0.2)'
        developBtn.style.color = 'rgba(200, 100, 100, 0.5)'
      })
      developBtn.addEventListener('click', () => {
        const text = input.value.trim()
        if (text && !developing) {
          developPrint(text, tray, status, gallery)
          input.value = ''
        }
      })
      btnRow.appendChild(developBtn)

      // "Use a memory" button
      const memBtn = document.createElement('button')
      memBtn.textContent = 'use a memory'
      memBtn.style.cssText = `
        background: transparent;
        border: 1px solid rgba(200, 100, 100, 0.1);
        color: rgba(200, 100, 100, 0.3);
        font-family: 'Cormorant Garamond', serif;
        font-size: 12px; font-style: italic;
        padding: 6px 16px;
        cursor: pointer; border-radius: 2px;
        transition: all 0.3s ease;
      `
      memBtn.addEventListener('mouseenter', () => {
        memBtn.style.borderColor = 'rgba(200, 100, 100, 0.4)'
        memBtn.style.color = 'rgba(200, 100, 100, 0.6)'
      })
      memBtn.addEventListener('mouseleave', () => {
        memBtn.style.borderColor = 'rgba(200, 100, 100, 0.1)'
        memBtn.style.color = 'rgba(200, 100, 100, 0.3)'
      })
      memBtn.addEventListener('click', () => {
        const memText = getRandomMemoryPrompt()
        if (memText) {
          input.value = memText
        } else {
          status.textContent = 'no memories to develop. visit the void first.'
          status.style.color = 'rgba(200, 100, 100, 0.3)'
        }
      })
      btnRow.appendChild(memBtn)

      inputArea.appendChild(btnRow)
      overlay.appendChild(inputArea)

      // === DEVELOPING TRAYS — navigation as darkroom process ===
      if (deps.switchTo) {
        const traysContainer = document.createElement('div')
        traysContainer.style.cssText = `
          display: flex; gap: 20px; justify-content: center;
          align-items: flex-start;
          margin-bottom: 28px; margin-top: 4px;
          padding: 16px 24px 12px;
          background: rgba(10, 1, 1, 0.6);
          border-top: 1px solid rgba(120, 30, 25, 0.1);
          border-bottom: 1px solid rgba(120, 30, 25, 0.1);
        `

        const trayDefs: { room: string; label: string; silhouette: string }[] = [
          {
            room: 'projection',
            label: 'projection',
            // Projector body (small rect) + light beam (triangle via borders)
            silhouette: `
              <svg viewBox="0 0 60 44" width="60" height="44" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="16" width="12" height="10" rx="1" fill="rgba(200,80,70,0.7)"/>
                <polygon points="14,18 56,4 56,38 14,28" fill="rgba(200,80,70,0.3)"/>
                <circle cx="8" cy="21" r="3" fill="rgba(200,80,70,0.5)"/>
              </svg>
            `,
          },
          {
            room: 'palimpsestgallery',
            label: 'gallery',
            // Two overlapping frames at slight angles
            silhouette: `
              <svg viewBox="0 0 60 44" width="60" height="44" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="6" width="28" height="22" rx="1" fill="none" stroke="rgba(200,80,70,0.6)" stroke-width="1.5" transform="rotate(-6 20 17)"/>
                <rect x="22" y="12" width="28" height="22" rx="1" fill="none" stroke="rgba(200,80,70,0.5)" stroke-width="1.5" transform="rotate(4 36 23)"/>
                <line x1="12" y1="14" x2="28" y2="14" stroke="rgba(200,80,70,0.2)" stroke-width="0.5" transform="rotate(-6 20 17)"/>
              </svg>
            `,
          },
          {
            room: 'sketchpad',
            label: 'sketchpad',
            // Diagonal pencil stroke with dot
            silhouette: `
              <svg viewBox="0 0 60 44" width="60" height="44" xmlns="http://www.w3.org/2000/svg">
                <line x1="10" y1="38" x2="50" y2="8" stroke="rgba(200,80,70,0.6)" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="14" y1="32" x2="36" y2="18" stroke="rgba(200,80,70,0.3)" stroke-width="0.8" stroke-linecap="round"/>
                <circle cx="50" cy="8" r="2.5" fill="rgba(200,80,70,0.5)"/>
                <circle cx="10" cy="38" r="1.5" fill="rgba(200,80,70,0.3)"/>
              </svg>
            `,
          },
          {
            room: 'loom',
            label: 'thread',
            // Three horizontal wavy lines (threads)
            silhouette: `
              <svg viewBox="0 0 60 44" width="60" height="44" xmlns="http://www.w3.org/2000/svg">
                <path d="M4,12 Q15,8 22,12 Q30,16 38,12 Q46,8 56,12" fill="none" stroke="rgba(200,80,70,0.6)" stroke-width="1.2"/>
                <path d="M4,22 Q15,18 22,22 Q30,26 38,22 Q46,18 56,22" fill="none" stroke="rgba(200,80,70,0.5)" stroke-width="1.2"/>
                <path d="M4,32 Q15,28 22,32 Q30,36 38,32 Q46,28 56,32" fill="none" stroke="rgba(200,80,70,0.4)" stroke-width="1.2"/>
              </svg>
            `,
          },
        ]

        for (const def of trayDefs) {
          const trayWrap = document.createElement('div')
          trayWrap.style.cssText = `
            display: flex; flex-direction: column;
            align-items: center; gap: 6px;
          `

          const trayDiv = document.createElement('div')
          trayDiv.className = 'dev-tray'
          trayDiv.style.cssText = `
            width: 80px; height: 60px;
            background: rgba(15, 2, 2, 0.9);
            border: 1px solid rgba(120, 30, 25, 0.25);
            display: flex; align-items: center; justify-content: center;
            overflow: hidden;
            border-radius: 1px;
          `

          const silDiv = document.createElement('div')
          silDiv.className = 'tray-silhouette'
          silDiv.style.cssText = `
            opacity: 0.05;
            display: flex; align-items: center; justify-content: center;
            width: 100%; height: 100%;
          `
          silDiv.innerHTML = def.silhouette.trim()
          trayDiv.appendChild(silDiv)

          const labelDiv = document.createElement('div')
          labelDiv.className = 'tray-label'
          labelDiv.style.cssText = `
            font-family: 'Cormorant Garamond', serif;
            font-size: 12px; font-style: italic;
            color: rgba(200, 100, 100, 0.15);
            letter-spacing: 1px;
            opacity: 0.3;
          `
          labelDiv.textContent = def.label

          // Click → flash then navigate
          trayDiv.addEventListener('click', () => {
            trayDiv.classList.add('dev-tray-flash')
            setTimeout(() => {
              deps.switchTo!(def.room)
            }, 220)
          })

          trayWrap.appendChild(trayDiv)
          trayWrap.appendChild(labelDiv)
          traysContainer.appendChild(trayWrap)
        }

        overlay.appendChild(traysContainer)
      }

      // Divider
      const divider = document.createElement('div')
      divider.style.cssText = `
        width: 200px; height: 1px;
        background: rgba(200, 100, 100, 0.08);
        margin-bottom: 20px;
      `
      overlay.appendChild(divider)

      // Gallery label
      const galleryLabel = document.createElement('div')
      galleryLabel.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 13px;
        color: rgba(200, 100, 100, 0.2);
        letter-spacing: 3px; text-transform: uppercase;
        margin-bottom: 12px;
      `
      galleryLabel.textContent = 'developed prints'
      overlay.appendChild(galleryLabel)

      // Gallery
      const gallery = document.createElement('div')
      gallery.style.cssText = `
        width: 480px; max-width: 90vw;
        margin-bottom: 24px;
      `
      renderGallery(gallery)
      overlay.appendChild(gallery)

      // Ghost prints from other visitors — clothesline section
      ghostGalleryEl = document.createElement('div')
      ghostGalleryEl.style.cssText = `
        width: 480px; max-width: 90vw;
        margin-bottom: 40px;
        padding-top: 16px;
        border-top: 1px solid rgba(80, 100, 140, 0.06);
      `
      overlay.appendChild(ghostGalleryEl)

      // Cultural inscription — cycling text at very bottom
      inscriptionEl = document.createElement('div')
      inscriptionEl.style.cssText = `
        position: fixed; bottom: 48px; left: 0; width: 100%;
        text-align: center;
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 12px; font-style: italic;
        color: rgba(200, 100, 100, 0.08);
        padding: 0 40px;
        pointer-events: none; z-index: 5;
        transition: opacity 2s ease;
        max-width: 600px; margin: 0 auto;
        line-height: 1.5;
      `
      inscriptionEl.textContent = CULTURAL_INSCRIPTIONS[0]
      overlay.appendChild(inscriptionEl)

      return overlay
    },

    activate() {
      active = true
      stains = []
      lastStainTime = performance.now() / 1000
      enlargerAngle = 0
      if (stainCtx && stainCanvas) stainCtx.clearRect(0, 0, stainCanvas.width, stainCanvas.height)
      initAudio()
      initDustMotes()
      renderVisualEffects()

      // Load ghost prints from other visitors
      ghostPrintsLoaded = false
      ghostPrints = []
      setTimeout(() => {
        if (active) loadGhostPrints()
      }, 3000)

      // Start cultural inscription cycling
      inscriptionIdx = Math.floor(Math.random() * CULTURAL_INSCRIPTIONS.length)
      if (inscriptionEl) inscriptionEl.textContent = CULTURAL_INSCRIPTIONS[inscriptionIdx]
      inscriptionTimer = setInterval(() => {
        inscriptionIdx = (inscriptionIdx + 1) % CULTURAL_INSCRIPTIONS.length
        if (inscriptionEl) {
          inscriptionEl.style.opacity = '0'
          setTimeout(() => {
            if (inscriptionEl) {
              inscriptionEl.textContent = CULTURAL_INSCRIPTIONS[inscriptionIdx]
              inscriptionEl.style.opacity = '1'
            }
          }, 2000)
        }
      }, 22000)
    },

    deactivate() {
      active = false
      cancelAnimationFrame(animFrameId)
      fadeAudioOut()
      if (inscriptionTimer) { clearInterval(inscriptionTimer); inscriptionTimer = null }
    },

    destroy() {
      active = false
      cancelAnimationFrame(animFrameId)
      destroyAudio()
      if (inscriptionTimer) { clearInterval(inscriptionTimer); inscriptionTimer = null }
      safelightEl = null
      rippleCanvas = null
      rippleCtx = null
      dustCanvas = null
      dustCtx = null
      stainCanvas = null
      stainCtx = null
      enlargerCanvas = null
      enlargerCtx = null
      inscriptionEl = null
      dustMotes = []
      ripples = []
      stains = []
      overlay?.remove()
    },
  }
}
