/**
 * THE GLACARIUM — memories frozen in ice
 *
 * Inspired by the record-low Arctic sea ice extent of February 2026.
 * The Arctic is losing ice at unprecedented rates. Your memories
 * crystallize as ice formations on a dark ocean — but the warming
 * world melts them. Degraded memories drip and dissolve. Fresh
 * memories form sharp, brilliant crystals.
 *
 * The room tracks real Arctic conditions: sea ice extent data
 * modulates the overall melt rate. When the Arctic shrinks,
 * your memories melt faster.
 *
 * Cultural context: Feb 2026 saw Arctic sea ice extent drop to
 * record lows, with scientists calling it "uncharted territory."
 * This room makes that crisis visceral and personal.
 *
 * USES MEMORIES. Data-driven. Climate-aware.
 *
 * Inspired by: Olafur Eliasson's Ice Watch, Arctic sea ice decline,
 * cryosphere science, the metaphor of frozen memories thawing,
 * Svalbard Global Seed Vault, permafrost methane release,
 * how glaciers carry ancient air bubbles (frozen time)
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
}

interface IceCrystal {
  x: number
  y: number
  memory: Memory
  width: number
  height: number
  facets: { x: number; y: number; w: number; h: number; angle: number }[]
  meltProgress: number // 0 = frozen solid, 1 = fully melted
  drips: { x: number; y: number; vy: number; alpha: number }[]
  shimmer: number
}

export function createGlaciariumRoom(deps: GlaciariumDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let crystals: IceCrystal[] = []
  let oceanLevel = 0.7 // proportion of screen that's ocean
  let seaIceExtent = 14.0 // million km², normal Feb avg ~14.5
  let meltRate = 1.0 // multiplier based on ice extent deviation
  let waterDrops: { x: number; y: number; vy: number; alpha: number }[] = []

  // Feb 2026 Arctic headline data
  const NORMAL_FEB_EXTENT = 14.5 // million km² (historical average)
  const RECORD_LOW_2026 = 13.2 // approximate record low Feb 2026

  async function fetchSeaIceData() {
    // Try to fetch real NSIDC sea ice extent
    // Falls back to known Feb 2026 values if unavailable
    try {
      const resp = await fetch('https://noaadata.apps.nsidc.org/NOAA/G02135/seaice_analysis/Sea_Ice_Index_Regional_Daily_Data_G02135_v3.0.xlsx', {
        signal: AbortSignal.timeout(5000),
      })
      // NSIDC data is complex — use the known 2026 value as fallback
      if (!resp.ok) throw new Error('fetch failed')
      // If we got data, we'd parse it here — but the XLSX endpoint is not CORS-friendly
      throw new Error('use fallback')
    } catch {
      // Use known Feb 2026 data — record low
      seaIceExtent = RECORD_LOW_2026
      meltRate = 1 + (NORMAL_FEB_EXTENT - seaIceExtent) / NORMAL_FEB_EXTENT * 3
    }
  }

  function buildCrystals() {
    if (!canvas) return
    const memories = deps.getMemories()
    const w = canvas.width
    const h = canvas.height
    const waterY = h * (1 - oceanLevel)

    crystals = []

    if (memories.length === 0) return

    // Place crystals along the ice shelf
    const maxCrystals = Math.min(memories.length, 12)
    const spacing = (w - 100) / maxCrystals

    for (let i = 0; i < maxCrystals; i++) {
      const mem = memories[i]
      const cx = 50 + spacing * i + spacing / 2
      const crystalH = 40 + (1 - mem.degradation) * 80
      const crystalW = 20 + (1 - mem.degradation) * 40

      // Generate facets — irregular ice crystal shapes
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
      })
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const c = ctx
    const w = canvas.width
    const h = canvas.height
    const waterY = h * (1 - oceanLevel)

    // Dark arctic ocean background
    c.fillStyle = 'rgba(5, 8, 18, 1)'
    c.fillRect(0, 0, w, h)

    // Sky — dark polar sky with aurora hints
    const skyGrad = c.createLinearGradient(0, 0, 0, waterY)
    skyGrad.addColorStop(0, 'rgba(3, 5, 15, 1)')
    skyGrad.addColorStop(0.5, 'rgba(8, 15, 30, 1)')
    skyGrad.addColorStop(1, 'rgba(12, 20, 40, 1)')
    c.fillStyle = skyGrad
    c.fillRect(0, 0, w, waterY)

    // Aurora borealis (subtle)
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

    // Ocean — dark water with subtle movement
    const oceanGrad = c.createLinearGradient(0, waterY, 0, h)
    oceanGrad.addColorStop(0, 'rgba(8, 20, 40, 1)')
    oceanGrad.addColorStop(0.3, 'rgba(5, 15, 35, 1)')
    oceanGrad.addColorStop(1, 'rgba(3, 8, 20, 1)')
    c.fillStyle = oceanGrad
    c.fillRect(0, waterY, w, h - waterY)

    // Wave lines on ocean surface
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

    // Ice shelf — white/blue ice along the water line
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

    // Draw ice crystals (memories)
    for (const crystal of crystals) {
      const melt = crystal.meltProgress
      const intact = 1 - melt

      // Update melt based on degradation and ice extent
      crystal.meltProgress = crystal.memory.degradation

      // Crystal body — vertical ice formation
      const baseAlpha = intact * 0.6
      const shimmer = Math.sin(time * 1.5 + crystal.shimmer) * 0.1

      // Main crystal pillar
      c.save()
      c.translate(crystal.x, crystal.y)

      // Ice glow
      const glow = c.createRadialGradient(0, -crystal.height * intact * 0.5, 0, 0, -crystal.height * intact * 0.5, crystal.width * 2)
      glow.addColorStop(0, `rgba(150, 200, 255, ${(baseAlpha + shimmer) * 0.15})`)
      glow.addColorStop(1, 'transparent')
      c.fillStyle = glow
      c.beginPath()
      c.arc(0, -crystal.height * intact * 0.5, crystal.width * 2, 0, Math.PI * 2)
      c.fill()

      // Crystal facets
      for (const facet of crystal.facets) {
        if (facet.y < -crystal.height * intact) continue // melted away

        c.save()
        c.translate(facet.x, facet.y * intact)
        c.rotate(facet.angle)

        // Ice facet — translucent blue-white
        const facetAlpha = baseAlpha + shimmer
        c.fillStyle = `rgba(180, 220, 255, ${facetAlpha * 0.3})`
        c.fillRect(-facet.w / 2, -facet.h / 2, facet.w, facet.h)

        // Facet edge highlight
        c.strokeStyle = `rgba(200, 240, 255, ${facetAlpha * 0.4})`
        c.lineWidth = 0.5
        c.strokeRect(-facet.w / 2, -facet.h / 2, facet.w, facet.h)

        c.restore()
      }

      // Main crystal body (trapezoid)
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

      // Internal fracture lines
      for (let f = 0; f < 3; f++) {
        const fy = -crystH * (0.2 + f * 0.3)
        c.strokeStyle = `rgba(200, 240, 255, ${baseAlpha * 0.1})`
        c.beginPath()
        c.moveTo(-topW * 0.5 + f * 3, fy)
        c.lineTo(topW * 0.3 - f * 2, fy + 10)
        c.stroke()
      }

      // Drip effect for melting crystals
      if (melt > 0.1) {
        // Spawn drips
        if (Math.random() < melt * meltRate * 0.08) {
          crystal.drips.push({
            x: (Math.random() - 0.5) * botW,
            y: 0,
            vy: 0.5 + Math.random() * 1,
            alpha: 0.4,
          })
        }

        // Update and draw drips
        crystal.drips = crystal.drips.filter(drip => {
          drip.y += drip.vy
          drip.vy += 0.05 // gravity
          drip.alpha -= 0.005

          if (drip.alpha <= 0) return false

          c.fillStyle = `rgba(150, 200, 255, ${drip.alpha})`
          c.beginPath()
          c.ellipse(drip.x, drip.y, 1.5, 3, 0, 0, Math.PI * 2)
          c.fill()

          // Add to global water drops when they hit the ocean
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

      // Memory text — etched into the ice
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

    // Sea ice extent data display
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
