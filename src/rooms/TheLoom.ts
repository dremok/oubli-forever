/**
 * THE LOOM — weave memories into textiles
 *
 * A room where stored memories become threads in a generative weaving.
 * Each memory is a colored thread — its hue from the memory's color,
 * its pattern from the text content (character codes → weave pattern).
 * Degraded memories produce frayed, broken threads.
 *
 * The weaving builds in real-time, left to right. New memories add
 * new threads. The pattern is deterministic — same memories always
 * produce the same textile. But as memories degrade, holes appear.
 *
 * The room has a meditative quality. The shuttle moves back and forth.
 * Threads interlace. The sound of the loom is the only audio.
 *
 * Accessible from the garden (hidden link) — plants → fibers → thread → cloth.
 * Also in the tab bar as a visible room.
 *
 * Inspired by: Jacquard looms (first binary programming), Anni Albers,
 * the Bayeux Tapestry, Navajo weaving, the Fates' thread,
 * Ada Lovelace (Analytical Engine was inspired by the Jacquard loom)
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'

interface LoomDeps {
  getMemories: () => StoredMemory[]
  switchTo?: (name: string) => void
}

function textToPattern(text: string): number[] {
  // Convert text to a binary-ish weave pattern
  const pattern: number[] = []
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    pattern.push(code % 2) // 0 = warp on top, 1 = weft on top
  }
  return pattern
}

function memoryToColor(mem: StoredMemory): string {
  const h = mem.hue * 360
  const s = 30 + (1 - mem.degradation) * 40
  const l = 20 + (1 - mem.degradation) * 30
  const a = 0.3 + (1 - mem.degradation) * 0.5
  return `hsla(${h}, ${s}%, ${l}%, ${a})`
}

export function createLoomRoom(deps: LoomDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let shuttleX = 0
  let shuttleDir = 1
  let weavingProgress = 0
  let hoveredSpool = -1

  const spools = [
    { label: 'study', room: 'study' },
    { label: 'darkroom', room: 'darkroom' },
    { label: 'gallery', room: 'palimpsestgallery' },
    { label: 'sketchpad', room: 'sketchpad' },
  ]

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height
    const memories = deps.getMemories()

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Background — warm dark wood
    ctx.fillStyle = 'rgba(18, 12, 8, 1)'
    ctx.fillRect(0, 0, w, h)

    if (memories.length === 0) {
      // Empty loom
      ctx.font = '14px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(180, 140, 100, 0.2)'
      ctx.textAlign = 'center'
      ctx.fillText('the loom awaits thread', w / 2, h / 2)
      ctx.font = '11px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(180, 140, 100, 0.1)'
      ctx.fillText('memories become fibers. type into the void first.', w / 2, h / 2 + 24)
      return
    }

    // Weaving area
    const margin = 60
    const weaveW = w - margin * 2
    const weaveH = h - margin * 2
    const threadCount = Math.min(memories.length, 40)
    const threadSpacing = weaveH / (threadCount + 1)
    const cellSize = Math.max(4, Math.min(12, weaveW / 80))

    // Frame
    ctx.strokeStyle = 'rgba(120, 80, 40, 0.1)'
    ctx.lineWidth = 2
    ctx.strokeRect(margin - 10, margin - 10, weaveW + 20, weaveH + 20)

    // Progress the weaving
    weavingProgress += 0.3
    const maxCols = Math.floor(weaveW / cellSize)
    const visibleCols = Math.min(Math.floor(weavingProgress), maxCols)

    // Draw warp threads (vertical, faint background)
    ctx.strokeStyle = 'rgba(120, 80, 40, 0.05)'
    ctx.lineWidth = 0.5
    for (let col = 0; col < visibleCols; col++) {
      const x = margin + col * cellSize
      ctx.beginPath()
      ctx.moveTo(x, margin)
      ctx.lineTo(x, margin + weaveH)
      ctx.stroke()
    }

    // Draw weft threads (horizontal, colored by memory)
    for (let t = 0; t < threadCount; t++) {
      const mem = memories[t % memories.length]
      const y = margin + (t + 1) * threadSpacing
      const pattern = textToPattern(mem.originalText)
      const color = memoryToColor(mem)

      // Thread base line
      ctx.strokeStyle = color
      ctx.lineWidth = Math.max(1, cellSize * 0.4)

      for (let col = 0; col < visibleCols; col++) {
        const x = margin + col * cellSize
        const patIdx = col % pattern.length
        const isOver = pattern[patIdx] === 1

        // Degraded memories have gaps
        if (mem.degradation > 0.3 && Math.random() < mem.degradation * 0.3) {
          continue // skip this cell — frayed thread
        }

        if (isOver) {
          // Weft on top — draw a slightly raised segment
          ctx.beginPath()
          ctx.moveTo(x, y - 1)
          ctx.lineTo(x + cellSize, y - 1)
          ctx.stroke()
        } else {
          // Weft below — draw dimmer
          ctx.globalAlpha = 0.4
          ctx.beginPath()
          ctx.moveTo(x, y + 1)
          ctx.lineTo(x + cellSize, y + 1)
          ctx.stroke()
          ctx.globalAlpha = 1
        }
      }

      // Memory label at left
      if (t < 20) {
        ctx.font = '8px "Cormorant Garamond", serif'
        ctx.fillStyle = color
        ctx.textAlign = 'right'
        ctx.globalAlpha = 0.5
        const label = mem.currentText.slice(0, 15).trim()
        ctx.fillText(label, margin - 14, y + 3)
        ctx.globalAlpha = 1
      }
    }

    // Shuttle animation
    if (visibleCols < maxCols) {
      shuttleX += shuttleDir * 2
      if (shuttleX > weaveW) { shuttleDir = -1; shuttleX = weaveW }
      if (shuttleX < 0) { shuttleDir = 1; shuttleX = 0 }

      // Draw shuttle
      const sx = margin + Math.min(shuttleX, visibleCols * cellSize)
      const sy = margin + weaveH / 2
      ctx.fillStyle = 'rgba(200, 160, 80, 0.3)'
      ctx.fillRect(sx - 8, sy - 3, 16, 6)
      ctx.fillStyle = 'rgba(200, 160, 80, 0.6)'
      ctx.fillRect(sx - 2, sy - 1, 4, 2)
    }

    // Title
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(180, 140, 100, 0.15)'
    ctx.textAlign = 'center'
    ctx.fillText('the loom', w / 2, margin - 24)

    // Stats
    const intact = memories.filter(m => m.degradation < 0.3).length
    const fraying = memories.filter(m => m.degradation >= 0.3 && m.degradation < 0.7).length
    const broken = memories.filter(m => m.degradation >= 0.7).length
    ctx.font = '9px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(180, 140, 100, 0.1)'
    ctx.textAlign = 'left'
    ctx.fillText(
      `${memories.length} threads · ${intact} intact · ${fraying} fraying · ${broken} broken`,
      margin, h - margin / 2 + 10
    )

    // Weaving complete indicator
    if (visibleCols >= maxCols) {
      ctx.font = '10px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(180, 140, 100, 0.12)'
      ctx.textAlign = 'center'
      ctx.fillText('the textile is complete', w / 2, h - margin / 2 + 10)
    }

    // Thread spool portals (bottom)
    if (deps.switchTo) {
      const spoolW = 55
      const totalSpW = spools.length * spoolW + (spools.length - 1) * 12
      const spoolStartX = (w - totalSpW) / 2
      const spoolY = h - 30
      for (let i = 0; i < spools.length; i++) {
        const sx = spoolStartX + i * (spoolW + 12)
        const hovered = hoveredSpool === i
        // Spool circle
        ctx.beginPath()
        ctx.arc(sx + spoolW / 2, spoolY, 6, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(200, 160, 80, ${hovered ? 0.3 : 0.08})`
        ctx.lineWidth = 1
        ctx.stroke()
        // Label
        ctx.font = '7px monospace'
        ctx.fillStyle = `rgba(180, 140, 100, ${hovered ? 0.3 : 0.06})`
        ctx.textAlign = 'center'
        ctx.fillText(spools[i].label, sx + spoolW / 2, spoolY + 16)
      }
    }
  }

  return {
    name: 'loom',
    label: 'the loom',

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

      // Spool portal click + hover
      canvas.addEventListener('click', (e) => {
        if (!deps.switchTo || !canvas) return
        const spoolW = 55
        const totalSpW = spools.length * spoolW + (spools.length - 1) * 12
        const spoolStartX = (canvas.width - totalSpW) / 2
        const spoolY = canvas.height - 30
        for (let i = 0; i < spools.length; i++) {
          const sx = spoolStartX + i * (spoolW + 12) + spoolW / 2
          const dx = e.clientX - sx
          const dy = e.clientY - spoolY
          if (dx * dx + dy * dy < 400) {
            deps.switchTo(spools[i].room)
            return
          }
        }
      })

      canvas.addEventListener('mousemove', (e) => {
        if (!canvas) return
        hoveredSpool = -1
        const spoolW = 55
        const totalSpW = spools.length * spoolW + (spools.length - 1) * 12
        const spoolStartX = (canvas.width - totalSpW) / 2
        const spoolY = canvas.height - 30
        for (let i = 0; i < spools.length; i++) {
          const sx = spoolStartX + i * (spoolW + 12) + spoolW / 2
          const dx = e.clientX - sx
          const dy = e.clientY - spoolY
          if (dx * dx + dy * dy < 400) {
            hoveredSpool = i
            break
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
      weavingProgress = 0
      shuttleX = 0
      shuttleDir = 1
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
