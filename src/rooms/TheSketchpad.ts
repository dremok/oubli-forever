/**
 * THE SKETCHPAD — draw in the dark
 *
 * A minimal drawing tool. Click and drag to draw with light.
 * The ink slowly fades. You can change hue with scroll wheel.
 * Double-click to clear.
 *
 * Drawings are impermanent — they dissolve over time.
 * You can't save, can't undo, can't export.
 * The only record is in your memory.
 *
 * This is the first functional/utility room in Oubli:
 * a tool that happens to exist inside an art piece.
 *
 * Inspired by: zen brushwork, blackboard, etch-a-sketch,
 * Harold and the Purple Crayon, cave paintings (the first art
 * was drawn in darkness), light painting photography
 */

import type { Room } from './RoomManager'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface Stroke {
  points: { x: number; y: number }[]
  hue: number
  width: number
  birth: number
  mirrored?: boolean
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  hue: number
  birth: number
  life: number // total lifespan in seconds
  size: number
}

interface SketchpadDeps {
  switchTo?: (name: string) => void
}

const CULTURAL_INSCRIPTIONS = [
  'anti-AI movement: 45% of creative directors now reject AI images. guaranteed human premium.',
  'cy twombly drew in the dark during army service. scribbles became high art.',
  'the etch-a-sketch was invented in 1960. shake to erase. no undo, no layers.',
  'wabi-sabi TikTok 2026: imperfection as beauty, decay as aesthetic, the sketch over the painting.',
  'agnes martin drew pencil grids on canvas for forty years. trembling lines. the hand is honest.',
  'basquiat covered his paintings with words then crossed them out. erasure as emphasis.',
  'cave paintings at lascaux: 17,000 years of drawings that were never meant to last.',
  'henri matisse: "drawing is like making an expressive gesture with the advantage of permanence." but here, no permanence.',
  'cmu research (2026): AI-composed music uses fewer notes, is judged less creative. the human hand is irreplaceable.',
  'shiota\'s red threads at hayward gallery: drawing in space. every line connects two memories.',
  '"i got rhythm" entered the public domain in 2026. even gershwin\'s lines are dissolving into commons.',
  'korg phase8 (2026): touch a steel resonator and it sings. every surface is a potential instrument — or canvas.',
  'suno generates 7 million songs per day. what is a line worth when lines are infinite?',
  'the 365 buttons TikTok: "it only has to make sense to me." drawing as private language.',
  'lucian freud drew the same faces 170 times. obsessive re-drawing. the hand remembers what the eye forgets.',
  'genuary 2026 prompt: intentional imperfection. the algorithm trembles. the human line breathes.',
]

export function createSketchpadRoom(deps: SketchpadDeps = {}): Room {
  let inscriptionTimer = 0
  let inscriptionIdx = 0
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let strokes: Stroke[] = []
  let currentStroke: Stroke | null = null
  let mirrorStroke: Stroke | null = null
  let drawHue = 330 // start with Oubli pink
  let brushWidth = 2
  let drawing = false
  let totalStrokes = 0

  // Sigil navigation system — draw symbols to navigate
  interface SigilTemplate {
    room: string
    label: string
    // Path as normalized points (0-1 range), will be scaled to screen
    path: { x: number; y: number }[]
    glow: number // current glow intensity (0-1)
    matchProgress: number // how close current stroke is to matching (0-1)
    flash: number // flash animation timer (0 = no flash)
  }

  const sigils: SigilTemplate[] = [
    {
      room: 'darkroom',
      label: 'darkroom',
      // Circle (lens aperture)
      path: (() => {
        const pts: { x: number; y: number }[] = []
        for (let i = 0; i <= 32; i++) {
          const a = (i / 32) * Math.PI * 2
          pts.push({ x: 0.5 + Math.cos(a) * 0.4, y: 0.5 + Math.sin(a) * 0.4 })
        }
        return pts
      })(),
      glow: 0,
      matchProgress: 0,
      flash: 0,
    },
    {
      room: 'pendulum',
      label: 'pendulum',
      // Figure-8 / infinity sign (harmonograph trace)
      path: (() => {
        const pts: { x: number; y: number }[] = []
        for (let i = 0; i <= 48; i++) {
          const t = (i / 48) * Math.PI * 2
          pts.push({
            x: 0.5 + Math.sin(t) * 0.4,
            y: 0.5 + Math.sin(t * 2) * 0.3,
          })
        }
        return pts
      })(),
      glow: 0,
      matchProgress: 0,
      flash: 0,
    },
    {
      room: 'loom',
      label: 'loom',
      // Zigzag / weave pattern (warp/weft)
      path: (() => {
        const pts: { x: number; y: number }[] = []
        const segments = 6
        for (let i = 0; i <= segments; i++) {
          const t = i / segments
          pts.push({
            x: 0.1 + t * 0.8,
            y: i % 2 === 0 ? 0.2 : 0.8,
          })
        }
        return pts
      })(),
      glow: 0,
      matchProgress: 0,
      flash: 0,
    },
  ]

  const SIGIL_SIZE = 70 // pixel size of each sigil template area
  const SIGIL_Y_OFFSET = 90 // pixels from bottom of screen
  let pendingNav: string | null = null
  let pendingNavTimer = 0

  function getSigilScreenPositions(w: number, h: number): { cx: number; cy: number }[] {
    const spacing = 140
    const totalWidth = (sigils.length - 1) * spacing
    const startX = w / 2 - totalWidth / 2
    const cy = h - SIGIL_Y_OFFSET
    return sigils.map((_, i) => ({ cx: startX + i * spacing, cy }))
  }

  function sigilPathToScreen(path: { x: number; y: number }[], cx: number, cy: number): { x: number; y: number }[] {
    return path.map(p => ({
      x: cx + (p.x - 0.5) * SIGIL_SIZE,
      y: cy + (p.y - 0.5) * SIGIL_SIZE,
    }))
  }

  function matchStrokeToSigil(strokePoints: { x: number; y: number }[], sigilScreenPath: { x: number; y: number }[], cx: number, cy: number): number {
    if (strokePoints.length < 5) return 0

    // Check if the stroke is even near the sigil area
    const strokeBounds = {
      minX: Infinity, maxX: -Infinity,
      minY: Infinity, maxY: -Infinity,
    }
    for (const p of strokePoints) {
      strokeBounds.minX = Math.min(strokeBounds.minX, p.x)
      strokeBounds.maxX = Math.max(strokeBounds.maxX, p.x)
      strokeBounds.minY = Math.min(strokeBounds.minY, p.y)
      strokeBounds.maxY = Math.max(strokeBounds.maxY, p.y)
    }
    const strokeCx = (strokeBounds.minX + strokeBounds.maxX) / 2
    const strokeCy = (strokeBounds.minY + strokeBounds.maxY) / 2

    // Must be within generous range of the sigil center
    const distToCenter = Math.sqrt((strokeCx - cx) ** 2 + (strokeCy - cy) ** 2)
    if (distToCenter > SIGIL_SIZE * 1.5) return 0

    // For each point on the sigil path, find the minimum distance to any stroke point
    let totalMinDist = 0
    const tolerance = SIGIL_SIZE * 0.5 // generous tolerance
    let closePoints = 0

    for (const sp of sigilScreenPath) {
      let minDist = Infinity
      for (const tp of strokePoints) {
        const d = Math.sqrt((sp.x - tp.x) ** 2 + (sp.y - tp.y) ** 2)
        if (d < minDist) minDist = d
      }
      totalMinDist += minDist
      if (minDist < tolerance) closePoints++
    }

    const coverage = closePoints / sigilScreenPath.length
    const avgDist = totalMinDist / sigilScreenPath.length
    const distScore = Math.max(0, 1 - avgDist / (SIGIL_SIZE * 0.8))

    // Combined score: coverage matters most, distance refines it
    return coverage * 0.6 + distScore * 0.4
  }

  function checkSigilMatch(strokePoints: { x: number; y: number }[]) {
    if (!canvas || !deps.switchTo) return
    const positions = getSigilScreenPositions(canvas.width, canvas.height)
    for (let i = 0; i < sigils.length; i++) {
      const pos = positions[i]
      const screenPath = sigilPathToScreen(sigils[i].path, pos.cx, pos.cy)
      const score = matchStrokeToSigil(strokePoints, screenPath, pos.cx, pos.cy)
      sigils[i].matchProgress = score
      if (score > 0.45) {
        // Trigger navigation with flash
        sigils[i].flash = 1.0
        pendingNav = sigils[i].room
        pendingNavTimer = 0.6 // seconds of flash before nav
      }
    }
  }

  // Symmetry mode
  let symmetryMode = false

  // Particle system
  let particles: Particle[] = []
  const MAX_PARTICLES = 100

  // Speed tracking for pressure simulation and audio
  let lastMoveTime = 0
  let currentSpeed = 0

  // Drawing activity tracking for particle response
  let lastDrawX = 0
  let lastDrawY = 0
  let drawingActivity = 0 // 0-1, decays when idle
  let idleParticleTimer = 0

  // Audio state
  let audioInitialized = false
  let audioCtx: AudioContext | null = null
  let oscillator: OscillatorNode | null = null
  let oscGain: GainNode | null = null
  let reverbNode: ConvolverNode | null = null
  let reverbGain: GainNode | null = null
  let dryGain: GainNode | null = null
  let delayNode: DelayNode | null = null
  let delayFeedback: GainNode | null = null
  let delayWet: GainNode | null = null

  // Background breathing
  let breathPhase = 0

  // Drawing mode: 'solid' | 'spray' | 'dots'
  let drawMode: 'solid' | 'spray' | 'dots' = 'solid'

  // Gravity drip system — ink runs downward from strokes
  let gravityMode = false
  interface Drip {
    x: number
    y: number
    vy: number
    hue: number
    size: number
    alpha: number
  }
  const drips: Drip[] = []
  const MAX_DRIPS = 200

  // Auto-sketch system — the room draws its own ghost lines after idle
  let autoSketchIdle = 0
  let autoSketchActive = false
  let autoSketchPhase = 0
  let autoSketchStroke: Stroke | null = null
  const autoSketchHistory: { x: number; y: number; hue: number }[] = [] // sampled from user strokes

  // Constellation system — endpoints of fading strokes connect with golden threads
  interface ConstellationLink {
    x1: number; y1: number
    x2: number; y2: number
    alpha: number
    birth: number
  }
  const constellationLinks: ConstellationLink[] = []
  let constellationTimer = 0

  // Evaporation wisps — tiny particles rising from aging strokes
  interface EvapWisp {
    x: number; y: number; vx: number; vy: number; alpha: number; size: number; hue: number
  }
  const evapWisps: EvapWisp[] = []
  let evapSpawnTimer = 0

  // Stroke echo replay — ghost strokes briefly re-trace themselves
  interface StrokeEcho {
    points: { x: number; y: number }[]
    hue: number
    width: number
    replayProgress: number // 0-1 how far through the replay
    alpha: number
  }
  const strokeEchoes: StrokeEcho[] = []
  const echoedStrokes = new Set<Stroke>() // track which strokes have already echoed

  const FADE_TIME = 60 // seconds before stroke fully fades
  const GHOST_EXTRA = 45 // extra seconds ghosts linger after stroke fades (30-60s range)

  // Bloom state — tracks which strokes have bloomed
  const bloomedStrokes = new Set<Stroke>()
  const BLOOM_DELAY = 0.7 // seconds after stroke ends before bloom starts
  const BLOOM_DURATION = 0.5 // seconds the bloom animation takes
  const BLOOM_EXPAND = 1.5 // pixels to expand outward

  // --- Audio setup ---
  async function initAudio() {
    if (audioInitialized) return
    try {
      audioCtx = await getAudioContext()
      const dest = getAudioDestination()

      // Oscillator -> oscGain -> [dry + reverb + delay] -> dest
      oscillator = audioCtx.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.value = 400

      oscGain = audioCtx.createGain()
      oscGain.gain.value = 0 // silent until drawing

      // Dry path
      dryGain = audioCtx.createGain()
      dryGain.gain.value = 0.5

      // Reverb (impulse response from noise burst)
      reverbNode = audioCtx.createConvolver()
      const sampleRate = audioCtx.sampleRate
      const reverbLength = sampleRate * 2.5
      const impulse = audioCtx.createBuffer(2, reverbLength, sampleRate)
      for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch)
        for (let i = 0; i < reverbLength; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / reverbLength, 2.5)
        }
      }
      reverbNode.buffer = impulse

      reverbGain = audioCtx.createGain()
      reverbGain.gain.value = 0.3

      // Delay
      delayNode = audioCtx.createDelay(1.0)
      delayNode.delayTime.value = 0.35
      delayFeedback = audioCtx.createGain()
      delayFeedback.gain.value = 0.3
      delayWet = audioCtx.createGain()
      delayWet.gain.value = 0.2

      // Wire: osc -> oscGain -> dry -> dest
      oscillator.connect(oscGain)
      oscGain.connect(dryGain)
      dryGain.connect(dest)

      // Wire: oscGain -> reverb -> reverbGain -> dest
      oscGain.connect(reverbNode)
      reverbNode.connect(reverbGain)
      reverbGain.connect(dest)

      // Wire: oscGain -> delay -> delayWet -> dest, delay -> feedback -> delay
      oscGain.connect(delayNode)
      delayNode.connect(delayWet)
      delayWet.connect(dest)
      delayNode.connect(delayFeedback)
      delayFeedback.connect(delayNode)

      oscillator.start()
      audioInitialized = true
    } catch (_e) {
      // Audio not available, that's fine
    }
  }

  function updateAudio(x: number, y: number, speed: number) {
    if (!audioInitialized || !oscillator || !oscGain || !audioCtx) return
    const now = audioCtx.currentTime
    const h = canvas?.height || window.innerHeight

    // Pitch: 200Hz at bottom, 800Hz at top
    const normalizedY = 1 - Math.max(0, Math.min(1, y / h))
    const freq = 200 + normalizedY * 600
    oscillator.frequency.cancelScheduledValues(now)
    oscillator.frequency.setValueAtTime(oscillator.frequency.value, now)
    oscillator.frequency.linearRampToValueAtTime(freq, now + 0.05)

    // Volume: base 0.04, scales up slightly with speed (max ~0.09)
    const speedFactor = Math.min(1, speed / 800)
    const vol = 0.04 + speedFactor * 0.05
    oscGain.gain.cancelScheduledValues(now)
    oscGain.gain.setValueAtTime(oscGain.gain.value, now)
    oscGain.gain.linearRampToValueAtTime(vol, now + 0.03)
  }

  function fadeOutAudio() {
    if (!audioInitialized || !oscGain || !audioCtx) return
    const now = audioCtx.currentTime
    oscGain.gain.cancelScheduledValues(now)
    oscGain.gain.setValueAtTime(oscGain.gain.value, now)
    oscGain.gain.linearRampToValueAtTime(0, now + 0.3)
  }

  function teardownAudio() {
    if (oscillator) {
      try { oscillator.stop() } catch (_e) { /* already stopped */ }
      oscillator.disconnect()
      oscillator = null
    }
    if (oscGain) { oscGain.disconnect(); oscGain = null }
    if (dryGain) { dryGain.disconnect(); dryGain = null }
    if (reverbNode) { reverbNode.disconnect(); reverbNode = null }
    if (reverbGain) { reverbGain.disconnect(); reverbGain = null }
    if (delayNode) { delayNode.disconnect(); delayNode = null }
    if (delayFeedback) { delayFeedback.disconnect(); delayFeedback = null }
    if (delayWet) { delayWet.disconnect(); delayWet = null }
    audioInitialized = false
    audioCtx = null
  }

  // --- Particle system ---
  function spawnParticle(x: number, y: number, hue: number, extraVx = 0, extraVy = 0) {
    if (particles.length >= MAX_PARTICLES) {
      // Remove oldest
      particles.shift()
    }
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 0.5 + extraVx,
      vy: -(Math.random() * 0.3 + 0.15) + extraVy, // drift upward
      hue,
      birth: time,
      life: 2 + Math.random() * 2, // 2-4 second lifespan
      size: 1 + Math.random() * 1.5,
    })
  }

  function updateAndDrawParticles(c: CanvasRenderingContext2D) {
    particles = particles.filter(p => {
      const age = time - p.birth
      if (age > p.life) return false

      // Update position
      p.x += p.vx
      p.y += p.vy
      p.vy -= 0.002 // slight upward acceleration

      const alpha = Math.max(0, 1 - age / p.life) * 0.4
      const size = p.size * (1 - age / p.life * 0.5)

      c.fillStyle = `hsla(${p.hue}, 70%, 70%, ${alpha})`
      c.beginPath()
      c.arc(p.x, p.y, size, 0, Math.PI * 2)
      c.fill()

      return true
    })
  }

  // --- Brush pressure (speed-based width) ---
  function getPressureWidth(baseWidth: number, speed: number): number {
    // Faster = thinner delicate lines, slower = thicker saturated marks
    const speedNorm = Math.min(1, speed / 500)
    const factor = 1.8 - speedNorm * 1.4 // 1.8x at rest, 0.4x at max speed
    return Math.max(0.5, baseWidth * factor)
  }

  // --- Grain texture ---
  function drawGrain(c: CanvasRenderingContext2D, w: number, h: number) {
    const imageData = c.getImageData(0, 0, w, h)
    const data = imageData.data
    // Sparse grain — only touch ~5% of pixels for performance
    const step = 20
    for (let i = 0; i < data.length; i += step * 4) {
      const noise = (Math.random() - 0.5) * 8
      data[i] = Math.max(0, Math.min(255, data[i] + noise))
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise))
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise))
    }
    c.putImageData(imageData, 0, 0)
  }

  // --- Drawing a stroke path (reusable for normal + mirror) ---
  function drawStrokePath(c: CanvasRenderingContext2D, points: { x: number; y: number }[], hue: number, width: number, alpha: number, glow: boolean, glowAlpha: number) {
    if (points.length < 2) return

    c.strokeStyle = `hsla(${hue}, 60%, 60%, ${alpha})`
    c.lineWidth = width
    c.lineCap = 'round'
    c.lineJoin = 'round'

    c.beginPath()
    c.moveTo(points[0].x, points[0].y)

    for (let i = 1; i < points.length - 1; i++) {
      const curr = points[i]
      const next = points[i + 1]
      const midX = (curr.x + next.x) / 2
      const midY = (curr.y + next.y) / 2
      c.quadraticCurveTo(curr.x, curr.y, midX, midY)
    }

    const last = points[points.length - 1]
    c.lineTo(last.x, last.y)
    c.stroke()

    if (glow) {
      c.strokeStyle = `hsla(${hue}, 70%, 70%, ${glowAlpha})`
      c.lineWidth = width + 4
      c.stroke()
    }
  }

  // --- Mirror points across center ---
  function mirrorPoints(points: { x: number; y: number }[]): { x: number; y: number }[] {
    const w = canvas?.width || window.innerWidth
    return points.map(p => ({ x: w - p.x, y: p.y }))
  }

  // --- Gravity drip system ---
  function spawnDrips(stroke: Stroke) {
    if (!gravityMode) return
    // Spawn drips from random points along the stroke
    const pts = stroke.points
    const count = Math.min(8, Math.floor(pts.length / 3))
    for (let i = 0; i < count; i++) {
      const p = pts[Math.floor(Math.random() * pts.length)]
      drips.push({
        x: p.x + (Math.random() - 0.5) * 4,
        y: p.y,
        vy: 0.2 + Math.random() * 0.5,
        hue: stroke.hue,
        size: stroke.width * 0.4 + Math.random() * 1.5,
        alpha: 0.5 + Math.random() * 0.3,
      })
    }
    while (drips.length > MAX_DRIPS) drips.shift()
  }

  function updateDrips(c: CanvasRenderingContext2D, h: number) {
    for (let i = drips.length - 1; i >= 0; i--) {
      const d = drips[i]
      d.vy += 0.015 // gravity
      d.y += d.vy
      d.alpha -= 0.003
      d.size *= 0.998

      if (d.alpha <= 0 || d.y > h) {
        drips.splice(i, 1)
        continue
      }

      c.fillStyle = `hsla(${d.hue}, 60%, 55%, ${d.alpha * 0.5})`
      c.beginPath()
      c.arc(d.x, d.y, d.size, 0, Math.PI * 2)
      c.fill()

      // Leave a faint trail
      c.fillStyle = `hsla(${d.hue}, 50%, 50%, ${d.alpha * 0.05})`
      c.fillRect(d.x - 0.3, d.y - d.vy, 0.6, d.vy)
    }
  }

  // --- Auto-sketch system ---
  function updateAutoSketch(c: CanvasRenderingContext2D, w: number, h: number) {
    if (drawing) {
      autoSketchIdle = 0
      autoSketchActive = false
      return
    }

    autoSketchIdle += 0.016
    if (autoSketchIdle < 10 || autoSketchHistory.length < 5) return

    if (!autoSketchActive) {
      autoSketchActive = true
      autoSketchPhase = 0
      // Start a new auto-sketch stroke from a random point in history
      const seed = autoSketchHistory[Math.floor(Math.random() * autoSketchHistory.length)]
      autoSketchStroke = {
        points: [{ x: seed.x + (Math.random() - 0.5) * 50, y: seed.y + (Math.random() - 0.5) * 50 }],
        hue: seed.hue + (Math.random() - 0.5) * 40,
        width: 0.5 + Math.random() * 1,
        birth: time,
      }
    }

    if (autoSketchStroke) {
      autoSketchPhase += 0.016
      // Add a point every few frames, using smooth noise-like movement
      if (autoSketchPhase > 0.05) {
        autoSketchPhase = 0
        const last = autoSketchStroke.points[autoSketchStroke.points.length - 1]
        // Drift toward another history point occasionally
        let targetX = last.x
        let targetY = last.y
        if (Math.random() < 0.1 && autoSketchHistory.length > 0) {
          const t = autoSketchHistory[Math.floor(Math.random() * autoSketchHistory.length)]
          targetX = t.x
          targetY = t.y
        }
        const dx = (targetX - last.x) * 0.02 + (Math.random() - 0.5) * 3
        const dy = (targetY - last.y) * 0.02 + (Math.random() - 0.5) * 3
        autoSketchStroke.points.push({ x: last.x + dx, y: last.y + dy })
      }

      // Draw the auto-sketch stroke very faintly
      if (autoSketchStroke.points.length >= 2) {
        drawStrokePath(c, autoSketchStroke.points, autoSketchStroke.hue, autoSketchStroke.width, 0.06, false, 0)
      }

      // End after ~4 seconds or too many points
      const autoAge = time - autoSketchStroke.birth
      if (autoAge > 4 || autoSketchStroke.points.length > 100) {
        strokes.push(autoSketchStroke)
        autoSketchStroke = null
        autoSketchActive = false
        autoSketchIdle = 5 + Math.random() * 8 // shorter wait for next ghost sketch
      }
    }
  }

  // --- Constellation system ---
  function updateConstellations(c: CanvasRenderingContext2D) {
    constellationTimer += 0.016

    // Every 3 seconds, try to create new links between recent stroke endpoints
    if (constellationTimer > 3) {
      constellationTimer = 0
      const endpoints: { x: number; y: number; age: number }[] = []
      for (const s of strokes) {
        if (s.points.length < 2) continue
        const age = time - s.birth
        if (age < 10 || age > FADE_TIME) continue // only mid-age strokes
        endpoints.push({ x: s.points[0].x, y: s.points[0].y, age })
        endpoints.push({ x: s.points[s.points.length - 1].x, y: s.points[s.points.length - 1].y, age })
      }

      // Connect nearby endpoints (within 200px)
      for (let i = 0; i < endpoints.length && constellationLinks.length < 30; i++) {
        for (let j = i + 1; j < endpoints.length; j++) {
          const dx = endpoints[i].x - endpoints[j].x
          const dy = endpoints[i].y - endpoints[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > 30 && dist < 200) {
            // Don't create duplicate links (check proximity to existing)
            const isDuplicate = constellationLinks.some(l => {
              const d1 = Math.abs(l.x1 - endpoints[i].x) + Math.abs(l.y1 - endpoints[i].y)
              const d2 = Math.abs(l.x2 - endpoints[j].x) + Math.abs(l.y2 - endpoints[j].y)
              return d1 < 20 && d2 < 20
            })
            if (!isDuplicate) {
              constellationLinks.push({
                x1: endpoints[i].x, y1: endpoints[i].y,
                x2: endpoints[j].x, y2: endpoints[j].y,
                alpha: 0.08,
                birth: time,
              })
              break // one link per endpoint per cycle
            }
          }
        }
      }
    }

    // Draw and fade constellation links
    for (let i = constellationLinks.length - 1; i >= 0; i--) {
      const link = constellationLinks[i]
      link.alpha -= 0.0003
      if (link.alpha <= 0) {
        constellationLinks.splice(i, 1)
        continue
      }

      // Thin golden line
      c.strokeStyle = `rgba(255, 215, 0, ${link.alpha})`
      c.lineWidth = 0.5
      c.setLineDash([3, 5])
      c.beginPath()
      c.moveTo(link.x1, link.y1)
      c.lineTo(link.x2, link.y2)
      c.stroke()
      c.setLineDash([])

      // Small dots at endpoints
      c.fillStyle = `rgba(255, 215, 0, ${link.alpha * 1.5})`
      c.beginPath()
      c.arc(link.x1, link.y1, 1.5, 0, Math.PI * 2)
      c.fill()
      c.beginPath()
      c.arc(link.x2, link.y2, 1.5, 0, Math.PI * 2)
      c.fill()
    }
  }

  // --- Spray/dot brush modes ---
  function drawSprayPoint(c: CanvasRenderingContext2D, x: number, y: number, hue: number, width: number, alpha: number) {
    const count = 5 + Math.floor(width * 3)
    const radius = width * 3
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const dist = Math.random() * radius
      const px = x + Math.cos(angle) * dist
      const py = y + Math.sin(angle) * dist
      const size = 0.5 + Math.random() * 1.5
      c.fillStyle = `hsla(${hue}, 60%, 60%, ${alpha * (0.2 + Math.random() * 0.3)})`
      c.beginPath()
      c.arc(px, py, size, 0, Math.PI * 2)
      c.fill()
    }
  }

  function drawDotPoint(c: CanvasRenderingContext2D, x: number, y: number, hue: number, width: number, alpha: number) {
    const size = width * 0.8 + Math.random() * width * 0.5
    c.fillStyle = `hsla(${hue}, 65%, 60%, ${alpha * 0.6})`
    c.beginPath()
    c.arc(x, y, size, 0, Math.PI * 2)
    c.fill()
    // Subtle glow
    c.fillStyle = `hsla(${hue}, 60%, 65%, ${alpha * 0.15})`
    c.beginPath()
    c.arc(x, y, size * 2, 0, Math.PI * 2)
    c.fill()
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const c = ctx
    const w = canvas.width
    const h = canvas.height

    // Background breathing — subtle pulse
    breathPhase += 0.008
    const breathR = 5 + Math.sin(breathPhase) * 0.5
    const breathG = 3 + Math.sin(breathPhase * 0.7) * 0.5
    const breathB = 8 + Math.sin(breathPhase * 1.1) * 0.5
    c.fillStyle = `rgb(${Math.round(breathR)}, ${Math.round(breathG)}, ${Math.round(breathB)})`
    c.fillRect(0, 0, w, h)

    // Draw ghost afterimages (faded strokes that linger slightly longer)
    const now = time
    for (const stroke of strokes) {
      const age = now - stroke.birth
      if (age > FADE_TIME && age <= FADE_TIME + GHOST_EXTRA) {
        const ghostAlpha = Math.max(0, 1 - (age - FADE_TIME) / GHOST_EXTRA) * 0.02
        if (stroke.points.length >= 2) {
          drawStrokePath(c, stroke.points, stroke.hue, stroke.width, ghostAlpha, false, 0)
        }
      }
    }

    // Draw all strokes
    strokes = strokes.filter(stroke => {
      const age = now - stroke.birth
      if (age > FADE_TIME + GHOST_EXTRA) {
        bloomedStrokes.delete(stroke) // clean up bloom tracking
        return false // ghost also gone
      }

      if (age > FADE_TIME) return true // keep for ghost rendering above

      const alpha = Math.max(0, 1 - age / FADE_TIME)

      if (stroke.points.length < 2) return true

      const isRecent = age < 3
      const glowAlpha = isRecent ? (1 - age / 3) * 0.2 : 0
      drawStrokePath(c, stroke.points, stroke.hue, stroke.width, alpha * 0.7, isRecent, glowAlpha)

      // Ink bloom effect — watercolor bleed after a short delay
      const bloomAge = age - BLOOM_DELAY
      if (bloomAge > 0 && bloomAge < BLOOM_DURATION) {
        const bloomProgress = bloomAge / BLOOM_DURATION
        // Ease out — fast start, gentle end
        const eased = 1 - (1 - bloomProgress) * (1 - bloomProgress)
        const bloomWidth = stroke.width + BLOOM_EXPAND * 2 * eased
        const bloomAlpha = alpha * 0.12 * (1 - eased) // fades as it expands
        drawStrokePath(c, stroke.points, stroke.hue, bloomWidth, bloomAlpha, false, 0)
        bloomedStrokes.add(stroke)
      }

      return true
    })

    // Decay drawing activity when not drawing
    drawingActivity = Math.max(0, drawingActivity - 0.01)

    // Ambient idle particles — lazy drift when not drawing
    idleParticleTimer += 0.016
    if (!drawing && idleParticleTimer > 0.4 && particles.length < MAX_PARTICLES * 0.3) {
      idleParticleTimer = 0
      // Spawn a lazy particle at a random position
      const rx = Math.random() * w
      const ry = Math.random() * h
      spawnParticle(rx, ry, drawHue + (Math.random() - 0.5) * 60)
    }

    // Particles
    updateAndDrawParticles(c)

    // Current stroke being drawn
    if (currentStroke && currentStroke.points.length >= 2) {
      c.strokeStyle = `hsla(${currentStroke.hue}, 70%, 65%, 0.8)`
      c.lineWidth = currentStroke.width
      c.lineCap = 'round'
      c.lineJoin = 'round'

      c.beginPath()
      c.moveTo(currentStroke.points[0].x, currentStroke.points[0].y)
      for (let i = 1; i < currentStroke.points.length; i++) {
        c.lineTo(currentStroke.points[i].x, currentStroke.points[i].y)
      }
      c.stroke()

      // Active glow
      c.strokeStyle = `hsla(${currentStroke.hue}, 70%, 70%, 0.2)`
      c.lineWidth = currentStroke.width + 6
      c.stroke()
    }

    // Mirror stroke (current, while drawing)
    if (mirrorStroke && mirrorStroke.points.length >= 2) {
      const mp = mirrorPoints(mirrorStroke.points)
      c.strokeStyle = `hsla(${mirrorStroke.hue}, 70%, 65%, 0.8)`
      c.lineWidth = mirrorStroke.width
      c.lineCap = 'round'
      c.lineJoin = 'round'

      c.beginPath()
      c.moveTo(mp[0].x, mp[0].y)
      for (let i = 1; i < mp.length; i++) {
        c.lineTo(mp[i].x, mp[i].y)
      }
      c.stroke()

      c.strokeStyle = `hsla(${mirrorStroke.hue}, 70%, 70%, 0.2)`
      c.lineWidth = mirrorStroke.width + 6
      c.stroke()
    }

    // Gravity drips
    if (gravityMode) updateDrips(c, h)

    // Constellation links
    updateConstellations(c)

    // Auto-sketch (ghost drawing)
    updateAutoSketch(c, w, h)

    // Evaporation wisps — spawn from aging strokes
    evapSpawnTimer += 0.016
    if (evapSpawnTimer > 0.12) {
      evapSpawnTimer = 0
      for (const stroke of strokes) {
        const age = now - stroke.birth
        if (age > 30 && age < FADE_TIME && stroke.points.length >= 2 && Math.random() < 0.15) {
          const pt = stroke.points[Math.floor(Math.random() * stroke.points.length)]
          evapWisps.push({
            x: pt.x + (Math.random() - 0.5) * 6,
            y: pt.y,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -(0.15 + Math.random() * 0.25),
            alpha: 0.12 + Math.random() * 0.08,
            size: 0.5 + Math.random() * 1.2,
            hue: stroke.hue,
          })
        }
      }
      while (evapWisps.length > 60) evapWisps.shift()
    }
    for (let i = evapWisps.length - 1; i >= 0; i--) {
      const ew = evapWisps[i]
      ew.x += ew.vx
      ew.y += ew.vy
      ew.vy -= 0.001
      ew.alpha -= 0.001
      ew.size *= 0.998
      if (ew.alpha <= 0) { evapWisps.splice(i, 1); continue }
      c.fillStyle = `hsla(${ew.hue}, 50%, 70%, ${ew.alpha})`
      c.beginPath()
      c.arc(ew.x, ew.y, ew.size, 0, Math.PI * 2)
      c.fill()
    }

    // Stroke echo replay — ghost strokes briefly re-trace during ghost phase
    for (const stroke of strokes) {
      const age = now - stroke.birth
      if (age > FADE_TIME && age < FADE_TIME + 5 && !echoedStrokes.has(stroke) && stroke.points.length >= 4) {
        echoedStrokes.add(stroke)
        strokeEchoes.push({
          points: stroke.points,
          hue: stroke.hue,
          width: stroke.width * 0.6,
          replayProgress: 0,
          alpha: 0.06,
        })
      }
    }
    for (let i = strokeEchoes.length - 1; i >= 0; i--) {
      const echo = strokeEchoes[i]
      echo.replayProgress += 0.008
      if (echo.replayProgress >= 1) { strokeEchoes.splice(i, 1); continue }
      const visibleCount = Math.floor(echo.replayProgress * echo.points.length)
      if (visibleCount < 2) continue
      const visiblePts = echo.points.slice(0, visibleCount)
      const fadeAlpha = echo.alpha * (1 - echo.replayProgress * 0.5)
      drawStrokePath(c, visiblePts, echo.hue, echo.width, fadeAlpha, false, 0)
      // Bright tip at replay head
      const tip = visiblePts[visiblePts.length - 1]
      c.fillStyle = `hsla(${echo.hue}, 60%, 75%, ${fadeAlpha * 2})`
      c.beginPath()
      c.arc(tip.x, tip.y, echo.width + 1, 0, Math.PI * 2)
      c.fill()
    }

    // Alternative brush mode rendering for current stroke
    if (currentStroke && currentStroke.points.length >= 2 && drawMode !== 'solid') {
      for (const p of currentStroke.points) {
        if (drawMode === 'spray') {
          drawSprayPoint(c, p.x, p.y, currentStroke.hue, currentStroke.width, 0.8)
        } else if (drawMode === 'dots') {
          drawDotPoint(c, p.x, p.y, currentStroke.hue, currentStroke.width, 0.8)
        }
      }
    }

    // Grain (subtle, applied after strokes)
    drawGrain(c, w, h)

    // Cursor color indicator
    if (!drawing) {
      const ix = w - 30
      const iy = 30
      c.fillStyle = `hsla(${drawHue}, 60%, 60%, 0.4)`
      c.beginPath()
      c.arc(ix, iy, brushWidth + 3, 0, Math.PI * 2)
      c.fill()
    }

    // Title
    c.font = '12px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(180, 160, 200, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.fillText('the sketchpad', w / 2, 25)

    // Mode indicators
    {
      let modeY = 40
      c.font = '12px "Cormorant Garamond", serif'
      c.textAlign = 'center'
      if (symmetryMode) {
        c.fillStyle = `rgba(180, 160, 200, ${0.12 + Math.sin(time * 0.5) * 0.03})`
        c.fillText('\u25C7 symmetric', w / 2, modeY)
        modeY += 15
      }
      if (gravityMode) {
        c.fillStyle = `rgba(160, 180, 220, ${0.12 + Math.sin(time * 0.6) * 0.03})`
        c.fillText('\u25BD gravity', w / 2, modeY)
        modeY += 15
      }
      if (drawMode !== 'solid') {
        c.fillStyle = `rgba(200, 180, 160, ${0.12 + Math.sin(time * 0.4) * 0.03})`
        c.fillText(drawMode === 'spray' ? '\u2022 spray' : '\u25CB dots', w / 2, modeY)
      }
    }

    // Stats (very faint)
    c.font = '12px monospace'
    c.fillStyle = 'rgba(180, 160, 200, 0.06)'
    c.textAlign = 'left'
    c.fillText(`strokes: ${totalStrokes}`, 12, h - 30)
    c.fillText(`visible: ${strokes.length}`, 12, h - 18)
    c.textAlign = 'right'
    c.fillText(`hue: ${drawHue}`, w - 12, h - 30)
    c.fillText(`width: ${brushWidth}`, w - 12, h - 18)

    // Sigil navigation templates
    if (deps.switchTo) {
      const positions = getSigilScreenPositions(w, h)
      for (let i = 0; i < sigils.length; i++) {
        const sigil = sigils[i]
        const pos = positions[i]
        const screenPath = sigilPathToScreen(sigil.path, pos.cx, pos.cy)

        // Decay glow and flash
        sigil.glow = sigil.glow * 0.92 + sigil.matchProgress * 0.08
        if (sigil.flash > 0) {
          sigil.flash -= 0.016 / 0.6 // decay over 0.6s
          if (sigil.flash < 0) sigil.flash = 0
        }

        // Base alpha — ghost outline
        const baseAlpha = 0.04 + Math.sin(time * 0.5 + i * 2) * 0.01
        const glowBoost = sigil.glow * 0.2
        const flashBoost = sigil.flash * 0.6
        const alpha = Math.min(1, baseAlpha + glowBoost + flashBoost)

        const hue = sigil.flash > 0 ? 60 : 270 // flash gold, otherwise purple

        // Draw sigil template outline
        c.strokeStyle = `hsla(${hue}, 50%, 65%, ${alpha})`
        c.lineWidth = 1.5 + sigil.glow * 1.5 + sigil.flash * 2
        c.lineCap = 'round'
        c.lineJoin = 'round'
        c.beginPath()
        if (screenPath.length > 0) {
          c.moveTo(screenPath[0].x, screenPath[0].y)
          for (let j = 1; j < screenPath.length; j++) {
            c.lineTo(screenPath[j].x, screenPath[j].y)
          }
        }
        c.stroke()

        // Outer glow when actively matching
        if (sigil.glow > 0.1 || sigil.flash > 0) {
          c.strokeStyle = `hsla(${hue}, 60%, 70%, ${(sigil.glow * 0.1 + sigil.flash * 0.3)})`
          c.lineWidth = 4 + sigil.flash * 4
          c.stroke()
        }

        // Room label beneath sigil
        c.font = '11px "Cormorant Garamond", serif'
        c.fillStyle = `rgba(180, 160, 200, ${0.04 + sigil.glow * 0.12 + sigil.flash * 0.4})`
        c.textAlign = 'center'
        c.fillText(sigil.label, pos.cx, pos.cy + SIGIL_SIZE / 2 + 14)
      }

      // Handle pending navigation
      if (pendingNav) {
        pendingNavTimer -= 0.016
        if (pendingNavTimer <= 0) {
          const room = pendingNav
          pendingNav = null
          deps.switchTo(room)
        }
      }

      // Reset match progress each frame (it gets set fresh from live stroke check)
      for (const sigil of sigils) {
        if (!drawing) sigil.matchProgress = 0
      }
    }

    // Hint
    c.font = '12px "Cormorant Garamond", serif'
    c.fillStyle = 'rgba(180, 160, 200, 0.04)'
    c.textAlign = 'center'
    c.fillText('draw with light \u00B7 scroll hue \u00B7 shift+scroll width \u00B7 S symmetry \u00B7 G gravity \u00B7 1/2/3 brush \u00B7 double-click clear', w / 2, h - 8)
    c.fillText('trace a sigil below to travel', w / 2, h - 4 + 14)

    // Cultural inscriptions
    inscriptionTimer += 0.016
    if (inscriptionTimer >= 24) {
      inscriptionTimer = 0
      inscriptionIdx = (inscriptionIdx + 1) % CULTURAL_INSCRIPTIONS.length
    }
    const insText = CULTURAL_INSCRIPTIONS[inscriptionIdx]
    c.font = '11px "Cormorant Garamond", serif'
    c.textAlign = 'center'
    c.fillStyle = 'rgba(180, 160, 200, 0.03)'
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
      c.fillText(insLines[li], w / 2, h - 70 + li * 14)
    }
  }

  function startStroke(x: number, y: number) {
    drawing = true
    const pressureW = getPressureWidth(brushWidth, currentSpeed)
    currentStroke = {
      points: [{ x, y }],
      hue: drawHue,
      width: pressureW,
      birth: time,
    }
    if (symmetryMode) {
      mirrorStroke = {
        points: [{ x, y }],
        hue: (drawHue + 30) % 360,
        width: pressureW,
        birth: time,
      }
    }
    lastMoveTime = performance.now()
    lastDrawX = x
    lastDrawY = y
    drawingActivity = 0.3

    // Start audio
    initAudio().then(() => {
      if (drawing) updateAudio(x, y, 0)
    })
  }

  function addPoint(x: number, y: number) {
    if (!currentStroke) return
    const last = currentStroke.points[currentStroke.points.length - 1]
    const dx = x - last.x
    const dy = y - last.y
    // Only add if moved enough
    if (dx * dx + dy * dy > 4) {
      // Calculate speed
      const now = performance.now()
      const dt = Math.max(1, now - lastMoveTime)
      const dist = Math.sqrt(dx * dx + dy * dy)
      currentSpeed = (dist / dt) * 1000 // pixels per second
      lastMoveTime = now

      // Pressure-adjusted width
      const pressureW = getPressureWidth(brushWidth, currentSpeed)
      currentStroke.width = pressureW

      currentStroke.points.push({ x, y })

      if (mirrorStroke) {
        mirrorStroke.points.push({ x, y })
        mirrorStroke.width = pressureW
      }

      // Track drawing position and activity
      lastDrawX = x
      lastDrawY = y
      drawingActivity = Math.min(1, drawingActivity + 0.15)

      // Record to auto-sketch history (sampled)
      if (Math.random() < 0.3) {
        autoSketchHistory.push({ x, y, hue: drawHue })
        if (autoSketchHistory.length > 200) autoSketchHistory.shift()
      }

      // Spawn particles — more when drawing, scattered when fast
      const speedNorm = Math.min(1, currentSpeed / 600)
      const particleCount = speedNorm > 0.5 ? 3 : 1 // more sparks when moving fast
      for (let pi = 0; pi < particleCount; pi++) {
        // Fast strokes scatter particles outward from cursor
        const scatterVx = speedNorm > 0.3 ? (Math.random() - 0.5) * speedNorm * 3 : 0
        const scatterVy = speedNorm > 0.3 ? (Math.random() - 0.5) * speedNorm * 3 : 0
        const offsetX = (Math.random() - 0.5) * 10
        const offsetY = (Math.random() - 0.5) * 10
        spawnParticle(x + offsetX, y + offsetY, drawHue, scatterVx, scatterVy)
      }
      if (symmetryMode) {
        const cw = canvas?.width || window.innerWidth
        const scatterVx = speedNorm > 0.3 ? (Math.random() - 0.5) * speedNorm * 3 : 0
        const scatterVy = speedNorm > 0.3 ? (Math.random() - 0.5) * speedNorm * 3 : 0
        spawnParticle(cw - x, y, (drawHue + 30) % 360, -scatterVx, scatterVy)
      }

      // Update audio
      updateAudio(x, y, currentSpeed)

      // Live sigil matching feedback while drawing
      if (canvas && deps.switchTo && currentStroke.points.length > 5) {
        const positions = getSigilScreenPositions(canvas.width, canvas.height)
        for (let si = 0; si < sigils.length; si++) {
          const pos = positions[si]
          const screenPath = sigilPathToScreen(sigils[si].path, pos.cx, pos.cy)
          sigils[si].matchProgress = matchStrokeToSigil(currentStroke.points, screenPath, pos.cx, pos.cy)
        }
      }
    }
  }

  function endStroke() {
    // Check sigil match before clearing the stroke
    if (currentStroke && currentStroke.points.length >= 5) {
      checkSigilMatch(currentStroke.points)
    }

    if (currentStroke && currentStroke.points.length >= 2) {
      strokes.push(currentStroke)
      totalStrokes++
      spawnDrips(currentStroke)
    }
    if (mirrorStroke && mirrorStroke.points.length >= 2) {
      // Store mirrored points directly so they render correctly as a normal stroke
      const mirrored: Stroke = {
        points: mirrorPoints(mirrorStroke.points),
        hue: mirrorStroke.hue,
        width: mirrorStroke.width,
        birth: mirrorStroke.birth,
        mirrored: true,
      }
      strokes.push(mirrored)
      totalStrokes++
    }
    currentStroke = null
    mirrorStroke = null
    drawing = false
    currentSpeed = 0

    // Fade out audio
    fadeOutAudio()
  }

  // Keyboard handler for modes
  function onKeyDown(e: KeyboardEvent) {
    if (!active) return
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

    if (e.key === 's' || e.key === 'S') {
      symmetryMode = !symmetryMode
    }
    if (e.key === 'g' || e.key === 'G') {
      gravityMode = !gravityMode
    }
    // Drawing mode: 1=solid, 2=spray, 3=dots
    if (e.key === '1') drawMode = 'solid'
    if (e.key === '2') drawMode = 'spray'
    if (e.key === '3') drawMode = 'dots'
  }

  return {
    name: 'sketchpad',
    label: 'the sketchpad',

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

      // Mouse events
      canvas.addEventListener('mousedown', (e) => {
        startStroke(e.clientX, e.clientY)
      })
      canvas.addEventListener('mousemove', (e) => {
        if (drawing) addPoint(e.clientX, e.clientY)
      })
      canvas.addEventListener('mouseup', () => endStroke())
      canvas.addEventListener('mouseleave', () => endStroke())

      // Touch events
      canvas.addEventListener('touchstart', (e) => {
        e.preventDefault()
        const t = e.touches[0]
        startStroke(t.clientX, t.clientY)
      }, { passive: false })
      canvas.addEventListener('touchmove', (e) => {
        e.preventDefault()
        const t = e.touches[0]
        if (drawing) addPoint(t.clientX, t.clientY)
      }, { passive: false })
      canvas.addEventListener('touchend', (e) => {
        e.preventDefault()
        endStroke()
      })

      // Double-click to clear
      canvas.addEventListener('dblclick', () => {
        strokes = []
        particles = []
        bloomedStrokes.clear()
        evapWisps.length = 0
        strokeEchoes.length = 0
        echoedStrokes.clear()
      })

      // Scroll to change hue, shift+scroll for width
      canvas.addEventListener('wheel', (e) => {
        if (e.shiftKey) {
          brushWidth = Math.max(1, Math.min(20, brushWidth + (e.deltaY > 0 ? 1 : -1)))
        } else {
          drawHue = ((drawHue + (e.deltaY > 0 ? 10 : -10)) % 360 + 360) % 360
        }
        e.preventDefault()
      }, { passive: false })

      // Symmetry toggle
      window.addEventListener('keydown', onKeyDown)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)
      return overlay
    },

    activate() {
      active = true
      evapWisps.length = 0
      strokeEchoes.length = 0
      echoedStrokes.clear()
      evapSpawnTimer = 0
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      fadeOutAudio()
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      window.removeEventListener('keydown', onKeyDown)
      teardownAudio()
      overlay?.remove()
    },
  }
}
