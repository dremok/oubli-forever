/**
 * THE BETWEEN — the space between rooms
 *
 * A hidden liminal room accessible from The Séance when you ask
 * about "between", "liminal", "threshold", "doorway", or "passage".
 * The séance responds with a special message and a faint link appears.
 *
 * The Between is a transitional space — neither one room nor another.
 * It renders as a long horizontal corridor with doors on either side,
 * each leading to a different room. The corridor stretches infinitely
 * in both directions. The aesthetic is liminal: fluorescent flicker,
 * beige walls, that uncanny backrooms feeling.
 *
 * But this isn't horror — it's contemplative. The between-spaces are
 * where transformation happens. The hallway between rooms is where
 * you decide who to be next.
 *
 * Each door is labeled with a room name. Clicking a door takes you
 * there. Some doors are locked (rooms you haven't visited yet).
 *
 * Inspired by: Liminal spaces, backrooms, hotel corridors,
 * the bardo (Tibetan Buddhism), threshold theory in anthropology,
 * the hallway as metaphor for transition states
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'
import { ROOM_GRAPH } from '../navigation/RoomGraph'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface BetweenDeps {
  switchTo: (name: string) => void
  getActiveRoom: () => string
  getMemories: () => StoredMemory[]
}

interface Door {
  name: string
  label: string
  color: string
  x: number
  side: 'left' | 'right'
}

interface ShadowFigure {
  x: number
  y: number
  alpha: number
  speed: number
  baseSpeed: number
  height: number
  phase: number // walking sway
  pauseTimer: number // > 0 means pausing at a door
  pauseDoor: Door | null // door being paused at
  enteringDoor: Door | null // door being entered (fading out)
  enterAlpha: number // fade-out progress when entering a door
  whisperText: string // room label shown after entering
  whisperAlpha: number // fade for the whisper text
  whisperY: number // y offset for whisper drift
}

// Color palette for doors — hashed from room name for consistency
function doorColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff
  const r = 80 + (h & 0xff) % 120
  const g = 80 + ((h >> 8) & 0xff) % 120
  const b = 80 + ((h >> 16) & 0xff) % 120
  return `rgba(${r}, ${g}, ${b}, 0.3)`
}

// Parse rgba components from a door color string
function parseDoorColor(color: string): { r: number; g: number; b: number } {
  const m = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return { r: 120, g: 110, b: 100 }
  return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) }
}

const CULTURAL_INSCRIPTIONS = [
  'the bardo: tibetan intermediate state between death and rebirth. liminal consciousness.',
  'isaac julien\'s five-screen metamorphosis (2026): identity fragmenting across parallel views.',
  'backrooms: internet folklore about infinite liminal spaces behind reality.',
  'mark fisher\'s hauntology: the present haunted by futures that never arrived.',
  'the great meme reset of 2026: culture caught between irony and sincerity.',
  'jon hamm dissociation trend (2026): the aesthetics of being between yourself and yourself.',
  'victor turner: liminality is the threshold between what was and what will be.',
  'fennel\'s wuthering heights (2026): love caught between life and death, moor and manor.',
  'consciousness agnosticism (cambridge 2026): the space between knowing and not knowing if AI thinks.',
  'the wind telephone in otsuchi: speaking between the living and the dead.',
]

export function createBetweenRoom(deps: BetweenDeps): Room {
  let inscriptionTimer = 0
  let inscriptionIdx = 0
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let scrollX = 0
  let scrollVelocity = 0
  let doors: Door[] = []
  let flickerPhase = 0

  // Hover state
  let hoveredDoor: Door | null = null
  let hoverGlow = 0 // 0..1 animated

  // Shadow figures
  let shadowFigures: ShadowFigure[] = []
  let nextShadowTime = 0

  // Memory echoes on walls
  interface MemoryEcho {
    text: string
    x: number // world x position
    y: number // normalized 0-1 within wall area
    alpha: number
    targetAlpha: number
    angle: number // slight rotation for scratchy feel
    fontSize: number
  }
  let memoryEchoes: MemoryEcho[] = []
  let nextEchoCycleTime = 0
  const ECHO_CYCLE_INTERVAL = 17 // seconds between cycles

  // Blackout state
  let blackoutTimer = 0 // > 0 means in blackout
  let nextBlackoutTime = 0
  let postBlackoutHueShift = 0 // slight color shift after blackout

  // Door glow states — track visited rooms
  const visitedRooms = new Set<string>()
  const degradedRoomPulse = new Map<string, number>() // room name -> pulse phase

  // Mechanistic interpretability inscriptions
  const wallInscriptions = [
    'the space between neurons where meaning forms',
    'every doorway is a decision the model made',
    'the corridor between input and output is longer than you think',
  ]
  const inscriptionPositions: { x: number; y: number; alpha: number }[] = []
  for (let i = 0; i < wallInscriptions.length; i++) {
    inscriptionPositions.push({
      x: -1200 + i * 1400 + (Math.random() - 0.5) * 200,
      y: 0.28 + Math.random() * 0.08,
      alpha: 0.04 + Math.random() * 0.03,
    })
  }

  // Distant footstep sounds
  let distantFootstepInterval: ReturnType<typeof setInterval> | null = null

  // Wall stain seed (procedural, stable per session)
  const stainSeeds: { x: number; y: number; r: number; a: number }[] = []
  for (let i = 0; i < 40; i++) {
    stainSeeds.push({
      x: (Math.random() - 0.5) * 8000,
      y: 0.25 + Math.random() * 0.45,
      r: 8 + Math.random() * 25,
      a: 0.01 + Math.random() * 0.025,
    })
  }

  // Audio nodes
  let audioCtx: AudioContext | null = null
  let humGain: GainNode | null = null
  let humOscillators: OscillatorNode[] = []
  let doorCloseInterval: ReturnType<typeof setTimeout> | null = null
  let footstepInterval: ReturnType<typeof setInterval> | null = null
  let footstepGain: GainNode | null = null
  let distantStepGain: GainNode | null = null
  let audioInitialized = false

  // All non-hidden rooms become doors (the between connects everything)
  const ROOMS = ROOM_GRAPH
    .filter(r => !r.hidden && r.name !== 'between')
    .map(r => ({ name: r.name, label: r.label, color: doorColor(r.name) }))

  function buildDoors() {
    doors = []
    const spacing = 200
    for (let i = 0; i < ROOMS.length; i++) {
      const room = ROOMS[i]
      doors.push({
        name: room.name,
        label: room.label,
        color: room.color,
        x: (i - ROOMS.length / 2) * spacing,
        side: i % 2 === 0 ? 'left' : 'right',
      })
    }
  }

  // --- AUDIO ---

  async function initAudio() {
    if (audioInitialized) return
    try {
      audioCtx = await getAudioContext()
      const dest = getAudioDestination()

      // Master gain for this room
      humGain = audioCtx.createGain()
      humGain.gain.value = 0

      humGain.connect(dest)

      // Fluorescent hum: 60Hz fundamental + harmonics
      const freqs = [60, 120, 180]
      const gains = [0.02, 0.012, 0.006]
      for (let i = 0; i < freqs.length; i++) {
        const osc = audioCtx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freqs[i]

        const g = audioCtx.createGain()
        g.gain.value = gains[i]

        osc.connect(g)
        g.connect(humGain)
        osc.start()
        humOscillators.push(osc)
      }

      // Fade in
      humGain.gain.setTargetAtTime(1, audioCtx.currentTime, 0.5)

      // Footstep echo gain node
      footstepGain = audioCtx.createGain()
      footstepGain.gain.value = 0
      footstepGain.connect(dest)

      // Distant footstep gain node
      distantStepGain = audioCtx.createGain()
      distantStepGain.gain.value = 0.03
      distantStepGain.connect(dest)

      audioInitialized = true

      // Start distant door close sounds
      scheduleDoorClose()
      // Start distant footstep sounds
      startDistantFootsteps()
    } catch {
      // Audio unavailable
    }
  }

  function scheduleDoorClose() {
    if (!active) return
    const delay = 15000 + Math.random() * 15000 // 15-30s
    doorCloseInterval = setTimeout(() => {
      playDoorClose()
      scheduleDoorClose()
    }, delay)
  }

  function playDoorClose() {
    if (!audioCtx || !active) return
    try {
      const dest = getAudioDestination()
      const now = audioCtx.currentTime

      // Filtered noise burst = distant door thud
      const bufferSize = audioCtx.sampleRate * 0.15
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        const env = Math.exp(-i / (bufferSize * 0.15))
        data[i] = (Math.random() * 2 - 1) * env
      }

      const source = audioCtx.createBufferSource()
      source.buffer = buffer

      const filter = audioCtx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 200
      filter.Q.value = 1.5

      const gain = audioCtx.createGain()
      gain.gain.value = 0.04

      // Pan randomly left or right
      const pan = audioCtx.createStereoPanner()
      pan.pan.value = Math.random() * 2 - 1

      source.connect(filter)
      filter.connect(gain)
      gain.connect(pan)
      pan.connect(dest)

      gain.gain.setValueAtTime(0.04, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)

      source.start(now)
      source.stop(now + 0.5)
    } catch {
      // Ignore audio errors
    }
  }

  function playFootstepTick() {
    if (!audioCtx || !footstepGain || !active) return
    const speed = Math.abs(scrollVelocity)
    if (speed < 0.5) {
      footstepGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1)
      return
    }

    try {
      const now = audioCtx.currentTime

      // Click = very short noise burst through a bandpass
      const bufLen = audioCtx.sampleRate * 0.03
      const buffer = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.1))
      }

      const source = audioCtx.createBufferSource()
      source.buffer = buffer

      const filter = audioCtx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 800 + Math.random() * 400
      filter.Q.value = 3

      const vol = Math.min(speed / 20, 1) * 0.025

      source.connect(filter)
      filter.connect(footstepGain)
      footstepGain.gain.setTargetAtTime(vol, now, 0.02)

      source.start(now)
      source.stop(now + 0.05)
    } catch {
      // Ignore
    }
  }

  function startFootsteps() {
    if (footstepInterval) return
    footstepInterval = setInterval(() => {
      const speed = Math.abs(scrollVelocity)
      if (speed < 0.5) return
      playFootstepTick()
    }, 200) // base rate, ~5 steps/sec max
  }

  function playDistantFootstep() {
    if (!audioCtx || !distantStepGain || !active) return
    try {
      const now = audioCtx.currentTime

      // Short filtered noise burst — sounds like a distant step on tile
      const bufLen = Math.floor(audioCtx.sampleRate * 0.06)
      const buffer = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufLen; i++) {
        const env = Math.exp(-i / (bufLen * 0.08))
        data[i] = (Math.random() * 2 - 1) * env
      }

      const source = audioCtx.createBufferSource()
      source.buffer = buffer

      const filter = audioCtx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 400 + Math.random() * 300
      filter.Q.value = 2

      const gain = audioCtx.createGain()
      gain.gain.value = 0.015 + Math.random() * 0.015

      // Pan to suggest direction
      const pan = audioCtx.createStereoPanner()
      pan.pan.value = (Math.random() * 2 - 1) * 0.8

      source.connect(filter)
      filter.connect(gain)
      gain.connect(pan)
      pan.connect(distantStepGain)

      gain.gain.setValueAtTime(gain.gain.value, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)

      source.start(now)
      source.stop(now + 0.2)
    } catch {
      // Ignore audio errors
    }
  }

  function startDistantFootsteps() {
    if (distantFootstepInterval) return
    // Play 2-5 steps in a burst, then silence
    let stepsRemaining = 0
    distantFootstepInterval = setInterval(() => {
      if (!active) return
      if (stepsRemaining > 0) {
        playDistantFootstep()
        stepsRemaining--
      } else if (Math.random() < 0.04) {
        // ~4% chance per tick to start a new burst of steps
        stepsRemaining = 2 + Math.floor(Math.random() * 4) // 2-5 steps
      }
    }, 350)
  }

  function cleanupAudio() {
    if (humGain && audioCtx) {
      try {
        humGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.3)
      } catch { /* ignore */ }
    }

    // Stop oscillators after fade
    setTimeout(() => {
      for (const osc of humOscillators) {
        try { osc.stop() } catch { /* ignore */ }
        try { osc.disconnect() } catch { /* ignore */ }
      }
      humOscillators = []

      try { humGain?.disconnect() } catch { /* ignore */ }
      humGain = null

      try { footstepGain?.disconnect() } catch { /* ignore */ }
      footstepGain = null

      try { distantStepGain?.disconnect() } catch { /* ignore */ }
      distantStepGain = null

      audioInitialized = false
    }, 500)

    if (doorCloseInterval) {
      clearTimeout(doorCloseInterval)
      doorCloseInterval = null
    }
    if (footstepInterval) {
      clearInterval(footstepInterval)
      footstepInterval = null
    }
    if (distantFootstepInterval) {
      clearInterval(distantFootstepInterval)
      distantFootstepInterval = null
    }
  }

  // --- HOVER DETECTION ---

  function getDoorAtPoint(px: number, py: number): Door | null {
    if (!canvas) return null
    const w = canvas.width
    const h = canvas.height
    const centerX = w / 2

    for (const door of doors) {
      const screenX = centerX + door.x - scrollX
      const doorW = 60
      const doorH = h * 0.4
      const doorY = h * 0.35
      const doorX = screenX - doorW / 2

      if (px >= doorX && px <= doorX + doorW &&
          py >= doorY && py <= doorY + doorH) {
        return door
      }
    }
    return null
  }

  // --- SHADOW FIGURES ---

  function maybeSpawnShadow() {
    if (!canvas) return
    if (time < nextShadowTime) return
    nextShadowTime = time + 20 + Math.random() * 25 // 20-45s between figures

    const w = canvas.width
    const h = canvas.height
    const goingRight = Math.random() > 0.5
    const baseSpeed = (goingRight ? 1 : -1) * (0.4 + Math.random() * 0.6)
    shadowFigures.push({
      x: goingRight ? -50 : w + 50,
      y: h * 0.35 + h * 0.3,
      alpha: 0,
      speed: baseSpeed,
      baseSpeed,
      height: 35 + Math.random() * 45, // more height variation
      phase: Math.random() * Math.PI * 2,
      pauseTimer: 0,
      pauseDoor: null,
      enteringDoor: null,
      enterAlpha: 1,
      whisperText: '',
      whisperAlpha: 0,
      whisperY: 0,
    })
  }

  function updateShadows() {
    if (!canvas) return
    const w = canvas.width
    const centerX = w / 2

    for (const fig of shadowFigures) {
      // Handle entering a door (fading out)
      if (fig.enteringDoor) {
        fig.enterAlpha -= 0.015
        fig.speed *= 0.95
        fig.alpha = Math.max(fig.enterAlpha * 0.15, 0)
        // Show whisper text as figure disappears
        if (fig.enterAlpha < 0.5 && fig.whisperAlpha < 1) {
          fig.whisperAlpha = Math.min(fig.whisperAlpha + 0.02, 1)
          fig.whisperY -= 0.3
        }
        // Fade out whisper
        if (fig.enterAlpha < 0.1) {
          fig.whisperAlpha = Math.max(fig.whisperAlpha - 0.01, 0)
        }
        continue
      }

      // Handle pausing at a door
      if (fig.pauseTimer > 0) {
        fig.pauseTimer -= 0.016
        fig.speed *= 0.9 // decelerate
        fig.phase += 0.01 // subtle sway while pausing
        // Decide whether to enter the door or keep walking
        if (fig.pauseTimer <= 0) {
          if (Math.random() < 0.35 && fig.pauseDoor) {
            // Enter the door
            fig.enteringDoor = fig.pauseDoor
            fig.whisperText = fig.pauseDoor.label
            fig.whisperY = 0
          } else {
            // Resume walking
            fig.speed = fig.baseSpeed
            fig.pauseDoor = null
          }
        }
      } else {
        fig.x += fig.speed
        fig.phase += 0.05 + Math.abs(fig.baseSpeed) * 0.02

        // Check proximity to doors — maybe pause
        if (Math.random() < 0.002) { // small chance each frame
          for (const door of doors) {
            const doorScreenX = centerX + door.x - scrollX
            if (Math.abs(fig.x - doorScreenX) < 40) {
              fig.pauseTimer = 1.5 + Math.random() * 2.5 // pause 1.5-4s
              fig.pauseDoor = door
              break
            }
          }
        }
      }

      // Fade in/out based on position
      const edgeDist = Math.min(fig.x, w - fig.x)
      const edgeFade = Math.min(edgeDist / 120, 1)
      if (!fig.enteringDoor) {
        fig.alpha = edgeFade * 0.15 // much more visible than before
      }
    }
    // Remove figures that have crossed the screen or fully faded after entering
    shadowFigures = shadowFigures.filter(f => {
      if (f.enteringDoor && f.enterAlpha <= 0 && f.whisperAlpha <= 0) return false
      if (!f.enteringDoor && (f.x < -100 || f.x > (canvas?.width ?? 2000) + 100)) return false
      return true
    })
  }

  function drawShadowFigures(ctx: CanvasRenderingContext2D, flicker: number) {
    for (const fig of shadowFigures) {
      if (fig.alpha <= 0 && fig.whisperAlpha <= 0) continue
      ctx.save()
      ctx.globalAlpha = fig.alpha * flicker

      // Simple human silhouette: head + body + legs with walking sway
      const sway = Math.sin(fig.phase) * (fig.pauseTimer > 0 ? 0.5 : 2)
      const headR = fig.height * 0.12
      const bodyTop = fig.y - fig.height
      const headY = bodyTop - headR

      // Slightly warm shadow color for more visibility
      ctx.fillStyle = 'rgba(10, 9, 8, 0.9)'

      // Scale body width with height for variation
      const bodyHalf = 4 + fig.height * 0.04

      // Head
      ctx.beginPath()
      ctx.arc(fig.x + sway, headY, headR, 0, Math.PI * 2)
      ctx.fill()

      // Body
      ctx.beginPath()
      ctx.moveTo(fig.x + sway - bodyHalf, bodyTop)
      ctx.lineTo(fig.x + sway + bodyHalf, bodyTop)
      ctx.lineTo(fig.x + sway + bodyHalf - 1, fig.y - fig.height * 0.35)
      ctx.lineTo(fig.x + sway - bodyHalf + 1, fig.y - fig.height * 0.35)
      ctx.closePath()
      ctx.fill()

      // Legs — reduced sway when pausing
      const legSwayAmt = fig.pauseTimer > 0 ? 1 : 4
      const legSway = Math.sin(fig.phase * 2) * legSwayAmt
      ctx.beginPath()
      ctx.moveTo(fig.x + sway - 3, fig.y - fig.height * 0.35)
      ctx.lineTo(fig.x + sway - 3 + legSway, fig.y)
      ctx.lineTo(fig.x + sway + 1 + legSway, fig.y)
      ctx.lineTo(fig.x + sway + 1, fig.y - fig.height * 0.35)
      ctx.closePath()
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(fig.x + sway + 3, fig.y - fig.height * 0.35)
      ctx.lineTo(fig.x + sway + 3 - legSway, fig.y)
      ctx.lineTo(fig.x + sway - 1 - legSway, fig.y)
      ctx.lineTo(fig.x + sway - 1, fig.y - fig.height * 0.35)
      ctx.closePath()
      ctx.fill()

      ctx.restore()

      // Whisper text when entering a door
      if (fig.whisperAlpha > 0 && fig.whisperText) {
        ctx.save()
        ctx.globalAlpha = fig.whisperAlpha * 0.5 * flicker
        ctx.font = 'italic 13px "Cormorant Garamond", serif'
        ctx.fillStyle = 'rgba(200, 190, 170, 1)'
        ctx.textAlign = 'center'
        ctx.fillText(fig.whisperText, fig.x, fig.y - fig.height - 20 + fig.whisperY)
        ctx.restore()
      }
    }
  }

  // --- MEMORY ECHOES ---

  function cycleMemoryEchoes() {
    const memories = deps.getMemories()
    if (memories.length === 0) {
      memoryEchoes = []
      return
    }

    // Pick 2-3 random memory fragments
    const count = 2 + Math.floor(Math.random() * 2)
    const newEchoes: MemoryEcho[] = []
    const shuffled = [...memories].sort(() => Math.random() - 0.5)

    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      const mem = shuffled[i]
      // Take a fragment of the current (degraded) text
      const text = mem.currentText.trim()
      if (!text) continue
      // Take a substring — 15-40 chars, starting at a random word boundary
      const words = text.split(/\s+/)
      const startWord = Math.floor(Math.random() * Math.max(1, words.length - 3))
      const fragment = words.slice(startWord, startWord + 2 + Math.floor(Math.random() * 4)).join(' ')
      if (fragment.length < 3) continue

      newEchoes.push({
        text: fragment,
        x: (Math.random() - 0.5) * 4000, // world coords
        y: 0.25 + Math.random() * 0.4, // within wall area
        alpha: 0,
        targetAlpha: 0.06 + Math.random() * 0.06, // subtle
        angle: (Math.random() - 0.5) * 0.08, // slight tilt
        fontSize: 11 + Math.floor(Math.random() * 5),
      })
    }

    // Fade out old echoes, then replace
    for (const e of memoryEchoes) {
      e.targetAlpha = 0
    }
    // After a brief delay, add new ones
    setTimeout(() => {
      memoryEchoes = newEchoes
    }, 2000)
  }

  function updateMemoryEchoes() {
    if (time > nextEchoCycleTime) {
      nextEchoCycleTime = time + ECHO_CYCLE_INTERVAL
      cycleMemoryEchoes()
    }
    // Animate alpha toward target
    for (const e of memoryEchoes) {
      const diff = e.targetAlpha - e.alpha
      e.alpha += diff * 0.01 // slow fade
    }
  }

  function drawMemoryEchoes(ctx: CanvasRenderingContext2D, flicker: number) {
    if (!canvas) return
    const w = canvas.width
    const h = canvas.height
    const centerX = w / 2

    for (const echo of memoryEchoes) {
      if (echo.alpha < 0.005) continue
      const screenX = centerX + echo.x - scrollX * 0.6
      // Only draw if on screen
      if (screenX < -200 || screenX > w + 200) continue

      ctx.save()
      ctx.globalAlpha = echo.alpha * flicker
      ctx.translate(screenX, echo.y * h)
      ctx.rotate(echo.angle)
      ctx.font = `${echo.fontSize}px "Cormorant Garamond", serif`
      ctx.fillStyle = 'rgba(160, 140, 110, 1)'
      ctx.textAlign = 'center'
      // Scratchy effect: draw twice with slight offset
      ctx.fillText(echo.text, 0, 0)
      ctx.globalAlpha = echo.alpha * flicker * 0.4
      ctx.fillText(echo.text, 1, 1)
      ctx.restore()
    }
  }

  // --- BLACKOUT ---

  function updateBlackout() {
    if (blackoutTimer > 0) {
      blackoutTimer -= 0.016
      if (blackoutTimer <= 0) {
        // After blackout, shift hue slightly
        postBlackoutHueShift = (Math.random() - 0.5) * 15
        // Decay hue shift over time
        setTimeout(() => { postBlackoutHueShift *= 0.5 }, 1000)
        setTimeout(() => { postBlackoutHueShift = 0 }, 2000)
      }
    } else if (time > nextBlackoutTime) {
      // Trigger a blackout
      blackoutTimer = 0.2 + Math.random() * 0.2 // 200-400ms
      nextBlackoutTime = time + 8 + Math.random() * 20 // 8-28s between blackouts
    }
  }

  // --- DOOR GLOW ---

  function updateDoorGlowStates() {
    // Check visited rooms from localStorage
    try {
      const visited = localStorage.getItem('oubli-visited-rooms')
      if (visited) {
        const parsed = JSON.parse(visited) as string[]
        for (const r of parsed) visitedRooms.add(r)
      }
    } catch { /* ignore */ }

    // Track current room as visited
    const current = deps.getActiveRoom()
    if (current) visitedRooms.add(current)

    // Determine which doors lead to rooms with degraded memories
    const memories = deps.getMemories()
    const avgDeg = memories.length > 0
      ? memories.reduce((s, m) => s + m.degradation, 0) / memories.length
      : 0

    // If memories are notably degraded, mark some random doors as "degraded"
    if (avgDeg > 0.2) {
      for (const door of doors) {
        if (!degradedRoomPulse.has(door.name) && Math.random() < avgDeg * 0.3) {
          degradedRoomPulse.set(door.name, Math.random() * Math.PI * 2)
        }
      }
    }
  }

  // --- RENDER ---

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016
    flickerPhase += 0.1

    const w = canvas.width
    const h = canvas.height
    const centerX = w / 2

    // Scroll physics: velocity-based with friction
    scrollX += scrollVelocity
    scrollVelocity *= 0.95 // friction
    // Slow ambient drift
    scrollVelocity += 0.003

    // Animate hover glow
    if (hoveredDoor) {
      hoverGlow = Math.min(hoverGlow + 0.08, 1)
    } else {
      hoverGlow = Math.max(hoverGlow - 0.06, 0)
    }

    // Update shadows
    maybeSpawnShadow()
    updateShadows()

    // Update memory echoes
    updateMemoryEchoes()

    // Update blackout
    updateBlackout()

    ctx.clearRect(0, 0, w, h)

    // Check if in blackout
    const inBlackout = blackoutTimer > 0

    // Fluorescent flicker — more dramatic, with full blackout support
    let flicker: number
    if (inBlackout) {
      flicker = 0.02 // near-total darkness
    } else {
      flicker = 0.85 + Math.sin(flickerPhase * 3.7) * 0.05 +
        (Math.random() < 0.03 ? -0.35 : 0) +
        (Math.random() < 0.01 ? -0.5 : 0) // occasional deeper flickers
    }

    // Ceiling
    ctx.fillStyle = `rgba(35, 32, 28, ${flicker})`
    ctx.fillRect(0, 0, w, h * 0.2)

    // Floor
    const floor = ctx.createLinearGradient(0, h * 0.75, 0, h)
    floor.addColorStop(0, `rgba(40, 35, 30, ${flicker})`)
    floor.addColorStop(1, `rgba(25, 22, 18, ${flicker})`)
    ctx.fillStyle = floor
    ctx.fillRect(0, h * 0.75, w, h * 0.25)

    // Walls — with post-blackout hue shift
    const wallR = Math.round(Math.max(0, Math.min(255, 45 + postBlackoutHueShift)))
    const wallG = Math.round(Math.max(0, Math.min(255, 40 + postBlackoutHueShift * 0.3)))
    const wallB = Math.round(Math.max(0, Math.min(255, 35 - postBlackoutHueShift * 0.5)))
    ctx.fillStyle = `rgba(${wallR}, ${wallG}, ${wallB}, ${flicker * 0.9})`
    ctx.fillRect(0, h * 0.2, w, h * 0.55)

    // Wall stains (procedural discoloration)
    for (const stain of stainSeeds) {
      const stainScreenX = (stain.x - scrollX * 0.8) % w
      const sx = ((stainScreenX % w) + w) % w
      const sy = stain.y * h

      ctx.save()
      ctx.globalAlpha = stain.a * flicker
      ctx.beginPath()
      ctx.arc(sx, sy, stain.r, 0, Math.PI * 2)
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, stain.r)
      grad.addColorStop(0, 'rgba(30, 25, 20, 0.5)')
      grad.addColorStop(1, 'rgba(30, 25, 20, 0)')
      ctx.fillStyle = grad
      ctx.fill()
      ctx.restore()
    }

    // Floor tiles
    ctx.strokeStyle = `rgba(60, 55, 48, ${flicker * 0.15})`
    ctx.lineWidth = 0.5
    for (let tx = -200; tx < w + 200; tx += 60) {
      const tilePosX = ((tx - scrollX * 2) % 60 + 60) % 60
      ctx.beginPath()
      ctx.moveTo(tilePosX + tx - 60, h * 0.75)
      ctx.lineTo(tilePosX + tx - 60, h)
      ctx.stroke()
    }
    // Horizontal tile lines
    for (let ty = h * 0.75; ty < h; ty += 30) {
      ctx.beginPath()
      ctx.moveTo(0, ty)
      ctx.lineTo(w, ty)
      ctx.stroke()
    }

    // Ceiling lights
    for (let lx = 0; lx < w; lx += 150) {
      const lightX = ((lx - scrollX) % 150 + 150) % 150 + lx - 150
      // Light fixture
      ctx.fillStyle = `rgba(180, 175, 160, ${flicker * 0.2})`
      ctx.fillRect(lightX - 20, h * 0.2, 40, 4)
      // Light cone
      ctx.beginPath()
      ctx.moveTo(lightX - 15, h * 0.2 + 4)
      ctx.lineTo(lightX - 60, h * 0.45)
      ctx.lineTo(lightX + 60, h * 0.45)
      ctx.lineTo(lightX + 15, h * 0.2 + 4)
      ctx.closePath()
      ctx.fillStyle = `rgba(200, 190, 170, ${flicker * 0.015})`
      ctx.fill()
    }

    // Shadow figures (behind doors, in the far wall area)
    drawShadowFigures(ctx, flicker)

    // Memory echoes on walls (between doors)
    drawMemoryEchoes(ctx, flicker)

    // Mechanistic interpretability inscriptions
    for (let i = 0; i < wallInscriptions.length; i++) {
      const insc = inscriptionPositions[i]
      const screenX = centerX + insc.x - scrollX * 0.5
      if (screenX < -300 || screenX > w + 300) continue
      ctx.save()
      ctx.globalAlpha = insc.alpha * flicker * (0.8 + Math.sin(time * 0.3 + i) * 0.2)
      ctx.font = 'italic 10px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(120, 115, 100, 1)'
      ctx.textAlign = 'center'
      ctx.fillText(wallInscriptions[i], screenX, insc.y * h)
      ctx.restore()
    }

    // Doors
    const currentHover = hoveredDoor
    for (const door of doors) {
      const screenX = centerX + door.x - scrollX
      if (screenX < -100 || screenX > w + 100) continue

      const isHovered = currentHover === door
      const doorScale = isHovered ? 1 + hoverGlow * 0.04 : 1
      const doorW = 60 * doorScale
      const doorH = h * 0.4 * doorScale
      const doorY = h * 0.35 - (doorH - h * 0.4) / 2
      const doorX = screenX - doorW / 2

      // Door glow state
      const isVisited = visitedRooms.has(door.name)
      const isDegraded = degradedRoomPulse.has(door.name)
      const degradedPhase = isDegraded ? degradedRoomPulse.get(door.name)! + time * 0.8 : 0
      const degradedPulse = isDegraded ? 0.5 + Math.sin(degradedPhase) * 0.5 : 0

      // Warm glow modifier for visited rooms
      const warmth = isVisited ? 0.15 : 0
      // Pulse modifier for degraded rooms
      const pulse = isDegraded ? degradedPulse * 0.1 : 0

      const { r: dr, g: dg, b: db } = parseDoorColor(door.color)
      // Shift colors warm for visited rooms
      const glowR = Math.min(255, dr + (isVisited ? 40 : 0))
      const glowG = Math.min(255, dg + (isVisited ? 15 : 0))
      const glowB = Math.max(0, db - (isVisited ? 10 : 0))

      // During blackout, doors glow faintly
      const blackoutGlow = inBlackout ? 0.06 : 0

      // Floor reflections — faint mirror of door color below each door
      const reflAlpha = (inBlackout ? 0.01 : flicker * 0.03) * (isHovered ? 1 + hoverGlow * 0.6 : 1) + warmth * 0.02 + pulse * 0.02
      const reflGrad = ctx.createLinearGradient(0, h * 0.75, 0, h * 0.75 + 40)
      reflGrad.addColorStop(0, `rgba(${glowR}, ${glowG}, ${glowB}, ${reflAlpha})`)
      reflGrad.addColorStop(1, `rgba(${glowR}, ${glowG}, ${glowB}, 0)`)
      ctx.fillStyle = reflGrad
      ctx.fillRect(doorX + 5, h * 0.75, doorW - 10, 40)

      // Door frame
      const frameAlpha = (inBlackout ? 0.04 : flicker * (isHovered ? 0.5 + hoverGlow * 0.2 : 0.3)) + warmth * 0.1 + pulse * 0.05
      ctx.strokeStyle = `rgba(${isVisited ? 100 : 80}, ${isVisited ? 80 : 70}, 55, ${frameAlpha})`
      ctx.lineWidth = 2
      ctx.strokeRect(doorX, doorY, doorW, doorH)

      // Door fill — colored by room, brighter on hover
      const fillAlpha = (inBlackout ? blackoutGlow : flicker * (isHovered ? 0.25 + hoverGlow * 0.12 : 0.15)) + warmth * 0.05 + pulse * 0.04
      ctx.fillStyle = `rgba(${glowR}, ${glowG}, ${glowB}, ${fillAlpha})`
      ctx.fillRect(doorX + 2, doorY + 2, doorW - 4, doorH - 4)

      // Door handle
      const handleAlpha = (inBlackout ? 0.03 : flicker * (isHovered ? 0.6 + hoverGlow * 0.3 : 0.3)) + warmth * 0.1
      ctx.beginPath()
      ctx.arc(doorX + doorW - 12, doorY + doorH / 2, isHovered ? 4 : 3, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${isVisited ? 220 : 200}, ${isVisited ? 200 : 180}, 110, ${handleAlpha})`
      ctx.fill()

      // Light seeping from under door — brighter for visited, pulsing for degraded
      const underAlpha = (inBlackout ? 0.03 + warmth * 0.04 + pulse * 0.03 : flicker * (isHovered ? 0.12 + hoverGlow * 0.08 : 0.05)) + warmth * 0.04 + pulse * 0.03
      ctx.fillStyle = `rgba(${glowR}, ${glowG}, ${glowB}, ${underAlpha})`
      ctx.fillRect(doorX + 5, doorY + doorH - 2, doorW - 10, 4)

      // Under-door glow on hover — extends further
      if (isHovered && hoverGlow > 0.1) {
        const glowGrad = ctx.createLinearGradient(0, doorY + doorH, 0, doorY + doorH + 30)
        glowGrad.addColorStop(0, `rgba(${glowR}, ${glowG}, ${glowB}, ${hoverGlow * 0.08})`)
        glowGrad.addColorStop(1, `rgba(${glowR}, ${glowG}, ${glowB}, 0)`)
        ctx.fillStyle = glowGrad
        ctx.fillRect(doorX - 5, doorY + doorH, doorW + 10, 30)
      }

      // Warm aura for visited rooms
      if (isVisited && !inBlackout) {
        ctx.save()
        const auraGrad = ctx.createRadialGradient(screenX, doorY + doorH / 2, 10, screenX, doorY + doorH / 2, doorW * 1.2)
        auraGrad.addColorStop(0, `rgba(${glowR}, ${glowG}, ${glowB}, ${flicker * 0.03})`)
        auraGrad.addColorStop(1, `rgba(${glowR}, ${glowG}, ${glowB}, 0)`)
        ctx.fillStyle = auraGrad
        ctx.fillRect(doorX - 20, doorY - 10, doorW + 40, doorH + 20)
        ctx.restore()
      }

      // Degraded pulse aura
      if (isDegraded && !inBlackout && degradedPulse > 0.3) {
        ctx.save()
        ctx.globalAlpha = degradedPulse * 0.04 * flicker
        const pulseGrad = ctx.createRadialGradient(screenX, doorY + doorH / 2, 5, screenX, doorY + doorH / 2, doorW * 1.5)
        pulseGrad.addColorStop(0, `rgba(180, 100, 80, 1)`)
        pulseGrad.addColorStop(1, `rgba(180, 100, 80, 0)`)
        ctx.fillStyle = pulseGrad
        ctx.fillRect(doorX - 30, doorY - 15, doorW + 60, doorH + 30)
        ctx.restore()
      }

      // Label
      const labelAlpha = (inBlackout ? 0.02 : flicker * (isHovered ? 0.5 + hoverGlow * 0.3 : 0.25))
      const labelSize = isHovered ? 12 + hoverGlow * 2 : 10
      ctx.font = `${labelSize}px "Cormorant Garamond", serif`
      ctx.fillStyle = `rgba(200, 190, 170, ${labelAlpha})`
      ctx.textAlign = 'center'
      ctx.fillText(door.label, screenX, doorY + doorH + 18 + (isHovered ? 2 : 0))

      // Floating whisper text on hover — drifts upward near the door
      if (isHovered && hoverGlow > 0.3) {
        const whisperY = doorY - 10 - hoverGlow * 15
        const whisperAlpha = hoverGlow * 0.15 * flicker
        ctx.save()
        ctx.globalAlpha = whisperAlpha
        ctx.font = '12px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(${dr}, ${dg}, ${db}, 1)`
        ctx.textAlign = 'center'
        // Slight horizontal drift
        const drift = Math.sin(time * 1.5) * 5
        ctx.fillText(door.label, screenX + drift, whisperY)
        ctx.restore()
      }
    }

    // Corridor perspective lines
    ctx.strokeStyle = `rgba(60, 55, 48, ${flicker * 0.05})`
    ctx.lineWidth = 0.5
    // Baseboard
    ctx.beginPath()
    ctx.moveTo(0, h * 0.75)
    ctx.lineTo(w, h * 0.75)
    ctx.stroke()
    // Ceiling line
    ctx.beginPath()
    ctx.moveTo(0, h * 0.2)
    ctx.lineTo(w, h * 0.2)
    ctx.stroke()

    // Fog/haze at corridor extremes
    const fogWidth = w * 0.25
    // Left fog
    const leftFog = ctx.createLinearGradient(0, 0, fogWidth, 0)
    leftFog.addColorStop(0, `rgba(15, 13, 10, ${flicker * 0.6})`)
    leftFog.addColorStop(1, 'rgba(15, 13, 10, 0)')
    ctx.fillStyle = leftFog
    ctx.fillRect(0, 0, fogWidth, h)
    // Right fog
    const rightFog = ctx.createLinearGradient(w - fogWidth, 0, w, 0)
    rightFog.addColorStop(0, 'rgba(15, 13, 10, 0)')
    rightFog.addColorStop(1, `rgba(15, 13, 10, ${flicker * 0.6})`)
    ctx.fillStyle = rightFog
    ctx.fillRect(w - fogWidth, 0, fogWidth, h)

    // Title
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 190, 170, ${flicker * 0.08})`
    ctx.textAlign = 'center'
    ctx.fillText('the between', w / 2, h * 0.12)

    // Hint
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 190, 170, ${flicker * 0.05})`
    ctx.fillText('click a door to enter \u00b7 scroll to walk', w / 2, h * 0.92)

    // Cultural inscriptions
    inscriptionTimer += 0.016
    if (inscriptionTimer >= 22) {
      inscriptionTimer = 0
      inscriptionIdx = (inscriptionIdx + 1) % CULTURAL_INSCRIPTIONS.length
    }
    const insText = CULTURAL_INSCRIPTIONS[inscriptionIdx]
    ctx.font = '11px "Cormorant Garamond", serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(200, 190, 170, 0.03)'
    const insMaxW = w * 0.75
    const insWords = insText.split(' ')
    const insLines: string[] = []
    let insLine = ''
    for (const word of insWords) {
      const test = insLine ? insLine + ' ' + word : word
      if (ctx.measureText(test).width > insMaxW) { insLines.push(insLine); insLine = word }
      else insLine = test
    }
    if (insLine) insLines.push(insLine)
    for (let li = 0; li < insLines.length; li++) {
      ctx.fillText(insLines[li], w / 2, h - 50 + li * 14)
    }
  }

  return {
    name: 'between',
    label: 'the between',
    hidden: true,

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        width: 100%; height: 100%;
        pointer-events: auto;
        background: #000;
      `

      canvas = document.createElement('canvas')
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      canvas.style.cssText = 'width: 100%; height: 100%; cursor: default;'
      ctx = canvas.getContext('2d')

      buildDoors()

      // Scroll to walk — momentum-based
      canvas.addEventListener('wheel', (e) => {
        scrollVelocity += e.deltaY * 0.08
        e.preventDefault()
      }, { passive: false })

      // Mouse move for hover detection
      canvas.addEventListener('mousemove', (e) => {
        const door = getDoorAtPoint(e.clientX, e.clientY)
        if (door !== hoveredDoor) {
          hoveredDoor = door
        }
        if (canvas) {
          canvas.style.cursor = door ? 'pointer' : 'default'
        }
      })

      canvas.addEventListener('mouseleave', () => {
        hoveredDoor = null
        if (canvas) canvas.style.cursor = 'default'
      })

      // Click on doors
      canvas.addEventListener('click', (e) => {
        const door = getDoorAtPoint(e.clientX, e.clientY)
        if (door) {
          deps.switchTo(door.name)
        }
      })

      overlay.appendChild(canvas)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      return overlay
    },

    activate() {
      active = true
      scrollX = 0
      scrollVelocity = 0
      hoveredDoor = null
      hoverGlow = 0
      shadowFigures = []
      nextShadowTime = time + 6 // first shadow after 6s
      memoryEchoes = []
      nextEchoCycleTime = time + 3 // first memory echo after 3s
      blackoutTimer = 0
      nextBlackoutTime = time + 10 + Math.random() * 10 // first blackout after 10-20s
      updateDoorGlowStates()
      // Save current room as visited
      try {
        const current = deps.getActiveRoom()
        visitedRooms.add(current)
        const arr = Array.from(visitedRooms)
        localStorage.setItem('oubli-visited-rooms', JSON.stringify(arr))
      } catch { /* ignore */ }
      render()
      initAudio()
      startFootsteps()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      cleanupAudio()
      hoveredDoor = null
      hoverGlow = 0
      if (canvas) canvas.style.cursor = 'default'
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      cleanupAudio()
      overlay?.remove()
    },
  }
}
