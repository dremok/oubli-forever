/**
 * THE PHENOTYPE — the house adapts its appearance to you
 *
 * Like how an organism's phenotype expresses its genotype through
 * interaction with environment, the house develops coloration based
 * on how you explore it. Spend time in water rooms → the whole house
 * develops aquatic tones. Gravitate toward fire → amber warmth spreads.
 *
 * This is not a room. It's gene expression. The house's DNA is its
 * rooms; your navigation pattern is the environment that activates
 * certain genes over others.
 *
 * The effect is extremely subtle — a barely perceptible tint that
 * shifts over many visits. You shouldn't notice the change, only
 * that the house "feels" different from someone else's experience.
 *
 * Inspired by:
 * - Epigenetic expression (same DNA, different organisms based on environment)
 * - "Guaranteed Human" movement — the house develops YOUR fingerprint
 * - The Nottingham/Cambridge episodic-semantic merger — all memory is one,
 *   but the WAY you remember shapes what you become
 * - Tracey Emin: "A Second Life" — same person, different expression
 */

// Room biomes — categorize rooms by elemental affinity
const BIOMES: Record<string, string[]> = {
  water:   ['tidepool', 'aquifer', 'well', 'glacarium'],
  fire:    ['furnace', 'lighthouse'],
  earth:   ['garden', 'roots', 'terrarium', 'ossuary', 'catacombs'],
  cosmic:  ['observatory', 'satellite', 'asteroid-field', 'void'],
  sound:   ['instrument', 'choir', 'radio', 'disintegration-loops'],
  text:    ['study', 'archive', 'library', 'palimpsest-gallery', 'loom'],
  time:    ['clock-tower', 'pendulum', 'midnight', 'date-paintings'],
  liminal: ['between', 'seance', 'labyrinth', 'mirror', 'cipher', 'madeleine'],
}

// Color tints per biome (HSL)
const BIOME_COLORS: Record<string, { h: number; s: number; l: number }> = {
  water:   { h: 195, s: 35, l: 55 },  // cool blue-green
  fire:    { h: 30,  s: 50, l: 55 },   // warm amber
  earth:   { h: 80,  s: 25, l: 45 },   // olive-brown
  cosmic:  { h: 270, s: 30, l: 50 },   // deep purple
  sound:   { h: 300, s: 25, l: 55 },   // soft violet
  text:    { h: 42,  s: 20, l: 60 },   // cream/sepia
  time:    { h: 210, s: 10, l: 65 },   // silver-gray
  liminal: { h: 160, s: 20, l: 55 },   // iridescent teal
}

const STORAGE_KEY = 'oubli_phenotype'
const DECAY_RATE = 0.995      // biome scores decay slowly per tick
const GAIN_PER_SECOND = 0.08  // score gained per second in a biome room
const TICK_MS = 2000           // update every 2 seconds
const MAX_TINT_ALPHA = 0.025  // maximum overlay opacity (VERY subtle)

interface PhenotypeState {
  scores: Record<string, number>  // biome name → accumulated score
}

export class Phenotype {
  private state: PhenotypeState
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private activeRoom = 'void'
  private activeBiome: string | null = null
  private tickInterval: number | null = null
  private animFrame: number | null = null
  private currentTint = { h: 0, s: 0, l: 0, a: 0 }
  private targetTint = { h: 0, s: 0, l: 0, a: 0 }

  constructor() {
    this.state = this.load()

    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 49; pointer-events: none;
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

  start() {
    this.computeTarget()

    this.tickInterval = window.setInterval(() => this.tick(), TICK_MS)

    const render = () => {
      this.animFrame = requestAnimationFrame(render)
      this.render()
    }
    render()
  }

  onRoomEnter(room: string) {
    this.activeRoom = room
    this.activeBiome = this.getBiome(room)
  }

  private getBiome(room: string): string | null {
    for (const [biome, rooms] of Object.entries(BIOMES)) {
      if (rooms.includes(room)) return biome
    }
    return null
  }

  private tick() {
    // Accumulate score for active biome
    if (this.activeBiome) {
      const dt = TICK_MS / 1000
      this.state.scores[this.activeBiome] =
        (this.state.scores[this.activeBiome] || 0) + GAIN_PER_SECOND * dt
    }

    // Decay all scores slightly (prevents any one biome from dominating forever)
    for (const biome of Object.keys(this.state.scores)) {
      this.state.scores[biome] *= DECAY_RATE
      if (this.state.scores[biome] < 0.01) delete this.state.scores[biome]
    }

    // Recompute target tint
    this.computeTarget()

    // Periodic save
    if (Math.random() < 0.1) this.save()
  }

  private computeTarget() {
    const scores = this.state.scores
    const total = Object.values(scores).reduce((s, v) => s + v, 0)

    if (total < 0.5) {
      // Not enough data — no tint
      this.targetTint = { h: 0, s: 0, l: 0, a: 0 }
      return
    }

    // Weighted average of biome colors
    let wH = 0, wS = 0, wL = 0
    for (const [biome, score] of Object.entries(scores)) {
      const color = BIOME_COLORS[biome]
      if (!color) continue
      const weight = score / total
      wH += color.h * weight
      wS += color.s * weight
      wL += color.l * weight
    }

    // Alpha scales with how concentrated the scores are (diversity vs focus)
    // If one biome dominates, the tint is stronger
    const maxScore = Math.max(...Object.values(scores))
    const concentration = total > 0 ? maxScore / total : 0
    // Also scale with total time spent (more exploration = more tint)
    const maturity = Math.min(1, total / 50) // reaches full at ~50 accumulated score
    const alpha = MAX_TINT_ALPHA * concentration * maturity

    this.targetTint = { h: wH, s: wS, l: wL, a: alpha }
  }

  private render() {
    const w = window.innerWidth
    const h = window.innerHeight
    const ctx = this.ctx

    ctx.clearRect(0, 0, w, h)

    // Smoothly interpolate toward target
    const lerp = 0.003 // very slow transition
    this.currentTint.h += (this.targetTint.h - this.currentTint.h) * lerp
    this.currentTint.s += (this.targetTint.s - this.currentTint.s) * lerp
    this.currentTint.l += (this.targetTint.l - this.currentTint.l) * lerp
    this.currentTint.a += (this.targetTint.a - this.currentTint.a) * lerp

    if (this.currentTint.a < 0.001) return

    // Apply as a very subtle fullscreen tint
    const { h: ch, s: cs, l: cl, a: ca } = this.currentTint
    ctx.fillStyle = `hsla(${ch}, ${cs}%, ${cl}%, ${ca})`
    ctx.fillRect(0, 0, w, h)

    // Slight vignette enhancement — tint is stronger at edges
    const grad = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.2,
      w / 2, h / 2, Math.min(w, h) * 0.7
    )
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)')
    grad.addColorStop(1, `hsla(${ch}, ${cs}%, ${Math.max(0, cl - 15)}%, ${ca * 0.5})`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  }

  /** Get the dominant biome name (for other systems to read) */
  getDominantBiome(): string | null {
    const scores = this.state.scores
    let max = 0
    let dominant: string | null = null
    for (const [biome, score] of Object.entries(scores)) {
      if (score > max) {
        max = score
        dominant = biome
      }
    }
    return dominant
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch { /* quota — fail silently */ }
  }

  private load(): PhenotypeState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as PhenotypeState
    } catch { /* corrupted */ }
    return { scores: {} }
  }
}
