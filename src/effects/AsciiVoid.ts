/**
 * ASCII VOID — the cosmos rendered in characters
 *
 * The entire WebGL scene is re-rendered as ASCII art in real-time.
 * Brightness maps to character density: dark → ' ', medium → '·:;',
 * bright → '#@&'. But here's the twist: the characters are drawn
 * from stored memories in the journal.
 *
 * Your words become the pixels of the void. The letters you typed
 * are repurposed as the texture of space itself. Memory as medium.
 *
 * Toggle with 'a' key. The transition between modes is itself
 * meaningful — the cosmic dissolves into text, text dissolves back
 * into light.
 *
 * Inspired by: Efecto (Codrops, Jan 2026), demoscene ASCII art,
 * the Matrix digital rain, Borges's Library of Babel
 */

// ASCII ramp from dark to bright
const ASCII_RAMP = ' .·:;+*#@█'

export class AsciiVoid {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private sourceCanvas: HTMLCanvasElement | null = null
  private width = 0
  private height = 0
  private active = false
  private transitionProgress = 0 // 0 = particles, 1 = ASCII
  private targetProgress = 0
  private frameId = 0
  private cellSize = 10
  private cols = 0
  private rows = 0
  private memoryChars = '' // characters from stored memories
  private charIndex = 0

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 150; pointer-events: none; opacity: 0;
      transition: opacity 1.5s ease;
      background: rgba(2, 1, 8, 0.95);
    `
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!
    this.resize()

    window.addEventListener('resize', () => this.resize())
    window.addEventListener('keydown', (e) => {
      if (e.key === 'a' || e.key === 'A') {
        this.toggle()
      }
    })
  }

  private resize() {
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = this.width
    this.canvas.height = this.height
    this.cols = Math.floor(this.width / this.cellSize)
    this.rows = Math.floor(this.height / this.cellSize)
  }

  /** Set the WebGL canvas to sample from */
  setSource(canvas: HTMLCanvasElement) {
    this.sourceCanvas = canvas
  }

  /** Update the memory text used for characters */
  updateMemoryText(text: string) {
    this.memoryChars = text.replace(/\s+/g, ' ').trim()
    if (this.memoryChars.length === 0) {
      this.memoryChars = 'oubli remembers by forgetting what was lost becomes light'
    }
  }

  toggle() {
    this.active = !this.active
    this.targetProgress = this.active ? 1 : 0
    this.canvas.style.opacity = this.active ? '1' : '0'

    if (this.active && this.frameId === 0) {
      this.animate()
    }
  }

  private animate() {
    this.frameId = requestAnimationFrame(() => this.animate())

    // Smooth transition
    this.transitionProgress += (this.targetProgress - this.transitionProgress) * 0.05

    if (!this.active && this.transitionProgress < 0.01) {
      cancelAnimationFrame(this.frameId)
      this.frameId = 0
      return
    }

    this.render()
  }

  private render() {
    if (!this.sourceCanvas) return

    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)
    ctx.fillStyle = 'rgba(2, 1, 8, 0.95)'
    ctx.fillRect(0, 0, this.width, this.height)

    // Sample the WebGL canvas
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = this.cols
    tempCanvas.height = this.rows
    const tempCtx = tempCanvas.getContext('2d')!
    tempCtx.drawImage(this.sourceCanvas, 0, 0, this.cols, this.rows)
    const imageData = tempCtx.getImageData(0, 0, this.cols, this.rows)
    const data = imageData.data

    const fontSize = this.cellSize * 0.9
    ctx.font = `${fontSize}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const idx = (y * this.cols + x) * 4
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]

        // Luminance
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255

        if (brightness < 0.02) continue // skip very dark areas

        // Map brightness to ASCII character
        const charIdx = Math.floor(brightness * (ASCII_RAMP.length - 1))
        let char: string

        // Use memory characters for bright areas, ASCII ramp for dim
        if (brightness > 0.15 && this.memoryChars.length > 0) {
          char = this.memoryChars[this.charIndex % this.memoryChars.length]
          this.charIndex++
        } else {
          char = ASCII_RAMP[charIdx]
        }

        // Color from source with boosted saturation
        const maxC = Math.max(r, g, b, 1)
        const cr = Math.min(255, (r / maxC) * 255 * 1.5)
        const cg = Math.min(255, (g / maxC) * 255 * 1.5)
        const cb = Math.min(255, (b / maxC) * 255 * 1.5)

        ctx.fillStyle = `rgba(${cr | 0}, ${cg | 0}, ${cb | 0}, ${brightness * 0.9})`
        ctx.fillText(
          char,
          x * this.cellSize + this.cellSize / 2,
          y * this.cellSize + this.cellSize / 2
        )
      }
    }
  }

  isActive(): boolean {
    return this.active
  }

  destroy() {
    if (this.frameId) cancelAnimationFrame(this.frameId)
    this.canvas.remove()
  }
}
