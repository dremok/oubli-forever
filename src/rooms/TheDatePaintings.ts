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

interface PaintingRecord {
  firstVisit: string // ISO date
  visitDays: string[] // ISO dates of days visited
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

  function loadRecord() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) record = JSON.parse(stored)
    } catch {}
  }

  function saveRecord() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
    } catch {}
  }

  function recordVisit() {
    const today = new Date().toISOString().split('T')[0]
    if (!record.firstVisit) record.firstVisit = today
    if (!record.visitDays.includes(today)) {
      record.visitDays.push(today)
    }
    saveRecord()
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

  function getBackgroundColor(timestamp: number, degradation: number): string {
    const now = Date.now()
    const age = (now - timestamp) / (1000 * 60 * 60 * 24) // days old

    // Kawara used different background colors across his career
    // Older → warmer/darker, recent → cooler
    const ageFactor = Math.min(1, age / 365) // normalize to 0-1 over a year

    const r = Math.floor(20 + ageFactor * 40 + (1 - ageFactor) * 10)
    const g = Math.floor(15 + ageFactor * 15 + (1 - ageFactor) * 20)
    const b = Math.floor(30 + (1 - ageFactor) * 50 + ageFactor * 10)

    // Degradation dims the painting
    const dimFactor = 1 - degradation * 0.3
    return `rgb(${Math.floor(r * dimFactor)}, ${Math.floor(g * dimFactor)}, ${Math.floor(b * dimFactor)})`
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const c = ctx
    const w = canvas.width
    const h = canvas.height

    // Gallery wall — neutral dark
    c.fillStyle = 'rgba(12, 10, 14, 1)'
    c.fillRect(0, 0, w, h)

    const memories = deps.getMemories()

    // Painting dimensions
    const paintingW = Math.min(180, w * 0.2)
    const paintingH = paintingW * 0.6 // Kawara's paintings are roughly this ratio
    const gap = 30
    const cols = Math.max(1, Math.floor((w - 60) / (paintingW + gap)))
    const startX = (w - cols * (paintingW + gap) + gap) / 2

    // Today's painting (always first)
    const todayDate = formatDate(Date.now())

    // Unique dates from memories
    const dates: { date: ReturnType<typeof formatDate>; degradation: number; timestamp: number }[] = []

    // Add today
    dates.push({
      date: todayDate,
      degradation: 0,
      timestamp: Date.now(),
    })

    // Add memory dates (deduplicate by day)
    const seenDays = new Set<string>()
    seenDays.add(todayDate.full)

    for (const mem of memories) {
      const d = formatDate(mem.timestamp)
      if (!seenDays.has(d.full)) {
        seenDays.add(d.full)
        dates.push({
          date: d,
          degradation: mem.degradation,
          timestamp: mem.timestamp,
        })
      }
    }

    // Sort by timestamp (most recent first)
    dates.sort((a, b) => b.timestamp - a.timestamp)

    // Draw paintings
    for (let i = 0; i < dates.length; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const px = startX + col * (paintingW + gap)
      const py = 80 + row * (paintingH + gap + 20) + scrollOffset

      // Skip if off-screen
      if (py + paintingH < 0 || py > h) continue

      const entry = dates[i]
      const isToday = i === 0

      // Painting background
      c.fillStyle = getBackgroundColor(entry.timestamp, entry.degradation)
      c.fillRect(px, py, paintingW, paintingH)

      // Subtle frame
      c.strokeStyle = 'rgba(60, 50, 40, 0.15)'
      c.lineWidth = 1
      c.strokeRect(px - 1, py - 1, paintingW + 2, paintingH + 2)

      // Date text — white, centered, Kawara-style
      const dateAlpha = Math.max(0.05, 1 - entry.degradation * 0.8)

      // Degradation effect on text — characters drop out
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

      // Today's painting gets a subtle glow
      if (isToday) {
        const glow = c.createRadialGradient(
          px + paintingW / 2, py + paintingH / 2, 0,
          px + paintingW / 2, py + paintingH / 2, paintingW * 0.6,
        )
        glow.addColorStop(0, `rgba(255, 215, 0, ${0.02 + Math.sin(time * 0.5) * 0.01})`)
        glow.addColorStop(1, 'transparent')
        c.fillStyle = glow
        c.fillRect(px - 10, py - 10, paintingW + 20, paintingH + 20)

        // "today" label
        c.font = '7px monospace'
        c.fillStyle = 'rgba(255, 215, 0, 0.12)'
        c.fillText('TODAY', px + paintingW / 2, py + paintingH + 12)
      }
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

    // Bottom
    c.font = '9px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 190, 170, ${0.03 + Math.sin(time * 0.15) * 0.01})`
    c.fillText('I am still alive', w / 2, h - 4)
  }

  function handleWheel(e: WheelEvent) {
    scrollOffset -= e.deltaY * 0.5
    scrollOffset = Math.min(0, scrollOffset) // can't scroll above top
    e.preventDefault()
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

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)

      // Navigation portals — On Kawara minimalist date-like labels at bottom
      if (deps.switchTo) {
        const portalData = [
          { name: 'clocktower', label: 'JAN.1,∞ — clocktower', color: '200, 190, 170' },
          { name: 'library', label: 'FEB.29,— — library', color: '180, 180, 200' },
          { name: 'archive', label: 'DEC.31,0 — archive', color: '160, 150, 140' },
        ]
        const totalW = portalData.length
        for (let i = 0; i < portalData.length; i++) {
          const p = portalData[i]
          const el = document.createElement('div')
          const leftPct = ((i + 0.5) / totalW) * 100
          el.style.cssText = `
            position: absolute; bottom: 22px; left: ${leftPct}%;
            transform: translateX(-50%);
            pointer-events: auto; cursor: pointer;
            font-family: monospace;
            font-size: 7px; letter-spacing: 2px;
            color: rgba(${p.color}, 0.05);
            transition: color 0.5s ease, text-shadow 0.5s ease;
            padding: 6px 10px; z-index: 10;
          `
          el.textContent = p.label
          el.addEventListener('mouseenter', () => {
            el.style.color = `rgba(${p.color}, 0.4)`
            el.style.textShadow = `0 0 8px rgba(${p.color}, 0.12)`
          })
          el.addEventListener('mouseleave', () => {
            el.style.color = `rgba(${p.color}, 0.05)`
            el.style.textShadow = 'none'
          })
          el.addEventListener('click', (e) => {
            e.stopPropagation()
            deps.switchTo!(p.name)
          })
          overlay.appendChild(el)
        }
      }

      return overlay
    },

    activate() {
      active = true
      scrollOffset = 0
      loadRecord()
      recordVisit()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      overlay?.remove()
    },
  }
}
