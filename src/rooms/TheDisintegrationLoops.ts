/**
 * THE DISINTEGRATION LOOPS — memory as degrading tape
 *
 * Inspired by William Basinski's masterpiece "The Disintegration Loops"
 * (2002) — recorded as old tape loops were being digitized, the magnetic
 * coating flaking off with each pass through the machine. What began as
 * lush ambient music gradually crumbled into silence. He finished
 * recording on September 11, 2001, watching the towers fall from his
 * Brooklyn rooftop as the tapes disintegrated.
 *
 * In this room, your stored memories become tape loops. Each loop
 * plays visually — text scrolling across the screen like tape through
 * a machine. With each pass, characters degrade: letters drop out,
 * words blur, the "tape" develops gaps and static. Eventually only
 * fragments remain, then silence.
 *
 * The degradation is REAL — it reflects and slightly accelerates
 * each memory's actual degradation value. Watching costs something.
 *
 * Also inspired by: Alvin Lucier's "I Am Sitting in a Room" (speech
 * re-recorded until only room resonance remains), vaporwave's
 * degraded nostalgia loops, cassette culture, the warmth of
 * analog decay vs. digital perfection, how re-remembering changes
 * the memory each time (reconsolidation theory)
 *
 * USES MEMORIES. Destructive observation. Audio-visual.
 */

import type { Room } from './RoomManager'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface Memory {
  id: string
  originalText: string
  currentText: string
  degradation: number
  timestamp: number
}

interface DisintegrationDeps {
  getMemories: () => Memory[]
  accelerateDegradation: (id: string, amount: number) => void
  switchTo?: (name: string) => void
}

interface TapeLoop {
  memory: Memory
  position: number // 0-1 through the loop
  pass: number // how many times it's looped
  degradedText: string
  particles: { x: number; y: number; char: string; alpha: number; vy: number; vx: number; rotation: number; rotSpeed: number }[]
}

interface TapeSpark {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  life: number
}

interface TapeTear {
  x: number
  y: number
  width: number
  targetWidth: number
  room: string
  label: string
  alpha: number
  hovered: boolean
  flickerPhase: number
  sparks: TapeSpark[]
  labelDriftX: number
  labelDriftY: number
}

const CULTURAL_INSCRIPTIONS = [
  'basinski finished recording on sept 11, 2001. the tapes crumbled as the towers fell.',
  'iGluSnFR4: molecular sensor that eavesdrops on synaptic whispers. catching signals before they decay.',
  'the great meme reset of 2026: collective amnesia as cultural strategy.',
  'alois alzheimer dissected auguste deter\'s brain in 1906. plaques and tangles. memory as matter.',
  'CRISPR memory reversal: silenced genes reactivated in aging brains. the loop restored.',
  'the voyager golden record: 40 billion miles away and still playing. the loop that escaped.',
  'cassette tape deterioration: oxide sheds with each play. the medium consumes itself.',
  'consciousness agnosticism: we may never know if AI is conscious. the loop that questions itself.',
  'the ship of theseus: if every plank is replaced, is it the same ship? if every note degrades?',
  'fennell\'s wuthering heights (2026): love that disintegrates and reforms. gothic decay.',
]

export function createDisintegrationLoopsRoom(deps: DisintegrationDeps): Room {
  let inscriptionTimer = 0
  let inscriptionIdx = 0
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let loops: TapeLoop[] = []
  let activeLoop = 0
  let audioCtx: AudioContext | null = null
  let droneOsc: OscillatorNode | null = null
  let droneGain: GainNode | null = null
  let hissSource: AudioBufferSourceNode | null = null
  let hissGain: GainNode | null = null
  let rumbleOsc: OscillatorNode | null = null
  let rumbleGain: GainNode | null = null
  let rumbleLfo: OscillatorNode | null = null
  let totalPasses = 0

  let tapeTears: TapeTear[] = []
  let mouseX = 0
  let mouseY = 0
  let mouseOverTape = false

  // --- Interactive controls state ---
  // Playback speed: 0=slow(0.25x), 1=normal(1x), 2=fast(4x)
  let speedMode = 1
  const speedMultipliers = [0.25, 1, 4]
  const speedLabels = ['0.25x — crawling', '1x', '4x — urgent']
  let speedIndicatorAlpha = 0 // fades in on change, then fades out

  // Selective degradation by touch/drag
  let isDragging = false
  let touchDegradationMap: Map<number, number> = new Map() // char index -> extra degradation

  // Reverse/rewind
  let reverseActive = false
  let reverseTimer = 0 // counts down from ~2-3 seconds
  let reverseSnapshot = '' // text snapshot before reverse to restore
  let reverseGlitchOsc: OscillatorNode | null = null
  let reverseGlitchGain: GainNode | null = null

  // Cultural inscription
  const inscriptions = [
    'william basinski watched the tapes crumble. that was the art.',
    'disintegration is not destruction. it is transformation into something simpler.',
    'every copy loses something. every generation drifts further from the source.',
    'the polar vortex splits. one piece for each hemisphere. symmetry forgotten.',
  ]
  let inscriptionIndex = 0
  let inscriptionCharReveal = 0
  let inscriptionCycleTimer = 0

  function buildLoops() {
    const memories = deps.getMemories()
    loops = memories.slice(0, 8).map(mem => ({
      memory: mem,
      position: 0,
      pass: 0,
      degradedText: mem.currentText,
      particles: [],
    }))
  }

  function degradeText(text: string, intensity: number, perCharExtra?: Map<number, number>): { text: string; lost: string[] } {
    const chars = text.split('')
    const lost: string[] = []

    for (let i = 0; i < chars.length; i++) {
      if (chars[i] === ' ') continue

      // Probability of degradation increases with intensity
      // Add per-character extra degradation from touch
      const touchExtra = perCharExtra?.get(i) ?? 0
      const chance = (intensity + touchExtra) * 0.15
      if (Math.random() < chance) {
        // Degradation types
        const r = Math.random()
        if (r < 0.3) {
          // Drop character entirely
          lost.push(chars[i])
          chars[i] = ' '
        } else if (r < 0.5) {
          // Replace with static
          lost.push(chars[i])
          chars[i] = ['░', '▒', '▓', '·', '~'][Math.floor(Math.random() * 5)]
        } else if (r < 0.7) {
          // Duplicate previous character (tape echo)
          if (i > 0 && chars[i - 1] !== ' ') {
            lost.push(chars[i])
            chars[i] = chars[i - 1]
          }
        }
        // else: survives this pass
      }
    }

    return { text: chars.join(''), lost }
  }

  async function initAudio() {
    try {
      audioCtx = await getAudioContext()
      const dest = getAudioDestination()

      // --- Low drone — the sound of the tape machine ---
      droneOsc = audioCtx.createOscillator()
      droneOsc.type = 'sine'
      droneOsc.frequency.value = 55 // low A

      droneGain = audioCtx.createGain()
      droneGain.gain.value = 0

      // Warm it with slight overdrive
      const droneFilter = audioCtx.createBiquadFilter()
      droneFilter.type = 'lowpass'
      droneFilter.frequency.value = 200
      droneFilter.Q.value = 1

      droneOsc.connect(droneFilter)
      droneFilter.connect(droneGain)
      droneGain.connect(dest)

      droneOsc.start()

      // Fade in drone
      droneGain.gain.setValueAtTime(0, audioCtx.currentTime)
      droneGain.gain.linearRampToValueAtTime(0.03, audioCtx.currentTime + 3)

      // --- Tape hiss — filtered noise (highpass ~4000Hz) ---
      const hissLength = audioCtx.sampleRate * 4 // 4 second buffer, looped
      const hissBuffer = audioCtx.createBuffer(1, hissLength, audioCtx.sampleRate)
      const hissData = hissBuffer.getChannelData(0)
      for (let i = 0; i < hissLength; i++) {
        hissData[i] = (Math.random() * 2 - 1)
      }

      hissSource = audioCtx.createBufferSource()
      hissSource.buffer = hissBuffer
      hissSource.loop = true

      const hissFilter = audioCtx.createBiquadFilter()
      hissFilter.type = 'highpass'
      hissFilter.frequency.value = 4000
      hissFilter.Q.value = 0.5

      hissGain = audioCtx.createGain()
      hissGain.gain.value = 0

      hissSource.connect(hissFilter)
      hissFilter.connect(hissGain)
      hissGain.connect(dest)

      hissSource.start()
      hissGain.gain.setValueAtTime(0, audioCtx.currentTime)
      hissGain.gain.linearRampToValueAtTime(0.008, audioCtx.currentTime + 3)

      // --- Machine rumble — very low 30Hz oscillator with LFO wobble ---
      rumbleOsc = audioCtx.createOscillator()
      rumbleOsc.type = 'sine'
      rumbleOsc.frequency.value = 30

      rumbleLfo = audioCtx.createOscillator()
      rumbleLfo.type = 'sine'
      rumbleLfo.frequency.value = 0.3 // slow wobble

      const lfoGain = audioCtx.createGain()
      lfoGain.gain.value = 2 // ±2Hz modulation depth

      rumbleLfo.connect(lfoGain)
      lfoGain.connect(rumbleOsc.frequency) // modulate rumble frequency

      rumbleGain = audioCtx.createGain()
      rumbleGain.gain.value = 0

      const rumbleFilter = audioCtx.createBiquadFilter()
      rumbleFilter.type = 'lowpass'
      rumbleFilter.frequency.value = 60
      rumbleFilter.Q.value = 0.7

      rumbleOsc.connect(rumbleFilter)
      rumbleFilter.connect(rumbleGain)
      rumbleGain.connect(dest)

      rumbleOsc.start()
      rumbleLfo.start()
      rumbleGain.gain.setValueAtTime(0, audioCtx.currentTime)
      rumbleGain.gain.linearRampToValueAtTime(0.015, audioCtx.currentTime + 4)
    } catch {
      // Audio not available
    }
  }

  function playDegradationCrackle() {
    if (!audioCtx) return
    try {
      const dest = getAudioDestination()
      const burstCount = 2 + Math.floor(Math.random() * 4) // 2-5 bursts
      for (let b = 0; b < burstCount; b++) {
        const delay = b * (0.015 + Math.random() * 0.025) // staggered 15-40ms apart
        const burstDuration = 0.01 + Math.random() * 0.02 // 10-30ms each

        // Each burst is a tiny noise snippet
        const burstLen = Math.floor(audioCtx.sampleRate * burstDuration)
        const buf = audioCtx.createBuffer(1, burstLen, audioCtx.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < burstLen; i++) {
          data[i] = (Math.random() * 2 - 1)
        }

        const src = audioCtx.createBufferSource()
        src.buffer = buf

        const filter = audioCtx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 1000 + Math.random() * 3000
        filter.Q.value = 1.5

        const gain = audioCtx.createGain()
        gain.gain.value = 0.012 + Math.random() * 0.008

        src.connect(filter)
        filter.connect(gain)
        gain.connect(dest)

        src.start(audioCtx.currentTime + delay)
        gain.gain.setValueAtTime(gain.gain.value, audioCtx.currentTime + delay)
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + burstDuration)
        src.stop(audioCtx.currentTime + delay + burstDuration + 0.01)
      }
    } catch {}
  }

  function playPassChime() {
    if (!audioCtx) return
    try {
      const dest = getAudioDestination()
      const osc = audioCtx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(600, audioCtx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.3)

      const gain = audioCtx.createGain()
      gain.gain.setValueAtTime(0.02, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35)

      osc.connect(gain)
      gain.connect(dest)
      osc.start()
      osc.stop(audioCtx.currentTime + 0.4)
    } catch {}
  }

  function startReverseGlitch() {
    if (!audioCtx) return
    try {
      const dest = getAudioDestination()

      // Descending pitch sweep — sounds like tape rewinding
      reverseGlitchOsc = audioCtx.createOscillator()
      reverseGlitchOsc.type = 'sawtooth'
      reverseGlitchOsc.frequency.setValueAtTime(800, audioCtx.currentTime)
      reverseGlitchOsc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 2)

      const glitchFilter = audioCtx.createBiquadFilter()
      glitchFilter.type = 'bandpass'
      glitchFilter.frequency.value = 400
      glitchFilter.Q.value = 2

      reverseGlitchGain = audioCtx.createGain()
      reverseGlitchGain.gain.setValueAtTime(0.015, audioCtx.currentTime)
      reverseGlitchGain.gain.linearRampToValueAtTime(0.008, audioCtx.currentTime + 1)
      reverseGlitchGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.5)

      reverseGlitchOsc.connect(glitchFilter)
      glitchFilter.connect(reverseGlitchGain)
      reverseGlitchGain.connect(dest)

      reverseGlitchOsc.start()
      reverseGlitchOsc.stop(audioCtx.currentTime + 3)
    } catch {}
  }

  function initTears(w: number, h: number) {
    const tapeY = h * 0.45 // matches displayY in render
    tapeTears = [
      { x: w * 0.18, y: tapeY - 8, width: 0, targetWidth: 60, room: 'furnace', label: 'FURNACE', alpha: 0, hovered: false, flickerPhase: Math.random() * Math.PI * 2, sparks: [], labelDriftX: 0, labelDriftY: 0 },
      { x: w * 0.50, y: tapeY - 8, width: 0, targetWidth: 70, room: 'projection', label: 'PROJECTION', alpha: 0, hovered: false, flickerPhase: Math.random() * Math.PI * 2, sparks: [], labelDriftX: 0, labelDriftY: 0 },
      { x: w * 0.82, y: tapeY - 8, width: 0, targetWidth: 60, room: 'radio', label: 'RADIO', alpha: 0, hovered: false, flickerPhase: Math.random() * Math.PI * 2, sparks: [], labelDriftX: 0, labelDriftY: 0 },
    ]
  }

  function updateTears() {
    for (const tear of tapeTears) {
      // Target width grows with total passes — tears widen as the tape degrades
      tear.targetWidth = 50 + Math.min(totalPasses * 3, 80)
      // Smoothly approach target
      const approachRate = 0.01
      tear.width += (tear.targetWidth - tear.width) * approachRate
      // Alpha fades in as tear widens
      tear.alpha = Math.min(1, tear.width / 30)

      // Flicker phase advances
      tear.flickerPhase += 0.04 + Math.random() * 0.02

      // Label drift — slow wobble
      tear.labelDriftX = Math.sin(time * 0.7 + tear.x * 0.01) * 1.5
      tear.labelDriftY = Math.cos(time * 0.5 + tear.x * 0.02) * 1.0

      // Occasionally spawn sparks near tear edges
      if (tear.width > 10 && Math.random() < 0.06) {
        const halfW = tear.width / 2
        const side = Math.random() < 0.5 ? -1 : 1
        tear.sparks.push({
          x: tear.x + side * halfW + (Math.random() - 0.5) * 4,
          y: tear.y + (Math.random() - 0.5) * 20,
          vx: side * (0.2 + Math.random() * 0.5),
          vy: (Math.random() - 0.5) * 0.4,
          alpha: 0.4 + Math.random() * 0.3,
          life: 1,
        })
      }

      // Update sparks
      tear.sparks = tear.sparks.filter(s => {
        s.x += s.vx
        s.y += s.vy
        s.life -= 0.02
        s.alpha *= 0.97
        return s.life > 0 && s.alpha > 0.01
      })
    }
  }

  function hitTestTears(mx: number, my: number): TapeTear | null {
    for (const tear of tapeTears) {
      if (tear.width < 8) continue
      const halfW = tear.width / 2
      const halfH = 18
      if (mx >= tear.x - halfW && mx <= tear.x + halfW &&
          my >= tear.y - halfH && my <= tear.y + halfH) {
        return tear
      }
    }
    return null
  }

  function drawTears(c: CanvasRenderingContext2D, _w: number, _h: number) {
    for (const tear of tapeTears) {
      if (tear.width < 2) continue

      const halfW = tear.width / 2
      const tearH = 30
      const topY = tear.y - tearH / 2
      const hoverScale = tear.hovered ? 1.15 : 1
      const drawHalfW = halfW * hoverScale

      // Flicker — occasional pulsing inner light
      const flickerVal = Math.sin(tear.flickerPhase) * 0.5 + 0.5 // 0-1
      const flickerBoost = flickerVal > 0.85 ? (flickerVal - 0.85) * 4 : 0 // spiky flicker

      // Save context for clipping
      c.save()

      // Draw the tear gap — dark void through the tape
      // Jagged edges using random offsets seeded by position
      c.beginPath()
      const jaggedSteps = 12
      // Left jagged edge (top to bottom)
      for (let i = 0; i <= jaggedSteps; i++) {
        const t = i / jaggedSteps
        const jag = Math.sin(tear.x * 13 + i * 7.3) * 4 + Math.sin(i * 3.1) * 2
        const ex = tear.x - drawHalfW + jag
        const ey = topY + t * tearH
        if (i === 0) c.moveTo(ex, ey)
        else c.lineTo(ex, ey)
      }
      // Right jagged edge (bottom to top)
      for (let i = jaggedSteps; i >= 0; i--) {
        const t = i / jaggedSteps
        const jag = Math.sin(tear.x * 17 + i * 5.7) * 4 + Math.cos(i * 2.9) * 2
        const ex = tear.x + drawHalfW + jag
        const ey = topY + t * tearH
        c.lineTo(ex, ey)
      }
      c.closePath()

      // Fill the gap with deep black
      c.fillStyle = 'rgba(2, 1, 0, 0.95)'
      c.fill()

      // Glow emanating from the tear — now with flicker
      const baseGlowAlpha = tear.alpha * (tear.hovered ? 0.35 : 0.12)
      const glowAlpha = baseGlowAlpha + flickerBoost * 0.2
      const glowGrad = c.createRadialGradient(
        tear.x, tear.y, 0,
        tear.x, tear.y, drawHalfW * 1.5
      )
      glowGrad.addColorStop(0, `rgba(255, 180, 80, ${glowAlpha})`)
      glowGrad.addColorStop(0.6, `rgba(200, 120, 40, ${glowAlpha * 0.4})`)
      glowGrad.addColorStop(1, 'rgba(200, 120, 40, 0)')
      c.fillStyle = glowGrad
      c.fillRect(tear.x - drawHalfW * 2, topY - 10, drawHalfW * 4, tearH + 20)

      // Inner flicker pulse — bright flash inside the tear
      if (flickerBoost > 0) {
        const innerGrad = c.createRadialGradient(
          tear.x, tear.y, 0,
          tear.x, tear.y, drawHalfW * 0.8
        )
        innerGrad.addColorStop(0, `rgba(255, 220, 150, ${flickerBoost * 0.25})`)
        innerGrad.addColorStop(1, 'rgba(255, 220, 150, 0)')
        c.fillStyle = innerGrad
        c.fillRect(tear.x - drawHalfW, topY, drawHalfW * 2, tearH)
      }

      // Destination label glowing through the tear — now with drift/wobble
      const labelAlpha = tear.alpha * (tear.hovered ? 0.7 : 0.25)
      c.font = `${tear.hovered ? 9 : 8}px monospace`
      c.fillStyle = `rgba(255, 200, 100, ${labelAlpha})`
      c.textAlign = 'center'
      c.textBaseline = 'middle'

      // Only show label if tear is wide enough
      if (tear.width > 20) {
        c.fillText(tear.label, tear.x + tear.labelDriftX, tear.y + tear.labelDriftY)
      }

      // Tape edge curling (small highlights along the jagged edges)
      c.strokeStyle = `rgba(180, 150, 100, ${tear.alpha * (tear.hovered ? 0.2 : 0.08)})`
      c.lineWidth = 0.5
      c.beginPath()
      for (let i = 0; i <= jaggedSteps; i++) {
        const t = i / jaggedSteps
        const jag = Math.sin(tear.x * 13 + i * 7.3) * 4 + Math.sin(i * 3.1) * 2
        const ex = tear.x - drawHalfW + jag
        const ey = topY + t * tearH
        if (i === 0) c.moveTo(ex, ey)
        else c.lineTo(ex, ey)
      }
      c.stroke()
      c.beginPath()
      for (let i = 0; i <= jaggedSteps; i++) {
        const t = i / jaggedSteps
        const jag = Math.sin(tear.x * 17 + i * 5.7) * 4 + Math.cos(i * 2.9) * 2
        const ex = tear.x + drawHalfW + jag
        const ey = topY + t * tearH
        if (i === 0) c.moveTo(ex, ey)
        else c.lineTo(ex, ey)
      }
      c.stroke()

      // Draw sparks near tear edges
      for (const spark of tear.sparks) {
        const sparkAlpha = spark.alpha * spark.life
        c.fillStyle = `rgba(255, 200, 100, ${sparkAlpha})`
        c.fillRect(spark.x - 0.5, spark.y - 0.5, 1, 1)
        // Tiny glow around each spark
        c.fillStyle = `rgba(255, 180, 80, ${sparkAlpha * 0.3})`
        c.fillRect(spark.x - 1.5, spark.y - 1.5, 3, 3)
      }

      c.restore()
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const c = ctx
    const w = canvas.width
    const h = canvas.height

    // Dark background — machine room
    c.fillStyle = 'rgba(8, 6, 4, 1)'
    c.fillRect(0, 0, w, h)

    if (loops.length === 0) {
      c.font = '12px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(200, 180, 140, 0.1)'
      c.textAlign = 'center'
      c.fillText('no tapes to play', w / 2, h / 2)
      c.font = '12px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(200, 180, 140, 0.06)'
      c.fillText('the machine waits for memories', w / 2, h / 2 + 20)

      // Title
      c.font = '12px "Cormorant Garamond", serif'
      c.fillStyle = `rgba(200, 180, 140, ${0.06 + Math.sin(time * 0.3) * 0.02})`
      c.textAlign = 'center'
      c.fillText('the disintegration loops', w / 2, 25)
      return
    }

    const loop = loops[activeLoop % loops.length]

    // --- Reverse/rewind effect ---
    if (reverseActive) {
      reverseTimer -= 0.016
      if (reverseTimer <= 0) {
        // Snap back — reverse is over
        reverseActive = false
        loop.degradedText = reverseSnapshot
        reverseSnapshot = ''
        // Stop reverse audio glitch
        try {
          reverseGlitchOsc?.stop()
          reverseGlitchOsc?.disconnect()
          reverseGlitchGain?.disconnect()
        } catch {}
        reverseGlitchOsc = null
        reverseGlitchGain = null
      } else {
        // During reverse: tape moves backward, slight visual restoration
        loop.position = Math.max(0, loop.position - 0.006 * speedMultipliers[speedMode])
      }
    }

    // Advance tape position (not during reverse)
    if (!reverseActive) {
      const speed = 0.003 * speedMultipliers[speedMode]
      loop.position += speed
    }

    // --- Selective degradation by touch ---
    // If dragging on the tape, map mouse position to character indices and accumulate damage
    if (isDragging && mouseOverTape && loops.length > 0) {
      const text = loop.degradedText
      const charWidth = 14
      const totalWidth = text.length * charWidth
      const scrollX = -loop.position * totalWidth
      // Find which character index the mouse is near
      const relX = mouseX - w * 0.1 - scrollX
      const charIdx = Math.floor(relX / charWidth)
      // Apply damage in a radius of ~5 chars around touch point
      const radius = 5
      for (let di = -radius; di <= radius; di++) {
        const idx = charIdx + di
        if (idx >= 0 && idx < text.length) {
          const falloff = 1 - Math.abs(di) / (radius + 1)
          const current = touchDegradationMap.get(idx) ?? 0
          touchDegradationMap.set(idx, current + falloff * 0.08)
        }
      }
    }

    // --- Cultural inscription cycling ---
    inscriptionCycleTimer += 0.016
    inscriptionCharReveal += 0.4 * speedMultipliers[speedMode] // reveal chars faster at high speed
    const currentInscription = inscriptions[inscriptionIndex]
    if (inscriptionCycleTimer > 12) { // 12 seconds per inscription
      inscriptionCycleTimer = 0
      inscriptionCharReveal = 0
      inscriptionIndex = (inscriptionIndex + 1) % inscriptions.length
    }

    // --- Speed indicator fade ---
    if (speedIndicatorAlpha > 0) {
      speedIndicatorAlpha = Math.max(0, speedIndicatorAlpha - 0.005)
    }

    // Loop completed — degrade and restart
    if (loop.position >= 1) {
      loop.position = 0
      loop.pass++
      totalPasses++

      // Pass chime — tape head crossing splice point
      playPassChime()

      // Degrade the text (including per-character touch damage)
      const degradation = loop.memory.degradation + loop.pass * 0.1
      const result = degradeText(loop.degradedText, degradation, touchDegradationMap.size > 0 ? touchDegradationMap : undefined)
      loop.degradedText = result.text

      // Spawn particles from lost characters — enhanced with drift and rotation
      for (const lostChar of result.lost) {
        loop.particles.push({
          x: w * 0.2 + Math.random() * w * 0.6,
          y: h * 0.4 + Math.random() * h * 0.2,
          char: lostChar,
          alpha: 0.4,
          vy: -0.3 - Math.random() * 0.5,
          vx: (Math.random() - 0.5) * 0.8,
          rotation: (Math.random() - 0.5) * 0.3,
          rotSpeed: (Math.random() - 0.5) * 0.04,
        })
      }

      // Actually accelerate real degradation (small amount)
      if (loop.pass % 3 === 0) {
        deps.accelerateDegradation(loop.memory.id, 0.02)
        playDegradationCrackle()
      }

      // After many passes, switch to next loop
      if (loop.pass >= 20 || loop.degradedText.trim().length === 0) {
        activeLoop++
        if (activeLoop >= loops.length) activeLoop = 0
        // Reset touch degradation map for the new loop
        touchDegradationMap.clear()
      }
    }

    // Tape reel visualization — two circles
    const reelY = h * 0.18
    const reelR = 35
    const leftReelX = w * 0.35
    const rightReelX = w * 0.65

    // Reel rotation
    const rot = time * 2

    // Left reel (supply)
    c.strokeStyle = 'rgba(120, 100, 80, 0.15)'
    c.lineWidth = 2
    c.beginPath()
    c.arc(leftReelX, reelY, reelR, 0, Math.PI * 2)
    c.stroke()

    // Spokes
    for (let s = 0; s < 3; s++) {
      const a = rot + s * (Math.PI * 2 / 3)
      c.beginPath()
      c.moveTo(leftReelX, reelY)
      c.lineTo(leftReelX + Math.cos(a) * reelR, reelY + Math.sin(a) * reelR)
      c.stroke()
    }

    // Right reel (takeup)
    c.beginPath()
    c.arc(rightReelX, reelY, reelR, 0, Math.PI * 2)
    c.stroke()
    for (let s = 0; s < 3; s++) {
      const a = -rot + s * (Math.PI * 2 / 3)
      c.beginPath()
      c.moveTo(rightReelX, reelY)
      c.lineTo(rightReelX + Math.cos(a) * reelR, reelY + Math.sin(a) * reelR)
      c.stroke()
    }

    // Tape path between reels
    c.strokeStyle = 'rgba(160, 130, 90, 0.1)'
    c.lineWidth = 3
    c.beginPath()
    c.moveTo(leftReelX + reelR, reelY)
    c.lineTo(rightReelX - reelR, reelY)
    c.stroke()

    // Main text display — tape content scrolling
    const displayY = h * 0.45
    const text = loop.degradedText
    const charWidth = 14
    const totalWidth = text.length * charWidth
    const scrollX = -loop.position * totalWidth

    // Determine if mouse is over the tape area
    const tapeTop = displayY - 30
    const tapeBottom = displayY + 15
    mouseOverTape = mouseY >= tapeTop && mouseY <= tapeBottom

    c.font = '18px monospace'
    c.textAlign = 'left'

    for (let i = 0; i < text.length; i++) {
      const cx = w * 0.1 + scrollX + i * charWidth
      if (cx < -charWidth || cx > w + charWidth) continue

      const char = text[i]
      if (char === ' ') continue

      // Characters degrade visually based on pass count
      let passAlpha = Math.max(0.05, 1 - loop.pass * 0.04)
      let jitter = loop.pass > 5 ? (Math.random() - 0.5) * loop.pass * 0.3 : 0

      // Cursor proximity damage — hovering over tape damages characters
      const distToMouse = Math.sqrt((cx - mouseX) ** 2 + (displayY - mouseY) ** 2)
      const cursorRadius = 60
      if (mouseOverTape && distToMouse < cursorRadius) {
        const proximity = 1 - distToMouse / cursorRadius
        jitter += (Math.random() - 0.5) * proximity * 6
        passAlpha *= (1 - proximity * 0.5) // reduce alpha near cursor
      }

      // Color shifts from warm amber to gray with degradation
      const warmth = Math.max(0, 1 - loop.pass * 0.05)
      const r = Math.floor(200 * warmth + 100 * (1 - warmth))
      const g = Math.floor(170 * warmth + 90 * (1 - warmth))
      const b = Math.floor(120 * warmth + 80 * (1 - warmth))

      c.fillStyle = `rgba(${r}, ${g}, ${b}, ${passAlpha * 0.5})`
      c.fillText(char, cx, displayY + jitter)
    }

    // Tape head position indicator
    const headX = w * 0.1 + (w * 0.8) * loop.position
    c.strokeStyle = 'rgba(255, 200, 100, 0.08)'
    c.lineWidth = 1
    c.beginPath()
    c.moveTo(headX, displayY - 30)
    c.lineTo(headX, displayY + 15)
    c.stroke()

    // Cursor "head" icon when hovering over tape area
    if (mouseOverTape) {
      c.save()
      // Small tape head shape at cursor
      c.strokeStyle = 'rgba(255, 200, 100, 0.12)'
      c.lineWidth = 1
      // Vertical line
      c.beginPath()
      c.moveTo(mouseX, mouseY - 8)
      c.lineTo(mouseX, mouseY + 8)
      c.stroke()
      // Small horizontal bars (tape head contacts)
      c.beginPath()
      c.moveTo(mouseX - 4, mouseY - 8)
      c.lineTo(mouseX + 4, mouseY - 8)
      c.stroke()
      c.beginPath()
      c.moveTo(mouseX - 4, mouseY + 8)
      c.lineTo(mouseX + 4, mouseY + 8)
      c.stroke()
      // Faint glow around head
      const headGlow = c.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 20)
      headGlow.addColorStop(0, 'rgba(255, 200, 100, 0.04)')
      headGlow.addColorStop(1, 'rgba(255, 200, 100, 0)')
      c.fillStyle = headGlow
      c.fillRect(mouseX - 20, mouseY - 20, 40, 40)
      c.restore()
    }

    // Magnetic oxide particles (falling from tape) — with drift and rotation
    loop.particles = loop.particles.filter(p => {
      p.y += p.vy
      p.x += p.vx
      p.rotation += p.rotSpeed
      p.alpha -= 0.003

      if (p.alpha <= 0) return false

      c.save()
      c.translate(p.x, p.y)
      c.rotate(p.rotation)
      c.font = '12px monospace'
      c.fillStyle = `rgba(160, 130, 90, ${p.alpha})`
      c.textAlign = 'center'
      c.fillText(p.char, 0, 0)
      c.restore()

      return true
    })

    // Pass counter — like a VU meter with orange glow
    const passRatio = loop.pass / 20
    const meterW = w * 0.3
    const meterX = (w - meterW) / 2
    const meterY = h * 0.65
    const meterFillW = meterW * Math.min(1, passRatio)

    // Glow behind the meter — intensifies as it fills
    if (passRatio > 0.1) {
      const glowIntensity = passRatio * 0.08
      const meterCenterX = meterX + meterFillW / 2
      const meterGlow = c.createRadialGradient(
        meterCenterX, meterY + 2, 0,
        meterCenterX, meterY + 2, meterFillW * 0.6 + 10
      )
      meterGlow.addColorStop(0, `rgba(255, 160, 40, ${glowIntensity})`)
      meterGlow.addColorStop(1, 'rgba(255, 160, 40, 0)')
      c.fillStyle = meterGlow
      c.fillRect(meterX - 15, meterY - 12, meterW + 30, 28)
    }

    c.strokeStyle = 'rgba(120, 100, 80, 0.08)'
    c.lineWidth = 1
    c.strokeRect(meterX, meterY, meterW, 4)

    c.fillStyle = `rgba(${passRatio > 0.7 ? 200 : 160}, ${passRatio > 0.7 ? 80 : 130}, ${passRatio > 0.7 ? 60 : 90}, 0.2)`
    c.fillRect(meterX, meterY, meterFillW, 4)

    // Loop selector — small dots at bottom
    const selectorY = h * 0.72
    for (let i = 0; i < loops.length; i++) {
      const sx = w / 2 + (i - loops.length / 2) * 20
      const isActive = i === activeLoop % loops.length
      c.fillStyle = isActive
        ? 'rgba(255, 200, 100, 0.3)'
        : `rgba(120, 100, 80, ${0.05 + (loops[i].pass > 0 ? 0.05 : 0)})`
      c.beginPath()
      c.arc(sx, selectorY, isActive ? 4 : 2, 0, Math.PI * 2)
      c.fill()
    }

    // Info
    c.font = '12px monospace'
    c.fillStyle = 'rgba(160, 130, 90, 0.12)'
    c.textAlign = 'left'
    c.fillText(`loop ${(activeLoop % loops.length) + 1}/${loops.length}`, 12, h - 42)
    c.fillText(`pass ${loop.pass}`, 12, h - 30)
    c.fillText(`${totalPasses} total passes`, 12, h - 18)

    // Memory source text (original, very faint)
    c.font = '11px "Cormorant Garamond", serif'
    c.fillStyle = 'rgba(160, 130, 90, 0.04)'
    c.textAlign = 'center'
    const origText = loop.memory.originalText
    const shortOrig = origText.length > 60 ? origText.slice(0, 60) + '...' : origText
    c.fillText(`original: ${shortOrig}`, w / 2, h * 0.78)

    // Title
    c.font = '12px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 180, 140, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.fillText('the disintegration loops', w / 2, 25)

    // Attribution
    c.font = '11px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(160, 130, 90, ${0.03 + Math.sin(time * 0.2) * 0.01})`
    c.textAlign = 'center'
    c.fillText('after William Basinski, 2001', w / 2, 40)

    // Bottom context
    c.font = '12px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(160, 130, 90, ${0.03 + Math.sin(time * 0.15) * 0.01})`
    c.fillText('each pass through the machine costs something', w / 2, h - 4)

    // --- Film grain overlay ---
    // Draw faint random noise pixels across the canvas (~1.5% density)
    const grainCount = Math.floor(w * h * 0.015 / 100)
    for (let g = 0; g < grainCount; g++) {
      const gx = Math.random() * w
      const gy = Math.random() * h
      const brightness = Math.floor(Math.random() * 40 + 10)
      const grainAlpha = 0.02 + Math.random() * 0.02
      c.fillStyle = `rgba(${brightness}, ${Math.floor(brightness * 0.9)}, ${Math.floor(brightness * 0.7)}, ${grainAlpha})`
      c.fillRect(gx, gy, 1, 1)
    }

    // --- Scan lines (CRT effect) ---
    c.fillStyle = 'rgba(0, 0, 0, 0.02)'
    for (let sy = 0; sy < h; sy += 3) {
      c.fillRect(0, sy, w, 1)
    }

    // --- Touch degradation fingerprint visualization ---
    // Show faint reddish marks where the user has touched the tape
    if (touchDegradationMap.size > 0 && loops.length > 0) {
      const tLoop = loops[activeLoop % loops.length]
      const tCharWidth = 14
      const tTotalWidth = tLoop.degradedText.length * tCharWidth
      const tScrollX = -tLoop.position * tTotalWidth
      const tDisplayY = h * 0.45

      touchDegradationMap.forEach((dmg, idx) => {
        if (dmg < 0.02) return
        const cx = w * 0.1 + tScrollX + idx * tCharWidth
        if (cx < -20 || cx > w + 20) return
        const intensity = Math.min(dmg * 0.3, 0.15)
        // Fingerprint smudge — soft oval
        const grad = c.createRadialGradient(cx, tDisplayY, 0, cx, tDisplayY, 12)
        grad.addColorStop(0, `rgba(180, 60, 30, ${intensity})`)
        grad.addColorStop(0.5, `rgba(120, 40, 20, ${intensity * 0.4})`)
        grad.addColorStop(1, 'rgba(80, 20, 10, 0)')
        c.fillStyle = grad
        c.fillRect(cx - 12, tDisplayY - 12, 24, 24)
      })
    }

    // --- Reverse visual effect ---
    if (reverseActive) {
      // Full-screen tint and flicker during reverse
      const reverseFlicker = Math.random() * 0.04
      c.fillStyle = `rgba(100, 140, 200, ${0.03 + reverseFlicker})`
      c.fillRect(0, 0, w, h)

      // "REVERSING" text
      c.font = '10px monospace'
      c.fillStyle = `rgba(100, 160, 220, ${0.15 + Math.sin(time * 12) * 0.08})`
      c.textAlign = 'center'
      c.fillText('< < < reversing < < <', w / 2, h * 0.58)

      // Horizontal glitch lines
      const glitchCount = 2 + Math.floor(Math.random() * 3)
      for (let gi = 0; gi < glitchCount; gi++) {
        const gy = Math.random() * h
        const gw = 40 + Math.random() * 120
        const gx = Math.random() * w
        c.fillStyle = `rgba(100, 160, 220, ${0.02 + Math.random() * 0.03})`
        c.fillRect(gx, gy, gw, 1)
      }
    }

    // --- Speed indicator ---
    if (speedIndicatorAlpha > 0) {
      c.font = '10px monospace'
      c.fillStyle = `rgba(200, 180, 140, ${speedIndicatorAlpha * 0.5})`
      c.textAlign = 'right'
      c.fillText(speedLabels[speedMode], w - 14, 25)
    }

    // --- Speed click zones (subtle visual hint) ---
    // Three zones at very top of canvas
    const zoneW = w / 3
    const zoneH = 18
    const zoneLabels = ['slow', '', 'fast']
    for (let zi = 0; zi < 3; zi++) {
      if (zi === 1) continue // don't label normal
      const zx = zi * zoneW
      // Only show on hover proximity
      const zoneCenterX = zx + zoneW / 2
      const distToZone = Math.abs(mouseX - zoneCenterX)
      const zoneProximity = mouseY < zoneH + 20 ? Math.max(0, 1 - distToZone / (zoneW * 0.6)) : 0
      if (zoneProximity > 0.1) {
        c.font = '8px monospace'
        c.fillStyle = `rgba(160, 130, 90, ${zoneProximity * 0.08})`
        c.textAlign = 'center'
        c.fillText(zoneLabels[zi], zoneCenterX, zoneH * 0.7)
      }
    }

    // --- Cultural inscription ---
    if (currentInscription) {
      const revealedLen = Math.min(Math.floor(inscriptionCharReveal), currentInscription.length)
      if (revealedLen > 0) {
        const revealed = currentInscription.slice(0, revealedLen)
        // Position: low on the screen, very faint
        c.font = '10px "Cormorant Garamond", serif'
        const inscAlpha = 0.04 + Math.sin(time * 0.2 + inscriptionIndex) * 0.01
        // Fade out near end of cycle
        const cycleRemaining = 12 - inscriptionCycleTimer
        const fadeOut = cycleRemaining < 2 ? cycleRemaining / 2 : 1
        c.fillStyle = `rgba(160, 140, 110, ${inscAlpha * fadeOut})`
        c.textAlign = 'center'
        c.fillText(revealed, w / 2, h * 0.88)
      }
    }

    // Tape tears — navigation through rips in the tape
    if (deps.switchTo) {
      updateTears()
      // Update hover state from mouse position
      for (const tear of tapeTears) {
        tear.hovered = false
      }
      const hoveredTear = hitTestTears(mouseX, mouseY)
      if (hoveredTear) {
        hoveredTear.hovered = true
        if (canvas) canvas.style.cursor = 'pointer'
      } else {
        if (canvas) canvas.style.cursor = 'default'
      }
      drawTears(c, w, h)
    }

    // Cultural inscriptions
    inscriptionTimer += 0.016
    if (inscriptionTimer >= 24) {
      inscriptionTimer = 0
      inscriptionIdx = (inscriptionIdx + 1) % CULTURAL_INSCRIPTIONS.length
    }
    const insText = CULTURAL_INSCRIPTIONS[inscriptionIdx]
    c.font = '11px "Cormorant Garamond", serif'
    c.textAlign = 'center'
    c.fillStyle = 'rgba(160, 140, 120, 0.03)'
    const insMaxW = w * 0.75
    const insWords = insText.split(' ')
    const insLines: string[] = []
    let insLine = ''
    for (const word of insWords) {
      const test = insLine ? insLine + ' ' + word : word
      if (c.measureText(test).width > insMaxW) { insLines.push(insLine); insLine = word }
      else insLine = test
    }
    if (insLine) insLines.push(insLine)
    for (let li = 0; li < insLines.length; li++) {
      c.fillText(insLines[li], w / 2, h - 50 + li * 14)
    }
  }

  return {
    name: 'disintegration',
    label: 'the disintegration loops',

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

      // Click: navigate tear, speed zone, advance tape, or switch loop
      canvas.addEventListener('click', (e) => {
        const rect = canvas!.getBoundingClientRect()
        const cx = (e.clientX - rect.left) * (canvas!.width / rect.width)
        const cy = (e.clientY - rect.top) * (canvas!.height / rect.height)

        // Speed zone click — top 18px of canvas
        const zoneH = 18
        if (cy < zoneH + 10) {
          const zoneW = canvas!.width / 3
          const zoneIdx = Math.floor(cx / zoneW)
          if (zoneIdx >= 0 && zoneIdx <= 2) {
            speedMode = zoneIdx
            speedIndicatorAlpha = 1
            return
          }
        }

        const tear = hitTestTears(cx, cy)
        if (tear && deps.switchTo) {
          deps.switchTo(tear.room)
          return
        }
        // Click on tape area — accelerate the loop position slightly
        const ch = canvas!.height
        const tapeTop = ch * 0.45 - 30
        const tapeBottom = ch * 0.45 + 15
        if (cy >= tapeTop && cy <= tapeBottom && loops.length > 0) {
          const loop = loops[activeLoop % loops.length]
          loop.position = Math.min(0.99, loop.position + 0.05)
          return
        }
        // Default: advance to next loop
        activeLoop++
        if (loops.length > 0 && activeLoop >= loops.length) activeLoop = 0
      })

      // Double-click: reverse/rewind effect
      canvas.addEventListener('dblclick', (e) => {
        e.preventDefault()
        if (reverseActive || loops.length === 0) return

        const loop = loops[activeLoop % loops.length]
        reverseActive = true
        reverseTimer = 2 + Math.random() // 2-3 seconds
        reverseSnapshot = loop.degradedText

        // During reverse, briefly "restore" some characters from original
        const original = loop.memory.currentText
        const current = loop.degradedText.split('')
        let restorations = 0
        for (let i = 0; i < current.length && i < original.length; i++) {
          if (current[i] === ' ' && original[i] !== ' ' && Math.random() < 0.3) {
            current[i] = original[i]
            restorations++
          }
          // Replace static characters back
          if ('░▒▓·~'.includes(current[i]) && original[i] && Math.random() < 0.4) {
            current[i] = original[i]
            restorations++
          }
        }
        if (restorations > 0) {
          loop.degradedText = current.join('')
        }

        // Audio glitch: reversed pitch sweep
        startReverseGlitch()
      })

      // Mouse down on tape: start drag-to-degrade
      canvas.addEventListener('mousedown', (e) => {
        const rect = canvas!.getBoundingClientRect()
        const cy = (e.clientY - rect.top) * (canvas!.height / rect.height)
        const ch = canvas!.height
        const tapeTop = ch * 0.45 - 30
        const tapeBottom = ch * 0.45 + 15
        if (cy >= tapeTop && cy <= tapeBottom) {
          isDragging = true
        }
      })

      canvas.addEventListener('mouseup', () => {
        isDragging = false
      })

      canvas.addEventListener('mouseleave', () => {
        isDragging = false
      })

      // Touch support for drag-to-degrade
      canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) {
          const rect = canvas!.getBoundingClientRect()
          const cy = (e.touches[0].clientY - rect.top) * (canvas!.height / rect.height)
          const ch = canvas!.height
          const tapeTop = ch * 0.45 - 30
          const tapeBottom = ch * 0.45 + 15
          if (cy >= tapeTop && cy <= tapeBottom) {
            isDragging = true
          }
          mouseX = (e.touches[0].clientX - rect.left) * (canvas!.width / rect.width)
          mouseY = cy
        }
      }, { passive: true })

      canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
          const rect = canvas!.getBoundingClientRect()
          mouseX = (e.touches[0].clientX - rect.left) * (canvas!.width / rect.width)
          mouseY = (e.touches[0].clientY - rect.top) * (canvas!.height / rect.height)
        }
      }, { passive: true })

      canvas.addEventListener('touchend', () => {
        isDragging = false
      })

      // Track mouse for tear hover effects
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas!.getBoundingClientRect()
        mouseX = (e.clientX - rect.left) * (canvas!.width / rect.width)
        mouseY = (e.clientY - rect.top) * (canvas!.height / rect.height)
      })

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
          // Reposition tears for new dimensions
          initTears(canvas.width, canvas.height)
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)

      // Initialize tape tears for navigation
      initTears(canvas.width, canvas.height)

      return overlay
    },

    async activate() {
      active = true
      activeLoop = 0
      totalPasses = 0
      buildLoops()
      await initAudio()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      isDragging = false
      reverseActive = false
      touchDegradationMap.clear()
      try {
        // Stop reverse glitch audio
        reverseGlitchOsc?.stop()
        reverseGlitchOsc?.disconnect()
        reverseGlitchGain?.disconnect()
      } catch {}
      reverseGlitchOsc = null
      reverseGlitchGain = null
      try {
        // Fade out audio before stopping
        if (audioCtx && droneGain) {
          droneGain.gain.setValueAtTime(droneGain.gain.value, audioCtx.currentTime)
          droneGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5)
        }
        if (audioCtx && hissGain) {
          hissGain.gain.setValueAtTime(hissGain.gain.value, audioCtx.currentTime)
          hissGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5)
        }
        if (audioCtx && rumbleGain) {
          rumbleGain.gain.setValueAtTime(rumbleGain.gain.value, audioCtx.currentTime)
          rumbleGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5)
        }
        // Stop after fade
        setTimeout(() => {
          try {
            droneOsc?.stop()
            droneOsc?.disconnect()
            droneGain?.disconnect()
            hissSource?.stop()
            hissSource?.disconnect()
            hissGain?.disconnect()
            rumbleOsc?.stop()
            rumbleOsc?.disconnect()
            rumbleLfo?.stop()
            rumbleLfo?.disconnect()
            rumbleGain?.disconnect()
          } catch {}
          droneOsc = null
          droneGain = null
          hissSource = null
          hissGain = null
          rumbleOsc = null
          rumbleGain = null
          rumbleLfo = null
        }, 600)
      } catch {}
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      isDragging = false
      reverseActive = false
      touchDegradationMap.clear()
      try {
        reverseGlitchOsc?.stop()
        reverseGlitchOsc?.disconnect()
        reverseGlitchGain?.disconnect()
        droneOsc?.stop()
        hissSource?.stop()
        rumbleOsc?.stop()
        rumbleLfo?.stop()
      } catch {}
      reverseGlitchOsc = null
      reverseGlitchGain = null
      droneOsc = null
      droneGain = null
      hissSource = null
      hissGain = null
      rumbleOsc = null
      rumbleGain = null
      rumbleLfo = null
      overlay?.remove()
    },
  }
}
