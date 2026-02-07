/**
 * THE CLOCK TOWER — time visualized through memory
 *
 * A room dominated by a massive clock face. But this isn't a normal
 * clock — the 12 positions correspond to your 12 most recent memories.
 * The hour hand points toward the memory that's degrading fastest.
 * The minute hand sweeps through time since your last visit.
 * The second hand ticks erratically — sometimes backwards.
 *
 * As memories degrade, their positions on the clock face distort:
 * numbers blur, the face cracks, the ticking becomes irregular.
 * At high degradation, the clock starts running backwards.
 *
 * There's a pendulum below the face that swings with a period
 * determined by your total time spent in Oubli across all sessions.
 *
 * Inspired by: Dalí's melting clocks, the Clock of the Long Now,
 * the doomsday clock, grandfather clocks in empty houses,
 * how dementia patients lose time perception, chronobiology
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'

interface ClockTowerDeps {
  getMemories: () => StoredMemory[]
}

export function createClockTowerRoom(deps: ClockTowerDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let pendulumAngle = 0
  let pendulumVelocity = 0
  let tickSound = 0 // visual tick flash

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height
    const cx = w / 2
    const cy = h * 0.4
    const radius = Math.min(w, h) * 0.28
    const memories = deps.getMemories()

    // Average degradation affects the clock's behavior
    const avgDeg = memories.length > 0
      ? memories.reduce((s, m) => s + m.degradation, 0) / memories.length
      : 0

    ctx.clearRect(0, 0, w, h)

    // Background — dark tower interior
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, h)
    bg.addColorStop(0, 'rgba(15, 12, 18, 1)')
    bg.addColorStop(1, 'rgba(5, 3, 8, 1)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // Tower walls — subtle stone texture lines
    ctx.strokeStyle = 'rgba(40, 35, 45, 0.08)'
    ctx.lineWidth = 0.5
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath()
      ctx.moveTo(0, y + Math.sin(y * 0.1) * 2)
      ctx.lineTo(w, y + Math.sin(y * 0.1 + 1) * 2)
      ctx.stroke()
    }

    // === CLOCK FACE ===

    // Outer ring
    ctx.beginPath()
    ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(180, 160, 120, ${0.1 - avgDeg * 0.05})`
    ctx.lineWidth = 2
    ctx.stroke()

    // Clock face background
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(20, 18, 25, ${0.8 + avgDeg * 0.15})`
    ctx.fill()

    // Cracks in the face (appear with degradation)
    if (avgDeg > 0.2) {
      ctx.strokeStyle = `rgba(60, 50, 40, ${avgDeg * 0.15})`
      ctx.lineWidth = 0.5
      for (let i = 0; i < Math.floor(avgDeg * 8); i++) {
        const angle = (i * 2.3) % (Math.PI * 2)
        const len = radius * (0.3 + avgDeg * 0.5)
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(angle) * 10, cy + Math.sin(angle) * 10)
        const endX = cx + Math.cos(angle + 0.2) * len
        const endY = cy + Math.sin(angle + 0.2) * len
        ctx.lineTo(endX, endY)
        ctx.stroke()
      }
    }

    // Hour markers — each position is a memory
    const displayMemories = memories.slice(0, 12)
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 - Math.PI / 2
      const markerDist = radius * 0.85
      const mx = cx + Math.cos(angle) * markerDist
      const my = cy + Math.sin(angle) * markerDist

      if (i < displayMemories.length) {
        const mem = displayMemories[i]
        const health = 1 - mem.degradation

        // Distortion — degraded memories wobble their position
        const wobble = mem.degradation * 5
        const wmx = mx + Math.sin(time * 2 + i) * wobble
        const wmy = my + Math.cos(time * 2 + i) * wobble

        // Memory marker
        ctx.beginPath()
        ctx.arc(wmx, wmy, 3 + health * 3, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${mem.hue * 360}, ${30 + health * 30}%, ${30 + health * 20}%, ${0.2 + health * 0.3})`
        ctx.fill()

        // Number (or degraded glyph)
        ctx.font = `${10 + health * 4}px "Cormorant Garamond", serif`
        ctx.fillStyle = `rgba(180, 160, 120, ${0.1 + health * 0.2})`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        if (health > 0.3) {
          ctx.fillText(String(i === 0 ? 12 : i), wmx, wmy)
        } else {
          // Degraded: show glitch character
          const glitchChars = '░▒▓█?·'
          ctx.fillText(glitchChars[Math.floor(time * 3 + i) % glitchChars.length], wmx, wmy)
        }

        // Memory text fragment below the marker (very faint)
        const textDist = radius * 0.65
        const tx = cx + Math.cos(angle) * textDist
        const ty = cy + Math.sin(angle) * textDist
        ctx.font = '8px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(180, 160, 120, ${health * 0.08})`
        const fragment = mem.currentText.slice(0, 12)
        ctx.fillText(fragment, tx, ty)
      } else {
        // Empty position — just a faint tick mark
        const tickInner = radius * 0.82
        const tickOuter = radius * 0.88
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(angle) * tickInner, cy + Math.sin(angle) * tickInner)
        ctx.lineTo(cx + Math.cos(angle) * tickOuter, cy + Math.sin(angle) * tickOuter)
        ctx.strokeStyle = 'rgba(180, 160, 120, 0.06)'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }

    // Minute ticks
    for (let i = 0; i < 60; i++) {
      if (i % 5 === 0) continue // skip hour positions
      const angle = (i / 60) * Math.PI * 2 - Math.PI / 2
      const tickInner = radius * 0.92
      const tickOuter = radius * 0.95
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(angle) * tickInner, cy + Math.sin(angle) * tickInner)
      ctx.lineTo(cx + Math.cos(angle) * tickOuter, cy + Math.sin(angle) * tickOuter)
      ctx.strokeStyle = 'rgba(180, 160, 120, 0.04)'
      ctx.lineWidth = 0.5
      ctx.stroke()
    }

    // === CLOCK HANDS ===

    const now = new Date()
    const realSeconds = now.getSeconds() + now.getMilliseconds() / 1000
    const realMinutes = now.getMinutes() + realSeconds / 60
    const realHours = (now.getHours() % 12) + realMinutes / 60

    // Time distortion from degradation
    const timeDistort = avgDeg * 0.5 // up to 50% time distortion
    const direction = avgDeg > 0.6 ? -1 : 1 // backwards at high degradation

    // Hour hand — points toward the degrading memory (or real time)
    const hourAngle = ((realHours * direction) / 12 * Math.PI * 2 - Math.PI / 2) +
      Math.sin(time * 0.1) * timeDistort * 0.5
    const hourLen = radius * 0.5
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(hourAngle) * hourLen, cy + Math.sin(hourAngle) * hourLen)
    ctx.strokeStyle = `rgba(180, 160, 120, ${0.25 - avgDeg * 0.1})`
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.stroke()

    // Minute hand
    const minuteAngle = ((realMinutes * direction) / 60 * Math.PI * 2 - Math.PI / 2) +
      Math.sin(time * 0.2) * timeDistort * 0.3
    const minuteLen = radius * 0.7
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(minuteAngle) * minuteLen, cy + Math.sin(minuteAngle) * minuteLen)
    ctx.strokeStyle = `rgba(180, 160, 120, ${0.2 - avgDeg * 0.08})`
    ctx.lineWidth = 2
    ctx.stroke()

    // Second hand — erratic ticking
    const secondJitter = avgDeg > 0.3 ? Math.sin(time * 8) * avgDeg * 0.3 : 0
    const secondAngle = ((realSeconds * direction) / 60 * Math.PI * 2 - Math.PI / 2) + secondJitter
    const secondLen = radius * 0.8
    ctx.beginPath()
    ctx.moveTo(cx - Math.cos(secondAngle) * 15, cy - Math.sin(secondAngle) * 15)
    ctx.lineTo(cx + Math.cos(secondAngle) * secondLen, cy + Math.sin(secondAngle) * secondLen)
    ctx.strokeStyle = `rgba(255, 80, 80, ${0.15 + tickSound * 0.2})`
    ctx.lineWidth = 1
    ctx.stroke()

    // Center pivot
    ctx.beginPath()
    ctx.arc(cx, cy, 4, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(180, 160, 120, 0.3)'
    ctx.fill()

    // Tick flash
    tickSound *= 0.95

    // Detect second hand crossing a new second
    const currentSecond = Math.floor(realSeconds)
    if (Math.abs(realSeconds - currentSecond) < 0.05) {
      tickSound = 0.5
    }

    // === PENDULUM ===
    const pendulumX = cx
    const pendulumTopY = cy + radius + 30
    const pendulumLength = h * 0.25

    // Physics-based pendulum
    const gravity = 0.0003
    const damping = 0.9999
    pendulumVelocity -= Math.sin(pendulumAngle) * gravity
    pendulumVelocity *= damping
    pendulumAngle += pendulumVelocity

    // Keep swinging with small kicks
    if (Math.abs(pendulumAngle) < 0.01 && Math.abs(pendulumVelocity) < 0.0001) {
      pendulumAngle = 0.15 // restart swing
    }

    const bobX = pendulumX + Math.sin(pendulumAngle) * pendulumLength
    const bobY = pendulumTopY + Math.cos(pendulumAngle) * pendulumLength

    // Pendulum rod
    ctx.beginPath()
    ctx.moveTo(pendulumX, pendulumTopY)
    ctx.lineTo(bobX, bobY)
    ctx.strokeStyle = 'rgba(180, 160, 120, 0.1)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Pendulum bob
    ctx.beginPath()
    ctx.arc(bobX, bobY, 12, 0, Math.PI * 2)
    const bobGrad = ctx.createRadialGradient(bobX, bobY, 0, bobX, bobY, 12)
    bobGrad.addColorStop(0, 'rgba(200, 180, 120, 0.15)')
    bobGrad.addColorStop(1, 'rgba(200, 180, 120, 0.02)')
    ctx.fillStyle = bobGrad
    ctx.fill()

    // === TITLE & INFO ===
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(180, 160, 120, ${0.08 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText('the clock tower', w / 2, 30)

    // Time display (degrading)
    const timeStr = now.toLocaleTimeString()
    const degradedTime = avgDeg > 0.2
      ? timeStr.split('').map(c => Math.random() < avgDeg * 0.3 ? '?' : c).join('')
      : timeStr
    ctx.font = '11px monospace'
    ctx.fillStyle = 'rgba(180, 160, 120, 0.1)'
    ctx.fillText(degradedTime, w / 2, h - 30)

    // Memory count
    ctx.font = '9px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(180, 160, 120, 0.06)'
    ctx.fillText(
      `${memories.length} memories on the face · ${Math.floor(avgDeg * 100)}% degraded`,
      w / 2, h - 15
    )

    // Direction indicator (when running backwards)
    if (avgDeg > 0.6) {
      ctx.font = '9px monospace'
      ctx.fillStyle = `rgba(255, 80, 80, ${0.1 + Math.sin(time * 2) * 0.05})`
      ctx.fillText('◄ time is running backwards', w / 2, cy + radius + 18)
    }
  }

  return {
    name: 'clocktower',
    label: 'the clock tower',

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
      pendulumAngle = 0.2
      pendulumVelocity = 0
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
