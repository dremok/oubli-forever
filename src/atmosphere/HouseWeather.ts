/**
 * HOUSE WEATHER — ambient cross-room influence system
 *
 * The house is alive. What happens in one room bleeds into others.
 * This system tracks events across rooms and applies subtle visual
 * effects when you're in adjacent rooms.
 *
 * Effects:
 * - Burn memories in the furnace → faint smoke particles drift into
 *   adjacent rooms for the next few minutes
 * - Many memories degraded → fog thickens across all rooms
 * - Time of day affects light quality in all rooms
 * - Recent activity in a room leaves "warmth" — a barely perceptible
 *   glow that fades over ~10 minutes
 *
 * This is rendered as a thin overlay on top of room content.
 * Purely atmospheric — no interaction, no UI, just ambience.
 */

interface WeatherState {
  smoke: number       // 0-1, from furnace burns
  fog: number         // 0-1, from overall degradation
  warmth: Map<string, number> // room name → warmth level (time-based)
}

export class HouseWeather {
  private state: WeatherState = {
    smoke: 0,
    fog: 0,
    warmth: new Map(),
  }
  private overlay: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private frameId = 0
  private time = 0
  private currentRoom = 'void'
  private getAverageDegradation: (() => number) | null = null

  init() {
    this.overlay = document.createElement('canvas')
    this.overlay.width = window.innerWidth
    this.overlay.height = window.innerHeight
    this.overlay.style.cssText = `
      position: fixed; top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 50;
      mix-blend-mode: screen;
    `
    document.body.appendChild(this.overlay)
    this.ctx = this.overlay.getContext('2d')

    window.addEventListener('resize', () => {
      if (this.overlay) {
        this.overlay.width = window.innerWidth
        this.overlay.height = window.innerHeight
      }
    })

    this.render()
  }

  setDegradationSource(fn: () => number) {
    this.getAverageDegradation = fn
  }

  setRoom(room: string) {
    // Leave warmth in the room you're leaving
    this.state.warmth.set(this.currentRoom, 1)
    this.currentRoom = room
  }

  /** Called when a memory is burned in the furnace */
  onBurn() {
    this.state.smoke = Math.min(1, this.state.smoke + 0.3)
  }

  private render() {
    this.frameId = requestAnimationFrame(() => this.render())
    this.time += 0.016

    if (!this.overlay || !this.ctx) return
    const w = this.overlay.width
    const h = this.overlay.height
    const ctx = this.ctx

    ctx.clearRect(0, 0, w, h)

    // Decay warmth
    for (const [room, warmth] of this.state.warmth) {
      this.state.warmth.set(room, warmth * 0.9995)
      if (warmth < 0.01) this.state.warmth.delete(room)
    }

    // Decay smoke
    this.state.smoke *= 0.999

    // Update fog from degradation
    if (this.getAverageDegradation) {
      const targetFog = this.getAverageDegradation() * 0.5
      this.state.fog += (targetFog - this.state.fog) * 0.01
    }

    // --- RENDER EFFECTS ---

    // Smoke particles (from furnace burns)
    if (this.state.smoke > 0.02) {
      for (let i = 0; i < Math.ceil(this.state.smoke * 5); i++) {
        const x = Math.random() * w
        const y = Math.random() * h * 0.4
        const size = 30 + Math.random() * 60
        ctx.beginPath()
        ctx.arc(x, y, size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(100, 80, 60, ${this.state.smoke * 0.008})`
        ctx.fill()
      }
    }

    // Fog overlay (from degradation)
    if (this.state.fog > 0.02) {
      const fogAlpha = this.state.fog * 0.03
      ctx.fillStyle = `rgba(80, 80, 90, ${fogAlpha})`
      ctx.fillRect(0, 0, w, h)

      // Drifting fog patches
      for (let i = 0; i < 3; i++) {
        const fx = w * 0.5 + Math.sin(this.time * 0.05 + i * 2) * w * 0.4
        const fy = h * 0.5 + Math.cos(this.time * 0.03 + i * 1.5) * h * 0.3
        const fogGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, 200)
        fogGrad.addColorStop(0, `rgba(60, 60, 70, ${this.state.fog * 0.02})`)
        fogGrad.addColorStop(1, 'rgba(60, 60, 70, 0)')
        ctx.fillStyle = fogGrad
        ctx.fillRect(0, 0, w, h)
      }
    }

    // Residual warmth from recently visited rooms
    const prevWarmth = this.state.warmth.get(this.currentRoom) || 0
    if (prevWarmth > 0.1) {
      // Warm glow — you were here recently
      const warmGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h * 0.6)
      warmGrad.addColorStop(0, `rgba(255, 200, 100, ${prevWarmth * 0.005})`)
      warmGrad.addColorStop(1, 'rgba(255, 200, 100, 0)')
      ctx.fillStyle = warmGrad
      ctx.fillRect(0, 0, w, h)
    }
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
    this.overlay?.remove()
  }
}
