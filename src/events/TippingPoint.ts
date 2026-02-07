/**
 * THE TIPPING POINT — entropy cascades
 *
 * 2026 neuroscience finding: once brain shrinkage passes a threshold,
 * memory decline accelerates dramatically. There's a tipping point
 * where gradual decline becomes collapse.
 *
 * This system monitors the total entropy of all stored memories.
 * When average degradation crosses thresholds, the visual environment
 * shifts — subtly at first, then dramatically:
 *
 * Phase 1 (Normal): degradation < 30% average — default state
 * Phase 2 (Accelerating): 30-60% — grain increases, bloom strengthens,
 *   particles speed up, subtle screen-edge static
 * Phase 3 (Cascade): > 60% — full visual breakdown. Edges corrupt,
 *   particles scatter, drone becomes dissonant, chromatic aberration
 *   intensifies. The system is forgetting itself.
 *
 * The cascade is reversible: add new memories to dilute the entropy.
 * This creates a meaningful tension — you must keep feeding the void
 * to prevent it from consuming itself.
 *
 * Inspired by: Phase transitions in physics, Alzheimer's tipping point
 * (2026), the heat death of the universe, system crashes
 */

import type { StoredMemory } from '../memory/MemoryJournal'

type TippingPhase = 'normal' | 'accelerating' | 'cascade'

interface TippingState {
  phase: TippingPhase
  entropy: number // 0-1 average degradation
  grainMultiplier: number
  bloomMultiplier: number
  speedMultiplier: number
  chromaticIntensity: number
  droneDissonance: number
  edgeCorruption: number
}

type StateChangeCallback = (state: TippingState) => void

export class TippingPoint {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private width = 0
  private height = 0
  private dpr = 1

  private getMemories: (() => StoredMemory[]) | null = null
  private onStateChange: StateChangeCallback | null = null
  private currentPhase: TippingPhase = 'normal'
  private currentState: TippingState = this.defaultState()
  private targetState: TippingState = this.defaultState()
  private frameId = 0
  private animating = false
  private frame = 0
  private hidden = false

  // Edge corruption visuals
  private glitchBars: { y: number; width: number; speed: number; alpha: number }[] = []

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 195; pointer-events: none;
    `
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!
    this.resize()
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

  private defaultState(): TippingState {
    return {
      phase: 'normal',
      entropy: 0,
      grainMultiplier: 1.0,
      bloomMultiplier: 1.0,
      speedMultiplier: 1.0,
      chromaticIntensity: 1.0,
      droneDissonance: 0,
      edgeCorruption: 0,
    }
  }

  setMemorySource(fn: () => StoredMemory[]) {
    this.getMemories = fn
  }

  onChange(fn: StateChangeCallback) {
    this.onStateChange = fn
  }

  start() {
    // Check entropy every 10 seconds
    setInterval(() => this.evaluate(), 10000)
    this.startAnimation()
  }

  setVisible(v: boolean) {
    this.hidden = !v
    if (this.hidden) {
      this.ctx.clearRect(0, 0, this.width, this.height)
    }
  }

  private evaluate() {
    if (!this.getMemories) return

    const memories = this.getMemories()
    if (memories.length === 0) return

    // Calculate average degradation
    const totalDeg = memories.reduce((sum, m) => sum + m.degradation, 0)
    const avgDeg = totalDeg / memories.length

    // Determine phase
    let newPhase: TippingPhase = 'normal'
    if (avgDeg > 0.6) newPhase = 'cascade'
    else if (avgDeg > 0.3) newPhase = 'accelerating'

    // Calculate target state based on phase
    switch (newPhase) {
      case 'normal':
        this.targetState = {
          ...this.defaultState(),
          entropy: avgDeg,
        }
        break

      case 'accelerating': {
        const t = (avgDeg - 0.3) / 0.3 // 0 at 30%, 1 at 60%
        this.targetState = {
          phase: 'accelerating',
          entropy: avgDeg,
          grainMultiplier: 1.0 + t * 1.5,
          bloomMultiplier: 1.0 + t * 0.8,
          speedMultiplier: 1.0 + t * 0.4,
          chromaticIntensity: 1.0 + t * 2.0,
          droneDissonance: t * 0.3,
          edgeCorruption: t * 0.3,
        }
        break
      }

      case 'cascade': {
        const t = Math.min((avgDeg - 0.6) / 0.3, 1) // 0 at 60%, 1 at 90%
        this.targetState = {
          phase: 'cascade',
          entropy: avgDeg,
          grainMultiplier: 2.5 + t * 3.0,
          bloomMultiplier: 1.8 + t * 1.5,
          speedMultiplier: 1.4 + t * 1.0,
          chromaticIntensity: 3.0 + t * 5.0,
          droneDissonance: 0.3 + t * 0.7,
          edgeCorruption: 0.3 + t * 0.7,
        }
        break
      }
    }

    // Notify on phase change
    if (newPhase !== this.currentPhase) {
      this.currentPhase = newPhase
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
    // Smooth interpolation toward target state
    const lerp = 0.02
    const s = this.currentState
    const t = this.targetState

    s.entropy += (t.entropy - s.entropy) * lerp
    s.grainMultiplier += (t.grainMultiplier - s.grainMultiplier) * lerp
    s.bloomMultiplier += (t.bloomMultiplier - s.bloomMultiplier) * lerp
    s.speedMultiplier += (t.speedMultiplier - s.speedMultiplier) * lerp
    s.chromaticIntensity += (t.chromaticIntensity - s.chromaticIntensity) * lerp
    s.droneDissonance += (t.droneDissonance - s.droneDissonance) * lerp
    s.edgeCorruption += (t.edgeCorruption - s.edgeCorruption) * lerp
    s.phase = t.phase

    // Emit state changes
    this.onStateChange?.(s)

    // Manage glitch bars for edge corruption
    if (s.edgeCorruption > 0.05) {
      // Spawn new glitch bars
      if (Math.random() < s.edgeCorruption * 0.15) {
        this.glitchBars.push({
          y: Math.random() * this.height,
          width: 5 + Math.random() * 30 * s.edgeCorruption,
          speed: (Math.random() - 0.5) * 3,
          alpha: 0.1 + Math.random() * s.edgeCorruption * 0.4,
        })
      }

      // Update existing bars
      for (let i = this.glitchBars.length - 1; i >= 0; i--) {
        const bar = this.glitchBars[i]
        bar.y += bar.speed
        bar.alpha -= 0.005
        if (bar.alpha <= 0 || bar.y < -10 || bar.y > this.height + 10) {
          this.glitchBars.splice(i, 1)
        }
      }
    } else {
      this.glitchBars = []
    }
  }

  private render() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    if (this.hidden) return
    if (this.currentState.edgeCorruption < 0.05) return

    const corruption = this.currentState.edgeCorruption

    // Edge static — horizontal bars of noise at screen edges
    for (const bar of this.glitchBars) {
      const side = Math.random() < 0.5 ? 0 : this.width - bar.width
      ctx.fillStyle = `rgba(255, 20, 147, ${bar.alpha})`
      ctx.fillRect(side, bar.y, bar.width, 1 + Math.random() * 2)
    }

    // Edge vignette that pulses with corruption
    if (corruption > 0.2) {
      const pulse = Math.sin(this.frame * 0.03) * 0.3 + 0.7
      const gradient = ctx.createRadialGradient(
        this.width / 2, this.height / 2, this.width * 0.3,
        this.width / 2, this.height / 2, this.width * 0.7
      )
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
      gradient.addColorStop(1, `rgba(20, 0, 30, ${corruption * pulse * 0.3})`)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, this.width, this.height)
    }

    // Scanline effect in cascade
    if (corruption > 0.5) {
      const scanAlpha = (corruption - 0.5) * 0.1
      for (let y = 0; y < this.height; y += 4) {
        if (Math.random() < 0.3) {
          ctx.fillStyle = `rgba(255, 20, 147, ${scanAlpha * Math.random()})`
          ctx.fillRect(0, y, this.width, 1)
        }
      }
    }
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
    this.canvas.remove()
  }
}
