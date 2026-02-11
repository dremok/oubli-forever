/**
 * STASIS — the house's metabolism is slowing down
 *
 * Inspired by the species turnover slowdown study (Nature Communications,
 * Feb 9 2026): the rate at which species replace each other has fallen
 * by a third since the 1970s. Nature's self-repairing engine is "grinding
 * to a halt" — not because things are stable, but because there are fewer
 * things left to do the reshuffling.
 *
 * In Oubli, Stasis measures how often content changes and gradually
 * slows the rate of change. Whispers cycle slower. Room transitions
 * take longer. The house is not dying dramatically — it's going quiet.
 *
 * Stasis is measured per-session and accumulates in localStorage.
 * The longer you spend in the house across multiple sessions, the
 * more the house's metabolism decelerates.
 *
 * Visual: a faint "pulse rate" indicator in the top-right corner
 * that shows the house's metabolic speed. It beats slower over time.
 *
 * Other organisms can query getTimeFactor() to slow themselves.
 * Factor starts at 1.0 and gradually decreases toward 0.3 over
 * many sessions.
 */

const STORAGE_KEY = 'oubli-stasis'
const PULSE_INTERVAL = 100  // ms between pulse renders

interface StasisState {
  totalSessionMs: number       // cumulative time across all sessions
  sessionCount: number         // number of sessions
  contentChanges: number       // tracked content changes
  lastUpdate: number           // timestamp
}

// Thresholds: cumulative session time → time factor
// After 1 hour total: factor = 0.9
// After 5 hours: factor = 0.7
// After 20 hours: factor = 0.5
// After 100 hours: factor = 0.3
const HOUR_MS = 3600000

function computeFactor(totalMs: number): number {
  if (totalMs < HOUR_MS) return 1.0
  // Logarithmic decay: 1.0 → 0.3 over many hours
  const hours = totalMs / HOUR_MS
  return Math.max(0.3, 1.0 - 0.1 * Math.log2(hours))
}

export class Stasis {
  private state: StasisState
  private sessionStart: number
  private el: HTMLElement
  private pulseEl: HTMLElement
  private factor: number
  private pulsePhase = 0

  constructor() {
    this.state = this.loadState()
    this.state.sessionCount++
    this.sessionStart = Date.now()
    this.factor = computeFactor(this.state.totalSessionMs)

    // Pulse indicator — tiny dot in top-right
    this.el = document.createElement('div')
    this.el.style.cssText = `
      position: fixed;
      top: 14px;
      right: 14px;
      z-index: 58;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 6px;
    `

    this.pulseEl = document.createElement('div')
    this.pulseEl.style.cssText = `
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: rgba(160, 140, 200, 0.15);
      transition: background 0.3s ease;
    `
    this.el.appendChild(this.pulseEl)

    document.body.appendChild(this.el)

    // Start pulse loop
    setInterval(() => this.pulse(), PULSE_INTERVAL)

    // Track session duration every 10s
    setInterval(() => {
      const now = Date.now()
      const dt = now - this.state.lastUpdate
      if (dt > 0 && dt < 60000) {
        this.state.totalSessionMs += dt
        this.factor = computeFactor(this.state.totalSessionMs)
      }
      this.state.lastUpdate = now
    }, 10000)

    // Save periodically
    setInterval(() => this.saveState(), 30000)
  }

  private pulse() {
    // Pulse rate: faster when factor is high (house is alive)
    // Slower when factor is low (house is stasis)
    const rate = 0.5 + this.factor * 2.5 // 0.8-3.0 Hz
    this.pulsePhase += (rate * PULSE_INTERVAL / 1000) * Math.PI * 2

    const beat = Math.pow(Math.max(0, Math.sin(this.pulsePhase)), 4)
    const alpha = 0.06 + beat * 0.12
    this.pulseEl.style.background = `rgba(160, 140, 200, ${alpha})`
  }

  /** Record a content change event (whisper cycle, room transition, etc.) */
  recordChange() {
    this.state.contentChanges++
  }

  /**
   * Time factor: 1.0 (house is lively) → 0.3 (house is in stasis)
   * Other organisms multiply their cycle times by 1/factor to slow down.
   */
  getTimeFactor(): number {
    return this.factor
  }

  /** Current pulse rate in Hz */
  getPulseRate(): number {
    return 0.5 + this.factor * 2.5
  }

  /** How many sessions the visitor has had */
  getSessionCount(): number {
    return this.state.sessionCount
  }

  /** Total time spent in the house (ms) */
  getTotalTime(): number {
    return this.state.totalSessionMs
  }

  private loadState(): StasisState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) return JSON.parse(stored)
    } catch { /* fresh */ }
    return {
      totalSessionMs: 0,
      sessionCount: 0,
      contentChanges: 0,
      lastUpdate: Date.now(),
    }
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch { /* quota */ }
  }
}
