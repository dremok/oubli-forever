/**
 * THREADS — the navigation web made visible
 *
 * Inspired by Chiharu Shiota's "Threads of Life" (Hayward Gallery,
 * Feb 2026): floor-to-ceiling webs of thread engulfing everyday
 * objects, making intangible connections physical and overwhelming.
 *
 * Every time you navigate between rooms, a thread is drawn between
 * them. The thread's weight accumulates: heavily-traveled paths
 * become thick, glowing strands. Rarely-used paths are thin wisps.
 *
 * The thread web briefly flashes visible on each room transition,
 * then fades. Over weeks of use, the accumulated web grows denser
 * until the connections themselves threaten to overwhelm the rooms.
 *
 * The web is drawn as a radial force-directed graph:
 * - Rooms are arranged in a circle
 * - Threads arc between connected rooms with Bézier curves
 * - Thread color comes from the room cluster (water=blue, fire=red, etc.)
 * - Thread opacity/width = accumulated traversal weight
 *
 * Uses localStorage to persist the thread weights across sessions.
 */

const STORAGE_KEY = 'oubli-threads'
const FLASH_DURATION = 3000     // 3s flash on each transition
const FADE_RATE = 0.001         // fade rate per ms
const MAX_WEIGHT = 50           // cap per connection
const RENDER_INTERVAL = 80      // ~12fps

// Room positions — arranged in a circle
// We'll compute these dynamically based on the rooms we've seen

interface ThreadState {
  weights: Record<string, number>  // "roomA→roomB" => accumulated weight
  totalTraversals: number
  lastUpdate: number
}

// Color for each room cluster
const CLUSTER_COLORS: Record<string, [number, number, number]> = {
  void:   [160, 140, 200],  // purple
  water:  [80, 150, 200],   // blue
  fire:   [200, 100, 60],   // orange-red
  nature: [80, 180, 100],   // green
  spirit: [180, 130, 200],  // violet
  time:   [200, 180, 100],  // amber
}

// Room → cluster mapping (subset — unknown rooms default to void)
const ROOM_CLUSTER: Record<string, string> = {
  void: 'void', study: 'spirit', library: 'spirit', cipher: 'time',
  instrument: 'void', choir: 'spirit', radio: 'time',
  observatory: 'void', satellite: 'void', asteroids: 'void',
  seance: 'spirit', oracle: 'spirit', madeleine: 'spirit', rememory: 'spirit',
  garden: 'nature', terrarium: 'nature', tidepool: 'water', well: 'water',
  glacarium: 'water', furnace: 'fire', disintegration: 'fire',
  clocktower: 'time', datepaintings: 'time', darkroom: 'spirit',
  projection: 'fire', palimpsestgallery: 'nature', sketchpad: 'nature',
  loom: 'nature', automaton: 'time', seismograph: 'time', pendulum: 'time',
  weathervane: 'water', cartographer: 'void', labyrinth: 'spirit',
  archive: 'time', lighthouse: 'water',
  catacombs: 'fire', roots: 'nature', ossuary: 'fire',
  between: 'spirit', aquifer: 'water', midnight: 'time', mirror: 'spirit',
}

export class Threads {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private state: ThreadState
  private flashAlpha = 0
  private flashStart = 0
  private rooms = new Set<string>()
  private roomPositions = new Map<string, { x: number; y: number }>()
  private animFrame: number | null = null
  private lastTransitionFrom = ''
  private lastTransitionTo = ''

  constructor() {
    this.state = this.loadState()

    // Extract known rooms from weights
    for (const key of Object.keys(this.state.weights)) {
      const [a, b] = key.split('→')
      if (a) this.rooms.add(a)
      if (b) this.rooms.add(b)
    }

    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      z-index: 55;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.5s ease;
    `
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!

    this.resize()
    window.addEventListener('resize', () => this.resize())

    // Start render loop (throttled)
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
    this.computePositions()
  }

  private computePositions() {
    const w = window.innerWidth
    const h = window.innerHeight
    const cx = w / 2
    const cy = h / 2
    const radius = Math.min(w, h) * 0.35

    const roomList = Array.from(this.rooms).sort()
    if (roomList.length === 0) return

    // Place rooms in a circle, void at top
    const voidIdx = roomList.indexOf('void')
    if (voidIdx > 0) {
      roomList.splice(voidIdx, 1)
      roomList.unshift('void')
    }

    this.roomPositions.clear()
    for (let i = 0; i < roomList.length; i++) {
      const angle = (i / roomList.length) * Math.PI * 2 - Math.PI / 2
      this.roomPositions.set(roomList[i], {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      })
    }
  }

  /** Call on room transition */
  onTransition(from: string, to: string) {
    if (from === to) return

    this.rooms.add(from)
    this.rooms.add(to)
    this.computePositions()

    // Accumulate weight (bidirectional key, sorted)
    const key = [from, to].sort().join('→')
    this.state.weights[key] = Math.min(
      MAX_WEIGHT,
      (this.state.weights[key] || 0) + 1
    )
    this.state.totalTraversals++
    this.state.lastUpdate = Date.now()

    // Flash the web
    this.lastTransitionFrom = from
    this.lastTransitionTo = to
    this.flashStart = performance.now()
    this.flashAlpha = 1
    this.canvas.style.opacity = '1'
  }

  private render() {
    const now = performance.now()
    const w = window.innerWidth
    const h = window.innerHeight
    const ctx = this.ctx

    // Update flash
    if (this.flashAlpha > 0) {
      const elapsed = now - this.flashStart
      if (elapsed > FLASH_DURATION) {
        this.flashAlpha = 0
        this.canvas.style.opacity = '0'
      } else {
        // Ease out
        this.flashAlpha = 1 - (elapsed / FLASH_DURATION)
        this.flashAlpha = this.flashAlpha * this.flashAlpha // quadratic ease
      }
    }

    if (this.flashAlpha <= 0.01) return // nothing to draw

    ctx.clearRect(0, 0, w, h)

    const entries = Object.entries(this.state.weights)
    if (entries.length === 0) return

    // Find max weight for normalization
    const maxW = Math.max(...entries.map(([, v]) => v), 1)

    // Draw all threads
    for (const [key, weight] of entries) {
      const [a, b] = key.split('→')
      const posA = this.roomPositions.get(a)
      const posB = this.roomPositions.get(b)
      if (!posA || !posB) continue

      const norm = weight / maxW
      const isActiveThread = (
        (a === this.lastTransitionFrom && b === this.lastTransitionTo) ||
        (b === this.lastTransitionFrom && a === this.lastTransitionTo)
      )

      // Thread properties
      const lineWidth = 0.5 + norm * 3
      const alpha = (0.05 + norm * 0.3) * this.flashAlpha

      // Color: blend between the two room clusters
      const clusterA = ROOM_CLUSTER[a] || 'void'
      const clusterB = ROOM_CLUSTER[b] || 'void'
      const colA = CLUSTER_COLORS[clusterA] || CLUSTER_COLORS.void
      const colB = CLUSTER_COLORS[clusterB] || CLUSTER_COLORS.void
      const r = Math.round((colA[0] + colB[0]) / 2)
      const g = Math.round((colA[1] + colB[1]) / 2)
      const bl = Math.round((colA[2] + colB[2]) / 2)

      // Active thread glows brighter
      const finalAlpha = isActiveThread ? Math.min(1, alpha * 3) : alpha

      // Draw Bézier curve (arc away from center)
      const cx = w / 2
      const cy = h / 2
      const mx = (posA.x + posB.x) / 2
      const my = (posA.y + posB.y) / 2
      // Control point: push away from center
      const dx = mx - cx
      const dy = my - cy
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const push = 30 + norm * 20
      const cpx = mx + (dx / dist) * push
      const cpy = my + (dy / dist) * push

      ctx.beginPath()
      ctx.moveTo(posA.x, posA.y)
      ctx.quadraticCurveTo(cpx, cpy, posB.x, posB.y)
      ctx.strokeStyle = `rgba(${r}, ${g}, ${bl}, ${finalAlpha})`
      ctx.lineWidth = lineWidth
      ctx.stroke()

      // Glow effect for heavy threads
      if (norm > 0.5) {
        ctx.beginPath()
        ctx.moveTo(posA.x, posA.y)
        ctx.quadraticCurveTo(cpx, cpy, posB.x, posB.y)
        ctx.strokeStyle = `rgba(${r}, ${g}, ${bl}, ${finalAlpha * 0.3})`
        ctx.lineWidth = lineWidth + 4
        ctx.stroke()
      }
    }

    // Draw room nodes as small dots
    for (const [room, pos] of this.roomPositions) {
      const cluster = ROOM_CLUSTER[room] || 'void'
      const col = CLUSTER_COLORS[cluster] || CLUSTER_COLORS.void

      const isActive = room === this.lastTransitionTo
      const size = isActive ? 4 : 2
      const dotAlpha = (isActive ? 0.8 : 0.3) * this.flashAlpha

      ctx.beginPath()
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${dotAlpha})`
      ctx.fill()
    }

    // Total traversals counter (very faint)
    if (this.state.totalTraversals > 5) {
      const countAlpha = 0.08 * this.flashAlpha
      ctx.font = '9px monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = `rgba(160, 140, 200, ${countAlpha})`
      ctx.fillText(
        `${this.state.totalTraversals} threads`,
        w / 2,
        h / 2
      )
    }
  }

  /** Get total accumulated traversals */
  getTotalTraversals(): number {
    return this.state.totalTraversals
  }

  /** Get weight of a specific connection */
  getConnectionWeight(a: string, b: string): number {
    const key = [a, b].sort().join('→')
    return this.state.weights[key] || 0
  }

  private loadState(): ThreadState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) return JSON.parse(stored)
    } catch { /* fresh */ }
    return { weights: {}, totalTraversals: 0, lastUpdate: Date.now() }
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch { /* quota */ }
  }
}
