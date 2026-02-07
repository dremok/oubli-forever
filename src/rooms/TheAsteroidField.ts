/**
 * THE ASTEROID FIELD — near-Earth objects
 *
 * Uses NASA JPL's Close Approach API to show real asteroids
 * that are approaching Earth. Each asteroid is rendered as a
 * tumbling rock drifting across the screen. Your memories
 * float among them as fragile points of light.
 *
 * When an asteroid passes close to a memory, the memory
 * distorts — text scrambles, colors shift. The bigger the
 * asteroid, the stronger the disruption. This is gravitational
 * lensing of meaning.
 *
 * Cultural context: In 2026, asteroid monitoring continues as
 * a quiet existential backdrop. DART mission proved deflection
 * is possible, but most near-Earth objects remain uncatalogued.
 * Like memories, the things that could destroy us often pass
 * unnoticed.
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
  diameter: number // km
  velocity: number // km/s
  missDistance: number // lunar distances
  closeApproachDate: string
  // Rendering
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  rotSpeed: number
  size: number // pixel size
  shape: number[] // irregular shape vertices
}

interface MemoryPoint {
  x: number
  y: number
  memory: Memory
  distortion: number // 0 = clear, 1 = fully scrambled
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
  let hoveredSensor = -1

  const sensors = [
    { label: 'SATELLITE', room: 'satellite' },
    { label: 'SEISMOGRAPH', room: 'seismograph' },
    { label: 'OBSERVATORY', room: 'observatory' },
    { label: 'GLACARIUM', room: 'glacarium' },
  ]

  async function fetchAsteroids() {
    try {
      // JPL Close Approach API — get upcoming close approaches
      const resp = await fetch(
        'https://ssd-api.jpl.nasa.gov/cad.api?date-min=now&date-max=%2B30&dist-max=0.1&sort=dist',
        { signal: AbortSignal.timeout(8000) }
      )
      if (!resp.ok) throw new Error('fetch failed')
      const data = await resp.json()

      if (data.data && data.data.length > 0) {
        asteroidCount = data.data.length
        const w = canvas?.width || window.innerWidth
        const h = canvas?.height || window.innerHeight

        asteroids = data.data.slice(0, 15).map((row: string[], i: number) => {
          // CAD API fields: des, orbit_id, jd, cd, dist, dist_min, dist_max, v_rel, v_inf, t_sigma_f, h, diameter, diameter_sigma, fullname
          const name = row[0] || `Unknown ${i}`
          const closeDate = row[3] || 'unknown'
          const dist = parseFloat(row[4]) || 0.05 // AU
          const velocity = parseFloat(row[7]) || 15 // km/s
          const diameterStr = row[11]
          const diameter = diameterStr ? parseFloat(diameterStr) : 0.05 + Math.random() * 0.5

          // Convert distance to lunar distances (1 AU ≈ 389 lunar distances)
          const lunarDist = dist * 389

          // Generate irregular shape
          const vertices = 8 + Math.floor(Math.random() * 4)
          const shape: number[] = []
          for (let v = 0; v < vertices; v++) {
            shape.push(0.6 + Math.random() * 0.4) // radius variation
          }

          // Size based on diameter (capped)
          const size = Math.max(4, Math.min(30, diameter * 20))

          return {
            name,
            diameter,
            velocity,
            missDistance: lunarDist,
            closeApproachDate: closeDate,
            x: Math.random() * w,
            y: -size - Math.random() * h * 0.5,
            vx: (Math.random() - 0.5) * 0.3,
            vy: 0.2 + Math.random() * 0.5,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.02,
            size,
            shape,
          } as Asteroid
        })
      }

      dataLoaded = true
    } catch {
      // Generate fictional asteroids if API unavailable
      dataLoaded = true
      const w = canvas?.width || window.innerWidth
      const h = canvas?.height || window.innerHeight

      const fakeNames = [
        '2026 AB3', '2026 CF1', '2025 YR12', '2026 DK7',
        '2024 PT5', '2026 EE2', '2025 WL8', '2026 FN4',
      ]

      asteroids = fakeNames.map((name, i) => {
        const vertices = 8 + Math.floor(Math.random() * 4)
        const shape: number[] = []
        for (let v = 0; v < vertices; v++) {
          shape.push(0.6 + Math.random() * 0.4)
        }
        return {
          name,
          diameter: 0.02 + Math.random() * 0.5,
          velocity: 5 + Math.random() * 30,
          missDistance: 0.5 + Math.random() * 30,
          closeApproachDate: '2026-Feb-' + (7 + i),
          x: Math.random() * w,
          y: -20 - Math.random() * h * 0.5,
          vx: (Math.random() - 0.5) * 0.3,
          vy: 0.15 + Math.random() * 0.4,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.02,
          size: 5 + Math.random() * 20,
          shape,
        }
      })
      asteroidCount = asteroids.length
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

      // Draw asteroid
      c.save()
      c.translate(ast.x, ast.y)
      c.rotate(ast.rotation)

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

      // Dark rock with subtle texture
      c.fillStyle = 'rgba(40, 35, 30, 0.8)'
      c.fill()
      c.strokeStyle = 'rgba(80, 70, 60, 0.3)'
      c.lineWidth = 1
      c.stroke()

      // Surface detail — craters
      for (let cr = 0; cr < 3; cr++) {
        const crx = (Math.sin(cr * 2.5 + ast.rotation * 0.3) * ast.size * 0.3)
        const cry = (Math.cos(cr * 3.1 + ast.rotation * 0.3) * ast.size * 0.3)
        c.strokeStyle = 'rgba(60, 55, 50, 0.3)'
        c.lineWidth = 0.5
        c.beginPath()
        c.arc(crx, cry, ast.size * 0.15, 0, Math.PI * 2)
        c.stroke()
      }

      c.restore()

      // Label (very faint)
      c.font = '7px monospace'
      c.fillStyle = 'rgba(150, 140, 130, 0.08)'
      c.textAlign = 'center'
      c.fillText(ast.name, ast.x, ast.y + ast.size + 10)
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
            const glitchChars = '░▒▓█▄▀■□●○◆◇'
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

    // Data panel
    c.font = '9px monospace'
    c.fillStyle = 'rgba(150, 140, 130, 0.12)'
    c.textAlign = 'left'
    c.fillText(`near-earth objects: ${asteroidCount}`, 12, h - 42)
    c.fillText(`tracking window: 30 days`, 12, h - 30)

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

    // Sensor readout portals (top-right)
    if (deps.switchTo) {
      const sensorX = w - 110
      const sensorStartY = 50
      for (let i = 0; i < sensors.length; i++) {
        const sy = sensorStartY + i * 20
        const hovered = hoveredSensor === i
        c.font = '7px monospace'
        c.fillStyle = `rgba(150, 140, 130, ${hovered ? 0.3 : 0.06})`
        c.textAlign = 'right'
        c.fillText(`▸ ${sensors[i].label}`, sensorX + 95, sy + 10)
      }
    }

    // Context line
    c.font = '9px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(150, 140, 130, ${0.03 + Math.sin(time * 0.2) * 0.01})`
    c.textAlign = 'center'
    c.fillText('most things that could destroy us pass unnoticed', w / 2, h - 4)
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

      // Sensor portal click + hover
      canvas.addEventListener('click', (e) => {
        if (!deps.switchTo || !canvas) return
        const sensorX = canvas.width - 110
        const sensorStartY = 50
        for (let i = 0; i < sensors.length; i++) {
          const sy = sensorStartY + i * 20
          if (e.clientX >= sensorX && e.clientX <= sensorX + 100 &&
              e.clientY >= sy && e.clientY <= sy + 16) {
            deps.switchTo(sensors[i].room)
            return
          }
        }
      })

      canvas.addEventListener('mousemove', (e) => {
        if (!canvas) return
        hoveredSensor = -1
        const sensorX = canvas.width - 110
        const sensorStartY = 50
        for (let i = 0; i < sensors.length; i++) {
          const sy = sensorStartY + i * 20
          if (e.clientX >= sensorX && e.clientX <= sensorX + 100 &&
              e.clientY >= sy && e.clientY <= sy + 16) {
            hoveredSensor = i
            break
          }
        }
      })

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
          placeMemories()
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)
      return overlay
    },

    activate() {
      active = true
      dataLoaded = false
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
