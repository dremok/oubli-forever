/**
 * THE MEMBRANE — the living tissue between rooms
 *
 * When you move between rooms, you don't just switch. You push through
 * a membrane. The membrane is alive — it remembers what has passed
 * through it, it thickens on rarely-used paths, thins on well-traveled ones.
 *
 * The visual: a brief organic overlay with cellular patterns that
 * parts and dissolves as you push through. Stronger mycelium trails
 * make the membrane thinner and more translucent. Weak trails create
 * a denser, more resistant passage.
 *
 * During the passage, fragments of both rooms bleed into each other —
 * a liminal space where two rooms coexist for a moment.
 *
 * Inspired by:
 * - Cell membranes: selectively permeable, alive, sensing
 * - Lattice surgery: splitting entangled quantum states without destruction
 *   (splitting qubits while maintaining coherence — Feb 2026)
 * - The space between sleeping and waking
 * - Tracey Emin's "A Second Life" — the membrane between death and living again
 * - The Nottingham/Cambridge discovery that episodic and semantic memory
 *   share the same brain regions — boundaries that dissolve at the neural level
 */

export class Membrane {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private active = false
  private progress = 0      // 0 to 1: passage progress
  private trailStrength = 0  // 0 to 1: how well-traveled this path is
  private fromRoom = ''
  private toRoom = ''
  private cells: Cell[] = []
  private fragments: Fragment[] = []
  private animFrame: number | null = null
  private getTrailStrength: ((a: string, b: string) => number) | null = null

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 200; pointer-events: none; opacity: 0;
      transition: opacity 0.15s ease;
    `
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio, 2)
    this.canvas.width = window.innerWidth * dpr
    this.canvas.height = window.innerHeight * dpr
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  /** Wire to mycelium trail data */
  setTrailSource(fn: (a: string, b: string) => number) {
    this.getTrailStrength = fn
  }

  /** Called on every room transition */
  onTransition(from: string, to: string) {
    this.fromRoom = from
    this.toRoom = to
    this.trailStrength = this.getTrailStrength?.(from, to) ?? 0

    // Generate cellular structure
    this.generateCells()
    this.generateFragments()

    // Start the passage
    this.active = true
    this.progress = 0
    this.canvas.style.opacity = '1'

    if (this.animFrame) cancelAnimationFrame(this.animFrame)
    const startTime = performance.now()

    // Duration: 800ms (strong trail) to 1800ms (weak trail)
    const duration = 800 + (1 - this.trailStrength) * 1000

    const animate = () => {
      const elapsed = performance.now() - startTime
      this.progress = Math.min(1, elapsed / duration)

      this.render()

      if (this.progress < 1) {
        this.animFrame = requestAnimationFrame(animate)
      } else {
        this.canvas.style.opacity = '0'
        this.active = false
        this.animFrame = null
      }
    }
    this.animFrame = requestAnimationFrame(animate)
  }

  private generateCells() {
    const w = window.innerWidth
    const h = window.innerHeight
    // More cells = denser membrane = less-traveled path
    const count = 20 + Math.floor((1 - this.trailStrength) * 30)
    this.cells = []

    for (let i = 0; i < count; i++) {
      this.cells.push({
        x: Math.random() * w,
        y: Math.random() * h,
        radius: 30 + Math.random() * 80 + (1 - this.trailStrength) * 40,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5,
        opacity: 0.04 + (1 - this.trailStrength) * 0.06,
      })
    }
  }

  private generateFragments() {
    this.fragments = []
    const w = window.innerWidth
    const h = window.innerHeight

    // Room name fragments that bleed through during transition
    const fromChars = this.fromRoom.split('')
    const toChars = this.toRoom.split('')

    // Scatter characters from both rooms
    for (let i = 0; i < Math.min(fromChars.length, 8); i++) {
      this.fragments.push({
        x: w * (0.1 + Math.random() * 0.35),
        y: h * (0.2 + Math.random() * 0.6),
        char: fromChars[i],
        side: 'from',
        drift: -20 - Math.random() * 30, // drifts left (leaving)
        baseOpacity: 0.06 + Math.random() * 0.04,
      })
    }
    for (let i = 0; i < Math.min(toChars.length, 8); i++) {
      this.fragments.push({
        x: w * (0.55 + Math.random() * 0.35),
        y: h * (0.2 + Math.random() * 0.6),
        char: toChars[i],
        side: 'to',
        drift: 20 + Math.random() * 30, // drifts right (arriving)
        baseOpacity: 0.06 + Math.random() * 0.04,
      })
    }
  }

  private render() {
    const w = window.innerWidth
    const h = window.innerHeight
    const ctx = this.ctx

    ctx.clearRect(0, 0, w, h)

    // Easing: the membrane parts in the middle, closes at start and end
    // Like pushing through a bubble
    const parting = Math.sin(this.progress * Math.PI) // 0 → 1 → 0

    // Overall opacity: fade in quickly, hold, fade out
    const alpha = this.progress < 0.15
      ? this.progress / 0.15
      : this.progress > 0.85
        ? (1 - this.progress) / 0.15
        : 1

    // Background: dark organic wash
    const bgAlpha = alpha * (0.15 + (1 - this.trailStrength) * 0.15)
    ctx.fillStyle = `rgba(8, 4, 2, ${bgAlpha})`
    ctx.fillRect(0, 0, w, h)

    // Cellular structures — Voronoi-like organic blobs
    for (const cell of this.cells) {
      const wobble = Math.sin(this.progress * Math.PI * 2 + cell.phase) * 8
      const cellAlpha = cell.opacity * alpha * (1 - parting * 0.6)

      // Cell membrane (ring)
      ctx.beginPath()
      ctx.arc(
        cell.x + wobble,
        cell.y + wobble * 0.7,
        cell.radius * (0.8 + parting * 0.3),
        0, Math.PI * 2
      )
      // Color: golden-green for strong trails, gray for weak
      const hue = 60 + this.trailStrength * 60 // 60 (gold) → 120 (green)
      ctx.strokeStyle = `hsla(${hue}, 30%, 50%, ${cellAlpha})`
      ctx.lineWidth = 0.5 + (1 - this.trailStrength)
      ctx.stroke()

      // Inner fill — very faint
      ctx.fillStyle = `hsla(${hue}, 20%, 30%, ${cellAlpha * 0.3})`
      ctx.fill()
    }

    // Central parting line — where the membrane splits
    if (parting > 0.1) {
      const splitX = w / 2
      const splitWidth = parting * w * 0.3

      const gradient = ctx.createLinearGradient(
        splitX - splitWidth / 2, 0,
        splitX + splitWidth / 2, 0
      )
      gradient.addColorStop(0, `rgba(200, 170, 80, ${0.08 * alpha})`)
      gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0)')
      gradient.addColorStop(1, `rgba(200, 170, 80, ${0.08 * alpha})`)

      ctx.fillStyle = gradient
      ctx.fillRect(splitX - splitWidth / 2, 0, splitWidth, h)
    }

    // Filament connections between cells (mycelium within the membrane)
    ctx.lineWidth = 0.3
    for (let i = 0; i < this.cells.length; i++) {
      for (let j = i + 1; j < Math.min(i + 4, this.cells.length); j++) {
        const a = this.cells[i]
        const b = this.cells[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 200) continue

        const filamentAlpha = (1 - dist / 200) * 0.03 * alpha * (1 - parting * 0.5)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        // Organic curve
        const midX = (a.x + b.x) / 2 + Math.sin(this.progress * 5 + i) * 15
        const midY = (a.y + b.y) / 2 + Math.cos(this.progress * 4 + j) * 10
        ctx.quadraticCurveTo(midX, midY, b.x, b.y)
        ctx.strokeStyle = `rgba(180, 160, 80, ${filamentAlpha})`
        ctx.stroke()
      }
    }

    // Room name fragments bleeding through
    ctx.font = '16px Cormorant Garamond, serif'
    ctx.textAlign = 'center'
    for (const frag of this.fragments) {
      const fragProgress = frag.side === 'from'
        ? 1 - this.progress  // fading out
        : this.progress       // fading in

      const fragAlpha = frag.baseOpacity * fragProgress * alpha
      const x = frag.x + frag.drift * this.progress * (frag.side === 'from' ? 1 : -1)
      const y = frag.y

      ctx.fillStyle = frag.side === 'from'
        ? `rgba(200, 150, 100, ${fragAlpha})`
        : `rgba(150, 200, 180, ${fragAlpha})`

      ctx.fillText(frag.char, x, y)
    }
  }
}

// --- Supporting types ---

interface Cell {
  x: number; y: number
  radius: number
  phase: number
  speed: number
  opacity: number
}

interface Fragment {
  x: number; y: number
  char: string
  side: 'from' | 'to'
  drift: number
  baseOpacity: number
}
