/**
 * THE EROSION — irreversible aging of the house
 *
 * Every other system in Oubli is cyclical: seasons reset, methylation
 * restores, nutrients regenerate, immune systems heal. The Erosion is
 * different. It is the one thing that NEVER goes back.
 *
 * Erosion accumulates from:
 * - Memory degradation (each tick of degradation adds micro-erosion)
 * - Composted memories (permanent loss events)
 * - Immune fever (the defense itself damages)
 * - Parasite damage (persistent colonization)
 * - Time itself (a slow, constant drip)
 *
 * As erosion accumulates, subtle permanent visual marks appear:
 * - Hairline cracks at screen edges (like old plaster)
 * - Watermarks (circular stains that never dry)
 * - Age spots (small dark patches)
 * - Dust motes that accumulate in corners
 *
 * The erosion is VISIBLE but SUBTLE. It takes hours of play to notice.
 * It takes days to become unmistakable. It can never be reversed.
 * The house ages, permanently.
 *
 * Inspired by:
 * - UN Global Water Bankruptcy (Jan 2026): 50% of lakes shrunk since 1990s.
 *   Some resources never come back. "Bankruptcy management, not crisis management."
 * - Wabi-sabi: beauty found in impermanence and imperfection
 * - Patina on bronze, foxing on paper, craquelure on oil paintings
 * - Second Law of Thermodynamics: entropy only increases
 * - Hayao Miyazaki: "Everything in the world is on the way to decay"
 */

const STORAGE_KEY = 'oubli_erosion'
const TICK_INTERVAL = 5000  // 5s between erosion ticks
const TIME_EROSION = 0.00001  // constant time drip per tick
const DEGRADATION_EROSION = 0.00003  // per degraded memory per tick
const COMPOST_EROSION = 0.002  // per composted memory event
const FEVER_EROSION = 0.0001  // per fever tick
const PARASITE_EROSION = 0.00005  // per active parasite per tick
const MAX_EROSION = 1.0  // theoretical maximum (takes very long)

// Visual mark types
interface Crack {
  x1: number; y1: number; x2: number; y2: number
  depth: number  // 0-1, how visible
  age: number    // when it appeared (erosion level)
}

interface WaterMark {
  x: number; y: number
  radius: number
  opacity: number
  age: number
}

interface AgeSpot {
  x: number; y: number
  size: number
  opacity: number
  age: number
}

interface ErosionState {
  level: number        // 0-1, cumulative erosion
  totalTicks: number
  cracks: Crack[]
  waterMarks: WaterMark[]
  ageSpots: AgeSpot[]
  lastCompost: number
}

interface ErosionDeps {
  getAvgDegradation: () => number
  getParasiteCount: () => number
  getFeverLevel: () => number
  getCompostCount: () => number  // total composted memories
}

export class Erosion {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private state: ErosionState
  private deps: ErosionDeps | null = null
  private tickTimer: number | null = null
  private animFrame: number | null = null
  private time = 0
  private prevCompostCount = 0

  constructor() {
    this.state = this.load()

    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 54; pointer-events: none;
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

  setDeps(deps: ErosionDeps) {
    this.deps = deps
    this.prevCompostCount = deps.getCompostCount()
  }

  start() {
    this.tickTimer = window.setInterval(() => this.tick(), TICK_INTERVAL)

    const render = () => {
      this.animFrame = requestAnimationFrame(render)
      this.render()
    }
    render()
  }

  getLevel(): number {
    return this.state.level
  }

  private tick() {
    if (!this.deps) return

    let delta = TIME_EROSION

    // Degradation contribution
    const avgDeg = this.deps.getAvgDegradation()
    delta += avgDeg * DEGRADATION_EROSION

    // Parasite contribution
    const parasites = this.deps.getParasiteCount()
    delta += parasites * PARASITE_EROSION

    // Fever contribution
    const fever = this.deps.getFeverLevel()
    delta += fever * FEVER_EROSION

    // Compost events (discrete jumps)
    const compostCount = this.deps.getCompostCount()
    if (compostCount > this.prevCompostCount) {
      const newCompost = compostCount - this.prevCompostCount
      delta += newCompost * COMPOST_EROSION
      this.prevCompostCount = compostCount
    }

    this.state.level = Math.min(MAX_EROSION, this.state.level + delta)
    this.state.totalTicks++

    // Generate new marks at erosion milestones
    this.generateMarks()

    // Save occasionally
    if (this.state.totalTicks % 20 === 0) this.save()
  }

  private generateMarks() {
    const level = this.state.level
    const w = window.innerWidth
    const h = window.innerHeight

    // Cracks appear starting at 0.05 erosion, more frequently as erosion rises
    if (level > 0.05 && this.state.cracks.length < Math.floor(level * 30)) {
      if (Math.random() < 0.02 * level) {
        this.addCrack(w, h, level)
      }
    }

    // Water marks start at 0.1
    if (level > 0.1 && this.state.waterMarks.length < Math.floor(level * 15)) {
      if (Math.random() < 0.01 * level) {
        this.addWaterMark(w, h, level)
      }
    }

    // Age spots start at 0.15
    if (level > 0.15 && this.state.ageSpots.length < Math.floor(level * 20)) {
      if (Math.random() < 0.015 * level) {
        this.addAgeSpot(w, h, level)
      }
    }
  }

  private addCrack(w: number, h: number, level: number) {
    // Cracks originate from edges and corners
    const edge = Math.floor(Math.random() * 4)
    let x1: number, y1: number
    switch (edge) {
      case 0: x1 = Math.random() * w; y1 = 0; break
      case 1: x1 = Math.random() * w; y1 = h; break
      case 2: x1 = 0; y1 = Math.random() * h; break
      default: x1 = w; y1 = Math.random() * h; break
    }

    // Crack extends inward
    const angle = Math.atan2(h / 2 - y1, w / 2 - x1) + (Math.random() - 0.5) * 1.2
    const length = 20 + Math.random() * 60 * level
    const x2 = x1 + Math.cos(angle) * length
    const y2 = y1 + Math.sin(angle) * length

    this.state.cracks.push({
      x1: x1 / w, y1: y1 / h,  // store as fractions for resize safety
      x2: x2 / w, y2: y2 / h,
      depth: 0.02 + Math.random() * 0.04 * level,
      age: level,
    })
  }

  private addWaterMark(w: number, h: number, level: number) {
    this.state.waterMarks.push({
      x: 0.1 + Math.random() * 0.8,
      y: 0.1 + Math.random() * 0.8,
      radius: 15 + Math.random() * 40,
      opacity: 0.01 + Math.random() * 0.02 * level,
      age: level,
    })
  }

  private addAgeSpot(w: number, h: number, level: number) {
    this.state.ageSpots.push({
      x: Math.random(),
      y: Math.random(),
      size: 2 + Math.random() * 5,
      opacity: 0.015 + Math.random() * 0.025 * level,
      age: level,
    })
  }

  private render() {
    const w = window.innerWidth
    const h = window.innerHeight
    const ctx = this.ctx
    const dt = 0.016

    ctx.clearRect(0, 0, w, h)
    this.time += dt

    if (this.state.level < 0.005) return // nothing to show yet

    // Render cracks
    for (const crack of this.state.cracks) {
      ctx.strokeStyle = `rgba(40, 30, 20, ${crack.depth})`
      ctx.lineWidth = 0.5 + crack.depth * 3
      ctx.beginPath()
      ctx.moveTo(crack.x1 * w, crack.y1 * h)

      // Slightly jagged path
      const midX = (crack.x1 + crack.x2) / 2 * w
      const midY = (crack.y1 + crack.y2) / 2 * h
      const jitter = 3 * crack.depth
      ctx.quadraticCurveTo(
        midX + Math.sin(crack.age * 100) * jitter,
        midY + Math.cos(crack.age * 73) * jitter,
        crack.x2 * w, crack.y2 * h,
      )
      ctx.stroke()
    }

    // Render water marks
    for (const mark of this.state.waterMarks) {
      const x = mark.x * w
      const y = mark.y * h

      // Circular stain with uneven edge
      ctx.beginPath()
      for (let a = 0; a < Math.PI * 2; a += 0.1) {
        const wobble = 1 + Math.sin(a * 5 + mark.age * 30) * 0.15
        const rx = mark.radius * wobble
        const px = x + Math.cos(a) * rx
        const py = y + Math.sin(a) * rx
        if (a === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()

      ctx.strokeStyle = `rgba(80, 60, 30, ${mark.opacity})`
      ctx.lineWidth = 0.8
      ctx.stroke()

      // Inner stain (fainter)
      ctx.fillStyle = `rgba(60, 45, 20, ${mark.opacity * 0.3})`
      ctx.fill()
    }

    // Render age spots
    for (const spot of this.state.ageSpots) {
      const x = spot.x * w
      const y = spot.y * h

      ctx.globalAlpha = spot.opacity
      ctx.fillStyle = 'rgba(50, 35, 15, 1)'
      ctx.beginPath()
      ctx.ellipse(
        x, y,
        spot.size, spot.size * (0.7 + Math.sin(spot.age * 50) * 0.3),
        spot.age * 10, 0, Math.PI * 2,
      )
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // Overall dust/foxing overlay at high erosion
    if (this.state.level > 0.3) {
      const dustAlpha = (this.state.level - 0.3) * 0.02
      ctx.fillStyle = `rgba(60, 50, 30, ${Math.min(0.015, dustAlpha)})`
      ctx.fillRect(0, 0, w, h)
    }

    // Erosion level indicator — extremely subtle
    if (this.state.level > 0.01) {
      ctx.font = '9px monospace'
      ctx.fillStyle = `rgba(100, 80, 50, ${Math.min(0.06, this.state.level * 0.1)})`
      ctx.textAlign = 'right'
      ctx.fillText(`erosion ${(this.state.level * 100).toFixed(1)}%`, w - 8, 12)
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch { /* quota */ }
  }

  private load(): ErosionState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as ErosionState
    } catch { /* corrupted */ }
    return {
      level: 0,
      totalTicks: 0,
      cracks: [],
      waterMarks: [],
      ageSpots: [],
      lastCompost: 0,
    }
  }
}
