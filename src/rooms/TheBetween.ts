/**
 * THE BETWEEN — the space between rooms
 *
 * A hidden liminal room accessible from The Séance when you ask
 * about "between", "liminal", "threshold", "doorway", or "passage".
 * The séance responds with a special message and a faint link appears.
 *
 * The Between is a transitional space — neither one room nor another.
 * It renders as a long horizontal corridor with doors on either side,
 * each leading to a different room. The corridor stretches infinitely
 * in both directions. The aesthetic is liminal: fluorescent flicker,
 * beige walls, that uncanny backrooms feeling.
 *
 * But this isn't horror — it's contemplative. The between-spaces are
 * where transformation happens. The hallway between rooms is where
 * you decide who to be next.
 *
 * Each door is labeled with a room name. Clicking a door takes you
 * there. Some doors are locked (rooms you haven't visited yet).
 *
 * Inspired by: Liminal spaces, backrooms, hotel corridors,
 * the bardo (Tibetan Buddhism), threshold theory in anthropology,
 * the hallway as metaphor for transition states
 */

import type { Room } from './RoomManager'
import { ROOM_GRAPH } from '../navigation/RoomGraph'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface BetweenDeps {
  switchTo: (name: string) => void
  getActiveRoom: () => string
}

interface Door {
  name: string
  label: string
  color: string
  x: number
  side: 'left' | 'right'
}

interface ShadowFigure {
  x: number
  y: number
  alpha: number
  speed: number
  height: number
  phase: number // walking sway
}

// Color palette for doors — hashed from room name for consistency
function doorColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff
  const r = 80 + (h & 0xff) % 120
  const g = 80 + ((h >> 8) & 0xff) % 120
  const b = 80 + ((h >> 16) & 0xff) % 120
  return `rgba(${r}, ${g}, ${b}, 0.3)`
}

// Parse rgba components from a door color string
function parseDoorColor(color: string): { r: number; g: number; b: number } {
  const m = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return { r: 120, g: 110, b: 100 }
  return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) }
}

export function createBetweenRoom(deps: BetweenDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let scrollX = 0
  let scrollVelocity = 0
  let doors: Door[] = []
  let flickerPhase = 0

  // Hover state
  let hoveredDoor: Door | null = null
  let hoverGlow = 0 // 0..1 animated

  // Shadow figures
  let shadowFigures: ShadowFigure[] = []
  let nextShadowTime = 0

  // Wall stain seed (procedural, stable per session)
  const stainSeeds: { x: number; y: number; r: number; a: number }[] = []
  for (let i = 0; i < 40; i++) {
    stainSeeds.push({
      x: (Math.random() - 0.5) * 8000,
      y: 0.25 + Math.random() * 0.45,
      r: 8 + Math.random() * 25,
      a: 0.01 + Math.random() * 0.025,
    })
  }

  // Audio nodes
  let audioCtx: AudioContext | null = null
  let humGain: GainNode | null = null
  let humOscillators: OscillatorNode[] = []
  let doorCloseInterval: ReturnType<typeof setTimeout> | null = null
  let footstepInterval: ReturnType<typeof setInterval> | null = null
  let footstepGain: GainNode | null = null
  let audioInitialized = false

  // All non-hidden rooms become doors (the between connects everything)
  const ROOMS = ROOM_GRAPH
    .filter(r => !r.hidden && r.name !== 'between')
    .map(r => ({ name: r.name, label: r.label, color: doorColor(r.name) }))

  function buildDoors() {
    doors = []
    const spacing = 200
    for (let i = 0; i < ROOMS.length; i++) {
      const room = ROOMS[i]
      doors.push({
        name: room.name,
        label: room.label,
        color: room.color,
        x: (i - ROOMS.length / 2) * spacing,
        side: i % 2 === 0 ? 'left' : 'right',
      })
    }
  }

  // --- AUDIO ---

  async function initAudio() {
    if (audioInitialized) return
    try {
      audioCtx = await getAudioContext()
      const dest = getAudioDestination()

      // Master gain for this room
      humGain = audioCtx.createGain()
      humGain.gain.value = 0

      humGain.connect(dest)

      // Fluorescent hum: 60Hz fundamental + harmonics
      const freqs = [60, 120, 180]
      const gains = [0.02, 0.012, 0.006]
      for (let i = 0; i < freqs.length; i++) {
        const osc = audioCtx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freqs[i]

        const g = audioCtx.createGain()
        g.gain.value = gains[i]

        osc.connect(g)
        g.connect(humGain)
        osc.start()
        humOscillators.push(osc)
      }

      // Fade in
      humGain.gain.setTargetAtTime(1, audioCtx.currentTime, 0.5)

      // Footstep echo gain node
      footstepGain = audioCtx.createGain()
      footstepGain.gain.value = 0
      footstepGain.connect(dest)

      audioInitialized = true

      // Start distant door close sounds
      scheduleDoorClose()
    } catch {
      // Audio unavailable
    }
  }

  function scheduleDoorClose() {
    if (!active) return
    const delay = 15000 + Math.random() * 15000 // 15-30s
    doorCloseInterval = setTimeout(() => {
      playDoorClose()
      scheduleDoorClose()
    }, delay)
  }

  function playDoorClose() {
    if (!audioCtx || !active) return
    try {
      const dest = getAudioDestination()
      const now = audioCtx.currentTime

      // Filtered noise burst = distant door thud
      const bufferSize = audioCtx.sampleRate * 0.15
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        const env = Math.exp(-i / (bufferSize * 0.15))
        data[i] = (Math.random() * 2 - 1) * env
      }

      const source = audioCtx.createBufferSource()
      source.buffer = buffer

      const filter = audioCtx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 200
      filter.Q.value = 1.5

      const gain = audioCtx.createGain()
      gain.gain.value = 0.04

      // Pan randomly left or right
      const pan = audioCtx.createStereoPanner()
      pan.pan.value = Math.random() * 2 - 1

      source.connect(filter)
      filter.connect(gain)
      gain.connect(pan)
      pan.connect(dest)

      gain.gain.setValueAtTime(0.04, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)

      source.start(now)
      source.stop(now + 0.5)
    } catch {
      // Ignore audio errors
    }
  }

  function playFootstepTick() {
    if (!audioCtx || !footstepGain || !active) return
    const speed = Math.abs(scrollVelocity)
    if (speed < 0.5) {
      footstepGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1)
      return
    }

    try {
      const now = audioCtx.currentTime

      // Click = very short noise burst through a bandpass
      const bufLen = audioCtx.sampleRate * 0.03
      const buffer = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.1))
      }

      const source = audioCtx.createBufferSource()
      source.buffer = buffer

      const filter = audioCtx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 800 + Math.random() * 400
      filter.Q.value = 3

      const vol = Math.min(speed / 20, 1) * 0.025

      source.connect(filter)
      filter.connect(footstepGain)
      footstepGain.gain.setTargetAtTime(vol, now, 0.02)

      source.start(now)
      source.stop(now + 0.05)
    } catch {
      // Ignore
    }
  }

  function startFootsteps() {
    if (footstepInterval) return
    footstepInterval = setInterval(() => {
      const speed = Math.abs(scrollVelocity)
      if (speed < 0.5) return
      playFootstepTick()
    }, 200) // base rate, ~5 steps/sec max
  }

  function cleanupAudio() {
    if (humGain && audioCtx) {
      try {
        humGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.3)
      } catch { /* ignore */ }
    }

    // Stop oscillators after fade
    setTimeout(() => {
      for (const osc of humOscillators) {
        try { osc.stop() } catch { /* ignore */ }
        try { osc.disconnect() } catch { /* ignore */ }
      }
      humOscillators = []

      try { humGain?.disconnect() } catch { /* ignore */ }
      humGain = null

      try { footstepGain?.disconnect() } catch { /* ignore */ }
      footstepGain = null

      audioInitialized = false
    }, 500)

    if (doorCloseInterval) {
      clearTimeout(doorCloseInterval)
      doorCloseInterval = null
    }
    if (footstepInterval) {
      clearInterval(footstepInterval)
      footstepInterval = null
    }
  }

  // --- HOVER DETECTION ---

  function getDoorAtPoint(px: number, py: number): Door | null {
    if (!canvas) return null
    const w = canvas.width
    const h = canvas.height
    const centerX = w / 2

    for (const door of doors) {
      const screenX = centerX + door.x - scrollX
      const doorW = 60
      const doorH = h * 0.4
      const doorY = h * 0.35
      const doorX = screenX - doorW / 2

      if (px >= doorX && px <= doorX + doorW &&
          py >= doorY && py <= doorY + doorH) {
        return door
      }
    }
    return null
  }

  // --- SHADOW FIGURES ---

  function maybeSpawnShadow() {
    if (!canvas) return
    if (time < nextShadowTime) return
    nextShadowTime = time + 60 + Math.random() * 30 // 60-90s between figures

    const w = canvas.width
    const h = canvas.height
    const goingRight = Math.random() > 0.5
    shadowFigures.push({
      x: goingRight ? -50 : w + 50,
      y: h * 0.35 + h * 0.3, // bottom of wall area
      alpha: 0,
      speed: (goingRight ? 1 : -1) * (0.3 + Math.random() * 0.4),
      height: 40 + Math.random() * 30,
      phase: 0,
    })
  }

  function updateShadows() {
    if (!canvas) return
    const w = canvas.width
    for (const fig of shadowFigures) {
      fig.x += fig.speed
      fig.phase += 0.05

      // Fade in at the edges, fade out in the center area
      const edgeDist = Math.min(fig.x, w - fig.x)
      const edgeFade = Math.min(edgeDist / 100, 1)
      // Very faint
      fig.alpha = edgeFade * 0.04
    }
    // Remove figures that have crossed the screen
    shadowFigures = shadowFigures.filter(f => f.x > -100 && f.x < (canvas?.width ?? 2000) + 100)
  }

  function drawShadowFigures(ctx: CanvasRenderingContext2D, flicker: number) {
    for (const fig of shadowFigures) {
      if (fig.alpha <= 0) continue
      ctx.save()
      ctx.globalAlpha = fig.alpha * flicker

      // Simple human silhouette: head + body + legs with walking sway
      const sway = Math.sin(fig.phase) * 2
      const headR = fig.height * 0.12
      const bodyTop = fig.y - fig.height
      const headY = bodyTop - headR

      ctx.fillStyle = '#0a0908'

      // Head
      ctx.beginPath()
      ctx.arc(fig.x + sway, headY, headR, 0, Math.PI * 2)
      ctx.fill()

      // Body
      ctx.beginPath()
      ctx.moveTo(fig.x + sway - 6, bodyTop)
      ctx.lineTo(fig.x + sway + 6, bodyTop)
      ctx.lineTo(fig.x + sway + 5, fig.y - fig.height * 0.35)
      ctx.lineTo(fig.x + sway - 5, fig.y - fig.height * 0.35)
      ctx.closePath()
      ctx.fill()

      // Legs
      const legSway = Math.sin(fig.phase * 2) * 4
      ctx.beginPath()
      ctx.moveTo(fig.x + sway - 3, fig.y - fig.height * 0.35)
      ctx.lineTo(fig.x + sway - 3 + legSway, fig.y)
      ctx.lineTo(fig.x + sway + 1 + legSway, fig.y)
      ctx.lineTo(fig.x + sway + 1, fig.y - fig.height * 0.35)
      ctx.closePath()
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(fig.x + sway + 3, fig.y - fig.height * 0.35)
      ctx.lineTo(fig.x + sway + 3 - legSway, fig.y)
      ctx.lineTo(fig.x + sway - 1 - legSway, fig.y)
      ctx.lineTo(fig.x + sway - 1, fig.y - fig.height * 0.35)
      ctx.closePath()
      ctx.fill()

      ctx.restore()
    }
  }

  // --- RENDER ---

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016
    flickerPhase += 0.1

    const w = canvas.width
    const h = canvas.height
    const centerX = w / 2

    // Scroll physics: velocity-based with friction
    scrollX += scrollVelocity
    scrollVelocity *= 0.95 // friction
    // Slow ambient drift
    scrollVelocity += 0.003

    // Animate hover glow
    if (hoveredDoor) {
      hoverGlow = Math.min(hoverGlow + 0.08, 1)
    } else {
      hoverGlow = Math.max(hoverGlow - 0.06, 0)
    }

    // Update shadows
    maybeSpawnShadow()
    updateShadows()

    ctx.clearRect(0, 0, w, h)

    // Fluorescent flicker
    const flicker = 0.85 + Math.sin(flickerPhase * 3.7) * 0.05 +
      (Math.random() < 0.02 ? -0.3 : 0)

    // Ceiling
    ctx.fillStyle = `rgba(35, 32, 28, ${flicker})`
    ctx.fillRect(0, 0, w, h * 0.2)

    // Floor
    const floor = ctx.createLinearGradient(0, h * 0.75, 0, h)
    floor.addColorStop(0, `rgba(40, 35, 30, ${flicker})`)
    floor.addColorStop(1, `rgba(25, 22, 18, ${flicker})`)
    ctx.fillStyle = floor
    ctx.fillRect(0, h * 0.75, w, h * 0.25)

    // Walls
    ctx.fillStyle = `rgba(45, 40, 35, ${flicker * 0.9})`
    ctx.fillRect(0, h * 0.2, w, h * 0.55)

    // Wall stains (procedural discoloration)
    for (const stain of stainSeeds) {
      const stainScreenX = (stain.x - scrollX * 0.8) % w
      const sx = ((stainScreenX % w) + w) % w
      const sy = stain.y * h

      ctx.save()
      ctx.globalAlpha = stain.a * flicker
      ctx.beginPath()
      ctx.arc(sx, sy, stain.r, 0, Math.PI * 2)
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, stain.r)
      grad.addColorStop(0, 'rgba(30, 25, 20, 0.5)')
      grad.addColorStop(1, 'rgba(30, 25, 20, 0)')
      ctx.fillStyle = grad
      ctx.fill()
      ctx.restore()
    }

    // Floor tiles
    ctx.strokeStyle = `rgba(60, 55, 48, ${flicker * 0.15})`
    ctx.lineWidth = 0.5
    for (let tx = -200; tx < w + 200; tx += 60) {
      const tilePosX = ((tx - scrollX * 2) % 60 + 60) % 60
      ctx.beginPath()
      ctx.moveTo(tilePosX + tx - 60, h * 0.75)
      ctx.lineTo(tilePosX + tx - 60, h)
      ctx.stroke()
    }
    // Horizontal tile lines
    for (let ty = h * 0.75; ty < h; ty += 30) {
      ctx.beginPath()
      ctx.moveTo(0, ty)
      ctx.lineTo(w, ty)
      ctx.stroke()
    }

    // Ceiling lights
    for (let lx = 0; lx < w; lx += 150) {
      const lightX = ((lx - scrollX) % 150 + 150) % 150 + lx - 150
      // Light fixture
      ctx.fillStyle = `rgba(180, 175, 160, ${flicker * 0.2})`
      ctx.fillRect(lightX - 20, h * 0.2, 40, 4)
      // Light cone
      ctx.beginPath()
      ctx.moveTo(lightX - 15, h * 0.2 + 4)
      ctx.lineTo(lightX - 60, h * 0.45)
      ctx.lineTo(lightX + 60, h * 0.45)
      ctx.lineTo(lightX + 15, h * 0.2 + 4)
      ctx.closePath()
      ctx.fillStyle = `rgba(200, 190, 170, ${flicker * 0.015})`
      ctx.fill()
    }

    // Shadow figures (behind doors, in the far wall area)
    drawShadowFigures(ctx, flicker)

    // Doors
    const currentHover = hoveredDoor
    for (const door of doors) {
      const screenX = centerX + door.x - scrollX
      if (screenX < -100 || screenX > w + 100) continue

      const isHovered = currentHover === door
      const doorScale = isHovered ? 1 + hoverGlow * 0.04 : 1
      const doorW = 60 * doorScale
      const doorH = h * 0.4 * doorScale
      const doorY = h * 0.35 - (doorH - h * 0.4) / 2
      const doorX = screenX - doorW / 2

      // Floor reflections — faint mirror of door color below each door
      const { r: dr, g: dg, b: db } = parseDoorColor(door.color)
      const reflAlpha = flicker * 0.03 * (isHovered ? 1 + hoverGlow * 0.6 : 1)
      const reflGrad = ctx.createLinearGradient(0, h * 0.75, 0, h * 0.75 + 40)
      reflGrad.addColorStop(0, `rgba(${dr}, ${dg}, ${db}, ${reflAlpha})`)
      reflGrad.addColorStop(1, `rgba(${dr}, ${dg}, ${db}, 0)`)
      ctx.fillStyle = reflGrad
      ctx.fillRect(doorX + 5, h * 0.75, doorW - 10, 40)

      // Door frame
      const frameAlpha = flicker * (isHovered ? 0.5 + hoverGlow * 0.2 : 0.3)
      ctx.strokeStyle = `rgba(80, 70, 55, ${frameAlpha})`
      ctx.lineWidth = 2
      ctx.strokeRect(doorX, doorY, doorW, doorH)

      // Door fill — colored by room, brighter on hover
      const fillAlpha = flicker * (isHovered ? 0.25 + hoverGlow * 0.12 : 0.15)
      ctx.fillStyle = door.color.replace('0.3', String(fillAlpha))
      ctx.fillRect(doorX + 2, doorY + 2, doorW - 4, doorH - 4)

      // Door handle
      const handleAlpha = flicker * (isHovered ? 0.6 + hoverGlow * 0.3 : 0.3)
      ctx.beginPath()
      ctx.arc(doorX + doorW - 12, doorY + doorH / 2, isHovered ? 4 : 3, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(200, 180, 110, ${handleAlpha})`
      ctx.fill()

      // Light seeping from under door — brighter on hover
      const underAlpha = flicker * (isHovered ? 0.12 + hoverGlow * 0.08 : 0.05)
      ctx.fillStyle = door.color.replace('0.3', String(underAlpha))
      ctx.fillRect(doorX + 5, doorY + doorH - 2, doorW - 10, 4)

      // Under-door glow on hover — extends further
      if (isHovered && hoverGlow > 0.1) {
        const glowGrad = ctx.createLinearGradient(0, doorY + doorH, 0, doorY + doorH + 30)
        glowGrad.addColorStop(0, `rgba(${dr}, ${dg}, ${db}, ${hoverGlow * 0.08})`)
        glowGrad.addColorStop(1, `rgba(${dr}, ${dg}, ${db}, 0)`)
        ctx.fillStyle = glowGrad
        ctx.fillRect(doorX - 5, doorY + doorH, doorW + 10, 30)
      }

      // Label
      const labelAlpha = flicker * (isHovered ? 0.5 + hoverGlow * 0.3 : 0.25)
      const labelSize = isHovered ? 12 + hoverGlow * 2 : 10
      ctx.font = `${labelSize}px "Cormorant Garamond", serif`
      ctx.fillStyle = `rgba(200, 190, 170, ${labelAlpha})`
      ctx.textAlign = 'center'
      ctx.fillText(door.label, screenX, doorY + doorH + 18 + (isHovered ? 2 : 0))

      // Floating whisper text on hover — drifts upward near the door
      if (isHovered && hoverGlow > 0.3) {
        const whisperY = doorY - 10 - hoverGlow * 15
        const whisperAlpha = hoverGlow * 0.15 * flicker
        ctx.save()
        ctx.globalAlpha = whisperAlpha
        ctx.font = '12px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(${dr}, ${dg}, ${db}, 1)`
        ctx.textAlign = 'center'
        // Slight horizontal drift
        const drift = Math.sin(time * 1.5) * 5
        ctx.fillText(door.label, screenX + drift, whisperY)
        ctx.restore()
      }
    }

    // Corridor perspective lines
    ctx.strokeStyle = `rgba(60, 55, 48, ${flicker * 0.05})`
    ctx.lineWidth = 0.5
    // Baseboard
    ctx.beginPath()
    ctx.moveTo(0, h * 0.75)
    ctx.lineTo(w, h * 0.75)
    ctx.stroke()
    // Ceiling line
    ctx.beginPath()
    ctx.moveTo(0, h * 0.2)
    ctx.lineTo(w, h * 0.2)
    ctx.stroke()

    // Fog/haze at corridor extremes
    const fogWidth = w * 0.25
    // Left fog
    const leftFog = ctx.createLinearGradient(0, 0, fogWidth, 0)
    leftFog.addColorStop(0, `rgba(15, 13, 10, ${flicker * 0.6})`)
    leftFog.addColorStop(1, 'rgba(15, 13, 10, 0)')
    ctx.fillStyle = leftFog
    ctx.fillRect(0, 0, fogWidth, h)
    // Right fog
    const rightFog = ctx.createLinearGradient(w - fogWidth, 0, w, 0)
    rightFog.addColorStop(0, 'rgba(15, 13, 10, 0)')
    rightFog.addColorStop(1, `rgba(15, 13, 10, ${flicker * 0.6})`)
    ctx.fillStyle = rightFog
    ctx.fillRect(w - fogWidth, 0, fogWidth, h)

    // Title
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 190, 170, ${flicker * 0.08})`
    ctx.textAlign = 'center'
    ctx.fillText('the between', w / 2, h * 0.12)

    // Hint
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 190, 170, ${flicker * 0.05})`
    ctx.fillText('click a door to enter \u00b7 scroll to walk', w / 2, h * 0.92)
  }

  return {
    name: 'between',
    label: 'the between',
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
      canvas.style.cssText = 'width: 100%; height: 100%; cursor: default;'
      ctx = canvas.getContext('2d')

      buildDoors()

      // Scroll to walk — momentum-based
      canvas.addEventListener('wheel', (e) => {
        scrollVelocity += e.deltaY * 0.08
        e.preventDefault()
      }, { passive: false })

      // Mouse move for hover detection
      canvas.addEventListener('mousemove', (e) => {
        const door = getDoorAtPoint(e.clientX, e.clientY)
        if (door !== hoveredDoor) {
          hoveredDoor = door
        }
        if (canvas) {
          canvas.style.cursor = door ? 'pointer' : 'default'
        }
      })

      canvas.addEventListener('mouseleave', () => {
        hoveredDoor = null
        if (canvas) canvas.style.cursor = 'default'
      })

      // Click on doors
      canvas.addEventListener('click', (e) => {
        const door = getDoorAtPoint(e.clientX, e.clientY)
        if (door) {
          deps.switchTo(door.name)
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
      scrollX = 0
      scrollVelocity = 0
      hoveredDoor = null
      hoverGlow = 0
      shadowFigures = []
      nextShadowTime = time + 10 // first shadow after 10s
      render()
      initAudio()
      startFootsteps()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      cleanupAudio()
      hoveredDoor = null
      hoverGlow = 0
      if (canvas) canvas.style.cursor = 'default'
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      cleanupAudio()
      overlay?.remove()
    },
  }
}
