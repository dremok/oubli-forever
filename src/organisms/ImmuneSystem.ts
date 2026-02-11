/**
 * THE IMMUNE SYSTEM — the house defends itself against excessive decay
 *
 * When parasites grow too strong, methylation erodes too far, or rooms
 * accumulate too much degradation, the house produces "antibodies" —
 * golden defensive particles that visually combat the decay.
 *
 * The immune system is NOT always active. It responds to threats:
 * - Parasite overload: too many parasites → golden particles swarm to edges
 * - Methylation crisis: too many rooms losing marks → stabilizing pulses
 * - Systemic decline: overall house health drops → whole-screen fever glow
 *
 * The immune response is visible: golden-white particles that move
 * purposefully toward threats. You can see the house fighting.
 * But immunity has a cost — it consumes nutrients from the mycelium.
 * A strong immune response can starve the house.
 *
 * Inspired by:
 * - T-cell activation: dormant until triggered, then explosive response
 * - Cytokine storms: when the immune response itself becomes the danger
 * - Fever: the body deliberately heats itself to fight infection
 * - Autoimmune conditions: when defense attacks self
 * - Lab-grown brain organoids forming thalamus-cortex connections (Nagoya 2026):
 *   defense requires communication between regions
 * - Global Plastic Treaty collapse (Geneva, Feb 2026): what happens when
 *   the protective system fails entirely
 */

const STORAGE_KEY = 'oubli_immune'
const CHECK_INTERVAL = 8000    // 8s between threat assessments
const ANTIBODY_LIFESPAN = 6000 // 6s per antibody particle
const MAX_ANTIBODIES = 40
const FEVER_DECAY = 0.002      // fever cools naturally
const FEVER_COST = 0.05        // nutrients consumed per fever tick
const NUTRIENT_DRAIN = 0.02    // nutrients consumed per active antibody

// Threat thresholds
const PARASITE_THREAT = 4      // 4+ parasites = immune response
const METHYLATION_CRISIS = 0.35 // avg methylation below this = crisis
const HEALTH_CRISIS = 0.3      // system health below this = fever

interface ImmuneState {
  totalResponses: number
  lastResponse: number
  feverLevel: number         // 0-1, how "hot" the house is running
  autoimmuneTicks: number    // how long the immune system has been overactive
}

interface Antibody {
  x: number
  y: number
  targetX: number
  targetY: number
  life: number
  maxLife: number
  type: 'swarm' | 'pulse' | 'fever'
  hue: number
  speed: number
}

interface ImmuneDeps {
  getParasiteCount: () => number
  getAvgMethylation: () => number
  getSystemRipeness: () => number
  getNutrients: (room: string) => number
  drainNutrients: (room: string, amount: number) => void
  getActiveRoom: () => string
  getSeason: () => string
}

export class ImmuneSystem {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private state: ImmuneState
  private antibodies: Antibody[] = []
  private checkTimer: number | null = null
  private animFrame: number | null = null
  private time = 0
  private deps: ImmuneDeps | null = null
  private threatLevel = 0      // 0-1 composite threat assessment
  private responseActive = false

  constructor() {
    this.state = this.load()

    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 57; pointer-events: none;
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

  setDeps(deps: ImmuneDeps) {
    this.deps = deps
  }

  start() {
    this.checkTimer = window.setInterval(() => this.assessThreats(), CHECK_INTERVAL)
    // Initial assessment after 20s (let other organisms initialize)
    setTimeout(() => this.assessThreats(), 20000)

    const render = () => {
      this.render()
      this.animFrame = window.setTimeout(render, 100)
    }
    render()
  }

  /** Get current fever level (for Narrator) */
  getFeverLevel(): number {
    return this.state.feverLevel
  }

  /** Get total immune responses (for Narrator) */
  getTotalResponses(): number {
    return this.state.totalResponses
  }

  /** Is the immune system currently actively responding? */
  isResponding(): boolean {
    return this.responseActive
  }

  private assessThreats() {
    if (!this.deps) return

    const parasiteCount = this.deps.getParasiteCount()
    const avgMethylation = this.deps.getAvgMethylation()
    const season = this.deps.getSeason()

    // Calculate composite threat level
    let threat = 0

    // Parasite threat (0-0.5)
    if (parasiteCount >= PARASITE_THREAT) {
      threat += Math.min(0.5, (parasiteCount - PARASITE_THREAT + 1) * 0.12)
    }

    // Methylation crisis (0-0.3)
    if (avgMethylation < METHYLATION_CRISIS) {
      threat += (METHYLATION_CRISIS - avgMethylation) * 0.8
    }

    // Season modulation — immune system stronger in growth/ripe, weaker in decay
    const seasonMod: Record<string, number> = {
      seed: 0.8, growth: 1.2, ripe: 1.0, fall: 0.7, decay: 0.5,
    }
    threat *= seasonMod[season] ?? 1

    this.threatLevel = Math.min(1, threat)

    // Trigger immune response if threat is high enough
    if (this.threatLevel > 0.15 && this.antibodies.length < MAX_ANTIBODIES) {
      this.triggerResponse()
    }

    // Fever management
    if (this.threatLevel > 0.4) {
      // Fever rises
      this.state.feverLevel = Math.min(1, this.state.feverLevel + 0.03 * this.threatLevel)
    } else {
      // Fever cools
      this.state.feverLevel = Math.max(0, this.state.feverLevel - FEVER_DECAY)
    }

    // Autoimmune tracking — if immune system runs too long, it damages the house
    if (this.responseActive) {
      this.state.autoimmuneTicks++
    } else {
      this.state.autoimmuneTicks = Math.max(0, this.state.autoimmuneTicks - 1)
    }

    // Nutrient cost of immune response
    if (this.state.feverLevel > 0.1 && this.deps) {
      const room = this.deps.getActiveRoom()
      const cost = FEVER_COST * this.state.feverLevel
      this.deps.drainNutrients(room, cost)
    }

    this.responseActive = this.threatLevel > 0.15

    if (Math.random() < 0.15) this.save()
  }

  private triggerResponse() {
    if (!this.deps) return

    const w = window.innerWidth
    const h = window.innerHeight
    const count = Math.floor(2 + this.threatLevel * 5)

    for (let i = 0; i < count; i++) {
      if (this.antibodies.length >= MAX_ANTIBODIES) break

      // Antibodies spawn from center and move toward edges (where parasites live)
      const type = this.threatLevel > 0.5 ? 'fever' :
                   this.threatLevel > 0.3 ? 'pulse' : 'swarm'

      const angle = Math.random() * Math.PI * 2
      const dist = 30 + Math.random() * 80

      // Target: edges for parasites, scattered for methylation
      let targetX: number, targetY: number
      if (Math.random() < 0.6) {
        // Edge target (fighting parasites)
        const edge = Math.floor(Math.random() * 4)
        switch (edge) {
          case 0: targetX = Math.random() * w; targetY = 0; break
          case 1: targetX = Math.random() * w; targetY = h; break
          case 2: targetX = 0; targetY = Math.random() * h; break
          default: targetX = w; targetY = Math.random() * h; break
        }
      } else {
        // Scattered (stabilizing methylation)
        targetX = Math.random() * w
        targetY = Math.random() * h
      }

      const life = ANTIBODY_LIFESPAN * (0.7 + Math.random() * 0.6)

      this.antibodies.push({
        x: w / 2 + Math.cos(angle) * dist,
        y: h / 2 + Math.sin(angle) * dist,
        targetX,
        targetY,
        life,
        maxLife: life,
        type,
        hue: 42 + Math.random() * 20, // golden range
        speed: 40 + Math.random() * 60,
      })
    }

    this.state.totalResponses++
    this.state.lastResponse = Date.now()
  }

  private render() {
    const w = window.innerWidth
    const h = window.innerHeight
    const ctx = this.ctx
    const dt = 0.016

    ctx.clearRect(0, 0, w, h)
    this.time += dt

    // Render fever glow if active
    if (this.state.feverLevel > 0.05) {
      this.renderFever(ctx, w, h)
    }

    // Render antibodies
    if (this.antibodies.length === 0) return

    for (let i = this.antibodies.length - 1; i >= 0; i--) {
      const ab = this.antibodies[i]
      ab.life -= dt * 1000

      if (ab.life <= 0) {
        this.antibodies.splice(i, 1)
        continue
      }

      // Move toward target
      const dx = ab.targetX - ab.x
      const dy = ab.targetY - ab.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > 2) {
        const moveSpeed = ab.speed * dt
        ab.x += (dx / dist) * moveSpeed
        ab.y += (dy / dist) * moveSpeed
        // Add organic wobble
        ab.x += Math.sin(this.time * 3 + i * 1.7) * 0.8
        ab.y += Math.cos(this.time * 2.5 + i * 2.3) * 0.6
      }

      const lifeRatio = ab.life / ab.maxLife
      const alpha = lifeRatio * 0.15 * (0.6 + 0.4 * Math.sin(this.time * 4 + i))

      // Different rendering per type
      switch (ab.type) {
        case 'swarm':
          this.renderSwarmAntibody(ctx, ab, alpha)
          break
        case 'pulse':
          this.renderPulseAntibody(ctx, ab, alpha)
          break
        case 'fever':
          this.renderFeverAntibody(ctx, ab, alpha)
          break
      }
    }
  }

  private renderSwarmAntibody(ctx: CanvasRenderingContext2D, ab: Antibody, alpha: number) {
    // Small golden dot with tail
    const tailLen = 8
    const angle = Math.atan2(ab.targetY - ab.y, ab.targetX - ab.x)

    ctx.globalAlpha = alpha
    ctx.fillStyle = `hsl(${ab.hue}, 70%, 65%)`
    ctx.beginPath()
    ctx.arc(ab.x, ab.y, 2.5, 0, Math.PI * 2)
    ctx.fill()

    // Tail
    ctx.strokeStyle = `hsl(${ab.hue}, 60%, 55%)`
    ctx.lineWidth = 1
    ctx.globalAlpha = alpha * 0.5
    ctx.beginPath()
    ctx.moveTo(ab.x, ab.y)
    ctx.lineTo(
      ab.x - Math.cos(angle) * tailLen,
      ab.y - Math.sin(angle) * tailLen,
    )
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  private renderPulseAntibody(ctx: CanvasRenderingContext2D, ab: Antibody, alpha: number) {
    // Expanding ring
    const pulseSize = 4 + Math.sin(this.time * 5) * 2

    ctx.globalAlpha = alpha * 0.8
    ctx.strokeStyle = `hsl(${ab.hue}, 80%, 70%)`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(ab.x, ab.y, pulseSize, 0, Math.PI * 2)
    ctx.stroke()

    // Inner dot
    ctx.globalAlpha = alpha
    ctx.fillStyle = `hsl(${ab.hue}, 90%, 80%)`
    ctx.beginPath()
    ctx.arc(ab.x, ab.y, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  private renderFeverAntibody(ctx: CanvasRenderingContext2D, ab: Antibody, alpha: number) {
    // Intense bright particle with glow
    const glow = 6 + Math.sin(this.time * 6 + ab.x * 0.01) * 3

    const grad = ctx.createRadialGradient(ab.x, ab.y, 0, ab.x, ab.y, glow)
    grad.addColorStop(0, `hsla(${ab.hue}, 100%, 85%, ${alpha * 1.2})`)
    grad.addColorStop(0.5, `hsla(${ab.hue + 10}, 80%, 60%, ${alpha * 0.4})`)
    grad.addColorStop(1, `hsla(${ab.hue + 20}, 60%, 40%, 0)`)

    ctx.fillStyle = grad
    ctx.fillRect(ab.x - glow, ab.y - glow, glow * 2, glow * 2)
  }

  private renderFever(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // Fever = warm edge glow, like the house is running hot
    const fever = this.state.feverLevel
    const breathe = 0.7 + 0.3 * Math.sin(this.time * 1.5)
    const alpha = fever * 0.04 * breathe

    // Warm vignette from edges
    const edgeSize = 80 + fever * 120

    // Top
    const topGrad = ctx.createLinearGradient(0, 0, 0, edgeSize)
    topGrad.addColorStop(0, `rgba(200, 120, 40, ${alpha})`)
    topGrad.addColorStop(1, 'rgba(200, 120, 40, 0)')
    ctx.fillStyle = topGrad
    ctx.fillRect(0, 0, w, edgeSize)

    // Bottom
    const botGrad = ctx.createLinearGradient(0, h, 0, h - edgeSize)
    botGrad.addColorStop(0, `rgba(200, 120, 40, ${alpha * 0.7})`)
    botGrad.addColorStop(1, 'rgba(200, 120, 40, 0)')
    ctx.fillStyle = botGrad
    ctx.fillRect(0, h - edgeSize, w, edgeSize)

    // Left
    const leftGrad = ctx.createLinearGradient(0, 0, edgeSize, 0)
    leftGrad.addColorStop(0, `rgba(200, 120, 40, ${alpha * 0.5})`)
    leftGrad.addColorStop(1, 'rgba(200, 120, 40, 0)')
    ctx.fillStyle = leftGrad
    ctx.fillRect(0, 0, edgeSize, h)

    // Right
    const rightGrad = ctx.createLinearGradient(w, 0, w - edgeSize, 0)
    rightGrad.addColorStop(0, `rgba(200, 120, 40, ${alpha * 0.5})`)
    rightGrad.addColorStop(1, 'rgba(200, 120, 40, 0)')
    ctx.fillStyle = rightGrad
    ctx.fillRect(w - edgeSize, 0, edgeSize, h)

    // Autoimmune warning — if immune has been active too long, it flickers red
    if (this.state.autoimmuneTicks > 50) {
      const autoAlpha = Math.min(0.03, (this.state.autoimmuneTicks - 50) * 0.0005)
      const flicker = Math.sin(this.time * 8) > 0.3 ? autoAlpha : 0
      ctx.fillStyle = `rgba(180, 30, 30, ${flicker})`
      ctx.fillRect(0, 0, w, h)
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch { /* quota */ }
  }

  private load(): ImmuneState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as ImmuneState
    } catch { /* corrupted */ }
    return {
      totalResponses: 0,
      lastResponse: 0,
      feverLevel: 0,
      autoimmuneTicks: 0,
    }
  }
}
