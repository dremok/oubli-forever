/**
 * THE FRUITING — emergent events born from the Mycelium
 *
 * When enough rooms have ripened, the mycelial network begins
 * to produce "fruit" — brief, beautiful, unrepeatable events
 * that manifest across the entire house.
 *
 * Each fruiting body is a one-time phenomenon. Once it occurs,
 * it seeds the next generation but never repeats exactly.
 *
 * Inspired by:
 * - The oubli fruit itself — sweet, golden, nourishing
 * - Fruiting bodies of fungi (sudden, spectacular, ephemeral)
 * - The "See Memory" documentary (30,000 hand-painted frames)
 * - Ethylene cascading through a bowl of fruit
 *
 * Types of fruiting events:
 * 1. GOLDEN RAIN — particles fall through all rooms like pollen
 * 2. RESONANCE BLOOM — all rooms briefly share the same hue
 * 3. MEMORY SEED — a memory fragment encapsulated and "planted"
 *    in a random room, to be discovered later
 * 4. TEMPORAL FOLD — the clock briefly runs backward
 * 5. SWEETENING — all text on screen briefly turns golden
 */

import type { Mycelium } from './Mycelium'

// --- Types ---

interface FruitingEvent {
  type: 'golden-rain' | 'resonance-bloom' | 'sweetening' | 'temporal-fold' | 'memory-seed'
  triggeredAt: number
  duration: number  // ms
  progress: number  // 0-1
  data?: Record<string, unknown>
}

interface PlantedSeed {
  room: string
  text: string
  plantedAt: number
  discovered: boolean
  isOther?: boolean  // true if planted by another visitor (shared seed)
}

// --- Constants ---

const CHECK_INTERVAL = 3000       // check for fruiting every 3s
const MIN_RIPENESS_TO_FRUIT = 0.15  // minimum system ripeness (average)
const FRUIT_COOLDOWN = 60000      // minimum 60s between fruiting events
const STORAGE_KEY = 'oubli_fruiting'
const SEED_STORAGE_KEY = 'oubli_seeds'

// --- Fruiting body ---

const FRUIT_TYPES: FruitingEvent['type'][] = [
  'golden-rain', 'resonance-bloom', 'sweetening', 'temporal-fold', 'memory-seed',
]

// Fragments that seeds carry — the DNA of the oubli fruit
const SEED_TEXTS = [
  'what falls from a tree of forgetting tastes sweet',
  'the mycelium remembers what you chose to forget',
  'every path you walked left golden traces in the dark',
  'a fruit that ripens in silence nourishes the soil',
  'you were here. the network felt you move between rooms.',
  'somewhere, a room you never visited grew warmer because of you',
  'the house learned your rhythm and grew toward it',
  'forgetting feeds the roots. the roots feed the fruit.',
  'this seed was planted by a visitor who came before you',
  'oubli: a sweet golden fruit that grows in the name of forgetting',
  'the connections between rooms are stronger than the rooms themselves',
  'every transition leaves a thread. every thread feeds the network.',
  'ripeness is not decay. it is readiness.',
  'the fruit does not fear the ground. it was always going to fall.',
]

// --- Visitor identity (anonymous, persistent) ---
function getVisitorId(): string {
  const KEY = 'oubli_visitor_id'
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem(KEY, id)
  }
  return id
}

export class Fruiting {
  private mycelium: Mycelium
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private checkInterval: number | null = null
  private animFrame: number | null = null
  private activeEvent: FruitingEvent | null = null
  private lastFruitTime = 0
  private particles: FruitParticle[] = []
  private seeds: PlantedSeed[] = []
  private getActiveRoom: () => string
  private fruitingHistory: string[] = [] // types already triggered this session
  private seedOverlay: HTMLDivElement | null = null
  private visitorId: string

  constructor(deps: {
    mycelium: Mycelium
    getActiveRoom: () => string
  }) {
    this.mycelium = deps.mycelium
    this.getActiveRoom = deps.getActiveRoom
    this.visitorId = getVisitorId()

    // Load persisted seeds
    this.seeds = this.loadSeeds()

    // Create visual layer
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 56; pointer-events: none;
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
    this.checkInterval = window.setInterval(() => this.check(), CHECK_INTERVAL)

    const render = () => {
      this.render()
      this.animFrame = window.setTimeout(render, 100)
    }
    render()
  }

  /** Called on room enter — check for planted seeds (local + shared) */
  onRoomEnter(room: string) {
    // Check for undiscovered LOCAL seeds in this room
    for (const seed of this.seeds) {
      if (seed.room === room && !seed.discovered) {
        seed.discovered = true
        this.showSeedDiscovery(seed)
        this.saveSeeds()
      }
    }

    // Also check for SHARED seeds from other visitors
    this.fetchSharedSeeds(room)

    // Contribute to collective pulse
    this.sendPulse(room)
  }

  // --- Fruiting check ---

  private check() {
    if (this.activeEvent) return // already fruiting
    if (Date.now() - this.lastFruitTime < FRUIT_COOLDOWN) return

    const sysRipeness = this.mycelium.getSystemRipeness()
    if (sysRipeness < MIN_RIPENESS_TO_FRUIT) return

    // Probability increases with ripeness
    const prob = sysRipeness * 0.08 // ~8% chance at full ripeness per check
    if (Math.random() > prob) return

    // Choose a type we haven't done this session (variety)
    const available = FRUIT_TYPES.filter(t => !this.fruitingHistory.includes(t))
    const type = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)]

    this.triggerFruiting(type)
  }

  private triggerFruiting(type: FruitingEvent['type']) {
    this.lastFruitTime = Date.now()
    this.fruitingHistory.push(type)

    const durations: Record<string, number> = {
      'golden-rain': 8000,
      'resonance-bloom': 5000,
      'sweetening': 4000,
      'temporal-fold': 3000,
      'memory-seed': 6000,
    }

    this.activeEvent = {
      type,
      triggeredAt: Date.now(),
      duration: durations[type] || 5000,
      progress: 0,
    }

    // Type-specific setup
    if (type === 'golden-rain') {
      this.spawnGoldenRain()
    } else if (type === 'sweetening') {
      this.triggerSweetening()
    } else if (type === 'memory-seed') {
      this.plantSeed()
    }
  }

  // --- Golden Rain ---

  private spawnGoldenRain() {
    const w = window.innerWidth
    for (let i = 0; i < 60; i++) {
      this.particles.push({
        x: Math.random() * w,
        y: -10 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 8,
        vy: 30 + Math.random() * 50,
        size: 1 + Math.random() * 3,
        life: 1,
        hue: 40 + Math.random() * 25,
        type: 'rain',
      })
    }
  }

  // --- Sweetening (golden text flash) ---

  private triggerSweetening() {
    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 900; pointer-events: none;
      mix-blend-mode: overlay;
      background: radial-gradient(ellipse at center,
        rgba(255, 200, 50, 0.06) 0%,
        rgba(255, 180, 30, 0.03) 40%,
        transparent 70%
      );
      opacity: 0;
      transition: opacity 1s ease;
    `
    document.body.appendChild(overlay)
    requestAnimationFrame(() => { overlay.style.opacity = '1' })

    setTimeout(() => {
      overlay.style.opacity = '0'
      setTimeout(() => overlay.remove(), 1000)
    }, 3000)
  }

  // --- Memory Seed ---

  private plantSeed() {
    // Choose a random room that isn't the current one
    const current = this.getActiveRoom()
    const rooms = ['study', 'garden', 'observatory', 'seance', 'furnace', 'tidepool',
      'radio', 'library', 'clocktower', 'choir', 'terrarium', 'well', 'cipher',
      'lighthouse', 'instrument', 'loom', 'archive', 'madeleine', 'pendulum']
    const target = rooms.filter(r => r !== current)
    const room = target[Math.floor(Math.random() * target.length)]

    const text = SEED_TEXTS[Math.floor(Math.random() * SEED_TEXTS.length)]

    this.seeds.push({
      room,
      text,
      plantedAt: Date.now(),
      discovered: false,
    })
    this.saveSeeds()

    // Share the seed with all visitors via the server
    this.shareSeed(room, text)

    // Brief visual: a golden dot floats to the edge of screen (toward the seeded room)
    const w = window.innerWidth
    const h = window.innerHeight
    for (let i = 0; i < 5; i++) {
      this.particles.push({
        x: w / 2 + (Math.random() - 0.5) * 100,
        y: h / 2 + (Math.random() - 0.5) * 100,
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 60,
        size: 2 + Math.random() * 2,
        life: 1,
        hue: 50,
        type: 'seed',
      })
    }
  }

  private showSeedDiscovery(seed: PlantedSeed) {
    // Show the seed text as a brief, beautiful overlay
    if (this.seedOverlay) this.seedOverlay.remove()

    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position: fixed; bottom: 80px; left: 50%;
      transform: translateX(-50%);
      z-index: 800; pointer-events: none;
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300; font-size: 16px;
      font-style: italic;
      letter-spacing: 2px;
      color: rgba(255, 200, 50, 0);
      transition: color 2s ease;
      text-align: center;
      max-width: 500px;
      line-height: 1.6;
    `

    // How long ago was it planted? By whom?
    const age = Date.now() - seed.plantedAt
    const days = Math.floor(age / (1000 * 60 * 60 * 24))
    const hours = Math.floor(age / (1000 * 60 * 60))
    const who = seed.isOther ? 'another visitor' : 'you'
    let timeStr: string
    if (days > 0) timeStr = `${days} day${days > 1 ? 's' : ''}`
    else if (hours > 0) timeStr = `${hours} hour${hours > 1 ? 's' : ''}`
    else timeStr = 'moments'
    const prefix = `[a seed planted by ${who}, ${timeStr} ago]`

    overlay.innerHTML = `
      <div style="font-size: 11px; letter-spacing: 3px; margin-bottom: 8px;
        color: rgba(255, 200, 50, 0.3)">${prefix}</div>
      <div>${seed.text}</div>
    `

    document.body.appendChild(overlay)
    this.seedOverlay = overlay

    requestAnimationFrame(() => {
      overlay.style.color = 'rgba(255, 200, 50, 0.5)'
    })

    setTimeout(() => {
      overlay.style.color = 'rgba(255, 200, 50, 0)'
      setTimeout(() => {
        overlay.remove()
        if (this.seedOverlay === overlay) this.seedOverlay = null
      }, 2000)
    }, 8000)
  }

  // --- Shared state (server communication) ---

  /** Share a seed with all visitors */
  private async shareSeed(room: string, text: string) {
    try {
      await fetch('/api/seeds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Visitor-Id': this.visitorId,
        },
        body: JSON.stringify({ room, text }),
      })
    } catch {
      // Server unavailable — seeds stay local only. Graceful degradation.
    }
  }

  /** Fetch shared seeds from other visitors for this room */
  private async fetchSharedSeeds(room: string) {
    try {
      const res = await fetch(`/api/seeds?room=${encodeURIComponent(room)}`, {
        headers: { 'X-Visitor-Id': this.visitorId },
      })
      if (!res.ok) return

      const seeds: PlantedSeed[] = await res.json()
      if (!seeds || seeds.length === 0) return

      // Show the first undiscovered shared seed (with delay for atmosphere)
      const seed = seeds[0]
      if (seed) {
        setTimeout(() => {
          this.showSeedDiscovery({
            room: seed.room,
            text: seed.text,
            plantedAt: seed.plantedAt,
            discovered: true,
            isOther: true,
          })
        }, 3000 + Math.random() * 5000) // 3-8s delay
      }
    } catch {
      // Server unavailable — only local seeds. Graceful.
    }
  }

  /** Contribute to collective pulse */
  private async sendPulse(room: string) {
    try {
      await fetch('/api/pulse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room }),
      })
    } catch {
      // Silent — pulse is optional
    }
  }

  // --- Render ---

  private render() {
    const w = window.innerWidth
    const h = window.innerHeight
    const ctx = this.ctx

    ctx.clearRect(0, 0, w, h)

    // Update active event progress
    if (this.activeEvent) {
      const elapsed = Date.now() - this.activeEvent.triggeredAt
      this.activeEvent.progress = Math.min(1, elapsed / this.activeEvent.duration)

      if (this.activeEvent.progress >= 1) {
        this.activeEvent = null
      }
    }

    // Render particles
    const dt = 0.016 // ~60fps
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt * 0.12

      if (p.type === 'rain') {
        // Golden rain: gentle sway
        p.vx += Math.sin(p.y * 0.01) * dt * 5
        p.vy += dt * 15 // gravity
      } else if (p.type === 'seed') {
        // Seeds: spiral outward
        p.vx *= 0.98
        p.vy *= 0.98
      }

      if (p.life <= 0 || p.y > h + 20 || p.x < -20 || p.x > w + 20) {
        this.particles.splice(i, 1)
        continue
      }

      const alpha = p.life * 0.4
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${p.hue}, 60%, 55%, ${alpha})`
      ctx.fill()
    }

    // Resonance bloom: all-room hue shift
    if (this.activeEvent?.type === 'resonance-bloom') {
      const p = this.activeEvent.progress
      const intensity = Math.sin(p * Math.PI) // bell curve
      const alpha = intensity * 0.04
      ctx.fillStyle = `hsla(45, 70%, 50%, ${alpha})`
      ctx.fillRect(0, 0, w, h)
    }

    // Temporal fold: brief screen distortion
    if (this.activeEvent?.type === 'temporal-fold') {
      const p = this.activeEvent.progress
      const intensity = Math.sin(p * Math.PI)
      // Horizontal scan lines
      ctx.strokeStyle = `rgba(255, 200, 50, ${intensity * 0.03})`
      ctx.lineWidth = 1
      const offset = Math.sin(Date.now() * 0.01) * 20
      for (let y = offset; y < h; y += 8) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }
    }
  }

  // --- Persistence ---

  private saveSeeds() {
    try {
      localStorage.setItem(SEED_STORAGE_KEY, JSON.stringify(this.seeds))
    } catch { /* silent */ }
  }

  private loadSeeds(): PlantedSeed[] {
    try {
      const raw = localStorage.getItem(SEED_STORAGE_KEY)
      if (raw) return JSON.parse(raw) as PlantedSeed[]
    } catch { /* silent */ }
    return []
  }
}

// --- Supporting types ---

interface FruitParticle {
  x: number; y: number
  vx: number; vy: number
  size: number; life: number
  hue: number
  type: 'rain' | 'seed'
}
