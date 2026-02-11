/**
 * RESIDUE — visible traces of invisible effort
 *
 * Michael Joo's "Sweat Models" (exhibited Feb 2026) captures the
 * residue of physical effort — sweat, condensation, body heat — as
 * the artwork itself. The visible trace of labor IS the piece.
 * Not what you made, but what making cost you.
 *
 * In Oubli, every interaction leaves invisible residue:
 * - Cursor distance traveled (how much you searched)
 * - Hover duration before clicks (how long you hesitated)
 * - Keys pressed then deleted (what you almost said)
 * - Scroll distance (how far you looked)
 * - Time between interactions (your rhythm, your patience)
 *
 * This residue accumulates and becomes subtly visible as heat-like
 * marks at the bottom of the screen — a thin, shimmering band that
 * grows warmer and more complex with effort. It's not what you DID
 * in the house. It's what it COST you to do it.
 *
 * The residue decays slowly (over hours) but never fully disappears.
 * Like a patina of use. Like fingerprints on glass.
 *
 * Inspired by:
 * - Michael Joo "Sweat Models" (Feb 2026): effort residue as art
 * - Thermal imaging: seeing what's invisible to the naked eye
 * - "Guaranteed Human" movement: the premium of visible human effort
 * - Indexical art: art that points to its own process of creation
 */

const STORAGE_KEY = 'oubli-residue'
const SAVE_INTERVAL = 30000  // save every 30s
const DECAY_RATE = 0.00002   // per ms — ~50% in 10 hours
const RENDER_INTERVAL = 200  // redraw every 200ms
const MAX_MARKS = 60         // max visible marks

interface ResidueState {
  totalCursorDistance: number
  totalHesitation: number    // cumulative ms of hover-before-click
  totalDeletions: number     // keys deleted (backspace/delete presses)
  totalScrollDistance: number
  totalClicks: number
  totalKeystrokes: number
  marks: ResidueMark[]
  lastSaveTime: number
}

interface ResidueMark {
  x: number       // 0-1 normalized position
  intensity: number // 0-1
  type: 'cursor' | 'hesitation' | 'deletion' | 'scroll'
  created: number  // timestamp
}

export class Residue {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private state: ResidueState
  private lastMousePos = { x: 0, y: 0 }
  private hoverStart = 0
  private sessionCursorDist = 0
  private sessionDeletions = 0
  private sessionScrollDist = 0
  private animFrame: number | null = null

  constructor() {
    // Load persisted state
    this.state = this.loadState()

    // Apply time-based decay since last save
    const elapsed = Date.now() - this.state.lastSaveTime
    if (elapsed > 0) {
      const decay = Math.exp(-DECAY_RATE * elapsed)
      this.state.marks = this.state.marks
        .map(m => ({ ...m, intensity: m.intensity * decay }))
        .filter(m => m.intensity > 0.01)
    }

    // Create canvas — thin band at bottom
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 32px;
      z-index: 56;
      pointer-events: none;
      opacity: 0.6;
    `
    this.canvas.width = window.innerWidth
    this.canvas.height = 32
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!

    // Handle resize
    window.addEventListener('resize', () => {
      this.canvas.width = window.innerWidth
      this.canvas.height = 32
    })

    // Track interactions
    this.bindEvents()

    // Save periodically
    setInterval(() => this.saveState(), SAVE_INTERVAL)

    // Start render loop
    this.render()
  }

  private bindEvents() {
    // Cursor distance
    window.addEventListener('mousemove', (e) => {
      const dx = e.clientX - this.lastMousePos.x
      const dy = e.clientY - this.lastMousePos.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      this.sessionCursorDist += dist
      this.state.totalCursorDistance += dist
      this.lastMousePos = { x: e.clientX, y: e.clientY }

      // Every 500px of cursor travel, add a cursor residue mark
      if (this.sessionCursorDist > 500) {
        this.addMark(e.clientX / window.innerWidth, 'cursor', 0.3)
        this.sessionCursorDist -= 500
      }
    })

    // Hover duration (hesitation before click)
    window.addEventListener('mousedown', () => {
      if (this.hoverStart > 0) {
        const hesitation = Date.now() - this.hoverStart
        this.state.totalHesitation += hesitation
        // Long hesitations (>1s) leave marks
        if (hesitation > 1000) {
          const intensity = Math.min(0.6, hesitation / 5000)
          this.addMark(this.lastMousePos.x / window.innerWidth, 'hesitation', intensity)
        }
      }
      this.state.totalClicks++
    })

    // Reset hover timer on mouse stop
    let moveTimeout: number | null = null
    window.addEventListener('mousemove', () => {
      this.hoverStart = Date.now()
      if (moveTimeout) clearTimeout(moveTimeout)
      moveTimeout = window.setTimeout(() => {
        this.hoverStart = Date.now()
      }, 200)
    })

    // Deletions (backspace/delete)
    window.addEventListener('keydown', (e) => {
      this.state.totalKeystrokes++
      if (e.key === 'Backspace' || e.key === 'Delete') {
        this.sessionDeletions++
        this.state.totalDeletions++
        // Every 5 deletions, leave a deletion mark
        if (this.sessionDeletions % 5 === 0) {
          this.addMark(Math.random(), 'deletion', 0.4)
        }
      }
    })

    // Scroll distance
    window.addEventListener('scroll', () => {
      this.sessionScrollDist += 50 // approximate
      this.state.totalScrollDistance += 50
      if (this.sessionScrollDist > 300) {
        this.addMark(Math.random(), 'scroll', 0.2)
        this.sessionScrollDist -= 300
      }
    }, { passive: true })

    // Also track wheel events (most rooms don't scroll)
    window.addEventListener('wheel', (e) => {
      const dist = Math.abs(e.deltaY) + Math.abs(e.deltaX)
      this.sessionScrollDist += dist
      this.state.totalScrollDistance += dist
      if (this.sessionScrollDist > 300) {
        this.addMark(this.lastMousePos.x / window.innerWidth, 'scroll', 0.2)
        this.sessionScrollDist -= 300
      }
    }, { passive: true })
  }

  private addMark(x: number, type: ResidueMark['type'], intensity: number) {
    this.state.marks.push({
      x: Math.max(0, Math.min(1, x)),
      intensity,
      type,
      created: Date.now(),
    })
    // Prune oldest if too many
    if (this.state.marks.length > MAX_MARKS) {
      this.state.marks.sort((a, b) => b.intensity - a.intensity)
      this.state.marks = this.state.marks.slice(0, MAX_MARKS)
    }
  }

  private render() {
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height

    ctx.clearRect(0, 0, w, h)

    if (this.state.marks.length === 0) {
      this.animFrame = requestAnimationFrame(() => {
        setTimeout(() => this.render(), RENDER_INTERVAL)
      })
      return
    }

    // Type-based colors (warm palette — like thermal imaging)
    const colors: Record<string, [number, number, number]> = {
      cursor:     [255, 180, 100],  // warm amber
      hesitation: [255, 120, 80],   // hot orange-red
      deletion:   [200, 100, 160],  // bruised purple
      scroll:     [180, 160, 120],  // dust brown
    }

    // Draw each mark as a soft gradient blob
    for (const mark of this.state.marks) {
      // Apply time decay
      const age = Date.now() - mark.created
      const decay = Math.exp(-DECAY_RATE * age)
      const alpha = mark.intensity * decay

      if (alpha < 0.005) continue

      const cx = mark.x * w
      const [r, g, b] = colors[mark.type] || [200, 180, 140]

      // Soft radial gradient
      const radius = 20 + alpha * 30
      const grad = ctx.createRadialGradient(cx, h * 0.6, 0, cx, h * 0.6, radius)
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha * 0.15})`)
      grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${alpha * 0.06})`)
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)

      ctx.fillStyle = grad
      ctx.fillRect(cx - radius, 0, radius * 2, h)
    }

    // Thin baseline glow if any marks exist — the residue "floor"
    const totalIntensity = this.state.marks.reduce((s, m) => {
      const age = Date.now() - m.created
      return s + m.intensity * Math.exp(-DECAY_RATE * age)
    }, 0)
    const baseAlpha = Math.min(0.04, totalIntensity * 0.005)
    if (baseAlpha > 0.002) {
      const baseGrad = ctx.createLinearGradient(0, 0, 0, h)
      baseGrad.addColorStop(0, 'transparent')
      baseGrad.addColorStop(0.7, `rgba(255, 180, 120, ${baseAlpha})`)
      baseGrad.addColorStop(1, `rgba(255, 180, 120, ${baseAlpha * 0.5})`)
      ctx.fillStyle = baseGrad
      ctx.fillRect(0, 0, w, h)
    }

    this.animFrame = requestAnimationFrame(() => {
      setTimeout(() => this.render(), RENDER_INTERVAL)
    })
  }

  private loadState(): ResidueState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) return JSON.parse(stored)
    } catch { /* ignore */ }
    return {
      totalCursorDistance: 0,
      totalHesitation: 0,
      totalDeletions: 0,
      totalScrollDistance: 0,
      totalClicks: 0,
      totalKeystrokes: 0,
      marks: [],
      lastSaveTime: Date.now(),
    }
  }

  private saveState() {
    this.state.lastSaveTime = Date.now()
    // Prune dead marks before saving
    this.state.marks = this.state.marks.filter(m => {
      const age = Date.now() - m.created
      return m.intensity * Math.exp(-DECAY_RATE * age) > 0.01
    })
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch { /* quota exceeded — clear old marks */ }
  }

  /** Total effort metrics */
  getEffort(): { distance: number; hesitation: number; deletions: number; clicks: number } {
    return {
      distance: this.state.totalCursorDistance,
      hesitation: this.state.totalHesitation,
      deletions: this.state.totalDeletions,
      clicks: this.state.totalClicks,
    }
  }

  /** Number of active marks */
  getMarkCount(): number {
    return this.state.marks.length
  }
}
