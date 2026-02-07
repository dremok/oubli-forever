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

interface Stroke {
  points: { x: number; y: number }[]
  hue: number
  width: number
  birth: number
}

export function createSketchpadRoom(): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let strokes: Stroke[] = []
  let currentStroke: Stroke | null = null
  let drawHue = 330 // start with Oubli pink
  let brushWidth = 2
  let drawing = false
  let totalStrokes = 0

  const FADE_TIME = 60 // seconds before stroke fully fades

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const c = ctx
    const w = canvas.width
    const h = canvas.height

    // Background — very dark with subtle grain
    c.fillStyle = 'rgba(5, 3, 8, 1)'
    c.fillRect(0, 0, w, h)

    // Draw all strokes
    const now = time
    strokes = strokes.filter(stroke => {
      const age = now - stroke.birth
      if (age > FADE_TIME) return false // fully faded

      const alpha = Math.max(0, 1 - age / FADE_TIME)

      if (stroke.points.length < 2) return true

      c.strokeStyle = `hsla(${stroke.hue}, 60%, 60%, ${alpha * 0.7})`
      c.lineWidth = stroke.width
      c.lineCap = 'round'
      c.lineJoin = 'round'

      c.beginPath()
      c.moveTo(stroke.points[0].x, stroke.points[0].y)

      // Smooth curve through points
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const curr = stroke.points[i]
        const next = stroke.points[i + 1]
        const midX = (curr.x + next.x) / 2
        const midY = (curr.y + next.y) / 2
        c.quadraticCurveTo(curr.x, curr.y, midX, midY)
      }

      // Last point
      const last = stroke.points[stroke.points.length - 1]
      c.lineTo(last.x, last.y)
      c.stroke()

      // Glow effect for recent strokes
      if (age < 3) {
        c.strokeStyle = `hsla(${stroke.hue}, 70%, 70%, ${(1 - age / 3) * 0.2})`
        c.lineWidth = stroke.width + 4
        c.stroke()
      }

      return true
    })

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

    // Stats (very faint)
    c.font = '9px monospace'
    c.fillStyle = 'rgba(180, 160, 200, 0.06)'
    c.textAlign = 'left'
    c.fillText(`strokes: ${totalStrokes}`, 12, h - 30)
    c.fillText(`visible: ${strokes.length}`, 12, h - 18)
    c.textAlign = 'right'
    c.fillText(`hue: ${drawHue}`, w - 12, h - 30)
    c.fillText(`width: ${brushWidth}`, w - 12, h - 18)

    // Hint
    c.font = '9px "Cormorant Garamond", serif'
    c.fillStyle = 'rgba(180, 160, 200, 0.04)'
    c.textAlign = 'center'
    c.fillText('draw with light · scroll to change color · shift+scroll for width · double-click to clear', w / 2, h - 8)
  }

  function startStroke(x: number, y: number) {
    drawing = true
    currentStroke = {
      points: [{ x, y }],
      hue: drawHue,
      width: brushWidth,
      birth: time,
    }
  }

  function addPoint(x: number, y: number) {
    if (!currentStroke) return
    const last = currentStroke.points[currentStroke.points.length - 1]
    const dx = x - last.x
    const dy = y - last.y
    // Only add if moved enough
    if (dx * dx + dy * dy > 4) {
      currentStroke.points.push({ x, y })
    }
  }

  function endStroke() {
    if (currentStroke && currentStroke.points.length >= 2) {
      strokes.push(currentStroke)
      totalStrokes++
    }
    currentStroke = null
    drawing = false
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
        startStroke(e.clientX, e.clientY)
      })
      canvas.addEventListener('mousemove', (e) => {
        if (drawing) addPoint(e.clientX, e.clientY)
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
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      overlay?.remove()
    },
  }
}
