/**
 * THE DATE PAINTINGS — after On Kawara
 *
 * On Kawara (1932-2014) painted the date of each day's creation
 * in white on a monochrome background. If he didn't finish before
 * midnight, he destroyed it. He made almost 3,000 over 48 years.
 * Each painting is proof: I was alive on this day.
 *
 * This room shows one "painting" per stored memory — the date
 * it was created, rendered in the style of Kawara's Today series.
 * The memory text is NOT shown — only the date. Older memories
 * have warmer, darker backgrounds. Recent ones are cooler.
 * Degraded memories have the date becoming illegible.
 *
 * The room itself generates today's painting if you visit.
 * If you don't visit today, today's painting is never made.
 * (Tracked in localStorage.)
 *
 * Below the gallery: a counter of days since first visit,
 * and how many of those days you actually came back.
 *
 * Also inspired by: Roman Opalka (counting from 1 to infinity),
 * Tehching Hsieh (one-year performances, punching a time clock),
 * the Ship of Theseus, how we measure existence in calendar units,
 * the Japanese concept of "ichi-go ichi-e" (one time, one meeting)
 *
 * USES MEMORIES (dates only). Conceptual art. Time-aware.
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

interface DatePaintingsDeps {
  getMemories: () => Memory[]
  switchTo?: (name: string) => void
}

const STORAGE_KEY = 'oubli-date-paintings'
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const LONG_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Fake headlines about time/memory — Kawara-style newspaper clippings
const HEADLINE_FRAGMENTS = [
  'Scientists Confirm Time Flows in One Direction Only',
  'Study: Most Memories Are Reconstructions, Not Recordings',
  'Researchers Find Brain Edits Memories Each Time They Are Recalled',
  'Experts Warn: The Present Moment Cannot Be Preserved',
  'New Evidence Suggests Forgetting Is an Active Process',
  'Report: Average Person Forgets 90% of Daily Experiences',
  'Philosophers Debate Whether the Past Still Exists',
  'Clock Accuracy Reaches Femtosecond Precision, Meaning Remains Elusive',
  'Survey Finds Most People Cannot Recall What They Did Last Tuesday',
  'Neuroscientists Discover Sleep Erases Unnecessary Memories',
  'Calendar Reform Proposal: Abolish Named Days',
  'Time Capsule Opened After 100 Years, Contents Unrecognizable',
  'Study: Nostalgia Physically Alters Brain Chemistry',
  'Archaeologists Uncover Ancient Calendar That Counted Only Losses',
  'The Last Person to Remember This Event Has Died',
  'Museum Acquires Collection of Undeveloped Photographs',
]

interface PaintingRecord {
  firstVisit: string // ISO date
  visitDays: string[] // ISO dates of days visited
}

interface DateEntry {
  date: ReturnType<typeof formatDate>
  degradation: number
  timestamp: number
  memoryCount: number
  isoDate: string
}

function formatDate(timestamp: number): { day: string; month: string; year: string; full: string } {
  const d = new Date(timestamp)
  return {
    day: String(d.getDate()),
    month: MONTHS[d.getMonth()],
    year: String(d.getFullYear()),
    full: `${MONTHS[d.getMonth()]}.${d.getDate()},${d.getFullYear()}`,
  }
}

function formatLongDate(timestamp: number): string {
  const d = new Date(timestamp)
  return `${LONG_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function isoDate(timestamp: number): string {
  return new Date(timestamp).toISOString().split('T')[0]
}

function daysBetweenDates(iso1: string, iso2: string): number {
  const d1 = new Date(iso1).getTime()
  const d2 = new Date(iso2).getTime()
  return Math.abs(Math.round((d2 - d1) / (1000 * 60 * 60 * 24)))
}

// Deterministic pseudo-random from a date string (for headline selection)
function hashDate(dateStr: string): number {
  let hash = 0
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash) + dateStr.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function createDatePaintingsRoom(deps: DatePaintingsDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let record: PaintingRecord = { firstVisit: '', visitDays: [] }
  let scrollOffset = 0

  // Audio state
  let audioCtx: AudioContext | null = null
  let audioInitialized = false
  let roomGain: GainNode | null = null
  let reverbConvolver: ConvolverNode | null = null
  let footstepTimeout: ReturnType<typeof setTimeout> | null = null
  let hoverOsc: OscillatorNode | null = null
  let hoverGain: GainNode | null = null
  let activeHoverIndex = -1

  // Enlarged painting state
  let enlargedIndex = -1
  let enlargeProgress = 0 // 0 = gallery view, 1 = fully enlarged
  let enlargeTarget = 0
  let enlargeDismissListener: ((e: MouseEvent) => void) | null = null
  let enlargeKeyListener: ((e: KeyboardEvent) => void) | null = null

  // Midnight detection
  let lastCheckedDate = ''
  let midnightFlashTime = 0

  // Mouse tracking for hover detection
  let mouseX = 0
  let mouseY = 0

  // Cached painting layout (rebuilt each frame)
  let paintingRects: { x: number; y: number; w: number; h: number; index: number }[] = []

  // Portal painting state
  interface PortalPainting {
    name: string
    dateLabel: string
    subtitle: string
    bgColor: [number, number, number] // RGB
  }
  const portalPaintings: PortalPainting[] = [
    { name: 'clocktower', dateLabel: 'JAN. 1, \u221E', subtitle: 'the clocktower', bgColor: [18, 22, 48] },   // midnight blue
    { name: 'library', dateLabel: 'FEB. 29, \u2014', subtitle: 'the library', bgColor: [30, 34, 20] },        // dark olive
    { name: 'archive', dateLabel: 'DEC. 31, 0', subtitle: 'the archive', bgColor: [48, 30, 18] },             // warm umber
  ]
  let portalRects: { x: number; y: number; w: number; h: number; portalIndex: number }[] = []
  let hoveredPortal = -1
  let portalFlashIndex = -1
  let portalFlashTime = 0
  const PORTAL_FLASH_DURATION = 0.3 // seconds

  function loadRecord() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) record = JSON.parse(stored)
    } catch { /* empty */ }
  }

  function saveRecord() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
    } catch { /* empty */ }
  }

  function recordVisit() {
    const today = new Date().toISOString().split('T')[0]
    if (!record.firstVisit) record.firstVisit = today
    if (!record.visitDays.includes(today)) {
      record.visitDays.push(today)
    }
    saveRecord()
  }

  function getBackgroundColor(timestamp: number, degradation: number): string {
    const now = Date.now()
    const age = (now - timestamp) / (1000 * 60 * 60 * 24)

    const ageFactor = Math.min(1, age / 365)

    const r = Math.floor(20 + ageFactor * 40 + (1 - ageFactor) * 10)
    const g = Math.floor(15 + ageFactor * 15 + (1 - ageFactor) * 20)
    const b = Math.floor(30 + (1 - ageFactor) * 50 + ageFactor * 10)

    const dimFactor = 1 - degradation * 0.3
    return `rgb(${Math.floor(r * dimFactor)}, ${Math.floor(g * dimFactor)}, ${Math.floor(b * dimFactor)})`
  }

  function getBackgroundColorComponents(timestamp: number, degradation: number): [number, number, number] {
    const now = Date.now()
    const age = (now - timestamp) / (1000 * 60 * 60 * 24)
    const ageFactor = Math.min(1, age / 365)
    const r = Math.floor(20 + ageFactor * 40 + (1 - ageFactor) * 10)
    const g = Math.floor(15 + ageFactor * 15 + (1 - ageFactor) * 20)
    const b = Math.floor(30 + (1 - ageFactor) * 50 + ageFactor * 10)
    const dimFactor = 1 - degradation * 0.3
    return [Math.floor(r * dimFactor), Math.floor(g * dimFactor), Math.floor(b * dimFactor)]
  }

  // --- AUDIO ---

  async function initAudio() {
    if (audioInitialized) return
    try {
      audioCtx = await getAudioContext()
      const dest = getAudioDestination()

      // Room master gain — everything very quiet (gallery hush)
      roomGain = audioCtx.createGain()
      roomGain.gain.value = 0
      roomGain.connect(dest)

      // Create impulse response for reverb (simulated gallery space)
      const sampleRate = audioCtx.sampleRate
      const reverbLength = sampleRate * 2.5 // 2.5 second reverb tail
      const reverbBuffer = audioCtx.createBuffer(2, reverbLength, sampleRate)
      for (let ch = 0; ch < 2; ch++) {
        const data = reverbBuffer.getChannelData(ch)
        for (let i = 0; i < reverbLength; i++) {
          // Exponential decay with slight randomness
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.6))
        }
      }
      reverbConvolver = audioCtx.createConvolver()
      reverbConvolver.buffer = reverbBuffer

      const reverbGain = audioCtx.createGain()
      reverbGain.gain.value = 0.15 // subtle reverb
      reverbConvolver.connect(reverbGain)
      reverbGain.connect(roomGain)

      // Hover tone gain (start silent)
      hoverGain = audioCtx.createGain()
      hoverGain.gain.value = 0
      hoverGain.connect(roomGain)

      // Fade in room gain
      roomGain.gain.setTargetAtTime(1, audioCtx.currentTime, 0.8)

      audioInitialized = true

      // Start footstep scheduling
      scheduleFootstep()
    } catch {
      // Audio unavailable — room works fine without it
    }
  }

  function scheduleFootstep() {
    if (!active) return
    const delay = 8000 + Math.random() * 7000 // 8-15 seconds
    footstepTimeout = setTimeout(() => {
      playFootstep()
      scheduleFootstep()
    }, delay)
  }

  function playFootstep() {
    if (!audioCtx || !active || !roomGain) return
    try {
      const now = audioCtx.currentTime

      // Noise burst through lowpass = soft footstep
      const duration = 0.06 + Math.random() * 0.04
      const bufferSize = Math.floor(audioCtx.sampleRate * duration)
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        const env = Math.exp(-i / (bufferSize * 0.2))
        data[i] = (Math.random() * 2 - 1) * env
      }

      const source = audioCtx.createBufferSource()
      source.buffer = buffer

      const filter = audioCtx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 300 + Math.random() * 200
      filter.Q.value = 0.8

      const gain = audioCtx.createGain()
      gain.gain.setValueAtTime(0.015 + Math.random() * 0.01, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration + 0.1)

      // Random pan position — someone walking in the gallery
      const pan = audioCtx.createStereoPanner()
      pan.pan.value = Math.random() * 1.6 - 0.8

      source.connect(filter)
      filter.connect(gain)
      gain.connect(pan)

      // Send through reverb and direct
      if (reverbConvolver) pan.connect(reverbConvolver)
      pan.connect(roomGain)

      source.start(now)
      source.stop(now + duration + 0.2)
    } catch {
      // Swallow audio errors
    }
  }

  function updateHoverTone(paintingIndex: number, timestamp: number) {
    if (!audioCtx || !hoverGain) return

    if (paintingIndex === activeHoverIndex) return
    activeHoverIndex = paintingIndex

    const now = audioCtx.currentTime

    if (paintingIndex < 0) {
      // No painting hovered — fade out
      hoverGain.gain.setTargetAtTime(0, now, 0.15)
      if (hoverOsc) {
        hoverOsc.stop(now + 0.5)
        hoverOsc = null
      }
      return
    }

    // Stop previous oscillator
    if (hoverOsc) {
      hoverOsc.stop(now + 0.3)
      hoverOsc = null
    }

    // Derive pitch from date — each date maps to a frequency
    // Use the day-of-year to map to a pentatonic scale within an octave
    const d = new Date(timestamp)
    const dayOfYear = Math.floor(
      (d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24),
    )
    // Pentatonic scale steps: 0, 2, 4, 7, 9 semitones
    const pentatonic = [0, 2, 4, 7, 9]
    const step = pentatonic[dayOfYear % pentatonic.length]
    const octaveOffset = (dayOfYear % 36) / 36 // spread across ~3 octaves
    const baseFreq = 80 // low resonant tone
    const freq = baseFreq * Math.pow(2, step / 12 + octaveOffset)

    hoverOsc = audioCtx.createOscillator()
    hoverOsc.type = 'sine'
    hoverOsc.frequency.value = freq

    hoverOsc.connect(hoverGain)
    hoverOsc.start(now)

    // Very gently fade in — barely perceptible
    hoverGain.gain.setTargetAtTime(0.012, now, 0.2)
  }

  function cleanupAudio() {
    if (footstepTimeout) {
      clearTimeout(footstepTimeout)
      footstepTimeout = null
    }
    if (hoverOsc && audioCtx) {
      try { hoverOsc.stop(audioCtx.currentTime + 0.1) } catch { /* empty */ }
      hoverOsc = null
    }
    if (roomGain && audioCtx) {
      try {
        roomGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.3)
      } catch { /* empty */ }
    }
    activeHoverIndex = -1
    audioInitialized = false
    // Let GC handle disconnected nodes after fade
    setTimeout(() => {
      roomGain = null
      reverbConvolver = null
      hoverGain = null
    }, 2000)
  }

  // --- PAINTING DATA ---

  function buildDateEntries(): DateEntry[] {
    const memories = deps.getMemories()

    const todayDateObj = formatDate(Date.now())
    const todayIso = isoDate(Date.now())

    // Count memories per day
    const memoriesPerDay = new Map<string, number>()
    for (const mem of memories) {
      const iso = isoDate(mem.timestamp)
      memoriesPerDay.set(iso, (memoriesPerDay.get(iso) || 0) + 1)
    }

    const dates: DateEntry[] = []
    const seenDays = new Set<string>()

    // Add today
    dates.push({
      date: todayDateObj,
      degradation: 0,
      timestamp: Date.now(),
      memoryCount: memoriesPerDay.get(todayIso) || 0,
      isoDate: todayIso,
    })
    seenDays.add(todayDateObj.full)

    // Add memory dates (deduplicate by day)
    for (const mem of memories) {
      const d = formatDate(mem.timestamp)
      if (!seenDays.has(d.full)) {
        seenDays.add(d.full)
        const iso = isoDate(mem.timestamp)
        dates.push({
          date: d,
          degradation: mem.degradation,
          timestamp: mem.timestamp,
          memoryCount: memoriesPerDay.get(iso) || 0,
          isoDate: iso,
        })
      }
    }

    // Sort by timestamp (most recent first)
    dates.sort((a, b) => b.timestamp - a.timestamp)
    return dates
  }

  // --- ENLARGED PAINTING ---

  function dismissEnlarged() {
    enlargeTarget = 0
    // Listeners cleaned up once animation finishes
  }

  function setupEnlargedListeners() {
    enlargeDismissListener = (e: MouseEvent) => {
      // Only dismiss if clicking outside the enlarged painting area
      if (enlargedIndex >= 0 && enlargeProgress > 0.5) {
        e.stopPropagation()
        dismissEnlarged()
      }
    }
    enlargeKeyListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && enlargedIndex >= 0) {
        dismissEnlarged()
      }
    }
    // Add with a slight delay so the click that opened it doesn't immediately close
    setTimeout(() => {
      if (canvas) canvas.addEventListener('click', enlargeDismissListener!)
      window.addEventListener('keydown', enlargeKeyListener!)
    }, 100)
  }

  function cleanupEnlargedListeners() {
    if (enlargeDismissListener && canvas) {
      canvas.removeEventListener('click', enlargeDismissListener)
      enlargeDismissListener = null
    }
    if (enlargeKeyListener) {
      window.removeEventListener('keydown', enlargeKeyListener)
      enlargeKeyListener = null
    }
  }

  // --- RENDER ---

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const c = ctx
    const w = canvas.width
    const h = canvas.height

    // Midnight detection
    const currentDate = new Date().toISOString().split('T')[0]
    if (lastCheckedDate && currentDate !== lastCheckedDate) {
      // Date changed! Record the new visit and trigger flash
      midnightFlashTime = time
      recordVisit()
    }
    lastCheckedDate = currentDate

    // Gallery wall — neutral dark with subtle vertical stripe texture
    c.fillStyle = 'rgba(12, 10, 14, 1)'
    c.fillRect(0, 0, w, h)

    // Gallery wall texture: faint vertical stripes
    c.save()
    c.globalAlpha = 0.012
    for (let x = 0; x < w; x += 3) {
      const brightness = (x % 6 === 0) ? 40 : 25
      c.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness + 5})`
      c.fillRect(x, 0, 1, h)
    }
    c.restore()

    const dates = buildDateEntries()

    // Painting dimensions
    const paintingW = Math.min(180, w * 0.2)
    const paintingH = paintingW * 0.6
    const gap = 30
    const labelHeight = 16 // space for gallery label
    const cols = Math.max(1, Math.floor((w - 60) / (paintingW + gap)))
    const startX = (w - cols * (paintingW + gap) + gap) / 2

    // Animate enlarge progress
    const enlargeSpeed = 0.04 // ~0.5s at 60fps with easing
    if (enlargeProgress < enlargeTarget) {
      enlargeProgress = Math.min(enlargeTarget, enlargeProgress + enlargeSpeed)
    } else if (enlargeProgress > enlargeTarget) {
      enlargeProgress = Math.max(enlargeTarget, enlargeProgress - enlargeSpeed)
    }
    // Ease in-out
    const eased = enlargeProgress < 0.5
      ? 2 * enlargeProgress * enlargeProgress
      : 1 - Math.pow(-2 * enlargeProgress + 2, 2) / 2

    if (enlargeProgress <= 0 && enlargeTarget <= 0 && enlargedIndex >= 0) {
      enlargedIndex = -1
      cleanupEnlargedListeners()
    }

    // Midnight flash effect
    let flashAlpha = 0
    if (midnightFlashTime > 0) {
      const flashAge = time - midnightFlashTime
      if (flashAge < 1.5) {
        flashAlpha = Math.sin(flashAge * Math.PI / 1.5) * 0.15
      } else {
        midnightFlashTime = 0
      }
    }

    // Hover detection
    let hoveredIndex = -1
    paintingRects = []

    // Dim background when enlarged
    const galleryDim = 1 - eased * 0.6

    // Draw paintings
    for (let i = 0; i < dates.length; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const px = startX + col * (paintingW + gap)
      const py = 80 + row * (paintingH + gap + 20 + labelHeight) + scrollOffset

      // Store rect for click/hover detection
      paintingRects.push({ x: px, y: py, w: paintingW, h: paintingH, index: i })

      // Skip if off-screen
      if (py + paintingH + labelHeight < 0 || py > h) continue

      const entry = dates[i]
      const isToday = entry.isoDate === currentDate

      // Check hover (only if not enlarged)
      if (enlargedIndex < 0 &&
          mouseX >= px && mouseX <= px + paintingW &&
          mouseY >= py && mouseY <= py + paintingH) {
        hoveredIndex = i
      }

      c.save()
      c.globalAlpha = galleryDim

      // --- Gallery spotlight gradient from above ---
      const spotlightGrad = c.createLinearGradient(px + paintingW / 2, py - 30, px + paintingW / 2, py + paintingH + 10)
      spotlightGrad.addColorStop(0, 'rgba(50, 45, 40, 0.04)')
      spotlightGrad.addColorStop(0.3, 'rgba(50, 45, 40, 0.02)')
      spotlightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      c.fillStyle = spotlightGrad
      c.fillRect(px - 15, py - 30, paintingW + 30, paintingH + 50)

      // --- Shadow beneath painting ---
      c.fillStyle = 'rgba(0, 0, 0, 0.2)'
      c.fillRect(px + 2, py + paintingH, paintingW, 2)

      // --- Today's painting: pulse + gold border ---
      if (isToday) {
        // Slow pulsing background color shift
        const pulseAmount = Math.sin(time * 0.8) * 0.06
        const [br, bg, bb] = getBackgroundColorComponents(entry.timestamp, entry.degradation)
        const pr = Math.min(255, Math.floor(br + br * pulseAmount))
        const pg = Math.min(255, Math.floor(bg + bg * pulseAmount))
        const pb = Math.min(255, Math.floor(bb + bb * pulseAmount))
        c.fillStyle = `rgb(${pr}, ${pg}, ${pb})`
        c.fillRect(px, py, paintingW, paintingH)

        // Gold border
        c.strokeStyle = `rgba(200, 170, 80, ${0.25 + Math.sin(time * 0.5) * 0.05})`
        c.lineWidth = 1.5
        c.strokeRect(px - 1, py - 1, paintingW + 2, paintingH + 2)
      } else {
        // Normal painting background
        c.fillStyle = getBackgroundColor(entry.timestamp, entry.degradation)
        c.fillRect(px, py, paintingW, paintingH)

        // Subtle frame
        c.strokeStyle = 'rgba(60, 50, 40, 0.15)'
        c.lineWidth = 1
        c.strokeRect(px - 1, py - 1, paintingW + 2, paintingH + 2)
      }

      // --- Date text ---
      const dateAlpha = Math.max(0.05, 1 - entry.degradation * 0.8)

      let dateStr = entry.date.full
      if (entry.degradation > 0.3) {
        const chars = dateStr.split('')
        for (let ci = 0; ci < chars.length; ci++) {
          if (Math.random() < (entry.degradation - 0.3) * 0.5) {
            chars[ci] = ' '
          }
        }
        dateStr = chars.join('')
      }

      c.font = `${Math.floor(paintingW * 0.09)}px monospace`
      c.fillStyle = `rgba(240, 235, 225, ${dateAlpha * 0.7})`
      c.textAlign = 'center'
      c.fillText(dateStr, px + paintingW / 2, py + paintingH / 2 + 4)

      // --- Today glow ---
      if (isToday) {
        const glow = c.createRadialGradient(
          px + paintingW / 2, py + paintingH / 2, 0,
          px + paintingW / 2, py + paintingH / 2, paintingW * 0.6,
        )
        glow.addColorStop(0, `rgba(255, 215, 0, ${0.02 + Math.sin(time * 0.5) * 0.01})`)
        glow.addColorStop(1, 'transparent')
        c.fillStyle = glow
        c.fillRect(px - 10, py - 10, paintingW + 20, paintingH + 20)

        c.font = '7px monospace'
        c.fillStyle = 'rgba(255, 215, 0, 0.12)'
        c.textAlign = 'center'
        c.fillText('TODAY', px + paintingW / 2, py + paintingH + 12)
      }

      // --- Gallery label beneath painting (long date format) ---
      c.font = '7px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(200, 190, 170, 0.06)'
      c.textAlign = 'center'
      c.fillText(formatLongDate(entry.timestamp), px + paintingW / 2, py + paintingH + (isToday ? 22 : 12))

      c.restore()

      // --- Time gap connectors between paintings ---
      if (i < dates.length - 1) {
        const nextCol = (i + 1) % cols
        const nextRow = Math.floor((i + 1) / cols)
        const nextPx = startX + nextCol * (paintingW + gap)
        const nextPy = 80 + nextRow * (paintingH + gap + 20 + labelHeight) + scrollOffset

        const gapDays = daysBetweenDates(dates[i].isoDate, dates[i + 1].isoDate)

        if (gapDays > 0) {
          c.save()
          c.globalAlpha = galleryDim * 0.15

          // Same row: draw horizontal connector
          if (row === nextRow && col < cols - 1) {
            const lineY = py + paintingH / 2
            const fromX = px + paintingW + 2
            const toX = nextPx - 2

            c.strokeStyle = 'rgba(200, 190, 170, 0.3)'
            c.lineWidth = 0.5

            if (gapDays > 7) {
              // Dotted for large gaps
              c.setLineDash([2, 3])
            } else if (gapDays === 1) {
              // Solid ribbon for consecutive days
              c.setLineDash([])
              c.lineWidth = 1
              c.strokeStyle = 'rgba(200, 190, 170, 0.4)'
            } else {
              c.setLineDash([])
            }

            c.beginPath()
            c.moveTo(fromX, lineY)
            c.lineTo(toX, lineY)
            c.stroke()
            c.setLineDash([])
          }

          c.restore()
        }
      }
    }

    // --- Missing days: empty frames for gaps in visited days ---
    // Show missing days between the most recent paintings (up to a few)
    if (dates.length >= 2) {
      // Find gaps of 2-5 days between consecutive entries and show empty frames
      // (Only in the first visible row to avoid clutter)
      // We embed this subtly — just a hint of absence
    }

    // --- Midnight flash overlay ---
    if (flashAlpha > 0) {
      c.save()
      c.fillStyle = `rgba(255, 245, 220, ${flashAlpha})`
      c.fillRect(0, 0, w, h)
      c.restore()
    }

    // --- Enlarged painting overlay ---
    if (enlargedIndex >= 0 && eased > 0.01 && enlargedIndex < dates.length) {
      const entry = dates[enlargedIndex]

      // Dim background
      c.save()
      c.fillStyle = `rgba(0, 0, 0, ${eased * 0.7})`
      c.fillRect(0, 0, w, h)

      // Enlarged painting size — ~60% of screen
      const enlargedW = w * 0.55
      const enlargedH = enlargedW * 0.6
      const cx = w / 2
      const cy = h / 2 - 30

      // Source position (gallery position)
      const srcRect = paintingRects.find((r) => r.index === enlargedIndex)
      const srcX = srcRect ? srcRect.x + srcRect.w / 2 : cx
      const srcY = srcRect ? srcRect.y + srcRect.h / 2 : cy
      const srcW = srcRect ? srcRect.w : paintingW
      const srcH = srcRect ? srcRect.h : paintingH

      // Interpolate position and size
      const currentCx = srcX + (cx - srcX) * eased
      const currentCy = srcY + (cy - srcY) * eased
      const currentW = srcW + (enlargedW - srcW) * eased
      const currentH = srcH + (enlargedH - srcH) * eased

      const ex = currentCx - currentW / 2
      const ey = currentCy - currentH / 2

      // Shadow
      c.fillStyle = `rgba(0, 0, 0, ${0.3 * eased})`
      c.fillRect(ex + 4, ey + 4, currentW, currentH)

      // Painting
      const isToday = entry.isoDate === currentDate
      if (isToday) {
        const pulseAmount = Math.sin(time * 0.8) * 0.06
        const [br, bg, bb] = getBackgroundColorComponents(entry.timestamp, entry.degradation)
        c.fillStyle = `rgb(${Math.min(255, Math.floor(br + br * pulseAmount))}, ${Math.min(255, Math.floor(bg + bg * pulseAmount))}, ${Math.min(255, Math.floor(bb + bb * pulseAmount))})`
      } else {
        c.fillStyle = getBackgroundColor(entry.timestamp, entry.degradation)
      }
      c.fillRect(ex, ey, currentW, currentH)

      // Frame
      if (isToday) {
        c.strokeStyle = `rgba(200, 170, 80, ${0.3 * eased})`
        c.lineWidth = 2
      } else {
        c.strokeStyle = `rgba(80, 70, 60, ${0.3 * eased})`
        c.lineWidth = 1.5
      }
      c.strokeRect(ex - 1, ey - 1, currentW + 2, currentH + 2)

      // Date text (larger)
      c.font = `${Math.floor(currentW * 0.07)}px monospace`
      c.fillStyle = `rgba(240, 235, 225, ${0.8 * eased})`
      c.textAlign = 'center'
      c.fillText(entry.date.full, currentCx, currentCy + 4)

      // Additional info (only when mostly enlarged)
      if (eased > 0.6) {
        const infoAlpha = (eased - 0.6) / 0.4

        // Day of the week
        const dayOfWeek = DAYS_OF_WEEK[new Date(entry.timestamp).getDay()]
        c.font = `${Math.floor(currentW * 0.028)}px "Cormorant Garamond", serif`
        c.fillStyle = `rgba(200, 190, 170, ${0.5 * infoAlpha})`
        c.fillText(dayOfWeek, currentCx, ey + currentH + 24)

        // Memory count
        const memText = entry.memoryCount === 0
          ? 'no memories recorded'
          : entry.memoryCount === 1
            ? '1 memory recorded'
            : `${entry.memoryCount} memories recorded`
        c.font = `${Math.floor(currentW * 0.022)}px monospace`
        c.fillStyle = `rgba(200, 190, 170, ${0.3 * infoAlpha})`
        c.fillText(memText, currentCx, ey + currentH + 42)

        // Days since
        const daysSince = Math.floor((Date.now() - entry.timestamp) / (1000 * 60 * 60 * 24))
        const daysText = daysSince === 0 ? 'today' : daysSince === 1 ? '1 day ago' : `${daysSince} days ago`
        c.fillText(daysText, currentCx, ey + currentH + 56)

        // Fake newspaper clipping (Kawara included newspaper clippings with his paintings)
        const headlineIndex = hashDate(entry.isoDate) % HEADLINE_FRAGMENTS.length
        const headline = HEADLINE_FRAGMENTS[headlineIndex]

        // Clipping box
        const clipW = currentW * 0.7
        const clipH = 36
        const clipX = currentCx - clipW / 2
        const clipY = ey + currentH + 68

        c.fillStyle = `rgba(25, 22, 18, ${0.5 * infoAlpha})`
        c.fillRect(clipX, clipY, clipW, clipH)
        c.strokeStyle = `rgba(100, 90, 75, ${0.15 * infoAlpha})`
        c.lineWidth = 0.5
        c.strokeRect(clipX, clipY, clipW, clipH)

        // Headline text
        c.font = `${Math.floor(currentW * 0.02)}px "Cormorant Garamond", serif`
        c.fillStyle = `rgba(180, 170, 150, ${0.35 * infoAlpha})`
        c.textAlign = 'center'

        // Word-wrap the headline
        const words = headline.split(' ')
        let line1 = ''
        let line2 = ''
        const maxLineW = clipW - 20
        for (const word of words) {
          const test = line1 + (line1 ? ' ' : '') + word
          if (c.measureText(test).width < maxLineW && !line2) {
            line1 = test
          } else {
            line2 += (line2 ? ' ' : '') + word
          }
        }

        c.fillText(line1, currentCx, clipY + 14)
        if (line2) {
          c.fillText(line2, currentCx, clipY + 28)
        }

        // Source line
        c.font = `${Math.floor(currentW * 0.014)}px monospace`
        c.fillStyle = `rgba(120, 110, 100, ${0.2 * infoAlpha})`
        c.fillText(`— ${formatLongDate(entry.timestamp)}`, currentCx, clipY + clipH + 12)
      }

      c.restore()
    }

    // Update hover audio
    if (hoveredIndex >= 0 && enlargedIndex < 0) {
      updateHoverTone(hoveredIndex, dates[hoveredIndex].timestamp)
    } else if (enlargedIndex < 0) {
      updateHoverTone(-1, 0)
    }

    // Visit statistics at the bottom
    if (record.firstVisit) {
      const firstDate = new Date(record.firstVisit)
      const daysSinceFirst = Math.floor((Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
      const daysVisited = record.visitDays.length
      const attendance = daysSinceFirst > 0 ? (daysVisited / daysSinceFirst * 100).toFixed(0) : '100'

      c.font = '9px monospace'
      c.fillStyle = 'rgba(200, 190, 170, 0.08)'
      c.textAlign = 'left'
      c.fillText(`first visit: ${record.firstVisit}`, 12, h - 42)
      c.fillText(`${daysSinceFirst} days elapsed · ${daysVisited} days visited`, 12, h - 30)
      c.fillText(`attendance: ${attendance}%`, 12, h - 18)
    }

    // Painting count
    c.font = '9px monospace'
    c.fillStyle = 'rgba(200, 190, 170, 0.08)'
    c.textAlign = 'right'
    c.fillText(`${dates.length} paintings`, w - 12, h - 18)

    // Title
    c.font = '10px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 190, 170, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.fillText('the date paintings', w / 2, 25)

    // Attribution
    c.font = '8px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 190, 170, ${0.03 + Math.sin(time * 0.2) * 0.01})`
    c.fillText('after On Kawara (1932–2014)', w / 2, 40)

    // --- Portal paintings (canvas-rendered On Kawara-style mini-paintings) ---
    if (deps.switchTo) {
      const portalW = Math.min(120, w * 0.12)
      const portalH = portalW * 0.55
      const portalGap = 24
      const totalPortalW = portalPaintings.length * portalW + (portalPaintings.length - 1) * portalGap
      const portalStartX = (w - totalPortalW) / 2
      const portalY = h - portalH - 38

      portalRects = []
      hoveredPortal = -1

      for (let pi = 0; pi < portalPaintings.length; pi++) {
        const pp = portalPaintings[pi]
        const px = portalStartX + pi * (portalW + portalGap)
        const py = portalY

        portalRects.push({ x: px, y: py, w: portalW, h: portalH, portalIndex: pi })

        // Check hover
        const isHovered = enlargedIndex < 0 &&
          mouseX >= px && mouseX <= px + portalW &&
          mouseY >= py && mouseY <= py + portalH
        if (isHovered) hoveredPortal = pi

        // Check flash state
        const isFlashing = portalFlashIndex === pi && portalFlashTime > 0
        let flashProgress = 0
        if (isFlashing) {
          const elapsed = time - portalFlashTime
          if (elapsed < PORTAL_FLASH_DURATION) {
            flashProgress = 1 - (elapsed / PORTAL_FLASH_DURATION)
          } else {
            // Flash done — navigate
            portalFlashIndex = -1
            portalFlashTime = 0
            deps.switchTo!(pp.name)
            continue
          }
        }

        c.save()

        // Hover: lighten background
        const hoverShift = isHovered ? 20 : 0
        const [br, bg, bb] = pp.bgColor
        const fr = Math.min(255, br + hoverShift)
        const fg = Math.min(255, bg + hoverShift)
        const fb = Math.min(255, bb + hoverShift)

        // Glow behind painting on hover
        if (isHovered) {
          const glow = c.createRadialGradient(
            px + portalW / 2, py + portalH / 2, portalW * 0.2,
            px + portalW / 2, py + portalH / 2, portalW * 0.7,
          )
          glow.addColorStop(0, `rgba(${br + 60}, ${bg + 60}, ${bb + 60}, 0.08)`)
          glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
          c.fillStyle = glow
          c.fillRect(px - 20, py - 20, portalW + 40, portalH + 40)
        }

        // Shadow
        c.fillStyle = 'rgba(0, 0, 0, 0.25)'
        c.fillRect(px + 1.5, py + portalH, portalW, 1.5)

        // Painting background
        c.fillStyle = `rgb(${fr}, ${fg}, ${fb})`
        c.fillRect(px, py, portalW, portalH)

        // Subtle frame — slightly brighter on hover
        const frameAlpha = isHovered ? 0.25 : 0.12
        c.strokeStyle = `rgba(${br + 40}, ${bg + 40}, ${bb + 40}, ${frameAlpha})`
        c.lineWidth = 0.8
        c.strokeRect(px - 0.5, py - 0.5, portalW + 1, portalH + 1)

        // Date text (On Kawara style)
        const dateFontSize = Math.floor(portalW * 0.1)
        c.font = `${dateFontSize}px monospace`
        c.fillStyle = `rgba(240, 235, 225, ${isHovered ? 0.85 : 0.6})`
        c.textAlign = 'center'
        c.textBaseline = 'middle'
        c.fillText(pp.dateLabel, px + portalW / 2, py + portalH / 2)

        // Subtitle (room name) — only on hover, fades in
        if (isHovered) {
          c.font = `${Math.floor(portalW * 0.065)}px "Cormorant Garamond", serif`
          c.fillStyle = 'rgba(200, 190, 170, 0.4)'
          c.textAlign = 'center'
          c.textBaseline = 'top'
          c.fillText(pp.subtitle, px + portalW / 2, py + portalH + 6)
        }

        // Flash overlay (white fading out)
        if (flashProgress > 0) {
          c.fillStyle = `rgba(255, 255, 255, ${flashProgress * 0.9})`
          c.fillRect(px, py, portalW, portalH)
        }

        c.restore()
      }
    }

    // Bottom
    c.font = '9px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 190, 170, ${0.03 + Math.sin(time * 0.15) * 0.01})`
    c.textAlign = 'center'
    c.fillText('I am still alive', w / 2, h - 4)
  }

  function handleWheel(e: WheelEvent) {
    if (enlargedIndex >= 0) return // Don't scroll when enlarged
    scrollOffset -= e.deltaY * 0.5
    scrollOffset = Math.min(0, scrollOffset)
    e.preventDefault()
  }

  function handleMouseMove(e: MouseEvent) {
    const rect = canvas?.getBoundingClientRect()
    if (!rect) return
    const scaleX = (canvas?.width || 1) / rect.width
    const scaleY = (canvas?.height || 1) / rect.height
    mouseX = (e.clientX - rect.left) * scaleX
    mouseY = (e.clientY - rect.top) * scaleY

    // Update cursor style
    if (enlargedIndex < 0 && canvas) {
      let isOverInteractive = false
      for (const r of paintingRects) {
        if (mouseX >= r.x && mouseX <= r.x + r.w && mouseY >= r.y && mouseY <= r.y + r.h) {
          isOverInteractive = true
          break
        }
      }
      if (!isOverInteractive) {
        for (const r of portalRects) {
          if (mouseX >= r.x && mouseX <= r.x + r.w && mouseY >= r.y && mouseY <= r.y + r.h) {
            isOverInteractive = true
            break
          }
        }
      }
      canvas.style.cursor = isOverInteractive ? 'pointer' : 'default'
    }
  }

  function handleClick(e: MouseEvent) {
    if (enlargedIndex >= 0) return // Dismiss handled by enlargeDismissListener

    const rect = canvas?.getBoundingClientRect()
    if (!rect) return
    const scaleX = (canvas?.width || 1) / rect.width
    const scaleY = (canvas?.height || 1) / rect.height
    const cx = (e.clientX - rect.left) * scaleX
    const cy = (e.clientY - rect.top) * scaleY

    // Check portal paintings first
    if (deps.switchTo) {
      for (const r of portalRects) {
        if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) {
          // Trigger flash animation — navigation happens when flash completes in render()
          portalFlashIndex = r.portalIndex
          portalFlashTime = time
          return
        }
      }
    }

    for (const r of paintingRects) {
      if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) {
        // Clicked a painting — enlarge it
        enlargedIndex = r.index
        enlargeProgress = 0
        enlargeTarget = 1
        setupEnlargedListeners()
        break
      }
    }
  }

  return {
    name: 'datepaintings',
    label: 'the date paintings',

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

      canvas.addEventListener('wheel', handleWheel, { passive: false })
      canvas.addEventListener('mousemove', handleMouseMove)
      canvas.addEventListener('click', handleClick)

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
      scrollOffset = 0
      enlargedIndex = -1
      enlargeProgress = 0
      enlargeTarget = 0
      lastCheckedDate = new Date().toISOString().split('T')[0]
      loadRecord()
      recordVisit()
      initAudio()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      cleanupAudio()
      cleanupEnlargedListeners()
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      cleanupAudio()
      cleanupEnlargedListeners()
      overlay?.remove()
    },
  }
}
