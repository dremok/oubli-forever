/**
 * THE MYCELIUM — a living network organism between rooms
 *
 * Inspired by mycorrhizal networks that connect 90% of land plants,
 * ethylene ripening cascades in fruit, and Physarum polycephalum's
 * trail-based intelligence. Also: the oubli fruit itself — sweet,
 * golden, growing in forgetting's name.
 *
 * This is NOT a room. It's the circulatory system of the house.
 * It lives between rooms, connecting them into a body.
 *
 * Mechanics:
 * - NUTRIENT FLOW: Time in a room generates nutrients that propagate
 *   through graph connections to neighbors, decaying with distance.
 * - TRAIL REINFORCEMENT: Paths you travel strengthen (Physarum).
 *   Paths you ignore weaken. The house optimizes for your behavior.
 * - RIPENING CASCADE: Rooms accumulate activity. When enough nutrients
 *   gather, the room "ripens" — like an oubli fruit turning golden.
 *   Ripe rooms emit ethylene-like signals that trigger neighbors to
 *   begin ripening. The cascade is irreversible.
 * - VISUAL TENDRILS: Subtle golden-green filaments at screen edges,
 *   pulsing with nutrient flow. The mycelium is always visible,
 *   barely — reminding you the house is alive.
 *
 * Cultural grounding: Mycorrhizal "wood wide web" research (Simard 2024),
 * lab-grown brain organoids forming thalamus-cortex connections (Nagoya 2026),
 * Hosnedlova's living fungal art at White Cube (2026).
 */

import { getConnections, ROOM_GRAPH, growConnection } from '../navigation/RoomGraph'

// --- State types ---

interface MyceliumState {
  nutrients: Record<string, number>   // nutrient level per room (0+)
  ripeness: Record<string, number>    // ripeness per room (0-1, monotonic)
  trails: Record<string, number>      // trail strength per connection key ("a->b")
  lastVisit: Record<string, number>   // timestamp of last visit per room
  composted: string[]                 // IDs of memories fully composted
}

interface CompostableMemory {
  id: string
  degradation: number
  currentText: string
}

// --- Constants ---

const TICK_MS = 600                     // propagation tick
const NUTRIENT_PER_SECOND = 0.12        // nutrients generated per second in active room
const PROPAGATION_DECAY = 0.25          // nutrients lose 75% per hop
const TRAIL_STRENGTHEN = 0.15           // trail boost on navigation
const TRAIL_DECAY_RATE = 0.997          // trail decay per tick (~0.3% per 600ms)
const RIPENESS_THRESHOLD = 8            // cumulative nutrients to begin ripening
const RIPENESS_GAIN = 0.003             // ripeness increase per tick when above threshold
const ETHYLENE_BURST = 2.0              // nutrient burst on ripeness milestone
const TENDRIL_COUNT = 12                // max tendrils rendered per frame
const COMPOST_THRESHOLD = 0.75          // degradation level to start composting
const COMPOST_NUTRIENT_YIELD = 3.0      // nutrients released per composted memory
const COMPOST_CHECK_INTERVAL = 50       // ticks between compost checks (~30s)
const STORAGE_KEY = 'oubli_mycelium'

// --- Ripeness milestones (emit ethylene at these levels) ---
const MILESTONES = [0.25, 0.5, 0.75, 1.0]

// --- The Mycelium ---

export class Mycelium {
  private state: MyceliumState
  private activeRoom: string = 'void'
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private tickInterval: number | null = null
  private animFrame: number | null = null
  private lastTime = 0
  private spores: Spore[] = []
  private tendrils: Tendril[] = []
  private milestoneHit = new Set<string>() // "room:milestone" keys already triggered
  private pulsePhase = 0
  private getMemories: (() => CompostableMemory[]) | null = null
  private compostTicker = 0
  private compostParticles: CompostParticle[] = []

  constructor() {
    // Load persisted state
    this.state = this.load()

    // Create visual layer — very low z-index, under rooms, above void
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 55; pointer-events: none;
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

  // --- Lifecycle ---

  start() {
    // Initialize all rooms to 0 nutrients/ripeness if missing
    for (const node of ROOM_GRAPH) {
      if (this.state.nutrients[node.name] === undefined) {
        this.state.nutrients[node.name] = 0
      }
      if (this.state.ripeness[node.name] === undefined) {
        this.state.ripeness[node.name] = 0
      }
    }

    // Rebuild milestone set from persisted ripeness
    for (const [room, ripe] of Object.entries(this.state.ripeness)) {
      for (const m of MILESTONES) {
        if (ripe >= m) this.milestoneHit.add(`${room}:${m}`)
      }
    }

    // Generate initial tendrils
    this.regenerateTendrils()

    // Start propagation tick
    this.lastTime = performance.now()
    this.tickInterval = window.setInterval(() => this.tick(), TICK_MS)

    // Start render loop
    const render = () => {
      this.animFrame = requestAnimationFrame(render)
      this.render()
    }
    render()
  }

  // --- Events from RoomManager ---

  onRoomEnter(room: string) {
    const prev = this.activeRoom
    this.activeRoom = room

    // Strengthen trail for this navigation
    if (prev !== room) {
      const key = this.trailKey(prev, room)
      this.state.trails[key] = Math.min(1, (this.state.trails[key] || 0) + TRAIL_STRENGTHEN)
    }

    // Record visit
    this.state.lastVisit[room] = Date.now()

    // Regenerate tendrils for new room's connections
    this.regenerateTendrils()

    this.save()
  }

  /** Connect the mycelium to the memory system for composting */
  setMemorySource(fn: () => CompostableMemory[]) {
    this.getMemories = fn
  }

  // --- Core propagation tick ---

  private tick() {
    const now = performance.now()
    const dt = (now - this.lastTime) / 1000
    this.lastTime = now

    // 1. Generate nutrients in active room
    this.state.nutrients[this.activeRoom] =
      (this.state.nutrients[this.activeRoom] || 0) + NUTRIENT_PER_SECOND * dt

    // 2. Propagate nutrients through graph
    const deltas: Record<string, number> = {}
    for (const node of ROOM_GRAPH) {
      const nut = this.state.nutrients[node.name] || 0
      if (nut < 0.01) continue

      const connections = getConnections(node.name)
      const outflow = nut * PROPAGATION_DECAY * dt * 0.5
      if (outflow < 0.001) continue

      const perConnection = outflow / Math.max(1, connections.length)
      for (const conn of connections) {
        // Scale by trail strength — stronger trails carry more
        const trailStr = this.state.trails[this.trailKey(node.name, conn)] || 0.1
        const flow = perConnection * (0.3 + trailStr * 0.7)
        deltas[conn] = (deltas[conn] || 0) + flow
      }
      deltas[node.name] = (deltas[node.name] || 0) - outflow
    }

    // Apply deltas
    for (const [room, delta] of Object.entries(deltas)) {
      this.state.nutrients[room] = Math.max(0, (this.state.nutrients[room] || 0) + delta)
    }

    // 3. Decay trails (Physarum-style)
    for (const key of Object.keys(this.state.trails)) {
      this.state.trails[key] *= TRAIL_DECAY_RATE
      if (this.state.trails[key] < 0.01) delete this.state.trails[key]
    }

    // 4. Ripening cascade
    for (const node of ROOM_GRAPH) {
      const nut = this.state.nutrients[node.name] || 0
      const ripe = this.state.ripeness[node.name] || 0

      if (nut > RIPENESS_THRESHOLD && ripe < 1) {
        // Room is ripening
        const gain = RIPENESS_GAIN * dt * (1 + nut * 0.02)
        this.state.ripeness[node.name] = Math.min(1, ripe + gain)

        // Check milestones
        for (const m of MILESTONES) {
          const key = `${node.name}:${m}`
          if (this.state.ripeness[node.name] >= m && !this.milestoneHit.has(key)) {
            this.milestoneHit.add(key)
            this.emitEthylene(node.name, m)
          }
        }
      }
    }

    // 5. Memory composting — degraded memories become nutrients
    this.compostTicker++
    if (this.compostTicker >= COMPOST_CHECK_INTERVAL) {
      this.compostTicker = 0
      this.compostMemories()
    }

    // 5b. Update compost particles
    this.updateCompostParticles(dt)

    // 6. Neural pathway growth — the graph topology evolves
    // If two rooms share strong trails through an intermediate,
    // the mycelium grows a direct connection (a new neural pathway).
    // Checked rarely (~every 30 ticks) to avoid performance cost.
    if (Math.random() < 0.03) this.checkNeuralGrowth()

    // 7. Update spores
    this.updateSpores(dt)

    // 8. Pulse phase
    this.pulsePhase += dt * 0.8

    // 9. Periodic save (every ~10 ticks)
    if (Math.random() < 0.1) this.save()
  }

  // --- Ethylene burst: ripening cascade trigger ---

  private emitEthylene(room: string, milestone: number) {
    const connections = getConnections(room)
    for (const conn of connections) {
      // Nutrient burst to neighbors — the cascade
      this.state.nutrients[conn] = (this.state.nutrients[conn] || 0) + ETHYLENE_BURST * milestone
    }

    // Spawn visual spores
    const count = Math.floor(3 + milestone * 5)
    for (let i = 0; i < count; i++) {
      this.spores.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 30,
        vy: -20 - Math.random() * 40, // float upward
        life: 1,
        decay: 0.15 + Math.random() * 0.1,
        size: 2 + Math.random() * 3,
        hue: 45 + Math.random() * 20, // golden
      })
    }
  }

  // --- Neural pathway growth ---

  private checkNeuralGrowth() {
    // For each pair of non-adjacent rooms, check if there's a strong
    // 2-hop trail path through an intermediate. If both legs are strong,
    // grow a direct connection — a new neural pathway.
    const GROWTH_THRESHOLD = 0.4 // both trail legs must be >= this

    // Only check rooms near the active room (performance)
    const neighbors = getConnections(this.activeRoom)
    for (const mid of neighbors) {
      const midNeighbors = getConnections(mid)
      for (const far of midNeighbors) {
        if (far === this.activeRoom) continue
        // Check if active<->far already connected
        const activeConns = getConnections(this.activeRoom)
        if (activeConns.includes(far)) continue

        // Check trail strengths for both legs
        const leg1 = this.state.trails[this.trailKey(this.activeRoom, mid)] || 0
        const leg2 = this.state.trails[this.trailKey(mid, far)] || 0

        if (leg1 >= GROWTH_THRESHOLD && leg2 >= GROWTH_THRESHOLD) {
          // Both legs are strong — grow the connection
          growConnection(this.activeRoom, far)

          // Spawn golden spores to celebrate new growth
          const w = window.innerWidth
          const h = window.innerHeight
          for (let i = 0; i < 8; i++) {
            this.spores.push({
              x: w / 2 + (Math.random() - 0.5) * w * 0.6,
              y: h / 2 + (Math.random() - 0.5) * h * 0.4,
              vx: (Math.random() - 0.5) * 40,
              vy: (Math.random() - 0.5) * 30,
              life: 1,
              decay: 0.08,
              size: 3 + Math.random() * 3,
              hue: 55 + Math.random() * 15, // bright gold
            })
          }

          // Regenerate tendrils to show new connection
          this.regenerateTendrils()
          return // one growth per check
        }
      }
    }
  }

  // --- Memory composting ---

  private compostMemories() {
    if (!this.getMemories) return

    const memories = this.getMemories()
    const composted = new Set(this.state.composted || [])

    for (const mem of memories) {
      if (composted.has(mem.id)) continue
      if (mem.degradation < COMPOST_THRESHOLD) continue

      // This memory is degraded enough to compost
      // Yield scales with degradation — more degraded = more nutrients
      const yield_ = COMPOST_NUTRIENT_YIELD * mem.degradation

      // Feed nutrients to the active room
      this.state.nutrients[this.activeRoom] =
        (this.state.nutrients[this.activeRoom] || 0) + yield_

      // Also spread some to neighbors (decomposition diffuses)
      const neighbors = getConnections(this.activeRoom)
      const neighborShare = yield_ * 0.3 / Math.max(1, neighbors.length)
      for (const n of neighbors) {
        this.state.nutrients[n] = (this.state.nutrients[n] || 0) + neighborShare
      }

      // Mark as composted
      composted.add(mem.id)

      // Visual: spawn decomposition particles (earth tones, sinking)
      const w = window.innerWidth
      const h = window.innerHeight
      const charCount = Math.min(mem.currentText.length, 12)
      for (let i = 0; i < charCount; i++) {
        this.compostParticles.push({
          x: w * (0.2 + Math.random() * 0.6),
          y: h * (0.3 + Math.random() * 0.4),
          vy: 8 + Math.random() * 15, // sink downward
          vx: (Math.random() - 0.5) * 8,
          char: mem.currentText[Math.floor(Math.random() * mem.currentText.length)] || '.',
          life: 1,
          decay: 0.04 + Math.random() * 0.03,
          hue: 30 + Math.random() * 30, // amber to brown
        })
      }

      // Only compost one memory per check cycle (gradual)
      break
    }

    this.state.composted = [...composted]
    this.save()
  }

  private updateCompostParticles(dt: number) {
    for (let i = this.compostParticles.length - 1; i >= 0; i--) {
      const p = this.compostParticles[i]
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy *= 0.97
      p.vx += (Math.random() - 0.5) * 3 * dt
      p.life -= p.decay * dt
      if (p.life <= 0) this.compostParticles.splice(i, 1)
    }
  }

  private updateSpores(dt: number) {
    for (let i = this.spores.length - 1; i >= 0; i--) {
      const s = this.spores[i]
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.vy *= 0.98 // air resistance
      s.vx += (Math.random() - 0.5) * 10 * dt // brownian drift
      s.life -= s.decay * dt
      if (s.life <= 0) this.spores.splice(i, 1)
    }
  }

  // --- Tendril generation ---

  private regenerateTendrils() {
    this.tendrils = []
    const connections = getConnections(this.activeRoom)

    for (let i = 0; i < Math.min(connections.length, TENDRIL_COUNT); i++) {
      const conn = connections[i]
      const trailStr = this.state.trails[this.trailKey(this.activeRoom, conn)] || 0.05
      const neighborRipeness = this.state.ripeness[conn] || 0

      // Assign an edge position — distribute around screen perimeter
      const angle = (i / connections.length) * Math.PI * 2 - Math.PI / 2
      const w = window.innerWidth
      const h = window.innerHeight

      // Start from screen edge
      const edgeX = w / 2 + Math.cos(angle) * (w * 0.6)
      const edgeY = h / 2 + Math.sin(angle) * (h * 0.6)

      // Generate tendril segments (branching filament)
      const segments: { x: number; y: number }[] = []
      let cx = edgeX, cy = edgeY
      const segCount = 8 + Math.floor(trailStr * 12)
      const inwardX = (w / 2 - edgeX) / segCount
      const inwardY = (h / 2 - edgeY) / segCount

      for (let s = 0; s < segCount; s++) {
        segments.push({ x: cx, y: cy })
        cx += inwardX * (0.6 + Math.random() * 0.8)
        cy += inwardY * (0.6 + Math.random() * 0.8)
        // Organic wander
        cx += (Math.random() - 0.5) * 20
        cy += (Math.random() - 0.5) * 15
      }

      this.tendrils.push({
        segments,
        connection: conn,
        trailStrength: trailStr,
        ripeness: neighborRipeness,
        phaseOffset: Math.random() * Math.PI * 2,
      })
    }
  }

  // --- Render ---

  private render() {
    const w = window.innerWidth
    const h = window.innerHeight
    const ctx = this.ctx

    ctx.clearRect(0, 0, w, h)

    const activeRipeness = this.state.ripeness[this.activeRoom] || 0
    const activeNutrients = this.state.nutrients[this.activeRoom] || 0

    // 1. Render tendrils
    for (const tendril of this.tendrils) {
      const pulse = Math.sin(this.pulsePhase * 2 + tendril.phaseOffset) * 0.5 + 0.5
      const baseAlpha = 0.015 + tendril.trailStrength * 0.04 + tendril.ripeness * 0.02
      const alpha = baseAlpha + pulse * 0.01

      // Color: green-gold, shifting golden as ripeness increases
      const hue = 120 - tendril.ripeness * 75 // 120 (green) -> 45 (gold)
      const sat = 40 + tendril.ripeness * 30
      const light = 40 + pulse * 10

      ctx.beginPath()
      ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`
      ctx.lineWidth = 0.8 + tendril.trailStrength * 1.5

      const segs = tendril.segments
      if (segs.length < 2) continue

      ctx.moveTo(segs[0].x, segs[0].y)
      for (let i = 1; i < segs.length; i++) {
        // Add living wobble
        const wobbleX = Math.sin(this.pulsePhase * 3 + i * 0.7 + tendril.phaseOffset) * 2
        const wobbleY = Math.cos(this.pulsePhase * 2.3 + i * 0.5 + tendril.phaseOffset) * 1.5
        ctx.lineTo(segs[i].x + wobbleX, segs[i].y + wobbleY)
      }
      ctx.stroke()

      // Nutrient pulse dots traveling along tendril
      if (activeNutrients > 0.5) {
        const dotPos = ((this.pulsePhase * 0.5 + tendril.phaseOffset) % 1)
        const segIdx = Math.floor(dotPos * (segs.length - 1))
        const segFrac = dotPos * (segs.length - 1) - segIdx
        if (segIdx < segs.length - 1) {
          const dx = segs[segIdx + 1].x - segs[segIdx].x
          const dy = segs[segIdx + 1].y - segs[segIdx].y
          const px = segs[segIdx].x + dx * segFrac
          const py = segs[segIdx].y + dy * segFrac
          const dotAlpha = 0.06 + tendril.trailStrength * 0.08
          ctx.beginPath()
          ctx.arc(px, py, 1.5 + tendril.trailStrength * 2, 0, Math.PI * 2)
          ctx.fillStyle = `hsla(${hue + 10}, ${sat + 20}%, ${light + 20}%, ${dotAlpha})`
          ctx.fill()
        }
      }
    }

    // 2. Render spores (ethylene burst particles)
    for (const spore of this.spores) {
      const alpha = spore.life * 0.3
      ctx.beginPath()
      ctx.arc(spore.x, spore.y, spore.size * spore.life, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${spore.hue}, 60%, 60%, ${alpha})`
      ctx.fill()
    }

    // 3. Render compost particles (sinking letter fragments)
    if (this.compostParticles.length > 0) {
      ctx.font = '11px Cormorant Garamond, serif'
      ctx.textAlign = 'center'
      for (const p of this.compostParticles) {
        const alpha = p.life * 0.25
        ctx.fillStyle = `hsla(${p.hue}, 40%, 35%, ${alpha})`
        ctx.fillText(p.char, p.x, p.y)
      }
    }

    // 4. Subtle ripeness glow on room perimeter
    if (activeRipeness > 0.1) {
      const glowAlpha = activeRipeness * 0.04
      const gradient = ctx.createRadialGradient(
        w / 2, h / 2, Math.min(w, h) * 0.3,
        w / 2, h / 2, Math.min(w, h) * 0.7
      )
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
      const r = Math.floor(180 + activeRipeness * 75)
      const g = Math.floor(140 + activeRipeness * 75)
      gradient.addColorStop(1, `rgba(${r}, ${g}, 40, ${glowAlpha})`)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, w, h)
    }
  }

  // --- Accessors for other systems ---

  /** Get ripeness of a room (0-1) */
  getRipeness(room: string): number {
    return this.state.ripeness[room] || 0
  }

  /** Get nutrient level of a room */
  getNutrients(room: string): number {
    return this.state.nutrients[room] || 0
  }

  /** Get trail strength between two rooms (0-1) */
  getTrailStrength(a: string, b: string): number {
    return this.state.trails[this.trailKey(a, b)] || 0
  }

  /** Get last visit timestamp for a room */
  getLastVisit(room: string): number {
    return this.state.lastVisit[room] || 0
  }

  /** Drain nutrients from a room (immune system cost) */
  drainNutrients(room: string, amount: number) {
    this.state.nutrients[room] = Math.max(0, (this.state.nutrients[room] || 0) - amount)
  }

  /** Get total system ripeness (average across all rooms) */
  getSystemRipeness(): number {
    const vals = Object.values(this.state.ripeness)
    if (vals.length === 0) return 0
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }

  // --- Persistence ---

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch { /* quota exceeded — silently fail */ }
  }

  private load(): MyceliumState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const state = JSON.parse(raw) as MyceliumState
        // Migrate: older states may lack composted array
        if (!state.composted) state.composted = []
        return state
      }
    } catch { /* corrupted — fresh start */ }
    return { nutrients: {}, ripeness: {}, trails: {}, lastVisit: {}, composted: [] }
  }

  // --- Helpers ---

  private trailKey(a: string, b: string): string {
    // Undirected — sort alphabetically
    return a < b ? `${a}->${b}` : `${b}->${a}`
  }
}

// --- Supporting types ---

interface Spore {
  x: number; y: number
  vx: number; vy: number
  life: number; decay: number
  size: number; hue: number
}

interface Tendril {
  segments: { x: number; y: number }[]
  connection: string
  trailStrength: number
  ripeness: number
  phaseOffset: number
}

interface CompostParticle {
  x: number; y: number
  vx: number; vy: number
  char: string
  life: number; decay: number
  hue: number
}
