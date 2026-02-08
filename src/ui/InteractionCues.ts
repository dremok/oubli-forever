/**
 * INTERACTION CUES — the void whispers what it wants
 *
 * Rather than explicit UI instructions, Oubli gives subtle hints
 * about available interactions through visual cues that feel like
 * part of the void's dreaming:
 *
 * - A faint blinking cursor appears after idle (suggesting typing)
 * - Key glyphs drift at the edges like ghost letters
 * - A breathing circle suggests voice input
 * - Tiny poetic labels explain what each key unlocks
 *
 * These cues fade in gently and disappear when the user interacts.
 * They're more like memories of instructions than instructions
 * themselves — ghosts of a tutorial that was never written.
 *
 * Inspired by: Game design "juice" and affordances, the way
 * ancient maps whispered "here be dragons" at their edges
 */

interface Cue {
  type: 'cursor' | 'keys' | 'voice' | 'click' | 'drift'
  x: number
  y: number
  alpha: number
  targetAlpha: number
  char?: string
  label?: string
  born: number
}

export class InteractionCues {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private cues: Cue[] = []
  private width = 0
  private height = 0
  private dpr = 1
  private frame = 0
  private frameId = 0
  private animating = false
  private lastInteraction = 0
  private hasTyped = false
  private hasSpoken = false
  private hasUsedKeys = false
  private hasClicked = false
  private voiceSupported = false

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 95; pointer-events: none;
    `
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!
    this.resize()

    window.addEventListener('resize', () => this.resize())

    // Track interactions to know what to hint
    window.addEventListener('keydown', (e) => {
      this.lastInteraction = this.frame
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) this.hasTyped = true
      if (e.key === 'a' || e.key === 'm' || e.key === 'h' || e.key === 't') this.hasUsedKeys = true
      if (e.code === 'Space') this.hasSpoken = true
      // Clear all cues on interaction
      for (const cue of this.cues) cue.targetAlpha = 0
    })

    window.addEventListener('mousemove', () => {
      this.lastInteraction = this.frame
      for (const cue of this.cues) cue.targetAlpha = 0
    })

    window.addEventListener('click', () => {
      this.lastInteraction = this.frame
      this.hasClicked = true
    })
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

  setVoiceSupported(supported: boolean) {
    this.voiceSupported = supported
  }

  start() {
    this.lastInteraction = 0
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

    // Typing hint — faint blinking cursor after 12s idle
    if (idleTime > 12 * 60 && !this.hasTyped && !this.cues.find(c => c.type === 'cursor')) {
      this.cues.push({
        type: 'cursor',
        x: this.width / 2,
        y: this.height / 2,
        alpha: 0,
        targetAlpha: 0.2,
        born: this.frame,
      })
    }

    // Key hints — after 30s, show keys with dreamy labels
    if (idleTime > 30 * 60 && !this.hasUsedKeys && !this.cues.find(c => c.type === 'keys')) {
      const keys = [
        { char: 'a', label: 'see as text', x: this.width - 40, y: this.height / 2 - 60 },
        { char: 'm', label: 'memories', x: this.width - 40, y: this.height / 2 - 20 },
        { char: 'h', label: 'your heat', x: this.width - 40, y: this.height / 2 + 20 },
        { char: 't', label: 'trails', x: this.width - 40, y: this.height / 2 + 60 },
      ]
      for (const k of keys) {
        this.cues.push({
          type: 'keys',
          x: k.x,
          y: k.y,
          alpha: 0,
          targetAlpha: 0.15,
          char: k.char,
          label: k.label,
          born: this.frame,
        })
      }
    }

    // Voice hint — after 10s, pulsing circle
    if (idleTime > 10 * 60 && !this.hasSpoken && this.voiceSupported &&
        !this.cues.find(c => c.type === 'voice')) {
      this.cues.push({
        type: 'voice',
        x: this.width / 2,
        y: this.height * 0.35,
        alpha: 0,
        targetAlpha: 0.35,
        born: this.frame,
      })
    }

    // Drift hints — after 50s, show number keys for drifts
    if (idleTime > 50 * 60 && !this.cues.find(c => c.type === 'drift')) {
      const drifts = [
        { char: '1', label: 'void', x: 30, y: this.height - 80 },
        { char: '2', label: 'deep', x: 60, y: this.height - 80 },
        { char: '3', label: 'burn', x: 90, y: this.height - 80 },
        { char: '4', label: 'garden', x: 120, y: this.height - 80 },
        { char: '5', label: 'archive', x: 150, y: this.height - 80 },
      ]
      for (const d of drifts) {
        this.cues.push({
          type: 'drift',
          x: d.x,
          y: d.y,
          alpha: 0,
          targetAlpha: 0.1,
          char: d.char,
          label: d.label,
          born: this.frame,
        })
      }
    }

    // Click hint — after 40s, subtle note about clicking
    if (idleTime > 40 * 60 && !this.hasClicked && !this.cues.find(c => c.type === 'click')) {
      this.cues.push({
        type: 'click',
        x: this.width / 2,
        y: this.height * 0.65,
        alpha: 0,
        targetAlpha: 0.12,
        born: this.frame,
      })
    }

    // Update cue alphas
    for (let i = this.cues.length - 1; i >= 0; i--) {
      const cue = this.cues[i]
      cue.alpha += (cue.targetAlpha - cue.alpha) * 0.03

      // Remove fully faded cues
      if (cue.targetAlpha === 0 && cue.alpha < 0.005) {
        this.cues.splice(i, 1)
      }
    }
  }

  private render() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    for (const cue of this.cues) {
      if (cue.alpha < 0.005) continue

      switch (cue.type) {
        case 'cursor':
          this.renderCursorHint(ctx, cue)
          break
        case 'keys':
          this.renderKeyHint(ctx, cue)
          break
        case 'voice':
          this.renderVoiceHint(ctx, cue)
          break
        case 'click':
          this.renderClickHint(ctx, cue)
          break
        case 'drift':
          this.renderKeyHint(ctx, cue)
          break
      }
    }
  }

  private renderCursorHint(ctx: CanvasRenderingContext2D, cue: Cue) {
    const blink = Math.sin(this.frame * 0.06) > 0

    if (blink) {
      ctx.fillStyle = `rgba(255, 215, 0, ${cue.alpha})`
      ctx.fillRect(cue.x - 1, cue.y - 14, 2, 28)
    }

    // Tiny label below
    const labelAlpha = cue.alpha * 0.5
    ctx.font = `300 10px 'Cormorant Garamond', serif`
    ctx.textAlign = 'center'
    ctx.fillStyle = `rgba(255, 215, 0, ${labelAlpha})`
    ctx.fillText('type a memory', cue.x, cue.y + 24)
  }

  private renderKeyHint(ctx: CanvasRenderingContext2D, cue: Cue) {
    if (!cue.char) return

    const shimmer = Math.sin(this.frame * 0.02 + cue.y * 0.1) * 0.5 + 0.5

    // Key letter
    ctx.font = '300 13px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = `rgba(255, 20, 147, ${cue.alpha * shimmer})`
    ctx.fillText(cue.char, cue.x, cue.y)

    // Bracket
    ctx.strokeStyle = `rgba(255, 20, 147, ${cue.alpha * shimmer * 0.3})`
    ctx.lineWidth = 0.5
    ctx.strokeRect(cue.x - 9, cue.y - 9, 18, 18)

    // Dreamy label to the left
    if (cue.label) {
      ctx.font = `300 9px 'Cormorant Garamond', serif`
      ctx.textAlign = 'right'
      ctx.fillStyle = `rgba(255, 215, 0, ${cue.alpha * shimmer * 0.5})`
      ctx.fillText(cue.label, cue.x - 16, cue.y + 1)
    }
  }

  private renderVoiceHint(ctx: CanvasRenderingContext2D, cue: Cue) {
    const pulse = Math.sin(this.frame * 0.04) * 0.5 + 0.5
    const radius = 8 + pulse * 4

    ctx.beginPath()
    ctx.arc(cue.x, cue.y, radius, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255, 20, 147, ${cue.alpha * (0.5 + pulse * 0.5)})`
    ctx.lineWidth = 1
    ctx.stroke()

    // Outer ring
    ctx.beginPath()
    ctx.arc(cue.x, cue.y, radius + 6, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255, 20, 147, ${cue.alpha * pulse * 0.15})`
    ctx.lineWidth = 0.5
    ctx.stroke()

    // Label
    ctx.font = `300 11px 'Cormorant Garamond', serif`
    ctx.textAlign = 'center'
    ctx.fillStyle = `rgba(255, 215, 0, ${cue.alpha * 0.8})`
    ctx.fillText('hold spacebar to speak', cue.x, cue.y + radius + 18)
  }

  private renderClickHint(ctx: CanvasRenderingContext2D, cue: Cue) {
    const breathe = Math.sin(this.frame * 0.03) * 0.5 + 0.5

    // A small ripple circle suggesting "click"
    const radius = 4 + breathe * 3
    ctx.beginPath()
    ctx.arc(cue.x, cue.y, radius, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255, 20, 147, ${cue.alpha * (0.4 + breathe * 0.4)})`
    ctx.lineWidth = 0.5
    ctx.stroke()

    ctx.font = `300 10px 'Cormorant Garamond', serif`
    ctx.textAlign = 'center'
    ctx.fillStyle = `rgba(255, 215, 0, ${cue.alpha * 0.4})`
    ctx.fillText('click the void', cue.x, cue.y + radius + 14)
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
    this.canvas.remove()
  }
}
