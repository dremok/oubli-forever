/**
 * SPACETIME RIPPLE — the house warps when something significant happens
 *
 * Inspired by GW250114 (Feb 2026): the clearest gravitational wave ever
 * recorded. Two black holes collided and spacetime rang like a bell,
 * producing multiple harmonics in the ringdown.
 *
 * In Oubli, when a memory degrades past a threshold, or when you visit
 * a room that actively destroys memories (disintegration loops, furnace),
 * a ripple propagates across the screen — a brief, subtle distortion
 * that makes the whole house feel like a single connected medium.
 *
 * The ripple is rendered as concentric rings expanding from a point,
 * with slight canvas distortion via CSS transform on the body.
 * A low-frequency tone accompanies each ripple (the "ringdown").
 *
 * Also responds to: entering the observatory, midnight hour change,
 * and other significant house events.
 */

import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface Ripple {
  x: number
  y: number
  radius: number
  maxRadius: number
  alpha: number
  speed: number
  born: number
  color: string
  harmonics: number // how many ring echoes
}

export class SpacetimeRipple {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private ripples: Ripple[] = []
  private animating = false
  private frameId = 0
  private frame = 0
  private width = 0
  private height = 0
  private dpr = 1
  private bodyTransformActive = false

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 58; pointer-events: none;
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

  /**
   * Trigger a spacetime ripple at a point on screen.
   * intensity: 0-1, affects size, duration, and audio volume.
   * color: CSS color string for the rings.
   */
  trigger(x?: number, y?: number, intensity = 0.5, color = '180,160,255') {
    const cx = x ?? this.width / 2
    const cy = y ?? this.height / 2
    const maxR = Math.max(this.width, this.height) * (0.6 + intensity * 0.4)

    this.ripples.push({
      x: cx,
      y: cy,
      radius: 0,
      maxRadius: maxR,
      alpha: 0.04 + intensity * 0.06,
      speed: 2 + intensity * 3,
      born: this.frame,
      color,
      harmonics: Math.floor(1 + intensity * 3),
    })

    // Subtle body distortion — very brief CSS transform
    this.applyBodyWarp(intensity)

    // Audio ringdown
    this.playRingdown(intensity)

    this.startAnimation()
  }

  /** Convenience: trigger from a memory degradation event */
  triggerDegradation(degradation: number) {
    if (degradation < 0.3) return // only trigger for significantly degraded
    const intensity = Math.min(degradation, 1) * 0.6
    // Random position slightly off-center
    const x = this.width * (0.3 + Math.random() * 0.4)
    const y = this.height * (0.3 + Math.random() * 0.4)
    this.trigger(x, y, intensity, '140,100,180')
  }

  /** Trigger for room-specific events */
  triggerRoomEvent(room: string) {
    const events: Record<string, { color: string; intensity: number }> = {
      disintegration: { color: '140,100,60', intensity: 0.4 },
      furnace: { color: '255,120,40', intensity: 0.35 },
      midnight: { color: '100,120,200', intensity: 0.3 },
      glacarium: { color: '160,200,240', intensity: 0.25 },
    }
    const ev = events[room]
    if (ev) {
      this.trigger(undefined, undefined, ev.intensity, ev.color)
    }
  }

  private applyBodyWarp(intensity: number) {
    if (this.bodyTransformActive) return
    this.bodyTransformActive = true

    const scale = 1 + intensity * 0.003
    const skew = intensity * 0.15
    document.body.style.transition = 'transform 0.3s ease-out'
    document.body.style.transform = `scale(${scale}) skewX(${skew}deg)`

    setTimeout(() => {
      document.body.style.transition = 'transform 0.8s ease-in'
      document.body.style.transform = 'none'
      setTimeout(() => {
        document.body.style.transition = ''
        document.body.style.transform = ''
        this.bodyTransformActive = false
      }, 800)
    }, 300)
  }

  private async playRingdown(intensity: number) {
    try {
      const ctx = await getAudioContext()
      const dest = getAudioDestination()

      // Low fundamental (like a struck bell)
      const fund = ctx.createOscillator()
      fund.type = 'sine'
      fund.frequency.value = 35 + intensity * 20
      const fundGain = ctx.createGain()
      fundGain.gain.setValueAtTime(intensity * 0.04, ctx.currentTime)
      fundGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3 + intensity * 2)
      fund.connect(fundGain)
      fundGain.connect(dest)
      fund.start()
      fund.stop(ctx.currentTime + 5)

      // Second harmonic (bell overtone)
      const harm = ctx.createOscillator()
      harm.type = 'sine'
      harm.frequency.value = (35 + intensity * 20) * 2.76 // inharmonic, like a real bell
      const harmGain = ctx.createGain()
      harmGain.gain.setValueAtTime(intensity * 0.015, ctx.currentTime)
      harmGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2)
      harm.connect(harmGain)
      harmGain.connect(dest)
      harm.start()
      harm.stop(ctx.currentTime + 3)

      // Third harmonic — very faint
      if (intensity > 0.4) {
        const h3 = ctx.createOscillator()
        h3.type = 'sine'
        h3.frequency.value = (35 + intensity * 20) * 5.4
        const h3Gain = ctx.createGain()
        h3Gain.gain.setValueAtTime(intensity * 0.006, ctx.currentTime)
        h3Gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5)
        h3.connect(h3Gain)
        h3Gain.connect(dest)
        h3.start()
        h3.stop(ctx.currentTime + 2)
      }
    } catch {
      // Audio not available
    }
  }

  private startAnimation() {
    if (this.animating) return
    this.animating = true

    const animate = () => {
      this.frame++
      this.update()
      this.render()

      if (this.ripples.length > 0) {
        this.frameId = requestAnimationFrame(animate)
      } else {
        this.animating = false
        this.ctx.clearRect(0, 0, this.width, this.height)
      }
    }
    this.frameId = requestAnimationFrame(animate)
  }

  private update() {
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i]
      r.radius += r.speed

      // Fade as it expands
      const progress = r.radius / r.maxRadius
      r.alpha = r.alpha * (1 - progress * 0.015)

      if (r.radius > r.maxRadius || r.alpha < 0.002) {
        this.ripples.splice(i, 1)
      }
    }
  }

  private render() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    for (const r of this.ripples) {
      // Draw multiple harmonic rings (like GW ringdown modes)
      for (let h = 0; h < r.harmonics; h++) {
        const ringRadius = r.radius * (1 - h * 0.15)
        if (ringRadius <= 0) continue

        const alpha = r.alpha * (1 - h * 0.3)
        if (alpha < 0.002) continue

        ctx.beginPath()
        ctx.arc(r.x, r.y, ringRadius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${r.color}, ${alpha})`
        ctx.lineWidth = 1.5 - h * 0.3
        ctx.stroke()

        // Inner shimmer ring
        if (h === 0 && alpha > 0.01) {
          ctx.beginPath()
          ctx.arc(r.x, r.y, ringRadius * 0.98, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(${r.color}, ${alpha * 0.3})`
          ctx.lineWidth = 3
          ctx.stroke()
        }
      }
    }
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
    this.canvas.remove()
  }
}
