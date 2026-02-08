/**
 * THE LIGHTHOUSE — communication through darkness
 *
 * A lighthouse beam sweeps across darkness. Type a message and it
 * blinks out in Morse code through the light. When idle, the lighthouse
 * transmits random fragments from a library of maritime distress calls,
 * poetry about the sea, and coordinates of shipwrecks.
 *
 * The beam is the only light source. Everything else is darkness and
 * the sound of waves.
 *
 * No memory dependency. Pure signal and noise.
 *
 * Inspired by: Morse code, maritime communication, lighthouses as
 * liminal spaces (between land and sea, safety and danger),
 * semaphore, signal fires, the desperate need to communicate
 * across distance and darkness.
 *
 * Audio inspired by Samson Young's "Liquid Borders" (EMPAC 2026) —
 * field recordings of border fence vibrations, hydrophone recordings
 * of the Shenzhen River. The idea that borders have sounds, and that
 * sound carries across boundaries. Maritime foghorns as warnings
 * across distance.
 */

import type { Room } from './RoomManager'
import { getAudioContext } from '../sound/AudioBus'

const MORSE: Record<string, string> = {
  'a': '.-', 'b': '-...', 'c': '-.-.', 'd': '-..', 'e': '.', 'f': '..-.',
  'g': '--.', 'h': '....', 'i': '..', 'j': '.---', 'k': '-.-', 'l': '.-..',
  'm': '--', 'n': '-.', 'o': '---', 'p': '.--.', 'q': '--.-', 'r': '.-.',
  's': '...', 't': '-', 'u': '..-', 'v': '...-', 'w': '.--', 'x': '-..-',
  'y': '-.--', 'z': '--..', '0': '-----', '1': '.----', '2': '..---',
  '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
  '8': '---..', '9': '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..',
  ' ': '/',
}

const AUTO_MESSAGES = [
  'sos sos sos',
  'all is well',
  'the sea remembers what the shore forgets',
  'lat 41.7 lon 49.9 titanic',
  'we are not lost we are waiting',
  'come home',
  'the light is the only language the dark understands',
  'mayday mayday mayday',
  'nothing is permanent not even stone',
  'three short three long three short',
  'do not go gentle into that good night',
  'i am a lighthouse i am a lighthouse',
  'lat 28.2 lon 80.6 challenger',
  'the fog is lifting',
  'all who wander are not lost',
  'the keeper has gone but the light remains',
  'signal received no reply',
  'lat 36.0 lon 25.4 minoan eruption',
]

interface LighthouseDeps {
  onDescend?: () => void // navigate to tide pool
  switchTo?: (name: string) => void
}

// ── Cursor trail point ────────────────────────────────────────
interface TrailPoint {
  x: number
  y: number
  birth: number // time when created
  alpha: number
}

const CULTURAL_INSCRIPTIONS = [
  'the pharos of alexandria was 130 meters tall. one of the seven wonders, now rubble under the sea.',
  'morse code: the first digital language. dit-dah as zero-one. transmission as the root of memory.',
  'flannan isles, 1900: three lighthouse keepers vanished. the clocks had stopped. the table was set.',
  'virginia woolf\'s to the lighthouse: the beam sweeps across the dark and nothing is ever the same.',
  'eddystone lighthouse was rebuilt 4 times. the sea kept forgetting it was there.',
  'number stations still broadcast encrypted sequences. UVB-76 has been buzzing since 1982. no one knows why.',
  'charli xcx\'s the moment: a cultural era examining whether it should let itself be forgotten.',
  'the last manned lighthouse in the US was automated in 1998. the keeper\'s memory, replaced by a timer.',
  'a foghorn\'s low frequency carries further because long waves bend around obstacles. grief travels the same way.',
  'episodic and semantic memory use the same brain network. what happened to you and what you know are one.',
]

export function createLighthouseRoom(deps: LighthouseDeps = {}): Room {
  let inscriptionTimer = 0
  let inscriptionIdx = 0
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let morseQueue: string[] = [] // dots and dashes to transmit
  let currentSymbol: string | null = null
  let symbolTimer = 0
  let lightOn = false
  let beamAngle = 0
  let inputText = ''
  let transmitting = false
  let autoMode = true
  let autoTimer = 0
  let currentMessage = ''
  let decodedSoFar = ''
  let transmitCount = 0
  let shoreLink: HTMLElement | null = null
  let shoreLinkVisible = false

  // Cursor tracking for wind modulation + signal trail
  let cursorX = 0
  let cursorY = 0
  let cursorNormY = 0.5 // 0 = top, 1 = bottom
  const cursorTrail: TrailPoint[] = []
  const TRAIL_LIFETIME = 4 // seconds

  // Ripple effect from cursor near water
  interface Ripple {
    x: number
    y: number
    birth: number
    radius: number
  }
  const ripples: Ripple[] = []

  // Landmark definitions for beam-illumination navigation
  const landmarks = [
    { label: 'radio tower', room: 'radio', xFrac: 0.15 },
    { label: 'the shore', room: 'tidepool', xFrac: 0.5 },
    { label: 'satellite array', room: 'satellite', xFrac: 0.85 },
  ]
  // illumination level per landmark (0 = dark, 1 = fully lit)
  const illuminated: number[] = [0, 0, 0]

  // Morse timing (in frames at 60fps)
  const DOT_DURATION = 8
  const DASH_DURATION = 24
  const SYMBOL_GAP = 8
  const LETTER_GAP = 20
  const WORD_GAP = 40

  // ── Audio state ─────────────────────────────────────────────
  let audioCtx: AudioContext | null = null
  // Ocean waves
  let waveSource: AudioBufferSourceNode | null = null
  let waveGain: GainNode | null = null
  let waveLfo: OscillatorNode | null = null
  let waveLfoGain: GainNode | null = null
  // Wind
  let windSource: AudioBufferSourceNode | null = null
  let windGain: GainNode | null = null
  let windFilter: BiquadFilterNode | null = null
  // Foghorn
  let foghornInterval: ReturnType<typeof setTimeout> | null = null
  let foghornActive = false
  // Morse clicks
  let morseClickBuffer: AudioBuffer | null = null

  // ── Audio setup ─────────────────────────────────────────────

  function createBrownNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
    const bufferSize = ctx.sampleRate * durationSec
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    }
    return buffer
  }

  function createClickBuffer(ctx: AudioContext): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * 0.005) // 5ms click
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < len; i++) {
      const env = 1 - i / len // linear decay
      data[i] = (Math.random() * 2 - 1) * env * 0.6
    }
    return buffer
  }

  async function startAudio() {
    try {
      audioCtx = await getAudioContext()
      if (!audioCtx) return

      // ── Ocean waves: brown noise + LFO amplitude modulation ──
      const waveBuf = createBrownNoiseBuffer(audioCtx, 2)
      waveSource = audioCtx.createBufferSource()
      waveSource.buffer = waveBuf
      waveSource.loop = true

      const waveFilter = audioCtx.createBiquadFilter()
      waveFilter.type = 'lowpass'
      waveFilter.frequency.value = 350
      waveFilter.Q.value = 0.4

      waveGain = audioCtx.createGain()
      waveGain.gain.value = 0 // fade in

      // LFO for wave swell: ~0.15Hz, modulates gain between ~0.02 and ~0.08
      waveLfo = audioCtx.createOscillator()
      waveLfo.type = 'sine'
      waveLfo.frequency.value = 0.15
      waveLfoGain = audioCtx.createGain()
      waveLfoGain.gain.value = 0.03 // modulation depth

      waveSource.connect(waveFilter)
      waveFilter.connect(waveGain)
      waveGain.connect(audioCtx.destination)

      // Route LFO into the wave gain param
      waveLfo.connect(waveLfoGain)
      waveLfoGain.connect(waveGain.gain)
      waveGain.gain.setValueAtTime(0.05, audioCtx.currentTime)

      waveSource.start()
      waveLfo.start()

      // Fade in
      waveGain.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 3)

      // ── Wind: bandpass filtered noise, cursor-modulated ──
      const windBuf = createBrownNoiseBuffer(audioCtx, 2)
      windSource = audioCtx.createBufferSource()
      windSource.buffer = windBuf
      windSource.loop = true

      windFilter = audioCtx.createBiquadFilter()
      windFilter.type = 'bandpass'
      windFilter.frequency.value = 400
      windFilter.Q.value = 2.5

      windGain = audioCtx.createGain()
      windGain.gain.value = 0

      windSource.connect(windFilter)
      windFilter.connect(windGain)
      windGain.connect(audioCtx.destination)

      windSource.start()
      windGain.gain.linearRampToValueAtTime(0.015, audioCtx.currentTime + 2)

      // ── Morse click buffer (pre-create) ──
      morseClickBuffer = createClickBuffer(audioCtx)

      // ── Foghorn schedule ──
      scheduleFoghorn()
    } catch {
      // Audio failed — continue without sound
    }
  }

  function scheduleFoghorn() {
    if (!active) return
    const delay = 30000 + Math.random() * 30000 // 30-60 seconds
    foghornInterval = setTimeout(() => {
      if (active && audioCtx) {
        playFoghorn()
        scheduleFoghorn()
      }
    }, delay)
  }

  function playFoghorn() {
    if (!audioCtx || foghornActive) return
    foghornActive = true

    // Deep sawtooth tone at 85Hz
    const osc = audioCtx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 85

    // Low-pass filter for warmth
    const filter = audioCtx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 200
    filter.Q.value = 1.5

    // Reverb via convolver (impulse response)
    const reverbLen = audioCtx.sampleRate * 4 // 4-second reverb tail
    const reverbBuf = audioCtx.createBuffer(2, reverbLen, audioCtx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const data = reverbBuf.getChannelData(ch)
      for (let i = 0; i < reverbLen; i++) {
        const decay = Math.exp(-i / (audioCtx.sampleRate * 1.2))
        data[i] = (Math.random() * 2 - 1) * decay * 0.4
      }
    }
    const convolver = audioCtx.createConvolver()
    convolver.buffer = reverbBuf

    // Gain envelope: 2 seconds on, then fade
    const hornGain = audioCtx.createGain()
    const now = audioCtx.currentTime
    hornGain.gain.setValueAtTime(0, now)
    hornGain.gain.linearRampToValueAtTime(0.08, now + 0.3) // attack
    hornGain.gain.setValueAtTime(0.08, now + 1.7) // sustain
    hornGain.gain.linearRampToValueAtTime(0, now + 2.0) // release

    // Dry + wet paths
    const dryGain = audioCtx.createGain()
    dryGain.gain.value = 0.7
    const wetGain = audioCtx.createGain()
    wetGain.gain.value = 0.4

    osc.connect(filter)
    filter.connect(hornGain)
    hornGain.connect(dryGain)
    dryGain.connect(audioCtx.destination)
    hornGain.connect(convolver)
    convolver.connect(wetGain)
    wetGain.connect(audioCtx.destination)

    osc.start(now)
    osc.stop(now + 2.0)

    // Clean up after reverb tail finishes
    setTimeout(() => {
      foghornActive = false
      try {
        osc.disconnect()
        filter.disconnect()
        hornGain.disconnect()
        convolver.disconnect()
        dryGain.disconnect()
        wetGain.disconnect()
      } catch { /* already disconnected */ }
    }, 6500)
  }

  function playMorseClick(isDash: boolean) {
    if (!audioCtx || !morseClickBuffer) return
    const src = audioCtx.createBufferSource()
    src.buffer = morseClickBuffer
    const g = audioCtx.createGain()
    g.gain.value = isDash ? 0.12 : 0.08
    src.connect(g)
    g.connect(audioCtx.destination)
    src.start()
    // For dashes, play a second click at the end of the dash duration
    if (isDash) {
      const src2 = audioCtx.createBufferSource()
      src2.buffer = morseClickBuffer
      const g2 = audioCtx.createGain()
      g2.gain.value = 0.06
      src2.connect(g2)
      g2.connect(audioCtx.destination)
      src2.start(audioCtx.currentTime + DASH_DURATION / 60) // dash duration in seconds
    }
  }

  function updateWindFromCursor() {
    if (!windGain || !audioCtx) return
    // Higher cursor = more wind (0 at bottom, max at top)
    const windLevel = (1 - cursorNormY) * 0.06 + 0.005
    windGain.gain.linearRampToValueAtTime(windLevel, audioCtx.currentTime + 0.1)
  }

  function stopAudio() {
    if (foghornInterval) {
      clearTimeout(foghornInterval)
      foghornInterval = null
    }

    if (audioCtx) {
      const now = audioCtx.currentTime

      if (waveGain) {
        waveGain.gain.linearRampToValueAtTime(0, now + 1.5)
      }
      if (windGain) {
        windGain.gain.linearRampToValueAtTime(0, now + 1.5)
      }

      setTimeout(() => {
        try { waveSource?.stop() } catch { /* ok */ }
        try { waveLfo?.stop() } catch { /* ok */ }
        try { windSource?.stop() } catch { /* ok */ }
        waveSource = null
        waveLfo = null
        waveLfoGain = null
        waveGain = null
        windSource = null
        windFilter = null
        windGain = null
        morseClickBuffer = null
      }, 2000)
    }
  }

  // ── Morse helpers ───────────────────────────────────────────

  function textToMorse(text: string): string[] {
    const queue: string[] = []
    const lower = text.toLowerCase()
    for (let i = 0; i < lower.length; i++) {
      const ch = lower[i]
      const morse = MORSE[ch]
      if (!morse) continue
      if (ch === ' ') {
        queue.push('word_gap')
        continue
      }
      for (let j = 0; j < morse.length; j++) {
        queue.push(morse[j] === '.' ? 'dot' : 'dash')
        if (j < morse.length - 1) queue.push('symbol_gap')
      }
      if (i < lower.length - 1 && lower[i + 1] !== ' ') {
        queue.push('letter_gap')
      }
    }
    return queue
  }

  function transmitMessage(text: string) {
    morseQueue = textToMorse(text)
    currentMessage = text
    decodedSoFar = ''
    transmitting = true
    autoMode = false
    transmitCount++

    // After 3 manual transmissions, reveal the shore link
    if (transmitCount >= 3 && !shoreLinkVisible && shoreLink && deps.onDescend) {
      shoreLinkVisible = true
      shoreLink.style.opacity = '0.3'
      shoreLink.style.pointerEvents = 'auto'
    }
  }

  function processQueue() {
    if (symbolTimer > 0) {
      symbolTimer--
      return
    }

    if (morseQueue.length === 0) {
      lightOn = false
      transmitting = false
      if (!autoMode) {
        // Return to auto mode after a pause
        autoTimer = 180 // 3 seconds
        autoMode = true
      }
      return
    }

    const next = morseQueue.shift()!
    currentSymbol = next

    switch (next) {
      case 'dot':
        lightOn = true
        symbolTimer = DOT_DURATION
        playMorseClick(false)
        break
      case 'dash':
        lightOn = true
        symbolTimer = DASH_DURATION
        playMorseClick(true)
        break
      case 'symbol_gap':
        lightOn = false
        symbolTimer = SYMBOL_GAP
        break
      case 'letter_gap':
        lightOn = false
        symbolTimer = LETTER_GAP
        // Reveal next letter of decoded text
        if (currentMessage) {
          const nextCharIdx = decodedSoFar.length
          if (nextCharIdx < currentMessage.length) {
            decodedSoFar = currentMessage.slice(0, nextCharIdx + 1)
          }
        }
        break
      case 'word_gap':
        lightOn = false
        symbolTimer = WORD_GAP
        if (currentMessage) {
          const nextCharIdx = decodedSoFar.length
          if (nextCharIdx < currentMessage.length) {
            decodedSoFar = currentMessage.slice(0, nextCharIdx + 1)
          }
        }
        break
    }
  }

  // ── Beam illumination helpers ───────────────────────────────

  /** Returns 0-1 for how much a point at (px, py) is within a beam cone */
  function beamIlluminationAt(px: number, py: number, lightX: number, lightY: number): number {
    const beamWidth = 0.12
    let maxIl = 0
    for (let b = 0; b < 2; b++) {
      const angle = beamAngle + b * Math.PI
      const dx = px - lightX
      const dy = py - lightY
      const pointAngle = Math.atan2(dy, dx)
      let diff = pointAngle - angle
      diff = diff - Math.floor((diff + Math.PI) / (2 * Math.PI)) * 2 * Math.PI
      const absDiff = Math.abs(diff)
      if (absDiff < beamWidth * 2) {
        const dist = Math.sqrt(dx * dx + dy * dy)
        // Closer = brighter, inside cone = brighter
        const coneFactor = Math.max(0, 1 - absDiff / (beamWidth * 2))
        const distFactor = Math.max(0, 1 - dist / 800)
        maxIl = Math.max(maxIl, coneFactor * distFactor)
      }
    }
    return maxIl
  }

  // ── Render ──────────────────────────────────────────────────

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height

    // Process morse queue
    processQueue()

    // Auto-transmit when idle
    if (autoMode && !transmitting) {
      autoTimer--
      if (autoTimer <= 0) {
        const msg = AUTO_MESSAGES[Math.floor(Math.random() * AUTO_MESSAGES.length)]
        morseQueue = textToMorse(msg)
        currentMessage = msg
        decodedSoFar = ''
        transmitting = true
        autoTimer = 300 + Math.random() * 300 // 5-10s between messages
      }
    }

    // Beam rotation (slow sweep)
    beamAngle += 0.003

    // Background — deep dark
    ctx.fillStyle = 'rgba(2, 3, 8, 1)'
    ctx.fillRect(0, 0, w, h)

    // Horizon line
    const horizonY = h * 0.65
    ctx.strokeStyle = 'rgba(20, 30, 50, 0.3)'
    ctx.beginPath()
    ctx.moveTo(0, horizonY)
    ctx.lineTo(w, horizonY)
    ctx.stroke()

    // Light source position (used for beam illumination calculations)
    const towerX = w / 2
    const towerTop = horizonY - 120
    const lightX = towerX
    const lightY = towerTop + 7
    const lightIntensity = lightOn ? 1 : 0.05

    // ── Water surface with beam illumination + ripple distortions ──
    for (let i = 0; i < 40; i++) {
      const baseWx = Math.sin(time * 0.5 + i * 0.7) * w * 0.4 + w / 2
      const wy = horizonY + 10 + i * ((h - horizonY - 10) / 40)

      // Check for ripple displacement
      let rippleOffset = 0
      for (const rp of ripples) {
        const rdx = baseWx - rp.x
        const rdy = wy - rp.y
        const dist = Math.sqrt(rdx * rdx + rdy * rdy)
        const age = time - rp.birth
        const wavefront = rp.radius
        const ringDist = Math.abs(dist - wavefront)
        if (ringDist < 15 && age < 2.5) {
          const strength = (1 - age / 2.5) * (1 - ringDist / 15)
          rippleOffset += Math.sin(dist * 0.5 - time * 8) * strength * 6
        }
      }

      const wx = baseWx + rippleOffset
      const baseAlpha = 0.02 + Math.sin(time * 1.5 + i) * 0.01

      // Beam brightening on water
      const waterBeamIl = lightIntensity > 0.1 ? beamIlluminationAt(wx, wy, lightX, lightY) : 0
      const waterBoost = waterBeamIl * 0.06
      const alpha = baseAlpha + waterBoost

      const br = Math.round(30 + waterBeamIl * 80)
      const bg = Math.round(50 + waterBeamIl * 60)
      const bb = Math.round(80 + waterBeamIl * 40)
      ctx.fillStyle = `rgba(${br}, ${bg}, ${bb}, ${alpha})`
      ctx.fillRect(wx - 20, wy, 40, 1)
    }

    // ── Ripple rings (subtle expanding circles near water) ──
    for (let ri = ripples.length - 1; ri >= 0; ri--) {
      const rp = ripples[ri]
      const age = time - rp.birth
      if (age > 2.5) {
        ripples.splice(ri, 1)
        continue
      }
      rp.radius += 0.8 // expand
      const alpha = (1 - age / 2.5) * 0.08
      ctx.strokeStyle = `rgba(60, 90, 140, ${alpha})`
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.arc(rp.x, rp.y, rp.radius, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Lighthouse tower
    const towerBase = horizonY - 5
    const towerWidth = 16

    // Tower body
    const towerGrad = ctx.createLinearGradient(towerX - towerWidth, towerTop, towerX + towerWidth, towerTop)
    towerGrad.addColorStop(0, 'rgba(60, 55, 50, 0.3)')
    towerGrad.addColorStop(0.5, 'rgba(80, 75, 70, 0.3)')
    towerGrad.addColorStop(1, 'rgba(50, 45, 40, 0.3)')
    ctx.fillStyle = towerGrad
    ctx.beginPath()
    ctx.moveTo(towerX - towerWidth * 1.3, towerBase)
    ctx.lineTo(towerX - towerWidth * 0.7, towerTop + 15)
    ctx.lineTo(towerX + towerWidth * 0.7, towerTop + 15)
    ctx.lineTo(towerX + towerWidth * 1.3, towerBase)
    ctx.fill()

    // Lantern room
    ctx.fillStyle = 'rgba(40, 35, 30, 0.4)'
    ctx.fillRect(towerX - towerWidth, towerTop, towerWidth * 2, 15)

    // Light beam
    if (lightIntensity > 0.1) {
      const beamLen = Math.max(w, h) * 1.5
      const beamW = 0.12

      // Two beams (lighthouse rotates)
      for (let b = 0; b < 2; b++) {
        const angle = beamAngle + b * Math.PI
        const endX = lightX + Math.cos(angle) * beamLen
        const endY = lightY + Math.sin(angle) * beamLen

        const grad = ctx.createLinearGradient(lightX, lightY, endX, endY)
        grad.addColorStop(0, `rgba(255, 250, 220, ${0.4 * lightIntensity})`)
        grad.addColorStop(0.1, `rgba(255, 250, 220, ${0.15 * lightIntensity})`)
        grad.addColorStop(0.4, `rgba(255, 250, 220, ${0.03 * lightIntensity})`)
        grad.addColorStop(1, 'transparent')

        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.moveTo(lightX, lightY)
        ctx.lineTo(
          lightX + Math.cos(angle - beamW) * beamLen,
          lightY + Math.sin(angle - beamW) * beamLen,
        )
        ctx.lineTo(
          lightX + Math.cos(angle + beamW) * beamLen,
          lightY + Math.sin(angle + beamW) * beamLen,
        )
        ctx.fill()
      }
    }

    // ── Lens flare at light source ──
    if (lightIntensity > 0.1) {
      // Main bright core
      const flareCore = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, 8)
      flareCore.addColorStop(0, `rgba(255, 255, 240, ${0.9 * lightIntensity})`)
      flareCore.addColorStop(0.5, `rgba(255, 250, 200, ${0.3 * lightIntensity})`)
      flareCore.addColorStop(1, 'transparent')
      ctx.fillStyle = flareCore
      ctx.beginPath()
      ctx.arc(lightX, lightY, 8, 0, Math.PI * 2)
      ctx.fill()

      // Horizontal streak (anamorphic flare)
      const streakLen = 40 + lightIntensity * 30
      const streakGrad = ctx.createLinearGradient(lightX - streakLen, lightY, lightX + streakLen, lightY)
      streakGrad.addColorStop(0, 'transparent')
      streakGrad.addColorStop(0.3, `rgba(255, 250, 220, ${0.06 * lightIntensity})`)
      streakGrad.addColorStop(0.5, `rgba(255, 250, 220, ${0.15 * lightIntensity})`)
      streakGrad.addColorStop(0.7, `rgba(255, 250, 220, ${0.06 * lightIntensity})`)
      streakGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = streakGrad
      ctx.fillRect(lightX - streakLen, lightY - 1.5, streakLen * 2, 3)

      // Secondary ghost (offset from light, subtle)
      const ghostDist = 35
      const ghostX = lightX + Math.cos(beamAngle) * ghostDist
      const ghostY = lightY + Math.sin(beamAngle) * ghostDist
      const ghostGrad = ctx.createRadialGradient(ghostX, ghostY, 0, ghostX, ghostY, 12)
      ghostGrad.addColorStop(0, `rgba(200, 220, 255, ${0.04 * lightIntensity})`)
      ghostGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = ghostGrad
      ctx.beginPath()
      ctx.arc(ghostX, ghostY, 12, 0, Math.PI * 2)
      ctx.fill()
    }

    // Light source glow
    const glowSize = 15 + lightIntensity * 20
    const glow = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, glowSize)
    glow.addColorStop(0, `rgba(255, 250, 200, ${0.8 * lightIntensity})`)
    glow.addColorStop(0.3, `rgba(255, 240, 180, ${0.3 * lightIntensity})`)
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(lightX, lightY, glowSize, 0, Math.PI * 2)
    ctx.fill()

    // ── Stars with beam illumination ──
    for (let i = 0; i < 50; i++) {
      const sx = (Math.sin(i * 127.1) * 0.5 + 0.5) * w
      const sy = (Math.sin(i * 311.7) * 0.5 + 0.5) * horizonY * 0.9
      const baseTwinkle = Math.sin(time * 2 + i * 1.3) > 0.7 ? 0.3 : 0.1

      // Stars caught in the beam glow brighter
      const starBeamIl = lightIntensity > 0.1 ? beamIlluminationAt(sx, sy, lightX, lightY) : 0
      const starAlpha = baseTwinkle + starBeamIl * 0.5

      const sr = Math.round(200 + starBeamIl * 55)
      const sg = Math.round(210 + starBeamIl * 40)
      const sb = Math.round(230 + starBeamIl * 25)
      ctx.fillStyle = `rgba(${sr}, ${sg}, ${sb}, ${starAlpha})`
      const starSize = 1 + starBeamIl * 1.5
      ctx.fillRect(sx - starSize / 2, sy - starSize / 2, starSize, starSize)
    }

    // ── Cursor signal trail ──
    // Remove expired trail points
    for (let ti = cursorTrail.length - 1; ti >= 0; ti--) {
      const age = time - cursorTrail[ti].birth
      if (age > TRAIL_LIFETIME) {
        cursorTrail.splice(ti, 1)
      }
    }

    // Draw trail
    for (const pt of cursorTrail) {
      const age = time - pt.birth
      const life = 1 - age / TRAIL_LIFETIME
      const alpha = life * life * 0.25 // quadratic fade
      const size = 2 + life * 3

      const trailGrad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, size)
      trailGrad.addColorStop(0, `rgba(255, 240, 180, ${alpha})`)
      trailGrad.addColorStop(0.6, `rgba(255, 220, 140, ${alpha * 0.3})`)
      trailGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = trailGrad
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2)
      ctx.fill()
    }

    // Decoded message (appears letter by letter)
    if (decodedSoFar) {
      ctx.font = '16px "Cormorant Garamond", serif'
      // Text caught in beam glows brighter
      const textBeamIl = lightIntensity > 0.1
        ? beamIlluminationAt(w / 2, h * 0.25, lightX, lightY)
        : 0
      const textAlpha = 0.3 + (lightOn ? 0.2 : 0) + textBeamIl * 0.3
      ctx.fillStyle = `rgba(255, 250, 200, ${textAlpha})`
      ctx.textAlign = 'center'
      ctx.fillText(decodedSoFar, w / 2, h * 0.25)
    }

    // Morse visual (current symbol)
    if (transmitting && currentSymbol) {
      ctx.font = '24px monospace'
      ctx.fillStyle = `rgba(255, 250, 200, ${lightOn ? 0.3 : 0.05})`
      ctx.textAlign = 'center'
      const morseStr = currentMessage ? textToMorse(currentMessage.slice(0, decodedSoFar.length + 1))
        .filter(s => s === 'dot' || s === 'dash')
        .map(s => s === 'dot' ? '\u00B7' : '\u2014')
        .join(' ') : ''
      ctx.fillText(morseStr.slice(-30), w / 2, h * 0.3)
    }

    // Input area
    ctx.font = '12px monospace'
    ctx.fillStyle = 'rgba(255, 250, 200, 0.15)'
    ctx.textAlign = 'center'

    if (inputText) {
      ctx.fillText(`> ${inputText}_`, w / 2, h * 0.92)
    } else if (!transmitting) {
      ctx.fillStyle = 'rgba(255, 250, 200, 0.06)'
      ctx.fillText('type a message, press enter to transmit', w / 2, h * 0.92)
    }

    // Landmark silhouettes + beam illumination navigation
    if (deps.switchTo) {
      const towerX_ = w / 2
      const lightY_ = horizonY - 120 + 7 // same as lightY

      for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i]
        const lx = w * lm.xFrac
        const ly = horizonY

        // Calculate angle from lighthouse light to this landmark
        const dx = lx - towerX_
        const dy = ly - lightY_
        const angleToLandmark = Math.atan2(dy, dx)

        // Check if either beam is near this landmark
        let minAngleDiff = Infinity
        for (let b = 0; b < 2; b++) {
          const bAngle = beamAngle + b * Math.PI
          // Normalize angle difference to [-PI, PI]
          let diff = angleToLandmark - bAngle
          diff = diff - Math.floor((diff + Math.PI) / (2 * Math.PI)) * 2 * Math.PI
          if (Math.abs(diff) < minAngleDiff) minAngleDiff = Math.abs(diff)
        }

        // Illuminate when beam is within ~0.15 radians
        const beamProximity = 0.15
        if (minAngleDiff < beamProximity) {
          // Fade in quickly
          illuminated[i] = Math.min(1, illuminated[i] + 0.06)
        } else {
          // Fade out slowly
          illuminated[i] = Math.max(0, illuminated[i] - 0.015)
        }

        const il = illuminated[i]

        // Draw landmark silhouettes
        ctx.save()

        if (i === 0) {
          // RADIO TOWER — antenna tower with cross bars
          const baseX = lx
          const baseY = ly
          const towerH = 45
          // Dark silhouette color, brightens when illuminated
          const r = Math.round(15 + il * 200)
          const g = Math.round(12 + il * 180)
          const b_ = Math.round(10 + il * 80)
          const a = 0.15 + il * 0.7

          ctx.strokeStyle = `rgba(${r}, ${g}, ${b_}, ${a})`
          ctx.lineWidth = 1.5
          // Main vertical mast
          ctx.beginPath()
          ctx.moveTo(baseX, baseY)
          ctx.lineTo(baseX, baseY - towerH)
          ctx.stroke()
          // Cross bars
          for (let cb = 1; cb <= 3; cb++) {
            const cbY = baseY - towerH * (cb / 4)
            const cbW = 6 + (3 - cb) * 3
            ctx.beginPath()
            ctx.moveTo(baseX - cbW, cbY)
            ctx.lineTo(baseX + cbW, cbY)
            ctx.stroke()
          }
          // Small antenna tip
          ctx.beginPath()
          ctx.moveTo(baseX - 3, baseY - towerH)
          ctx.lineTo(baseX, baseY - towerH - 8)
          ctx.lineTo(baseX + 3, baseY - towerH)
          ctx.stroke()
          // Diagonal support wires
          ctx.lineWidth = 0.5
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b_}, ${a * 0.5})`
          ctx.beginPath()
          ctx.moveTo(baseX - 12, baseY)
          ctx.lineTo(baseX, baseY - towerH * 0.7)
          ctx.moveTo(baseX + 12, baseY)
          ctx.lineTo(baseX, baseY - towerH * 0.7)
          ctx.stroke()
        } else if (i === 1) {
          // TIDAL SHORE — jagged rocky shore silhouette
          const baseX = lx
          const baseY = ly
          const r = Math.round(15 + il * 180)
          const g = Math.round(18 + il * 190)
          const b_ = Math.round(20 + il * 100)
          const a = 0.12 + il * 0.65

          ctx.fillStyle = `rgba(${r}, ${g}, ${b_}, ${a})`
          ctx.beginPath()
          ctx.moveTo(baseX - 40, baseY)
          ctx.lineTo(baseX - 35, baseY - 6)
          ctx.lineTo(baseX - 28, baseY - 3)
          ctx.lineTo(baseX - 22, baseY - 12)
          ctx.lineTo(baseX - 15, baseY - 8)
          ctx.lineTo(baseX - 8, baseY - 15)
          ctx.lineTo(baseX - 3, baseY - 10)
          ctx.lineTo(baseX + 2, baseY - 18)
          ctx.lineTo(baseX + 8, baseY - 11)
          ctx.lineTo(baseX + 14, baseY - 14)
          ctx.lineTo(baseX + 20, baseY - 7)
          ctx.lineTo(baseX + 27, baseY - 10)
          ctx.lineTo(baseX + 33, baseY - 4)
          ctx.lineTo(baseX + 40, baseY)
          ctx.closePath()
          ctx.fill()
        } else if (i === 2) {
          // SATELLITE DISH — parabolic dish shape
          const baseX = lx
          const baseY = ly
          const r = Math.round(15 + il * 190)
          const g = Math.round(12 + il * 175)
          const b_ = Math.round(10 + il * 90)
          const a = 0.13 + il * 0.7

          ctx.strokeStyle = `rgba(${r}, ${g}, ${b_}, ${a})`
          ctx.lineWidth = 1.5
          // Support pole
          ctx.beginPath()
          ctx.moveTo(baseX, baseY)
          ctx.lineTo(baseX, baseY - 25)
          ctx.stroke()
          // Dish (parabolic arc)
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(baseX - 18, baseY - 22)
          ctx.quadraticCurveTo(baseX - 10, baseY - 40, baseX, baseY - 38)
          ctx.quadraticCurveTo(baseX + 10, baseY - 40, baseX + 18, baseY - 22)
          ctx.stroke()
          // Feed arm
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(baseX, baseY - 30)
          ctx.lineTo(baseX + 10, baseY - 42)
          ctx.stroke()
          // Feed point
          ctx.beginPath()
          ctx.arc(baseX + 10, baseY - 42, 2, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${r}, ${g}, ${b_}, ${a * 0.8})`
          ctx.fill()
          // Base support
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b_}, ${a * 0.5})`
          ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.moveTo(baseX - 10, baseY)
          ctx.lineTo(baseX, baseY - 15)
          ctx.lineTo(baseX + 10, baseY)
          ctx.stroke()
        }

        // Golden aura when illuminated
        if (il > 0.1) {
          const auraRadius = 30 + il * 20
          const aura = ctx.createRadialGradient(lx, ly - 15, 0, lx, ly - 15, auraRadius)
          aura.addColorStop(0, `rgba(255, 220, 120, ${il * 0.12})`)
          aura.addColorStop(0.5, `rgba(255, 200, 100, ${il * 0.05})`)
          aura.addColorStop(1, 'transparent')
          ctx.fillStyle = aura
          ctx.beginPath()
          ctx.arc(lx, ly - 15, auraRadius, 0, Math.PI * 2)
          ctx.fill()
        }

        // Label — only visible when illuminated
        if (il > 0.2) {
          ctx.font = '12px "Cormorant Garamond", serif'
          ctx.fillStyle = `rgba(255, 240, 180, ${il * 0.6})`
          ctx.textAlign = 'center'
          ctx.fillText(lm.label, lx, ly - 55)
        }

        // Click indicator — pulsing circle when clickable
        if (il > 0.3) {
          const pulse = 0.5 + Math.sin(time * 5) * 0.3
          ctx.beginPath()
          ctx.arc(lx, ly - 25, 4 + pulse * 2, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(255, 240, 180, ${il * 0.35 * pulse})`
          ctx.lineWidth = 1
          ctx.stroke()
          // Tiny "click" text
          ctx.font = '7px monospace'
          ctx.fillStyle = `rgba(255, 240, 180, ${il * 0.25 * pulse})`
          ctx.textAlign = 'center'
          ctx.fillText('click', lx, ly - 35)
        }

        ctx.restore()
      }
    }

    // Title
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(255, 250, 200, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the lighthouse', w / 2, 25)

    // Stats
    ctx.font = '12px monospace'
    ctx.fillStyle = 'rgba(255, 250, 200, 0.06)'
    ctx.textAlign = 'left'
    ctx.fillText(lightOn ? '\u25A0 transmitting' : '\u25A1 silence', 12, h - 18)
    ctx.textAlign = 'right'
    ctx.fillText(autoMode ? 'auto' : 'manual', w - 12, h - 18)

    // Cultural inscription
    inscriptionTimer += 0.016
    if (inscriptionTimer >= 25) {
      inscriptionTimer = 0
      inscriptionIdx = (inscriptionIdx + 1) % CULTURAL_INSCRIPTIONS.length
    }
    const insText = CULTURAL_INSCRIPTIONS[inscriptionIdx]
    ctx.font = '11px "Cormorant Garamond", serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255, 250, 200, 0.03)'
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
      ctx.fillText(insLines[li], w / 2, h - 45 + li * 14)
    }
  }

  function handleKey(e: KeyboardEvent) {
    if (!active) return

    if (e.key === 'Enter' && inputText.length > 0) {
      transmitMessage(inputText)
      inputText = ''
      e.preventDefault()
      return
    }

    if (e.key === 'Backspace') {
      inputText = inputText.slice(0, -1)
      e.preventDefault()
      return
    }

    if (e.key === 'Escape') {
      inputText = ''
      e.preventDefault()
      return
    }

    // Only accept printable characters
    if (e.key.length === 1 && inputText.length < 60) {
      const lower = e.key.toLowerCase()
      if (MORSE[lower] || lower === ' ') {
        inputText += lower
        e.preventDefault()
      }
    }
  }

  // ── Mouse move handler for wind + trail + ripples ──────────
  let lastTrailTime = 0

  function handleMouseMove(e: MouseEvent) {
    if (!active || !canvas) return
    cursorX = e.clientX
    cursorY = e.clientY
    cursorNormY = cursorY / canvas.height

    // Update wind
    updateWindFromCursor()

    // Add trail point (throttle to every ~50ms worth of time)
    if (time - lastTrailTime > 0.05) {
      cursorTrail.push({ x: cursorX, y: cursorY, birth: time, alpha: 1 })
      lastTrailTime = time
      // Limit trail length
      if (cursorTrail.length > 80) cursorTrail.shift()
    }

    // Ripples when cursor moves near/below water
    const horizonY = canvas.height * 0.65
    if (cursorY > horizonY - 20 && Math.random() < 0.15) {
      ripples.push({
        x: cursorX,
        y: Math.max(cursorY, horizonY + 5),
        birth: time,
        radius: 2,
      })
      // Limit ripple count
      if (ripples.length > 12) ripples.shift()
    }
  }

  return {
    name: 'lighthouse',
    label: 'the lighthouse',

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
      canvas.style.cssText = 'width: 100%; height: 100%;'
      ctx = canvas.getContext('2d')

      window.addEventListener('keydown', handleKey)

      // Landmark click — only works when beam illuminates the landmark
      canvas.addEventListener('click', (e) => {
        if (!deps.switchTo || !canvas) return
        const horizonY = canvas.height * 0.65
        for (let i = 0; i < landmarks.length; i++) {
          // Only clickable when sufficiently illuminated
          if (illuminated[i] < 0.3) continue
          const lx = canvas.width * landmarks[i].xFrac
          const ly = horizonY - 15 // center of the silhouette area
          const dx = e.clientX - lx
          const dy = e.clientY - ly
          // Generous click radius around landmark
          if (dx * dx + dy * dy < 2500) {
            deps.switchTo(landmarks[i].room)
            return
          }
        }
      })

      // Cursor changes when hovering an illuminated landmark + signal trail + ripples
      canvas.addEventListener('mousemove', (e) => {
        // Signal trail + wind + ripples
        handleMouseMove(e)

        if (!canvas || !deps.switchTo) return
        let overLandmark = false
        const horizonY = canvas.height * 0.65
        for (let i = 0; i < landmarks.length; i++) {
          if (illuminated[i] < 0.3) continue
          const lx = canvas.width * landmarks[i].xFrac
          const ly = horizonY - 15
          const dx = e.clientX - lx
          const dy = e.clientY - ly
          if (dx * dx + dy * dy < 2500) {
            overLandmark = true
            break
          }
        }
        canvas.style.cursor = overLandmark ? 'pointer' : 'default'
      })

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      // Shore link — hidden passage to tide pool
      if (deps.onDescend) {
        shoreLink = document.createElement('div')
        shoreLink.style.cssText = `
          position: absolute; bottom: 40px; left: 50%;
          transform: translateX(-50%);
          font-family: 'Cormorant Garamond', serif;
          font-size: 12px; font-style: italic;
          letter-spacing: 2px;
          color: rgba(80, 120, 180, 0.4);
          cursor: pointer; pointer-events: none;
          opacity: 0; transition: opacity 2s ease;
        `
        shoreLink.textContent = 'descend to the shore'
        shoreLink.addEventListener('click', () => deps.onDescend?.())
        overlay.appendChild(shoreLink)
      }

      overlay.appendChild(canvas)
      return overlay
    },

    activate() {
      active = true
      autoTimer = 60 // start auto-transmit after 1 second
      transmitCount = 0
      shoreLinkVisible = false
      if (shoreLink) {
        shoreLink.style.opacity = '0'
        shoreLink.style.pointerEvents = 'none'
      }
      startAudio()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      stopAudio()
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      stopAudio()
      window.removeEventListener('keydown', handleKey)
      overlay?.remove()
    },
  }
}
