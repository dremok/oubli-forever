/**
 * THE LOOM — weave memories into textiles
 *
 * A room where stored memories become threads in a generative weaving.
 * Each memory is a colored thread — its hue from the memory's color,
 * its pattern from the text content (character codes → weave pattern).
 * Degraded memories produce frayed, broken threads.
 *
 * The weaving builds in real-time, left to right. New memories add
 * new threads. The pattern is deterministic — same memories always
 * produce the same textile. But as memories degrade, holes appear.
 *
 * The room has a meditative quality. The shuttle moves back and forth.
 * Threads interlace. The sound of the loom is the only audio.
 *
 * Accessible from the garden (hidden link) — plants → fibers → thread → cloth.
 * Also in the tab bar as a visible room.
 *
 * Inspired by: Jacquard looms (first binary programming), Anni Albers,
 * the Bayeux Tapestry, Navajo weaving, the Fates' thread,
 * Ada Lovelace (Analytical Engine was inspired by the Jacquard loom)
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface LoomDeps {
  getMemories: () => StoredMemory[]
  switchTo?: (name: string) => void
}

function textToPattern(text: string): number[] {
  // Convert text to a binary-ish weave pattern
  const pattern: number[] = []
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    pattern.push(code % 2) // 0 = warp on top, 1 = weft on top
  }
  return pattern
}

function memoryToColor(mem: StoredMemory): { h: number; s: number; l: number; a: number } {
  const h = mem.hue * 360
  const s = 30 + (1 - mem.degradation) * 40
  const l = 20 + (1 - mem.degradation) * 30
  const a = 0.3 + (1 - mem.degradation) * 0.5
  return { h, s, l, a }
}

function colorToString(c: { h: number; s: number; l: number; a: number }): string {
  return `hsla(${c.h}, ${c.s}%, ${c.l}%, ${c.a})`
}

// Seeded random for deterministic frayed ends per thread
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

const CULTURAL_INSCRIPTIONS = [
  'the jacquard loom (1804): punch cards controlling thread patterns. the first binary programming.',
  'ada lovelace saw the analytical engine as a jacquard loom weaving algebraic patterns. code as textile.',
  'anni albers at the bauhaus: weaving as a language parallel to painting. thread as line, fabric as field.',
  'the bayeux tapestry returns to england in 2026. insured for 800 million pounds. vibration sensors test the route.',
  'penelope wove by day and unwove by night. twenty years of deliberate forgetting, disguised as patience.',
  'navajo weavers intentionally leave a spirit line — a deliberate flaw — so the weaver\'s soul can escape.',
  'shiota threads of life: monumental red thread installations. shoes, keys, beds — all tangled in connection.',
  'the fates spin, measure, and cut the thread of life. memory as textile, destiny as weaving.',
  'MIT put a computer inside a single fiber. 32-bit processor, sensors, bluetooth. the fabric literally thinks.',
  'yin xiuzhen built a human heart from collected clothing. each garment carries someone\'s lived experience.',
  'phillip stearns weaves literal computer memory data into textiles. the binary can be decoded from the cloth.',
  'anna lucia\'s algorithmic loom: weave patterns generated at the moment of transaction. distortion as decay.',
  'the quilters of gee\'s bend: centuries of african american memory encoded in quilt patterns.',
  '2026 textile tension: craft versus code. algorithmic precision colliding with deliberate imperfection.',
  'physarum stores memories in tube thickness. a slime mold\'s network IS its memory. thicker paths are remembered.',
  'kustaa saksi: a 15-meter jacquard-woven pine tree suspended in mid-air. washi paper yarns. uprootedness.',
]

export function createLoomRoom(deps: LoomDeps): Room {
  let inscriptionTimer = 0
  let inscriptionIdx = 0
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let shuttleX = 0
  let shuttleDir = 1
  let prevShuttleDir = 1
  let weavingProgress = 0
  // Pull-thread navigation state
  let navThreads = [
    { label: 'study', room: 'study', color: [210, 170, 60] as [number, number, number] },       // warm amber/gold
    { label: 'darkroom', room: 'darkroom', color: [160, 30, 40] as [number, number, number] },   // deep crimson
    { label: 'gallery', room: 'palimpsestgallery', color: [140, 170, 210] as [number, number, number] }, // pale blue/silver
    { label: 'sketchpad', room: 'sketchpad', color: [140, 80, 180] as [number, number, number] }, // violet
  ]
  let hoveredNavThread = -1
  let pullingNavThread = -1
  let pullStartY = 0
  let pullCurrentY = 0
  let navThreadFlash = -1
  let navThreadFlashTimer = 0

  // Click-to-examine state
  let selectedThread = -1
  let selectedMemory: StoredMemory | null = null
  let examineTimeout = 0
  let examineOverlay: HTMLElement | null = null

  // Thread positions for hit testing (updated each frame)
  let threadYPositions: number[] = []
  let threadMargin = 60
  let threadWeaveW = 0

  // Tension state
  let tension = 0 // 0-1
  let snappedThread = -1
  let snapTimer = 0

  // Heddle state (per-column rise/fall)
  let heddlePhases: number[] = []

  // --- Spirit line (Navajo tradition: deliberate flaw) ---
  let spiritLineCol = -1 // column index of the spirit line, set on activate

  // --- Thread whisper: hovering shows memory text flowing along thread ---
  let hoveredThread = -1
  let whisperOffset = 0 // scrolls along the thread

  // --- Patina: completed weave develops warm aging tint ---
  let patinaAge = 0 // accumulates each frame, affects the tint

  // --- Loose fibers: detach from degraded threads, drift downward ---
  interface LooseFiber {
    x: number
    y: number
    vx: number
    vy: number
    alpha: number
    length: number
    angle: number
    rotSpeed: number
    hue: number
  }
  let looseFibers: LooseFiber[] = []

  // --- Shuttle trail: glowing trace behind shuttle ---
  interface ShuttleTrailPoint {
    x: number
    y: number
    alpha: number
  }
  let shuttleTrail: ShuttleTrailPoint[] = []

  // Audio state
  let audioInitialized = false
  let audioMaster: GainNode | null = null
  let droneOsc: OscillatorNode | null = null
  let droneGain: GainNode | null = null
  let droneFilter: BiquadFilterNode | null = null
  let creakInterval = 0

  // --- Audio ---

  async function initAudio() {
    if (audioInitialized) return
    try {
      const ac = await getAudioContext()
      const dest = getAudioDestination()

      audioMaster = ac.createGain()
      audioMaster.gain.value = 0
      audioMaster.connect(dest)

      // Background drone — warm low sawtooth through heavy filter
      droneOsc = ac.createOscillator()
      droneOsc.type = 'sawtooth'
      droneOsc.frequency.value = 80
      droneFilter = ac.createBiquadFilter()
      droneFilter.type = 'lowpass'
      droneFilter.frequency.value = 120
      droneFilter.Q.value = 2
      droneGain = ac.createGain()
      droneGain.gain.value = 0.04 // very faint
      droneOsc.connect(droneFilter)
      droneFilter.connect(droneGain)
      droneGain.connect(audioMaster)
      droneOsc.start()

      audioInitialized = true

      // Fade in
      audioMaster.gain.setValueAtTime(0, ac.currentTime)
      audioMaster.gain.linearRampToValueAtTime(1.0, ac.currentTime + 1.5)

      // Tension creaks every 10-20s
      scheduleCreak()
    } catch {
      // Audio not available — silent operation
    }
  }

  function playShuttleClick() {
    if (!audioInitialized || !audioMaster) return
    try {
      const ac = audioMaster.context as AudioContext
      const now = ac.currentTime

      // Short noise burst through tight bandpass at ~800Hz
      const bufferSize = Math.floor(ac.sampleRate * 0.03) // 30ms
      const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15))
      }

      const source = ac.createBufferSource()
      source.buffer = buffer

      const bp = ac.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 800
      bp.Q.value = 8

      const clickGain = ac.createGain()
      clickGain.gain.setValueAtTime(0.12, now)
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)

      source.connect(bp)
      bp.connect(clickGain)
      clickGain.connect(audioMaster)
      source.start(now)
      source.stop(now + 0.06)
    } catch {
      // Ignore audio errors
    }
  }

  function playCreak() {
    if (!audioInitialized || !audioMaster) return
    try {
      const ac = audioMaster.context as AudioContext
      const now = ac.currentTime

      // Filtered noise at ~2000Hz, very quiet, short
      const duration = 0.15 + Math.random() * 0.15
      const bufferSize = Math.floor(ac.sampleRate * duration)
      const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4))
      }

      const source = ac.createBufferSource()
      source.buffer = buffer

      const bp = ac.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1800 + Math.random() * 600
      bp.Q.value = 12

      const creakGain = ac.createGain()
      creakGain.gain.setValueAtTime(0.03, now)
      creakGain.gain.exponentialRampToValueAtTime(0.001, now + duration)

      source.connect(bp)
      bp.connect(creakGain)
      creakGain.connect(audioMaster)
      source.start(now)
      source.stop(now + duration)
    } catch {
      // Ignore
    }
  }

  function scheduleCreak() {
    if (!active) return
    const delay = 10000 + Math.random() * 10000 // 10-20s
    creakInterval = window.setTimeout(() => {
      playCreak()
      scheduleCreak()
    }, delay)
  }

  function destroyAudio() {
    if (creakInterval) {
      clearTimeout(creakInterval)
      creakInterval = 0
    }
    if (audioMaster) {
      try {
        const ac = audioMaster.context as AudioContext
        const now = ac.currentTime
        audioMaster.gain.setValueAtTime(audioMaster.gain.value, now)
        audioMaster.gain.linearRampToValueAtTime(0, now + 0.5)
      } catch { /* ignore */ }

      setTimeout(() => {
        try { droneOsc?.stop() } catch { /* already stopped */ }
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
  }

  // --- Examine overlay ---

  function showExamineOverlay(mem: StoredMemory) {
    dismissExamineOverlay()
    selectedMemory = mem

    examineOverlay = document.createElement('div')
    examineOverlay.style.cssText = `
      position: absolute; bottom: 50px; left: 50%; transform: translateX(-50%);
      max-width: 420px; width: 80%;
      background: rgba(18, 12, 8, 0.92);
      border: 1px solid rgba(180, 140, 100, 0.15);
      border-radius: 4px;
      padding: 14px 18px;
      font-family: "Cormorant Garamond", serif;
      color: rgba(200, 170, 120, 0.7);
      pointer-events: auto;
      z-index: 10;
      opacity: 0;
      transition: opacity 0.3s ease;
    `

    const ageDays = Math.floor((Date.now() - mem.timestamp) / (1000 * 60 * 60 * 24))
    const degradPct = Math.round(mem.degradation * 100)

    examineOverlay.innerHTML = `
      <div style="font-size: 13px; line-height: 1.5; margin-bottom: 8px; color: rgba(200, 170, 120, 0.6);">
        ${mem.currentText || '<em style="opacity:0.3">dissolved</em>'}
      </div>
      <div style="font-size: 12px; letter-spacing: 1px; color: rgba(180, 140, 100, 0.25); display: flex; gap: 16px;">
        <span>${degradPct}% degraded</span>
        <span>${ageDays} day${ageDays !== 1 ? 's' : ''} old</span>
      </div>
    `

    overlay?.appendChild(examineOverlay)
    requestAnimationFrame(() => {
      if (examineOverlay) examineOverlay.style.opacity = '1'
    })

    // Auto-dismiss after 5s
    examineTimeout = window.setTimeout(() => {
      dismissExamineOverlay()
    }, 5000)
  }

  function dismissExamineOverlay() {
    if (examineTimeout) { clearTimeout(examineTimeout); examineTimeout = 0 }
    if (examineOverlay) {
      examineOverlay.style.opacity = '0'
      const el = examineOverlay
      setTimeout(() => el.remove(), 300)
      examineOverlay = null
    }
    selectedThread = -1
    selectedMemory = null
  }

  // --- Drawing helpers ---

  function drawWoodGrain(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    horizontal: boolean
  ) {
    ctx.save()
    ctx.globalAlpha = 0.04
    ctx.strokeStyle = 'rgba(160, 120, 60, 1)'
    ctx.lineWidth = 0.5
    const count = horizontal ? Math.floor(h / 3) : Math.floor(w / 3)
    for (let i = 0; i < count; i++) {
      ctx.beginPath()
      if (horizontal) {
        const gy = y + (i / count) * h
        const wobble = Math.sin(i * 0.7) * 2
        ctx.moveTo(x, gy + wobble)
        for (let px = 0; px < w; px += 8) {
          const py = gy + Math.sin((px + i * 13) * 0.03) * 1.5 + wobble
          ctx.lineTo(x + px, py)
        }
      } else {
        const gx = x + (i / count) * w
        const wobble = Math.sin(i * 0.7) * 2
        ctx.moveTo(gx + wobble, y)
        for (let py = 0; py < h; py += 8) {
          const px = gx + Math.sin((py + i * 13) * 0.03) * 1.5 + wobble
          ctx.lineTo(px, y + py)
        }
      }
      ctx.stroke()
    }
    ctx.restore()
  }

  function drawLoomFrame(
    ctx: CanvasRenderingContext2D,
    margin: number, weaveW: number, weaveH: number
  ) {
    const beamThickness = 12
    const postWidth = 10

    // Top beam
    ctx.fillStyle = 'rgba(80, 55, 30, 0.25)'
    ctx.fillRect(margin - postWidth - 4, margin - beamThickness - 14, weaveW + postWidth * 2 + 8, beamThickness)
    drawWoodGrain(ctx, margin - postWidth - 4, margin - beamThickness - 14, weaveW + postWidth * 2 + 8, beamThickness, true)

    // Bottom beam
    ctx.fillRect(margin - postWidth - 4, margin + weaveH + 4, weaveW + postWidth * 2 + 8, beamThickness)
    drawWoodGrain(ctx, margin - postWidth - 4, margin + weaveH + 4, weaveW + postWidth * 2 + 8, beamThickness, true)

    // Left post
    ctx.fillRect(margin - postWidth - 4, margin - beamThickness - 14, postWidth, weaveH + beamThickness * 2 + 18)
    drawWoodGrain(ctx, margin - postWidth - 4, margin - beamThickness - 14, postWidth, weaveH + beamThickness * 2 + 18, false)

    // Right post
    ctx.fillRect(margin + weaveW + 4, margin - beamThickness - 14, postWidth, weaveH + beamThickness * 2 + 18)
    drawWoodGrain(ctx, margin + weaveW + 4, margin - beamThickness - 14, postWidth, weaveH + beamThickness * 2 + 18, false)
  }

  function drawHeddles(
    ctx: CanvasRenderingContext2D,
    margin: number, weaveW: number, visibleCols: number,
    cellSize: number
  ) {
    // Small bars above the weaving that rise/fall
    const heddleY = margin - 6
    const heddleH = 4
    const barWidth = Math.max(2, cellSize * 0.6)

    // Ensure we have enough phases
    while (heddlePhases.length < visibleCols) {
      heddlePhases.push(Math.random() * Math.PI * 2)
    }

    ctx.fillStyle = 'rgba(140, 100, 50, 0.12)'
    for (let col = 0; col < visibleCols; col++) {
      const x = margin + col * cellSize + (cellSize - barWidth) / 2
      const phase = heddlePhases[col]
      const rise = Math.sin(time * 0.5 + phase) * 3
      ctx.fillRect(x, heddleY + rise, barWidth, heddleH)
    }
  }

  function drawTensionMeter(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, height: number, t: number
  ) {
    const meterW = 4
    const fillH = height * t

    // Track
    ctx.fillStyle = 'rgba(80, 55, 30, 0.08)'
    ctx.fillRect(x, y, meterW, height)

    // Fill (warm color, brighter as tension rises)
    const r = 120 + t * 80
    const g = 80 + (1 - t) * 40
    const b = 30
    const alpha = 0.1 + t * 0.2
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
    ctx.fillRect(x, y + height - fillH, meterW, fillH)

    // Label
    ctx.save()
    ctx.font = '7px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(180, 140, 100, 0.12)`
    ctx.textAlign = 'center'
    ctx.translate(x + meterW / 2, y - 6)
    ctx.fillText('tension', 0, 0)
    ctx.restore()
  }

  function drawIntersectionNodes(
    ctx: CanvasRenderingContext2D,
    memories: StoredMemory[],
    margin: number, threadCount: number, threadSpacing: number,
    visibleCols: number, cellSize: number
  ) {
    // Where two bright threads cross (both "over"), draw a small pearl
    for (let col = 0; col < visibleCols; col += 3) { // Check every 3rd column for performance
      const x = margin + col * cellSize + cellSize / 2
      let prevOver = false
      let prevBright = false
      for (let t = 0; t < threadCount; t++) {
        const mem = memories[t % memories.length]
        const pattern = textToPattern(mem.originalText)
        const patIdx = col % pattern.length
        const isOver = pattern[patIdx] === 1
        const isBright = mem.degradation < 0.3

        if (isOver && isBright && prevOver && prevBright && t > 0) {
          const y = margin + (t + 1) * threadSpacing
          const prevY = margin + t * threadSpacing
          const midY = (y + prevY) / 2

          // Pearl node
          ctx.beginPath()
          ctx.arc(x, midY, 1.5, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(240, 220, 180, ${0.15 + Math.sin(time * 2 + col * 0.5) * 0.05})`
          ctx.fill()
        }
        prevOver = isOver
        prevBright = isBright
      }
    }
  }

  function drawFrayedEnds(
    ctx: CanvasRenderingContext2D,
    mem: StoredMemory,
    x: number, y: number, cellSize: number,
    threadIdx: number, colIdx: number
  ) {
    // Degraded threads get tiny fiber branches at gaps
    if (mem.degradation < 0.4) return
    const rng = seededRandom(threadIdx * 1000 + colIdx)
    const fiberCount = 2 + Math.floor(rng() * 2)
    const color = memoryToColor(mem)

    ctx.save()
    ctx.strokeStyle = colorToString({ ...color, a: color.a * 0.4 })
    ctx.lineWidth = 0.5
    for (let f = 0; f < fiberCount; f++) {
      const angle = (rng() - 0.5) * Math.PI * 0.8
      const len = 2 + rng() * 3
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len)
      ctx.stroke()
    }
    ctx.restore()
  }

  // --- Main render ---

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height
    const memories = deps.getMemories()

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Background — warm dark wood
    ctx.fillStyle = 'rgba(18, 12, 8, 1)'
    ctx.fillRect(0, 0, w, h)

    if (memories.length === 0) {
      // Empty loom
      ctx.font = '14px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(180, 140, 100, 0.2)'
      ctx.textAlign = 'center'
      ctx.fillText('the loom awaits thread', w / 2, h / 2)
      ctx.font = '13px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(180, 140, 100, 0.1)'
      ctx.fillText('memories become fibers. type into the void first.', w / 2, h / 2 + 24)
      return
    }

    // Weaving area
    const margin = 60
    const weaveW = w - margin * 2 - 20 // Extra space for tension meter
    const weaveH = h - margin * 2
    const threadCount = Math.min(memories.length, 40)
    const threadSpacing = weaveH / (threadCount + 1)
    const cellSize = Math.max(4, Math.min(12, weaveW / 80))

    // Store for hit testing
    threadMargin = margin
    threadWeaveW = weaveW
    threadYPositions = []
    for (let t = 0; t < threadCount; t++) {
      threadYPositions.push(margin + (t + 1) * threadSpacing)
    }

    // Tension calculation: more threads = more tension
    const targetTension = Math.min(1, threadCount / 35)
    tension += (targetTension - tension) * 0.02

    // Shuttle speed affected by tension
    const shuttleSpeed = 2 * (1 - tension * 0.5) // Tighter = slower

    // Snap timer: occasional thread snap at high tension
    if (tension > 0.7) {
      snapTimer -= 0.016
      if (snapTimer <= 0) {
        snappedThread = Math.floor(Math.random() * threadCount)
        snapTimer = 8 + Math.random() * 12 // 8-20s between snaps
        // Re-appear after a short time
        setTimeout(() => { snappedThread = -1 }, 400 + Math.random() * 400)
      }
    }

    // Loom frame
    drawLoomFrame(ctx, margin, weaveW, weaveH)

    // Progress the weaving
    weavingProgress += 0.3
    const maxCols = Math.floor(weaveW / cellSize)
    const visibleCols = Math.min(Math.floor(weavingProgress), maxCols)

    // Heddles above weaving
    drawHeddles(ctx, margin, weaveW, visibleCols, cellSize)

    // Draw warp threads (vertical, faint background)
    ctx.strokeStyle = 'rgba(120, 80, 40, 0.05)'
    ctx.lineWidth = 0.5
    for (let col = 0; col < visibleCols; col++) {
      const x = margin + col * cellSize
      ctx.beginPath()
      ctx.moveTo(x, margin)
      ctx.lineTo(x, margin + weaveH)
      ctx.stroke()
    }

    // Draw weft threads (horizontal, colored by memory)
    for (let t = 0; t < threadCount; t++) {
      const mem = memories[t % memories.length]
      const y = margin + (t + 1) * threadSpacing
      const pattern = textToPattern(mem.originalText)
      const color = memoryToColor(mem)
      const isSelected = t === selectedThread
      const isSnapped = t === snappedThread

      if (isSnapped) continue // Thread temporarily invisible

      // Glow for selected thread
      if (isSelected) {
        ctx.save()
        ctx.shadowColor = colorToString({ ...color, a: 1 })
        ctx.shadowBlur = 8
      }

      const drawAlpha = isSelected ? Math.min(1, color.a * 2) : color.a

      // Thread base line
      ctx.strokeStyle = colorToString({ ...color, a: drawAlpha })
      ctx.lineWidth = Math.max(1, cellSize * 0.4)

      for (let col = 0; col < visibleCols; col++) {
        const x = margin + col * cellSize
        const patIdx = col % pattern.length
        let isOver = pattern[patIdx] === 1

        // Spirit line: at the spirit column, invert the pattern (the deliberate flaw)
        if (col === spiritLineCol) {
          isOver = !isOver
        }

        // Hue gradient along thread length
        const hueShift = Math.sin(col * 0.05) * 8
        const gradColor = { ...color, h: color.h + hueShift, a: drawAlpha }

        // Degraded memories have gaps — draw frayed ends at gap boundaries
        if (mem.degradation > 0.3) {
          // Use deterministic check instead of random for stable rendering
          const gapSeed = seededRandom(t * 10000 + col)
          if (gapSeed() < mem.degradation * 0.3) {
            // Draw frayed end at gap
            drawFrayedEnds(ctx, mem, x, y, cellSize, t, col)
            continue // skip this cell — frayed thread
          }
        }

        ctx.strokeStyle = colorToString(gradColor)

        if (isOver) {
          // Weft on top — draw a slightly raised segment
          ctx.beginPath()
          ctx.moveTo(x, y - 1)
          ctx.lineTo(x + cellSize, y - 1)
          ctx.stroke()
        } else {
          // Weft below — draw dimmer
          ctx.globalAlpha = 0.4
          ctx.beginPath()
          ctx.moveTo(x, y + 1)
          ctx.lineTo(x + cellSize, y + 1)
          ctx.stroke()
          ctx.globalAlpha = 1
        }
      }

      if (isSelected) {
        ctx.restore()
      }

      // Memory label at left
      if (t < 20) {
        ctx.font = '11px "Cormorant Garamond", serif'
        ctx.fillStyle = colorToString(color)
        ctx.textAlign = 'right'
        ctx.globalAlpha = isSelected ? 0.8 : 0.5
        const label = mem.currentText.slice(0, 15).trim()
        ctx.fillText(label, margin - 14, y + 3)
        ctx.globalAlpha = 1
      }
    }

    // Intersection pearl nodes
    drawIntersectionNodes(ctx, memories, margin, threadCount, threadSpacing, visibleCols, cellSize)

    // --- Loose fibers: spawn from degraded threads ---
    if (looseFibers.length < 20) {
      for (let t = 0; t < threadCount; t++) {
        const mem = memories[t % memories.length]
        if (mem.degradation > 0.5 && Math.random() < 0.0008 * mem.degradation) {
          const color = memoryToColor(mem)
          const y = margin + (t + 1) * threadSpacing
          const x = margin + Math.random() * Math.min(visibleCols * cellSize, weaveW)
          looseFibers.push({
            x, y,
            vx: (Math.random() - 0.5) * 0.15,
            vy: 0.1 + Math.random() * 0.2,
            alpha: 0.15 + Math.random() * 0.1,
            length: 4 + Math.random() * 6,
            angle: Math.random() * Math.PI,
            rotSpeed: (Math.random() - 0.5) * 0.02,
            hue: color.h,
          })
        }
      }
    }

    // Update and draw loose fibers
    for (let i = looseFibers.length - 1; i >= 0; i--) {
      const f = looseFibers[i]
      f.x += f.vx + Math.sin(time * 0.8 + f.y * 0.01) * 0.1
      f.y += f.vy
      f.angle += f.rotSpeed
      f.alpha -= 0.0004
      if (f.alpha <= 0 || f.y > h) {
        looseFibers.splice(i, 1)
        continue
      }
      ctx.save()
      ctx.translate(f.x, f.y)
      ctx.rotate(f.angle)
      ctx.strokeStyle = `hsla(${f.hue}, 30%, 40%, ${f.alpha})`
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(-f.length / 2, 0)
      ctx.lineTo(f.length / 2, 0)
      ctx.stroke()
      ctx.restore()
    }

    // --- Shuttle trail ---
    if (visibleCols < maxCols) {
      const sx = margin + Math.min(shuttleX, visibleCols * cellSize)
      const sy = margin + weaveH / 2
      shuttleTrail.push({ x: sx, y: sy, alpha: 0.15 })
    }
    for (let i = shuttleTrail.length - 1; i >= 0; i--) {
      shuttleTrail[i].alpha -= 0.003
      if (shuttleTrail[i].alpha <= 0) {
        shuttleTrail.splice(i, 1)
        continue
      }
      const st = shuttleTrail[i]
      ctx.beginPath()
      ctx.arc(st.x, st.y, 2, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(200, 160, 80, ${st.alpha})`
      ctx.fill()
    }
    if (shuttleTrail.length > 60) shuttleTrail.splice(0, 15)

    // --- Warp thread vibration at high tension ---
    if (tension > 0.5) {
      const vibIntensity = (tension - 0.5) * 2 // 0 to 1
      ctx.strokeStyle = `rgba(120, 80, 40, ${0.03 + vibIntensity * 0.03})`
      ctx.lineWidth = 0.3
      for (let col = 0; col < visibleCols; col += 2) {
        const baseX = margin + col * cellSize
        ctx.beginPath()
        ctx.moveTo(baseX, margin)
        for (let py = margin; py < margin + weaveH; py += 6) {
          const vib = Math.sin(time * 12 + col * 0.7 + py * 0.03) * vibIntensity * 1.5
          ctx.lineTo(baseX + vib, py)
        }
        ctx.stroke()
      }
    }

    // --- Spirit line indicator ---
    if (spiritLineCol >= 0 && spiritLineCol < visibleCols) {
      const slx = margin + spiritLineCol * cellSize + cellSize / 2
      // Very faint vertical line with a subtle glow
      ctx.strokeStyle = `rgba(255, 200, 100, ${0.04 + Math.sin(time * 0.7) * 0.015})`
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(slx, margin)
      ctx.lineTo(slx, margin + weaveH)
      ctx.stroke()
      // Spirit line label (appears very faintly near top)
      ctx.font = '8px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(255, 200, 100, ${0.04 + Math.sin(time * 0.5) * 0.01})`
      ctx.textAlign = 'center'
      ctx.fillText('spirit line', slx, margin - 8)
    }

    // --- Thread whisper: show memory text flowing along hovered thread ---
    if (hoveredThread >= 0 && hoveredThread < threadCount) {
      whisperOffset += 0.5
      const mem = memories[hoveredThread % memories.length]
      const txt = mem.currentText || mem.originalText
      const ty = margin + (hoveredThread + 1) * threadSpacing
      ctx.font = '9px monospace'
      ctx.textAlign = 'left'
      const charW = 7
      for (let ci = 0; ci < txt.length; ci++) {
        const cx = margin + ((ci * charW + whisperOffset) % Math.max(1, visibleCols * cellSize))
        if (cx > margin + visibleCols * cellSize) continue
        const fadeEdge = Math.min(
          (cx - margin) / 30,
          (margin + visibleCols * cellSize - cx) / 30,
          1
        )
        const alpha = Math.max(0, 0.25 * fadeEdge)
        const color = memoryToColor(mem)
        ctx.fillStyle = `hsla(${color.h}, ${color.s}%, ${Math.min(70, color.l + 20)}%, ${alpha})`
        ctx.fillText(txt[ci], cx, ty - 6)
      }
    } else {
      whisperOffset = 0
    }

    // --- Patina: warm aging tint over completed weave area ---
    if (visibleCols > 20) {
      patinaAge = Math.min(1, patinaAge + 0.0001)
      if (patinaAge > 0.01) {
        const patinaAlpha = patinaAge * 0.03
        ctx.fillStyle = `rgba(120, 90, 50, ${patinaAlpha})`
        ctx.fillRect(margin, margin, visibleCols * cellSize, weaveH)
      }
    }

    // Shuttle animation
    if (visibleCols < maxCols) {
      shuttleX += shuttleDir * shuttleSpeed
      if (shuttleX > weaveW) {
        if (shuttleDir === 1) {
          playShuttleClick()
        }
        shuttleDir = -1
        shuttleX = weaveW
      }
      if (shuttleX < 0) {
        if (shuttleDir === -1) {
          playShuttleClick()
        }
        shuttleDir = 1
        shuttleX = 0
      }

      // Track direction changes for audio
      if (shuttleDir !== prevShuttleDir) {
        prevShuttleDir = shuttleDir
      }

      // Draw shuttle
      const sx = margin + Math.min(shuttleX, visibleCols * cellSize)
      const sy = margin + weaveH / 2
      ctx.fillStyle = 'rgba(200, 160, 80, 0.3)'
      ctx.fillRect(sx - 8, sy - 3, 16, 6)
      ctx.fillStyle = 'rgba(200, 160, 80, 0.6)'
      ctx.fillRect(sx - 2, sy - 1, 4, 2)
    }

    // Tension meter (right side)
    const meterX = margin + weaveW + 14
    const meterY = margin + 20
    const meterH = weaveH - 40
    drawTensionMeter(ctx, meterX, meterY, meterH, tension)

    // Title
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(180, 140, 100, 0.15)'
    ctx.textAlign = 'center'
    ctx.fillText('the loom', w / 2, margin - 30)

    // Stats
    const intact = memories.filter(m => m.degradation < 0.3).length
    const fraying = memories.filter(m => m.degradation >= 0.3 && m.degradation < 0.7).length
    const broken = memories.filter(m => m.degradation >= 0.7).length
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(180, 140, 100, 0.1)'
    ctx.textAlign = 'left'
    ctx.fillText(
      `${memories.length} threads · ${intact} intact · ${fraying} fraying · ${broken} broken`,
      margin, h - margin / 2 + 10
    )

    // Weaving complete indicator
    if (visibleCols >= maxCols) {
      ctx.font = '12px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(180, 140, 100, 0.12)'
      ctx.textAlign = 'center'
      ctx.fillText('the textile is complete', w / 2, h - margin / 2 + 10)
    }

    // Pull-thread navigation (loose threads hanging from right edge of weaving)
    if (deps.switchTo) {
      const rightEdgeX = margin + Math.min(visibleCols * cellSize, weaveW)
      const threadSpacingNav = weaveH / (navThreads.length + 1)

      // Flash effect
      if (navThreadFlash >= 0) {
        navThreadFlashTimer -= 0.016
        if (navThreadFlashTimer <= 0) {
          navThreadFlash = -1
        }
      }

      for (let i = 0; i < navThreads.length; i++) {
        const nt = navThreads[i]
        const anchorY = margin + (i + 1) * threadSpacingNav
        const [r, g, b] = nt.color
        const isHovered = hoveredNavThread === i
        const isPulling = pullingNavThread === i
        const isFlashing = navThreadFlash === i

        // Calculate thread droop - catenary curve
        const baseHangLen = 80
        const hangX = rightEdgeX + 40  // horizontal extent to the right
        let droopAmount = baseHangLen  // vertical droop

        // When pulling, reduce droop (thread tightens)
        let pullDist = 0
        if (isPulling) {
          pullDist = pullCurrentY - pullStartY
          if (pullDist > 0) {
            droopAmount = Math.max(20, baseHangLen - pullDist * 0.8)
          }
        } else if (isHovered) {
          droopAmount = baseHangLen - 15  // slight tightening on hover
        }

        // Sway animation
        const swayPhase = time * 0.8 + i * 1.5
        const swayAmount = isPulling ? 1 : (isHovered ? 2 : 4)

        // Draw the catenary thread as a bezier curve
        const endX = hangX
        const endY = anchorY + droopAmount
        const cpSag = droopAmount * 0.7 // control point sag

        // Thread glow when hovered, pulling, or flashing
        const needsGlow = isHovered || isPulling || isFlashing
        if (needsGlow) {
          ctx.save()
          if (isFlashing) {
            const flashAlpha = navThreadFlashTimer / 0.3
            ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${flashAlpha})`
            ctx.shadowBlur = 20
          } else {
            ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.6)`
            ctx.shadowBlur = isPulling ? 12 : 6
          }
        }

        const alpha = isHovered || isPulling ? 0.7 : 0.35
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
        ctx.lineWidth = isPulling ? 2.5 : (isHovered ? 2 : 1.5)

        ctx.beginPath()
        ctx.moveTo(rightEdgeX, anchorY)
        // Bezier curve: anchor -> control point with sag -> end
        const midX = (rightEdgeX + endX) / 2 + Math.sin(swayPhase) * swayAmount
        const midY = anchorY + cpSag + Math.sin(swayPhase * 0.7) * swayAmount
        ctx.quadraticCurveTo(midX, midY, endX, endY + Math.sin(swayPhase * 0.5) * swayAmount)
        ctx.stroke()

        // Small fibers at the loose end
        const looseEndX = endX
        const looseEndY = endY + Math.sin(swayPhase * 0.5) * swayAmount
        const fiberAlpha = isHovered || isPulling ? 0.5 : 0.2
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${fiberAlpha})`
        ctx.lineWidth = 0.5
        for (let f = 0; f < 3; f++) {
          const fAngle = (-0.3 + f * 0.3) + Math.sin(swayPhase + f) * 0.15
          const fLen = 6 + Math.sin(time * 1.2 + f * 2) * 2
          ctx.beginPath()
          ctx.moveTo(looseEndX, looseEndY)
          ctx.lineTo(
            looseEndX + Math.cos(fAngle + Math.PI * 0.5) * fLen,
            looseEndY + Math.sin(fAngle + Math.PI * 0.5) * fLen
          )
          ctx.stroke()
        }

        if (needsGlow) {
          ctx.restore()
        }

        // Pull progress indicator (subtle line showing threshold)
        if (isPulling && pullDist > 0) {
          const progress = Math.min(1, pullDist / 60)
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${progress * 0.3})`
          ctx.fillRect(endX - 15, looseEndY + 4, 30 * progress, 1)
        }

        // Label at the loose end
        const labelAlpha = isHovered || isPulling ? 0.6 : 0.12
        ctx.font = '11px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${labelAlpha})`
        ctx.textAlign = 'center'
        ctx.fillText(nt.label, looseEndX, looseEndY + 16)
      }
    }

    // Cultural inscriptions
    inscriptionTimer += 0.016
    if (inscriptionTimer >= 24) {
      inscriptionTimer = 0
      inscriptionIdx = (inscriptionIdx + 1) % CULTURAL_INSCRIPTIONS.length
    }
    const insText = CULTURAL_INSCRIPTIONS[inscriptionIdx]
    ctx.font = '11px "Cormorant Garamond", serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(180, 140, 100, 0.03)'
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

  // --- Hit testing ---

  function hitTestThread(clientX: number, clientY: number): number {
    const hitThreshold = 8
    for (let t = 0; t < threadYPositions.length; t++) {
      const ty = threadYPositions[t]
      if (Math.abs(clientY - ty) < hitThreshold &&
          clientX >= threadMargin && clientX <= threadMargin + threadWeaveW) {
        return t
      }
    }
    return -1
  }

  function getNavThreadLooseEnd(i: number): { x: number; y: number } | null {
    if (!canvas) return null
    const memories = deps.getMemories()
    if (memories.length === 0) return null
    const margin = 60
    const weaveW = canvas.width - margin * 2 - 20
    const weaveH = canvas.height - margin * 2
    const cellSize = Math.max(4, Math.min(12, weaveW / 80))
    const maxCols = Math.floor(weaveW / cellSize)
    const visibleCols = Math.min(Math.floor(weavingProgress), maxCols)
    const rightEdgeX = margin + Math.min(visibleCols * cellSize, weaveW)
    const threadSpacingNav = weaveH / (navThreads.length + 1)

    const anchorY = margin + (i + 1) * threadSpacingNav
    const baseHangLen = 80
    const hangX = rightEdgeX + 40
    let droopAmount = baseHangLen
    if (pullingNavThread === i) {
      const pullDist = pullCurrentY - pullStartY
      if (pullDist > 0) {
        droopAmount = Math.max(20, baseHangLen - pullDist * 0.8)
      }
    } else if (hoveredNavThread === i) {
      droopAmount = baseHangLen - 15
    }
    const swayPhase = time * 0.8 + i * 1.5
    const swayAmount = pullingNavThread === i ? 1 : (hoveredNavThread === i ? 2 : 4)
    const endY = anchorY + droopAmount + Math.sin(swayPhase * 0.5) * swayAmount
    return { x: hangX, y: endY }
  }

  function hitTestNavThread(clientX: number, clientY: number): number {
    const hitRadius = 20
    for (let i = 0; i < navThreads.length; i++) {
      const pos = getNavThreadLooseEnd(i)
      if (!pos) continue
      const dx = clientX - pos.x
      const dy = clientY - pos.y
      if (dx * dx + dy * dy < hitRadius * hitRadius) return i
    }
    return -1
  }

  return {
    name: 'loom',
    label: 'the loom',

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        width: 100%; height: 100%;
        pointer-events: auto;
        background: #000;
        position: relative;
      `

      canvas = document.createElement('canvas')
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      canvas.style.cssText = 'width: 100%; height: 100%;'
      ctx = canvas.getContext('2d')

      // Click handler: thread examine (nav threads use mousedown/mousemove/mouseup)
      canvas.addEventListener('click', (e) => {
        if (!canvas) return
        // If we were pulling a nav thread, don't also examine
        if (pullingNavThread >= 0) return

        // Check thread click for examine
        const memories = deps.getMemories()
        const threadIdx = hitTestThread(e.clientX, e.clientY)
        if (threadIdx >= 0 && threadIdx < memories.length) {
          selectedThread = threadIdx
          showExamineOverlay(memories[threadIdx])
        } else {
          dismissExamineOverlay()
        }
      })

      // Pull-thread navigation: mousedown starts pull
      canvas.addEventListener('mousedown', (e) => {
        if (!canvas || !deps.switchTo) return
        const navIdx = hitTestNavThread(e.clientX, e.clientY)
        if (navIdx >= 0) {
          pullingNavThread = navIdx
          pullStartY = e.clientY
          pullCurrentY = e.clientY
          e.preventDefault()
        }
      })

      // mousemove: update hover state and pull distance
      canvas.addEventListener('mousemove', (e) => {
        if (!canvas) return

        // Update pull if actively pulling
        if (pullingNavThread >= 0) {
          pullCurrentY = e.clientY
          const pullDist = pullCurrentY - pullStartY
          // Check if pull threshold met (60px downward)
          if (pullDist >= 60 && deps.switchTo) {
            const room = navThreads[pullingNavThread].room
            // Flash effect
            navThreadFlash = pullingNavThread
            navThreadFlashTimer = 0.3
            pullingNavThread = -1
            // Navigate after brief flash
            setTimeout(() => {
              deps.switchTo!(room)
            }, 150)
          }
          canvas.style.cursor = 'grabbing'
          return
        }

        // Hover detection for nav threads
        hoveredNavThread = -1
        const navIdx = hitTestNavThread(e.clientX, e.clientY)
        if (navIdx >= 0) {
          hoveredNavThread = navIdx
          canvas.style.cursor = 'grab'
          return
        }

        // Check weaving thread hover
        const threadIdx = hitTestThread(e.clientX, e.clientY)
        hoveredThread = threadIdx
        canvas.style.cursor = threadIdx >= 0 ? 'pointer' : 'default'
      })

      // mouseup: cancel pull if threshold not met
      canvas.addEventListener('mouseup', () => {
        pullingNavThread = -1
      })

      // mouseleave: cancel pull
      canvas.addEventListener('mouseleave', () => {
        pullingNavThread = -1
        hoveredNavThread = -1
        hoveredThread = -1
      })

      overlay.appendChild(canvas)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      return overlay
    },

    activate() {
      active = true
      weavingProgress = 0
      shuttleX = 0
      shuttleDir = 1
      prevShuttleDir = 1
      heddlePhases = []
      snapTimer = 10 + Math.random() * 10
      snappedThread = -1
      hoveredThread = -1
      whisperOffset = 0
      patinaAge = 0
      looseFibers = []
      shuttleTrail = []
      // Spirit line: place at ~70% of the way through the weave (Navajo tradition)
      const weaveW = (canvas?.width || window.innerWidth) - 60 * 2 - 20
      const cs = Math.max(4, Math.min(12, weaveW / 80))
      const maxCols = Math.floor(weaveW / cs)
      spiritLineCol = Math.floor(maxCols * 0.7) + Math.floor(Math.random() * 5)
      initAudio()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      dismissExamineOverlay()
      destroyAudio()
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      dismissExamineOverlay()
      destroyAudio()
      overlay?.remove()
    },
  }
}
