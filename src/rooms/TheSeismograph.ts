/**
 * THE SEISMOGRAPH — the earth speaks in tremors
 *
 * Real-time earthquake data from USGS rendered as a living visualization.
 * No memories. No text. Just the planet's heartbeat.
 *
 * The world map is drawn as a minimal dot grid. Earthquakes appear as
 * expanding rings colored by depth (shallow=red, mid=orange, deep=violet).
 * A seismograph trace draws across the bottom — the earth's own handwriting.
 *
 * Data refreshes every 5 minutes from USGS GeoJSON feed.
 * Completely independent of the memory system.
 *
 * Inspired by: seismology, Richter scale, plate tectonics,
 * the earth as a living organism, how the ground beneath us
 * is never really still
 */

import type { Room } from './RoomManager'

interface SeismographDeps {
  switchTo?: (name: string) => void
}

interface Quake {
  lat: number
  lon: number
  mag: number
  depth: number
  place: string
  time: number
  x: number // screen coords
  y: number // screen coords
  ringRadius: number
  ringAlpha: number
  pulsePhase: number
}

const FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'

export function createSeismographRoom(deps?: SeismographDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let quakes: Quake[] = []
  let lastFetch = 0
  let traceData: number[] = []
  let traceOffset = 0
  let selectedQuake: Quake | null = null
  let fetchError = false
  let loading = true
  let hoveredNav = -1

  const navPoints = [
    { label: 'STN:AUT', room: 'automaton', xFrac: 0.03, yFrac: 0.97 },
    { label: 'STN:AST', room: 'asteroids', xFrac: 0.5, yFrac: 0.97 },
    { label: 'STN:WVN', room: 'weathervane', xFrac: 0.97, yFrac: 0.97 },
  ]

  // Simple equirectangular projection
  function latLonToScreen(lat: number, lon: number, w: number, h: number): [number, number] {
    const mapX = w * 0.08
    const mapY = h * 0.06
    const mapW = w * 0.84
    const mapH = h * 0.58

    const x = mapX + ((lon + 180) / 360) * mapW
    const y = mapY + ((90 - lat) / 180) * mapH
    return [x, y]
  }

  // Depth to color
  function depthColor(depth: number, alpha: number): string {
    if (depth < 30) return `rgba(255, 60, 40, ${alpha})`       // shallow — red
    if (depth < 70) return `rgba(255, 140, 40, ${alpha})`      // mid — orange
    if (depth < 150) return `rgba(255, 200, 60, ${alpha})`     // intermediate — gold
    if (depth < 300) return `rgba(140, 100, 255, ${alpha})`    // deep — violet
    return `rgba(80, 60, 200, ${alpha})`                        // very deep — indigo
  }

  // Magnitude to visual size
  function magToSize(mag: number): number {
    return Math.max(2, Math.pow(2, mag) * 0.5)
  }

  async function fetchQuakes() {
    try {
      loading = true
      fetchError = false
      const resp = await fetch(FEED_URL)
      if (!resp.ok) throw new Error('fetch failed')
      const data = await resp.json()

      if (!canvas) return
      const w = canvas.width
      const h = canvas.height

      quakes = data.features.slice(0, 200).map((f: any) => {
        const [lon, lat, depth] = f.geometry.coordinates
        const [x, y] = latLonToScreen(lat, lon, w, h)
        return {
          lat, lon,
          mag: f.properties.mag || 0,
          depth: depth || 0,
          place: f.properties.place || 'unknown',
          time: f.properties.time || Date.now(),
          x, y,
          ringRadius: 0,
          ringAlpha: 1,
          pulsePhase: Math.random() * Math.PI * 2,
        }
      })

      // Build trace from magnitudes (simulate seismograph needle)
      traceData = quakes.slice(0, 100).map(q => q.mag).reverse()
      lastFetch = Date.now()
      loading = false
    } catch {
      fetchError = true
      loading = false
    }
  }

  // Simplified world map — coastline dots
  function drawWorldOutline(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // Draw a simple grid of land mass hints using latitude lines
    ctx.strokeStyle = 'rgba(60, 80, 60, 0.06)'
    ctx.lineWidth = 0.5

    const mapX = w * 0.08
    const mapY = h * 0.06
    const mapW = w * 0.84
    const mapH = h * 0.58

    // Latitude lines
    for (let lat = -60; lat <= 80; lat += 20) {
      const y = mapY + ((90 - lat) / 180) * mapH
      ctx.beginPath()
      ctx.moveTo(mapX, y)
      ctx.lineTo(mapX + mapW, y)
      ctx.stroke()
    }

    // Longitude lines
    for (let lon = -180; lon <= 180; lon += 30) {
      const x = mapX + ((lon + 180) / 360) * mapW
      ctx.beginPath()
      ctx.moveTo(x, mapY)
      ctx.lineTo(x, mapY + mapH)
      ctx.stroke()
    }

    // Equator (slightly brighter)
    const eqY = mapY + mapH / 2
    ctx.strokeStyle = 'rgba(60, 80, 60, 0.12)'
    ctx.beginPath()
    ctx.moveTo(mapX, eqY)
    ctx.lineTo(mapX + mapW, eqY)
    ctx.stroke()

    // Map border
    ctx.strokeStyle = 'rgba(60, 80, 60, 0.08)'
    ctx.strokeRect(mapX, mapY, mapW, mapH)

    // Tectonic plate boundaries (approximate major ones as polylines)
    ctx.strokeStyle = 'rgba(120, 40, 30, 0.06)'
    ctx.lineWidth = 1
    const plates: [number, number][][] = [
      // Pacific Ring of Fire (simplified)
      [[-60, -70], [-46, -75], [-23, -70], [0, -80], [15, -105], [30, -130],
       [45, -130], [50, -150], [55, 165], [50, 155], [45, 145], [35, 140],
       [25, 125], [10, 120], [0, 130], [-10, 150], [-25, 175], [-40, 175], [-50, 165]],
      // Mid-Atlantic Ridge (simplified)
      [[65, -18], [55, -30], [40, -30], [25, -45], [10, -40], [0, -15],
       [-15, -13], [-30, -14], [-45, -15], [-55, -5]],
      // Alpine-Himalayan belt
      [[35, -5], [37, 20], [38, 40], [35, 55], [28, 65], [28, 80], [30, 90]],
    ]

    for (const plate of plates) {
      ctx.beginPath()
      for (let i = 0; i < plate.length; i++) {
        const [lat, lon] = plate[i]
        const [x, y] = latLonToScreen(lat, lon, w, h)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }

  function drawSeismographTrace(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const traceY = h * 0.72
    const traceH = h * 0.18
    const traceW = w * 0.84
    const traceX = w * 0.08

    // Trace background
    ctx.fillStyle = 'rgba(10, 15, 10, 0.5)'
    ctx.fillRect(traceX, traceY, traceW, traceH)
    ctx.strokeStyle = 'rgba(60, 80, 60, 0.08)'
    ctx.strokeRect(traceX, traceY, traceW, traceH)

    // Center line
    const centerY = traceY + traceH / 2
    ctx.strokeStyle = 'rgba(60, 80, 60, 0.1)'
    ctx.beginPath()
    ctx.moveTo(traceX, centerY)
    ctx.lineTo(traceX + traceW, centerY)
    ctx.stroke()

    // Draw trace
    if (traceData.length < 2) return

    ctx.strokeStyle = 'rgba(40, 255, 80, 0.5)'
    ctx.lineWidth = 1.5
    ctx.beginPath()

    const step = traceW / traceData.length
    for (let i = 0; i < traceData.length; i++) {
      const x = traceX + i * step
      const mag = traceData[i]
      // Add some jitter/noise to make it look like a real seismograph
      const noise = Math.sin(time * 3 + i * 0.5) * 2 + Math.sin(time * 7.3 + i * 1.2) * 1
      const deflection = (mag / 9) * (traceH * 0.45) + noise
      const y = centerY - deflection

      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Moving needle indicator
    traceOffset = (traceOffset + 0.3) % traceW
    const needleX = traceX + traceOffset
    ctx.strokeStyle = 'rgba(40, 255, 80, 0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(needleX, traceY)
    ctx.lineTo(needleX, traceY + traceH)
    ctx.stroke()

    // Label
    ctx.font = '9px monospace'
    ctx.fillStyle = 'rgba(40, 255, 80, 0.15)'
    ctx.textAlign = 'left'
    ctx.fillText('seismograph trace — last 24h magnitudes', traceX + 6, traceY + 12)
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height

    // Clear
    ctx.fillStyle = 'rgba(5, 8, 5, 1)'
    ctx.fillRect(0, 0, w, h)

    // World outline
    drawWorldOutline(ctx, w, h)

    // Draw quakes
    for (const q of quakes) {
      const size = magToSize(q.mag)
      const pulse = Math.sin(time * 1.5 + q.pulsePhase) * 0.3 + 0.7

      // Expanding ring
      q.ringRadius += 0.02
      if (q.ringRadius > size * 4) {
        q.ringRadius = 0
        q.ringAlpha = 0.5
      }
      if (q.ringRadius > 0) {
        ctx.strokeStyle = depthColor(q.depth, q.ringAlpha * 0.3 * pulse)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(q.x, q.y, q.ringRadius, 0, Math.PI * 2)
        ctx.stroke()
        q.ringAlpha *= 0.995
      }

      // Core dot
      ctx.fillStyle = depthColor(q.depth, 0.4 + pulse * 0.3)
      ctx.beginPath()
      ctx.arc(q.x, q.y, size * pulse, 0, Math.PI * 2)
      ctx.fill()

      // Glow for larger quakes
      if (q.mag >= 4) {
        const glow = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, size * 3)
        glow.addColorStop(0, depthColor(q.depth, 0.1 * pulse))
        glow.addColorStop(1, 'transparent')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(q.x, q.y, size * 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Seismograph trace
    drawSeismographTrace(ctx, w, h)

    // Selected quake info
    if (selectedQuake) {
      const sq = selectedQuake
      ctx.font = '11px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(40, 255, 80, 0.4)'
      ctx.textAlign = 'center'

      const infoY = h * 0.94
      ctx.fillText(
        `M${sq.mag.toFixed(1)} · ${sq.place} · ${sq.depth.toFixed(0)}km deep · ${timeAgo(sq.time)}`,
        w / 2, infoY
      )
    }

    // Stats
    const totalQuakes = quakes.length
    const maxMag = quakes.reduce((max, q) => Math.max(max, q.mag), 0)

    ctx.font = '9px monospace'
    ctx.fillStyle = 'rgba(40, 255, 80, 0.12)'
    ctx.textAlign = 'left'
    ctx.fillText(`${totalQuakes} earthquakes (24h)`, 12, h - 30)
    ctx.fillText(`max M${maxMag.toFixed(1)}`, 12, h - 18)

    ctx.textAlign = 'right'
    const mins = Math.floor((Date.now() - lastFetch) / 60000)
    ctx.fillText(`updated ${mins}m ago`, w - 12, h - 30)
    ctx.fillText('usgs.gov', w - 12, h - 18)

    // Title
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(40, 255, 80, ${0.08 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the seismograph', w / 2, 25)

    // Loading/error state
    if (loading && quakes.length === 0) {
      ctx.font = '14px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(40, 255, 80, 0.15)'
      ctx.fillText('listening for tremors...', w / 2, h / 2)
    }
    if (fetchError && quakes.length === 0) {
      ctx.font = '12px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(255, 80, 40, 0.15)'
      ctx.fillText('the earth is silent. (connection failed)', w / 2, h / 2)
    }

    // Navigation portals — station codes on readout
    if (deps?.switchTo) {
      for (let i = 0; i < navPoints.length; i++) {
        const np = navPoints[i]
        const nx = w * np.xFrac
        const ny = h * np.yFrac
        const hovered = hoveredNav === i
        const a = hovered ? 0.4 : 0.08
        ctx.font = '8px monospace'
        ctx.fillStyle = `rgba(40, 255, 80, ${a})`
        ctx.textAlign = np.xFrac < 0.3 ? 'left' : np.xFrac > 0.7 ? 'right' : 'center'
        ctx.fillText(np.label, nx, ny)
        if (hovered) {
          ctx.strokeStyle = `rgba(40, 255, 80, 0.2)`
          ctx.lineWidth = 0.5
          ctx.strokeRect(nx - (np.xFrac < 0.3 ? 3 : np.xFrac > 0.7 ? 52 : 24), ny - 10, 55, 14)
        }
      }
    }

    // Depth legend
    ctx.font = '8px monospace'
    ctx.textAlign = 'right'
    const legendX = w - 12
    const legendY = h * 0.08
    const depths = [
      { label: '<30km', depth: 10 },
      { label: '30-70km', depth: 50 },
      { label: '70-150km', depth: 100 },
      { label: '150-300km', depth: 200 },
      { label: '>300km', depth: 400 },
    ]
    for (let i = 0; i < depths.length; i++) {
      ctx.fillStyle = depthColor(depths[i].depth, 0.4)
      ctx.beginPath()
      ctx.arc(legendX - 40, legendY + i * 14, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(40, 255, 80, 0.12)'
      ctx.fillText(depths[i].label, legendX, legendY + i * 14 + 3)
    }

    // Refresh data every 5 minutes
    if (Date.now() - lastFetch > 300000) {
      fetchQuakes()
    }
  }

  function timeAgo(ts: number): string {
    const mins = Math.floor((Date.now() - ts) / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    return `${hours}h ${mins % 60}m ago`
  }

  function handleClick(e: MouseEvent) {
    if (!canvas) return
    const x = e.clientX
    const y = e.clientY

    // Find closest quake
    let closest: Quake | null = null
    let closestDist = Infinity
    for (const q of quakes) {
      const dx = q.x - x
      const dy = q.y - y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < closestDist && dist < 30) {
        closest = q
        closestDist = dist
      }
    }
    selectedQuake = closest
  }

  return {
    name: 'seismograph',
    label: 'the seismograph',

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

      canvas.addEventListener('click', handleClick)

      // Navigation portal click + hover
      canvas.addEventListener('click', (e) => {
        if (!deps?.switchTo || !canvas) return
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
      })
      canvas.addEventListener('mousemove', (e) => {
        if (!deps?.switchTo || !canvas) return
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
      })

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
          // Recalculate quake positions
          for (const q of quakes) {
            const [x, y] = latLonToScreen(q.lat, q.lon, canvas.width, canvas.height)
            q.x = x
            q.y = y
          }
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)
      return overlay
    },

    activate() {
      active = true
      fetchQuakes()
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
