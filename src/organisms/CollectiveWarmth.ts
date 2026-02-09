/**
 * COLLECTIVE WARMTH — the presence of others in the house
 *
 * You can't see them. You can't hear them. But you can feel them.
 *
 * A subtle ambient effect that changes based on how many other
 * visitors are currently in the house, and what rooms they're in.
 * The more visitors, the warmer the house feels — a faint golden
 * tinge at the edges, a slightly faster pulse, a barely perceptible
 * sense that you are not alone.
 *
 * If someone is in the SAME room as you (or was very recently),
 * the warmth intensifies — you're standing where another stood.
 *
 * Polls the collective pulse every 15 seconds. Changes are
 * extremely gradual — you shouldn't notice the transition,
 * only the state.
 *
 * Inspired by:
 * - The feeling of entering a room someone just left
 * - Residual body heat in a chair
 * - The way a house "feels" occupied vs. empty
 * - Felix Gonzalez-Torres's "Untitled" (Portrait of Ross in L.A.)
 *   — candy pile that visitors take from, changing the work
 */

export class CollectiveWarmth {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private animFrame: number | null = null
  private pollInterval: number | null = null
  private warmth = 0          // 0-1, current warmth level
  private targetWarmth = 0    // what we're interpolating toward
  private sameRoom = false    // someone else is/was in this room
  private sameRoomFade = 0    // 0-1, fading presence indicator
  private activeRoom = 'void'
  private time = 0

  constructor() {
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

  start() {
    // Poll collective pulse every 15s
    this.pollInterval = window.setInterval(() => this.poll(), 15000)
    // Initial poll after 5s (let things settle)
    setTimeout(() => this.poll(), 5000)

    const render = () => {
      this.animFrame = requestAnimationFrame(render)
      this.render()
    }
    render()
  }

  onRoomEnter(room: string) {
    this.activeRoom = room
  }

  private async poll() {
    try {
      const res = await fetch('/api/pulse')
      if (!res.ok) return
      const data = await res.json()

      // Calculate warmth from visitor activity
      const { totalVisits, activeRooms, seedCount } = data
      const activeCount = Object.keys(activeRooms || {}).length

      // Warmth scales with active rooms (other visitors exploring)
      // 0 active = 0, 1-2 active = subtle, 3+ = warm
      this.targetWarmth = Math.min(1, activeCount * 0.15 + (seedCount || 0) * 0.002)

      // Check if someone is in the same room
      const roomActivity = activeRooms?.[this.activeRoom]
      if (roomActivity) {
        const age = Date.now() - roomActivity
        // Active in last 2 minutes = same room
        this.sameRoom = age < 120000
      } else {
        this.sameRoom = false
      }
    } catch {
      // Server unavailable — no warmth data. That's ok.
      this.targetWarmth = 0
    }
  }

  private render() {
    const w = window.innerWidth
    const h = window.innerHeight
    const ctx = this.ctx
    const dt = 0.016

    ctx.clearRect(0, 0, w, h)
    this.time += dt

    // Smoothly interpolate warmth
    this.warmth += (this.targetWarmth - this.warmth) * dt * 0.3

    // Same-room fade
    if (this.sameRoom) {
      this.sameRoomFade = Math.min(1, this.sameRoomFade + dt * 0.5)
    } else {
      this.sameRoomFade = Math.max(0, this.sameRoomFade - dt * 0.2)
    }

    if (this.warmth < 0.005 && this.sameRoomFade < 0.005) return

    // Warmth glow — golden radiance from edges
    if (this.warmth > 0.01) {
      const alpha = this.warmth * 0.025
      const pulse = Math.sin(this.time * 0.5) * 0.3 + 0.7

      const grad = ctx.createRadialGradient(
        w / 2, h / 2, Math.min(w, h) * 0.2,
        w / 2, h / 2, Math.min(w, h) * 0.8
      )
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)')
      grad.addColorStop(0.6, 'rgba(0, 0, 0, 0)')
      grad.addColorStop(1, `rgba(200, 150, 50, ${alpha * pulse})`)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)
    }

    // Same-room presence — a barely-visible warm spot at center
    if (this.sameRoomFade > 0.01) {
      const alpha = this.sameRoomFade * 0.03
      const breathe = Math.sin(this.time * 0.8) * 0.5 + 0.5

      const grad = ctx.createRadialGradient(
        w / 2, h / 2, 0,
        w / 2, h / 2, Math.min(w, h) * 0.3
      )
      grad.addColorStop(0, `rgba(255, 200, 80, ${alpha * breathe})`)
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)
    }
  }
}
