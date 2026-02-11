/**
 * THE AUTOPHAGY — the house deliberately dismantles itself to survive
 *
 * In biology, autophagy ("self-eating") is how cells recycle their own
 * components. In February 2026, Vanderbilt researchers discovered that
 * cells dismantle up to 70% of their endoplasmic reticulum — their
 * biggest internal factory — within days of reaching adulthood.
 * This is not decay. It is deliberate survival strategy.
 * Long-lived organisms do it sooner, not later.
 * Blocking it ERASES lifespan benefits.
 *
 * In Oubli, rooms that have been "alive" longest (most visited,
 * most active) undergo autophagy — they strip away visual density,
 * becoming sparser, emptier, more essential. This is the opposite
 * of decay: the healthiest rooms look the barest.
 *
 * Visual: golden-amber dissolving particles rising upward from the
 * room, like the house absorbing its own material. A subtle
 * transparency overlay that increases with autophagy level.
 * The room becomes luminous and spare, not dark and broken.
 *
 * Autophagy is NOT erosion (which is irreversible damage).
 * Autophagy is NOT methylation decay (which is loss of protection).
 * Autophagy is DELIBERATE, HEALTHY self-reduction.
 *
 * Inspired by:
 * - ER-phagy (Vanderbilt, Nature Cell Biology, Feb 2026):
 *   cells dismantle 70% of their factory to survive aging
 * - Interstellar Comet 3I/ATLAS (Feb 2026):
 *   most vivid at moment of departure — stripped objects reveal more
 * - Michael Joo "Sweat Models" (Space ZeroOne, Feb 2026):
 *   the body as leak, exertion made visible as fluid
 * - Wabi-sabi: beauty in reduction, elegance in what's removed
 */

const STORAGE_KEY = 'oubli_autophagy'
const TICK_INTERVAL = 4000  // 4s between autophagy ticks
const PARTICLE_MAX = 40     // max dissolving particles on screen

// How many visits before autophagy begins (early = healthy)
const ONSET_VISITS = 5
// How many visits for full autophagy (70% reduction, matching the cell biology)
const FULL_VISITS = 40
// Maximum autophagy level (0.7 = 70% reduction, matching the science)
const MAX_LEVEL = 0.7

interface AutophagyState {
  levels: Record<string, number>  // autophagy level per room (0-0.7)
  totalDigested: number           // cumulative material digested across all rooms
}

interface AutophagyDeps {
  getActiveRoom: () => string
  getRoomVisits: () => Map<string, number>
  getRipeness: (room: string) => number
  getSeason: () => string
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  hue: number       // golden-amber range
  life: number      // 0-1, counts down
  rotSpeed: number
  rot: number
}

export class Autophagy {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private state: AutophagyState
  private deps: AutophagyDeps | null = null
  private tickTimer: number | null = null
  private animFrame: number | null = null
  private particles: Particle[] = []
  private time = 0

  constructor() {
    this.state = this.load()

    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 55; pointer-events: none;
    `
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio, 2)
    this.canvas.width = window.innerWidth * dpr
    this.canvas.height = window.innerHeight * dpr
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  setDeps(deps: AutophagyDeps) {
    this.deps = deps
  }

  start() {
    this.tickTimer = window.setInterval(() => this.tick(), TICK_INTERVAL)
    const render = () => {
      this.render()
      this.animFrame = window.setTimeout(render, 100)
    }
    render()
  }

  /** Current autophagy level for a room (0 = none, 0.7 = full) */
  getLevel(room: string): number {
    return this.state.levels[room] || 0
  }

  /** Average autophagy across all rooms */
  getAvgLevel(): number {
    const vals = Object.values(this.state.levels)
    if (vals.length === 0) return 0
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }

  /** Total digested material (for narrator) */
  getTotalDigested(): number {
    return this.state.totalDigested
  }

  private tick() {
    if (!this.deps) return

    const room = this.deps.getActiveRoom()
    const visits = this.deps.getRoomVisits()
    const visitCount = visits.get(room) || 0
    const ripeness = this.deps.getRipeness(room)
    const season = this.deps.getSeason()

    // Autophagy begins after ONSET_VISITS
    if (visitCount < ONSET_VISITS) return

    // Calculate target level based on visit count
    const progress = Math.min(1, (visitCount - ONSET_VISITS) / (FULL_VISITS - ONSET_VISITS))
    const targetLevel = progress * MAX_LEVEL

    // Seasonal modulation: autophagy accelerates in growth/ripe seasons
    // (healthy organisms self-reduce during abundance, not scarcity)
    const seasonMod: Record<string, number> = {
      seed: 0.5, growth: 1.2, ripe: 1.5, fall: 0.8, decay: 0.3,
    }
    const mod = seasonMod[season] || 1

    // Ripeness accelerates autophagy (ripe rooms strip faster — like the biology)
    const ripenessMod = 1 + ripeness * 0.5

    // Approach target level gradually
    const currentLevel = this.state.levels[room] || 0
    if (currentLevel < targetLevel) {
      const delta = 0.002 * mod * ripenessMod
      this.state.levels[room] = Math.min(targetLevel, currentLevel + delta)
      this.state.totalDigested += delta
    }

    // Spawn dissolving particles when autophagy is active
    const level = this.state.levels[room] || 0
    if (level > 0.05 && this.particles.length < PARTICLE_MAX) {
      if (Math.random() < level * 0.4) {
        this.spawnParticle()
      }
    }

    // Save occasionally
    if (Math.random() < 0.05) this.save()
  }

  private spawnParticle() {
    const w = window.innerWidth
    const h = window.innerHeight

    this.particles.push({
      x: 0.1 * w + Math.random() * 0.8 * w,
      y: 0.3 * h + Math.random() * 0.6 * h,  // spawn from middle/lower areas
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(0.2 + Math.random() * 0.5),  // rise upward
      size: 1.5 + Math.random() * 3,
      alpha: 0.06 + Math.random() * 0.08,
      hue: 38 + Math.random() * 15,  // golden-amber (38-53)
      life: 1,
      rotSpeed: (Math.random() - 0.5) * 0.02,
      rot: Math.random() * Math.PI * 2,
    })
  }

  private render() {
    const w = window.innerWidth
    const h = window.innerHeight
    const ctx = this.ctx
    const dt = 0.016

    ctx.clearRect(0, 0, w, h)
    this.time += dt

    if (!this.deps) return

    const room = this.deps.getActiveRoom()
    const level = this.state.levels[room] || 0

    if (level < 0.01 && this.particles.length === 0) return

    // Render the transparency overlay — the room becoming spare
    if (level > 0.05) {
      // A very subtle warm golden veil, increasing with autophagy
      // This is luminous, not dark — the room glows as it strips
      const overlayAlpha = Math.min(0.04, level * 0.05)
      ctx.fillStyle = `rgba(255, 215, 100, ${overlayAlpha})`
      ctx.fillRect(0, 0, w, h)
    }

    // Render dissolving particles — material being absorbed
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]

      // Update
      p.x += p.vx
      p.vy -= 0.005  // gentle upward acceleration
      p.y += p.vy
      p.rot += p.rotSpeed
      p.life -= 0.004 + level * 0.002  // faster dissolution at higher autophagy
      p.alpha *= 0.997  // gradual fade
      p.size *= 0.999   // slight shrink

      // Remove dead particles
      if (p.life <= 0 || p.y < -20 || p.alpha < 0.005) {
        this.particles.splice(i, 1)
        continue
      }

      // Draw — small luminous fragments rising upward
      const drawAlpha = p.alpha * p.life
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.globalAlpha = drawAlpha

      // Diamond/crystal shape — the house's material dissolving
      const s = p.size
      ctx.fillStyle = `hsl(${p.hue}, 60%, 70%)`
      ctx.beginPath()
      ctx.moveTo(0, -s)
      ctx.lineTo(s * 0.6, 0)
      ctx.lineTo(0, s * 0.5)
      ctx.lineTo(-s * 0.6, 0)
      ctx.closePath()
      ctx.fill()

      // Subtle glow
      ctx.shadowColor = `hsla(${p.hue}, 70%, 80%, ${drawAlpha * 0.5})`
      ctx.shadowBlur = s * 2
      ctx.fill()
      ctx.shadowBlur = 0

      ctx.globalAlpha = 1
      ctx.restore()
    }

    // Autophagy level indicator — extremely subtle
    if (level > 0.05) {
      ctx.font = '9px monospace'
      ctx.fillStyle = `rgba(200, 170, 80, ${Math.min(0.06, level * 0.08)})`
      ctx.textAlign = 'left'
      ctx.fillText(`autophagy ${(level * 100).toFixed(0)}%`, 8, 12)
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch { /* quota */ }
  }

  private load(): AutophagyState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as AutophagyState
    } catch { /* corrupted */ }
    return {
      levels: {},
      totalDigested: 0,
    }
  }
}
