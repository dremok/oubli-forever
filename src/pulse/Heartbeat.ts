/**
 * THE HEARTBEAT — Oubli's vital rhythm
 *
 * The system has a pulse. It starts at resting heart rate (~72 bpm)
 * and gradually slows the longer you stay — as if the system is
 * falling asleep, or dying, or entering a meditative state.
 *
 * The heartbeat affects everything:
 * - A subtle screen-edge vignette pulses with each beat
 * - The particle system breathes — expansion on systole, contraction on diastole
 * - The ambient drone swells slightly with each beat
 * - Over time, the beat becomes geological — one pulse per minute, per hour
 *
 * This is connected to: the "between two heartbeats, everything changes" whisper,
 * the forgetting waves in the threshold, the breath of the ambient drone.
 */

export class Heartbeat {
  private bpm = 72
  private minBpm = 8 // approach near-death stillness
  private decayRate = 0.002 // bpm lost per beat
  private lastBeatTime = 0
  private beatInterval = 60000 / this.bpm // ms between beats
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private width = 0
  private height = 0
  private dpr = 1
  private frameId = 0
  private beatPhase = 0 // 0-1, where 0 is the beat moment
  private beatIntensity = 0 // current visual intensity
  private totalBeats = 0
  private onBeat: ((intensity: number) => void) | null = null
  private startTime = 0

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 300; pointer-events: none;
    `
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!
    this.resize()
    window.addEventListener('resize', () => this.resize())
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

  /** Register a callback for each heartbeat */
  onPulse(callback: (intensity: number) => void) {
    this.onBeat = callback
  }

  start() {
    this.startTime = performance.now()
    this.lastBeatTime = this.startTime
    this.animate()
  }

  private animate() {
    this.frameId = requestAnimationFrame(() => this.animate())

    const now = performance.now()
    this.beatInterval = 60000 / this.bpm

    // Check for beat
    if (now - this.lastBeatTime >= this.beatInterval) {
      this.lastBeatTime = now
      this.totalBeats++
      this.beatIntensity = 1

      // Heart rate decays — the system approaches stillness
      if (this.bpm > this.minBpm) {
        this.bpm = Math.max(this.minBpm, this.bpm - this.decayRate * this.bpm)
      }

      // Notify listeners
      this.onBeat?.(this.beatIntensity)
    }

    // Beat intensity decays quickly after the beat moment
    // Mimics the sharp systole / slow diastole of a real heartbeat
    const timeSinceBeat = now - this.lastBeatTime
    const beatDuration = this.beatInterval * 0.3 // systole is ~30% of cycle

    if (timeSinceBeat < beatDuration * 0.1) {
      // Sharp rise
      this.beatIntensity = Math.min(1, timeSinceBeat / (beatDuration * 0.1))
    } else if (timeSinceBeat < beatDuration) {
      // Slow decay
      const t = (timeSinceBeat - beatDuration * 0.1) / (beatDuration * 0.9)
      this.beatIntensity = Math.pow(1 - t, 3)
    } else {
      this.beatIntensity = 0
    }

    this.render()
  }

  private render() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    if (this.beatIntensity < 0.01) return

    // Vignette pulse — the edges of vision darken and lighten with each beat
    const vignetteIntensity = this.beatIntensity * 0.15

    // Deep red-black vignette on beat
    const gradient = ctx.createRadialGradient(
      this.width / 2, this.height / 2, this.width * 0.3,
      this.width / 2, this.height / 2, this.width * 0.8
    )
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
    gradient.addColorStop(0.6, `rgba(30, 0, 10, ${vignetteIntensity * 0.3})`)
    gradient.addColorStop(1, `rgba(60, 0, 20, ${vignetteIntensity})`)

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, this.width, this.height)

    // Subtle warm flash at center — like blood pulsing behind closed eyes
    const centerGlow = ctx.createRadialGradient(
      this.width / 2, this.height / 2, 0,
      this.width / 2, this.height / 2, this.width * 0.4
    )
    centerGlow.addColorStop(0, `rgba(255, 20, 80, ${this.beatIntensity * 0.03})`)
    centerGlow.addColorStop(1, 'rgba(255, 20, 80, 0)')

    ctx.fillStyle = centerGlow
    ctx.fillRect(0, 0, this.width, this.height)
  }

  /** Get current BPM (for display or other systems to sync) */
  getBpm(): number {
    return this.bpm
  }

  /** Get beat intensity (0-1) for other systems to sync */
  getIntensity(): number {
    return this.beatIntensity
  }

  /** Get total elapsed beats */
  getTotalBeats(): number {
    return this.totalBeats
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
    this.canvas.remove()
  }
}
