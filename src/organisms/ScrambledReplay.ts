/**
 * SCRAMBLED REPLAY — the house dreams of your path, but gets it wrong
 *
 * During rest (idle periods), the hippocampus replays recent experiences
 * to consolidate memory. In Alzheimer's, this replay still fires — but
 * the sequences are SCRAMBLED. The brain tries to remember your day
 * but reassembles the events in the wrong order, with wrong details.
 *
 * This organism reads your ThreadTrail navigation history and periodically
 * "replays" it — flashing room names in rapid succession, but shuffled,
 * substituted, and corrupted. The deeper the house's methylation decay,
 * the more scrambled the replay becomes.
 *
 * The replay is brief (3-6 seconds), shows 5-10 room name flashes,
 * and occurs every 2-4 minutes of idle time. It's subtle — a ripple
 * across the bottom of the screen, like REM eye movement.
 *
 * Inspired by:
 * - UCL Alzheimer's scrambled replay (Current Biology, Feb 2026):
 *   "Place cells grow unstable, stop representing the same locations,
 *   and mice revisit already-explored paths." The replay isn't absent —
 *   it's WRONG.
 * - Karnivool "In Verses" (Feb 6, 2026): progressive structure where
 *   nothing repeats, each verse adds a layer — but here, verses scramble
 * - Episodic/semantic memory merger (Nottingham/Cambridge, Feb 2026):
 *   the house can't tell which memories are "paths" and which are "rooms"
 */

const MIN_IDLE = 90000       // 90s idle before first replay
const REPLAY_INTERVAL_MIN = 120000  // 2min between replays
const REPLAY_INTERVAL_MAX = 240000  // 4min between replays
const FLASH_COUNT_MIN = 5
const FLASH_COUNT_MAX = 12
const FLASH_DURATION = 400   // ms per flash
const FLASH_GAP = 120        // ms between flashes
const FADE_IN = 300
const FADE_OUT = 800

// Room characteristic colors (biome hues)
const ROOM_HUES: Record<string, number> = {
  void: 280, study: 42, instrument: 320, observatory: 230,
  seance: 270, darkroom: 0, garden: 120, archive: 35,
  loom: 30, tidepool: 195, furnace: 15, radio: 140,
  well: 210, clocktower: 50, automaton: 60, seismograph: 345,
  pendulum: 45, cipher: 160, terrarium: 100, lighthouse: 55,
  sketchpad: 310, weathervane: 180, cartographer: 40, choir: 260,
  oracledeck: 290, labyrinth: 0, glacarium: 200, satellite: 220,
  asteroids: 25, disintegration: 10, projection: 35, datepaintings: 48,
  madeleine: 330, library: 38, palimpsestgallery: 42, rememory: 300,
  catacombs: 20, roots: 80, ossuary: 28, between: 170,
  aquifer: 190, midnight: 240, mirror: 275,
}

interface ReplayFlash {
  roomName: string       // displayed name (may be wrong)
  actualRoom: string     // what room it represents
  hue: number            // color (may be wrong)
  startTime: number
  endTime: number
  scrambleType: 'correct' | 'shuffled' | 'substituted' | 'merged' | 'reversed'
  xOffset: number        // slight horizontal drift
  glitchIntensity: number // 0-1
}

interface ScrambledReplayDeps {
  getNavigationHistory: () => { from: string; to: string; count: number }[]
  getActiveRoom: () => string
  getAvgMethylation: () => number
  getSeason: () => string
}

export class ScrambledReplay {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private deps: ScrambledReplayDeps | null = null
  private animFrame: number | null = null
  private time = 0

  // Replay state
  private flashes: ReplayFlash[] = []
  private replayActive = false
  private lastReplay = 0
  private nextReplayAt = 0
  private lastInteraction = Date.now()
  private totalReplays = 0

  // Visual state
  private scanLineY = -1       // horizontal scan line sweeping during replay
  private replayLabel = ''
  private replayLabelAlpha = 0

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 56; pointer-events: none;
    `
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!
    this.resize()
    window.addEventListener('resize', () => this.resize())

    // Track user interaction to detect idle periods
    const resetIdle = () => { this.lastInteraction = Date.now() }
    document.addEventListener('mousemove', resetIdle, { passive: true })
    document.addEventListener('keydown', resetIdle, { passive: true })
    document.addEventListener('click', resetIdle, { passive: true })
    document.addEventListener('touchstart', resetIdle, { passive: true })

    this.scheduleNext()
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio, 2)
    this.canvas.width = window.innerWidth * dpr
    this.canvas.height = window.innerHeight * dpr
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  setDeps(deps: ScrambledReplayDeps) {
    this.deps = deps
  }

  start() {
    const render = () => {
      this.tick()
      this.animFrame = window.setTimeout(render, 100)
    }
    render()
  }

  getTotalReplays(): number {
    return this.totalReplays
  }

  isReplaying(): boolean {
    return this.replayActive
  }

  private scheduleNext() {
    const interval = REPLAY_INTERVAL_MIN +
      Math.random() * (REPLAY_INTERVAL_MAX - REPLAY_INTERVAL_MIN)
    this.nextReplayAt = Date.now() + interval
  }

  private tick() {
    const now = Date.now()
    const dt = 0.016
    this.time += dt

    const w = window.innerWidth
    const h = window.innerHeight
    const ctx = this.ctx

    ctx.clearRect(0, 0, w, h)

    // Check if we should start a replay
    if (!this.replayActive && this.deps && now >= this.nextReplayAt) {
      const idleTime = now - this.lastInteraction
      if (idleTime >= MIN_IDLE) {
        this.startReplay()
      }
    }

    // Render active replay
    if (this.replayActive && this.flashes.length > 0) {
      this.renderReplay(ctx, w, h, now)
    }

    // Fade replay label
    if (this.replayLabelAlpha > 0) {
      this.replayLabelAlpha -= dt * 0.15
      if (this.replayLabelAlpha > 0) {
        ctx.font = '11px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(200, 160, 120, ${Math.max(0, this.replayLabelAlpha * 0.06)})`
        ctx.textAlign = 'center'
        ctx.fillText(this.replayLabel, w / 2, h - 6)
      }
    }
  }

  private startReplay() {
    if (!this.deps) return

    const history = this.deps.getNavigationHistory()
    if (history.length < 3) return // need enough history to scramble

    const avgMeth = this.deps.getAvgMethylation()
    const season = this.deps.getSeason()

    // Scramble intensity: lower methylation = more scrambled
    // Also worse during fall/decay seasons
    const seasonMod: Record<string, number> = {
      seed: 0.8, growth: 0.6, ripe: 0.5, fall: 1.2, decay: 1.4,
    }
    const scrambleIntensity = Math.min(1, (1 - avgMeth) * 1.5 * (seasonMod[season] ?? 1))

    // Extract room sequence from navigation edges (weighted by count)
    const rooms = this.extractRoomSequence(history)
    if (rooms.length < 3) return

    // Determine flash count
    const flashCount = FLASH_COUNT_MIN +
      Math.floor(Math.random() * (FLASH_COUNT_MAX - FLASH_COUNT_MIN + 1))

    // Build the replay sequence — with scrambling
    const now = Date.now()
    this.flashes = []

    for (let i = 0; i < flashCount; i++) {
      const flash = this.generateFlash(rooms, i, flashCount, scrambleIntensity, now)
      this.flashes.push(flash)
    }

    this.replayActive = true
    this.lastReplay = now
    this.totalReplays++
    this.scanLineY = -10

    // Choose replay label
    const labels = [
      'replay — scrambled',
      'the house dreams of your path',
      'consolidation error',
      'hippocampal replay — corrupted',
      'sharp wave ripple — wrong order',
      `replay #${this.totalReplays} — ${Math.round(scrambleIntensity * 100)}% corruption`,
    ]
    this.replayLabel = labels[Math.floor(Math.random() * labels.length)]
    this.replayLabelAlpha = 1

    this.scheduleNext()
  }

  private extractRoomSequence(
    history: { from: string; to: string; count: number }[],
  ): string[] {
    // Build a weighted sequence from navigation edges
    const rooms: string[] = []
    const seen = new Set<string>()

    // Sort by count (most traveled first) and extract rooms
    const sorted = [...history].sort((a, b) => b.count - a.count)

    for (const edge of sorted) {
      if (!seen.has(edge.from)) {
        rooms.push(edge.from)
        seen.add(edge.from)
      }
      if (!seen.has(edge.to)) {
        rooms.push(edge.to)
        seen.add(edge.to)
      }
    }

    return rooms
  }

  private generateFlash(
    rooms: string[],
    index: number,
    total: number,
    scrambleIntensity: number,
    baseTime: number,
  ): ReplayFlash {
    const start = baseTime + index * (FLASH_DURATION + FLASH_GAP)
    const end = start + FLASH_DURATION

    // Decide scramble type based on intensity
    const roll = Math.random()
    let scrambleType: ReplayFlash['scrambleType']
    let roomName: string
    let hue: number

    if (roll > scrambleIntensity * 0.8) {
      // Correct replay — room at this position
      scrambleType = 'correct'
      const room = rooms[index % rooms.length]
      roomName = this.formatRoomName(room)
      hue = ROOM_HUES[room] ?? 200
    } else if (roll < scrambleIntensity * 0.3) {
      // Substituted — wrong room entirely
      scrambleType = 'substituted'
      const wrongRoom = rooms[Math.floor(Math.random() * rooms.length)]
      roomName = this.formatRoomName(wrongRoom)
      // Use a DIFFERENT room's hue (color mismatch)
      const colorRoom = rooms[Math.floor(Math.random() * rooms.length)]
      hue = ROOM_HUES[colorRoom] ?? 200
    } else if (roll < scrambleIntensity * 0.5) {
      // Merged — two room names blended
      scrambleType = 'merged'
      const a = rooms[Math.floor(Math.random() * rooms.length)]
      const b = rooms[Math.floor(Math.random() * rooms.length)]
      roomName = this.mergeNames(a, b)
      hue = ((ROOM_HUES[a] ?? 200) + (ROOM_HUES[b] ?? 200)) / 2
    } else if (roll < scrambleIntensity * 0.7) {
      // Reversed — correct room but name is backwards
      scrambleType = 'reversed'
      const room = rooms[index % rooms.length]
      roomName = this.formatRoomName(room).split('').reverse().join('')
      hue = ROOM_HUES[room] ?? 200
    } else {
      // Shuffled — room from wrong position
      scrambleType = 'shuffled'
      const shuffledIdx = (index + Math.floor(Math.random() * rooms.length)) % rooms.length
      const room = rooms[shuffledIdx]
      roomName = this.formatRoomName(room)
      hue = ROOM_HUES[room] ?? 200
    }

    return {
      roomName,
      actualRoom: rooms[index % rooms.length],
      hue,
      startTime: start,
      endTime: end,
      scrambleType,
      xOffset: (Math.random() - 0.5) * 60 * scrambleIntensity,
      glitchIntensity: scrambleIntensity * (0.3 + Math.random() * 0.7),
    }
  }

  private formatRoomName(room: string): string {
    // Convert 'palimpsestgallery' to 'the palimpsest gallery' etc.
    const names: Record<string, string> = {
      void: 'the void', study: 'the study', instrument: 'the instrument',
      observatory: 'the observatory', seance: 'the séance', darkroom: 'the darkroom',
      garden: 'the garden', archive: 'the archive', loom: 'the loom',
      tidepool: 'the tide pool', furnace: 'the furnace', radio: 'the radio',
      well: 'the well', clocktower: 'the clock tower', automaton: 'the automaton',
      seismograph: 'the seismograph', pendulum: 'the pendulum', cipher: 'the cipher',
      terrarium: 'the terrarium', lighthouse: 'the lighthouse', sketchpad: 'the sketchpad',
      weathervane: 'the weathervane', cartographer: 'the cartographer', choir: 'the choir',
      oracledeck: 'the oracle deck', labyrinth: 'the labyrinth', glacarium: 'the glacarium',
      satellite: 'the satellite', asteroids: 'the asteroid field',
      disintegration: 'the disintegration loops', projection: 'the projection room',
      datepaintings: 'the date paintings', madeleine: 'the madeleine',
      library: 'the library', palimpsestgallery: 'the palimpsest gallery',
      rememory: 'the rememory', catacombs: 'the catacombs', roots: 'the roots',
      ossuary: 'the ossuary', between: 'the between', aquifer: 'the aquifer',
      midnight: 'the midnight', mirror: 'the mirror',
    }
    return names[room] ?? room
  }

  private mergeNames(a: string, b: string): string {
    const nameA = this.formatRoomName(a)
    const nameB = this.formatRoomName(b)

    // Take first half of A and second half of B
    const midA = Math.floor(nameA.length * 0.5)
    const midB = Math.floor(nameB.length * 0.5)
    return nameA.slice(0, midA) + nameB.slice(midB)
  }

  private renderReplay(
    ctx: CanvasRenderingContext2D,
    w: number, h: number,
    now: number,
  ) {
    const bottomY = h - 30  // render near bottom, like REM eye movement trace

    let anyActive = false

    for (const flash of this.flashes) {
      if (now < flash.startTime || now > flash.endTime + FADE_OUT) continue
      anyActive = true

      // Calculate alpha with fade in/out
      let alpha: number
      if (now < flash.startTime + FADE_IN) {
        alpha = (now - flash.startTime) / FADE_IN
      } else if (now > flash.endTime) {
        alpha = 1 - (now - flash.endTime) / FADE_OUT
      } else {
        alpha = 1
      }
      alpha = Math.max(0, Math.min(1, alpha))

      // Base visibility is very subtle
      const baseAlpha = 0.12 * alpha

      // Color based on hue, scramble type affects saturation
      const sat = flash.scrambleType === 'correct' ? 40 : 60
      const lit = flash.scrambleType === 'correct' ? 65 : 55

      // Glitch jitter for scrambled entries
      const jitterX = flash.scrambleType !== 'correct'
        ? Math.sin(this.time * 15 + flash.hue) * flash.glitchIntensity * 3
        : 0
      const jitterY = flash.scrambleType !== 'correct'
        ? Math.cos(this.time * 12 + flash.hue * 0.7) * flash.glitchIntensity * 1.5
        : 0

      const x = w / 2 + flash.xOffset + jitterX
      const y = bottomY + jitterY

      // Room name text
      ctx.font = '13px "Cormorant Garamond", serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = `hsla(${flash.hue}, ${sat}%, ${lit}%, ${baseAlpha})`
      ctx.fillText(flash.roomName, x, y)

      // Scramble type indicator (very faint)
      if (flash.scrambleType !== 'correct' && alpha > 0.5) {
        ctx.font = '9px monospace'
        ctx.fillStyle = `hsla(${flash.hue}, 30%, 50%, ${baseAlpha * 0.3})`
        const indicator = flash.scrambleType === 'merged' ? '⊕'
          : flash.scrambleType === 'reversed' ? '↔'
          : flash.scrambleType === 'substituted' ? '≠'
          : '~'
        ctx.fillText(indicator, x, y + 12)
      }

      // Horizontal glitch tear for highly corrupted flashes
      if (flash.glitchIntensity > 0.6 && alpha > 0.3) {
        const tearW = 40 + flash.glitchIntensity * 80
        const tearH = 1
        const tearX = x - tearW / 2 + (Math.random() - 0.5) * 20
        ctx.fillStyle = `hsla(${flash.hue}, 50%, 60%, ${baseAlpha * 0.4})`
        ctx.fillRect(tearX, y - 8 + Math.random() * 4, tearW, tearH)
      }
    }

    // Scan line sweeps during replay
    if (anyActive) {
      this.scanLineY += 1.5
      if (this.scanLineY > h) this.scanLineY = -10

      ctx.fillStyle = 'rgba(200, 180, 140, 0.015)'
      ctx.fillRect(0, this.scanLineY, w, 1)
    }

    // Check if replay is done
    const lastFlash = this.flashes[this.flashes.length - 1]
    if (lastFlash && now > lastFlash.endTime + FADE_OUT + 500) {
      this.replayActive = false
      this.flashes = []
    }
  }
}
