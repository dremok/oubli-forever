/**
 * THE FORGETTING MACHINE
 *
 * Type a memory. Watch it dissolve.
 *
 * Each letter becomes a particle that drifts away from its position,
 * joining the threshold's particle field. Your words literally become
 * the ambient particles of the system. What you give to Oubli,
 * Oubli transforms into light.
 *
 * Inspired by: Palimpsests, Alzheimer's progression, the way dreams
 * dissolve upon waking, Chris Marker's "Sans Soleil"
 */

interface LetterParticle {
  char: string
  x: number
  y: number
  originX: number
  originY: number
  vx: number
  vy: number
  alpha: number
  size: number
  hue: number
  phase: 'forming' | 'visible' | 'dissolving' | 'gone'
  dissolveDelay: number
  dissolveSpeed: number
  rotation: number
  rotationSpeed: number
}

export class ForgettingMachine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private visible = false
  private inputText = ''
  private cursorVisible = true
  private cursorInterval: number | null = null
  private letters: LetterParticle[] = []
  private animating = false
  private frameId = 0
  private width = 0
  private height = 0
  private dpr = 1
  private onDissolveComplete: (() => void) | null = null
  private placeholder = 'type a memory...'
  private showPlaceholder = true

  constructor(
    private parentCanvas: HTMLCanvasElement,
    private onParticleRelease?: (x: number, y: number, hue: number) => void,
    private onTextDissolve?: (text: string) => void,
  ) {
    // Create overlay canvas for text rendering
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 200; pointer-events: none;
    `
    document.body.appendChild(this.canvas)

    this.ctx = this.canvas.getContext('2d')!
    this.resize()
    this.bindEvents()
    this.startCursorBlink()
  }

  private resize() {
    this.dpr = Math.min(window.devicePixelRatio, 2)
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = this.width * this.dpr
    this.canvas.height = this.height * this.dpr
    this.canvas.style.width = this.width + 'px'
    this.canvas.style.height = this.height + 'px'
    this.ctx.scale(this.dpr, this.dpr)
  }

  private bindEvents() {
    window.addEventListener('resize', () => this.resize())

    window.addEventListener('keydown', (e) => {
      // Don't capture if another input is focused
      if (document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA') return

      if (e.key === 'Enter' && this.inputText.length > 0) {
        this.dissolve()
        return
      }

      if (e.key === 'Backspace') {
        this.inputText = this.inputText.slice(0, -1)
        this.showPlaceholder = this.inputText.length === 0
        return
      }

      if (e.key === 'Escape') {
        this.inputText = ''
        this.showPlaceholder = true
        return
      }

      // Don't capture number keys 1-5 when no text is being typed (reserved for drift navigation)
      if ('12345'.includes(e.key) && this.inputText.length === 0) return

      // Only accept printable characters
      if (e.key.length === 1 && this.inputText.length < 120) {
        this.inputText += e.key
        this.showPlaceholder = false
        if (!this.animating) {
          this.startRenderLoop()
        }
      }
    })
  }

  private startCursorBlink() {
    this.cursorInterval = window.setInterval(() => {
      this.cursorVisible = !this.cursorVisible
    }, 530)
  }

  private startRenderLoop() {
    if (this.animating) return
    this.animating = true

    const animate = () => {
      this.frameId = requestAnimationFrame(animate)
      this.render()
    }
    animate()
  }

  private render() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    // If we have dissolving letters, animate them
    if (this.letters.length > 0) {
      this.renderDissolving(ctx)
      return
    }

    // Otherwise render the input text
    this.renderInput(ctx)
  }

  private renderInput(ctx: CanvasRenderingContext2D) {
    const text = this.showPlaceholder ? this.placeholder : this.inputText
    const isPlaceholder = this.showPlaceholder

    const fontSize = Math.min(this.width * 0.05, 42)
    ctx.font = `300 ${fontSize}px 'Cormorant Garamond', serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const centerX = this.width / 2
    const centerY = this.height / 2

    if (isPlaceholder) {
      ctx.fillStyle = 'rgba(255, 215, 0, 0.2)'
      ctx.fillText(text, centerX, centerY)
    } else {
      // Render each character with slight color variation
      const metrics = ctx.measureText(text)
      let x = centerX - metrics.width / 2

      for (let i = 0; i < text.length; i++) {
        const charWidth = ctx.measureText(text[i]).width
        const hue = 330 + (i / text.length) * 60 // pink to gold gradient
        ctx.fillStyle = `hsla(${hue}, 80%, 70%, 0.9)`
        ctx.fillText(text[i], x + charWidth / 2, centerY)
        x += charWidth
      }

      // Cursor
      if (this.cursorVisible) {
        const fullWidth = ctx.measureText(text).width
        const cursorX = centerX + fullWidth / 2 + 4
        ctx.fillStyle = 'rgba(255, 20, 147, 0.7)'
        ctx.fillRect(cursorX, centerY - fontSize * 0.4, 2, fontSize * 0.8)
      }
    }
  }

  private dissolve() {
    const ctx = this.ctx
    const text = this.inputText
    if (!text) return

    // Save the memory before dissolving it
    this.onTextDissolve?.(text)

    const fontSize = Math.min(this.width * 0.05, 42)
    ctx.font = `300 ${fontSize}px 'Cormorant Garamond', serif`

    const centerX = this.width / 2
    const centerY = this.height / 2
    const metrics = ctx.measureText(text)
    let x = centerX - metrics.width / 2

    this.letters = []

    // Create a letter particle for each character
    for (let i = 0; i < text.length; i++) {
      const charWidth = ctx.measureText(text[i]).width
      const charX = x + charWidth / 2

      const hue = 330 + (i / text.length) * 60

      this.letters.push({
        char: text[i],
        x: charX,
        y: centerY,
        originX: charX,
        originY: centerY,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2 - 0.5, // slight upward drift
        alpha: 1,
        size: fontSize,
        hue,
        phase: 'visible',
        dissolveDelay: i * 80 + Math.random() * 200, // staggered dissolution
        dissolveSpeed: 0.005 + Math.random() * 0.01,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.02,
      })

      x += charWidth
    }

    this.inputText = ''
    this.showPlaceholder = true

    // Start dissolving after a brief pause — let the user see their words one last time
    setTimeout(() => {
      for (const letter of this.letters) {
        letter.phase = 'dissolving'
      }
    }, 800)
  }

  private renderDissolving(ctx: CanvasRenderingContext2D) {
    let allGone = true

    for (const l of this.letters) {
      if (l.phase === 'gone') continue

      if (l.phase === 'dissolving') {
        l.dissolveDelay -= 16

        if (l.dissolveDelay <= 0) {
          // The letter drifts and fades
          l.vx += (Math.random() - 0.5) * 0.3
          l.vy += (Math.random() - 0.5) * 0.3 - 0.02 // gentle rise
          l.x += l.vx
          l.y += l.vy
          l.alpha -= l.dissolveSpeed
          l.rotation += l.rotationSpeed
          l.size *= 0.998 // slowly shrink

          // Release a particle back to the threshold
          if (l.alpha < 0.5 && Math.random() < 0.1 && this.onParticleRelease) {
            this.onParticleRelease(l.x, l.y, l.hue)
          }

          if (l.alpha <= 0) {
            l.phase = 'gone'
            // Final particle burst
            if (this.onParticleRelease) {
              for (let i = 0; i < 3; i++) {
                this.onParticleRelease(
                  l.x + (Math.random() - 0.5) * 20,
                  l.y + (Math.random() - 0.5) * 20,
                  l.hue
                )
              }
            }
          }
        }
      }

      if (l.phase !== 'gone') {
        allGone = false

        ctx.save()
        ctx.translate(l.x, l.y)
        ctx.rotate(l.rotation)
        ctx.font = `300 ${l.size}px 'Cormorant Garamond', serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        // Glow effect as it dissolves
        if (l.alpha < 0.7) {
          ctx.shadowColor = `hsla(${l.hue}, 80%, 60%, ${l.alpha * 0.5})`
          ctx.shadowBlur = 20
        }

        ctx.fillStyle = `hsla(${l.hue}, 80%, 70%, ${Math.max(l.alpha, 0)})`
        ctx.fillText(l.char, 0, 0)
        ctx.restore()
      }
    }

    if (allGone) {
      this.letters = []
      this.onDissolveComplete?.()
    }
  }

  /** Whether the user is actively typing a memory */
  hasActiveInput(): boolean {
    return this.inputText.length > 0
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
    if (this.cursorInterval) clearInterval(this.cursorInterval)
    this.canvas.remove()
  }
}
