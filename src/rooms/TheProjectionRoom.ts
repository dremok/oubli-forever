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

interface Canister {
  room: string
  label: string
  x: number
  illumination: number
  hovered: boolean
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

  // Film canister shelf navigation
  const canisters: Canister[] = [
    { room: 'darkroom', label: 'I — darkroom', x: 0, illumination: 0, hovered: false },
    { room: 'disintegration', label: 'II — disintegration', x: 0, illumination: 0, hovered: false },
    { room: 'library', label: 'III — library', x: 0, illumination: 0, hovered: false },
    { room: 'madeleine', label: 'IV — madeleine', x: 0, illumination: 0, hovered: false },
  ]
  const CANISTER_W = 30
  const CANISTER_H = 40
  const SWEEP_PERIOD = 8 // seconds between light sweeps
  let navLeaderActive = false
  let navLeaderTime = 0
  let navLeaderTarget = ''
  let navLeaderLabel = ''

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

  function layoutCanisters(w: number) {
    const totalSlots = canisters.length
    const spacing = (w - 60) / (totalSlots + 1) // exclude sprocket strips
    for (let i = 0; i < canisters.length; i++) {
      canisters[i].x = 30 + spacing * (i + 1)
    }
  }

  function getCanisterRect(c: Canister, h: number) {
    const shelfY = h * 0.88
    return {
      x: c.x - CANISTER_W / 2,
      y: shelfY - CANISTER_H - 4,
      w: CANISTER_W,
      h: CANISTER_H,
    }
  }

  function hitTestCanisters(mx: number, my: number, h: number): Canister | null {
    for (const c of canisters) {
      const r = getCanisterRect(c, h)
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        return c
      }
    }
    return null
  }

  function drawShelfAndCanisters(c: CanvasRenderingContext2D, w: number, h: number) {
    const shelfY = h * 0.88

    // Wooden shelf — thin dark brown plank
    const shelfGrad = c.createLinearGradient(30, shelfY - 3, 30, shelfY + 5)
    shelfGrad.addColorStop(0, 'rgba(60, 40, 22, 0.7)')
    shelfGrad.addColorStop(0.5, 'rgba(45, 30, 15, 0.8)')
    shelfGrad.addColorStop(1, 'rgba(30, 20, 10, 0.6)')
    c.fillStyle = shelfGrad
    c.fillRect(30, shelfY - 3, w - 60, 8)

    // Shelf edge highlight
    c.strokeStyle = 'rgba(90, 65, 35, 0.3)'
    c.lineWidth = 0.5
    c.beginPath()
    c.moveTo(30, shelfY - 3)
    c.lineTo(w - 30, shelfY - 3)
    c.stroke()

    // Light sweep across shelf
    const sweepCycle = (time % SWEEP_PERIOD) / SWEEP_PERIOD
    // Sweep moves left-to-right during the middle portion of the cycle
    const sweepActive = sweepCycle > 0.3 && sweepCycle < 0.7
    const sweepX = sweepActive
      ? 30 + ((sweepCycle - 0.3) / 0.4) * (w - 60)
      : -999
    const sweepRadius = 80

    if (sweepActive) {
      // Draw the projector light leak on the shelf
      const leakGrad = c.createRadialGradient(sweepX, shelfY - CANISTER_H / 2, 0, sweepX, shelfY - CANISTER_H / 2, sweepRadius)
      leakGrad.addColorStop(0, 'rgba(255, 220, 140, 0.06)')
      leakGrad.addColorStop(1, 'transparent')
      c.fillStyle = leakGrad
      c.beginPath()
      c.arc(sweepX, shelfY - CANISTER_H / 2, sweepRadius, 0, Math.PI * 2)
      c.fill()
    }

    // Draw each canister
    for (const canister of canisters) {
      const rect = getCanisterRect(canister, h)

      // Update illumination from sweep
      if (sweepActive) {
        const dist = Math.abs(canister.x - sweepX)
        if (dist < sweepRadius) {
          const sweepIllum = (1 - dist / sweepRadius) * 0.45
          canister.illumination = Math.max(canister.illumination, sweepIllum)
        }
      }
      // Decay illumination
      canister.illumination = Math.max(0, canister.illumination - 0.004)

      // Determine label alpha
      const baseAlpha = 0.04
      const hoverBoost = canister.hovered ? 0.15 : 0
      const labelAlpha = Math.min(0.55, baseAlpha + canister.illumination + hoverBoost)

      // Canister body — rounded cylinder shape
      const cGrad = c.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y)
      const bodyAlpha = 0.15 + canister.illumination * 0.3 + (canister.hovered ? 0.1 : 0)
      cGrad.addColorStop(0, `rgba(40, 35, 28, ${bodyAlpha * 0.6})`)
      cGrad.addColorStop(0.3, `rgba(60, 50, 35, ${bodyAlpha})`)
      cGrad.addColorStop(0.7, `rgba(55, 45, 32, ${bodyAlpha})`)
      cGrad.addColorStop(1, `rgba(35, 30, 22, ${bodyAlpha * 0.6})`)

      // Draw rounded rect (canister body)
      const radius = 5
      c.beginPath()
      c.moveTo(rect.x + radius, rect.y)
      c.lineTo(rect.x + rect.w - radius, rect.y)
      c.arcTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + radius, radius)
      c.lineTo(rect.x + rect.w, rect.y + rect.h - radius)
      c.arcTo(rect.x + rect.w, rect.y + rect.h, rect.x + rect.w - radius, rect.y + rect.h, radius)
      c.lineTo(rect.x + radius, rect.y + rect.h)
      c.arcTo(rect.x, rect.y + rect.h, rect.x, rect.y + rect.h - radius, radius)
      c.lineTo(rect.x, rect.y + radius)
      c.arcTo(rect.x, rect.y, rect.x + radius, rect.y, radius)
      c.closePath()
      c.fillStyle = cGrad
      c.fill()

      // Canister rim — top cap
      c.fillStyle = `rgba(70, 58, 40, ${bodyAlpha * 0.8})`
      c.beginPath()
      c.ellipse(canister.x, rect.y + 2, CANISTER_W / 2, 4, 0, 0, Math.PI * 2)
      c.fill()

      // Label — small text on canister face
      c.font = '6px monospace'
      c.fillStyle = `rgba(200, 180, 140, ${labelAlpha})`
      c.textAlign = 'center'
      c.textBaseline = 'middle'

      // Split label into lines if needed
      const parts = canister.label.split(' — ')
      if (parts.length === 2) {
        c.fillText(parts[0], canister.x, rect.y + rect.h * 0.38)
        c.font = '5px monospace'
        c.fillText(parts[1], canister.x, rect.y + rect.h * 0.62)
      } else {
        c.fillText(canister.label, canister.x, rect.y + rect.h / 2)
      }

      // Hover glow
      if (canister.hovered) {
        const glow = c.createRadialGradient(canister.x, rect.y + rect.h / 2, 0, canister.x, rect.y + rect.h / 2, CANISTER_W)
        glow.addColorStop(0, 'rgba(255, 220, 140, 0.04)')
        glow.addColorStop(1, 'transparent')
        c.fillStyle = glow
        c.beginPath()
        c.arc(canister.x, rect.y + rect.h / 2, CANISTER_W, 0, Math.PI * 2)
        c.fill()
      }
    }

    c.textBaseline = 'alphabetic'
  }

  function drawNavLeader(c: CanvasRenderingContext2D, w: number, h: number) {
    navLeaderTime += 0.016

    // Fullscreen countdown leader overlay before navigating
    c.fillStyle = 'rgba(5, 4, 3, 0.92)'
    c.fillRect(0, 0, w, h)

    const count = Math.max(1, 3 - Math.floor(navLeaderTime))

    // Countdown number
    c.font = `bold ${Math.min(w * 0.25, 160)}px monospace`
    c.fillStyle = `rgba(200, 180, 140, ${0.25 + Math.sin(navLeaderTime * 10) * 0.08})`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(String(count), w / 2, h * 0.42)

    // Room name
    c.font = '14px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 180, 140, ${0.12 + navLeaderTime * 0.06})`
    c.fillText(`loading reel: ${navLeaderLabel}`, w / 2, h * 0.58)

    // Sweep line
    const sweepAngle = navLeaderTime * Math.PI * 3
    c.strokeStyle = 'rgba(200, 180, 140, 0.1)'
    c.lineWidth = 1.5
    c.beginPath()
    c.moveTo(w / 2, h / 2)
    c.lineTo(
      w / 2 + Math.cos(sweepAngle) * Math.min(w, h) * 0.3,
      h / 2 + Math.sin(sweepAngle) * Math.min(w, h) * 0.3,
    )
    c.stroke()

    // Circle
    c.strokeStyle = 'rgba(200, 180, 140, 0.06)'
    c.lineWidth = 1
    c.beginPath()
    c.arc(w / 2, h / 2, Math.min(w, h) * 0.28, 0, Math.PI * 2)
    c.stroke()

    c.textBaseline = 'alphabetic'

    // Navigate after the countdown
    if (navLeaderTime > 2.5) {
      navLeaderActive = false
      navLeaderTime = 0
      if (deps.switchTo) deps.switchTo(navLeaderTarget)
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

    // Layout canisters for current canvas size
    layoutCanisters(w)

    if (inLeader) {
      drawLeader(c, w, h)
      drawSprocketHoles(c, w, h)

      // Title
      c.font = '10px "Cormorant Garamond", serif'
      c.fillStyle = `rgba(200, 180, 140, ${0.06 + Math.sin(time * 0.3) * 0.02})`
      c.textAlign = 'center'
      c.fillText('the projection room', w / 2, 25)

      // Draw shelf even during leader
      if (deps.switchTo) drawShelfAndCanisters(c, w, h)
      if (navLeaderActive) drawNavLeader(c, w, h)
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

      // Draw shelf even with no frames
      if (deps.switchTo) drawShelfAndCanisters(c, w, h)
      if (navLeaderActive) drawNavLeader(c, w, h)
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

    // Film canister shelf navigation
    if (deps.switchTo) drawShelfAndCanisters(c, w, h)

    // Nav leader overlay (countdown before navigating)
    if (navLeaderActive) drawNavLeader(c, w, h)
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

      // Click handler — canisters or advance reel
      canvas.addEventListener('click', (e) => {
        if (!canvas || navLeaderActive) return
        const rect = canvas.getBoundingClientRect()
        const mx = (e.clientX - rect.left) * (canvas.width / rect.width)
        const my = (e.clientY - rect.top) * (canvas.height / rect.height)

        // Check canister hit first
        if (deps.switchTo) {
          const hit = hitTestCanisters(mx, my, canvas.height)
          if (hit) {
            navLeaderActive = true
            navLeaderTime = 0
            navLeaderTarget = hit.room
            navLeaderLabel = hit.label
            return
          }
        }

        // Default: advance reel
        if (inLeader) {
          inLeader = false
          frameTime = 0
        } else {
          frameTime = 0
          currentFrame++
          if (frames.length > 0 && currentFrame >= frames.length) currentFrame = 0
        }
      })

      // Mousemove handler for canister hover
      canvas.addEventListener('mousemove', (e) => {
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const mx = (e.clientX - rect.left) * (canvas.width / rect.width)
        const my = (e.clientY - rect.top) * (canvas.height / rect.height)

        let anyCursorChange = false
        for (const c of canisters) {
          const r = getCanisterRect(c, canvas.height)
          c.hovered = mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h
          if (c.hovered) anyCursorChange = true
        }
        canvas.style.cursor = anyCursorChange ? 'pointer' : 'default'
      })

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)

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
