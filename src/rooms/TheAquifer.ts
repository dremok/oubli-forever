/**
 * THE AQUIFER — underground water where memories dissolve and mingle
 *
 * A hidden room beneath The Well. Accessible when the well's water
 * level is high enough (drop enough memories). The aquifer is where
 * all dropped memories end up — a vast underground lake where text
 * fragments float, dissolve, and recombine in the water.
 *
 * The aesthetic is deep underwater: dark blues, bioluminescent glows,
 * text fragments drifting in currents. Memories from the well are
 * mixed together — you can't tell which came from which original.
 *
 * A passage leads to The Tide Pool — the aquifer feeds the ocean.
 * Another passage leads back up to The Well.
 *
 * Inspired by: Underground rivers, the water table, aquatic caves,
 * the collective unconscious (Jung), how memories blend together
 * over time, the water cycle as a metaphor for memory recycling
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'

interface AquiferDeps {
  getMemories: () => StoredMemory[]
  toWell: () => void
  toTidePool: () => void
  switchTo?: (name: string) => void
}

interface FloatingFragment {
  text: string
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  size: number
  hue: number
}

interface Bubble {
  x: number
  y: number
  vy: number
  size: number
  alpha: number
}

export function createAquiferRoom(deps: AquiferDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let fragments: FloatingFragment[] = []
  let bubbles: Bubble[] = []
  let mouseX = 0
  let mouseY = 0
  let hoveredNav = -1

  // Navigation portals — bioluminescent markers in the dark water
  const navPoints = [
    { label: '◈ the well', room: 'well', xFrac: 0.5, yFrac: 0.04 },
    { label: '◈ the tide pool', room: 'tidepool', xFrac: 0.94, yFrac: 0.5 },
  ]

  function shatterMemories() {
    fragments = []
    const memories = deps.getMemories()
    if (memories.length === 0) return

    const w = canvas?.width || window.innerWidth
    const h = canvas?.height || window.innerHeight

    // Take words from all memories, shuffle them
    const allWords: { word: string; hue: number }[] = []
    for (const mem of memories) {
      const words = mem.currentText.split(/\s+/).filter(w => w.length > 2)
      for (const word of words) {
        allWords.push({ word, hue: mem.hue })
      }
    }

    // Create floating fragments from random combinations
    const fragCount = Math.min(allWords.length, 40)
    for (let i = 0; i < fragCount; i++) {
      const wordData = allWords[Math.floor(Math.random() * allWords.length)]
      // Sometimes combine 2-3 words
      let text = wordData.word
      if (Math.random() < 0.4 && allWords.length > 1) {
        const other = allWords[Math.floor(Math.random() * allWords.length)]
        text = `${wordData.word} ${other.word}`
      }

      fragments.push({
        text,
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.2,
        alpha: 0.1 + Math.random() * 0.2,
        size: 10 + Math.random() * 6,
        hue: wordData.hue * 360,
      })
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height

    ctx.clearRect(0, 0, w, h)

    // Background — deep underwater
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, 'rgba(2, 8, 20, 1)')
    bg.addColorStop(0.5, 'rgba(3, 12, 30, 1)')
    bg.addColorStop(1, 'rgba(2, 6, 15, 1)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // Underwater caustic patterns
    for (let i = 0; i < 6; i++) {
      const cx = w * 0.5 + Math.sin(time * 0.2 + i * 2) * w * 0.3
      const cy = h * 0.3 + Math.cos(time * 0.15 + i * 1.5) * h * 0.2
      const radius = 100 + Math.sin(time * 0.3 + i) * 30
      const caustic = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
      caustic.addColorStop(0, 'rgba(40, 100, 180, 0.015)')
      caustic.addColorStop(1, 'rgba(20, 60, 120, 0)')
      ctx.fillStyle = caustic
      ctx.fillRect(0, 0, w, h)
    }

    // Water current lines
    ctx.strokeStyle = 'rgba(60, 120, 180, 0.02)'
    ctx.lineWidth = 0.5
    for (let i = 0; i < 8; i++) {
      const y = (h * 0.2 + i * h * 0.08 + Math.sin(time * 0.1 + i) * 20)
      ctx.beginPath()
      ctx.moveTo(0, y)
      for (let x = 0; x < w; x += 20) {
        const dy = Math.sin(x * 0.01 + time * 0.3 + i) * 10
        ctx.lineTo(x, y + dy)
      }
      ctx.stroke()
    }

    // Floating text fragments — the dissolved memories
    for (const frag of fragments) {
      // Current drift
      frag.x += frag.vx + Math.sin(time * 0.5 + frag.y * 0.01) * 0.2
      frag.y += frag.vy + Math.cos(time * 0.3 + frag.x * 0.01) * 0.1

      // Mouse influence — fragments drift away from cursor
      const dx = frag.x - mouseX
      const dy = frag.y - mouseY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 150) {
        const force = (150 - dist) / 150 * 0.3
        frag.vx += (dx / dist) * force * 0.01
        frag.vy += (dy / dist) * force * 0.01
      }

      // Dampen velocity
      frag.vx *= 0.99
      frag.vy *= 0.99

      // Wrap around
      if (frag.x < -100) frag.x = w + 50
      if (frag.x > w + 100) frag.x = -50
      if (frag.y < -50) frag.y = h + 30
      if (frag.y > h + 50) frag.y = -30

      // Draw fragment
      ctx.font = `${frag.size}px "Cormorant Garamond", serif`
      ctx.fillStyle = `hsla(${200 + frag.hue * 0.2}, 50%, 60%, ${frag.alpha})`
      ctx.textAlign = 'center'
      ctx.fillText(frag.text, frag.x, frag.y)
    }

    // Bubbles
    if (Math.random() < 0.05) {
      bubbles.push({
        x: Math.random() * w,
        y: h + 10,
        vy: -0.5 - Math.random() * 1,
        size: 1 + Math.random() * 3,
        alpha: 0.1 + Math.random() * 0.1,
      })
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]
      b.y += b.vy
      b.x += Math.sin(time * 2 + b.y * 0.05) * 0.3
      b.alpha -= 0.0005

      if (b.y < -10 || b.alpha <= 0) {
        bubbles.splice(i, 1)
        continue
      }

      ctx.beginPath()
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(100, 180, 220, ${b.alpha})`
      ctx.lineWidth = 0.5
      ctx.stroke()
    }
    if (bubbles.length > 50) bubbles.splice(0, 10)

    // Mouse proximity glow
    ctx.beginPath()
    ctx.arc(mouseX, mouseY, 60, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(60, 120, 200, 0.015)'
    ctx.fill()

    // Navigation links
    // Up to well
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(100, 160, 220, ${0.1 + Math.sin(time * 0.5) * 0.03})`
    ctx.textAlign = 'center'
    ctx.fillText('▲ ascend to the well', w / 2, 25)

    // Right to tide pool
    ctx.save()
    ctx.translate(w - 15, h / 2)
    ctx.rotate(Math.PI / 2)
    ctx.fillStyle = `rgba(100, 160, 220, ${0.08 + Math.sin(time * 0.4 + 1) * 0.02})`
    ctx.fillText('the tide pool →', 0, 0)
    ctx.restore()

    // Title
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(80, 140, 200, ${0.08 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'left'
    ctx.fillText('the aquifer', 15, h - 15)

    // Info
    ctx.font = '9px monospace'
    ctx.fillStyle = 'rgba(80, 140, 200, 0.06)'
    ctx.textAlign = 'right'
    ctx.fillText(`${fragments.length} fragments dissolved`, w - 15, h - 15)

    // Navigation portals — bioluminescent markers
    if (deps.switchTo) {
      for (let i = 0; i < navPoints.length; i++) {
        const np = navPoints[i]
        const nx = w * np.xFrac
        const ny = h * np.yFrac
        const hovered = hoveredNav === i
        const a = hovered ? 0.4 : 0.07
        ctx.font = '9px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(100, 180, 220, ${a})`
        ctx.textAlign = np.xFrac < 0.5 ? 'left' : np.xFrac > 0.6 ? 'right' : 'center'
        ctx.fillText(np.label, nx, ny)
        if (hovered) {
          const glow = ctx.createRadialGradient(nx, ny, 0, nx, ny, 15)
          glow.addColorStop(0, `rgba(60, 160, 220, 0.12)`)
          glow.addColorStop(1, 'rgba(60, 160, 220, 0)')
          ctx.fillStyle = glow
          ctx.fillRect(nx - 15, ny - 15, 30, 30)
        }
      }
    }
  }

  return {
    name: 'aquifer',
    label: 'the aquifer',
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
        // Top area → ascend to well
        if (e.clientY < 50) {
          deps.toWell()
        }
        // Right edge → tide pool
        else if (e.clientX > window.innerWidth * 0.85) {
          deps.toTidePool()
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
      bubbles = []
      shatterMemories()
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
