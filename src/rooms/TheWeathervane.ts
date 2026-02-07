/**
 * THE WEATHERVANE — the sky outside rendered as data
 *
 * Fetches real-time weather for your location via Open-Meteo API
 * and renders it as an abstract atmospheric visualization.
 *
 * Temperature → color warmth. Wind → particle movement.
 * Humidity → fog density. Cloud cover → darkness.
 * Rain → falling streaks. Snow → floating dots.
 *
 * INTERACTIVE: Move your cursor to create wind gusts that push
 * particles. A spinning weathervane at center responds to real
 * wind direction. Wind audio modulated by actual conditions.
 *
 * Uses Open-Meteo API (free, no key, CORS-friendly).
 * Zero memory dependency.
 *
 * Inspired by: weather stations, barometers, Olafur Eliasson's
 * Weather Project, James Turrell's skyspaces
 */

import type { Room } from './RoomManager'

interface WeatherData {
  temperature: number
  windSpeed: number
  windDirection: number
  humidity: number
  cloudCover: number
  rain: number
  snowfall: number
  weatherCode: number
  isDay: boolean
  location: string
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  type: 'air' | 'rain' | 'snow'
}

interface WeathervaneDeps {
  switchTo?: (name: string) => void
}

const API_BASE = 'https://api.open-meteo.com/v1/forecast'

export function createWeathervaneRoom(deps: WeathervaneDeps = {}): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let weather: WeatherData | null = null
  let particles: Particle[] = []
  let loading = true
  let error = false
  let lastFetch = 0

  // Mouse
  let mouseX = 0
  let mouseY = 0
  let prevMouseX = 0
  let prevMouseY = 0
  let mouseVX = 0
  let mouseVY = 0

  // Weathervane animation
  let vaneAngle = 0
  let vaneTargetAngle = 0

  // Audio
  let audioCtx: AudioContext | null = null
  let windGain: GainNode | null = null
  let windFilter: BiquadFilterNode | null = null

  // Navigation portals
  const portals: { name: string; label: string; x: number; y: number; r: number; hovered: boolean }[] = []

  function buildPortals() {
    if (!canvas) return
    const w = canvas.width
    const h = canvas.height
    portals.length = 0
    portals.push(
      { name: 'seismograph', label: 'tremors beneath', x: w * 0.08, y: h * 0.85, r: 20, hovered: false },
      { name: 'radio', label: 'a frequency drifts by', x: w * 0.92, y: h * 0.15, r: 15, hovered: false },
      { name: 'glacarium', label: 'ice on the horizon', x: w * 0.92, y: h * 0.85, r: 18, hovered: false },
      { name: 'tidepool', label: 'water collects below', x: w * 0.08, y: h * 0.15, r: 16, hovered: false },
    )
  }

  function tempToColor(temp: number): { r: number; g: number; b: number } {
    if (temp < -10) return { r: 40, g: 60, b: 200 }
    if (temp < 0) return { r: 40, g: 120, b: 200 }
    if (temp < 10) return { r: 40, g: 180, b: 160 }
    if (temp < 20) return { r: 100, g: 200, b: 80 }
    if (temp < 30) return { r: 220, g: 180, b: 40 }
    return { r: 220, g: 60, b: 40 }
  }

  function weatherCodeToText(code: number): string {
    const codes: Record<number, string> = {
      0: 'clear sky',
      1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
      45: 'fog', 48: 'depositing rime fog',
      51: 'light drizzle', 53: 'moderate drizzle', 55: 'dense drizzle',
      61: 'slight rain', 63: 'moderate rain', 65: 'heavy rain',
      71: 'slight snow', 73: 'moderate snow', 75: 'heavy snow',
      77: 'snow grains',
      80: 'slight showers', 81: 'moderate showers', 82: 'violent showers',
      85: 'slight snow showers', 86: 'heavy snow showers',
      95: 'thunderstorm', 96: 'thunderstorm with slight hail',
      99: 'thunderstorm with heavy hail',
    }
    return codes[code] || 'unknown'
  }

  function directionName(deg: number): string {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    return dirs[Math.round(deg / 45) % 8]
  }

  async function fetchWeather() {
    loading = true
    error = false

    let lat = 48.8566
    let lon = 2.3522
    let locationName = 'paris'

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      })
      lat = pos.coords.latitude
      lon = pos.coords.longitude
      locationName = `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`
    } catch {
      // Use default
    }

    try {
      const url = `${API_BASE}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,cloud_cover,rain,snowfall,weather_code,is_day`
      const resp = await fetch(url)
      if (!resp.ok) throw new Error('fetch failed')
      const data = await resp.json()
      const c = data.current

      weather = {
        temperature: c.temperature_2m,
        windSpeed: c.wind_speed_10m,
        windDirection: c.wind_direction_10m,
        humidity: c.relative_humidity_2m,
        cloudCover: c.cloud_cover,
        rain: c.rain,
        snowfall: c.snowfall,
        weatherCode: c.weather_code,
        isDay: c.is_day === 1,
        location: locationName,
      }

      vaneTargetAngle = (weather.windDirection * Math.PI) / 180
      initParticles()
      updateAudio()
      loading = false
      lastFetch = Date.now()
    } catch {
      error = true
      loading = false
    }
  }

  function initAudio() {
    if (audioCtx) return
    try {
      audioCtx = new AudioContext()

      // Wind noise
      const bufferSize = audioCtx.sampleRate * 2
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
      const data = noiseBuffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.4
      }
      const noise = audioCtx.createBufferSource()
      noise.buffer = noiseBuffer
      noise.loop = true

      windFilter = audioCtx.createBiquadFilter()
      windFilter.type = 'bandpass'
      windFilter.frequency.value = 250
      windFilter.Q.value = 0.3

      windGain = audioCtx.createGain()
      windGain.gain.value = 0

      noise.connect(windFilter)
      windFilter.connect(windGain)
      windGain.connect(audioCtx.destination)
      noise.start()

      windGain.gain.linearRampToValueAtTime(0.02, audioCtx.currentTime + 2)
    } catch {
      // Audio not available
    }
  }

  function updateAudio() {
    if (!windGain || !audioCtx || !weather || !windFilter) return
    // Modulate wind volume by speed (0-50 km/h → 0.01-0.06)
    const vol = 0.01 + Math.min(weather.windSpeed / 50, 1) * 0.05
    windGain.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + 1)
    // Modulate filter frequency by temperature
    const freq = 150 + Math.max(0, weather.temperature) * 10
    windFilter.frequency.linearRampToValueAtTime(freq, audioCtx.currentTime + 1)
  }

  function initParticles() {
    if (!canvas || !weather) return
    const w = canvas.width
    const h = canvas.height
    particles = []

    const airCount = 100 + Math.floor(weather.windSpeed * 3)
    for (let i = 0; i < airCount; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: 0, vy: 0,
        size: 1 + Math.random() * 2,
        alpha: 0.05 + Math.random() * 0.1,
        type: 'air',
      })
    }

    if (weather.rain > 0) {
      const rainCount = Math.floor(weather.rain * 50)
      for (let i = 0; i < Math.min(rainCount, 300); i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: 0, vy: 0,
          size: 1,
          alpha: 0.3 + Math.random() * 0.3,
          type: 'rain',
        })
      }
    }

    if (weather.snowfall > 0) {
      const snowCount = Math.floor(weather.snowfall * 100)
      for (let i = 0; i < Math.min(snowCount, 200); i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: 0, vy: 0,
          size: 2 + Math.random() * 3,
          alpha: 0.3 + Math.random() * 0.4,
          type: 'snow',
        })
      }
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    prevMouseX = mouseX
    prevMouseY = mouseY
    mouseX = (e.clientX - rect.left) * (canvas.width / rect.width)
    mouseY = (e.clientY - rect.top) * (canvas.height / rect.height)
    mouseVX = (mouseX - prevMouseX) * 0.3
    mouseVY = (mouseY - prevMouseY) * 0.3

    // Portal hover
    for (const p of portals) {
      p.hovered = Math.hypot(mouseX - p.x, mouseY - p.y) < p.r + 10
    }

    if (canvas) {
      canvas.style.cursor = portals.some(p => p.hovered) ? 'pointer' : 'default'
    }
  }

  function handleClick() {
    for (const p of portals) {
      if (p.hovered && deps.switchTo) {
        deps.switchTo(p.name)
        return
      }
    }
  }

  function drawWeathervane(c: CanvasRenderingContext2D, cx: number, cy: number) {
    // Smoothly rotate toward target angle
    let diff = vaneTargetAngle - vaneAngle
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    vaneAngle += diff * 0.02

    // Add cursor wind influence
    const cursorInfluence = Math.atan2(mouseVY, mouseVX)
    const cursorStrength = Math.min(Math.hypot(mouseVX, mouseVY) * 0.01, 0.1)
    vaneAngle += Math.sin(cursorInfluence - vaneAngle) * cursorStrength

    const color = weather ? tempToColor(weather.temperature) : { r: 140, g: 160, b: 200 }
    const alpha = 0.12

    c.save()
    c.translate(cx, cy)

    // Outer circle
    c.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.5})`
    c.lineWidth = 1
    c.beginPath()
    c.arc(0, 0, 60, 0, Math.PI * 2)
    c.stroke()

    // Cardinal points
    c.font = '9px monospace'
    c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.8})`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText('N', 0, -72)
    c.fillText('S', 0, 72)
    c.fillText('E', 72, 0)
    c.fillText('W', -72, 0)

    // Vane arrow
    c.save()
    c.rotate(vaneAngle)

    // Arrow body
    c.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(0, 40)
    c.lineTo(0, -40)
    c.stroke()

    // Arrow head
    c.beginPath()
    c.moveTo(0, -45)
    c.lineTo(-6, -35)
    c.lineTo(6, -35)
    c.closePath()
    c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
    c.fill()

    // Arrow tail (wider)
    c.beginPath()
    c.moveTo(-8, 35)
    c.lineTo(8, 35)
    c.lineTo(0, 45)
    c.closePath()
    c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.6})`
    c.fill()

    c.restore()

    // Center dot
    c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
    c.beginPath()
    c.arc(0, 0, 3, 0, Math.PI * 2)
    c.fill()

    c.restore()
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height
    const c = ctx

    // Decay cursor velocity
    mouseVX *= 0.95
    mouseVY *= 0.95

    // Background
    if (weather) {
      const color = tempToColor(weather.temperature)
      const r = Math.floor(color.r * 0.03 + (weather.isDay ? 5 : 2))
      const g = Math.floor(color.g * 0.03 + (weather.isDay ? 5 : 2))
      const b = Math.floor(color.b * 0.03 + (weather.isDay ? 8 : 5))
      c.fillStyle = `rgb(${r}, ${g}, ${b})`
    } else {
      c.fillStyle = 'rgba(5, 5, 10, 1)'
    }
    c.fillRect(0, 0, w, h)

    if (weather) {
      // Fog overlay
      if (weather.humidity > 70) {
        const fogAlpha = (weather.humidity - 70) / 30 * 0.15
        c.fillStyle = `rgba(80, 80, 90, ${fogAlpha})`
        c.fillRect(0, 0, w, h)
      }

      const windRad = (weather.windDirection * Math.PI) / 180
      const windForce = weather.windSpeed / 50

      // Cursor gust radius
      const gustRadius = 150

      // Update and draw particles
      for (const p of particles) {
        // Cursor wind influence
        const dx = p.x - mouseX
        const dy = p.y - mouseY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < gustRadius && dist > 0) {
          const force = (1 - dist / gustRadius) * 0.5
          p.vx += mouseVX * force
          p.vy += mouseVY * force
        }

        switch (p.type) {
          case 'air':
            p.vx += Math.sin(windRad) * windForce * 0.1
            p.vy += Math.cos(windRad) * windForce * 0.05
            p.vx += (Math.random() - 0.5) * 0.1
            p.vy += (Math.random() - 0.5) * 0.1
            p.vx *= 0.98
            p.vy *= 0.98
            break
          case 'rain':
            p.vx = Math.sin(windRad) * windForce * 2 + mouseVX * 0.1
            p.vy = 4 + weather.rain * 2
            break
          case 'snow':
            p.vx = Math.sin(windRad) * windForce + Math.sin(time * 2 + p.x * 0.01) * 0.5
            p.vy = 0.5 + weather.snowfall * 0.3
            break
        }

        p.x += p.vx
        p.y += p.vy

        if (p.x < 0) p.x += w
        if (p.x > w) p.x -= w
        if (p.y > h) p.y = -5
        if (p.y < -10) p.y = h

        const color = tempToColor(weather.temperature)
        switch (p.type) {
          case 'air':
            c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${p.alpha})`
            c.beginPath()
            c.arc(p.x, p.y, p.size, 0, Math.PI * 2)
            c.fill()
            break
          case 'rain':
            c.strokeStyle = `rgba(140, 160, 220, ${p.alpha})`
            c.lineWidth = 1
            c.beginPath()
            c.moveTo(p.x, p.y)
            c.lineTo(p.x + p.vx * 2, p.y + p.vy * 2)
            c.stroke()
            break
          case 'snow':
            c.fillStyle = `rgba(220, 220, 240, ${p.alpha})`
            c.beginPath()
            c.arc(p.x, p.y, p.size, 0, Math.PI * 2)
            c.fill()
            break
        }
      }

      // Draw weathervane in center
      drawWeathervane(c, w / 2, h / 2)

      // Temperature display
      const color = tempToColor(weather.temperature)
      c.font = '80px monospace'
      c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.06)`
      c.textAlign = 'center'
      c.fillText(`${weather.temperature.toFixed(1)}°`, w / 2, h * 0.3)

      // Weather description
      c.font = '16px "Cormorant Garamond", serif'
      c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.12)`
      c.fillText(weatherCodeToText(weather.weatherCode), w / 2, h * 0.72)

      // Details
      c.font = '10px monospace'
      c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.08)`
      c.textAlign = 'left'
      c.fillText(`wind: ${weather.windSpeed.toFixed(0)} km/h ${directionName(weather.windDirection)}`, 20, h - 55)
      c.fillText(`humidity: ${weather.humidity}%`, 20, h - 42)
      c.fillText(`cloud cover: ${weather.cloudCover}%`, 20, h - 29)

      if (weather.rain > 0) c.fillText(`rain: ${weather.rain} mm`, 20, h - 16)
      if (weather.snowfall > 0) c.fillText(`snow: ${weather.snowfall} cm`, 20, h - 16)

      c.textAlign = 'right'
      c.fillText(weather.location, w - 20, h - 42)
      c.fillText(weather.isDay ? 'day' : 'night', w - 20, h - 29)

      const mins = Math.floor((Date.now() - lastFetch) / 60000)
      c.fillText(`updated ${mins}m ago`, w - 20, h - 16)
    }

    // Navigation portals
    for (const p of portals) {
      const pulse = Math.sin(time * 1.5 + p.x * 0.01) * 0.3 + 0.5
      const alpha = p.hovered ? 0.35 : 0.06 * pulse
      const color = weather ? tempToColor(weather.temperature) : { r: 140, g: 160, b: 200 }

      c.beginPath()
      c.arc(p.x, p.y, p.r * (p.hovered ? 1.2 : 1), 0, Math.PI * 2)
      c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.3})`
      c.fill()
      c.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
      c.lineWidth = 1
      c.stroke()

      if (p.hovered) {
        c.font = '9px "Cormorant Garamond", serif'
        c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.5)`
        c.textAlign = 'center'
        c.fillText(p.label, p.x, p.y + p.r + 14)
      }
    }

    // Loading/error
    if (loading) {
      c.font = '14px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(120, 140, 180, 0.15)'
      c.textAlign = 'center'
      c.fillText('sensing the weather...', w / 2, h / 2)
    }
    if (error && !weather) {
      c.font = '12px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(200, 100, 80, 0.15)'
      c.textAlign = 'center'
      c.fillText('the sky is unreachable.', w / 2, h / 2)
    }

    // Title
    c.font = '10px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(140, 160, 200, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.fillText('the weathervane', w / 2, 25)

    // Hint
    c.font = '9px "Cormorant Garamond", serif'
    c.fillStyle = 'rgba(140, 160, 200, 0.04)'
    c.textAlign = 'center'
    c.fillText('move to stir the wind', w / 2, 40)

    // Refresh every 10 minutes
    if (Date.now() - lastFetch > 600000 && !loading) {
      fetchWeather()
    }
  }

  return {
    name: 'weathervane',
    label: 'the weathervane',

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
          if (weather) initParticles()
          buildPortals()
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)
      return overlay
    },

    activate() {
      active = true
      fetchWeather()
      buildPortals()
      initAudio()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      if (windGain && audioCtx) {
        windGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1)
      }
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
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
