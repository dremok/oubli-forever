/**
 * THE CHOIR — voices in the dark
 *
 * Generative choral music. Multiple oscillators simulate singing voices,
 * each with vibrato, vowel formants, and slow harmonic drift.
 * Click to place a new voice in space. Each voice has a pitch
 * determined by its vertical position and a timbre from its horizontal.
 *
 * Voices slowly fade over time. The choir is always changing.
 * At any moment it might be a single voice or a wall of sound.
 *
 * No memories. Pure generative music and spatial interaction.
 *
 * VOICE RESONANCE PORTALS: voices placed near the edges of the room
 * resonate with adjacent rooms. Sustain a voice at the boundary
 * to open a passage through sound.
 *
 * Cathedral reverb with multiple delay lines for depth.
 * Harmonic rules inspired by tintinnabuli: consonant intervals
 * ring longer, dissonant intervals create beating/tremolo.
 * Ghost voices replay from the cathedral's memory.
 *
 * Inspired by: Gregorian chant, tintinnabuli technique,
 * Ligeti's Atmospheres, Hildegard von Bingen,
 * Meredith Monk's extended vocal techniques,
 * Pauline Oliveros' deep listening, throat singing,
 * the sound of wind through architecture, how voices
 * combine to create something none of them contain alone
 */

import type { Room } from './RoomManager'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'
import { shareChoirVoice, fetchChoirVoices } from '../shared/FootprintReporter'

interface ChoirDeps {
  switchTo?: (name: string) => void
}

interface Voice {
  x: number
  y: number
  freq: number
  osc: OscillatorNode | null
  gain: GainNode | null
  vibrato: OscillatorNode | null
  filter: BiquadFilterNode | null
  birth: number
  life: number // max life in seconds
  alpha: number
  isGhost?: boolean
}

/** Record of a voice that has faded, for ghost replay */
interface GhostRecord {
  x: number
  y: number
  freq: number
  xNorm: number
  yNorm: number
}

/** A flickering candle point at the base of the cathedral */
interface Candle {
  x: number
  y: number
  phase: number
  speed: number
  brightness: number
  size: number
}

interface ResonanceZone {
  label: string
  room: string
  resonance: number
  test: (x: number, y: number, w: number, h: number) => boolean
}

const CULTURAL_INSCRIPTIONS = [
  'arvo pärt\'s tintinnabuli: each voice has a melodic voice and a tintinnabuli voice. memory and echo.',
  'ligeti\'s atmosphères: 48 string players, each on a different note. a cloud of sound with no melody.',
  'hildegard von bingen composed music she heard in visions. the choir as direct channel to the divine.',
  'the milan olympics opening was defiantly analog. fire instead of drones. voice instead of AI.',
  'the deep note — THX\'s famous chord — is 30 voices starting in chaos and converging to unison.',
  'meredith monk treats the voice as an instrument of memory: glossolalia, ululation, prehistoric sound.',
  'the first polyphony: two monks singing different notes simultaneously, 9th century. harmony as accident.',
  'transcranial ultrasound: MIT can now probe deep brain structures. sound as the tool of consciousness.',
  'pauline oliveros: deep listening. attend to all sounds equally. the room\'s hum is as important as the voice.',
  'wabi-sabi went viral on tiktok, then was co-opted and hollowed out. beauty of imperfection, mass-produced.',
  'when a choir sings in unison, their heartbeats synchronize. the body remembers before the mind does.',
  'the schola cantorum of rome: 1400 years of continuous singing. a chain of breath that never broke.',
  'stained glass was designed to sing with light. each color a frequency. the cathedral is an instrument.',
  'in 2026 researchers found that group singing releases more oxytocin than any other collective activity.',
  'the ison — a sustained drone note held by half the choir while the other half sings melody above it.',
  'john cage\'s organ2/aslsp in halberstadt: a chord change every few years. the slowest music in the world.',
]

export function createChoirRoom(deps?: ChoirDeps): Room {
  let inscriptionTimer = 0
  let inscriptionIdx = 0
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let voices: Voice[] = []
  let audioCtx: AudioContext | null = null
  let masterGain: GainNode | null = null
  let reverb: ConvolverNode | null = null
  let totalVoices = 0

  // Cathedral delay-based reverb nodes
  let delayLines: { delay: DelayNode; feedback: GainNode; output: GainNode }[] = []

  // Ambient pad nodes
  let padOscs: OscillatorNode[] = []
  let padGains: GainNode[] = []
  let padFilter: BiquadFilterNode | null = null
  let padMasterGain: GainNode | null = null
  let padLfoOsc: OscillatorNode | null = null
  let padLfoGain: GainNode | null = null

  // Ghost voice system
  const ghostRecords: GhostRecord[] = []
  let ghostTimer: ReturnType<typeof setInterval> | null = null
  let remoteVoicesLoaded = false

  // Candles for visual depth
  let candles: Candle[] = []

  // Collective breath — synchronized dimming/brightening across all voices
  let breathPhase = 0 // 0..2π, cycles slowly
  const BREATH_RATE = 0.15 // ~42 second cycle

  // Stained glass light rays — activated when triads form
  interface LightRay {
    angle: number
    hue: number
    alpha: number
    width: number
    length: number
  }
  let lightRays: LightRay[] = []
  let triadDetected = false
  let triadStrength = 0

  // Resonance zones — voices placed near edges create portals to adjacent rooms
  const resonanceZones: ResonanceZone[] = [
    {
      label: 'the instrument',
      room: 'instrument',
      resonance: 0,
      test: (_x, y, _w, h) => y < h * 0.15,
    },
    {
      label: 'the seance',
      room: 'seance',
      resonance: 0,
      test: (_x, y, _w, h) => y > h * 0.85,
    },
    {
      label: 'the terrarium',
      room: 'terrarium',
      resonance: 0,
      test: (x, y, w, h) => x < w * 0.15 && y > h * 0.3 && y < h * 0.7,
    },
  ]

  // Create a simple reverb impulse response
  function createReverbIR(actx: AudioContext, duration: number, decay: number): AudioBuffer {
    const length = actx.sampleRate * duration
    const buffer = actx.createBuffer(2, length, actx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch)
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
      }
    }
    return buffer
  }

  // Create cathedral delay-based reverb (4 delay lines with different times + feedback)
  function createCathedralDelays(actx: AudioContext, destination: AudioNode, source: AudioNode) {
    const delayConfigs = [
      { time: 0.071, feedback: 0.62, gain: 0.18 },  // short early reflection
      { time: 0.137, feedback: 0.55, gain: 0.14 },  // medium reflection
      { time: 0.233, feedback: 0.48, gain: 0.11 },  // longer reflection
      { time: 0.379, feedback: 0.42, gain: 0.08 },  // long cathedral tail
    ]

    delayLines = delayConfigs.map(cfg => {
      const delay = actx.createDelay(1.0)
      delay.delayTime.value = cfg.time

      const feedback = actx.createGain()
      feedback.gain.value = cfg.feedback

      const output = actx.createGain()
      output.gain.value = cfg.gain

      // Source -> delay -> output -> destination
      source.connect(delay)
      delay.connect(output)
      output.connect(destination)

      // Feedback loop: delay -> feedback -> delay
      delay.connect(feedback)
      feedback.connect(delay)

      return { delay, feedback, output }
    })
  }

  // Create ambient pad — low sustained chord (C2-G2-C3) with slow filter sweep
  function createAmbientPad(actx: AudioContext, destination: AudioNode) {
    const padFreqs = [65.41, 98.0, 130.81] // C2, G2, C3

    padMasterGain = actx.createGain()
    padMasterGain.gain.value = 0

    padFilter = actx.createBiquadFilter()
    padFilter.type = 'lowpass'
    padFilter.frequency.value = 400
    padFilter.Q.value = 1.0

    // LFO for slow filter sweep
    padLfoOsc = actx.createOscillator()
    padLfoOsc.frequency.value = 0.05 // very slow: one cycle per 20 seconds
    padLfoGain = actx.createGain()
    padLfoGain.gain.value = 200 // sweep range: 200-600 Hz
    padLfoOsc.connect(padLfoGain)
    padLfoGain.connect(padFilter.frequency)
    padLfoOsc.start()

    padFilter.connect(padMasterGain)
    padMasterGain.connect(destination)

    // Fade in the pad over 6 seconds
    const now = actx.currentTime
    padMasterGain.gain.setValueAtTime(0, now)
    padMasterGain.gain.linearRampToValueAtTime(0.03, now + 6)

    padFreqs.forEach(freq => {
      const osc = actx.createOscillator()

      // Soft sawtooth-ish wave for warmth
      const nH = 12
      const real = new Float32Array(nH)
      const imag = new Float32Array(nH)
      real[0] = 0; imag[0] = 0
      for (let k = 1; k < nH; k++) {
        imag[k] = 1.0 / (k * k) // steep rolloff for soft tone
      }
      const wave = actx.createPeriodicWave(real, imag, { disableNormalization: false })
      osc.setPeriodicWave(wave)
      osc.frequency.value = freq

      const g = actx.createGain()
      g.gain.value = 0.3 // balance between the 3 tones

      osc.connect(g)
      g.connect(padFilter!)
      osc.start()

      padOscs.push(osc)
      padGains.push(g)
    })
  }

  /** Compute the interval in semitones between two frequencies */
  function intervalSemitones(f1: number, f2: number): number {
    return Math.abs(12 * Math.log2(f1 / f2))
  }

  /** Classify an interval for harmonic rules */
  function classifyInterval(semitones: number): 'consonant' | 'dissonant' | 'neutral' {
    // Reduce to within one octave
    const s = semitones % 12
    // Perfect intervals: unison, fifth, octave
    if (s < 0.3 || Math.abs(s - 7) < 0.3 || Math.abs(s - 12) < 0.3) return 'consonant'
    // Minor second / major seventh — dissonant
    if (s < 1.3 || s > 10.7) return 'dissonant'
    // Tritone
    if (Math.abs(s - 6) < 0.3) return 'dissonant'
    return 'neutral'
  }

  /**
   * Apply harmonic rules between overlapping voices.
   * - Consonant intervals (P5, P8): boost gain slightly, extend life feel
   * - Dissonant intervals (m2): apply tremolo via gain modulation
   * - Voices drift toward consonant intervals over time
   */
  function applyHarmonicRules() {
    if (!audioCtx) return

    for (let i = 0; i < voices.length; i++) {
      const vi = voices[i]
      if (!vi.gain || !vi.osc) continue
      const ageI = time - vi.birth
      if (ageI < 2 || ageI > vi.life - 3) continue // skip during fade in/out

      let consonantBoost = 0
      let dissonantBeat = 0

      for (let j = 0; j < voices.length; j++) {
        if (i === j) continue
        const vj = voices[j]
        if (!vj.osc) continue
        const ageJ = time - vj.birth
        if (ageJ < 2 || ageJ > vj.life - 3) continue

        const semis = intervalSemitones(vi.freq, vj.freq)
        const cls = classifyInterval(semis)

        if (cls === 'consonant') {
          consonantBoost += 0.04
        } else if (cls === 'dissonant') {
          dissonantBeat += 0.15
        }
      }

      // Consonant: slightly louder (cap at +0.1)
      const boostTarget = Math.min(0.1, consonantBoost)
      // Dissonant: tremolo beating
      const beatAmount = Math.min(0.3, dissonantBeat)

      try {
        const baseGain = 0.3
        const now = audioCtx.currentTime
        if (beatAmount > 0.01) {
          // Create beating effect — modulate gain with sine at ~6-8 Hz
          const beatRate = 6 + beatAmount * 4
          const beatDepth = beatAmount * 0.08
          const mod = Math.sin(now * beatRate * Math.PI * 2) * beatDepth
          vi.gain.gain.setTargetAtTime(baseGain + boostTarget + mod, now, 0.05)
        } else {
          vi.gain.gain.setTargetAtTime(baseGain + boostTarget, now, 0.1)
        }
      } catch {
        // Audio scheduling error — ignore
      }

      // Drift toward consonant intervals: gently pull frequency toward nearest P5/P8
      if (vi.osc && voices.length > 1) {
        let nearestConsonant = vi.freq
        let minDist = Infinity
        for (let j = 0; j < voices.length; j++) {
          if (i === j) continue
          const vj = voices[j]
          if (!vj.osc) continue
          // Check P5 above and below, P8 above and below
          const targets = [
            vj.freq * 1.5,    // P5 above
            vj.freq / 1.5,    // P5 below
            vj.freq * 2,      // P8 above
            vj.freq / 2,      // P8 below
            vj.freq,          // unison
          ]
          for (const t of targets) {
            const dist = Math.abs(t - vi.freq)
            if (dist < minDist && dist > 0.5) { // don't drift if already there
              minDist = dist
              nearestConsonant = t
            }
          }
        }
        // Very gentle drift — 0.02 Hz per frame toward consonance
        if (minDist < 20 && minDist > 0.5) {
          const drift = (nearestConsonant - vi.freq) * 0.0003
          vi.freq += drift
          try {
            vi.osc.frequency.setTargetAtTime(vi.freq, audioCtx.currentTime, 0.5)
          } catch {
            // ignore
          }
        }
      }
    }
  }

  async function initAudio() {
    try {
      audioCtx = await getAudioContext()
      const destination = getAudioDestination()

      masterGain = audioCtx.createGain()
      masterGain.gain.value = 0.15

      // Convolver reverb for cathedral-like space
      reverb = audioCtx.createConvolver()
      reverb.buffer = createReverbIR(audioCtx, 4, 2)

      const reverbGain = audioCtx.createGain()
      reverbGain.gain.value = 0.5

      masterGain.connect(destination)
      masterGain.connect(reverb)
      reverb.connect(reverbGain)
      reverbGain.connect(destination)

      // Additional cathedral delay-based reverb for depth
      createCathedralDelays(audioCtx, destination, masterGain)

      // Ambient pad drone
      createAmbientPad(audioCtx, destination)
    } catch {
      // Audio not available
    }
  }

  function addVoice(x: number, y: number, isGhost = false) {
    if (!audioCtx || !masterGain || !canvas) return

    const w = canvas.width
    const h = canvas.height

    // EMaj7add9 chord with proper voicing:
    // E and B (root+fifth) tend lower, F# G# D# (color tones) tend higher
    const pitchRatio = 1 - y / h // 0=low, 1=high
    const baseFreq = 82.41 // E2

    // 5 chord tones across 3 octaves with octave-preference weights
    // weights: [octave2, octave3, octave4] — higher weight = more likely
    const voicedNotes = [
      { semitones: [0, 12, 24],  weights: [0.55, 0.35, 0.10] },  // E: strongly low
      { semitones: [7, 19, 31],  weights: [0.50, 0.35, 0.15] },  // B: strongly low
      { semitones: [2, 14, 26],  weights: [0.10, 0.35, 0.55] },  // F#: tends high
      { semitones: [4, 16, 28],  weights: [0.08, 0.27, 0.65] },  // G#: strongly high
      { semitones: [11, 23, 35], weights: [0.08, 0.22, 0.70] },  // D#: strongly high
    ]

    // Pick a random chord tone
    const note = voicedNotes[Math.floor(Math.random() * voicedNotes.length)]

    // Y position shifts the octave preference (higher click -> higher octaves)
    const adjusted = note.weights.map((wt, i) => {
      const octaveBias = (i - 1) * 0.6 // -0.6, 0, +0.6
      return Math.max(0.01, wt * (1 + (pitchRatio - 0.5) * octaveBias))
    })
    const wSum = adjusted[0] + adjusted[1] + adjusted[2]
    const norm = adjusted.map(wt => wt / wSum)

    // Weighted random octave selection
    const roll = Math.random()
    const octIdx = roll < norm[0] ? 0 : roll < norm[0] + norm[1] ? 1 : 2
    const semitone = note.semitones[octIdx]
    const freq = baseFreq * Math.pow(2, semitone / 12)

    // X,Y -> continuous waveform shape via custom PeriodicWave
    const xNorm = x / w // 0=left(pure), 1=right(bright)
    const yNorm = y / h // 0=top, 1=bottom

    try {
      const osc = audioCtx.createOscillator()

      // Build custom waveform: X controls harmonic richness, Y affects even/odd balance
      const nH = 20
      const real = new Float32Array(nH)
      const imag = new Float32Array(nH)
      real[0] = 0; imag[0] = 0
      for (let k = 1; k < nH; k++) {
        if (k === 1) { imag[k] = 1.0; continue }
        const isOdd = k % 2 === 1
        // X: left=fundamental only, middle=odd harmonics(hollow), right=all harmonics(bright)
        const evenPresence = isOdd ? 1.0 : Math.max(0, (xNorm - 0.25) / 0.75)
        const richness = Math.pow(xNorm, 0.4)
        // Y: top adds slight emphasis on higher partials, bottom on lower
        const yShift = 1.0 + (1 - yNorm - 0.5) * 0.3
        const falloff = 1.0 / Math.pow(k, (1.8 - xNorm * 0.9) * yShift)
        imag[k] = richness * evenPresence * falloff
      }
      const wave = audioCtx.createPeriodicWave(real, imag, { disableNormalization: false })
      osc.setPeriodicWave(wave)
      osc.frequency.value = freq

      // Vibrato
      const vibrato = audioCtx.createOscillator()
      vibrato.frequency.value = 4.5 + Math.random() * 2 // 4.5-6.5 Hz
      const vibratoGain = audioCtx.createGain()
      vibratoGain.gain.value = freq * 0.008 // subtle pitch wobble
      vibrato.connect(vibratoGain)
      vibratoGain.connect(osc.frequency)

      // Formant filter: X controls openness, Y affects resonance
      const filter = audioCtx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 300 + xNorm * 2200 + pitchRatio * 800 // 300-3300 Hz
      filter.Q.value = 1.5 + (1 - xNorm) * 3 + yNorm * 1.5 // more resonant when pure/low

      // Ghost voices: more filtered and quieter
      if (isGhost) {
        filter.frequency.value *= 0.6 // darker, more distant
        filter.Q.value += 2 // more nasal/distant quality
      }

      // Gain envelope
      const gain = audioCtx.createGain()
      gain.gain.value = 0

      // Fade in
      const now = audioCtx.currentTime
      const peakGain = isGhost ? 0.12 : 0.3 // ghosts are quieter
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(peakGain, now + 2)

      // Connect
      osc.connect(filter)
      filter.connect(gain)
      gain.connect(masterGain)

      osc.start()
      vibrato.start()

      const life = isGhost
        ? 8 + Math.random() * 10  // ghosts: shorter life (8-18s)
        : 15 + Math.random() * 20 // normal: 15-35 seconds

      voices.push({
        x, y, freq,
        osc, gain, vibrato, filter,
        birth: time,
        life,
        alpha: 0,
        isGhost,
      })

      totalVoices++

      // Record for ghost replay (only non-ghosts)
      if (!isGhost) {
        ghostRecords.push({ x, y, freq, xNorm, yNorm })
        // Keep only last 20 records
        if (ghostRecords.length > 20) ghostRecords.shift()
        // Share voice placement with other visitors
        if (canvas) {
          shareChoirVoice(x / canvas.width, y / canvas.height, freq)
        }
      }

      // Schedule fade out
      gain.gain.setValueAtTime(peakGain, now + life - 3)
      gain.gain.linearRampToValueAtTime(0, now + life)

      // Stop after fade
      setTimeout(() => {
        try {
          osc.stop()
          vibrato.stop()
        } catch {}
      }, life * 1000 + 500)
    } catch {
      // Audio error
    }
  }

  /** Replay a ghost voice from the cathedral's memory */
  function spawnGhostVoice() {
    if (!active || !canvas || ghostRecords.length < 5) return
    const record = ghostRecords[Math.floor(Math.random() * ghostRecords.length)]
    addVoice(record.x, record.y, true)
  }

  function removeDeadVoices() {
    voices = voices.filter(v => {
      const age = time - v.birth
      if (age > v.life) {
        try {
          v.osc?.disconnect()
          v.gain?.disconnect()
          v.vibrato?.disconnect()
          v.filter?.disconnect()
        } catch {}
        return false
      }
      return true
    })
  }

  // Seed some initial voices
  function seedVoices() {
    if (!canvas) return
    const w = canvas.width
    const h = canvas.height
    // 3 initial voices
    addVoice(w * 0.3, h * 0.5)
    addVoice(w * 0.5, h * 0.35)
    addVoice(w * 0.7, h * 0.6)
  }

  // Initialize candles
  function initCandles() {
    if (!canvas) return
    candles = []
    const w = canvas.width
    const h = canvas.height
    const count = 12 + Math.floor(Math.random() * 8)
    for (let i = 0; i < count; i++) {
      candles.push({
        x: w * 0.05 + Math.random() * w * 0.9,
        y: h * 0.85 + Math.random() * h * 0.12,
        phase: Math.random() * Math.PI * 2,
        speed: 2 + Math.random() * 4,
        brightness: 0.3 + Math.random() * 0.5,
        size: 1.5 + Math.random() * 2.5,
      })
    }
  }

  // Draw resonance zone edge effects
  function drawResonanceEdge(
    c: CanvasRenderingContext2D,
    zoneIndex: number,
    w: number, h: number,
    r: number, t: number,
  ) {
    if (r < 0.01) return

    if (zoneIndex === 0) {
      // TOP edge — instrument portal
      for (let i = 0; i < 5; i++) {
        const spread = w * 0.1 + i * w * 0.18
        const pulse = Math.sin(t * 2 + i * 1.3) * 0.3 + 0.7
        const a = r * 0.25 * pulse
        c.strokeStyle = `rgba(200, 180, 255, ${a})`
        c.lineWidth = 1
        c.beginPath()
        c.arc(w / 2, -10, spread, 0.1 * Math.PI, 0.9 * Math.PI)
        c.stroke()
      }
    } else if (zoneIndex === 1) {
      // BOTTOM edge — seance portal
      for (let i = 0; i < 5; i++) {
        const spread = w * 0.1 + i * w * 0.18
        const pulse = Math.sin(t * 1.8 + i * 1.1) * 0.3 + 0.7
        const a = r * 0.25 * pulse
        c.strokeStyle = `rgba(200, 180, 255, ${a})`
        c.lineWidth = 1
        c.beginPath()
        c.arc(w / 2, h + 10, spread, 1.1 * Math.PI, 1.9 * Math.PI)
        c.stroke()
      }
    } else if (zoneIndex === 2) {
      // LEFT edge — terrarium portal
      for (let i = 0; i < 5; i++) {
        const spread = h * 0.06 + i * h * 0.1
        const pulse = Math.sin(t * 2.2 + i * 0.9) * 0.3 + 0.7
        const a = r * 0.25 * pulse
        c.strokeStyle = `rgba(200, 180, 255, ${a})`
        c.lineWidth = 1
        c.beginPath()
        c.arc(-10, h / 2, spread, -0.4 * Math.PI, 0.4 * Math.PI)
        c.stroke()
      }
    }
  }

  // Draw connecting wave lines from a voice to the edge of the zone
  function drawVoiceConnection(
    c: CanvasRenderingContext2D,
    v: Voice,
    zoneIndex: number,
    w: number, h: number,
    t: number,
  ) {
    // Target point on the edge
    let tx: number, ty: number
    if (zoneIndex === 0) {
      tx = v.x; ty = 0
    } else if (zoneIndex === 1) {
      tx = v.x; ty = h
    } else {
      tx = 0; ty = v.y
    }

    const dx = tx - v.x
    const dy = ty - v.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 1) return

    const steps = 20
    const perpX = -dy / dist
    const perpY = dx / dist

    c.beginPath()
    for (let s = 0; s <= steps; s++) {
      const frac = s / steps
      const px = v.x + dx * frac
      const py = v.y + dy * frac
      // Sine wave perpendicular to the line
      const wave = Math.sin(frac * 8 + t * 4) * 6 * (1 - frac) * v.alpha
      const fx = px + perpX * wave
      const fy = py + perpY * wave
      if (s === 0) c.moveTo(fx, fy)
      else c.lineTo(fx, fy)
    }
    c.strokeStyle = `rgba(200, 180, 255, ${v.alpha * 0.06})`
    c.lineWidth = 1
    c.stroke()
  }

  // Draw cathedral pillars — faint vertical columns at left and right edges
  function drawPillars(c: CanvasRenderingContext2D, w: number, h: number, t: number) {
    const pillarCount = 4 // pillars per side
    const pillarWidth = 18
    const marginX = w * 0.03

    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < pillarCount; i++) {
        const baseX = side === 0
          ? marginX + i * (w * 0.04)
          : w - marginX - i * (w * 0.04)

        const flicker = Math.sin(t * 0.3 + i * 1.7 + side * 2.1) * 0.01
        const alpha = 0.025 + flicker

        // Main pillar body — gradient from bottom to top
        const grad = c.createLinearGradient(baseX, 0, baseX, h)
        grad.addColorStop(0, `rgba(80, 70, 110, ${alpha * 0.3})`)
        grad.addColorStop(0.3, `rgba(60, 50, 90, ${alpha})`)
        grad.addColorStop(0.8, `rgba(50, 40, 80, ${alpha})`)
        grad.addColorStop(1, `rgba(40, 30, 70, ${alpha * 0.5})`)

        c.fillStyle = grad
        c.fillRect(baseX - pillarWidth / 2, 0, pillarWidth, h)

        // Capital at top — small widening
        const capHeight = 20
        c.fillStyle = `rgba(70, 60, 100, ${alpha * 1.2})`
        c.beginPath()
        c.moveTo(baseX - pillarWidth / 2 - 4, capHeight)
        c.lineTo(baseX + pillarWidth / 2 + 4, capHeight)
        c.lineTo(baseX + pillarWidth / 2, capHeight + 10)
        c.lineTo(baseX - pillarWidth / 2, capHeight + 10)
        c.closePath()
        c.fill()

        // Base at bottom
        c.fillStyle = `rgba(70, 60, 100, ${alpha * 1.2})`
        c.beginPath()
        c.moveTo(baseX - pillarWidth / 2 - 4, h - 10)
        c.lineTo(baseX + pillarWidth / 2 + 4, h - 10)
        c.lineTo(baseX + pillarWidth / 2, h - 20)
        c.lineTo(baseX - pillarWidth / 2, h - 20)
        c.closePath()
        c.fill()
      }
    }
  }

  // Draw flickering candles at the base
  function drawCandles(c: CanvasRenderingContext2D, t: number) {
    for (const candle of candles) {
      const flicker = Math.sin(t * candle.speed + candle.phase) * 0.3
        + Math.sin(t * candle.speed * 1.7 + candle.phase * 0.6) * 0.2
      const b = candle.brightness * (0.7 + flicker * 0.3)
      if (b < 0.05) continue

      // Warm glow
      const glowR = 8 + candle.size * 4
      const glow = c.createRadialGradient(candle.x, candle.y, 0, candle.x, candle.y, glowR)
      glow.addColorStop(0, `rgba(255, 200, 100, ${b * 0.15})`)
      glow.addColorStop(0.4, `rgba(255, 160, 60, ${b * 0.06})`)
      glow.addColorStop(1, 'transparent')
      c.fillStyle = glow
      c.beginPath()
      c.arc(candle.x, candle.y, glowR, 0, Math.PI * 2)
      c.fill()

      // Flame point
      c.fillStyle = `rgba(255, 220, 140, ${b * 0.5})`
      c.beginPath()
      c.arc(candle.x, candle.y - candle.size * 0.5, candle.size * 0.6, 0, Math.PI * 2)
      c.fill()
    }
  }

  // Draw rose window — circular mandala pattern at top-center, responds to harmonic density
  function drawRoseWindow(c: CanvasRenderingContext2D, w: number, h: number, t: number) {
    const cx = w / 2
    const cy = h * 0.08
    const baseRadius = Math.min(w, h) * 0.06

    // Harmonic density = number of active voices, capped
    const density = Math.min(voices.length / 6, 1)
    if (density < 0.01 && voices.length === 0) return

    const alpha = 0.02 + density * 0.04

    // Outer circle
    c.strokeStyle = `rgba(180, 150, 220, ${alpha})`
    c.lineWidth = 1
    c.beginPath()
    c.arc(cx, cy, baseRadius, 0, Math.PI * 2)
    c.stroke()

    // Petal pattern — number of petals increases with density
    const petalCount = 6 + Math.floor(density * 6)
    for (let p = 0; p < petalCount; p++) {
      const angle = (p / petalCount) * Math.PI * 2 + t * 0.1
      const petalAlpha = alpha * (0.5 + Math.sin(t * 0.8 + p * 0.5) * 0.3)

      // Inner petal arc
      const innerR = baseRadius * 0.3
      const outerR = baseRadius * (0.6 + density * 0.3)
      const px = cx + Math.cos(angle) * innerR
      const py = cy + Math.sin(angle) * innerR
      const px2 = cx + Math.cos(angle) * outerR
      const py2 = cy + Math.sin(angle) * outerR

      c.strokeStyle = `rgba(200, 170, 240, ${petalAlpha})`
      c.lineWidth = 0.5
      c.beginPath()
      c.moveTo(px, py)
      c.lineTo(px2, py2)
      c.stroke()

      // Small arc at petal tip
      const tipAngle = angle + 0.15
      const tipX = cx + Math.cos(tipAngle) * outerR
      const tipY = cy + Math.sin(tipAngle) * outerR
      c.beginPath()
      c.moveTo(px2, py2)
      c.quadraticCurveTo(
        cx + Math.cos(angle + 0.08) * (outerR + 5),
        cy + Math.sin(angle + 0.08) * (outerR + 5),
        tipX, tipY,
      )
      c.stroke()
    }

    // Center dot
    c.fillStyle = `rgba(220, 200, 255, ${alpha * 1.5})`
    c.beginPath()
    c.arc(cx, cy, 2, 0, Math.PI * 2)
    c.fill()

    // Concentric inner rings
    for (let r = 1; r <= 3; r++) {
      const ringR = baseRadius * (r * 0.2)
      const ringPulse = Math.sin(t * 0.6 + r * 1.2) * 0.3 + 0.7
      c.strokeStyle = `rgba(180, 160, 220, ${alpha * 0.4 * ringPulse})`
      c.lineWidth = 0.5
      c.beginPath()
      c.arc(cx, cy, ringR, 0, Math.PI * 2)
      c.stroke()
    }
  }

  /** Detect if 3+ voices form a major or minor triad (within tolerance) */
  function detectTriad(): { found: boolean; strength: number; hue: number } {
    const activeVoices = voices.filter(v => {
      const age = time - v.birth
      return age > 2 && age < v.life - 3 && v.osc
    })
    if (activeVoices.length < 3) return { found: false, strength: 0, hue: 0 }

    // Check all triples for major triad (0,4,7) or minor triad (0,3,7) within ±0.5 semitones
    for (let i = 0; i < activeVoices.length; i++) {
      for (let j = i + 1; j < activeVoices.length; j++) {
        for (let k = j + 1; k < activeVoices.length; k++) {
          const freqs = [activeVoices[i].freq, activeVoices[j].freq, activeVoices[k].freq].sort((a, b) => a - b)
          const s1 = 12 * Math.log2(freqs[1] / freqs[0])
          const s2 = 12 * Math.log2(freqs[2] / freqs[0])
          // Normalize to within one octave
          const n1 = ((s1 % 12) + 12) % 12
          const n2 = ((s2 % 12) + 12) % 12
          const sorted = [n1, n2].sort((a, b) => a - b)
          // Major triad: ~4, ~7
          if (Math.abs(sorted[0] - 4) < 0.8 && Math.abs(sorted[1] - 7) < 0.8) {
            return { found: true, strength: 0.8, hue: 40 } // warm gold
          }
          // Minor triad: ~3, ~7
          if (Math.abs(sorted[0] - 3) < 0.8 && Math.abs(sorted[1] - 7) < 0.8) {
            return { found: true, strength: 0.6, hue: 220 } // cool blue
          }
        }
      }
    }
    return { found: false, strength: 0, hue: 0 }
  }

  /** Draw harmonic web — lines connecting consonant voice pairs */
  function drawHarmonicWeb(c: CanvasRenderingContext2D) {
    const activeVoices = voices.filter(v => {
      const age = time - v.birth
      return v.alpha > 0.1 && age > 1 && age < v.life - 2
    })

    for (let i = 0; i < activeVoices.length; i++) {
      for (let j = i + 1; j < activeVoices.length; j++) {
        const vi = activeVoices[i]
        const vj = activeVoices[j]
        const semis = intervalSemitones(vi.freq, vj.freq)
        const cls = classifyInterval(semis)

        if (cls === 'consonant') {
          // Golden thread between consonant voices
          const alpha = Math.min(vi.alpha, vj.alpha) * 0.04
          const pulse = 0.7 + Math.sin(time * 1.5 + i * 0.7 + j * 1.3) * 0.3
          c.strokeStyle = `rgba(255, 215, 100, ${alpha * pulse})`
          c.lineWidth = 0.5
          c.setLineDash([3, 6])
          c.beginPath()
          c.moveTo(vi.x, vi.y)
          // Slight curve through midpoint
          const mx = (vi.x + vj.x) / 2
          const my = (vi.y + vj.y) / 2 - 15
          c.quadraticCurveTo(mx, my, vj.x, vj.y)
          c.stroke()
          c.setLineDash([])
        } else if (cls === 'dissonant') {
          // Red jagged line between dissonant voices
          const alpha = Math.min(vi.alpha, vj.alpha) * 0.02
          const jitter = Math.sin(time * 8 + i + j) * 3
          c.strokeStyle = `rgba(255, 80, 80, ${alpha})`
          c.lineWidth = 0.3
          c.beginPath()
          const steps = 8
          for (let s = 0; s <= steps; s++) {
            const frac = s / steps
            const px = vi.x + (vj.x - vi.x) * frac
            const py = vi.y + (vj.y - vi.y) * frac + (s % 2 === 0 ? jitter : -jitter)
            if (s === 0) c.moveTo(px, py)
            else c.lineTo(px, py)
          }
          c.stroke()
        }
      }
    }
  }

  /** Draw stained glass light rays from rose window when triads are detected */
  function drawStainedGlassLight(c: CanvasRenderingContext2D, w: number, h: number) {
    if (triadStrength < 0.01) return

    const cx = w / 2
    const cy = h * 0.08

    // Generate/update light rays when triad strengthens
    if (triadDetected && lightRays.length < 6) {
      const angle = -0.4 + Math.random() * 0.8 + Math.PI / 2 // mostly downward
      lightRays.push({
        angle,
        hue: Math.random() * 360,
        alpha: 0,
        width: 15 + Math.random() * 25,
        length: h * 0.4 + Math.random() * h * 0.3,
      })
    }

    // Draw and update rays
    lightRays = lightRays.filter(ray => {
      if (triadDetected) {
        ray.alpha = Math.min(triadStrength * 0.04, ray.alpha + 0.0005)
      } else {
        ray.alpha -= 0.001
      }
      if (ray.alpha <= 0) return false

      const endX = cx + Math.cos(ray.angle) * ray.length
      const endY = cy + Math.sin(ray.angle) * ray.length

      // Create gradient along the ray
      const grad = c.createLinearGradient(cx, cy, endX, endY)
      grad.addColorStop(0, `hsla(${ray.hue}, 60%, 70%, ${ray.alpha})`)
      grad.addColorStop(0.3, `hsla(${ray.hue}, 50%, 60%, ${ray.alpha * 0.6})`)
      grad.addColorStop(1, `hsla(${ray.hue}, 40%, 50%, 0)`)

      // Draw as a thin triangle (cone of light)
      const perpAngle = ray.angle + Math.PI / 2
      const hw = ray.width / 2
      c.fillStyle = grad
      c.beginPath()
      c.moveTo(cx, cy)
      c.lineTo(endX + Math.cos(perpAngle) * hw, endY + Math.sin(perpAngle) * hw)
      c.lineTo(endX - Math.cos(perpAngle) * hw, endY - Math.sin(perpAngle) * hw)
      c.closePath()
      c.fill()

      return true
    })
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    removeDeadVoices()

    // Apply harmonic interval rules every few frames
    if (Math.floor(time * 60) % 4 === 0) {
      applyHarmonicRules()
    }

    // Update collective breath phase
    breathPhase += BREATH_RATE * 0.016
    if (breathPhase > Math.PI * 2) breathPhase -= Math.PI * 2
    const breathFactor = 0.85 + Math.sin(breathPhase) * 0.15 // 0.7..1.0

    // Detect triads for stained glass effect
    const triadResult = detectTriad()
    triadDetected = triadResult.found
    if (triadDetected) {
      triadStrength = Math.min(1, triadStrength + 0.02)
    } else {
      triadStrength = Math.max(0, triadStrength - 0.008)
    }

    const w = canvas.width
    const h = canvas.height

    // Background — cathedral dark
    ctx.fillStyle = 'rgba(3, 2, 8, 1)'
    ctx.fillRect(0, 0, w, h)

    // --- Stained glass light rays (behind everything) ---
    drawStainedGlassLight(ctx, w, h)

    // --- Draw cathedral structure (behind everything) ---
    drawPillars(ctx, w, h, time)
    drawCandles(ctx, time)
    drawRoseWindow(ctx, w, h, time)

    // --- Update resonance zones ---
    const livingVoices = voices.filter(v => {
      const age = time - v.birth
      return age > 0.5 && age < v.life - 1 // only count stable voices
    })

    for (let zi = 0; zi < resonanceZones.length; zi++) {
      const zone = resonanceZones[zi]
      let hasVoice = false
      for (const v of livingVoices) {
        if (zone.test(v.x, v.y, w, h)) {
          hasVoice = true
          break
        }
      }
      if (hasVoice) {
        zone.resonance = Math.min(1.0, zone.resonance + 0.01)
      } else {
        zone.resonance = Math.max(0, zone.resonance - 0.005)
      }
    }

    // --- Draw harmonic web (behind voices) ---
    drawHarmonicWeb(ctx)

    // Draw voices
    for (const v of voices) {
      const age = time - v.birth
      const lifeRatio = age / v.life

      // Fade in/out
      if (age < 2) {
        v.alpha = age / 2
      } else if (lifeRatio > 0.8) {
        v.alpha = (1 - lifeRatio) / 0.2
      } else {
        v.alpha = 1
      }

      // Apply collective breath to alpha
      v.alpha *= breathFactor

      const breathe = Math.sin(time * 1.2 + v.x * 0.01) * 0.1

      // Voice visualization — concentric rings with more variance
      const maxRadius = 30 + v.freq * 0.05
      const ringCount = v.isGhost ? 5 : 3 // ghosts have more ethereal rings
      for (let ring = 0; ring < ringCount; ring++) {
        const radius = maxRadius * (0.3 + ring * (v.isGhost ? 0.2 : 0.35))
        const ringPhase = Math.sin(time * 2 + ring * 2 + v.x * 0.01)
        // More variance in pulsing
        const pulseVar = Math.sin(time * 0.7 + ring * 3.1 + v.y * 0.005) * 0.15
        const ringAlpha = v.alpha * (0.05 + breathe + pulseVar) * (1 - ring * (1 / (ringCount + 1)))

        // Ghost voices: blue-shifted, more transparent
        const color = v.isGhost
          ? `rgba(150, 170, 255, ${ringAlpha * 0.6})`
          : `rgba(200, 180, 255, ${ringAlpha})`

        ctx.strokeStyle = color
        ctx.lineWidth = v.isGhost ? 0.5 : 1
        ctx.beginPath()
        ctx.arc(v.x, v.y, radius + ringPhase * 3, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Core glow
      const glowColor = v.isGhost
        ? `rgba(150, 170, 255, ${v.alpha * 0.1})`
        : `rgba(200, 180, 255, ${v.alpha * 0.2})`
      const glow = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, 15)
      glow.addColorStop(0, glowColor)
      glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(v.x, v.y, 15, 0, Math.PI * 2)
      ctx.fill()

      // Center dot
      const dotColor = v.isGhost
        ? `rgba(180, 190, 255, ${v.alpha * 0.25})`
        : `rgba(220, 200, 255, ${v.alpha * 0.4})`
      ctx.fillStyle = dotColor
      ctx.beginPath()
      ctx.arc(v.x, v.y, v.isGhost ? 2 : 3, 0, Math.PI * 2)
      ctx.fill()

      // Note label (very faint) — ghosts show "ghost" indicator
      ctx.font = '11px monospace'
      ctx.textAlign = 'center'
      if (v.isGhost) {
        ctx.fillStyle = `rgba(150, 170, 255, ${v.alpha * 0.05})`
        ctx.fillText(`${v.freq.toFixed(0)}Hz ~`, v.x, v.y + 22)
      } else {
        ctx.fillStyle = `rgba(200, 180, 255, ${v.alpha * 0.06})`
        ctx.fillText(`${v.freq.toFixed(0)}Hz`, v.x, v.y + 22)
      }

      // Draw wave connections from voices to resonance zones they're in
      for (let zi = 0; zi < resonanceZones.length; zi++) {
        if (resonanceZones[zi].test(v.x, v.y, w, h)) {
          drawVoiceConnection(ctx, v, zi, w, h, time)
        }
      }
    }

    // Auto-add voices occasionally to keep the choir alive
    if (voices.length < 2 && Math.random() < 0.005) {
      addVoice(
        w * 0.2 + Math.random() * w * 0.6,
        h * 0.2 + Math.random() * h * 0.6,
      )
    }

    // Title
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 180, 255, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the choir', w / 2, 25)

    // Stats
    ctx.font = '12px monospace'
    ctx.fillStyle = 'rgba(200, 180, 255, 0.06)'
    ctx.textAlign = 'left'
    const ghostCount = voices.filter(v => v.isGhost).length
    ctx.fillText(`${voices.length} voices${ghostCount > 0 ? ` (${ghostCount} echoes)` : ''}`, 12, h - 42)
    ctx.fillText(`${totalVoices} total`, 12, h - 30)

    // Breath indicator — small pulsing circle
    const breathAlpha = 0.03 + breathFactor * 0.03
    ctx.fillStyle = `rgba(200, 180, 255, ${breathAlpha})`
    ctx.beginPath()
    ctx.arc(16, h - 14, 3 + breathFactor * 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(200, 180, 255, 0.04)'
    ctx.fillText('breath', 26, h - 10)

    // Triad indicator
    if (triadStrength > 0.1) {
      ctx.fillStyle = `rgba(255, 215, 100, ${triadStrength * 0.06})`
      ctx.fillText('triad', 80, h - 10)
    }

    // Pitch guide (very faint)
    ctx.textAlign = 'right'
    ctx.fillText('high \u2191', w - 12, h * 0.15)
    ctx.fillText('low \u2193', w - 12, h * 0.85)
    ctx.fillText('\u2190 pure \u00b7 rich \u2192', w - 12, h - 18)

    // --- Draw resonance zone effects ---
    if (deps?.switchTo) {
      for (let zi = 0; zi < resonanceZones.length; zi++) {
        const zone = resonanceZones[zi]

        // Draw edge arcs when resonance > 0
        if (zone.resonance > 0.01) {
          drawResonanceEdge(ctx, zi, w, h, zone.resonance, time)
        }

        // Show label when resonance > 0.7
        if (zone.resonance > 0.7) {
          const labelAlpha = (zone.resonance - 0.7) / 0.3 * 0.25
          ctx.font = '12px "Cormorant Garamond", serif'
          ctx.fillStyle = `rgba(200, 180, 255, ${labelAlpha})`
          ctx.textAlign = 'center'
          if (zi === 0) {
            // Top edge
            ctx.fillText(`resonance detected... ${zone.label}`, w / 2, 50)
          } else if (zi === 1) {
            // Bottom edge
            ctx.fillText(`resonance detected... ${zone.label}`, w / 2, h - 45)
          } else if (zi === 2) {
            // Left edge
            ctx.save()
            ctx.translate(30, h / 2)
            ctx.rotate(-Math.PI / 2)
            ctx.fillText(`resonance detected... ${zone.label}`, 0, 0)
            ctx.restore()
          }
        }
      }
    }

    // Hint — show only when no zones are active
    const anyZoneActive = resonanceZones.some(z => z.resonance > 0.1)
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(200, 180, 255, 0.04)'
    ctx.fillText('click to add a voice \u00b7 position determines pitch and timbre', w / 2, h - 8)

    if (!anyZoneActive) {
      ctx.fillStyle = 'rgba(200, 180, 255, 0.03)'
      ctx.fillText('voices placed near the edges create resonance...', w / 2, h - 22)
    }

    // Cultural inscription
    inscriptionTimer += 0.016
    if (inscriptionTimer >= 22) {
      inscriptionTimer = 0
      inscriptionIdx = (inscriptionIdx + 1) % CULTURAL_INSCRIPTIONS.length
    }
    const insText = CULTURAL_INSCRIPTIONS[inscriptionIdx]
    ctx.font = '11px "Cormorant Garamond", serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(200, 180, 255, 0.03)'
    const insMaxW = w * 0.75
    const insWords = insText.split(' ')
    const insLines: string[] = []
    let insLine = ''
    for (const word of insWords) {
      const test = insLine ? insLine + ' ' + word : word
      if (ctx.measureText(test).width > insMaxW) { insLines.push(insLine); insLine = word }
      else insLine = test
    }
    if (insLine) insLines.push(insLine)
    for (let li = 0; li < insLines.length; li++) {
      ctx.fillText(insLines[li], w / 2, h - 50 + li * 14)
    }
  }

  /** Clean up all audio nodes (shared between deactivate and destroy) */
  function cleanupAudio() {
    // Stop all voices
    for (const v of voices) {
      try {
        v.osc?.stop()
        v.vibrato?.stop()
        v.osc?.disconnect()
        v.gain?.disconnect()
        v.vibrato?.disconnect()
        v.filter?.disconnect()
      } catch {}
    }
    voices = []

    // Stop ambient pad
    for (const osc of padOscs) {
      try { osc.stop(); osc.disconnect() } catch {}
    }
    for (const g of padGains) {
      try { g.disconnect() } catch {}
    }
    padOscs = []
    padGains = []
    try { padFilter?.disconnect() } catch {}
    try { padMasterGain?.disconnect() } catch {}
    try { padLfoOsc?.stop(); padLfoOsc?.disconnect() } catch {}
    try { padLfoGain?.disconnect() } catch {}
    padFilter = null
    padMasterGain = null
    padLfoOsc = null
    padLfoGain = null

    // Disconnect delay lines
    for (const dl of delayLines) {
      try {
        dl.delay.disconnect()
        dl.feedback.disconnect()
        dl.output.disconnect()
      } catch {}
    }
    delayLines = []

    // Disconnect reverb
    try { reverb?.disconnect() } catch {}
    try { masterGain?.disconnect() } catch {}
    reverb = null
    masterGain = null

    // Stop ghost timer
    if (ghostTimer !== null) {
      clearInterval(ghostTimer)
      ghostTimer = null
    }
  }

  return {
    name: 'choir',
    label: 'the choir',

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

      canvas.addEventListener('click', (e) => {
        // Check resonance zone clicks — navigate if resonance > 0.5
        if (deps?.switchTo && canvas) {
          for (let zi = 0; zi < resonanceZones.length; zi++) {
            const zone = resonanceZones[zi]
            if (zone.resonance > 0.5 && zone.test(e.clientX, e.clientY, canvas.width, canvas.height)) {
              deps.switchTo(zone.room)
              return
            }
          }
        }
        addVoice(e.clientX, e.clientY)
      })

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
          initCandles() // re-scatter candles on resize
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)
      return overlay
    },

    async activate() {
      active = true
      // Reset resonance on re-entry
      for (const z of resonanceZones) z.resonance = 0
      // Reset breath and triad state
      breathPhase = 0
      lightRays = []
      triadDetected = false
      triadStrength = 0
      await initAudio()
      initCandles()
      seedVoices()

      // Ghost voice timer: check every 8-15 seconds after 5+ voices have been placed
      ghostTimer = setInterval(() => {
        if (totalVoices >= 5 && Math.random() < 0.4) {
          spawnGhostVoice()
        }
      }, 8000 + Math.random() * 7000)

      render()

      // Load shared voice placements from other visitors (4s delay, staggered)
      if (!remoteVoicesLoaded) {
        setTimeout(async () => {
          if (!active || !canvas) return
          remoteVoicesLoaded = true
          const data = await fetchChoirVoices()
          if (data && data.voices.length > 0) {
            const w = canvas.width
            const h = canvas.height
            // Stagger remote ghost voices over 10-30s
            for (let i = 0; i < data.voices.length; i++) {
              const v = data.voices[i]
              const delay = 3000 + i * 4000 + Math.random() * 3000
              setTimeout(() => {
                if (!active || !canvas) return
                addVoice(v.x * canvas.width, v.y * canvas.height, true)
              }, delay)
            }
          }
        }, 4000)
      }
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      cleanupAudio()
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      cleanupAudio()
      overlay?.remove()
    },
  }
}
