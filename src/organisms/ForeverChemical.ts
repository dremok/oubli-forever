/**
 * FOREVER CHEMICAL — the cure that became the contamination
 *
 * Inspired by TFA/PFAS research (Geophysical Research Letters, Feb 2026):
 * the chemicals we invented to fix the ozone hole are breaking down into
 * trifluoroacetic acid, a "forever chemical" now found in rainwater,
 * Arctic ice, soil, and human blood. 335,500 metric tons deposited
 * since 2000. The cure is becoming the contamination. The fix never
 * goes away.
 *
 * In Oubli, every act of preservation — typing a memory, writing in
 * the study, planting a seed, visiting a room — leaves a permanent
 * crystalline residue. Unlike every other organism in the house,
 * THIS NEVER DECAYS. The residue accumulates across sessions.
 *
 * The more you try to remember, the more contaminated the house becomes.
 * The act of saving leaves traces that outlast what was saved.
 *
 * Visual: tiny bright specks scattered across the screen, like
 * crystalline deposits or chemical precipitates. They shimmer faintly.
 * Each speck represents one act of preservation. They're always there.
 *
 * This is the ONLY permanent accumulation in Oubli. Everything else
 * decays, erodes, or is digested. These never leave.
 */

const STORAGE_KEY = 'oubli-forever-chemical'
const MAX_DEPOSITS = 500          // visual cap (data keeps growing)
const RENDER_INTERVAL = 150       // ~7fps, these don't need to be smooth
const SHIMMER_SPEED = 0.0003      // very slow shimmer

interface Deposit {
  x: number      // 0-1 normalized position
  y: number      // 0-1 normalized position
  size: number   // 1-3 px
  hue: number    // color shift
  birth: number  // timestamp
}

interface ChemicalState {
  deposits: Deposit[]
  totalActs: number    // total preservation acts ever
  firstDeposit: number // timestamp of first deposit
}

export class ForeverChemical {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private state: ChemicalState
  private animFrame: number | null = null

  constructor() {
    this.state = this.loadState()

    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      z-index: 53;
      pointer-events: none;
    `
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!

    this.resize()
    window.addEventListener('resize', () => this.resize())

    // Start render loop (very throttled)
    const render = () => {
      this.render()
      this.animFrame = window.setTimeout(render, RENDER_INTERVAL)
    }
    render()

    // Save periodically
    setInterval(() => this.saveState(), 30000)
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = window.innerWidth * dpr
    this.canvas.height = window.innerHeight * dpr
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  /**
   * Record a preservation act. Each act leaves a permanent deposit.
   * Call this when the visitor writes, plants, creates, or saves.
   */
  deposit(source?: string) {
    this.state.totalActs++
    if (this.state.firstDeposit === 0) {
      this.state.firstDeposit = Date.now()
    }

    // Create a deposit at a random position
    // Cluster near center with some spread
    const angle = Math.random() * Math.PI * 2
    const dist = Math.random() * 0.4 + 0.1
    const deposit: Deposit = {
      x: 0.5 + Math.cos(angle) * dist,
      y: 0.5 + Math.sin(angle) * dist,
      size: 1 + Math.random() * 2,
      hue: source === 'memory' ? 200 : source === 'garden' ? 120 : 40 + Math.random() * 20,
      birth: Date.now(),
    }

    this.state.deposits.push(deposit)

    // Only keep visual deposits up to MAX_DEPOSITS (but totalActs keeps counting)
    if (this.state.deposits.length > MAX_DEPOSITS) {
      this.state.deposits = this.state.deposits.slice(-MAX_DEPOSITS)
    }
  }

  private render() {
    const w = window.innerWidth
    const h = window.innerHeight
    const ctx = this.ctx
    const now = Date.now()

    ctx.clearRect(0, 0, w, h)

    if (this.state.deposits.length === 0) return

    for (const d of this.state.deposits) {
      const px = d.x * w
      const py = d.y * h

      // Shimmer: slow sinusoidal alpha variation
      const age = now - d.birth
      const shimmer = 0.5 + 0.5 * Math.sin(age * SHIMMER_SPEED + d.x * 10)
      const alpha = 0.08 + shimmer * 0.12

      ctx.beginPath()
      ctx.arc(px, py, d.size, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${d.hue}, 40%, 70%, ${alpha})`
      ctx.fill()
    }

    // Very faint count in center bottom (only if significant)
    if (this.state.totalActs > 10) {
      const countAlpha = Math.min(0.06, 0.02 + this.state.totalActs * 0.0005)
      ctx.font = '8px monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = `rgba(200, 180, 140, ${countAlpha})`
      ctx.fillText(
        `${this.state.totalActs} permanent deposits`,
        w / 2,
        h - 24
      )
    }
  }

  /** Total preservation acts ever recorded */
  getTotalActs(): number {
    return this.state.totalActs
  }

  /** Number of visible deposits */
  getDepositCount(): number {
    return this.state.deposits.length
  }

  /** Age of first deposit in ms (0 if none) */
  getAge(): number {
    return this.state.firstDeposit ? Date.now() - this.state.firstDeposit : 0
  }

  private loadState(): ChemicalState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) return JSON.parse(stored)
    } catch { /* fresh */ }
    return { deposits: [], totalActs: 0, firstDeposit: 0 }
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch { /* quota */ }
  }
}
