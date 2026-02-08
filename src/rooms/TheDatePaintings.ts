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

// --- Wikimedia "On This Day" API types and cache ---

interface OnThisDayEvent {
  text: string
  year: number
  pages?: { title: string; extract?: string; thumbnail?: { source: string; width: number; height: number } }[]
}

// Session-level cache: keyed by "MM/DD" so same day never refetches
const onThisDayCache: Map<string, OnThisDayEvent[]> = new Map()
// Track loaded thumbnail images
const thumbnailCache: Map<string, HTMLImageElement> = new Map()

async function fetchOnThisDay(): Promise<OnThisDayEvent[]> {
  const now = new Date()
  const month = String(now.getMonth() + 1)
  const day = String(now.getDate())
  const cacheKey = `${month}/${day}`

  const cached = onThisDayCache.get(cacheKey)
  if (cached) return cached

  try {
    const resp = await fetch(
      `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${month}/${day}`,
      { headers: { 'Api-User-Agent': 'Oubli/1.0 (art project)' } },
    )
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json() as { events?: OnThisDayEvent[] }
    const events = (data.events || []).sort((a, b) => a.year - b.year)
    onThisDayCache.set(cacheKey, events)
    return events
  } catch {
    // Graceful fallback — return empty, fake headlines will still show
    onThisDayCache.set(cacheKey, [])
    return []
  }
}

function loadThumbnail(url: string): HTMLImageElement | null {
  const existing = thumbnailCache.get(url)
  if (existing) return existing.complete ? existing : null
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = url
  thumbnailCache.set(url, img)
  return null // not loaded yet; will be available next frame
}

/** Returns an opacity multiplier based on century — older events are more faded */
function centuryFade(year: number): number {
  const currentYear = new Date().getFullYear()
  const age = currentYear - year
  if (age < 100) return 1.0
  if (age < 200) return 0.85
  if (age < 500) return 0.65
  if (age < 1000) return 0.45
  return 0.3
}

/** Returns a tint color for different centuries */
function centuryTint(year: number): string {
  const currentYear = new Date().getFullYear()
  const age = currentYear - year
  if (age < 50) return 'rgba(200, 210, 230, ALPHA)' // blue-white — recent
  if (age < 150) return 'rgba(210, 200, 180, ALPHA)' // warm sepia
  if (age < 300) return 'rgba(180, 170, 150, ALPHA)' // faded parchment
  if (age < 600) return 'rgba(150, 140, 130, ALPHA)' // stone
  return 'rgba(120, 115, 110, ALPHA)' // ancient — nearly grey
}

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

  // On This Day events
  let onThisDayEvents: OnThisDayEvent[] = []
  let onThisDayScrollOffset = 0 // scroll within the enlarged event list

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

        // --- Newspaper clippings section ---
        // Kawara included newspaper clippings with his paintings.
        // We show real "on this day" historical events from Wikimedia API
        // alongside the fake headline as a fallback/complement.

        const clipW = currentW * 0.8
        const clipX = currentCx - clipW / 2
        let clipY = ey + currentH + 68

        // Determine which events to show (match month/day of this painting)
        const paintingDate = new Date(entry.timestamp)
        const paintingMonth = paintingDate.getMonth()
        const paintingDay = paintingDate.getDate()
        const todayNow = new Date()
        const isMatchingDay = paintingMonth === todayNow.getMonth() && paintingDay === todayNow.getDate()
        const eventsToShow = isMatchingDay ? onThisDayEvents : []

        if (eventsToShow.length > 0) {
          // Section header
          c.font = `${Math.floor(currentW * 0.018)}px monospace`
          c.fillStyle = `rgba(160, 150, 135, ${0.25 * infoAlpha})`
          c.textAlign = 'center'
          c.fillText(`on this day — ${LONG_MONTHS[paintingMonth]} ${paintingDay}`, currentCx, clipY - 4)
          clipY += 8

          // Show up to 6 events, scrollable via onThisDayScrollOffset
          const maxVisible = 6
          const eventFontSize = Math.max(8, Math.floor(currentW * 0.017))
          const eventLineH = eventFontSize + 4
          const eventBlockH = eventFontSize * 2.8 // space per event card
          const thumbSize = Math.floor(eventBlockH * 0.75)

          // Clamp scroll offset
          const scrollableCount = Math.max(0, eventsToShow.length - maxVisible)
          const startIdx = Math.min(Math.max(0, Math.floor(onThisDayScrollOffset)), scrollableCount)

          // Clip region for events
          c.save()
          c.beginPath()
          c.rect(clipX - 4, clipY - 2, clipW + 8, maxVisible * eventBlockH + 8)
          c.clip()

          for (let ei = 0; ei < maxVisible && (startIdx + ei) < eventsToShow.length; ei++) {
            const evt = eventsToShow[startIdx + ei]
            const evtY = clipY + ei * eventBlockH

            const fade = centuryFade(evt.year)
            const tintTemplate = centuryTint(evt.year)

            // Event card background — subtle, darker for older events
            const cardAlpha = 0.35 * infoAlpha * fade
            c.fillStyle = `rgba(20, 18, 15, ${cardAlpha})`
            c.fillRect(clipX, evtY, clipW, eventBlockH - 4)

            // Subtle left accent line colored by century
            const accentAlpha = 0.3 * infoAlpha * fade
            c.fillStyle = tintTemplate.replace('ALPHA', String(accentAlpha))
            c.fillRect(clipX, evtY, 2, eventBlockH - 4)

            // Year label — prominent
            c.font = `bold ${eventFontSize}px monospace`
            const yearAlpha = 0.6 * infoAlpha * fade
            c.fillStyle = tintTemplate.replace('ALPHA', String(yearAlpha))
            c.textAlign = 'left'
            c.fillText(String(evt.year), clipX + 8, evtY + eventLineH)

            // Event text — truncated to fit, wrapped to 2 lines max
            const textX = clipX + 8 + c.measureText('0000').width + 8
            const hasThumb = evt.pages?.[0]?.thumbnail?.source
            const textMaxW = hasThumb ? clipW - (textX - clipX) - thumbSize - 12 : clipW - (textX - clipX) - 8
            c.font = `${eventFontSize}px "Cormorant Garamond", serif`
            const textAlpha = 0.4 * infoAlpha * fade
            c.fillStyle = tintTemplate.replace('ALPHA', String(textAlpha))

            // Word-wrap to 2 lines
            const evtWords = evt.text.split(' ')
            let eLine1 = ''
            let eLine2 = ''
            for (const w of evtWords) {
              const test = eLine1 + (eLine1 ? ' ' : '') + w
              if (c.measureText(test).width < textMaxW && !eLine2) {
                eLine1 = test
              } else if (!eLine2 || c.measureText(eLine2 + ' ' + w).width < textMaxW) {
                eLine2 += (eLine2 ? ' ' : '') + w
              } else {
                eLine2 += '\u2026'
                break
              }
            }
            c.fillText(eLine1, textX, evtY + eventLineH)
            if (eLine2) {
              c.fillText(eLine2, textX, evtY + eventLineH * 2 - 2)
            }

            // Thumbnail image (if available) — rendered small and faded
            if (hasThumb) {
              const thumbUrl = evt.pages![0].thumbnail!.source
              const img = loadThumbnail(thumbUrl)
              if (img) {
                const thumbX = clipX + clipW - thumbSize - 6
                const thumbY = evtY + 2
                c.globalAlpha = 0.35 * infoAlpha * fade
                try {
                  c.drawImage(img, thumbX, thumbY, thumbSize, thumbSize)
                } catch { /* cross-origin or decode error */ }
                c.globalAlpha = 1
                // Subtle border around thumbnail
                c.strokeStyle = tintTemplate.replace('ALPHA', String(0.15 * infoAlpha * fade))
                c.lineWidth = 0.5
                c.strokeRect(thumbX, thumbY, thumbSize, thumbSize)
              }
            }
          }

          c.restore() // unclip

          // Scroll hint arrows if there are more events
          if (eventsToShow.length > maxVisible) {
            c.font = `${eventFontSize}px monospace`
            c.textAlign = 'center'
            const hintAlpha = 0.2 * infoAlpha
            if (startIdx > 0) {
              c.fillStyle = `rgba(200, 190, 170, ${hintAlpha})`
              c.fillText('\u25B2', currentCx, clipY - 2)
            }
            if (startIdx + maxVisible < eventsToShow.length) {
              const bottomY = clipY + maxVisible * eventBlockH + 10
              c.fillStyle = `rgba(200, 190, 170, ${hintAlpha})`
              c.fillText(`\u25BC  ${eventsToShow.length - startIdx - maxVisible} more`, currentCx, bottomY)
            }
          }
        } else {
          // Fallback: show fake headline (original Kawara-style newspaper clipping)
          const headlineIndex = hashDate(entry.isoDate) % HEADLINE_FRAGMENTS.length
          const headline = HEADLINE_FRAGMENTS[headlineIndex]

          const fakeClipH = 36
          c.fillStyle = `rgba(25, 22, 18, ${0.5 * infoAlpha})`
          c.fillRect(clipX, clipY, clipW, fakeClipH)
          c.strokeStyle = `rgba(100, 90, 75, ${0.15 * infoAlpha})`
          c.lineWidth = 0.5
          c.strokeRect(clipX, clipY, clipW, fakeClipH)

          c.font = `${Math.floor(currentW * 0.02)}px "Cormorant Garamond", serif`
          c.fillStyle = `rgba(180, 170, 150, ${0.35 * infoAlpha})`
          c.textAlign = 'center'

          const fakeWords = headline.split(' ')
          let fLine1 = ''
          let fLine2 = ''
          const fMaxW = clipW - 20
          for (const word of fakeWords) {
            const test = fLine1 + (fLine1 ? ' ' : '') + word
            if (c.measureText(test).width < fMaxW && !fLine2) {
              fLine1 = test
            } else {
              fLine2 += (fLine2 ? ' ' : '') + word
            }
          }

          c.fillText(fLine1, currentCx, clipY + 14)
          if (fLine2) {
            c.fillText(fLine2, currentCx, clipY + 28)
          }
        }

        // Source line
        c.font = `${Math.floor(currentW * 0.014)}px monospace`
        c.fillStyle = `rgba(120, 110, 100, ${0.2 * infoAlpha})`
        c.textAlign = 'center'
        c.fillText(`\u2014 ${formatLongDate(entry.timestamp)}`, currentCx, clipY + (eventsToShow.length > 0 ? Math.min(6, eventsToShow.length) * (Math.max(8, Math.floor(currentW * 0.017)) * 2.8) + 14 : 50))
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

      c.font = '12px monospace'
      c.fillStyle = 'rgba(200, 190, 170, 0.08)'
      c.textAlign = 'left'
      c.fillText(`first visit: ${record.firstVisit}`, 12, h - 42)
      c.fillText(`${daysSinceFirst} days elapsed · ${daysVisited} days visited`, 12, h - 30)
      c.fillText(`attendance: ${attendance}%`, 12, h - 18)
    }

    // Painting count
    c.font = '12px monospace'
    c.fillStyle = 'rgba(200, 190, 170, 0.08)'
    c.textAlign = 'right'
    c.fillText(`${dates.length} paintings`, w - 12, h - 18)

    // Title
    c.font = '12px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 190, 170, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.fillText('the date paintings', w / 2, 25)

    // Attribution
    c.font = '11px "Cormorant Garamond", serif'
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
    c.font = '12px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 190, 170, ${0.03 + Math.sin(time * 0.15) * 0.01})`
    c.textAlign = 'center'
    c.fillText('I am still alive', w / 2, h - 4)
  }

  function handleWheel(e: WheelEvent) {
    if (enlargedIndex >= 0) {
      // Scroll through on-this-day events when painting is enlarged
      if (onThisDayEvents.length > 6) {
        onThisDayScrollOffset += e.deltaY > 0 ? 1 : -1
        onThisDayScrollOffset = Math.max(0, Math.min(onThisDayScrollOffset, onThisDayEvents.length - 6))
      }
      e.preventDefault()
      return
    }
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
        onThisDayScrollOffset = 0
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
      onThisDayScrollOffset = 0
      lastCheckedDate = new Date().toISOString().split('T')[0]
      loadRecord()
      recordVisit()
      initAudio()
      // Fetch "on this day" events (non-blocking)
      fetchOnThisDay().then((events) => { onThisDayEvents = events })
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
