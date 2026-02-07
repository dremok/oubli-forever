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

// Color palette for doors — hashed from room name for consistency
function doorColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff
  const r = 80 + (h & 0xff) % 120
  const g = 80 + ((h >> 8) & 0xff) % 120
  const b = 80 + ((h >> 16) & 0xff) % 120
  return `rgba(${r}, ${g}, ${b}, 0.3)`
}

export function createBetweenRoom(deps: BetweenDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let scrollX = 0
  let doors: Door[] = []
  let flickerPhase = 0

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

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016
    flickerPhase += 0.1

    const w = canvas.width
    const h = canvas.height
    const centerX = w / 2

    // Slow drift
    scrollX += 0.2

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

    // Doors
    for (const door of doors) {
      const screenX = centerX + door.x - scrollX
      if (screenX < -100 || screenX > w + 100) continue

      const doorW = 60
      const doorH = h * 0.4
      const doorY = h * 0.35
      const doorX = screenX - doorW / 2

      // Door frame
      ctx.strokeStyle = `rgba(80, 70, 55, ${flicker * 0.3})`
      ctx.lineWidth = 2
      ctx.strokeRect(doorX, doorY, doorW, doorH)

      // Door fill — colored by room
      ctx.fillStyle = door.color.replace('0.3', String(flicker * 0.15))
      ctx.fillRect(doorX + 2, doorY + 2, doorW - 4, doorH - 4)

      // Door handle
      ctx.beginPath()
      ctx.arc(doorX + doorW - 12, doorY + doorH / 2, 3, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(180, 160, 100, ${flicker * 0.3})`
      ctx.fill()

      // Label
      ctx.font = '10px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(200, 190, 170, ${flicker * 0.25})`
      ctx.textAlign = 'center'
      ctx.fillText(door.label, screenX, doorY + doorH + 18)

      // Light seeping from under door
      ctx.fillStyle = door.color.replace('0.3', String(flicker * 0.05))
      ctx.fillRect(doorX + 5, doorY + doorH - 2, doorW - 10, 4)
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

    // Title
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 190, 170, ${flicker * 0.08})`
    ctx.textAlign = 'center'
    ctx.fillText('the between', w / 2, h * 0.12)

    // Hint
    ctx.font = '9px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 190, 170, ${flicker * 0.05})`
    ctx.fillText('click a door to enter · scroll to walk', w / 2, h * 0.92)
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
      canvas.style.cssText = 'width: 100%; height: 100%; cursor: pointer;'
      ctx = canvas.getContext('2d')

      buildDoors()

      // Scroll to walk
      canvas.addEventListener('wheel', (e) => {
        scrollX += e.deltaY * 0.5
        e.preventDefault()
      }, { passive: false })

      // Click on doors
      canvas.addEventListener('click', (e) => {
        const w = canvas!.width
        const h = canvas!.height
        const centerX = w / 2
        const clickX = e.clientX
        const clickY = e.clientY

        // Check if clicked on a door
        for (const door of doors) {
          const screenX = centerX + door.x - scrollX
          const doorW = 60
          const doorH = h * 0.4
          const doorY = h * 0.35
          const doorX = screenX - doorW / 2

          if (clickX >= doorX && clickX <= doorX + doorW &&
              clickY >= doorY && clickY <= doorY + doorH) {
            deps.switchTo(door.name)
            return
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
      scrollX = 0
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
