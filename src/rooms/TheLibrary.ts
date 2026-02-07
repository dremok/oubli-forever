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

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const c = ctx
    const w = canvas.width
    const h = canvas.height

    // Library darkness — warm lamplight
    c.fillStyle = 'rgba(10, 8, 5, 1)'
    c.fillRect(0, 0, w, h)

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
    c.fillText('← prev page · next page → · r for random', w / 2, pageY + pageH + 35)

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
        c.fillText(`→ hex:${(mHash % 999999).toString().padStart(6, '0')}`, 12, 90 + i * 14)
      }
    }

    // Title
    c.font = '10px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 180, 140, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.fillText('the library', w / 2, 25)

    // Attribution
    c.font = '8px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(140, 120, 90, ${0.03 + Math.sin(time * 0.2) * 0.01})`
    c.fillText('after Borges — "The Library of Babel" (1941)', w / 2, 40)

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

      // Click to navigate to memory's location
      canvas.addEventListener('click', (e) => {
        const memories = deps.getMemories()
        // Check if clicked on a memory in the sidebar
        if (e.clientX < 200 && e.clientY > 60 && e.clientY < 60 + memories.length * 14) {
          const idx = Math.floor((e.clientY - 60) / 14)
          if (idx >= 0 && idx < memories.length) {
            goToMemoryLocation(idx)
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
