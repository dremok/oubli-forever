/**
 * THE GREAT RESET — Oubli forgets itself
 *
 * Inspired by the Great Meme Reset of 2026 — culture deciding to
 * collectively forget and start fresh. Every few minutes, Oubli
 * undergoes a cataclysmic event: particles scatter violently,
 * colors shift, the bloom overwhelms everything to white, then
 * slowly the system reconstitutes — but different. Changed.
 *
 * This is compaction made visible. This is forgetting as rebirth.
 * This is the system's core metaphor enacted.
 *
 * Each reset changes:
 * - Color palette shifts (hue rotation)
 * - Bloom intensity spikes then settles to a new baseline
 * - A burst of new whisper fragments
 * - Particle spawn patterns change
 * - The counter increments — the system knows how many times it has died
 */

interface ResetPhase {
  name: 'dormant' | 'warning' | 'cataclysm' | 'void' | 'rebirth'
  duration: number // ms
}

export class GreatReset {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private width = 0
  private height = 0
  private dpr = 1
  private frameId = 0
  private phase: ResetPhase['name'] = 'dormant'
  private phaseStartTime = 0
  private resetCount = 0
  private nextResetTime = 0
  private currentAlpha = 0
  private hueShift = 0
  private onReset: (() => void) | null = null
  private onCataclysm: (() => void) | null = null

  // Reset interval: 3-5 minutes, randomized
  private readonly minInterval = 180000
  private readonly maxInterval = 300000

  private readonly phases: Record<string, number> = {
    warning: 3000,    // subtle visual warning
    cataclysm: 2000,  // everything explodes
    void: 1500,       // pure white/black
    rebirth: 4000,    // slow reconstitution
  }

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 500; pointer-events: none; opacity: 0;
      transition: opacity 0.3s;
    `
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!
    this.resize()
    window.addEventListener('resize', () => this.resize())

    this.scheduleNextReset()
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

  onResetComplete(callback: () => void) {
    this.onReset = callback
  }

  onCataclysmStart(callback: () => void) {
    this.onCataclysm = callback
  }

  private scheduleNextReset() {
    const interval = this.minInterval + Math.random() * (this.maxInterval - this.minInterval)
    this.nextResetTime = performance.now() + interval
  }

  start() {
    this.animate()
  }

  private animate() {
    this.frameId = requestAnimationFrame(() => this.animate())
    const now = performance.now()

    if (this.phase === 'dormant') {
      // Check if it's time for a reset
      if (now >= this.nextResetTime) {
        this.beginReset()
      }
      return
    }

    const elapsed = now - this.phaseStartTime

    switch (this.phase) {
      case 'warning':
        this.renderWarning(elapsed / this.phases.warning)
        if (elapsed > this.phases.warning) {
          this.phase = 'cataclysm'
          this.phaseStartTime = now
          this.onCataclysm?.()
        }
        break

      case 'cataclysm':
        this.renderCataclysm(elapsed / this.phases.cataclysm)
        if (elapsed > this.phases.cataclysm) {
          this.phase = 'void'
          this.phaseStartTime = now
        }
        break

      case 'void':
        this.renderVoid(elapsed / this.phases.void)
        if (elapsed > this.phases.void) {
          this.phase = 'rebirth'
          this.phaseStartTime = now
          this.resetCount++
          this.hueShift = (this.hueShift + 60 + Math.random() * 60) % 360
        }
        break

      case 'rebirth':
        this.renderRebirth(elapsed / this.phases.rebirth)
        if (elapsed > this.phases.rebirth) {
          this.phase = 'dormant'
          this.canvas.style.opacity = '0'
          this.scheduleNextReset()
          this.onReset?.()
        }
        break
    }
  }

  private beginReset() {
    this.phase = 'warning'
    this.phaseStartTime = performance.now()
    this.canvas.style.opacity = '1'
  }

  private renderWarning(t: number) {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    // Subtle red pulse at edges — something is coming
    const intensity = Math.sin(t * Math.PI * 4) * 0.5 + 0.5
    const gradient = ctx.createRadialGradient(
      this.width / 2, this.height / 2, this.width * 0.2,
      this.width / 2, this.height / 2, this.width * 0.9
    )
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
    gradient.addColorStop(1, `rgba(255, 20, 60, ${intensity * 0.15 * t})`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, this.width, this.height)
  }

  private renderCataclysm(t: number) {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    // White flash that builds
    const flashIntensity = Math.pow(t, 2)
    ctx.fillStyle = `rgba(255, 255, 255, ${flashIntensity * 0.9})`
    ctx.fillRect(0, 0, this.width, this.height)

    // Horizontal scan lines — like a CRT dying
    if (t > 0.3) {
      const lineCount = Math.floor(t * 20)
      for (let i = 0; i < lineCount; i++) {
        const y = Math.random() * this.height
        const width = Math.random() * this.width * 0.8
        const x = Math.random() * this.width * 0.2
        ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.5})`
        ctx.fillRect(x, y, width, 1 + Math.random() * 3)
      }
    }
  }

  private renderVoid(t: number) {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    // Pure white fading to pure black — the moment of total forgetting
    const brightness = 1 - Math.pow(t, 0.5)
    const r = Math.floor(brightness * 255)
    ctx.fillStyle = `rgb(${r}, ${r}, ${r})`
    ctx.fillRect(0, 0, this.width, this.height)

    // Reset epoch text
    if (t > 0.5) {
      const textAlpha = (t - 0.5) * 2
      ctx.font = `300 ${Math.min(this.width * 0.015, 14)}px 'Cormorant Garamond', serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = `rgba(255, 20, 147, ${textAlpha * 0.6})`
      ctx.fillText(
        `reset ${this.resetCount + 1} — oubli forgets itself`,
        this.width / 2,
        this.height / 2
      )
    }
  }

  private renderRebirth(t: number) {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    // Black fading to transparent — the void recedes
    const alpha = 1 - Math.pow(t, 0.3)
    ctx.fillStyle = `rgba(2, 1, 8, ${alpha})`
    ctx.fillRect(0, 0, this.width, this.height)
  }

  getResetCount(): number {
    return this.resetCount
  }

  getHueShift(): number {
    return this.hueShift
  }

  isResetting(): boolean {
    return this.phase !== 'dormant'
  }

  /** Force a reset now (for testing or triggered events) */
  forceReset() {
    this.nextResetTime = 0
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
    this.canvas.remove()
  }
}
