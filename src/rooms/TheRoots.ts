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

interface TendrilSegment {
  x: number
  y: number
}

interface NavTendril {
  room: string
  label: string
  segments: TendrilSegment[]
  targetSegments: TendrilSegment[]
  maxSegments: number
  growProgress: number      // 0..maxSegments, fractional for smooth growth
  growSpeed: number
  hovered: boolean
  tipGlow: number           // 0..1, animated glow intensity
  labelAlpha: number        // 0..1, fades in on hover
  burstParticles: { x: number; y: number; vx: number; vy: number; alpha: number; size: number }[]
  burstTriggered: boolean
  visible: boolean
  // colors
  r: number; g: number; b: number
  glowR: number; glowG: number; glowB: number
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
  let hoveredTendril: string | null = null

  // Growing root tendril navigation
  let tendrils: NavTendril[] = []
  let tendrilsInitialized = false

  function buildTendrilPath(
    startX: number, startY: number,
    endX: number, endY: number,
    numSegments: number, curvature: number, seed: number
  ): TendrilSegment[] {
    const rng = seeded(seed)
    const segments: TendrilSegment[] = []
    for (let i = 0; i <= numSegments; i++) {
      const t = i / numSegments
      const baseX = startX + (endX - startX) * t
      const baseY = startY + (endY - startY) * t
      // Organic wandering via cumulative random offset
      const wobbleX = Math.sin(t * Math.PI * 3 + seed) * curvature * (1 - Math.abs(t - 0.5) * 2)
      const jitterX = (rng() - 0.5) * curvature * 0.4
      segments.push({ x: baseX + wobbleX + jitterX, y: baseY })
    }
    return segments
  }

  function initTendrils(w: number, h: number) {
    tendrils = []

    // Garden tendril — grows UPWARD from surface line toward top
    const gardenStartX = w * 0.45 + (hashCode('garden') % 60) - 30
    const gardenPath = buildTendrilPath(
      gardenStartX, 40,        // start at surface line
      w * 0.5, -10,            // end above top edge
      13, 25, 12345
    )
    tendrils.push({
      room: 'garden',
      label: 'the garden',
      segments: [],
      targetSegments: gardenPath,
      maxSegments: gardenPath.length - 1,
      growProgress: 0,
      growSpeed: 0.02,
      hovered: false,
      tipGlow: 0.3,
      labelAlpha: 0,
      burstParticles: [],
      burstTriggered: false,
      visible: true,
      r: 80, g: 110, b: 55,       // warm green, new growth
      glowR: 140, glowG: 200, glowB: 90,
    })

    // Ossuary tendril — grows DOWNWARD from deep roots to bottom-right
    const ossuaryStartX = w * 0.6
    const ossuaryPath = buildTendrilPath(
      ossuaryStartX, h * 0.7,     // start from deep root area
      w - 30, h + 10,              // end at bottom-right corner
      12, 30, 67890
    )
    tendrils.push({
      room: 'ossuary',
      label: 'the ossuary',
      segments: [],
      targetSegments: ossuaryPath,
      maxSegments: ossuaryPath.length - 1,
      growProgress: 0,
      growSpeed: 0.015,
      hovered: false,
      tipGlow: 0.2,
      labelAlpha: 0,
      burstParticles: [],
      burstTriggered: false,
      visible: false,  // only shown when degraded memories exist
      r: 220, g: 210, b: 190,     // bone-colored
      glowR: 240, glowG: 230, glowB: 200,
    })

    tendrilsInitialized = true
  }

  function getTendrilTip(tendril: NavTendril): TendrilSegment | null {
    if (tendril.segments.length < 2) return null
    return tendril.segments[tendril.segments.length - 1]
  }

  function drawTendril(tendril: NavTendril, _w: number, _h: number) {
    if (!ctx || tendril.segments.length < 2) return

    const { r, g, b, glowR, glowG, glowB, hovered } = tendril
    const baseAlpha = hovered ? 0.6 : 0.25
    const thickness = hovered ? 1.8 : 1.2

    // Draw segments
    for (let i = 1; i < tendril.segments.length; i++) {
      const prev = tendril.segments[i - 1]
      const seg = tendril.segments[i]
      const segT = i / tendril.maxSegments
      const sway = Math.sin(time * 0.8 + i * 0.7) * 1.5 * segT
      const sx = seg.x + sway
      const sy = seg.y
      const px = prev.x + Math.sin(time * 0.8 + (i - 1) * 0.7) * 1.5 * ((i - 1) / tendril.maxSegments)
      const py = prev.y

      // Thinner toward tip
      const segThick = thickness * (1 - segT * 0.5)

      ctx.beginPath()
      ctx.moveTo(px, py)
      const midX = (px + sx) / 2 + Math.sin(time * 0.3 + i) * 1.5
      const midY = (py + sy) / 2
      ctx.quadraticCurveTo(midX, midY, sx, sy)
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${baseAlpha * (0.5 + segT * 0.5)})`
      ctx.lineWidth = segThick
      ctx.lineCap = 'round'
      ctx.stroke()

      // Mycorrhizal nodes along ossuary tendril (bone phosphorescence)
      if (tendril.room === 'ossuary' && i % 3 === 0 && i < tendril.segments.length - 1) {
        const nodeGlow = 0.04 + Math.sin(time * 0.6 + i * 2) * 0.03
        ctx.beginPath()
        ctx.arc(sx, sy, 3 + Math.sin(time + i) * 1, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${glowR}, ${glowG}, ${glowB}, ${nodeGlow})`
        ctx.fill()
      }
    }

    // Draw growing tip nodule
    const tip = getTendrilTip(tendril)
    if (tip) {
      const tipSway = Math.sin(time * 0.8 + tendril.segments.length * 0.7) * 1.5
      const tipX = tip.x + tipSway
      const tipY = tip.y
      const glowIntensity = tendril.tipGlow

      // Outer glow
      const outerSize = 6 + Math.sin(time * 1.2) * 2
      ctx.beginPath()
      ctx.arc(tipX, tipY, outerSize, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${glowR}, ${glowG}, ${glowB}, ${glowIntensity * 0.15})`
      ctx.fill()

      // Inner nodule
      ctx.beginPath()
      ctx.arc(tipX, tipY, 3, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${glowR}, ${glowG}, ${glowB}, ${glowIntensity * 0.5})`
      ctx.fill()

      // Label near tip (fades in on hover)
      if (tendril.labelAlpha > 0.01) {
        ctx.font = '10px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${tendril.labelAlpha})`
        if (tendril.room === 'garden') {
          ctx.textAlign = 'left'
          ctx.fillText(tendril.label, tipX + 14, tipY + 4)
        } else {
          ctx.textAlign = 'right'
          ctx.fillText(tendril.label, tipX - 14, tipY + 4)
        }
      }
    }

    // Draw burst particles (garden breakthrough)
    for (let i = tendril.burstParticles.length - 1; i >= 0; i--) {
      const bp = tendril.burstParticles[i]
      bp.x += bp.vx
      bp.y += bp.vy
      bp.alpha -= 0.008
      if (bp.alpha <= 0) {
        tendril.burstParticles.splice(i, 1)
        continue
      }
      ctx.beginPath()
      ctx.arc(bp.x, bp.y, bp.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${glowR}, ${glowG}, ${glowB}, ${bp.alpha})`
      ctx.fill()
    }
  }

  function updateTendrils(memories: StoredMemory[]) {
    for (const tendril of tendrils) {
      // Ossuary only visible when degraded memories exist
      if (tendril.room === 'ossuary') {
        tendril.visible = !!(deps.onDeeper && memories.some(m => m.degradation > 0.4))
      }

      if (!tendril.visible) {
        tendril.growProgress = 0
        tendril.segments = []
        continue
      }

      // Grow
      if (tendril.growProgress < tendril.maxSegments) {
        tendril.growProgress = Math.min(tendril.growProgress + tendril.growSpeed, tendril.maxSegments)
      }

      // Build current visible segments from growProgress
      const fullSegs = Math.floor(tendril.growProgress)
      const frac = tendril.growProgress - fullSegs
      tendril.segments = tendril.targetSegments.slice(0, fullSegs + 1)

      // Add partial segment for smooth growth
      if (fullSegs < tendril.maxSegments && frac > 0) {
        const from = tendril.targetSegments[fullSegs]
        const to = tendril.targetSegments[fullSegs + 1]
        if (from && to) {
          tendril.segments.push({
            x: from.x + (to.x - from.x) * frac,
            y: from.y + (to.y - from.y) * frac,
          })
        }
      }

      // Garden burst when fully grown and reaching top
      if (tendril.room === 'garden' && tendril.growProgress >= tendril.maxSegments && !tendril.burstTriggered) {
        tendril.burstTriggered = true
        const tip = getTendrilTip(tendril)
        if (tip) {
          for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2
            const speed = 0.5 + Math.random() * 1.5
            tendril.burstParticles.push({
              x: tip.x, y: tip.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 0.5,
              alpha: 0.4 + Math.random() * 0.3,
              size: 1 + Math.random() * 2,
            })
          }
        }
      }

      // Animate tipGlow and labelAlpha
      const targetGlow = tendril.hovered ? 0.9 : 0.3
      tendril.tipGlow += (targetGlow - tendril.tipGlow) * 0.08
      const targetLabel = tendril.hovered ? 0.45 : 0
      tendril.labelAlpha += (targetLabel - tendril.labelAlpha) * 0.1
    }
  }

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

    // Growing root tendril navigation
    if (deps.switchTo) {
      if (!tendrilsInitialized) initTendrils(w, h)
      updateTendrils(memories)
      for (const tendril of tendrils) {
        if (tendril.visible) drawTendril(tendril, w, h)
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
        cursor: default;
      `

      canvas = document.createElement('canvas')
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      canvas.style.cssText = 'width: 100%; height: 100%;'
      ctx = canvas.getContext('2d')

      canvas.addEventListener('mousemove', (e) => {
        mouseX = e.clientX
        mouseY = e.clientY
        // Tendril tip hover detection
        hoveredTendril = null
        if (deps.switchTo) {
          for (const tendril of tendrils) {
            if (!tendril.visible) { tendril.hovered = false; continue }
            const tip = getTendrilTip(tendril)
            if (!tip) { tendril.hovered = false; continue }
            const tipSway = Math.sin(time * 0.8 + tendril.segments.length * 0.7) * 1.5
            const dx = e.clientX - (tip.x + tipSway)
            const dy = e.clientY - tip.y
            if (dx * dx + dy * dy < 40 * 40) {
              tendril.hovered = true
              hoveredTendril = tendril.room
            } else {
              tendril.hovered = false
            }
          }
        }
        // Update cursor
        if (canvas) {
          canvas.style.cursor = hoveredTendril ? 'pointer' : 'default'
        }
      })

      // Click: tendril nav, ascend, descend, or create tremor ripple
      canvas.addEventListener('click', (e) => {
        // Check tendril tips first
        if (deps.switchTo) {
          for (const tendril of tendrils) {
            if (!tendril.visible || !tendril.hovered) continue
            const tip = getTendrilTip(tendril)
            if (!tip) continue
            const tipSway = Math.sin(time * 0.8 + tendril.segments.length * 0.7) * 1.5
            const dx = e.clientX - (tip.x + tipSway)
            const dy = e.clientY - tip.y
            if (dx * dx + dy * dy < 40 * 40) {
              deps.switchTo(tendril.room)
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
          tendrilsInitialized = false
        }
      }
      window.addEventListener('resize', onResize)

      return overlay
    },

    activate() {
      active = true
      particles = []
      tendrilsInitialized = false
      tendrils = []
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
