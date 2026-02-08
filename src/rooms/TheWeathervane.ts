/**
 * THE WEATHERVANE — the sky outside rendered as data
 *
 * Fetches real-time weather for your location via Open-Meteo API
 * and renders it as an abstract atmospheric visualization.
 *
 * Temperature -> color warmth (cold=blue, warm=amber).
 * Wind -> particle movement + weathervane orientation.
 * Weather code -> atmospheric effects (rain, snow, clouds, fog, lightning).
 * Humidity -> fog density. Cloud cover -> darkness + cloud layers.
 *
 * INTERACTIVE: Move your cursor to create wind gusts that push
 * particles. A spinning weathervane at center responds to real
 * wind direction. Wind audio modulated by actual conditions.
 *
 * Uses Open-Meteo API (free, no key, CORS-friendly).
 * Geolocation with short timeout, fallback to Berlin.
 * 10-minute data cache across room switches.
 * Zero memory dependency.
 *
 * Navigation portals themed as compass directions and weather phenomena:
 *   - seismograph (S): tremors beneath the wind
 *   - radio (E): frequencies carried on the breeze
 *   - glacarium (N): ice crystals on the northern horizon
 *   - tidepool (W): rain collects westward
 *
 * Inspired by: weather stations, barometers, Olafur Eliasson's
 * Weather Project, James Turrell's skyspaces
 */

import type { Room } from './RoomManager'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

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
  type: 'air' | 'rain' | 'snow' | 'cloud' | 'lightning'
  life?: number
  maxLife?: number
}

interface WeathervaneDeps {
  switchTo?: (name: string) => void
}

interface PortalDef {
  name: string
  label: string
  compassDir: string
  icon: string
  x: number
  y: number
  r: number
  hovered: boolean
  angle: number
  windOffset: number
}

const API_BASE = 'https://api.open-meteo.com/v1/forecast'
const CACHE_DURATION = 600_000 // 10 minutes
const GEO_TIMEOUT = 3000 // short geolocation timeout

// Module-level cache so data persists across room switches
let cachedWeather: WeatherData | null = null
let cacheTimestamp = 0

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
  let vaneOscillation = 0

  // Audio — shared AudioContext from AudioBus
  let sharedAudioCtx: AudioContext | null = null
  let audioDestination: AudioNode | null = null
  let audioInitialized = false

  // Wind synthesis nodes
  let windNoiseSource: AudioBufferSourceNode | null = null
  let windFilter: BiquadFilterNode | null = null
  let windGain: GainNode | null = null
  let windFilterLFO: OscillatorNode | null = null
  let windLFOGain: GainNode | null = null

  // Rain synthesis nodes
  let rainGain: GainNode | null = null
  let rainFilter: BiquadFilterNode | null = null
  let rainNoiseSource: AudioBufferSourceNode | null = null
  let rainDropTimer = 0
  let rainDropGain: GainNode | null = null

  // Thunder synthesis nodes
  let thunderGain: GainNode | null = null
  let thunderFilter: BiquadFilterNode | null = null
  let thunderNoiseSource: AudioBufferSourceNode | null = null
  let thunderTimer = 0
  let thunderActive = false

  // Temperature drone nodes
  let droneOsc: OscillatorNode | null = null
  let droneGain: GainNode | null = null
  let droneOsc2: OscillatorNode | null = null
  let droneGain2: GainNode | null = null

  // Cursor wind whoosh
  let cursorWhooshGain: GainNode | null = null
  let cursorWhooshFilter: BiquadFilterNode | null = null
  let cursorWhooshSource: AudioBufferSourceNode | null = null

  // Lightning flash
  let lightningAlpha = 0
  let lightningTimer = 0

  // Cultural inscription
  const inscriptions = [
    'the atmosphere remembers summer at the wrong time',
    'warm rain on mountain passes. the aquifers will feel this in july.',
    'olafur eliasson built a sun inside the tate. nature forgot how.',
    'the jet stream forgets its shape. arctic air spills south.',
  ]
  let inscriptionIndex = 0
  let inscriptionTimer = 0
  let inscriptionAlpha = 0

  // Cursor speed tracking
  let cursorSpeed = 0

  // Navigation portals
  const portals: PortalDef[] = []

  function buildPortals() {
    if (!canvas) return
    const w = canvas.width
    const h = canvas.height
    const cx = w / 2
    const cy = h / 2
    const orbitalRadius = Math.min(w, h) * 0.38

    portals.length = 0

    // Portals placed at compass directions around the weathervane
    // N = glacarium (ice on the northern horizon)
    // E = radio (frequencies drift eastward)
    // S = seismograph (tremors beneath, southward)
    // W = tidepool (rain collects to the west)
    const defs: Array<{ name: string; label: string; compassDir: string; icon: string; angleDeg: number }> = [
      { name: 'glacarium', label: 'ice on the horizon', compassDir: 'N', icon: '***', angleDeg: 270 },
      { name: 'radio', label: 'a frequency drifts by', compassDir: 'E', icon: '~))', angleDeg: 0 },
      { name: 'seismograph', label: 'tremors beneath', compassDir: 'S', icon: '/\\/\\', angleDeg: 90 },
      { name: 'tidepool', label: 'water collects below', compassDir: 'W', icon: '~~~', angleDeg: 180 },
    ]

    for (const d of defs) {
      const rad = (d.angleDeg * Math.PI) / 180
      portals.push({
        name: d.name,
        label: d.label,
        compassDir: d.compassDir,
        icon: d.icon,
        x: cx + Math.cos(rad) * orbitalRadius,
        y: cy + Math.sin(rad) * orbitalRadius,
        r: 22,
        hovered: false,
        angle: rad,
        windOffset: Math.random() * Math.PI * 2,
      })
    }
  }

  function tempToColor(temp: number): { r: number; g: number; b: number } {
    // Cold -> blue/teal, warm -> amber/red
    if (temp < -10) return { r: 30, g: 50, b: 210 }
    if (temp < 0) return { r: 40, g: 110, b: 210 }
    if (temp < 5) return { r: 50, g: 150, b: 190 }
    if (temp < 10) return { r: 60, g: 180, b: 150 }
    if (temp < 15) return { r: 90, g: 200, b: 100 }
    if (temp < 20) return { r: 160, g: 200, b: 60 }
    if (temp < 25) return { r: 210, g: 180, b: 40 }
    if (temp < 30) return { r: 220, g: 140, b: 30 }
    if (temp < 35) return { r: 230, g: 80, b: 30 }
    return { r: 230, g: 50, b: 30 }
  }

  function weatherCodeToText(code: number): string {
    const codes: Record<number, string> = {
      0: 'clear sky',
      1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
      45: 'fog', 48: 'depositing rime fog',
      51: 'light drizzle', 53: 'moderate drizzle', 55: 'dense drizzle',
      56: 'light freezing drizzle', 57: 'dense freezing drizzle',
      61: 'slight rain', 63: 'moderate rain', 65: 'heavy rain',
      66: 'light freezing rain', 67: 'heavy freezing rain',
      71: 'slight snow', 73: 'moderate snow', 75: 'heavy snow',
      77: 'snow grains',
      80: 'slight showers', 81: 'moderate showers', 82: 'violent showers',
      85: 'slight snow showers', 86: 'heavy snow showers',
      95: 'thunderstorm', 96: 'thunderstorm with slight hail',
      99: 'thunderstorm with heavy hail',
    }
    return codes[code] || 'unknown'
  }

  function weatherCodeCategory(code: number): 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm' {
    if (code === 0 || code === 1) return 'clear'
    if (code <= 3) return 'cloudy'
    if (code <= 48) return 'fog'
    if (code <= 57) return 'drizzle'
    if (code <= 67) return 'rain'
    if (code <= 86) return 'snow'
    return 'storm'
  }

  function directionName(deg: number): string {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    return dirs[Math.round(deg / 45) % 8]
  }

  async function fetchWeather() {
    // Check module-level cache first
    if (cachedWeather && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
      weather = cachedWeather
      vaneTargetAngle = (weather.windDirection * Math.PI) / 180
      initParticles()
      updateAudio()
      loading = false
      return
    }

    loading = true
    error = false

    // Default: Berlin
    let lat = 52.52
    let lon = 13.41
    let locationName = 'berlin'

    // Try geolocation with a short timeout
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: GEO_TIMEOUT,
            maximumAge: CACHE_DURATION,
            enableHighAccuracy: false,
          })
        })
        lat = pos.coords.latitude
        lon = pos.coords.longitude
        // Format as human-readable coordinates
        const latDir = lat >= 0 ? 'N' : 'S'
        const lonDir = lon >= 0 ? 'E' : 'W'
        locationName = `${Math.abs(lat).toFixed(2)}\u00b0${latDir}, ${Math.abs(lon).toFixed(2)}\u00b0${lonDir}`
      } catch {
        // Geolocation unavailable or denied — use Berlin default
      }
    }

    try {
      const url = `${API_BASE}?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,rain,snowfall,is_day` +
        `&timezone=auto`
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
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

      // Update module-level cache
      cachedWeather = weather
      cacheTimestamp = Date.now()

      vaneTargetAngle = (weather.windDirection * Math.PI) / 180
      initParticles()
      updateAudio()
      loading = false
    } catch {
      error = true
      loading = false
      // If we had stale cache data, use it as fallback
      if (cachedWeather) {
        weather = cachedWeather
        vaneTargetAngle = (weather.windDirection * Math.PI) / 180
        initParticles()
      }
    }
  }

  function createNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const bufferSize = ctx.sampleRate * seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5
    }
    return buffer
  }

  async function initAudio() {
    if (audioInitialized) return
    audioInitialized = true
    try {
      sharedAudioCtx = await getAudioContext()
      audioDestination = getAudioDestination()
      const ctx = sharedAudioCtx
      const dest = audioDestination
      const noiseBuffer = createNoiseBuffer(ctx, 2)

      // === WIND SYNTHESIS ===
      // Bandpass-filtered noise, LFO modulates filter frequency
      windNoiseSource = ctx.createBufferSource()
      windNoiseSource.buffer = noiseBuffer
      windNoiseSource.loop = true

      windFilter = ctx.createBiquadFilter()
      windFilter.type = 'bandpass'
      windFilter.frequency.value = 300
      windFilter.Q.value = 0.5

      // LFO to modulate wind filter frequency for organic movement
      windFilterLFO = ctx.createOscillator()
      windFilterLFO.type = 'sine'
      windFilterLFO.frequency.value = 0.15 // slow modulation
      windLFOGain = ctx.createGain()
      windLFOGain.gain.value = 100 // +/- 100Hz modulation range
      windFilterLFO.connect(windLFOGain)
      windLFOGain.connect(windFilter.frequency)
      windFilterLFO.start()

      windGain = ctx.createGain()
      windGain.gain.value = 0

      windNoiseSource.connect(windFilter)
      windFilter.connect(windGain)
      windGain.connect(dest)
      windNoiseSource.start()

      // Fade in wind over 2 seconds
      windGain.gain.linearRampToValueAtTime(0.015, ctx.currentTime + 2)

      // === RAIN SYNTHESIS ===
      // Continuous filtered noise for rain backdrop
      rainNoiseSource = ctx.createBufferSource()
      rainNoiseSource.buffer = noiseBuffer
      rainNoiseSource.loop = true

      rainFilter = ctx.createBiquadFilter()
      rainFilter.type = 'highpass'
      rainFilter.frequency.value = 3000
      rainFilter.Q.value = 0.7

      rainGain = ctx.createGain()
      rainGain.gain.value = 0

      rainNoiseSource.connect(rainFilter)
      rainFilter.connect(rainGain)
      rainGain.connect(dest)
      rainNoiseSource.start()

      // Rain droplet burst channel (short enveloped noise hits)
      rainDropGain = ctx.createGain()
      rainDropGain.gain.value = 0
      rainDropGain.connect(dest)

      // === THUNDER SYNTHESIS ===
      // Very low-freq filtered noise for rumble
      thunderNoiseSource = ctx.createBufferSource()
      thunderNoiseSource.buffer = noiseBuffer
      thunderNoiseSource.loop = true

      thunderFilter = ctx.createBiquadFilter()
      thunderFilter.type = 'lowpass'
      thunderFilter.frequency.value = 60
      thunderFilter.Q.value = 1.0

      thunderGain = ctx.createGain()
      thunderGain.gain.value = 0

      thunderNoiseSource.connect(thunderFilter)
      thunderFilter.connect(thunderGain)
      thunderGain.connect(dest)
      thunderNoiseSource.start()

      // === TEMPERATURE DRONE ===
      // Base sine, frequency mapped to temperature
      droneOsc = ctx.createOscillator()
      droneOsc.type = 'sine'
      droneOsc.frequency.value = 55 // default A1
      droneGain = ctx.createGain()
      droneGain.gain.value = 0
      droneOsc.connect(droneGain)
      droneGain.connect(dest)
      droneOsc.start()

      // Second overtone — adds warmth for high temps, silent for cold
      droneOsc2 = ctx.createOscillator()
      droneOsc2.type = 'triangle'
      droneOsc2.frequency.value = 110
      droneGain2 = ctx.createGain()
      droneGain2.gain.value = 0
      droneOsc2.connect(droneGain2)
      droneGain2.connect(dest)
      droneOsc2.start()

      // === CURSOR WIND WHOOSH ===
      cursorWhooshSource = ctx.createBufferSource()
      cursorWhooshSource.buffer = noiseBuffer
      cursorWhooshSource.loop = true

      cursorWhooshFilter = ctx.createBiquadFilter()
      cursorWhooshFilter.type = 'bandpass'
      cursorWhooshFilter.frequency.value = 800
      cursorWhooshFilter.Q.value = 1.2

      cursorWhooshGain = ctx.createGain()
      cursorWhooshGain.gain.value = 0

      cursorWhooshSource.connect(cursorWhooshFilter)
      cursorWhooshFilter.connect(cursorWhooshGain)
      cursorWhooshGain.connect(dest)
      cursorWhooshSource.start()
    } catch {
      // Audio not available
      audioInitialized = false
    }
  }

  function triggerRainDrop() {
    if (!sharedAudioCtx || !audioDestination) return
    const ctx = sharedAudioCtx
    try {
      // Short burst of high-freq filtered noise — sounds like a droplet
      const dropBuf = createNoiseBuffer(ctx, 0.05)
      const src = ctx.createBufferSource()
      src.buffer = dropBuf

      const filt = ctx.createBiquadFilter()
      filt.type = 'bandpass'
      filt.frequency.value = 2000 + Math.random() * 4000
      filt.Q.value = 2 + Math.random() * 3

      const gain = ctx.createGain()
      const vol = 0.005 + Math.random() * 0.015
      gain.gain.setValueAtTime(vol, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06)

      src.connect(filt)
      filt.connect(gain)
      gain.connect(audioDestination)
      src.start()
      src.stop(ctx.currentTime + 0.08)
    } catch {
      // drop failed — no big deal
    }
  }

  function triggerThunder() {
    if (!sharedAudioCtx || !thunderGain || !thunderFilter) return
    const ctx = sharedAudioCtx
    thunderActive = true
    // Rumble: ramp up, sustain, decay
    thunderFilter.frequency.setValueAtTime(40 + Math.random() * 40, ctx.currentTime)
    thunderGain.gain.setValueAtTime(0, ctx.currentTime)
    thunderGain.gain.linearRampToValueAtTime(0.03 + Math.random() * 0.02, ctx.currentTime + 0.3)
    thunderGain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 1.0)
    thunderGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.5)
    setTimeout(() => { thunderActive = false }, 2500)
  }

  function updateAudio() {
    if (!sharedAudioCtx || !weather) return
    const ctx = sharedAudioCtx

    // === Wind: volume + filter modulated by actual wind speed ===
    if (windGain && windFilter && windLFOGain) {
      const windNorm = Math.min(weather.windSpeed / 50, 1)
      const vol = 0.01 + windNorm * 0.03
      windGain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 1)
      // Higher wind = higher center frequency + wider LFO sweep
      const freq = 200 + windNorm * 400 + Math.max(0, weather.temperature) * 5
      windFilter.frequency.linearRampToValueAtTime(freq, ctx.currentTime + 1)
      windLFOGain.gain.linearRampToValueAtTime(80 + windNorm * 200, ctx.currentTime + 1)
      // Faster LFO with stronger wind
      if (windFilterLFO) {
        windFilterLFO.frequency.linearRampToValueAtTime(0.1 + windNorm * 0.4, ctx.currentTime + 1)
      }
    }

    // === Rain: continuous high-freq wash when raining ===
    if (rainGain && rainFilter) {
      const category = weatherCodeCategory(weather.weatherCode)
      const isRaining = weather.rain > 0 || category === 'rain' || category === 'drizzle'
      if (isRaining) {
        const intensity = Math.min((weather.rain + (category === 'drizzle' ? 0.3 : 0.5)) / 5, 1)
        rainGain.gain.linearRampToValueAtTime(0.005 + intensity * 0.025, ctx.currentTime + 1)
        // Heavier rain = lower filter = broader spectrum
        rainFilter.frequency.linearRampToValueAtTime(4000 - intensity * 2000, ctx.currentTime + 1)
      } else {
        rainGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1)
      }
    }

    // === Temperature drone ===
    if (droneOsc && droneGain && droneOsc2 && droneGain2) {
      // Cold -> low pure sine. Warm -> higher pitch + overtone
      const tempNorm = Math.max(0, Math.min(1, (weather.temperature + 10) / 45))
      const baseFreq = 40 + tempNorm * 40 // 40Hz at -10C, 80Hz at 35C
      droneOsc.frequency.linearRampToValueAtTime(baseFreq, ctx.currentTime + 2)
      droneGain.gain.linearRampToValueAtTime(0.012, ctx.currentTime + 2)

      // Overtone: silent in cold, present in warm
      const overtoneVol = tempNorm > 0.4 ? (tempNorm - 0.4) * 0.03 : 0
      droneOsc2.frequency.linearRampToValueAtTime(baseFreq * 2, ctx.currentTime + 2)
      droneGain2.gain.linearRampToValueAtTime(overtoneVol, ctx.currentTime + 2)
    }
  }

  function updateAudioPerFrame(dt: number) {
    if (!sharedAudioCtx || !weather) return
    const ctx = sharedAudioCtx

    // === Rain droplets at random intervals ===
    const category = weatherCodeCategory(weather.weatherCode)
    const isRaining = weather.rain > 0 || category === 'rain' || category === 'drizzle'
    if (isRaining) {
      rainDropTimer -= dt
      if (rainDropTimer <= 0) {
        triggerRainDrop()
        // Heavier rain = more frequent drops
        const intensity = Math.min((weather.rain + 0.5) / 5, 1)
        rainDropTimer = 0.02 + (1 - intensity) * 0.15 + Math.random() * 0.1
      }
    }

    // === Thunder during storms ===
    if (category === 'storm') {
      thunderTimer -= dt
      if (thunderTimer <= 0 && !thunderActive) {
        triggerThunder()
        thunderTimer = 4 + Math.random() * 12 // 4-16 seconds between rumbles
      }
    }

    // === Cursor whoosh modulation ===
    if (cursorWhooshGain && cursorWhooshFilter) {
      // cursorSpeed is set in handleMouseMove
      const whooshVol = Math.min(cursorSpeed * 0.0003, 0.035)
      cursorWhooshGain.gain.linearRampToValueAtTime(whooshVol, ctx.currentTime + 0.05)
      // Faster cursor = higher whoosh frequency
      const whooshFreq = 600 + Math.min(cursorSpeed, 40) * 30
      cursorWhooshFilter.frequency.linearRampToValueAtTime(whooshFreq, ctx.currentTime + 0.05)
    }

    // === Cultural inscription cycling ===
    inscriptionTimer += dt
    if (inscriptionTimer >= 25) {
      inscriptionTimer = 0
      inscriptionIndex = (inscriptionIndex + 1) % inscriptions.length
    }
    // Fade: in for first 2s, visible for 21s, out for last 2s
    if (inscriptionTimer < 2) {
      inscriptionAlpha = inscriptionTimer / 2
    } else if (inscriptionTimer > 23) {
      inscriptionAlpha = (25 - inscriptionTimer) / 2
    } else {
      inscriptionAlpha = 1
    }
  }

  function initParticles() {
    if (!canvas || !weather) return
    const w = canvas.width
    const h = canvas.height
    particles = []

    // Air particles — more with higher wind speed
    const airCount = 80 + Math.floor(weather.windSpeed * 3)
    for (let i = 0; i < airCount; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: 0, vy: 0,
        size: 1 + Math.random() * 2,
        alpha: 0.04 + Math.random() * 0.08,
        type: 'air',
      })
    }

    // Rain particles based on rain amount
    const category = weatherCodeCategory(weather.weatherCode)
    if (weather.rain > 0 || category === 'rain' || category === 'drizzle') {
      const rainAmount = Math.max(weather.rain, category === 'drizzle' ? 0.5 : 1)
      const rainCount = Math.floor(rainAmount * 60)
      for (let i = 0; i < Math.min(rainCount, 400); i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: 0, vy: 0,
          size: category === 'drizzle' ? 0.5 : 1,
          alpha: 0.2 + Math.random() * 0.3,
          type: 'rain',
        })
      }
    }

    // Snow particles
    if (weather.snowfall > 0 || category === 'snow') {
      const snowAmount = Math.max(weather.snowfall, 0.5)
      const snowCount = Math.floor(snowAmount * 100)
      for (let i = 0; i < Math.min(snowCount, 250); i++) {
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

    // Cloud puffs when overcast or cloudy
    if (weather.cloudCover > 30) {
      const cloudCount = Math.floor((weather.cloudCover / 100) * 25)
      for (let i = 0; i < cloudCount; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h * 0.5, // upper half
          vx: 0, vy: 0,
          size: 30 + Math.random() * 60,
          alpha: 0.02 + (weather.cloudCover / 100) * 0.04,
          type: 'cloud',
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

    // Track cursor speed for audio modulation
    cursorSpeed = Math.hypot(mouseX - prevMouseX, mouseY - prevMouseY)

    // Portal hover detection
    for (const p of portals) {
      p.hovered = Math.hypot(mouseX - p.x, mouseY - p.y) < p.r + 12
    }

    if (canvas) {
      canvas.style.cursor = portals.some(p => p.hovered) ? 'pointer' : 'default'
    }
  }

  function handleClick(e: MouseEvent) {
    // Check portal clicks first
    for (const p of portals) {
      if (p.hovered && deps.switchTo) {
        deps.switchTo(p.name)
        return
      }
    }

    // Gust burst — scatter particles outward from click point
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const clickX = (e.clientX - rect.left) * (canvas.width / rect.width)
    const clickY = (e.clientY - rect.top) * (canvas.height / rect.height)
    const burstRadius = 200
    const burstForce = 4

    for (const p of particles) {
      const dx = p.x - clickX
      const dy = p.y - clickY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < burstRadius && dist > 0) {
        const strength = (1 - dist / burstRadius) * burstForce
        p.vx += (dx / dist) * strength
        p.vy += (dy / dist) * strength
      }
    }

    // Brief whoosh burst on click
    if (cursorWhooshGain && sharedAudioCtx) {
      const ctx = sharedAudioCtx
      cursorWhooshGain.gain.setValueAtTime(0.03, ctx.currentTime)
      cursorWhooshGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    }
  }

  function drawWeathervane(c: CanvasRenderingContext2D, cx: number, cy: number) {
    // Smoothly rotate toward target wind direction
    let diff = vaneTargetAngle - vaneAngle
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    vaneAngle += diff * 0.02

    // Wind-speed-dependent oscillation (gusty in high wind)
    const gustiness = weather ? Math.min(weather.windSpeed / 30, 1) : 0
    vaneOscillation += 0.03 + gustiness * 0.05
    const wobble = Math.sin(vaneOscillation) * gustiness * 0.08
    const renderAngle = vaneAngle + wobble

    // Cursor wind influence
    const cursorInfluence = Math.atan2(mouseVY, mouseVX)
    const cursorStrength = Math.min(Math.hypot(mouseVX, mouseVY) * 0.01, 0.1)
    const finalAngle = renderAngle + Math.sin(cursorInfluence - renderAngle) * cursorStrength

    const color = weather ? tempToColor(weather.temperature) : { r: 140, g: 160, b: 200 }
    const alpha = 0.14

    c.save()
    c.translate(cx, cy)

    // Outer ring with tick marks
    c.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.4})`
    c.lineWidth = 1
    c.beginPath()
    c.arc(0, 0, 65, 0, Math.PI * 2)
    c.stroke()

    // Inner ring
    c.beginPath()
    c.arc(0, 0, 55, 0, Math.PI * 2)
    c.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.2})`
    c.stroke()

    // Tick marks around circle
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2
      const isCardinal = i % 8 === 0
      const isMajor = i % 4 === 0
      const innerR = isCardinal ? 55 : isMajor ? 58 : 61
      const outerR = 65
      c.beginPath()
      c.moveTo(Math.cos(a) * innerR, Math.sin(a) * innerR)
      c.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR)
      c.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${isCardinal ? alpha * 0.6 : alpha * 0.3})`
      c.lineWidth = isCardinal ? 1.5 : 0.5
      c.stroke()
    }

    // Cardinal labels
    c.font = '12px monospace'
    c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.8})`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText('N', 0, -78)
    c.fillText('S', 0, 78)
    c.fillText('E', 78, 0)
    c.fillText('W', -78, 0)

    // Vane arrow
    c.save()
    c.rotate(finalAngle)

    // Arrow body
    c.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(0, 42)
    c.lineTo(0, -42)
    c.stroke()

    // Arrow head (points into wind direction)
    c.beginPath()
    c.moveTo(0, -48)
    c.lineTo(-7, -36)
    c.lineTo(7, -36)
    c.closePath()
    c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
    c.fill()

    // Arrow tail (wider, opposite direction)
    c.beginPath()
    c.moveTo(-9, 36)
    c.lineTo(9, 36)
    c.lineTo(0, 48)
    c.closePath()
    c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.5})`
    c.fill()

    c.restore()

    // Center dot
    c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.8})`
    c.beginPath()
    c.arc(0, 0, 3, 0, Math.PI * 2)
    c.fill()

    // Wind speed arc indicator (shows speed as arc length)
    if (weather) {
      const speedFrac = Math.min(weather.windSpeed / 60, 1)
      const arcLen = speedFrac * Math.PI * 1.5
      c.beginPath()
      c.arc(0, 0, 70, -Math.PI / 2, -Math.PI / 2 + arcLen)
      c.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.5})`
      c.lineWidth = 2
      c.stroke()
    }

    c.restore()
  }

  function drawPortal(c: CanvasRenderingContext2D, p: PortalDef, color: { r: number; g: number; b: number }) {
    const pulse = Math.sin(time * 1.5 + p.windOffset) * 0.3 + 0.7
    const windPush = weather ? Math.sin(time * 0.8 + p.windOffset) * (weather.windSpeed / 80) * 5 : 0
    const drawX = p.x + windPush * Math.cos(p.angle + Math.PI / 2)
    const drawY = p.y + windPush * Math.sin(p.angle + Math.PI / 2)
    const r = p.r * (p.hovered ? 1.3 : 1)
    const alpha = p.hovered ? 0.4 : 0.08 * pulse

    c.save()
    c.translate(drawX, drawY)

    // Outer glow when hovered
    if (p.hovered) {
      const grad = c.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 2)
      grad.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.1)`)
      grad.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`)
      c.fillStyle = grad
      c.beginPath()
      c.arc(0, 0, r * 2, 0, Math.PI * 2)
      c.fill()
    }

    // Portal circle
    c.beginPath()
    c.arc(0, 0, r, 0, Math.PI * 2)
    c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.25})`
    c.fill()
    c.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
    c.lineWidth = 1
    c.stroke()

    // Compass direction letter inside portal
    c.font = 'bold 11px monospace'
    c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${p.hovered ? 0.6 : alpha * 1.2})`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(p.compassDir, 0, 0)

    // Weather-themed icon below compass letter
    c.font = '7px monospace'
    c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${p.hovered ? 0.4 : alpha * 0.7})`
    c.fillText(p.icon, 0, 10)

    // Label on hover
    if (p.hovered) {
      c.font = '13px "Cormorant Garamond", serif'
      c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.55)`
      c.textAlign = 'center'
      c.fillText(p.label, 0, r + 18)

      // Room name in smaller text
      c.font = '11px monospace'
      c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.35)`
      c.fillText(`\u2192 the ${p.name}`, 0, r + 30)
    }

    c.restore()
  }

  function drawCloudLayer(c: CanvasRenderingContext2D, w: number, _h: number) {
    if (!weather || weather.cloudCover < 20) return

    const coverFrac = weather.cloudCover / 100
    const layerAlpha = coverFrac * 0.06
    const color = weather.isDay
      ? { r: 120, g: 130, b: 150 }
      : { r: 40, g: 45, b: 60 }

    // Draw drifting cloud bands across top portion
    for (let i = 0; i < 3; i++) {
      const y = 30 + i * 40 + Math.sin(time * 0.15 + i * 2) * 20
      const xOff = (time * (8 + i * 3) + i * w * 0.3) % (w + 200) - 100
      const bw = 200 + i * 80

      const grad = c.createRadialGradient(xOff, y, 0, xOff, y, bw)
      grad.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${layerAlpha})`)
      grad.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`)
      c.fillStyle = grad
      c.fillRect(0, 0, w, _h * 0.4)
    }
  }

  function updateLightning(dt: number) {
    if (!weather) return
    const category = weatherCodeCategory(weather.weatherCode)
    if (category !== 'storm') {
      lightningAlpha = 0
      return
    }

    lightningTimer -= dt
    if (lightningTimer <= 0) {
      // Random lightning flash
      lightningAlpha = 0.15 + Math.random() * 0.15
      lightningTimer = 3 + Math.random() * 8 // 3-11 seconds between flashes
    }
    lightningAlpha *= 0.9 // quick decay
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    const dt = 0.016
    time += dt

    const w = canvas.width
    const h = canvas.height
    const c = ctx

    // Decay cursor velocity and speed
    mouseVX *= 0.95
    mouseVY *= 0.95
    cursorSpeed *= 0.9

    // Update lightning
    updateLightning(dt)

    // Per-frame audio updates (rain drops, thunder timing, cursor whoosh)
    updateAudioPerFrame(dt)

    // Background — temperature-tinted
    if (weather) {
      const color = tempToColor(weather.temperature)
      const dayMul = weather.isDay ? 1 : 0.4
      const r = Math.floor(color.r * 0.03 * dayMul + (weather.isDay ? 5 : 2))
      const g = Math.floor(color.g * 0.03 * dayMul + (weather.isDay ? 5 : 2))
      const b = Math.floor(color.b * 0.03 * dayMul + (weather.isDay ? 8 : 5))
      c.fillStyle = `rgb(${r}, ${g}, ${b})`
    } else {
      c.fillStyle = 'rgb(5, 5, 10)'
    }
    c.fillRect(0, 0, w, h)

    if (weather) {
      // Lightning flash overlay
      if (lightningAlpha > 0.01) {
        c.fillStyle = `rgba(200, 210, 255, ${lightningAlpha})`
        c.fillRect(0, 0, w, h)
      }

      // Fog overlay
      if (weather.humidity > 70 || weatherCodeCategory(weather.weatherCode) === 'fog') {
        const fogBase = weatherCodeCategory(weather.weatherCode) === 'fog' ? 0.12 : 0
        const humidFog = Math.max(0, (weather.humidity - 70) / 30) * 0.1
        const fogAlpha = fogBase + humidFog
        // Animated fog layers
        for (let layer = 0; layer < 2; layer++) {
          const yOff = Math.sin(time * 0.1 + layer * 3) * 30
          const grad = c.createLinearGradient(0, h * 0.3 + yOff, 0, h)
          grad.addColorStop(0, `rgba(80, 85, 95, 0)`)
          grad.addColorStop(0.5, `rgba(80, 85, 95, ${fogAlpha * 0.5})`)
          grad.addColorStop(1, `rgba(80, 85, 95, ${fogAlpha})`)
          c.fillStyle = grad
          c.fillRect(0, 0, w, h)
        }
      }

      // Cloud layer
      drawCloudLayer(c, w, h)

      const windRad = (weather.windDirection * Math.PI) / 180
      const windForce = weather.windSpeed / 50

      // Cursor gust radius
      const gustRadius = 150

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]

        // Cursor wind influence — dramatic gusts
        const dx = p.x - mouseX
        const dy = p.y - mouseY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < gustRadius && dist > 0) {
          const falloff = 1 - dist / gustRadius
          // Directional push from cursor velocity
          const pushForce = falloff * 0.8
          p.vx += mouseVX * pushForce
          p.vy += mouseVY * pushForce
          // Radial scatter — particles near cursor get pushed outward too
          const radialForce = falloff * cursorSpeed * 0.02
          p.vx += (dx / dist) * radialForce
          p.vy += (dy / dist) * radialForce
        }

        // Lightning particles: limited lifespan
        if (p.type === 'lightning') {
          p.life = (p.life || 0) + dt
          if (p.life > (p.maxLife || 0.5)) {
            particles.splice(i, 1)
            continue
          }
          p.alpha = (1 - p.life / (p.maxLife || 0.5)) * 0.6
          p.vy += 1
          p.vx *= 0.98
        }

        switch (p.type) {
          case 'air':
            p.vx += Math.sin(windRad) * windForce * 0.12
            p.vy += Math.cos(windRad) * windForce * 0.06
            p.vx += (Math.random() - 0.5) * 0.1
            p.vy += (Math.random() - 0.5) * 0.1
            p.vx *= 0.98
            p.vy *= 0.98
            break
          case 'rain':
            p.vx = Math.sin(windRad) * windForce * 2 + mouseVX * 0.08
            p.vy = 3.5 + weather.rain * 2 + windForce * 0.5
            break
          case 'snow':
            p.vx = Math.sin(windRad) * windForce * 0.8 + Math.sin(time * 1.5 + p.x * 0.01) * 0.4
            p.vy = 0.4 + weather.snowfall * 0.3
            break
          case 'cloud':
            p.vx = Math.sin(windRad) * windForce * 0.3 + 0.1
            p.vy = Math.sin(time * 0.2 + p.x * 0.005) * 0.05
            break
          case 'lightning':
            // already handled above
            break
        }

        p.x += p.vx
        p.y += p.vy

        // Wrap around
        if (p.type !== 'lightning') {
          if (p.x < -p.size) p.x += w + p.size * 2
          if (p.x > w + p.size) p.x -= w + p.size * 2
          if (p.y > h + p.size) p.y = -p.size
          if (p.y < -p.size * 2) p.y = h
        }

        // Draw
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
            c.lineWidth = p.size
            c.beginPath()
            c.moveTo(p.x, p.y)
            c.lineTo(p.x + p.vx * 2, p.y + p.vy * 2)
            c.stroke()
            break
          case 'snow':
            c.fillStyle = `rgba(220, 225, 240, ${p.alpha})`
            c.beginPath()
            c.arc(p.x, p.y, p.size, 0, Math.PI * 2)
            c.fill()
            break
          case 'cloud': {
            const grad = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size)
            const cCol = weather.isDay ? '140,145,160' : '50,55,65'
            grad.addColorStop(0, `rgba(${cCol}, ${p.alpha})`)
            grad.addColorStop(1, `rgba(${cCol}, 0)`)
            c.fillStyle = grad
            c.beginPath()
            c.arc(p.x, p.y, p.size, 0, Math.PI * 2)
            c.fill()
            break
          }
          case 'lightning':
            c.fillStyle = `rgba(200, 210, 255, ${p.alpha})`
            c.beginPath()
            c.arc(p.x, p.y, p.size, 0, Math.PI * 2)
            c.fill()
            break
        }
      }

      // Spawn lightning sparks during flash
      if (lightningAlpha > 0.05 && particles.length < 800) {
        const boltX = w * 0.2 + Math.random() * w * 0.6
        for (let s = 0; s < 5; s++) {
          particles.push({
            x: boltX + (Math.random() - 0.5) * 30,
            y: Math.random() * h * 0.4,
            vx: (Math.random() - 0.5) * 3,
            vy: 2 + Math.random() * 4,
            size: 1 + Math.random() * 2,
            alpha: 0.6,
            type: 'lightning',
            life: 0,
            maxLife: 0.3 + Math.random() * 0.4,
          })
        }
      }

      // Draw weathervane in center
      drawWeathervane(c, w / 2, h / 2)

      // Temperature display — large ghostly number
      const color = tempToColor(weather.temperature)
      c.font = '80px monospace'
      c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.06)`
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(`${weather.temperature.toFixed(1)}\u00b0`, w / 2, h * 0.25)

      // Weather description
      c.font = '16px "Cormorant Garamond", serif'
      c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.13)`
      c.textAlign = 'center'
      c.textBaseline = 'alphabetic'
      c.fillText(weatherCodeToText(weather.weatherCode), w / 2, h * 0.73)

      // Data readout — bottom left
      c.font = '12px monospace'
      c.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.09)`
      c.textAlign = 'left'
      c.textBaseline = 'alphabetic'
      c.fillText(`wind ${weather.windSpeed.toFixed(0)} km/h ${directionName(weather.windDirection)}`, 20, h - 58)
      c.fillText(`humidity ${weather.humidity}%`, 20, h - 44)
      c.fillText(`cloud cover ${weather.cloudCover}%`, 20, h - 30)

      if (weather.rain > 0) c.fillText(`rain ${weather.rain} mm`, 20, h - 16)
      else if (weather.snowfall > 0) c.fillText(`snow ${weather.snowfall} cm`, 20, h - 16)

      // Location and meta — bottom right
      c.textAlign = 'right'
      c.fillText(weather.location, w - 20, h - 44)
      c.fillText(weather.isDay ? 'day' : 'night', w - 20, h - 30)

      const elapsed = Date.now() - cacheTimestamp
      const mins = Math.floor(elapsed / 60000)
      c.fillText(mins < 1 ? 'just updated' : `updated ${mins}m ago`, w - 20, h - 16)
    }

    // Navigation portals
    const portalColor = weather ? tempToColor(weather.temperature) : { r: 140, g: 160, b: 200 }
    for (const p of portals) {
      drawPortal(c, p, portalColor)
    }

    // Loading / error states
    if (loading) {
      c.font = '14px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(120, 140, 180, 0.15)'
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText('sensing the weather...', w / 2, h / 2)
    }
    if (error && !weather) {
      c.font = '12px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(200, 100, 80, 0.15)'
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText('the sky is unreachable.', w / 2, h / 2)
    }

    // Cultural inscription — near-invisible cycling text at bottom
    if (inscriptionAlpha > 0.01) {
      const inscColor = weather ? tempToColor(weather.temperature) : { r: 140, g: 160, b: 200 }
      c.font = '11px "Cormorant Garamond", serif'
      c.fillStyle = `rgba(${inscColor.r}, ${inscColor.g}, ${inscColor.b}, ${inscriptionAlpha * 0.04})`
      c.textAlign = 'center'
      c.textBaseline = 'alphabetic'
      c.fillText(inscriptions[inscriptionIndex], w / 2, h - 6)
    }

    // Title
    c.font = '12px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(140, 160, 200, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.textBaseline = 'alphabetic'
    c.fillText('the weathervane', w / 2, 25)

    // Hint
    c.font = '12px "Cormorant Garamond", serif'
    c.fillStyle = 'rgba(140, 160, 200, 0.04)'
    c.textAlign = 'center'
    c.fillText('move to stir the wind', w / 2, 40)

    // Auto-refresh when cache expires
    if ((Date.now() - cacheTimestamp) > CACHE_DURATION && !loading) {
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
      // Fade out all audio gracefully (shared context — don't close it)
      if (sharedAudioCtx) {
        const t = sharedAudioCtx.currentTime
        if (windGain) windGain.gain.linearRampToValueAtTime(0, t + 1)
        if (rainGain) rainGain.gain.linearRampToValueAtTime(0, t + 1)
        if (thunderGain) thunderGain.gain.linearRampToValueAtTime(0, t + 0.5)
        if (droneGain) droneGain.gain.linearRampToValueAtTime(0, t + 1.5)
        if (droneGain2) droneGain2.gain.linearRampToValueAtTime(0, t + 1.5)
        if (cursorWhooshGain) cursorWhooshGain.gain.linearRampToValueAtTime(0, t + 0.3)
      }
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)

      // Disconnect and stop all audio nodes (shared context — never close it)
      const stopSource = (src: AudioBufferSourceNode | OscillatorNode | null) => {
        if (src) {
          try { src.stop() } catch { /* already stopped */ }
          try { src.disconnect() } catch { /* already disconnected */ }
        }
      }
      stopSource(windNoiseSource)
      stopSource(windFilterLFO)
      stopSource(rainNoiseSource)
      stopSource(thunderNoiseSource)
      stopSource(droneOsc)
      stopSource(droneOsc2)
      stopSource(cursorWhooshSource)

      const disconnectNode = (node: AudioNode | null) => {
        if (node) {
          try { node.disconnect() } catch { /* already disconnected */ }
        }
      }
      disconnectNode(windFilter)
      disconnectNode(windGain)
      disconnectNode(windLFOGain)
      disconnectNode(rainFilter)
      disconnectNode(rainGain)
      disconnectNode(rainDropGain)
      disconnectNode(thunderFilter)
      disconnectNode(thunderGain)
      disconnectNode(droneGain)
      disconnectNode(droneGain2)
      disconnectNode(cursorWhooshFilter)
      disconnectNode(cursorWhooshGain)

      // Null out references
      windNoiseSource = null
      windFilter = null
      windGain = null
      windFilterLFO = null
      windLFOGain = null
      rainNoiseSource = null
      rainFilter = null
      rainGain = null
      rainDropGain = null
      thunderNoiseSource = null
      thunderFilter = null
      thunderGain = null
      droneOsc = null
      droneGain = null
      droneOsc2 = null
      droneGain2 = null
      cursorWhooshSource = null
      cursorWhooshFilter = null
      cursorWhooshGain = null
      sharedAudioCtx = null
      audioDestination = null
      audioInitialized = false

      canvas?.removeEventListener('mousemove', handleMouseMove)
      canvas?.removeEventListener('click', handleClick)
      overlay?.remove()
    },
  }
}
