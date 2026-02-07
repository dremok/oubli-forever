/**
 * THE GARDEN — memories grow as living things
 *
 * A generative garden where each stored memory is a plant. New memories
 * are seeds. Over time they grow — branching, leafing, blooming. But
 * as the memory degrades, the plant withers. Fully degraded memories
 * become dry husks that still stand as monuments to what was.
 *
 * The garden uses procedural L-system-like growth rendered on canvas.
 * Each plant's shape is deterministically derived from the memory text
 * (text → hash → growth parameters). So the same memory always grows
 * the same plant, but each memory grows a unique one.
 *
 * Wind blows gently. Plants sway. The garden breathes.
 *
 * Inspired by: L-systems (Lindenmayer), Cellular automata gardens,
 * The Secret Garden, Japanese moss gardens, digital bonsai,
 * growth as metaphor for memory consolidation
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'

interface GardenDeps {
  getMemories: () => StoredMemory[]
}

interface Plant {
  memory: StoredMemory
  x: number
  segments: PlantSegment[]
  swayPhase: number
  swaySpeed: number
}

interface PlantSegment {
  x1: number; y1: number
  x2: number; y2: number
  thickness: number
  hue: number
  saturation: number
  lightness: number
  alpha: number
  isLeaf: boolean
  isFlower: boolean
}

function hashString(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
    return (s >>> 0) / 0xFFFFFFFF
  }
}

function generatePlant(memory: StoredMemory, baseX: number, groundY: number): Plant {
  const hash = hashString(memory.originalText)
  const rng = seededRandom(hash)

  const segments: PlantSegment[] = []
  const health = 1 - memory.degradation // 0 = dead, 1 = full
  const textLen = memory.originalText.length

  // Plant parameters derived from text
  const maxHeight = 60 + (textLen % 80) + rng() * 40 // taller for longer memories
  const branchiness = 0.15 + (hash % 100) / 300 // 0.15-0.48
  const curviness = 0.3 + rng() * 0.5
  const baseHue = memory.hue * 360 // use memory's hue

  // Grow from bottom up
  const numSegments = 5 + Math.floor(rng() * 6)
  let curX = baseX
  let curY = groundY
  const segHeight = maxHeight / numSegments

  function growBranch(
    startX: number, startY: number,
    angle: number, length: number,
    thickness: number, depth: number
  ) {
    if (depth > 4 || length < 4) return

    const endX = startX + Math.sin(angle) * length
    const endY = startY - Math.cos(angle) * length

    // Health affects color — dying plants go brown/gray
    const h = health > 0.3 ? baseHue : 30 + (1 - health) * 20
    const s = health > 0.3 ? (40 + health * 30) : (10 + health * 20)
    const l = 20 + health * 25
    const a = 0.3 + health * 0.5

    segments.push({
      x1: startX, y1: startY,
      x2: endX, y2: endY,
      thickness: thickness * (health * 0.7 + 0.3),
      hue: h, saturation: s, lightness: l,
      alpha: a,
      isLeaf: false,
      isFlower: false,
    })

    // Branch?
    if (rng() < branchiness && depth < 3) {
      const branchAngle = angle + (rng() - 0.5) * 1.5
      growBranch(endX, endY, branchAngle, length * 0.6, thickness * 0.6, depth + 1)
    }

    // Continue main stem with slight curve
    const nextAngle = angle + (rng() - 0.5) * curviness
    growBranch(endX, endY, nextAngle, length * 0.85, thickness * 0.8, depth + 1)

    // Leaf at end of thin branches
    if (depth >= 2 && thickness < 1.5 && health > 0.2) {
      segments.push({
        x1: endX, y1: endY,
        x2: endX + (rng() - 0.5) * 8, y2: endY - rng() * 6,
        thickness: 3 + health * 4,
        hue: baseHue + 20, saturation: 50 + health * 30,
        lightness: 30 + health * 20,
        alpha: 0.2 + health * 0.4,
        isLeaf: true,
        isFlower: false,
      })
    }

    // Flower at tips of healthy plants
    if (depth >= 3 && health > 0.6 && rng() < 0.4) {
      segments.push({
        x1: endX, y1: endY,
        x2: endX, y2: endY,
        thickness: 3 + rng() * 4,
        hue: (baseHue + 180) % 360, // complementary color
        saturation: 60 + health * 30,
        lightness: 50 + health * 20,
        alpha: 0.4 + health * 0.4,
        isLeaf: false,
        isFlower: true,
      })
    }
  }

  // Start growing
  const initialAngle = (rng() - 0.5) * 0.3 // slight lean
  growBranch(curX, curY, initialAngle, segHeight * 2, 2.5, 0)

  return {
    memory,
    x: baseX,
    segments,
    swayPhase: rng() * Math.PI * 2,
    swaySpeed: 0.3 + rng() * 0.5,
  }
}

export function createGardenRoom(deps: GardenDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let plants: Plant[] = []
  let time = 0

  function buildGarden() {
    const memories = deps.getMemories()
    if (!canvas) return

    const w = canvas.width
    const groundY = canvas.height * 0.82

    plants = []

    if (memories.length === 0) return

    // Space plants evenly across the ground
    const spacing = Math.min(80, (w - 80) / memories.length)
    const startX = (w - (memories.length - 1) * spacing) / 2

    for (let i = 0; i < memories.length; i++) {
      const x = startX + i * spacing
      plants.push(generatePlant(memories[i], x, groundY))
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Sky gradient — dark blue to deep void
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, 'rgba(5, 3, 15, 1)')
    sky.addColorStop(0.6, 'rgba(8, 5, 20, 1)')
    sky.addColorStop(1, 'rgba(12, 8, 5, 1)')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    // Ground
    const groundY = h * 0.82
    const ground = ctx.createLinearGradient(0, groundY, 0, h)
    ground.addColorStop(0, 'rgba(20, 12, 8, 0.8)')
    ground.addColorStop(1, 'rgba(10, 6, 3, 1)')
    ctx.fillStyle = ground
    ctx.fillRect(0, groundY, w, h - groundY)

    // Ground line
    ctx.strokeStyle = 'rgba(80, 50, 30, 0.15)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, groundY)
    ctx.lineTo(w, groundY)
    ctx.stroke()

    // Stars — subtle background
    const starSeed = seededRandom(42)
    ctx.fillStyle = 'rgba(255, 215, 0, 0.15)'
    for (let i = 0; i < 40; i++) {
      const sx = starSeed() * w
      const sy = starSeed() * groundY * 0.8
      const sr = 0.5 + starSeed() * 1
      const twinkle = 0.5 + 0.5 * Math.sin(time * (0.5 + starSeed()) + starSeed() * 10)
      ctx.globalAlpha = twinkle * 0.3
      ctx.beginPath()
      ctx.arc(sx, sy, sr, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Wind
    const wind = Math.sin(time * 0.3) * 0.02

    // Draw plants
    for (const plant of plants) {
      const sway = Math.sin(time * plant.swaySpeed + plant.swayPhase) * 3 + wind * 20

      for (const seg of plant.segments) {
        // Apply sway — more at top (lower y = higher on screen)
        const swayFactor1 = Math.max(0, (groundY - seg.y1) / (groundY * 0.5))
        const swayFactor2 = Math.max(0, (groundY - seg.y2) / (groundY * 0.5))

        const sx1 = seg.x1 + sway * swayFactor1
        const sy1 = seg.y1
        const sx2 = seg.x2 + sway * swayFactor2
        const sy2 = seg.y2

        if (seg.isFlower) {
          // Draw flower as small circle
          ctx.beginPath()
          ctx.arc(sx2, sy2, seg.thickness, 0, Math.PI * 2)
          ctx.fillStyle = `hsla(${seg.hue}, ${seg.saturation}%, ${seg.lightness}%, ${seg.alpha})`
          ctx.fill()

          // Glow
          ctx.beginPath()
          ctx.arc(sx2, sy2, seg.thickness * 2, 0, Math.PI * 2)
          ctx.fillStyle = `hsla(${seg.hue}, ${seg.saturation}%, ${seg.lightness}%, ${seg.alpha * 0.15})`
          ctx.fill()
        } else if (seg.isLeaf) {
          // Draw leaf as small ellipse
          ctx.save()
          ctx.translate(sx2, sy2)
          ctx.rotate(Math.atan2(sy2 - sy1, sx2 - sx1))
          ctx.scale(1, 0.5)
          ctx.beginPath()
          ctx.arc(0, 0, seg.thickness, 0, Math.PI * 2)
          ctx.fillStyle = `hsla(${seg.hue}, ${seg.saturation}%, ${seg.lightness}%, ${seg.alpha})`
          ctx.fill()
          ctx.restore()
        } else {
          // Draw branch segment
          ctx.beginPath()
          ctx.moveTo(sx1, sy1)
          ctx.lineTo(sx2, sy2)
          ctx.strokeStyle = `hsla(${seg.hue}, ${seg.saturation}%, ${seg.lightness}%, ${seg.alpha})`
          ctx.lineWidth = seg.thickness
          ctx.lineCap = 'round'
          ctx.stroke()
        }
      }
    }

    // Labels — memory fragments below plants
    ctx.font = '9px "Cormorant Garamond", serif'
    ctx.textAlign = 'center'
    for (const plant of plants) {
      const label = plant.memory.currentText.slice(0, 20)
      if (!label.trim()) continue
      ctx.fillStyle = `rgba(200, 180, 140, ${0.1 + (1 - plant.memory.degradation) * 0.15})`
      ctx.fillText(label, plant.x + Math.sin(time * plant.swaySpeed + plant.swayPhase) * 1, groundY + 18)
    }

    // Info text
    const memCount = plants.length
    const avgHealth = plants.length > 0
      ? plants.reduce((s, p) => s + (1 - p.memory.degradation), 0) / plants.length
      : 0
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(200, 180, 140, 0.12)'
    ctx.textAlign = 'left'
    ctx.fillText(`${memCount} memories growing · ${Math.floor(avgHealth * 100)}% average vitality`, 16, h - 16)
  }

  return {
    name: 'garden',
    label: 'the garden',

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
      canvas.style.cssText = `
        width: 100%; height: 100%;
      `
      ctx = canvas.getContext('2d')
      overlay.appendChild(canvas)

      // Handle resize
      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
          buildGarden()
        }
      }
      window.addEventListener('resize', onResize)

      return overlay
    },

    activate() {
      active = true
      buildGarden()
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
