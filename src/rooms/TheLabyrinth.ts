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
  let currentScare: { triggeredAt: number; image: HTMLImageElement | null; duration: number } | null = null
  let lastScareTime = -999

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
    if (h2 < 0.10) return INSCRIPTION

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
    // Load images
    for (let i = 1; i <= 5; i++) {
      const img = new Image()
      img.src = `/assets/labyrinth/labyrinth-scare-${i}.jpg`
      img.onload = () => scareImages.push(img)
    }

    // Load sounds
    if (!audioCtx) return
    for (let i = 1; i <= 4; i++) {
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

  function playScareSound() {
    if (!audioCtx) return
    const dest = getAudioDestination()
    const now = audioCtx.currentTime

    // Play pre-generated sound if available
    if (scareBuffers.length > 0) {
      const buf = scareBuffers[Math.floor(Math.random() * scareBuffers.length)]
      const source = audioCtx.createBufferSource()
      source.buffer = buf
      const gain = audioCtx.createGain()
      gain.gain.value = 0.4
      source.connect(gain)
      gain.connect(dest)
      if (reverbNode) gain.connect(reverbNode)
      source.start()
    }

    // Always add a synthesized sub-bass thump
    const thump = audioCtx.createOscillator()
    thump.frequency.value = 30
    thump.type = 'sine'
    const thumpGain = audioCtx.createGain()
    thumpGain.gain.setValueAtTime(0.25, now)
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
    thump.connect(thumpGain)
    thumpGain.connect(dest)
    thump.start(now)
    thump.stop(now + 0.5)

    // High screech
    const screech = audioCtx.createOscillator()
    screech.frequency.value = 1800 + Math.random() * 600
    screech.type = 'sawtooth'
    const screechGain = audioCtx.createGain()
    screechGain.gain.setValueAtTime(0.06, now)
    screechGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
    const screechFilter = audioCtx.createBiquadFilter()
    screechFilter.type = 'bandpass'
    screechFilter.frequency.value = 2000
    screechFilter.Q.value = 5
    screech.connect(screechFilter)
    screechFilter.connect(screechGain)
    screechGain.connect(dest)
    if (reverbNode) screechGain.connect(reverbNode)
    screech.start(now)
    screech.stop(now + 0.4)
  }

  function triggerScare() {
    const img = scareImages.length > 0
      ? scareImages[Math.floor(Math.random() * scareImages.length)]
      : null
    currentScare = {
      triggeredAt: time,
      image: img,
      duration: 1.2,
    }
    lastScareTime = time
    tension = 0
    tensionTarget = 0
    playScareSound()
  }

  function checkScare(): void {
    if (currentScare) return
    if (time - lastScareTime < 90) return // 90 second cooldown

    const exits = countExits(Math.floor(px), Math.floor(py))

    // Build tension
    if (exits <= 1) {
      tensionTarget = Math.min(1, tensionTarget + 0.0015)
    } else {
      tensionTarget = Math.max(0, tensionTarget - 0.002)
    }

    // Random tension spikes
    if (Math.random() < 0.0003) {
      tensionTarget = Math.min(1, tensionTarget + 0.25)
    }

    tension += (tensionTarget - tension) * 0.015

    // Trigger when tension is high enough
    if (tension > 0.7 && Math.random() < 0.008) {
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

  // ===== UPDATE =====

  function update() {
    let moveX = 0
    let moveY = 0
    let moving = false

    // Keyboard only — no mouse
    if (keys.has('w') || keys.has('arrowup')) {
      moveX += Math.cos(pa) * moveSpeed
      moveY += Math.sin(pa) * moveSpeed
      moving = true
    }
    if (keys.has('s') || keys.has('arrowdown')) {
      moveX -= Math.cos(pa) * moveSpeed
      moveY -= Math.sin(pa) * moveSpeed
      moving = true
    }
    if (keys.has('a') || keys.has('arrowleft')) {
      pa -= turnSpeed
    }
    if (keys.has('d') || keys.has('arrowright')) {
      pa += turnSpeed
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

    // Update tension/scare
    checkScare()

    // Update ambient drone pitch with tension
    if (ambOsc && audioCtx) {
      ambOsc.frequency.value = 42 - tension * 10
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

    if (cell === INSCRIPTION) {
      return [
        (50 + tensionR) * brightness * sideDim,
        (38 + tensionG) * brightness * sideDim,
        65 * brightness * sideDim,
      ]
    }
    return [
      (40 + tensionR) * brightness * sideDim,
      (30 + tensionG) * brightness * sideDim,
      60 * brightness * sideDim,
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

    let alpha = 1
    if (elapsed > 0.15) {
      alpha = Math.max(0, 1 - (elapsed - 0.15) / (currentScare.duration - 0.15))
    }

    // Screen shake
    const shakeX = (Math.random() - 0.5) * 20 * alpha
    const shakeY = (Math.random() - 0.5) * 20 * alpha

    ctx.save()
    ctx.translate(shakeX, shakeY)

    // Red flash
    ctx.fillStyle = `rgba(80, 0, 0, ${alpha * 0.35})`
    ctx.fillRect(0, 0, w, h)

    // Image
    if (currentScare.image) {
      ctx.globalAlpha = alpha * 0.8
      const imgW = w * 0.5
      const imgH = h * 0.5
      const imgX = (w - imgW) / 2 + (Math.random() - 0.5) * 10
      const imgY = (h - imgH) / 2 + (Math.random() - 0.5) * 10
      ctx.drawImage(currentScare.image, imgX, imgY, imgW, imgH)
      ctx.globalAlpha = 1
    }

    // Scanlines
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.15})`
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 2)
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
    const fov = Math.PI / 3

    // Clear
    ctx.fillStyle = 'rgba(3, 2, 6, 1)'
    ctx.fillRect(0, 0, w, h)

    // Ceiling with tension-affected breathing
    const breathe = Math.sin(time * 0.2) * 2
    const tensionFlicker = tension > 0.3 ? Math.random() * tension * 3 : 0
    const ceilGrad = ctx.createLinearGradient(0, 0, 0, h / 2)
    ceilGrad.addColorStop(0, `rgba(${5 + breathe + tensionFlicker}, 3, ${10 + breathe}, 1)`)
    ceilGrad.addColorStop(1, `rgba(${10 + breathe + tensionFlicker}, 8, ${18 + breathe}, 1)`)
    ctx.fillStyle = ceilGrad
    ctx.fillRect(0, 0, w, h / 2)

    // Floor
    const floorGrad = ctx.createLinearGradient(0, h / 2, 0, h)
    floorGrad.addColorStop(0, 'rgba(8, 6, 12, 1)')
    floorGrad.addColorStop(1, 'rgba(3, 2, 6, 1)')
    ctx.fillStyle = floorGrad
    ctx.fillRect(0, h / 2, w, h / 2)

    // Raycasting
    const stripW = w / numRays
    const visibleInscriptions: { text: string; screenX: number; dist: number; brightness: number }[] = []

    for (let i = 0; i < numRays; i++) {
      const rayAngle = pa - fov / 2 + (i / numRays) * fov
      const hit = castRay(px, py, rayAngle)

      const correctedDist = hit.dist * Math.cos(rayAngle - pa)
      const wallHeight = Math.min(h * 2, h / correctedDist)
      const wallTop = (h - wallHeight) / 2
      const brightness = Math.max(0, 1 - correctedDist / 10)
      const sideDim = hit.side ? 0.7 : 1.0

      // Tension flicker on distant walls
      const flicker = tension > 0.4 && correctedDist > 4
        ? 1 - Math.random() * tension * 0.15
        : 1

      const [r, g, b] = getCellColor(hit.cell, brightness * flicker, sideDim)
      ctx.fillStyle = `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`
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
      ctx.translate(insc.screenX, h / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText(insc.text.substring(0, 20), 0, 0)
      ctx.restore()
    }

    // Fog overlay
    const fogGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6)
    fogGrad.addColorStop(0, 'rgba(3, 2, 6, 0)')
    fogGrad.addColorStop(0.7, 'rgba(3, 2, 6, 0.1)')
    fogGrad.addColorStop(1, `rgba(${3 + tension * 15}, 2, 6, ${0.4 + tension * 0.15})`)
    ctx.fillStyle = fogGrad
    ctx.fillRect(0, 0, w, h)

    // Portal room glow
    if (nearbyPortal) {
      const [pr, pg, pb] = nearbyPortal.color
      const portalGlow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.4)
      portalGlow.addColorStop(0, `rgba(${pr}, ${pg}, ${pb}, ${0.03 + Math.sin(time * 1.5) * 0.01})`)
      portalGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = portalGlow
      ctx.fillRect(0, 0, w, h)
    }

    // Crosshair
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.04)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(w / 2 - 6, h / 2)
    ctx.lineTo(w / 2 + 6, h / 2)
    ctx.moveTo(w / 2, h / 2 - 6)
    ctx.lineTo(w / 2, h / 2 + 6)
    ctx.stroke()

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

    // Portal interaction prompt
    if (nearbyPortal) {
      const [pr, pg, pb] = nearbyPortal.color
      const alpha = 0.4 + Math.sin(time * 2) * 0.15
      ctx.font = '12px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(${pr}, ${pg}, ${pb}, ${alpha})`
      ctx.textAlign = 'center'
      ctx.fillText(`press E — a passage leads to ${nearbyPortal.label}`, w / 2, h - 40)
    }

    // Hint
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(140, 120, 160, 0.04)'
    ctx.textAlign = 'center'
    ctx.fillText('WASD to move · the labyrinth is infinite · it forgets behind you', w / 2, h - 8)

    // Jump scare overlay (on top of everything)
    renderJumpScare(w, h)
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
  }

  function handleKeyUp(e: KeyboardEvent) {
    keys.delete(e.key.toLowerCase())
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
      lastScareTime = -999
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
