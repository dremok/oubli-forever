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
        c.font = '11px "Cormorant Garamond", serif'
        c.fillStyle = `rgba(220, 200, 160, ${Math.max(0, fl.alpha + breathe)})`
      } else if (fl.isAuthor) {
        c.font = '9px "Cormorant Garamond", serif'
        c.fillStyle = `rgba(180, 160, 130, ${Math.max(0, fl.alpha * 0.8 + breathe)})`
      } else {
        c.font = '10px "Cormorant Garamond", serif'
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
      c.font = hovered ? '8px "Cormorant Garamond", serif' : '7px "Cormorant Garamond", serif'
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

    const c = ctx
    const w = canvas.width
    const h = canvas.height

    // Library darkness — warm lamplight
    c.fillStyle = 'rgba(10, 8, 5, 1)'
    c.fillRect(0, 0, w, h)

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
        const cx = pageX + 20 + col * charWidth

        // Is this character part of a memory fragment?
        const isFrag = frag && col >= frag.col && col < frag.col + frag.length
        const breathe = Math.sin(time * 1.5 + col * 0.2) * 0.03

        if (isFrag) {
          // Memory fragment — golden highlight
          c.fillStyle = `rgba(255, 215, 0, ${0.4 + breathe})`
        } else {
          // Random text — barely legible
          c.fillStyle = `rgba(140, 120, 90, ${0.12 + breathe * 0.5})`
        }

        c.fillText(text[col], cx, ly)
      }
    }

    // Location code
    const locStr = `hex:${String(location.hexagon).padStart(6, '0')} wall:${location.wall} shelf:${location.shelf} vol:${location.volume} p:${location.page}`
    c.font = '8px monospace'
    c.fillStyle = 'rgba(140, 120, 90, 0.15)'
    c.textAlign = 'center'
    c.fillText(locStr, w / 2, pageY + pageH + 18)

    // Navigation hints
    c.font = '9px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(140, 120, 90, ${0.06 + Math.sin(time * 1) * 0.02})`
    c.fillText('\u2190 prev page \u00b7 next page \u2192 \u00b7 r for random', w / 2, pageY + pageH + 35)

    // Memory locations sidebar
    const memories = deps.getMemories()
    if (memories.length > 0) {
      c.font = '8px monospace'
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
      c.font = '8px "Cormorant Garamond", serif'
      c.fillStyle = `rgba(200, 180, 140, ${0.06 + Math.sin(time * 0.3) * 0.02})`
      c.textAlign = 'left'
      const poemInfo = `a volume found open: "${currentPoem.title}" \u2014 ${currentPoem.author}`
      c.fillText(poemInfo.length > 70 ? poemInfo.slice(0, 67) + '...' : poemInfo, 12, h - 34)
    }

    // Title
    c.font = '10px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 180, 140, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.fillText('the library', w / 2, 25)

    // Attribution
    c.font = '8px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(140, 120, 90, ${0.03 + Math.sin(time * 0.2) * 0.01})`
    c.fillText('after Borges \u2014 "The Library of Babel" (1941)', w / 2, 40)

    // Stats
    c.font = '9px monospace'
    c.fillStyle = 'rgba(140, 120, 90, 0.06)'
    c.textAlign = 'left'
    c.fillText(`${pagesViewed} pages consulted`, 12, h - 18)

    // Fragment count
    c.textAlign = 'right'
    c.fillStyle = 'rgba(255, 215, 0, 0.08)'
    const fragCount = memoryFragmentPositions.length
    c.fillText(`${fragCount} fragment${fragCount !== 1 ? 's' : ''} of you on this page`, w - 12, h - 18)

    // Bottom quote
    c.font = '9px "Cormorant Garamond", serif'
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

      // Click to navigate to memory's location or portal books
      canvas.addEventListener('click', (e) => {
        // Check portal books
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
        }
      })

      // Hover detection for portal books
      canvas.addEventListener('mousemove', (e) => {
        if (!canvas) return
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
      })

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

    activate() {
      active = true
      pagesViewed = 0
      time = 0
      lastPoemFetchTime = 0
      floatingLines = []

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

      window.addEventListener('keydown', handleKeyDown)
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      window.removeEventListener('keydown', handleKeyDown)
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      window.removeEventListener('keydown', handleKeyDown)
      overlay?.remove()
    },
  }
}
