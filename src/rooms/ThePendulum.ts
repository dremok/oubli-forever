/**
 * THE PENDULUM — harmonics made visible
 *
 * A harmonograph simulator. Two coupled pendulums trace Lissajous-like
 * curves that slowly decay. The result is a drawing that looks like
 * something between a spirograph and a dying star.
 *
 * Click to randomize parameters. Scroll to adjust decay rate.
 * The trace slowly fades — each drawing is temporary.
 *
 * No memories. No text. Pure physics and geometry.
 * The beauty is in the transience: each pattern appears, evolves,
 * and vanishes. You can't save them. You can only watch.
 *
 * Inspired by: harmonographs, Lissajous curves, Spirograph,
 * pendulum wave machines, cymatics, the relationship between
 * oscillation and beauty, how simple forces create complex art
 */

import type { Room } from './RoomManager'

interface PendulumState {
  freq: number
  phase: number
  amp: number
  decay: number
}

export function createPendulumRoom(): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let traceTime = 0

  // Two pendulums for X, two for Y (full harmonograph has 4)
  let pendulums: PendulumState[] = []
  let hue = 330 // starting hue (pink)
  let fadeSpeed = 0.003 // how fast the trace fades

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
  }

  function getPosition(t: number): [number, number] {
    let x = 0
    let y = 0
    // X = sum of first two pendulums
    x += pendulums[0].amp * Math.sin(pendulums[0].freq * t + pendulums[0].phase) * Math.exp(-pendulums[0].decay * t)
    x += pendulums[1].amp * Math.sin(pendulums[1].freq * t + pendulums[1].phase) * Math.exp(-pendulums[1].decay * t)
    // Y = sum of last two pendulums
    y += pendulums[2].amp * Math.sin(pendulums[2].freq * t + pendulums[2].phase) * Math.exp(-pendulums[2].decay * t)
    y += pendulums[3].amp * Math.sin(pendulums[3].freq * t + pendulums[3].phase) * Math.exp(-pendulums[3].decay * t)
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

    // Draw many points per frame for smooth trace
    const stepsPerFrame = 40
    const dt = 0.15

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

      // Larger glow point for the current tip
      if (i === stepsPerFrame - 1) {
        const glow = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 6)
        glow.addColorStop(0, `hsla(${traceHue}, 60%, 70%, ${alpha * 0.5})`)
        glow.addColorStop(1, 'transparent')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(screenX, screenY, 6, 0, Math.PI * 2)
        ctx.fill()
      }
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
      ctx.fillText(`x: ${r1}Hz · y: ${r2}Hz`, 12, h - 30)
      ctx.fillText(`decay: ${(fadeSpeed * 1000).toFixed(1)}`, 12, h - 18)

      ctx.textAlign = 'right'
      ctx.fillText('click to reshape', w - 12, h - 30)
      ctx.fillText('scroll to adjust decay', w - 12, h - 18)
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
      canvas.style.cssText = 'width: 100%; height: 100%; cursor: pointer;'
      ctx = canvas.getContext('2d')

      // Click to randomize
      canvas.addEventListener('click', () => {
        randomize()
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
