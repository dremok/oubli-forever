/**
 * THE PROJECTION ROOM — cinema of the mind
 *
 * A dark theater where your memories play as degrading film reels.
 * Each memory is a "scene" — text projected onto a screen with
 * film grain, sprocket holes, and countdown leaders. As memories
 * degrade, the film deteriorates: scratches appear, frames skip,
 * the image burns from the center outward (cigarette burns),
 * color fades to sepia to nothing.
 *
 * Between memories, the projector shows "leader" — countdown numbers,
 * alignment marks, the artifacts of cinema's mechanical substrate.
 *
 * Inspired by:
 * - "Eternal Sunshine of the Spotless Mind" (2004) — memories erased
 *   while you watch, the edges dissolving, Joel running through
 *   crumbling scenes trying to preserve one last memory of Clementine
 * - "Last Year at Marienbad" (Resnais, 1961) — memory as unreliable
 *   narrator, scenes repeating with variations, did it happen or not?
 * - "Stalker" (Tarkovsky, 1979) — the Zone where desire reshapes
 *   reality, sepia vs. color as states of being
 * - "Memento" (Nolan, 2000) — reverse chronology, polaroids as
 *   prosthetic memory, tattoos as permanent storage
 * - "Sans Soleil" (Marker, 1983) — memory, travel, the zone of
 *   images, "I remember that January in Tokyo"
 * - Tyler Durden's cigarette burns in Fight Club
 *
 * USES MEMORIES. Cinematic. Destructive viewing.
 */

import type { Room } from './RoomManager'

interface Memory {
  id: string
  originalText: string
  currentText: string
  degradation: number
  timestamp: number
}

interface ProjectionDeps {
  getMemories: () => Memory[]
  switchTo?: (name: string) => void
}

interface FilmFrame {
  memory: Memory
  scratches: { x: number; length: number; alpha: number }[]
  burnRadius: number // cigarette burn, 0 = no burn
  colorShift: number // 0 = full color, 1 = sepia
  frameSkips: number
}

export function createProjectionRoom(deps: ProjectionDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let frames: FilmFrame[] = []
  let currentFrame = 0
  let frameTime = 0 // time spent on current frame
  const FRAME_DURATION = 8 // seconds per memory
  let inLeader = true
  let leaderCount = 5
  let leaderTime = 0
  let projectorFlicker = 0

  function buildFrames() {
    const memories = deps.getMemories()
    frames = memories.slice(0, 12).map(mem => {
      // Generate scratches based on degradation
      const numScratches = Math.floor(mem.degradation * 8)
      const scratches = []
      for (let i = 0; i < numScratches; i++) {
        scratches.push({
          x: Math.random(),
          length: 0.3 + Math.random() * 0.7,
          alpha: 0.1 + Math.random() * 0.2,
        })
      }

      return {
        memory: mem,
        scratches,
        burnRadius: mem.degradation > 0.6 ? (mem.degradation - 0.6) / 0.4 : 0,
        colorShift: mem.degradation * 0.8,
        frameSkips: Math.floor(mem.degradation * 5),
      }
    })
  }

  function drawSprocketHoles(c: CanvasRenderingContext2D, w: number, h: number) {
    const holeW = 8
    const holeH = 12
    const spacing = 30
    const offset = (time * 50) % spacing

    c.fillStyle = 'rgba(0, 0, 0, 0.8)'

    // Left strip
    c.fillRect(0, 0, 25, h)
    // Right strip
    c.fillRect(w - 25, 0, 25, h)

    // Sprocket holes
    for (let y = -spacing + offset; y < h + spacing; y += spacing) {
      // Left holes
      c.fillStyle = 'rgba(20, 18, 15, 1)'
      c.fillRect(8, y - holeH / 2, holeW, holeH)
      // Right holes
      c.fillRect(w - 16, y - holeH / 2, holeW, holeH)
    }
  }

  function drawFilmGrain(c: CanvasRenderingContext2D, w: number, h: number, intensity: number) {
    const imgData = c.getImageData(30, 0, w - 60, h)
    const data = imgData.data
    const grainAmount = intensity * 30

    for (let i = 0; i < data.length; i += 16) { // sample every 4th pixel for performance
      const noise = (Math.random() - 0.5) * grainAmount
      data[i] = Math.min(255, Math.max(0, data[i] + noise))
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise))
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise))
    }

    c.putImageData(imgData, 30, 0)
  }

  function drawLeader(c: CanvasRenderingContext2D, w: number, h: number) {
    leaderTime += 0.016

    // Film leader aesthetic — countdown, alignment marks
    const screenX = 30
    const screenW = w - 60
    const screenH = h

    // Dark screen
    c.fillStyle = 'rgba(15, 12, 8, 0.95)'
    c.fillRect(screenX, 0, screenW, screenH)

    // Countdown number
    const count = Math.max(1, leaderCount - Math.floor(leaderTime))

    c.font = `bold ${Math.min(screenW * 0.3, 200)}px monospace`
    c.fillStyle = `rgba(200, 180, 140, ${0.3 + Math.sin(leaderTime * 8) * 0.1})`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(String(count), w / 2, h / 2)

    // Rotating sweep line (like SMPTE leader)
    const sweepAngle = leaderTime * Math.PI * 2
    c.strokeStyle = 'rgba(200, 180, 140, 0.15)'
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(w / 2, h / 2)
    c.lineTo(
      w / 2 + Math.cos(sweepAngle) * Math.min(screenW, screenH) * 0.4,
      h / 2 + Math.sin(sweepAngle) * Math.min(screenW, screenH) * 0.4,
    )
    c.stroke()

    // Circle
    c.strokeStyle = 'rgba(200, 180, 140, 0.1)'
    c.lineWidth = 1
    c.beginPath()
    c.arc(w / 2, h / 2, Math.min(screenW, screenH) * 0.35, 0, Math.PI * 2)
    c.stroke()

    // Crosshairs
    c.strokeStyle = 'rgba(200, 180, 140, 0.06)'
    c.beginPath()
    c.moveTo(screenX, h / 2)
    c.lineTo(screenX + screenW, h / 2)
    c.moveTo(w / 2, 0)
    c.lineTo(w / 2, screenH)
    c.stroke()

    c.textBaseline = 'alphabetic'

    // Transition to first frame after countdown
    if (leaderTime > leaderCount + 0.5) {
      inLeader = false
      frameTime = 0
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const c = ctx
    const w = canvas.width
    const h = canvas.height

    // Projector room darkness
    c.fillStyle = 'rgba(5, 4, 3, 1)'
    c.fillRect(0, 0, w, h)

    // Projector flicker
    projectorFlicker = 0.85 + Math.random() * 0.15

    if (inLeader) {
      drawLeader(c, w, h)
      drawSprocketHoles(c, w, h)

      // Title
      c.font = '10px "Cormorant Garamond", serif'
      c.fillStyle = `rgba(200, 180, 140, ${0.06 + Math.sin(time * 0.3) * 0.02})`
      c.textAlign = 'center'
      c.fillText('the projection room', w / 2, 25)
      return
    }

    if (frames.length === 0) {
      c.font = '12px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(200, 180, 140, 0.1)'
      c.textAlign = 'center'
      c.fillText('no reels to project', w / 2, h / 2)
      c.font = '10px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(200, 180, 140, 0.06)'
      c.fillText('the projector hums in the dark', w / 2, h / 2 + 20)
      return
    }

    const frame = frames[currentFrame % frames.length]
    frameTime += 0.016

    // Advance to next frame
    if (frameTime > FRAME_DURATION) {
      frameTime = 0
      currentFrame++
      if (currentFrame >= frames.length) currentFrame = 0
    }

    const screenX = 30
    const screenW = w - 60
    const screenH = h
    const degradation = frame.memory.degradation

    // Screen background — warm film base
    const warmth = 1 - frame.colorShift
    const r = Math.floor(15 + warmth * 5)
    const g = Math.floor(12 + warmth * 3)
    const b = Math.floor(8 + warmth * 0)
    c.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.9 * projectorFlicker})`
    c.fillRect(screenX, 0, screenW, screenH)

    // Frame skip effect
    if (frame.frameSkips > 0 && Math.random() < degradation * 0.05) {
      // Jump — add horizontal jitter
      c.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 5)
    }

    // Memory text as projected words
    c.font = '16px "Cormorant Garamond", serif'
    c.textAlign = 'center'

    // Color: from warm amber to sepia to gray
    const textR = Math.floor(220 * warmth + 150 * (1 - warmth))
    const textG = Math.floor(190 * warmth + 130 * (1 - warmth))
    const textB = Math.floor(140 * warmth + 100 * (1 - warmth))
    const textAlpha = (0.35 - degradation * 0.2) * projectorFlicker

    c.fillStyle = `rgba(${textR}, ${textG}, ${textB}, ${textAlpha})`

    // Word wrap the memory text
    const text = frame.memory.currentText
    const words = text.split(' ')
    const maxWidth = screenW * 0.6
    let line = ''
    let lineY = h * 0.35

    for (const word of words) {
      const test = line + (line ? ' ' : '') + word
      if (c.measureText(test).width > maxWidth && line) {
        // Occasional frame skip — text jumps
        const skipOffset = frame.frameSkips > 0 && Math.random() < 0.1
          ? (Math.random() - 0.5) * 8 : 0
        c.fillText(line, w / 2 + skipOffset, lineY)
        line = word
        lineY += 24
      } else {
        line = test
      }
    }
    if (line) c.fillText(line, w / 2, lineY)

    // Film scratches — vertical lines
    for (const scratch of frame.scratches) {
      const sx = screenX + scratch.x * screenW
      c.strokeStyle = `rgba(200, 190, 170, ${scratch.alpha * projectorFlicker})`
      c.lineWidth = 0.5
      c.beginPath()
      const startY = (1 - scratch.length) * h * Math.random()
      c.moveTo(sx, startY)
      c.lineTo(sx + (Math.random() - 0.5) * 3, startY + scratch.length * h)
      c.stroke()
    }

    // Cigarette burn (top-right corner, for heavily degraded memories)
    if (frame.burnRadius > 0) {
      const burnX = w * 0.85
      const burnY = h * 0.1
      const bRadius = frame.burnRadius * 40

      const burn = c.createRadialGradient(burnX, burnY, 0, burnX, burnY, bRadius)
      burn.addColorStop(0, `rgba(80, 60, 30, ${0.5 * frame.burnRadius})`)
      burn.addColorStop(0.5, `rgba(40, 30, 15, ${0.3 * frame.burnRadius})`)
      burn.addColorStop(1, 'transparent')
      c.fillStyle = burn
      c.beginPath()
      c.arc(burnX, burnY, bRadius, 0, Math.PI * 2)
      c.fill()
    }

    // Light leak (periodic warm wash from projector)
    if (Math.sin(time * 0.5) > 0.8) {
      const leakAlpha = (Math.sin(time * 0.5) - 0.8) / 0.2 * 0.03
      c.fillStyle = `rgba(255, 200, 100, ${leakAlpha})`
      c.fillRect(screenX, 0, screenW, screenH)
    }

    // Vignette
    const vignette = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.8)
    vignette.addColorStop(0, 'transparent')
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.4)')
    c.fillStyle = vignette
    c.fillRect(0, 0, w, h)

    // Apply film grain
    if (Math.random() < 0.3) { // only apply occasionally for performance
      drawFilmGrain(c, w, h, 0.3 + degradation * 0.5)
    }

    // Sprocket holes
    drawSprocketHoles(c, w, h)

    // Reset transform
    c.setTransform(1, 0, 0, 1, 0, 0)

    // Frame counter (bottom, like timecode)
    c.font = '8px monospace'
    c.fillStyle = 'rgba(200, 180, 140, 0.08)'
    c.textAlign = 'left'
    const fakeTimecode = `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(Math.floor(time) % 60).padStart(2, '0')}:${String(Math.floor((time * 24) % 24)).padStart(2, '0')}`
    c.fillText(`TC ${fakeTimecode}`, 32, h - 18)

    // Reel info
    c.fillText(`reel ${currentFrame + 1}/${frames.length}`, 32, h - 30)
    c.fillText(`condition: ${degradation < 0.2 ? 'good' : degradation < 0.5 ? 'worn' : degradation < 0.8 ? 'deteriorating' : 'critical'}`, 32, h - 42)

    // Title
    c.font = '10px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 180, 140, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.fillText('the projection room', w / 2, 25)

    // Context — cycling film references
    const quotes = [
      'after Gondry, Resnais, Tarkovsky, Marker',
      'blessed are the forgetful — Nietzsche / Eternal Sunshine',
      '"I remember that January in Tokyo" — Sans Soleil',
      'the Zone gives everyone what they ask for — Stalker',
    ]
    const quoteIdx = Math.floor(time * 0.03) % quotes.length
    c.font = '8px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 180, 140, ${0.03 + Math.sin(time * 0.15) * 0.01})`
    c.fillText(quotes[quoteIdx], w / 2, h - 4)
  }

  return {
    name: 'projection',
    label: 'the projection room',

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

      // Click to advance to next memory/reel
      canvas.addEventListener('click', () => {
        if (inLeader) {
          inLeader = false
          frameTime = 0
        } else {
          frameTime = 0
          currentFrame++
          if (frames.length > 0 && currentFrame >= frames.length) currentFrame = 0
        }
      })

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)

      // Navigation portals — styled as film reel numbers at edges
      if (deps.switchTo) {
        const portalData = [
          { name: 'darkroom', label: 'REEL I — darkroom', color: '200, 180, 140', pos: 'top: 50%; left: 6px; transform: translateY(-50%);' },
          { name: 'disintegration', label: 'REEL II — disintegration', color: '200, 160, 100', pos: 'top: 50%; right: 6px; transform: translateY(-50%);' },
          { name: 'library', label: 'REEL III — library', color: '180, 180, 200', pos: 'bottom: 50px; left: 32px;' },
          { name: 'madeleine', label: 'REEL IV — madeleine', color: '220, 190, 130', pos: 'bottom: 50px; right: 32px;' },
        ]
        for (const p of portalData) {
          const el = document.createElement('div')
          el.style.cssText = `
            position: absolute; ${p.pos}
            pointer-events: auto; cursor: pointer;
            font-family: monospace;
            font-size: 7px; letter-spacing: 2px;
            color: rgba(${p.color}, 0.06);
            transition: color 0.5s ease, text-shadow 0.5s ease;
            padding: 6px 8px; z-index: 10;
            writing-mode: ${p.pos.includes('left: 6px') || p.pos.includes('right: 6px') ? 'vertical-rl' : 'horizontal-tb'};
          `
          el.textContent = p.label
          el.addEventListener('mouseenter', () => {
            el.style.color = `rgba(${p.color}, 0.45)`
            el.style.textShadow = `0 0 10px rgba(${p.color}, 0.15)`
          })
          el.addEventListener('mouseleave', () => {
            el.style.color = `rgba(${p.color}, 0.06)`
            el.style.textShadow = 'none'
          })
          el.addEventListener('click', (e) => {
            e.stopPropagation()
            deps.switchTo!(p.name)
          })
          overlay.appendChild(el)
        }
      }

      return overlay
    },

    activate() {
      active = true
      inLeader = true
      leaderTime = 0
      leaderCount = 5
      currentFrame = 0
      frameTime = 0
      buildFrames()
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
