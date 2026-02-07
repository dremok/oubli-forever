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

  // Audio state
  let audioInitialized = false
  let audioMaster: GainNode | null = null
  let ambientOsc: OscillatorNode | null = null
  let ambientGain: GainNode | null = null
  let hoverOsc: OscillatorNode | null = null
  let hoverGain: GainNode | null = null
  let ac: AudioContext | null = null

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

  function cleanupAudio() {
    if (ambientGain && ac) {
      ambientGain.gain.setTargetAtTime(0, ac.currentTime, 0.3)
    }
    if (hoverGain && ac) {
      hoverGain.gain.setTargetAtTime(0, ac.currentTime, 0.1)
    }
    // Delayed cleanup to allow fade-out
    setTimeout(() => {
      try {
        ambientOsc?.stop()
        hoverOsc?.stop()
      } catch (_) { /* already stopped */ }
      ambientOsc = null
      ambientGain = null
      hoverOsc = null
      hoverGain = null
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
    const repulseStrength = 2000
    const attractStrength = 0.005
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
    const margin = 60
    const w = canvas?.width || 1200
    const h = canvas?.height || 800
    for (const node of nodes) {
      node.targetX = Math.max(margin, Math.min(w - margin, node.targetX))
      node.targetY = Math.max(margin + 30, Math.min(h - margin - 50, node.targetY))
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

    // Start with elliptical layout as seed positions
    const cx = w / 2
    const surfaceCY = h * 0.35
    const rx = w * 0.35
    const ry = h * 0.2

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
    const hiddenCY = h * 0.72
    const hiddenRX = w * 0.2
    for (let i = 0; i < hiddenRooms.length; i++) {
      const angle = (i / hiddenRooms.length) * Math.PI * 2 - Math.PI / 2
      const r = hiddenRooms[i]
      const tx = cx + Math.cos(angle) * hiddenRX
      const ty = hiddenCY + Math.sin(angle) * (h * 0.1)
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

    c.font = '8px monospace'
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
    const panelH = 90
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
    c.font = '10px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(255, 215, 0, ${textAlpha})`
    c.textAlign = 'left'
    c.fillText(node.label, tx, ty)
    ty += 14

    // Times visited
    const visits = deps.getRoomVisits()
    const visitCount = visits.get(node.name) || 0
    c.font = '8px monospace'
    c.fillStyle = `rgba(200, 190, 180, ${textAlpha * 0.7})`
    c.fillText(`visited: ${visitCount} time${visitCount !== 1 ? 's' : ''}`, tx, ty)
    ty += 12

    // Uses memories?
    const usesMemory = MEMORY_ROOMS.has(node.name)
    c.fillText(`memories: ${usesMemory ? 'yes' : 'no'}`, tx, ty)
    ty += 12

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
  // RENDER
  // ═══════════════════════════════════════

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

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

    const w = canvas.width
    const h = canvas.height
    const currentRoom = deps.getActiveRoom()

    // Compute highlighted path
    if (hoveredNode && hoveredNode.name !== currentRoom) {
      highlightedPath = findShortestPath(currentRoom, hoveredNode.name)
    } else {
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

    // Draw connections first
    for (const node of nodes) {
      for (const connName of node.connections) {
        const target = findNode(connName)
        if (!target) continue

        const bothVisited = node.visited && target.visited
        const anyHidden = node.hidden || target.hidden
        const edgeKey = `${node.name}--${connName}`
        const isHighlighted = highlightEdges.has(edgeKey)

        // Pulse on the connection
        const pulse = Math.sin(time * 1.5 + node.x * 0.01) * 0.02

        if (isHighlighted) {
          // Gold glowing path
          const glowPulse = Math.sin(time * 4) * 0.1 + 0.9
          ctx.strokeStyle = `rgba(255, 215, 0, ${0.35 * glowPulse})`
          ctx.setLineDash([])
          ctx.lineWidth = 2
        } else if (anyHidden && !(node.visited && target.visited)) {
          // Hidden connection — barely visible
          ctx.strokeStyle = `rgba(80, 60, 100, ${0.03 + pulse})`
          ctx.setLineDash([3, 6])
          ctx.lineWidth = 1
        } else if (bothVisited) {
          ctx.strokeStyle = `rgba(255, 215, 0, ${0.08 + pulse})`
          ctx.setLineDash([])
          ctx.lineWidth = 1
        } else {
          ctx.strokeStyle = `rgba(120, 100, 140, ${0.05 + pulse})`
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

    // Draw nodes
    for (const node of nodes) {
      const isActive = node.name === currentRoom
      const isHovered = node === hoveredNode
      const isOnPath = highlightNodes.has(node.name) && !isActive && !isHovered
      const breathe = Math.sin(time * 0.8 + node.x * 0.01 + node.y * 0.01) * 0.5 + 0.5

      // Node size and appearance
      let radius = 4
      let alpha = 0.15

      if (node.visited) {
        radius = 5
        alpha = 0.3
      }
      if (isActive) {
        radius = 7
        alpha = 0.6
      }
      if (node.hidden && !node.visited) {
        radius = 3
        alpha = 0.04
      }
      if (isHovered) {
        radius += 2
        alpha += 0.2
      }
      if (isOnPath) {
        // Pulse nodes along the path
        const pathPulse = Math.sin(time * 5) * 0.15 + 0.85
        radius += 1.5
        alpha = Math.min(1, alpha + 0.15 * pathPulse)
      }

      // Node glow
      const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 3)
      if (isActive) {
        glow.addColorStop(0, `rgba(255, 20, 147, ${alpha * 0.4 * (0.8 + breathe * 0.2)})`)
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
      ctx.font = '9px "Cormorant Garamond", serif'
      ctx.textAlign = 'center'

      if (node.hidden && !node.visited) {
        ctx.fillStyle = `rgba(100, 80, 140, ${0.04 + breathe * 0.01})`
        ctx.fillText('?', node.x, node.y + radius + 14)
      } else {
        const labelAlpha = isHovered ? 0.4 : isActive ? 0.3 : isOnPath ? 0.25 : node.visited ? 0.12 : 0.06
        ctx.fillStyle = `rgba(200, 190, 180, ${labelAlpha})`
        ctx.fillText(node.label, node.x, node.y + radius + 14)
      }
    }

    // Path hop count near hovered node
    if (hoveredNode && highlightedPath.length > 1) {
      const hops = highlightedPath.length - 1
      ctx.font = '8px monospace'
      ctx.fillStyle = 'rgba(255, 215, 0, 0.25)'
      ctx.textAlign = 'left'
      ctx.fillText(`${hops} hop${hops !== 1 ? 's' : ''}`, hoveredNode.x + 14, hoveredNode.y - 8)
    }

    // Section labels
    ctx.font = '9px monospace'
    ctx.fillStyle = 'rgba(120, 100, 140, 0.06)'
    ctx.textAlign = 'center'
    ctx.fillText('— surface rooms —', w / 2, 50)
    ctx.fillText('— hidden rooms —', w / 2, h * 0.58)

    // Title
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 190, 180, ${0.08 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the cartographer', w / 2, 25)

    // Stats
    const visits = deps.getRoomVisits()
    const visitedCount = [...visits.values()].filter(v => v > 0).length
    const totalRooms = ROOM_GRAPH.length
    const hiddenFound = ROOM_GRAPH.filter(r => r.hidden && (visits.get(r.name) || 0) > 0).length
    const hiddenTotal = ROOM_GRAPH.filter(r => r.hidden).length

    ctx.font = '9px monospace'
    ctx.fillStyle = 'rgba(200, 190, 180, 0.06)'
    ctx.textAlign = 'left'
    ctx.fillText(`${visitedCount}/${totalRooms} rooms visited`, 12, h - 30)
    ctx.fillText(`${hiddenFound}/${hiddenTotal} secrets found`, 12, h - 18)

    // Hint
    ctx.font = '9px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(200, 190, 180, 0.04)'
    ctx.textAlign = 'center'
    ctx.fillText('click a room to go there', w / 2, h - 8)

    // Compass rose
    drawCompassRose(ctx, w, h)

    // Legend
    drawLegend(ctx, w, h)

    // Detail panel (if hovering for >1 second)
    if (hoveredNode && showDetailPanel) {
      drawDetailPanel(ctx, hoveredNode, w, h)
    }
  }

  function handleClick(e: MouseEvent) {
    if (!hoveredNode) return
    // Navigate to the clicked room (only if visited or not hidden)
    if (!hoveredNode.hidden || hoveredNode.visited) {
      playWhoosh()
      deps.switchTo(hoveredNode.name)
    }
  }

  function handleMove(e: MouseEvent) {
    mouseX = e.clientX
    mouseY = e.clientY

    const prevHovered = hoveredNode
    hoveredNode = null
    for (const node of nodes) {
      const dx = e.clientX - node.x
      const dy = e.clientY - node.y
      if (dx * dx + dy * dy < 400) { // 20px radius
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
      initNodes()
      initAudio()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      cleanupAudio()
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      cleanupAudio()
      overlay?.remove()
    },
  }
}
