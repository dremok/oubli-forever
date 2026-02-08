/**
 * THE LIBRARY — every possible page
 *
 * Jorge Luis Borges' "The Library of Babel" (1941) describes
 * an infinite library containing every possible 410-page book.
 * Most are gibberish. Somewhere in the library is the book that
 * describes your life perfectly. And the book that describes your
 * life with one letter changed.
 *
 * This room generates "pages" from a deterministic hash function
 * seeded by your stored memories. Each memory maps to a specific
 * location in the library (hexagon, wall, shelf, volume, page).
 * The page contains mostly random characters, but fragments of
 * your actual memory text are embedded at deterministic positions.
 *
 * Real poetry from PoetryDB drifts through the library — lines
 * from Emily Dickinson, William Blake, Percy Bysshe Shelley, and
 * Walt Whitman appear and dissolve among the infinite shelves,
 * as if the library occasionally produces something beautiful
 * amid the noise.
 *
 * Scroll through pages. Click the location code to jump to a
 * random location. Your memories are scattered across infinity.
 *
 * Also inspired by: the Wayback Machine (every webpage that ever
 * existed), the infinite monkey theorem, the Voynich Manuscript,
 * Italo Calvino's "If on a winter's night a traveler",
 * pi containing every possible number sequence, the existential
 * dread of being one meaningful text among infinite noise
 *
 * USES MEMORIES (as seeds). Literary. Procedural infinity.
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

interface LibraryDeps {
  getMemories: () => Memory[]
  switchTo?: (name: string) => void
}

// --- PoetryDB types ---
interface Poem {
  title: string
  author: string
  lines: string[]
  linecount: string
}

interface FloatingLine {
  text: string
  x: number
  y: number
  alpha: number
  fadeIn: boolean
  age: number
  maxAge: number
  speed: number
  isTitle: boolean
  isAuthor: boolean
}

// Simple seedable PRNG
function mulberry32(seed: number) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function hashString(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0
  }
  return hash
}

// Borges' library uses 25 characters (22 letters + space + period + comma)
const BABEL_CHARS = 'abcdefghijklmnopqrstuvwxyz .,;'
const CHARS_PER_LINE = 40
const LINES_PER_PAGE = 20

interface LibraryLocation {
  hexagon: number
  wall: number  // 1-4
  shelf: number // 1-5
  volume: number // 1-32
  page: number  // 1-410
}

// Fallback poems in case the API is unreachable
const FALLBACK_POEMS: Poem[] = [
  {
    title: 'I felt a Funeral, in my Brain',
    author: 'Emily Dickinson',
    lines: [
      'I felt a Funeral, in my Brain,',
      'And Mourners to and fro',
      'Kept treading - treading - till it seemed',
      'That Sense was breaking through -',
      '',
      'And when they all were seated,',
      'A Service, like a Drum -',
      'Kept beating - beating - till I thought',
      'My mind was going numb -',
    ],
    linecount: '9',
  },
  {
    title: 'Auguries of Innocence',
    author: 'William Blake',
    lines: [
      'To see a World in a Grain of Sand',
      'And a Heaven in a Wild Flower',
      'Hold Infinity in the palm of your hand',
      'And Eternity in an hour',
    ],
    linecount: '4',
  },
  {
    title: 'O Me! O Life!',
    author: 'Walt Whitman',
    lines: [
      'O me! O life! of the questions of these recurring,',
      'Of the endless trains of the faithless,',
      'of cities fill\'d with the foolish,',
      'What good amid these, O me, O life?',
      '',
      'Answer.',
      'That you are here — that life exists and identity,',
      'That the powerful play goes on,',
      'and you may contribute a verse.',
    ],
    linecount: '9',
  },
]

// Poets whose work suits the library's atmosphere
const POET_QUERY_AUTHORS = 'Emily%20Dickinson;William%20Blake;Percy%20Bysshe%20Shelley;Walt%20Whitman'

export function createLibraryRoom(deps: LibraryDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let location: LibraryLocation = { hexagon: 0, wall: 1, shelf: 1, volume: 1, page: 1 }
  let pageContent: string[] = []
  let memoryFragmentPositions: { line: number; col: number; length: number }[] = []
  let scrollY = 0
  let pagesViewed = 0
  let hoveredShelf = -1
  let hoveredPortal = -1

  // --- Cursor state ---
  let mouseX = 0
  let mouseY = 0

  // --- Visual atmosphere state ---
  interface DustParticle {
    x: number; y: number; vx: number; vy: number
    size: number; alpha: number; life: number; maxLife: number
  }
  interface PageFragment {
    x: number; y: number; vx: number; vy: number
    rotation: number; rotSpeed: number
    w: number; h: number; alpha: number; life: number; maxLife: number
    chars: string
  }
  interface GlowingLetter {
    x: number; y: number; char: string; alpha: number; vy: number; life: number
  }
  let dustParticles: DustParticle[] = []
  let pageFragments: PageFragment[] = []
  let glowingLetters: GlowingLetter[] = []
  const MAX_DUST = 80
  const MAX_FRAGMENTS = 6

  // --- Audio state ---
  let audioInitialized = false
  let audioMaster: GainNode | null = null
  let choirOscillators: OscillatorNode[] = []
  let choirGains: GainNode[] = []
  let heartbeatOsc: OscillatorNode | null = null
  let heartbeatGain: GainNode | null = null
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null
  let pageTurnInterval: ReturnType<typeof setInterval> | null = null
  let footstepInterval: ReturnType<typeof setInterval> | null = null
  let reverbDelay: DelayNode | null = null
  let reverbFeedback: GainNode | null = null
  let reverbWet: GainNode | null = null

  // --- Poetry state ---
  let cachedPoems: Poem[] = []
  let currentPoem: Poem | null = null
  let floatingLines: FloatingLine[] = []
  let lastPoemFetchTime = 0
  let poemFetchInFlight = false
  const POEM_REFRESH_INTERVAL = 150 // seconds (~2.5 minutes)
  const MAX_FLOATING_LINES = 6

  // --- Portal books (enhanced navigation) ---
  const portalBooks = [
    { label: 'The Study',       hint: 'return to familiar shelves',    room: 'study',        color: [180, 160, 120] as [number, number, number] },
    { label: 'The Archive',     hint: 'deeper into the stacks',       room: 'archive',      color: [160, 140, 100] as [number, number, number] },
    { label: 'The Cipher',      hint: 'encoded volumes',              room: 'cipher',       color: [140, 160, 130] as [number, number, number] },
    { label: 'The Oracle',      hint: 'prophetic texts',              room: 'oracle',       color: [170, 140, 160] as [number, number, number] },
    { label: 'The Projection',  hint: 'illuminated pages',            room: 'projection',   color: [150, 150, 170] as [number, number, number] },
    { label: 'Date Paintings',  hint: 'numbered days',                room: 'datepaintings', color: [170, 150, 130] as [number, number, number] },
  ]

  // --- Poetry fetching ---
  async function fetchPoem(): Promise<Poem | null> {
    if (poemFetchInFlight) return null
    poemFetchInFlight = true
    try {
      // Alternate between random poem and curated poets
      const useRandom = Math.random() > 0.4
      const url = useRandom
        ? 'https://poetrydb.org/random/1'
        : `https://poetrydb.org/author/${POET_QUERY_AUTHORS}/title,author,lines`

      const response = await fetch(url)
      if (!response.ok) throw new Error(`PoetryDB ${response.status}`)

      const data: Poem[] = await response.json()
      if (!data || data.length === 0) throw new Error('No poems returned')

      if (useRandom) {
        return data[0]
      } else {
        // Pick a random poem from the curated list
        cachedPoems = data
        return data[Math.floor(Math.random() * data.length)]
      }
    } catch {
      // Fallback to built-in poems
      return FALLBACK_POEMS[Math.floor(Math.random() * FALLBACK_POEMS.length)]
    } finally {
      poemFetchInFlight = false
    }
  }

  function loadNewPoem() {
    fetchPoem().then(poem => {
      if (!poem || !active) return
      currentPoem = poem
      spawnPoemLines(poem)
      lastPoemFetchTime = time
      playPoemChime()
    })
  }

  function spawnPoemLines(poem: Poem) {
    if (!canvas) return
    const w = canvas.width
    const h = canvas.height

    // Filter empty lines and pick a subset
    const nonEmpty = poem.lines.filter(l => l.trim().length > 0)
    const linesToShow = nonEmpty.slice(0, Math.min(nonEmpty.length, MAX_FLOATING_LINES))

    // Spawn title first
    floatingLines.push({
      text: poem.title,
      x: w * (0.1 + Math.random() * 0.15),
      y: h * 0.12 + Math.random() * 40,
      alpha: 0,
      fadeIn: true,
      age: 0,
      maxAge: 18 + Math.random() * 8,
      speed: 0.15 + Math.random() * 0.1,
      isTitle: true,
      isAuthor: false,
    })

    // Spawn author
    floatingLines.push({
      text: `\u2014 ${poem.author}`,
      x: w * (0.1 + Math.random() * 0.15),
      y: h * 0.12 + 22 + Math.random() * 20,
      alpha: 0,
      fadeIn: true,
      age: 0,
      maxAge: 16 + Math.random() * 6,
      speed: 0.12 + Math.random() * 0.08,
      isTitle: false,
      isAuthor: true,
    })

    // Spawn poem lines at staggered positions
    for (let i = 0; i < linesToShow.length; i++) {
      const line = linesToShow[i]
      // Position lines in the margins around the central page
      // Some on the left, some on the right, some above/below
      const side = Math.random()
      let x: number, y: number

      if (side < 0.35) {
        // Left margin
        x = 10 + Math.random() * (w * 0.18)
        y = h * 0.25 + (i / linesToShow.length) * h * 0.5 + Math.random() * 30
      } else if (side < 0.7) {
        // Right margin
        x = w * 0.72 + Math.random() * (w * 0.2)
        y = h * 0.25 + (i / linesToShow.length) * h * 0.5 + Math.random() * 30
      } else if (side < 0.85) {
        // Above page
        x = w * 0.2 + Math.random() * w * 0.6
        y = 50 + Math.random() * 30
      } else {
        // Below page
        x = w * 0.2 + Math.random() * w * 0.6
        y = h * 0.88 + Math.random() * (h * 0.08)
      }

      floatingLines.push({
        text: line,
        x,
        y,
        alpha: 0,
        fadeIn: true,
        age: -i * 1.5, // stagger appearance
        maxAge: 12 + Math.random() * 10,
        speed: 0.08 + Math.random() * 0.15,
        isTitle: false,
        isAuthor: false,
      })
    }
  }

  function updateFloatingLines(dt: number) {
    for (let i = floatingLines.length - 1; i >= 0; i--) {
      const fl = floatingLines[i]
      fl.age += dt

      if (fl.age < 0) continue // staggered, not yet visible

      // Drift upward slowly
      fl.y -= fl.speed * dt * 4

      // Fade in/out lifecycle
      const lifeFrac = fl.age / fl.maxAge
      if (lifeFrac < 0.15) {
        // Fade in
        fl.alpha = (lifeFrac / 0.15) * 0.28
      } else if (lifeFrac > 0.75) {
        // Fade out
        fl.alpha = ((1 - lifeFrac) / 0.25) * 0.28
      } else {
        fl.alpha = 0.28
      }

      // Title and author are slightly brighter
      if (fl.isTitle) fl.alpha *= 1.4
      if (fl.isAuthor) fl.alpha *= 1.2

      // Remove dead lines
      if (fl.age > fl.maxAge) {
        floatingLines.splice(i, 1)
      }
    }
  }

  function renderFloatingLines(c: CanvasRenderingContext2D) {
    for (const fl of floatingLines) {
      if (fl.age < 0 || fl.alpha <= 0) continue

      const breathe = Math.sin(time * 0.8 + fl.x * 0.01) * 0.03

      if (fl.isTitle) {
        c.font = '13px "Cormorant Garamond", serif'
        c.fillStyle = `rgba(220, 200, 160, ${Math.max(0, fl.alpha + breathe)})`
      } else if (fl.isAuthor) {
        c.font = '12px "Cormorant Garamond", serif'
        c.fillStyle = `rgba(180, 160, 130, ${Math.max(0, fl.alpha * 0.8 + breathe)})`
      } else {
        c.font = '12px "Cormorant Garamond", serif'
        c.fillStyle = `rgba(200, 185, 150, ${Math.max(0, fl.alpha + breathe)})`
      }

      c.textAlign = 'left'

      // Truncate long lines to prevent overflow
      let text = fl.text
      if (text.length > 55) text = text.slice(0, 52) + '...'

      c.fillText(text, fl.x, fl.y)
    }
  }

  function generatePage(loc: LibraryLocation): { lines: string[]; fragments: typeof memoryFragmentPositions } {
    const memories = deps.getMemories()

    // Create a seed from the location
    const locSeed = loc.hexagon * 100000 + loc.wall * 10000 + loc.shelf * 1000 + loc.volume * 100 + loc.page
    const rng = mulberry32(locSeed)

    const lines: string[] = []
    const fragments: typeof memoryFragmentPositions = []

    // Generate mostly random text
    for (let line = 0; line < LINES_PER_PAGE; line++) {
      let chars = ''
      for (let col = 0; col < CHARS_PER_LINE; col++) {
        chars += BABEL_CHARS[Math.floor(rng() * BABEL_CHARS.length)]
      }
      lines.push(chars)
    }

    // Embed memory fragments at deterministic positions
    if (memories.length > 0) {
      // Which memory maps to this location?
      const memIdx = Math.abs(locSeed) % memories.length
      const mem = memories[memIdx]
      const text = mem.currentText.toLowerCase()

      // Fragment positions determined by memory hash + location
      const fragSeed = hashString(mem.id + String(loc.page))
      const fragRng = mulberry32(fragSeed)

      // Insert 1-3 fragments of the memory text
      const numFrags = 1 + Math.floor(fragRng() * 3)

      for (let f = 0; f < numFrags; f++) {
        const fragLine = Math.floor(fragRng() * LINES_PER_PAGE)
        const fragStart = Math.floor(fragRng() * text.length)
        const fragLen = 3 + Math.floor(fragRng() * Math.min(12, text.length - fragStart))
        const fragment = text.slice(fragStart, fragStart + fragLen)

        // Insert fragment into the line
        const col = Math.floor(fragRng() * (CHARS_PER_LINE - fragLen))
        const line = lines[fragLine]
        lines[fragLine] = line.slice(0, col) + fragment + line.slice(col + fragment.length)

        fragments.push({ line: fragLine, col, length: fragment.length })
      }
    }

    // Occasionally embed a poem line into the Babel page (like finding sense in noise)
    if (currentPoem && rng() > 0.6) {
      const nonEmpty = currentPoem.lines.filter(l => l.trim().length > 0)
      if (nonEmpty.length > 0) {
        const poemLine = nonEmpty[Math.floor(rng() * nonEmpty.length)].toLowerCase()
        const embedLine = Math.floor(rng() * LINES_PER_PAGE)
        const trimmed = poemLine.slice(0, Math.min(poemLine.length, CHARS_PER_LINE))
        const col = Math.floor(rng() * Math.max(1, CHARS_PER_LINE - trimmed.length))
        const original = lines[embedLine]
        lines[embedLine] = original.slice(0, col) + trimmed + original.slice(col + trimmed.length)
      }
    }

    return { lines, fragments }
  }

  function goToLocation(loc: LibraryLocation) {
    location = { ...loc }
    const result = generatePage(location)
    pageContent = result.lines
    memoryFragmentPositions = result.fragments
    scrollY = 0
    pagesViewed++
    playDoorwayEcho()
  }

  function goToMemoryLocation(memoryIndex: number) {
    const memories = deps.getMemories()
    if (memoryIndex >= memories.length) return

    const mem = memories[memoryIndex]
    const hash = Math.abs(hashString(mem.id || mem.originalText))

    goToLocation({
      hexagon: hash % 999999,
      wall: (hash >> 4) % 4 + 1,
      shelf: (hash >> 8) % 5 + 1,
      volume: (hash >> 12) % 32 + 1,
      page: (hash >> 16) % 410 + 1,
    })
  }

  function nextPage() {
    location.page++
    if (location.page > 410) {
      location.page = 1
      location.volume++
      if (location.volume > 32) {
        location.volume = 1
        location.shelf++
        if (location.shelf > 5) {
          location.shelf = 1
          location.wall++
          if (location.wall > 4) {
            location.wall = 1
            location.hexagon++
          }
        }
      }
    }
    const result = generatePage(location)
    pageContent = result.lines
    memoryFragmentPositions = result.fragments
    scrollY = 0
    pagesViewed++
    // Manual page turn sound (in addition to ambient random ones)
    if (audioInitialized && audioMaster) {
      try { playPageTurnSound(audioMaster.context as AudioContext) } catch { /* */ }
    }
  }

  function prevPage() {
    location.page--
    if (location.page < 1) {
      location.page = 410
      location.volume--
      if (location.volume < 1) {
        location.volume = 32
        location.shelf--
      }
    }
    const result = generatePage(location)
    pageContent = result.lines
    memoryFragmentPositions = result.fragments
    scrollY = 0
    // Manual page turn sound
    if (audioInitialized && audioMaster) {
      try { playPageTurnSound(audioMaster.context as AudioContext) } catch { /* */ }
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!active) return
    if (e.key === 'ArrowRight' || e.key === 'd') {
      nextPage()
      e.preventDefault()
    } else if (e.key === 'ArrowLeft' || e.key === 'a') {
      prevPage()
      e.preventDefault()
    } else if (e.key === 'r') {
      // Random location
      goToLocation({
        hexagon: Math.floor(Math.random() * 999999),
        wall: Math.floor(Math.random() * 4) + 1,
        shelf: Math.floor(Math.random() * 5) + 1,
        volume: Math.floor(Math.random() * 32) + 1,
        page: Math.floor(Math.random() * 410) + 1,
      })
      e.preventDefault()
    }
  }

  // --- Portal book rendering ---
  function getPortalBookBounds(w: number, h: number, index: number) {
    // Books arranged as a vertical bookshelf along the right edge
    const bookW = 56
    const bookH = 24
    const shelfX = w - bookW - 12
    const startY = 70
    const spacing = bookH + 8
    return {
      x: shelfX,
      y: startY + index * spacing,
      w: bookW,
      h: bookH,
    }
  }

  function renderPortalBooks(c: CanvasRenderingContext2D, w: number, h: number) {
    if (!deps.switchTo) return

    // Shelf label
    c.font = '7px monospace'
    c.fillStyle = 'rgba(140, 120, 90, 0.08)'
    c.textAlign = 'center'
    const firstBounds = getPortalBookBounds(w, h, 0)
    c.fillText('passages', firstBounds.x + firstBounds.w / 2, firstBounds.y - 8)

    for (let i = 0; i < portalBooks.length; i++) {
      const b = getPortalBookBounds(w, h, i)
      const portal = portalBooks[i]
      const hovered = hoveredPortal === i
      const [cr, cg, cb] = portal.color
      const pulse = Math.sin(time * 1.2 + i * 0.7) * 0.02

      // Book spine background
      const baseAlpha = hovered ? 0.35 : 0.1
      c.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${baseAlpha + pulse})`
      c.fillRect(b.x, b.y, b.w, b.h)

      // Spine edge (left side, like book binding)
      c.fillStyle = `rgba(${cr - 30}, ${cg - 30}, ${cb - 30}, ${baseAlpha * 1.5})`
      c.fillRect(b.x, b.y, 3, b.h)

      // Border
      c.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${(hovered ? 0.4 : 0.08) + pulse})`
      c.lineWidth = 0.5
      c.strokeRect(b.x, b.y, b.w, b.h)

      // Spine text (title)
      c.font = hovered ? '11px "Cormorant Garamond", serif' : '7px "Cormorant Garamond", serif'
      c.fillStyle = `rgba(255, 240, 200, ${hovered ? 0.55 : 0.15})`
      c.textAlign = 'center'
      c.fillText(portal.label, b.x + b.w / 2, b.y + b.h / 2 + 3)

      // Hint on hover
      if (hovered) {
        c.font = '7px "Cormorant Garamond", serif'
        c.fillStyle = 'rgba(200, 180, 140, 0.3)'
        c.textAlign = 'right'
        c.fillText(portal.hint, b.x - 6, b.y + b.h / 2 + 3)
      }
    }
  }

  // ==========================================================
  // AUDIO SYSTEM
  // ==========================================================

  async function initAudio() {
    try {
      const ac = await getAudioContext()
      const dest = getAudioDestination()

      audioMaster = ac.createGain()
      audioMaster.gain.value = 0
      audioMaster.connect(dest)

      // Reverb for spatial echoes
      reverbDelay = ac.createDelay(0.8)
      reverbDelay.delayTime.value = 0.45
      reverbFeedback = ac.createGain()
      reverbFeedback.gain.value = 0.4
      reverbWet = ac.createGain()
      reverbWet.gain.value = 0.2
      reverbDelay.connect(reverbFeedback)
      reverbFeedback.connect(reverbDelay)
      reverbDelay.connect(reverbWet)
      reverbWet.connect(audioMaster)

      // Choir-like hum: many detuned sine oscillators = countless voices reading
      const choirFreqs = [82, 84, 110, 112, 146, 148, 164, 166, 220, 222]
      for (const freq of choirFreqs) {
        const osc = ac.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq + (Math.random() - 0.5) * 2
        const gain = ac.createGain()
        gain.gain.value = 0
        osc.connect(gain)
        gain.connect(audioMaster)
        // Also feed reverb for spaciousness
        gain.connect(reverbDelay)
        osc.start()
        choirOscillators.push(osc)
        choirGains.push(gain)
      }

      // Heartbeat — the library's mechanical clock rhythm
      heartbeatOsc = ac.createOscillator()
      heartbeatOsc.type = 'sine'
      heartbeatOsc.frequency.value = 60
      heartbeatGain = ac.createGain()
      heartbeatGain.gain.value = 0
      heartbeatOsc.connect(heartbeatGain)
      heartbeatGain.connect(audioMaster)
      heartbeatOsc.start()

      audioInitialized = true

      // Fade master in
      const now = ac.currentTime
      audioMaster.gain.setValueAtTime(0, now)
      audioMaster.gain.linearRampToValueAtTime(1, now + 3)

      // Fade choir gains in gently over time with slow modulation
      for (let i = 0; i < choirGains.length; i++) {
        const g = choirGains[i]
        g.gain.setValueAtTime(0, now)
        g.gain.linearRampToValueAtTime(0.006 + Math.random() * 0.004, now + 4 + i * 0.3)
      }

      // Start heartbeat ticking (~0.7Hz for a slow mechanical pulse)
      startHeartbeat(ac)
      // Start random page-turn sounds
      startPageTurns(ac)
      // Start distant footsteps
      startFootsteps(ac)
    } catch {
      // Audio not available — degrade gracefully
    }
  }

  function startHeartbeat(ac: AudioContext) {
    if (heartbeatInterval) clearInterval(heartbeatInterval)
    heartbeatInterval = setInterval(() => {
      if (!heartbeatGain || !active) return
      const now = ac.currentTime
      // Two-beat pulse: thud...thud (like a clock's tick-tock)
      heartbeatGain.gain.setValueAtTime(0, now)
      heartbeatGain.gain.linearRampToValueAtTime(0.015, now + 0.01)
      heartbeatGain.gain.linearRampToValueAtTime(0, now + 0.08)
      // Second beat, quieter
      heartbeatGain.gain.setValueAtTime(0, now + 0.35)
      heartbeatGain.gain.linearRampToValueAtTime(0.008, now + 0.36)
      heartbeatGain.gain.linearRampToValueAtTime(0, now + 0.42)
    }, 1400)
  }

  function startPageTurns(ac: AudioContext) {
    if (pageTurnInterval) clearInterval(pageTurnInterval)
    const scheduleTurn = () => {
      if (!audioMaster || !active) return
      playPageTurnSound(ac)
      // Random interval 4-12 seconds
      pageTurnInterval = setTimeout(scheduleTurn, 4000 + Math.random() * 8000) as unknown as ReturnType<typeof setInterval>
    }
    pageTurnInterval = setTimeout(scheduleTurn, 3000 + Math.random() * 5000) as unknown as ReturnType<typeof setInterval>
  }

  function playPageTurnSound(ac: AudioContext) {
    if (!audioMaster) return
    try {
      const now = ac.currentTime
      // Page turn = short burst of filtered noise
      const bufferSize = ac.sampleRate * 0.15
      const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        // Shaped noise: louder at start, quieter at end
        const env = 1 - i / bufferSize
        data[i] = (Math.random() * 2 - 1) * env * env
      }
      const source = ac.createBufferSource()
      source.buffer = buffer
      const filter = ac.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 2000 + Math.random() * 2000
      filter.Q.value = 0.8
      const gain = ac.createGain()
      gain.gain.setValueAtTime(0.02 + Math.random() * 0.015, now)
      gain.gain.linearRampToValueAtTime(0, now + 0.15)
      source.connect(filter)
      filter.connect(gain)
      gain.connect(audioMaster)
      source.start(now)
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect() }
    } catch { /* ignore */ }
  }

  function startFootsteps(ac: AudioContext) {
    if (footstepInterval) clearInterval(footstepInterval)
    const scheduleStep = () => {
      if (!audioMaster || !active) return
      playFootstep(ac)
      // Random interval 6-18 seconds — distant, rare
      footstepInterval = setTimeout(scheduleStep, 6000 + Math.random() * 12000) as unknown as ReturnType<typeof setInterval>
    }
    footstepInterval = setTimeout(scheduleStep, 5000 + Math.random() * 8000) as unknown as ReturnType<typeof setInterval>
  }

  function playFootstep(ac: AudioContext) {
    if (!audioMaster || !reverbDelay) return
    try {
      const now = ac.currentTime
      // Footstep: low thud with reverb echo
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(120 + Math.random() * 40, now)
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.08)
      const gain = ac.createGain()
      gain.gain.setValueAtTime(0.012 + Math.random() * 0.008, now)
      gain.gain.linearRampToValueAtTime(0, now + 0.12)
      osc.connect(gain)
      gain.connect(audioMaster)
      gain.connect(reverbDelay) // echo through the library
      osc.start(now)
      osc.stop(now + 0.15)
      osc.onended = () => { osc.disconnect(); gain.disconnect() }
    } catch { /* ignore */ }
  }

  function playPoemChime() {
    if (!audioInitialized || !audioMaster) return
    try {
      const ac = audioMaster.context as AudioContext
      const now = ac.currentTime
      // Crystalline chime: high sine with harmonics
      const freqs = [880, 1320, 1760]
      for (let i = 0; i < freqs.length; i++) {
        const osc = ac.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freqs[i] + (Math.random() - 0.5) * 10
        const gain = ac.createGain()
        gain.gain.setValueAtTime(0, now + i * 0.08)
        gain.gain.linearRampToValueAtTime(0.02 - i * 0.005, now + i * 0.08 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2 + i * 0.3)
        osc.connect(gain)
        gain.connect(audioMaster!)
        if (reverbDelay) gain.connect(reverbDelay)
        osc.start(now + i * 0.08)
        osc.stop(now + 2.5 + i * 0.3)
        osc.onended = () => { osc.disconnect(); gain.disconnect() }
      }
    } catch { /* ignore */ }
  }

  function playDoorwayEcho() {
    if (!audioInitialized || !audioMaster || !reverbDelay) return
    try {
      const ac = audioMaster.context as AudioContext
      const now = ac.currentTime
      // Low resonant whoosh for navigating hexagons
      const osc = ac.createOscillator()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(180, now)
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.4)
      const gain = ac.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.03, now + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
      osc.connect(gain)
      gain.connect(audioMaster)
      gain.connect(reverbDelay) // deep echo
      osc.start(now)
      osc.stop(now + 0.7)
      osc.onended = () => { osc.disconnect(); gain.disconnect() }
    } catch { /* ignore */ }
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
    if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null }
    if (pageTurnInterval) { clearTimeout(pageTurnInterval as unknown as number); pageTurnInterval = null }
    if (footstepInterval) { clearTimeout(footstepInterval as unknown as number); footstepInterval = null }
    setTimeout(() => {
      for (const osc of choirOscillators) { try { osc.stop() } catch { /* */ }; osc.disconnect() }
      for (const g of choirGains) { g.disconnect() }
      choirOscillators = []
      choirGains = []
      try { heartbeatOsc?.stop() } catch { /* */ }
      heartbeatOsc?.disconnect()
      heartbeatGain?.disconnect()
      reverbDelay?.disconnect()
      reverbFeedback?.disconnect()
      reverbWet?.disconnect()
      audioMaster?.disconnect()
      heartbeatOsc = null
      heartbeatGain = null
      reverbDelay = null
      reverbFeedback = null
      reverbWet = null
      audioMaster = null
      audioInitialized = false
    }, 600)
  }

  // Modulate choir gains slowly for breathing, living sound
  function updateChoirModulation() {
    if (!audioInitialized) return
    for (let i = 0; i < choirGains.length; i++) {
      const baseVol = 0.005 + (i % 3) * 0.002
      const mod = Math.sin(time * (0.15 + i * 0.04) + i * 1.7) * 0.003
      const val = Math.max(0, baseVol + mod)
      choirGains[i].gain.value = val
    }
  }

  // ==========================================================
  // VISUAL ATMOSPHERE
  // ==========================================================

  function spawnDust() {
    if (!canvas) return
    while (dustParticles.length < MAX_DUST) {
      dustParticles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.1 - Math.random() * 0.2,
        size: 0.5 + Math.random() * 1.5,
        alpha: 0,
        life: 0,
        maxLife: 8 + Math.random() * 12,
      })
    }
  }

  function updateDust(dt: number) {
    if (!canvas) return
    for (let i = dustParticles.length - 1; i >= 0; i--) {
      const p = dustParticles[i]
      p.life += dt
      p.x += p.vx * dt * 10
      p.y += p.vy * dt * 10

      // Attracted gently toward cursor (lamplight catches dust)
      const dx = mouseX - p.x
      const dy = mouseY - p.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 200 && dist > 1) {
        p.vx += dx / dist * 0.01
        p.vy += dy / dist * 0.01
      }

      // Fade lifecycle
      const frac = p.life / p.maxLife
      if (frac < 0.1) p.alpha = frac / 0.1 * 0.4
      else if (frac > 0.8) p.alpha = (1 - frac) / 0.2 * 0.4
      else p.alpha = 0.4

      // Near cursor: brighter (lamplight)
      if (dist < 150) {
        p.alpha *= 1 + (1 - dist / 150) * 2
      }

      if (p.life > p.maxLife || p.y < -10 || p.x < -10 || p.x > canvas.width + 10) {
        dustParticles.splice(i, 1)
      }
    }
    // Respawn
    spawnDust()
  }

  function renderDust(c: CanvasRenderingContext2D) {
    for (const p of dustParticles) {
      if (p.alpha <= 0) continue
      const glow = Math.sin(time * 2 + p.x * 0.01) * 0.05
      c.beginPath()
      c.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      c.fillStyle = `rgba(220, 200, 140, ${Math.min(1, Math.max(0, p.alpha + glow))})`
      c.fill()
    }
  }

  function spawnPageFragment() {
    if (!canvas || pageFragments.length >= MAX_FRAGMENTS) return
    const side = Math.random()
    let x: number, y: number
    if (side < 0.5) {
      x = Math.random() * canvas.width
      y = -20
    } else {
      x = side < 0.75 ? -20 : canvas.width + 20
      y = Math.random() * canvas.height
    }
    // tiny rectangle with random text
    const chars = Array.from({ length: 3 + Math.floor(Math.random() * 5) }, () =>
      BABEL_CHARS[Math.floor(Math.random() * BABEL_CHARS.length)]
    ).join('')
    pageFragments.push({
      x, y,
      vx: (Math.random() - 0.5) * 0.4,
      vy: 0.15 + Math.random() * 0.2,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.02,
      w: 20 + Math.random() * 25,
      h: 10 + Math.random() * 14,
      alpha: 0,
      life: 0,
      maxLife: 12 + Math.random() * 10,
      chars,
    })
  }

  function updatePageFragments(dt: number) {
    if (!canvas) return
    for (let i = pageFragments.length - 1; i >= 0; i--) {
      const f = pageFragments[i]
      f.life += dt
      f.x += f.vx * dt * 10
      f.y += f.vy * dt * 10
      f.rotation += f.rotSpeed

      const frac = f.life / f.maxLife
      if (frac < 0.15) f.alpha = frac / 0.15 * 0.12
      else if (frac > 0.75) f.alpha = (1 - frac) / 0.25 * 0.12
      else f.alpha = 0.12

      if (f.life > f.maxLife) {
        pageFragments.splice(i, 1)
      }
    }
    // Spawn new fragments occasionally
    if (Math.random() < 0.02) spawnPageFragment()
  }

  function renderPageFragments(c: CanvasRenderingContext2D) {
    for (const f of pageFragments) {
      if (f.alpha <= 0) continue
      c.save()
      c.translate(f.x, f.y)
      c.rotate(f.rotation)
      // Tiny aged paper rectangle
      c.fillStyle = `rgba(40, 35, 25, ${f.alpha})`
      c.fillRect(-f.w / 2, -f.h / 2, f.w, f.h)
      c.strokeStyle = `rgba(80, 70, 50, ${f.alpha * 0.6})`
      c.lineWidth = 0.3
      c.strokeRect(-f.w / 2, -f.h / 2, f.w, f.h)
      // Faint text on fragment
      c.font = '5px monospace'
      c.fillStyle = `rgba(120, 100, 70, ${f.alpha * 0.8})`
      c.fillText(f.chars, -f.w / 2 + 2, 2)
      c.restore()
    }
  }

  function renderHexagonalGrid(c: CanvasRenderingContext2D, w: number, h: number) {
    // Faint hexagonal grid suggesting infinite corridors
    const hexR = 60
    const hexH = hexR * Math.sqrt(3)
    c.strokeStyle = `rgba(60, 50, 35, ${0.025 + Math.sin(time * 0.2) * 0.008})`
    c.lineWidth = 0.3

    const cols = Math.ceil(w / (hexR * 1.5)) + 2
    const rows = Math.ceil(h / hexH) + 2

    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const cx = col * hexR * 1.5
        const cy = row * hexH + (col % 2 === 0 ? 0 : hexH / 2)

        // Fade grid based on distance from center
        const dx = cx - w / 2
        const dy = cy - h / 2
        const dist = Math.sqrt(dx * dx + dy * dy)
        const fade = Math.max(0, 1 - dist / (Math.max(w, h) * 0.6))
        if (fade < 0.01) continue

        c.globalAlpha = fade
        c.beginPath()
        for (let i = 0; i < 6; i++) {
          const angle = Math.PI / 3 * i + Math.PI / 6
          const px = cx + hexR * 0.4 * Math.cos(angle)
          const py = cy + hexR * 0.4 * Math.sin(angle)
          if (i === 0) c.moveTo(px, py)
          else c.lineTo(px, py)
        }
        c.closePath()
        c.stroke()
      }
    }
    c.globalAlpha = 1
  }

  function renderInfiniteCorridors(c: CanvasRenderingContext2D, w: number, h: number) {
    // Deep perspective lines suggesting infinite corridors receding
    const cx = w / 2
    const cy = h / 2
    const numLines = 12
    const perspectiveDepth = 8

    for (let d = perspectiveDepth; d >= 1; d--) {
      const scale = d / perspectiveDepth
      const alpha = (1 - scale) * 0.03
      const rectW = w * 0.35 * scale
      const rectH = h * 0.4 * scale

      c.strokeStyle = `rgba(70, 60, 40, ${alpha})`
      c.lineWidth = 0.3
      c.strokeRect(cx - rectW / 2, cy - rectH / 2, rectW, rectH)
    }

    // Converging lines from corners toward vanishing point
    const vanishX = cx + Math.sin(time * 0.1) * 5
    const vanishY = cy + Math.cos(time * 0.13) * 3
    c.strokeStyle = 'rgba(50, 45, 30, 0.015)'
    c.lineWidth = 0.3
    const corners = [[0, 0], [w, 0], [w, h], [0, h]]
    for (const [fx, fy] of corners) {
      c.beginPath()
      c.moveTo(fx, fy)
      c.lineTo(vanishX, vanishY)
      c.stroke()
    }
  }

  function renderLamplight(c: CanvasRenderingContext2D) {
    // Warm reading-lamp circle following cursor
    const gradient = c.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 180)
    gradient.addColorStop(0, 'rgba(255, 230, 160, 0.06)')
    gradient.addColorStop(0.3, 'rgba(255, 220, 140, 0.03)')
    gradient.addColorStop(0.7, 'rgba(200, 170, 100, 0.01)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    c.fillStyle = gradient
    c.fillRect(0, 0, c.canvas.width, c.canvas.height)
  }

  function updateGlowingLetters(dt: number) {
    for (let i = glowingLetters.length - 1; i >= 0; i--) {
      const gl = glowingLetters[i]
      gl.life += dt
      gl.y -= gl.vy * dt * 10
      gl.alpha = Math.max(0, 1 - gl.life / 2) * 0.6
      if (gl.life > 2) {
        glowingLetters.splice(i, 1)
      }
    }
  }

  function renderGlowingLetters(c: CanvasRenderingContext2D) {
    c.font = '12px monospace'
    c.textAlign = 'center'
    for (const gl of glowingLetters) {
      if (gl.alpha <= 0) continue
      c.fillStyle = `rgba(255, 230, 160, ${gl.alpha})`
      c.fillText(gl.char, gl.x, gl.y)
    }
  }

  // Handle click on text to make letters glow and drift upward
  function handleTextClick(e: MouseEvent) {
    if (!canvas || !active) return
    const w = canvas.width
    const h = canvas.height
    const pageW = Math.min(w * 0.6, 500)
    const pageH = Math.min(h * 0.7, 500)
    const pageX = (w - pageW) / 2
    const pageY = (h - pageH) / 2 - 10
    const lineHeight = pageH / (LINES_PER_PAGE + 2)
    const charWidth = (pageW - 40) / CHARS_PER_LINE

    // Check if click is inside the page area
    if (e.clientX >= pageX + 20 && e.clientX <= pageX + pageW - 20 &&
        e.clientY >= pageY + 10 && e.clientY <= pageY + pageH - 10) {
      const col = Math.floor((e.clientX - pageX - 20) / charWidth)
      const line = Math.floor((e.clientY - pageY - 12) / lineHeight)
      if (line >= 0 && line < pageContent.length && col >= 0 && col < pageContent[line].length) {
        // Spawn a few glowing letters around the click
        const count = 3 + Math.floor(Math.random() * 4)
        for (let i = 0; i < count; i++) {
          const ci = Math.max(0, Math.min(pageContent[line].length - 1, col - 1 + i))
          glowingLetters.push({
            x: pageX + 20 + ci * charWidth + Math.random() * 4,
            y: pageY + 20 + line * lineHeight,
            char: pageContent[line][ci],
            alpha: 0.6,
            vy: 0.3 + Math.random() * 0.4,
            life: 0,
          })
        }
      }
    }
  }

  function handleMouseMove(e: MouseEvent) {
    mouseX = e.clientX
    mouseY = e.clientY

    if (!canvas) return
    // Existing hover detection for portal books
    hoveredPortal = -1
    hoveredShelf = -1
    for (let i = 0; i < portalBooks.length; i++) {
      const b = getPortalBookBounds(canvas.width, canvas.height, i)
      if (e.clientX >= b.x && e.clientX <= b.x + b.w &&
          e.clientY >= b.y && e.clientY <= b.y + b.h) {
        hoveredPortal = i
        break
      }
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    const dt = 0.016
    time += dt

    // Check if it's time to fetch a new poem
    if (time - lastPoemFetchTime > POEM_REFRESH_INTERVAL && !poemFetchInFlight) {
      loadNewPoem()
    }

    // Update floating poem lines
    updateFloatingLines(dt)

    // Update atmosphere particles
    updateDust(dt)
    updatePageFragments(dt)
    updateGlowingLetters(dt)
    updateChoirModulation()

    const c = ctx
    const w = canvas.width
    const h = canvas.height

    // Library darkness — warm lamplight
    c.fillStyle = 'rgba(10, 8, 5, 1)'
    c.fillRect(0, 0, w, h)

    // --- Background: hexagonal grid (behind everything) ---
    renderHexagonalGrid(c, w, h)

    // --- Background: infinite corridor perspective ---
    renderInfiniteCorridors(c, w, h)

    // --- Background: page fragments drifting ---
    renderPageFragments(c)

    // --- Floating poem lines (behind the page) ---
    renderFloatingLines(c)

    // Page area
    const pageW = Math.min(w * 0.6, 500)
    const pageH = Math.min(h * 0.7, 500)
    const pageX = (w - pageW) / 2
    const pageY = (h - pageH) / 2 - 10

    // Page background — aged paper
    c.fillStyle = 'rgba(30, 26, 20, 0.9)'
    c.fillRect(pageX, pageY, pageW, pageH)

    // Page border
    c.strokeStyle = 'rgba(80, 70, 50, 0.15)'
    c.lineWidth = 1
    c.strokeRect(pageX, pageY, pageW, pageH)

    // Page content
    const lineHeight = pageH / (LINES_PER_PAGE + 2)
    const charWidth = (pageW - 40) / CHARS_PER_LINE

    c.font = `${Math.min(12, charWidth * 1.2)}px monospace`
    c.textAlign = 'left'

    for (let line = 0; line < pageContent.length; line++) {
      const ly = pageY + 20 + line * lineHeight
      if (ly < pageY || ly > pageY + pageH - 10) continue

      const text = pageContent[line]

      // Check if this line has a memory fragment
      const frag = memoryFragmentPositions.find(f => f.line === line)

      for (let col = 0; col < text.length; col++) {
        const charX = pageX + 20 + col * charWidth

        // Lamplight proximity: text is more readable near cursor
        const dxCur = charX - mouseX
        const dyCur = ly - mouseY
        const cursorDist = Math.sqrt(dxCur * dxCur + dyCur * dyCur)
        const lampBoost = cursorDist < 140 ? (1 - cursorDist / 140) * 0.25 : 0

        // Is this character part of a memory fragment?
        const isFrag = frag && col >= frag.col && col < frag.col + frag.length
        const breathe = Math.sin(time * 1.5 + col * 0.2) * 0.03

        if (isFrag) {
          // Memory fragment — golden highlight, brighter near lamp
          c.fillStyle = `rgba(255, 215, 0, ${0.4 + breathe + lampBoost * 0.5})`
        } else {
          // Random text — barely legible, but readable near lamp
          c.fillStyle = `rgba(140, 120, 90, ${0.12 + breathe * 0.5 + lampBoost})`
        }

        c.fillText(text[col], charX, ly)
      }
    }

    // --- Lamplight overlay (warm cursor glow over text) ---
    renderLamplight(c)

    // --- Golden dust particles ---
    renderDust(c)

    // --- Glowing letters drifting upward from clicks ---
    renderGlowingLetters(c)

    // Location code
    const locStr = `hex:${String(location.hexagon).padStart(6, '0')} wall:${location.wall} shelf:${location.shelf} vol:${location.volume} p:${location.page}`
    c.font = '11px monospace'
    c.fillStyle = 'rgba(140, 120, 90, 0.15)'
    c.textAlign = 'center'
    c.fillText(locStr, w / 2, pageY + pageH + 18)

    // Navigation hints
    c.font = '12px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(140, 120, 90, ${0.06 + Math.sin(time * 1) * 0.02})`
    c.fillText('\u2190 prev page \u00b7 next page \u2192 \u00b7 r for random', w / 2, pageY + pageH + 35)

    // Memory locations sidebar
    const memories = deps.getMemories()
    if (memories.length > 0) {
      c.font = '11px monospace'
      c.fillStyle = 'rgba(255, 215, 0, 0.08)'
      c.textAlign = 'left'
      c.fillText('your memories in the library:', 12, 60)

      for (let i = 0; i < Math.min(memories.length, 8); i++) {
        const mem = memories[i]
        const mHash = Math.abs(hashString(mem.id || mem.originalText))
        const short = mem.currentText.slice(0, 20) + (mem.currentText.length > 20 ? '...' : '')
        c.fillStyle = 'rgba(255, 215, 0, 0.06)'
        c.fillText(`${short}`, 12, 78 + i * 14)
        c.fillStyle = 'rgba(140, 120, 90, 0.04)'
        c.fillText(`\u2192 hex:${(mHash % 999999).toString().padStart(6, '0')}`, 12, 90 + i * 14)
      }
    }

    // --- Portal books (right edge) ---
    renderPortalBooks(c, w, h)

    // --- Current poem info (bottom-left, subtle) ---
    if (currentPoem) {
      c.font = '11px "Cormorant Garamond", serif'
      c.fillStyle = `rgba(200, 180, 140, ${0.06 + Math.sin(time * 0.3) * 0.02})`
      c.textAlign = 'left'
      const poemInfo = `a volume found open: "${currentPoem.title}" \u2014 ${currentPoem.author}`
      c.fillText(poemInfo.length > 70 ? poemInfo.slice(0, 67) + '...' : poemInfo, 12, h - 34)
    }

    // Title
    c.font = '12px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 180, 140, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.fillText('the library', w / 2, 25)

    // Attribution
    c.font = '11px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(140, 120, 90, ${0.03 + Math.sin(time * 0.2) * 0.01})`
    c.fillText('after Borges \u2014 "The Library of Babel" (1941)', w / 2, 40)

    // Stats
    c.font = '12px monospace'
    c.fillStyle = 'rgba(140, 120, 90, 0.06)'
    c.textAlign = 'left'
    c.fillText(`${pagesViewed} pages consulted`, 12, h - 18)

    // Fragment count
    c.textAlign = 'right'
    c.fillStyle = 'rgba(255, 215, 0, 0.08)'
    const fragCount = memoryFragmentPositions.length
    c.fillText(`${fragCount} fragment${fragCount !== 1 ? 's' : ''} of you on this page`, w - 12, h - 18)

    // Bottom quote
    c.font = '12px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(140, 120, 90, ${0.03 + Math.sin(time * 0.15) * 0.01})`
    c.textAlign = 'center'
    c.fillText('the library is unlimited and periodic', w / 2, h - 4)
  }

  return {
    name: 'library',
    label: 'the library',

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

      // Click to navigate to memory's location, portal books, or glow text
      canvas.addEventListener('click', (e) => {
        // Check portal books first
        if (deps.switchTo && canvas) {
          for (let i = 0; i < portalBooks.length; i++) {
            const b = getPortalBookBounds(canvas.width, canvas.height, i)
            if (e.clientX >= b.x && e.clientX <= b.x + b.w &&
                e.clientY >= b.y && e.clientY <= b.y + b.h) {
              deps.switchTo(portalBooks[i].room)
              return
            }
          }
        }

        const memories = deps.getMemories()
        // Check if clicked on a memory in the sidebar
        if (e.clientX < 200 && e.clientY > 60 && e.clientY < 60 + memories.length * 14) {
          const idx = Math.floor((e.clientY - 60) / 14)
          if (idx >= 0 && idx < memories.length) {
            goToMemoryLocation(idx)
          }
          return
        }

        // Otherwise, handle text click (glowing letters)
        handleTextClick(e)
      })

      // Hover/cursor tracking for lamplight + portal books
      canvas.addEventListener('mousemove', handleMouseMove)

      window.addEventListener('keydown', handleKeyDown)

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

    async activate() {
      active = true
      pagesViewed = 0
      time = 0
      lastPoemFetchTime = 0
      floatingLines = []
      dustParticles = []
      pageFragments = []
      glowingLetters = []

      // Start at a location derived from the first memory, or random
      const memories = deps.getMemories()
      if (memories.length > 0) {
        goToMemoryLocation(0)
      } else {
        goToLocation({
          hexagon: Math.floor(Math.random() * 999999),
          wall: Math.floor(Math.random() * 4) + 1,
          shelf: Math.floor(Math.random() * 5) + 1,
          volume: Math.floor(Math.random() * 32) + 1,
          page: Math.floor(Math.random() * 410) + 1,
        })
      }

      // Fetch initial poem
      loadNewPoem()

      // Init audio
      await initAudio()

      // Spawn initial dust
      spawnDust()

      window.addEventListener('keydown', handleKeyDown)
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      window.removeEventListener('keydown', handleKeyDown)
      fadeAudioOut()
      if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null }
      if (pageTurnInterval) { clearTimeout(pageTurnInterval as unknown as number); pageTurnInterval = null }
      if (footstepInterval) { clearTimeout(footstepInterval as unknown as number); footstepInterval = null }
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      window.removeEventListener('keydown', handleKeyDown)
      destroyAudio()
      dustParticles = []
      pageFragments = []
      glowingLetters = []
      overlay?.remove()
    },
  }
}
