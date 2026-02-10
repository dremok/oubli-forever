/**
 * PARASITES — organisms that colonize rooms and modify their behavior
 *
 * The house doesn't just grow — it gets colonized. Small organisms
 * appear, attach to rooms, and change things. Some are beneficial
 * (pollinators that spread beauty). Some are parasitic (things that
 * eat memories faster). Some are symbiotic (changing the room's
 * appearance in exchange for nutrients from the mycelium).
 *
 * Parasites appear based on conditions — a room that's been unvisited
 * for a long time might develop moss (visual beauty, slows navigation).
 * A room with many degraded memories might attract a scavenger
 * (accelerates composting but dims the room). A highly-traveled room
 * might grow barnacles (slight visual crusting but immunity to decay).
 *
 * Each parasite is a small visual overlay that appears in the affected
 * room. They persist in localStorage and spread slowly.
 *
 * Inspired by:
 * - Gut microbiome: organisms that live in you and change how you function
 * - Klara Hosnedlova's living fungal art at White Cube (2026)
 * - Lichen: symbiosis between fungus and algae, growing on surfaces
 * - Barnacles: encrusting organisms that attach to well-traveled surfaces
 * - Toni Morrison: "Our liberation from diminishing notions comes through
 *   language." Some parasites diminish; others liberate.
 */

import { getConnections, ROOM_GRAPH } from '../navigation/RoomGraph'

const STORAGE_KEY = 'oubli_parasites'
const CHECK_INTERVAL = 10000 // 10s
const MAX_PARASITES = 8

type ParasiteType = 'moss' | 'barnacle' | 'scavenger' | 'phosphor' | 'lichen'

interface Parasite {
  type: ParasiteType
  room: string
  attachedAt: number  // timestamp
  strength: number    // 0-1, grows over time
}

interface ParasiteVisual {
  color: string
  label: string
  pattern: 'spots' | 'edge-creep' | 'veins' | 'glow' | 'crust'
}

const PARASITE_VISUALS: Record<ParasiteType, ParasiteVisual> = {
  moss: {
    color: 'rgba(60, 120, 50, 0.06)',
    label: 'moss',
    pattern: 'edge-creep',
  },
  barnacle: {
    color: 'rgba(180, 170, 150, 0.05)',
    label: 'barnacle',
    pattern: 'crust',
  },
  scavenger: {
    color: 'rgba(120, 80, 40, 0.05)',
    label: 'scavenger',
    pattern: 'spots',
  },
  phosphor: {
    color: 'rgba(100, 200, 180, 0.04)',
    label: 'phosphor',
    pattern: 'glow',
  },
  lichen: {
    color: 'rgba(150, 160, 100, 0.05)',
    label: 'lichen',
    pattern: 'veins',
  },
}

interface ParasiteState {
  parasites: Parasite[]
  lastCheck: number
}

export class Parasites {
  private state: ParasiteState
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private activeRoom = 'void'
  private checkInterval: number | null = null
  private animFrame: number | null = null
  private time = 0
  private getLastVisit: ((room: string) => number) | null = null
  private getNutrients: ((room: string) => number) | null = null
  private getTrailStrength: ((a: string, b: string) => number) | null = null

  constructor() {
    this.state = this.load()

    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 53; pointer-events: none;
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

  /** Wire to mycelium data sources */
  setMyceliumSource(deps: {
    getLastVisit: (room: string) => number
    getNutrients: (room: string) => number
    getTrailStrength: (a: string, b: string) => number
  }) {
    this.getLastVisit = deps.getLastVisit
    this.getNutrients = deps.getNutrients
    this.getTrailStrength = deps.getTrailStrength
  }

  start() {
    this.checkInterval = window.setInterval(() => this.check(), CHECK_INTERVAL)
    // Initial check after 15s
    setTimeout(() => this.check(), 15000)

    const render = () => {
      this.animFrame = requestAnimationFrame(render)
      this.render()
    }
    render()
  }

  onRoomEnter(room: string) {
    this.activeRoom = room
  }

  /** Get parasites attached to a specific room */
  getParasitesInRoom(room: string): Parasite[] {
    return this.state.parasites.filter(p => p.room === room)
  }

  /** Get total parasite count across all rooms */
  getTotalCount(): number {
    return this.state.parasites.length
  }

  private check() {
    // Grow existing parasites
    for (const p of this.state.parasites) {
      p.strength = Math.min(1, p.strength + 0.005)
    }

    // Maybe spawn a new parasite
    if (this.state.parasites.length < MAX_PARASITES && Math.random() < 0.08) {
      this.trySpawn()
    }

    // Remove very old parasites (>48h of real time)
    const now = Date.now()
    this.state.parasites = this.state.parasites.filter(
      p => now - p.attachedAt < 48 * 60 * 60 * 1000
    )

    if (Math.random() < 0.1) this.save()
  }

  private trySpawn() {
    const now = Date.now()
    const occupiedRooms = new Set(this.state.parasites.map(p => p.room))

    // Find candidate rooms
    for (const node of ROOM_GRAPH) {
      if (node.hidden) continue
      if (occupiedRooms.has(node.name)) continue

      const lastVisit = this.getLastVisit?.(node.name) ?? 0
      const timeSinceVisit = lastVisit ? (now - lastVisit) / 1000 : Infinity
      const nutrients = this.getNutrients?.(node.name) ?? 0

      let type: ParasiteType | null = null

      // Moss: grows in unvisited rooms (>10 min since last visit)
      if (timeSinceVisit > 600 && Math.random() < 0.3) {
        type = 'moss'
      }
      // Barnacle: encrusts highly-traveled rooms (high nutrients)
      else if (nutrients > 5 && Math.random() < 0.2) {
        type = 'barnacle'
      }
      // Scavenger: attracted to rooms with stagnant nutrients
      else if (nutrients > 2 && nutrients < 5 && timeSinceVisit > 300 && Math.random() < 0.2) {
        type = 'scavenger'
      }
      // Phosphor: rare, appears in rooms with strong connections
      else if (Math.random() < 0.05) {
        const conns = getConnections(node.name)
        const avgTrail = conns.reduce(
          (s, c) => s + (this.getTrailStrength?.(node.name, c) ?? 0), 0
        ) / Math.max(1, conns.length)
        if (avgTrail > 0.3) type = 'phosphor'
      }
      // Lichen: symbiotic, appears on rooms with moderate everything
      else if (nutrients > 1 && timeSinceVisit > 120 && Math.random() < 0.1) {
        type = 'lichen'
      }

      if (type) {
        this.state.parasites.push({
          type,
          room: node.name,
          attachedAt: now,
          strength: 0.1,
        })
        this.save()
        return
      }
    }
  }

  private render() {
    const w = window.innerWidth
    const h = window.innerHeight
    const ctx = this.ctx
    const dt = 0.016

    ctx.clearRect(0, 0, w, h)
    this.time += dt

    // Only render parasites in the active room
    const roomParasites = this.state.parasites.filter(p => p.room === this.activeRoom)
    if (roomParasites.length === 0) return

    for (const parasite of roomParasites) {
      const visual = PARASITE_VISUALS[parasite.type]
      const alpha = parasite.strength

      switch (visual.pattern) {
        case 'edge-creep':
          this.renderEdgeCreep(ctx, w, h, visual.color, alpha)
          break
        case 'crust':
          this.renderCrust(ctx, w, h, visual.color, alpha)
          break
        case 'spots':
          this.renderSpots(ctx, w, h, visual.color, alpha)
          break
        case 'glow':
          this.renderGlow(ctx, w, h, visual.color, alpha)
          break
        case 'veins':
          this.renderVeins(ctx, w, h, visual.color, alpha)
          break
      }
    }
  }

  private renderEdgeCreep(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, alpha: number) {
    // Moss creeping in from edges
    const spread = alpha * 80
    const baseAlpha = alpha * 0.04

    // Parse color for manipulation
    ctx.fillStyle = color

    // Top edge
    for (let x = 0; x < w; x += 15) {
      const height = spread * (0.5 + 0.5 * Math.sin(x * 0.02 + this.time * 0.3))
      ctx.globalAlpha = baseAlpha * (0.5 + 0.5 * Math.sin(x * 0.05 + this.time * 0.2))
      ctx.beginPath()
      ctx.ellipse(x, 0, 8, height, 0, 0, Math.PI)
      ctx.fill()
    }

    // Bottom edge
    for (let x = 0; x < w; x += 18) {
      const height = spread * 0.7 * (0.5 + 0.5 * Math.cos(x * 0.015 + this.time * 0.25))
      ctx.globalAlpha = baseAlpha * 0.8
      ctx.beginPath()
      ctx.ellipse(x, h, 10, height, 0, Math.PI, Math.PI * 2)
      ctx.fill()
    }

    // Left edge
    for (let y = 0; y < h; y += 20) {
      const width = spread * 0.6 * (0.5 + 0.5 * Math.sin(y * 0.025 + this.time * 0.15))
      ctx.globalAlpha = baseAlpha * 0.7
      ctx.beginPath()
      ctx.ellipse(0, y, width, 7, 0, -Math.PI / 2, Math.PI / 2)
      ctx.fill()
    }

    ctx.globalAlpha = 1
  }

  private renderCrust(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, alpha: number) {
    // Barnacle-like crusting — small irregular circles clustered at edges
    ctx.fillStyle = color
    const count = Math.floor(alpha * 30)

    // Use deterministic positions based on time seed
    const seed = Math.floor(this.time * 0.1)
    for (let i = 0; i < count; i++) {
      const hash = (i * 7919 + seed * 131) % 10000
      const edge = hash % 4
      let x: number, y: number
      switch (edge) {
        case 0: x = (hash * 3.7) % w; y = (hash * 0.3) % (h * 0.1); break
        case 1: x = (hash * 3.7) % w; y = h - (hash * 0.3) % (h * 0.1); break
        case 2: x = (hash * 0.3) % (w * 0.08); y = (hash * 2.9) % h; break
        default: x = w - (hash * 0.3) % (w * 0.08); y = (hash * 2.9) % h; break
      }
      const r = 2 + (hash % 5)
      ctx.globalAlpha = alpha * 0.04 * (0.5 + 0.5 * Math.sin(this.time + i * 0.3))
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  private renderSpots(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, alpha: number) {
    // Scavenger spots — scattered dark spots that pulse
    ctx.fillStyle = color
    const count = Math.floor(alpha * 15)

    for (let i = 0; i < count; i++) {
      const hash = (i * 5381 + 42) % 10000
      const x = (hash * 1.7) % w
      const y = (hash * 2.3) % h
      const r = 3 + (hash % 8)
      const pulse = Math.sin(this.time * 0.5 + i * 1.5) * 0.5 + 0.5
      ctx.globalAlpha = alpha * 0.03 * pulse
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  private renderGlow(ctx: CanvasRenderingContext2D, w: number, h: number, _color: string, alpha: number) {
    // Phosphor — gentle bioluminescent glow from center
    const breathe = Math.sin(this.time * 0.4) * 0.5 + 0.5
    const glowAlpha = alpha * 0.03 * breathe
    const grad = ctx.createRadialGradient(
      w / 2, h / 2, 0,
      w / 2, h / 2, Math.min(w, h) * 0.4
    )
    grad.addColorStop(0, `rgba(100, 200, 180, ${glowAlpha})`)
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  }

  private renderVeins(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, alpha: number) {
    // Lichen veins — branching organic lines across the surface
    ctx.strokeStyle = color
    ctx.lineWidth = 0.5
    ctx.globalAlpha = alpha * 0.04

    const branches = Math.floor(alpha * 6) + 2
    for (let b = 0; b < branches; b++) {
      const hash = (b * 6271 + 17) % 10000
      let x = (hash * 1.3) % w
      let y = (hash * 2.1) % h
      const angle = (hash % 628) / 100

      ctx.beginPath()
      ctx.moveTo(x, y)

      const segments = 15 + Math.floor(alpha * 20)
      for (let s = 0; s < segments; s++) {
        const dx = Math.cos(angle + Math.sin(this.time * 0.2 + s * 0.3) * 0.5) * 12
        const dy = Math.sin(angle + Math.cos(this.time * 0.15 + s * 0.4) * 0.5) * 10
        x += dx
        y += dy
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch { /* quota */ }
  }

  private load(): ParasiteState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as ParasiteState
    } catch { /* corrupted */ }
    return { parasites: [], lastCheck: Date.now() }
  }
}
