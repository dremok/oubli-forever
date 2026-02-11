/**
 * THE SEASONAL CLOCK — the house has its own biological seasons
 *
 * Not tied to the calendar. Not tied to real seasons. The house has its
 * own internal clock, measured in cumulative visitor presence.
 *
 * SEED   → sparse, quiet, potential energy, muted colors
 * GROWTH → energy increasing, colors brightening, trails strengthening
 * RIPE   → maximum sweetness, golden warmth, abundant events
 * FALL   → beauty in shedding, amber/red tones, memories drift loose
 * DECAY  → decomposition, earth tones, nutrients cycling back
 *
 * Then back to SEED.
 *
 * Each season lasts roughly 1-3 days of cumulative visitor time
 * (not wall-clock time — only advances when someone is present).
 * The season affects everything: membrane density, mycelium growth rate,
 * fruiting probability, phenotype intensity, background atmosphere.
 *
 * Visitors experience different seasons on different visits. The house
 * is never the same twice. If you visit during DECAY, you see the
 * house composting itself. During RIPE, it's golden and abundant.
 *
 * Inspired by:
 * - Ethylene ripening cascade (irreversible seasonal transition)
 * - Polar vortex split (the atmosphere's protective structure breaking)
 * - The Great Meme Reset (trying to return to seed, failing, transforming)
 * - Deciduous trees: the same organism, radically different appearance each season
 * - The oubli fruit: its own life cycle IS the clock
 */

const STORAGE_KEY = 'oubli_seasonal_clock'

export type Season = 'seed' | 'growth' | 'ripe' | 'fall' | 'decay'

const SEASONS: Season[] = ['seed', 'growth', 'ripe', 'fall', 'decay']

// Cumulative visitor-seconds per season (total cycle ~4 hours of actual presence)
const SEASON_DURATIONS: Record<Season, number> = {
  seed:   2400,   // 40 min of visitor presence
  growth: 3600,   // 60 min
  ripe:   2400,   // 40 min (shorter — peak is fleeting)
  fall:   1800,   // 30 min
  decay:  1800,   // 30 min
}

// Visual properties per season
const SEASON_AESTHETICS: Record<Season, SeasonStyle> = {
  seed: {
    bgTint: { h: 220, s: 10, l: 15, a: 0.03 },    // cool, dark, potential
    particleSpeed: 0.7,
    particleAlpha: 0.6,
    label: 'seed',
    whisper: 'the house is waiting to begin',
  },
  growth: {
    bgTint: { h: 120, s: 20, l: 25, a: 0.02 },     // green, alive
    particleSpeed: 1.0,
    particleAlpha: 0.8,
    label: 'growth',
    whisper: 'the house is growing',
  },
  ripe: {
    bgTint: { h: 45, s: 40, l: 30, a: 0.025 },     // golden, warm, abundant
    particleSpeed: 0.9,
    particleAlpha: 1.0,
    label: 'ripe',
    whisper: 'the house is golden',
  },
  fall: {
    bgTint: { h: 15, s: 35, l: 25, a: 0.025 },     // amber, shedding
    particleSpeed: 1.2,
    particleAlpha: 0.7,
    label: 'fall',
    whisper: 'the house is shedding',
  },
  decay: {
    bgTint: { h: 30, s: 15, l: 18, a: 0.03 },      // earth, decomposing
    particleSpeed: 0.5,
    particleAlpha: 0.5,
    label: 'decay',
    whisper: 'the house is composting itself',
  },
}

interface SeasonStyle {
  bgTint: { h: number; s: number; l: number; a: number }
  particleSpeed: number
  particleAlpha: number
  label: string
  whisper: string
}

interface ClockState {
  season: Season
  elapsed: number         // seconds accumulated in current season
  totalCycles: number     // how many full cycles completed
  lastTick: number        // timestamp of last tick
}

export class SeasonalClock {
  private state: ClockState
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private tickInterval: number | null = null
  private animFrame: number | null = null
  private currentStyle: SeasonStyle
  private targetStyle: SeasonStyle
  private blendedTint = { h: 0, s: 0, l: 0, a: 0 }
  private transitionProgress = 1 // 1 = fully in current season
  private seasonChangeCallbacks: ((season: Season, style: SeasonStyle) => void)[] = []
  private fallingLeaves: Leaf[] = []
  private time = 0

  constructor() {
    this.state = this.load()
    this.currentStyle = SEASON_AESTHETICS[this.state.season]
    this.targetStyle = this.currentStyle
    this.blendedTint = { ...this.currentStyle.bgTint }

    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 48; pointer-events: none;
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
    // Tick every 2 seconds — accumulate presence time
    this.tickInterval = window.setInterval(() => this.tick(), 2000)

    const render = () => {
      this.render()
      this.animFrame = window.setTimeout(render, 100)
    }
    render()

    // Notify listeners of initial season
    for (const cb of this.seasonChangeCallbacks) {
      cb(this.state.season, this.currentStyle)
    }
  }

  /** Register callback for season changes */
  onSeasonChange(fn: (season: Season, style: SeasonStyle) => void) {
    this.seasonChangeCallbacks.push(fn)
  }

  /** Get the current season */
  getSeason(): Season {
    return this.state.season
  }

  /** Get progress through current season (0-1) */
  getSeasonProgress(): number {
    const duration = SEASON_DURATIONS[this.state.season]
    return Math.min(1, this.state.elapsed / duration)
  }

  /** Get total cycle count */
  getCycleCount(): number {
    return this.state.totalCycles
  }

  private tick() {
    const now = Date.now()
    const dt = this.state.lastTick ? Math.min(5, (now - this.state.lastTick) / 1000) : 2
    this.state.lastTick = now

    // Accumulate visitor presence
    this.state.elapsed += dt

    // Check for season transition
    const duration = SEASON_DURATIONS[this.state.season]
    if (this.state.elapsed >= duration) {
      this.advanceSeason()
    }

    // Spawn falling leaves in fall season
    if (this.state.season === 'fall' && Math.random() < 0.08) {
      this.spawnLeaf()
    }

    // Periodic save
    if (Math.random() < 0.05) this.save()
  }

  private advanceSeason() {
    const currentIdx = SEASONS.indexOf(this.state.season)
    const nextIdx = (currentIdx + 1) % SEASONS.length

    // Check for full cycle
    if (nextIdx === 0) {
      this.state.totalCycles++
    }

    this.state.season = SEASONS[nextIdx]
    this.state.elapsed = 0

    // Set up transition
    this.targetStyle = SEASON_AESTHETICS[this.state.season]
    this.transitionProgress = 0

    // Notify listeners
    for (const cb of this.seasonChangeCallbacks) {
      cb(this.state.season, this.targetStyle)
    }

    this.save()
  }

  private spawnLeaf() {
    const w = window.innerWidth
    this.fallingLeaves.push({
      x: Math.random() * w,
      y: -10,
      vx: (Math.random() - 0.5) * 20,
      vy: 15 + Math.random() * 25,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 2,
      size: 3 + Math.random() * 5,
      hue: 20 + Math.random() * 30, // amber to brown
      life: 1,
      decay: 0.02 + Math.random() * 0.02,
    })
  }

  private render() {
    const w = window.innerWidth
    const h = window.innerHeight
    const ctx = this.ctx
    const dt = 0.016

    ctx.clearRect(0, 0, w, h)
    this.time += dt

    // Blend toward target style
    if (this.transitionProgress < 1) {
      this.transitionProgress = Math.min(1, this.transitionProgress + dt * 0.05)
    }

    const t = this.transitionProgress
    const cur = this.currentStyle.bgTint
    const tgt = this.targetStyle.bgTint
    this.blendedTint.h = cur.h + (tgt.h - cur.h) * t
    this.blendedTint.s = cur.s + (tgt.s - cur.s) * t
    this.blendedTint.l = cur.l + (tgt.l - cur.l) * t
    this.blendedTint.a = cur.a + (tgt.a - cur.a) * t

    if (t >= 1) {
      this.currentStyle = this.targetStyle
    }

    // Seasonal atmosphere overlay
    const { h: ch, s: cs, l: cl, a: ca } = this.blendedTint
    if (ca > 0.001) {
      // Fullscreen tint
      ctx.fillStyle = `hsla(${ch}, ${cs}%, ${cl}%, ${ca})`
      ctx.fillRect(0, 0, w, h)

      // Breathing pulse based on season
      const breath = Math.sin(this.time * 0.3) * 0.3 + 0.7
      const breathAlpha = ca * 0.3 * breath
      const grad = ctx.createRadialGradient(
        w / 2, h / 2, 0,
        w / 2, h / 2, Math.min(w, h) * 0.6
      )
      grad.addColorStop(0, `hsla(${ch}, ${cs + 10}%, ${cl + 10}%, ${breathAlpha})`)
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)
    }

    // Falling leaves (only during fall/decay seasons)
    for (let i = this.fallingLeaves.length - 1; i >= 0; i--) {
      const leaf = this.fallingLeaves[i]
      leaf.x += leaf.vx * dt
      leaf.y += leaf.vy * dt
      leaf.vx += Math.sin(this.time * 2 + leaf.rotation) * 5 * dt // wind sway
      leaf.rotation += leaf.rotSpeed * dt
      leaf.life -= leaf.decay * dt

      if (leaf.life <= 0 || leaf.y > h + 20) {
        this.fallingLeaves.splice(i, 1)
        continue
      }

      const alpha = leaf.life * 0.15
      ctx.save()
      ctx.translate(leaf.x, leaf.y)
      ctx.rotate(leaf.rotation)
      ctx.fillStyle = `hsla(${leaf.hue}, 40%, 40%, ${alpha})`
      // Simple leaf shape — elongated diamond
      ctx.beginPath()
      ctx.moveTo(0, -leaf.size)
      ctx.quadraticCurveTo(leaf.size * 0.6, 0, 0, leaf.size)
      ctx.quadraticCurveTo(-leaf.size * 0.6, 0, 0, -leaf.size)
      ctx.fill()
      ctx.restore()
    }

    // Season indicator — very subtle text at bottom-left
    const seasonProgress = this.getSeasonProgress()
    const indicatorAlpha = 0.06
    ctx.font = '10px Cormorant Garamond, serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = `rgba(200, 180, 120, ${indicatorAlpha})`
    ctx.fillText(
      `${this.state.season} · ${Math.floor(seasonProgress * 100)}%`,
      12, h - 12
    )
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch { /* quota */ }
  }

  private load(): ClockState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as ClockState
    } catch { /* corrupted */ }
    return {
      season: 'seed',
      elapsed: 0,
      totalCycles: 0,
      lastTick: Date.now(),
    }
  }
}

// --- Supporting types ---

interface Leaf {
  x: number; y: number
  vx: number; vy: number
  rotation: number; rotSpeed: number
  size: number; hue: number
  life: number; decay: number
}
