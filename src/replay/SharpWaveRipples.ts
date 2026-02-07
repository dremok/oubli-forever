/**
 * SHARP WAVE RIPPLES — the void replays your memories
 *
 * Named after the hippocampal sharp-wave ripples that compress
 * and replay memories during rest. Every few minutes, if the user
 * is idle, particles briefly organize into the text of a stored
 * memory — then scatter back to chaos.
 *
 * The formation is imperfect. Some characters land in wrong positions.
 * Degraded memories have more corruption — characters swap, gaps appear,
 * the formation breaks apart faster. The brain tries to replay but
 * the structure is lost.
 *
 * 2026 neuroscience: In Alzheimer's models, hippocampal replay still
 * occurs but has lost its normal structure. Forgetting isn't silence —
 * it's corrupted replay.
 *
 * Inspired by: Hippocampal sharp-wave ripples, sleep replay,
 * the Alzheimer's replay research (2026), murmuration patterns
 */

import type { StoredMemory } from '../memory/MemoryJournal'

interface ReplayDot {
  // Current position
  x: number
  y: number
  // Target position (character location)
  tx: number
  ty: number
  // Start position (random scatter)
  sx: number
  sy: number
  // Visual
  hue: number
  size: number
  alpha: number
  // Which character this dot belongs to
  charIndex: number
  // Corruption: offset from true target
  corruptX: number
  corruptY: number
}

type ReplayPhase = 'idle' | 'gathering' | 'formed' | 'scattering' | 'fading'

export class SharpWaveRipples {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private width = 0
  private height = 0
  private dpr = 1

  private memories: StoredMemory[] = []
  private dots: ReplayDot[] = []
  private phase: ReplayPhase = 'idle'
  private phaseTime = 0
  private frame = 0
  private frameId = 0
  private animating = false
  private hidden = false

  // Timing
  private lastInteraction = 0
  private nextReplayFrame = 0
  private idleThreshold = 150 * 60 // ~150 seconds idle

  // Current replay
  private replayText = ''
  private replayHue = 0
  private replayDegradation = 0
  private textAlpha = 0

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 185; pointer-events: none;
    `
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!
    this.resize()

    window.addEventListener('resize', () => this.resize())

    // Track user interaction
    const onInteract = () => { this.lastInteraction = this.frame }
    window.addEventListener('keydown', onInteract)
    window.addEventListener('mousemove', onInteract)
    window.addEventListener('click', onInteract)
    window.addEventListener('touchstart', onInteract)
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

  loadMemories(memories: StoredMemory[]) {
    this.memories = memories
  }

  addMemory(memory: StoredMemory) {
    this.memories.push(memory)
  }

  start() {
    this.nextReplayFrame = this.idleThreshold + Math.random() * 60 * 60
    this.startAnimation()
  }

  setVisible(v: boolean) {
    this.hidden = !v
    if (this.hidden) {
      this.ctx.clearRect(0, 0, this.width, this.height)
    }
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

    // Trigger replay after idle threshold
    if (this.phase === 'idle' && idleTime > this.nextReplayFrame && this.memories.length > 0) {
      this.beginReplay()
    }

    this.phaseTime++

    switch (this.phase) {
      case 'gathering':
        // Dots converge toward text positions
        this.textAlpha = Math.min(this.textAlpha + 0.015, 0.8)
        if (this.phaseTime > 90) { // ~1.5 seconds
          this.phase = 'formed'
          this.phaseTime = 0
        }
        break

      case 'formed':
        // Text holds — readable
        if (this.phaseTime > 150) { // ~2.5 seconds
          this.phase = 'scattering'
          this.phaseTime = 0
        }
        break

      case 'scattering':
        // Dots drift away from positions
        this.textAlpha = Math.max(this.textAlpha - 0.01, 0)
        if (this.phaseTime > 120) { // ~2 seconds
          this.phase = 'fading'
          this.phaseTime = 0
        }
        break

      case 'fading':
        this.textAlpha = Math.max(this.textAlpha - 0.02, 0)
        if (this.textAlpha <= 0) {
          this.phase = 'idle'
          this.dots = []
          this.replayText = ''
          // Next replay in 3-6 minutes of idle
          this.nextReplayFrame = this.frame - this.lastInteraction +
            (180 + Math.random() * 180) * 60
        }
        break
    }
  }

  private beginReplay() {
    // Pick a random memory
    const memory = this.memories[Math.floor(Math.random() * this.memories.length)]
    this.replayText = memory.currentText
    this.replayHue = memory.hue
    this.replayDegradation = memory.degradation

    // Compute character positions
    const ctx = this.ctx
    const fontSize = Math.min(this.width * 0.035, 32)
    ctx.font = `300 ${fontSize}px 'Cormorant Garamond', serif`

    const centerX = this.width / 2
    const centerY = this.height * 0.45

    // Word wrap
    const maxWidth = this.width * 0.5
    const words = this.replayText.split(' ')
    const lines: string[] = []
    let currentLine = ''
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }
    if (currentLine) lines.push(currentLine)

    const lineHeight = fontSize * 1.5
    const totalHeight = lines.length * lineHeight
    const startY = centerY - totalHeight / 2

    // Create dots for each character
    this.dots = []
    const hueDeg = this.replayHue * 360
    let charIdx = 0

    for (let l = 0; l < lines.length; l++) {
      const line = lines[l]
      const lineWidth = ctx.measureText(line).width
      let x = centerX - lineWidth / 2
      const y = startY + l * lineHeight

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        const charWidth = ctx.measureText(char).width
        const cx = x + charWidth / 2

        // 3-5 dots per character
        const dotsPerChar = 3 + Math.floor(Math.random() * 3)
        for (let d = 0; d < dotsPerChar; d++) {
          // Corruption: degraded memories have dots that miss their targets
          const corruption = this.replayDegradation
          const corruptX = corruption > 0.1
            ? (Math.random() - 0.5) * corruption * 80
            : 0
          const corruptY = corruption > 0.1
            ? (Math.random() - 0.5) * corruption * 40
            : 0

          // Some dots are completely lost for very degraded memories
          if (Math.random() < corruption * 0.3) continue

          this.dots.push({
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            tx: cx + (Math.random() - 0.5) * charWidth * 0.8,
            ty: y + (Math.random() - 0.5) * fontSize * 0.6,
            sx: Math.random() * this.width,
            sy: Math.random() * this.height,
            hue: hueDeg + (Math.random() - 0.5) * 30,
            size: 1.5 + Math.random() * 2,
            alpha: 0.5 + Math.random() * 0.5,
            charIndex: charIdx,
            corruptX,
            corruptY,
          })
        }

        x += charWidth
        charIdx++
      }
    }

    this.phase = 'gathering'
    this.phaseTime = 0
    this.textAlpha = 0
  }

  private render() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    if (this.hidden || this.phase === 'idle' || this.dots.length === 0) return

    // Compute interpolation factor
    let t = 0 // 0 = scattered, 1 = formed
    switch (this.phase) {
      case 'gathering':
        t = this.easeOutCubic(Math.min(this.phaseTime / 90, 1))
        break
      case 'formed':
        t = 1
        break
      case 'scattering': {
        const scatter = this.easeInCubic(Math.min(this.phaseTime / 120, 1))
        t = 1 - scatter
        break
      }
      case 'fading':
        t = 0
        break
    }

    for (const dot of this.dots) {
      // Interpolate position
      const targetX = dot.tx + dot.corruptX
      const targetY = dot.ty + dot.corruptY
      dot.x = dot.sx + (targetX - dot.sx) * t
      dot.y = dot.sy + (targetY - dot.sy) * t

      // Gentle drift when formed
      if (this.phase === 'formed') {
        dot.x += Math.sin(this.frame * 0.02 + dot.charIndex * 0.5) * 0.5
        dot.y += Math.cos(this.frame * 0.015 + dot.charIndex * 0.7) * 0.3
      }

      // Scatter phase: dots drift outward
      if (this.phase === 'scattering') {
        const scatterT = this.phaseTime / 120
        dot.x += (Math.random() - 0.5) * scatterT * 3
        dot.y += (Math.random() - 0.5) * scatterT * 3 - scatterT * 0.5
      }

      // Draw dot
      const alpha = dot.alpha * this.textAlpha
      if (alpha < 0.01) continue

      const gradient = ctx.createRadialGradient(
        dot.x, dot.y, 0,
        dot.x, dot.y, dot.size * 2
      )
      gradient.addColorStop(0, `hsla(${dot.hue}, 60%, 80%, ${alpha})`)
      gradient.addColorStop(0.5, `hsla(${dot.hue}, 50%, 60%, ${alpha * 0.4})`)
      gradient.addColorStop(1, `hsla(${dot.hue}, 40%, 50%, 0)`)

      ctx.beginPath()
      ctx.arc(dot.x, dot.y, dot.size * 2, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()
    }

    // Faint text label during formed phase
    if (this.phase === 'formed' && this.textAlpha > 0.3) {
      const labelAlpha = (this.textAlpha - 0.3) * 0.15
      ctx.font = `300 9px 'Cormorant Garamond', serif`
      ctx.textAlign = 'center'
      ctx.fillStyle = `rgba(255, 255, 255, ${labelAlpha})`
      ctx.fillText('sharp wave ripple', this.width / 2, this.height * 0.45 + 60)
    }
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3)
  }

  private easeInCubic(t: number): number {
    return t * t * t
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
    this.canvas.remove()
  }
}
