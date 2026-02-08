/**
 * THE ASTEROID FIELD — near-Earth objects
 *
 * Uses NASA's NeoWs (Near Earth Object Web Service) API to show real
 * asteroids that are approaching Earth TODAY. Each asteroid is rendered
 * as a tumbling rock drifting across the screen. Your memories float
 * among them as fragile points of light.
 *
 * When an asteroid passes close to a memory, the memory distorts —
 * text scrambles, colors shift. The bigger the asteroid, the stronger
 * the disruption. This is gravitational lensing of meaning.
 *
 * Potentially hazardous asteroids glow red and pulse — cosmic threats
 * rendered visible among your fragile recollections.
 *
 * Navigation portals appear as clickable asteroid fragments orbiting
 * the edges — satellite, seismograph, observatory, glacarium.
 *
 * Cultural context: In 2026, asteroid monitoring continues as a quiet
 * existential backdrop. DART mission proved deflection is possible,
 * but most near-Earth objects remain uncatalogued. Like memories, the
 * things that could destroy us often pass unnoticed.
 *
 * USES MEMORIES. Live data. Cosmic threat.
 *
 * Inspired by: Andrei Tarkovsky's Stalker (the Zone), Gravity,
 * the asteroid that killed the dinosaurs (and the memories of
 * every creature alive), DART mission, Tunguska event, how
 * small perturbations change trajectories forever, the film
 * Melancholia (Lars von Trier) — beauty in approaching doom,
 * Arvo Pärt's Spiegel im Spiegel — minimalist dread
 */

import type { Room } from './RoomManager'

interface Memory {
  id: string
  originalText: string
  currentText: string
  degradation: number
  timestamp: number
}

interface AsteroidFieldDeps {
  getMemories: () => Memory[]
  switchTo?: (name: string) => void
}

interface Asteroid {
  name: string
  diameter: number // km (estimated max)
  diameterMin: number // km (estimated min)
  velocity: number // km/s
  missDistance: number // lunar distances
  missDistanceKm: number // km
  closeApproachDate: string
  isHazardous: boolean
  // Rendering
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  rotSpeed: number
  size: number // pixel size
  shape: number[] // irregular shape vertices
  hoverAlpha: number // for hover tooltip fade
}

interface MemoryPoint {
  x: number
  y: number
  memory: Memory
  distortion: number // 0 = clear, 1 = fully scrambled
}

interface NavigationPortal {
  label: string
  room: string
  x: number
  y: number
  angle: number
  orbitRadius: number
  orbitSpeed: number
  size: number
  shape: number[]
  hovered: boolean
  pulsePhase: number
}

interface NeoWsCache {
  timestamp: number
  data: Asteroid[]
}

const CACHE_KEY = 'oubli_neows_cache'
const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes

function getCachedData(): NeoWsCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cache: NeoWsCache = JSON.parse(raw)
    if (Date.now() - cache.timestamp > CACHE_DURATION) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }
    return cache
  } catch {
    return null
  }
}

function setCachedData(data: Asteroid[]) {
  try {
    const cache: NeoWsCache = { timestamp: Date.now(), data }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // localStorage full or unavailable — ignore
  }
}

export function createAsteroidFieldRoom(deps: AsteroidFieldDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let asteroids: Asteroid[] = []
  let memoryPoints: MemoryPoint[] = []
  let dataLoaded = false
  let asteroidCount = 0
  let hazardousCount = 0
  let hoveredAsteroid: Asteroid | null = null
  let mouseX = 0
  let mouseY = 0

  // Navigation portals — asteroid fragment style
  let portals: NavigationPortal[] = []

  function initPortals(w: number, h: number) {
    const portalDefs = [
      { label: 'SATELLITE', room: 'satellite' },
      { label: 'SEISMOGRAPH', room: 'seismograph' },
      { label: 'OBSERVATORY', room: 'observatory' },
      { label: 'GLACARIUM', room: 'glacarium' },
    ]

    portals = portalDefs.map((def, i) => {
      // Position portals along the edges/corners
      const positions = [
        { x: w - 80, y: h * 0.25 },   // right side upper
        { x: w - 80, y: h * 0.45 },   // right side middle
        { x: w - 80, y: h * 0.65 },   // right side lower
        { x: w - 80, y: h * 0.85 },   // right side bottom
      ]
      const pos = positions[i]

      // Generate irregular fragment shape
      const vertices = 6 + Math.floor(Math.random() * 3)
      const shape: number[] = []
      for (let v = 0; v < vertices; v++) {
        shape.push(0.5 + Math.random() * 0.5)
      }

      return {
        ...def,
        x: pos.x,
        y: pos.y,
        angle: Math.random() * Math.PI * 2,
        orbitRadius: 8 + Math.random() * 4,
        orbitSpeed: 0.3 + Math.random() * 0.3,
        size: 14 + Math.random() * 6,
        shape,
        hovered: false,
        pulsePhase: Math.random() * Math.PI * 2,
      }
    })
  }

  function parseNeoWsData(json: Record<string, unknown>, w: number, h: number): Asteroid[] {
    const neoObjects = json.near_earth_objects as Record<string, unknown[]> | undefined
    if (!neoObjects) return []

    const allAsteroids: Asteroid[] = []

    for (const dateKey of Object.keys(neoObjects)) {
      const neos = neoObjects[dateKey] as Record<string, unknown>[]
      for (const neo of neos) {
        const name = (neo.name as string) || 'Unknown'

        // Diameter
        const diamData = neo.estimated_diameter as Record<string, Record<string, number>> | undefined
        const diamKm = diamData?.kilometers
        const diameterMax = diamKm?.estimated_diameter_max ?? (0.05 + Math.random() * 0.5)
        const diameterMin = diamKm?.estimated_diameter_min ?? diameterMax * 0.5

        // Close approach data
        const approaches = neo.close_approach_data as Record<string, unknown>[] | undefined
        const approach = approaches?.[0]
        const velocity = approach?.relative_velocity as Record<string, string> | undefined
        const velKmS = velocity ? parseFloat(velocity.kilometers_per_second) : 15
        const missDist = approach?.miss_distance as Record<string, string> | undefined
        const missLunar = missDist ? parseFloat(missDist.lunar) : 10
        const missKm = missDist ? parseFloat(missDist.kilometers) : 5000000
        const closeDate = (approach?.close_approach_date as string) || dateKey

        const isHazardous = (neo.is_potentially_hazardous_asteroid as boolean) || false

        // Generate irregular shape
        const vertices = 8 + Math.floor(Math.random() * 4)
        const shape: number[] = []
        for (let v = 0; v < vertices; v++) {
          shape.push(0.6 + Math.random() * 0.4)
        }

        // Size: map diameter to pixel size
        // Most NEOs are 0.01 - 1 km; map to 4-35px range
        // Hazardous get a boost
        let size = Math.max(4, Math.min(35, diameterMax * 40))
        if (isHazardous) size = Math.max(size, 15)

        // Speed: map velocity to movement speed (most are 5-30 km/s)
        const speedFactor = Math.max(0.08, Math.min(1.2, velKmS / 25))

        allAsteroids.push({
          name,
          diameter: diameterMax,
          diameterMin,
          velocity: velKmS,
          missDistance: missLunar,
          missDistanceKm: missKm,
          closeApproachDate: closeDate,
          isHazardous,
          x: Math.random() * w,
          y: -size - Math.random() * h * 0.5,
          vx: (Math.random() - 0.5) * 0.3 * speedFactor,
          vy: (0.15 + Math.random() * 0.35) * speedFactor,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.02,
          size,
          shape,
          hoverAlpha: 0,
        })
      }
    }

    return allAsteroids
  }

  function generateFallbackAsteroids(w: number, h: number): Asteroid[] {
    const fakeNames = [
      '(2026 AB3)', '(2026 CF1)', '(2025 YR12)', '(2026 DK7)',
      '(2024 PT5)', '(2026 EE2)', '(2025 WL8)', '(2026 FN4)',
    ]

    return fakeNames.map((name, _i) => {
      const vertices = 8 + Math.floor(Math.random() * 4)
      const shape: number[] = []
      for (let v = 0; v < vertices; v++) {
        shape.push(0.6 + Math.random() * 0.4)
      }
      const isHazardous = Math.random() < 0.2
      const diameter = 0.02 + Math.random() * 0.5
      return {
        name,
        diameter,
        diameterMin: diameter * 0.5,
        velocity: 5 + Math.random() * 30,
        missDistance: 0.5 + Math.random() * 30,
        missDistanceKm: 200000 + Math.random() * 10000000,
        closeApproachDate: 'simulated',
        isHazardous,
        x: Math.random() * w,
        y: -20 - Math.random() * h * 0.5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: 0.15 + Math.random() * 0.4,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02,
        size: isHazardous ? 15 + Math.random() * 15 : 5 + Math.random() * 20,
        shape,
        hoverAlpha: 0,
      }
    })
  }

  async function fetchAsteroids() {
    const w = canvas?.width || window.innerWidth
    const h = canvas?.height || window.innerHeight

    // Check cache first
    const cached = getCachedData()
    if (cached && cached.data.length > 0) {
      // Re-initialize positions for cached data
      asteroids = cached.data.map(a => ({
        ...a,
        x: Math.random() * w,
        y: -a.size - Math.random() * h * 0.5,
        vx: (Math.random() - 0.5) * 0.3 * Math.max(0.08, Math.min(1.2, a.velocity / 25)),
        vy: (0.15 + Math.random() * 0.35) * Math.max(0.08, Math.min(1.2, a.velocity / 25)),
        rotation: Math.random() * Math.PI * 2,
        hoverAlpha: 0,
      }))
      asteroidCount = asteroids.length
      hazardousCount = asteroids.filter(a => a.isHazardous).length
      dataLoaded = true
      return
    }

    try {
      const today = new Date().toISOString().split('T')[0]
      const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${today}&end_date=${today}&api_key=DEMO_KEY`
      const resp = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!resp.ok) throw new Error(`NeoWs fetch failed: ${resp.status}`)
      const json = await resp.json()

      asteroids = parseNeoWsData(json as Record<string, unknown>, w, h)

      if (asteroids.length === 0) throw new Error('No NEO data')

      asteroidCount = (json as Record<string, number>).element_count || asteroids.length
      hazardousCount = asteroids.filter(a => a.isHazardous).length
      dataLoaded = true

      // Cache the parsed asteroid data (without ephemeral rendering state)
      setCachedData(asteroids)
    } catch {
      // Fallback: generate fictional asteroids
      asteroids = generateFallbackAsteroids(w, h)
      asteroidCount = asteroids.length
      hazardousCount = asteroids.filter(a => a.isHazardous).length
      dataLoaded = true
    }
  }

  function placeMemories() {
    if (!canvas) return
    const memories = deps.getMemories()
    const w = canvas.width
    const h = canvas.height

    memoryPoints = memories.slice(0, 15).map((mem, i) => ({
      x: w * 0.15 + (i % 5) * (w * 0.7 / 5) + Math.random() * 40,
      y: h * 0.2 + Math.floor(i / 5) * (h * 0.2) + Math.random() * 40,
      memory: mem,
      distortion: 0,
    }))
  }

  function drawAsteroidBody(c: CanvasRenderingContext2D, ast: Asteroid) {
    c.save()
    c.translate(ast.x, ast.y)
    c.rotate(ast.rotation)

    // Hazardous glow
    if (ast.isHazardous) {
      const pulse = 0.5 + Math.sin(time * 2.5 + ast.x * 0.01) * 0.3
      const glowSize = ast.size * 2.5
      const glow = c.createRadialGradient(0, 0, ast.size * 0.3, 0, 0, glowSize)
      glow.addColorStop(0, `rgba(255, 40, 20, ${0.15 * pulse})`)
      glow.addColorStop(0.5, `rgba(255, 60, 30, ${0.06 * pulse})`)
      glow.addColorStop(1, 'transparent')
      c.fillStyle = glow
      c.beginPath()
      c.arc(0, 0, glowSize, 0, Math.PI * 2)
      c.fill()
    }

    // Asteroid body — irregular shape
    c.beginPath()
    for (let i = 0; i < ast.shape.length; i++) {
      const angle = (i / ast.shape.length) * Math.PI * 2
      const r = ast.size * ast.shape[i]
      const px = Math.cos(angle) * r
      const py = Math.sin(angle) * r
      if (i === 0) c.moveTo(px, py)
      else c.lineTo(px, py)
    }
    c.closePath()

    if (ast.isHazardous) {
      // Hazardous: dark red-brown rock
      const pulse = 0.7 + Math.sin(time * 2 + ast.y * 0.01) * 0.3
      c.fillStyle = `rgba(60, 25, 20, ${0.85 * pulse})`
      c.fill()
      c.strokeStyle = `rgba(180, 50, 30, ${0.4 * pulse})`
      c.lineWidth = 1.5
      c.stroke()
    } else {
      // Normal: dark rock
      c.fillStyle = 'rgba(40, 35, 30, 0.8)'
      c.fill()
      c.strokeStyle = 'rgba(80, 70, 60, 0.3)'
      c.lineWidth = 1
      c.stroke()
    }

    // Surface detail — craters
    for (let cr = 0; cr < 3; cr++) {
      const crx = Math.sin(cr * 2.5 + ast.rotation * 0.3) * ast.size * 0.3
      const cry = Math.cos(cr * 3.1 + ast.rotation * 0.3) * ast.size * 0.3
      c.strokeStyle = ast.isHazardous
        ? 'rgba(120, 40, 30, 0.3)'
        : 'rgba(60, 55, 50, 0.3)'
      c.lineWidth = 0.5
      c.beginPath()
      c.arc(crx, cry, ast.size * 0.15, 0, Math.PI * 2)
      c.stroke()
    }

    c.restore()
  }

  function drawAsteroidLabel(c: CanvasRenderingContext2D, ast: Asteroid) {
    // Always show faint name
    c.font = '7px monospace'
    const labelAlpha = ast.isHazardous ? 0.15 : 0.08
    c.fillStyle = ast.isHazardous
      ? `rgba(255, 80, 60, ${labelAlpha})`
      : `rgba(150, 140, 130, ${labelAlpha})`
    c.textAlign = 'center'
    c.fillText(ast.name, ast.x, ast.y + ast.size + 10)
  }

  function drawAsteroidTooltip(c: CanvasRenderingContext2D, ast: Asteroid) {
    if (ast.hoverAlpha <= 0.01) return

    const alpha = ast.hoverAlpha
    const tx = ast.x
    const ty = ast.y - ast.size - 12

    // Background panel
    c.fillStyle = `rgba(0, 0, 0, ${0.7 * alpha})`
    const panelW = 180
    const panelH = ast.isHazardous ? 72 : 60
    const px = tx - panelW / 2
    const py = ty - panelH
    c.fillRect(px, py, panelW, panelH)

    // Border
    c.strokeStyle = ast.isHazardous
      ? `rgba(255, 60, 30, ${0.4 * alpha})`
      : `rgba(100, 95, 90, ${0.2 * alpha})`
    c.lineWidth = 0.5
    c.strokeRect(px, py, panelW, panelH)

    c.font = '8px monospace'
    c.textAlign = 'left'
    const textX = px + 6
    let textY = py + 12

    // Name
    c.fillStyle = ast.isHazardous
      ? `rgba(255, 100, 70, ${0.9 * alpha})`
      : `rgba(180, 170, 160, ${0.8 * alpha})`
    c.fillText(ast.name, textX, textY)
    textY += 12

    // Diameter
    const diamStr = ast.diameterMin < 0.01
      ? `${(ast.diameterMin * 1000).toFixed(0)}-${(ast.diameter * 1000).toFixed(0)} m`
      : `${ast.diameterMin.toFixed(2)}-${ast.diameter.toFixed(2)} km`
    c.fillStyle = `rgba(150, 140, 130, ${0.7 * alpha})`
    c.fillText(`dia: ${diamStr}`, textX, textY)
    textY += 12

    // Velocity
    c.fillText(`vel: ${ast.velocity.toFixed(1)} km/s`, textX, textY)

    // Miss distance on right side
    c.textAlign = 'right'
    c.fillText(`${ast.missDistance.toFixed(1)} LD`, px + panelW - 6, textY)
    textY += 12

    // Hazardous warning
    if (ast.isHazardous) {
      const warnPulse = 0.7 + Math.sin(time * 3) * 0.3
      c.textAlign = 'center'
      c.fillStyle = `rgba(255, 50, 30, ${0.8 * alpha * warnPulse})`
      c.fillText('POTENTIALLY HAZARDOUS', tx, textY)
    }
  }

  function drawPortal(c: CanvasRenderingContext2D, portal: NavigationPortal) {
    // Orbit the portal slightly around its anchor point
    const ox = portal.x + Math.cos(time * portal.orbitSpeed + portal.pulsePhase) * portal.orbitRadius
    const oy = portal.y + Math.sin(time * portal.orbitSpeed + portal.pulsePhase) * portal.orbitRadius * 0.5

    // Store computed position for hit testing
    portal.x = portal.x // anchor stays fixed
    const drawX = ox
    const drawY = oy

    c.save()
    c.translate(drawX, drawY)
    c.rotate(time * 0.3 + portal.pulsePhase)

    // Glow when hovered
    if (portal.hovered) {
      const glow = c.createRadialGradient(0, 0, 0, 0, 0, portal.size * 2)
      glow.addColorStop(0, 'rgba(200, 180, 140, 0.2)')
      glow.addColorStop(1, 'transparent')
      c.fillStyle = glow
      c.beginPath()
      c.arc(0, 0, portal.size * 2, 0, Math.PI * 2)
      c.fill()
    }

    // Fragment body
    c.beginPath()
    for (let i = 0; i < portal.shape.length; i++) {
      const angle = (i / portal.shape.length) * Math.PI * 2
      const r = portal.size * portal.shape[i]
      const px = Math.cos(angle) * r
      const py = Math.sin(angle) * r
      if (i === 0) c.moveTo(px, py)
      else c.lineTo(px, py)
    }
    c.closePath()

    const baseAlpha = portal.hovered ? 0.6 : 0.25
    c.fillStyle = `rgba(80, 75, 65, ${baseAlpha})`
    c.fill()
    c.strokeStyle = `rgba(140, 130, 110, ${portal.hovered ? 0.5 : 0.15})`
    c.lineWidth = portal.hovered ? 1.5 : 0.8
    c.stroke()

    // Small bright core
    const coreAlpha = portal.hovered ? 0.5 : 0.15
    c.fillStyle = `rgba(200, 180, 140, ${coreAlpha})`
    c.beginPath()
    c.arc(0, 0, 2, 0, Math.PI * 2)
    c.fill()

    c.restore()

    // Label
    c.font = '7px monospace'
    c.textAlign = 'center'
    c.fillStyle = `rgba(150, 140, 130, ${portal.hovered ? 0.5 : 0.08})`
    c.fillText(portal.label.toLowerCase(), drawX, drawY + portal.size + 10)
  }

  function getPortalDrawPos(portal: NavigationPortal): { x: number; y: number } {
    return {
      x: portal.x + Math.cos(time * portal.orbitSpeed + portal.pulsePhase) * portal.orbitRadius,
      y: portal.y + Math.sin(time * portal.orbitSpeed + portal.pulsePhase) * portal.orbitRadius * 0.5,
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const c = ctx
    const w = canvas.width
    const h = canvas.height

    // Deep space
    c.fillStyle = 'rgba(2, 2, 6, 1)'
    c.fillRect(0, 0, w, h)

    // Star field
    for (let i = 0; i < 120; i++) {
      const sx = ((i * 137.5 + 23) % w)
      const sy = ((i * 97.3 + 17) % h)
      const twinkle = Math.sin(time * 1.2 + i * 3.1) * 0.3 + 0.4
      c.fillStyle = `rgba(200, 210, 230, ${0.04 * twinkle})`
      c.beginPath()
      c.arc(sx, sy, 0.7, 0, Math.PI * 2)
      c.fill()
    }

    // Update and draw asteroids
    hoveredAsteroid = null

    for (const ast of asteroids) {
      ast.x += ast.vx
      ast.y += ast.vy
      ast.rotation += ast.rotSpeed

      // Wrap around
      if (ast.y > h + ast.size * 2) {
        ast.y = -ast.size * 2
        ast.x = Math.random() * w
      }
      if (ast.x < -ast.size * 2) ast.x = w + ast.size
      if (ast.x > w + ast.size * 2) ast.x = -ast.size

      // Check proximity to memory points
      for (const mp of memoryPoints) {
        const dx = ast.x - mp.x
        const dy = ast.y - mp.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const influence = Math.max(0, 1 - dist / (ast.size * 8))
        mp.distortion = Math.max(mp.distortion, influence)
      }

      // Check mouse proximity for tooltip
      const mdx = mouseX - ast.x
      const mdy = mouseY - ast.y
      const mdist = Math.sqrt(mdx * mdx + mdy * mdy)
      if (mdist < ast.size + 20) {
        hoveredAsteroid = ast
        ast.hoverAlpha = Math.min(1, ast.hoverAlpha + 0.08)
      } else {
        ast.hoverAlpha = Math.max(0, ast.hoverAlpha - 0.04)
      }

      drawAsteroidBody(c, ast)
      drawAsteroidLabel(c, ast)
    }

    // Draw tooltips on top (second pass so they aren't occluded)
    for (const ast of asteroids) {
      drawAsteroidTooltip(c, ast)
    }

    // Draw memory points
    for (const mp of memoryPoints) {
      // Decay distortion over time
      mp.distortion *= 0.98

      const intact = 1 - mp.memory.degradation
      const distorted = mp.distortion > 0.1

      // Memory glow
      const glowRadius = 12 + Math.sin(time + mp.x * 0.01) * 3
      const glow = c.createRadialGradient(mp.x, mp.y, 0, mp.x, mp.y, glowRadius)
      const baseHue = distorted ? 0 : 320 // pink normally, red when disturbed
      const alpha = intact * 0.15 * (1 - mp.distortion * 0.5)
      glow.addColorStop(0, `hsla(${baseHue}, 80%, 70%, ${alpha})`)
      glow.addColorStop(1, 'transparent')
      c.fillStyle = glow
      c.beginPath()
      c.arc(mp.x, mp.y, glowRadius, 0, Math.PI * 2)
      c.fill()

      // Core dot
      c.fillStyle = `hsla(${baseHue}, 80%, 70%, ${intact * 0.4})`
      c.beginPath()
      c.arc(mp.x, mp.y, 2, 0, Math.PI * 2)
      c.fill()

      // Memory text
      c.font = '9px "Cormorant Garamond", serif'
      c.textAlign = 'center'

      let text = mp.memory.currentText
      if (text.length > 40) text = text.slice(0, 40) + '...'

      // Distortion effect — scramble characters
      if (mp.distortion > 0.1) {
        const chars = text.split('')
        for (let i = 0; i < chars.length; i++) {
          if (Math.random() < mp.distortion * 0.5) {
            const glitchChars = '\u2591\u2592\u2593\u2588\u2584\u2580\u25A0\u25A1\u25CF\u25CB\u25C6\u25C7'
            chars[i] = glitchChars[Math.floor(Math.random() * glitchChars.length)]
          }
        }
        text = chars.join('')
      }

      const textAlpha = intact * 0.25 * (1 - mp.distortion * 0.3)
      c.fillStyle = `rgba(255, 180, 200, ${textAlpha})`

      // Offset text when distorted
      const offsetX = mp.distortion * (Math.random() - 0.5) * 10
      const offsetY = mp.distortion * (Math.random() - 0.5) * 5
      c.fillText(text, mp.x + offsetX, mp.y + 15 + offsetY)
    }

    // Draw navigation portals
    if (deps.switchTo) {
      for (const portal of portals) {
        drawPortal(c, portal)
      }
    }

    // Data panel
    c.font = '9px monospace'
    c.fillStyle = 'rgba(150, 140, 130, 0.12)'
    c.textAlign = 'left'
    c.fillText(`near-earth objects today: ${asteroidCount}`, 12, h - 54)
    c.fillText(`potentially hazardous: ${hazardousCount}`, 12, h - 42)
    c.fillText(`source: NASA NeoWs`, 12, h - 30)

    if (asteroids.length > 0) {
      const closest = asteroids.reduce((a, b) => a.missDistance < b.missDistance ? a : b)
      c.fillText(`closest: ${closest.name} (${closest.missDistance.toFixed(1)} LD)`, 12, h - 18)
    }

    // Title
    c.font = '10px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(150, 140, 130, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.fillText('the asteroid field', w / 2, 25)

    // No memories hint
    if (memoryPoints.length === 0) {
      c.font = '12px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(150, 140, 130, 0.1)'
      c.textAlign = 'center'
      c.fillText('nothing to protect', w / 2, h / 2)
      c.font = '10px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(150, 140, 130, 0.06)'
      c.fillText('your memories float among the rocks', w / 2, h / 2 + 20)
    }

    // Loading
    if (!dataLoaded) {
      c.font = '9px monospace'
      c.fillStyle = 'rgba(150, 140, 130, 0.15)'
      c.textAlign = 'center'
      c.fillText('scanning near-earth space...', w / 2, h * 0.95)
    }

    // Context line
    c.font = '9px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(150, 140, 130, ${0.03 + Math.sin(time * 0.2) * 0.01})`
    c.textAlign = 'center'
    c.fillText('most things that could destroy us pass unnoticed', w / 2, h - 4)
  }

  function handleClick(e: MouseEvent) {
    if (!deps.switchTo) return

    // Check portal clicks
    for (const portal of portals) {
      const pos = getPortalDrawPos(portal)
      const dx = e.clientX - pos.x
      const dy = e.clientY - pos.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < portal.size + 8) {
        deps.switchTo(portal.room)
        return
      }
    }
  }

  function handleMouseMove(e: MouseEvent) {
    mouseX = e.clientX
    mouseY = e.clientY

    // Update portal hover states
    for (const portal of portals) {
      const pos = getPortalDrawPos(portal)
      const dx = e.clientX - pos.x
      const dy = e.clientY - pos.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      portal.hovered = dist < portal.size + 8
    }

    // Update cursor for portals and asteroids
    if (canvas) {
      const overPortal = portals.some(p => p.hovered)
      canvas.style.cursor = overPortal ? 'pointer' : 'default'
    }
  }

  return {
    name: 'asteroids',
    label: 'the asteroid field',

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

      canvas.addEventListener('click', handleClick)
      canvas.addEventListener('mousemove', handleMouseMove)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
          placeMemories()
          initPortals(canvas.width, canvas.height)
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)
      return overlay
    },

    activate() {
      active = true
      dataLoaded = false
      hazardousCount = 0
      if (canvas) {
        initPortals(canvas.width, canvas.height)
      }
      placeMemories()
      fetchAsteroids()
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
