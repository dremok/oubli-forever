/**
 * THE LABYRINTH — you are inside
 *
 * First-person maze exploration via raycasting.
 * WASD to move, mouse/arrow to look. The maze is seeded and
 * persists between visits — you always return to the same corridors.
 *
 * Hidden within the maze are three artifacts that connect to other rooms:
 * - A cipher stone (encoded inscriptions) → the cipher
 * - A cartographer's table (partial map) → the cartographer
 * - A bookshelf growing from the wall → the library
 *
 * Walls whisper fragments of your memories as you pass.
 * The exit at the far end leads to a random hidden room.
 *
 * Inspired by: Borges' "Garden of Forking Paths", grey matter
 * erosion research, Chiharu Shiota's thread installations,
 * the Minotaur's labyrinth, how getting lost is a form of finding
 */

import type { Room } from './RoomManager'

interface LabyrinthDeps {
  onExit?: () => void
  switchTo?: (name: string) => void
  getMemories?: () => { currentText: string; degradation: number }[]
}

// Seeded pseudo-random number generator (mulberry32)
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// Text fragments that appear on walls (mixed with user memories)
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
]

// Cell types
const WALL = 1
const EXIT = 2
const CIPHER_STONE = 3   // → cipher room
const MAP_TABLE = 4       // → cartographer room
const BOOKSHELF = 5       // → library room
const INSCRIPTION = 6     // wall with text (not a passage, just decoration)

export function createLabyrinthRoom(deps: LabyrinthDeps = {}): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  // Player state
  let px = 1.5
  let py = 1.5
  let pa = 0 // angle in radians
  const moveSpeed = 0.03
  const turnSpeed = 0.04

  // Maze
  let maze: number[][] = []
  let mazeW = 0
  let mazeH = 0
  let exitX = 0
  let exitY = 0

  // Special object positions
  let cipherPos = { x: 0, y: 0 }
  let mapPos = { x: 0, y: 0 }
  let bookPos = { x: 0, y: 0 }

  // Wall inscriptions: map cell key "x,y" → text
  const wallTexts = new Map<string, string>()

  // Discovery state (persisted)
  let discovered = new Set<string>()

  // Audio
  let audioCtx: AudioContext | null = null
  let footstepOsc: OscillatorNode | null = null
  let footstepGain: GainNode | null = null
  let ambienceGain: GainNode | null = null
  let lastStepTime = 0

  // Interaction hint
  let nearbyObject: string | null = null
  let interactAlpha = 0

  // Input
  const keys = new Set<string>()

  function getSeed(): number {
    const key = 'oubli-labyrinth-seed'
    let seed = localStorage.getItem(key)
    if (!seed) {
      seed = String(Math.floor(Math.random() * 2147483647))
      localStorage.setItem(key, seed)
    }
    return parseInt(seed)
  }

  function generateMaze(width: number, height: number, seed: number): number[][] {
    const rng = mulberry32(seed)
    const w = width | 1
    const h = height | 1
    mazeW = w
    mazeH = h

    // Fill with walls
    const grid: number[][] = Array.from({ length: h }, () => Array(w).fill(WALL))

    // Recursive backtracker (iterative to avoid stack overflow)
    const stack: [number, number][] = [[1, 1]]
    grid[1][1] = 0

    while (stack.length > 0) {
      const [x, y] = stack[stack.length - 1]
      const dirs: [number, number][] = [[0, -2], [0, 2], [-2, 0], [2, 0]]
      // Shuffle with seeded RNG
      for (let i = dirs.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[dirs[i], dirs[j]] = [dirs[j], dirs[i]]
      }

      let carved = false
      for (const [dx, dy] of dirs) {
        const nx = x + dx
        const ny = y + dy
        if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1 && grid[ny][nx] === WALL) {
          grid[y + dy / 2][x + dx / 2] = 0
          grid[ny][nx] = 0
          stack.push([nx, ny])
          carved = true
          break
        }
      }
      if (!carved) stack.pop()
    }

    // Place exit far from start
    exitX = w - 2
    exitY = h - 2
    grid[exitY][exitX] = EXIT

    // Collect all open cells for placing objects
    const openCells: [number, number][] = []
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (grid[y][x] === 0 && !(x === 1 && y === 1) && !(x === exitX && y === exitY)) {
          openCells.push([x, y])
        }
      }
    }

    // Shuffle open cells with seeded RNG
    for (let i = openCells.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[openCells[i], openCells[j]] = [openCells[j], openCells[i]]
    }

    // Place special objects — find walls adjacent to open cells
    function placeAdjacentWall(cellIdx: number, cellType: number): { x: number; y: number } {
      const [cx, cy] = openCells[cellIdx]
      // Check 4 neighbors for a wall to mark as special
      const neighbors: [number, number][] = [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]]
      for (const [nx, ny] of neighbors) {
        if (nx > 0 && nx < w-1 && ny > 0 && ny < h-1 && grid[ny][nx] === WALL) {
          grid[ny][nx] = cellType
          return { x: nx, y: ny }
        }
      }
      // Fallback: mark the cell itself
      grid[cy][cx] = cellType
      return { x: cx, y: cy }
    }

    // Place artifacts in different quadrants for good distribution
    const q1 = openCells.filter(([x, y]) => x < w/2 && y < h/2)
    const q2 = openCells.filter(([x, y]) => x >= w/2 && y < h/2)
    const q3 = openCells.filter(([x, y]) => x < w/2 && y >= h/2)

    // Cipher stone in quadrant with most cells, map table in next, bookshelf in last
    const quadrants = [q1, q2, q3].sort((a, b) => b.length - a.length)

    if (quadrants[0].length > 0) {
      const idx = Math.floor(rng() * quadrants[0].length)
      const [cx, cy] = quadrants[0][idx]
      const cellIdx = openCells.findIndex(([x, y]) => x === cx && y === cy)
      cipherPos = placeAdjacentWall(cellIdx >= 0 ? cellIdx : 0, CIPHER_STONE)
    }
    if (quadrants[1].length > 0) {
      const idx = Math.floor(rng() * quadrants[1].length)
      const [cx, cy] = quadrants[1][idx]
      const cellIdx = openCells.findIndex(([x, y]) => x === cx && y === cy)
      mapPos = placeAdjacentWall(cellIdx >= 0 ? cellIdx : 1, MAP_TABLE)
    }
    if (quadrants[2].length > 0) {
      const idx = Math.floor(rng() * quadrants[2].length)
      const [cx, cy] = quadrants[2][idx]
      const cellIdx = openCells.findIndex(([x, y]) => x === cx && y === cy)
      bookPos = placeAdjacentWall(cellIdx >= 0 ? cellIdx : 2, BOOKSHELF)
    }

    // Scatter inscriptions on ~15% of wall cells
    wallTexts.clear()
    const memTexts = deps.getMemories?.().map(m => m.currentText).filter(t => t.length > 3) ?? []
    const allTexts = [...WALL_FRAGMENTS, ...memTexts.slice(0, 10)]

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (grid[y][x] === WALL && rng() < 0.12) {
          // Check if adjacent to an open cell (visible wall)
          const hasOpen = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(
            ([nx, ny]) => nx >= 0 && nx < w && ny >= 0 && ny < h && (grid[ny][nx] === 0 || grid[ny][nx] === EXIT)
          )
          if (hasOpen) {
            grid[y][x] = INSCRIPTION
            wallTexts.set(`${x},${y}`, allTexts[Math.floor(rng() * allTexts.length)])
          }
        }
      }
    }

    return grid
  }

  function initAudio() {
    if (audioCtx) return
    try {
      audioCtx = new AudioContext()

      // Ambient drone — low rumble of the labyrinth
      const ambOsc = audioCtx.createOscillator()
      ambOsc.type = 'sine'
      ambOsc.frequency.value = 42 // deep sub-bass
      ambienceGain = audioCtx.createGain()
      ambienceGain.gain.value = 0
      ambOsc.connect(ambienceGain)
      ambienceGain.connect(audioCtx.destination)
      ambOsc.start()

      // Second harmonic
      const ambOsc2 = audioCtx.createOscillator()
      ambOsc2.type = 'sine'
      ambOsc2.frequency.value = 63
      const amb2Gain = audioCtx.createGain()
      amb2Gain.gain.value = 0
      ambOsc2.connect(amb2Gain)
      amb2Gain.connect(audioCtx.destination)
      ambOsc2.start()

      // Slowly fade in
      ambienceGain.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 3)
      amb2Gain.gain.linearRampToValueAtTime(0.03, audioCtx.currentTime + 5)

      // Footstep synth — short filtered noise burst
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
      footstepGain.connect(audioCtx.destination)
      footstepOsc.start()
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

  function castRay(ox: number, oy: number, angle: number): { dist: number; side: number; cell: number } {
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)

    let t = 0
    const step = 0.02

    while (t < 20) {
      const x = ox + dx * t
      const y = oy + dy * t
      const mx = Math.floor(x)
      const my = Math.floor(y)

      if (mx < 0 || mx >= mazeW || my < 0 || my >= mazeH) {
        return { dist: t, side: 0, cell: WALL }
      }

      const cell = maze[my][mx]
      if (cell >= 1) {
        const prevX = Math.floor(ox + dx * (t - step))
        const prevY = Math.floor(oy + dy * (t - step))
        const side = (prevX !== mx) ? 0 : 1
        return { dist: t, side, cell }
      }

      t += step
    }

    return { dist: 20, side: 0, cell: 0 }
  }

  function isWalkable(cell: number): boolean {
    return cell === 0 || cell === EXIT
  }

  function update() {
    let moveX = 0
    let moveY = 0
    let moving = false

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

    // Collision detection
    const margin = 0.2
    const newX = px + moveX
    const newY = py + moveY

    const cellXCheck = maze[Math.floor(py)]?.[Math.floor(newX + margin * Math.sign(moveX))]
    if (cellXCheck !== undefined && isWalkable(cellXCheck)) {
      px = newX
    }
    const cellYCheck = maze[Math.floor(newY + margin * Math.sign(moveY))]?.[Math.floor(px)]
    if (cellYCheck !== undefined && isWalkable(cellYCheck)) {
      py = newY
    }

    if (moving) playFootstep()

    // Check proximity to special objects
    nearbyObject = null
    const checkDist = 1.8

    const dCipher = Math.hypot(px - (cipherPos.x + 0.5), py - (cipherPos.y + 0.5))
    const dMap = Math.hypot(px - (mapPos.x + 0.5), py - (mapPos.y + 0.5))
    const dBook = Math.hypot(px - (bookPos.x + 0.5), py - (bookPos.y + 0.5))

    if (dCipher < checkDist) nearbyObject = 'cipher'
    else if (dMap < checkDist) nearbyObject = 'cartographer'
    else if (dBook < checkDist) nearbyObject = 'library'

    // Check if at exit
    if (Math.floor(px) === exitX && Math.floor(py) === exitY) {
      if (deps.onExit) {
        deps.onExit()
      } else {
        // Regenerate with new seed
        localStorage.removeItem('oubli-labyrinth-seed')
        maze = generateMaze(25, 25, getSeed())
        px = 1.5
        py = 1.5
      }
    }
  }

  function getCellColor(cell: number, brightness: number, sideDim: number): [number, number, number] {
    switch (cell) {
      case EXIT:
        return [255 * brightness, 215 * brightness, 0]
      case CIPHER_STONE:
        // Pulsing green — encoded
        return [
          20 * brightness * sideDim,
          (100 + Math.sin(time * 2) * 40) * brightness * sideDim,
          60 * brightness * sideDim,
        ]
      case MAP_TABLE:
        // Warm amber — cartography
        return [
          (120 + Math.sin(time * 1.5) * 30) * brightness * sideDim,
          (90 + Math.sin(time * 1.5) * 20) * brightness * sideDim,
          30 * brightness * sideDim,
        ]
      case BOOKSHELF:
        // Deep burgundy — old books
        return [
          (100 + Math.sin(time * 1.8) * 25) * brightness * sideDim,
          30 * brightness * sideDim,
          (50 + Math.sin(time * 1.8) * 20) * brightness * sideDim,
        ]
      case INSCRIPTION:
        // Slightly warmer than normal walls
        return [
          50 * brightness * sideDim,
          38 * brightness * sideDim,
          65 * brightness * sideDim,
        ]
      default:
        // Normal wall
        return [
          40 * brightness * sideDim,
          30 * brightness * sideDim,
          60 * brightness * sideDim,
        ]
    }
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

    // Ceiling gradient with subtle breathing
    const breathe = Math.sin(time * 0.2) * 2
    const ceilGrad = ctx.createLinearGradient(0, 0, 0, h / 2)
    ceilGrad.addColorStop(0, `rgba(${5 + breathe}, 3, ${10 + breathe}, 1)`)
    ceilGrad.addColorStop(1, `rgba(${10 + breathe}, 8, ${18 + breathe}, 1)`)
    ctx.fillStyle = ceilGrad
    ctx.fillRect(0, 0, w, h / 2)

    // Floor gradient
    const floorGrad = ctx.createLinearGradient(0, h / 2, 0, h)
    floorGrad.addColorStop(0, 'rgba(8, 6, 12, 1)')
    floorGrad.addColorStop(1, 'rgba(3, 2, 6, 1)')
    ctx.fillStyle = floorGrad
    ctx.fillRect(0, h / 2, w, h / 2)

    // Raycasting
    const stripW = w / numRays

    // Collect nearby inscription texts to show
    const visibleInscriptions: { text: string; screenX: number; dist: number; brightness: number }[] = []

    for (let i = 0; i < numRays; i++) {
      const rayAngle = pa - fov / 2 + (i / numRays) * fov
      const hit = castRay(px, py, rayAngle)

      const correctedDist = hit.dist * Math.cos(rayAngle - pa)
      const wallHeight = Math.min(h * 2, h / correctedDist)
      const wallTop = (h - wallHeight) / 2
      const brightness = Math.max(0, 1 - correctedDist / 10)
      const sideDim = hit.side ? 0.7 : 1.0

      const [r, g, b] = getCellColor(hit.cell, brightness, sideDim)

      ctx.fillStyle = `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`
      ctx.fillRect(i * stripW, wallTop, stripW + 1, wallHeight)

      // Check for inscription text on this ray
      if (hit.cell === INSCRIPTION && correctedDist < 4) {
        const hitX = Math.floor(px + Math.cos(rayAngle) * hit.dist)
        const hitY = Math.floor(py + Math.sin(rayAngle) * hit.dist)
        const key = `${hitX},${hitY}`
        const text = wallTexts.get(key)
        if (text) {
          visibleInscriptions.push({
            text,
            screenX: i * stripW + stripW / 2,
            dist: correctedDist,
            brightness,
          })
        }
      }
    }

    // Render wall inscriptions (deduplicate by text)
    const shownTexts = new Set<string>()
    for (const insc of visibleInscriptions) {
      if (shownTexts.has(insc.text)) continue
      shownTexts.add(insc.text)

      const fontSize = Math.max(8, Math.min(14, 16 / insc.dist))
      const alpha = Math.min(0.6, insc.brightness * 0.8) * (0.5 + Math.sin(time * 0.5 + insc.screenX * 0.01) * 0.3)
      ctx.font = `${fontSize}px "Cormorant Garamond", serif`
      ctx.fillStyle = `rgba(180, 160, 200, ${alpha})`
      ctx.textAlign = 'center'

      // Render vertically (rotated) to look like wall writing
      ctx.save()
      ctx.translate(insc.screenX, h / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText(insc.text.substring(0, 20), 0, 0)
      ctx.restore()
    }

    // Fog overlay — distance-based darkening
    const fogGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6)
    fogGrad.addColorStop(0, 'rgba(3, 2, 6, 0)')
    fogGrad.addColorStop(0.7, 'rgba(3, 2, 6, 0.1)')
    fogGrad.addColorStop(1, 'rgba(3, 2, 6, 0.4)')
    ctx.fillStyle = fogGrad
    ctx.fillRect(0, 0, w, h)

    // Crosshair
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.04)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(w / 2 - 6, h / 2)
    ctx.lineTo(w / 2 + 6, h / 2)
    ctx.moveTo(w / 2, h / 2 - 6)
    ctx.lineTo(w / 2, h / 2 + 6)
    ctx.stroke()

    // Title
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(140, 120, 160, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the labyrinth', w / 2, 25)

    // Discovery count
    const totalArtifacts = 3
    const found = discovered.size
    if (found > 0) {
      ctx.font = '8px monospace'
      ctx.fillStyle = `rgba(255, 215, 0, ${0.08 + Math.sin(time * 0.5) * 0.03})`
      ctx.textAlign = 'right'
      ctx.fillText(`${found}/${totalArtifacts} found`, w - 16, 20)
    }

    // Interaction prompt when near a special object
    if (nearbyObject) {
      interactAlpha = Math.min(1, interactAlpha + 0.03)
      const alpha = interactAlpha * (0.4 + Math.sin(time * 2) * 0.15)

      let prompt = ''
      let color = ''
      switch (nearbyObject) {
        case 'cipher':
          prompt = 'press E — encoded inscriptions shimmer on the stone'
          color = `rgba(80, 200, 120, ${alpha})`
          break
        case 'cartographer':
          prompt = 'press E — a half-drawn map on the table'
          color = `rgba(200, 170, 80, ${alpha})`
          break
        case 'library':
          prompt = 'press E — books grow from the wall like roots'
          color = `rgba(180, 80, 120, ${alpha})`
          break
      }

      ctx.font = '12px "Cormorant Garamond", serif'
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.fillText(prompt, w / 2, h - 40)
    } else {
      interactAlpha = Math.max(0, interactAlpha - 0.02)
    }

    // Bottom hint (only if no nearby object)
    if (!nearbyObject) {
      ctx.font = '9px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(140, 120, 160, 0.04)'
      ctx.textAlign = 'center'
      const hint = found < totalArtifacts
        ? 'WASD to move · find artifacts hidden in the corridors'
        : 'WASD to move · seek the golden exit'
      ctx.fillText(hint, w / 2, h - 8)
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!active) return
    const key = e.key.toLowerCase()
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      keys.add(key)
      e.preventDefault()
    }

    // Interact with nearby objects
    if (key === 'e' && nearbyObject && deps.switchTo) {
      discovered.add(nearbyObject)
      // Persist discoveries
      localStorage.setItem('oubli-labyrinth-discovered', JSON.stringify([...discovered]))
      deps.switchTo(nearbyObject)
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
      return overlay
    },

    activate() {
      active = true
      maze = generateMaze(25, 25, getSeed())
      px = 1.5
      py = 1.5
      pa = 0
      keys.clear()

      // Restore discoveries
      try {
        const saved = localStorage.getItem('oubli-labyrinth-discovered')
        if (saved) discovered = new Set(JSON.parse(saved))
      } catch { /* ignore */ }

      initAudio()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      keys.clear()

      // Fade out audio
      if (ambienceGain && audioCtx) {
        ambienceGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1)
      }
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      if (audioCtx) {
        audioCtx.close().catch(() => {})
        audioCtx = null
      }
      overlay?.remove()
    },
  }
}
