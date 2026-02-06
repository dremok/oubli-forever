/**
 * PARTICLE TRAILS — afterimages of the cosmos
 *
 * A frame accumulation effect that creates ghostly trails behind
 * particles as they move. Instead of clearing the canvas completely
 * each frame, we overlay a semi-transparent black rectangle,
 * letting previous frames bleed through.
 *
 * The result: particles leave luminous comet tails. The void
 * remembers where light was, even after it moves on. This is
 * visual memory — persistence of vision made literal.
 *
 * This works by capturing the WebGL canvas to a 2D canvas
 * and compositing it with reduced opacity each frame. The trail
 * length is controlled by the opacity of the fade overlay.
 *
 * Press 't' to toggle trails on/off.
 *
 * Inspired by: Long-exposure photography, comet tails,
 * persistence of vision, the trail a sparkler leaves in the dark
 */

export class ParticleTrails {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private sourceCanvas: HTMLCanvasElement | null = null
  private active = false
  private width = 0
  private height = 0
  private frameId = 0
  private animating = false
  private trailOpacity = 0.92 // Higher = longer trails

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 5; pointer-events: none; opacity: 0;
      transition: opacity 1s ease;
      mix-blend-mode: screen;
    `
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!
    this.resize()

    window.addEventListener('resize', () => this.resize())
    window.addEventListener('keydown', (e) => {
      if ((e.key === 't' || e.key === 'T') &&
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA') {
        this.toggle()
      }
    })
  }

  private resize() {
    this.width = window.innerWidth
    this.height = window.innerHeight
    // Use lower resolution for performance
    this.canvas.width = Math.floor(this.width / 2)
    this.canvas.height = Math.floor(this.height / 2)
    this.canvas.style.width = this.width + 'px'
    this.canvas.style.height = this.height + 'px'
  }

  setSource(canvas: HTMLCanvasElement) {
    this.sourceCanvas = canvas
  }

  private toggle() {
    this.active = !this.active
    this.canvas.style.opacity = this.active ? '0.6' : '0'

    if (this.active && !this.animating) {
      // Clear the trail canvas when activating
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
      this.startAnimation()
    }
  }

  private startAnimation() {
    if (this.animating) return
    this.animating = true

    const animate = () => {
      this.frameId = requestAnimationFrame(animate)

      if (!this.active) {
        this.animating = false
        cancelAnimationFrame(this.frameId)
        return
      }

      this.render()
    }
    animate()
  }

  private render() {
    if (!this.sourceCanvas) return

    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height

    // Fade previous frame — this creates the trail
    ctx.fillStyle = `rgba(2, 1, 8, ${1 - this.trailOpacity})`
    ctx.fillRect(0, 0, w, h)

    // Draw current WebGL frame on top
    ctx.globalAlpha = 0.3
    ctx.drawImage(this.sourceCanvas, 0, 0, w, h)
    ctx.globalAlpha = 1.0
  }

  isActive(): boolean {
    return this.active
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
    this.canvas.remove()
  }
}
