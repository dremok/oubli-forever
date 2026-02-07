/**
 * GHOST TYPING — the void remembers back at you
 *
 * Every few minutes, if the user is idle, the system begins typing
 * a fragment of a stored memory — letter by letter, as if the void
 * is trying to recall something the user once said. The text appears
 * in the same location as the forgetting machine input, but in a
 * different color (spectral blue-white) and with a trembling, uncertain
 * quality — like someone speaking in a dream.
 *
 * The typing is imperfect. Letters sometimes appear wrong and get
 * corrected. The speed is irregular — fast in the middle of words,
 * slow at beginnings and ends, as if the system is reaching for
 * the next word. Sometimes it stops mid-word and the half-typed
 * fragment fades away — the memory was lost before it could be spoken.
 *
 * Any user interaction immediately stops the ghost typing and fades
 * the text away. The void was talking to itself. You overheard it.
 *
 * Inspired by: Automatic writing, sleep talking, the way dementia
 * patients sometimes recall entire poems they thought they'd forgotten,
 * EVP (electronic voice phenomena)
 */

import type { StoredMemory } from '../memory/MemoryJournal'

export class GhostTyping {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private width = 0
  private height = 0
  private dpr = 1

  private memories: StoredMemory[] = []
  private active = false
  private currentText = ''   // the target text to type
  private typedText = ''     // what's been "typed" so far
  private charIndex = 0
  private alpha = 0
  private targetAlpha = 0
  private frameId = 0
  private animating = false
  private frame = 0
  private nextCharFrame = 0
  private lastInteraction = 0
  private idleThreshold = 90 * 60 // ~90 seconds idle before ghost types
  private nextGhostTime = 0
  private aborted = false     // memory lost mid-typing
  private hidden = false

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 190; pointer-events: none;
    `
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!
    this.resize()

    window.addEventListener('resize', () => this.resize())

    // Any interaction cancels ghost typing
    const cancelGhost = () => {
      this.lastInteraction = this.frame
      if (this.active) {
        this.targetAlpha = 0
        this.active = false
      }
    }
    window.addEventListener('keydown', cancelGhost)
    window.addEventListener('mousemove', cancelGhost)
    window.addEventListener('click', cancelGhost)
    window.addEventListener('touchstart', cancelGhost)
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

  /** Load memories that the ghost can type back */
  loadMemories(memories: StoredMemory[]) {
    this.memories = memories
  }

  start() {
    this.lastInteraction = 0
    this.nextGhostTime = this.idleThreshold + Math.random() * 60 * 60
    this.startAnimation()
  }

  private startAnimation() {
    if (this.animating) return
    this.animating = true

    const animate = () => {
      this.frameId = requestAnimationFrame(animate)
      this.frame++
      this.update()
      this.render()
    }
    animate()
  }

  private update() {
    const idleTime = this.frame - this.lastInteraction

    // Start ghost typing after idle threshold
    if (!this.active && idleTime > this.nextGhostTime && this.memories.length > 0) {
      this.beginGhostType()
    }

    // Smooth alpha
    this.alpha += (this.targetAlpha - this.alpha) * 0.05

    // Type next character
    if (this.active && !this.aborted && this.frame >= this.nextCharFrame) {
      if (this.charIndex < this.currentText.length) {
        const char = this.currentText[this.charIndex]
        this.typedText += char
        this.charIndex++

        // Variable typing speed — slow at word boundaries
        let delay: number
        if (char === ' ' || this.charIndex === 1) {
          delay = 8 + Math.random() * 15 // slow at spaces and start
        } else {
          delay = 3 + Math.random() * 5  // faster mid-word
        }

        // Random chance of aborting mid-typing (memory lost)
        if (this.charIndex > 3 && Math.random() < 0.008) {
          this.aborted = true
          // Fade out after a pause
          setTimeout(() => {
            this.targetAlpha = 0
            this.active = false
          }, 2000)
        }

        this.nextCharFrame = this.frame + delay
      } else {
        // Finished typing — hold for a moment, then fade
        if (this.frame >= this.nextCharFrame + 180) {
          this.targetAlpha = 0
          this.active = false
        }
      }
    }

    // Reset for next ghost cycle when faded out
    if (!this.active && this.alpha < 0.01 && this.typedText.length > 0) {
      this.typedText = ''
      this.currentText = ''
      this.charIndex = 0
      this.aborted = false
      // Next ghost in 2-5 minutes of idle
      this.nextGhostTime = this.frame - this.lastInteraction + (120 + Math.random() * 180) * 60
    }
  }

  private beginGhostType() {
    // Pick a random memory
    const memory = this.memories[Math.floor(Math.random() * this.memories.length)]
    this.currentText = memory.currentText
    this.typedText = ''
    this.charIndex = 0
    this.active = true
    this.aborted = false
    this.targetAlpha = 0.7
    this.nextCharFrame = this.frame + 30 // brief pause before typing starts
  }

  setVisible(v: boolean) {
    this.hidden = !v
    if (this.hidden) {
      this.ctx.clearRect(0, 0, this.width, this.height)
    }
  }

  private render() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    if (this.hidden) return
    if (this.alpha < 0.01 || this.typedText.length === 0) return

    const fontSize = Math.min(this.width * 0.04, 36)
    ctx.font = `300 ${fontSize}px 'Cormorant Garamond', serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const centerX = this.width / 2
    const centerY = this.height / 2

    // Render each character with individual tremor
    const metrics = ctx.measureText(this.typedText)
    let x = centerX - metrics.width / 2

    for (let i = 0; i < this.typedText.length; i++) {
      const char = this.typedText[i]
      const charWidth = ctx.measureText(char).width

      // Per-character tremor
      const tremor = Math.sin(this.frame * 0.1 + i * 1.7) * 0.8
      const yTremor = Math.cos(this.frame * 0.08 + i * 2.3) * 0.5

      // Color: spectral blue-white
      const hue = 200 + Math.sin(i * 0.3 + this.frame * 0.01) * 20
      const a = this.alpha * (0.6 + Math.sin(this.frame * 0.05 + i) * 0.15)

      ctx.fillStyle = `hsla(${hue}, 40%, 75%, ${a})`
      ctx.fillText(char, x + charWidth / 2 + tremor, centerY + yTremor)
      x += charWidth
    }

    // Blinking cursor at the end (if still typing)
    if (this.active && !this.aborted && this.charIndex < this.currentText.length) {
      const blink = Math.sin(this.frame * 0.08) > 0
      if (blink) {
        ctx.fillStyle = `rgba(150, 180, 220, ${this.alpha * 0.4})`
        ctx.fillRect(x + 3, centerY - fontSize * 0.35, 1.5, fontSize * 0.7)
      }
    }

    // If aborted, show a faint "..." trailing off
    if (this.aborted) {
      const dotAlpha = this.alpha * 0.3 * (Math.sin(this.frame * 0.03) * 0.5 + 0.5)
      ctx.fillStyle = `rgba(150, 180, 220, ${dotAlpha})`
      ctx.fillText('...', x + 12, centerY)
    }
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
    this.canvas.remove()
  }
}
