/**
 * THE PENDULUM — harmonics made visible
 *
 * A harmonograph simulator. Two coupled pendulums trace Lissajous-like
 * curves that slowly decay. The result is a drawing that looks like
 * something between a spirograph and a dying star.
 *
 * Drag to pull the pendulum into new shapes. Shift+Click to randomize.
 * Scroll to adjust decay rate. Move the cursor to gently perturb the trace.
 *
 * No memories. No text. Pure physics and geometry.
 * The beauty is in the transience: each pattern appears, evolves,
 * and vanishes. You can't save them. You can only watch.
 *
 * Inspired by: harmonographs, Lissajous curves, Spirograph,
 * pendulum wave machines, cymatics, the relationship between
 * oscillation and beauty, how simple forces create complex art,
 * Milan Cortina 2026 Olympics theme "armonia" — harmony made visible.
 */

import type { Room } from './RoomManager'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface PendulumDeps {
  switchTo?: (name: string) => void
}

interface PendulumState {
  freq: number
  phase: number
  amp: number
  decay: number
}

const CULTURAL_INSCRIPTIONS = [
  'foucault\'s pendulum proves the earth rotates. the floor turns, the pendulum stays true.',
  'lissajous figures: the visual signature of two frequencies in conversation.',
  'polar vortex split, feb 2026: the atmosphere\'s pendulum swinging to extremes.',
  'the pit and the pendulum: poe\'s blade swings closer with each pass. time as threat.',
  'harmonograph: victorian drawing machines that made ephemeral art from coupled oscillations.',
  'huygens\' clocks: two pendulums on the same wall synchronize. sympathy between machines.',
  '7000-atom schrödinger\'s cat: the largest quantum pendulum ever, swinging in two states at once.',
  'the metronome: tempo is just a pendulum counting time. music is regulated swing.',
  'galileo watched a chandelier swing in pisa cathedral. isochronism: big swings and small take the same time.',
  'hidden quantum geometry: the quantum metric bends electrons like pendulums bend space.',
]

export function createPendulumRoom(deps?: PendulumDeps): Room {
  let inscriptionTimer = 0
  let inscriptionIdx = 0
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let traceTime = 0
  // Navigation pendulum bobs — swing to navigate
  interface NavBob {
    room: string
    label: string
    hue: number          // bob color hue
    edge: 'N' | 'S' | 'E' | 'W'
    swingAngle: number   // current swing offset (pixels)
    swingVel: number     // angular velocity
    amplitude: number    // current swing amplitude (grows on interaction)
    baseAmplitude: number // idle swing amplitude
    rings: { r: number; alpha: number }[] // resonance rings
    triggered: boolean   // navigation triggered, waiting for ring anim
    triggerTime: number  // when triggered
    showLabel: boolean   // show room name
  }

  const navBobs: NavBob[] = [
    { room: 'instrument', label: 'instrument', hue: 42, edge: 'N',
      swingAngle: 0, swingVel: 0, amplitude: 6, baseAmplitude: 6,
      rings: [], triggered: false, triggerTime: 0, showLabel: false },
    { room: 'clocktower', label: 'clocktower', hue: 210, edge: 'S',
      swingAngle: 0, swingVel: 0, amplitude: 6, baseAmplitude: 6,
      rings: [], triggered: false, triggerTime: 0, showLabel: false },
    { room: 'automaton', label: 'automaton', hue: 140, edge: 'W',
      swingAngle: 0, swingVel: 0, amplitude: 6, baseAmplitude: 6,
      rings: [], triggered: false, triggerTime: 0, showLabel: false },
    { room: 'cipher', label: 'cipher', hue: 280, edge: 'E',
      swingAngle: 0, swingVel: 0, amplitude: 6, baseAmplitude: 6,
      rings: [], triggered: false, triggerTime: 0, showLabel: false },
  ]

  const NAV_BOB_RADIUS = 8
  const NAV_TRIGGER_AMPLITUDE = 35
  const NAV_RING_SPEED = 80
  const NAV_RING_COUNT = 3

  // Cursor state (normalized -1..1 from center)
  let cursorX = 0
  let cursorY = 0
  // Cursor screen position for magnetic field
  let cursorScreenX = 0
  let cursorScreenY = 0

  // Drag state
  let isDragging = false

  // Audio state
  let audioInitialized = false
  let oscillators: OscillatorNode[] = []
  let oscGains: GainNode[] = []
  let delayNode: DelayNode | null = null
  let feedbackGain: GainNode | null = null
  let dryGain: GainNode | null = null
  let wetGain: GainNode | null = null
  let audioMaster: GainNode | null = null
  const BASE_HZ = 220

  // Two pendulums for X, two for Y (full harmonograph has 4)
  let pendulums: PendulumState[] = []
  let hue = 330 // starting hue (pink)
  let fadeSpeed = 0.003 // how fast the trace fades

  // Ghost trace buffer — stores a snapshot of the canvas when pattern completes
  let ghostCanvas: HTMLCanvasElement | null = null
  let ghostCtx: CanvasRenderingContext2D | null = null
  let ghostAlpha = 0 // current ghost layer opacity (fades in when pattern dies)
  let ghostCaptured = false

  // Pattern catalog state
  let catalogLabel = ''
  let catalogAlpha = 0
  let catalogFadeStart = 0
  let lastFreqRatio: [number, number] = [1, 1] // store for classification

  // Pattern gallery — thumbnails of completed patterns
  interface GalleryEntry {
    imageData: ImageData
    ratio: [number, number]
    label: string
    hue: number
  }
  const patternGallery: GalleryEntry[] = []
  const MAX_GALLERY = 6

  // Resonance discovery — special ratios produce a brief visual/audio reward
  const GOLDEN_RATIOS: [number, number][] = [[1, 1], [2, 3], [3, 4], [5, 8]]
  let resonanceFlash = 0
  let resonanceLabel = ''

  // Pattern counter
  let patternsCreated = 0

  // --- Audio ---

  async function initAudio() {
    if (audioInitialized) return
    try {
      const ac = await getAudioContext()
      const dest = getAudioDestination()

      // Master gain for this room
      audioMaster = ac.createGain()
      audioMaster.gain.value = 0
      audioMaster.connect(dest)

      // Delay-based reverb
      delayNode = ac.createDelay(1.0)
      delayNode.delayTime.value = 0.35
      feedbackGain = ac.createGain()
      feedbackGain.gain.value = 0.3
      dryGain = ac.createGain()
      dryGain.gain.value = 0.7
      wetGain = ac.createGain()
      wetGain.gain.value = 0.3

      // dry path
      dryGain.connect(audioMaster)
      // wet path: delay -> feedback loop, delay -> wetGain -> master
      delayNode.connect(feedbackGain)
      feedbackGain.connect(delayNode)
      delayNode.connect(wetGain)
      wetGain.connect(audioMaster)

      // Create 4 oscillators (one per pendulum)
      for (let i = 0; i < 4; i++) {
        const osc = ac.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = 220
        const g = ac.createGain()
        g.gain.value = 0
        osc.connect(g)
        g.connect(dryGain)
        g.connect(delayNode)
        osc.start()
        oscillators.push(osc)
        oscGains.push(g)
      }

      audioInitialized = true
    } catch {
      // Audio not available — silent fallback
    }
  }

  function updateAudioFromPendulums(smooth: boolean) {
    if (!audioInitialized || oscillators.length < 4) return
    const ac = oscillators[0].context
    const now = ac.currentTime
    const rampTime = smooth ? 1.5 : 0.01

    for (let i = 0; i < 4; i++) {
      const p = pendulums[i]
      if (!p) continue
      const freq = p.freq * BASE_HZ
      // Clamp to audible range
      const clampedFreq = Math.max(40, Math.min(2000, freq))
      oscillators[i].frequency.cancelScheduledValues(now)
      oscillators[i].frequency.setValueAtTime(oscillators[i].frequency.value, now)
      oscillators[i].frequency.linearRampToValueAtTime(clampedFreq, now + rampTime)
    }
  }

  function updateAudioDecay() {
    if (!audioInitialized || oscillators.length < 4) return
    // Set oscillator gains based on pendulum amplitude * exponential decay
    // Very quiet tones (0.02-0.03) that fade with amplitude
    for (let i = 0; i < 4; i++) {
      const p = pendulums[i]
      if (!p) continue
      const envAmp = p.amp * Math.exp(-p.decay * traceTime)
      // Scale to very quiet level (0.02-0.03 max)
      const targetGain = Math.min(0.03, envAmp * 0.08)
      oscGains[i].gain.value = targetGain
    }
  }

  function fadeAudioIn() {
    if (!audioMaster) return
    const ac = audioMaster.context
    const now = ac.currentTime
    audioMaster.gain.cancelScheduledValues(now)
    audioMaster.gain.setValueAtTime(audioMaster.gain.value, now)
    audioMaster.gain.linearRampToValueAtTime(1.0, now + 0.5)
  }

  function fadeAudioOut() {
    if (!audioMaster) return
    const ac = audioMaster.context
    const now = ac.currentTime
    audioMaster.gain.cancelScheduledValues(now)
    audioMaster.gain.setValueAtTime(audioMaster.gain.value, now)
    audioMaster.gain.linearRampToValueAtTime(0, now + 0.3)
  }

  function destroyAudio() {
    fadeAudioOut()
    setTimeout(() => {
      for (const osc of oscillators) {
        try { osc.stop() } catch { /* already stopped */ }
      }
      for (const g of oscGains) {
        g.disconnect()
      }
      audioMaster?.disconnect()
      delayNode?.disconnect()
      feedbackGain?.disconnect()
      dryGain?.disconnect()
      wetGain?.disconnect()
      oscillators = []
      oscGains = []
      audioMaster = null
      delayNode = null
      feedbackGain = null
      dryGain = null
      wetGain = null
      audioInitialized = false
    }, 400)
  }

  // --- Pendulum Logic ---

  function randomize() {
    // Create 4 pendulums with interesting frequency ratios
    const ratios: [number, number][] = [
      [1, 1], [2, 3], [3, 4], [3, 2], [4, 3], [5, 4],
      [2, 1], [3, 1], [1, 2], [1, 3], [5, 6], [7, 8],
    ]
    const ratio = ratios[Math.floor(Math.random() * ratios.length)]
    lastFreqRatio = ratio

    const baseFreq = 1 + Math.random() * 2

    pendulums = [
      // X pendulums
      {
        freq: baseFreq * ratio[0],
        phase: Math.random() * Math.PI * 2,
        amp: 0.3 + Math.random() * 0.15,
        decay: 0.0003 + Math.random() * 0.0005,
      },
      {
        freq: baseFreq * (ratio[0] + 0.002 * (Math.random() - 0.5)), // slight detuning
        phase: Math.random() * Math.PI * 2,
        amp: 0.05 + Math.random() * 0.1,
        decay: 0.0004 + Math.random() * 0.0004,
      },
      // Y pendulums
      {
        freq: baseFreq * ratio[1],
        phase: Math.random() * Math.PI * 2,
        amp: 0.3 + Math.random() * 0.15,
        decay: 0.0003 + Math.random() * 0.0005,
      },
      {
        freq: baseFreq * (ratio[1] + 0.002 * (Math.random() - 0.5)),
        phase: Math.random() * Math.PI * 2,
        amp: 0.05 + Math.random() * 0.1,
        decay: 0.0004 + Math.random() * 0.0004,
      },
    ]

    traceTime = 0
    hue = Math.random() * 360
    ghostCaptured = false

    // Clear canvas with fade
    if (ctx && canvas) {
      ctx.fillStyle = 'rgba(3, 2, 8, 1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    // Update audio frequencies
    updateAudioFromPendulums(true)
  }

  function getPosition(t: number): [number, number] {
    let x = 0
    let y = 0

    // X = sum of first two pendulums + cursor perturbation
    x += pendulums[0].amp * Math.sin(pendulums[0].freq * t + pendulums[0].phase) * Math.exp(-pendulums[0].decay * t)
    x += pendulums[1].amp * Math.sin(pendulums[1].freq * t + pendulums[1].phase) * Math.exp(-pendulums[1].decay * t)
    // Y = sum of last two pendulums + cursor perturbation
    y += pendulums[2].amp * Math.sin(pendulums[2].freq * t + pendulums[2].phase) * Math.exp(-pendulums[2].decay * t)
    y += pendulums[3].amp * Math.sin(pendulums[3].freq * t + pendulums[3].phase) * Math.exp(-pendulums[3].decay * t)

    // Cursor-as-force: gentle perturbation based on mouse position
    const totalAmp = pendulums.reduce((sum, p) => sum + p.amp * Math.exp(-p.decay * t), 0)
    const forceFactor = 0.02 * totalAmp
    x += cursorX * forceFactor
    y += cursorY * forceFactor

    return [x, y]
  }

  // --- Nav Bob Helpers ---

  /** Get the anchor position for a nav bob (center of the edge it lives on) */
  function getBobAnchor(bob: NavBob, w: number, h: number): [number, number] {
    switch (bob.edge) {
      case 'N': return [w / 2, 36]
      case 'S': return [w / 2, h - 36]
      case 'W': return [36, h / 2]
      case 'E': return [w - 36, h / 2]
    }
  }

  /** Get the current bob position including swing offset */
  function getBobPosition(bob: NavBob, w: number, h: number): [number, number] {
    const [ax, ay] = getBobAnchor(bob, w, h)
    // N/S bobs swing horizontally, E/W bobs swing vertically
    if (bob.edge === 'N' || bob.edge === 'S') {
      return [ax + bob.swingAngle, ay]
    } else {
      return [ax, ay + bob.swingAngle]
    }
  }

  /** Update nav bob physics for one frame */
  function updateNavBobs(dt: number) {
    for (const bob of navBobs) {
      // Simple harmonic motion with damping toward baseAmplitude
      // Each bob has a slightly different natural frequency for variety
      const freq = bob.edge === 'N' ? 1.8 : bob.edge === 'S' ? 1.5 : bob.edge === 'W' ? 1.3 : 2.0
      bob.swingVel += -freq * freq * bob.swingAngle * dt
      bob.swingVel *= 0.995 // light damping
      bob.swingAngle += bob.swingVel * dt * 60

      // If amplitude is decaying back toward base, do so gently
      if (!bob.triggered && bob.amplitude > bob.baseAmplitude + 1) {
        bob.amplitude += (bob.baseAmplitude - bob.amplitude) * 0.02
      }

      // Keep swing energy near target amplitude
      const energy = Math.sqrt(bob.swingAngle * bob.swingAngle + (bob.swingVel / freq) * (bob.swingVel / freq))
      if (energy < bob.amplitude * 0.3 && !bob.triggered) {
        // Inject a tiny kick to keep it alive
        bob.swingVel += (Math.random() - 0.5) * bob.amplitude * 0.3
      }

      // Show label when amplitude is high
      bob.showLabel = bob.amplitude > bob.baseAmplitude + 8 || bob.triggered

      // Check trigger threshold
      if (!bob.triggered && bob.amplitude >= NAV_TRIGGER_AMPLITUDE) {
        bob.triggered = true
        bob.triggerTime = time
        bob.rings = []
      }

      // Update rings
      if (bob.triggered) {
        const elapsed = time - bob.triggerTime
        // Spawn rings at intervals
        const ringInterval = 0.3
        const expectedRings = Math.min(NAV_RING_COUNT, Math.floor(elapsed / ringInterval) + 1)
        while (bob.rings.length < expectedRings) {
          bob.rings.push({ r: 0, alpha: 0.6 })
        }
        // Expand rings
        for (const ring of bob.rings) {
          ring.r += NAV_RING_SPEED * dt
          ring.alpha = Math.max(0, 0.6 - ring.r * 0.006)
        }
        // Navigate after all rings have expanded enough
        if (bob.rings.length >= NAV_RING_COUNT && bob.rings[NAV_RING_COUNT - 1].r > 30) {
          if (deps?.switchTo) {
            deps.switchTo(bob.room)
          }
          // Reset bob state
          bob.triggered = false
          bob.amplitude = bob.baseAmplitude
          bob.rings = []
        }
      }
    }
  }

  /** Draw all nav bobs */
  function drawNavBobs(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const cx = w / 2
    const cy = h / 2

    for (const bob of navBobs) {
      const [bx, by] = getBobPosition(bob, w, h)
      const [ax, ay] = getBobAnchor(bob, w, h)

      // Arm: thin line from near center to the bob
      // Arm origin is partway from center toward the bob's edge
      const armOriginX = cx + (ax - cx) * 0.15
      const armOriginY = cy + (ay - cy) * 0.15

      const glowIntensity = Math.min(1, (bob.amplitude - bob.baseAmplitude) / (NAV_TRIGGER_AMPLITUDE - bob.baseAmplitude))
      const armAlpha = 0.06 + glowIntensity * 0.15

      ctx.strokeStyle = `hsla(${bob.hue}, 40%, 55%, ${armAlpha})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(armOriginX, armOriginY)
      ctx.lineTo(bx, by)
      ctx.stroke()

      // Bob glow (grows with amplitude)
      const glowRadius = NAV_BOB_RADIUS + glowIntensity * 12
      const glow = ctx.createRadialGradient(bx, by, 0, bx, by, glowRadius)
      glow.addColorStop(0, `hsla(${bob.hue}, 60%, 75%, ${0.15 + glowIntensity * 0.5})`)
      glow.addColorStop(0.5, `hsla(${bob.hue}, 50%, 60%, ${0.05 + glowIntensity * 0.2})`)
      glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(bx, by, glowRadius, 0, Math.PI * 2)
      ctx.fill()

      // Bob core
      const coreAlpha = 0.3 + glowIntensity * 0.5
      ctx.fillStyle = `hsla(${bob.hue}, 55%, 70%, ${coreAlpha})`
      ctx.beginPath()
      ctx.arc(bx, by, NAV_BOB_RADIUS, 0, Math.PI * 2)
      ctx.fill()

      // Inner highlight
      ctx.fillStyle = `hsla(${bob.hue}, 40%, 85%, ${coreAlpha * 0.6})`
      ctx.beginPath()
      ctx.arc(bx - 2, by - 2, NAV_BOB_RADIUS * 0.4, 0, Math.PI * 2)
      ctx.fill()

      // Resonance rings
      for (const ring of bob.rings) {
        if (ring.alpha <= 0) continue
        ctx.strokeStyle = `hsla(${bob.hue}, 50%, 65%, ${ring.alpha})`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(bx, by, ring.r, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Label (visible when swinging wide or triggered)
      if (bob.showLabel) {
        const labelAlpha = Math.min(0.5, glowIntensity * 0.5 + (bob.triggered ? 0.4 : 0))
        ctx.font = '12px "Cormorant Garamond", serif'
        ctx.fillStyle = `hsla(${bob.hue}, 30%, 70%, ${labelAlpha})`
        ctx.textAlign = 'center'
        const labelOffY = bob.edge === 'S' ? 20 : bob.edge === 'N' ? -16 : 0
        const labelOffX = bob.edge === 'E' ? 20 : bob.edge === 'W' ? -20 : 0
        const labelX = bx + labelOffX
        const labelY = by + labelOffY
        if (bob.edge === 'W' || bob.edge === 'E') {
          ctx.textAlign = bob.edge === 'W' ? 'right' : 'left'
        }
        ctx.fillText(bob.label, labelX, labelY)
      }
    }
  }

  /** Find which nav bob (if any) is near the given screen coordinates */
  function findNearestBob(sx: number, sy: number, w: number, h: number): NavBob | null {
    let closest: NavBob | null = null
    let closestDist = Infinity
    for (const bob of navBobs) {
      const [bx, by] = getBobPosition(bob, w, h)
      const dx = sx - bx
      const dy = sy - by
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 40 && dist < closestDist) {
        closest = bob
        closestDist = dist
      }
    }
    return closest
  }

  /** Excite a bob — increase its swing amplitude */
  function exciteBob(bob: NavBob, amount: number) {
    if (bob.triggered) return
    bob.amplitude = Math.min(NAV_TRIGGER_AMPLITUDE + 5, bob.amplitude + amount)
    // Add velocity kick in current swing direction
    const dir = bob.swingAngle >= 0 ? 1 : -1
    bob.swingVel += dir * amount * 0.5
  }

  // --- Phase-based trail color ---
  // Returns an HSL hue based on the phase relationship between X and Y pendulums.
  // In-phase (similar phase) -> warm (gold/amber, hue ~40-50)
  // Out-of-phase (opposite phase) -> cool (blue/violet, hue ~240-280)
  function getPhaseHue(t: number): number {
    if (pendulums.length < 4) return hue
    // Compare instantaneous phases of X pendulum 0 and Y pendulum 2
    const phaseX = (pendulums[0].freq * t + pendulums[0].phase) % (Math.PI * 2)
    const phaseY = (pendulums[2].freq * t + pendulums[2].phase) % (Math.PI * 2)
    // Phase difference normalized to 0..1 (0 = in-phase, 0.5 = opposite)
    let phaseDiff = Math.abs(phaseX - phaseY) % (Math.PI * 2)
    if (phaseDiff > Math.PI) phaseDiff = Math.PI * 2 - phaseDiff
    const normalized = phaseDiff / Math.PI // 0 = in-phase, 1 = out-of-phase
    // Smooth interpolation: warm (45) -> cool (260)
    return 45 + normalized * 215
  }

  // --- Pattern classification ---
  function classifyPattern(ratio: [number, number]): string {
    const [a, b] = ratio
    if (a === b) return `lissajous ${a}:${b} \u00b7 circle`
    const gcd = (x: number, y: number): number => y === 0 ? x : gcd(y, x % y)
    const g = gcd(a, b)
    const ra = a / g
    const rb = b / g
    if (ra + rb <= 4) return `lissajous ${ra}:${rb}`
    if (ra + rb <= 7) return `spirograph ${ra}:${rb}`
    return `decaying harmonic ${ra}:${rb}`
  }

  // --- Cursor magnetic field ---
  // Returns a displacement [dx, dy] that bends a trace point toward the cursor.
  // Only affects points within a radius. Very subtle.
  function magneticPull(screenX: number, screenY: number): [number, number] {
    const dx = cursorScreenX - screenX
    const dy = cursorScreenY - screenY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const radius = 120 // pixels within which magnetic field acts
    if (dist > radius || dist < 1) return [0, 0]
    // Inverse-linear falloff, very subtle strength
    const strength = 0.15 * (1 - dist / radius)
    return [dx * strength, dy * strength]
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height
    const cx = w / 2
    const cy = h / 2
    const scale = Math.min(w, h) * 0.9

    // Draw ghost layer (afterimage of previous pattern) if present
    if (ghostCanvas && ghostAlpha > 0.001) {
      ctx.globalAlpha = ghostAlpha
      ctx.drawImage(ghostCanvas, 0, 0)
      ctx.globalAlpha = 1.0
      // Fade ghost layer gradually
      ghostAlpha *= 0.997
      if (ghostAlpha < 0.001) ghostAlpha = 0
    }

    // Very gentle fade — creates persistence effect
    ctx.fillStyle = `rgba(3, 2, 8, ${fadeSpeed})`
    ctx.fillRect(0, 0, w, h)

    if (pendulums.length === 0) return

    // Update audio decay envelope
    updateAudioDecay()

    // Draw many points per frame for smooth trace
    const stepsPerFrame = 40
    const dt = 0.15

    let lastScreenX = 0
    let lastScreenY = 0

    for (let i = 0; i < stepsPerFrame; i++) {
      traceTime += dt
      const [x, y] = getPosition(traceTime)

      // Check if pendulums have decayed to near-zero
      const totalAmp = pendulums.reduce((sum, p) =>
        sum + p.amp * Math.exp(-p.decay * traceTime), 0)

      if (totalAmp < 0.01) {
        // Capture ghost trace before clearing (only once per pattern)
        if (!ghostCaptured && canvas && ctx) {
          if (!ghostCanvas) {
            ghostCanvas = document.createElement('canvas')
            ghostCtx = ghostCanvas.getContext('2d')
          }
          ghostCanvas.width = canvas.width
          ghostCanvas.height = canvas.height
          ghostCtx?.drawImage(canvas, 0, 0)
          ghostAlpha = 0.08 // start very faint
          ghostCaptured = true

          // Save to pattern gallery (small thumbnail)
          const thumbSize = 64
          const thumbCanvas = document.createElement('canvas')
          thumbCanvas.width = thumbSize
          thumbCanvas.height = thumbSize
          const thumbCtx = thumbCanvas.getContext('2d')
          if (thumbCtx) {
            thumbCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, thumbSize, thumbSize)
            const imgData = thumbCtx.getImageData(0, 0, thumbSize, thumbSize)
            const label = classifyPattern(lastFreqRatio)
            patternGallery.push({
              imageData: imgData,
              ratio: [...lastFreqRatio] as [number, number],
              label,
              hue,
            })
            if (patternGallery.length > MAX_GALLERY) patternGallery.shift()
          }
          patternsCreated++

          // Check for golden ratio resonance
          for (const [ga, gb] of GOLDEN_RATIOS) {
            if (lastFreqRatio[0] === ga && lastFreqRatio[1] === gb) {
              resonanceFlash = 1.0
              resonanceLabel = ga === gb ? 'unison — perfect circle' :
                `${ga}:${gb} — ${ga === 5 && gb === 8 ? 'golden section' : 'harmonic resonance'}`
              break
            }
          }

          // Show pattern catalog label
          catalogLabel = classifyPattern(lastFreqRatio)
          catalogAlpha = 0.5
          catalogFadeStart = time
        }

        // Pendulums have died — randomize new ones after a pause
        if (traceTime > 500) randomize()
        continue
      }

      let screenX = cx + x * scale
      let screenY = cy + y * scale

      // Cursor magnetic field: bend nearby trace toward cursor
      const [mx, my] = magneticPull(screenX, screenY)
      screenX += mx
      screenY += my

      // Phase-based trail color (warm in-phase, cool out-of-phase)
      const traceHue = getPhaseHue(traceTime)
      // Saturation increases slightly when more in-phase (warmer)
      const saturation = traceHue < 150 ? 60 : 45

      // Decay visualization: alpha and size decrease with amplitude
      const decayFactor = Math.min(1, totalAmp * 2.5) // 1 at full, -> 0 at decay
      const alpha = Math.min(0.6, totalAmp * 1.5) * decayFactor
      // Trail width thins with decay (1.2 at full -> 0.4 near end)
      const trailRadius = 0.4 + 0.8 * decayFactor

      ctx.fillStyle = `hsla(${traceHue}, ${saturation}%, 60%, ${alpha})`
      ctx.beginPath()
      ctx.arc(screenX, screenY, trailRadius, 0, Math.PI * 2)
      ctx.fill()

      lastScreenX = screenX
      lastScreenY = screenY

      // Larger glow point + pendulum arm for the current tip
      if (i === stepsPerFrame - 1) {
        // Pendulum arm: faint line from center to current point
        ctx.strokeStyle = `hsla(${traceHue}, 30%, 50%, ${alpha * 0.08})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(screenX, screenY)
        ctx.stroke()

        // Shadow of the arm (slightly offset)
        ctx.strokeStyle = `hsla(${traceHue}, 20%, 40%, ${alpha * 0.04})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(cx + 3, cy + 3)
        ctx.lineTo(screenX + 3, screenY + 3)
        ctx.stroke()

        // Enhanced glow at the tip (larger radius, scales with decay)
        const glowSize = 8 + 6 * decayFactor
        const glow = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, glowSize)
        glow.addColorStop(0, `hsla(${traceHue}, 70%, 80%, ${alpha * 0.6})`)
        glow.addColorStop(0.4, `hsla(${traceHue}, 60%, 70%, ${alpha * 0.25})`)
        glow.addColorStop(1, 'transparent')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(screenX, screenY, glowSize, 0, Math.PI * 2)
        ctx.fill()

        // Bright core dot (shrinks with decay)
        const coreSize = 1 + 1 * decayFactor
        ctx.fillStyle = `hsla(${traceHue}, 60%, 85%, ${alpha * 0.8})`
        ctx.beginPath()
        ctx.arc(screenX, screenY, coreSize, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Small pivot dot at center
    ctx.fillStyle = 'rgba(180, 160, 200, 0.06)'
    ctx.beginPath()
    ctx.arc(cx, cy, 2, 0, Math.PI * 2)
    ctx.fill()

    // Pattern catalog label (appears when pattern fully decays, fades over 2s)
    if (catalogAlpha > 0.01) {
      const elapsed = time - catalogFadeStart
      if (elapsed > 2.0) {
        // Fade out over 1 second after the 2s display
        catalogAlpha = Math.max(0, 0.5 * (1 - (elapsed - 2.0)))
      }
      if (catalogAlpha > 0.01) {
        ctx.save()
        ctx.font = '14px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(200, 180, 220, ${catalogAlpha * 0.6})`
        ctx.textAlign = 'center'
        ctx.fillText(catalogLabel, cx, cy + 30)
        ctx.restore()
      }
    }

    // If dragging, show a pull line from cursor to the trace point
    if (isDragging && lastScreenX && lastScreenY) {
      const dragX = (cursorX * 0.5 + 0.5) * w
      const dragY = (cursorY * 0.5 + 0.5) * h
      ctx.strokeStyle = 'rgba(180, 160, 200, 0.1)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 6])
      ctx.beginPath()
      ctx.moveTo(dragX, dragY)
      ctx.lineTo(lastScreenX, lastScreenY)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Pendulum info (very subtle)
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(180, 160, 200, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the pendulum', w / 2, 25)

    // Frequency ratio display
    if (pendulums.length >= 4) {
      ctx.font = '12px monospace'
      ctx.fillStyle = 'rgba(180, 160, 200, 0.06)'
      ctx.textAlign = 'left'
      const r1 = pendulums[0].freq.toFixed(2)
      const r2 = pendulums[2].freq.toFixed(2)
      ctx.fillText(`x: ${r1}Hz \u00b7 y: ${r2}Hz`, 12, h - 30)
      ctx.fillText(`decay: ${(fadeSpeed * 1000).toFixed(1)}`, 12, h - 18)

      ctx.textAlign = 'right'
      ctx.fillText('drag to pull \u00b7 shift+click to reshape', w - 12, h - 30)
      ctx.fillText('scroll to adjust decay', w - 12, h - 18)
    }

    // Navigation pendulum bobs — update physics and draw
    if (deps?.switchTo) {
      updateNavBobs(0.016)

      // Proximity excitation: if cursor is near an edge, excite the bob there
      const mouseScreenX = (cursorX * 0.5 + 0.5) * w
      const mouseScreenY = (cursorY * 0.5 + 0.5) * h
      for (const bob of navBobs) {
        const [bx, by] = getBobPosition(bob, w, h)
        const dx = mouseScreenX - bx
        const dy = mouseScreenY - by
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 60) {
          exciteBob(bob, (60 - dist) * 0.008)
        }
      }

      drawNavBobs(ctx, w, h)
    }

    // Hint
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(180, 160, 200, 0.04)'
    ctx.textAlign = 'center'
    ctx.fillText('each pattern is temporary. you cannot save them.', w / 2, h - 8)

    // Cultural inscriptions
    inscriptionTimer += 0.016
    if (inscriptionTimer >= 22) {
      inscriptionTimer = 0
      inscriptionIdx = (inscriptionIdx + 1) % CULTURAL_INSCRIPTIONS.length
    }
    const insText = CULTURAL_INSCRIPTIONS[inscriptionIdx]
    ctx.font = '11px "Cormorant Garamond", serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(180, 160, 200, 0.03)'
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

    // === RESONANCE FLASH ===
    if (resonanceFlash > 0.01) {
      // Golden ring expanding from center
      const ringR = (1 - resonanceFlash) * Math.min(w, h) * 0.5
      const ringAlpha = resonanceFlash * 0.3
      ctx.strokeStyle = `hsla(45, 70%, 70%, ${ringAlpha})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
      ctx.stroke()
      // Label
      ctx.font = '14px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(255, 215, 0, ${resonanceFlash * 0.5})`
      ctx.textAlign = 'center'
      ctx.fillText(resonanceLabel, cx, cy + 50)
      resonanceFlash *= 0.985
    }

    // === PATTERN GALLERY (top-left thumbnails) ===
    if (patternGallery.length > 0) {
      const thumbSize = 48
      const pad = 6
      const startX = 12
      const startY = 40

      for (let gi = 0; gi < patternGallery.length; gi++) {
        const entry = patternGallery[gi]
        const gx = startX
        const gy = startY + gi * (thumbSize + pad)

        // Draw thumbnail
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = 64
        tempCanvas.height = 64
        const tempCtx = tempCanvas.getContext('2d')
        if (tempCtx) {
          tempCtx.putImageData(entry.imageData, 0, 0)
          ctx.globalAlpha = 0.15
          ctx.drawImage(tempCanvas, gx, gy, thumbSize, thumbSize)
          ctx.globalAlpha = 1.0
        }

        // Border
        ctx.strokeStyle = `hsla(${entry.hue}, 30%, 50%, 0.06)`
        ctx.lineWidth = 0.5
        ctx.strokeRect(gx, gy, thumbSize, thumbSize)

        // Label
        ctx.font = '8px monospace'
        ctx.fillStyle = `hsla(${entry.hue}, 30%, 60%, 0.08)`
        ctx.textAlign = 'left'
        ctx.fillText(entry.label, gx, gy + thumbSize + 8)
      }

      // Pattern count
      ctx.font = '10px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(180, 160, 200, 0.05)'
      ctx.textAlign = 'left'
      ctx.fillText(`${patternsCreated} patterns created`, startX, startY - 8)
    }
  }

  return {
    name: 'pendulum',
    label: 'the pendulum',

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
      canvas.style.cssText = 'width: 100%; height: 100%; cursor: crosshair;'
      ctx = canvas.getContext('2d')

      // Mousedown: start drag (or shift+click to randomize, or click nav bob)
      canvas.addEventListener('mousedown', (e) => {
        // Check nav bobs first — clicking near a bob excites it strongly
        if (deps?.switchTo && canvas) {
          const nearBob = findNearestBob(e.clientX, e.clientY, canvas.width, canvas.height)
          if (nearBob) {
            exciteBob(nearBob, 15)
            return
          }
        }

        if (e.shiftKey) {
          randomize()
          return
        }

        // Start drag-to-pull
        isDragging = true

        if (canvas) {
          // Set pendulum amplitudes and phases from cursor position
          const nx = (e.clientX / canvas.width - 0.5) * 2
          const ny = (e.clientY / canvas.height - 0.5) * 2
          const dist = Math.sqrt(nx * nx + ny * ny)

          // Reset trace and set new initial conditions based on pull position
          traceTime = 0
          if (ctx && canvas) {
            ctx.fillStyle = 'rgba(3, 2, 8, 1)'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
          }

          // Adjust amplitudes based on drag position
          for (let i = 0; i < 2; i++) {
            if (pendulums[i]) {
              pendulums[i].amp = Math.abs(nx) * 0.3 + 0.05
              pendulums[i].phase = Math.atan2(ny, nx) + i * 0.5
            }
          }
          for (let i = 2; i < 4; i++) {
            if (pendulums[i]) {
              pendulums[i].amp = Math.abs(ny) * 0.3 + 0.05
              pendulums[i].phase = Math.atan2(nx, ny) + (i - 2) * 0.5
            }
          }

          // Bigger pull = bigger amplitude
          if (pendulums[0]) pendulums[0].amp = Math.max(pendulums[0].amp, dist * 0.25)
          if (pendulums[2]) pendulums[2].amp = Math.max(pendulums[2].amp, dist * 0.25)

          updateAudioFromPendulums(true)
        }
      })

      canvas.addEventListener('mouseup', () => {
        isDragging = false
      })

      canvas.addEventListener('mouseleave', () => {
        isDragging = false
        cursorX = 0
        cursorY = 0
      })

      // Mousemove: update cursor for perturbation + drag + magnetic field
      canvas.addEventListener('mousemove', (e) => {
        if (!canvas) return

        // Normalized -1..1 from center
        cursorX = (e.clientX / canvas.width - 0.5) * 2
        cursorY = (e.clientY / canvas.height - 0.5) * 2
        // Screen coordinates for magnetic field
        cursorScreenX = e.clientX
        cursorScreenY = e.clientY

        // Drag: continuously adjust pendulum parameters
        if (isDragging && pendulums.length >= 4) {
          // Springy: adjust amplitudes toward cursor position
          pendulums[0].amp += (Math.abs(cursorX) * 0.3 - pendulums[0].amp) * 0.05
          pendulums[2].amp += (Math.abs(cursorY) * 0.3 - pendulums[2].amp) * 0.05
          // Adjust phase slightly based on movement
          pendulums[0].phase += cursorX * 0.01
          pendulums[2].phase += cursorY * 0.01

          // Keep amplitudes bounded
          for (const p of pendulums) {
            p.amp = Math.max(0.02, Math.min(0.5, p.amp))
          }
        }

        // Nav bob hover: show label when cursor is near a bob
        if (deps?.switchTo) {
          for (const bob of navBobs) {
            const [bx, by] = getBobPosition(bob, canvas.width, canvas.height)
            const dx = e.clientX - bx
            const dy = e.clientY - by
            const dist = Math.sqrt(dx * dx + dy * dy)
            bob.showLabel = bob.showLabel || dist < 40
          }
        }
      })

      // Scroll to adjust fade speed (decay visibility)
      canvas.addEventListener('wheel', (e) => {
        fadeSpeed = Math.max(0.0005, Math.min(0.02, fadeSpeed + (e.deltaY > 0 ? 0.001 : -0.001)))
        e.preventDefault()
      }, { passive: false })

      const onResize = () => {
        if (canvas && ctx) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
          ctx.fillStyle = 'rgba(3, 2, 8, 1)'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)
      return overlay
    },

    activate() {
      active = true
      randomize()
      render()
      initAudio().then(() => {
        if (active) {
          updateAudioFromPendulums(false)
          fadeAudioIn()
        }
      })
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      fadeAudioOut()
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      destroyAudio()
      ghostCanvas = null
      ghostCtx = null
      overlay?.remove()
    },
  }
}
