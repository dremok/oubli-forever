/**
 * THE TIDE — a system-wide rhythm of presence and absence
 *
 * Sierra Nevada snowpack (Feb 2026) at 6% of normal — the water memory
 * of an entire mountain range vanishing. The snow that should have
 * accumulated over winter simply didn't fall. A drought of memory.
 *
 * In Oubli, the Tide is a slow, house-wide oscillation driven by
 * accumulated visitor presence. It rises as you spend time in the house
 * and falls when you're away. When the tide is HIGH (>0.7), hidden
 * content surfaces — extra whispers, deeper colors, content that was
 * always there but submerged. When the tide is LOW (<0.3), rooms
 * feel exposed, dry, stripped — like a tide pool at low water.
 *
 * The tide level is persisted in localStorage and decays during
 * absence. It takes sustained presence to raise the tide, and
 * sustained absence to drain it. The cycle is much slower than
 * seasons — think weeks, not hours.
 *
 * Visual: a thin horizontal line at the very bottom of the screen
 * that shows the current tide level. Blue when high, amber when low.
 * Almost invisible — a watermark of accumulated time.
 *
 * Inspired by:
 * - Snow drought 2026: water memory vanishing from mountains
 * - Hawking area theorem (GW250114): surfaces only grow, never shrink
 *   (but the tide DOES shrink — it's entropy, not area)
 * - Tidal patterns: the gravitational memory of moon and sun
 * - James Lovelock's Gaia: the planet as self-regulating organism
 */

const STORAGE_KEY = 'oubli-tide'
const RISE_RATE = 0.00001    // per ms of presence (~0.036/hour)
const FALL_RATE = 0.000003   // per ms of absence (~0.011/hour, 3x slower)
const UPDATE_INTERVAL = 5000 // recalculate every 5s
const RENDER_INTERVAL = 200  // visual update every 200ms

interface TideState {
  level: number       // 0-1
  totalPresence: number // cumulative ms of presence (never decreases)
  lastUpdate: number  // timestamp
  highWaterMark: number // highest tide ever reached
}

// Content that surfaces at high tide
const HIGH_TIDE_WHISPERS = [
  'the water remembers everyone who visited.',
  'at high tide, the hidden rooms are closer to the surface.',
  'the house is full. something is about to overflow.',
  'the accumulated presence of all visitors raises the water level.',
  'every minute you spend here adds a drop to the tide.',
]

// Content exposed at low tide
const LOW_TIDE_WHISPERS = [
  'the tide has receded. the foundation is visible.',
  'at low water, you can see what the house is built on.',
  'the drought of attention strips the rooms bare.',
  'absence drains. the house is drying out.',
  'the waterline marks show how full it used to be.',
]

export class Tide {
  private state: TideState
  private el: HTMLElement
  private indicator: HTMLElement
  private levelText: HTMLElement
  private timer: number | null = null

  constructor() {
    this.state = this.loadState()

    // Apply absence decay since last update
    const elapsed = Date.now() - this.state.lastUpdate
    if (elapsed > 0 && elapsed < 30 * 24 * 60 * 60 * 1000) { // cap at 30 days
      this.state.level = Math.max(0, this.state.level - FALL_RATE * elapsed)
    }

    // Create visual element — thin tide line at bottom
    this.el = document.createElement('div')
    this.el.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;
      z-index: 57;
      pointer-events: none;
      overflow: hidden;
    `

    this.indicator = document.createElement('div')
    this.indicator.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      height: 100%;
      width: 0%;
      transition: width 2s ease, background 2s ease;
    `
    this.el.appendChild(this.indicator)

    this.levelText = document.createElement('div')
    this.levelText.style.cssText = `
      position: fixed;
      bottom: 6px;
      right: 12px;
      z-index: 57;
      pointer-events: none;
      font: 8px monospace;
      color: rgba(100, 140, 180, 0);
      transition: color 3s ease;
      letter-spacing: 1px;
    `
    document.body.appendChild(this.el)
    document.body.appendChild(this.levelText)
  }

  start() {
    this.tick()
    this.render()
    setInterval(() => this.saveState(), 30000) // save every 30s
  }

  private tick() {
    // Presence raises the tide
    const now = Date.now()
    const dt = now - this.state.lastUpdate
    this.state.lastUpdate = now

    if (dt > 0 && dt < 60000) { // sanity check: max 1 minute delta
      this.state.level = Math.min(1, this.state.level + RISE_RATE * dt)
      this.state.totalPresence += dt

      // Track high water mark
      if (this.state.level > this.state.highWaterMark) {
        this.state.highWaterMark = this.state.level
      }
    }

    this.timer = window.setTimeout(() => this.tick(), UPDATE_INTERVAL)
  }

  private render() {
    const level = this.state.level
    const pct = (level * 100).toFixed(1)

    // Tide line width
    this.indicator.style.width = `${pct}%`

    // Color: blue at high tide, amber at low tide
    if (level > 0.7) {
      this.indicator.style.background = `linear-gradient(90deg,
        rgba(80, 140, 200, 0.3),
        rgba(100, 160, 220, 0.15))`
    } else if (level > 0.3) {
      this.indicator.style.background = `linear-gradient(90deg,
        rgba(140, 160, 180, 0.2),
        rgba(140, 160, 180, 0.08))`
    } else {
      this.indicator.style.background = `linear-gradient(90deg,
        rgba(200, 160, 80, 0.25),
        rgba(200, 160, 80, 0.08))`
    }

    // Level text (very faint)
    if (level > 0.01) {
      const alpha = Math.min(0.12, level * 0.1)
      const r = level > 0.5 ? 100 : 200
      const g = level > 0.5 ? 140 : 160
      const b = level > 0.5 ? 200 : 100
      this.levelText.style.color = `rgba(${r}, ${g}, ${b}, ${alpha})`
      this.levelText.textContent = `tide ${pct}%`
    } else {
      this.levelText.style.color = 'rgba(100, 140, 180, 0)'
    }

    requestAnimationFrame(() => {
      setTimeout(() => this.render(), RENDER_INTERVAL)
    })
  }

  private loadState(): TideState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) return JSON.parse(stored)
    } catch { /* fresh */ }
    return {
      level: 0,
      totalPresence: 0,
      lastUpdate: Date.now(),
      highWaterMark: 0,
    }
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch { /* quota */ }
  }

  /** Current tide level (0-1) */
  getLevel(): number {
    return this.state.level
  }

  /** High water mark — highest tide ever reached */
  getHighWaterMark(): number {
    return this.state.highWaterMark
  }

  /** Total accumulated presence in ms */
  getTotalPresence(): number {
    return this.state.totalPresence
  }

  /** Get a context-appropriate whisper based on tide level */
  getWhisper(): string | null {
    if (this.state.level > 0.7) {
      return HIGH_TIDE_WHISPERS[Math.floor(Math.random() * HIGH_TIDE_WHISPERS.length)]
    }
    if (this.state.level < 0.3) {
      return LOW_TIDE_WHISPERS[Math.floor(Math.random() * LOW_TIDE_WHISPERS.length)]
    }
    return null
  }
}
