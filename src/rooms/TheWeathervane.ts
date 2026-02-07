/**
 * THE WEATHERVANE — the sky outside rendered as data
 *
 * Fetches real-time weather for the user's location (or a default)
 * and renders it as an abstract atmospheric visualization.
 *
 * Temperature → color warmth. Wind → particle movement.
 * Humidity → fog density. Cloud cover → darkness.
 * Rain → falling streaks. Snow → floating dots.
 *
 * Uses Open-Meteo API (free, no key, CORS-friendly).
 * Uses Geolocation API for position (falls back to Paris).
 *
 * The room breathes with the real weather outside your window.
 * Zero memory dependency.
 *
 * Inspired by: weather stations, barometers, Olafur Eliasson's
 * Weather Project, James Turrell's skyspaces, how weather is
 * the largest shared experience on Earth
 */

import type { Room } from './RoomManager'

interface WeatherData {
  temperature: number      // celsius
  windSpeed: number        // km/h
  windDirection: number    // degrees
  humidity: number         // 0-100
  cloudCover: number       // 0-100
  rain: number             // mm
  snowfall: number         // cm
  weatherCode: number      // WMO code
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

const API_BASE = 'https://api.open-meteo.com/v1/forecast'

export function createWeathervaneRoom(): Room {
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

  function tempToColor(temp: number): { r: number; g: number; b: number } {
    // -20 = deep blue, 0 = cyan, 15 = green, 25 = gold, 35+ = red
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

  async function fetchWeather() {
    loading = true
    error = false

    let lat = 48.8566 // Paris default
    let lon = 2.3522
    let locationName = 'paris'

    // Try geolocation
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

      initParticles()
      loading = false
      lastFetch = Date.now()
    } catch {
      error = true
      loading = false
    }
  }

  function initParticles() {
    if (!canvas || !weather) return
    const w = canvas.width
    const h = canvas.height
    particles = []

    // Air particles (always present)
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

    // Rain
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

    // Snow
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

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height

    // Background based on weather
    if (weather) {
      const cloudDark = weather.cloudCover / 100 * 0.3
      const dayBright = weather.isDay ? 0.03 : 0
      const color = tempToColor(weather.temperature)
      const r = Math.floor(color.r * 0.03 + (weather.isDay ? 5 : 2))
      const g = Math.floor(color.g * 0.03 + (weather.isDay ? 5 : 2))
      const b = Math.floor(color.b * 0.03 + (weather.isDay ? 8 : 5))
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
    } else {
      ctx.fillStyle = 'rgba(5, 5, 10, 1)'
    }
    ctx.fillRect(0, 0, w, h)

    if (weather) {
      // Fog overlay (humidity)
      if (weather.humidity > 70) {
        const fogAlpha = (weather.humidity - 70) / 30 * 0.15
        ctx.fillStyle = `rgba(80, 80, 90, ${fogAlpha})`
        ctx.fillRect(0, 0, w, h)
      }

      // Wind direction and speed
      const windRad = (weather.windDirection * Math.PI) / 180
      const windForce = weather.windSpeed / 50

      // Update and draw particles
      for (const p of particles) {
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
            p.vx = Math.sin(windRad) * windForce * 2
            p.vy = 4 + weather.rain * 2
            break
          case 'snow':
            p.vx = Math.sin(windRad) * windForce + Math.sin(time * 2 + p.x * 0.01) * 0.5
            p.vy = 0.5 + weather.snowfall * 0.3
            break
        }

        p.x += p.vx
        p.y += p.vy

        // Wrap
        if (p.x < 0) p.x += w
        if (p.x > w) p.x -= w
        if (p.y > h) p.y = -5
        if (p.y < -10) p.y = h

        // Draw
        const color = tempToColor(weather.temperature)
        switch (p.type) {
          case 'air':
            ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${p.alpha})`
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
            ctx.fill()
            break
          case 'rain':
            ctx.strokeStyle = `rgba(140, 160, 220, ${p.alpha})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(p.x + p.vx * 2, p.y + p.vy * 2)
            ctx.stroke()
            break
          case 'snow':
            ctx.fillStyle = `rgba(220, 220, 240, ${p.alpha})`
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
            ctx.fill()
            break
        }
      }

      // Temperature display — large, centered
      ctx.font = '80px monospace'
      const color = tempToColor(weather.temperature)
      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.08)`
      ctx.textAlign = 'center'
      ctx.fillText(`${weather.temperature.toFixed(1)}°`, w / 2, h * 0.4)

      // Weather description
      ctx.font = '16px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.15)`
      ctx.fillText(weatherCodeToText(weather.weatherCode), w / 2, h * 0.48)

      // Details
      ctx.font = '10px monospace'
      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.08)`
      ctx.textAlign = 'left'
      ctx.fillText(`wind: ${weather.windSpeed.toFixed(0)} km/h ${directionName(weather.windDirection)}`, 20, h - 55)
      ctx.fillText(`humidity: ${weather.humidity}%`, 20, h - 42)
      ctx.fillText(`cloud cover: ${weather.cloudCover}%`, 20, h - 29)

      if (weather.rain > 0) ctx.fillText(`rain: ${weather.rain} mm`, 20, h - 16)
      if (weather.snowfall > 0) ctx.fillText(`snow: ${weather.snowfall} cm`, 20, h - 16)

      ctx.textAlign = 'right'
      ctx.fillText(weather.location, w - 20, h - 42)
      ctx.fillText(weather.isDay ? 'day' : 'night', w - 20, h - 29)

      const mins = Math.floor((Date.now() - lastFetch) / 60000)
      ctx.fillText(`updated ${mins}m ago`, w - 20, h - 16)
    }

    // Loading/error state
    if (loading) {
      ctx.font = '14px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(120, 140, 180, 0.15)'
      ctx.textAlign = 'center'
      ctx.fillText('sensing the weather...', w / 2, h / 2)
    }
    if (error && !weather) {
      ctx.font = '12px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(200, 100, 80, 0.15)'
      ctx.textAlign = 'center'
      ctx.fillText('the sky is unreachable.', w / 2, h / 2)
    }

    // Title
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(140, 160, 200, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the weathervane', w / 2, 25)

    // Refresh every 10 minutes
    if (Date.now() - lastFetch > 600000 && !loading) {
      fetchWeather()
    }
  }

  function directionName(deg: number): string {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    return dirs[Math.round(deg / 45) % 8]
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

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
          if (weather) initParticles()
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)
      return overlay
    },

    activate() {
      active = true
      fetchWeather()
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
