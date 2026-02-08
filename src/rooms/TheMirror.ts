/**
 * THE MIRROR — a portrait of your behavior in Oubli
 *
 * A hidden room that reflects who you are based on how you've used
 * Oubli. It tracks which rooms you visit, how long you stay, what
 * you type, and renders this data as a text-based self-portrait.
 *
 * The mirror doesn't show your face — it shows your patterns.
 * The rooms you visit most are the brightest. The words you type
 * most frequently form the features. Your browsing rhythm becomes
 * a pulse.
 *
 * The portrait degrades if you don't visit — the mirror forgets
 * you just like everything else in Oubli.
 *
 * Accessible from The Between (one of the doors leads here instead
 * of to a normal room), or discovered by visiting every visible room.
 *
 * Inspired by: Black mirrors (scrying), funhouse mirrors,
 * Dorian Gray, data portraits, quantified self,
 * the observer effect (looking changes what's seen)
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface MirrorDeps {
  getMemories: () => StoredMemory[]
  getRoomVisits: () => Map<string, number>
  switchTo?: (name: string) => void
}

interface DataPoint {
  x: number
  y: number
  char: string
  alpha: number
  hue: number
}

interface Ripple {
  x: number
  y: number
  age: number       // seconds since creation
  maxAge: number    // total lifetime
}

interface FogParticle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  alpha: number
}

interface ShimmerSpot {
  x: number         // 0..1 relative to mirror area
  y: number         // 0..1 relative to mirror area
  vx: number
  vy: number
  radius: number
  brightness: number
}

interface FogWriting {
  text: string
  x: number         // 0..1 relative to mirror area
  y: number         // 0..1 relative to mirror area
  age: number       // seconds since creation
  maxAge: number    // total lifetime (5s)
  alpha: number     // current alpha
}

const STORAGE_KEY = 'oubli-mirror-data'

interface MirrorData {
  roomTimes: Record<string, number>  // room name → total seconds
  wordFrequencies: Record<string, number>  // word → count
  lastVisit: number
  visitCount: number
}

// Cultural inscriptions that cycle around the mirror frame
const CULTURAL_INSCRIPTIONS = [
  "dorian gray's portrait aged while he stayed young. every mirror is a portrait in reverse.",
  "lacan's mirror stage: the moment an infant recognizes itself. identity begins with reflection.",
  "narcissus drowned reaching for his own reflection. the mirror gives nothing back.",
  "in many cultures, mirrors are covered when someone dies. the soul might get trapped.",
  "the anti-AI movement: 45% of creative directors now reject generated images. the hunger for human imperfection.",
  "klara hosnedlova makes art from living fungus. it grows and decays while you watch.",
  "consciousness may be permanent agnosticism. we may never know if an AI is aware.",
  "yin xiuzhen builds sculptures from used clothing. each garment carries an absent body's history.",
]

// Fog writing fragments — appear when degradation is high
const FOG_FRAGMENTS = [
  'who were you before this?',
  'the face you wore yesterday',
  'everything you forget becomes someone else',
  'a mirror has no memory',
  'you are the space between reflections',
  'the glass remembers nothing',
  'touch the surface and it ripples',
  'your reflection blinks when you look away',
  'what stares back is not you',
  'the fog knows your name',
  'behind every mirror is a wall',
  'you left something here last time',
]

const INSCRIPTION_CYCLE_MS = 22_000  // 22 seconds per inscription

export function createMirrorRoom(deps: MirrorDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let portraitData: DataPoint[] = []
  let mirrorData: MirrorData

  // Cultural inscription state
  let inscriptionIndex = 0
  let inscriptionStartTime = 0

  // Reflection distortion — cursor velocity tracking
  let prevMouseX = -1
  let prevMouseY = -1
  let cursorVelocity = 0           // current smoothed velocity magnitude
  let distortionAmount = 0         // current distortion (decays over 0.5s)
  let lastMouseMoveTime = 0

  // Fog writing state
  const fogWritings: FogWriting[] = []
  let lastFogWriteTime = 0

  // Reflection distortion navigation zones — 4 zones at mirror edges
  let hoveredZone = -1
  let shatterTime = -1  // when a shatter animation started (-1 = none)
  let shatterTarget = ''  // room to navigate to after shatter
  const navZones = [
    { room: 'darkroom', side: 'left' as const, color: { r: 180, g: 30, b: 20 }, label: 'warm/amber' },
    { room: 'datepaintings', side: 'right' as const, color: { r: 60, g: 80, b: 180 }, label: 'cold/blue' },
    { room: 'between', side: 'top' as const, color: { r: 140, g: 60, b: 180 }, label: 'violet' },
    { room: 'projection', side: 'bottom' as const, color: { r: 40, g: 160, b: 80 }, label: 'green' },
  ]

  // --- Visual state ---
  const ripples: Ripple[] = []
  const fogParticles: FogParticle[] = []
  const shimmerSpots: ShimmerSpot[] = []
  let mouseX = -1
  let mouseY = -1

  // Initialize shimmer spots
  for (let i = 0; i < 6; i++) {
    shimmerSpots.push({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.02,
      vy: (Math.random() - 0.5) * 0.015,
      radius: 15 + Math.random() * 30,
      brightness: 0.02 + Math.random() * 0.03,
    })
  }

  // --- Audio state ---
  let audioInitialized = false
  let audioMaster: GainNode | null = null
  // Mirror hum
  let humOsc1: OscillatorNode | null = null
  let humOsc2: OscillatorNode | null = null
  let humGain: GainNode | null = null
  // Heartbeat LFO
  let heartbeatLFO: OscillatorNode | null = null
  let heartbeatLFOGain: GainNode | null = null
  // Fog whisper (brown noise)
  let fogNoiseNode: AudioBufferSourceNode | null = null
  let fogFilter: BiquadFilterNode | null = null
  let fogGain: GainNode | null = null
  let fogActive = false

  async function initAudio() {
    if (audioInitialized) return
    try {
      const ac = await getAudioContext()
      const dest = getAudioDestination()

      // Master gain for this room
      audioMaster = ac.createGain()
      audioMaster.gain.value = 0
      audioMaster.connect(dest)

      // --- Mirror hum: detuned sine pair creating 1Hz beat ---
      humGain = ac.createGain()
      humGain.gain.value = 0.02  // base value, LFO will modulate around this
      humGain.connect(audioMaster)

      humOsc1 = ac.createOscillator()
      humOsc1.type = 'sine'
      humOsc1.frequency.value = 180
      humOsc1.connect(humGain)
      humOsc1.start()

      humOsc2 = ac.createOscillator()
      humOsc2.type = 'sine'
      humOsc2.frequency.value = 181
      humOsc2.connect(humGain)
      humOsc2.start()

      // --- Heartbeat LFO: 0.8Hz modulating drone gain between 0.01 and 0.03 ---
      heartbeatLFO = ac.createOscillator()
      heartbeatLFO.type = 'sine'
      heartbeatLFO.frequency.value = 0.8  // 0.8 Hz heartbeat rate

      heartbeatLFOGain = ac.createGain()
      heartbeatLFOGain.gain.value = 0.01  // amplitude: +/- 0.01 around the 0.02 center

      heartbeatLFO.connect(heartbeatLFOGain)
      heartbeatLFOGain.connect(humGain.gain)  // modulates the hum gain param
      heartbeatLFO.start()

      audioInitialized = true
    } catch {
      // Audio not available — silent fallback
    }
  }

  function startFogAudio() {
    if (!audioInitialized || !audioMaster || fogActive) return
    try {
      const ac = audioMaster.context as AudioContext

      // Brown noise: integrate white noise
      const bufferSize = ac.sampleRate * 2
      const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
      const data = buffer.getChannelData(0)
      let lastOut = 0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        lastOut = (lastOut + (0.02 * white)) / 1.02
        data[i] = lastOut * 3.5 // normalize a bit
      }

      fogNoiseNode = ac.createBufferSource()
      fogNoiseNode.buffer = buffer
      fogNoiseNode.loop = true

      fogFilter = ac.createBiquadFilter()
      fogFilter.type = 'lowpass'
      fogFilter.frequency.value = 200
      fogFilter.Q.value = 0.5

      fogGain = ac.createGain()
      fogGain.gain.value = 0.008

      fogNoiseNode.connect(fogFilter)
      fogFilter.connect(fogGain)
      fogGain.connect(audioMaster)
      fogNoiseNode.start()

      fogActive = true
    } catch {
      // silent fallback
    }
  }

  function stopFogAudio() {
    if (!fogActive) return
    try {
      if (fogGain) {
        const ac = fogGain.context as AudioContext
        fogGain.gain.setValueAtTime(fogGain.gain.value, ac.currentTime)
        fogGain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.3)
      }
      setTimeout(() => {
        try { fogNoiseNode?.stop() } catch { /* already stopped */ }
        fogNoiseNode?.disconnect()
        fogFilter?.disconnect()
        fogGain?.disconnect()
        fogNoiseNode = null
        fogFilter = null
        fogGain = null
        fogActive = false
      }, 350)
    } catch {
      fogActive = false
    }
  }

  function playShimmerSound() {
    if (!audioInitialized || !audioMaster) return
    try {
      const ac = audioMaster.context as AudioContext
      const now = ac.currentTime

      // Ascending glissando: 400 -> 800Hz over 500ms
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(400, now)
      osc.frequency.linearRampToValueAtTime(800, now + 0.5)

      // Gain envelope
      const g = ac.createGain()
      g.gain.setValueAtTime(0.02, now)
      g.gain.linearRampToValueAtTime(0.005, now + 0.3)
      g.gain.linearRampToValueAtTime(0, now + 0.5)

      // Simple delay for reverb-like effect
      const delay = ac.createDelay(0.5)
      delay.delayTime.value = 0.15
      const feedback = ac.createGain()
      feedback.gain.value = 0.25
      const wetGain = ac.createGain()
      wetGain.gain.value = 0.3

      osc.connect(g)
      // Dry path
      g.connect(audioMaster)
      // Wet path
      g.connect(delay)
      delay.connect(feedback)
      feedback.connect(delay)
      delay.connect(wetGain)
      wetGain.connect(audioMaster)

      osc.start(now)
      osc.stop(now + 0.6)

      // Cleanup after sound finishes (including delay tail)
      setTimeout(() => {
        osc.disconnect()
        g.disconnect()
        delay.disconnect()
        feedback.disconnect()
        wetGain.disconnect()
      }, 1200)
    } catch {
      // silent fallback
    }
  }

  function playShatterSound() {
    if (!audioInitialized || !audioMaster) return
    try {
      const ac = audioMaster.context as AudioContext
      const now = ac.currentTime

      // White noise burst through highpass
      const noiseLen = 0.1
      const noiseBuf = ac.createBuffer(1, Math.ceil(ac.sampleRate * noiseLen), ac.sampleRate)
      const noiseData = noiseBuf.getChannelData(0)
      for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = Math.random() * 2 - 1
      }
      const noiseSrc = ac.createBufferSource()
      noiseSrc.buffer = noiseBuf

      const highpass = ac.createBiquadFilter()
      highpass.type = 'highpass'
      highpass.frequency.value = 2000

      const noiseGain = ac.createGain()
      noiseGain.gain.setValueAtTime(0.05, now)
      noiseGain.gain.linearRampToValueAtTime(0, now + 0.1)

      noiseSrc.connect(highpass)
      highpass.connect(noiseGain)
      noiseGain.connect(audioMaster)
      noiseSrc.start(now)
      noiseSrc.stop(now + noiseLen)

      // Descending tone: 600 -> 200Hz over 300ms
      const tone = ac.createOscillator()
      tone.type = 'sine'
      tone.frequency.setValueAtTime(600, now)
      tone.frequency.linearRampToValueAtTime(200, now + 0.3)

      const toneGain = ac.createGain()
      toneGain.gain.setValueAtTime(0.04, now)
      toneGain.gain.linearRampToValueAtTime(0, now + 0.3)

      tone.connect(toneGain)
      toneGain.connect(audioMaster)
      tone.start(now)
      tone.stop(now + 0.35)

      // Cleanup
      setTimeout(() => {
        noiseSrc.disconnect()
        highpass.disconnect()
        noiseGain.disconnect()
        tone.disconnect()
        toneGain.disconnect()
      }, 600)
    } catch {
      // silent fallback
    }
  }

  function fadeAudioIn() {
    if (!audioMaster) return
    const ac = audioMaster.context as AudioContext
    const now = ac.currentTime
    audioMaster.gain.cancelScheduledValues(now)
    audioMaster.gain.setValueAtTime(audioMaster.gain.value, now)
    audioMaster.gain.linearRampToValueAtTime(1.0, now + 0.8)
  }

  function fadeAudioOut() {
    if (!audioMaster) return
    const ac = audioMaster.context as AudioContext
    const now = ac.currentTime
    audioMaster.gain.cancelScheduledValues(now)
    audioMaster.gain.setValueAtTime(audioMaster.gain.value, now)
    audioMaster.gain.linearRampToValueAtTime(0, now + 0.5)
  }

  function destroyAudio() {
    fadeAudioOut()
    setTimeout(() => {
      try { humOsc1?.stop() } catch { /* already stopped */ }
      try { humOsc2?.stop() } catch { /* already stopped */ }
      try { heartbeatLFO?.stop() } catch { /* already stopped */ }
      try { fogNoiseNode?.stop() } catch { /* already stopped */ }
      humOsc1?.disconnect()
      humOsc2?.disconnect()
      humGain?.disconnect()
      heartbeatLFO?.disconnect()
      heartbeatLFOGain?.disconnect()
      fogNoiseNode?.disconnect()
      fogFilter?.disconnect()
      fogGain?.disconnect()
      audioMaster?.disconnect()

      humOsc1 = null
      humOsc2 = null
      humGain = null
      heartbeatLFO = null
      heartbeatLFOGain = null
      fogNoiseNode = null
      fogFilter = null
      fogGain = null
      audioMaster = null
      fogActive = false
      audioInitialized = false
    }, 600)
  }

  function loadData(): MirrorData {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) return JSON.parse(stored)
    } catch {}
    return {
      roomTimes: {},
      wordFrequencies: {},
      lastVisit: Date.now(),
      visitCount: 0,
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mirrorData))
    } catch {}
  }

  function buildPortrait() {
    if (!canvas) return
    portraitData = []
    const w = canvas.width
    const h = canvas.height
    const memories = deps.getMemories()

    // Build word frequency from all memories
    for (const mem of memories) {
      const words = mem.currentText.toLowerCase().split(/\s+/).filter(w => w.length > 2)
      for (const word of words) {
        mirrorData.wordFrequencies[word] = (mirrorData.wordFrequencies[word] || 0) + 1
      }
    }

    // Sort words by frequency
    const sortedWords = Object.entries(mirrorData.wordFrequencies)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)

    if (sortedWords.length === 0 && memories.length === 0) return

    // Create an oval portrait shape
    const centerX = w / 2
    const centerY = h * 0.45
    const radiusX = w * 0.2
    const radiusY = h * 0.3

    // Fill the oval with words, sized by frequency
    const maxFreq = sortedWords.length > 0 ? sortedWords[0][1] : 1
    let attempts = 0

    for (const [word, freq] of sortedWords) {
      const normalizedFreq = freq / maxFreq
      const angle = Math.random() * Math.PI * 2
      const dist = Math.random() * 0.9
      const x = centerX + Math.cos(angle) * radiusX * dist
      const y = centerY + Math.sin(angle) * radiusY * dist

      for (const char of word) {
        portraitData.push({
          x: x + (Math.random() - 0.5) * word.length * 8,
          y: y + (Math.random() - 0.5) * 10,
          char,
          alpha: 0.1 + normalizedFreq * 0.4,
          hue: (freq * 37) % 360,
        })
      }

      attempts++
      if (attempts > 200) break
    }

    // Add room-based shading
    const roomVisits = deps.getRoomVisits()
    const totalVisits = [...roomVisits.values()].reduce((s, v) => s + v, 0) || 1

    // Room data creates background texture
    for (const [room, visits] of roomVisits) {
      const intensity = visits / totalVisits
      const roomAngle = hashRoom(room) * Math.PI * 2
      const rx = centerX + Math.cos(roomAngle) * radiusX * 0.5
      const ry = centerY + Math.sin(roomAngle) * radiusY * 0.5

      for (let i = 0; i < Math.ceil(intensity * 20); i++) {
        portraitData.push({
          x: rx + (Math.random() - 0.5) * 40,
          y: ry + (Math.random() - 0.5) * 40,
          char: room[Math.floor(Math.random() * room.length)],
          alpha: intensity * 0.1,
          hue: hashRoom(room) * 360,
        })
      }
    }

    saveData()

    // Play shimmer sound when portrait rebuilds
    playShimmerSound()
  }

  function hashRoom(name: string): number {
    let h = 0
    for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0
    return Math.abs(h) / 0xFFFFFFFF
  }

  // Helper: check if a point is inside the mirror area
  function isInMirrorArea(px: number, py: number, w: number, h: number): boolean {
    const frameX = w * 0.2 + 10
    const frameY = h * 0.08 + 10
    const frameW = w * 0.6 - 20
    const frameH = h * 0.75 - 20
    return px >= frameX && px <= frameX + frameW && py >= frameY && py <= frameY + frameH
  }

  // Get frame geometry helper
  function getFrameGeometry(w: number, h: number) {
    const frameX = w * 0.2
    const frameY = h * 0.08
    const frameW = w * 0.6
    const frameH = h * 0.75
    return { frameX, frameY, frameW, frameH }
  }

  // Draw cultural inscriptions around the mirror frame
  function drawInscriptions(c: CanvasRenderingContext2D, w: number, h: number) {
    const { frameX, frameY, frameW, frameH } = getFrameGeometry(w, h)

    // Determine current inscription based on time
    const elapsed = Date.now() - inscriptionStartTime
    inscriptionIndex = Math.floor(elapsed / INSCRIPTION_CYCLE_MS) % CULTURAL_INSCRIPTIONS.length
    const text = CULTURAL_INSCRIPTIONS[inscriptionIndex]

    // Fade: within each 22s cycle, fade in for 2s, hold, fade out for 2s
    const cycleProgress = (elapsed % INSCRIPTION_CYCLE_MS) / INSCRIPTION_CYCLE_MS
    let alpha: number
    if (cycleProgress < 0.09) {
      alpha = cycleProgress / 0.09  // fade in over ~2s
    } else if (cycleProgress > 0.91) {
      alpha = (1.0 - cycleProgress) / 0.09  // fade out over ~2s
    } else {
      alpha = 1.0
    }
    alpha *= 0.035  // very low base alpha

    c.save()
    c.font = '10px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(140, 130, 120, ${alpha})`
    c.textAlign = 'center'

    // Split text and distribute around the frame perimeter
    const words = text.split(' ')
    const perimeter = 2 * (frameW + frameH)
    const margin = 20  // offset from frame edge

    for (let i = 0; i < words.length; i++) {
      const t = i / words.length
      const dist = t * perimeter

      let px: number, py: number
      if (dist < frameW) {
        // Top edge
        px = frameX + dist
        py = frameY - margin
      } else if (dist < frameW + frameH) {
        // Right edge
        px = frameX + frameW + margin
        py = frameY + (dist - frameW)
        c.save()
        c.translate(px, py)
        c.rotate(Math.PI / 2)
        c.fillText(words[i], 0, 0)
        c.restore()
        continue
      } else if (dist < 2 * frameW + frameH) {
        // Bottom edge
        px = frameX + frameW - (dist - frameW - frameH)
        py = frameY + frameH + margin + 10
      } else {
        // Left edge
        px = frameX - margin
        py = frameY + frameH - (dist - 2 * frameW - frameH)
        c.save()
        c.translate(px, py)
        c.rotate(-Math.PI / 2)
        c.fillText(words[i], 0, 0)
        c.restore()
        continue
      }

      c.fillText(words[i], px, py)
    }

    c.restore()
  }

  // Draw fog writing — faint text emerging from fog
  function drawFogWriting(c: CanvasRenderingContext2D, mirrorInnerX: number, mirrorInnerY: number, mirrorInnerW: number, mirrorInnerH: number) {
    // Spawn new fog writing every ~3 seconds
    const now = time
    if (now - lastFogWriteTime > 3.0 && fogWritings.length < 4) {
      const fragment = FOG_FRAGMENTS[Math.floor(Math.random() * FOG_FRAGMENTS.length)]
      fogWritings.push({
        text: fragment,
        x: 0.15 + Math.random() * 0.7,
        y: 0.15 + Math.random() * 0.7,
        age: 0,
        maxAge: 5.0,
        alpha: 0,
      })
      lastFogWriteTime = now
    }

    c.save()
    c.beginPath()
    c.rect(mirrorInnerX, mirrorInnerY, mirrorInnerW, mirrorInnerH)
    c.clip()

    c.font = '13px "Cormorant Garamond", serif'
    c.textAlign = 'center'

    for (let i = fogWritings.length - 1; i >= 0; i--) {
      const fw = fogWritings[i]
      fw.age += 0.016

      if (fw.age > fw.maxAge) {
        fogWritings.splice(i, 1)
        continue
      }

      // Fade in for 1s, hold, fade out for 1.5s
      const progress = fw.age / fw.maxAge
      if (progress < 0.2) {
        fw.alpha = progress / 0.2
      } else if (progress > 0.7) {
        fw.alpha = (1.0 - progress) / 0.3
      } else {
        fw.alpha = 1.0
      }

      const px = mirrorInnerX + fw.x * mirrorInnerW
      const py = mirrorInnerY + fw.y * mirrorInnerH

      // Finger-on-glass effect: slightly blurred, warm tone
      c.fillStyle = `rgba(180, 170, 160, ${fw.alpha * 0.08})`
      // Draw slightly offset for blur effect
      c.fillText(fw.text, px - 0.5, py - 0.5)
      c.fillText(fw.text, px + 0.5, py + 0.5)
      c.fillStyle = `rgba(200, 190, 175, ${fw.alpha * 0.12})`
      c.fillText(fw.text, px, py)
    }

    c.restore()
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height

    ctx.clearRect(0, 0, w, h)

    // Background — very dark, reflective
    ctx.fillStyle = 'rgba(3, 3, 8, 1)'
    ctx.fillRect(0, 0, w, h)

    // --- Heartbeat breathing cycle (synced with 0.8Hz audio LFO) ---
    const heartbeatPhase = Math.sin(time * 0.8 * Math.PI * 2)  // 0.8 Hz
    const frameBreathe = 0.02 + heartbeatPhase * 0.015  // subtle brightness variation

    // Mirror frame with heartbeat-synced brightness
    const { frameX, frameY, frameW, frameH } = getFrameGeometry(w, h)
    const frameAlpha = 0.08 + frameBreathe
    ctx.strokeStyle = `rgba(120, 100, 80, ${frameAlpha})`
    ctx.lineWidth = 3
    ctx.strokeRect(frameX, frameY, frameW, frameH)

    // Inner frame
    ctx.strokeStyle = `rgba(120, 100, 80, ${frameAlpha * 0.5})`
    ctx.lineWidth = 1
    ctx.strokeRect(frameX + 8, frameY + 8, frameW - 16, frameH - 16)

    // --- Cultural inscriptions around the frame ---
    drawInscriptions(ctx, w, h)

    // Mirror surface — slight gradient
    const mirrorGrad = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, h * 0.4)
    mirrorGrad.addColorStop(0, 'rgba(15, 15, 25, 0.3)')
    mirrorGrad.addColorStop(1, 'rgba(5, 5, 10, 0.1)')
    ctx.fillStyle = mirrorGrad
    ctx.fillRect(frameX + 10, frameY + 10, frameW - 20, frameH - 20)

    // --- Mirror surface shimmer: drifting bright spots ---
    const mirrorInnerX = frameX + 10
    const mirrorInnerY = frameY + 10
    const mirrorInnerW = frameW - 20
    const mirrorInnerH = frameH - 20

    ctx.save()
    ctx.beginPath()
    ctx.rect(mirrorInnerX, mirrorInnerY, mirrorInnerW, mirrorInnerH)
    ctx.clip()

    for (const spot of shimmerSpots) {
      // Update position
      spot.x += spot.vx * 0.016
      spot.y += spot.vy * 0.016
      // Bounce off edges
      if (spot.x < 0 || spot.x > 1) spot.vx *= -1
      if (spot.y < 0 || spot.y > 1) spot.vy *= -1
      spot.x = Math.max(0, Math.min(1, spot.x))
      spot.y = Math.max(0, Math.min(1, spot.y))

      const sx = mirrorInnerX + spot.x * mirrorInnerW
      const sy = mirrorInnerY + spot.y * mirrorInnerH
      const pulse = Math.sin(time * 0.7 + spot.x * 5 + spot.y * 3) * 0.3 + 0.7

      const shimGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, spot.radius)
      shimGrad.addColorStop(0, `rgba(180, 180, 220, ${spot.brightness * pulse})`)
      shimGrad.addColorStop(1, 'rgba(180, 180, 220, 0)')
      ctx.fillStyle = shimGrad
      ctx.fillRect(sx - spot.radius, sy - spot.radius, spot.radius * 2, spot.radius * 2)
    }

    ctx.restore()

    // --- Decay distortion smoothly over 0.5s ---
    distortionAmount *= Math.exp(-0.016 / 0.25)  // exponential decay, ~0.5s settle
    if (distortionAmount < 0.001) distortionAmount = 0

    // --- Portrait breathing: synchronized alpha pulsing ---
    const breathCycle = Math.sin(time * 0.8) * 0.04 // slow rhythm

    // Portrait data points — with cursor-velocity distortion
    if (portraitData.length > 0) {
      for (const dp of portraitData) {
        const breathe = Math.sin(time * 0.5 + dp.x * 0.01 + dp.y * 0.01) * 0.02
        const synced = breathCycle

        // Apply reflection distortion based on cursor velocity
        let drawX = dp.x
        let drawY = dp.y
        if (distortionAmount > 0.001) {
          // Distance from cursor affects distortion strength
          const dx = dp.x - mouseX
          const dy = dp.y - mouseY
          const dist = Math.sqrt(dx * dx + dy * dy)
          const influence = Math.max(0, 1 - dist / 200)  // fades over 200px
          const wobble = Math.sin(time * 12 + dp.x * 0.05 + dp.y * 0.03)

          // Stretch character spacing and skew positions
          drawX += influence * distortionAmount * wobble * 8
          drawY += influence * distortionAmount * Math.cos(time * 10 + dp.y * 0.04) * 4
        }

        ctx.font = '12px "Cormorant Garamond", serif'
        ctx.fillStyle = `hsla(${dp.hue}, 30%, 60%, ${Math.max(0, dp.alpha + breathe + synced)})`
        ctx.textAlign = 'center'
        ctx.fillText(dp.char, drawX, drawY)
      }
    } else {
      // Empty mirror
      ctx.font = '14px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(120, 120, 160, 0.1)'
      ctx.textAlign = 'center'
      ctx.fillText('the mirror is blank.', w / 2, h * 0.4)
      ctx.fillText('it needs more of you to reflect.', w / 2, h * 0.45)
      ctx.fillText('visit rooms. type memories. return.', w / 2, h * 0.5)
    }

    // --- Mirror ripple at cursor position ---
    // Update and render ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rip = ripples[i]
      rip.age += 0.016
      if (rip.age > rip.maxAge) {
        ripples.splice(i, 1)
        continue
      }

      const progress = rip.age / rip.maxAge
      const maxRadius = 40
      for (let ring = 0; ring < 3; ring++) {
        const ringProgress = Math.max(0, progress - ring * 0.1)
        if (ringProgress <= 0 || ringProgress > 1) continue
        const radius = ringProgress * maxRadius
        const alpha = 0.06 * (1 - ringProgress)
        ctx.beginPath()
        ctx.arc(rip.x, rip.y, radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(160, 160, 200, ${alpha})`
        ctx.lineWidth = 0.8
        ctx.stroke()
      }
    }

    // Degradation based on time since last visit
    const daysSinceVisit = (Date.now() - mirrorData.lastVisit) / (1000 * 60 * 60 * 24)
    const fogAlpha = daysSinceVisit > 1 ? Math.min(0.7, daysSinceVisit * 0.05) : 0

    if (daysSinceVisit > 1) {
      // Fog over the mirror — it forgets you
      ctx.fillStyle = `rgba(10, 10, 15, ${fogAlpha})`
      ctx.fillRect(frameX + 10, frameY + 10, frameW - 20, frameH - 20)

      ctx.font = '12px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(120, 120, 160, ${0.1 + Math.sin(time) * 0.03})`
      ctx.textAlign = 'center'
      ctx.fillText('the mirror is forgetting your face.', w / 2, h * 0.9)

      // Start fog audio if not already running
      if (!fogActive) startFogAudio()

      // --- Fog writing: faint text emerging from the fog ---
      drawFogWriting(ctx, mirrorInnerX, mirrorInnerY, mirrorInnerW, mirrorInnerH)
    } else {
      // Stop fog audio if running
      if (fogActive) stopFogAudio()
      // Clear fog writings when not fogged
      fogWritings.length = 0
    }

    // --- Fog particles when fogAlpha > 0 ---
    if (fogAlpha > 0) {
      // Spawn new particles occasionally
      if (Math.random() < 0.15) {
        fogParticles.push({
          x: mirrorInnerX - 10,
          y: mirrorInnerY + Math.random() * mirrorInnerH,
          vx: 8 + Math.random() * 12,
          vy: (Math.random() - 0.5) * 3,
          radius: 3 + Math.random() * 6,
          alpha: 0.02 + Math.random() * 0.04,
        })
      }

      // Update and render fog particles
      ctx.save()
      ctx.beginPath()
      ctx.rect(mirrorInnerX, mirrorInnerY, mirrorInnerW, mirrorInnerH)
      ctx.clip()

      for (let i = fogParticles.length - 1; i >= 0; i--) {
        const fp = fogParticles[i]
        fp.x += fp.vx * 0.016
        fp.y += fp.vy * 0.016
        fp.vy += (Math.random() - 0.5) * 0.5

        // Remove if off-screen
        if (fp.x > mirrorInnerX + mirrorInnerW + 20) {
          fogParticles.splice(i, 1)
          continue
        }

        ctx.beginPath()
        ctx.arc(fp.x, fp.y, fp.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(80, 80, 100, ${fp.alpha * Math.min(fogAlpha * 3, 1)})`
        ctx.fill()
      }

      ctx.restore()
    } else {
      // Clear fog particles when not fogged
      fogParticles.length = 0
    }

    // Stats
    const roomVisits = deps.getRoomVisits()
    const totalVisits = [...roomVisits.values()].reduce((s, v) => s + v, 0)
    const wordCount = Object.keys(mirrorData.wordFrequencies).length

    ctx.font = '12px monospace'
    ctx.fillStyle = 'rgba(120, 120, 160, 0.06)'
    ctx.textAlign = 'center'
    ctx.fillText(
      `${totalVisits} room visits · ${wordCount} unique words · visit #${mirrorData.visitCount}`,
      w / 2, h - 15
    )

    // Title
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(120, 120, 160, ${0.08 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the mirror', w / 2, 30)

    // --- 4 Navigation zones at the four edges of the mirror ---
    if (deps.switchTo) {
      const zoneRadius = Math.min(frameW * 0.08, 40)

      // Compute zone centers: left, right, top, bottom of the mirror
      const zoneCenters = navZones.map(zone => {
        switch (zone.side) {
          case 'left':
            return { x: mirrorInnerX + frameW * 0.12, y: frameY + frameH * 0.5 }
          case 'right':
            return { x: mirrorInnerX + mirrorInnerW - frameW * 0.12, y: frameY + frameH * 0.5 }
          case 'top':
            return { x: frameX + frameW * 0.5, y: mirrorInnerY + frameH * 0.1 }
          case 'bottom':
            return { x: frameX + frameW * 0.5, y: mirrorInnerY + mirrorInnerH - frameH * 0.1 }
        }
      })

      for (let i = 0; i < navZones.length; i++) {
        const zone = navZones[i]
        const zc = zoneCenters[i]
        const zx = zc.x
        const zy = zc.y
        const hovered = hoveredZone === i
        const isShatteringThis = shatterTime > 0 && shatterTarget === zone.room
        const shatterElapsed = isShatteringThis ? time - shatterTime : 0
        const zoneColor = zone.color

        ctx.save()

        // Clipping — keep reflections inside mirror frame
        ctx.beginPath()
        ctx.rect(frameX + 10, frameY + 10, frameW - 20, frameH - 20)
        ctx.clip()

        if (isShatteringThis && shatterElapsed < 0.5) {
          // --- Shatter animation: crack pattern radiating outward ---
          const progress = shatterElapsed / 0.4
          const crackAlpha = 1.0 - progress
          const numCracks = 8
          for (let c = 0; c < numCracks; c++) {
            const angle = (c / numCracks) * Math.PI * 2 + 0.3
            const len = progress * zoneRadius * 2.5
            ctx.beginPath()
            ctx.moveTo(zx, zy)
            // Jagged crack lines
            const segments = 4
            for (let s = 1; s <= segments; s++) {
              const frac = s / segments
              const jitterX = (Math.sin(c * 13.7 + s * 7.3) * 6) * frac
              const jitterY = (Math.cos(c * 9.1 + s * 11.2) * 6) * frac
              ctx.lineTo(
                zx + Math.cos(angle) * len * frac + jitterX,
                zy + Math.sin(angle) * len * frac + jitterY
              )
            }
            ctx.strokeStyle = `rgba(${zoneColor.r}, ${zoneColor.g}, ${zoneColor.b}, ${crackAlpha * 0.6})`
            ctx.lineWidth = 1.5 - progress
            ctx.stroke()
          }
          // Flash at center
          const flashAlpha = Math.max(0, 0.5 - progress * 1.2)
          const flashGrad = ctx.createRadialGradient(zx, zy, 0, zx, zy, zoneRadius * progress * 2)
          flashGrad.addColorStop(0, `rgba(${zoneColor.r}, ${zoneColor.g}, ${zoneColor.b}, ${flashAlpha})`)
          flashGrad.addColorStop(1, `rgba(${zoneColor.r}, ${zoneColor.g}, ${zoneColor.b}, 0)`)
          ctx.fillStyle = flashGrad
          ctx.fillRect(zx - zoneRadius * 3, zy - zoneRadius * 3, zoneRadius * 6, zoneRadius * 6)
        } else if (!isShatteringThis) {
          // --- Normal navigation zone with themed glow ---
          const baseAlpha = hovered ? 0.18 : 0.05
          const shimmer = Math.sin(time * 2.0 + i * 3.0) * 0.02

          // Themed radial glow
          const glowGrad = ctx.createRadialGradient(zx, zy, 0, zx, zy, zoneRadius * 1.3)
          glowGrad.addColorStop(0, `rgba(${zoneColor.r}, ${zoneColor.g}, ${zoneColor.b}, ${(baseAlpha + shimmer) * 1.5})`)
          glowGrad.addColorStop(0.6, `rgba(${zoneColor.r}, ${zoneColor.g}, ${zoneColor.b}, ${(baseAlpha + shimmer) * 0.6})`)
          glowGrad.addColorStop(1, `rgba(${zoneColor.r}, ${zoneColor.g}, ${zoneColor.b}, 0)`)
          ctx.fillStyle = glowGrad
          ctx.fillRect(zx - zoneRadius * 1.5, zy - zoneRadius * 1.5, zoneRadius * 3, zoneRadius * 3)

          // Zone-specific visual details
          if (zone.room === 'darkroom') {
            // Darkroom: developing tray shapes
            ctx.strokeStyle = `rgba(${zoneColor.r}, ${Math.min(255, zoneColor.g + 20)}, ${zoneColor.b + 10}, ${baseAlpha * 1.8 + shimmer})`
            ctx.lineWidth = 0.6
            const trayW = zoneRadius * 0.7
            const trayH = zoneRadius * 0.45
            for (let t = 0; t < 3; t++) {
              const trayOffsetX = (t - 1) * trayW * 0.9
              const trayOffsetY = Math.sin(time * 0.8 + t * 1.5) * 3
              ctx.strokeRect(zx + trayOffsetX - trayW / 2, zy + trayOffsetY - trayH / 2 + 8, trayW, trayH)
            }
          } else if (zone.room === 'datepaintings') {
            // Date paintings: small frames with date text
            const pW = zoneRadius * 0.5
            const pH = zoneRadius * 0.65
            const dates = ['FEB.8', 'JAN.3', 'DEC.1', 'OCT.19']
            for (let p = 0; p < 4; p++) {
              const col = p % 2
              const row = Math.floor(p / 2)
              const px = zx + (col - 0.5) * pW * 1.4
              const py = zy + (row - 0.5) * pH * 1.2
              const drift = Math.sin(time * 0.6 + p * 2.1) * 2
              ctx.strokeStyle = `rgba(${zoneColor.r}, ${zoneColor.g}, ${zoneColor.b}, ${baseAlpha * 1.5 + shimmer})`
              ctx.lineWidth = 0.5
              ctx.strokeRect(px - pW / 2 + drift, py - pH / 2, pW, pH)
              ctx.font = '6px monospace'
              ctx.fillStyle = `rgba(${zoneColor.r}, ${zoneColor.g}, ${zoneColor.b}, ${baseAlpha * 2.0 + shimmer})`
              ctx.textAlign = 'center'
              ctx.fillText(dates[p], px + drift, py + 2)
            }
          } else if (zone.room === 'between') {
            // The Between: ghostly doorway outline, shifting violet
            ctx.strokeStyle = `rgba(${zoneColor.r}, ${zoneColor.g}, ${zoneColor.b}, ${baseAlpha * 2.0 + shimmer})`
            ctx.lineWidth = 0.8
            const doorW = zoneRadius * 0.5
            const doorH = zoneRadius * 1.2
            const doorShift = Math.sin(time * 1.2) * 2
            // Arched door shape
            ctx.beginPath()
            ctx.moveTo(zx - doorW / 2, zy + doorH / 2 + doorShift)
            ctx.lineTo(zx - doorW / 2, zy - doorH / 4 + doorShift)
            ctx.quadraticCurveTo(zx, zy - doorH / 2 + doorShift, zx + doorW / 2, zy - doorH / 4 + doorShift)
            ctx.lineTo(zx + doorW / 2, zy + doorH / 2 + doorShift)
            ctx.stroke()
            // Small threshold line
            ctx.beginPath()
            ctx.moveTo(zx - doorW / 2 - 3, zy + doorH / 2 + doorShift)
            ctx.lineTo(zx + doorW / 2 + 3, zy + doorH / 2 + doorShift)
            ctx.stroke()
          } else if (zone.room === 'projection') {
            // Projection: film strip / light cone
            ctx.strokeStyle = `rgba(${zoneColor.r}, ${zoneColor.g}, ${zoneColor.b}, ${baseAlpha * 1.8 + shimmer})`
            ctx.lineWidth = 0.6
            // Light cone triangle
            const coneW = zoneRadius * 0.8
            const coneH = zoneRadius * 1.0
            const coneShift = Math.sin(time * 0.9) * 1.5
            ctx.beginPath()
            ctx.moveTo(zx, zy - coneH / 2 + coneShift)
            ctx.lineTo(zx - coneW / 2, zy + coneH / 2 + coneShift)
            ctx.lineTo(zx + coneW / 2, zy + coneH / 2 + coneShift)
            ctx.closePath()
            ctx.stroke()
            // Film perforations (small squares along the side)
            const perfSize = 2.5
            for (let p = 0; p < 4; p++) {
              const py = zy - coneH / 3 + p * (coneH / 4) + coneShift
              ctx.fillStyle = `rgba(${zoneColor.r}, ${zoneColor.g}, ${zoneColor.b}, ${baseAlpha * 1.5})`
              ctx.fillRect(zx - coneW / 2 - perfSize - 3, py - perfSize / 2, perfSize, perfSize)
              ctx.fillRect(zx + coneW / 2 + 3, py - perfSize / 2, perfSize, perfSize)
            }
          }

          // Hover effect: ripple (concentric circles expanding outward)
          if (hovered) {
            const rippleCount = 3
            for (let r = 0; r < rippleCount; r++) {
              const phase = (time * 1.5 + r * 0.7) % 2.0
              const rippleRadius = phase * zoneRadius * 1.5
              const rippleAlpha = Math.max(0, 0.15 * (1.0 - phase / 2.0))
              ctx.beginPath()
              ctx.arc(zx, zy, rippleRadius, 0, Math.PI * 2)
              ctx.strokeStyle = `rgba(${zoneColor.r}, ${zoneColor.g}, ${zoneColor.b}, ${rippleAlpha})`
              ctx.lineWidth = 1.0
              ctx.stroke()
            }
            // Cursor hint
            canvas!.style.cursor = 'pointer'
          }
        }

        ctx.restore()
      }

      // Reset cursor when not hovering any zone
      if (hoveredZone === -1 && canvas) {
        canvas.style.cursor = 'default'
      }
    }
  }

  mirrorData = loadData()

  // Throttle for ripple creation on mouse move
  let lastRippleTime = 0

  return {
    name: 'mirror',
    label: 'the mirror',
    hidden: true,

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        width: 100%; height: 100%;
        pointer-events: auto;
        background: #000;
      `

      canvas = document.createElement('canvas')
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      canvas.style.cssText = 'width: 100%; height: 100%; cursor: pointer;'
      ctx = canvas.getContext('2d')

      // Initialize inscription timer
      inscriptionStartTime = Date.now()

      // Navigation zone position calculator
      const getZonePositions = () => {
        if (!canvas) return []
        const cw = canvas.width
        const ch = canvas.height
        const fg = getFrameGeometry(cw, ch)
        const fInnerX = fg.frameX + 10
        const fInnerW = fg.frameW - 20
        const fInnerY = fg.frameY + 10
        const fInnerH = fg.frameH - 20
        const radius = Math.min(fg.frameW * 0.08, 40) * 1.3

        return navZones.map(zone => {
          let x: number, y: number
          switch (zone.side) {
            case 'left':
              x = fInnerX + fg.frameW * 0.12
              y = fg.frameY + fg.frameH * 0.5
              break
            case 'right':
              x = fInnerX + fInnerW - fg.frameW * 0.12
              y = fg.frameY + fg.frameH * 0.5
              break
            case 'top':
              x = fg.frameX + fg.frameW * 0.5
              y = fInnerY + fg.frameH * 0.1
              break
            case 'bottom':
              x = fg.frameX + fg.frameW * 0.5
              y = fInnerY + fInnerH - fg.frameH * 0.1
              break
          }
          return { x, y, radius, room: zone.room }
        })
      }

      canvas.addEventListener('click', (e) => {
        if (!deps.switchTo || !canvas || shatterTime > 0) return
        const zones = getZonePositions()
        for (let i = 0; i < zones.length; i++) {
          const z = zones[i]
          const dx = e.clientX - z.x
          const dy = e.clientY - z.y
          if (dx * dx + dy * dy < z.radius * z.radius) {
            // Start shatter animation, navigate after delay
            shatterTime = time
            shatterTarget = z.room
            // Play shatter sound
            playShatterSound()
            setTimeout(() => {
              if (deps.switchTo) deps.switchTo(z.room)
              shatterTime = -1
              shatterTarget = ''
            }, 400)
            return
          }
        }
      })
      canvas.addEventListener('mousemove', (e) => {
        if (!canvas) return
        const now = performance.now()

        // Track cursor velocity for reflection distortion
        if (prevMouseX >= 0 && prevMouseY >= 0) {
          const dx = e.clientX - prevMouseX
          const dy = e.clientY - prevMouseY
          const dt = Math.max(1, now - lastMouseMoveTime) / 1000  // seconds
          const speed = Math.sqrt(dx * dx + dy * dy) / dt  // px/sec

          // Smooth velocity with exponential moving average
          cursorVelocity = cursorVelocity * 0.7 + speed * 0.3

          // Apply distortion proportional to velocity (only inside mirror)
          if (isInMirrorArea(e.clientX, e.clientY, canvas.width, canvas.height)) {
            const normalizedVelocity = Math.min(cursorVelocity / 2000, 1.0)  // cap at 2000 px/s
            distortionAmount = Math.max(distortionAmount, normalizedVelocity)
          }
        }

        prevMouseX = e.clientX
        prevMouseY = e.clientY
        lastMouseMoveTime = now
        mouseX = e.clientX
        mouseY = e.clientY

        // Mirror ripple: create ripple when mouse is over mirror area
        if (now - lastRippleTime > 120 && isInMirrorArea(mouseX, mouseY, canvas.width, canvas.height)) {
          ripples.push({
            x: mouseX,
            y: mouseY,
            age: 0,
            maxAge: 1.2,
          })
          lastRippleTime = now
          // Cap ripple count
          if (ripples.length > 15) ripples.shift()
        }

        // Navigation zone hover detection
        if (!deps.switchTo) return
        hoveredZone = -1
        const zones = getZonePositions()
        for (let i = 0; i < zones.length; i++) {
          const z = zones[i]
          const ddx = e.clientX - z.x
          const ddy = e.clientY - z.y
          if (ddx * ddx + ddy * ddy < z.radius * z.radius) {
            hoveredZone = i
            break
          }
        }
      })

      overlay.appendChild(canvas)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
          buildPortrait()
        }
      }
      window.addEventListener('resize', onResize)

      return overlay
    },

    activate() {
      active = true
      mirrorData.visitCount++
      mirrorData.lastVisit = Date.now()
      saveData()
      buildPortrait()
      inscriptionStartTime = Date.now()
      render()

      // Initialize and fade in audio
      initAudio().then(() => {
        if (active) fadeAudioIn()
      })
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      fadeAudioOut()
      stopFogAudio()
      // Clear visual state
      ripples.length = 0
      fogParticles.length = 0
      fogWritings.length = 0
      // Reset distortion
      distortionAmount = 0
      cursorVelocity = 0
      prevMouseX = -1
      prevMouseY = -1
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      destroyAudio()
      ripples.length = 0
      fogParticles.length = 0
      fogWritings.length = 0
      overlay?.remove()
    },
  }
}
