/**
 * THE OSSUARY — where dead memories rest
 *
 * A hidden room accessible from BOTH The Roots and The Catacombs.
 * Two underground paths converge here. This is the final resting
 * place for memories that have degraded past 70%.
 *
 * The visual: bone-white fragments arranged in patterns on dark walls,
 * like the Paris catacombs' ossuary where bones become architecture.
 * Each degraded memory is a bone-like glyph. The most degraded are
 * barely visible — just the ghost of a shape.
 *
 * The room is silent except for a very faint wind. No music. No drone.
 * Just the quiet company of what was forgotten.
 *
 * From here you can return to The Roots OR The Catacombs — the two
 * underground paths remain open.
 *
 * Inspired by: Paris Catacombs ossuary, Sedlec Ossuary (bone church),
 * memento mori, archaeological bone pits, the dignity of the dead,
 * Buddhist charnel grounds
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'

interface OssuaryDeps {
  getMemories: () => StoredMemory[]
  toRoots: () => void
  toCatacombs: () => void
  switchTo?: (name: string) => void
}

export function createOssuaryRoom(deps: OssuaryDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let hoveredNav = -1

  // Navigation portals — bone-fragment markers leading to connected rooms
  const navPoints = [
    { label: '☽ the roots', room: 'roots', xFrac: 0.08, yFrac: 0.92 },
    { label: '☽ the catacombs', room: 'catacombs', xFrac: 0.92, yFrac: 0.92 },
  ]

  // Glyph shapes for dead memories — abstract bone-like forms
  function drawGlyph(x: number, y: number, seed: number, size: number, alpha: number) {
    if (!ctx) return
    const rng = () => { seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF; return (seed >>> 0) / 0xFFFFFFFF }

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rng() * Math.PI * 2)

    const type = Math.floor(rng() * 4)
    ctx.strokeStyle = `rgba(220, 210, 190, ${alpha})`
    ctx.fillStyle = `rgba(220, 210, 190, ${alpha * 0.3})`
    ctx.lineWidth = 0.5 + rng()

    if (type === 0) {
      // Long bone
      ctx.beginPath()
      ctx.ellipse(0, 0, size * 0.15, size * 0.5, 0, 0, Math.PI * 2)
      ctx.stroke()
      // Knobs at ends
      ctx.beginPath()
      ctx.arc(0, -size * 0.45, size * 0.12, 0, Math.PI * 2)
      ctx.arc(0, size * 0.45, size * 0.12, 0, Math.PI * 2)
      ctx.stroke()
    } else if (type === 1) {
      // Skull-like circle
      ctx.beginPath()
      ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2)
      ctx.stroke()
      // Eye sockets
      ctx.beginPath()
      ctx.arc(-size * 0.1, -size * 0.05, size * 0.06, 0, Math.PI * 2)
      ctx.arc(size * 0.1, -size * 0.05, size * 0.06, 0, Math.PI * 2)
      ctx.fill()
    } else if (type === 2) {
      // Cross / vertebra
      ctx.beginPath()
      ctx.moveTo(-size * 0.3, 0)
      ctx.lineTo(size * 0.3, 0)
      ctx.moveTo(0, -size * 0.2)
      ctx.lineTo(0, size * 0.2)
      ctx.stroke()
    } else {
      // Fragment / shard
      ctx.beginPath()
      ctx.moveTo(0, -size * 0.3)
      ctx.lineTo(size * 0.2, size * 0.1)
      ctx.lineTo(-size * 0.15, size * 0.25)
      ctx.closePath()
      ctx.stroke()
    }

    ctx.restore()
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height
    const memories = deps.getMemories()

    // Only show memories that are significantly degraded
    const dead = memories.filter(m => m.degradation > 0.4)

    ctx.clearRect(0, 0, w, h)

    // Background — near black with slight warm tone
    ctx.fillStyle = 'rgba(8, 6, 5, 1)'
    ctx.fillRect(0, 0, w, h)

    // Subtle stone texture — faint noise pattern
    for (let i = 0; i < 200; i++) {
      const sx = (Math.sin(i * 127.1 + 311.7) * 0.5 + 0.5) * w
      const sy = (Math.sin(i * 269.5 + 183.3) * 0.5 + 0.5) * h
      ctx.fillStyle = `rgba(220, 210, 190, ${0.01 + Math.sin(i * 0.7) * 0.005})`
      ctx.fillRect(sx, sy, 1, 1)
    }

    if (dead.length === 0) {
      // No dead memories — the ossuary is empty
      ctx.font = '14px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(220, 210, 190, 0.15)'
      ctx.textAlign = 'center'
      ctx.fillText('the ossuary is empty', w / 2, h / 2 - 10)
      ctx.font = '11px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(220, 210, 190, 0.08)'
      ctx.fillText('no memories have degraded enough to rest here', w / 2, h / 2 + 14)
    } else {
      // Arrange glyphs in a grid-like pattern (like bones on walls)
      const cols = Math.ceil(Math.sqrt(dead.length * 1.5))
      const rows = Math.ceil(dead.length / cols)
      const cellW = (w - 120) / cols
      const cellH = (h - 200) / Math.max(rows, 1)
      const offsetX = 60 + cellW / 2
      const offsetY = 100 + cellH / 2

      for (let i = 0; i < dead.length; i++) {
        const mem = dead[i]
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = offsetX + col * cellW + Math.sin(time * 0.2 + i) * 1
        const y = offsetY + row * cellH + Math.cos(time * 0.15 + i * 0.7) * 1

        const hash = mem.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
        const alpha = 0.03 + (1 - mem.degradation) * 0.15
        const size = 15 + (mem.originalText.length % 20)

        drawGlyph(x, y, hash, size, alpha)

        // Memory text fragment below glyph
        if (mem.degradation < 0.9) {
          ctx.font = '8px "Cormorant Garamond", serif'
          ctx.fillStyle = `rgba(220, 210, 190, ${alpha * 0.4})`
          ctx.textAlign = 'center'
          ctx.fillText(mem.currentText.slice(0, 20), x, y + size * 0.6 + 8)
        }
      }

      // Count
      ctx.font = '9px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(220, 210, 190, 0.08)'
      ctx.textAlign = 'center'
      ctx.fillText(`${dead.length} memories at rest`, w / 2, h - 50)
    }

    // Title
    ctx.font = '11px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(220, 210, 190, 0.12)'
    ctx.textAlign = 'center'
    ctx.letterSpacing = '3px'
    ctx.fillText('THE OSSUARY', w / 2, 40)

    // Navigation links
    ctx.font = '10px "Cormorant Garamond", serif'

    // Left: to roots
    ctx.fillStyle = `rgba(120, 90, 50, ${0.08 + Math.sin(time * 0.4) * 0.03})`
    ctx.textAlign = 'left'
    ctx.fillText('← the roots', 20, h / 2)

    // Right: to catacombs
    ctx.fillStyle = `rgba(180, 160, 120, ${0.08 + Math.sin(time * 0.4 + 1) * 0.03})`
    ctx.textAlign = 'right'
    ctx.fillText('the catacombs →', w - 20, h / 2)

    // Navigation portals
    if (deps.switchTo) {
      for (let i = 0; i < navPoints.length; i++) {
        const np = navPoints[i]
        const nx = w * np.xFrac
        const ny = h * np.yFrac
        const hovered = hoveredNav === i
        const a = hovered ? 0.35 : 0.06
        ctx.font = '9px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(220, 210, 190, ${a})`
        ctx.textAlign = np.xFrac < 0.5 ? 'left' : 'right'
        ctx.fillText(np.label, nx, ny)
        if (hovered) {
          ctx.fillStyle = 'rgba(220, 210, 190, 0.12)'
          ctx.beginPath()
          ctx.arc(nx + (np.xFrac < 0.5 ? -6 : 6), ny - 3, 3, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
  }

  return {
    name: 'ossuary',
    label: 'the ossuary',
    hidden: true,

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
      canvas.style.cssText = 'width: 100%; height: 100%; cursor: pointer;'
      ctx = canvas.getContext('2d')

      // Portal navigation click + hover
      canvas.addEventListener('click', (e) => {
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
        // Click left half → roots, right half → catacombs
        const x = e.clientX
        const mid = window.innerWidth / 2
        if (x < mid * 0.3) {
          deps.toRoots()
        } else if (x > mid * 1.7) {
          deps.toCatacombs()
        }
      })
      canvas.addEventListener('mousemove', (e) => {
        if (!deps.switchTo || !canvas) return
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
