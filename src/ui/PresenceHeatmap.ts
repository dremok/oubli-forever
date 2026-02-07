/**
 * PRESENCE HEATMAP — your attention becomes visible
 *
 * As you move the cursor, invisible heat accumulates on the screen.
 * Over time, a ghostly heatmap emerges — a map of where you looked,
 * where you lingered, what drew your gaze. Hot spots glow pink.
 * Cold spots remain void. The map slowly cools, fading back to black.
 *
 * This is attention as memory. The system remembers where you were,
 * even after you've moved on. The heatmap is your presence,
 * recorded and slowly forgotten.
 *
 * Press 'h' to toggle visibility. The heatmap is always recording,
 * but only visible when activated — like memory itself, present
 * but not always conscious.
 *
 * Technical: Low-resolution grid of heat values, rendered as
 * a blurred overlay. Each frame: mouse position adds heat,
 * all cells cool by a small amount.
 *
 * Inspired by: Eye-tracking studies, thermal cameras, the way
 * footpaths form in grass from repeated walking
 */

const GRID_SIZE = 48 // cells per axis (low-res for organic look)
const HEAT_RADIUS = 3 // cells affected by cursor
const HEAT_AMOUNT = 0.04 // heat added per frame at cursor
const COOL_RATE = 0.0008 // heat lost per frame per cell

export class PresenceHeatmap {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private grid: Float32Array
  private cols = 0
  private rows = 0
  private width = 0
  private height = 0
  private cellW = 0
  private cellH = 0
  private mouseX = -1
  private mouseY = -1
  private visible = false
  private overlayAlpha = 0
  private animating = false
  private frameId = 0
  private roomCheck: (() => string) | null = null

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 50; pointer-events: none; opacity: 0;
      transition: opacity 1.5s ease;
    `
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!

    this.grid = new Float32Array(0)
    this.resize()

    window.addEventListener('resize', () => this.resize())
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX
      this.mouseY = e.clientY
    })
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'h' || e.key === 'H') &&
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA') {
        if (this.roomCheck && this.roomCheck() !== 'void') return
        this.toggle()
      }
    })
  }

  private resize() {
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = this.width
    this.canvas.height = this.height

    this.cols = GRID_SIZE
    this.rows = Math.floor(GRID_SIZE * (this.height / this.width))
    this.cellW = this.width / this.cols
    this.cellH = this.height / this.rows

    // Preserve heat data if possible
    const newGrid = new Float32Array(this.cols * this.rows)
    if (this.grid.length > 0) {
      const copyLen = Math.min(this.grid.length, newGrid.length)
      newGrid.set(this.grid.subarray(0, copyLen))
    }
    this.grid = newGrid
  }

  /** Set a function that returns the current room name */
  setRoomCheck(check: () => string) {
    this.roomCheck = check
  }

  start() {
    this.startAnimation()
  }

  private toggle() {
    this.visible = !this.visible
    this.canvas.style.opacity = this.visible ? '1' : '0'
  }

  private startAnimation() {
    if (this.animating) return
    this.animating = true

    const animate = () => {
      this.frameId = requestAnimationFrame(animate)
      this.update()
      if (this.visible || this.overlayAlpha > 0.01) {
        this.render()
      }
    }
    animate()
  }

  private update() {
    // Add heat at cursor position
    if (this.mouseX >= 0 && this.mouseY >= 0) {
      const cx = Math.floor(this.mouseX / this.cellW)
      const cy = Math.floor(this.mouseY / this.cellH)

      for (let dy = -HEAT_RADIUS; dy <= HEAT_RADIUS; dy++) {
        for (let dx = -HEAT_RADIUS; dx <= HEAT_RADIUS; dx++) {
          const gx = cx + dx
          const gy = cy + dy
          if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows) continue

          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > HEAT_RADIUS) continue

          const falloff = 1 - dist / HEAT_RADIUS
          const idx = gy * this.cols + gx
          this.grid[idx] = Math.min(1, this.grid[idx] + HEAT_AMOUNT * falloff * falloff)
        }
      }
    }

    // Cool all cells
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = Math.max(0, this.grid[i] - COOL_RATE)
    }

    // Track overlay fade
    this.overlayAlpha += (this.visible ? 1 : 0 - this.overlayAlpha) * 0.05
  }

  private render() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const heat = this.grid[y * this.cols + x]
        if (heat < 0.01) continue

        // Color: cold = deep blue, warm = pink, hot = white-gold
        let r: number, g: number, b: number

        if (heat < 0.3) {
          // Cold: deep violet/blue
          const t = heat / 0.3
          r = 30 + t * 100
          g = 10 + t * 20
          b = 80 + t * 80
        } else if (heat < 0.7) {
          // Warm: pink/magenta
          const t = (heat - 0.3) / 0.4
          r = 130 + t * 125
          g = 30 + t * 20
          b = 160 - t * 30
        } else {
          // Hot: gold/white
          const t = (heat - 0.7) / 0.3
          r = 255
          g = 50 + t * 165
          b = 130 - t * 30 + t * 100
        }

        const alpha = heat * 0.35

        ctx.fillStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha})`

        // Slightly larger than cell for overlap/blur
        const pad = 2
        ctx.fillRect(
          x * this.cellW - pad,
          y * this.cellH - pad,
          this.cellW + pad * 2,
          this.cellH + pad * 2
        )
      }
    }
  }

  isVisible(): boolean {
    return this.visible
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
    this.canvas.remove()
  }
}
