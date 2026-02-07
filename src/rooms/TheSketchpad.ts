/**
 * THE SKETCHPAD — draw in the dark
 *
 * A minimal drawing tool. Click and drag to draw with light.
 * The ink slowly fades. You can change hue with scroll wheel.
 * Double-click to clear.
 *
 * Drawings are impermanent — they dissolve over time.
 * You can't save, can't undo, can't export.
 * The only record is in your memory.
 *
 * This is the first functional/utility room in Oubli:
 * a tool that happens to exist inside an art piece.
 *
 * Inspired by: zen brushwork, blackboard, etch-a-sketch,
 * Harold and the Purple Crayon, cave paintings (the first art
 * was drawn in darkness), light painting photography
 */

import type { Room } from './RoomManager'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface Stroke {
  points: { x: number; y: number }[]
  hue: number
  width: number
  birth: number
  mirrored?: boolean
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  hue: number
  birth: number
  life: number // total lifespan in seconds
  size: number
}

interface SketchpadDeps {
  switchTo?: (name: string) => void
}

export function createSketchpadRoom(deps: SketchpadDeps = {}): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let strokes: Stroke[] = []
  let currentStroke: Stroke | null = null
  let mirrorStroke: Stroke | null = null
  let drawHue = 330 // start with Oubli pink
  let brushWidth = 2
  let drawing = false
  let totalStrokes = 0
  let hoveredLink = -1

  // Symmetry mode
  let symmetryMode = false

  // Particle system
  let particles: Particle[] = []
  const MAX_PARTICLES = 100

  // Speed tracking for pressure simulation and audio
  let lastMoveTime = 0
  let currentSpeed = 0

  // Audio state
  let audioInitialized = false
  let audioCtx: AudioContext | null = null
  let oscillator: OscillatorNode | null = null
  let oscGain: GainNode | null = null
  let reverbNode: ConvolverNode | null = null
  let reverbGain: GainNode | null = null
  let dryGain: GainNode | null = null
  let delayNode: DelayNode | null = null
  let delayFeedback: GainNode | null = null
  let delayWet: GainNode | null = null

  // Background breathing
  let breathPhase = 0

  const sketchLinks = [
    { label: 'darkroom', room: 'darkroom' },
    { label: 'pendulum', room: 'pendulum' },
    { label: 'loom', room: 'loom' },
  ]

  const FADE_TIME = 60 // seconds before stroke fully fades
  const GHOST_EXTRA = 8 // extra seconds ghosts linger after stroke fades

  // --- Audio setup ---
  async function initAudio() {
    if (audioInitialized) return
    try {
      audioCtx = await getAudioContext()
      const dest = getAudioDestination()

      // Oscillator -> oscGain -> [dry + reverb + delay] -> dest
      oscillator = audioCtx.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.value = 400

      oscGain = audioCtx.createGain()
      oscGain.gain.value = 0 // silent until drawing

      // Dry path
      dryGain = audioCtx.createGain()
      dryGain.gain.value = 0.5

      // Reverb (impulse response from noise burst)
      reverbNode = audioCtx.createConvolver()
      const sampleRate = audioCtx.sampleRate
      const reverbLength = sampleRate * 2.5
      const impulse = audioCtx.createBuffer(2, reverbLength, sampleRate)
      for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch)
        for (let i = 0; i < reverbLength; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / reverbLength, 2.5)
        }
      }
      reverbNode.buffer = impulse

      reverbGain = audioCtx.createGain()
      reverbGain.gain.value = 0.3

      // Delay
      delayNode = audioCtx.createDelay(1.0)
      delayNode.delayTime.value = 0.35
      delayFeedback = audioCtx.createGain()
      delayFeedback.gain.value = 0.3
      delayWet = audioCtx.createGain()
      delayWet.gain.value = 0.2

      // Wire: osc -> oscGain -> dry -> dest
      oscillator.connect(oscGain)
      oscGain.connect(dryGain)
      dryGain.connect(dest)

      // Wire: oscGain -> reverb -> reverbGain -> dest
      oscGain.connect(reverbNode)
      reverbNode.connect(reverbGain)
      reverbGain.connect(dest)

      // Wire: oscGain -> delay -> delayWet -> dest, delay -> feedback -> delay
      oscGain.connect(delayNode)
      delayNode.connect(delayWet)
      delayWet.connect(dest)
      delayNode.connect(delayFeedback)
      delayFeedback.connect(delayNode)

      oscillator.start()
      audioInitialized = true
    } catch (_e) {
      // Audio not available, that's fine
    }
  }

  function updateAudio(x: number, y: number, speed: number) {
    if (!audioInitialized || !oscillator || !oscGain || !audioCtx) return
    const now = audioCtx.currentTime
    const h = canvas?.height || window.innerHeight

    // Pitch: 200Hz at bottom, 800Hz at top
    const normalizedY = 1 - Math.max(0, Math.min(1, y / h))
    const freq = 200 + normalizedY * 600
    oscillator.frequency.cancelScheduledValues(now)
    oscillator.frequency.setValueAtTime(oscillator.frequency.value, now)
    oscillator.frequency.linearRampToValueAtTime(freq, now + 0.05)

    // Volume: base 0.04, scales up slightly with speed (max ~0.09)
    const speedFactor = Math.min(1, speed / 800)
    const vol = 0.04 + speedFactor * 0.05
    oscGain.gain.cancelScheduledValues(now)
    oscGain.gain.setValueAtTime(oscGain.gain.value, now)
    oscGain.gain.linearRampToValueAtTime(vol, now + 0.03)
  }

  function fadeOutAudio() {
    if (!audioInitialized || !oscGain || !audioCtx) return
    const now = audioCtx.currentTime
    oscGain.gain.cancelScheduledValues(now)
    oscGain.gain.setValueAtTime(oscGain.gain.value, now)
    oscGain.gain.linearRampToValueAtTime(0, now + 0.3)
  }

  function teardownAudio() {
    if (oscillator) {
      try { oscillator.stop() } catch (_e) { /* already stopped */ }
      oscillator.disconnect()
      oscillator = null
    }
    if (oscGain) { oscGain.disconnect(); oscGain = null }
    if (dryGain) { dryGain.disconnect(); dryGain = null }
    if (reverbNode) { reverbNode.disconnect(); reverbNode = null }
    if (reverbGain) { reverbGain.disconnect(); reverbGain = null }
    if (delayNode) { delayNode.disconnect(); delayNode = null }
    if (delayFeedback) { delayFeedback.disconnect(); delayFeedback = null }
    if (delayWet) { delayWet.disconnect(); delayWet = null }
    audioInitialized = false
    audioCtx = null
  }

  // --- Particle system ---
  function spawnParticle(x: number, y: number, hue: number) {
    if (particles.length >= MAX_PARTICLES) {
      // Remove oldest
      particles.shift()
    }
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -(Math.random() * 0.3 + 0.15), // drift upward
      hue,
      birth: time,
      life: 2 + Math.random() * 2, // 2-4 second lifespan
      size: 1 + Math.random() * 1.5,
    })
  }

  function updateAndDrawParticles(c: CanvasRenderingContext2D) {
    particles = particles.filter(p => {
      const age = time - p.birth
      if (age > p.life) return false

      // Update position
      p.x += p.vx
      p.y += p.vy
      p.vy -= 0.002 // slight upward acceleration

      const alpha = Math.max(0, 1 - age / p.life) * 0.4
      const size = p.size * (1 - age / p.life * 0.5)

      c.fillStyle = `hsla(${p.hue}, 70%, 70%, ${alpha})`
      c.beginPath()
      c.arc(p.x, p.y, size, 0, Math.PI * 2)
      c.fill()

      return true
    })
  }

  // --- Brush pressure (speed-based width) ---
  function getPressureWidth(baseWidth: number, speed: number): number {
    // Faster = thinner, slower = thicker. +/- 30%
    const speedNorm = Math.min(1, speed / 600)
    const factor = 1.3 - speedNorm * 0.6 // 1.3 at rest, 0.7 at max speed
    return baseWidth * factor
  }

  // --- Grain texture ---
  function drawGrain(c: CanvasRenderingContext2D, w: number, h: number) {
    const imageData = c.getImageData(0, 0, w, h)
    const data = imageData.data
    // Sparse grain — only touch ~5% of pixels for performance
    const step = 20
    for (let i = 0; i < data.length; i += step * 4) {
      const noise = (Math.random() - 0.5) * 8
      data[i] = Math.max(0, Math.min(255, data[i] + noise))
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise))
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise))
    }
    c.putImageData(imageData, 0, 0)
  }

  // --- Drawing a stroke path (reusable for normal + mirror) ---
  function drawStrokePath(c: CanvasRenderingContext2D, points: { x: number; y: number }[], hue: number, width: number, alpha: number, glow: boolean, glowAlpha: number) {
    if (points.length < 2) return

    c.strokeStyle = `hsla(${hue}, 60%, 60%, ${alpha})`
    c.lineWidth = width
    c.lineCap = 'round'
    c.lineJoin = 'round'

    c.beginPath()
    c.moveTo(points[0].x, points[0].y)

    for (let i = 1; i < points.length - 1; i++) {
      const curr = points[i]
      const next = points[i + 1]
      const midX = (curr.x + next.x) / 2
      const midY = (curr.y + next.y) / 2
      c.quadraticCurveTo(curr.x, curr.y, midX, midY)
    }

    const last = points[points.length - 1]
    c.lineTo(last.x, last.y)
    c.stroke()

    if (glow) {
      c.strokeStyle = `hsla(${hue}, 70%, 70%, ${glowAlpha})`
      c.lineWidth = width + 4
      c.stroke()
    }
  }

  // --- Mirror points across center ---
  function mirrorPoints(points: { x: number; y: number }[]): { x: number; y: number }[] {
    const w = canvas?.width || window.innerWidth
    return points.map(p => ({ x: w - p.x, y: p.y }))
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const c = ctx
    const w = canvas.width
    const h = canvas.height

    // Background breathing — subtle pulse
    breathPhase += 0.008
    const breathR = 5 + Math.sin(breathPhase) * 0.5
    const breathG = 3 + Math.sin(breathPhase * 0.7) * 0.5
    const breathB = 8 + Math.sin(breathPhase * 1.1) * 0.5
    c.fillStyle = `rgb(${Math.round(breathR)}, ${Math.round(breathG)}, ${Math.round(breathB)})`
    c.fillRect(0, 0, w, h)

    // Draw ghost afterimages (faded strokes that linger slightly longer)
    const now = time
    for (const stroke of strokes) {
      const age = now - stroke.birth
      if (age > FADE_TIME && age <= FADE_TIME + GHOST_EXTRA) {
        const ghostAlpha = Math.max(0, 1 - (age - FADE_TIME) / GHOST_EXTRA) * 0.04
        if (stroke.points.length >= 2) {
          drawStrokePath(c, stroke.points, stroke.hue, stroke.width, ghostAlpha, false, 0)
        }
      }
    }

    // Draw all strokes
    strokes = strokes.filter(stroke => {
      const age = now - stroke.birth
      if (age > FADE_TIME + GHOST_EXTRA) return false // ghost also gone

      if (age > FADE_TIME) return true // keep for ghost rendering above

      const alpha = Math.max(0, 1 - age / FADE_TIME)

      if (stroke.points.length < 2) return true

      const isRecent = age < 3
      const glowAlpha = isRecent ? (1 - age / 3) * 0.2 : 0
      drawStrokePath(c, stroke.points, stroke.hue, stroke.width, alpha * 0.7, isRecent, glowAlpha)

      return true
    })

    // Particles
    updateAndDrawParticles(c)

    // Current stroke being drawn
    if (currentStroke && currentStroke.points.length >= 2) {
      c.strokeStyle = `hsla(${currentStroke.hue}, 70%, 65%, 0.8)`
      c.lineWidth = currentStroke.width
      c.lineCap = 'round'
      c.lineJoin = 'round'

      c.beginPath()
      c.moveTo(currentStroke.points[0].x, currentStroke.points[0].y)
      for (let i = 1; i < currentStroke.points.length; i++) {
        c.lineTo(currentStroke.points[i].x, currentStroke.points[i].y)
      }
      c.stroke()

      // Active glow
      c.strokeStyle = `hsla(${currentStroke.hue}, 70%, 70%, 0.2)`
      c.lineWidth = currentStroke.width + 6
      c.stroke()
    }

    // Mirror stroke (current, while drawing)
    if (mirrorStroke && mirrorStroke.points.length >= 2) {
      const mp = mirrorPoints(mirrorStroke.points)
      c.strokeStyle = `hsla(${mirrorStroke.hue}, 70%, 65%, 0.8)`
      c.lineWidth = mirrorStroke.width
      c.lineCap = 'round'
      c.lineJoin = 'round'

      c.beginPath()
      c.moveTo(mp[0].x, mp[0].y)
      for (let i = 1; i < mp.length; i++) {
        c.lineTo(mp[i].x, mp[i].y)
      }
      c.stroke()

      c.strokeStyle = `hsla(${mirrorStroke.hue}, 70%, 70%, 0.2)`
      c.lineWidth = mirrorStroke.width + 6
      c.stroke()
    }

    // Grain (subtle, applied after strokes)
    drawGrain(c, w, h)

    // Cursor color indicator
    if (!drawing) {
      const ix = w - 30
      const iy = 30
      c.fillStyle = `hsla(${drawHue}, 60%, 60%, 0.4)`
      c.beginPath()
      c.arc(ix, iy, brushWidth + 3, 0, Math.PI * 2)
      c.fill()
    }

    // Title
    c.font = '10px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(180, 160, 200, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.fillText('the sketchpad', w / 2, 25)

    // Symmetry indicator
    if (symmetryMode) {
      c.font = '9px "Cormorant Garamond", serif'
      c.fillStyle = `rgba(180, 160, 200, ${0.12 + Math.sin(time * 0.5) * 0.03})`
      c.textAlign = 'center'
      c.fillText('\u25C7 symmetric', w / 2, 40)
    }

    // Stats (very faint)
    c.font = '9px monospace'
    c.fillStyle = 'rgba(180, 160, 200, 0.06)'
    c.textAlign = 'left'
    c.fillText(`strokes: ${totalStrokes}`, 12, h - 30)
    c.fillText(`visible: ${strokes.length}`, 12, h - 18)
    c.textAlign = 'right'
    c.fillText(`hue: ${drawHue}`, w - 12, h - 30)
    c.fillText(`width: ${brushWidth}`, w - 12, h - 18)

    // Navigation links (bottom corners)
    if (deps.switchTo) {
      const linkY = h - 50
      const positions = [20, w / 2, w - 20]
      const aligns: CanvasTextAlign[] = ['left', 'center', 'right']
      for (let i = 0; i < sketchLinks.length; i++) {
        const hovered = hoveredLink === i
        c.font = '8px "Cormorant Garamond", serif'
        c.fillStyle = `rgba(180, 160, 200, ${hovered ? 0.25 : 0.04})`
        c.textAlign = aligns[i]
        c.fillText(sketchLinks[i].label, positions[i], linkY)
      }
    }

    // Hint
    c.font = '9px "Cormorant Garamond", serif'
    c.fillStyle = 'rgba(180, 160, 200, 0.04)'
    c.textAlign = 'center'
    c.fillText('draw with light \u00B7 scroll to change color \u00B7 shift+scroll for width \u00B7 S for symmetry \u00B7 double-click to clear', w / 2, h - 8)
  }

  function startStroke(x: number, y: number) {
    drawing = true
    const pressureW = getPressureWidth(brushWidth, currentSpeed)
    currentStroke = {
      points: [{ x, y }],
      hue: drawHue,
      width: pressureW,
      birth: time,
    }
    if (symmetryMode) {
      mirrorStroke = {
        points: [{ x, y }],
        hue: (drawHue + 30) % 360,
        width: pressureW,
        birth: time,
      }
    }
    lastMoveTime = performance.now()

    // Start audio
    initAudio().then(() => {
      if (drawing) updateAudio(x, y, 0)
    })
  }

  function addPoint(x: number, y: number) {
    if (!currentStroke) return
    const last = currentStroke.points[currentStroke.points.length - 1]
    const dx = x - last.x
    const dy = y - last.y
    // Only add if moved enough
    if (dx * dx + dy * dy > 4) {
      // Calculate speed
      const now = performance.now()
      const dt = Math.max(1, now - lastMoveTime)
      const dist = Math.sqrt(dx * dx + dy * dy)
      currentSpeed = (dist / dt) * 1000 // pixels per second
      lastMoveTime = now

      // Pressure-adjusted width
      const pressureW = getPressureWidth(brushWidth, currentSpeed)
      currentStroke.width = pressureW

      currentStroke.points.push({ x, y })

      if (mirrorStroke) {
        mirrorStroke.points.push({ x, y })
        mirrorStroke.width = pressureW
      }

      // Spawn particle at brush position
      spawnParticle(x, y, drawHue)
      if (symmetryMode) {
        const w = canvas?.width || window.innerWidth
        spawnParticle(w - x, y, (drawHue + 30) % 360)
      }

      // Update audio
      updateAudio(x, y, currentSpeed)
    }
  }

  function endStroke() {
    if (currentStroke && currentStroke.points.length >= 2) {
      strokes.push(currentStroke)
      totalStrokes++
    }
    if (mirrorStroke && mirrorStroke.points.length >= 2) {
      // Store mirrored points directly so they render correctly as a normal stroke
      const mirrored: Stroke = {
        points: mirrorPoints(mirrorStroke.points),
        hue: mirrorStroke.hue,
        width: mirrorStroke.width,
        birth: mirrorStroke.birth,
        mirrored: true,
      }
      strokes.push(mirrored)
      totalStrokes++
    }
    currentStroke = null
    mirrorStroke = null
    drawing = false
    currentSpeed = 0

    // Fade out audio
    fadeOutAudio()
  }

  // Keyboard handler for symmetry toggle
  function onKeyDown(e: KeyboardEvent) {
    if (!active) return
    if (e.key === 's' || e.key === 'S') {
      // Don't toggle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      symmetryMode = !symmetryMode
    }
  }

  return {
    name: 'sketchpad',
    label: 'the sketchpad',

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
      canvas.style.cssText = 'width: 100%; height: 100%; cursor: crosshair;'
      ctx = canvas.getContext('2d')

      // Mouse events
      canvas.addEventListener('mousedown', (e) => {
        // Check navigation links
        if (deps.switchTo && canvas) {
          const linkY = canvas.height - 50
          const positions = [20, canvas.width / 2, canvas.width - 20]
          for (let i = 0; i < sketchLinks.length; i++) {
            if (Math.abs(e.clientY - linkY) < 12 && Math.abs(e.clientX - positions[i]) < 40) {
              deps.switchTo(sketchLinks[i].room)
              return
            }
          }
        }
        startStroke(e.clientX, e.clientY)
      })
      canvas.addEventListener('mousemove', (e) => {
        if (drawing) addPoint(e.clientX, e.clientY)
        // Hover for links
        if (canvas) {
          hoveredLink = -1
          const linkY = canvas.height - 50
          const positions = [20, canvas.width / 2, canvas.width - 20]
          for (let i = 0; i < sketchLinks.length; i++) {
            if (Math.abs(e.clientY - linkY) < 12 && Math.abs(e.clientX - positions[i]) < 40) {
              hoveredLink = i
              break
            }
          }
        }
      })
      canvas.addEventListener('mouseup', () => endStroke())
      canvas.addEventListener('mouseleave', () => endStroke())

      // Touch events
      canvas.addEventListener('touchstart', (e) => {
        e.preventDefault()
        const t = e.touches[0]
        startStroke(t.clientX, t.clientY)
      }, { passive: false })
      canvas.addEventListener('touchmove', (e) => {
        e.preventDefault()
        const t = e.touches[0]
        if (drawing) addPoint(t.clientX, t.clientY)
      }, { passive: false })
      canvas.addEventListener('touchend', (e) => {
        e.preventDefault()
        endStroke()
      })

      // Double-click to clear
      canvas.addEventListener('dblclick', () => {
        strokes = []
        particles = []
      })

      // Scroll to change hue, shift+scroll for width
      canvas.addEventListener('wheel', (e) => {
        if (e.shiftKey) {
          brushWidth = Math.max(1, Math.min(20, brushWidth + (e.deltaY > 0 ? 1 : -1)))
        } else {
          drawHue = ((drawHue + (e.deltaY > 0 ? 10 : -10)) % 360 + 360) % 360
        }
        e.preventDefault()
      }, { passive: false })

      // Symmetry toggle
      window.addEventListener('keydown', onKeyDown)

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
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      fadeOutAudio()
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      window.removeEventListener('keydown', onKeyDown)
      teardownAudio()
      overlay?.remove()
    },
  }
}
