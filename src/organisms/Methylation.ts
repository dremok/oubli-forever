/**
 * THE METHYLATION — epigenetic memory of the house
 *
 * DNA methylation marks protect the genome from transposable elements —
 * rogue sequences that jump between locations, disrupting order.
 * With aging, methylation decays, and these elements awaken.
 *
 * In the house: each room has "methylation" — protective stability marks.
 * Over time (correlated with visit patterns and the seasonal clock),
 * methylation erodes. When it falls below a threshold, "transposable
 * elements" — fragments of content from that room — escape and drift
 * into whatever room you're currently in.
 *
 * You're in the garden and suddenly a fragment of text from the study
 * drifts across. The house's memories are becoming unstable, transposing
 * between rooms. Content bleeding across boundaries.
 *
 * Inspired by:
 * - DNA methylation decay in aging (Science, Jan 2026) — protective marks
 *   erode, transposable elements awaken, genomes destabilize
 * - Fennell's "Wuthering Heights" (Feb 2026) — an adaptation is a
 *   quotation, not the thing itself. Rooms quote each other.
 * - Sonsbeek 2026 "Against Forgetting" — memory as transformation
 * - Prions: misfolded proteins that propagate their shape to neighbors
 */

const STORAGE_KEY = 'oubli_methylation'
const TICK_INTERVAL = 5000       // 5s
const DECAY_PER_TICK = 0.001     // base methylation decay per tick
const VISIT_RESTORE = 0.03       // visiting a room restores some methylation
const TRANSPOSE_THRESHOLD = 0.4  // below this, transposition can happen
const TRANSPOSE_CHANCE = 0.12    // chance per tick when below threshold
const MAX_TRANSPOSONS = 3        // max visible transposing fragments
const TRANSPOSON_LIFETIME = 8000 // ms before a transposon fades

// Room-specific content fragments that can transpose
const ROOM_FRAGMENTS: Record<string, string[]> = {
  void: [
    '30,000 particles', 'the void breathes', 'entropy is the universe\'s mercy',
    'hold spacebar to speak', 'oubli: forgetting',
  ],
  study: [
    'write something you\'re afraid to remember', 'the prompt whispers back',
    'ink dissolves as you write', 'Toni Morrison: liberation through language',
  ],
  instrument: [
    '♪ ♩ ♫', 'the keys remember your last chord', 'harmonics decay',
    'a note held too long becomes noise',
  ],
  garden: [
    'roots remember the shape of soil', 'a plant wilts when its memory degrades',
    'seeds from other visitors', 'photosynthesis of attention',
  ],
  observatory: [
    'memory constellations', 'each star was a thought once', 'orbit decaying',
    'the distance between memories is meaning',
  ],
  seance: [
    'ask the void a question', 'the dead respond in fragments',
    'between the words, silence speaks', 'a door to in-between',
  ],
  darkroom: [
    'developing memories in chemical light', 'the photograph fades',
    'red light preserves what darkness destroys', 'exposure time: your attention span',
  ],
  archive: [
    'dead websites drift here', 'geocities ghosts', 'the wayback machine forgets too',
    '404: a whole era, not found',
  ],
  loom: [
    'thread by thread, a pattern emerges', 'the shuttle moves back and forth',
    'jacquard: first binary program', 'holes in the weave where memories degraded',
  ],
  furnace: [
    'feed memories to the fire', 'ash is just memory in another form',
    'the heat accelerates forgetting', 'what burns bright burns fast',
  ],
  clocktower: [
    'the clock runs backward at high degradation', 'each number is a memory position',
    'time jitters', 'midnight: the hidden hour',
  ],
  pendulum: [
    'coupled oscillations', 'the trace decays', 'resonance: beauty before catastrophe',
    'two frequencies in conversation',
  ],
  lighthouse: [
    'light sweeps across the dark', 'a signal to no one', 'the keeper is gone',
    'each rotation: one memory recalled',
  ],
  labyrinth: [
    'the walls shift when you\'re not looking', 'minotaur: the thing you forgot you were running from',
    'dead ends are just pauses', 'the exit leads somewhere random',
  ],
  tidepool: [
    'organisms in miniature', 'the tide brings and takes', 'salt crystals of meaning',
    'what the ocean left behind',
  ],
  satellite: [
    'orbiting the house from outside', 'signal degrades with distance',
    'ISS position affects the view', 'alone in space with your thoughts',
  ],
  glacarium: [
    'memories frozen in ice', 'the glacier moves one inch per year',
    'preserved but unreachable', 'when the ice melts, everything returns at once',
  ],
  disintegrationloops: [
    'the tape is wearing thin', 'each loop loses something', 'Basinski watched the towers fall',
    'beauty in irreversible decay',
  ],
}

interface Transposon {
  text: string
  fromRoom: string
  x: number
  y: number
  vx: number
  vy: number
  born: number
  alpha: number
  size: number
  angle: number     // slight rotation
  angleVel: number  // rotation speed
}

interface MethylationState {
  marks: Record<string, number>   // methylation level per room (0-1, starts at 1)
  totalTranspositions: number
}

export class Methylation {
  private state: MethylationState
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private transposons: Transposon[] = []
  private activeRoom = 'void'
  private tickInterval: number | null = null
  private animFrame: number | null = null
  private time = 0
  private getSeason: (() => string) | null = null

  constructor() {
    this.state = this.load()

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

  setSeasonSource(fn: () => string) {
    this.getSeason = fn
  }

  start() {
    this.tickInterval = window.setInterval(() => this.tick(), TICK_INTERVAL)
    const render = () => {
      this.animFrame = requestAnimationFrame(render)
      this.render()
    }
    render()
  }

  onRoomEnter(room: string) {
    this.activeRoom = room

    // Visiting restores methylation (attention is protective)
    if (this.state.marks[room] !== undefined) {
      this.state.marks[room] = Math.min(1, this.state.marks[room] + VISIT_RESTORE)
    } else {
      this.state.marks[room] = 1
    }

    this.save()
  }

  /** Get methylation level of a room (0-1, 1 = fully protected) */
  getMethylation(room: string): number {
    return this.state.marks[room] ?? 1
  }

  /** Get average methylation across all rooms */
  getAvgMethylation(): number {
    const vals = Object.values(this.state.marks)
    if (vals.length === 0) return 1
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }

  private tick() {
    // Seasonal modifier: decay faster during fall/decay seasons
    const season = this.getSeason?.() ?? 'growth'
    let decayMultiplier = 1
    switch (season) {
      case 'seed': decayMultiplier = 0.5; break
      case 'growth': decayMultiplier = 0.7; break
      case 'ripe': decayMultiplier = 1.0; break
      case 'fall': decayMultiplier = 1.5; break
      case 'decay': decayMultiplier = 2.0; break
    }

    // Decay methylation on all rooms (except the one you're in — attention protects)
    for (const room of Object.keys(this.state.marks)) {
      if (room === this.activeRoom) continue
      this.state.marks[room] = Math.max(
        0,
        this.state.marks[room] - DECAY_PER_TICK * decayMultiplier
      )
    }

    // Check for transposition events
    if (this.transposons.length < MAX_TRANSPOSONS) {
      for (const [room, level] of Object.entries(this.state.marks)) {
        if (room === this.activeRoom) continue
        if (level > TRANSPOSE_THRESHOLD) continue
        if (Math.random() > TRANSPOSE_CHANCE) continue

        // Transposition! A fragment from this room escapes to the current room
        const frags = ROOM_FRAGMENTS[room]
        if (!frags || frags.length === 0) continue

        const text = frags[Math.floor(Math.random() * frags.length)]
        const w = window.innerWidth
        const h = window.innerHeight

        // Enter from a random edge
        const edge = Math.floor(Math.random() * 4)
        let x: number, y: number, vx: number, vy: number
        switch (edge) {
          case 0: x = Math.random() * w; y = -20; vx = (Math.random() - 0.5) * 15; vy = 8 + Math.random() * 12; break
          case 1: x = Math.random() * w; y = h + 20; vx = (Math.random() - 0.5) * 15; vy = -(8 + Math.random() * 12); break
          case 2: x = -20; y = Math.random() * h; vx = 8 + Math.random() * 12; vy = (Math.random() - 0.5) * 15; break
          default: x = w + 20; y = Math.random() * h; vx = -(8 + Math.random() * 12); vy = (Math.random() - 0.5) * 15; break
        }

        this.transposons.push({
          text,
          fromRoom: room,
          x, y, vx, vy,
          born: Date.now(),
          alpha: 0,
          size: 11 + Math.random() * 4,
          angle: (Math.random() - 0.5) * 0.3,
          angleVel: (Math.random() - 0.5) * 0.02,
        })

        this.state.totalTranspositions++
        break // one transposition per tick max
      }
    }

    // Clean up old transposons
    const now = Date.now()
    this.transposons = this.transposons.filter(t => now - t.born < TRANSPOSON_LIFETIME)

    // Save periodically
    if (Math.random() < 0.1) this.save()
  }

  private render() {
    const w = window.innerWidth
    const h = window.innerHeight
    const ctx = this.ctx
    const dt = 0.016

    ctx.clearRect(0, 0, w, h)
    this.time += dt

    if (this.transposons.length === 0) return

    const now = Date.now()

    for (const t of this.transposons) {
      const age = now - t.born
      const lifeFraction = age / TRANSPOSON_LIFETIME

      // Fade in for first 500ms, fade out for last 2000ms
      if (age < 500) {
        t.alpha = (age / 500) * 0.2
      } else if (age > TRANSPOSON_LIFETIME - 2000) {
        t.alpha = ((TRANSPOSON_LIFETIME - age) / 2000) * 0.2
      } else {
        t.alpha = 0.2
      }

      // Movement: slow drift, decelerating
      t.x += t.vx * dt
      t.y += t.vy * dt
      t.vx *= 0.995
      t.vy *= 0.995
      t.angle += t.angleVel

      // Slight wobble
      const wobbleX = Math.sin(this.time * 1.5 + lifeFraction * 10) * 2
      const wobbleY = Math.cos(this.time * 1.2 + lifeFraction * 8) * 1.5

      // Render the transposon
      ctx.save()
      ctx.translate(t.x + wobbleX, t.y + wobbleY)
      ctx.rotate(t.angle)

      // Ghost text — slightly glitched, not quite belonging
      ctx.font = `italic ${t.size}px Cormorant Garamond, serif`
      ctx.textAlign = 'center'

      // Color: warm pink for recent, cold blue for old
      const hue = 340 - lifeFraction * 160 // pink → blue over lifetime
      ctx.fillStyle = `hsla(${hue}, 40%, 60%, ${t.alpha})`

      // Slight horizontal jitter for instability
      const jitter = Math.sin(this.time * 8 + t.born * 0.001) * (lifeFraction * 3)
      ctx.fillText(t.text, jitter, 0)

      // Source label — very faint, below the text
      ctx.font = `8px Cormorant Garamond, serif`
      ctx.fillStyle = `hsla(${hue}, 30%, 50%, ${t.alpha * 0.3})`
      const sourceName = t.fromRoom.replace(/([A-Z])/g, ' $1').trim().toLowerCase()
      ctx.fillText(`from the ${sourceName}`, jitter, 14)

      ctx.restore()
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch { /* quota */ }
  }

  private load(): MethylationState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as MethylationState
    } catch { /* corrupted */ }
    return { marks: {}, totalTranspositions: 0 }
  }
}
