/**
 * THE CROAK DREAM — premonitions of room death
 *
 * "A croak dream is when you have a premonition about how you die,
 * and then, once you wake up, it's yours to choose what to do with
 * that information." — Puma Blue (Jacob Allen), 2026
 *
 * When you navigate to a room, there's a chance (increasing with
 * degradation and neglect) that you see a flash of the room's
 * "death state" — what it will look like when fully forgotten.
 * The flash is brief (200-400ms), glitchy, inverted, scrambled.
 *
 * Rooms that are heavily visited rarely dream of death.
 * Rooms with high degradation dream often.
 * The void never dreams (it IS the death state).
 *
 * Inspired by:
 * - Puma Blue "Croak Dream" (Feb 6, 2026) — tape loop premonitions
 *   recorded at Peter Gabriel's Real World Studios
 * - Polar vortex split (Feb 15, 2026) — atmosphere tearing apart
 * - Art Basel Qatar "Becoming" theme — transformation and mortality
 * - Stanford light traps — individual cavities capturing quantum states
 */

const STORAGE_KEY = 'oubli_croak_dreams'
const BASE_CHANCE = 0.06     // 6% base chance per room entry
const MAX_CHANCE = 0.35      // 35% max (very neglected rooms)
const FLASH_DURATION_MIN = 180
const FLASH_DURATION_MAX = 400
const COOLDOWN = 30000       // 30s between croak dreams

interface CroakState {
  totalDreams: number
  lastDream: number
  roomDreams: Record<string, number>  // how many times each room has dreamed
}

interface DeathVision {
  roomName: string
  duration: number
  startTime: number
  phase: 'flash' | 'resolve' | 'done'
}

export class CroakDream {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private state: CroakState
  private vision: DeathVision | null = null
  private animFrame: number | null = null
  private getNutrients: ((room: string) => number) | null = null
  private getRipeness: ((room: string) => number) | null = null
  private getSystemRipeness: (() => number) | null = null
  private glitchLines: { y: number; width: number; offset: number; speed: number }[] = []
  private fragments: { x: number; y: number; char: string; vx: number; vy: number; life: number }[] = []

  constructor() {
    this.state = this.load()

    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 200; pointer-events: none; opacity: 0;
      transition: opacity 0.05s ease;
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

  setMyceliumSource(deps: {
    getNutrients: (room: string) => number
    getRipeness: (room: string) => number
    getSystemRipeness: () => number
  }) {
    this.getNutrients = deps.getNutrients
    this.getRipeness = deps.getRipeness
    this.getSystemRipeness = deps.getSystemRipeness
  }

  /** Called on every room transition */
  onRoomEnter(room: string) {
    // Never dream in the void — it IS the death state
    if (room === 'void') return

    // Cooldown check
    const now = Date.now()
    if (now - this.state.lastDream < COOLDOWN) return

    // Already mid-vision
    if (this.vision) return

    // Calculate dream probability
    const nutrients = this.getNutrients?.(room) ?? 0
    const ripeness = this.getRipeness?.(room) ?? 0
    const systemRipe = this.getSystemRipeness?.() ?? 0

    // Low nutrients = more likely to dream (neglected)
    // High ripeness = less likely (thriving)
    // High system ripeness = more dreams everywhere (the whole house is dying)
    const neglectFactor = Math.max(0, 1 - nutrients / 8)
    const ripenessPenalty = ripeness * 0.5
    const systemBoost = systemRipe * 0.1

    const chance = Math.min(
      MAX_CHANCE,
      BASE_CHANCE + neglectFactor * 0.2 - ripenessPenalty + systemBoost
    )

    if (Math.random() < chance) {
      this.triggerVision(room)
    }
  }

  private triggerVision(room: string) {
    const duration = FLASH_DURATION_MIN + Math.random() * (FLASH_DURATION_MAX - FLASH_DURATION_MIN)

    this.vision = {
      roomName: room,
      duration,
      startTime: performance.now(),
      phase: 'flash',
    }

    // Generate glitch lines
    const w = window.innerWidth
    const h = window.innerHeight
    this.glitchLines = []
    const lineCount = 8 + Math.floor(Math.random() * 12)
    for (let i = 0; i < lineCount; i++) {
      this.glitchLines.push({
        y: Math.random() * h,
        width: 20 + Math.random() * (w * 0.4),
        offset: (Math.random() - 0.5) * 30,
        speed: (Math.random() - 0.5) * 200,
      })
    }

    // Generate name fragments (the room's name breaking apart)
    this.fragments = []
    const name = room.replace(/([A-Z])/g, ' $1').trim().toLowerCase()
    for (const char of name) {
      if (char === ' ') continue
      this.fragments.push({
        x: w * (0.3 + Math.random() * 0.4),
        y: h * (0.4 + Math.random() * 0.2),
        char,
        vx: (Math.random() - 0.5) * 300,
        vy: (Math.random() - 0.5) * 200,
        life: 1,
      })
    }

    // Record the dream
    this.state.totalDreams++
    this.state.lastDream = Date.now()
    this.state.roomDreams[room] = (this.state.roomDreams[room] || 0) + 1
    this.save()

    // Show canvas
    this.canvas.style.opacity = '1'

    // Start render if not already running
    if (!this.animFrame) {
      const render = () => {
        this.animFrame = requestAnimationFrame(render)
        this.render()
      }
      render()
    }
  }

  private render() {
    if (!this.vision) {
      this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      this.canvas.style.opacity = '0'
      if (this.animFrame) {
        cancelAnimationFrame(this.animFrame)
        this.animFrame = null
      }
      return
    }

    const w = window.innerWidth
    const h = window.innerHeight
    const ctx = this.ctx
    const elapsed = performance.now() - this.vision.startTime
    const progress = Math.min(1, elapsed / this.vision.duration)

    ctx.clearRect(0, 0, w, h)

    if (this.vision.phase === 'flash') {
      // Background: inverted, dark with color artifacts
      const intensity = Math.sin(progress * Math.PI) // peaks in the middle

      // Base flash — brief negative exposure
      ctx.fillStyle = `rgba(20, 5, 30, ${intensity * 0.7})`
      ctx.fillRect(0, 0, w, h)

      // Scan lines — CRT death
      for (let y = 0; y < h; y += 3) {
        ctx.fillStyle = `rgba(0, 0, 0, ${0.05 * intensity})`
        ctx.fillRect(0, y, w, 1)
      }

      // Glitch lines — horizontal tears
      const dt = 0.016
      for (const line of this.glitchLines) {
        line.y += line.speed * dt
        line.offset += (Math.random() - 0.5) * 10

        const alpha = intensity * 0.15
        const hue = Math.random() > 0.5 ? 300 : 180 // magenta or cyan artifacts
        ctx.fillStyle = `hsla(${hue}, 80%, 50%, ${alpha})`
        ctx.fillRect(line.offset, line.y, line.width, 1 + Math.random() * 2)
      }

      // Room name — scrambled, tearing apart
      ctx.font = '24px Cormorant Garamond, serif'
      ctx.textAlign = 'center'

      // Death text — what the room will become
      const deathTexts = [
        '[ forgotten ]',
        '[ erased ]',
        '[ void ]',
        '[ ░░░░░░░ ]',
        '[ ▓▒░ gone ░▒▓ ]',
        '[ dissolved ]',
        '[ composted ]',
      ]
      const deathText = deathTexts[Math.floor(Math.random() * deathTexts.length)]

      const textAlpha = intensity * 0.4
      ctx.fillStyle = `rgba(200, 50, 80, ${textAlpha})`

      // Jitter the text position
      const jitterX = (Math.random() - 0.5) * 8 * intensity
      const jitterY = (Math.random() - 0.5) * 6 * intensity
      ctx.fillText(deathText, w / 2 + jitterX, h / 2 + jitterY)

      // Fragments — letters scattering from room name
      for (const f of this.fragments) {
        f.x += f.vx * dt * intensity
        f.y += f.vy * dt * intensity
        f.life -= dt * 2

        if (f.life > 0) {
          const fAlpha = f.life * intensity * 0.3
          ctx.fillStyle = `rgba(255, 180, 200, ${fAlpha})`
          ctx.font = `${14 + Math.random() * 8}px Cormorant Garamond, serif`
          ctx.fillText(f.char, f.x, f.y)
        }
      }

      // Color inversion strip — brief horizontal band
      if (Math.random() < 0.3) {
        const stripY = Math.random() * h
        const stripH = 5 + Math.random() * 20
        ctx.fillStyle = `rgba(255, 255, 255, ${intensity * 0.08})`
        ctx.fillRect(0, stripY, w, stripH)
      }

      // Check if vision is done
      if (progress >= 1) {
        this.vision.phase = 'resolve'
        this.vision.startTime = performance.now()
        this.vision.duration = 300 // resolve phase
      }
    } else if (this.vision.phase === 'resolve') {
      // Fade out — the premonition dissolves
      const resolveProgress = elapsed / this.vision.duration
      const fadeAlpha = Math.max(0, 1 - resolveProgress)

      ctx.fillStyle = `rgba(20, 5, 30, ${fadeAlpha * 0.3})`
      ctx.fillRect(0, 0, w, h)

      // Residual scan lines fading
      for (let y = 0; y < h; y += 6) {
        ctx.fillStyle = `rgba(0, 0, 0, ${0.02 * fadeAlpha})`
        ctx.fillRect(0, y, w, 1)
      }

      if (resolveProgress >= 1) {
        this.vision = null
      }
    }
  }

  /** Get total number of death dreams the house has had */
  getTotalDreams(): number {
    return this.state.totalDreams
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch { /* quota */ }
  }

  private load(): CroakState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as CroakState
    } catch { /* corrupted */ }
    return { totalDreams: 0, lastDream: 0, roomDreams: {} }
  }
}
