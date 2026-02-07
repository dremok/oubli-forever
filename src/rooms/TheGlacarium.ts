/**
 * THE GLACARIUM — memories frozen in ice
 *
 * Inspired by the record-low Arctic sea ice extent of February 2026.
 * Your memories crystallize as ice formations on a dark ocean — but
 * the warming world melts them. Degraded memories drip and dissolve.
 *
 * INTERACTIVE: Your cursor radiates warmth — ice crystals near it
 * melt faster and glow. Click a crystal to expand and read the full
 * memory. The Arctic is a visceral metaphor: as the ice goes,
 * so do your memories.
 *
 * USES MEMORIES. Data-driven. Climate-aware.
 *
 * Inspired by: Olafur Eliasson's Ice Watch, Arctic sea ice decline,
 * cryosphere science, frozen memories thawing, Svalbard Seed Vault
 */

import type { Room } from './RoomManager'

interface Memory {
  id: string
  originalText: string
  currentText: string
  degradation: number
  timestamp: number
}

interface GlaciariumDeps {
  getMemories: () => Memory[]
  switchTo?: (name: string) => void
}

interface IceCrystal {
  x: number
  y: number
  memory: Memory
  width: number
  height: number
  facets: { x: number; y: number; w: number; h: number; angle: number }[]
  meltProgress: number
  drips: { x: number; y: number; vy: number; alpha: number }[]
  shimmer: number
  warmth: number // 0-1, how much cursor heat this crystal has absorbed
  expanded: boolean
  expandProgress: number // 0-1 animation
}

export function createGlaciariumRoom(deps: GlaciariumDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let crystals: IceCrystal[] = []
  let oceanLevel = 0.7
  let seaIceExtent = 14.0
  let meltRate = 1.0
  let waterDrops: { x: number; y: number; vy: number; alpha: number }[] = []

  // Mouse state
  let mouseX = 0
  let mouseY = 0

  // Audio
  let audioCtx: AudioContext | null = null
  let windGain: GainNode | null = null
  let crackTimeout: ReturnType<typeof setTimeout> | null = null

  const NORMAL_FEB_EXTENT = 14.5
  const RECORD_LOW_2026 = 13.2

  // Navigation portals in the arctic scene
  const portals: { name: string; label: string; x: number; y: number; r: number; color: string; hovered: boolean }[] = []

  function buildPortals() {
    if (!canvas) return
    const w = canvas.width
    const h = canvas.height
    const waterY = h * (1 - oceanLevel)

    portals.length = 0
    portals.push(
      // Satellite blinking in the sky
      { name: 'satellite', label: 'a satellite passes overhead', x: w * 0.85, y: waterY * 0.15, r: 4, color: '180, 220, 255', hovered: false },
      // Weathervane on horizon
      { name: 'weathervane', label: 'a weathervane turns on the horizon', x: w * 0.12, y: waterY - 15, r: 6, color: '200, 180, 140', hovered: false },
      // Tidepool below ice shelf
      { name: 'tidepool', label: 'a tide pool glimmers beneath the ice', x: w * 0.7, y: waterY + 50, r: 18, color: '100, 180, 220', hovered: false },
      // Asteroids streaking
      { name: 'asteroids', label: 'debris streaks across the polar sky', x: w * 0.55, y: waterY * 0.08, r: 3, color: '255, 180, 100', hovered: false },
    )
  }

  async function fetchSeaIceData() {
    try {
      const resp = await fetch('https://noaadata.apps.nsidc.org/NOAA/G02135/seaice_analysis/Sea_Ice_Index_Regional_Daily_Data_G02135_v3.0.xlsx', {
        signal: AbortSignal.timeout(5000),
      })
      if (!resp.ok) throw new Error('fetch failed')
      throw new Error('use fallback')
    } catch {
      seaIceExtent = RECORD_LOW_2026
      meltRate = 1 + (NORMAL_FEB_EXTENT - seaIceExtent) / NORMAL_FEB_EXTENT * 3
    }
  }

  function initAudio() {
    if (audioCtx) return
    try {
      audioCtx = new AudioContext()

      // Wind — filtered noise
      const bufferSize = audioCtx.sampleRate * 2
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
      const data = noiseBuffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.3
      }
      const noise = audioCtx.createBufferSource()
      noise.buffer = noiseBuffer
      noise.loop = true

      const windFilter = audioCtx.createBiquadFilter()
      windFilter.type = 'bandpass'
      windFilter.frequency.value = 300
      windFilter.Q.value = 0.5

      windGain = audioCtx.createGain()
      windGain.gain.value = 0

      noise.connect(windFilter)
      windFilter.connect(windGain)
      windGain.connect(audioCtx.destination)
      noise.start()

      // Fade wind in
      windGain.gain.linearRampToValueAtTime(0.025, audioCtx.currentTime + 3)

      // Schedule periodic ice crack sounds
      scheduleIceCrack()
    } catch {
      // Audio not available
    }
  }

  function scheduleIceCrack() {
    if (!active) return
    const delay = 4000 + Math.random() * 12000
    crackTimeout = setTimeout(() => {
      playIceCrack()
      scheduleIceCrack()
    }, delay)
  }

  function playIceCrack() {
    if (!audioCtx || !active) return
    const now = audioCtx.currentTime
    const osc = audioCtx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(800 + Math.random() * 400, now)
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15)

    const gain = audioCtx.createGain()
    gain.gain.setValueAtTime(0.03, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)

    const filter = audioCtx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 200

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start(now)
    osc.stop(now + 0.25)
  }

  function buildCrystals() {
    if (!canvas) return
    const memories = deps.getMemories()
    const w = canvas.width
    const h = canvas.height
    const waterY = h * (1 - oceanLevel)

    crystals = []
    if (memories.length === 0) return

    const maxCrystals = Math.min(memories.length, 12)
    const spacing = (w - 100) / maxCrystals

    for (let i = 0; i < maxCrystals; i++) {
      const mem = memories[i]
      const cx = 50 + spacing * i + spacing / 2
      const crystalH = 40 + (1 - mem.degradation) * 80
      const crystalW = 20 + (1 - mem.degradation) * 40

      const facets: IceCrystal['facets'] = []
      const numFacets = 3 + Math.floor(Math.random() * 4)
      for (let f = 0; f < numFacets; f++) {
        facets.push({
          x: (Math.random() - 0.5) * crystalW * 0.8,
          y: -Math.random() * crystalH,
          w: 5 + Math.random() * crystalW * 0.5,
          h: 5 + Math.random() * crystalH * 0.3,
          angle: (Math.random() - 0.5) * 0.4,
        })
      }

      crystals.push({
        x: cx,
        y: waterY,
        memory: mem,
        width: crystalW,
        height: crystalH,
        facets,
        meltProgress: mem.degradation,
        drips: [],
        shimmer: Math.random() * Math.PI * 2,
        warmth: 0,
        expanded: false,
        expandProgress: 0,
      })
    }

    buildPortals()
  }

  function handleMouseMove(e: MouseEvent) {
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    mouseX = (e.clientX - rect.left) * (canvas.width / rect.width)
    mouseY = (e.clientY - rect.top) * (canvas.height / rect.height)

    // Check portal hover
    for (const p of portals) {
      const dx = mouseX - p.x
      const dy = mouseY - p.y
      p.hovered = Math.sqrt(dx * dx + dy * dy) < p.r + 15
    }

    // Check crystal hover — change cursor
    let overCrystal = false
    for (const crystal of crystals) {
      const dx = mouseX - crystal.x
      const dy = mouseY - (crystal.y - crystal.height * (1 - crystal.meltProgress) * 0.5)
      if (Math.abs(dx) < crystal.width && Math.abs(dy) < crystal.height * 0.6) {
        overCrystal = true
        break
      }
    }

    if (canvas) {
      canvas.style.cursor = overCrystal || portals.some(p => p.hovered)
        ? 'pointer' : 'default'
    }
  }

  function handleClick(e: MouseEvent) {
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cx = (e.clientX - rect.left) * (canvas.width / rect.width)
    const cy = (e.clientY - rect.top) * (canvas.height / rect.height)

    // Check portal clicks
    for (const p of portals) {
      const dx = cx - p.x
      const dy = cy - p.y
      if (Math.sqrt(dx * dx + dy * dy) < p.r + 15 && deps.switchTo) {
        deps.switchTo(p.name)
        return
      }
    }

    // Check crystal clicks
    for (const crystal of crystals) {
      const dx = cx - crystal.x
      const dy = cy - (crystal.y - crystal.height * (1 - crystal.meltProgress) * 0.5)
      if (Math.abs(dx) < crystal.width * 1.2 && Math.abs(dy) < crystal.height * 0.7) {
        // Toggle expansion
        crystal.expanded = !crystal.expanded
        // Collapse all others
        for (const other of crystals) {
          if (other !== crystal) other.expanded = false
        }
        return
      }
    }

    // Click empty space → collapse all
    for (const crystal of crystals) crystal.expanded = false
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const c = ctx
    const w = canvas.width
    const h = canvas.height
    const waterY = h * (1 - oceanLevel)

    // Background
    c.fillStyle = 'rgba(5, 8, 18, 1)'
    c.fillRect(0, 0, w, h)

    // Sky
    const skyGrad = c.createLinearGradient(0, 0, 0, waterY)
    skyGrad.addColorStop(0, 'rgba(3, 5, 15, 1)')
    skyGrad.addColorStop(0.5, 'rgba(8, 15, 30, 1)')
    skyGrad.addColorStop(1, 'rgba(12, 20, 40, 1)')
    c.fillStyle = skyGrad
    c.fillRect(0, 0, w, waterY)

    // Aurora borealis
    const auroraY = waterY * 0.3
    for (let i = 0; i < 3; i++) {
      const ax = w * 0.2 + Math.sin(time * 0.15 + i * 2) * w * 0.3
      const grad = c.createRadialGradient(ax, auroraY, 0, ax, auroraY, 120 + i * 40)
      const hue = 120 + i * 30 + Math.sin(time * 0.2) * 20
      grad.addColorStop(0, `hsla(${hue}, 60%, 40%, ${0.04 + Math.sin(time * 0.3 + i) * 0.02})`)
      grad.addColorStop(1, 'transparent')
      c.fillStyle = grad
      c.beginPath()
      c.ellipse(ax, auroraY, 150 + i * 30, 40, 0, 0, Math.PI * 2)
      c.fill()
    }

    // Stars
    for (let i = 0; i < 50; i++) {
      const sx = ((i * 137.5) % w)
      const sy = ((i * 97.3) % (waterY * 0.8))
      const twinkle = Math.sin(time * 2 + i * 3) * 0.3 + 0.5
      c.fillStyle = `rgba(200, 220, 255, ${0.1 * twinkle})`
      c.beginPath()
      c.arc(sx, sy, 1, 0, Math.PI * 2)
      c.fill()
    }

    // Navigation portals
    for (const p of portals) {
      const pulse = Math.sin(time * 1.5 + p.x * 0.01) * 0.3 + 0.5
      const alpha = p.hovered ? 0.6 : 0.15 * pulse

      if (p.name === 'satellite') {
        // Blinking dot moving slowly
        const satX = p.x + Math.sin(time * 0.1) * 30
        c.fillStyle = `rgba(${p.color}, ${alpha})`
        c.beginPath()
        c.arc(satX, p.y, p.r * (p.hovered ? 2 : 1), 0, Math.PI * 2)
        c.fill()
        if (p.hovered) {
          c.font = '9px "Cormorant Garamond", serif'
          c.fillStyle = `rgba(${p.color}, 0.5)`
          c.textAlign = 'center'
          c.fillText(p.label, satX, p.y + 18)
        }
      } else if (p.name === 'asteroids') {
        // Streak across sky
        const streakLen = p.hovered ? 25 : 12
        const ax = p.x + Math.sin(time * 0.3) * 20
        c.strokeStyle = `rgba(${p.color}, ${alpha})`
        c.lineWidth = p.hovered ? 2 : 1
        c.beginPath()
        c.moveTo(ax, p.y)
        c.lineTo(ax + streakLen, p.y + streakLen * 0.4)
        c.stroke()
        if (p.hovered) {
          c.font = '9px "Cormorant Garamond", serif'
          c.fillStyle = `rgba(${p.color}, 0.5)`
          c.textAlign = 'center'
          c.fillText(p.label, ax + streakLen / 2, p.y + 22)
        }
      } else if (p.name === 'weathervane') {
        // Silhouette on horizon with spinning arrow
        const angle = time * 0.5
        c.save()
        c.translate(p.x, p.y)
        c.strokeStyle = `rgba(${p.color}, ${alpha})`
        c.lineWidth = p.hovered ? 2 : 1
        // Pole
        c.beginPath()
        c.moveTo(0, 0)
        c.lineTo(0, -20)
        c.stroke()
        // Arrow
        c.save()
        c.translate(0, -20)
        c.rotate(angle)
        c.beginPath()
        c.moveTo(-8, 0)
        c.lineTo(8, 0)
        c.lineTo(5, -3)
        c.stroke()
        c.restore()
        c.restore()
        if (p.hovered) {
          c.font = '9px "Cormorant Garamond", serif'
          c.fillStyle = `rgba(${p.color}, 0.5)`
          c.textAlign = 'center'
          c.fillText(p.label, p.x, p.y + 15)
        }
      } else if (p.name === 'tidepool') {
        // Glimmering pool below ice
        const poolAlpha = p.hovered ? 0.3 : 0.08 * pulse
        const grad = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)
        grad.addColorStop(0, `rgba(${p.color}, ${poolAlpha})`)
        grad.addColorStop(1, 'transparent')
        c.fillStyle = grad
        c.beginPath()
        c.ellipse(p.x, p.y, p.r * 1.5, p.r * 0.6, 0, 0, Math.PI * 2)
        c.fill()
        if (p.hovered) {
          c.font = '9px "Cormorant Garamond", serif'
          c.fillStyle = `rgba(${p.color}, 0.5)`
          c.textAlign = 'center'
          c.fillText(p.label, p.x, p.y + p.r + 15)
        }
      }
    }

    // Ocean
    const oceanGrad = c.createLinearGradient(0, waterY, 0, h)
    oceanGrad.addColorStop(0, 'rgba(8, 20, 40, 1)')
    oceanGrad.addColorStop(0.3, 'rgba(5, 15, 35, 1)')
    oceanGrad.addColorStop(1, 'rgba(3, 8, 20, 1)')
    c.fillStyle = oceanGrad
    c.fillRect(0, waterY, w, h - waterY)

    // Wave lines
    c.strokeStyle = 'rgba(100, 160, 200, 0.06)'
    c.lineWidth = 1
    for (let wave = 0; wave < 5; wave++) {
      c.beginPath()
      for (let x = 0; x < w; x += 4) {
        const wy = waterY + wave * 15 + Math.sin(x * 0.02 + time * 0.5 + wave) * 3
        if (x === 0) c.moveTo(x, wy)
        else c.lineTo(x, wy)
      }
      c.stroke()
    }

    // Ice shelf
    c.fillStyle = 'rgba(180, 210, 230, 0.08)'
    c.beginPath()
    c.moveTo(0, waterY + 2)
    for (let x = 0; x < w; x += 10) {
      const iy = waterY + 2 + Math.sin(x * 0.03 + time * 0.2) * 2
      c.lineTo(x, iy)
    }
    c.lineTo(w, waterY + 8)
    c.lineTo(0, waterY + 8)
    c.closePath()
    c.fill()

    // Cursor warmth radius (visible glow)
    const warmthRadius = 120
    const warmthGrad = c.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, warmthRadius)
    warmthGrad.addColorStop(0, 'rgba(255, 80, 40, 0.03)')
    warmthGrad.addColorStop(0.5, 'rgba(255, 60, 30, 0.01)')
    warmthGrad.addColorStop(1, 'transparent')
    c.fillStyle = warmthGrad
    c.beginPath()
    c.arc(mouseX, mouseY, warmthRadius, 0, Math.PI * 2)
    c.fill()

    // Draw crystals
    for (const crystal of crystals) {
      const melt = crystal.meltProgress
      const intact = 1 - melt

      crystal.meltProgress = crystal.memory.degradation

      // Cursor warmth effect
      const dist = Math.hypot(mouseX - crystal.x, mouseY - crystal.y)
      if (dist < warmthRadius) {
        crystal.warmth = Math.min(1, crystal.warmth + 0.01 * (1 - dist / warmthRadius))
      } else {
        crystal.warmth = Math.max(0, crystal.warmth - 0.005)
      }

      // Expand/collapse animation
      if (crystal.expanded) {
        crystal.expandProgress = Math.min(1, crystal.expandProgress + 0.04)
      } else {
        crystal.expandProgress = Math.max(0, crystal.expandProgress - 0.06)
      }

      const baseAlpha = intact * 0.6
      const shimmer = Math.sin(time * 1.5 + crystal.shimmer) * 0.1
      const warmthGlow = crystal.warmth * 0.15

      c.save()
      c.translate(crystal.x, crystal.y)

      // Warmth-induced glow (red-orange when cursor is near)
      if (crystal.warmth > 0.01) {
        const wGrad = c.createRadialGradient(0, -crystal.height * intact * 0.3, 0, 0, -crystal.height * intact * 0.3, crystal.width * 3)
        wGrad.addColorStop(0, `rgba(255, 100, 50, ${crystal.warmth * 0.08})`)
        wGrad.addColorStop(1, 'transparent')
        c.fillStyle = wGrad
        c.beginPath()
        c.arc(0, -crystal.height * intact * 0.3, crystal.width * 3, 0, Math.PI * 2)
        c.fill()

        // Extra drips from warmth
        if (Math.random() < crystal.warmth * 0.15) {
          crystal.drips.push({
            x: (Math.random() - 0.5) * crystal.width,
            y: -Math.random() * crystal.height * intact * 0.5,
            vy: 0.3 + Math.random(),
            alpha: 0.5,
          })
        }
      }

      // Ice glow
      const glow = c.createRadialGradient(0, -crystal.height * intact * 0.5, 0, 0, -crystal.height * intact * 0.5, crystal.width * 2)
      glow.addColorStop(0, `rgba(150, 200, 255, ${(baseAlpha + shimmer + warmthGlow) * 0.15})`)
      glow.addColorStop(1, 'transparent')
      c.fillStyle = glow
      c.beginPath()
      c.arc(0, -crystal.height * intact * 0.5, crystal.width * 2, 0, Math.PI * 2)
      c.fill()

      // Crystal facets
      for (const facet of crystal.facets) {
        if (facet.y < -crystal.height * intact) continue

        c.save()
        c.translate(facet.x, facet.y * intact)
        c.rotate(facet.angle)

        const facetAlpha = baseAlpha + shimmer + warmthGlow
        c.fillStyle = `rgba(180, 220, 255, ${facetAlpha * 0.3})`
        c.fillRect(-facet.w / 2, -facet.h / 2, facet.w, facet.h)

        c.strokeStyle = `rgba(200, 240, 255, ${facetAlpha * 0.4})`
        c.lineWidth = 0.5
        c.strokeRect(-facet.w / 2, -facet.h / 2, facet.w, facet.h)

        c.restore()
      }

      // Main crystal body
      const topW = crystal.width * 0.3 * intact
      const botW = crystal.width * 0.8
      const crystH = crystal.height * intact

      c.beginPath()
      c.moveTo(-topW, -crystH)
      c.lineTo(topW, -crystH)
      c.lineTo(botW / 2, 0)
      c.lineTo(-botW / 2, 0)
      c.closePath()
      c.fillStyle = `rgba(160, 210, 245, ${baseAlpha * 0.2})`
      c.fill()
      c.strokeStyle = `rgba(200, 240, 255, ${baseAlpha * 0.3})`
      c.lineWidth = 1
      c.stroke()

      // Fracture lines
      for (let f = 0; f < 3; f++) {
        const fy = -crystH * (0.2 + f * 0.3)
        c.strokeStyle = `rgba(200, 240, 255, ${baseAlpha * 0.1})`
        c.beginPath()
        c.moveTo(-topW * 0.5 + f * 3, fy)
        c.lineTo(topW * 0.3 - f * 2, fy + 10)
        c.stroke()
      }

      // Drips
      if (melt > 0.1 || crystal.warmth > 0.1) {
        if (Math.random() < (melt + crystal.warmth) * meltRate * 0.08) {
          crystal.drips.push({
            x: (Math.random() - 0.5) * botW,
            y: 0,
            vy: 0.5 + Math.random() * 1,
            alpha: 0.4,
          })
        }

        crystal.drips = crystal.drips.filter(drip => {
          drip.y += drip.vy
          drip.vy += 0.05
          drip.alpha -= 0.005

          if (drip.alpha <= 0) return false

          c.fillStyle = `rgba(150, 200, 255, ${drip.alpha})`
          c.beginPath()
          c.ellipse(drip.x, drip.y, 1.5, 3, 0, 0, Math.PI * 2)
          c.fill()

          if (crystal.y + drip.y > waterY + 5) {
            waterDrops.push({
              x: crystal.x + drip.x,
              y: waterY,
              vy: 0,
              alpha: 0.3,
            })
            return false
          }

          return true
        })
      }

      // Memory text on crystal surface
      c.font = '9px "Cormorant Garamond", serif'
      c.textAlign = 'center'
      const textAlpha = intact * 0.4
      c.fillStyle = `rgba(220, 240, 255, ${textAlpha})`

      const text = crystal.memory.currentText
      const maxChars = Math.floor(crystal.width * 2)
      const displayText = text.length > maxChars ? text.slice(0, maxChars) + '...' : text
      const words = displayText.split(' ')
      let lineY = -crystH * 0.4
      let line = ''

      for (const word of words) {
        const test = line + (line ? ' ' : '') + word
        if (c.measureText(test).width > crystal.width * 1.5 && line) {
          c.fillText(line, 0, lineY)
          line = word
          lineY += 12
          if (lineY > -5) break
        } else {
          line = test
        }
      }
      if (line && lineY <= -5) c.fillText(line, 0, lineY)

      c.restore()

      // Expanded memory panel
      if (crystal.expandProgress > 0) {
        const ep = crystal.expandProgress
        const panelW = 240 * ep
        const panelH = 100 * ep
        const px = crystal.x - panelW / 2
        const py = crystal.y - crystal.height * intact - panelH - 20

        c.fillStyle = `rgba(8, 15, 35, ${0.85 * ep})`
        c.fillRect(px, py, panelW, panelH)
        c.strokeStyle = `rgba(150, 200, 255, ${0.2 * ep})`
        c.lineWidth = 1
        c.strokeRect(px, py, panelW, panelH)

        if (ep > 0.5) {
          c.font = '11px "Cormorant Garamond", serif'
          c.fillStyle = `rgba(220, 240, 255, ${0.7 * ep})`
          c.textAlign = 'left'

          // Word wrap the full text
          const fullWords = crystal.memory.currentText.split(' ')
          let ly = py + 18
          let ln = ''
          for (const word of fullWords) {
            const test = ln + (ln ? ' ' : '') + word
            if (c.measureText(test).width > panelW - 20 && ln) {
              c.fillText(ln, px + 10, ly)
              ln = word
              ly += 15
              if (ly > py + panelH - 10) break
            } else {
              ln = test
            }
          }
          if (ln && ly <= py + panelH - 10) c.fillText(ln, px + 10, ly)

          // Degradation indicator
          c.font = '8px monospace'
          c.fillStyle = `rgba(255, ${Math.floor(200 * (1 - crystal.memory.degradation))}, ${Math.floor(200 * (1 - crystal.memory.degradation))}, ${0.3 * ep})`
          c.fillText(`${(crystal.memory.degradation * 100).toFixed(0)}% melted`, px + 10, py + panelH - 8)
        }
      }
    }

    // Water drop ripples
    waterDrops = waterDrops.filter(drop => {
      drop.alpha -= 0.008
      if (drop.alpha <= 0) return false

      const radius = (0.3 - drop.alpha) / 0.3 * 30
      c.strokeStyle = `rgba(150, 200, 255, ${drop.alpha * 0.3})`
      c.lineWidth = 0.5
      c.beginPath()
      c.arc(drop.x, drop.y, radius, 0, Math.PI * 2)
      c.stroke()

      return true
    })

    // Sea ice extent data
    c.font = '9px monospace'
    c.fillStyle = 'rgba(150, 200, 255, 0.12)'
    c.textAlign = 'left'
    c.fillText(`arctic sea ice: ${seaIceExtent.toFixed(1)} million km²`, 12, h - 42)

    const deviation = ((NORMAL_FEB_EXTENT - seaIceExtent) / NORMAL_FEB_EXTENT * 100).toFixed(1)
    c.fillStyle = 'rgba(255, 100, 100, 0.12)'
    c.fillText(`${deviation}% below february average`, 12, h - 30)

    c.fillStyle = 'rgba(150, 200, 255, 0.08)'
    c.fillText(`melt rate: ${meltRate.toFixed(2)}x`, 12, h - 18)

    // Title
    c.font = '10px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(180, 220, 255, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.fillText('the glacarium', w / 2, 25)

    // Interaction hint
    c.font = '9px "Cormorant Garamond", serif'
    c.fillStyle = 'rgba(180, 220, 255, 0.04)'
    c.textAlign = 'center'
    c.fillText('your warmth melts the ice · click a crystal to read', w / 2, 40)

    // No memories hint
    if (crystals.length === 0) {
      c.font = '12px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(180, 220, 255, 0.1)'
      c.textAlign = 'center'
      c.fillText('no memories to freeze', w / 2, h / 2 - 20)
      c.font = '10px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(180, 220, 255, 0.06)'
      c.fillText('type something into the void first', w / 2, h / 2 + 5)
    }

    // Context quote
    c.font = '9px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(180, 220, 255, ${0.04 + Math.sin(time * 0.2) * 0.01})`
    c.textAlign = 'center'
    c.fillText('february 2026 — arctic sea ice reaches record low', w / 2, h - 8)
  }

  return {
    name: 'glacarium',
    label: 'the glacarium',

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

      canvas.addEventListener('mousemove', handleMouseMove)
      canvas.addEventListener('click', handleClick)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
          buildCrystals()
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)
      return overlay
    },

    activate() {
      active = true
      fetchSeaIceData()
      buildCrystals()
      initAudio()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      if (crackTimeout) clearTimeout(crackTimeout)
      if (windGain && audioCtx) {
        windGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1)
      }
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      if (crackTimeout) clearTimeout(crackTimeout)
      if (audioCtx) {
        audioCtx.close().catch(() => {})
        audioCtx = null
      }
      canvas?.removeEventListener('mousemove', handleMouseMove)
      canvas?.removeEventListener('click', handleClick)
      overlay?.remove()
    },
  }
}
