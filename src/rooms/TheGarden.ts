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
  onDescend?: () => void
  switchTo?: (name: string) => void
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

interface WaterDrop {
  x: number
  y: number
  radius: number
  alpha: number
}

interface PlantTooltip {
  plant: Plant
  x: number
  y: number
  alpha: number
}

interface GardenPortal {
  name: string
  label: string
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  hovered: boolean
  clickFlash: number // 0-1, decays after click
}

export function createGardenRoom(deps: GardenDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let plants: Plant[] = []
  let time = 0
  let waterDrops: WaterDrop[] = []
  let tooltip: PlantTooltip | null = null
  let mouseX = 0
  let mouseY = 0

  const gardenPortals: GardenPortal[] = [
    { name: 'terrarium', label: 'the terrarium', corner: 'top-right', hovered: false, clickFlash: 0 },
    { name: 'tidepool', label: 'the tide pool', corner: 'top-left', hovered: false, clickFlash: 0 },
    { name: 'madeleine', label: 'the madeleine', corner: 'bottom-right', hovered: false, clickFlash: 0 },
    { name: 'void', label: 'the void', corner: 'bottom-left', hovered: false, clickFlash: 0 },
  ]

  function getPortalPosition(portal: GardenPortal, w: number, h: number): { x: number; y: number } {
    const margin = 50
    switch (portal.corner) {
      case 'top-right': return { x: w - margin, y: margin }
      case 'top-left': return { x: margin, y: margin }
      case 'bottom-right': return { x: w - margin, y: h - 70 }
      case 'bottom-left': return { x: margin, y: h - 70 }
    }
  }

  function isInsidePortal(px: number, py: number, portal: GardenPortal, w: number, h: number): boolean {
    const pos = getPortalPosition(portal, w, h)
    const dx = px - pos.x
    const dy = py - pos.y
    return dx * dx + dy * dy < 30 * 30
  }

  function renderPortals(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (!deps.switchTo) return

    for (const portal of gardenPortals) {
      const pos = getPortalPosition(portal, w, h)
      const hover = portal.hovered
      const flash = portal.clickFlash
      const glowBase = hover ? 0.6 : 0.15
      const glowPulse = Math.sin(time * (hover ? 3 : 1.2)) * 0.05

      // Decay click flash
      if (portal.clickFlash > 0) {
        portal.clickFlash = Math.max(0, portal.clickFlash - 0.03)
      }

      ctx.save()
      ctx.translate(pos.x, pos.y)

      if (portal.name === 'terrarium') {
        // Glass dome / bell jar with tiny plant
        const domeH = hover ? 26 : 22
        const domeW = hover ? 16 : 14
        const glow = glowBase + glowPulse + flash * 0.5

        // Glow aura
        const auraR = 30 + flash * 20
        const aura = ctx.createRadialGradient(0, -4, 2, 0, -4, auraR)
        aura.addColorStop(0, `rgba(80, 180, 60, ${glow * 0.25})`)
        aura.addColorStop(1, `rgba(80, 180, 60, 0)`)
        ctx.fillStyle = aura
        ctx.beginPath()
        ctx.arc(0, -4, auraR, 0, Math.PI * 2)
        ctx.fill()

        // Bell jar outline
        ctx.strokeStyle = `rgba(140, 200, 120, ${glow * 0.7})`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(-domeW / 2, 6)
        ctx.lineTo(-domeW / 2, -domeH * 0.3)
        ctx.quadraticCurveTo(-domeW / 2, -domeH, 0, -domeH)
        ctx.quadraticCurveTo(domeW / 2, -domeH, domeW / 2, -domeH * 0.3)
        ctx.lineTo(domeW / 2, 6)
        ctx.stroke()

        // Base
        ctx.fillStyle = `rgba(100, 160, 80, ${glow * 0.4})`
        ctx.fillRect(-domeW / 2 - 2, 5, domeW + 4, 3)

        // Tiny plant inside
        const plantSway = Math.sin(time * (hover ? 2.5 : 1.5)) * 1.5
        ctx.strokeStyle = `rgba(80, 180, 50, ${glow})`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(0, 4)
        ctx.quadraticCurveTo(plantSway, -6, plantSway * 0.6, -12)
        ctx.stroke()

        // Tiny leaves
        ctx.fillStyle = `rgba(100, 200, 60, ${glow * 0.8})`
        ctx.beginPath()
        ctx.ellipse(plantSway * 0.3 + 3, -8, 3, 1.5, 0.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(plantSway * 0.5 - 2, -5, 2.5, 1.2, -0.5, 0, Math.PI * 2)
        ctx.fill()

      } else if (portal.name === 'tidepool') {
        // Puddle with rippling concentric circles
        const glow = glowBase + glowPulse + flash * 0.5
        const rippleSpeed = hover ? 2.5 : 1.2

        // Glow aura
        const auraR = 28 + flash * 18
        const aura = ctx.createRadialGradient(0, 0, 2, 0, 0, auraR)
        aura.addColorStop(0, `rgba(60, 130, 200, ${glow * 0.3})`)
        aura.addColorStop(1, `rgba(60, 130, 200, 0)`)
        ctx.fillStyle = aura
        ctx.beginPath()
        ctx.arc(0, 0, auraR, 0, Math.PI * 2)
        ctx.fill()

        // Puddle base ellipse
        ctx.fillStyle = `rgba(30, 70, 120, ${glow * 0.4})`
        ctx.beginPath()
        ctx.ellipse(0, 2, 20, 10, 0, 0, Math.PI * 2)
        ctx.fill()

        // Concentric ripples
        for (let r = 0; r < 3; r++) {
          const phase = (time * rippleSpeed + r * 1.2) % 3
          const radius = 4 + phase * 7
          const alpha = (1 - phase / 3) * glow * 0.5
          ctx.strokeStyle = `rgba(100, 170, 220, ${alpha})`
          ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.ellipse(0, 2, radius, radius * 0.5, 0, 0, Math.PI * 2)
          ctx.stroke()
        }

        // Sparkle
        const sparklePhase = Math.sin(time * 3.7) * 0.5 + 0.5
        ctx.fillStyle = `rgba(180, 220, 255, ${sparklePhase * glow * 0.4})`
        ctx.beginPath()
        ctx.arc(-5 + Math.sin(time * 1.3) * 3, -1, 1, 0, Math.PI * 2)
        ctx.fill()

      } else if (portal.name === 'madeleine') {
        // Flower with slowly opening petals
        const glow = glowBase + glowPulse + flash * 0.5
        const openAmount = hover ? 0.9 : 0.5 + Math.sin(time * 0.4) * 0.15
        const petalCount = 6

        // Glow aura
        const auraR = 28 + flash * 18
        const aura = ctx.createRadialGradient(0, -2, 2, 0, -2, auraR)
        aura.addColorStop(0, `rgba(220, 120, 160, ${glow * 0.25})`)
        aura.addColorStop(1, `rgba(220, 120, 160, 0)`)
        ctx.fillStyle = aura
        ctx.beginPath()
        ctx.arc(0, -2, auraR, 0, Math.PI * 2)
        ctx.fill()

        // Stem
        ctx.strokeStyle = `rgba(80, 140, 60, ${glow * 0.5})`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(0, 14)
        ctx.quadraticCurveTo(Math.sin(time * 0.8) * 2, 6, 0, -2)
        ctx.stroke()

        // Petals
        for (let i = 0; i < petalCount; i++) {
          const angle = (i / petalCount) * Math.PI * 2 + time * (hover ? 0.15 : 0.05)
          const petalLen = 8 + openAmount * 6
          const px = Math.cos(angle) * petalLen
          const py = Math.sin(angle) * petalLen * 0.6 - 2
          const hue = 330 + i * 8
          ctx.fillStyle = `hsla(${hue}, 60%, ${50 + glow * 20}%, ${glow * 0.7})`
          ctx.beginPath()
          ctx.ellipse(px * 0.5, py * 0.5 - 2, petalLen * 0.45, petalLen * 0.2,
            angle, 0, Math.PI * 2)
          ctx.fill()
        }

        // Center
        ctx.fillStyle = `rgba(255, 220, 140, ${glow * 0.6})`
        ctx.beginPath()
        ctx.arc(0, -2, 2.5, 0, Math.PI * 2)
        ctx.fill()

      } else if (portal.name === 'void') {
        // Dark hole in the ground with magenta glow at edges
        const glow = glowBase + glowPulse + flash * 0.5
        const pulseSize = hover ? 3 : 1.5
        const holeRadius = 14 + Math.sin(time * (hover ? 2 : 0.8)) * pulseSize

        // Magenta edge glow
        const auraR = holeRadius + 16 + flash * 15
        const aura = ctx.createRadialGradient(0, 0, holeRadius * 0.5, 0, 0, auraR)
        aura.addColorStop(0, `rgba(0, 0, 0, 0)`)
        aura.addColorStop(0.5, `rgba(180, 20, 120, ${glow * 0.3})`)
        aura.addColorStop(1, `rgba(180, 20, 120, 0)`)
        ctx.fillStyle = aura
        ctx.beginPath()
        ctx.arc(0, 0, auraR, 0, Math.PI * 2)
        ctx.fill()

        // Dark hole
        const hole = ctx.createRadialGradient(0, 0, 0, 0, 0, holeRadius)
        hole.addColorStop(0, `rgba(0, 0, 0, ${0.8 + glow * 0.2})`)
        hole.addColorStop(0.7, `rgba(5, 0, 10, ${0.6 + glow * 0.2})`)
        hole.addColorStop(1, `rgba(80, 10, 60, ${glow * 0.4})`)
        ctx.fillStyle = hole
        ctx.beginPath()
        ctx.ellipse(0, 0, holeRadius, holeRadius * 0.55, 0, 0, Math.PI * 2)
        ctx.fill()

        // Rim highlight
        ctx.strokeStyle = `rgba(200, 30, 140, ${glow * 0.4})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.ellipse(0, 0, holeRadius, holeRadius * 0.55, 0, 0, Math.PI * 2)
        ctx.stroke()

        // Tiny swirling particles inside
        for (let i = 0; i < 3; i++) {
          const a = time * (1.5 + i * 0.3) + i * 2.1
          const pr = (holeRadius * 0.4) * (0.3 + (Math.sin(time + i) * 0.5 + 0.5) * 0.7)
          const ppx = Math.cos(a) * pr
          const ppy = Math.sin(a) * pr * 0.5
          ctx.fillStyle = `rgba(200, 50, 150, ${glow * 0.5})`
          ctx.beginPath()
          ctx.arc(ppx, ppy, 0.8, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Label on hover
      if (hover) {
        ctx.font = '10px "Cormorant Garamond", serif'
        ctx.textAlign = 'center'
        ctx.fillStyle = `rgba(200, 180, 140, 0.5)`
        const labelY = portal.corner.startsWith('top') ? 28 : -22
        ctx.fillText(portal.label, 0, labelY)
      }

      ctx.restore()
    }
  }

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

    // Water drop animations
    for (let i = waterDrops.length - 1; i >= 0; i--) {
      const drop = waterDrops[i]
      drop.radius += 0.8
      drop.alpha -= 0.008

      if (drop.alpha <= 0) {
        waterDrops.splice(i, 1)
        continue
      }

      ctx.beginPath()
      ctx.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(100, 160, 200, ${drop.alpha})`
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Hover highlight — glow around nearest plant
    if (mouseY < groundY) {
      for (const plant of plants) {
        const dist = Math.abs(mouseX - plant.x)
        if (dist < 30) {
          ctx.beginPath()
          ctx.arc(plant.x, groundY - 5, 4, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(255, 215, 0, 0.08)'
          ctx.fill()
        }
      }
    }

    // Plant tooltip
    if (tooltip) {
      tooltip.alpha -= 0.003
      if (tooltip.alpha <= 0) {
        tooltip = null
      } else {
        const t = tooltip
        const mem = t.plant.memory
        const health = Math.floor((1 - mem.degradation) * 100)
        const age = Math.floor((Date.now() - mem.timestamp) / (1000 * 60 * 60 * 24))

        // Background
        ctx.fillStyle = `rgba(10, 8, 5, ${t.alpha * 0.85})`
        ctx.fillRect(t.x - 120, t.y - 45, 240, 75)
        ctx.strokeStyle = `rgba(120, 90, 50, ${t.alpha * 0.15})`
        ctx.lineWidth = 1
        ctx.strokeRect(t.x - 120, t.y - 45, 240, 75)

        // Text
        ctx.font = '12px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(200, 180, 140, ${t.alpha * 0.6})`
        ctx.textAlign = 'center'
        const label = mem.currentText.slice(0, 40) || '(empty)'
        ctx.fillText(`"${label}"`, t.x, t.y - 20)

        ctx.font = '10px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(200, 180, 140, ${t.alpha * 0.3})`
        ctx.fillText(`${health}% alive · ${age} days old`, t.x, t.y)

        ctx.font = '9px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(200, 180, 140, ${t.alpha * 0.15})`
        ctx.fillText('click water to nurture · click soil to descend', t.x, t.y + 16)
      }
    }

    // Descent hint — click ground to go to roots
    if (deps.onDescend && plants.length > 0) {
      ctx.font = '9px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(120, 90, 50, ${0.06 + Math.sin(time * 0.3) * 0.02})`
      ctx.textAlign = 'center'
      ctx.fillText('▼ click the soil to see the roots', w / 2, groundY + 40)
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

    // Garden portals — organic exits at the edges
    renderPortals(ctx, w, h)
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

      // Click interactions
      canvas.addEventListener('click', (e) => {
        const rect = canvas!.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const clickY = e.clientY - rect.top
        const cw = canvas!.width
        const ch = canvas!.height
        const groundY = ch * 0.82

        // Check portal clicks first
        if (deps.switchTo) {
          for (const portal of gardenPortals) {
            if (isInsidePortal(clickX, clickY, portal, cw, ch)) {
              portal.clickFlash = 1
              const targetName = portal.name
              setTimeout(() => deps.switchTo!(targetName), 300)
              return
            }
          }
        }

        if (clickY > groundY && deps.onDescend) {
          deps.onDescend()
          return
        }

        // Check if clicked near a plant
        let clickedPlant: Plant | null = null
        let closestDist = 40 // max click distance
        for (const plant of plants) {
          const dist = Math.abs(clickX - plant.x)
          if (dist < closestDist && clickY < groundY) {
            closestDist = dist
            clickedPlant = plant
          }
        }

        if (clickedPlant) {
          // Show tooltip for this plant
          tooltip = {
            plant: clickedPlant,
            x: clickedPlant.x,
            y: groundY - 80,
            alpha: 1,
          }
        } else {
          // Water effect — click on ground near plants
          waterDrops.push({
            x: clickX,
            y: clickY,
            radius: 2,
            alpha: 0.4,
          })
          // Dismiss tooltip
          tooltip = null
        }
      })

      // Track mouse for hover effects
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas!.getBoundingClientRect()
        mouseX = e.clientX - rect.left
        mouseY = e.clientY - rect.top

        // Update portal hover states
        let anyPortalHovered = false
        if (deps.switchTo) {
          const cw = canvas!.width
          const ch = canvas!.height
          for (const portal of gardenPortals) {
            portal.hovered = isInsidePortal(mouseX, mouseY, portal, cw, ch)
            if (portal.hovered) anyPortalHovered = true
          }
        }
        canvas!.style.cursor = anyPortalHovered ? 'pointer' : 'default'
      })

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
