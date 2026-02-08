/**
 * THE CARTOGRAPHER — a map of the house itself
 *
 * A meta-room that draws the navigation topology of Oubli.
 * Each room is a node, connections are edges. Visited rooms
 * glow brighter. Hidden rooms are shown as faint ghosts until
 * you've found them.
 *
 * The map breathes — nodes drift gently, connections pulse.
 * Click a room to navigate there. The map is both tool and art.
 *
 * This is Oubli becoming self-aware: drawing its own body.
 *
 * Inspired by: medieval cartography, mind maps, subway maps,
 * the Marauder's Map, site maps, how a house learns its own layout
 */

import type { Room } from './RoomManager'
import { ROOM_GRAPH as SHARED_GRAPH } from '../navigation/RoomGraph'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'
import { threadTrail } from '../navigation/ThreadTrail'

interface MapNode {
  name: string
  label: string
  x: number
  y: number
  targetX: number
  targetY: number
  vx: number
  vy: number
  hidden: boolean
  connections: string[]
  visited: boolean
}

// Poetic descriptions for each room (2-3 words)
const ROOM_POEMS: Record<string, string> = {
  void: 'where everything begins',
  study: 'ink remembers you',
  library: 'infinite shelves dreaming',
  cipher: 'meaning hides here',
  instrument: 'sound made visible',
  choir: 'voices without bodies',
  radio: 'static between worlds',
  observatory: 'counting dead stars',
  satellite: 'orbit of longing',
  asteroids: 'debris of creation',
  seance: 'the veil thins',
  oracle: 'futures already written',
  madeleine: 'taste triggers time',
  rememory: 'what the body knows',
  garden: 'growing in reverse',
  terrarium: 'worlds under glass',
  tidepool: 'small ocean, vast',
  well: 'depth speaks back',
  glacarium: 'frozen midsentence',
  furnace: 'where memories burn',
  disintegration: 'beauty in decay',
  clocktower: 'time made visible',
  datepaintings: 'each day a mark',
  darkroom: 'light leaves traces',
  projection: 'ghosts on walls',
  palimpsestgallery: 'layers beneath layers',
  sketchpad: 'lines seeking form',
  loom: 'threads of thought',
  automaton: 'clockwork dreaming',
  seismograph: 'tremors of feeling',
  pendulum: 'gravity keeps time',
  weathervane: 'wind knows direction',
  cartographer: 'the map breathes',
  labyrinth: 'lost by design',
  archive: 'everything kept, nothing found',
  lighthouse: 'light against dark',
  catacombs: 'buried whispers',
  roots: 'beneath the garden',
  ossuary: 'bones remember shape',
  between: 'neither here nor there',
  aquifer: 'deep water rising',
  midnight: 'the hour between',
  mirror: 'self looking back',
}

interface MapDeps {
  switchTo: (name: string) => void
  getActiveRoom: () => string
  getRoomVisits: () => Map<string, number>
}

// Rooms that use the memory system
const MEMORY_ROOMS = new Set([
  'study', 'seance', 'garden', 'observatory', 'radio', 'darkroom',
  'tidepool', 'furnace', 'well', 'library', 'clocktower', 'satellite',
  'asteroids', 'glacarium', 'disintegration', 'projection', 'loom',
  'palimpsestgallery', 'datepaintings', 'labyrinth', 'madeleine',
  'rememory', 'mirror', 'roots', 'ossuary', 'aquifer',
])

// Use the shared room graph
const ROOM_GRAPH = SHARED_GRAPH.map(n => ({
  name: n.name,
  label: n.label,
  hidden: n.hidden,
  connects: n.connections,
}))

export function createCartographerRoom(deps: MapDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let animProgress = 0 // 0..1 for unfolding animation

  let nodes: MapNode[] = []
  let hoveredNode: MapNode | null = null
  let prevHoveredNode: MapNode | null = null
  let hoverStartTime = 0
  let showDetailPanel = false
  let mouseX = 0
  let mouseY = 0

  // Path highlighting
  let highlightedPath: string[] = []

  // Zoom/focus state
  let zoomTarget: MapNode | null = null
  let zoomStartTime = 0
  let zoomDuration = 1.5 // seconds before navigating
  let zoomProgress = 0
  let zoomOriginX = 0
  let zoomOriginY = 0
  let zoomScale = 1
  let focusedConnections: Set<string> = new Set()

  // Connection line animation (flowing dots)
  let connectionDots: { fromName: string; toName: string; t: number; speed: number }[] = []
  let dotsInitialized = false

  // Cultural inscription state
  const INSCRIPTIONS = [
    'the clearest picture of dark matter looks like a neural network',
    'dark matter filaments: the scaffold everything visible grew on',
    'voids in the dark matter map \u2014 places where nothing chose to be',
    'borges dreamed a library of every possible book. this is a map of every possible room.',
  ]
  let inscriptionIndex = 0
  let inscriptionFade = 0
  let inscriptionTimer = 0
  const INSCRIPTION_CYCLE = 8 // seconds per inscription

  // Audio state
  let audioInitialized = false
  let audioMaster: GainNode | null = null
  let ambientOsc: OscillatorNode | null = null
  let ambientGain: GainNode | null = null
  let hoverOsc: OscillatorNode | null = null
  let hoverGain: GainNode | null = null
  let ac: AudioContext | null = null

  // Cartographic audio state
  let quillNoiseSource: AudioBufferSourceNode | null = null
  let quillFilter: BiquadFilterNode | null = null
  let quillGain: GainNode | null = null
  let unfoldInterval: ReturnType<typeof setInterval> | null = null

  // ═══════════════════════════════════════
  // AUDIO
  // ═══════════════════════════════════════

  async function initAudio() {
    if (audioInitialized) return
    try {
      ac = await getAudioContext()
      const dest = getAudioDestination()

      audioMaster = ac.createGain()
      audioMaster.gain.value = 0.15
      audioMaster.connect(dest)

      // Ambient hum — very low sine at 40Hz
      ambientOsc = ac.createOscillator()
      ambientOsc.type = 'sine'
      ambientOsc.frequency.value = 40
      ambientGain = ac.createGain()
      ambientGain.gain.value = 0
      ambientOsc.connect(ambientGain)
      ambientGain.connect(audioMaster)
      ambientOsc.start()

      // Fade in the ambient hum
      ambientGain.gain.setTargetAtTime(0.3, ac.currentTime, 1.5)

      // Hover oscillator — will be retuned on hover
      hoverOsc = ac.createOscillator()
      hoverOsc.type = 'sine'
      hoverOsc.frequency.value = 220
      hoverGain = ac.createGain()
      hoverGain.gain.value = 0
      hoverOsc.connect(hoverGain)
      hoverGain.connect(audioMaster)
      hoverOsc.start()

      audioInitialized = true
      initCartographicAudio()
    } catch (_) {
      // Audio not available — silent mode
    }
  }

  function playHoverTone(node: MapNode) {
    if (!ac || !hoverOsc || !hoverGain) return
    // Pitch based on node position — higher nodes = higher pitch
    const normalizedY = node.y / (canvas?.height || 800)
    const freq = 150 + (1 - normalizedY) * 300 // 150–450 Hz range
    hoverOsc.frequency.setTargetAtTime(freq, ac.currentTime, 0.05)
    hoverGain.gain.setTargetAtTime(0.15, ac.currentTime, 0.08)
  }

  function stopHoverTone() {
    if (!ac || !hoverGain) return
    hoverGain.gain.setTargetAtTime(0, ac.currentTime, 0.15)
  }

  function playWhoosh() {
    if (!ac || !audioMaster) return
    // Filtered noise burst — quick attack, fast decay
    const bufferSize = ac.sampleRate * 0.15
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      const envelope = Math.exp(-i / (bufferSize * 0.15))
      data[i] = (Math.random() * 2 - 1) * envelope
    }

    const source = ac.createBufferSource()
    source.buffer = buffer

    const filter = ac.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 800
    filter.Q.value = 1.5

    const whooshGain = ac.createGain()
    whooshGain.gain.value = 0.4

    source.connect(filter)
    filter.connect(whooshGain)
    whooshGain.connect(audioMaster)
    source.start()
  }

  function playClickChime(node: MapNode) {
    if (!ac || !audioMaster) return
    // Soft bell/chime — sine at 400-800Hz based on position, short envelope
    const normalizedY = node.y / (canvas?.height || 800)
    const freq = 400 + (1 - normalizedY) * 400
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    const g = ac.createGain()
    g.gain.setValueAtTime(0.2, ac.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.8)
    osc.connect(g)
    g.connect(audioMaster)
    osc.start()
    osc.stop(ac.currentTime + 0.8)
    // Second harmonic for bell quality
    const osc2 = ac.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = freq * 2.02 // slight detuning
    const g2 = ac.createGain()
    g2.gain.setValueAtTime(0.08, ac.currentTime)
    g2.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5)
    osc2.connect(g2)
    g2.connect(audioMaster)
    osc2.start()
    osc2.stop(ac.currentTime + 0.5)
  }

  function initCartographicAudio() {
    if (!ac || !audioMaster) return
    // Quill on parchment — filtered noise at very low gain
    const bufferLen = ac.sampleRate * 4 // 4-second loop
    const buffer = ac.createBuffer(1, bufferLen, ac.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferLen; i++) {
      // Scratchy noise with amplitude variation
      const scratch = Math.sin(i * 0.002) * 0.5 + 0.5
      data[i] = (Math.random() * 2 - 1) * (0.3 + scratch * 0.7)
    }
    quillNoiseSource = ac.createBufferSource()
    quillNoiseSource.buffer = buffer
    quillNoiseSource.loop = true
    quillFilter = ac.createBiquadFilter()
    quillFilter.type = 'highpass'
    quillFilter.frequency.value = 3000
    quillFilter.Q.value = 0.5
    quillGain = ac.createGain()
    quillGain.gain.value = 0
    quillNoiseSource.connect(quillFilter)
    quillFilter.connect(quillGain)
    quillGain.connect(audioMaster)
    quillNoiseSource.start()
    // Fade in slowly
    quillGain.gain.setTargetAtTime(0.01, ac.currentTime, 2.0)

    // Occasional map-unfolding sounds (broader noise burst at 0.015)
    unfoldInterval = setInterval(() => {
      if (!ac || !audioMaster || !active) return
      // Random chance ~20% every 3 seconds
      if (Math.random() > 0.2) return
      const unfoldLen = ac.sampleRate * 0.3
      const unfoldBuf = ac.createBuffer(1, unfoldLen, ac.sampleRate)
      const uData = unfoldBuf.getChannelData(0)
      for (let i = 0; i < unfoldLen; i++) {
        const env = Math.exp(-i / (unfoldLen * 0.3)) * Math.min(1, i / (unfoldLen * 0.05))
        uData[i] = (Math.random() * 2 - 1) * env
      }
      const src = ac.createBufferSource()
      src.buffer = unfoldBuf
      const filt = ac.createBiquadFilter()
      filt.type = 'bandpass'
      filt.frequency.value = 1200 + Math.random() * 800
      filt.Q.value = 0.8
      const uGain = ac.createGain()
      uGain.gain.value = 0.015
      src.connect(filt)
      filt.connect(uGain)
      uGain.connect(audioMaster!)
      src.start()
    }, 3000)
  }

  function cleanupAudio() {
    if (ambientGain && ac) {
      ambientGain.gain.setTargetAtTime(0, ac.currentTime, 0.3)
    }
    if (hoverGain && ac) {
      hoverGain.gain.setTargetAtTime(0, ac.currentTime, 0.1)
    }
    if (quillGain && ac) {
      quillGain.gain.setTargetAtTime(0, ac.currentTime, 0.2)
    }
    if (unfoldInterval !== null) {
      clearInterval(unfoldInterval)
      unfoldInterval = null
    }
    // Delayed cleanup to allow fade-out
    setTimeout(() => {
      try {
        ambientOsc?.stop()
        hoverOsc?.stop()
        quillNoiseSource?.stop()
      } catch (_) { /* already stopped */ }
      ambientOsc = null
      ambientGain = null
      hoverOsc = null
      hoverGain = null
      quillNoiseSource = null
      quillFilter = null
      quillGain = null
      audioMaster = null
      ac = null
      audioInitialized = false
    }, 500)
  }

  // ═══════════════════════════════════════
  // SHORTEST PATH (BFS)
  // ═══════════════════════════════════════

  function findShortestPath(fromName: string, toName: string): string[] {
    if (fromName === toName) return [fromName]
    const visited = new Set<string>()
    const queue: string[][] = [[fromName]]
    visited.add(fromName)

    while (queue.length > 0) {
      const path = queue.shift()!
      const current = path[path.length - 1]
      const node = findNode(current)
      if (!node) continue

      for (const neighbor of node.connections) {
        if (visited.has(neighbor)) continue
        const newPath = [...path, neighbor]
        if (neighbor === toName) return newPath
        visited.add(neighbor)
        queue.push(newPath)
      }
    }
    return [] // no path found
  }

  // ═══════════════════════════════════════
  // FORCE-DIRECTED LAYOUT
  // ═══════════════════════════════════════

  function runForceSimulation(iterations: number) {
    const repulseStrength = 4500
    const attractStrength = 0.004
    const damping = 0.85
    const centerPullX = canvas ? canvas.width / 2 : 600
    const centerPullY = canvas ? canvas.height / 2 : 400

    for (let iter = 0; iter < iterations; iter++) {
      // Repulsion between all node pairs
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]
          const b = nodes[j]
          let dx = a.targetX - b.targetX
          let dy = a.targetY - b.targetY
          let dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 1) dist = 1
          const force = repulseStrength / (dist * dist)
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          a.vx += fx
          a.vy += fy
          b.vx -= fx
          b.vy -= fy
        }
      }

      // Attraction along edges
      for (const node of nodes) {
        for (const connName of node.connections) {
          const target = findNode(connName)
          if (!target) continue
          const dx = target.targetX - node.targetX
          const dy = target.targetY - node.targetY
          const dist = Math.sqrt(dx * dx + dy * dy)
          const force = dist * attractStrength
          node.vx += (dx / dist) * force
          node.vy += (dy / dist) * force
        }
      }

      // Gentle center pull to prevent drifting offscreen
      for (const node of nodes) {
        node.vx += (centerPullX - node.targetX) * 0.0003
        node.vy += (centerPullY - node.targetY) * 0.0003
      }

      // Apply velocities with damping
      for (const node of nodes) {
        node.vx *= damping
        node.vy *= damping
        node.targetX += node.vx
        node.targetY += node.vy
      }
    }

    // Clamp positions to canvas bounds with margin
    const margin = 40
    const w = canvas?.width || 1200
    const h = canvas?.height || 800
    for (const node of nodes) {
      node.targetX = Math.max(margin, Math.min(w - margin, node.targetX))
      node.targetY = Math.max(margin + 30, Math.min(h - margin - 30, node.targetY))
    }
  }

  // ═══════════════════════════════════════
  // NODE INITIALIZATION
  // ═══════════════════════════════════════

  function initNodes() {
    if (!canvas) return
    const w = canvas.width
    const h = canvas.height
    const visits = deps.getRoomVisits()

    const surfaceRooms = ROOM_GRAPH.filter(r => !r.hidden)
    const hiddenRooms = ROOM_GRAPH.filter(r => r.hidden)

    nodes = []

    // Start with elliptical layout as seed positions — use most of the screen
    const cx = w / 2
    const surfaceCY = h * 0.38
    const rx = w * 0.42
    const ry = h * 0.28

    for (let i = 0; i < surfaceRooms.length; i++) {
      const angle = (i / surfaceRooms.length) * Math.PI * 2 - Math.PI / 2
      const r = surfaceRooms[i]
      const tx = cx + Math.cos(angle) * rx
      const ty = surfaceCY + Math.sin(angle) * ry
      nodes.push({
        name: r.name,
        label: r.label,
        x: cx, // start at center for unfold animation
        y: h / 2,
        targetX: tx,
        targetY: ty,
        vx: 0,
        vy: 0,
        hidden: false,
        connections: r.connects,
        visited: (visits.get(r.name) || 0) > 0 || r.name === 'void',
      })
    }

    // Hidden rooms below
    const hiddenCY = h * 0.78
    const hiddenRX = w * 0.28
    for (let i = 0; i < hiddenRooms.length; i++) {
      const angle = (i / hiddenRooms.length) * Math.PI * 2 - Math.PI / 2
      const r = hiddenRooms[i]
      const tx = cx + Math.cos(angle) * hiddenRX
      const ty = hiddenCY + Math.sin(angle) * (h * 0.12)
      nodes.push({
        name: r.name,
        label: r.label,
        x: cx,
        y: h / 2,
        targetX: tx,
        targetY: ty,
        vx: 0,
        vy: 0,
        hidden: true,
        connections: r.connects,
        visited: (visits.get(r.name) || 0) > 0,
      })
    }

    // Run force simulation to refine positions
    runForceSimulation(120)

    // Reset animation
    animProgress = 0
  }

  function initConnectionDots() {
    connectionDots = []
    const seen = new Set<string>()
    for (const node of nodes) {
      for (const connName of node.connections) {
        const key = [node.name, connName].sort().join('--')
        if (seen.has(key)) continue
        seen.add(key)
        // 1-2 dots per connection
        const count = 1 + (Math.random() > 0.6 ? 1 : 0)
        for (let i = 0; i < count; i++) {
          connectionDots.push({
            fromName: node.name,
            toName: connName,
            t: Math.random(), // position along line [0,1]
            speed: 0.03 + Math.random() * 0.04, // units per second
          })
        }
      }
    }
    dotsInitialized = true
  }

  function findNode(name: string): MapNode | undefined {
    return nodes.find(n => n.name === name)
  }

  // ═══════════════════════════════════════
  // COMPASS ROSE
  // ═══════════════════════════════════════

  function drawCompassRose(c: CanvasRenderingContext2D, w: number, h: number) {
    const cx = w - 60
    const cy = 70
    const outerR = 30
    const innerR = 8
    const rotation = time * 0.03 // slow rotation

    c.save()
    c.translate(cx, cy)
    c.rotate(rotation)

    const alpha = 0.04 + Math.sin(time * 0.5) * 0.01

    // Draw the four main points
    const directions = [
      { angle: -Math.PI / 2, label: 'surface', len: outerR },
      { angle: Math.PI / 2, label: 'depths', len: outerR },
      { angle: 0, label: 'memory', len: outerR * 0.85 },
      { angle: Math.PI, label: 'forgetting', len: outerR * 0.85 },
    ]

    for (const dir of directions) {
      const tipX = Math.cos(dir.angle) * dir.len
      const tipY = Math.sin(dir.angle) * dir.len

      // Diamond point
      const perpX = Math.cos(dir.angle + Math.PI / 2) * 4
      const perpY = Math.sin(dir.angle + Math.PI / 2) * 4

      c.beginPath()
      c.moveTo(tipX, tipY)
      c.lineTo(perpX, perpY)
      c.lineTo(Math.cos(dir.angle) * innerR, Math.sin(dir.angle) * innerR)
      c.lineTo(-perpX, -perpY)
      c.closePath()

      c.fillStyle = `rgba(200, 180, 140, ${alpha * 1.5})`
      c.fill()
      c.strokeStyle = `rgba(200, 180, 140, ${alpha})`
      c.lineWidth = 0.5
      c.stroke()

      // Label
      const labelDist = dir.len + 12
      const lx = Math.cos(dir.angle) * labelDist
      const ly = Math.sin(dir.angle) * labelDist

      c.save()
      c.rotate(-rotation) // counter-rotate so text stays readable
      const absLx = cx + Math.cos(dir.angle + rotation) * labelDist - cx
      const absLy = cy + Math.sin(dir.angle + rotation) * labelDist - cy
      c.font = '7px "Cormorant Garamond", serif'
      c.fillStyle = `rgba(200, 180, 140, ${alpha * 2})`
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(dir.label, lx, ly)
      c.restore()
    }

    // Center circle
    c.beginPath()
    c.arc(0, 0, 3, 0, Math.PI * 2)
    c.fillStyle = `rgba(200, 180, 140, ${alpha * 2})`
    c.fill()

    // Outer ring
    c.beginPath()
    c.arc(0, 0, outerR + 4, 0, Math.PI * 2)
    c.strokeStyle = `rgba(200, 180, 140, ${alpha * 0.5})`
    c.lineWidth = 0.3
    c.stroke()

    c.restore()
  }

  // ═══════════════════════════════════════
  // MAP LEGEND
  // ═══════════════════════════════════════

  function drawLegend(c: CanvasRenderingContext2D, w: number, h: number) {
    const lx = w - 140
    const ly = h - 100
    const lineH = 14
    const alpha = 0.06

    c.font = '11px monospace'
    c.textAlign = 'left'

    const items = [
      { color: 'rgba(255, 215, 0, 0.4)', label: 'visited room', dashed: false },
      { color: 'rgba(255, 20, 147, 0.6)', label: 'current room', dashed: false },
      { color: 'rgba(100, 80, 140, 0.2)', label: 'undiscovered', dashed: false },
    ]

    for (let i = 0; i < items.length; i++) {
      const y = ly + i * lineH
      c.fillStyle = items[i].color
      c.beginPath()
      c.arc(lx, y, 3, 0, Math.PI * 2)
      c.fill()

      c.fillStyle = `rgba(200, 190, 180, ${alpha})`
      c.fillText(items[i].label, lx + 10, y + 3)
    }

    // Line items
    const lineItems = [
      { solid: true, color: `rgba(255, 215, 0, ${0.12})`, label: 'visited path' },
      { solid: false, color: `rgba(120, 100, 140, ${0.1})`, label: 'undiscovered path' },
      { solid: true, color: `rgba(180, 50, 50, ${0.15})`, label: 'your thread' },
    ]

    for (let i = 0; i < lineItems.length; i++) {
      const y = ly + (items.length + i) * lineH
      c.strokeStyle = lineItems[i].color
      c.lineWidth = 1
      if (!lineItems[i].solid) c.setLineDash([2, 3])
      else c.setLineDash([])
      c.beginPath()
      c.moveTo(lx - 6, y)
      c.lineTo(lx + 6, y)
      c.stroke()
      c.setLineDash([])

      c.fillStyle = `rgba(200, 190, 180, ${alpha})`
      c.fillText(lineItems[i].label, lx + 10, y + 3)
    }
  }

  // ═══════════════════════════════════════
  // DETAIL PANEL
  // ═══════════════════════════════════════

  function drawDetailPanel(c: CanvasRenderingContext2D, node: MapNode, w: number, h: number) {
    const panelW = 170
    const panelH = 104
    // Position near cursor but clamped to canvas
    let px = mouseX + 18
    let py = mouseY - panelH / 2
    if (px + panelW > w - 10) px = mouseX - panelW - 18
    if (py < 10) py = 10
    if (py + panelH > h - 10) py = h - panelH - 10

    const hoverDuration = time - hoverStartTime
    const fadeIn = Math.min(1, (hoverDuration - 1.0) * 2) // start after 1s, 0.5s fade
    if (fadeIn <= 0) return

    const alpha = fadeIn * 0.6

    // Panel background
    c.fillStyle = `rgba(10, 8, 18, ${alpha * 0.9})`
    c.strokeStyle = `rgba(200, 180, 140, ${alpha * 0.15})`
    c.lineWidth = 0.5
    c.beginPath()
    c.roundRect(px, py, panelW, panelH, 3)
    c.fill()
    c.stroke()

    const textAlpha = fadeIn * 0.35
    const tx = px + 10
    let ty = py + 16

    // Room name
    c.font = '12px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(255, 215, 0, ${textAlpha})`
    c.textAlign = 'left'
    c.fillText(node.label, tx, ty)
    ty += 14

    // Times visited
    const visits = deps.getRoomVisits()
    const visitCount = visits.get(node.name) || 0
    c.font = '11px monospace'
    c.fillStyle = `rgba(200, 190, 180, ${textAlpha * 0.7})`
    c.fillText(`visited: ${visitCount} time${visitCount !== 1 ? 's' : ''}`, tx, ty)
    ty += 12

    // Uses memories?
    const usesMemory = MEMORY_ROOMS.has(node.name)
    c.fillText(`memories: ${usesMemory ? 'yes' : 'no'}`, tx, ty)
    ty += 12

    // Thread count for this room
    const threadEdges = threadTrail.getEdges()
    const roomThreads = threadEdges.filter(
      e => e.from === node.name || e.to === node.name
    )
    if (roomThreads.length > 0) {
      const totalPasses = roomThreads.reduce((s, e) => s + e.count, 0)
      c.fillStyle = `rgba(180, 60, 60, ${textAlpha * 0.6})`
      c.fillText(`threads: ${roomThreads.length} (${totalPasses} passes)`, tx, ty)
      ty += 12
    }

    // Connected rooms (truncated)
    const connLabels = node.connections
      .map(n => {
        const found = findNode(n)
        return found ? found.label.replace('the ', '') : n
      })
      .slice(0, 4)
    const connStr = connLabels.join(', ')
    c.fillStyle = `rgba(200, 190, 180, ${textAlpha * 0.5})`
    c.font = '7px monospace'
    c.fillText(`links: ${connStr}`, tx, ty)
  }

  // ═══════════════════════════════════════
  // THREAD TRAIL (Shiota-inspired)
  // ═══════════════════════════════════════

  function drawThreadTrail(c: CanvasRenderingContext2D) {
    const edges = threadTrail.getEdges()
    if (edges.length === 0) return

    // Find max traversal count for normalization
    let maxCount = 1
    for (const edge of edges) {
      if (edge.count > maxCount) maxCount = edge.count
    }

    for (const edge of edges) {
      const fromNode = findNode(edge.from)
      const toNode = findNode(edge.to)
      if (!fromNode || !toNode) continue

      const intensity = Math.min(1, edge.count / Math.max(maxCount, 5))
      const alpha = 0.04 + intensity * 0.18
      const width = 0.5 + intensity * 2.5

      // Catenary-like curve — threads sag slightly
      const midX = (fromNode.x + toNode.x) / 2
      const midY = (fromNode.y + toNode.y) / 2
      const dx = toNode.x - fromNode.x
      const dy = toNode.y - fromNode.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const sag = Math.min(dist * 0.15, 30) // sag proportional to distance

      // Perpendicular offset for the sag + slight time-based sway
      const perpX = -dy / (dist || 1)
      const perpY = dx / (dist || 1)
      const sway = Math.sin(time * 0.4 + fromNode.x * 0.01 + toNode.y * 0.01) * 3
      const cpX = midX + perpX * (sag + sway)
      const cpY = midY + perpY * (sag + sway)

      // Red thread with slight variation
      const hue = 0 + Math.sin(edge.count * 0.7) * 8 // 352-8 range (reds)
      const sat = 70 + intensity * 20

      c.beginPath()
      c.moveTo(fromNode.x, fromNode.y)
      c.quadraticCurveTo(cpX, cpY, toNode.x, toNode.y)
      c.strokeStyle = `hsla(${hue}, ${sat}%, 45%, ${alpha})`
      c.lineWidth = width
      c.stroke()

      // Faint glow for thick threads
      if (intensity > 0.3) {
        c.beginPath()
        c.moveTo(fromNode.x, fromNode.y)
        c.quadraticCurveTo(cpX, cpY, toNode.x, toNode.y)
        c.strokeStyle = `hsla(${hue}, ${sat}%, 55%, ${alpha * 0.3})`
        c.lineWidth = width + 3
        c.stroke()
      }
    }

    // Thread trail stats in legend area
    const totalEdges = threadTrail.getUniqueEdgeCount()
    const totalTraversals = threadTrail.getTotalTraversals()
    if (totalEdges > 0) {
      c.font = '11px monospace'
      c.fillStyle = 'rgba(180, 60, 60, 0.08)'
      c.textAlign = 'left'
      const w = canvas?.width || 1200
      const h = canvas?.height || 800
      c.fillText(`${totalEdges} threads woven`, 12, h - 6)
    }
  }

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    // Initialize connection dots once nodes are ready
    if (!dotsInitialized && nodes.length > 0) {
      initConnectionDots()
    }

    // Animate unfolding: nodes move from center to their target positions
    if (animProgress < 1) {
      animProgress = Math.min(1, animProgress + 0.012)
      const ease = 1 - Math.pow(1 - animProgress, 3) // cubic ease-out
      for (const node of nodes) {
        const cx = canvas.width / 2
        const cy = canvas.height / 2
        node.x = cx + (node.targetX - cx) * ease
        node.y = cy + (node.targetY - cy) * ease
      }
    } else {
      // Subtle gentle drift after settling
      for (const node of nodes) {
        const drift = 0.15
        const dx = Math.sin(time * 0.3 + node.targetX * 0.01) * drift
        const dy = Math.cos(time * 0.25 + node.targetY * 0.01) * drift
        node.x = node.targetX + dx
        node.y = node.targetY + dy
      }
    }

    // Update zoom/focus animation
    if (zoomTarget) {
      zoomProgress = Math.min(1, (time - zoomStartTime) / zoomDuration)
      const ease = 1 - Math.pow(1 - zoomProgress, 2)
      // Zoom toward target node
      const targetScale = 1.8
      zoomScale = 1 + (targetScale - 1) * ease
      zoomOriginX = zoomTarget.x
      zoomOriginY = zoomTarget.y

      // Navigate after zoom completes
      if (zoomProgress >= 1) {
        const targetName = zoomTarget.name
        zoomTarget = null
        zoomScale = 1
        zoomProgress = 0
        focusedConnections.clear()
        deps.switchTo(targetName)
      }
    }

    // Update connection dots
    for (const dot of connectionDots) {
      dot.t += dot.speed * 0.016
      if (dot.t > 1) dot.t -= 1
    }

    // Update cultural inscription
    inscriptionTimer += 0.016
    const cyclePos = inscriptionTimer % INSCRIPTION_CYCLE
    if (cyclePos < 1.5) {
      // Fade in
      inscriptionFade = Math.min(1, cyclePos / 1.5)
    } else if (cyclePos > INSCRIPTION_CYCLE - 1.5) {
      // Fade out
      inscriptionFade = Math.max(0, (INSCRIPTION_CYCLE - cyclePos) / 1.5)
    } else {
      inscriptionFade = 1
    }
    if (cyclePos < 0.016 && inscriptionTimer > 0.1) {
      inscriptionIndex = (inscriptionIndex + 1) % INSCRIPTIONS.length
    }

    const w = canvas.width
    const h = canvas.height
    const currentRoom = deps.getActiveRoom()

    // Compute highlighted path (only when not zooming)
    if (!zoomTarget && hoveredNode && hoveredNode.name !== currentRoom) {
      highlightedPath = findShortestPath(currentRoom, hoveredNode.name)
    } else if (!zoomTarget) {
      highlightedPath = []
    }

    // Build a set of highlighted edges for fast lookup
    const highlightEdges = new Set<string>()
    const highlightNodes = new Set<string>()
    for (let i = 0; i < highlightedPath.length; i++) {
      highlightNodes.add(highlightedPath[i])
      if (i < highlightedPath.length - 1) {
        const a = highlightedPath[i]
        const b = highlightedPath[i + 1]
        highlightEdges.add(`${a}--${b}`)
        highlightEdges.add(`${b}--${a}`)
      }
    }

    ctx.fillStyle = 'rgba(5, 3, 10, 1)'
    ctx.fillRect(0, 0, w, h)

    // Apply zoom transform if active
    if (zoomTarget && zoomScale > 1) {
      ctx.save()
      ctx.translate(zoomOriginX, zoomOriginY)
      ctx.scale(zoomScale, zoomScale)
      ctx.translate(-zoomOriginX, -zoomOriginY)
    }

    // Draw connections first
    for (const node of nodes) {
      for (const connName of node.connections) {
        const target = findNode(connName)
        if (!target) continue

        const bothVisited = node.visited && target.visited
        const anyHidden = node.hidden || target.hidden
        const edgeKey = `${node.name}--${connName}`
        const isHighlighted = highlightEdges.has(edgeKey)
        const isFocused = focusedConnections.has(node.name) && focusedConnections.has(connName)

        // Pulse on the connection
        const pulse = Math.sin(time * 1.5 + node.x * 0.01) * 0.02

        if (isFocused && zoomTarget) {
          // Glowing lines for focused connections during zoom
          const glowPulse = Math.sin(time * 6) * 0.15 + 0.85
          ctx.strokeStyle = `rgba(255, 200, 100, ${0.5 * glowPulse})`
          ctx.setLineDash([])
          ctx.lineWidth = 3
        } else if (isHighlighted) {
          // Gold glowing path
          const glowPulse = Math.sin(time * 4) * 0.1 + 0.9
          ctx.strokeStyle = `rgba(255, 215, 0, ${0.35 * glowPulse})`
          ctx.setLineDash([])
          ctx.lineWidth = 2.5
        } else if (anyHidden && !(node.visited && target.visited)) {
          // Hidden connection — barely visible
          ctx.strokeStyle = `rgba(80, 60, 100, ${0.03 + pulse})`
          ctx.setLineDash([3, 6])
          ctx.lineWidth = 1
        } else if (bothVisited) {
          // Warmer gold for visited connections
          ctx.strokeStyle = `rgba(255, 215, 0, ${0.1 + pulse})`
          ctx.setLineDash([])
          ctx.lineWidth = 1.5
        } else {
          // Cooler purple for unvisited
          ctx.strokeStyle = `rgba(120, 100, 140, ${0.06 + pulse})`
          ctx.setLineDash([2, 4])
          ctx.lineWidth = 1
        }

        ctx.beginPath()
        ctx.moveTo(node.x, node.y)
        ctx.lineTo(target.x, target.y)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // Draw flowing dots on connections
    for (const dot of connectionDots) {
      const fromNode = findNode(dot.fromName)
      const toNode = findNode(dot.toName)
      if (!fromNode || !toNode) continue

      const px = fromNode.x + (toNode.x - fromNode.x) * dot.t
      const py = fromNode.y + (toNode.y - fromNode.y) * dot.t
      const bothVisited = fromNode.visited && toNode.visited
      // Warmer dots for visited paths, cooler for unvisited
      const dotAlpha = bothVisited ? 0.08 : 0.04
      const dotColor = bothVisited
        ? `rgba(255, 215, 100, ${dotAlpha})`
        : `rgba(150, 130, 180, ${dotAlpha})`

      ctx.beginPath()
      ctx.arc(px, py, 1.5, 0, Math.PI * 2)
      ctx.fillStyle = dotColor
      ctx.fill()
    }

    // Draw thread trail (Shiota-inspired red threads)
    drawThreadTrail(ctx)

    // Draw nodes
    for (const node of nodes) {
      const isActive = node.name === currentRoom
      const isHovered = node === hoveredNode
      const isOnPath = highlightNodes.has(node.name) && !isActive && !isHovered
      const isFocusNode = focusedConnections.has(node.name) && zoomTarget !== null
      const breathe = Math.sin(time * 0.8 + node.x * 0.01 + node.y * 0.01) * 0.5 + 0.5

      // Node size and appearance
      let radius = 5
      let alpha = 0.15

      if (node.visited) {
        radius = 7
        alpha = 0.3
      }
      if (isActive) {
        radius = 9
        alpha = 0.6
      }
      if (node.hidden && !node.visited) {
        radius = 4
        alpha = 0.04
      }
      if (isHovered) {
        radius += 3
        alpha += 0.2
      }
      if (isOnPath) {
        // Pulse nodes along the path
        const pathPulse = Math.sin(time * 5) * 0.15 + 0.85
        radius += 2
        alpha = Math.min(1, alpha + 0.15 * pathPulse)
      }
      if (isFocusNode) {
        radius += 2
        alpha = Math.min(1, alpha + 0.3)
      }

      // Node glow
      const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 3)
      if (isActive) {
        glow.addColorStop(0, `rgba(255, 20, 147, ${alpha * 0.4 * (0.8 + breathe * 0.2)})`)
      } else if (isFocusNode) {
        glow.addColorStop(0, `rgba(255, 200, 100, ${alpha * 0.5})`)
      } else if (isOnPath) {
        glow.addColorStop(0, `rgba(255, 215, 0, ${alpha * 0.5})`)
      } else if (node.hidden) {
        glow.addColorStop(0, `rgba(100, 80, 140, ${alpha * 0.3})`)
      } else {
        glow.addColorStop(0, `rgba(255, 215, 0, ${alpha * 0.3 * (0.8 + breathe * 0.2)})`)
      }
      glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(node.x, node.y, radius * 3, 0, Math.PI * 2)
      ctx.fill()

      // Node core
      if (isActive) {
        ctx.fillStyle = `rgba(255, 20, 147, ${alpha})`
      } else if (isFocusNode) {
        ctx.fillStyle = `rgba(255, 200, 100, ${alpha})`
      } else if (isOnPath) {
        ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`
      } else if (node.hidden && !node.visited) {
        ctx.fillStyle = `rgba(100, 80, 140, ${alpha})`
      } else {
        ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`
      }
      ctx.beginPath()
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)
      ctx.fill()

      // Label
      ctx.font = `${isHovered ? '12' : '11'}px "Cormorant Garamond", serif`
      ctx.textAlign = 'center'

      if (node.hidden && !node.visited) {
        ctx.fillStyle = `rgba(100, 80, 140, ${0.04 + breathe * 0.01})`
        ctx.fillText('?', node.x, node.y + radius + 16)
      } else {
        const labelAlpha = isHovered ? 0.5 : isActive ? 0.35 : isFocusNode ? 0.4 : isOnPath ? 0.3 : node.visited ? 0.15 : 0.08
        ctx.fillStyle = `rgba(200, 190, 180, ${labelAlpha})`
        ctx.fillText(node.label, node.x, node.y + radius + 16)
      }
    }

    // Restore zoom transform
    if (zoomTarget && zoomScale > 1) {
      ctx.restore()
    }

    // Path hop count near hovered node
    if (hoveredNode && highlightedPath.length > 1 && !zoomTarget) {
      const hops = highlightedPath.length - 1
      ctx.font = '11px monospace'
      ctx.fillStyle = 'rgba(255, 215, 0, 0.25)'
      ctx.textAlign = 'left'
      ctx.fillText(`${hops} hop${hops !== 1 ? 's' : ''}`, hoveredNode.x + 14, hoveredNode.y - 8)
    }

    // Hover tooltip — room label, visit status, poetic description
    if (hoveredNode && !zoomTarget) {
      const visits = deps.getRoomVisits()
      const visitCount = visits.get(hoveredNode.name) || 0
      const visitLabel = visitCount > 0 ? `visited ${visitCount}x` : 'unexplored'
      const poem = ROOM_POEMS[hoveredNode.name] || ''

      const ttX = hoveredNode.x
      const ttY = hoveredNode.y - 22

      // Tooltip background
      ctx.font = '11px "Cormorant Garamond", serif'
      const labelWidth = ctx.measureText(hoveredNode.label).width
      const visitWidth = ctx.measureText(visitLabel).width
      const poemWidth = poem ? ctx.measureText(poem).width : 0
      const bgWidth = Math.max(labelWidth, visitWidth, poemWidth) + 16
      const bgHeight = poem ? 46 : 32
      const bgX = ttX - bgWidth / 2
      const bgY = ttY - bgHeight + 4

      ctx.fillStyle = 'rgba(10, 8, 18, 0.85)'
      ctx.strokeStyle = 'rgba(200, 180, 140, 0.1)'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.roundRect(bgX, bgY, bgWidth, bgHeight, 3)
      ctx.fill()
      ctx.stroke()

      // Room label
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(255, 215, 0, 0.5)'
      ctx.fillText(hoveredNode.label, ttX, ttY - (poem ? 20 : 8))

      // Visit status
      ctx.font = '9px monospace'
      ctx.fillStyle = visitCount > 0 ? 'rgba(200, 190, 180, 0.3)' : 'rgba(120, 100, 140, 0.3)'
      ctx.fillText(visitLabel, ttX, ttY - (poem ? 8 : -2))

      // Poetic description
      if (poem) {
        ctx.font = '10px "Cormorant Garamond", serif'
        ctx.fillStyle = 'rgba(200, 180, 140, 0.2)'
        ctx.fillText(poem, ttX, ttY + 4)
      }
    }

    // Section labels
    ctx.font = '12px monospace'
    ctx.fillStyle = 'rgba(120, 100, 140, 0.06)'
    ctx.textAlign = 'center'
    ctx.fillText('\u2014 surface rooms \u2014', w / 2, 50)
    ctx.fillText('\u2014 hidden rooms \u2014', w / 2, h * 0.58)

    // Title
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 190, 180, ${0.08 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the cartographer', w / 2, 25)

    // Cultural inscription (cycling at low alpha)
    const insAlpha = inscriptionFade * 0.06
    if (insAlpha > 0.002) {
      ctx.font = '13px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(200, 180, 140, ${insAlpha})`
      ctx.textAlign = 'center'
      ctx.fillText(INSCRIPTIONS[inscriptionIndex], w / 2, 42)
    }

    // Stats
    const statsVisits = deps.getRoomVisits()
    const visitedCount = [...statsVisits.values()].filter(v => v > 0).length
    const totalRooms = ROOM_GRAPH.length
    const hiddenFound = ROOM_GRAPH.filter(r => r.hidden && (statsVisits.get(r.name) || 0) > 0).length
    const hiddenTotal = ROOM_GRAPH.filter(r => r.hidden).length

    ctx.font = '12px monospace'
    ctx.fillStyle = 'rgba(200, 190, 180, 0.06)'
    ctx.textAlign = 'left'
    ctx.fillText(`${visitedCount}/${totalRooms} rooms visited`, 12, h - 30)
    ctx.fillText(`${hiddenFound}/${hiddenTotal} secrets found`, 12, h - 18)

    // Hint
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(200, 190, 180, 0.04)'
    ctx.textAlign = 'center'
    ctx.fillText('click a room to go there', w / 2, h - 8)

    // Compass rose
    drawCompassRose(ctx, w, h)

    // Legend
    drawLegend(ctx, w, h)

    // Detail panel (if hovering for >1 second)
    if (hoveredNode && showDetailPanel && !zoomTarget) {
      drawDetailPanel(ctx, hoveredNode, w, h)
    }
  }

  function handleClick(_e: MouseEvent) {
    if (!hoveredNode || zoomTarget) return
    // Navigate to the clicked room (only if visited or not hidden)
    if (!hoveredNode.hidden || hoveredNode.visited) {
      playClickChime(hoveredNode)
      // Start zoom/focus animation
      zoomTarget = hoveredNode
      zoomStartTime = time
      zoomProgress = 0
      // Build focused connections set — the target and its neighbors
      focusedConnections.clear()
      focusedConnections.add(hoveredNode.name)
      for (const conn of hoveredNode.connections) {
        focusedConnections.add(conn)
      }
    }
  }

  function handleMove(e: MouseEvent) {
    mouseX = e.clientX
    mouseY = e.clientY

    // Don't update hover during zoom
    if (zoomTarget) return

    const prevHovered = hoveredNode
    hoveredNode = null

    // Inverse-transform mouse coordinates if zoomed
    let mx = e.clientX
    let my = e.clientY
    if (zoomScale > 1) {
      mx = zoomOriginX + (e.clientX - zoomOriginX) / zoomScale
      my = zoomOriginY + (e.clientY - zoomOriginY) / zoomScale
    }

    for (const node of nodes) {
      const dx = mx - node.x
      const dy = my - node.y
      if (dx * dx + dy * dy < 625) { // 25px radius
        if (!node.hidden || node.visited) {
          hoveredNode = node
        }
        break
      }
    }

    // Track hover timing for detail panel
    if (hoveredNode !== prevHovered) {
      if (hoveredNode) {
        hoverStartTime = time
        showDetailPanel = false
        playHoverTone(hoveredNode)
      } else {
        showDetailPanel = false
        stopHoverTone()
      }
      prevHoveredNode = prevHovered
    }

    // Check if we've been hovering long enough for detail panel
    if (hoveredNode && time - hoverStartTime > 1.0) {
      showDetailPanel = true
    }

    if (canvas) {
      canvas.style.cursor = hoveredNode ? 'pointer' : 'default'
    }

  }

  return {
    name: 'cartographer',
    label: 'the cartographer',

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

      canvas.addEventListener('click', handleClick)
      canvas.addEventListener('mousemove', handleMove)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
          initNodes()
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)
      return overlay
    },

    activate() {
      active = true
      zoomTarget = null
      zoomScale = 1
      zoomProgress = 0
      focusedConnections.clear()
      dotsInitialized = false
      inscriptionTimer = 0
      inscriptionIndex = 0
      initNodes()
      initAudio()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      cleanupAudio()
      zoomTarget = null
      zoomScale = 1
      focusedConnections.clear()
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      cleanupAudio()
      zoomTarget = null
      zoomScale = 1
      focusedConnections.clear()
      overlay?.remove()
    },
  }
}
