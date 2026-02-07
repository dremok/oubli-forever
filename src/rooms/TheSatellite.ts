/**
 * THE SATELLITE — orbital perspective
 *
 * Tracks the International Space Station in real-time using the
 * Open Notify API. Renders a simplified Earth with the ISS
 * orbiting overhead. Your memories appear as signal beacons
 * scattered across the planet — when the ISS passes near one,
 * it "receives the transmission" and displays the memory text.
 *
 * The ISS completes an orbit every ~90 minutes. Patience rewarded.
 *
 * Cultural context: Artemis II was delayed again in early 2026
 * due to hydrogen leak issues. Meanwhile the ISS continues its
 * quiet orbit, passing over every human being on Earth every day.
 * A satellite doesn't choose what to observe — it receives
 * whatever signals reach it.
 *
 * USES MEMORIES. Live data. Space-aware.
 *
 * Inspired by: ISS live feeds, Powers of Ten (Eames), Overview Effect,
 * Artemis II delays, SETI signal searches, the loneliness of orbit,
 * how everything looks small from far enough away
 */

import type { Room } from './RoomManager'

interface Memory {
  id: string
  originalText: string
  currentText: string
  degradation: number
  timestamp: number
}

interface SatelliteDeps {
  getMemories: () => Memory[]
  switchTo?: (name: string) => void
}

interface Beacon {
  lat: number
  lon: number
  memory: Memory
  pulsePhase: number
  received: boolean
  receiveTime: number
}

export function createSatelliteRoom(deps: SatelliteDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let issLat = 0
  let issLon = 0
  let issTrail: { x: number; y: number; alpha: number }[] = []
  let beacons: Beacon[] = []
  let receivedMessage: { text: string; alpha: number } | null = null
  let fetchInterval: number | null = null
  let totalReceived = 0
  let hoveredLandmark = -1

  const landmarks: {
    room: string; label: string; lat: number; lon: number;
    illumination: number; lastIlluminated: number
  }[] = [
    { room: 'observatory', label: 'Mauna Kea', lat: 19.82, lon: -155.47, illumination: 0, lastIlluminated: 0 },
    { room: 'radio', label: 'Arecibo', lat: 18.35, lon: -66.75, illumination: 0, lastIlluminated: 0 },
    { room: 'lighthouse', label: 'Cape Hatteras', lat: 35.25, lon: -75.53, illumination: 0, lastIlluminated: 0 },
    { room: 'glacarium', label: 'South Pole', lat: -90, lon: 0, illumination: 0, lastIlluminated: 0 },
    { room: 'asteroids', label: 'Chicxulub', lat: 21.3, lon: -89.5, illumination: 0, lastIlluminated: 0 },
  ]

  // Simple equirectangular projection
  function project(lat: number, lon: number, w: number, h: number): { x: number; y: number } {
    const mapW = w * 0.85
    const mapH = h * 0.6
    const mapX = (w - mapW) / 2
    const mapY = (h - mapH) / 2 - 10

    const x = mapX + ((lon + 180) / 360) * mapW
    const y = mapY + ((90 - lat) / 180) * mapH
    return { x, y }
  }

  async function fetchISS() {
    try {
      const resp = await fetch('http://api.open-notify.org/iss-now.json', {
        signal: AbortSignal.timeout(5000),
      })
      if (!resp.ok) throw new Error('fetch failed')
      const data = await resp.json()
      if (data.message === 'success') {
        issLat = parseFloat(data.iss_position.latitude)
        issLon = parseFloat(data.iss_position.longitude)
      }
    } catch {
      // Simulate ISS movement if API unavailable
      // ISS moves roughly 4 degrees longitude per minute
      issLon += 0.067 * 5 // approximate for 5-second intervals
      if (issLon > 180) issLon -= 360
      issLat = 30 * Math.sin(issLon * Math.PI / 180 * 0.5) // sinusoidal orbit approximation
    }
  }

  function placeBeacons() {
    const memories = deps.getMemories()
    beacons = []

    // Scatter memories as beacons across the globe
    // Use memory creation time as a seed for consistent positioning
    for (let i = 0; i < Math.min(memories.length, 20); i++) {
      const mem = memories[i]
      // Deterministic position from memory ID hash
      const hash = hashString(mem.id || mem.originalText)
      const lat = ((hash % 1400) / 1400) * 140 - 70 // -70 to 70 (avoid poles)
      const lon = (((hash >> 8) % 3600) / 3600) * 360 - 180

      beacons.push({
        lat,
        lon,
        memory: mem,
        pulsePhase: Math.random() * Math.PI * 2,
        received: false,
        receiveTime: 0,
      })
    }
  }

  function hashString(s: string): number {
    let hash = 0
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0
    }
    return Math.abs(hash)
  }

  function degDist(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLat = lat1 - lat2
    const dLon = lon1 - lon2
    const adjustedDLon = Math.abs(dLon) > 180 ? dLon + (dLon > 0 ? -360 : 360) : dLon
    return Math.sqrt(dLat * dLat + adjustedDLon * adjustedDLon)
  }

  function checkReception() {
    if (!canvas) return

    for (const beacon of beacons) {
      if (beacon.received) continue

      const dist = degDist(issLat, issLon, beacon.lat, beacon.lon)

      // ISS "reception radius" — ~20 degrees (roughly its visible footprint)
      if (dist < 20) {
        beacon.received = true
        beacon.receiveTime = time
        totalReceived++

        // Show the received memory
        receivedMessage = {
          text: beacon.memory.currentText,
          alpha: 1,
        }
      }
    }

    // Illuminate landmarks within ISS range
    for (const lm of landmarks) {
      const dist = degDist(issLat, issLon, lm.lat, lm.lon)
      if (dist < 25) {
        lm.illumination = 1.0
        lm.lastIlluminated = time
      }
    }
  }

  // --- Landmark icon drawing functions (small canvas shapes, 2-4px scale) ---

  function drawDomeIcon(c: CanvasRenderingContext2D, x: number, y: number, alpha: number) {
    // Observatory dome — small hemisphere on a base
    c.strokeStyle = `rgba(255, 215, 0, ${alpha})`
    c.lineWidth = 1
    c.beginPath()
    c.arc(x, y - 1, 3, Math.PI, 0) // dome arc
    c.lineTo(x + 3, y + 2)
    c.lineTo(x - 3, y + 2)
    c.closePath()
    c.stroke()
    // Slit line
    c.beginPath()
    c.moveTo(x, y - 4)
    c.lineTo(x, y - 1)
    c.stroke()
  }

  function drawDishIcon(c: CanvasRenderingContext2D, x: number, y: number, alpha: number) {
    // Radio dish — parabolic curve on a stem
    c.strokeStyle = `rgba(255, 215, 0, ${alpha})`
    c.lineWidth = 1
    c.beginPath()
    c.moveTo(x - 3, y - 3)
    c.quadraticCurveTo(x, y + 1, x + 3, y - 3) // dish curve
    c.stroke()
    // Support stem
    c.beginPath()
    c.moveTo(x, y - 1)
    c.lineTo(x, y + 3)
    c.stroke()
    // Feed point
    c.beginPath()
    c.arc(x, y - 3, 0.8, 0, Math.PI * 2)
    c.stroke()
  }

  function drawTowerIcon(c: CanvasRenderingContext2D, x: number, y: number, alpha: number) {
    // Lighthouse tower — narrow trapezoid with a light cap
    c.strokeStyle = `rgba(255, 215, 0, ${alpha})`
    c.lineWidth = 1
    c.beginPath()
    c.moveTo(x - 1, y - 4) // top left
    c.lineTo(x + 1, y - 4) // top right
    c.lineTo(x + 2, y + 3) // bottom right
    c.lineTo(x - 2, y + 3) // bottom left
    c.closePath()
    c.stroke()
    // Light cap
    c.fillStyle = `rgba(255, 215, 0, ${alpha * 0.8})`
    c.beginPath()
    c.arc(x, y - 4, 1.2, 0, Math.PI * 2)
    c.fill()
  }

  function drawSnowflakeIcon(c: CanvasRenderingContext2D, x: number, y: number, alpha: number) {
    // Snowflake — six short lines from center
    c.strokeStyle = `rgba(255, 215, 0, ${alpha})`
    c.lineWidth = 0.8
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2
      c.beginPath()
      c.moveTo(x, y)
      c.lineTo(x + Math.cos(angle) * 3.5, y + Math.sin(angle) * 3.5)
      c.stroke()
      // Small tick marks at the end of each arm
      const endX = x + Math.cos(angle) * 3.5
      const endY = y + Math.sin(angle) * 3.5
      const perpAngle = angle + Math.PI / 2
      c.beginPath()
      c.moveTo(endX + Math.cos(perpAngle) * 1, endY + Math.sin(perpAngle) * 1)
      c.lineTo(endX - Math.cos(perpAngle) * 1, endY - Math.sin(perpAngle) * 1)
      c.stroke()
    }
  }

  function drawCraterIcon(c: CanvasRenderingContext2D, x: number, y: number, alpha: number) {
    // Crater — ellipse with inner ring
    c.strokeStyle = `rgba(255, 215, 0, ${alpha})`
    c.lineWidth = 0.8
    c.beginPath()
    c.ellipse(x, y, 4, 2.5, 0, 0, Math.PI * 2)
    c.stroke()
    // Inner rim
    c.beginPath()
    c.ellipse(x, y + 0.5, 2, 1.2, 0, 0, Math.PI * 2)
    c.stroke()
  }

  const landmarkIconDrawers = [drawDomeIcon, drawDishIcon, drawTowerIcon, drawSnowflakeIcon, drawCraterIcon]

  // Simplified continent outlines (major coastline points)
  const CONTINENTS: number[][][] = [
    // North America (simplified)
    [[-130,50],[-125,60],[-100,60],[-80,45],[-75,30],[-80,25],[-100,20],[-105,25],[-120,35],[-130,50]],
    // South America
    [[-80,10],[-60,5],[-35,-5],[-40,-20],[-55,-30],[-70,-50],[-75,-45],[-70,-15],[-80,10]],
    // Europe
    [[-10,35],[0,45],[5,50],[10,55],[25,60],[30,55],[30,45],[25,35],[10,35],[-10,35]],
    // Africa
    [[-15,15],[-15,30],[0,35],[10,35],[35,30],[40,10],[50,10],[45,-5],[35,-30],[20,-35],[15,-25],[10,-5],[-15,5],[-15,15]],
    // Asia (simplified)
    [[30,45],[50,50],[60,55],[80,60],[100,55],[120,50],[130,45],[140,40],[130,30],[120,25],[105,10],[100,15],[80,25],[70,25],[60,30],[40,35],[30,45]],
    // Australia
    [[115,-15],[130,-12],[150,-15],[155,-25],[150,-35],[140,-38],[130,-35],[115,-25],[115,-15]],
  ]

  function drawContinents(c: CanvasRenderingContext2D, w: number, h: number) {
    c.strokeStyle = 'rgba(100, 160, 200, 0.08)'
    c.lineWidth = 1

    for (const continent of CONTINENTS) {
      c.beginPath()
      for (let i = 0; i < continent.length; i++) {
        const [lon, lat] = continent[i]
        const p = project(lat, lon, w, h)
        if (i === 0) c.moveTo(p.x, p.y)
        else c.lineTo(p.x, p.y)
      }
      c.closePath()
      c.stroke()
      c.fillStyle = 'rgba(50, 80, 100, 0.04)'
      c.fill()
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const c = ctx
    const w = canvas.width
    const h = canvas.height

    // Dark space background
    c.fillStyle = 'rgba(2, 3, 8, 1)'
    c.fillRect(0, 0, w, h)

    // Stars
    for (let i = 0; i < 80; i++) {
      const sx = ((i * 137.5 + 50) % w)
      const sy = ((i * 97.3 + 30) % h)
      const twinkle = Math.sin(time * 1.5 + i * 2.7) * 0.3 + 0.5
      c.fillStyle = `rgba(200, 220, 255, ${0.05 * twinkle})`
      c.beginPath()
      c.arc(sx, sy, 0.8, 0, Math.PI * 2)
      c.fill()
    }

    // Map border (subtle)
    const mapW = w * 0.85
    const mapH = h * 0.6
    const mapX = (w - mapW) / 2
    const mapY = (h - mapH) / 2 - 10
    c.strokeStyle = 'rgba(100, 160, 200, 0.04)'
    c.lineWidth = 1
    c.strokeRect(mapX, mapY, mapW, mapH)

    // Grid lines
    c.strokeStyle = 'rgba(100, 160, 200, 0.02)'
    c.lineWidth = 0.5
    // Latitude lines
    for (let lat = -60; lat <= 60; lat += 30) {
      const p1 = project(lat, -180, w, h)
      const p2 = project(lat, 180, w, h)
      c.beginPath()
      c.moveTo(p1.x, p1.y)
      c.lineTo(p2.x, p2.y)
      c.stroke()
    }
    // Longitude lines
    for (let lon = -180; lon <= 180; lon += 30) {
      const p1 = project(-90, lon, w, h)
      const p2 = project(90, lon, w, h)
      c.beginPath()
      c.moveTo(p1.x, p1.y)
      c.lineTo(p2.x, p2.y)
      c.stroke()
    }

    // Continents
    drawContinents(c, w, h)

    // Memory beacons
    for (const beacon of beacons) {
      const p = project(beacon.lat, beacon.lon, w, h)
      const pulse = Math.sin(time * 2 + beacon.pulsePhase)
      const intact = 1 - beacon.memory.degradation

      if (beacon.received) {
        // Received beacon — golden flash then dim
        const timeSinceReceive = time - beacon.receiveTime
        const fadeAlpha = Math.max(0, 1 - timeSinceReceive / 10)

        // Reception burst
        if (timeSinceReceive < 2) {
          const burstRadius = timeSinceReceive * 30
          c.strokeStyle = `rgba(255, 215, 0, ${0.3 * (1 - timeSinceReceive / 2)})`
          c.lineWidth = 1
          c.beginPath()
          c.arc(p.x, p.y, burstRadius, 0, Math.PI * 2)
          c.stroke()
        }

        // Received dot
        c.fillStyle = `rgba(255, 215, 0, ${0.3 * fadeAlpha})`
        c.beginPath()
        c.arc(p.x, p.y, 3, 0, Math.PI * 2)
        c.fill()
      } else {
        // Active beacon — pulsing signal
        const signalStrength = intact * 0.8

        // Pulse rings
        const radius = 5 + pulse * 3
        c.strokeStyle = `rgba(255, 20, 147, ${0.1 * signalStrength})`
        c.lineWidth = 0.5
        c.beginPath()
        c.arc(p.x, p.y, radius, 0, Math.PI * 2)
        c.stroke()

        // Beacon dot
        c.fillStyle = `rgba(255, 20, 147, ${0.2 + pulse * 0.05 * signalStrength})`
        c.beginPath()
        c.arc(p.x, p.y, 2, 0, Math.PI * 2)
        c.fill()

        // Signal line upward (toward satellite)
        if (Math.random() < 0.02 * signalStrength) {
          c.strokeStyle = `rgba(255, 20, 147, 0.05)`
          c.lineWidth = 0.5
          c.beginPath()
          c.moveTo(p.x, p.y)
          c.lineTo(p.x, p.y - 20 - Math.random() * 30)
          c.stroke()
        }
      }
    }

    // ISS position
    const issP = project(issLat, issLon, w, h)

    // ISS trail
    issTrail.push({ x: issP.x, y: issP.y, alpha: 0.3 })
    if (issTrail.length > 200) issTrail.shift()

    // Draw trail
    for (let i = 0; i < issTrail.length - 1; i++) {
      const t = issTrail[i]
      const next = issTrail[i + 1]
      // Don't draw trail across map wrap
      if (Math.abs(next.x - t.x) > w * 0.3) continue
      t.alpha -= 0.001
      c.strokeStyle = `rgba(255, 215, 0, ${Math.max(0, t.alpha * 0.2)})`
      c.lineWidth = 1
      c.beginPath()
      c.moveTo(t.x, t.y)
      c.lineTo(next.x, next.y)
      c.stroke()
    }
    issTrail = issTrail.filter(t => t.alpha > 0)

    // ISS glow
    const issGlow = c.createRadialGradient(issP.x, issP.y, 0, issP.x, issP.y, 25)
    issGlow.addColorStop(0, 'rgba(255, 215, 0, 0.15)')
    issGlow.addColorStop(1, 'transparent')
    c.fillStyle = issGlow
    c.beginPath()
    c.arc(issP.x, issP.y, 25, 0, Math.PI * 2)
    c.fill()

    // ISS icon (simple cross shape)
    c.strokeStyle = 'rgba(255, 215, 0, 0.5)'
    c.lineWidth = 1.5
    // Solar panels
    c.beginPath()
    c.moveTo(issP.x - 8, issP.y)
    c.lineTo(issP.x + 8, issP.y)
    c.moveTo(issP.x, issP.y - 4)
    c.lineTo(issP.x, issP.y + 4)
    c.stroke()
    // Center dot
    c.fillStyle = 'rgba(255, 215, 0, 0.7)'
    c.beginPath()
    c.arc(issP.x, issP.y, 2, 0, Math.PI * 2)
    c.fill()

    // ISS footprint circle (visibility radius ~2200km ≈ ~20 degrees)
    c.strokeStyle = 'rgba(255, 215, 0, 0.04)'
    c.lineWidth = 1
    c.setLineDash([4, 4])
    // Approximate footprint as circle on the projection
    const footprintRadius = (20 / 180) * mapH / 2
    c.beginPath()
    c.arc(issP.x, issP.y, footprintRadius, 0, Math.PI * 2)
    c.stroke()
    c.setLineDash([])

    // Check for beacon reception
    checkReception()

    // Received message display
    if (receivedMessage) {
      receivedMessage.alpha -= 0.004
      if (receivedMessage.alpha <= 0) {
        receivedMessage = null
      } else {
        c.font = '13px "Cormorant Garamond", serif'
        c.fillStyle = `rgba(255, 215, 0, ${receivedMessage.alpha * 0.5})`
        c.textAlign = 'center'

        // Word wrap
        const words = receivedMessage.text.split(' ')
        const maxWidth = w * 0.5
        let line = ''
        let lineY = h * 0.88

        c.font = '8px monospace'
        c.fillStyle = `rgba(255, 215, 0, ${receivedMessage.alpha * 0.2})`
        c.fillText('▼ signal received', w / 2, lineY - 18)

        c.font = '13px "Cormorant Garamond", serif'
        c.fillStyle = `rgba(255, 215, 0, ${receivedMessage.alpha * 0.5})`

        for (const word of words) {
          const test = line + (line ? ' ' : '') + word
          if (c.measureText(test).width > maxWidth && line) {
            c.fillText(line, w / 2, lineY)
            line = word
            lineY += 18
          } else {
            line = test
          }
        }
        if (line) c.fillText(line, w / 2, lineY)
      }
    }

    // ISS data
    c.font = '9px monospace'
    c.fillStyle = 'rgba(255, 215, 0, 0.12)'
    c.textAlign = 'left'
    c.fillText(`iss: ${issLat.toFixed(2)}°N ${issLon.toFixed(2)}°E`, 12, h - 42)
    c.fillText(`altitude: ~420 km`, 12, h - 30)
    c.fillText(`${beacons.filter(b => !b.received).length} signals awaiting reception`, 12, h - 18)

    // Title
    c.font = '10px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(255, 215, 0, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.fillText('the satellite', w / 2, 25)

    // Stats
    c.font = '9px monospace'
    c.fillStyle = 'rgba(255, 215, 0, 0.08)'
    c.textAlign = 'right'
    c.fillText(`${totalReceived} transmissions received`, w - 12, h - 18)

    // No memories hint
    if (beacons.length === 0) {
      c.font = '12px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(255, 215, 0, 0.1)'
      c.textAlign = 'center'
      c.fillText('no signals to receive', w / 2, h * 0.88)
      c.font = '10px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(255, 215, 0, 0.06)'
      c.fillText('type something into the void to create a beacon', w / 2, h * 0.88 + 20)
    }

    // Geographic landmark navigation
    if (deps.switchTo) {
      for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i]

        // Decay illumination over ~30 seconds
        if (lm.lastIlluminated > 0 && time - lm.lastIlluminated > 0) {
          lm.illumination = Math.max(0, 1 - (time - lm.lastIlluminated) / 30)
        }

        const p = project(lm.lat, lm.lon, w, h)
        const illum = lm.illumination
        const hovered = hoveredLandmark === i && illum > 0.1

        // Base alpha: barely visible when not illuminated, bright when illuminated
        const baseAlpha = 0.03 + illum * 0.4
        const iconAlpha = hovered ? Math.min(baseAlpha * 1.6, 0.7) : baseAlpha

        // Golden pulse ring when illuminated
        if (illum > 0.1) {
          const pulsePhase = (time - lm.lastIlluminated) * 3
          const pulseRadius = 8 + Math.sin(pulsePhase) * 3
          const pulseAlpha = illum * 0.2
          c.strokeStyle = `rgba(255, 215, 0, ${pulseAlpha})`
          c.lineWidth = 0.8
          c.beginPath()
          c.arc(p.x, p.y, pulseRadius, 0, Math.PI * 2)
          c.stroke()

          // Expanding ring burst when freshly illuminated
          if (illum > 0.8) {
            const burstT = 1 - illum // 0 at fresh, grows to ~0.2
            const burstRadius = 12 + burstT * 40
            c.strokeStyle = `rgba(255, 215, 0, ${(1 - burstT * 5) * 0.15})`
            c.lineWidth = 0.5
            c.beginPath()
            c.arc(p.x, p.y, burstRadius, 0, Math.PI * 2)
            c.stroke()
          }
        }

        // Hovered glow
        if (hovered) {
          const glowGrad = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 18)
          glowGrad.addColorStop(0, `rgba(255, 215, 0, ${illum * 0.12})`)
          glowGrad.addColorStop(1, 'transparent')
          c.fillStyle = glowGrad
          c.beginPath()
          c.arc(p.x, p.y, 18, 0, Math.PI * 2)
          c.fill()
        }

        // Draw the icon shape
        landmarkIconDrawers[i](c, p.x, p.y, iconAlpha)

        // Label (fades with illumination)
        const labelAlpha = hovered ? Math.min(illum * 0.5, 0.5) : illum * 0.2
        if (labelAlpha > 0.01) {
          c.font = '7px monospace'
          c.fillStyle = `rgba(255, 215, 0, ${labelAlpha})`
          c.textAlign = 'center'
          c.fillText(lm.label, p.x, p.y + 12)
        }
      }
    }

    // Context
    c.font = '9px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(255, 215, 0, ${0.03 + Math.sin(time * 0.2) * 0.01})`
    c.textAlign = 'center'
    c.fillText('artemis waits. the station orbits. your signals persist.', w / 2, h - 4)
  }

  return {
    name: 'satellite',
    label: 'the satellite',

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

      // Landmark click navigation (only illuminated landmarks are clickable)
      canvas.addEventListener('click', (e) => {
        if (!deps.switchTo || !canvas) return
        const w = canvas.width
        const h = canvas.height
        for (let i = 0; i < landmarks.length; i++) {
          const lm = landmarks[i]
          if (lm.illumination < 0.1) continue
          const p = project(lm.lat, lm.lon, w, h)
          const dx = e.clientX - p.x
          const dy = e.clientY - p.y
          if (dx * dx + dy * dy < 625) { // 25px radius
            deps.switchTo(lm.room)
            return
          }
        }
      })

      // Landmark hover detection
      canvas.addEventListener('mousemove', (e) => {
        if (!canvas) return
        const w = canvas.width
        const h = canvas.height
        hoveredLandmark = -1
        for (let i = 0; i < landmarks.length; i++) {
          const lm = landmarks[i]
          if (lm.illumination < 0.1) continue
          const p = project(lm.lat, lm.lon, w, h)
          const dx = e.clientX - p.x
          const dy = e.clientY - p.y
          if (dx * dx + dy * dy < 625) { // 25px radius
            hoveredLandmark = i
            break
          }
        }
        canvas.style.cursor = hoveredLandmark >= 0 ? 'pointer' : 'default'
      })

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
      issTrail = []
      totalReceived = 0
      receivedMessage = null
      placeBeacons()
      fetchISS()
      // Fetch ISS position every 5 seconds
      fetchInterval = window.setInterval(fetchISS, 5000)
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      if (fetchInterval) clearInterval(fetchInterval)
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      if (fetchInterval) clearInterval(fetchInterval)
      overlay?.remove()
    },
  }
}
