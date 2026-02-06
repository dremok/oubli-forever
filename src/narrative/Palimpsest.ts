/**
 * PALIMPSEST — layers of erased text bleeding through
 *
 * In the background, barely visible, fragments of text from previous
 * sessions appear and disappear. These are "palimpsest layers" —
 * like the ghosts of writing on a manuscript that was scraped clean
 * and written over.
 *
 * The system saves the last 50 texts ever typed into the forgetting
 * machine in localStorage. On each visit, some of these texts appear
 * at random positions, extremely faint, as if bleeding through from
 * a previous reality. They're oriented at slight angles. Some are
 * backwards. Some overlap.
 *
 * The effect is barely noticeable at first. Over many sessions, as
 * the palimpsest layer grows denser, the void starts to feel haunted
 * by its own history.
 *
 * Inspired by: Medieval palimpsests, Rauschenberg's "Erased de Kooning",
 * urban archaeology, the way old wallpaper shows through new paint
 */

const STORAGE_KEY = 'oubli-palimpsest'
const MAX_TEXTS = 50

interface PalimpsestFragment {
  text: string
  x: number
  y: number
  angle: number
  alpha: number
  targetAlpha: number
  fontSize: number
  mirrored: boolean
  phase: number
}

export class Palimpsest {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private texts: string[] = []
  private fragments: PalimpsestFragment[] = []
  private width = 0
  private height = 0
  private dpr = 1
  private frameId = 0
  private animating = false
  private frame = 0

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 3; pointer-events: none;
    `
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!
    this.resize()

    this.loadTexts()
    window.addEventListener('resize', () => this.resize())
  }

  private resize() {
    this.dpr = Math.min(window.devicePixelRatio, 2)
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = this.width * this.dpr
    this.canvas.height = this.height * this.dpr
    this.canvas.style.width = this.width + 'px'
    this.canvas.style.height = this.height + 'px'
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  private loadTexts() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        this.texts = JSON.parse(stored)
      }
    } catch { /* */ }
  }

  private saveTexts() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.texts))
    } catch { /* */ }
  }

  /** Add a new text to the palimpsest layer */
  addText(text: string) {
    this.texts.push(text)
    if (this.texts.length > MAX_TEXTS) {
      this.texts.shift() // Remove oldest
    }
    this.saveTexts()
  }

  start() {
    if (this.texts.length === 0) return

    // Create fragments from stored texts — only show a subset
    const numToShow = Math.min(this.texts.length, 8 + Math.floor(Math.random() * 5))
    const shuffled = [...this.texts].sort(() => Math.random() - 0.5)

    for (let i = 0; i < numToShow; i++) {
      this.fragments.push({
        text: shuffled[i],
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        angle: (Math.random() - 0.5) * 0.3, // slight tilt
        alpha: 0,
        targetAlpha: 0.03 + Math.random() * 0.04, // very faint
        fontSize: 14 + Math.random() * 10,
        mirrored: Math.random() < 0.15, // 15% chance of being backwards
        phase: Math.random() * Math.PI * 2,
      })
    }

    this.startAnimation()
  }

  private startAnimation() {
    if (this.animating) return
    this.animating = true

    const animate = () => {
      this.frameId = requestAnimationFrame(animate)
      this.frame++
      this.render()
    }
    animate()
  }

  private render() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    for (const f of this.fragments) {
      // Very slow breathing — fragments phase in and out
      const breathe = Math.sin(this.frame * 0.003 + f.phase) * 0.5 + 0.5
      f.alpha += (f.targetAlpha * breathe - f.alpha) * 0.01

      if (f.alpha < 0.005) continue

      ctx.save()
      ctx.translate(f.x, f.y)
      ctx.rotate(f.angle)

      if (f.mirrored) {
        ctx.scale(-1, 1)
      }

      ctx.font = `300 ${f.fontSize}px 'Cormorant Garamond', serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillStyle = `rgba(180, 160, 200, ${f.alpha})`

      ctx.fillText(f.text, 0, 0)

      ctx.restore()
    }
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
    this.canvas.remove()
  }
}
