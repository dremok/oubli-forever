/**
 * THE PENDULUM — harmonics made visible
 *
 * A harmonograph simulator. Two coupled pendulums trace Lissajous-like
 * curves that slowly decay. The result is a drawing that looks like
 * something between a spirograph and a dying star.
 *
 * Drag to pull the pendulum into new shapes. Shift+Click to randomize.
 * Scroll to adjust decay rate. Move the cursor to gently perturb the trace.
 *
 * No memories. No text. Pure physics and geometry.
 * The beauty is in the transience: each pattern appears, evolves,
 * and vanishes. You can't save them. You can only watch.
 *
 * Inspired by: harmonographs, Lissajous curves, Spirograph,
 * pendulum wave machines, cymatics, the relationship between
 * oscillation and beauty, how simple forces create complex art,
 * Milan Cortina 2026 Olympics theme "armonia" — harmony made visible.
 */

import type { Room } from './RoomManager'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface PendulumDeps {
  switchTo?: (name: string) => void
}

interface PendulumState {
  freq: number
  phase: number
  amp: number
  decay: number
}

export function createPendulumRoom(deps?: PendulumDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let traceTime = 0
  let hoveredNav = -1

  // Cursor state (normalized -1..1 from center)
  let cursorX = 0
  let cursorY = 0

  // Drag state
  let isDragging = false

  // Audio state
  let audioInitialized = false
  let oscillators: OscillatorNode[] = []
  let oscGains: GainNode[] = []
  let delayNode: DelayNode | null = null
  let feedbackGain: GainNode | null = null
  let dryGain: GainNode | null = null
  let wetGain: GainNode | null = null
  let audioMaster: GainNode | null = null
  const BASE_HZ = 150

  // Directional markers on the floor — N/S/E/W compass-style
  const navPoints = [
    { label: 'N \u2191 instrument', room: 'instrument', xFrac: 0.5, yFrac: 0.04 },
    { label: 'S \u2193 clocktower', room: 'clocktower', xFrac: 0.5, yFrac: 0.97 },
    { label: 'W \u2190 automaton', room: 'automaton', xFrac: 0.03, yFrac: 0.5 },
    { label: 'E \u2192 cipher', room: 'cipher', xFrac: 0.97, yFrac: 0.5 },
  ]

  // Two pendulums for X, two for Y (full harmonograph has 4)
  let pendulums: PendulumState[] = []
  let hue = 330 // starting hue (pink)
  let fadeSpeed = 0.003 // how fast the trace fades

  // --- Audio ---

  async function initAudio() {
    if (audioInitialized) return
    try {
      const ac = await getAudioContext()
      const dest = getAudioDestination()

      // Master gain for this room
      audioMaster = ac.createGain()
      audioMaster.gain.value = 0
      audioMaster.connect(dest)

      // Delay-based reverb
      delayNode = ac.createDelay(1.0)
      delayNode.delayTime.value = 0.35
      feedbackGain = ac.createGain()
      feedbackGain.gain.value = 0.3
      dryGain = ac.createGain()
      dryGain.gain.value = 0.7
      wetGain = ac.createGain()
      wetGain.gain.value = 0.3

      // dry path
      dryGain.connect(audioMaster)
      // wet path: delay -> feedback loop, delay -> wetGain -> master
      delayNode.connect(feedbackGain)
      feedbackGain.connect(delayNode)
      delayNode.connect(wetGain)
      wetGain.connect(audioMaster)

      // Create 4 oscillators (one per pendulum)
      for (let i = 0; i < 4; i++) {
        const osc = ac.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = 220
        const g = ac.createGain()
        g.gain.value = 0
        osc.connect(g)
        g.connect(dryGain)
        g.connect(delayNode)
        osc.start()
        oscillators.push(osc)
        oscGains.push(g)
      }

      audioInitialized = true
    } catch {
      // Audio not available — silent fallback
    }
  }

  function updateAudioFromPendulums(smooth: boolean) {
    if (!audioInitialized || oscillators.length < 4) return
    const ac = oscillators[0].context
    const now = ac.currentTime
    const rampTime = smooth ? 1.5 : 0.01

    for (let i = 0; i < 4; i++) {
      const p = pendulums[i]
      if (!p) continue
      const freq = p.freq * BASE_HZ
      // Clamp to audible range
      const clampedFreq = Math.max(40, Math.min(2000, freq))
      oscillators[i].frequency.cancelScheduledValues(now)
      oscillators[i].frequency.setValueAtTime(oscillators[i].frequency.value, now)
      oscillators[i].frequency.linearRampToValueAtTime(clampedFreq, now + rampTime)
    }
  }

  function updateAudioDecay() {
    if (!audioInitialized || oscillators.length < 4) return
    // Set oscillator gains based on pendulum amplitude * exponential decay
    for (let i = 0; i < 4; i++) {
      const p = pendulums[i]
      if (!p) continue
      const envAmp = p.amp * Math.exp(-p.decay * traceTime)
      // Scale to a quiet listening level (0.03 - 0.08)
      const targetGain = Math.min(0.08, envAmp * 0.15)
      oscGains[i].gain.value = targetGain
    }
  }

  function fadeAudioIn() {
    if (!audioMaster) return
    const ac = audioMaster.context
    const now = ac.currentTime
    audioMaster.gain.cancelScheduledValues(now)
    audioMaster.gain.setValueAtTime(audioMaster.gain.value, now)
    audioMaster.gain.linearRampToValueAtTime(1.0, now + 0.5)
  }

  function fadeAudioOut() {
    if (!audioMaster) return
    const ac = audioMaster.context
    const now = ac.currentTime
    audioMaster.gain.cancelScheduledValues(now)
    audioMaster.gain.setValueAtTime(audioMaster.gain.value, now)
    audioMaster.gain.linearRampToValueAtTime(0, now + 0.3)
  }

  function destroyAudio() {
    fadeAudioOut()
    setTimeout(() => {
      for (const osc of oscillators) {
        try { osc.stop() } catch { /* already stopped */ }
      }
      for (const g of oscGains) {
        g.disconnect()
      }
      audioMaster?.disconnect()
      delayNode?.disconnect()
      feedbackGain?.disconnect()
      dryGain?.disconnect()
      wetGain?.disconnect()
      oscillators = []
      oscGains = []
      audioMaster = null
      delayNode = null
      feedbackGain = null
      dryGain = null
      wetGain = null
      audioInitialized = false
    }, 400)
  }

  // --- Pendulum Logic ---

  function randomize() {
    // Create 4 pendulums with interesting frequency ratios
    const ratios = [
      [1, 1], [2, 3], [3, 4], [3, 2], [4, 3], [5, 4],
      [2, 1], [3, 1], [1, 2], [1, 3], [5, 6], [7, 8],
    ]
    const ratio = ratios[Math.floor(Math.random() * ratios.length)]

    const baseFreq = 1 + Math.random() * 2

    pendulums = [
      // X pendulums
      {
        freq: baseFreq * ratio[0],
        phase: Math.random() * Math.PI * 2,
        amp: 0.3 + Math.random() * 0.15,
        decay: 0.0003 + Math.random() * 0.0005,
      },
      {
        freq: baseFreq * (ratio[0] + 0.002 * (Math.random() - 0.5)), // slight detuning
        phase: Math.random() * Math.PI * 2,
        amp: 0.05 + Math.random() * 0.1,
        decay: 0.0004 + Math.random() * 0.0004,
      },
      // Y pendulums
      {
        freq: baseFreq * ratio[1],
        phase: Math.random() * Math.PI * 2,
        amp: 0.3 + Math.random() * 0.15,
        decay: 0.0003 + Math.random() * 0.0005,
      },
      {
        freq: baseFreq * (ratio[1] + 0.002 * (Math.random() - 0.5)),
        phase: Math.random() * Math.PI * 2,
        amp: 0.05 + Math.random() * 0.1,
        decay: 0.0004 + Math.random() * 0.0004,
      },
    ]

    traceTime = 0
    hue = Math.random() * 360

    // Clear canvas with fade
    if (ctx && canvas) {
      ctx.fillStyle = 'rgba(3, 2, 8, 1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    // Update audio frequencies
    updateAudioFromPendulums(true)
  }

  function getPosition(t: number): [number, number] {
    let x = 0
    let y = 0

    // X = sum of first two pendulums + cursor perturbation
    x += pendulums[0].amp * Math.sin(pendulums[0].freq * t + pendulums[0].phase) * Math.exp(-pendulums[0].decay * t)
    x += pendulums[1].amp * Math.sin(pendulums[1].freq * t + pendulums[1].phase) * Math.exp(-pendulums[1].decay * t)
    // Y = sum of last two pendulums + cursor perturbation
    y += pendulums[2].amp * Math.sin(pendulums[2].freq * t + pendulums[2].phase) * Math.exp(-pendulums[2].decay * t)
    y += pendulums[3].amp * Math.sin(pendulums[3].freq * t + pendulums[3].phase) * Math.exp(-pendulums[3].decay * t)

    // Cursor-as-force: gentle perturbation based on mouse position
    const totalAmp = pendulums.reduce((sum, p) => sum + p.amp * Math.exp(-p.decay * t), 0)
    const forceFactor = 0.02 * totalAmp
    x += cursorX * forceFactor
    y += cursorY * forceFactor

    return [x, y]
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height
    const cx = w / 2
    const cy = h / 2
    const scale = Math.min(w, h) * 0.9

    // Very gentle fade — creates persistence effect
    ctx.fillStyle = `rgba(3, 2, 8, ${fadeSpeed})`
    ctx.fillRect(0, 0, w, h)

    if (pendulums.length === 0) return

    // Update audio decay envelope
    updateAudioDecay()

    // Draw many points per frame for smooth trace
    const stepsPerFrame = 40
    const dt = 0.15

    let lastScreenX = 0
    let lastScreenY = 0

    for (let i = 0; i < stepsPerFrame; i++) {
      traceTime += dt
      const [x, y] = getPosition(traceTime)

      // Check if pendulums have decayed to near-zero
      const totalAmp = pendulums.reduce((sum, p) =>
        sum + p.amp * Math.exp(-p.decay * traceTime), 0)

      if (totalAmp < 0.01) {
        // Pendulums have died — randomize new ones after a pause
        if (traceTime > 500) randomize()
        continue
      }

      const screenX = cx + x * scale
      const screenY = cy + y * scale

      // Color shifts slowly along the trace
      const traceHue = (hue + traceTime * 0.3) % 360
      const alpha = Math.min(0.6, totalAmp * 1.5)

      ctx.fillStyle = `hsla(${traceHue}, 50%, 60%, ${alpha})`
      ctx.beginPath()
      ctx.arc(screenX, screenY, 1, 0, Math.PI * 2)
      ctx.fill()

      lastScreenX = screenX
      lastScreenY = screenY

      // Larger glow point + pendulum arm for the current tip
      if (i === stepsPerFrame - 1) {
        // Pendulum arm: faint line from center to current point
        ctx.strokeStyle = `hsla(${traceHue}, 30%, 50%, ${alpha * 0.08})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(screenX, screenY)
        ctx.stroke()

        // Shadow of the arm (slightly offset)
        ctx.strokeStyle = `hsla(${traceHue}, 20%, 40%, ${alpha * 0.04})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(cx + 3, cy + 3)
        ctx.lineTo(screenX + 3, screenY + 3)
        ctx.stroke()

        // Enhanced glow at the tip (larger radius)
        const glow = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 14)
        glow.addColorStop(0, `hsla(${traceHue}, 70%, 80%, ${alpha * 0.6})`)
        glow.addColorStop(0.4, `hsla(${traceHue}, 60%, 70%, ${alpha * 0.25})`)
        glow.addColorStop(1, 'transparent')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(screenX, screenY, 14, 0, Math.PI * 2)
        ctx.fill()

        // Bright core dot
        ctx.fillStyle = `hsla(${traceHue}, 60%, 85%, ${alpha * 0.8})`
        ctx.beginPath()
        ctx.arc(screenX, screenY, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Small pivot dot at center
    ctx.fillStyle = 'rgba(180, 160, 200, 0.06)'
    ctx.beginPath()
    ctx.arc(cx, cy, 2, 0, Math.PI * 2)
    ctx.fill()

    // If dragging, show a pull line from cursor to the trace point
    if (isDragging && lastScreenX && lastScreenY) {
      const dragX = (cursorX * 0.5 + 0.5) * w
      const dragY = (cursorY * 0.5 + 0.5) * h
      ctx.strokeStyle = 'rgba(180, 160, 200, 0.1)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 6])
      ctx.beginPath()
      ctx.moveTo(dragX, dragY)
      ctx.lineTo(lastScreenX, lastScreenY)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Pendulum info (very subtle)
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(180, 160, 200, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the pendulum', w / 2, 25)

    // Frequency ratio display
    if (pendulums.length >= 4) {
      ctx.font = '9px monospace'
      ctx.fillStyle = 'rgba(180, 160, 200, 0.06)'
      ctx.textAlign = 'left'
      const r1 = pendulums[0].freq.toFixed(2)
      const r2 = pendulums[2].freq.toFixed(2)
      ctx.fillText(`x: ${r1}Hz \u00b7 y: ${r2}Hz`, 12, h - 30)
      ctx.fillText(`decay: ${(fadeSpeed * 1000).toFixed(1)}`, 12, h - 18)

      ctx.textAlign = 'right'
      ctx.fillText('drag to pull \u00b7 shift+click to reshape', w - 12, h - 30)
      ctx.fillText('scroll to adjust decay', w - 12, h - 18)
    }

    // Navigation portals — directional markers on the floor
    if (deps?.switchTo) {
      for (let i = 0; i < navPoints.length; i++) {
        const np = navPoints[i]
        const nx = w * np.xFrac
        const ny = h * np.yFrac
        const hovered = hoveredNav === i
        const a = hovered ? 0.3 : 0.05
        ctx.font = '8px monospace'
        ctx.fillStyle = `rgba(180, 160, 200, ${a})`
        ctx.textAlign = np.xFrac < 0.2 ? 'left' : np.xFrac > 0.8 ? 'right' : 'center'
        ctx.fillText(np.label, nx, ny)
        if (hovered) {
          ctx.fillStyle = 'rgba(180, 160, 200, 0.12)'
          ctx.beginPath()
          ctx.arc(nx, ny - 3, 3, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    // Hint
    ctx.font = '9px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(180, 160, 200, 0.04)'
    ctx.textAlign = 'center'
    ctx.fillText('each pattern is temporary. you cannot save them.', w / 2, h - 8)
  }

  return {
    name: 'pendulum',
    label: 'the pendulum',

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

      // Mousedown: start drag (or shift+click to randomize)
      canvas.addEventListener('mousedown', (e) => {
        // Check nav portals first
        if (deps?.switchTo && canvas) {
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

        if (e.shiftKey) {
          randomize()
          return
        }

        // Start drag-to-pull
        isDragging = true

        if (canvas) {
          // Set pendulum amplitudes and phases from cursor position
          const nx = (e.clientX / canvas.width - 0.5) * 2
          const ny = (e.clientY / canvas.height - 0.5) * 2
          const dist = Math.sqrt(nx * nx + ny * ny)

          // Reset trace and set new initial conditions based on pull position
          traceTime = 0
          if (ctx && canvas) {
            ctx.fillStyle = 'rgba(3, 2, 8, 1)'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
          }

          // Adjust amplitudes based on drag position
          for (let i = 0; i < 2; i++) {
            if (pendulums[i]) {
              pendulums[i].amp = Math.abs(nx) * 0.3 + 0.05
              pendulums[i].phase = Math.atan2(ny, nx) + i * 0.5
            }
          }
          for (let i = 2; i < 4; i++) {
            if (pendulums[i]) {
              pendulums[i].amp = Math.abs(ny) * 0.3 + 0.05
              pendulums[i].phase = Math.atan2(nx, ny) + (i - 2) * 0.5
            }
          }

          // Bigger pull = bigger amplitude
          if (pendulums[0]) pendulums[0].amp = Math.max(pendulums[0].amp, dist * 0.25)
          if (pendulums[2]) pendulums[2].amp = Math.max(pendulums[2].amp, dist * 0.25)

          updateAudioFromPendulums(true)
        }
      })

      canvas.addEventListener('mouseup', () => {
        isDragging = false
      })

      canvas.addEventListener('mouseleave', () => {
        isDragging = false
        cursorX = 0
        cursorY = 0
      })

      // Mousemove: update cursor for perturbation + nav hover + drag
      canvas.addEventListener('mousemove', (e) => {
        if (!canvas) return

        // Normalized -1..1 from center
        cursorX = (e.clientX / canvas.width - 0.5) * 2
        cursorY = (e.clientY / canvas.height - 0.5) * 2

        // Drag: continuously adjust pendulum parameters
        if (isDragging && pendulums.length >= 4) {
          // Springy: adjust amplitudes toward cursor position
          pendulums[0].amp += (Math.abs(cursorX) * 0.3 - pendulums[0].amp) * 0.05
          pendulums[2].amp += (Math.abs(cursorY) * 0.3 - pendulums[2].amp) * 0.05
          // Adjust phase slightly based on movement
          pendulums[0].phase += cursorX * 0.01
          pendulums[2].phase += cursorY * 0.01

          // Keep amplitudes bounded
          for (const p of pendulums) {
            p.amp = Math.max(0.02, Math.min(0.5, p.amp))
          }
        }

        // Navigation hover
        if (deps?.switchTo) {
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

      // Scroll to adjust fade speed (decay visibility)
      canvas.addEventListener('wheel', (e) => {
        fadeSpeed = Math.max(0.0005, Math.min(0.02, fadeSpeed + (e.deltaY > 0 ? 0.001 : -0.001)))
        e.preventDefault()
      }, { passive: false })

      const onResize = () => {
        if (canvas && ctx) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
          ctx.fillStyle = 'rgba(3, 2, 8, 1)'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)
      return overlay
    },

    activate() {
      active = true
      randomize()
      render()
      initAudio().then(() => {
        if (active) {
          updateAudioFromPendulums(false)
          fadeAudioIn()
        }
      })
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      fadeAudioOut()
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      destroyAudio()
      overlay?.remove()
    },
  }
}
