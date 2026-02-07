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

interface MapNode {
  name: string
  label: string
  x: number
  y: number
  hidden: boolean
  connections: string[]
  visited: boolean
}

interface MapDeps {
  switchTo: (name: string) => void
  getActiveRoom: () => string
  getRoomVisits: () => Map<string, number>
}

// Define the room topology
const ROOM_GRAPH: { name: string; label: string; hidden: boolean; connects: string[] }[] = [
  // Surface rooms (tab bar)
  { name: 'void', label: 'the void', hidden: false, connects: [] },
  { name: 'study', label: 'the study', hidden: false, connects: ['void'] },
  { name: 'instrument', label: 'the instrument', hidden: false, connects: ['void'] },
  { name: 'observatory', label: 'the observatory', hidden: false, connects: ['void'] },
  { name: 'seance', label: 'the séance', hidden: false, connects: ['void', 'between'] },
  { name: 'darkroom', label: 'the darkroom', hidden: false, connects: ['void'] },
  { name: 'garden', label: 'the garden', hidden: false, connects: ['void', 'roots'] },
  { name: 'archive', label: 'the archive', hidden: false, connects: ['void', 'catacombs'] },
  { name: 'loom', label: 'the loom', hidden: false, connects: ['void'] },
  { name: 'tidepool', label: 'the tide pool', hidden: false, connects: ['void'] },
  { name: 'furnace', label: 'the furnace', hidden: false, connects: ['void'] },
  { name: 'radio', label: 'the radio', hidden: false, connects: ['void'] },
  { name: 'well', label: 'the well', hidden: false, connects: ['void', 'aquifer'] },
  { name: 'clocktower', label: 'the clock tower', hidden: false, connects: ['void', 'midnight'] },
  { name: 'automaton', label: 'the automaton', hidden: false, connects: ['void'] },
  { name: 'seismograph', label: 'the seismograph', hidden: false, connects: ['void'] },
  { name: 'pendulum', label: 'the pendulum', hidden: false, connects: ['void'] },
  { name: 'cipher', label: 'the cipher', hidden: false, connects: ['void'] },
  { name: 'terrarium', label: 'the terrarium', hidden: false, connects: ['void', 'garden'] },
  { name: 'lighthouse', label: 'the lighthouse', hidden: false, connects: ['void', 'tidepool'] },
  { name: 'sketchpad', label: 'the sketchpad', hidden: false, connects: ['void'] },
  { name: 'weathervane', label: 'the weathervane', hidden: false, connects: ['void'] },
  { name: 'cartographer', label: 'the cartographer', hidden: false, connects: ['void'] },
  { name: 'choir', label: 'the choir', hidden: false, connects: ['void'] },
  { name: 'oracle', label: 'the oracle deck', hidden: false, connects: ['void'] },
  { name: 'labyrinth', label: 'the labyrinth', hidden: false, connects: ['void'] },
  { name: 'glacarium', label: 'the glacarium', hidden: false, connects: ['void'] },
  { name: 'satellite', label: 'the satellite', hidden: false, connects: ['void'] },
  { name: 'asteroids', label: 'the asteroid field', hidden: false, connects: ['void'] },
  { name: 'disintegration', label: 'the disintegration loops', hidden: false, connects: ['void'] },
  { name: 'projection', label: 'the projection room', hidden: false, connects: ['void'] },
  { name: 'datepaintings', label: 'the date paintings', hidden: false, connects: ['void'] },
  { name: 'madeleine', label: 'the madeleine', hidden: false, connects: ['void'] },
  { name: 'library', label: 'the library', hidden: false, connects: ['void'] },
  { name: 'palimpsestgallery', label: 'the palimpsest gallery', hidden: false, connects: ['void'] },
  // Hidden rooms
  { name: 'catacombs', label: 'the catacombs', hidden: true, connects: ['archive', 'ossuary'] },
  { name: 'roots', label: 'the roots', hidden: true, connects: ['garden', 'ossuary'] },
  { name: 'ossuary', label: 'the ossuary', hidden: true, connects: ['roots', 'catacombs'] },
  { name: 'between', label: 'the between', hidden: true, connects: ['seance'] },
  { name: 'aquifer', label: 'the aquifer', hidden: true, connects: ['well', 'tidepool'] },
  { name: 'midnight', label: 'the midnight', hidden: true, connects: ['clocktower'] },
  { name: 'mirror', label: 'the mirror', hidden: true, connects: [] },
]

export function createCartographerRoom(deps: MapDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let nodes: MapNode[] = []
  let hoveredNode: MapNode | null = null

  function initNodes() {
    if (!canvas) return
    const w = canvas.width
    const h = canvas.height
    const visits = deps.getRoomVisits()

    // Arrange nodes in a force-directed-like layout
    // Surface rooms in a circle, hidden rooms below
    const surfaceRooms = ROOM_GRAPH.filter(r => !r.hidden)
    const hiddenRooms = ROOM_GRAPH.filter(r => r.hidden)

    nodes = []

    // Surface rooms in an ellipse
    const cx = w / 2
    const surfaceCY = h * 0.35
    const rx = w * 0.35
    const ry = h * 0.2

    for (let i = 0; i < surfaceRooms.length; i++) {
      const angle = (i / surfaceRooms.length) * Math.PI * 2 - Math.PI / 2
      const r = surfaceRooms[i]
      nodes.push({
        name: r.name,
        label: r.label,
        x: cx + Math.cos(angle) * rx,
        y: surfaceCY + Math.sin(angle) * ry,
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
      nodes.push({
        name: r.name,
        label: r.label,
        x: cx + Math.cos(angle) * hiddenRX,
        y: hiddenCY + Math.sin(angle) * (h * 0.1),
        hidden: true,
        connections: r.connects,
        visited: (visits.get(r.name) || 0) > 0,
      })
    }
  }

  function findNode(name: string): MapNode | undefined {
    return nodes.find(n => n.name === name)
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height
    const currentRoom = deps.getActiveRoom()

    ctx.fillStyle = 'rgba(5, 3, 10, 1)'
    ctx.fillRect(0, 0, w, h)

    // Draw connections first
    for (const node of nodes) {
      for (const connName of node.connections) {
        const target = findNode(connName)
        if (!target) continue

        const bothVisited = node.visited && target.visited
        const anyHidden = node.hidden || target.hidden

        // Pulse on the connection
        const pulse = Math.sin(time * 1.5 + node.x * 0.01) * 0.02

        if (anyHidden && !(node.visited && target.visited)) {
          // Hidden connection — barely visible
          ctx.strokeStyle = `rgba(80, 60, 100, ${0.03 + pulse})`
          ctx.setLineDash([3, 6])
        } else if (bothVisited) {
          ctx.strokeStyle = `rgba(255, 215, 0, ${0.08 + pulse})`
          ctx.setLineDash([])
        } else {
          ctx.strokeStyle = `rgba(120, 100, 140, ${0.05 + pulse})`
          ctx.setLineDash([2, 4])
        }

        ctx.lineWidth = 1
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

      // Node glow
      const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 3)
      if (isActive) {
        glow.addColorStop(0, `rgba(255, 20, 147, ${alpha * 0.4 * (0.8 + breathe * 0.2)})`)
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
        const labelAlpha = isHovered ? 0.4 : isActive ? 0.3 : node.visited ? 0.12 : 0.06
        ctx.fillStyle = `rgba(200, 190, 180, ${labelAlpha})`
        ctx.fillText(node.label, node.x, node.y + radius + 14)
      }
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
  }

  function handleClick(e: MouseEvent) {
    if (!hoveredNode) return
    // Navigate to the clicked room (only if visited or not hidden)
    if (!hoveredNode.hidden || hoveredNode.visited) {
      deps.switchTo(hoveredNode.name)
    }
  }

  function handleMove(e: MouseEvent) {
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
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      overlay?.remove()
    },
  }
}
