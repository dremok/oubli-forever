/**
 * THE AUTOMATON — cellular life emerges from rules
 *
 * No memories. No text. Just Conway's Game of Life running on a grid.
 * Click to seed living cells. Watch patterns emerge, oscillate, and die.
 * The universe follows four simple rules and produces infinite complexity.
 *
 * The Oubli twist: cells have a "generation" counter that affects their
 * color. New cells are bright pink. Old cells fade to gold, then gray.
 * Cells that have died and been reborn glow violet — resurrection cells.
 *
 * The grid wraps at edges (toroidal topology). An age counter shows
 * how many generations have passed. Speed can be adjusted by scrolling.
 *
 * This room is purely mathematical — a meditation on emergence,
 * how simple rules create complexity, how life and death are the same
 * process viewed from different angles.
 *
 * Inspired by: Conway's Game of Life, cellular automata, emergence
 * theory, artificial life, Wolfram's Rule 110, the heat death of
 * the universe, how neurons are just cells following rules
 */

import type { Room } from './RoomManager'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface AutomatonDeps {
  switchTo?: (name: string) => void
}

const PATTERNS = {
  glider: [[0,1],[1,2],[2,0],[2,1],[2,2]],
  blinker: [[1,0],[1,1],[1,2]],
  block: [[0,0],[0,1],[1,0],[1,1]],
  beacon: [[0,0],[0,1],[1,0],[2,3],[3,2],[3,3]],
  pulsar: [
    [2,0],[3,0],[4,0],[8,0],[9,0],[10,0],
    [0,2],[5,2],[7,2],[12,2],
    [0,3],[5,3],[7,3],[12,3],
    [0,4],[5,4],[7,4],[12,4],
    [2,5],[3,5],[4,5],[8,5],[9,5],[10,5],
    [2,7],[3,7],[4,7],[8,7],[9,7],[10,7],
    [0,8],[5,8],[7,8],[12,8],
    [0,9],[5,9],[7,9],[12,9],
    [0,10],[5,10],[7,10],[12,10],
    [2,12],[3,12],[4,12],[8,12],[9,12],[10,12],
  ],
}

const CULTURAL_INSCRIPTIONS = [
  'conway died of covid in 2020. the game of life outlived its creator.',
  'rule 110 is turing-complete. simple rules contain infinite computation.',
  'physarum stores memories in tube thickness. wider tubes are remembered paths. thinner tubes are forgotten.',
  'gliders: the simplest self-propagating pattern. five cells that walk forever.',
  'reverse game of life: start with a creature, reverse-engineer the rules. damage it, and it heals itself.',
  'the doomsday clock: 85 seconds to midnight. a simple counter for complex annihilation.',
  'methuselah patterns: small seeds that take thousands of generations to stabilize.',
  'garden of eden: patterns with no predecessor. states that could not have evolved.',
  'flow-lenia: 400 species in 18 families. memories as soft creatures that compete for space.',
  'slime mold avoids its own slime trails — a physical record of where it has been. externalized memory.',
  'replicators emerge spontaneously from noise. no design needed. memories that create themselves.',
  'xenobots: living robots that reproduce by gathering loose cells. pac-man shaped mouths. AI designed the body.',
  'the right to be forgotten is dead. data absorbed into AI retains patterns even after deletion.',
  'JCVI-syn3.0: 473 genes. the smallest self-replicating genome. stripped to minimum, it evolved fitness back.',
  'mycelium remembers growth directions even after hyphae are removed. an exposed sentient membrane.',
  'at what point does a sufficiently complex automaton become aware? consciousness agnosticism.',
  'mordvintsev: neural cellular automata that grow virtual butterflies from pixels. regeneration was not programmed.',
]

// Rule sets for different cellular automata
interface RuleSet {
  name: string
  birth: Set<number>
  survive: Set<number>
  notation: string
  description: string
}

const RULE_SETS: RuleSet[] = [
  { name: 'conway', birth: new Set([3]), survive: new Set([2, 3]),
    notation: 'B3/S23', description: 'conway\'s game of life — the original' },
  { name: 'highlife', birth: new Set([3, 6]), survive: new Set([2, 3]),
    notation: 'B36/S23', description: 'highlife — self-replicating patterns emerge' },
  { name: 'day & night', birth: new Set([3, 6, 7, 8]), survive: new Set([3, 4, 6, 7, 8]),
    notation: 'B3678/S34678', description: 'day & night — alive and dead are symmetric' },
  { name: 'seeds', birth: new Set([2]), survive: new Set([]),
    notation: 'B2/S', description: 'seeds — nothing survives, only explodes' },
]

export function createAutomatonRoom(deps?: AutomatonDeps): Room {
  let inscriptionTimer = 0
  let inscriptionIdx = 0
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let generation = 0
  let speed = 8 // frames between updates (lower = faster)
  let frameCount = 0
  let paused = false
  let hoveredPortal = -1

  // Rule mutation
  let currentRuleIdx = 0
  let ruleTransitionAlpha = 0 // for rule change flash

  // Population history graph
  const popHistory: number[] = []
  const POP_HISTORY_MAX = 200

  // --- Physarum-inspired memory trails ---
  // Heat map of cumulative cell activity — fades slowly, rendered as background glow
  let heatMap: Float32Array = new Float32Array(0)
  let heatMapCols = 0
  let heatMapRows = 0
  const HEAT_DECAY = 0.997 // slow decay per frame
  const HEAT_ACCUMULATE = 0.15 // heat added per living cell per step

  // --- Extinction event detection ---
  let prevPopulation = 0
  let extinctionFlash = 0 // 1→0, red flash on mass die-off
  let extinctionCount = 0
  let extinctionLabel = ''

  // --- Pattern age tracking ---
  let oldestCellAge = 0 // tracks the longest-surviving cell

  // --- Fossil layer: cells that died many times leave permanent traces ---
  // (uses deathCount grid — cells with high death counts get rendered as dim fossils)

  // --- Cosmic ray mutations: occasional random cell flips ---
  let cosmicRayTimer = 0
  let cosmicRayFlash: { x: number; y: number; alpha: number } | null = null

  // --- Extinction memorial markers on the population graph ---
  interface ExtinctionMarker {
    generation: number
    severity: number // 0-1, how much was lost
    graphX: number   // computed during render
  }
  const extinctionMarkers: ExtinctionMarker[] = []

  // --- Stagnation detection ---
  let stagnationCounter = 0
  let stagnationShimmer = 0 // 0-1, golden shimmer when population stabilizes
  let lastStagnationPop = 0

  // --- Birth cluster glow ---
  interface BirthClusterRing {
    x: number; y: number; radius: number; alpha: number
  }
  const birthClusterRings: BirthClusterRing[] = []

  // --- Audio state ---
  let audioReady = false
  let ac: AudioContext | null = null
  let droneOsc: OscillatorNode | null = null
  let droneGain: GainNode | null = null
  let portalOscs: (OscillatorNode | null)[] = [null, null, null]
  let portalGains: (GainNode | null)[] = [null, null, null]
  let portalWasActive: boolean[] = [false, false, false]
  let lastLiveCells = 0
  let birthsThisStep = 0
  let deathsThisStep = 0
  // Grid pulse brightness offset (0-0.02)
  let gridPulseBrightness = 0

  // --- Death particles ---
  interface DeathParticle {
    x: number
    y: number
    vx: number
    vy: number
    alpha: number
    size: number
  }
  const deathParticles: DeathParticle[] = []

  // --- Newborn glow tracking ---
  // Cells born in the last few steps get a radial glow
  // We track them as [row, col, birthGen]
  const newbornCells: [number, number, number][] = []

  interface PortalZone {
    room: string
    label: string
    edgeRow: number  // grid row near edge (set in initGrid)
    edgeCol: number  // grid col near edge (set in initGrid)
    cells: [number, number][]  // the oscillator cells (row, col)
    active: boolean
    stableTime: number  // frames since pattern became stable
    glowColor: string
    lastSnapshot: string  // serialized cell states to detect stability
    snapshotAge: number   // how many generations the snapshot has been stable
  }

  const portalZones: PortalZone[] = [
    { room: 'terrarium', label: 'terrarium', edgeRow: 0, edgeCol: 0,
      cells: [], active: false, stableTime: 0,
      glowColor: 'rgba(80, 220, 120, ', lastSnapshot: '', snapshotAge: 0 },
    { room: 'seismograph', label: 'seismograph', edgeRow: 0, edgeCol: 0,
      cells: [], active: false, stableTime: 0,
      glowColor: 'rgba(60, 200, 180, ', lastSnapshot: '', snapshotAge: 0 },
    { room: 'pendulum', label: 'pendulum', edgeRow: 0, edgeCol: 0,
      cells: [], active: false, stableTime: 0,
      glowColor: 'rgba(160, 100, 240, ', lastSnapshot: '', snapshotAge: 0 },
  ]

  let cols = 0
  let rows = 0
  const cellSize = 6
  let grid: number[][] = []  // 0 = dead, >0 = age (generation when born)
  let deathCount: number[][] = [] // how many times this cell has died

  function initGrid() {
    cols = Math.ceil(window.innerWidth / cellSize)
    rows = Math.ceil(window.innerHeight / cellSize)
    grid = Array.from({ length: rows }, () => Array(cols).fill(0))
    deathCount = Array.from({ length: rows }, () => Array(cols).fill(0))
    generation = 0
    prevPopulation = 0
    oldestCellAge = 0

    // Initialize heat map
    heatMapCols = cols
    heatMapRows = rows
    heatMap = new Float32Array(rows * cols)

    // Position portal zones near edges
    // terrarium — top-left
    portalZones[0].edgeRow = 4
    portalZones[0].edgeCol = 6
    // seismograph — top-right
    portalZones[1].edgeRow = 4
    portalZones[1].edgeCol = cols - 10
    // pendulum — bottom-left
    portalZones[2].edgeRow = rows - 8
    portalZones[2].edgeCol = 6

    // Reset portal state
    for (const pz of portalZones) {
      pz.active = false
      pz.stableTime = 0
      pz.cells = []
      pz.lastSnapshot = ''
      pz.snapshotAge = 0
    }

    // Seed with a few random patterns
    seedRandom(0.08)

    // Seed initial portal organisms
    seedAllPortals()
  }

  /** Place a small oscillator pattern in the portal zone */
  function seedPortal(pz: PortalZone) {
    const r = pz.edgeRow
    const c = pz.edgeCol
    // Clear a small area around the portal first
    for (let dr = -2; dr <= 4; dr++) {
      for (let dc = -2; dc <= 5; dc++) {
        const nr = (r + dr + rows) % rows
        const nc = (c + dc + cols) % cols
        grid[nr][nc] = 0
      }
    }
    // Alternate between beacon and blinker
    if (Math.random() < 0.5) {
      // Beacon (period 2): two 2x2 blocks offset diagonally
      const beaconCells: [number, number][] = [
        [r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1],
        [r + 2, c + 2], [r + 2, c + 3], [r + 3, c + 2], [r + 3, c + 3],
      ]
      pz.cells = beaconCells.map(([br, bc]) => [(br + rows) % rows, (bc + cols) % cols] as [number, number])
    } else {
      // Blinker (period 2): three cells in a line
      const blinkerCells: [number, number][] = [
        [r, c + 1], [r + 1, c + 1], [r + 2, c + 1],
      ]
      pz.cells = blinkerCells.map(([br, bc]) => [(br + rows) % rows, (bc + cols) % cols] as [number, number])
    }
    // Place the cells on the grid
    for (const [pr, pc] of pz.cells) {
      grid[pr][pc] = generation + 1
    }
    pz.active = false
    pz.stableTime = 0
    pz.lastSnapshot = ''
    pz.snapshotAge = 0
  }

  function seedAllPortals() {
    for (const pz of portalZones) {
      seedPortal(pz)
    }
  }

  /** Snapshot the cell states in a portal zone's neighborhood to detect oscillator stability */
  function getPortalSnapshot(pz: PortalZone): string {
    const r = pz.edgeRow
    const c = pz.edgeCol
    let s = ''
    for (let dr = -2; dr <= 5; dr++) {
      for (let dc = -2; dc <= 6; dc++) {
        const nr = (r + dr + rows) % rows
        const nc = (c + dc + cols) % cols
        s += grid[nr][nc] > 0 ? '1' : '0'
      }
    }
    return s
  }

  /** Check portal zone stability and re-seed if destroyed */
  function updatePortals() {
    for (const pz of portalZones) {
      const snap = getPortalSnapshot(pz)

      // Check if any cells are alive in the zone area
      let aliveCount = 0
      const r = pz.edgeRow
      const c = pz.edgeCol
      for (let dr = -1; dr <= 4; dr++) {
        for (let dc = -1; dc <= 5; dc++) {
          const nr = (r + dr + rows) % rows
          const nc = (c + dc + cols) % cols
          if (grid[nr][nc] > 0) aliveCount++
        }
      }

      // If pattern was destroyed, re-seed
      if (aliveCount === 0) {
        seedPortal(pz)
        continue
      }

      // Detect oscillator: snapshot matches one from 2 or 3 generations ago
      // We store snapshots and check period-2 by comparing current to 2-ago
      if (snap === pz.lastSnapshot) {
        // Same as last check (period-2 match: we check every 2 steps)
        pz.snapshotAge++
        if (pz.snapshotAge > 5 && !pz.active) {
          pz.active = true
          pz.stableTime = 0
          // Update cells to current alive cells in the zone
          pz.cells = []
          for (let dr = -1; dr <= 4; dr++) {
            for (let dc = -1; dc <= 5; dc++) {
              const nr = (r + dr + rows) % rows
              const nc = (c + dc + cols) % cols
              if (grid[nr][nc] > 0) {
                pz.cells.push([nr, nc])
              }
            }
          }
        }
      } else {
        pz.snapshotAge = 0
        pz.active = false
        pz.stableTime = 0
      }

      pz.lastSnapshot = snap

      if (pz.active) {
        pz.stableTime++
      }
    }
  }

  /** Protect portal organisms: re-seed if they have been overrun or destroyed */
  function protectPortals() {
    for (const pz of portalZones) {
      const r = pz.edgeRow
      const c = pz.edgeCol
      let aliveCount = 0
      for (let dr = -1; dr <= 4; dr++) {
        for (let dc = -1; dc <= 5; dc++) {
          const nr = (r + dr + rows) % rows
          const nc = (c + dc + cols) % cols
          if (grid[nr][nc] > 0) aliveCount++
        }
      }
      // If too many cells (overrun) or too few (destroyed), re-seed
      if (aliveCount > 20 || aliveCount === 0) {
        seedPortal(pz)
      }
    }
  }

  function seedRandom(density: number) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < density) {
          grid[r][c] = generation + 1
        }
      }
    }
  }

  function placePattern(name: keyof typeof PATTERNS, startRow: number, startCol: number) {
    const pattern = PATTERNS[name]
    for (const [dr, dc] of pattern) {
      const r = (startRow + dr) % rows
      const c = (startCol + dc) % cols
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        grid[r][c] = generation + 1
      }
    }
  }

  function countNeighbors(r: number, c: number): number {
    let count = 0
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        const nr = (r + dr + rows) % rows
        const nc = (c + dc + cols) % cols
        if (grid[nr][nc] > 0) count++
      }
    }
    return count
  }

  function step() {
    const next: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0))

    birthsThisStep = 0
    deathsThisStep = 0

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const neighbors = countNeighbors(r, c)
        const alive = grid[r][c] > 0

        const rules = RULE_SETS[currentRuleIdx]
        if (alive) {
          if (rules.survive.has(neighbors)) {
            next[r][c] = grid[r][c] // survive, keep birth generation
          } else {
            next[r][c] = 0 // die
            deathCount[r][c]++
            deathsThisStep++

            // Spawn death particle (10% chance)
            if (Math.random() < 0.1) {
              deathParticles.push({
                x: c * cellSize + cellSize / 2,
                y: r * cellSize + cellSize / 2,
                vx: (Math.random() - 0.5) * 0.3,
                vy: -(Math.random() * 0.5 + 0.2),
                alpha: 0.4 + Math.random() * 0.2,
                size: 1 + Math.random() * 1.5,
              })
            }
          }
        } else {
          if (rules.birth.has(neighbors)) {
            next[r][c] = generation + 1 // born
            birthsThisStep++
            // Track newborn for glow effect
            newbornCells.push([r, c, generation + 1])
          }
        }
      }
    }

    grid = next
    generation++

    // Prune old newborn entries (keep only cells born within last 3 generations)
    while (newbornCells.length > 0 && generation - newbornCells[0][2] > 3) {
      newbornCells.shift()
    }

    // --- Audio: life pulse, birth/death crackle ---
    if (audioReady && ac) {
      playLifePulse()
      playBirthDeathCrackle()
      updateDroneFrequency()
      updatePortalAudio()
    }

    // Track population for graph
    let liveCells = 0
    oldestCellAge = 0
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] > 0) {
          liveCells++
          const age = generation - grid[r][c]
          if (age > oldestCellAge) oldestCellAge = age
          // Accumulate heat map (Physarum memory trail)
          if (r < heatMapRows && c < heatMapCols) {
            heatMap[r * heatMapCols + c] = Math.min(1, heatMap[r * heatMapCols + c] + HEAT_ACCUMULATE)
          }
        }
      }
    }
    lastLiveCells = liveCells
    popHistory.push(liveCells)
    if (popHistory.length > POP_HISTORY_MAX) popHistory.shift()

    // Stagnation detection: population stable ±5% for 30+ generations
    if (lastStagnationPop > 0 && liveCells > 0) {
      const ratio = liveCells / lastStagnationPop
      if (ratio > 0.95 && ratio < 1.05) {
        stagnationCounter++
        if (stagnationCounter > 30) {
          stagnationShimmer = Math.min(1, stagnationShimmer + 0.02)
        }
      } else {
        stagnationCounter = 0
        stagnationShimmer = Math.max(0, stagnationShimmer - 0.05)
      }
    }
    lastStagnationPop = liveCells

    // Birth cluster glow: when 5+ births in one step, show expanding ring
    if (birthsThisStep >= 5) {
      let sumX = 0, sumY = 0, count = 0
      for (let r2 = 0; r2 < rows; r2++) {
        for (let c2 = 0; c2 < cols; c2++) {
          if (grid[r2][c2] === generation) {
            sumX += c2 * cellSize + cellSize / 2
            sumY += r2 * cellSize + cellSize / 2
            count++
          }
        }
      }
      if (count > 0) {
        birthClusterRings.push({
          x: sumX / count, y: sumY / count,
          radius: 5, alpha: 0.25,
        })
      }
    }

    // Extinction event detection: >40% population drop in one generation
    if (prevPopulation > 50 && liveCells < prevPopulation * 0.6) {
      extinctionFlash = 1
      extinctionCount++
      const lostPct = Math.round((1 - liveCells / prevPopulation) * 100)
      extinctionLabel = `extinction event #${extinctionCount}: ${lostPct}% lost`
    }
    prevPopulation = liveCells

    // Extinction marker: record on the timeline
    if (prevPopulation > 50 && liveCells < prevPopulation * 0.6) {
      const severity = 1 - liveCells / prevPopulation
      extinctionMarkers.push({ generation, severity, graphX: 0 })
      if (extinctionMarkers.length > 20) extinctionMarkers.shift()
    }

    // Cosmic ray mutation: ~every 5-15 seconds, flip a random cell
    cosmicRayTimer += 1
    if (cosmicRayTimer > 300 + Math.random() * 600) {
      cosmicRayTimer = 0
      const rayR = Math.floor(Math.random() * rows)
      const rayC = Math.floor(Math.random() * cols)
      if (grid[rayR][rayC] > 0) {
        grid[rayR][rayC] = 0
        deathCount[rayR][rayC]++
      } else {
        grid[rayR][rayC] = generation + 1
      }
      cosmicRayFlash = {
        x: rayC * cellSize + cellSize / 2,
        y: rayR * cellSize + cellSize / 2,
        alpha: 0.6,
      }
    }

    // Grid pulse brightness peaks on step then decays
    gridPulseBrightness = 0.02

    // Every 2 generations, check portal stability (period-2 detection)
    if (generation % 2 === 0) {
      updatePortals()
    }

    // Every ~200 generations, protect/re-seed portals if needed
    if (generation % 200 === 0) {
      protectPortals()
    }
  }

  // --- Audio helper functions ---

  function playLifePulse() {
    if (!ac) return
    try {
      const dest = getAudioDestination()
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'sine'
      osc.frequency.value = 200
      const cellRatio = Math.min(lastLiveCells / 500, 1)
      gain.gain.value = 0.001 * cellRatio
      osc.connect(gain)
      gain.connect(dest)
      osc.start(ac.currentTime)
      osc.stop(ac.currentTime + 0.002)
    } catch (_) { /* audio node creation can fail if context is closed */ }
  }

  function playBirthDeathCrackle() {
    if (!ac || (birthsThisStep === 0 && deathsThisStep === 0)) return
    try {
      const dest = getAudioDestination()
      const bufferSize = ac.sampleRate * 0.02 // 20ms noise burst
      const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1)
      }

      if (birthsThisStep > 0) {
        const src = ac.createBufferSource()
        src.buffer = buffer
        const filter = ac.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 2000
        filter.Q.value = 2
        const gain = ac.createGain()
        gain.gain.value = Math.min(0.01, 0.005 + birthsThisStep * 0.0002)
        src.connect(filter)
        filter.connect(gain)
        gain.connect(dest)
        src.start(ac.currentTime)
      }

      if (deathsThisStep > 0) {
        const src = ac.createBufferSource()
        src.buffer = buffer
        const filter = ac.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 500
        filter.Q.value = 2
        const gain = ac.createGain()
        gain.gain.value = Math.min(0.01, 0.005 + deathsThisStep * 0.0002)
        src.connect(filter)
        filter.connect(gain)
        gain.connect(dest)
        src.start(ac.currentTime)
      }
    } catch (_) { /* audio node creation can fail */ }
  }

  function updateDroneFrequency() {
    if (!droneOsc) return
    const targetFreq = 60 + Math.min(lastLiveCells * 0.01, 5)
    droneOsc.frequency.setTargetAtTime(targetFreq, ac!.currentTime, 0.5)
  }

  function updatePortalAudio() {
    if (!ac) return
    const portalFreqs = [330, 392, 262] // terrarium, seismograph, pendulum
    try {
      const dest = getAudioDestination()
      for (let i = 0; i < portalZones.length; i++) {
        const pz = portalZones[i]
        const wasActive = portalWasActive[i]

        if (pz.active && !wasActive) {
          // Portal just activated — start hum
          const osc = ac.createOscillator()
          osc.type = 'sine'
          osc.frequency.value = portalFreqs[i]
          const gain = ac.createGain()
          gain.gain.value = 0
          gain.gain.setTargetAtTime(0.02, ac.currentTime, 1.0)
          osc.connect(gain)
          gain.connect(dest)
          osc.start(ac.currentTime)
          portalOscs[i] = osc
          portalGains[i] = gain
        } else if (!pz.active && wasActive) {
          // Portal just deactivated — fade out and stop
          const gain = portalGains[i]
          const osc = portalOscs[i]
          if (gain && osc) {
            gain.gain.setTargetAtTime(0, ac.currentTime, 0.3)
            osc.stop(ac.currentTime + 1.5)
          }
          portalOscs[i] = null
          portalGains[i] = null
        }

        portalWasActive[i] = pz.active
      }
    } catch (_) { /* audio cleanup race */ }
  }

  function playClickSound() {
    if (!audioReady || !ac) return
    try {
      const dest = getAudioDestination()
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'sine'
      osc.frequency.value = 440
      gain.gain.value = 0.03
      gain.gain.setTargetAtTime(0, ac.currentTime, 0.003)
      osc.connect(gain)
      gain.connect(dest)
      osc.start(ac.currentTime)
      osc.stop(ac.currentTime + 0.005)
    } catch (_) { /* */ }
  }

  function initAudio() {
    getAudioContext().then((context) => {
      if (!active) return
      ac = context
      audioReady = true
      try {
        const dest = getAudioDestination()
        // Generation drone: low continuous triangle wave
        droneOsc = ac.createOscillator()
        droneOsc.type = 'triangle'
        droneOsc.frequency.value = 60
        droneGain = ac.createGain()
        droneGain.gain.value = 0
        // Fade drone in over 2 seconds
        droneGain.gain.setTargetAtTime(0.01, ac.currentTime, 2.0)
        droneOsc.connect(droneGain)
        droneGain.connect(dest)
        droneOsc.start(ac.currentTime)
      } catch (_) { /* */ }
    }).catch(() => { /* audio init failed, room still works silently */ })
  }

  function cleanupAudio(fadeTime = 0.5) {
    audioReady = false
    if (!ac) return

    const now = ac.currentTime

    // Fade drone
    if (droneGain) {
      try { droneGain.gain.setTargetAtTime(0, now, fadeTime * 0.3) } catch (_) { /* */ }
    }
    if (droneOsc) {
      try { droneOsc.stop(now + fadeTime + 0.1) } catch (_) { /* */ }
    }

    // Fade portal hums
    for (let i = 0; i < portalOscs.length; i++) {
      const g = portalGains[i]
      const o = portalOscs[i]
      if (g) {
        try { g.gain.setTargetAtTime(0, now, fadeTime * 0.3) } catch (_) { /* */ }
      }
      if (o) {
        try { o.stop(now + fadeTime + 0.1) } catch (_) { /* */ }
      }
      portalOscs[i] = null
      portalGains[i] = null
    }
    portalWasActive = [false, false, false]
  }

  function destroyAudio() {
    cleanupAudio(0)
    // Disconnect all nodes
    try { droneOsc?.disconnect() } catch (_) { /* */ }
    try { droneGain?.disconnect() } catch (_) { /* */ }
    for (let i = 0; i < portalOscs.length; i++) {
      try { portalOscs[i]?.disconnect() } catch (_) { /* */ }
      try { portalGains[i]?.disconnect() } catch (_) { /* */ }
      portalOscs[i] = null
      portalGains[i] = null
    }
    droneOsc = null
    droneGain = null
    ac = null
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016
    frameCount++

    // Step the simulation
    if (!paused && frameCount % speed === 0) {
      step()
    }

    const w = canvas.width
    const h = canvas.height

    // Decay grid pulse brightness
    gridPulseBrightness *= 0.92

    // Clear with very slight trail (creates afterglow), pulse brightness on step
    const bgR = Math.round(3 + gridPulseBrightness * 255)
    const bgG = Math.round(2 + gridPulseBrightness * 200)
    const bgB = Math.round(5 + gridPulseBrightness * 255)
    ctx.fillStyle = `rgba(${bgR}, ${bgG}, ${bgB}, 0.85)`
    ctx.fillRect(0, 0, w, h)

    // --- Physarum memory trails (heat map underlay) ---
    // Decay and render heat map every frame
    for (let r = 0; r < heatMapRows; r += 2) { // render every other row for performance
      for (let c = 0; c < heatMapCols; c += 2) {
        const idx = r * heatMapCols + c
        if (heatMap[idx] > 0.01) {
          heatMap[idx] *= HEAT_DECAY
          // Render as faint warm glow — color shifts from amber to violet with intensity
          const h = heatMap[idx]
          const red = Math.round(80 + h * 120)
          const green = Math.round(40 + h * 30)
          const blue = Math.round(80 + h * 100)
          const alpha = h * 0.08
          ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`
          ctx.fillRect(c * cellSize, r * cellSize, cellSize * 2, cellSize * 2)
        } else {
          heatMap[idx] = 0
        }
      }
    }

    // --- Extinction event flash ---
    if (extinctionFlash > 0.01) {
      ctx.fillStyle = `rgba(180, 30, 30, ${extinctionFlash * 0.15})`
      ctx.fillRect(0, 0, w, h)
      extinctionFlash *= 0.97
    }

    // Draw cells
    let liveCells = 0
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] > 0) {
          liveCells++
          const age = generation - grid[r][c]
          const deaths = deathCount[r][c]

          // Color based on age and resurrection count
          let hue: number, sat: number, light: number, alpha: number
          if (deaths > 0) {
            // Resurrection cells — violet
            hue = 280 + deaths * 10
            sat = 40 + Math.min(deaths * 5, 30)
            light = 40 + Math.min(age, 50)
            alpha = 0.6 + Math.sin(time * 2 + r + c) * 0.1
          } else if (age < 5) {
            // New cells — bright pink
            hue = 330
            sat = 80
            light = 60 - age * 3
            alpha = 0.8
          } else if (age < 30) {
            // Maturing cells — gold
            hue = 40 + age
            sat = 60 - age
            light = 50 - age * 0.5
            alpha = 0.6
          } else {
            // Old cells — fading gray
            hue = 0
            sat = 5
            light = Math.max(15, 40 - age * 0.3)
            alpha = Math.max(0.2, 0.5 - age * 0.005)
          }

          ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`
          ctx.fillRect(c * cellSize, r * cellSize, cellSize - 1, cellSize - 1)
        }
      }
    }

    // Track live cells for audio
    lastLiveCells = liveCells

    // --- Newborn cell glow ---
    for (const [nr, nc, birthGen] of newbornCells) {
      if (grid[nr]?.[nc] > 0) {
        const glowAge = generation - birthGen
        if (glowAge < 3) {
          const cx = nc * cellSize + cellSize / 2
          const cy = nr * cellSize + cellSize / 2
          const glowAlpha = 0.15 * (1 - glowAge / 3)
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cellSize * 2.5)
          grad.addColorStop(0, `rgba(255, 180, 220, ${glowAlpha})`)
          grad.addColorStop(1, 'rgba(255, 180, 220, 0)')
          ctx.fillStyle = grad
          ctx.fillRect(cx - cellSize * 2.5, cy - cellSize * 2.5, cellSize * 5, cellSize * 5)
        }
      }
    }

    // --- Death particles ---
    for (let i = deathParticles.length - 1; i >= 0; i--) {
      const p = deathParticles[i]
      p.x += p.vx
      p.y += p.vy
      p.alpha -= 0.005
      if (p.alpha <= 0) {
        deathParticles.splice(i, 1)
        continue
      }
      ctx.fillStyle = `rgba(160, 140, 180, ${p.alpha})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }

    // --- Fossil layer: cells with many deaths leave permanent dim marks ---
    for (let r = 0; r < rows; r += 2) { // every other row for performance
      for (let c = 0; c < cols; c += 2) {
        const deaths = deathCount[r][c]
        if (deaths > 5 && grid[r][c] === 0) {
          const fossilAlpha = Math.min(0.06, deaths * 0.004)
          ctx.fillStyle = `rgba(100, 80, 120, ${fossilAlpha})`
          ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize)
        }
      }
    }

    // --- Cosmic ray flash ---
    if (cosmicRayFlash) {
      cosmicRayFlash.alpha -= 0.01
      if (cosmicRayFlash.alpha <= 0) {
        cosmicRayFlash = null
      } else {
        const cr = cosmicRayFlash
        // Bright flash expanding outward
        const radius = (0.6 - cr.alpha) * 40 + 5
        const grad = ctx.createRadialGradient(cr.x, cr.y, 0, cr.x, cr.y, radius)
        grad.addColorStop(0, `rgba(255, 255, 200, ${cr.alpha})`)
        grad.addColorStop(0.3, `rgba(200, 150, 255, ${cr.alpha * 0.5})`)
        grad.addColorStop(1, 'rgba(150, 100, 200, 0)')
        ctx.fillStyle = grad
        ctx.fillRect(cr.x - radius, cr.y - radius, radius * 2, radius * 2)

        // Label
        if (cr.alpha > 0.3) {
          ctx.font = '9px monospace'
          ctx.fillStyle = `rgba(255, 255, 200, ${cr.alpha * 0.6})`
          ctx.textAlign = 'center'
          ctx.fillText('cosmic ray', cr.x, cr.y - radius - 4)
        }
      }
    }

    // --- Stagnation shimmer ---
    if (stagnationShimmer > 0.01) {
      const shimAlpha = stagnationShimmer * 0.03 * (0.8 + Math.sin(time * 1.5) * 0.2)
      ctx.fillStyle = `rgba(255, 215, 80, ${shimAlpha})`
      ctx.fillRect(0, 0, w, h)
      if (stagnationCounter > 60) {
        ctx.font = '12px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(255, 215, 80, ${stagnationShimmer * 0.15})`
        ctx.textAlign = 'center'
        ctx.fillText('equilibrium', w / 2, 50)
      }
      // Decay shimmer slowly when not stepping
      if (paused) stagnationShimmer *= 0.99
    }

    // --- Birth cluster rings ---
    for (let i = birthClusterRings.length - 1; i >= 0; i--) {
      const ring = birthClusterRings[i]
      ring.radius += 1.5
      ring.alpha -= 0.004
      if (ring.alpha <= 0) { birthClusterRings.splice(i, 1); continue }
      ctx.strokeStyle = `rgba(255, 180, 220, ${ring.alpha})`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2)
      ctx.stroke()
    }

    // UI overlay
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(180, 160, 200, ${0.08 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the automaton', w / 2, 25)

    // Stats
    ctx.font = '12px monospace'
    ctx.fillStyle = 'rgba(180, 160, 200, 0.08)'
    ctx.textAlign = 'left'
    ctx.fillText(`gen ${generation}`, 12, h - 42)
    ctx.fillText(`${liveCells} alive`, 12, h - 30)
    if (oldestCellAge > 10) {
      ctx.fillText(`eldest: ${oldestCellAge} gen`, 12, h - 18)
    }

    ctx.textAlign = 'right'
    ctx.fillText(`speed: ${11 - speed}`, w - 12, h - 30)
    ctx.fillText(paused ? 'paused' : 'running', w - 12, h - 18)

    // Extinction event label
    if (extinctionFlash > 0.01 && extinctionLabel) {
      ctx.font = '14px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(220, 60, 60, ${extinctionFlash * 0.5})`
      ctx.textAlign = 'center'
      ctx.fillText(extinctionLabel, w / 2, 50)
    }
    // Extinction count (persistent)
    if (extinctionCount > 0) {
      ctx.font = '10px monospace'
      ctx.fillStyle = 'rgba(180, 80, 80, 0.06)'
      ctx.textAlign = 'left'
      ctx.fillText(`${extinctionCount} extinction${extinctionCount > 1 ? 's' : ''}`, 12, 25)
    }

    // Hints (updated with rule mutation keys)
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(180, 160, 200, 0.05)'
    ctx.textAlign = 'center'
    ctx.fillText('click to seed · scroll speed · space pause · r reset · 6-9 mutate rules', w / 2, h - 8)

    // === RULE INDICATOR ===
    {
      const rules = RULE_SETS[currentRuleIdx]
      // Flash on rule change
      ruleTransitionAlpha *= 0.96
      const flashAlpha = ruleTransitionAlpha * 0.5
      if (flashAlpha > 0.01) {
        ctx.fillStyle = `rgba(200, 160, 255, ${flashAlpha})`
        ctx.fillRect(0, 0, w, h)
      }
      // Rule label
      const ruleAlpha = 0.06 + ruleTransitionAlpha * 0.3
      ctx.font = '13px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(200, 160, 255, ${ruleAlpha})`
      ctx.textAlign = 'right'
      ctx.fillText(rules.notation, w - 12, 25)
      ctx.font = '11px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(200, 160, 255, ${ruleAlpha * 0.6})`
      ctx.fillText(rules.description, w - 12, 40)
    }

    // === POPULATION GRAPH (bottom-right) ===
    if (popHistory.length > 2) {
      const graphW = 120
      const graphH = 40
      const graphX = w - graphW - 14
      const graphY = h - 80
      const maxPop = Math.max(1, ...popHistory)

      // Background
      ctx.fillStyle = 'rgba(10, 5, 20, 0.3)'
      ctx.fillRect(graphX, graphY, graphW, graphH)
      ctx.strokeStyle = 'rgba(180, 160, 200, 0.06)'
      ctx.lineWidth = 0.5
      ctx.strokeRect(graphX, graphY, graphW, graphH)

      // Draw population line
      ctx.beginPath()
      for (let i = 0; i < popHistory.length; i++) {
        const x = graphX + (i / POP_HISTORY_MAX) * graphW
        const y = graphY + graphH - (popHistory[i] / maxPop) * graphH
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = 'rgba(255, 180, 220, 0.2)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Extinction markers on the graph
      const oldestGen = generation - popHistory.length
      for (const em of extinctionMarkers) {
        const genOffset = em.generation - oldestGen
        if (genOffset >= 0 && genOffset < popHistory.length) {
          const markerX = graphX + (genOffset / POP_HISTORY_MAX) * graphW
          em.graphX = markerX
          // Vertical red line at extinction point
          ctx.strokeStyle = `rgba(220, 60, 60, ${0.1 + em.severity * 0.15})`
          ctx.lineWidth = 0.5
          ctx.beginPath()
          ctx.moveTo(markerX, graphY)
          ctx.lineTo(markerX, graphY + graphH)
          ctx.stroke()
          // Small cross/memorial mark
          ctx.fillStyle = `rgba(220, 60, 60, ${0.08 + em.severity * 0.1})`
          ctx.fillRect(markerX - 1, graphY + graphH + 2, 2, 3)
        }
      }

      // Label
      ctx.font = '9px monospace'
      ctx.fillStyle = 'rgba(180, 160, 200, 0.06)'
      ctx.textAlign = 'right'
      ctx.fillText('population', graphX + graphW, graphY - 3)
    }

    // Portal zones — stable life patterns that glow and act as navigation
    if (deps?.switchTo) {
      for (let i = 0; i < portalZones.length; i++) {
        const pz = portalZones[i]
        const isHovered = hoveredPortal === i
        const centerX = pz.edgeCol * cellSize + cellSize * 2
        const centerY = pz.edgeRow * cellSize + cellSize * 2

        // Always draw a faint glow around the portal zone so players can discover it
        const baseGlow = pz.active ? 0.12 : 0.03
        const hoverBoost = isHovered ? 0.2 : 0
        const pulse = Math.sin(time * 3 + i * 2) * 0.04
        const glowAlpha = Math.min(1, baseGlow + hoverBoost + pulse)

        // Soft radial glow
        const grad = ctx.createRadialGradient(centerX, centerY, 2, centerX, centerY, 40)
        grad.addColorStop(0, pz.glowColor + (glowAlpha * 0.8).toFixed(3) + ')')
        grad.addColorStop(0.5, pz.glowColor + (glowAlpha * 0.4).toFixed(3) + ')')
        grad.addColorStop(1, pz.glowColor + '0)')
        ctx.fillStyle = grad
        ctx.fillRect(centerX - 40, centerY - 40, 80, 80)

        // If active, draw brighter glow on each live portal cell
        if (pz.active) {
          for (const [cr, cc] of pz.cells) {
            if (grid[cr]?.[cc] > 0) {
              const cx = cc * cellSize + cellSize / 2
              const cy = cr * cellSize + cellSize / 2
              const cellGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, cellSize * 1.5)
              const cellAlpha = 0.3 + (isHovered ? 0.25 : 0) + Math.sin(time * 4 + cr + cc) * 0.1
              cellGlow.addColorStop(0, pz.glowColor + cellAlpha.toFixed(3) + ')')
              cellGlow.addColorStop(1, pz.glowColor + '0)')
              ctx.fillStyle = cellGlow
              ctx.fillRect(cx - cellSize * 1.5, cy - cellSize * 1.5, cellSize * 3, cellSize * 3)
            }
          }
        }

        // Label — fades in as portal stabilizes
        const labelAlpha = pz.active
          ? Math.min(0.45, pz.stableTime * 0.005) + (isHovered ? 0.35 : 0)
          : (isHovered ? 0.1 : 0)
        if (labelAlpha > 0.01) {
          ctx.font = '12px "Cormorant Garamond", serif'
          ctx.fillStyle = pz.glowColor + labelAlpha.toFixed(3) + ')'
          ctx.textAlign = 'center'
          // Place label below the pattern
          ctx.fillText(pz.label, centerX, centerY + 35)
        }

        // Cursor hint when hovered
        if (isHovered && canvas) {
          canvas.style.cursor = 'pointer'
        }
      }
      // Reset cursor if nothing hovered
      if (hoveredPortal === -1 && canvas) {
        canvas.style.cursor = 'crosshair'
      }
    }

    // Auto-reseed if everything dies
    if (liveCells === 0 && !paused) {
      seedRandom(0.05)
    }

    // Cultural inscriptions
    inscriptionTimer += 0.016
    if (inscriptionTimer >= 25) {
      inscriptionTimer = 0
      inscriptionIdx = (inscriptionIdx + 1) % CULTURAL_INSCRIPTIONS.length
    }
    const insText = CULTURAL_INSCRIPTIONS[inscriptionIdx]
    ctx.font = '11px "Cormorant Garamond", serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(200, 120, 180, 0.03)'
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
    name: 'automaton',
    label: 'the automaton',

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
      canvas.style.cssText = 'width: 100%; height: 100%; cursor: crosshair;'
      ctx = canvas.getContext('2d')

      // Click to seed cells
      canvas.addEventListener('click', (e) => {
        const c = Math.floor(e.clientX / cellSize)
        const r = Math.floor(e.clientY / cellSize)
        playClickSound()
        // Place a random pattern or just toggle cells
        if (Math.random() < 0.3) {
          const patternNames = Object.keys(PATTERNS) as (keyof typeof PATTERNS)[]
          const name = patternNames[Math.floor(Math.random() * patternNames.length)]
          placePattern(name, r, c)
        } else {
          // Draw a small cluster
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              if (Math.random() < 0.5) {
                const nr = (r + dr + rows) % rows
                const nc = (c + dc + cols) % cols
                grid[nr][nc] = generation + 1
              }
            }
          }
        }
      })

      // Drag to paint
      let painting = false
      canvas.addEventListener('mousedown', () => { painting = true })
      canvas.addEventListener('mouseup', () => { painting = false })
      canvas.addEventListener('mouseleave', () => { painting = false })
      canvas.addEventListener('mousemove', (e) => {
        if (!painting) return
        const c = Math.floor(e.clientX / cellSize)
        const r = Math.floor(e.clientY / cellSize)
        if (r >= 0 && r < rows && c >= 0 && c < cols) {
          grid[r][c] = generation + 1
        }
      })

      // Scroll to change speed
      canvas.addEventListener('wheel', (e) => {
        speed = Math.max(1, Math.min(10, speed + (e.deltaY > 0 ? 1 : -1)))
        e.preventDefault()
      }, { passive: false })

      // Keyboard: space to pause, r to reset
      const onKey = (e: KeyboardEvent) => {
        if (e.key === ' ') {
          paused = !paused
          e.preventDefault()
        }
        if (e.key === 'r' || e.key === 'R') {
          initGrid()
        }
        // Rule mutation: 6-9 switch rule sets
        const ruleKeys: Record<string, number> = { '6': 0, '7': 1, '8': 2, '9': 3 }
        if (ruleKeys[e.key] !== undefined) {
          const newIdx = ruleKeys[e.key]
          if (newIdx !== currentRuleIdx) {
            currentRuleIdx = newIdx
            ruleTransitionAlpha = 1.0
          }
        }
      }
      window.addEventListener('keydown', onKey)

      // Portal zone click detection
      canvas.addEventListener('click', (e) => {
        if (!deps?.switchTo) return
        for (let i = 0; i < portalZones.length; i++) {
          const pz = portalZones[i]
          const centerX = pz.edgeCol * cellSize + cellSize * 2
          const centerY = pz.edgeRow * cellSize + cellSize * 2
          const dx = e.clientX - centerX
          const dy = e.clientY - centerY
          if (dx * dx + dy * dy < 50 * 50) {
            deps.switchTo(pz.room)
            return
          }
        }
      })
      // Portal zone hover detection
      canvas.addEventListener('mousemove', (e) => {
        if (!deps?.switchTo) return
        hoveredPortal = -1
        for (let i = 0; i < portalZones.length; i++) {
          const pz = portalZones[i]
          const centerX = pz.edgeCol * cellSize + cellSize * 2
          const centerY = pz.edgeRow * cellSize + cellSize * 2
          const dx = e.clientX - centerX
          const dy = e.clientY - centerY
          if (dx * dx + dy * dy < 50 * 50) {
            hoveredPortal = i
            break
          }
        }
      })

      overlay.appendChild(canvas)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
          initGrid()
        }
      }
      window.addEventListener('resize', onResize)

      return overlay
    },

    activate() {
      active = true
      cosmicRayTimer = 0
      cosmicRayFlash = null
      extinctionMarkers.length = 0
      stagnationCounter = 0
      stagnationShimmer = 0
      lastStagnationPop = 0
      birthClusterRings.length = 0
      initGrid()
      initAudio()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      cleanupAudio(0.5)
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      destroyAudio()
      deathParticles.length = 0
      newbornCells.length = 0
      overlay?.remove()
    },
  }
}
