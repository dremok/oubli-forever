/**
 * THE THRESHOLD — Oubli's first experience
 *
 * Particles emerge from void. They carry traces of light — hot pink, gold,
 * diamond-white. They drift, coalesce into fleeting shapes that almost mean
 * something, then dissolve. Like memories forming and fading.
 *
 * The user's presence (mouse/touch) attracts particles, creating temporary
 * constellations. When the user is still, particles drift and forget their
 * formations. When the user moves, particles remember — briefly.
 */

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  hue: number
  saturation: number
  lightness: number
  alpha: number
  trail: { x: number; y: number; alpha: number }[]
  memoryStrength: number // how strongly this particle "remembers" its path
  birthTime: number
}

export class ThresholdEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private particles: Particle[] = []
  private mouseX = -1000
  private mouseY = -1000
  private mouseActive = false
  private time = 0
  private width = 0
  private height = 0
  private dpr = 1
  private frameId = 0
  private birthRate = 0 // ramps up over time
  private maxParticles = 2000
  private epoch = 0 // increases with each "forgetting cycle"

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: false })!
    this.resize()
    this.bindEvents()
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

    const updateMouse = (x: number, y: number) => {
      this.mouseX = x
      this.mouseY = y
      this.mouseActive = true
    }

    window.addEventListener('mousemove', (e) => updateMouse(e.clientX, e.clientY))
    window.addEventListener('touchmove', (e) => {
      e.preventDefault()
      const t = e.touches[0]
      updateMouse(t.clientX, t.clientY)
    }, { passive: false })
    window.addEventListener('touchstart', (e) => {
      const t = e.touches[0]
      updateMouse(t.clientX, t.clientY)
    })
    window.addEventListener('mouseleave', () => { this.mouseActive = false })
    window.addEventListener('touchend', () => { this.mouseActive = false })
  }

  private spawnParticle(): Particle {
    // Particles emerge from edges, from center, from random points
    // The spawn pattern evolves over time
    const spawnMode = Math.random()
    let x: number, y: number

    if (spawnMode < 0.3) {
      // From edges — like memories creeping in from periphery
      const edge = Math.floor(Math.random() * 4)
      switch (edge) {
        case 0: x = Math.random() * this.width; y = -10; break
        case 1: x = this.width + 10; y = Math.random() * this.height; break
        case 2: x = Math.random() * this.width; y = this.height + 10; break
        default: x = -10; y = Math.random() * this.height; break
      }
    } else if (spawnMode < 0.5) {
      // From center — like memories surfacing
      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * 50
      x = this.width / 2 + Math.cos(angle) * radius
      y = this.height / 2 + Math.sin(angle) * radius
    } else {
      // Random — scattered like fragments
      x = Math.random() * this.width
      y = Math.random() * this.height
    }

    // Color palette: hot pink → gold → diamond white → deep violet
    const colorMode = Math.random()
    let hue: number, saturation: number, lightness: number
    if (colorMode < 0.35) {
      // Hot pink
      hue = 330 + Math.random() * 20
      saturation = 80 + Math.random() * 20
      lightness = 50 + Math.random() * 20
    } else if (colorMode < 0.6) {
      // Gold
      hue = 40 + Math.random() * 15
      saturation = 80 + Math.random() * 20
      lightness = 55 + Math.random() * 15
    } else if (colorMode < 0.8) {
      // Diamond white
      hue = Math.random() * 360
      saturation = 10 + Math.random() * 20
      lightness = 85 + Math.random() * 15
    } else {
      // Deep violet
      hue = 270 + Math.random() * 30
      saturation = 60 + Math.random() * 30
      lightness = 30 + Math.random() * 30
    }

    const maxLife = 200 + Math.random() * 600

    return {
      x, y,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      life: maxLife,
      maxLife,
      size: 1 + Math.random() * 3,
      hue, saturation, lightness,
      alpha: 0,
      trail: [],
      memoryStrength: 0.3 + Math.random() * 0.7,
      birthTime: this.time,
    }
  }

  private updateParticle(p: Particle, dt: number) {
    // Particles drift with a slow organic current
    const noiseX = Math.sin(p.x * 0.003 + this.time * 0.0005) * 0.15
    const noiseY = Math.cos(p.y * 0.003 + this.time * 0.0007) * 0.15

    // Slow spiral tendency — like thoughts circling
    const cx = this.width / 2
    const cy = this.height / 2
    const dx = p.x - cx
    const dy = p.y - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const spiralForce = 0.00003
    const spiralX = -dy * spiralForce
    const spiralY = dx * spiralForce

    // Mouse interaction — particles are drawn to presence
    if (this.mouseActive) {
      const mdx = this.mouseX - p.x
      const mdy = this.mouseY - p.y
      const mDist = Math.sqrt(mdx * mdx + mdy * mdy)
      const attractRadius = 250
      if (mDist < attractRadius) {
        const force = (1 - mDist / attractRadius) * 0.02 * p.memoryStrength
        p.vx += (mdx / mDist) * force
        p.vy += (mdy / mDist) * force
        // Being near presence strengthens memory
        p.life = Math.min(p.life + 0.5, p.maxLife)
      }
    }

    p.vx += noiseX * 0.1 + spiralX
    p.vy += noiseY * 0.1 + spiralY

    // Gentle drag — memories slow down
    p.vx *= 0.995
    p.vy *= 0.995

    p.x += p.vx * dt
    p.y += p.vy * dt

    // Life fades — all memories dissolve
    p.life -= dt * 0.3

    // Alpha follows life curve: fade in, sustain, fade out
    const lifeRatio = p.life / p.maxLife
    if (lifeRatio > 0.9) {
      p.alpha = (1 - lifeRatio) * 10 // fade in
    } else if (lifeRatio > 0.2) {
      p.alpha = 1
    } else {
      p.alpha = lifeRatio * 5 // fade out
    }

    // Trail — the particle's memory of where it's been
    if (this.time % 3 === 0) {
      p.trail.push({ x: p.x, y: p.y, alpha: p.alpha * 0.4 })
      if (p.trail.length > 12 * p.memoryStrength) {
        p.trail.shift() // forgetting the oldest positions
      }
    }

    // Fade trail
    for (const t of p.trail) {
      t.alpha *= 0.97
    }
  }

  private render() {
    const ctx = this.ctx

    // The void — not pure black but a deep, breathing darkness
    const voidPulse = Math.sin(this.time * 0.001) * 0.5 + 0.5
    const bgAlpha = 0.08 + voidPulse * 0.02
    ctx.fillStyle = `rgba(2, 1, 8, ${bgAlpha})`
    ctx.fillRect(0, 0, this.width, this.height)

    // Draw particles
    for (const p of this.particles) {
      if (p.alpha <= 0.01) continue

      // Trail first (memory traces)
      if (p.trail.length > 1) {
        ctx.beginPath()
        ctx.moveTo(p.trail[0].x, p.trail[0].y)
        for (let i = 1; i < p.trail.length; i++) {
          ctx.lineTo(p.trail[i].x, p.trail[i].y)
        }
        ctx.strokeStyle = `hsla(${p.hue}, ${p.saturation}%, ${p.lightness}%, ${p.alpha * 0.1})`
        ctx.lineWidth = p.size * 0.5
        ctx.stroke()
      }

      // The particle itself — a point of light
      const glowSize = p.size * (2 + Math.sin(this.time * 0.01 + p.birthTime) * 0.5)

      // Outer glow
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize * 4)
      gradient.addColorStop(0, `hsla(${p.hue}, ${p.saturation}%, ${p.lightness}%, ${p.alpha * 0.6})`)
      gradient.addColorStop(0.4, `hsla(${p.hue}, ${p.saturation}%, ${p.lightness}%, ${p.alpha * 0.15})`)
      gradient.addColorStop(1, `hsla(${p.hue}, ${p.saturation}%, ${p.lightness}%, 0)`)

      ctx.beginPath()
      ctx.arc(p.x, p.y, glowSize * 4, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()

      // Core — bright point
      ctx.beginPath()
      ctx.arc(p.x, p.y, glowSize * 0.5, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${p.hue}, ${p.saturation * 0.5}%, ${Math.min(p.lightness + 30, 100)}%, ${p.alpha * 0.9})`
      ctx.fill()
    }

    // Draw connections between nearby particles — neural pathways
    this.drawConnections(ctx)
  }

  private drawConnections(ctx: CanvasRenderingContext2D) {
    const connectionDist = 120
    const maxConnections = 3

    for (let i = 0; i < this.particles.length; i++) {
      const a = this.particles[i]
      if (a.alpha < 0.2) continue
      let connections = 0

      for (let j = i + 1; j < this.particles.length && connections < maxConnections; j++) {
        const b = this.particles[j]
        if (b.alpha < 0.2) continue

        const dx = a.x - b.x
        const dy = a.y - b.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < connectionDist) {
          const strength = (1 - dist / connectionDist) * Math.min(a.alpha, b.alpha) * 0.15

          // Connection color blends between the two particles
          const hue = (a.hue + b.hue) / 2
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.strokeStyle = `hsla(${hue}, 60%, 60%, ${strength})`
          ctx.lineWidth = 0.5
          ctx.stroke()
          connections++
        }
      }
    }
  }

  start() {
    const animate = () => {
      this.time++
      this.frameId = requestAnimationFrame(animate)

      // Birth rate ramps up — the system slowly comes alive
      if (this.birthRate < 3) {
        this.birthRate += 0.002
      }

      // Spawn new particles
      const toSpawn = Math.floor(this.birthRate)
      const fractional = this.birthRate - toSpawn
      for (let i = 0; i < toSpawn; i++) {
        if (this.particles.length < this.maxParticles) {
          this.particles.push(this.spawnParticle())
        }
      }
      if (Math.random() < fractional && this.particles.length < this.maxParticles) {
        this.particles.push(this.spawnParticle())
      }

      // Update all particles
      for (const p of this.particles) {
        this.updateParticle(p, 1)
      }

      // Remove dead particles — they are forgotten
      this.particles = this.particles.filter(p => p.life > 0)

      // Periodic "forgetting waves" — a pulse that dims everything
      if (this.time % 1200 === 0) {
        this.epoch++
        for (const p of this.particles) {
          p.life *= 0.7 // a wave of forgetting
          p.trail.length = 0 // trails erased
        }
      }

      this.render()
    }

    animate()
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
  }
}
