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
const DOOR_THRESHOLD = 0.50

// Numeric key encoding for Map/Set — avoids string allocation in hot paths
// Handles coordinates in [-50000, 50000] without collision
function numKey(x: number, y: number): number {
  return (x + 50000) * 100001 + (y + 50000)
}
function numKeyX(key: number): number {
  return Math.floor(key / 100001) - 50000
}
function numKeyY(key: number): number {
  return (key % 100001) - 50000
}

// Text fragments on walls
const WALL_FRAGMENTS = [
  'every path divides',
  'I have been here before',
  'the center is everywhere',
  'which turn did I take?',
  'walls remember what feet forget',
  'the way out is the way through',
  'one does not reach the center',
  'the thread is broken',
  'all labyrinths are one labyrinth',
  'the walls are shifting',
  'breadcrumbs dissolve',
  'forgetting the way back',
  'the maze dreams itself',
  'the corridor behind you has changed',
  'this wall was not here before',
  'you are the minotaur',
  'something followed me here',
  'the exit was inside you',
  'who built this',
  'do not look behind you',
  'the walls are warm',
  'I can hear it breathing',
  'this is not a place',
  'the floor remembers your weight',
  'someone wrote this before you did',
  'you forgot why you entered',
  'the door you came through is gone',
  'memory is a corridor that narrows',
  'names dissolve first',
  'the minotaur is also lost',
  'time moves differently in here',
  'the ceiling is lower than before',
  'nothing here stays found',
  'you were here yesterday',
  'the walls are listening',
  'forgetting is the oldest architecture',
  'every dead end was once a door',
  'the map is not the territory',
  'you are being remembered',
  'the labyrinth does not end',
  'what you seek has already left',
  'the echo knows your name',
  'there is no minotaur. there is only the maze.',
  'the passage behind you just closed',
  'something in the walls is dreaming',
  'you have been walking for years',
  'the stone tastes like salt',
  'each turn erases the last',
  'the light source does not exist',
  'who are you looking for',
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
  let lastFrameMs = 0
  let dtScale = 1 // frame-rate compensation: 1.0 at 60fps, 2.0 at 30fps

  // Session seed — makes every visit a different labyrinth
  let sessionSeed = 0

  // Player state — world coordinates
  let px = 1.5
  let py = 1.5
  let pa = 0 // angle in radians
  const moveSpeed = 0.014
  const turnSpeed = 0.025

  // Input
  const keys = new Set<string>()


  // Wall overrides — periodically opened walls to prevent getting stuck
  const wallOverrides = new Map<number, number>()
  let lastWallOpenTime = 0
  const WALL_OPEN_INTERVAL = 10 // seconds between random wall openings

  // Region salts for the forgetting mechanic
  const regionSalts = new Map<number, number>()
  const activeRegions = new Set<number>()

  // Explored cells for minimap
  const exploredCells = new Set<number>()

  // Minimap ghost regions (evicted)
  const ghostRegions = new Set<number>()

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
  let anomalyWX = 0
  let anomalyWY = 0
  const usedAnomalies = new Set<number>() // walls that have been clicked already

  // Ambient creepy sound system
  const ambientCreepyBuffers: AudioBuffer[] = []
  let lastCreepySoundTime = 0
  const CREEPY_SOUND_INTERVAL = 60 // seconds between ambient creepy sounds

  // Portal detection
  let nearbyPortal: { room: string; label: string; color: [number, number, number] } | null = null

  // Audio
  let audioInitialized = false
  let audioCtx: AudioContext | null = null
  let ambienceGain: GainNode | null = null
  let ambOsc: OscillatorNode | null = null
  let footstepGain: GainNode | null = null
  let footstepOsc: OscillatorNode | null = null
  let reverbNode: ConvolverNode | null = null
  let reverbGain: GainNode | null = null
  let dripTimeout: ReturnType<typeof setTimeout> | null = null
  let lastStepTime = 0

  // Pre-created noise buffers for phantom sounds (avoid main-thread blocking)
  let sharedNoiseBuffer: AudioBuffer | null = null
  let sharedBreathBuffer: AudioBuffer | null = null
  let sharedScrapeBuffer: AudioBuffer | null = null

  // Wikipedia system
  const wikiCache = new Set<string>()
  let currentFragment: WikiFragment | null = null
  let lastFetchTime = 0
  let fetchIntervalSec = 35
  let wikiFetchInProgress = false

  // Inscription hint
  let inscriptionText = ''
  let inscriptionAlpha = 0

  // ===== GHOST FIGURE SYSTEM =====
  // Spectral figures that appear in distant corridors and dissolve as you approach
  interface Ghost {
    x: number       // world position (center of an open cell)
    y: number
    spawnTime: number
    type: number    // appearance variant 0-4
    sway: number    // random sway phase offset
    height: number  // 0.6-1.0 relative height
  }
  const ghosts: Ghost[] = []
  let lastGhostSpawnTime = 0
  const GHOST_SPAWN_INTERVAL = 12 // seconds between spawn attempts
  const GHOST_MAX = 3
  const GHOST_APPEAR_DIST = 10   // visible from far
  const GHOST_DISSOLVE_DIST = 5  // start dissolving below this
  const GHOST_GONE_DIST = 2.5    // fully gone before you reach them

  // Pre-rendered ghost sprite canvas
  let ghostSpriteCanvas: HTMLCanvasElement | null = null

  function createGhostSprite(): HTMLCanvasElement {
    const sw = 64
    const sh = 128
    const c = document.createElement('canvas')
    c.width = sw
    c.height = sh
    const g = c.getContext('2d')!
    g.clearRect(0, 0, sw, sh)

    // Ethereal humanoid silhouette — drawn in white/blue with soft edges
    const cx = sw / 2
    // Head
    g.beginPath()
    g.arc(cx, 22, 10, 0, Math.PI * 2)
    g.fillStyle = 'rgba(180, 200, 220, 0.6)'
    g.fill()
    // Inner head glow
    g.beginPath()
    g.arc(cx, 22, 6, 0, Math.PI * 2)
    g.fillStyle = 'rgba(220, 230, 240, 0.4)'
    g.fill()
    // Eyes — two dim points
    g.fillStyle = 'rgba(100, 140, 180, 0.7)'
    g.fillRect(cx - 4, 20, 2, 2)
    g.fillRect(cx + 2, 20, 2, 2)

    // Neck
    g.fillStyle = 'rgba(160, 180, 200, 0.3)'
    g.fillRect(cx - 3, 32, 6, 6)

    // Body — tapers down, like a shroud
    g.beginPath()
    g.moveTo(cx - 14, 38)
    g.quadraticCurveTo(cx - 16, 70, cx - 10, 110)
    g.lineTo(cx + 10, 110)
    g.quadraticCurveTo(cx + 16, 70, cx + 14, 38)
    g.closePath()
    g.fillStyle = 'rgba(160, 180, 210, 0.35)'
    g.fill()

    // Inner body lighter core
    g.beginPath()
    g.moveTo(cx - 8, 42)
    g.quadraticCurveTo(cx - 9, 65, cx - 5, 100)
    g.lineTo(cx + 5, 100)
    g.quadraticCurveTo(cx + 9, 65, cx + 8, 42)
    g.closePath()
    g.fillStyle = 'rgba(190, 210, 230, 0.2)'
    g.fill()

    // Arms — thin, slightly outstretched
    g.strokeStyle = 'rgba(160, 180, 200, 0.25)'
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(cx - 14, 44)
    g.quadraticCurveTo(cx - 22, 58, cx - 18, 72)
    g.stroke()
    g.beginPath()
    g.moveTo(cx + 14, 44)
    g.quadraticCurveTo(cx + 22, 58, cx + 18, 72)
    g.stroke()

    // Bottom dissolve — fades to nothing (the figure has no feet)
    const fadeGrad = g.createLinearGradient(0, 90, 0, 120)
    fadeGrad.addColorStop(0, 'rgba(0,0,0,0)')
    fadeGrad.addColorStop(1, 'rgba(0,0,0,1)')
    g.globalCompositeOperation = 'destination-out'
    g.fillStyle = fadeGrad
    g.fillRect(0, 90, sw, 38)
    g.globalCompositeOperation = 'source-over'

    return c
  }

  function spawnGhost(): void {
    if (ghosts.length >= GHOST_MAX) return
    // Spawn along visible corridors — cast rays near player's facing direction
    // and place the ghost in an open cell the player can actually SEE
    for (let attempt = 0; attempt < 12; attempt++) {
      // Bias toward forward direction but allow some peripheral spawns
      const angleOffset = (Math.random() - 0.5) * Math.PI * 0.8
      const rayAngle = pa + angleOffset
      const hit = castRay(px, py, rayAngle)
      // Need at least 3 tiles of clear corridor
      if (hit.dist < 3.5) continue
      // Place ghost at 60-85% of the way to the wall — visible but distant
      const placeDist = hit.dist * (0.6 + Math.random() * 0.25)
      const gx = px + Math.cos(rayAngle) * placeDist
      const gy = py + Math.sin(rayAngle) * placeDist
      // Snap to nearest open cell center
      const cellX = Math.floor(gx)
      const cellY = Math.floor(gy)
      // Check it's an open cell
      if (getWorldCell(cellX, cellY) !== 0) continue
      const cx = cellX + 0.5
      const cy = cellY + 0.5
      // Not too close to player or other ghosts
      if (Math.hypot(cx - px, cy - py) < 3) continue
      const tooClose = ghosts.some(g => Math.hypot(g.x - cx, g.y - cy) < 3)
      if (tooClose) continue
      // Verify line of sight from player
      const verifyHit = castRay(px, py, Math.atan2(cy - py, cx - px))
      if (verifyHit.dist < Math.hypot(cx - px, cy - py) * 0.9) continue
      ghosts.push({
        x: cx,
        y: cy,
        spawnTime: time,
        type: Math.floor(Math.random() * 5),
        sway: Math.random() * Math.PI * 2,
        height: 0.65 + Math.random() * 0.35,
      })
      return
    }
  }

  function updateGhosts(): void {
    // Remove ghosts that the player has approached (fully dissolved)
    for (let i = ghosts.length - 1; i >= 0; i--) {
      const g = ghosts[i]
      const dist = Math.hypot(g.x - px, g.y - py)
      if (dist < GHOST_GONE_DIST) {
        ghosts.splice(i, 1)
      }
      // Also remove ghosts that have been alive too long (60s)
      else if (time - g.spawnTime > 60) {
        ghosts.splice(i, 1)
      }
    }

    // Spawn new ghosts periodically
    const interval = ghosts.length === 0 ? 8 : GHOST_SPAWN_INTERVAL
    if (time - lastGhostSpawnTime > interval && time > 10) {
      // Higher insanity = more frequent spawns, first ghost is guaranteed
      const spawnChance = ghosts.length === 0 ? 1 : 0.5 + insanity * 0.4
      if (Math.random() < spawnChance) {
        spawnGhost()
      }
      lastGhostSpawnTime = time
    }
  }

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
  // placement: 'wall' (normal), 'floor' (near bottom), 'ceiling' (near top), 'floating' (bobs up and down)
  // physics: 'static' (fixed), 'bob' (gentle float), 'spin' (rotates), 'breathe' (pulses size), 'drip' (occasional drip particles)
  const WALL_OBJECTS = [
    { name: 'rusty_handle', icon: '⬮', desc: 'a rusty door handle', w: 8, h: 14, placement: 'wall', physics: 'static', scale: 1.0 },
    { name: 'crack', icon: '╱', desc: 'a crack with light', w: 12, h: 20, placement: 'wall', physics: 'breathe', scale: 1.3 },
    { name: 'eye_hole', icon: '◉', desc: 'something watches', w: 6, h: 6, placement: 'wall', physics: 'static', scale: 0.8 },
    { name: 'carved_symbol', icon: '✧', desc: 'a carved symbol', w: 10, h: 10, placement: 'ceiling', physics: 'spin', scale: 1.0 },
    { name: 'small_mirror', icon: '◻', desc: 'a small mirror', w: 8, h: 12, placement: 'wall', physics: 'static', scale: 1.2 },
    { name: 'bloodstain', icon: '●', desc: 'a dark stain', w: 14, h: 10, placement: 'floor', physics: 'drip', scale: 1.5 },
    { name: 'keyhole', icon: '⚿', desc: 'a keyhole', w: 4, h: 8, placement: 'wall', physics: 'static', scale: 0.9 },
    { name: 'handprint', icon: '✋', desc: 'a handprint', w: 12, h: 14, placement: 'wall', physics: 'static', scale: 1.1 },
    { name: 'fungus', icon: '❋', desc: 'strange growth', w: 16, h: 10, placement: 'floor', physics: 'breathe', scale: 1.4 },
    { name: 'candle', icon: '🕯', desc: 'a flickering candle', w: 4, h: 12, placement: 'wall', physics: 'bob', scale: 1.0 },
    { name: 'scratches', icon: '≡', desc: 'deep scratches', w: 16, h: 8, placement: 'ceiling', physics: 'static', scale: 1.2 },
    { name: 'face_relief', icon: '☹', desc: 'a face in the stone', w: 12, h: 14, placement: 'wall', physics: 'breathe', scale: 1.3 },
    { name: 'skull', icon: '💀', desc: 'a skull on the ground', w: 14, h: 14, placement: 'floor', physics: 'static', scale: 1.1 },
    { name: 'floating_orb', icon: '◯', desc: 'something floats here', w: 10, h: 10, placement: 'floating', physics: 'bob', scale: 0.9 },
    { name: 'chain', icon: '⛓', desc: 'chains hang from above', w: 6, h: 20, placement: 'ceiling', physics: 'bob', scale: 1.3 },
    { name: 'rune', icon: '᛭', desc: 'a glowing rune', w: 10, h: 10, placement: 'floating', physics: 'spin', scale: 1.0 },
  ]

  function getWallObject(wx: number, wy: number): typeof WALL_OBJECTS[0] | null {
    if (getWorldCell(wx, wy) !== ANOMALY) return null
    const h = cellHash2(wx + 17, wy + 31)
    return WALL_OBJECTS[Math.floor(h * WALL_OBJECTS.length)]
  }

  function getObjectYPos(wx: number, wy: number): number {
    // Fully random position on the wall — floor, ceiling, anywhere
    const h = cellHash2(wx + 7, wy + 13)
    return 0.05 + h * 0.85  // anywhere from near ceiling (0.05) to near floor (0.9)
  }

  // ===== HASH-BASED INFINITE MAZE =====

  function regionKey(wx: number, wy: number): number {
    const rx = Math.floor(wx / REGION_SIZE)
    const ry = Math.floor(wy / REGION_SIZE)
    return numKey(rx, ry)
  }

  function cellHash(wx: number, wy: number): number {
    const rx = Math.floor(wx / REGION_SIZE)
    const ry = Math.floor(wy / REGION_SIZE)
    const salt = regionSalts.get(numKey(rx, ry)) ?? 0
    let h = (wx * 374761393 + wy * 668265263 + (salt + sessionSeed) * 1013904223) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    h = h ^ (h >>> 16)
    return (h >>> 0) / 4294967296
  }

  function cellHash2(wx: number, wy: number): number {
    const rx = Math.floor(wx / REGION_SIZE)
    const ry = Math.floor(wy / REGION_SIZE)
    const salt = regionSalts.get(numKey(rx, ry)) ?? 0
    let h = (wx * 668265263 + wy * 374761393 + (salt + sessionSeed) * 2654435769) | 0
    h = Math.imul(h ^ (h >>> 13), 2246822507)
    h = h ^ (h >>> 16)
    return (h >>> 0) / 4294967296
  }

  // Check if this door has the minimum hash among a room's 4 doors
  // Inlined to avoid array allocations in hot path (~4000 calls/frame)
  function isDoorMinForRoom(roomX: number, roomY: number, doorX: number, doorY: number, doorHash: number): boolean {
    if (!(roomX === doorX && roomY - 1 === doorY) && cellHash(roomX, roomY - 1) < doorHash) return false
    if (!(roomX === doorX && roomY + 1 === doorY) && cellHash(roomX, roomY + 1) < doorHash) return false
    if (!(roomX - 1 === doorX && roomY === doorY) && cellHash(roomX - 1, roomY) < doorHash) return false
    if (!(roomX + 1 === doorX && roomY === doorY) && cellHash(roomX + 1, roomY) < doorHash) return false
    return true
  }

  function getWorldCell(wx: number, wy: number): number {
    // Check wall overrides first (manually opened walls)
    const overrideKey = numKey(wx, wy)
    if (wallOverrides.has(overrideKey)) return wallOverrides.get(overrideKey)!

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
    if (h2 < 0.13) return INSCRIPTION  // ~13% of walls have text
    if (h2 < 0.18) return ANOMALY  // ~5% of walls are clickable anomalies

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

  // Cache inscription texts to avoid rebuilding arrays every frame
  let cachedAllTexts: string[] | null = null
  let cachedAllTextsTime = -1

  function getInscriptionText(wx: number, wy: number): { text: string; isMemory: boolean } {
    // Rebuild cache every 5 seconds (memories rarely change)
    if (!cachedAllTexts || time - cachedAllTextsTime > 5) {
      const memTexts = deps.getMemories?.().map(m => m.currentText).filter(t => t.length > 3) ?? []
      const weightedMems = [...memTexts.slice(0, 10), ...memTexts.slice(0, 10), ...memTexts.slice(0, 10)]
      cachedAllTexts = [...WALL_FRAGMENTS, ...weightedMems]
      cachedAllTextsTime = time
    }
    const idx = Math.floor(cellHash2(wx + 3, wy + 7) * cachedAllTexts.length)
    const text = cachedAllTexts[idx % cachedAllTexts.length]
    const isMemory = idx >= WALL_FRAGMENTS.length
    return { text, isMemory }
  }

  // ===== REGION MANAGEMENT =====

  function updateRegions(): void {
    const prx = Math.floor(px / REGION_SIZE)
    const pry = Math.floor(py / REGION_SIZE)

    const newActive = new Set<number>()
    for (let dx = -KEEP_RADIUS; dx <= KEEP_RADIUS; dx++) {
      for (let dy = -KEEP_RADIUS; dy <= KEEP_RADIUS; dy++) {
        newActive.add(numKey(prx + dx, pry + dy))
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
    wallU: number // 0-1 fractional position along wall face
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
        const absDist = Math.abs(dist)
        // Calculate wallU — fractional position along wall face (0-1)
        let wallU: number
        if (side === 0) {
          wallU = oy + absDist * dy
        } else {
          wallU = ox + absDist * dx
        }
        wallU = wallU - Math.floor(wallU)
        // Flip U for correct text orientation
        if ((side === 0 && dx > 0) || (side === 1 && dy < 0)) {
          wallU = 1 - wallU
        }
        return { dist: absDist, side, cell, hitX: mapX, hitY: mapY, wallU }
      }
    }

    return { dist: 30, side: 0, cell: 0, hitX: mapX, hitY: mapY, wallU: 0 }
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
    if (audioInitialized) return
    audioInitialized = true
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

      // Pre-create noise buffers for phantom sounds (avoids main-thread blocking)
      const sr = audioCtx.sampleRate
      // 4-second white noise buffer (reused for whisper/breath/scrape sounds)
      sharedNoiseBuffer = audioCtx.createBuffer(1, sr * 4, sr)
      const nd = sharedNoiseBuffer.getChannelData(0)
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
      // Breath-shaped noise (inhale/exhale envelope baked in)
      sharedBreathBuffer = audioCtx.createBuffer(1, sr * 3, sr)
      const bd = sharedBreathBuffer.getChannelData(0)
      for (let i = 0; i < bd.length; i++) {
        const t = i / bd.length
        const env = t < 0.4 ? Math.sin((t / 0.4) * Math.PI * 0.5) : Math.sin(((t - 0.4) / 0.6) * Math.PI)
        bd[i] = (Math.random() * 2 - 1) * env
      }
      // Scrape-shaped noise (decaying)
      sharedScrapeBuffer = audioCtx.createBuffer(1, sr, sr)
      const sd = sharedScrapeBuffer.getChannelData(0)
      for (let i = 0; i < sd.length; i++) sd[i] = (Math.random() * 2 - 1) * (1 - i / sd.length)

      // Load scare sounds now that audioCtx is ready
      loadScareAssets()
    } catch {
      // Audio not available
      audioInitialized = false
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

    // Load ambient creepy sounds (kids laughter, singing, alien speaking)
    for (let i = 1; i <= 12; i++) {
      try {
        const resp = await fetch(`/assets/labyrinth/ambient/ambient-${i}.mp3`)
        if (resp.ok) {
          const buf = await resp.arrayBuffer()
          const audioBuf = await audioCtx.decodeAudioData(buf)
          ambientCreepyBuffers.push(audioBuf)
        }
      } catch { /* missing assets ok */ }
    }
  }

  function playAmbientCreepySound() {
    if (!audioCtx || ambientCreepyBuffers.length === 0) return
    const dest = getAudioDestination()
    const now = audioCtx.currentTime

    const buf = ambientCreepyBuffers[Math.floor(Math.random() * ambientCreepyBuffers.length)]
    const src = audioCtx.createBufferSource()
    src.buffer = buf

    // Random stereo pan for spatial feel
    const panner = audioCtx.createStereoPanner()
    panner.pan.value = (Math.random() - 0.5) * 1.6

    // Soft volume with fade in/out
    const gain = audioCtx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.08 + Math.random() * 0.06, now + 0.5)
    gain.gain.setValueAtTime(0.08 + Math.random() * 0.06, now + buf.duration - 1)
    gain.gain.linearRampToValueAtTime(0, now + buf.duration)

    // Slight pitch variation for uncanniness
    src.playbackRate.value = 0.9 + Math.random() * 0.2

    src.connect(panner)
    panner.connect(gain)
    gain.connect(dest)
    src.start(now)
  }

  /** Play only the AI-generated scare sound (no synth layers) */
  function playScareSound(intensity: number = 1) {
    if (!audioCtx) return
    const dest = getAudioDestination()

    // Play pre-generated AI sound only
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
  }

  /** Synthesized horror sting — used rarely for random ambient scares, NOT on every jump scare */
  function playSynthHorrorSting(intensity: number = 0.6) {
    if (!audioCtx) return
    const dest = getAudioDestination()
    const now = audioCtx.currentTime

    // Sub-bass body slam
    const thump = audioCtx.createOscillator()
    thump.frequency.setValueAtTime(50, now)
    thump.frequency.exponentialRampToValueAtTime(20, now + 0.4)
    thump.type = 'sine'
    const thumpGain = audioCtx.createGain()
    thumpGain.gain.setValueAtTime(0.25 * intensity, now)
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
    thump.connect(thumpGain)
    thumpGain.connect(dest)
    thump.start(now)
    thump.stop(now + 0.7)

    // Metallic screech
    const screech = audioCtx.createOscillator()
    screech.frequency.setValueAtTime(1200 + Math.random() * 800, now)
    screech.frequency.linearRampToValueAtTime(2800 + Math.random() * 400, now + 0.15)
    screech.type = 'sawtooth'
    const screechGain = audioCtx.createGain()
    screechGain.gain.setValueAtTime(0.07 * intensity, now)
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

    // Distorted white noise burst
    const noiseLen = audioCtx.sampleRate * 0.3
    const noiseBuf = audioCtx.createBuffer(1, noiseLen, audioCtx.sampleRate)
    const noiseData = noiseBuf.getChannelData(0)
    for (let i = 0; i < noiseLen; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen)
    }
    const noiseSrc = audioCtx.createBufferSource()
    noiseSrc.buffer = noiseBuf
    const noiseGain = audioCtx.createGain()
    noiseGain.gain.setValueAtTime(0.08 * intensity, now)
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
    // No scares during first 20 seconds — let the atmosphere build
    if (time < 20) return
    // Cooldown decreases with insanity (min 10s at full insanity, 35s at zero)
    const cooldown = Math.max(10, 35 - insanity * 25 - scareCount * 2)
    if (time - lastScareTime < cooldown) return

    const exits = countExits(Math.floor(px), Math.floor(py))

    // Build tension — faster at higher insanity
    const insanityAccel = 1 + insanity * 2
    if (exits <= 1) {
      tensionTarget = Math.min(1, tensionTarget + 0.004 * insanityAccel)
    } else if (exits === 2) {
      tensionTarget = Math.min(1, tensionTarget + 0.001 * insanityAccel)
    } else {
      tensionTarget = Math.max(0, tensionTarget - 0.003)
    }

    // Random tension spikes — more frequent at high insanity
    if (Math.random() < 0.001 + insanity * 0.002) {
      tensionTarget = Math.min(1, tensionTarget + 0.3)
    }

    // Ambient unease builds over time just from wandering
    if (time > 30) {
      tensionTarget = Math.min(1, tensionTarget + 0.0003)
    }

    tension += (tensionTarget - tension) * 0.02

    // Scare probability scales with insanity — at 0 insanity almost never, at 1 very frequent
    const scareChance = 0.002 + insanity * 0.02
    const scareThreshold = 0.6 - insanity * 0.3 // threshold drops from 0.6 to 0.3

    if (tension > scareThreshold && Math.random() < scareChance) {
      triggerScare()
    }

    // Rare random scare at high insanity even at low tension
    if (insanity > 0.3 && time - lastScareTime > 45 && Math.random() < insanity * 0.003) {
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

  // Object-specific interactions (overrides generic effect for certain objects)
  let brightBoostEnd = 0  // temporary brightness boost from candle
  let invertMovementEnd = 0 // movement inversion from mirror

  function triggerObjectInteraction(): boolean {
    const obj = getWallObject(anomalyWX, anomalyWY)
    if (!obj) return false

    switch (obj.name) {
      case 'candle':
        // Take the candle — temporary brightness boost for 8 seconds
        brightBoostEnd = time + 8
        if (audioCtx) {
          const now = audioCtx.currentTime
          const osc = audioCtx.createOscillator()
          osc.type = 'sine'
          osc.frequency.value = 660
          const env = audioCtx.createGain()
          env.gain.setValueAtTime(0.05, now)
          env.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
          osc.connect(env)
          env.connect(getAudioDestination())
          osc.start(now)
          osc.stop(now + 0.4)
        }
        return true

      case 'small_mirror':
        // Mirror — inverts movement controls for 4 seconds + screen flash
        invertMovementEnd = time + 4
        currentEffect = {
          triggeredAt: time, duration: 0.5,
          type: 'screen_invert', params: {},
        }
        insanity = Math.min(1, insanity + 0.1)
        return true

      case 'fungus':
        // Fungus — releases spores, green-tinted vision for 6 seconds
        currentEffect = {
          triggeredAt: time, duration: 6,
          type: 'aurora', params: { hue: 120, spiralDir: 1, originX: anomalyScreenX, msgIdx: 0 },
        }
        // Fungus restores some sanity (natural calm)
        insanity = Math.max(0, insanity - 0.15)
        return true

      case 'keyhole':
        // Peek through — brief map reveal
        currentEffect = {
          triggeredAt: time, duration: 3,
          type: 'map_reveal', params: { hue: 0, spiralDir: 1, originX: anomalyScreenX, msgIdx: 0 },
        }
        insanity = Math.max(0, insanity - 0.2) // knowledge calms you
        return true

      default:
        return false // use generic effect system
    }
  }

  function triggerWallEffect() {
    if (currentEffect) return

    // Mark this anomaly as used — can only click each wall once
    usedAnomalies.add(numKey(anomalyWX, anomalyWY))

    // Try object-specific interaction first
    if (triggerObjectInteraction()) return

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

    // Sanity impact: scary = lose 10%, non-scary = recover a little
    if (category === 'scary') {
      insanity = Math.min(1, insanity + 0.1)
    } else {
      insanity = Math.max(0, insanity - 0.08)
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
    const vol = 0.015 + insanity * 0.025 // gentle base volume
    const roll = Math.random()

    if (roll < 0.18) {
      // WHISPERING — pre-created noise with bandpass filter for speech-like texture
      if (!sharedNoiseBuffer) return
      const dur = 1.5 + Math.random() * 2
      const src = audioCtx.createBufferSource()
      src.buffer = sharedNoiseBuffer
      const offset = Math.random() * 2 // random start within buffer
      const f = audioCtx.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.value = 1800 + Math.random() * 800
      f.Q.value = 8 + Math.random() * 6
      // Syllable-like modulation via gain automation (runs on audio thread)
      const g = audioCtx.createGain()
      const syllableRate = 3 + Math.random() * 4
      for (let t = 0; t < dur; t += 0.04) {
        const env = Math.sin((t / dur) * Math.PI)
        const syllable = 0.4 + 0.6 * Math.abs(Math.sin(t * syllableRate * Math.PI))
        g.gain.setValueAtTime(vol * 1.2 * env * syllable, now + t)
      }
      g.gain.setValueAtTime(0, now + dur)
      src.connect(f); f.connect(g); g.connect(dest)
      if (reverbNode) g.connect(reverbNode)
      src.start(now, offset, dur)
    } else if (roll < 0.33) {
      // CHILDREN'S SINGING — high sine tones with vibrato, like a distant lullaby
      const noteCount = 4 + Math.floor(Math.random() * 5)
      const baseFreq = 400 + Math.random() * 200
      const scale = [0, 2, 3, 5, 7, 8, 12] // minor scale semitones
      for (let i = 0; i < noteCount; i++) {
        const osc = audioCtx.createOscillator()
        osc.type = 'sine'
        const semitone = scale[Math.floor(Math.random() * scale.length)]
        const freq = baseFreq * Math.pow(2, semitone / 12)
        osc.frequency.value = freq
        // Vibrato
        const vib = audioCtx.createOscillator()
        vib.frequency.value = 4 + Math.random() * 3
        const vibGain = audioCtx.createGain()
        vibGain.gain.value = freq * 0.02
        vib.connect(vibGain); vibGain.connect(osc.frequency)
        vib.start(now)
        const noteStart = now + i * (0.3 + Math.random() * 0.25)
        const noteDur = 0.25 + Math.random() * 0.2
        const ng = audioCtx.createGain()
        ng.gain.setValueAtTime(0, noteStart)
        ng.gain.linearRampToValueAtTime(vol * 0.8, noteStart + 0.05)
        ng.gain.linearRampToValueAtTime(vol * 0.6, noteStart + noteDur * 0.7)
        ng.gain.linearRampToValueAtTime(0, noteStart + noteDur)
        osc.connect(ng); ng.connect(dest)
        if (reverbNode) ng.connect(reverbNode)
        osc.start(noteStart); osc.stop(noteStart + noteDur + 0.1)
        vib.stop(noteStart + noteDur + 0.1)
      }
    } else if (roll < 0.48) {
      // HAUNTING VOICE — formant-like filtered sawtooth, speaking nonsense
      const syllables = 3 + Math.floor(Math.random() * 4)
      const baseFreq = 80 + Math.random() * 60 // deep voice
      for (let i = 0; i < syllables; i++) {
        const osc = audioCtx.createOscillator()
        osc.type = 'sawtooth'
        osc.frequency.value = baseFreq + (Math.random() - 0.5) * 20
        // Formant filter — vowel-like resonance
        const formant = audioCtx.createBiquadFilter()
        formant.type = 'bandpass'
        const vowelFreqs = [270, 530, 730, 1000, 1300] // a, e, i, o, u ish
        formant.frequency.value = vowelFreqs[Math.floor(Math.random() * vowelFreqs.length)]
        formant.Q.value = 5 + Math.random() * 5
        const sStart = now + i * (0.2 + Math.random() * 0.15)
        const sDur = 0.15 + Math.random() * 0.2
        const sg = audioCtx.createGain()
        sg.gain.setValueAtTime(0, sStart)
        sg.gain.linearRampToValueAtTime(vol * 1.5, sStart + 0.03)
        sg.gain.linearRampToValueAtTime(vol * 0.8, sStart + sDur * 0.6)
        sg.gain.linearRampToValueAtTime(0, sStart + sDur)
        osc.connect(formant); formant.connect(sg); sg.connect(dest)
        if (reverbNode) sg.connect(reverbNode)
        osc.start(sStart); osc.stop(sStart + sDur + 0.05)
      }
    } else if (roll < 0.58) {
      // DISTANT KNOCKING
      const knocks = 2 + Math.floor(Math.random() * 3)
      for (let i = 0; i < knocks; i++) {
        const knock = audioCtx.createOscillator()
        knock.frequency.value = 180 + Math.random() * 120
        knock.type = 'square'
        const kg = audioCtx.createGain()
        const t = now + i * (0.15 + Math.random() * 0.1)
        kg.gain.setValueAtTime(vol * 2, t)
        kg.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
        knock.connect(kg); kg.connect(dest)
        if (reverbNode) kg.connect(reverbNode)
        knock.start(t); knock.stop(t + 0.1)
      }
    } else if (roll < 0.68) {
      // BREATH — pre-created breath noise with gain envelope for inhale/exhale
      if (!sharedBreathBuffer) return
      const dur = 2 + Math.random() * 1.5
      const src = audioCtx.createBufferSource()
      src.buffer = sharedBreathBuffer
      const offset = Math.random() * 0.5
      const f = audioCtx.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.value = 600 + Math.random() * 400
      f.Q.value = 3
      const g = audioCtx.createGain()
      // Inhale/exhale envelope via gain automation (audio thread)
      for (let t = 0; t < dur; t += 0.04) {
        const p = t / dur
        const breathEnv = p < 0.4
          ? Math.sin((p / 0.4) * Math.PI * 0.5)
          : Math.sin(((p - 0.4) / 0.6) * Math.PI)
        g.gain.setValueAtTime(vol * 1.5 * breathEnv, now + t)
      }
      g.gain.setValueAtTime(0, now + dur)
      src.connect(f); f.connect(g); g.connect(dest)
      if (reverbNode) g.connect(reverbNode)
      src.start(now, offset, dur)
    } else if (roll < 0.78) {
      // SCRAPING — pre-created decay noise with sweeping bandpass
      if (!sharedScrapeBuffer) return
      const src = audioCtx.createBufferSource()
      src.buffer = sharedScrapeBuffer
      const f = audioCtx.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.setValueAtTime(300, now)
      f.frequency.linearRampToValueAtTime(2000, now + 0.8)
      f.Q.value = 5
      const g = audioCtx.createGain()
      g.gain.value = vol * 2
      src.connect(f); f.connect(g); g.connect(dest)
      if (reverbNode) g.connect(reverbNode)
      src.start(now, 0, 0.8)
    } else if (roll < 0.88) {
      // HUMMING — single sustained tone, like someone humming in the dark
      const osc = audioCtx.createOscillator()
      osc.type = 'sine'
      const freq = 180 + Math.random() * 80
      osc.frequency.value = freq
      // Slow wavering
      const vib = audioCtx.createOscillator()
      vib.frequency.value = 2 + Math.random() * 2
      const vibG = audioCtx.createGain()
      vibG.gain.value = freq * 0.01
      vib.connect(vibG); vibG.connect(osc.frequency)
      vib.start(now)
      const dur = 2 + Math.random() * 2
      const g = audioCtx.createGain()
      g.gain.setValueAtTime(0, now)
      g.gain.linearRampToValueAtTime(vol, now + 0.5)
      g.gain.linearRampToValueAtTime(vol * 0.7, now + dur - 0.5)
      g.gain.linearRampToValueAtTime(0, now + dur)
      osc.connect(g); g.connect(dest)
      if (reverbNode) g.connect(reverbNode)
      osc.start(now); osc.stop(now + dur + 0.1)
      vib.stop(now + dur + 0.1)
    } else {
      // SOFT CRYING — pitch-bending sine with tremolo
      const dur = 1.5 + Math.random() * 1.5
      const osc = audioCtx.createOscillator()
      osc.type = 'sine'
      const startF = 300 + Math.random() * 150
      osc.frequency.setValueAtTime(startF, now)
      // Sobbing pitch contour
      for (let i = 0; i < 4; i++) {
        const t = now + i * dur / 4
        osc.frequency.linearRampToValueAtTime(startF + 40, t + dur / 8)
        osc.frequency.linearRampToValueAtTime(startF - 20, t + dur / 4)
      }
      // Tremolo
      const trem = audioCtx.createOscillator()
      trem.frequency.value = 6 + Math.random() * 4
      const tremG = audioCtx.createGain()
      tremG.gain.value = vol * 0.4
      trem.connect(tremG)
      const g = audioCtx.createGain()
      g.gain.setValueAtTime(0, now)
      g.gain.linearRampToValueAtTime(vol * 0.8, now + 0.2)
      g.gain.linearRampToValueAtTime(0, now + dur)
      tremG.connect(g.gain)
      osc.connect(g); g.connect(dest)
      if (reverbNode) g.connect(reverbNode)
      trem.start(now)
      osc.start(now); osc.stop(now + dur + 0.1)
      trem.stop(now + dur + 0.1)
    }
  }

  // ===== INSANITY UPDATE =====

  function updateInsanity() {
    // Insanity increases slowly but relentlessly
    // ~0.15 per minute at start, accelerating faster
    const baseRate = 0.00004
    const accel = 1 + insanity * 3 // accelerates as it gets worse
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

    // Movement drift — disabled (caused stutter from wall collisions)
    moveDrift = 0

    // Color shift — hue rotation increasing
    colorShift = insanity > 0.25 ? (insanity - 0.25) * 80 : 0

    // Wall breathing — walls expand and contract
    breathePhase = insanity > 0.1 ? Math.sin(time * 0.8) * insanity * 0.15 : 0

    // Corridor stretch — distant walls appear further (visual only)
    corridorStretch = insanity > 0.35 ? 1 + (insanity - 0.35) * 0.8 : 1

    // Horizon shift — the ground plane moves
    horizonShift = insanity > 0.4 ? Math.sin(time * 0.25) * (insanity - 0.4) * 40 : 0

    // Visual glitch chance per frame
    glitchChance = insanity > 0.3 ? (insanity - 0.3) * 0.05 : 0

    // Footstep timing distortion
    stepDelayMod = insanity > 0.5 ? 1 + Math.sin(time * 2) * (insanity - 0.5) * 0.6 : 1

    // Phantom sounds — play from the start, with random pauses
    // Interval: 8-30s at low insanity, 3-10s at high insanity
    phantomSoundTimer -= 0.016 * dtScale
    if (phantomSoundTimer <= 0) {
      const minInterval = Math.max(3, 10 - insanity * 8)
      const maxInterval = Math.max(8, 30 - insanity * 22)
      phantomSoundTimer = minInterval + Math.random() * (maxInterval - minInterval)
      playPhantomSound()
    }
  }

  // ===== UPDATE =====

  function update() {
    // Update insanity before everything else
    updateInsanity()

    // Ambient creepy sounds — kids laughter, singing, alien speaking (~every 60s)
    if (time - lastCreepySoundTime > CREEPY_SOUND_INTERVAL) {
      lastCreepySoundTime = time
      if (ambientCreepyBuffers.length > 0) {
        // Add slight randomness (50-70 seconds between)
        lastCreepySoundTime -= Math.random() * 10
        playAmbientCreepySound()
      }
    }

    let moveX = 0
    let moveY = 0
    let moving = false

    // Movement with insanity-induced drift (mirror inverts controls temporarily)
    // Scale by dtScale for frame-rate independence
    const inverted = time < invertMovementEnd
    const effectiveAngle = pa + moveDrift
    const moveDir = inverted ? -1 : 1
    const scaledMoveSpeed = moveSpeed * dtScale
    if (keys.has('w') || keys.has('arrowup')) {
      moveX += Math.cos(effectiveAngle) * scaledMoveSpeed * moveDir
      moveY += Math.sin(effectiveAngle) * scaledMoveSpeed * moveDir
      moving = true
    }
    if (keys.has('s') || keys.has('arrowdown')) {
      moveX -= Math.cos(effectiveAngle) * scaledMoveSpeed * moveDir
      moveY -= Math.sin(effectiveAngle) * scaledMoveSpeed * moveDir
      moving = true
    }

    // Turn speed — scaled by dtScale for frame-rate independence
    const effectiveTurnSpeed = turnSpeed * dtScale
    if (keys.has('a') || keys.has('arrowleft')) {
      pa -= effectiveTurnSpeed
    }
    if (keys.has('d') || keys.has('arrowright')) {
      pa += effectiveTurnSpeed
    }

    // At high insanity, involuntary micro-movements (creepy ambient drift)
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

    // Track explored cells
    exploredCells.add(numKey(Math.floor(px), Math.floor(py)))

    // Periodically open a random wall near the player to prevent dead ends
    if (time - lastWallOpenTime > WALL_OPEN_INTERVAL) {
      lastWallOpenTime = time
      // Search for a wall in the player's vicinity and open it
      const searchRadius = 10
      const candidates: [number, number][] = []
      const flPx = Math.floor(px)
      const flPy = Math.floor(py)
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
          const wx = flPx + dx
          const wy = flPy + dy
          const xOdd = (wx & 1) === 1
          const yOdd = (wy & 1) === 1
          // Only door positions (mixed parity) that are currently walls
          if (xOdd === yOdd) continue
          if (wallOverrides.has(numKey(wx, wy))) continue
          const cell = getWorldCell(wx, wy)
          if (cell === WALL || cell === INSCRIPTION) {
            candidates.push([wx, wy])
          }
        }
      }
      if (candidates.length > 0) {
        const [owx, owy] = candidates[Math.floor(Math.random() * candidates.length)]
        wallOverrides.set(numKey(owx, owy), 0)
      }
    }

    // Update regions (the labyrinth forgets distant areas)
    updateRegions()

    // Prune explored cells far from player periodically
    if (Math.floor(time * 60) % 300 === 0) {
      const floorPx = Math.floor(px)
      const floorPy = Math.floor(py)
      for (const key of exploredCells) {
        const cx = numKeyX(key)
        const cy = numKeyY(key)
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
    const anomalyKey = numKey(centerHit.hitX, centerHit.hitY)
    lookingAtAnomaly = centerHit.cell === ANOMALY && centerHit.dist < 3.5 && !usedAnomalies.has(anomalyKey)
    anomalyDist = centerHit.dist
    anomalyScreenX = canvas ? canvas.width / 2 : 400
    anomalyWX = centerHit.hitX
    anomalyWY = centerHit.hitY

    // Expire current effect
    if (currentEffect && time - currentEffect.triggeredAt > currentEffect.duration) {
      currentEffect = null
    }

    // Update tension/scare
    checkScare()

    // Update ghost figures
    updateGhosts()

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
            inscriptionText = getInscriptionText(wx, wy).text
            inscriptionAlpha = Math.min(0.6, 1 - dist / checkRadius)
            break
          }
        }
      }
      if (inscriptionText) break
    }
  }

  // ===== HAND-DRAWN TEXT RENDERING =====

  /** Render text in a hand-drawn/scratched style — memories scrawled on walls */
  function drawHandwrittenText(c: CanvasRenderingContext2D, text: string, fontSize: number, alpha: number, wx: number, wy: number) {
    const chars = text.split('')
    const totalWidth = chars.length * fontSize * 0.55
    let xOffset = -totalWidth / 2

    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i]
      // Seeded randomness per character position (consistent per wall)
      const seed1 = cellHash2(wx * 100 + i * 7, wy * 100 + i * 13)
      const seed2 = cellHash2(wx * 100 + i * 13, wy * 100 + i * 7)
      const seed3 = cellHash2(wx * 100 + i * 19, wy * 100 + i * 23)

      // Per-character jitter
      const charRotation = (seed1 - 0.5) * 0.3     // stronger tilt
      const yJitter = (seed2 - 0.5) * fontSize * 0.35
      const sizeJitter = 0.8 + seed3 * 0.4
      const alphaJitter = 0.6 + seed1 * 0.4

      const charSize = fontSize * sizeJitter

      c.save()
      c.translate(xOffset, yJitter)
      c.rotate(charRotation)

      // Warm amber color for memories (like chalk or charcoal on stone)
      const warmth = 0.5 + seed2 * 0.5
      const r = Math.floor(200 + warmth * 40)
      const g = Math.floor(160 + warmth * 30)
      const b = Math.floor(80 + warmth * 20)

      // Use Caveat (handwriting font) with fallback to cursive
      c.font = `${Math.floor(charSize)}px "Caveat", cursive`
      c.textAlign = 'center'
      c.textBaseline = 'middle'

      // --- Multi-pass painted/drawn effect ---
      // Pass 1: Big chalky glow halo — looks like paint bleeding into stone
      c.shadowColor = `rgba(${r}, ${g}, ${b}, ${alpha * 0.5})`
      c.shadowBlur = 6 + seed3 * 4
      c.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * alphaJitter * 0.3})`
      c.fillText(ch, (seed1 - 0.5) * 1.5, (seed2 - 0.5) * 1.5)
      c.shadowBlur = 0
      c.shadowColor = 'transparent'

      // Pass 2: Bold fill — the main painted stroke
      c.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * alphaJitter * 0.8})`
      c.fillText(ch, 0, 0)

      // Pass 3: Second fill offset — thicker paint strokes
      c.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * alphaJitter * 0.5})`
      c.fillText(ch, (seed3 - 0.5) * 2, (seed1 - 0.5) * 1.5)

      // Pass 4: Stroke outline for crispness
      c.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * alphaJitter * 0.4})`
      c.lineWidth = 1.2 + seed2 * 0.6
      c.strokeText(ch, 0, 0)

      // Paint drip effect on some characters
      if (seed1 > 0.75) {
        const dripLen = charSize * (0.4 + seed2 * 0.6)
        c.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * alphaJitter * 0.15})`
        c.fillRect(-1, charSize * 0.3, 2 + seed3 * 2, dripLen)
      }

      c.restore()

      xOffset += charSize * 0.55 + (seed2 - 0.5) * 3 // more irregular spacing
    }
  }

  // ===== MEMORY PICTOGRAPH SYSTEM =====
  // Converts memory text keywords into procedural symbol drawings on walls

  /** Keyword-to-symbol mapping: words found in memories trigger pictograph drawings */
  const PICTOGRAPH_KEYWORDS: { words: string[]; draw: (c: CanvasRenderingContext2D, s: number, t: number) => void }[] = [
    { words: ['sun', 'sunny', 'sunrise', 'sunset', 'dawn', 'morning', 'bright'],
      draw: (c, s, t) => {
        // Sun with rays
        const pulse = 0.8 + Math.sin(t * 2) * 0.2
        c.strokeStyle = `rgba(255, 200, 60, ${0.6 * pulse})`
        c.lineWidth = 1.5
        c.beginPath(); c.arc(0, 0, s * 0.15, 0, Math.PI * 2); c.stroke()
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + t * 0.3
          c.beginPath()
          c.moveTo(Math.cos(a) * s * 0.2, Math.sin(a) * s * 0.2)
          c.lineTo(Math.cos(a) * s * 0.32, Math.sin(a) * s * 0.32)
          c.stroke()
        }
      }},
    { words: ['moon', 'night', 'dark', 'midnight', 'stars', 'dream'],
      draw: (c, s, t) => {
        // Crescent moon
        c.strokeStyle = `rgba(200, 200, 255, ${0.5 + Math.sin(t) * 0.15})`
        c.lineWidth = 1.5
        c.beginPath(); c.arc(0, 0, s * 0.18, 0, Math.PI * 2); c.stroke()
        c.fillStyle = 'rgba(5, 3, 10, 0.9)'
        c.beginPath(); c.arc(s * 0.07, -s * 0.03, s * 0.14, 0, Math.PI * 2); c.fill()
        // Tiny stars
        c.fillStyle = `rgba(200, 200, 255, ${0.3 + Math.sin(t * 3) * 0.15})`
        c.fillRect(-s * 0.3, -s * 0.25, 1.5, 1.5)
        c.fillRect(s * 0.2, -s * 0.3, 1, 1)
        c.fillRect(s * 0.1, s * 0.2, 1.5, 1.5)
      }},
    { words: ['water', 'ocean', 'sea', 'river', 'rain', 'wave', 'swim', 'lake', 'beach'],
      draw: (c, s, t) => {
        // Waves
        c.strokeStyle = `rgba(80, 160, 220, ${0.5 + Math.sin(t * 1.5) * 0.2})`
        c.lineWidth = 1.5
        for (let row = -1; row <= 1; row++) {
          c.beginPath()
          for (let x = -s * 0.35; x <= s * 0.35; x += 2) {
            const y = row * s * 0.12 + Math.sin(x * 0.12 + t * 2 + row) * s * 0.04
            if (x === -s * 0.35) c.moveTo(x, y)
            else c.lineTo(x, y)
          }
          c.stroke()
        }
      }},
    { words: ['heart', 'love', 'loved', 'kiss', 'hug', 'care'],
      draw: (c, s, t) => {
        // Heart shape
        const beat = 1 + Math.sin(t * 3) * 0.08
        c.strokeStyle = `rgba(220, 80, 100, ${0.6 + Math.sin(t * 2) * 0.15})`
        c.lineWidth = 1.5
        c.beginPath()
        c.moveTo(0, s * 0.1 * beat)
        c.bezierCurveTo(-s * 0.2 * beat, -s * 0.1 * beat, -s * 0.25 * beat, -s * 0.2 * beat, 0, -s * 0.08 * beat)
        c.bezierCurveTo(s * 0.25 * beat, -s * 0.2 * beat, s * 0.2 * beat, -s * 0.1 * beat, 0, s * 0.1 * beat)
        c.stroke()
      }},
    { words: ['tree', 'forest', 'wood', 'leaf', 'garden', 'grow', 'plant', 'flower'],
      draw: (c, s, t) => {
        // Simple tree
        c.strokeStyle = `rgba(100, 140, 80, ${0.5 + Math.sin(t * 0.8) * 0.15})`
        c.lineWidth = 2
        c.beginPath(); c.moveTo(0, s * 0.2); c.lineTo(0, -s * 0.05); c.stroke()
        // Branches
        c.lineWidth = 1
        const sway = Math.sin(t * 0.5) * 0.05
        c.beginPath()
        c.moveTo(0, -s * 0.05); c.lineTo(-s * 0.15 + sway * s, -s * 0.2)
        c.moveTo(0, -s * 0.05); c.lineTo(s * 0.15 + sway * s, -s * 0.18)
        c.moveTo(0, 0); c.lineTo(-s * 0.1 + sway * s, -s * 0.12)
        c.stroke()
        // Foliage
        c.fillStyle = `rgba(80, 140, 60, ${0.2 + Math.sin(t * 0.7) * 0.08})`
        c.beginPath(); c.arc(0, -s * 0.15, s * 0.15, 0, Math.PI * 2); c.fill()
      }},
    { words: ['house', 'home', 'room', 'door', 'window', 'family', 'kitchen'],
      draw: (c, s, t) => {
        // Simple house
        c.strokeStyle = `rgba(180, 160, 120, ${0.5 + Math.sin(t * 0.6) * 0.15})`
        c.lineWidth = 1.5
        // Walls
        c.strokeRect(-s * 0.15, -s * 0.05, s * 0.3, s * 0.2)
        // Roof
        c.beginPath()
        c.moveTo(-s * 0.18, -s * 0.05)
        c.lineTo(0, -s * 0.22)
        c.lineTo(s * 0.18, -s * 0.05)
        c.stroke()
        // Door
        c.strokeRect(-s * 0.03, s * 0.05, s * 0.06, s * 0.1)
        // Window glow
        const glow = 0.15 + Math.sin(t * 1.5) * 0.1
        c.fillStyle = `rgba(255, 200, 80, ${glow})`
        c.fillRect(s * 0.04, -s * 0.01, s * 0.06, s * 0.05)
      }},
    { words: ['fire', 'burn', 'flame', 'warm', 'hot', 'candle'],
      draw: (c, s, t) => {
        // Flickering flame
        const flick = Math.sin(t * 6) * 0.15
        c.fillStyle = `rgba(255, 140, 40, ${0.4 + flick})`
        c.beginPath()
        c.moveTo(-s * 0.06, s * 0.1)
        c.quadraticCurveTo(-s * 0.1, -s * 0.1 + flick * s, 0, -s * (0.25 + flick * 0.3))
        c.quadraticCurveTo(s * 0.1, -s * 0.1 - flick * s, s * 0.06, s * 0.1)
        c.fill()
        // Inner blue core
        c.fillStyle = `rgba(80, 120, 255, ${0.3 + flick * 0.5})`
        c.beginPath()
        c.moveTo(-s * 0.02, s * 0.06)
        c.quadraticCurveTo(-s * 0.03, 0, 0, -s * 0.06)
        c.quadraticCurveTo(s * 0.03, 0, s * 0.02, s * 0.06)
        c.fill()
      }},
    { words: ['eye', 'see', 'watch', 'look', 'stare', 'gaze', 'vision'],
      draw: (c, s, t) => {
        // Eye
        c.strokeStyle = `rgba(200, 180, 160, ${0.5 + Math.sin(t) * 0.15})`
        c.lineWidth = 1.5
        c.beginPath()
        c.moveTo(-s * 0.2, 0)
        c.quadraticCurveTo(0, -s * 0.15, s * 0.2, 0)
        c.quadraticCurveTo(0, s * 0.15, -s * 0.2, 0)
        c.stroke()
        // Iris
        c.beginPath(); c.arc(Math.sin(t * 0.5) * s * 0.03, 0, s * 0.06, 0, Math.PI * 2); c.stroke()
        // Pupil
        c.fillStyle = `rgba(20, 10, 30, 0.8)`
        c.beginPath(); c.arc(Math.sin(t * 0.5) * s * 0.03, 0, s * 0.025, 0, Math.PI * 2); c.fill()
      }},
    { words: ['mountain', 'hill', 'climb', 'peak', 'snow', 'high', 'sky'],
      draw: (c, s, t) => {
        // Mountains
        c.strokeStyle = `rgba(140, 130, 160, ${0.5 + Math.sin(t * 0.4) * 0.1})`
        c.lineWidth = 1.5
        c.beginPath()
        c.moveTo(-s * 0.35, s * 0.15)
        c.lineTo(-s * 0.1, -s * 0.2)
        c.lineTo(s * 0.05, s * 0.05)
        c.lineTo(s * 0.2, -s * 0.12)
        c.lineTo(s * 0.35, s * 0.15)
        c.stroke()
        // Snow cap
        c.strokeStyle = `rgba(220, 230, 255, ${0.3 + Math.sin(t * 0.6) * 0.1})`
        c.lineWidth = 1
        c.beginPath()
        c.moveTo(-s * 0.15, -s * 0.12)
        c.lineTo(-s * 0.1, -s * 0.2)
        c.lineTo(-s * 0.05, -s * 0.12)
        c.stroke()
      }},
    { words: ['bird', 'fly', 'wing', 'feather', 'crow', 'sparrow'],
      draw: (c, s, t) => {
        // Flying bird (simple V shapes)
        c.strokeStyle = `rgba(160, 150, 170, ${0.5 + Math.sin(t * 1.2) * 0.15})`
        c.lineWidth = 1.5
        const flap = Math.sin(t * 3) * s * 0.04
        c.beginPath()
        c.moveTo(-s * 0.15, flap)
        c.quadraticCurveTo(-s * 0.05, -s * 0.08 + flap, 0, 0)
        c.quadraticCurveTo(s * 0.05, -s * 0.08 - flap, s * 0.15, -flap)
        c.stroke()
        // Second bird further away
        c.globalAlpha = 0.5
        c.beginPath()
        c.moveTo(-s * 0.08 + s * 0.15, -s * 0.1 + flap * 0.5)
        c.quadraticCurveTo(-s * 0.02 + s * 0.15, -s * 0.15 + flap * 0.5, s * 0.02 + s * 0.15, -s * 0.1)
        c.stroke()
        c.globalAlpha = 1
      }},
    { words: ['clock', 'time', 'hour', 'minute', 'wait', 'year', 'old', 'age', 'yesterday'],
      draw: (c, s, t) => {
        // Clock face
        c.strokeStyle = `rgba(180, 170, 160, ${0.5 + Math.sin(t * 0.3) * 0.1})`
        c.lineWidth = 1.5
        c.beginPath(); c.arc(0, 0, s * 0.18, 0, Math.PI * 2); c.stroke()
        // Hour marks
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2
          c.beginPath()
          c.moveTo(Math.cos(a) * s * 0.14, Math.sin(a) * s * 0.14)
          c.lineTo(Math.cos(a) * s * 0.17, Math.sin(a) * s * 0.17)
          c.stroke()
        }
        // Hands (moving)
        const hourAngle = (t * 0.05) % (Math.PI * 2) - Math.PI / 2
        const minAngle = (t * 0.3) % (Math.PI * 2) - Math.PI / 2
        c.beginPath()
        c.moveTo(0, 0)
        c.lineTo(Math.cos(hourAngle) * s * 0.1, Math.sin(hourAngle) * s * 0.1)
        c.stroke()
        c.lineWidth = 1
        c.beginPath()
        c.moveTo(0, 0)
        c.lineTo(Math.cos(minAngle) * s * 0.14, Math.sin(minAngle) * s * 0.14)
        c.stroke()
      }},
    { words: ['spiral', 'round', 'circle', 'loop', 'again', 'repeat', 'cycle'],
      draw: (c, s, t) => {
        // Spiral
        c.strokeStyle = `rgba(180, 140, 200, ${0.5 + Math.sin(t * 0.8) * 0.15})`
        c.lineWidth = 1
        c.beginPath()
        for (let a = 0; a < Math.PI * 6; a += 0.1) {
          const r = a * s * 0.015 + Math.sin(t + a * 0.5) * s * 0.005
          const x = Math.cos(a + t * 0.2) * r
          const y = Math.sin(a + t * 0.2) * r
          if (a === 0) c.moveTo(x, y)
          else c.lineTo(x, y)
        }
        c.stroke()
      }},
    { words: ['hand', 'touch', 'hold', 'grab', 'finger', 'reach'],
      draw: (c, s, t) => {
        // Open hand outline
        c.strokeStyle = `rgba(180, 160, 140, ${0.5 + Math.sin(t * 0.7) * 0.1})`
        c.lineWidth = 1.5
        // Palm
        c.beginPath(); c.ellipse(0, s * 0.05, s * 0.1, s * 0.13, 0, 0, Math.PI * 2); c.stroke()
        // Fingers (simplified)
        const fPos = [[-0.07, -0.15], [-0.025, -0.2], [0.025, -0.19], [0.07, -0.14], [0.12, 0.02]]
        for (const [fx, fy] of fPos) {
          c.beginPath()
          c.moveTo(fx * s * 0.8, (fy + 0.1) * s)
          c.lineTo(fx * s * 1.2, fy * s)
          c.stroke()
        }
      }},
    { words: ['key', 'lock', 'open', 'close', 'secret', 'hidden'],
      draw: (c, s, t) => {
        // Key shape
        c.strokeStyle = `rgba(200, 180, 100, ${0.5 + Math.sin(t * 1.5) * 0.15})`
        c.lineWidth = 1.5
        // Ring
        c.beginPath(); c.arc(-s * 0.1, 0, s * 0.08, 0, Math.PI * 2); c.stroke()
        // Shaft
        c.beginPath(); c.moveTo(-s * 0.02, 0); c.lineTo(s * 0.2, 0); c.stroke()
        // Teeth
        c.beginPath()
        c.moveTo(s * 0.12, 0); c.lineTo(s * 0.12, s * 0.06)
        c.moveTo(s * 0.17, 0); c.lineTo(s * 0.17, s * 0.05)
        c.stroke()
      }},
  ]

  /** Extract pictograph symbols from text and draw them */
  function drawMemoryPictographs(c: CanvasRenderingContext2D, text: string, size: number, alpha: number, wx: number, wy: number) {
    const lowerText = text.toLowerCase()
    const matched: typeof PICTOGRAPH_KEYWORDS = []

    for (const pk of PICTOGRAPH_KEYWORDS) {
      for (const word of pk.words) {
        if (lowerText.includes(word)) {
          matched.push(pk)
          break
        }
      }
    }

    if (matched.length === 0) return

    // Draw up to 2 matched symbols, spaced along the wall
    const toDraw = matched.slice(0, 2)
    const spacing = size * 0.8
    const startX = -spacing * (toDraw.length - 1) / 2

    for (let i = 0; i < toDraw.length; i++) {
      c.save()
      // Position symbols below the text
      c.translate(startX + i * spacing, size * 0.5)
      c.globalAlpha = alpha * 0.7
      // Slight per-wall variation
      const wobble = cellHash2(wx + i * 17, wy + i * 31) * 0.2 - 0.1
      c.rotate(wobble)
      toDraw[i].draw(c, size, time)
      c.globalAlpha = 1
      c.restore()
    }
  }

  // ===== PROCEDURAL OBJECT RENDERING =====

  /** Draw a wall object using Canvas2D procedural graphics instead of icons */
  function drawRenderedObject(c: CanvasRenderingContext2D, name: string, size: number, t: number, wx: number, wy: number) {
    const s = size // shorthand
    const hash = cellHash2(wx + 5, wy + 11) // deterministic variation per object

    switch (name) {
      case 'candle': {
        // A dripping candle with flickering flame
        const flicker = Math.sin(t * 8 + hash * 20) * 0.3 + Math.sin(t * 13) * 0.15
        // Flame glow
        const glowGrad = c.createRadialGradient(0, -s * 0.4, 0, 0, -s * 0.4, s * 0.8)
        glowGrad.addColorStop(0, `rgba(255, 180, 50, ${0.3 + flicker * 0.1})`)
        glowGrad.addColorStop(1, 'rgba(255, 100, 20, 0)')
        c.fillStyle = glowGrad
        c.fillRect(-s, -s * 1.2, s * 2, s * 1.6)
        // Candle body
        c.fillStyle = `rgba(220, 200, 170, 0.8)`
        c.fillRect(-s * 0.12, -s * 0.15, s * 0.24, s * 0.55)
        // Wax drips
        c.fillStyle = 'rgba(210, 190, 160, 0.6)'
        c.beginPath()
        c.ellipse(-s * 0.08, s * 0.08, s * 0.04, s * 0.12, 0, 0, Math.PI * 2)
        c.fill()
        // Wick
        c.strokeStyle = 'rgba(80, 60, 40, 0.7)'
        c.lineWidth = 1
        c.beginPath()
        c.moveTo(0, -s * 0.15)
        c.lineTo(0, -s * 0.25)
        c.stroke()
        // Flame
        c.fillStyle = `rgba(255, ${200 + flicker * 40}, ${80 + flicker * 60}, 0.9)`
        c.beginPath()
        c.moveTo(-s * 0.06, -s * 0.25)
        c.quadraticCurveTo(-s * 0.08, -s * (0.5 + flicker * 0.1), 0, -s * (0.65 + flicker * 0.08))
        c.quadraticCurveTo(s * 0.08, -s * (0.5 + flicker * 0.1), s * 0.06, -s * 0.25)
        c.fill()
        break
      }

      case 'eye_hole': {
        // A realistic eye peering through the wall
        const pupilDrift = Math.sin(t * 0.7 + hash * 10) * s * 0.04
        // Dark socket
        const socketGrad = c.createRadialGradient(0, 0, s * 0.05, 0, 0, s * 0.3)
        socketGrad.addColorStop(0, 'rgba(20, 10, 30, 0.9)')
        socketGrad.addColorStop(1, 'rgba(40, 25, 50, 0.3)')
        c.fillStyle = socketGrad
        c.beginPath()
        c.ellipse(0, 0, s * 0.3, s * 0.2, 0, 0, Math.PI * 2)
        c.fill()
        // Eye white
        c.fillStyle = 'rgba(200, 195, 180, 0.7)'
        c.beginPath()
        c.ellipse(0, 0, s * 0.18, s * 0.11, 0, 0, Math.PI * 2)
        c.fill()
        // Iris
        const irisHue = hash > 0.5 ? 'rgba(60, 120, 80, 0.9)' : 'rgba(100, 80, 50, 0.9)'
        c.fillStyle = irisHue
        c.beginPath()
        c.arc(pupilDrift, 0, s * 0.07, 0, Math.PI * 2)
        c.fill()
        // Pupil
        c.fillStyle = 'rgba(5, 0, 10, 0.95)'
        c.beginPath()
        c.arc(pupilDrift, 0, s * 0.035, 0, Math.PI * 2)
        c.fill()
        // Highlight
        c.fillStyle = 'rgba(255, 255, 255, 0.4)'
        c.beginPath()
        c.arc(pupilDrift - s * 0.02, -s * 0.02, s * 0.015, 0, Math.PI * 2)
        c.fill()
        break
      }

      case 'crack': {
        // A crack in the wall with light bleeding through
        c.strokeStyle = `rgba(200, 180, 255, ${0.5 + Math.sin(t * 2) * 0.2})`
        c.lineWidth = 2
        c.shadowColor = 'rgba(200, 180, 255, 0.5)'
        c.shadowBlur = 8
        c.beginPath()
        c.moveTo(0, -s * 0.5)
        c.lineTo(-s * 0.08, -s * 0.2)
        c.lineTo(s * 0.05, -s * 0.05)
        c.lineTo(-s * 0.03, s * 0.15)
        c.lineTo(s * 0.07, s * 0.35)
        c.lineTo(0, s * 0.5)
        c.stroke()
        // Light bleeding from crack
        c.shadowBlur = 0
        const lightGrad = c.createLinearGradient(-s * 0.3, 0, s * 0.3, 0)
        lightGrad.addColorStop(0, 'rgba(200, 180, 255, 0)')
        lightGrad.addColorStop(0.45, `rgba(220, 200, 255, ${0.1 + Math.sin(t * 3) * 0.05})`)
        lightGrad.addColorStop(0.55, `rgba(220, 200, 255, ${0.1 + Math.sin(t * 3) * 0.05})`)
        lightGrad.addColorStop(1, 'rgba(200, 180, 255, 0)')
        c.fillStyle = lightGrad
        c.fillRect(-s * 0.3, -s * 0.5, s * 0.6, s)
        break
      }

      case 'small_mirror': {
        // A tarnished mirror with warped reflection
        // Frame
        c.strokeStyle = 'rgba(140, 120, 80, 0.7)'
        c.lineWidth = 2
        c.strokeRect(-s * 0.2, -s * 0.3, s * 0.4, s * 0.6)
        // Mirror surface
        const mirGrad = c.createLinearGradient(-s * 0.2, -s * 0.3, s * 0.2, s * 0.3)
        mirGrad.addColorStop(0, 'rgba(80, 90, 100, 0.6)')
        mirGrad.addColorStop(0.5, 'rgba(120, 130, 150, 0.5)')
        mirGrad.addColorStop(1, 'rgba(60, 70, 80, 0.6)')
        c.fillStyle = mirGrad
        c.fillRect(-s * 0.18, -s * 0.28, s * 0.36, s * 0.56)
        // Distorted face shape (your reflection)
        const faceAlpha = 0.15 + Math.sin(t * 1.5) * 0.08
        c.fillStyle = `rgba(180, 160, 140, ${faceAlpha})`
        c.beginPath()
        c.ellipse(Math.sin(t * 0.8) * s * 0.03, 0, s * 0.08, s * 0.12, 0, 0, Math.PI * 2)
        c.fill()
        break
      }

      case 'bloodstain': {
        // Organic dark splatter on the floor/wall
        const splats = 3 + Math.floor(hash * 4)
        for (let i = 0; i < splats; i++) {
          const sx = (cellHash2(wx + i * 7, wy + i * 3) - 0.5) * s * 0.5
          const sy = (cellHash2(wx + i * 3, wy + i * 7) - 0.5) * s * 0.4
          const sr = s * (0.06 + cellHash2(wx + i * 11, wy + i * 13) * 0.12)
          c.fillStyle = `rgba(${80 + Math.floor(hash * 40)}, 15, 20, ${0.5 + hash * 0.3})`
          c.beginPath()
          c.ellipse(sx, sy, sr, sr * (0.6 + cellHash2(wx + i, wy) * 0.8), hash * Math.PI, 0, Math.PI * 2)
          c.fill()
        }
        break
      }

      case 'keyhole': {
        // A proper keyhole shape with darkness behind
        // Outer plate
        c.fillStyle = 'rgba(100, 90, 70, 0.7)'
        c.beginPath()
        c.ellipse(0, -s * 0.05, s * 0.15, s * 0.2, 0, 0, Math.PI * 2)
        c.fill()
        // Keyhole
        c.fillStyle = 'rgba(5, 0, 10, 0.95)'
        c.beginPath()
        c.arc(0, -s * 0.08, s * 0.05, 0, Math.PI * 2)
        c.fill()
        c.beginPath()
        c.moveTo(-s * 0.03, -s * 0.04)
        c.lineTo(s * 0.03, -s * 0.04)
        c.lineTo(s * 0.02, s * 0.1)
        c.lineTo(-s * 0.02, s * 0.1)
        c.closePath()
        c.fill()
        // Light from inside
        const keyGlow = c.createRadialGradient(0, 0, 0, 0, 0, s * 0.12)
        keyGlow.addColorStop(0, `rgba(160, 140, 200, ${0.15 + Math.sin(t * 2) * 0.08})`)
        keyGlow.addColorStop(1, 'rgba(160, 140, 200, 0)')
        c.fillStyle = keyGlow
        c.fillRect(-s * 0.12, -s * 0.15, s * 0.24, s * 0.3)
        break
      }

      case 'handprint': {
        // A ghostly handprint pressed into the wall
        c.fillStyle = `rgba(${hash > 0.5 ? '120, 40, 50' : '60, 80, 100'}, ${0.4 + Math.sin(t * 1.2) * 0.1})`
        // Palm
        c.beginPath()
        c.ellipse(0, s * 0.05, s * 0.14, s * 0.18, 0, 0, Math.PI * 2)
        c.fill()
        // Fingers
        const fingers = [[-0.1, -0.2, 0.03, 0.12], [-0.04, -0.25, 0.025, 0.13], [0.03, -0.23, 0.025, 0.12], [0.09, -0.18, 0.025, 0.1], [0.15, 0.0, 0.025, 0.08]]
        for (const [fx, fy, fw, fh] of fingers) {
          c.beginPath()
          c.ellipse(fx * s, fy * s, fw * s, fh * s, (fx - 0.02) * 0.5, 0, Math.PI * 2)
          c.fill()
        }
        break
      }

      case 'fungus': {
        // Bio-luminescent fungal growth
        const clusters = 4 + Math.floor(hash * 5)
        for (let i = 0; i < clusters; i++) {
          const fx = (cellHash2(wx + i * 5, wy + i * 9) - 0.5) * s * 0.5
          const fy = (cellHash2(wx + i * 9, wy + i * 5) - 0.3) * s * 0.4
          const fr = s * (0.04 + cellHash2(wx + i * 3, wy + i * 7) * 0.08)
          // Bioluminescent glow
          const glowGrad = c.createRadialGradient(fx, fy, 0, fx, fy, fr * 3)
          glowGrad.addColorStop(0, `rgba(80, 200, 120, ${0.2 + Math.sin(t * 1.5 + i) * 0.1})`)
          glowGrad.addColorStop(1, 'rgba(40, 160, 80, 0)')
          c.fillStyle = glowGrad
          c.fillRect(fx - fr * 3, fy - fr * 3, fr * 6, fr * 6)
          // Cap
          c.fillStyle = `rgba(100, 180, 130, ${0.6 + Math.sin(t * 2 + i * 2) * 0.15})`
          c.beginPath()
          c.ellipse(fx, fy, fr, fr * 0.6, 0, Math.PI, 0)
          c.fill()
          // Stem
          c.fillStyle = 'rgba(80, 140, 100, 0.5)'
          c.fillRect(fx - fr * 0.15, fy, fr * 0.3, fr * 0.8)
        }
        break
      }

      case 'scratches': {
        // Deep parallel scratch marks gouged into stone
        const numScratches = 3 + Math.floor(hash * 3)
        c.strokeStyle = `rgba(60, 50, 70, 0.8)`
        c.lineWidth = 1.5
        for (let i = 0; i < numScratches; i++) {
          const sx = (-0.3 + i * 0.15) * s
          const angle = -0.2 + hash * 0.4
          c.beginPath()
          c.moveTo(sx + Math.cos(angle) * s * 0.2, -s * 0.2)
          c.lineTo(sx - Math.cos(angle) * s * 0.2, s * 0.2)
          c.stroke()
        }
        // Inner light on scratches
        c.strokeStyle = `rgba(160, 140, 180, ${0.15 + Math.sin(t) * 0.05})`
        c.lineWidth = 0.5
        for (let i = 0; i < numScratches; i++) {
          const sx = (-0.3 + i * 0.15) * s + 1
          c.beginPath()
          c.moveTo(sx, -s * 0.18)
          c.lineTo(sx, s * 0.18)
          c.stroke()
        }
        break
      }

      case 'face_relief': {
        // An eerie face carved into the stone
        c.fillStyle = `rgba(80, 70, 90, ${0.5 + Math.sin(t * 0.8) * 0.15})`
        // Face outline
        c.beginPath()
        c.ellipse(0, 0, s * 0.2, s * 0.28, 0, 0, Math.PI * 2)
        c.fill()
        // Eyes (sunken sockets)
        c.fillStyle = 'rgba(20, 10, 30, 0.8)'
        c.beginPath()
        c.ellipse(-s * 0.07, -s * 0.06, s * 0.04, s * 0.03, 0, 0, Math.PI * 2)
        c.fill()
        c.beginPath()
        c.ellipse(s * 0.07, -s * 0.06, s * 0.04, s * 0.03, 0, 0, Math.PI * 2)
        c.fill()
        // Mouth
        c.strokeStyle = 'rgba(20, 10, 30, 0.6)'
        c.lineWidth = 1
        c.beginPath()
        c.arc(0, s * 0.1, s * 0.08, 0.2, Math.PI - 0.2)
        c.stroke()
        break
      }

      case 'skull': {
        // A skull on the ground
        c.fillStyle = 'rgba(180, 170, 150, 0.6)'
        // Cranium
        c.beginPath()
        c.ellipse(0, -s * 0.05, s * 0.18, s * 0.22, 0, 0, Math.PI * 2)
        c.fill()
        // Jaw
        c.beginPath()
        c.ellipse(0, s * 0.15, s * 0.12, s * 0.08, 0, 0, Math.PI)
        c.fill()
        // Eye sockets
        c.fillStyle = 'rgba(10, 5, 20, 0.9)'
        c.beginPath()
        c.ellipse(-s * 0.06, -s * 0.05, s * 0.045, s * 0.04, 0, 0, Math.PI * 2)
        c.fill()
        c.beginPath()
        c.ellipse(s * 0.06, -s * 0.05, s * 0.045, s * 0.04, 0, 0, Math.PI * 2)
        c.fill()
        // Nose
        c.beginPath()
        c.moveTo(-s * 0.02, s * 0.03)
        c.lineTo(0, s * 0.07)
        c.lineTo(s * 0.02, s * 0.03)
        c.closePath()
        c.fill()
        break
      }

      case 'floating_orb': {
        // A translucent glowing orb suspended in the air
        const orbPulse = 0.7 + Math.sin(t * 2 + hash * 8) * 0.3
        const orbGrad = c.createRadialGradient(s * 0.02, -s * 0.02, 0, 0, 0, s * 0.2)
        orbGrad.addColorStop(0, `rgba(200, 180, 255, ${0.6 * orbPulse})`)
        orbGrad.addColorStop(0.4, `rgba(140, 100, 220, ${0.3 * orbPulse})`)
        orbGrad.addColorStop(1, 'rgba(100, 60, 180, 0)')
        c.fillStyle = orbGrad
        c.beginPath()
        c.arc(0, 0, s * 0.2, 0, Math.PI * 2)
        c.fill()
        // Inner spark
        c.fillStyle = `rgba(255, 240, 255, ${0.3 + Math.sin(t * 5) * 0.2})`
        c.beginPath()
        c.arc(s * 0.03, -s * 0.03, s * 0.04, 0, Math.PI * 2)
        c.fill()
        break
      }

      case 'chain': {
        // Chains hanging from the ceiling
        const links = 4 + Math.floor(hash * 3)
        c.strokeStyle = 'rgba(120, 110, 100, 0.7)'
        c.lineWidth = 2
        for (let i = 0; i < links; i++) {
          const ly = -s * 0.4 + i * s * 0.15
          const swing = Math.sin(t * 0.8 + i * 0.5) * s * 0.02
          c.beginPath()
          c.ellipse(swing, ly, s * 0.04, s * 0.06, 0, 0, Math.PI * 2)
          c.stroke()
        }
        break
      }

      case 'rune': {
        // A glowing mystical rune
        const runePulse = 0.6 + Math.sin(t * 2.5 + hash * 12) * 0.4
        // Glow
        const runeGlow = c.createRadialGradient(0, 0, 0, 0, 0, s * 0.3)
        runeGlow.addColorStop(0, `rgba(180, 140, 255, ${0.2 * runePulse})`)
        runeGlow.addColorStop(1, 'rgba(140, 100, 220, 0)')
        c.fillStyle = runeGlow
        c.fillRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.6)
        // Rune lines
        c.strokeStyle = `rgba(200, 170, 255, ${0.7 * runePulse})`
        c.lineWidth = 1.5
        // Geometric pattern
        c.beginPath()
        c.moveTo(0, -s * 0.2)
        c.lineTo(-s * 0.15, s * 0.1)
        c.lineTo(s * 0.15, s * 0.1)
        c.closePath()
        c.stroke()
        c.beginPath()
        c.moveTo(0, s * 0.2)
        c.lineTo(-s * 0.15, -s * 0.1)
        c.lineTo(s * 0.15, -s * 0.1)
        c.closePath()
        c.stroke()
        // Center dot
        c.fillStyle = `rgba(255, 230, 255, ${0.8 * runePulse})`
        c.beginPath()
        c.arc(0, 0, s * 0.025, 0, Math.PI * 2)
        c.fill()
        break
      }

      case 'carved_symbol': {
        // A mysterious carved geometric symbol
        c.strokeStyle = `rgba(160, 140, 200, ${0.5 + Math.sin(t * 1.8) * 0.2})`
        c.lineWidth = 1.5
        // Outer circle
        c.beginPath()
        c.arc(0, 0, s * 0.18, 0, Math.PI * 2)
        c.stroke()
        // Cross inside
        c.beginPath()
        c.moveTo(0, -s * 0.14); c.lineTo(0, s * 0.14)
        c.moveTo(-s * 0.14, 0); c.lineTo(s * 0.14, 0)
        c.stroke()
        // Inner circle
        c.beginPath()
        c.arc(0, 0, s * 0.06, 0, Math.PI * 2)
        c.stroke()
        break
      }

      default: {
        // Fallback: generic glowing shape
        const fbGrad = c.createRadialGradient(0, 0, 0, 0, 0, s * 0.15)
        fbGrad.addColorStop(0, 'rgba(180, 150, 220, 0.5)')
        fbGrad.addColorStop(1, 'rgba(120, 90, 180, 0)')
        c.fillStyle = fbGrad
        c.beginPath()
        c.arc(0, 0, s * 0.15, 0, Math.PI * 2)
        c.fill()
      }
    }

    // Reset shadow for safety
    c.shadowBlur = 0
    c.shadowColor = 'transparent'
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
      // Anomaly walls pulse with a noticeable purple glow
      const shimmer = 0.3 + Math.sin(time * 1.8) * 0.25
      const pulse = 0.9 + Math.sin(time * 2.5) * 0.1
      return [
        (50 + tensionR + insanityR + shimmer * 20) * brightness * sideDim * pulse,
        (30 + tensionG + insanityG + shimmer * 8) * brightness * sideDim * pulse,
        (90 + insanityB + shimmer * 30) * brightness * sideDim * pulse,
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

    // Iterate view area instead of all explored cells — O(viewRadius²) vs O(n)
    for (let ddx = -viewRadius; ddx <= viewRadius; ddx++) {
      for (let ddy = -viewRadius; ddy <= viewRadius; ddy++) {
        const cwx = centerWX + ddx
        const cwy = centerWY + ddy
        if (!exploredCells.has(numKey(cwx, cwy))) continue

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

  function renderGhosts(w: number, h: number, fov: number, midLine: number): void {
    if (!ctx || ghosts.length === 0) return
    if (!ghostSpriteCanvas) ghostSpriteCanvas = createGhostSprite()

    const c = ctx

    // Sort ghosts far to near for correct overlap
    const sorted = [...ghosts].sort((a, b) => {
      const da = (a.x - px) * (a.x - px) + (a.y - py) * (a.y - py)
      const db = (b.x - px) * (b.x - px) + (b.y - py) * (b.y - py)
      return db - da
    })

    for (const ghost of sorted) {
      const dx = ghost.x - px
      const dy = ghost.y - py
      const dist = Math.hypot(dx, dy)

      if (dist > GHOST_APPEAR_DIST || dist < GHOST_GONE_DIST) continue

      // Angle from player to ghost
      const angleToGhost = Math.atan2(dy, dx)
      // Relative angle within player's FOV
      let relAngle = angleToGhost - pa
      while (relAngle > Math.PI) relAngle -= Math.PI * 2
      while (relAngle < -Math.PI) relAngle += Math.PI * 2

      // Skip if outside FOV (with margin)
      if (Math.abs(relAngle) > fov * 0.6) continue

      // Wall occlusion — cast ray toward ghost, skip if wall is closer
      const wallHit = castRay(px, py, angleToGhost)
      if (wallHit.dist < dist * 0.95) continue // wall blocks line of sight

      // Project to screen X
      const screenX = w / 2 + (relAngle / fov) * w

      // Perspective-corrected distance (fish-eye fix)
      const perpDist = dist * Math.cos(relAngle)
      if (perpDist < 0.3) continue

      // Sprite dimensions — ghost stands on the floor
      const unitH = h / perpDist  // 1 world-unit in screen pixels at this distance
      const spriteH = unitH * ghost.height
      const spriteW = spriteH * 0.5
      // Anchor feet to floor: floor is at midLine + unitH/2
      const floorY = midLine + unitH / 2
      const spriteTop = floorY - spriteH

      // Dissolution based on distance — closer = more transparent
      let opacity: number
      if (dist > GHOST_DISSOLVE_DIST) {
        // Visible range: fade in from appear dist, full brightness in middle
        opacity = Math.min(0.8, (GHOST_APPEAR_DIST - dist) / 2)
      } else {
        // Dissolving as player approaches
        const t = (dist - GHOST_GONE_DIST) / (GHOST_DISSOLVE_DIST - GHOST_GONE_DIST)
        opacity = t * 0.8
      }

      // Fade in on spawn (first 2 seconds)
      const age = time - ghost.spawnTime
      if (age < 2) opacity *= age / 2

      // Slight sway animation
      const sway = Math.sin(time * 0.6 + ghost.sway) * 3 * (1 / Math.max(1, perpDist))

      // Mild distance fog — don't make them too dim
      const fogFade = Math.max(0.5, 1 - dist / (GHOST_APPEAR_DIST * 1.5))

      if (opacity < 0.01) continue

      c.save()
      c.globalAlpha = opacity * fogFade

      // Dissolution distortion — break apart into strips as player approaches
      if (dist < GHOST_DISSOLVE_DIST) {
        const dissolveT = 1 - (dist - GHOST_GONE_DIST) / (GHOST_DISSOLVE_DIST - GHOST_GONE_DIST)
        const stripCount = 8
        const sW = spriteW / stripCount
        const srcStripW = 64 / stripCount

        for (let s = 0; s < stripCount; s++) {
          const stripSeed = Math.sin(s * 7.3 + ghost.sway * 3.1)
          const driftX = stripSeed * dissolveT * 25
          const driftY = Math.cos(s * 4.7 + ghost.sway) * dissolveT * 20 - dissolveT * 10
          const stripAlpha = Math.max(0, 1 - dissolveT * (0.5 + Math.abs(stripSeed) * 0.8))

          if (stripAlpha < 0.01) continue

          c.globalAlpha = opacity * fogFade * stripAlpha
          c.drawImage(
            ghostSpriteCanvas!,
            s * srcStripW, 0, srcStripW, 128,
            screenX - spriteW / 2 + s * sW + sway + driftX,
            spriteTop + driftY,
            sW + 1,
            spriteH,
          )
        }
      } else {
        c.drawImage(
          ghostSpriteCanvas!,
          0, 0, 64, 128,
          screenX - spriteW / 2 + sway,
          spriteTop,
          spriteW,
          spriteH,
        )
      }

      c.restore()
    }
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

    // Frame-rate independent timing — prevents slowdown when frames drop
    const now = performance.now()
    const frameDt = lastFrameMs > 0 ? Math.min(50, now - lastFrameMs) : 16
    lastFrameMs = now
    dtScale = frameDt / 16 // 1.0 at 60fps, 2.0 at 30fps
    time += 0.016 * dtScale

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
    const visibleInscriptions: { text: string; isMemory: boolean; screenX: number; dist: number; brightness: number; wallTop: number; wallHeight: number; wx: number; wy: number }[] = []
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
      const brightBoost = time < brightBoostEnd ? 0.25 : 0
      const brightness = Math.min(1, Math.max(0, 1 - correctedDist / 10) + brightBoost)
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


      // Collect inscriptions
      if (hit.cell === INSCRIPTION && correctedDist < 7) {
        const insc = getInscriptionText(hit.hitX, hit.hitY)
        visibleInscriptions.push({
          text: insc.text,
          isMemory: insc.isMemory,
          screenX: i * stripW + stripW / 2,
          dist: correctedDist,
          brightness,
          wallTop,
          wallHeight,
          wx: hit.hitX,
          wy: hit.hitY,
        })
      }

      // Collect wall objects on anomaly walls (skip used ones)
      if (hit.cell === ANOMALY && correctedDist < 7) {
        const objKey = numKey(hit.hitX, hit.hitY)
        if (!usedAnomalies.has(objKey)) {
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
    }

    // Render wall inscriptions — simple font text on walls
    const shownTexts = new Set<number>()
    for (const insc of visibleInscriptions) {
      const inscKey = numKey(insc.wx, insc.wy)
      if (shownTexts.has(inscKey)) continue
      shownTexts.add(inscKey)

      const yHash = cellHash2(insc.wx + 17, insc.wy + 31)
      const wallY = insc.wallTop + insc.wallHeight * (0.3 + yHash * 0.4)
      const fontSize = Math.max(10, Math.min(16, 22 / insc.dist))
      const alpha = Math.min(0.7, insc.brightness * 0.9) * (0.7 + Math.sin(time * 0.3 + insc.wx * 0.7) * 0.1)
      const color = insc.isMemory
        ? `rgba(220, 185, 100, ${alpha})`
        : `rgba(170, 160, 190, ${alpha * 0.8})`

      ctx.save()
      ctx.font = `italic ${fontSize}px "Cormorant Garamond", serif`
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.fillText(insc.text.substring(0, 30), insc.screenX, wallY)
      ctx.restore()
    }

    // Render wall objects — procedurally drawn 2D graphics
    const shownObjects = new Set<number>()
    for (const vo of visibleObjects) {
      const key = numKey(vo.wx, vo.wy)
      if (shownObjects.has(key)) continue
      shownObjects.add(key)

      const yPos = getObjectYPos(vo.wx, vo.wy)
      let objY = vo.wallTop + vo.wallHeight * yPos
      const baseScale = Math.max(0.5, 1.2 - vo.dist / 7) * (vo.obj.scale || 1.0)
      const alpha = Math.min(0.9, vo.brightness * (0.6 + Math.sin(time * 2.5 + vo.wx * 3.7) * 0.25))

      // Apply physics
      let physScale = baseScale
      let rotation = 0
      const phys = vo.obj.physics || 'static'
      if (phys === 'bob') {
        objY += Math.sin(time * 1.5 + vo.wx * 2.3) * 6 * baseScale
      } else if (phys === 'spin') {
        rotation = time * 1.2 + vo.wy * 4.1
      } else if (phys === 'breathe') {
        physScale = baseScale * (0.9 + Math.sin(time * 2 + vo.wx * 3) * 0.15)
      }

      // Drip particles
      if (phys === 'drip' && Math.random() < 0.3) {
        for (let d = 0; d < 3; d++) {
          const dripY = objY + Math.random() * 20 * physScale
          ctx.beginPath()
          ctx.arc(vo.screenX + (Math.random() - 0.5) * 6, dripY, 1.5 * physScale, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(140, 40, 60, ${alpha * 0.4})`
          ctx.fill()
        }
      }

      const objSize = physScale * 28  // bigger objects for visibility

      ctx.save()
      ctx.translate(vo.screenX, objY)
      if (rotation) ctx.rotate(rotation)

      // Shadow layer — gives depth/3D feel
      ctx.globalAlpha = alpha * 0.25
      ctx.save()
      ctx.translate(3 * physScale, 4 * physScale)
      ctx.scale(1.03, 1.03)
      drawRenderedObject(ctx, vo.obj.name, objSize, time, vo.wx, vo.wy)
      ctx.restore()

      // Main object layer
      ctx.globalAlpha = alpha
      drawRenderedObject(ctx, vo.obj.name, objSize, time, vo.wx, vo.wy)
      ctx.globalAlpha = 1
      ctx.restore()

      // No description text — objects speak for themselves
    }

    // Ghost figures — rendered before fog so they're part of the scene
    renderGhosts(w, h, fov, midLine)

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
      time = 0
      // New random seed each visit — every labyrinth is different
      sessionSeed = Math.floor(Math.random() * 2147483647)
      px = 1.5
      py = 1.5
      pa = Math.random() * Math.PI * 2 // random starting direction
      keys.clear()
      regionSalts.clear()
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
      wallOverrides.clear()
      lastWallOpenTime = 0
      nearbyPortal = null
      inscriptionText = ''
      inscriptionAlpha = 0

      // Reset caches for fresh session
      cachedAllTexts = null
      currentFragment = null
      lastFetchTime = time
      fetchIntervalSec = 8 + Math.random() * 10

      // Reset used anomalies, ghosts, and ambient sounds for fresh session
      usedAnomalies.clear()
      ghosts.length = 0
      lastGhostSpawnTime = 0
      lastCreepySoundTime = time + 20 // first ambient sound after 20s

      initAudio()
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
      audioInitialized = false
      overlay?.remove()
    },
  }
}
