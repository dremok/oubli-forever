/**
 * THE LABYRINTH — infinite, generative, forgetting
 *
 * First-person maze exploration via raycasting in an infinite
 * procedural labyrinth. WASD to move, arrow keys to turn.
 * Keyboard only — the maze demands your full attention.
 *
 * The labyrinth generates itself as you walk — infinite corridors
 * stretching in every direction, determined by hash functions.
 * But it also forgets: corridors you passed through dissolve
 * behind you, regenerated differently if you return.
 *
 * Rare jump scares punctuate the unease — pre-generated images
 * and sounds that flash in dead ends and dark corners.
 *
 * Inspired by: Borges' "Garden of Forking Paths", procedural
 * generation, grey matter erosion research, Chiharu Shiota's
 * thread installations, 3600-year-old Patagonian trees burning,
 * the feeling that the way back has changed
 */

import type { Room } from './RoomManager'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface LabyrinthDeps {
  onExit?: () => void
  switchTo?: (name: string) => void
  getMemories?: () => { currentText: string; degradation: number }[]
}

// Cell types
const WALL = 1
const INSCRIPTION = 2
const ANOMALY = 3  // Clickable wall elements — trigger effects

// Region system for forgetting
const REGION_SIZE = 12
const KEEP_RADIUS = 3

// Maze parameters
const DOOR_THRESHOLD = 0.38

// Text fragments on walls
const WALL_FRAGMENTS = [
  'every path divides',
  'I have been here before',
  'the center is everywhere',
  'which turn did I take?',
  'walls remember what feet forget',
  'the way out is the way through',
  'corridors of grey matter',
  'one does not reach the center',
  'the thread is broken',
  'all labyrinths are one labyrinth',
  'I thought I saw an exit',
  'the walls are shifting',
  'breadcrumbs dissolve',
  'each passage a synapse',
  'forgetting the way back',
  'the maze dreams itself',
  'the corridor behind you has changed',
  'this wall was not here before',
  'you are the minotaur',
  '3600 years of memory stored in wood, burning',
]

const CULTURAL_INSCRIPTIONS = [
  'borges imagined a library containing every possible book. this labyrinth contains every possible path.',
  'the minotaur was the child of a queen and a bull. what is the child of a human and forgetting?',
  'thread unspools behind you. chiharu shiota fills galleries with red thread — connection made visible.',
  'the brain\'s hippocampus has four hidden layers. each stores a different kind of memory.',
  'in patagonia, alerce trees 3600 years old are burning. each ring a year of memory stored in wood.',
  'the great meme reset of 2026: a collective desire to forget an entire era and start over.',
  'episodic and semantic memory share the same neural network. what happened to you and what you know are one.',
  'ruthenium molecules that switch between memory, logic, and learning. matter that remembers.',
  'milan 2026: the olympics chose fire and human voice over AI spectacle. the analog as radical act.',
  'a frozen earth was found hiding in kepler\'s old archives. something real, waiting to be noticed.',
]

// Portal targets for rooms reachable from the labyrinth
const PORTAL_TARGETS = [
  { room: 'cipher', label: 'the cipher', color: [40, 160, 90] as [number, number, number] },
  { room: 'cartographer', label: 'the cartographer', color: [170, 140, 60] as [number, number, number] },
  { room: 'library', label: 'the library', color: [140, 50, 90] as [number, number, number] },
  { room: 'mirror', label: 'the mirror', color: [100, 100, 180] as [number, number, number] },
  { room: 'void', label: 'the void', color: [80, 60, 120] as [number, number, number] },
]

// Wikipedia fragment for "forgotten knowledge"
interface WikiFragment {
  title: string
  extract: string
  appearedAt: number
  revealProgress: number
  alpha: number
  fading: boolean
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}

export function createLabyrinthRoom(deps: LabyrinthDeps = {}): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  // Player state — world coordinates
  let px = 1.5
  let py = 1.5
  let pa = 0 // angle in radians
  const moveSpeed = 0.035
  const turnSpeed = 0.045

  // Input
  const keys = new Set<string>()

  // Region salts for the forgetting mechanic
  const regionSalts = new Map<string, number>()
  const activeRegions = new Set<string>()

  // Explored cells for minimap
  const exploredCells = new Set<string>()

  // Minimap ghost regions (evicted)
  const ghostRegions = new Set<string>()

  // Tension system
  let tension = 0
  let tensionTarget = 0

  // Jump scare state
  const scareImages: HTMLImageElement[] = []
  const scareBuffers: AudioBuffer[] = []
  let currentScare: {
    triggeredAt: number
    image: HTMLImageElement | null
    duration: number
    type: 'flash' | 'slowburn' | 'glitch' | 'darkness' | 'bleed'
  } | null = null
  let lastScareTime = -999
  let scareCount = 0  // escalation — scares get worse over time

  // Wall anomaly / effect system
  interface WallEffect {
    triggeredAt: number
    duration: number
    type: string
    params: Record<string, number>
  }
  let currentEffect: WallEffect | null = null
  let lookingAtAnomaly = false
  let anomalyDist = 0
  let anomalyScreenX = 0

  // Portal detection
  let nearbyPortal: { room: string; label: string; color: [number, number, number] } | null = null

  // Audio
  let audioCtx: AudioContext | null = null
  let ambienceGain: GainNode | null = null
  let ambOsc: OscillatorNode | null = null
  let footstepGain: GainNode | null = null
  let footstepOsc: OscillatorNode | null = null
  let reverbNode: ConvolverNode | null = null
  let reverbGain: GainNode | null = null
  let dripTimeout: ReturnType<typeof setTimeout> | null = null
  let lastStepTime = 0

  // Wikipedia system
  const wikiCache = new Set<string>()
  let currentFragment: WikiFragment | null = null
  let lastFetchTime = 0
  let fetchIntervalSec = 35
  let wikiFetchInProgress = false

  // Inscription hint
  let inscriptionText = ''
  let inscriptionAlpha = 0

  // ===== INSANITY ESCALATION SYSTEM =====
  // The labyrinth slowly drives you mad the longer you stay
  let insanity = 0        // 0-1 scale, gradually increases
  let cameraTilt = 0      // gradual tilt
  let fovWarp = 0         // FOV distortion
  let moveDrift = 0       // involuntary movement drift angle
  let colorShift = 0      // hue rotation
  let breathePhase = 0    // wall breathing
  let corridorStretch = 0 // corridors appear longer
  let horizonShift = 0    // horizon moves
  let glitchChance = 0    // chance of random visual glitch per frame
  let stepDelayMod = 1    // footstep timing distortion
  let phantomSoundTimer = 0 // timer for ambient phantom sounds

  // Wall objects — specific things on walls you can click
  const WALL_OBJECTS = [
    { name: 'rusty_handle', icon: '⬮', desc: 'a rusty door handle', w: 8, h: 14 },
    { name: 'crack', icon: '╱', desc: 'a crack with light', w: 12, h: 20 },
    { name: 'eye_hole', icon: '◉', desc: 'something watches', w: 6, h: 6 },
    { name: 'carved_symbol', icon: '✧', desc: 'a carved symbol', w: 10, h: 10 },
    { name: 'small_mirror', icon: '◻', desc: 'a small mirror', w: 8, h: 12 },
    { name: 'bloodstain', icon: '●', desc: 'a dark stain', w: 14, h: 10 },
    { name: 'keyhole', icon: '⚿', desc: 'a keyhole', w: 4, h: 8 },
    { name: 'handprint', icon: '✋', desc: 'a handprint', w: 12, h: 14 },
    { name: 'fungus', icon: '❋', desc: 'strange growth', w: 16, h: 10 },
    { name: 'candle', icon: '🕯', desc: 'a flickering candle', w: 4, h: 12 },
    { name: 'scratches', icon: '≡', desc: 'deep scratches', w: 16, h: 8 },
    { name: 'face_relief', icon: '☹', desc: 'a face in the stone', w: 12, h: 14 },
  ]

  function getWallObject(wx: number, wy: number): typeof WALL_OBJECTS[0] | null {
    if (getWorldCell(wx, wy) !== ANOMALY) return null
    const h = cellHash2(wx + 17, wy + 31)
    return WALL_OBJECTS[Math.floor(h * WALL_OBJECTS.length)]
  }

  function getObjectYPos(wx: number, wy: number): number {
    // Vertical position on the wall (0-1, 0=top, 1=bottom)
    return 0.3 + cellHash2(wx + 7, wy + 13) * 0.4
  }

  // ===== HASH-BASED INFINITE MAZE =====

  function regionKey(wx: number, wy: number): string {
    const rx = Math.floor(wx / REGION_SIZE)
    const ry = Math.floor(wy / REGION_SIZE)
    return `${rx},${ry}`
  }

  function cellHash(wx: number, wy: number): number {
    const rx = Math.floor(wx / REGION_SIZE)
    const ry = Math.floor(wy / REGION_SIZE)
    const salt = regionSalts.get(`${rx},${ry}`) ?? 0
    let h = (wx * 374761393 + wy * 668265263 + salt * 1013904223) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    h = h ^ (h >>> 16)
    return (h >>> 0) / 4294967296
  }

  function cellHash2(wx: number, wy: number): number {
    const rx = Math.floor(wx / REGION_SIZE)
    const ry = Math.floor(wy / REGION_SIZE)
    const salt = regionSalts.get(`${rx},${ry}`) ?? 0
    let h = (wx * 668265263 + wy * 374761393 + salt * 2654435769) | 0
    h = Math.imul(h ^ (h >>> 13), 2246822507)
    h = h ^ (h >>> 16)
    return (h >>> 0) / 4294967296
  }

  // Check if this door has the minimum hash among a room's 4 doors
  function isDoorMinForRoom(roomX: number, roomY: number, doorX: number, doorY: number, doorHash: number): boolean {
    const doors: [number, number][] = [
      [roomX, roomY - 1], [roomX, roomY + 1],
      [roomX - 1, roomY], [roomX + 1, roomY],
    ]
    for (const [dx, dy] of doors) {
      if (dx === doorX && dy === doorY) continue
      if (cellHash(dx, dy) < doorHash) return false
    }
    return true
  }

  function getWorldCell(wx: number, wy: number): number {
    const xOdd = (wx & 1) === 1
    const yOdd = (wy & 1) === 1

    // Pillars at even/even — always wall
    if (!xOdd && !yOdd) return WALL

    // Rooms at odd/odd — always open
    if (xOdd && yOdd) return 0

    // Door position — check if open
    const h = cellHash(wx, wy)

    // Guaranteed exit: if this door is the minimum for either adjacent room, it's open
    if (xOdd) {
      // Connects rooms (wx, wy-1) and (wx, wy+1)
      if (isDoorMinForRoom(wx, wy - 1, wx, wy, h)) return 0
      if (isDoorMinForRoom(wx, wy + 1, wx, wy, h)) return 0
    } else {
      // Connects rooms (wx-1, wy) and (wx+1, wy)
      if (isDoorMinForRoom(wx - 1, wy, wx, wy, h)) return 0
      if (isDoorMinForRoom(wx + 1, wy, wx, wy, h)) return 0
    }

    // Standard threshold check
    if (h < DOOR_THRESHOLD) return 0

    // This is a wall — determine subtype
    const h2 = cellHash2(wx, wy)
    if (h2 < 0.06) return INSCRIPTION
    if (h2 < 0.11) return ANOMALY  // ~5% of walls are clickable anomalies

    return WALL
  }

  function countExits(wx: number, wy: number): number {
    // Find room cell at or near this position
    const rx = wx | 1
    const ry = wy | 1
    let exits = 0
    if (getWorldCell(rx, ry - 1) === 0) exits++
    if (getWorldCell(rx, ry + 1) === 0) exits++
    if (getWorldCell(rx - 1, ry) === 0) exits++
    if (getWorldCell(rx + 1, ry) === 0) exits++
    return exits
  }

  function isPortalRoom(wx: number, wy: number): boolean {
    if ((wx & 1) === 0 || (wy & 1) === 0) return false
    return cellHash2(wx, wy) < 0.006
  }

  function getPortalTarget(wx: number, wy: number): { room: string; label: string; color: [number, number, number] } {
    const idx = Math.floor(cellHash2(wx + 1, wy + 1) * PORTAL_TARGETS.length)
    return PORTAL_TARGETS[idx % PORTAL_TARGETS.length]
  }

  function getInscriptionText(wx: number, wy: number): string {
    const memTexts = deps.getMemories?.().map(m => m.currentText).filter(t => t.length > 3) ?? []
    const allTexts = [...WALL_FRAGMENTS, ...memTexts.slice(0, 10)]
    const idx = Math.floor(cellHash2(wx + 3, wy + 7) * allTexts.length)
    return allTexts[idx % allTexts.length]
  }

  // ===== REGION MANAGEMENT =====

  function updateRegions(): void {
    const prx = Math.floor(px / REGION_SIZE)
    const pry = Math.floor(py / REGION_SIZE)

    const newActive = new Set<string>()
    for (let dx = -KEEP_RADIUS; dx <= KEEP_RADIUS; dx++) {
      for (let dy = -KEEP_RADIUS; dy <= KEEP_RADIUS; dy++) {
        newActive.add(`${prx + dx},${pry + dy}`)
      }
    }

    // Increment salt for regions that just left the active set (the labyrinth forgets)
    for (const key of activeRegions) {
      if (!newActive.has(key)) {
        const currentSalt = regionSalts.get(key) ?? 0
        regionSalts.set(key, currentSalt + 1)
        ghostRegions.add(key)
      }
    }

    activeRegions.clear()
    for (const key of newActive) {
      activeRegions.add(key)
      ghostRegions.delete(key)
    }
  }

  // ===== DDA RAYCASTING =====

  interface RayHit {
    dist: number
    side: number
    cell: number
    hitX: number
    hitY: number
  }

  function castRay(ox: number, oy: number, angle: number): RayHit {
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)

    let mapX = Math.floor(ox)
    let mapY = Math.floor(oy)

    const stepX = dx > 0 ? 1 : -1
    const stepY = dy > 0 ? 1 : -1

    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    let tMaxX = absDx > 1e-8 ? (dx > 0 ? (mapX + 1 - ox) / dx : (mapX - ox) / dx) : 1e30
    let tMaxY = absDy > 1e-8 ? (dy > 0 ? (mapY + 1 - oy) / dy : (mapY - oy) / dy) : 1e30
    const tDeltaX = absDx > 1e-8 ? Math.abs(1 / dx) : 1e30
    const tDeltaY = absDy > 1e-8 ? Math.abs(1 / dy) : 1e30

    let side = 0

    for (let i = 0; i < 80; i++) {
      if (tMaxX < tMaxY) {
        mapX += stepX
        tMaxX += tDeltaX
        side = 0
      } else {
        mapY += stepY
        tMaxY += tDeltaY
        side = 1
      }

      const cell = getWorldCell(mapX, mapY)
      if (cell >= 1) {
        const dist = side === 0
          ? (mapX - ox + (1 - stepX) / 2) / dx
          : (mapY - oy + (1 - stepY) / 2) / dy
        return { dist: Math.abs(dist), side, cell, hitX: mapX, hitY: mapY }
      }
    }

    return { dist: 30, side: 0, cell: 0, hitX: mapX, hitY: mapY }
  }

  // ===== AUDIO =====

  function createReverbIR(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
    const sampleRate = ctx.sampleRate
    const length = sampleRate * duration
    const buffer = ctx.createBuffer(2, length, sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch)
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
      }
    }
    return buffer
  }

  function scheduleDrip() {
    if (!audioCtx || !active) return
    const dest = getAudioDestination()
    const now = audioCtx.currentTime

    const freq = 800 + Math.random() * 400
    const osc = audioCtx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq

    const dripGain = audioCtx.createGain()
    dripGain.gain.setValueAtTime(0.02, now)
    dripGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15)

    osc.connect(dripGain)
    if (reverbGain) dripGain.connect(reverbGain)
    dripGain.connect(dest)
    osc.start(now)
    osc.stop(now + 0.2)

    // Drips come faster when tension is high
    const baseDelay = 3000 + Math.random() * 5000
    const tensionMultiplier = Math.max(0.3, 1 - tension * 0.6)
    dripTimeout = setTimeout(scheduleDrip, baseDelay * tensionMultiplier)
  }

  async function initAudio() {
    if (audioCtx) return
    try {
      audioCtx = await getAudioContext()
      const dest = getAudioDestination()

      // Reverb
      reverbNode = audioCtx.createConvolver()
      reverbNode.buffer = createReverbIR(audioCtx, 2, 2.5)
      reverbGain = audioCtx.createGain()
      reverbGain.gain.value = 0.4
      reverbNode.connect(reverbGain)
      reverbGain.connect(dest)

      // Ambient drone
      ambOsc = audioCtx.createOscillator()
      ambOsc.type = 'sine'
      ambOsc.frequency.value = 42
      ambienceGain = audioCtx.createGain()
      ambienceGain.gain.value = 0
      ambOsc.connect(ambienceGain)
      ambienceGain.connect(dest)
      ambienceGain.connect(reverbNode)
      ambOsc.start()

      // Second harmonic
      const ambOsc2 = audioCtx.createOscillator()
      ambOsc2.type = 'sine'
      ambOsc2.frequency.value = 63
      const amb2Gain = audioCtx.createGain()
      amb2Gain.gain.value = 0
      ambOsc2.connect(amb2Gain)
      amb2Gain.connect(dest)
      ambOsc2.start()

      ambienceGain.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 3)
      amb2Gain.gain.linearRampToValueAtTime(0.03, audioCtx.currentTime + 5)

      // Brown noise rumble
      const rumbleSize = audioCtx.sampleRate * 2
      const rumbleBuffer = audioCtx.createBuffer(1, rumbleSize, audioCtx.sampleRate)
      const rumbleData = rumbleBuffer.getChannelData(0)
      let lastVal = 0
      for (let i = 0; i < rumbleSize; i++) {
        lastVal += (Math.random() * 2 - 1) * 0.1
        lastVal *= 0.998
        rumbleData[i] = lastVal
      }
      const rumbleSource = audioCtx.createBufferSource()
      rumbleSource.buffer = rumbleBuffer
      rumbleSource.loop = true
      const rumbleFilter = audioCtx.createBiquadFilter()
      rumbleFilter.type = 'bandpass'
      rumbleFilter.frequency.value = 40
      rumbleFilter.Q.value = 2
      const rumbleGain = audioCtx.createGain()
      rumbleGain.gain.value = 0.008
      rumbleSource.connect(rumbleFilter)
      rumbleFilter.connect(rumbleGain)
      rumbleGain.connect(dest)
      rumbleSource.start()

      // Footstep synth
      footstepOsc = audioCtx.createOscillator()
      footstepOsc.type = 'sawtooth'
      footstepOsc.frequency.value = 80
      footstepGain = audioCtx.createGain()
      footstepGain.gain.value = 0
      const footFilter = audioCtx.createBiquadFilter()
      footFilter.type = 'lowpass'
      footFilter.frequency.value = 200
      footstepOsc.connect(footFilter)
      footFilter.connect(footstepGain)
      footstepGain.connect(dest)
      footstepGain.connect(reverbNode)
      footstepOsc.start()

      const firstDrip = 2000 + Math.random() * 4000
      dripTimeout = setTimeout(scheduleDrip, firstDrip)
    } catch {
      // Audio not available
    }
  }

  function playFootstep() {
    if (!footstepGain || !audioCtx) return
    const now = audioCtx.currentTime
    if (now - lastStepTime < 0.25) return
    lastStepTime = now

    footstepGain.gain.cancelScheduledValues(now)
    footstepGain.gain.setValueAtTime(0.04, now)
    footstepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
  }

  // ===== JUMP SCARE SYSTEM =====

  async function loadScareAssets() {
    // Load images (up to 15)
    for (let i = 1; i <= 15; i++) {
      const img = new Image()
      img.src = `/assets/labyrinth/labyrinth-scare-${i}.jpg`
      img.onload = () => scareImages.push(img)
    }

    // Load sounds (up to 24 — tries to load all, skips missing)
    if (!audioCtx) return
    for (let i = 1; i <= 24; i++) {
      try {
        const resp = await fetch(`/assets/labyrinth/labyrinth-sound-${i}.mp3`)
        if (resp.ok) {
          const buf = await resp.arrayBuffer()
          const audioBuf = await audioCtx.decodeAudioData(buf)
          scareBuffers.push(audioBuf)
        }
      } catch { /* missing assets ok */ }
    }
  }

  function playScareSound(intensity: number = 1) {
    if (!audioCtx) return
    const dest = getAudioDestination()
    const now = audioCtx.currentTime

    // Play pre-generated sound if available
    if (scareBuffers.length > 0) {
      const buf = scareBuffers[Math.floor(Math.random() * scareBuffers.length)]
      const source = audioCtx.createBufferSource()
      source.buffer = buf
      const gain = audioCtx.createGain()
      gain.gain.value = 0.5 * intensity
      source.connect(gain)
      gain.connect(dest)
      if (reverbNode) gain.connect(reverbNode)
      source.start()
    }

    // Sub-bass body slam — chest-rattling thump
    const thump = audioCtx.createOscillator()
    thump.frequency.setValueAtTime(50, now)
    thump.frequency.exponentialRampToValueAtTime(20, now + 0.4)
    thump.type = 'sine'
    const thumpGain = audioCtx.createGain()
    thumpGain.gain.setValueAtTime(0.35 * intensity, now)
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
    thump.connect(thumpGain)
    thumpGain.connect(dest)
    thump.start(now)
    thump.stop(now + 0.7)

    // Metallic screech — like nails on a chalkboard
    const screech = audioCtx.createOscillator()
    screech.frequency.setValueAtTime(1200 + Math.random() * 800, now)
    screech.frequency.linearRampToValueAtTime(2800 + Math.random() * 400, now + 0.15)
    screech.type = 'sawtooth'
    const screechGain = audioCtx.createGain()
    screechGain.gain.setValueAtTime(0.1 * intensity, now)
    screechGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
    const screechFilter = audioCtx.createBiquadFilter()
    screechFilter.type = 'bandpass'
    screechFilter.frequency.value = 2200
    screechFilter.Q.value = 8
    screech.connect(screechFilter)
    screechFilter.connect(screechGain)
    screechGain.connect(dest)
    if (reverbNode) screechGain.connect(reverbNode)
    screech.start(now)
    screech.stop(now + 0.4)

    // Distorted white noise burst — like a broken radio
    const noiseLen = audioCtx.sampleRate * 0.3
    const noiseBuf = audioCtx.createBuffer(1, noiseLen, audioCtx.sampleRate)
    const noiseData = noiseBuf.getChannelData(0)
    for (let i = 0; i < noiseLen; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen)
    }
    const noiseSrc = audioCtx.createBufferSource()
    noiseSrc.buffer = noiseBuf
    const noiseGain = audioCtx.createGain()
    noiseGain.gain.setValueAtTime(0.12 * intensity, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
    const noiseFilter = audioCtx.createBiquadFilter()
    noiseFilter.type = 'highpass'
    noiseFilter.frequency.value = 3000
    noiseSrc.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(dest)
    noiseSrc.start(now)

    // Detuned chord — deeply unsettling dissonance
    if (intensity > 0.7) {
      const dissonanceFreqs = [110, 116.5, 155.6, 233.1] // tritone cluster
      for (const f of dissonanceFreqs) {
        const osc = audioCtx.createOscillator()
        osc.frequency.value = f + Math.random() * 3
        osc.type = 'triangle'
        const g = audioCtx.createGain()
        g.gain.setValueAtTime(0.04 * intensity, now + 0.05)
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.5)
        osc.connect(g)
        g.connect(dest)
        if (reverbNode) g.connect(reverbNode)
        osc.start(now + 0.05)
        osc.stop(now + 1.6)
      }
    }
  }

  // Beautiful/mysterious sound for wall effects
  function playEffectSound(type: string) {
    if (!audioCtx) return
    const dest = getAudioDestination()
    const now = audioCtx.currentTime

    if (type === 'beautiful') {
      // Ethereal chord — major with shimmer
      const freqs = [261.6, 329.6, 392, 523.3] // C major spread
      for (const f of freqs) {
        const osc = audioCtx.createOscillator()
        osc.frequency.value = f
        osc.type = 'sine'
        const g = audioCtx.createGain()
        g.gain.setValueAtTime(0, now)
        g.gain.linearRampToValueAtTime(0.06, now + 0.3)
        g.gain.exponentialRampToValueAtTime(0.001, now + 3)
        osc.connect(g)
        g.connect(dest)
        if (reverbNode) g.connect(reverbNode)
        osc.start(now)
        osc.stop(now + 3.5)
      }
      // High shimmer
      const shimmer = audioCtx.createOscillator()
      shimmer.frequency.value = 1047
      shimmer.type = 'sine'
      const sg = audioCtx.createGain()
      sg.gain.setValueAtTime(0, now)
      sg.gain.linearRampToValueAtTime(0.03, now + 0.5)
      sg.gain.exponentialRampToValueAtTime(0.001, now + 4)
      shimmer.connect(sg)
      sg.connect(dest)
      if (reverbNode) sg.connect(reverbNode)
      shimmer.start(now)
      shimmer.stop(now + 4.5)
    } else if (type === 'mysterious') {
      // Low bell tone with beating
      const osc1 = audioCtx.createOscillator()
      osc1.frequency.value = 130.8
      osc1.type = 'sine'
      const osc2 = audioCtx.createOscillator()
      osc2.frequency.value = 131.5 // slight detune for beating
      osc2.type = 'sine'
      const g1 = audioCtx.createGain()
      g1.gain.setValueAtTime(0.08, now)
      g1.gain.exponentialRampToValueAtTime(0.001, now + 4)
      osc1.connect(g1); g1.connect(dest)
      const g2 = audioCtx.createGain()
      g2.gain.setValueAtTime(0.08, now)
      g2.gain.exponentialRampToValueAtTime(0.001, now + 4)
      osc2.connect(g2); g2.connect(dest)
      if (reverbNode) { g1.connect(reverbNode); g2.connect(reverbNode) }
      osc1.start(now); osc1.stop(now + 4.5)
      osc2.start(now); osc2.stop(now + 4.5)
    } else {
      // Scary effect sound — sudden dissonant stab
      playScareSound(0.6)
    }
  }

  function triggerScare() {
    // Pick a scare type — escalates with scare count
    const types: Array<'flash' | 'slowburn' | 'glitch' | 'darkness' | 'bleed'> =
      ['flash', 'flash', 'glitch', 'darkness', 'bleed', 'slowburn']
    const typeIdx = Math.floor(Math.random() * types.length)
    const scareType = types[typeIdx]

    const img = scareImages.length > 0
      ? scareImages[Math.floor(Math.random() * scareImages.length)]
      : null

    const durations: Record<string, number> = {
      flash: 0.8 + Math.random() * 0.6,
      slowburn: 2.5 + Math.random() * 1.5,
      glitch: 1.0 + Math.random() * 0.8,
      darkness: 1.5 + Math.random() * 1.0,
      bleed: 3.0 + Math.random() * 2.0,
    }

    currentScare = {
      triggeredAt: time,
      image: img,
      duration: durations[scareType],
      type: scareType,
    }
    lastScareTime = time
    scareCount++

    // Intensity escalates with scare count
    const intensity = Math.min(1.5, 0.7 + scareCount * 0.08)
    tension = 0
    tensionTarget = 0
    playScareSound(intensity)
  }

  function checkScare(): void {
    if (currentScare) return
    // Cooldown decreases with scareCount (min 12s)
    const cooldown = Math.max(12, 30 - scareCount * 2)
    if (time - lastScareTime < cooldown) return

    const exits = countExits(Math.floor(px), Math.floor(py))

    // Build tension faster
    if (exits <= 1) {
      tensionTarget = Math.min(1, tensionTarget + 0.004)
    } else if (exits === 2) {
      tensionTarget = Math.min(1, tensionTarget + 0.001)
    } else {
      tensionTarget = Math.max(0, tensionTarget - 0.003)
    }

    // Random tension spikes — more frequent
    if (Math.random() < 0.001) {
      tensionTarget = Math.min(1, tensionTarget + 0.3)
    }

    // Ambient unease builds over time just from wandering
    if (time > 30) {
      tensionTarget = Math.min(1, tensionTarget + 0.0003)
    }

    tension += (tensionTarget - tension) * 0.02

    // Trigger at lower threshold, more likely
    if (tension > 0.4 && Math.random() < 0.015) {
      triggerScare()
    }

    // Rare random scare even at low tension (after 60s)
    if (time > 60 && time - lastScareTime > 45 && Math.random() < 0.002) {
      triggerScare()
    }
  }

  // ===== WALL ANOMALY / CLICK EFFECTS =====

  const EFFECT_TYPES = [
    // SCARY effects
    { name: 'face_flash', category: 'scary' },
    { name: 'screen_invert', category: 'scary' },
    { name: 'wall_bleed', category: 'scary' },
    { name: 'static_burst', category: 'scary' },
    { name: 'lights_out', category: 'scary' },
    { name: 'eye_track', category: 'scary' },
    // BEAUTIFUL effects
    { name: 'rainbow_spiral', category: 'beautiful' },
    { name: 'golden_particles', category: 'beautiful' },
    { name: 'aurora', category: 'beautiful' },
    { name: 'starfield', category: 'beautiful' },
    { name: 'prismatic', category: 'beautiful' },
    // MYSTERIOUS effects
    { name: 'portal_glimpse', category: 'mysterious' },
    { name: 'time_freeze', category: 'mysterious' },
    { name: 'cryptic_message', category: 'mysterious' },
    { name: 'map_reveal', category: 'mysterious' },
    { name: 'bell_toll', category: 'mysterious' },
  ]

  const CRYPTIC_MESSAGES = [
    'you have been walking in circles',
    'the minotaur remembers your name',
    'this wall was not here a moment ago',
    'someone else is in the labyrinth',
    'the exit moved',
    'you are closer than you think',
    'the labyrinth is dreaming you',
    'turn around slowly',
    'the walls are listening',
    'you passed this exact spot 47 minutes ago',
    'do not look behind you',
    'the floor is getting warmer',
    'something followed you here',
    'the maze has no center',
    'you are the maze',
  ]

  function triggerWallEffect() {
    if (currentEffect) return

    // Weight: 40% scary, 35% beautiful, 25% mysterious
    const roll = Math.random()
    let category: string
    if (roll < 0.40) category = 'scary'
    else if (roll < 0.75) category = 'beautiful'
    else category = 'mysterious'

    const options = EFFECT_TYPES.filter(e => e.category === category)
    const chosen = options[Math.floor(Math.random() * options.length)]

    const durations: Record<string, number> = {
      face_flash: 1.0, screen_invert: 2.5, wall_bleed: 4.0,
      static_burst: 1.5, lights_out: 2.0, eye_track: 3.0,
      rainbow_spiral: 4.0, golden_particles: 5.0, aurora: 6.0,
      starfield: 5.0, prismatic: 3.5,
      portal_glimpse: 2.5, time_freeze: 2.0, cryptic_message: 4.0,
      map_reveal: 3.0, bell_toll: 3.0,
    }

    currentEffect = {
      triggeredAt: time,
      duration: durations[chosen.name] || 3,
      type: chosen.name,
      params: {
        msgIdx: Math.floor(Math.random() * CRYPTIC_MESSAGES.length),
        hue: Math.random() * 360,
        spiralDir: Math.random() > 0.5 ? 1 : -1,
        originX: anomalyScreenX,
      },
    }

    playEffectSound(category)

    // Scary effects can also trigger a scare on top
    if (category === 'scary' && chosen.name === 'face_flash') {
      triggerScare()
    }
  }

  // ===== WIKIPEDIA SYSTEM =====

  async function fetchWikiFragment(): Promise<void> {
    if (wikiFetchInProgress) return
    wikiFetchInProgress = true
    try {
      const url = 'https://en.wikipedia.org/w/api.php?action=query&generator=random&grnnamespace=0&prop=extracts&exchars=300&exintro=1&format=json&origin=*'
      const resp = await fetch(url)
      if (!resp.ok) return
      const data = await resp.json()
      const pages = data?.query?.pages
      if (!pages) return

      for (const pid of Object.keys(pages)) {
        const page = pages[pid]
        const title: string = page.title || ''
        const rawExtract: string = page.extract || ''
        const extract = stripHtml(rawExtract).trim()

        if (!title || !extract || extract.length < 20) continue
        if (wikiCache.has(title)) continue

        wikiCache.add(title)
        currentFragment = {
          title,
          extract: extract.substring(0, 250),
          appearedAt: time,
          revealProgress: 0,
          alpha: 0,
          fading: false,
        }
        fetchIntervalSec = 30 + Math.random() * 30
        lastFetchTime = time
        return
      }
    } catch { /* skip */ }
    finally { wikiFetchInProgress = false }
  }

  function updateWikiFragment(): void {
    if (!currentFragment && time - lastFetchTime > fetchIntervalSec) {
      fetchWikiFragment()
    }
    if (!currentFragment) return

    const age = time - currentFragment.appearedAt
    if (age < 2) currentFragment.alpha = Math.min(1, age / 2)
    if (age > 1 && age < 7) currentFragment.revealProgress = Math.min(1, (age - 1) / 6)
    else if (age >= 7) currentFragment.revealProgress = 1
    if (age > 15) {
      currentFragment.fading = true
      currentFragment.alpha = Math.max(0, 1 - (age - 15) / 3)
    }
    if (age > 18) currentFragment = null
  }

  // ===== PHANTOM SOUND SYSTEM =====
  // Ambient horror sounds that play randomly, more often at higher insanity

  function playPhantomSound() {
    if (!audioCtx) return
    const dest = getAudioDestination()
    const now = audioCtx.currentTime
    const roll = Math.random()

    if (roll < 0.2) {
      // Distant knocking — 3 sharp knocks
      for (let i = 0; i < 3; i++) {
        const knock = audioCtx.createOscillator()
        knock.frequency.value = 200 + Math.random() * 100
        knock.type = 'square'
        const kg = audioCtx.createGain()
        const t = now + i * 0.18
        kg.gain.setValueAtTime(0.03 + insanity * 0.04, t)
        kg.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
        knock.connect(kg); kg.connect(dest)
        if (reverbNode) kg.connect(reverbNode)
        knock.start(t); knock.stop(t + 0.1)
      }
    } else if (roll < 0.35) {
      // Metal bang — sharp broadband hit
      const bangLen = audioCtx.sampleRate * 0.15
      const bangBuf = audioCtx.createBuffer(1, bangLen, audioCtx.sampleRate)
      const bd = bangBuf.getChannelData(0)
      for (let i = 0; i < bangLen; i++) {
        bd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bangLen * 0.1))
      }
      const bangSrc = audioCtx.createBufferSource()
      bangSrc.buffer = bangBuf
      const bangFilter = audioCtx.createBiquadFilter()
      bangFilter.type = 'bandpass'
      bangFilter.frequency.value = 800 + Math.random() * 600
      bangFilter.Q.value = 3
      const bangGain = audioCtx.createGain()
      bangGain.gain.value = 0.06 + insanity * 0.06
      bangSrc.connect(bangFilter); bangFilter.connect(bangGain)
      bangGain.connect(dest)
      if (reverbNode) bangGain.connect(reverbNode)
      bangSrc.start(now)
    } else if (roll < 0.5) {
      // Haunting whisper — filtered noise with resonance
      const whisperLen = audioCtx.sampleRate * 1.5
      const wBuf = audioCtx.createBuffer(1, whisperLen, audioCtx.sampleRate)
      const wd = wBuf.getChannelData(0)
      for (let i = 0; i < whisperLen; i++) {
        const env = Math.sin((i / whisperLen) * Math.PI) // fade in/out
        wd[i] = (Math.random() * 2 - 1) * env * 0.5
      }
      const wSrc = audioCtx.createBufferSource()
      wSrc.buffer = wBuf
      const wFilter = audioCtx.createBiquadFilter()
      wFilter.type = 'bandpass'
      wFilter.frequency.value = 1500 + Math.random() * 1000
      wFilter.Q.value = 10
      const wGain = audioCtx.createGain()
      wGain.gain.value = 0.02 + insanity * 0.03
      wSrc.connect(wFilter); wFilter.connect(wGain)
      wGain.connect(dest)
      if (reverbNode) wGain.connect(reverbNode)
      wSrc.start(now)
    } else if (roll < 0.65) {
      // Low sinister laugh — descending glissando
      const laugh = audioCtx.createOscillator()
      laugh.type = 'sawtooth'
      laugh.frequency.setValueAtTime(180, now)
      laugh.frequency.exponentialRampToValueAtTime(80, now + 1.5)
      const lFilter = audioCtx.createBiquadFilter()
      lFilter.type = 'lowpass'
      lFilter.frequency.value = 400
      const lGain = audioCtx.createGain()
      // Pulsing volume for "ha ha ha" effect
      for (let i = 0; i < 6; i++) {
        const t = now + i * 0.25
        lGain.gain.setValueAtTime(0.025 + insanity * 0.02, t)
        lGain.gain.exponentialRampToValueAtTime(0.002, t + 0.12)
      }
      laugh.connect(lFilter); lFilter.connect(lGain)
      lGain.connect(dest)
      if (reverbNode) lGain.connect(reverbNode)
      laugh.start(now); laugh.stop(now + 1.8)
    } else if (roll < 0.8) {
      // Scraping sound — filtered noise sweep
      const scrapeLen = audioCtx.sampleRate * 0.8
      const sBuf = audioCtx.createBuffer(1, scrapeLen, audioCtx.sampleRate)
      const sd = sBuf.getChannelData(0)
      for (let i = 0; i < scrapeLen; i++) {
        sd[i] = (Math.random() * 2 - 1) * (1 - i / scrapeLen)
      }
      const sSrc = audioCtx.createBufferSource()
      sSrc.buffer = sBuf
      const sFilter = audioCtx.createBiquadFilter()
      sFilter.type = 'bandpass'
      sFilter.frequency.setValueAtTime(300, now)
      sFilter.frequency.linearRampToValueAtTime(2000, now + 0.8)
      sFilter.Q.value = 5
      const sGain = audioCtx.createGain()
      sGain.gain.value = 0.04 + insanity * 0.04
      sSrc.connect(sFilter); sFilter.connect(sGain)
      sGain.connect(dest)
      if (reverbNode) sGain.connect(reverbNode)
      sSrc.start(now)
    } else {
      // Play a pre-recorded sound if available
      if (scareBuffers.length > 0) {
        const buf = scareBuffers[Math.floor(Math.random() * scareBuffers.length)]
        const src = audioCtx.createBufferSource()
        src.buffer = buf
        const g = audioCtx.createGain()
        g.gain.value = 0.12 + insanity * 0.1
        src.connect(g); g.connect(dest)
        if (reverbNode) g.connect(reverbNode)
        src.start(now)
      }
    }
  }

  // ===== INSANITY UPDATE =====

  function updateInsanity() {
    // Insanity increases slowly but relentlessly
    // ~0.1 per minute at start, accelerating
    const baseRate = 0.00003
    const accel = 1 + insanity * 2 // accelerates as it gets worse
    insanity = Math.min(1, insanity + baseRate * accel)

    // Derive all madness parameters from insanity level
    // Stage 1 (0-0.15): Subtle unease — slight breathing, occasional phantom sounds
    // Stage 2 (0.15-0.3): Disorientation — FOV pulses, movement drifts slightly
    // Stage 3 (0.3-0.5): Reality bending — camera tilts, colors shift, corridors stretch
    // Stage 4 (0.5-0.7): Alien geometry — walls breathe hard, horizon shifts, glitches
    // Stage 5 (0.7-0.85): Losing control — severe drift, inverted controls moments, narrowing
    // Stage 6 (0.85-1.0): Full madness — everything wrong, impossible geometry, constant horror

    // Camera tilt — slowly tilts to one side
    const tiltTarget = insanity > 0.3 ? Math.sin(time * 0.15) * insanity * 0.15 : 0
    cameraTilt += (tiltTarget - cameraTilt) * 0.01

    // FOV warping — pulsing wider, creating fisheye feeling
    fovWarp = insanity > 0.15 ? Math.sin(time * 0.3) * (insanity - 0.15) * 0.4 : 0

    // Movement drift — you don't go quite where you intend
    moveDrift = insanity > 0.2 ? Math.sin(time * 0.7) * (insanity - 0.2) * 0.02 : 0

    // Color shift — hue rotation increasing
    colorShift = insanity > 0.25 ? (insanity - 0.25) * 80 : 0

    // Wall breathing — walls expand and contract
    breathePhase = insanity > 0.1 ? Math.sin(time * 0.8) * insanity * 0.15 : 0

    // Corridor stretch — distant walls appear further
    corridorStretch = insanity > 0.35 ? 1 + (insanity - 0.35) * 0.8 : 1

    // Horizon shift — the ground plane moves
    horizonShift = insanity > 0.4 ? Math.sin(time * 0.25) * (insanity - 0.4) * 40 : 0

    // Visual glitch chance per frame
    glitchChance = insanity > 0.3 ? (insanity - 0.3) * 0.05 : 0

    // Footstep timing distortion
    stepDelayMod = insanity > 0.5 ? 1 + Math.sin(time * 2) * (insanity - 0.5) * 0.6 : 1

    // Phantom sounds — interval decreases with insanity
    phantomSoundTimer -= 0.016
    if (phantomSoundTimer <= 0 && insanity > 0.05) {
      const interval = Math.max(3, 25 - insanity * 25)
      phantomSoundTimer = interval + Math.random() * interval
      playPhantomSound()
    }
  }

  // ===== UPDATE =====

  function update() {
    // Update insanity before everything else
    updateInsanity()

    let moveX = 0
    let moveY = 0
    let moving = false

    // Movement with insanity-induced drift
    const effectiveAngle = pa + moveDrift
    if (keys.has('w') || keys.has('arrowup')) {
      moveX += Math.cos(effectiveAngle) * moveSpeed
      moveY += Math.sin(effectiveAngle) * moveSpeed
      moving = true
    }
    if (keys.has('s') || keys.has('arrowdown')) {
      moveX -= Math.cos(effectiveAngle) * moveSpeed
      moveY -= Math.sin(effectiveAngle) * moveSpeed
      moving = true
    }

    // Turn speed affected by insanity — sometimes sluggish, sometimes too fast
    const effectiveTurnSpeed = turnSpeed * (1 + (insanity > 0.4 ? Math.sin(time * 3) * (insanity - 0.4) * 0.8 : 0))
    if (keys.has('a') || keys.has('arrowleft')) {
      pa -= effectiveTurnSpeed
    }
    if (keys.has('d') || keys.has('arrowright')) {
      pa += effectiveTurnSpeed
    }

    // At high insanity, involuntary micro-movements
    if (insanity > 0.6 && !moving) {
      const driftAmount = (insanity - 0.6) * 0.008
      px += Math.cos(time * 1.3) * driftAmount
      py += Math.sin(time * 1.7) * driftAmount
    }

    // Collision detection against world cells
    const margin = 0.2
    const newX = px + moveX
    const checkCellX = getWorldCell(
      Math.floor(newX + margin * Math.sign(moveX)),
      Math.floor(py),
    )
    if (checkCellX === 0) px = newX

    const newY = py + moveY
    const checkCellY = getWorldCell(
      Math.floor(px),
      Math.floor(newY + margin * Math.sign(moveY)),
    )
    if (checkCellY === 0) py = newY

    if (moving) playFootstep()

    // Track explored cells
    exploredCells.add(`${Math.floor(px)},${Math.floor(py)}`)

    // Update regions (the labyrinth forgets distant areas)
    updateRegions()

    // Prune explored cells far from player periodically
    if (Math.floor(time * 60) % 300 === 0) {
      const floorPx = Math.floor(px)
      const floorPy = Math.floor(py)
      for (const key of exploredCells) {
        const comma = key.indexOf(',')
        const cx = parseInt(key.substring(0, comma))
        const cy = parseInt(key.substring(comma + 1))
        if (Math.abs(cx - floorPx) > 60 || Math.abs(cy - floorPy) > 60) {
          exploredCells.delete(key)
        }
      }
    }

    // Check for nearby portal
    const roomX = Math.floor(px) | 1
    const roomY = Math.floor(py) | 1
    if (isPortalRoom(roomX, roomY)) {
      nearbyPortal = getPortalTarget(roomX, roomY)
    } else {
      nearbyPortal = null
    }

    // Check what center ray hits (for anomaly clicking)
    const centerHit = castRay(px, py, pa)
    lookingAtAnomaly = centerHit.cell === ANOMALY && centerHit.dist < 3.5
    anomalyDist = centerHit.dist
    anomalyScreenX = canvas ? canvas.width / 2 : 400

    // Expire current effect
    if (currentEffect && time - currentEffect.triggeredAt > currentEffect.duration) {
      currentEffect = null
    }

    // Update tension/scare
    checkScare()

    // Update ambient drone pitch with tension + insanity
    if (ambOsc && audioCtx) {
      // Drone drops lower with tension, warps with insanity
      const basePitch = 42 - tension * 10 - insanity * 8
      const wobble = insanity > 0.3 ? Math.sin(time * 1.5) * insanity * 3 : 0
      ambOsc.frequency.value = Math.max(20, basePitch + wobble)
    }
    if (ambienceGain && audioCtx) {
      // Drone gets louder with insanity
      const targetVol = 0.06 + insanity * 0.08
      ambienceGain.gain.value += (targetVol - ambienceGain.gain.value) * 0.01
    }

    // Wikipedia
    updateWikiFragment()

    // Inscription detection — check walls near player
    inscriptionText = ''
    inscriptionAlpha = Math.max(0, inscriptionAlpha - 0.02)
    const checkRadius = 1.8
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const wx = Math.floor(px) + dx
        const wy = Math.floor(py) + dy
        if (getWorldCell(wx, wy) === INSCRIPTION) {
          const dist = Math.hypot(px - (wx + 0.5), py - (wy + 0.5))
          if (dist < checkRadius) {
            inscriptionText = getInscriptionText(wx, wy)
            inscriptionAlpha = Math.min(0.6, 1 - dist / checkRadius)
            break
          }
        }
      }
      if (inscriptionText) break
    }
  }

  // ===== RENDERING =====

  function getCellColor(cell: number, brightness: number, sideDim: number): [number, number, number] {
    // Tension affects wall color — slight red shift
    const tensionR = tension * 15
    const tensionG = -tension * 5

    // Insanity color shift — sickly green/yellow at mid, blood red at high
    const insanityR = insanity > 0.5 ? (insanity - 0.5) * 30 : 0
    const insanityG = insanity > 0.25 ? Math.sin(time * 0.4 + colorShift * 0.01) * insanity * 12 : 0
    const insanityB = insanity > 0.4 ? -insanity * 10 : 0

    if (cell === ANOMALY) {
      // Anomaly walls shimmer with a subtle otherworldly glow
      const shimmer = 0.5 + Math.sin(time * 2.5) * 0.3
      return [
        (45 + tensionR + insanityR + shimmer * 15) * brightness * sideDim,
        (32 + tensionG + insanityG + shimmer * 8) * brightness * sideDim,
        (70 + insanityB + shimmer * 20) * brightness * sideDim,
      ]
    }
    if (cell === INSCRIPTION) {
      return [
        (50 + tensionR + insanityR) * brightness * sideDim,
        (38 + tensionG + insanityG) * brightness * sideDim,
        (65 + insanityB) * brightness * sideDim,
      ]
    }

    // Wall breathing — brightness modulation
    const breathMod = 1 + breathePhase * 0.3

    return [
      (40 + tensionR + insanityR) * brightness * sideDim * breathMod,
      (30 + tensionG + insanityG) * brightness * sideDim * breathMod,
      (60 + insanityB) * brightness * sideDim * breathMod,
    ]
  }

  function renderWikiFragment(w: number, h: number): void {
    if (!currentFragment || !ctx) return
    const frag = currentFragment
    const baseAlpha = frag.alpha * 0.7

    const boxX = 24
    const boxY = 50
    const maxWidth = Math.min(320, w * 0.4)

    ctx.save()
    ctx.font = 'small-caps 13px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(160, 145, 120, ${baseAlpha * 0.9})`
    ctx.textAlign = 'left'

    const jitterX = Math.sin(time * 0.7 + 3.1) * 0.5
    const jitterY = Math.cos(time * 0.5 + 1.7) * 0.3
    ctx.fillText(frag.title.toUpperCase(), boxX + jitterX, boxY + jitterY)

    const titleWidth = ctx.measureText(frag.title.toUpperCase()).width
    ctx.strokeStyle = `rgba(140, 125, 100, ${baseAlpha * 0.4})`
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(boxX, boxY + 5)
    ctx.lineTo(boxX + Math.min(titleWidth, maxWidth) * frag.revealProgress, boxY + 5)
    ctx.stroke()

    if (frag.revealProgress > 0) {
      const charsToShow = Math.floor(frag.extract.length * frag.revealProgress)
      const visibleText = frag.extract.substring(0, charsToShow)

      ctx.font = '13px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(130, 120, 105, ${baseAlpha * 0.7})`

      const words = visibleText.split(' ')
      let line = ''
      let lineY = boxY + 22
      for (const word of words) {
        const testLine = line ? line + ' ' + word : word
        if (ctx.measureText(testLine).width > maxWidth && line) {
          const lineJitter = Math.sin(lineY * 0.3 + time * 0.2) * 0.4
          ctx.fillText(line, boxX + lineJitter, lineY)
          line = word
          lineY += 15
          if (lineY > boxY + 100) break
        } else {
          line = testLine
        }
      }
      if (line && lineY <= boxY + 100) {
        ctx.fillText(line, boxX + Math.sin(lineY * 0.3 + time * 0.2) * 0.4, lineY)
      }
    }
    ctx.restore()
  }

  function renderMinimap(w: number, h: number): void {
    if (!ctx) return
    const viewRadius = 20
    const mapSize = 100
    const cellSize = mapSize / (viewRadius * 2)
    const mapX = w - mapSize - 12
    const mapY = 12

    ctx.save()
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(mapX - 1, mapY - 1, mapSize + 2, mapSize + 2)
    ctx.strokeStyle = 'rgba(60, 80, 60, 0.2)'
    ctx.lineWidth = 1
    ctx.strokeRect(mapX - 1, mapY - 1, mapSize + 2, mapSize + 2)

    const centerWX = Math.floor(px)
    const centerWY = Math.floor(py)

    for (const key of exploredCells) {
      const comma = key.indexOf(',')
      const cwx = parseInt(key.substring(0, comma))
      const cwy = parseInt(key.substring(comma + 1))
      const ddx = cwx - centerWX
      const ddy = cwy - centerWY

      if (Math.abs(ddx) > viewRadius || Math.abs(ddy) > viewRadius) continue

      const rk = regionKey(cwx, cwy)
      const isGhost = ghostRegions.has(rk)

      const screenX = mapX + (ddx + viewRadius) * cellSize
      const screenY = mapY + (ddy + viewRadius) * cellSize

      if (isGhost) {
        ctx.fillStyle = 'rgba(60, 40, 60, 0.12)'
      } else {
        const cell = getWorldCell(cwx, cwy)
        ctx.fillStyle = cell === 0
          ? 'rgba(40, 80, 40, 0.25)'
          : 'rgba(30, 60, 30, 0.45)'
      }
      ctx.fillRect(screenX, screenY, cellSize + 0.5, cellSize + 0.5)
    }

    // Player dot
    const dotX = mapX + viewRadius * cellSize
    const dotY = mapY + viewRadius * cellSize
    const pulse = 2 + Math.sin(time * 3) * 0.5
    ctx.fillStyle = 'rgba(100, 255, 100, 0.8)'
    ctx.beginPath()
    ctx.arc(dotX, dotY, pulse, 0, Math.PI * 2)
    ctx.fill()

    // Direction indicator
    ctx.strokeStyle = 'rgba(100, 255, 100, 0.5)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(dotX, dotY)
    ctx.lineTo(dotX + Math.cos(pa) * 5, dotY + Math.sin(pa) * 5)
    ctx.stroke()

    ctx.restore()
  }

  function renderJumpScare(w: number, h: number): void {
    if (!currentScare || !ctx) return

    const elapsed = time - currentScare.triggeredAt
    if (elapsed > currentScare.duration) {
      currentScare = null
      return
    }

    const progress = elapsed / currentScare.duration
    const type = currentScare.type

    ctx.save()

    if (type === 'flash') {
      // INTENSE flash scare — full screen, violent shake
      let alpha = 1
      if (elapsed < 0.05) alpha = elapsed / 0.05 // instant attack
      else if (elapsed > 0.2) alpha = Math.max(0, 1 - (elapsed - 0.2) / (currentScare.duration - 0.2))

      // Violent screen shake
      const shakeIntensity = 30 * alpha * (1 + scareCount * 0.3)
      ctx.translate(
        (Math.random() - 0.5) * shakeIntensity,
        (Math.random() - 0.5) * shakeIntensity,
      )

      // Blood-red flash
      ctx.fillStyle = `rgba(120, 0, 0, ${alpha * 0.5})`
      ctx.fillRect(-20, -20, w + 40, h + 40)

      // Image — BIGGER, closer, more threatening
      if (currentScare.image) {
        ctx.globalAlpha = alpha * 0.9
        const scale = 0.7 + Math.random() * 0.3 // 70-100% of screen
        const imgW = w * scale
        const imgH = h * scale
        const imgX = (w - imgW) / 2 + (Math.random() - 0.5) * 20
        const imgY = (h - imgH) / 2 + (Math.random() - 0.5) * 20
        ctx.drawImage(currentScare.image, imgX, imgY, imgW, imgH)
        ctx.globalAlpha = 1
      }

      // Harsh scanlines
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.25})`
      for (let y = 0; y < h; y += 3) {
        ctx.fillRect(0, y, w, 1)
      }

      // Chromatic aberration — red/blue split rectangles
      if (currentScare.image && alpha > 0.3) {
        ctx.globalCompositeOperation = 'screen'
        ctx.fillStyle = `rgba(255, 0, 0, ${alpha * 0.15})`
        ctx.fillRect(3, 0, w, h)
        ctx.fillStyle = `rgba(0, 0, 255, ${alpha * 0.15})`
        ctx.fillRect(-3, 0, w, h)
        ctx.globalCompositeOperation = 'source-over'
      }

    } else if (type === 'slowburn') {
      // Slow creeping scare — image fades in gradually then SLAMS
      let alpha: number
      if (progress < 0.6) {
        alpha = progress / 0.6 * 0.3 // slowly creep to 30% opacity
      } else if (progress < 0.65) {
        alpha = 0.3 + (progress - 0.6) / 0.05 * 0.7 // SLAM to full
      } else {
        alpha = Math.max(0, 1 - (progress - 0.65) / 0.35)
      }

      // Subtle shake only at slam point
      if (progress > 0.58 && progress < 0.75) {
        const slam = Math.min(1, (progress - 0.58) / 0.05) * 40
        ctx.translate((Math.random() - 0.5) * slam, (Math.random() - 0.5) * slam)
      }

      ctx.fillStyle = `rgba(40, 0, 0, ${alpha * 0.4})`
      ctx.fillRect(0, 0, w, h)

      if (currentScare.image) {
        ctx.globalAlpha = alpha
        ctx.drawImage(currentScare.image, 0, 0, w, h) // FULL SCREEN
        ctx.globalAlpha = 1
      }

    } else if (type === 'glitch') {
      // Digital glitch scare — broken reality
      const alpha = progress < 0.1 ? progress / 0.1 : Math.max(0, 1 - (progress - 0.1) / 0.9)

      // Tear the screen into horizontal slices
      const numSlices = 8 + Math.floor(Math.random() * 12)
      for (let i = 0; i < numSlices; i++) {
        const sliceY = Math.random() * h
        const sliceH = 2 + Math.random() * 30
        const offsetX = (Math.random() - 0.5) * 60 * alpha
        ctx.fillStyle = `rgba(${Math.random() > 0.5 ? 180 : 0}, ${Math.random() > 0.7 ? 80 : 0}, ${Math.random() > 0.5 ? 120 : 0}, ${alpha * 0.6})`
        ctx.fillRect(offsetX, sliceY, w, sliceH)
      }

      // Random color blocks
      for (let i = 0; i < 5; i++) {
        const bx = Math.random() * w
        const by = Math.random() * h
        const bw = 20 + Math.random() * 100
        const bh = 10 + Math.random() * 60
        ctx.fillStyle = `rgba(${Math.floor(Math.random() * 255)}, 0, ${Math.floor(Math.random() * 255)}, ${alpha * 0.4})`
        ctx.fillRect(bx, by, bw, bh)
      }

      // Image fragments scattered
      if (currentScare.image && alpha > 0.2) {
        for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = alpha * 0.7
          const sx = Math.random() * w * 0.5
          const sy = Math.random() * h * 0.5
          const sw = w * 0.3
          const sh = h * 0.2
          ctx.drawImage(currentScare.image, sx, sy, sw, sh)
          ctx.globalAlpha = 1
        }
      }

    } else if (type === 'darkness') {
      // Lights go completely out, then slam back with a face
      const alpha = progress < 0.6 ? 1 : Math.max(0, 1 - (progress - 0.6) / 0.4)

      if (progress < 0.7) {
        // Total darkness
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.95})`
        ctx.fillRect(0, 0, w, h)

        // Occasional tiny red dot (like eyes)
        if (Math.random() < 0.03) {
          ctx.fillStyle = 'rgba(180, 0, 0, 0.8)'
          const eyeX = w * 0.3 + Math.random() * w * 0.4
          const eyeY = h * 0.3 + Math.random() * h * 0.3
          ctx.beginPath()
          ctx.arc(eyeX, eyeY, 2, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.arc(eyeX + 25 + Math.random() * 10, eyeY + (Math.random() - 0.5) * 5, 2, 0, Math.PI * 2)
          ctx.fill()
        }
      } else {
        // Slam back — bright flash with image
        const slamAlpha = Math.max(0, 1 - (progress - 0.7) / 0.3)
        ctx.fillStyle = `rgba(200, 180, 160, ${slamAlpha * 0.3})`
        ctx.fillRect(0, 0, w, h)
        if (currentScare.image) {
          ctx.globalAlpha = slamAlpha * 0.6
          ctx.drawImage(currentScare.image, w * 0.1, h * 0.1, w * 0.8, h * 0.8)
          ctx.globalAlpha = 1
        }
        const shake = slamAlpha * 25
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake)
      }

    } else if (type === 'bleed') {
      // Walls bleed — red drips down the screen for a long time
      const alpha = progress < 0.1 ? progress / 0.1 : progress > 0.8 ? (1 - progress) / 0.2 : 1

      // Multiple drip streams
      const numDrips = 15 + scareCount * 3
      for (let i = 0; i < numDrips; i++) {
        const dx = (cellHash(i * 7, i * 13) * w)
        const dripSpeed = 0.3 + cellHash(i * 3, i * 11) * 0.7
        const dripY = -20 + elapsed * h * dripSpeed * 0.3
        const dripWidth = 2 + cellHash(i * 5, i * 9) * 6

        const gradient = ctx.createLinearGradient(dx, Math.max(0, dripY - 40), dx, dripY)
        gradient.addColorStop(0, `rgba(80, 0, 0, 0)`)
        gradient.addColorStop(0.5, `rgba(140, 10, 10, ${alpha * 0.5})`)
        gradient.addColorStop(1, `rgba(100, 0, 0, ${alpha * 0.7})`)

        ctx.fillStyle = gradient
        ctx.fillRect(dx, Math.max(0, dripY - 60), dripWidth, 60)

        // Blood drop at bottom
        ctx.fillStyle = `rgba(120, 5, 5, ${alpha * 0.6})`
        ctx.beginPath()
        ctx.arc(dx + dripWidth / 2, dripY, dripWidth * 0.7, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    ctx.restore()
  }

  // ===== WALL EFFECT RENDERING =====

  function renderWallEffect(w: number, h: number): void {
    if (!currentEffect || !ctx) return

    const elapsed = time - currentEffect.triggeredAt
    const progress = elapsed / currentEffect.duration
    if (progress > 1) return
    const fadeIn = Math.min(1, progress * 5)
    const fadeOut = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1
    const alpha = fadeIn * fadeOut

    ctx.save()

    switch (currentEffect.type) {
      case 'screen_invert': {
        ctx.globalCompositeOperation = 'difference'
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`
        ctx.fillRect(0, 0, w, h)
        ctx.globalCompositeOperation = 'source-over'
        break
      }

      case 'wall_bleed': {
        // Red ooze from walls
        const numDrips = 20
        for (let i = 0; i < numDrips; i++) {
          const dx = (i / numDrips) * w + Math.sin(i * 3.7) * 30
          const dripLen = elapsed * 80 * (0.5 + Math.sin(i * 2.3) * 0.5)
          const gradient = ctx.createLinearGradient(dx, h * 0.2, dx, h * 0.2 + dripLen)
          gradient.addColorStop(0, `rgba(100, 0, 0, ${alpha * 0.4})`)
          gradient.addColorStop(1, `rgba(80, 0, 0, 0)`)
          ctx.fillStyle = gradient
          ctx.fillRect(dx, h * 0.2, 3 + Math.sin(i) * 2, dripLen)
        }
        break
      }

      case 'static_burst': {
        // TV static
        const imgData = ctx.getImageData(0, 0, w, h)
        const d = imgData.data
        const intensity = alpha * 0.6
        for (let i = 0; i < d.length; i += 16) { // every 4th pixel for perf
          const noise = (Math.random() - 0.5) * 255 * intensity
          d[i] += noise
          d[i + 1] += noise
          d[i + 2] += noise
        }
        ctx.putImageData(imgData, 0, 0)
        break
      }

      case 'lights_out': {
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.92})`
        ctx.fillRect(0, 0, w, h)
        // Pair of red eyes
        if (Math.random() < 0.06) {
          ctx.fillStyle = `rgba(160, 0, 0, ${alpha * 0.6})`
          const eyeY = h * 0.4 + Math.random() * h * 0.2
          const eyeX = w * 0.35 + Math.random() * w * 0.3
          ctx.beginPath()
          ctx.arc(eyeX, eyeY, 2, 0, Math.PI * 2)
          ctx.arc(eyeX + 20, eyeY, 2, 0, Math.PI * 2)
          ctx.fill()
        }
        break
      }

      case 'eye_track': {
        // A large eye appears and follows... something
        const eyeX = w / 2 + Math.sin(time * 0.8) * 50
        const eyeY = h / 2 + Math.cos(time * 0.6) * 30
        const eyeR = 60 * alpha

        // Sclera
        ctx.fillStyle = `rgba(220, 210, 200, ${alpha * 0.7})`
        ctx.beginPath()
        ctx.ellipse(eyeX, eyeY, eyeR, eyeR * 0.6, 0, 0, Math.PI * 2)
        ctx.fill()

        // Iris
        const irisOffX = Math.sin(time * 1.5) * eyeR * 0.2
        const irisOffY = Math.cos(time * 1.2) * eyeR * 0.15
        ctx.fillStyle = `rgba(40, 80, 40, ${alpha * 0.9})`
        ctx.beginPath()
        ctx.arc(eyeX + irisOffX, eyeY + irisOffY, eyeR * 0.4, 0, Math.PI * 2)
        ctx.fill()

        // Pupil
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.95})`
        ctx.beginPath()
        ctx.arc(eyeX + irisOffX, eyeY + irisOffY, eyeR * 0.2, 0, Math.PI * 2)
        ctx.fill()

        // Red veins
        ctx.strokeStyle = `rgba(180, 30, 30, ${alpha * 0.3})`
        ctx.lineWidth = 1
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2
          ctx.beginPath()
          ctx.moveTo(eyeX + Math.cos(angle) * eyeR * 0.5, eyeY + Math.sin(angle) * eyeR * 0.3)
          ctx.lineTo(eyeX + Math.cos(angle) * eyeR * 0.9, eyeY + Math.sin(angle) * eyeR * 0.55)
          ctx.stroke()
        }
        break
      }

      case 'rainbow_spiral': {
        // Beautiful rainbow spiral emanating from center
        const dir = currentEffect.params.spiralDir
        for (let i = 0; i < 200; i++) {
          const angle = (i / 200) * Math.PI * 8 + time * 2 * dir
          const radius = (i / 200) * Math.min(w, h) * 0.6 * progress
          const sx = w / 2 + Math.cos(angle) * radius
          const sy = h / 2 + Math.sin(angle) * radius
          const hue = (i * 1.8 + time * 60) % 360
          const size = 3 + (1 - i / 200) * 8
          ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${alpha * 0.6 * (1 - i / 200)})`
          ctx.beginPath()
          ctx.arc(sx, sy, size, 0, Math.PI * 2)
          ctx.fill()
        }
        break
      }

      case 'golden_particles': {
        // Burst of golden firefly particles
        const numP = 80
        for (let i = 0; i < numP; i++) {
          const seed = i * 7.31 + 3.14
          const angle = seed + elapsed * (0.3 + Math.sin(seed) * 0.2)
          const dist = elapsed * 80 * (0.3 + (Math.sin(seed * 2) + 1) * 0.5)
          const gx = w / 2 + Math.cos(angle) * dist
          const gy = h / 2 + Math.sin(angle) * dist - elapsed * 20
          if (gx < 0 || gx > w || gy < 0 || gy > h) continue
          const flicker = 0.5 + Math.sin(time * 5 + seed) * 0.5
          const pAlpha = alpha * flicker * Math.max(0, 1 - dist / (Math.min(w, h) * 0.5))
          const size = 2 + Math.sin(seed * 3) * 2
          ctx.fillStyle = `rgba(255, 215, ${80 + Math.floor(Math.sin(seed) * 50)}, ${pAlpha})`
          ctx.beginPath()
          ctx.arc(gx, gy, size, 0, Math.PI * 2)
          ctx.fill()
          // Glow
          ctx.fillStyle = `rgba(255, 200, 50, ${pAlpha * 0.3})`
          ctx.beginPath()
          ctx.arc(gx, gy, size * 3, 0, Math.PI * 2)
          ctx.fill()
        }
        break
      }

      case 'aurora': {
        // Northern lights ripple across the ceiling
        for (let x = 0; x < w; x += 4) {
          const wave1 = Math.sin(x * 0.008 + time * 0.5) * 40
          const wave2 = Math.sin(x * 0.015 + time * 0.3 + 2) * 25
          const wave3 = Math.sin(x * 0.003 + time * 0.7) * 60
          const baseY = h * 0.15 + wave1 + wave2 + wave3
          const height = 40 + Math.sin(x * 0.01 + time) * 20
          const hue = (120 + x * 0.1 + time * 10) % 360
          const gradient = ctx.createLinearGradient(x, baseY, x, baseY + height)
          gradient.addColorStop(0, `hsla(${hue}, 70%, 50%, ${alpha * 0.4})`)
          gradient.addColorStop(0.5, `hsla(${hue + 30}, 60%, 40%, ${alpha * 0.2})`)
          gradient.addColorStop(1, `hsla(${hue + 60}, 50%, 30%, 0)`)
          ctx.fillStyle = gradient
          ctx.fillRect(x, baseY, 5, height)
        }
        break
      }

      case 'starfield': {
        // Wall becomes transparent, revealing stars
        ctx.fillStyle = `rgba(0, 0, 5, ${alpha * 0.7})`
        ctx.fillRect(0, 0, w, h)
        const numStars = 200
        for (let i = 0; i < numStars; i++) {
          const sx = (cellHash(i, 999) * w)
          const sy = (cellHash(i, 1001) * h)
          const brightness = 0.3 + cellHash(i, 1003) * 0.7
          const twinkle = 0.5 + Math.sin(time * (2 + cellHash(i, 1005) * 3) + i) * 0.5
          const size = 0.5 + cellHash(i, 1007) * 2
          ctx.fillStyle = `rgba(255, 255, ${200 + Math.floor(cellHash(i, 1009) * 55)}, ${alpha * brightness * twinkle})`
          ctx.beginPath()
          ctx.arc(sx, sy, size, 0, Math.PI * 2)
          ctx.fill()
        }
        // Nebula cloud
        const nebGrad = ctx.createRadialGradient(w * 0.6, h * 0.4, 0, w * 0.6, h * 0.4, w * 0.3)
        nebGrad.addColorStop(0, `rgba(80, 20, 120, ${alpha * 0.15})`)
        nebGrad.addColorStop(0.5, `rgba(40, 10, 80, ${alpha * 0.08})`)
        nebGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = nebGrad
        ctx.fillRect(0, 0, w, h)
        break
      }

      case 'prismatic': {
        // Light refracts through corridors — rainbow bands
        for (let i = 0; i < 7; i++) {
          const hue = i * 51.4
          const bandY = h * 0.2 + i * h * 0.08
          const bandH = h * 0.06
          const wave = Math.sin(time * 2 + i * 0.5) * 20
          ctx.fillStyle = `hsla(${hue}, 90%, 60%, ${alpha * 0.2})`
          ctx.fillRect(0, bandY + wave, w, bandH)
        }
        break
      }

      case 'portal_glimpse': {
        // Brief flash of another world through the wall
        const portalR = Math.min(w, h) * 0.3 * alpha
        const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, portalR)
        gradient.addColorStop(0, `rgba(100, 60, 180, ${alpha * 0.5})`)
        gradient.addColorStop(0.5, `rgba(60, 30, 120, ${alpha * 0.3})`)
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, w, h)

        // Swirling particles inside the portal
        for (let i = 0; i < 30; i++) {
          const a = time * 1.5 + i * 0.21
          const r = portalR * 0.3 + Math.sin(time + i) * portalR * 0.2
          const px2 = w / 2 + Math.cos(a) * r
          const py2 = h / 2 + Math.sin(a) * r
          ctx.fillStyle = `rgba(180, 140, 255, ${alpha * 0.5})`
          ctx.beginPath()
          ctx.arc(px2, py2, 2, 0, Math.PI * 2)
          ctx.fill()
        }
        break
      }

      case 'time_freeze': {
        // Everything gets a blue-white tint, time label appears
        ctx.fillStyle = `rgba(180, 200, 255, ${alpha * 0.15})`
        ctx.fillRect(0, 0, w, h)
        ctx.font = `${24 + Math.sin(time * 3) * 4}px "Cormorant Garamond", serif`
        ctx.fillStyle = `rgba(200, 220, 255, ${alpha * 0.6})`
        ctx.textAlign = 'center'
        ctx.fillText('time has stopped', w / 2, h / 2)
        ctx.font = '12px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(200, 220, 255, ${alpha * 0.3})`
        ctx.fillText('...or has it', w / 2, h / 2 + 30)
        break
      }

      case 'cryptic_message': {
        // Text materializes from nothing
        const msg = CRYPTIC_MESSAGES[currentEffect.params.msgIdx % CRYPTIC_MESSAGES.length]
        const charReveal = Math.floor(msg.length * Math.min(1, progress * 2))
        const visible = msg.substring(0, charReveal)

        ctx.font = '18px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(180, 160, 200, ${alpha * 0.7})`
        ctx.textAlign = 'center'
        ctx.fillText(visible, w / 2, h / 2)

        // Glitch on each new character
        if (charReveal > 0 && Math.random() < 0.3) {
          ctx.fillStyle = `rgba(180, 160, 200, ${alpha * 0.15})`
          const glitchY = h / 2 + (Math.random() - 0.5) * 40
          ctx.fillText(msg, w / 2 + (Math.random() - 0.5) * 10, glitchY)
        }
        break
      }

      case 'map_reveal': {
        // Minimap briefly shows a massive area then shrinks back
        // Handled by temporarily expanding minimap in renderMinimap
        // Here just add a flash
        ctx.fillStyle = `rgba(40, 80, 40, ${alpha * 0.08})`
        ctx.fillRect(0, 0, w, h)
        ctx.font = '11px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(80, 160, 80, ${alpha * 0.4})`
        ctx.textAlign = 'center'
        ctx.fillText('the labyrinth reveals itself', w / 2, h - 60)
        break
      }

      case 'bell_toll': {
        // Visual ripple from center
        const rippleR = elapsed * 200
        const rippleAlpha = alpha * Math.max(0, 1 - rippleR / (Math.min(w, h) * 0.8))
        ctx.strokeStyle = `rgba(200, 180, 140, ${rippleAlpha * 0.4})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(w / 2, h / 2, rippleR, 0, Math.PI * 2)
        ctx.stroke()
        // Second ripple
        if (elapsed > 0.5) {
          const r2 = (elapsed - 0.5) * 200
          const a2 = alpha * Math.max(0, 1 - r2 / (Math.min(w, h) * 0.8))
          ctx.strokeStyle = `rgba(200, 180, 140, ${a2 * 0.3})`
          ctx.beginPath()
          ctx.arc(w / 2, h / 2, r2, 0, Math.PI * 2)
          ctx.stroke()
        }
        break
      }
    }

    ctx.restore()
  }

  function renderCulturalInscription(w: number, h: number): void {
    if (!ctx) return
    // Show cultural inscription based on which region the player is in
    const rx = Math.floor(px / REGION_SIZE)
    const ry = Math.floor(py / REGION_SIZE)
    const h2 = cellHash2(rx * REGION_SIZE + 5, ry * REGION_SIZE + 5)
    if (h2 >= 0.20) return // only ~20% of regions have inscriptions

    const idx = Math.floor(h2 * CULTURAL_INSCRIPTIONS.length / 0.20)
    const text = CULTURAL_INSCRIPTIONS[idx % CULTURAL_INSCRIPTIONS.length]
    const alpha = 0.04 + Math.sin(time * 0.4) * 0.015

    ctx.save()
    ctx.font = 'italic 11px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 180, 150, ${alpha})`
    ctx.textAlign = 'center'

    const words = text.split(' ')
    let line = ''
    let lineY = h - 80
    const maxLineW = Math.min(500, w * 0.7)
    for (const word of words) {
      const test = line ? line + ' ' + word : word
      if (ctx.measureText(test).width > maxLineW && line) {
        ctx.fillText(line, w / 2, lineY)
        line = word
        lineY += 14
      } else {
        line = test
      }
    }
    if (line) ctx.fillText(line, w / 2, lineY)
    ctx.restore()
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    update()

    const w = canvas.width
    const h = canvas.height
    const numRays = Math.min(w, 400)
    // FOV warps with insanity — gets wider, more fisheye
    const baseFov = Math.PI / 3
    const fov = baseFov + fovWarp * 0.3

    // Apply camera tilt at high insanity
    ctx.save()
    if (Math.abs(cameraTilt) > 0.001) {
      ctx.translate(w / 2, h / 2)
      ctx.rotate(cameraTilt)
      ctx.translate(-w / 2, -h / 2)
    }

    // Clear
    ctx.fillStyle = 'rgba(3, 2, 6, 1)'
    ctx.fillRect(-20, -20, w + 40, h + 40)

    // Horizon shifts with insanity
    const midLine = h / 2 + horizonShift

    // Ceiling with tension + insanity
    const breathe = Math.sin(time * 0.2) * 2
    const tensionFlicker = tension > 0.3 ? Math.random() * tension * 3 : 0
    const insanityFlicker = insanity > 0.5 ? Math.random() * (insanity - 0.5) * 8 : 0
    const ceilGrad = ctx.createLinearGradient(0, 0, 0, midLine)
    const ceilR = Math.floor(5 + breathe + tensionFlicker + insanityFlicker + colorShift * 0.1)
    const ceilG = Math.floor(3 + insanity * 5)
    const ceilB = Math.floor(10 + breathe - insanity * 4)
    ceilGrad.addColorStop(0, `rgba(${ceilR}, ${ceilG}, ${ceilB}, 1)`)
    ceilGrad.addColorStop(1, `rgba(${ceilR + 5}, ${ceilG + 5}, ${ceilB + 8}, 1)`)
    ctx.fillStyle = ceilGrad
    ctx.fillRect(0, 0, w, midLine)

    // Floor — gets sickly with insanity
    const floorGrad = ctx.createLinearGradient(0, midLine, 0, h)
    const floorR = Math.floor(8 + insanity * 8)
    const floorG = Math.floor(6 + insanity * 4)
    floorGrad.addColorStop(0, `rgba(${floorR}, ${floorG}, 12, 1)`)
    floorGrad.addColorStop(1, `rgba(3, 2, 6, 1)`)
    ctx.fillStyle = floorGrad
    ctx.fillRect(0, midLine, w, h - midLine)

    // Raycasting
    const stripW = w / numRays
    const visibleInscriptions: { text: string; screenX: number; dist: number; brightness: number }[] = []
    const visibleObjects: { obj: typeof WALL_OBJECTS[0]; screenX: number; wallTop: number; wallHeight: number; dist: number; brightness: number; wx: number; wy: number }[] = []

    for (let i = 0; i < numRays; i++) {
      const rayAngle = pa - fov / 2 + (i / numRays) * fov
      const hit = castRay(px, py, rayAngle)

      // Corridor stretch at high insanity — distant walls appear further
      let correctedDist = hit.dist * Math.cos(rayAngle - pa)
      if (corridorStretch > 1 && correctedDist > 3) {
        correctedDist *= 1 + (corridorStretch - 1) * (correctedDist - 3) * 0.1
      }

      // Wall height compression at very high insanity — ceiling closing in
      const heightMod = insanity > 0.6 ? 1 + (insanity - 0.6) * 0.5 : 1
      const wallHeight = Math.min(h * 2, (h / correctedDist) * heightMod)
      const wallTop = (midLine - wallHeight / 2)
      const brightness = Math.max(0, 1 - correctedDist / 10)
      const sideDim = hit.side ? 0.7 : 1.0

      // Tension + insanity flicker
      let flicker = 1
      if (tension > 0.4 && correctedDist > 4) {
        flicker -= Math.random() * tension * 0.15
      }
      if (insanity > 0.5 && Math.random() < 0.02) {
        flicker *= 0.3 // random dark flash on individual strips
      }

      const [r, g, b] = getCellColor(hit.cell, brightness * flicker, sideDim)
      ctx.fillStyle = `rgb(${Math.floor(Math.max(0, r))}, ${Math.floor(Math.max(0, g))}, ${Math.floor(Math.max(0, b))})`
      ctx.fillRect(i * stripW, wallTop, stripW + 1, wallHeight)

      // Collect inscription text from nearby walls
      if (hit.cell === INSCRIPTION && correctedDist < 4) {
        visibleInscriptions.push({
          text: getInscriptionText(hit.hitX, hit.hitY),
          screenX: i * stripW + stripW / 2,
          dist: correctedDist,
          brightness,
        })
      }

      // Collect wall objects on anomaly walls
      if (hit.cell === ANOMALY && correctedDist < 5) {
        const obj = getWallObject(hit.hitX, hit.hitY)
        if (obj) {
          visibleObjects.push({
            obj,
            screenX: i * stripW + stripW / 2,
            wallTop,
            wallHeight,
            dist: correctedDist,
            brightness,
            wx: hit.hitX,
            wy: hit.hitY,
          })
        }
      }
    }

    // Render wall inscriptions
    const shownTexts = new Set<string>()
    for (const insc of visibleInscriptions) {
      if (shownTexts.has(insc.text)) continue
      shownTexts.add(insc.text)

      const fontSize = Math.max(8, Math.min(14, 16 / insc.dist))
      const alpha = Math.min(0.6, insc.brightness * 0.8) * (0.5 + Math.sin(time * 0.5 + insc.screenX * 0.01) * 0.3)
      ctx.font = `${fontSize}px "Cormorant Garamond", serif`
      ctx.fillStyle = `rgba(180, 160, 200, ${alpha})`
      ctx.textAlign = 'center'

      ctx.save()
      ctx.translate(insc.screenX, midLine)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText(insc.text.substring(0, 20), 0, 0)
      ctx.restore()
    }

    // Render wall objects — specific clickable things on anomaly walls
    const shownObjects = new Set<string>()
    for (const vo of visibleObjects) {
      const key = `${vo.wx},${vo.wy}`
      if (shownObjects.has(key)) continue
      shownObjects.add(key)

      const yPos = getObjectYPos(vo.wx, vo.wy)
      const objY = vo.wallTop + vo.wallHeight * yPos
      const scale = Math.max(0.3, 1 - vo.dist / 5)
      const objW = vo.obj.w * scale
      const objH = vo.obj.h * scale
      const alpha = vo.brightness * (0.4 + Math.sin(time * 2 + vo.wx * 3.7) * 0.2)

      // Glow behind the object
      const glowR = 6 * scale
      const glowGrad = ctx.createRadialGradient(vo.screenX, objY, 0, vo.screenX, objY, glowR * 3)
      glowGrad.addColorStop(0, `rgba(140, 100, 200, ${alpha * 0.25})`)
      glowGrad.addColorStop(1, 'rgba(140, 100, 200, 0)')
      ctx.fillStyle = glowGrad
      ctx.fillRect(vo.screenX - glowR * 3, objY - glowR * 3, glowR * 6, glowR * 6)

      // Draw the object symbol
      const fontSize = Math.max(6, Math.floor(12 * scale))
      ctx.font = `${fontSize}px sans-serif`
      ctx.fillStyle = `rgba(200, 170, 240, ${alpha})`
      ctx.textAlign = 'center'
      ctx.fillText(vo.obj.icon, vo.screenX, objY + fontSize * 0.3)

      // At close range, show description
      if (vo.dist < 2.5) {
        ctx.font = `${Math.floor(9 * scale)}px "Cormorant Garamond", serif`
        ctx.fillStyle = `rgba(180, 160, 200, ${alpha * 0.5})`
        ctx.fillText(vo.obj.desc, vo.screenX, objY + fontSize + 8 * scale)
      }
    }

    // Fog overlay — tightens with insanity (vision narrows)
    const fogRadius = w * (0.6 - insanity * 0.15)
    const fogGrad = ctx.createRadialGradient(w / 2, midLine, 0, w / 2, midLine, fogRadius)
    fogGrad.addColorStop(0, 'rgba(3, 2, 6, 0)')
    fogGrad.addColorStop(0.6, `rgba(3, 2, 6, ${insanity * 0.1})`)
    fogGrad.addColorStop(1, `rgba(${3 + tension * 15 + insanity * 10}, 2, 6, ${0.4 + tension * 0.15 + insanity * 0.2})`)
    ctx.fillStyle = fogGrad
    ctx.fillRect(-20, -20, w + 40, h + 40)

    // Random visual glitch frames at high insanity
    if (Math.random() < glitchChance) {
      // Horizontal tear
      const tearY = Math.random() * h
      const tearH = 2 + Math.random() * 15
      const tearOffset = (Math.random() - 0.5) * 40
      const imgData = ctx.getImageData(0, Math.floor(tearY), w, Math.floor(tearH))
      ctx.putImageData(imgData, Math.floor(tearOffset), Math.floor(tearY))
    }
    if (insanity > 0.7 && Math.random() < 0.01) {
      // Brief color inversion flash
      ctx.globalCompositeOperation = 'difference'
      ctx.fillStyle = `rgba(255, 255, 255, ${(insanity - 0.7) * 0.5})`
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
    }

    // Portal room glow
    if (nearbyPortal) {
      const [pr, pg, pb] = nearbyPortal.color
      const portalGlow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.4)
      portalGlow.addColorStop(0, `rgba(${pr}, ${pg}, ${pb}, ${0.03 + Math.sin(time * 1.5) * 0.01})`)
      portalGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = portalGlow
      ctx.fillRect(0, 0, w, h)
    }

    // Crosshair — changes when looking at anomaly
    if (lookingAtAnomaly) {
      const pulse = 0.15 + Math.sin(time * 4) * 0.08
      ctx.strokeStyle = `rgba(180, 140, 255, ${pulse})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(w / 2, h / 2, 8, 0, Math.PI * 2)
      ctx.stroke()
      // Inner dot
      ctx.fillStyle = `rgba(180, 140, 255, ${pulse * 1.5})`
      ctx.beginPath()
      ctx.arc(w / 2, h / 2, 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.04)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(w / 2 - 6, h / 2)
      ctx.lineTo(w / 2 + 6, h / 2)
      ctx.moveTo(w / 2, h / 2 - 6)
      ctx.lineTo(w / 2, h / 2 + 6)
      ctx.stroke()
    }

    // Wikipedia fragment
    renderWikiFragment(w, h)

    // Minimap
    renderMinimap(w, h)

    // Cultural inscription
    renderCulturalInscription(w, h)

    // Title
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(140, 120, 160, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the labyrinth', w / 2, 25)

    // Nearby inscription text
    if (inscriptionText && inscriptionAlpha > 0.01) {
      ctx.font = '14px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(180, 160, 200, ${inscriptionAlpha * 0.5})`
      ctx.textAlign = 'center'
      ctx.fillText(inscriptionText, w / 2, h / 2 + 60)
    }

    // Anomaly interaction prompt
    if (lookingAtAnomaly && !currentEffect) {
      const pulse = 0.3 + Math.sin(time * 3) * 0.12
      ctx.font = '13px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(180, 140, 255, ${pulse})`
      ctx.textAlign = 'center'
      ctx.fillText('click or press space — something is here', w / 2, h / 2 + 45)
    }

    // Portal interaction prompt
    if (nearbyPortal) {
      const [pr, pg, pb] = nearbyPortal.color
      const portalAlpha = 0.4 + Math.sin(time * 2) * 0.15
      ctx.font = '12px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(${pr}, ${pg}, ${pb}, ${portalAlpha})`
      ctx.textAlign = 'center'
      ctx.fillText(`press E — a passage leads to ${nearbyPortal.label}`, w / 2, h - 40)
    }

    // Hint
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(140, 120, 160, 0.04)'
    ctx.textAlign = 'center'
    ctx.fillText('WASD to move · click glowing walls · the labyrinth forgets behind you', w / 2, h - 8)

    // Wall effect overlay
    renderWallEffect(w, h)

    // Jump scare overlay (on top of everything)
    renderJumpScare(w, h)

    // Close camera tilt transform
    ctx.restore()

    // Insanity indicator (very subtle)
    if (insanity > 0.15) {
      ctx.font = '10px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(140, 80, 80, ${Math.min(0.3, insanity * 0.3)})`
      ctx.textAlign = 'right'
      const sanityPct = Math.floor((1 - insanity) * 100)
      ctx.fillText(`sanity: ${sanityPct}%`, w - 15, h - 8)
    }
  }

  // ===== INPUT =====

  function handleKeyDown(e: KeyboardEvent) {
    if (!active) return
    const key = e.key.toLowerCase()
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      keys.add(key)
      e.preventDefault()
    }

    // Portal interaction
    if (key === 'e' && nearbyPortal && deps.switchTo) {
      deps.switchTo(nearbyPortal.room)
    }

    // Space or Enter to interact with anomaly
    if ((key === ' ' || key === 'enter') && lookingAtAnomaly) {
      e.preventDefault()
      triggerWallEffect()
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    keys.delete(e.key.toLowerCase())
  }

  function handleClick(e: MouseEvent) {
    if (!active) return
    e.preventDefault()
    initAudio() // ensure audio on first click
    if (lookingAtAnomaly) {
      triggerWallEffect()
    }
  }

  return {
    name: 'labyrinth',
    label: 'the labyrinth',

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
      canvas.style.cssText = 'width: 100%; height: 100%;'
      ctx = canvas.getContext('2d')

      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)
      canvas.addEventListener('click', handleClick)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)

      // Navigation portals embedded in overlay
      if (deps.switchTo) {
        const portalData = [
          { name: 'cipher', label: 'the cipher', color: '40, 160, 90', pos: 'top: 50px; left: 20px;' },
          { name: 'cartographer', label: 'the cartographer', color: '170, 140, 60', pos: 'top: 50px; right: 120px;' },
          { name: 'library', label: 'the library', color: '140, 50, 90', pos: 'top: 70px; left: 20px;' },
        ]
        for (const p of portalData) {
          const el = document.createElement('div')
          el.style.cssText = `
            position: absolute; ${p.pos}
            pointer-events: auto; cursor: pointer;
            font-family: 'Cormorant Garamond', serif;
            font-size: 10px; letter-spacing: 1px;
            color: rgba(${p.color}, 0.0);
            transition: color 0.5s ease;
            padding: 3px 6px; z-index: 10;
          `
          el.textContent = p.label
          el.addEventListener('mouseenter', () => {
            el.style.color = `rgba(${p.color}, 0.25)`
          })
          el.addEventListener('mouseleave', () => {
            el.style.color = `rgba(${p.color}, 0.0)`
          })
          el.addEventListener('click', (e) => {
            e.stopPropagation()
            deps.switchTo!(p.name)
          })
          overlay.appendChild(el)
        }
      }

      return overlay
    },

    activate() {
      active = true
      px = 1.5
      py = 1.5
      pa = 0
      keys.clear()
      exploredCells.clear()
      ghostRegions.clear()
      tension = 0
      tensionTarget = 0
      currentScare = null
      currentEffect = null
      lastScareTime = -999
      scareCount = 0
      insanity = 0
      cameraTilt = 0
      fovWarp = 0
      moveDrift = 0
      colorShift = 0
      breathePhase = 0
      corridorStretch = 0
      horizonShift = 0
      glitchChance = 0
      stepDelayMod = 1
      phantomSoundTimer = 10 + Math.random() * 15
      nearbyPortal = null
      inscriptionText = ''
      inscriptionAlpha = 0

      // Reset wiki for fresh session
      currentFragment = null
      lastFetchTime = time
      fetchIntervalSec = 8 + Math.random() * 10

      initAudio()
      loadScareAssets()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      keys.clear()
      currentFragment = null
      currentScare = null
      currentEffect = null

      if (dripTimeout) {
        clearTimeout(dripTimeout)
        dripTimeout = null
      }
      if (ambienceGain && audioCtx) {
        ambienceGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1)
      }
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      if (dripTimeout) {
        clearTimeout(dripTimeout)
        dripTimeout = null
      }
      audioCtx = null
      overlay?.remove()
    },
  }
}
