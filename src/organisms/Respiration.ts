/**
 * RESPIRATION — the house breathes
 *
 * Not a metaphor. Not a visual effect in a room. The entire house
 * has a respiratory cycle — a slow, barely perceptible oscillation
 * that makes everything feel like it's inside a living body.
 *
 * Implementation: a full-screen overlay with a radial vignette that
 * pulses between slightly darker and lighter at the edges. The
 * breathing rate is modulated by:
 * - Season: faster in growth, slower in decay
 * - Immune fever: rapid/shallow breathing when sick
 * - Autophagy: irregular when self-digesting
 * - Time of day: slower at night
 * - Erosion: labored when damaged
 *
 * The effect is EXTREMELY subtle — you should never consciously
 * notice it. But without it, the house feels dead. With it,
 * the house feels like something that could stop breathing.
 *
 * Inspired by:
 * - Respiratory sinus arrhythmia: breathing naturally varies
 * - Tarkovsky's long takes: cinema that breathes
 * - The 2026 "Guaranteed Human" movement: life is imperfect rhythm
 * - James Turrell: perceiving light as substance
 */

const BASE_CYCLE = 6000      // 6s default breath cycle
const MIN_CYCLE = 2500       // fastest breathing (fever)
const MAX_CYCLE = 10000      // slowest breathing (deep sleep)
const BASE_DEPTH = 0.012     // vignette opacity oscillation depth
const UPDATE_INTERVAL = 50   // 50ms for smooth animation

interface RespirationDeps {
  getSeason: () => string
  getFeverLevel: () => number
  getErosionLevel: () => number
  getAvgAutophagy: () => number
}

export class Respiration {
  private overlay: HTMLElement
  private deps: RespirationDeps | null = null
  private phase = 0           // 0-1 through breath cycle
  private cycleMs = BASE_CYCLE
  private depth = BASE_DEPTH
  private timer: number | null = null
  private lastTick = 0
  private irregularity = 0    // 0-1, how irregular the breathing is

  constructor() {
    this.overlay = document.createElement('div')
    this.overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: 52;
      pointer-events: none;
      opacity: 0;
      transition: opacity 3s ease;
    `
    document.body.appendChild(this.overlay)

    // Fade in after page load
    setTimeout(() => { this.overlay.style.opacity = '1' }, 5000)
  }

  setDeps(deps: RespirationDeps) {
    this.deps = deps
  }

  start() {
    this.lastTick = Date.now()
    this.tick()

    // Update breathing parameters every 5s from organism state
    setInterval(() => this.updateParams(), 5000)
  }

  private updateParams() {
    if (!this.deps) return

    const season = this.deps.getSeason()
    const fever = this.deps.getFeverLevel()
    const erosion = this.deps.getErosionLevel()
    const autophagy = this.deps.getAvgAutophagy()

    // Base cycle from season
    const seasonRates: Record<string, number> = {
      seed: 7000,
      growth: 5000,
      ripe: 5500,
      fall: 6500,
      decay: 8500,
    }
    let targetCycle = seasonRates[season] || BASE_CYCLE

    // Fever increases breathing rate
    if (fever > 0.1) {
      targetCycle *= (1 - fever * 0.5) // up to 50% faster
    }

    // Erosion makes breathing labored (deeper, slower)
    if (erosion > 0.1) {
      targetCycle *= (1 + erosion * 0.3) // up to 30% slower
      this.depth = BASE_DEPTH * (1 + erosion * 2) // deeper breaths
    } else {
      this.depth = BASE_DEPTH
    }

    // Autophagy makes breathing irregular
    this.irregularity = Math.min(0.5, autophagy)

    // Clamp
    this.cycleMs = Math.max(MIN_CYCLE, Math.min(MAX_CYCLE, targetCycle))

    // Time of day: slower at night
    const hour = new Date().getHours()
    if (hour >= 23 || hour < 5) {
      this.cycleMs *= 1.3
      this.depth *= 0.7
    }
  }

  private tick() {
    const now = Date.now()
    const dt = now - this.lastTick
    this.lastTick = now

    // Advance phase with optional irregularity
    let phaseDelta = dt / this.cycleMs
    if (this.irregularity > 0) {
      // Add subtle jitter to breathing
      phaseDelta *= 1 + (Math.sin(now * 0.0003) * this.irregularity)
    }
    this.phase = (this.phase + phaseDelta) % 1

    // Sinusoidal breath — smooth in and out
    // Use a modified sine that spends slightly more time exhaled (natural)
    const raw = Math.sin(this.phase * Math.PI * 2)
    // Asymmetric: inhale faster, exhale slower
    const breath = raw > 0
      ? Math.pow(raw, 0.8)    // inhale: slightly faster
      : -Math.pow(-raw, 1.2)  // exhale: slightly slower

    // Map to vignette opacity
    const vignetteAlpha = this.depth * (1 + breath) * 0.5

    // Subtle color shift with season
    const season = this.deps?.getSeason() || 'growth'
    const colors: Record<string, string> = {
      seed:   '40, 35, 50',    // cool deep purple
      growth: '20, 30, 25',    // verdant dark
      ripe:   '45, 35, 15',    // warm amber
      fall:   '50, 30, 20',    // russet
      decay:  '30, 25, 35',    // bruised violet
    }
    const rgb = colors[season] || '30, 25, 30'

    // Apply vignette
    this.overlay.style.background = `
      radial-gradient(ellipse at center,
        transparent 40%,
        rgba(${rgb}, ${vignetteAlpha * 0.3}) 70%,
        rgba(${rgb}, ${vignetteAlpha}) 100%)
    `

    this.timer = window.setTimeout(() => this.tick(), UPDATE_INTERVAL)
  }

  /** Current breath phase (0-1) for other systems */
  getPhase(): number {
    return this.phase
  }

  /** Current breathing rate in ms per cycle */
  getCycleMs(): number {
    return this.cycleMs
  }
}
