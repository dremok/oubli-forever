/**
 * THE WELL — drop memories into darkness, hear them echo back
 *
 * A room with a single deep well at the center. You select a memory
 * and drop it in. You watch it fall (text shrinking, fading). Then,
 * after a pause proportional to the well's "depth", the echo returns —
 * but distorted. Words rearranged, characters reversed, meaning shifted.
 *
 * The well remembers everything you've dropped in, but its echoes
 * become increasingly tangled as more memories accumulate at the bottom.
 * The well's water level rises with each dropped memory.
 *
 * This is NOT destructive like the furnace — it's transformative.
 * The memory isn't degraded, but the well returns a distorted version
 * that might reveal something the original text didn't.
 *
 * Inspired by: Wishing wells, oracle pools, Narcissus and Echo,
 * the cenote sacrificial wells of the Maya, dream interpretation,
 * the subconscious as a deep pool, echolocation, reverb in caves
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'

interface WellDeps {
  getMemories: () => StoredMemory[]
  onDescend?: () => void
  switchTo?: (name: string) => void
}

interface DroppedMemory {
  text: string
  y: number          // falling position (0 = top, 1 = bottom)
  phase: 'falling' | 'waiting' | 'echoing' | 'done'
  echoText: string
  echoAlpha: number
  fallSpeed: number
  waitTime: number
  dropTime: number
}

interface WaterRipple {
  radius: number
  alpha: number
  x: number
}

interface RimObject {
  label: string
  room: string
  angleOnRim: number  // angle on the ellipse (radians)
  drawFn: string      // 'seashell' | 'candle' | 'coal'
}

interface FallingObject {
  type: string
  x: number
  y: number
  startY: number
  targetRoom: string
  scale: number
  alpha: number
  speed: number
  splashed: boolean
}

export function createWellRoom(deps: WellDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let droppedMemories: DroppedMemory[] = []
  let waterLevel = 0 // rises as you drop more
  let ripples: WaterRipple[] = []
  let selectedIndex = 0
  let listVisible = true
  let listEl: HTMLElement | null = null

  // Rim objects for navigation
  const rimObjects: RimObject[] = [
    { label: 'drop to reach the tide pool', room: 'tidepool', angleOnRim: Math.PI + 0.6, drawFn: 'seashell' },
    { label: 'drop to reach the furnace', room: 'furnace', angleOnRim: Math.PI + Math.PI * 0.5, drawFn: 'coal' },
    { label: 'drop to reach the séance', room: 'seance', angleOnRim: Math.PI + Math.PI - 0.6, drawFn: 'candle' },
  ]
  let hoveredObject = -1
  let fallingObject: FallingObject | null = null
  let navigateTimeout: ReturnType<typeof setTimeout> | null = null

  // Coal spark particles
  let coalSparks: { x: number; y: number; vx: number; vy: number; life: number }[] = []

  function distortText(text: string): string {
    const techniques = [
      // Reverse words
      () => text.split(' ').reverse().join(' '),
      // Shuffle middle of words
      () => text.split(' ').map(w => {
        if (w.length <= 3) return w
        const mid = w.slice(1, -1).split('')
        for (let i = mid.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [mid[i], mid[j]] = [mid[j], mid[i]]
        }
        return w[0] + mid.join('') + w[w.length - 1]
      }).join(' '),
      // Echo repetition
      () => {
        const words = text.split(' ')
        return words.map((w, i) => i > 0 && Math.random() < 0.3 ? `${w}... ${w}` : w).join(' ')
      },
      // Drop random words, add ellipses
      () => text.split(' ').filter(() => Math.random() > 0.25).join(' ... '),
      // Merge with previous dropped memory
      () => {
        if (droppedMemories.length > 0) {
          const prev = droppedMemories[Math.floor(Math.random() * droppedMemories.length)]
          const prevWords = prev.text.split(' ')
          const thisWords = text.split(' ')
          const merged: string[] = []
          const maxLen = Math.max(prevWords.length, thisWords.length)
          for (let i = 0; i < maxLen; i++) {
            if (Math.random() < 0.5 && i < thisWords.length) merged.push(thisWords[i])
            else if (i < prevWords.length) merged.push(prevWords[i])
          }
          return merged.join(' ')
        }
        return text.split('').reverse().join('')
      },
    ]

    return techniques[Math.floor(Math.random() * techniques.length)]()
  }

  function dropMemory(mem: StoredMemory) {
    const echoText = distortText(mem.currentText)
    droppedMemories.push({
      text: mem.currentText,
      y: 0,
      phase: 'falling',
      echoText,
      echoAlpha: 0,
      fallSpeed: 0.005 + Math.random() * 0.003,
      waitTime: 0,
      dropTime: time,
    })
    waterLevel = Math.min(0.3, waterLevel + 0.02)
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height
    const wellCenterX = w / 2
    const wellTopY = h * 0.3
    const wellBottomY = h * 0.85
    const wellWidth = 120
    const waterY = wellBottomY - (wellBottomY - wellTopY) * waterLevel

    ctx.clearRect(0, 0, w, h)

    // Background — deep dark with bluish tint
    ctx.fillStyle = 'rgba(3, 5, 10, 1)'
    ctx.fillRect(0, 0, w, h)

    // Stars above the well
    for (let i = 0; i < 30; i++) {
      const sx = (Math.sin(i * 83.7) * 0.5 + 0.5) * w
      const sy = (Math.sin(i * 47.3) * 0.5 + 0.5) * h * 0.25
      const brightness = 0.05 + Math.sin(time * 0.5 + i) * 0.02
      ctx.beginPath()
      ctx.arc(sx, sy, 0.5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(200, 200, 220, ${brightness})`
      ctx.fill()
    }

    // Well stone rim
    ctx.beginPath()
    ctx.ellipse(wellCenterX, wellTopY, wellWidth + 15, 20, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(40, 38, 35, 0.8)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(60, 55, 48, 0.3)'
    ctx.lineWidth = 2
    ctx.stroke()

    // Well interior — dark shaft
    ctx.beginPath()
    ctx.ellipse(wellCenterX, wellTopY, wellWidth, 15, 0, 0, Math.PI)
    ctx.lineTo(wellCenterX - wellWidth, wellBottomY)
    ctx.ellipse(wellCenterX, wellBottomY, wellWidth, 10, 0, Math.PI, 0, true)
    ctx.lineTo(wellCenterX + wellWidth, wellTopY)
    ctx.fillStyle = 'rgba(2, 3, 5, 0.95)'
    ctx.fill()

    // Well walls — slight stone texture
    ctx.strokeStyle = 'rgba(40, 35, 30, 0.15)'
    ctx.lineWidth = 0.5
    for (let row = wellTopY + 20; row < wellBottomY; row += 15) {
      const progress = (row - wellTopY) / (wellBottomY - wellTopY)
      const rowWidth = wellWidth * (1 - progress * 0.1)
      ctx.beginPath()
      ctx.moveTo(wellCenterX - rowWidth, row)
      ctx.lineTo(wellCenterX + rowWidth, row)
      ctx.stroke()
    }

    // Water at bottom
    if (waterLevel > 0) {
      ctx.beginPath()
      ctx.ellipse(wellCenterX, waterY, wellWidth * 0.95, 8, 0, 0, Math.PI * 2)
      const waterGrad = ctx.createRadialGradient(wellCenterX, waterY, 0, wellCenterX, waterY, wellWidth)
      waterGrad.addColorStop(0, `rgba(20, 40, 80, ${0.3 + Math.sin(time * 0.5) * 0.05})`)
      waterGrad.addColorStop(1, 'rgba(5, 10, 25, 0.5)')
      ctx.fillStyle = waterGrad
      ctx.fill()

      // Water ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i]
        r.radius += 0.5
        r.alpha -= 0.003
        if (r.alpha <= 0 || r.radius > wellWidth) {
          ripples.splice(i, 1)
          continue
        }
        ctx.beginPath()
        ctx.ellipse(r.x, waterY, r.radius, r.radius * 0.3, 0, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(60, 100, 160, ${r.alpha})`
        ctx.lineWidth = 0.5
        ctx.stroke()
      }
    }

    // Process dropping memories
    for (let i = droppedMemories.length - 1; i >= 0; i--) {
      const dm = droppedMemories[i]

      if (dm.phase === 'falling') {
        dm.y += dm.fallSpeed
        if (dm.y >= 1) {
          dm.y = 1
          dm.phase = 'waiting'
          dm.waitTime = 0
          // Splash ripple
          ripples.push({ radius: 3, alpha: 0.3, x: wellCenterX + (Math.random() - 0.5) * 20 })
        }

        // Draw falling text
        const textY = wellTopY + dm.y * (wellBottomY - wellTopY - 20)
        const scale = 1 - dm.y * 0.7
        const alpha = 1 - dm.y * 0.8
        ctx.font = `${Math.max(6, 13 * scale)}px "Cormorant Garamond", serif`
        ctx.fillStyle = `rgba(180, 200, 220, ${alpha})`
        ctx.textAlign = 'center'
        const displayText = dm.text.length > 40 ? dm.text.slice(0, 40) + '...' : dm.text
        ctx.fillText(displayText, wellCenterX, textY)
      }

      if (dm.phase === 'waiting') {
        dm.waitTime += 0.016
        // Wait 2-4 seconds (deeper = longer wait)
        const waitDuration = 2 + waterLevel * 6
        if (dm.waitTime > waitDuration) {
          dm.phase = 'echoing'
          dm.echoAlpha = 0
        }
      }

      if (dm.phase === 'echoing') {
        dm.echoAlpha += 0.008
        if (dm.echoAlpha >= 1) {
          dm.echoAlpha = 1
          setTimeout(() => { dm.phase = 'done' }, 8000)
        }

        // Draw echo text rising from the well
        const echoY = wellTopY - 30 - (dm.echoAlpha * 60)
        ctx.font = '14px "Cormorant Garamond", serif'
        ctx.textAlign = 'center'

        // Echo text has a wavy, reverb-like quality
        const echoLines = wrapText(dm.echoText, 40)
        for (let j = 0; j < echoLines.length; j++) {
          const lineY = echoY + j * 20
          // Multiple fading copies (like reverb)
          for (let echo = 0; echo < 3; echo++) {
            const echoDist = echo * 4
            const echoAlpha = dm.echoAlpha * (0.4 - echo * 0.12)
            ctx.fillStyle = `rgba(120, 160, 220, ${echoAlpha})`
            ctx.fillText(echoLines[j], wellCenterX + (Math.random() - 0.5) * echoDist, lineY - echoDist)
          }
        }
      }
    }

    // Remove done memories from active rendering (keep in memory for distortion mixing)
    droppedMemories = droppedMemories.filter(dm => dm.phase !== 'done')

    // Well rim top (drawn on top of everything in the well)
    ctx.beginPath()
    ctx.ellipse(wellCenterX, wellTopY, wellWidth + 15, 20, 0, Math.PI, Math.PI * 2)
    ctx.fillStyle = 'rgba(45, 42, 38, 0.9)'
    ctx.fill()

    // Rim objects — navigation items sitting on the stone rim
    drawRimObjects()

    // Title
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(120, 160, 220, ${0.1 + Math.sin(time * 0.3) * 0.03})`
    ctx.textAlign = 'center'
    ctx.fillText('the well', w / 2, 30)

    // Depth indicator
    ctx.font = '9px monospace'
    ctx.fillStyle = 'rgba(120, 160, 220, 0.08)'
    ctx.textAlign = 'right'
    ctx.fillText(`depth: ${Math.floor(waterLevel * 100)}%`, w - 20, h - 20)

    // Hint
    ctx.font = '9px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(120, 160, 220, 0.06)'
    ctx.textAlign = 'center'
    ctx.fillText('drop a memory. wait for the echo.', w / 2, h - 20)
  }

  function wrapText(text: string, maxChars: number): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let current = ''
    for (const word of words) {
      if ((current + ' ' + word).length > maxChars) {
        if (current) lines.push(current)
        current = word
      } else {
        current = current ? current + ' ' + word : word
      }
    }
    if (current) lines.push(current)
    return lines
  }

  function getRimObjectPosition(obj: RimObject, w: number, h: number): { x: number; y: number } {
    const wellCenterX = w / 2
    const wellTopY = h * 0.3
    const rimRadiusX = 120 + 15  // wellWidth + 15 (rim ellipse)
    const rimRadiusY = 20
    return {
      x: wellCenterX + Math.cos(obj.angleOnRim) * rimRadiusX,
      y: wellTopY + Math.sin(obj.angleOnRim) * rimRadiusY,
    }
  }

  function drawSeashell(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, hovered: boolean, t: number) {
    ctx.save()
    ctx.translate(x, y - (hovered ? 3 : 0))
    ctx.scale(scale, scale)

    // Glow on hover
    if (hovered) {
      ctx.shadowColor = 'rgba(255, 180, 160, 0.4)'
      ctx.shadowBlur = 12
    }

    // Spiral shell shape
    const baseColor = hovered ? [255, 170, 150] : [220, 150, 140]
    const shimmer = Math.sin(t * 2) * 15

    // Shell body — spiral arcs
    ctx.beginPath()
    for (let a = 0; a < Math.PI * 3; a += 0.1) {
      const r = 2 + a * 1.8
      const px = Math.cos(a + 0.5) * r
      const py = Math.sin(a + 0.5) * r * 0.7
      if (a === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.strokeStyle = `rgba(${baseColor[0] + shimmer}, ${baseColor[1]}, ${baseColor[2]}, ${hovered ? 0.9 : 0.6})`
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Inner spiral lines
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      const offset = i * 0.8
      for (let a = offset; a < Math.PI * 2.5 - i * 0.5; a += 0.15) {
        const r = 1.5 + a * 1.2
        const px = Math.cos(a + 0.5) * r
        const py = Math.sin(a + 0.5) * r * 0.7
        if (a === offset) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.strokeStyle = `rgba(${baseColor[0]}, ${baseColor[1] + shimmer * 0.5}, ${baseColor[2]}, ${(hovered ? 0.5 : 0.3) - i * 0.08})`
      ctx.lineWidth = 0.8
      ctx.stroke()
    }

    ctx.restore()
  }

  function drawCandle(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, hovered: boolean, t: number) {
    ctx.save()
    ctx.translate(x, y - (hovered ? 3 : 0))
    ctx.scale(scale, scale)

    // Warm glow
    if (hovered) {
      ctx.shadowColor = 'rgba(255, 200, 80, 0.5)'
      ctx.shadowBlur = 18
    } else {
      ctx.shadowColor = 'rgba(255, 180, 60, 0.2)'
      ctx.shadowBlur = 8
    }

    // Wax body
    ctx.fillStyle = `rgba(230, 220, 200, ${hovered ? 0.8 : 0.5})`
    ctx.fillRect(-3, -4, 6, 12)

    // Wick
    ctx.strokeStyle = `rgba(80, 60, 40, ${hovered ? 0.6 : 0.3})`
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(0, -4)
    ctx.lineTo(0, -7)
    ctx.stroke()

    // Flame — teardrop with flicker
    const flickerX = Math.sin(t * 8) * 1.2 + Math.sin(t * 13) * 0.5
    const flickerH = 6 + Math.sin(t * 6) * 1.5

    ctx.beginPath()
    ctx.moveTo(flickerX, -7 - flickerH)
    ctx.quadraticCurveTo(flickerX + 4, -7 - flickerH * 0.4, flickerX, -6)
    ctx.quadraticCurveTo(flickerX - 4, -7 - flickerH * 0.4, flickerX, -7 - flickerH)
    ctx.closePath()

    const flameGrad = ctx.createLinearGradient(0, -7 - flickerH, 0, -6)
    flameGrad.addColorStop(0, `rgba(255, 220, 100, ${hovered ? 0.9 : 0.6})`)
    flameGrad.addColorStop(0.5, `rgba(255, 160, 40, ${hovered ? 0.8 : 0.5})`)
    flameGrad.addColorStop(1, `rgba(255, 80, 20, ${hovered ? 0.7 : 0.4})`)
    ctx.fillStyle = flameGrad
    ctx.fill()

    ctx.restore()
  }

  function drawCoal(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, hovered: boolean, t: number) {
    ctx.save()
    ctx.translate(x, y - (hovered ? 3 : 0))
    ctx.scale(scale, scale)

    // Pulsing ember
    const pulse = Math.sin(t * 3) * 0.3 + 0.7
    const innerPulse = Math.sin(t * 5 + 1) * 0.2 + 0.8

    // Glow
    if (hovered) {
      ctx.shadowColor = `rgba(255, 100, 30, ${0.5 * pulse})`
      ctx.shadowBlur = 20
    } else {
      ctx.shadowColor = `rgba(255, 80, 20, ${0.2 * pulse})`
      ctx.shadowBlur = 10
    }

    // Rough coal shape — irregular circle
    ctx.beginPath()
    for (let a = 0; a < Math.PI * 2; a += 0.3) {
      const r = 5 + Math.sin(a * 3.7 + 1) * 1.5 + Math.cos(a * 2.3) * 1
      const px = Math.cos(a) * r
      const py = Math.sin(a) * r * 0.7
      if (a === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()

    const coalGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 6)
    coalGrad.addColorStop(0, `rgba(255, ${Math.floor(120 * innerPulse)}, ${Math.floor(40 * innerPulse)}, ${hovered ? 0.9 : 0.6})`)
    coalGrad.addColorStop(0.6, `rgba(200, ${Math.floor(60 * pulse)}, 20, ${hovered ? 0.7 : 0.4})`)
    coalGrad.addColorStop(1, `rgba(80, 20, 10, ${hovered ? 0.8 : 0.5})`)
    ctx.fillStyle = coalGrad
    ctx.fill()

    // Surface cracks that glow
    ctx.strokeStyle = `rgba(255, 160, 60, ${(hovered ? 0.6 : 0.3) * pulse})`
    ctx.lineWidth = 0.5
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      const startA = i * 2.1
      ctx.moveTo(Math.cos(startA) * 2, Math.sin(startA) * 1.4)
      ctx.lineTo(Math.cos(startA + 0.8) * 5, Math.sin(startA + 0.8) * 3.5)
      ctx.stroke()
    }

    ctx.restore()

    // Sparks — occasional
    if (Math.random() < (hovered ? 0.15 : 0.04)) {
      coalSparks.push({
        x: x + (Math.random() - 0.5) * 6 * scale,
        y: y - 3 * scale,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 2 - 0.5,
        life: 1,
      })
    }
  }

  function drawRimObjects() {
    if (!ctx || !canvas) return
    const w = canvas.width
    const h = canvas.height

    // Draw sparks (from coal, rendered before objects so they go behind if needed)
    for (let i = coalSparks.length - 1; i >= 0; i--) {
      const s = coalSparks[i]
      s.x += s.vx
      s.y += s.vy
      s.vy += 0.03  // slight gravity
      s.life -= 0.02
      if (s.life <= 0) {
        coalSparks.splice(i, 1)
        continue
      }
      ctx.beginPath()
      ctx.arc(s.x, s.y, 0.8, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, ${Math.floor(120 + s.life * 80)}, 30, ${s.life * 0.8})`
      ctx.fill()
    }

    // Draw each rim object (skip if it's currently falling)
    for (let i = 0; i < rimObjects.length; i++) {
      if (fallingObject && fallingObject.type === rimObjects[i].drawFn) continue

      const obj = rimObjects[i]
      const pos = getRimObjectPosition(obj, w, h)
      const isHovered = hoveredObject === i
      const scale = 1.0

      if (obj.drawFn === 'seashell') drawSeashell(ctx, pos.x, pos.y, scale, isHovered, time)
      else if (obj.drawFn === 'candle') drawCandle(ctx, pos.x, pos.y, scale, isHovered, time)
      else if (obj.drawFn === 'coal') drawCoal(ctx, pos.x, pos.y, scale, isHovered, time)

      // Hover label
      if (isHovered) {
        ctx.font = '10px "Cormorant Garamond", serif'
        ctx.fillStyle = 'rgba(180, 200, 220, 0.5)'
        ctx.textAlign = 'center'
        ctx.fillText(obj.label, pos.x, pos.y - 22)
      }
    }

    // Draw falling object
    if (fallingObject) {
      const fo = fallingObject
      const wellBottomY = h * 0.85
      const waterY = wellBottomY - (wellBottomY - h * 0.3) * waterLevel

      // Fall physics
      fo.speed += 0.3
      fo.y += fo.speed
      fo.scale = Math.max(0.1, fo.scale - 0.004)
      fo.alpha = Math.max(0, fo.alpha - 0.006)

      // Check for splash
      if (!fo.splashed && fo.y >= waterY && waterLevel > 0) {
        fo.splashed = true
        ripples.push({ radius: 5, alpha: 0.4, x: fo.x + (Math.random() - 0.5) * 10 })
        ripples.push({ radius: 2, alpha: 0.3, x: fo.x + (Math.random() - 0.5) * 15 })
      }

      // Check if fallen past bottom
      if (fo.y >= wellBottomY + 20 || fo.alpha <= 0) {
        // Object has fully fallen — schedule navigation
        if (!navigateTimeout) {
          navigateTimeout = setTimeout(() => {
            if (deps.switchTo && fallingObject) {
              deps.switchTo(fallingObject.targetRoom)
            }
            fallingObject = null
            navigateTimeout = null
          }, 1500)
        }
      } else {
        // Still falling — draw it
        if (fo.type === 'seashell') drawSeashell(ctx, fo.x, fo.y, fo.scale, false, time)
        else if (fo.type === 'candle') drawCandle(ctx, fo.x, fo.y, fo.scale, false, time)
        else if (fo.type === 'coal') drawCoal(ctx, fo.x, fo.y, fo.scale, false, time)
      }
    }
  }

  function handleCanvasMouseMove(e: MouseEvent) {
    if (!canvas || fallingObject) {
      hoveredObject = -1
      return
    }
    const rect = canvas.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width)
    const my = (e.clientY - rect.top) * (canvas.height / rect.height)

    hoveredObject = -1
    for (let i = 0; i < rimObjects.length; i++) {
      const pos = getRimObjectPosition(rimObjects[i], canvas.width, canvas.height)
      const dx = mx - pos.x
      const dy = my - pos.y
      if (dx * dx + dy * dy < 20 * 20) {
        hoveredObject = i
        break
      }
    }
    canvas.style.cursor = hoveredObject >= 0 ? 'pointer' : 'default'
  }

  function handleCanvasClick(e: MouseEvent) {
    if (!canvas || fallingObject || hoveredObject < 0) return
    if (!deps.switchTo) return

    const obj = rimObjects[hoveredObject]
    const pos = getRimObjectPosition(obj, canvas.width, canvas.height)

    fallingObject = {
      type: obj.drawFn,
      x: pos.x,
      y: pos.y,
      startY: pos.y,
      targetRoom: obj.room,
      scale: 1.0,
      alpha: 1.0,
      speed: 0,
      splashed: false,
    }
    hoveredObject = -1
    canvas.style.cursor = 'default'
  }

  function rebuildList() {
    if (!listEl) return
    listEl.innerHTML = ''
    const memories = deps.getMemories()

    if (memories.length === 0) {
      const empty = document.createElement('div')
      empty.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-size: 12px; font-style: italic;
        color: rgba(120, 160, 220, 0.15);
        text-align: center; padding: 20px;
      `
      empty.textContent = 'no memories to drop.'
      listEl.appendChild(empty)
      return
    }

    for (const mem of memories.slice(0, 20)) {
      const item = document.createElement('div')
      item.style.cssText = `
        padding: 8px 12px;
        border-bottom: 1px solid rgba(120, 160, 220, 0.04);
        cursor: pointer;
        transition: background 0.3s ease;
      `
      item.addEventListener('mouseenter', () => {
        item.style.background = 'rgba(120, 160, 220, 0.05)'
      })
      item.addEventListener('mouseleave', () => {
        item.style.background = 'transparent'
      })

      const textEl = document.createElement('div')
      textEl.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-size: 12px;
        color: rgba(120, 160, 220, 0.3);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 250px;
      `
      textEl.textContent = mem.currentText
      item.appendChild(textEl)

      item.addEventListener('click', () => {
        dropMemory(mem)
      })

      listEl.appendChild(item)
    }
  }

  return {
    name: 'well',
    label: 'the well',

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
      canvas.style.cssText = `
        position: absolute; top: 0; left: 0;
        width: 100%; height: 100%;
        pointer-events: auto;
      `
      ctx = canvas.getContext('2d')
      overlay.appendChild(canvas)

      // Memory list panel — left side
      const panel = document.createElement('div')
      panel.style.cssText = `
        position: absolute;
        left: 20px; top: 60px;
        width: 280px; max-width: 35vw;
        max-height: 60vh;
        overflow-y: auto;
        scrollbar-width: none;
        z-index: 2;
        pointer-events: auto;
      `

      const panelTitle = document.createElement('div')
      panelTitle.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 11px;
        color: rgba(120, 160, 220, 0.15);
        letter-spacing: 3px;
        text-transform: uppercase;
        margin-bottom: 12px;
        padding: 0 12px;
      `
      panelTitle.textContent = 'choose a memory to drop'
      panel.appendChild(panelTitle)

      listEl = document.createElement('div')
      panel.appendChild(listEl)
      overlay.appendChild(panel)

      // Canvas event listeners for rim object interaction
      canvas.addEventListener('mousemove', handleCanvasMouseMove)
      canvas.addEventListener('click', handleCanvasClick)

      // Descent link — appears when water level is high
      let descentEl: HTMLElement | null = null
      if (deps.onDescend) {
        descentEl = document.createElement('div')
        descentEl.style.cssText = `
          position: absolute;
          bottom: 50px; left: 0; right: 0;
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300; font-size: 11px; font-style: italic;
          color: rgba(60, 120, 200, 0);
          text-align: center;
          cursor: pointer;
          pointer-events: none;
          transition: color 2s ease;
          z-index: 3;
        `
        descentEl.textContent = '▼ the water leads somewhere deeper'
        descentEl.addEventListener('mouseenter', () => {
          if (waterLevel >= 0.15 && descentEl) descentEl.style.color = 'rgba(60, 120, 200, 0.3)'
        })
        descentEl.addEventListener('mouseleave', () => {
          if (waterLevel >= 0.15 && descentEl) descentEl.style.color = 'rgba(60, 120, 200, 0.1)'
        })
        descentEl.addEventListener('click', () => {
          if (waterLevel >= 0.15 && deps.onDescend) deps.onDescend()
        })
        overlay.appendChild(descentEl)
      }

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      // Check water level periodically and show/hide descent
      const checkWater = setInterval(() => {
        if (descentEl && waterLevel >= 0.15) {
          descentEl.style.color = 'rgba(60, 120, 200, 0.1)'
          descentEl.style.pointerEvents = 'auto'
        }
      }, 1000)

      return overlay
    },

    activate() {
      active = true
      droppedMemories = []
      ripples = []
      waterLevel = 0
      fallingObject = null
      hoveredObject = -1
      coalSparks = []
      if (navigateTimeout) { clearTimeout(navigateTimeout); navigateTimeout = null }
      rebuildList()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      if (navigateTimeout) { clearTimeout(navigateTimeout); navigateTimeout = null }
      fallingObject = null
      hoveredObject = -1
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      if (navigateTimeout) { clearTimeout(navigateTimeout); navigateTimeout = null }
      if (canvas) {
        canvas.removeEventListener('mousemove', handleCanvasMouseMove)
        canvas.removeEventListener('click', handleCanvasClick)
      }
      overlay?.remove()
    },
  }
}
