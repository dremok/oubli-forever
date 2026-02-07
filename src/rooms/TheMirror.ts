/**
 * THE MIRROR — a portrait of your behavior in Oubli
 *
 * A hidden room that reflects who you are based on how you've used
 * Oubli. It tracks which rooms you visit, how long you stay, what
 * you type, and renders this data as a text-based self-portrait.
 *
 * The mirror doesn't show your face — it shows your patterns.
 * The rooms you visit most are the brightest. The words you type
 * most frequently form the features. Your browsing rhythm becomes
 * a pulse.
 *
 * The portrait degrades if you don't visit — the mirror forgets
 * you just like everything else in Oubli.
 *
 * Accessible from The Between (one of the doors leads here instead
 * of to a normal room), or discovered by visiting every visible room.
 *
 * Inspired by: Black mirrors (scrying), funhouse mirrors,
 * Dorian Gray, data portraits, quantified self,
 * the observer effect (looking changes what's seen)
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'

interface MirrorDeps {
  getMemories: () => StoredMemory[]
  getRoomVisits: () => Map<string, number>
  switchTo?: (name: string) => void
}

interface DataPoint {
  x: number
  y: number
  char: string
  alpha: number
  hue: number
}

const STORAGE_KEY = 'oubli-mirror-data'

interface MirrorData {
  roomTimes: Record<string, number>  // room name → total seconds
  wordFrequencies: Record<string, number>  // word → count
  lastVisit: number
  visitCount: number
}

export function createMirrorRoom(deps: MirrorDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let portraitData: DataPoint[] = []
  let mirrorData: MirrorData

  // Reflection distortion navigation zones
  let hoveredZone = -1
  let shatterTime = -1  // when a shatter animation started (-1 = none)
  let shatterTarget = ''  // room to navigate to after shatter
  const navZones = [
    { room: 'darkroom', side: 'left' as const },
    { room: 'datepaintings', side: 'right' as const },
  ]

  function loadData(): MirrorData {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) return JSON.parse(stored)
    } catch {}
    return {
      roomTimes: {},
      wordFrequencies: {},
      lastVisit: Date.now(),
      visitCount: 0,
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mirrorData))
    } catch {}
  }

  function buildPortrait() {
    if (!canvas) return
    portraitData = []
    const w = canvas.width
    const h = canvas.height
    const memories = deps.getMemories()

    // Build word frequency from all memories
    for (const mem of memories) {
      const words = mem.currentText.toLowerCase().split(/\s+/).filter(w => w.length > 2)
      for (const word of words) {
        mirrorData.wordFrequencies[word] = (mirrorData.wordFrequencies[word] || 0) + 1
      }
    }

    // Sort words by frequency
    const sortedWords = Object.entries(mirrorData.wordFrequencies)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)

    if (sortedWords.length === 0 && memories.length === 0) return

    // Create an oval portrait shape
    const centerX = w / 2
    const centerY = h * 0.45
    const radiusX = w * 0.2
    const radiusY = h * 0.3

    // Fill the oval with words, sized by frequency
    const maxFreq = sortedWords.length > 0 ? sortedWords[0][1] : 1
    let attempts = 0

    for (const [word, freq] of sortedWords) {
      const normalizedFreq = freq / maxFreq
      const angle = Math.random() * Math.PI * 2
      const dist = Math.random() * 0.9
      const x = centerX + Math.cos(angle) * radiusX * dist
      const y = centerY + Math.sin(angle) * radiusY * dist

      for (const char of word) {
        portraitData.push({
          x: x + (Math.random() - 0.5) * word.length * 8,
          y: y + (Math.random() - 0.5) * 10,
          char,
          alpha: 0.1 + normalizedFreq * 0.4,
          hue: (freq * 37) % 360,
        })
      }

      attempts++
      if (attempts > 200) break
    }

    // Add room-based shading
    const roomVisits = deps.getRoomVisits()
    const totalVisits = [...roomVisits.values()].reduce((s, v) => s + v, 0) || 1

    // Room data creates background texture
    for (const [room, visits] of roomVisits) {
      const intensity = visits / totalVisits
      const roomAngle = hashRoom(room) * Math.PI * 2
      const rx = centerX + Math.cos(roomAngle) * radiusX * 0.5
      const ry = centerY + Math.sin(roomAngle) * radiusY * 0.5

      for (let i = 0; i < Math.ceil(intensity * 20); i++) {
        portraitData.push({
          x: rx + (Math.random() - 0.5) * 40,
          y: ry + (Math.random() - 0.5) * 40,
          char: room[Math.floor(Math.random() * room.length)],
          alpha: intensity * 0.1,
          hue: hashRoom(room) * 360,
        })
      }
    }

    saveData()
  }

  function hashRoom(name: string): number {
    let h = 0
    for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0
    return Math.abs(h) / 0xFFFFFFFF
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height

    ctx.clearRect(0, 0, w, h)

    // Background — very dark, reflective
    ctx.fillStyle = 'rgba(3, 3, 8, 1)'
    ctx.fillRect(0, 0, w, h)

    // Mirror frame
    const frameX = w * 0.2
    const frameY = h * 0.08
    const frameW = w * 0.6
    const frameH = h * 0.75
    ctx.strokeStyle = 'rgba(120, 100, 80, 0.08)'
    ctx.lineWidth = 3
    ctx.strokeRect(frameX, frameY, frameW, frameH)

    // Inner frame
    ctx.strokeStyle = 'rgba(120, 100, 80, 0.04)'
    ctx.lineWidth = 1
    ctx.strokeRect(frameX + 8, frameY + 8, frameW - 16, frameH - 16)

    // Mirror surface — slight gradient
    const mirrorGrad = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, h * 0.4)
    mirrorGrad.addColorStop(0, 'rgba(15, 15, 25, 0.3)')
    mirrorGrad.addColorStop(1, 'rgba(5, 5, 10, 0.1)')
    ctx.fillStyle = mirrorGrad
    ctx.fillRect(frameX + 10, frameY + 10, frameW - 20, frameH - 20)

    // Portrait data points
    if (portraitData.length > 0) {
      for (const dp of portraitData) {
        const breathe = Math.sin(time * 0.5 + dp.x * 0.01 + dp.y * 0.01) * 0.02
        ctx.font = '12px "Cormorant Garamond", serif'
        ctx.fillStyle = `hsla(${dp.hue}, 30%, 60%, ${dp.alpha + breathe})`
        ctx.textAlign = 'center'
        ctx.fillText(dp.char, dp.x, dp.y)
      }
    } else {
      // Empty mirror
      ctx.font = '14px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(120, 120, 160, 0.1)'
      ctx.textAlign = 'center'
      ctx.fillText('the mirror is blank.', w / 2, h * 0.4)
      ctx.fillText('it needs more of you to reflect.', w / 2, h * 0.45)
      ctx.fillText('visit rooms. type memories. return.', w / 2, h * 0.5)
    }

    // Degradation based on time since last visit
    const daysSinceVisit = (Date.now() - mirrorData.lastVisit) / (1000 * 60 * 60 * 24)
    if (daysSinceVisit > 1) {
      // Fog over the mirror — it forgets you
      const fogAlpha = Math.min(0.7, daysSinceVisit * 0.05)
      ctx.fillStyle = `rgba(10, 10, 15, ${fogAlpha})`
      ctx.fillRect(frameX + 10, frameY + 10, frameW - 20, frameH - 20)

      ctx.font = '10px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(120, 120, 160, ${0.1 + Math.sin(time) * 0.03})`
      ctx.fillText('the mirror is forgetting your face.', w / 2, h * 0.9)
    }

    // Stats
    const roomVisits = deps.getRoomVisits()
    const totalVisits = [...roomVisits.values()].reduce((s, v) => s + v, 0)
    const wordCount = Object.keys(mirrorData.wordFrequencies).length

    ctx.font = '9px monospace'
    ctx.fillStyle = 'rgba(120, 120, 160, 0.06)'
    ctx.textAlign = 'center'
    ctx.fillText(
      `${totalVisits} room visits · ${wordCount} unique words · visit #${mirrorData.visitCount}`,
      w / 2, h - 15
    )

    // Title
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(120, 120, 160, ${0.08 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the mirror', w / 2, 30)

    // Reflection distortion navigation zones within the mirror frame
    if (deps.switchTo) {
      const mirrorLeft = frameX + 10
      const mirrorRight = frameX + frameW - 10
      const mirrorCenterY = frameY + frameH * 0.5
      const zoneRadius = Math.min(frameW * 0.1, 50)

      for (let i = 0; i < navZones.length; i++) {
        const zone = navZones[i]
        const zx = zone.side === 'left'
          ? mirrorLeft + frameW * 0.18
          : mirrorRight - frameW * 0.18
        const zy = mirrorCenterY
        const hovered = hoveredZone === i
        const isShatteringThis = shatterTime > 0 && shatterTarget === zone.room
        const shatterElapsed = isShatteringThis ? time - shatterTime : 0

        ctx.save()

        // Clipping — keep reflections inside mirror frame
        ctx.beginPath()
        ctx.rect(frameX + 10, frameY + 10, frameW - 20, frameH - 20)
        ctx.clip()

        if (isShatteringThis && shatterElapsed < 0.5) {
          // --- Shatter animation: crack pattern radiating outward ---
          const progress = shatterElapsed / 0.4
          const crackAlpha = 1.0 - progress
          const numCracks = 8
          for (let c = 0; c < numCracks; c++) {
            const angle = (c / numCracks) * Math.PI * 2 + 0.3
            const len = progress * zoneRadius * 2.5
            ctx.beginPath()
            ctx.moveTo(zx, zy)
            // Jagged crack lines
            const segments = 4
            for (let s = 1; s <= segments; s++) {
              const frac = s / segments
              const jitterX = (Math.sin(c * 13.7 + s * 7.3) * 6) * frac
              const jitterY = (Math.cos(c * 9.1 + s * 11.2) * 6) * frac
              ctx.lineTo(
                zx + Math.cos(angle) * len * frac + jitterX,
                zy + Math.sin(angle) * len * frac + jitterY
              )
            }
            ctx.strokeStyle = `rgba(200, 200, 240, ${crackAlpha * 0.6})`
            ctx.lineWidth = 1.5 - progress
            ctx.stroke()
          }
          // Flash at center
          const flashAlpha = Math.max(0, 0.5 - progress * 1.2)
          const flashGrad = ctx.createRadialGradient(zx, zy, 0, zx, zy, zoneRadius * progress * 2)
          flashGrad.addColorStop(0, `rgba(200, 200, 255, ${flashAlpha})`)
          flashGrad.addColorStop(1, 'rgba(200, 200, 255, 0)')
          ctx.fillStyle = flashGrad
          ctx.fillRect(zx - zoneRadius * 3, zy - zoneRadius * 3, zoneRadius * 6, zoneRadius * 6)
        } else if (!isShatteringThis) {
          // --- Normal reflection distortion zone ---
          const baseAlpha = hovered ? 0.18 : 0.05
          const shimmer = Math.sin(time * 2.0 + i * 3.0) * 0.02

          if (zone.room === 'darkroom') {
            // Darkroom: faint red safe-light glow with developing tray shapes
            const redGrad = ctx.createRadialGradient(zx, zy, 0, zx, zy, zoneRadius * 1.3)
            redGrad.addColorStop(0, `rgba(180, 30, 20, ${(baseAlpha + shimmer) * 1.5})`)
            redGrad.addColorStop(0.6, `rgba(120, 15, 10, ${(baseAlpha + shimmer) * 0.8})`)
            redGrad.addColorStop(1, 'rgba(80, 10, 5, 0)')
            ctx.fillStyle = redGrad
            ctx.fillRect(zx - zoneRadius * 1.5, zy - zoneRadius * 1.5, zoneRadius * 3, zoneRadius * 3)

            // Developing tray shapes — faint rectangles
            ctx.strokeStyle = `rgba(160, 40, 30, ${baseAlpha * 1.8 + shimmer})`
            ctx.lineWidth = 0.6
            const trayW = zoneRadius * 0.7
            const trayH = zoneRadius * 0.45
            for (let t = 0; t < 3; t++) {
              const trayOffsetX = (t - 1) * trayW * 0.9
              const trayOffsetY = Math.sin(time * 0.8 + t * 1.5) * 3
              ctx.strokeRect(
                zx + trayOffsetX - trayW / 2,
                zy + trayOffsetY - trayH / 2 + 8,
                trayW, trayH
              )
            }
          } else {
            // Date paintings: faint rectangular shapes with date-like text
            const paintGrad = ctx.createRadialGradient(zx, zy, 0, zx, zy, zoneRadius * 1.3)
            paintGrad.addColorStop(0, `rgba(140, 130, 100, ${(baseAlpha + shimmer) * 1.2})`)
            paintGrad.addColorStop(0.6, `rgba(100, 90, 70, ${(baseAlpha + shimmer) * 0.6})`)
            paintGrad.addColorStop(1, 'rgba(60, 55, 40, 0)')
            ctx.fillStyle = paintGrad
            ctx.fillRect(zx - zoneRadius * 1.5, zy - zoneRadius * 1.5, zoneRadius * 3, zoneRadius * 3)

            // Small painting frames with tiny dates
            const pW = zoneRadius * 0.5
            const pH = zoneRadius * 0.65
            const dates = ['FEB.8', 'JAN.3', 'DEC.1', 'OCT.19']
            for (let p = 0; p < 4; p++) {
              const col = p % 2
              const row = Math.floor(p / 2)
              const px = zx + (col - 0.5) * pW * 1.4
              const py = zy + (row - 0.5) * pH * 1.2
              const drift = Math.sin(time * 0.6 + p * 2.1) * 2
              ctx.strokeStyle = `rgba(130, 120, 90, ${baseAlpha * 1.5 + shimmer})`
              ctx.lineWidth = 0.5
              ctx.strokeRect(px - pW / 2 + drift, py - pH / 2, pW, pH)
              // Tiny date text inside
              ctx.font = '6px monospace'
              ctx.fillStyle = `rgba(140, 130, 100, ${baseAlpha * 2.0 + shimmer})`
              ctx.textAlign = 'center'
              ctx.fillText(dates[p], px + drift, py + 2)
            }
          }

          // Hover effect: ripple (concentric circles expanding outward)
          if (hovered) {
            const rippleCount = 3
            for (let r = 0; r < rippleCount; r++) {
              const phase = (time * 1.5 + r * 0.7) % 2.0
              const rippleRadius = phase * zoneRadius * 1.5
              const rippleAlpha = Math.max(0, 0.15 * (1.0 - phase / 2.0))
              ctx.beginPath()
              ctx.arc(zx, zy, rippleRadius, 0, Math.PI * 2)
              ctx.strokeStyle = zone.room === 'darkroom'
                ? `rgba(180, 50, 40, ${rippleAlpha})`
                : `rgba(150, 140, 110, ${rippleAlpha})`
              ctx.lineWidth = 1.0
              ctx.stroke()
            }
            // Cursor hint
            canvas!.style.cursor = 'pointer'
          }
        }

        ctx.restore()
      }

      // Reset cursor when not hovering any zone
      if (hoveredZone === -1 && canvas) {
        canvas.style.cursor = 'default'
      }
    }
  }

  mirrorData = loadData()

  return {
    name: 'mirror',
    label: 'the mirror',
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

      // Reflection distortion zone click + hover
      const getZonePositions = () => {
        if (!canvas) return []
        const cw = canvas.width
        const ch = canvas.height
        const fX = cw * 0.2 + 10
        const fW = cw * 0.6 - 20
        const fY = ch * 0.08
        const fH = ch * 0.75
        const centerY = fY + fH * 0.5
        const radius = Math.min(fW * 0.1, 50)
        return navZones.map(zone => ({
          x: zone.side === 'left' ? fX + fW * 0.18 : fX + fW - fW * 0.18,
          y: centerY,
          radius: radius * 1.3,
          room: zone.room,
        }))
      }

      canvas.addEventListener('click', (e) => {
        if (!deps.switchTo || !canvas || shatterTime > 0) return
        const zones = getZonePositions()
        for (let i = 0; i < zones.length; i++) {
          const z = zones[i]
          const dx = e.clientX - z.x
          const dy = e.clientY - z.y
          if (dx * dx + dy * dy < z.radius * z.radius) {
            // Start shatter animation, navigate after delay
            shatterTime = time
            shatterTarget = z.room
            setTimeout(() => {
              if (deps.switchTo) deps.switchTo(z.room)
              shatterTime = -1
              shatterTarget = ''
            }, 400)
            return
          }
        }
      })
      canvas.addEventListener('mousemove', (e) => {
        if (!deps.switchTo || !canvas) return
        hoveredZone = -1
        const zones = getZonePositions()
        for (let i = 0; i < zones.length; i++) {
          const z = zones[i]
          const dx = e.clientX - z.x
          const dy = e.clientY - z.y
          if (dx * dx + dy * dy < z.radius * z.radius) {
            hoveredZone = i
            break
          }
        }
      })

      overlay.appendChild(canvas)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
          buildPortrait()
        }
      }
      window.addEventListener('resize', onResize)

      return overlay
    },

    activate() {
      active = true
      mirrorData.visitCount++
      mirrorData.lastVisit = Date.now()
      saveData()
      buildPortrait()
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
