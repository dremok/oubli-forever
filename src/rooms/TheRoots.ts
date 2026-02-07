/**
 * THE ROOTS — beneath the garden, the decomposition layer
 *
 * A hidden room accessible only from The Garden (click the ground).
 * Below the garden's surface, root systems of memory-plants tangle
 * and interweave. Deeper still, fully degraded memories decompose
 * into nutrients — dark compost feeding new growth above.
 *
 * The visual is an inverted garden: plants grow downward, roots
 * spread like neural dendrites. The color palette is earth tones —
 * deep browns, dark reds, the occasional bioluminescent glow from
 * mycorrhizal networks (fungi connecting plant roots).
 *
 * At the very bottom, text fragments from the most degraded memories
 * dissolve into particles that drift upward — the cycle of decay
 * and renewal made visible.
 *
 * Inspired by: Mycorrhizal networks ("wood wide web"), composting,
 * the soil food web, root systems as neural networks, decomposition
 * as transformation, the underworld in mythology
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'

interface RootsDeps {
  getMemories: () => StoredMemory[]
  onAscend: () => void
  onDeeper?: () => void
  switchTo?: (name: string) => void
}

interface RootNode {
  x: number
  y: number
  angle: number
  depth: number
  memory: StoredMemory
  children: RootNode[]
}

interface Particle {
  x: number
  y: number
  vy: number
  alpha: number
  size: number
  hue: number
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function seeded(seed: number): () => number {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xFFFFFFFF; return (s >>> 0) / 0xFFFFFFFF }
}

function buildRootSystem(mem: StoredMemory, startX: number, startY: number): RootNode {
  const hash = hashCode(mem.originalText)
  const rng = seeded(hash)
  const health = 1 - mem.degradation

  const root: RootNode = {
    x: startX, y: startY,
    angle: Math.PI / 2 + (rng() - 0.5) * 0.4, // roughly downward
    depth: 0,
    memory: mem,
    children: [],
  }

  function grow(node: RootNode, length: number, thickness: number) {
    if (node.depth > 5 || length < 6) return

    const numBranches = 1 + Math.floor(rng() * 2)
    for (let b = 0; b < numBranches; b++) {
      const childAngle = node.angle + (rng() - 0.5) * 1.2
      const childLen = length * (0.6 + rng() * 0.3)
      const child: RootNode = {
        x: node.x + Math.cos(childAngle) * childLen,
        y: node.y + Math.sin(childAngle) * childLen,
        angle: childAngle,
        depth: node.depth + 1,
        memory: mem,
        children: [],
      }
      node.children.push(child)

      // Only continue growing if memory is healthy enough
      if (health > 0.2 || node.depth < 2) {
        grow(child, childLen * 0.8, thickness * 0.7)
      }
    }
  }

  const baseLen = 30 + (mem.originalText.length % 40) + rng() * 20
  grow(root, baseLen, 3)

  return root
}

export function createRootsRoom(deps: RootsDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let particles: Particle[] = []
  let mouseX = 0
  let mouseY = 0
  let clickRipples: { x: number; y: number; radius: number; alpha: number }[] = []
  let hoveredNav = -1

  // Navigation portals — root-like tendrils leading to connected rooms
  const navPoints = [
    { label: '⌁ the garden', room: 'garden', xFrac: 0.5, yFrac: 0.04 },
    { label: '⌁ the ossuary', room: 'ossuary', xFrac: 0.92, yFrac: 0.96 },
  ]

  function drawRoot(node: RootNode, parentX: number, parentY: number) {
    if (!ctx) return
    const health = 1 - node.memory.degradation
    const h = 20 + node.memory.hue * 40 // earth tones: 20-60
    const s = 20 + health * 30
    const l = 15 + health * 15
    const a = 0.2 + health * 0.4
    const thickness = Math.max(0.5, 3 - node.depth * 0.5)

    // Draw segment from parent to this node
    ctx.beginPath()
    ctx.moveTo(parentX, parentY)

    // Slight curve
    const midX = (parentX + node.x) / 2 + Math.sin(time * 0.5 + node.depth) * 2
    const midY = (parentY + node.y) / 2
    ctx.quadraticCurveTo(midX, midY, node.x, node.y)

    ctx.strokeStyle = `hsla(${h}, ${s}%, ${l}%, ${a})`
    ctx.lineWidth = thickness
    ctx.lineCap = 'round'
    ctx.stroke()

    // Root tip glow for deep roots
    if (node.children.length === 0 && node.depth > 2) {
      ctx.beginPath()
      ctx.arc(node.x, node.y, 2, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${h}, ${s + 20}%, ${l + 20}%, ${a * 0.5})`
      ctx.fill()
    }

    // Mycorrhizal glow — bioluminescent nodes at connections
    if (node.depth === 2 && health > 0.4) {
      const glowSize = 4 + Math.sin(time * 0.8 + node.x * 0.1) * 2
      ctx.beginPath()
      ctx.arc(node.x, node.y, glowSize, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(120, 60%, 40%, ${0.05 + Math.sin(time + node.y * 0.05) * 0.03})`
      ctx.fill()
    }

    // Recurse
    for (const child of node.children) {
      drawRoot(child, node.x, node.y)
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height
    const memories = deps.getMemories()

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Background — dark earth gradient
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, 'rgba(15, 10, 5, 1)')
    bg.addColorStop(0.3, 'rgba(20, 12, 6, 1)')
    bg.addColorStop(0.7, 'rgba(12, 8, 4, 1)')
    bg.addColorStop(1, 'rgba(5, 3, 2, 1)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // Surface line at top
    ctx.strokeStyle = 'rgba(80, 60, 30, 0.15)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 8])
    ctx.beginPath()
    ctx.moveTo(0, 40)
    ctx.lineTo(w, 40)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.font = '9px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(120, 90, 50, 0.15)'
    ctx.textAlign = 'left'
    ctx.fillText('surface', 12, 35)

    // Soil layers
    const layers = [
      { y: h * 0.25, label: 'topsoil', alpha: 0.05 },
      { y: h * 0.5, label: 'subsoil', alpha: 0.03 },
      { y: h * 0.75, label: 'decomposition layer', alpha: 0.02 },
    ]
    for (const layer of layers) {
      ctx.strokeStyle = `rgba(80, 60, 30, ${layer.alpha})`
      ctx.setLineDash([2, 12])
      ctx.beginPath()
      ctx.moveTo(0, layer.y)
      ctx.lineTo(w, layer.y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.font = '8px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(120, 90, 50, ${layer.alpha * 2})`
      ctx.fillText(layer.label, 12, layer.y - 4)
    }

    if (memories.length === 0) {
      ctx.font = '14px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(120, 90, 50, 0.2)'
      ctx.textAlign = 'center'
      ctx.fillText('no roots. no memories planted above.', w / 2, h / 2)
      return
    }

    // Build and draw root systems
    const spacing = Math.min(80, (w - 100) / memories.length)
    const startX = (w - (memories.length - 1) * spacing) / 2

    for (let i = 0; i < Math.min(memories.length, 30); i++) {
      const mem = memories[i]
      const x = startX + i * spacing
      const rootSystem = buildRootSystem(mem, x, 40)
      drawRoot(rootSystem, x, 40)
    }

    // Decomposition particles — drift upward from degraded memories
    const degraded = memories.filter(m => m.degradation > 0.5)
    if (degraded.length > 0 && Math.random() < 0.1) {
      const mem = degraded[Math.floor(Math.random() * degraded.length)]
      particles.push({
        x: Math.random() * w,
        y: h * 0.7 + Math.random() * h * 0.3,
        vy: -0.3 - Math.random() * 0.5,
        alpha: 0.2 + Math.random() * 0.3,
        size: 1 + Math.random() * 2,
        hue: mem.hue * 360,
      })
    }

    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.y += p.vy
      p.alpha -= 0.002
      p.x += Math.sin(time + p.y * 0.02) * 0.3

      if (p.alpha <= 0 || p.y < 0) {
        particles.splice(i, 1)
        continue
      }

      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${p.hue}, 30%, 40%, ${p.alpha})`
      ctx.fill()
    }

    // Keep particles manageable
    if (particles.length > 100) particles.splice(0, 20)

    // Click ripples — underground tremors
    for (let i = clickRipples.length - 1; i >= 0; i--) {
      const r = clickRipples[i]
      r.radius += 1.2
      r.alpha -= 0.008
      if (r.alpha <= 0) { clickRipples.splice(i, 1); continue }

      ctx.beginPath()
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(120, 90, 50, ${r.alpha})`
      ctx.lineWidth = 0.5
      ctx.stroke()
    }

    // Mouse proximity glow — roots react to presence
    ctx.beginPath()
    ctx.arc(mouseX, mouseY, 40, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(80, 120, 60, 0.02)'
    ctx.fill()

    // Ascend link
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(120, 90, 50, ${0.1 + Math.sin(time * 0.5) * 0.05})`
    ctx.textAlign = 'center'
    ctx.fillText('▲ ascend to the garden', w / 2, 24)

    // Ossuary link — bottom right
    if (deps.onDeeper && memories.some(m => m.degradation > 0.4)) {
      ctx.font = '9px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(220, 210, 190, ${0.06 + Math.sin(time * 0.3 + 2) * 0.02})`
      ctx.textAlign = 'right'
      ctx.fillText('the ossuary →', w - 12, h - 12)
    }

    // Info
    ctx.font = '9px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(120, 90, 50, 0.1)'
    ctx.textAlign = 'left'
    const decomposing = memories.filter(m => m.degradation > 0.5).length
    ctx.fillText(
      `${memories.length} root systems · ${decomposing} decomposing`,
      12, h - 12
    )

    // Navigation portals
    if (deps.switchTo) {
      for (let i = 0; i < navPoints.length; i++) {
        const np = navPoints[i]
        const nx = w * np.xFrac
        const ny = h * np.yFrac
        const hovered = hoveredNav === i
        const a = hovered ? 0.35 : 0.07
        ctx.font = '9px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(120, 90, 50, ${a})`
        ctx.textAlign = np.xFrac < 0.5 ? 'left' : np.xFrac > 0.6 ? 'right' : 'center'
        ctx.fillText(np.label, nx, ny)
        if (hovered) {
          ctx.fillStyle = 'rgba(80, 120, 60, 0.15)'
          ctx.beginPath()
          ctx.arc(nx, ny + 6, 3, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
  }

  return {
    name: 'roots',
    label: 'the roots',
    hidden: true,

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        width: 100%; height: 100%;
        pointer-events: auto;
        background: #000;
        cursor: pointer;
      `

      canvas = document.createElement('canvas')
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      canvas.style.cssText = 'width: 100%; height: 100%;'
      ctx = canvas.getContext('2d')

      canvas.addEventListener('mousemove', (e) => {
        mouseX = e.clientX
        mouseY = e.clientY
        // Portal hover detection
        if (deps.switchTo && canvas) {
          hoveredNav = -1
          for (let i = 0; i < navPoints.length; i++) {
            const nx = canvas.width * navPoints[i].xFrac
            const ny = canvas.height * navPoints[i].yFrac
            const dx = e.clientX - nx
            const dy = e.clientY - ny
            if (dx * dx + dy * dy < 600) {
              hoveredNav = i
              break
            }
          }
        }
      })

      // Click: portal nav, ascend, descend, or create tremor ripple
      canvas.addEventListener('click', (e) => {
        // Check portals first
        if (deps.switchTo && canvas) {
          for (let i = 0; i < navPoints.length; i++) {
            const nx = canvas.width * navPoints[i].xFrac
            const ny = canvas.height * navPoints[i].yFrac
            const dx = e.clientX - nx
            const dy = e.clientY - ny
            if (dx * dx + dy * dy < 600) {
              deps.switchTo(navPoints[i].room)
              return
            }
          }
        }
        if (e.clientY < 50) {
          deps.onAscend()
        } else if (e.clientX > window.innerWidth * 0.7 && e.clientY > window.innerHeight * 0.85 && deps.onDeeper) {
          deps.onDeeper()
        } else {
          // Tremor ripple + spawn particles from click point
          clickRipples.push({ x: e.clientX, y: e.clientY, radius: 5, alpha: 0.3 })
          for (let i = 0; i < 5; i++) {
            particles.push({
              x: e.clientX + (Math.random() - 0.5) * 20,
              y: e.clientY,
              vy: -0.5 - Math.random() * 1,
              alpha: 0.3 + Math.random() * 0.2,
              size: 1 + Math.random() * 2,
              hue: 30 + Math.random() * 30,
            })
          }
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
      particles = []
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
