/**
 * VACUUM FLUCTUATIONS — something from nothing
 *
 * The void is not empty. It seethes with virtual particles that
 * flicker in and out of existence. Occasionally, a pair of "quantum
 * twins" materializes from a random point, glows briefly, flies apart
 * in opposite directions, and dissolves back into nothing.
 *
 * The effect is rare and very subtle — a brief flicker of paired
 * light that you might miss if you're not paying attention. Like
 * real vacuum fluctuations, they exist for only a moment.
 *
 * Particle pairs are complementary: one warm (gold), one cool (blue).
 * They emerge together, connected by a faint thread that stretches
 * and snaps as they separate.
 *
 * Inspired by: Brookhaven National Lab's Feb 2026 discovery of
 * "quantum twins" — spin-aligned lambda particles emerging from
 * the quantum vacuum with 100% correlation. "Something from nothing."
 * The void remembers what it briefly held.
 */

interface FluctuationParticle {
  x: number
  y: number
  vx: number
  vy: number
  hue: number
  alpha: number
  size: number
  age: number
}

interface FluctuationEvent {
  originX: number
  originY: number
  particles: [FluctuationParticle, FluctuationParticle]
  threadAlpha: number
  age: number
  maxAge: number
}

export class VacuumFluctuations {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private width = 0
  private height = 0
  private events: FluctuationEvent[] = []
  private nextSpawnTime = 0
  private animating = false
  private frameId = 0
  private roomCheck: (() => string) | null = null
  private time = 0

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 51; pointer-events: none;
    `
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!
    this.resize()

    window.addEventListener('resize', () => this.resize())
  }

  private resize() {
    const dpr = window.devicePixelRatio || 1
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = this.width * dpr
    this.canvas.height = this.height * dpr
    this.canvas.style.width = this.width + 'px'
    this.canvas.style.height = this.height + 'px'
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  setRoomCheck(check: () => string) {
    this.roomCheck = check
  }

  start() {
    this.nextSpawnTime = 20 + Math.random() * 30 // first event after 20-50 seconds
    if (!this.animating) {
      this.animating = true
      const loop = () => {
        this.frameId = requestAnimationFrame(loop)
        this.update()
        this.render()
      }
      loop()
    }
  }

  private spawnEvent() {
    // Random origin point — biased toward center
    const cx = this.width * (0.15 + Math.random() * 0.7)
    const cy = this.height * (0.15 + Math.random() * 0.7)

    // Random direction — particles fly in opposite directions
    const angle = Math.random() * Math.PI * 2
    const speed = 15 + Math.random() * 25 // px/sec

    const maxAge = 3 + Math.random() * 2 // 3-5 seconds lifetime

    const event: FluctuationEvent = {
      originX: cx,
      originY: cy,
      particles: [
        {
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          hue: 42, // warm gold
          alpha: 0,
          size: 2 + Math.random() * 2,
          age: 0,
        },
        {
          x: cx, y: cy,
          vx: Math.cos(angle + Math.PI) * speed, // opposite direction
          vy: Math.sin(angle + Math.PI) * speed,
          hue: 210, // cool blue
          alpha: 0,
          size: 2 + Math.random() * 2,
          age: 0,
        },
      ],
      threadAlpha: 0,
      age: 0,
      maxAge,
    }

    this.events.push(event)
  }

  private update() {
    const dt = 0.016
    this.time += dt

    // Only spawn in the void
    const inVoid = !this.roomCheck || this.roomCheck() === 'void'

    // Spawn timer
    this.nextSpawnTime -= dt
    if (this.nextSpawnTime <= 0 && inVoid) {
      this.spawnEvent()
      this.nextSpawnTime = 35 + Math.random() * 40 // 35-75 seconds between events
    }

    // Update events
    for (let i = this.events.length - 1; i >= 0; i--) {
      const ev = this.events[i]
      ev.age += dt

      // Phase envelope: fade in (0-0.5s), sustain (0.5-2s), fade out (2s-maxAge)
      const fadeInEnd = 0.5
      const fadeOutStart = ev.maxAge - 1.5

      for (const p of ev.particles) {
        p.age += dt
        p.x += p.vx * dt
        p.y += p.vy * dt

        // Alpha envelope
        if (ev.age < fadeInEnd) {
          p.alpha = (ev.age / fadeInEnd) * 0.25
        } else if (ev.age > fadeOutStart) {
          p.alpha = Math.max(0, (1 - (ev.age - fadeOutStart) / 1.5) * 0.25)
        } else {
          p.alpha = 0.25
        }
      }

      // Thread alpha — visible during sustain, fades and snaps
      if (ev.age < fadeInEnd) {
        ev.threadAlpha = (ev.age / fadeInEnd) * 0.08
      } else if (ev.age > fadeOutStart * 0.6) {
        ev.threadAlpha = Math.max(0, (1 - (ev.age - fadeOutStart * 0.6) / 1.0) * 0.08)
      } else {
        ev.threadAlpha = 0.08
      }

      // Remove expired events
      if (ev.age >= ev.maxAge) {
        this.events.splice(i, 1)
      }
    }
  }

  private render() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    for (const ev of this.events) {
      const [p1, p2] = ev.particles

      // Draw connecting thread — a faint line between the twins
      if (ev.threadAlpha > 0.001) {
        const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y)
        grad.addColorStop(0, `hsla(42, 70%, 65%, ${ev.threadAlpha})`)
        grad.addColorStop(0.5, `hsla(280, 40%, 50%, ${ev.threadAlpha * 0.5})`)
        grad.addColorStop(1, `hsla(210, 70%, 65%, ${ev.threadAlpha})`)

        ctx.strokeStyle = grad
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      }

      // Draw particles with glow
      for (const p of ev.particles) {
        if (p.alpha < 0.001) continue

        // Outer glow
        const glowGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 6)
        glowGrad.addColorStop(0, `hsla(${p.hue}, 60%, 70%, ${p.alpha * 0.4})`)
        glowGrad.addColorStop(0.5, `hsla(${p.hue}, 50%, 60%, ${p.alpha * 0.1})`)
        glowGrad.addColorStop(1, `hsla(${p.hue}, 40%, 50%, 0)`)
        ctx.fillStyle = glowGrad
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 6, 0, Math.PI * 2)
        ctx.fill()

        // Core
        ctx.fillStyle = `hsla(${p.hue}, 70%, 80%, ${p.alpha})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }

      // Origin flash — brief bright point at the moment of creation
      if (ev.age < 0.3) {
        const flashAlpha = (1 - ev.age / 0.3) * 0.15
        const flashGrad = ctx.createRadialGradient(ev.originX, ev.originY, 0, ev.originX, ev.originY, 12)
        flashGrad.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`)
        flashGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
        ctx.fillStyle = flashGrad
        ctx.beginPath()
        ctx.arc(ev.originX, ev.originY, 12, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  destroy() {
    this.animating = false
    cancelAnimationFrame(this.frameId)
    this.canvas.remove()
  }
}
