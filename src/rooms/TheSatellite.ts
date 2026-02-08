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
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

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
  let prevIssLat = 0
  let prevIssLon = 0

  // --- Audio state ---
  let audioInitialized = false
  let audioCtxRef: AudioContext | null = null
  let masterVol: GainNode | null = null
  // Life support drone
  let droneOsc1: OscillatorNode | null = null
  let droneOsc2: OscillatorNode | null = null
  let droneGain: GainNode | null = null
  // Radar sweep
  let sweepOsc: OscillatorNode | null = null
  let sweepGain: GainNode | null = null
  let sweepLfo: OscillatorNode | null = null
  let sweepLfoGain: GainNode | null = null
  // Telemetry beep
  let beepInterval: number | null = null
  // Radio static
  let staticInterval: number | null = null
  // Cosmic wind (filtered noise)
  let windSource: AudioBufferSourceNode | null = null
  let windGain: GainNode | null = null
  let windFilter: BiquadFilterNode | null = null

  // --- Visual atmosphere state ---
  interface StarParticle {
    x: number; y: number; vx: number; vy: number
    size: number; alpha: number; twinkleSpeed: number
  }
  interface ShootingStar {
    x: number; y: number; vx: number; vy: number
    life: number; maxLife: number; length: number
  }
  interface Debris {
    x: number; y: number; vx: number; vy: number
    size: number; alpha: number
  }
  let starField: StarParticle[] = []
  let shootingStars: ShootingStar[] = []
  let debris: Debris[] = []
  let auroraPhase = 0

  // --- Cursor interactivity state ---
  interface StarTrail {
    x: number; y: number; alpha: number; size: number
  }
  interface RadioBurst {
    x: number; y: number; radius: number; alpha: number
  }
  let starTrails: StarTrail[] = []
  let radioBursts: RadioBurst[] = []
  let mouseX = 0
  let mouseY = 0
  let orbitalRingAlpha = 0

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
    prevIssLat = issLat
    prevIssLon = issLon
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
    // If position actually changed, play a subtle telemetry ping
    if (Math.abs(issLat - prevIssLat) > 0.01 || Math.abs(issLon - prevIssLon) > 0.01) {
      playBeep()
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
        // Data-received ping sound
        playDataReceivedPing()
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

  // --- Audio ---
  async function initAudio() {
    if (audioInitialized) return
    audioInitialized = true
    try {
      const ac = await getAudioContext()
      const dest = getAudioDestination()
      audioCtxRef = ac

      masterVol = ac.createGain()
      masterVol.gain.value = 0
      masterVol.connect(dest)
      masterVol.gain.setTargetAtTime(1, ac.currentTime, 0.8)

      // --- Life support drone: two low detuned sines ---
      droneGain = ac.createGain()
      droneGain.gain.value = 0.025
      const droneLowpass = ac.createBiquadFilter()
      droneLowpass.type = 'lowpass'
      droneLowpass.frequency.value = 160
      droneLowpass.Q.value = 0.7
      droneGain.connect(droneLowpass)
      droneLowpass.connect(masterVol)

      droneOsc1 = ac.createOscillator()
      droneOsc1.type = 'sine'
      droneOsc1.frequency.value = 60
      droneOsc1.connect(droneGain)
      droneOsc1.start()

      droneOsc2 = ac.createOscillator()
      droneOsc2.type = 'sine'
      droneOsc2.frequency.value = 60.4 // slight detune for beating
      droneOsc2.connect(droneGain)
      droneOsc2.start()

      // --- Radar sweep oscillator: slow sweeping sine ---
      sweepGain = ac.createGain()
      sweepGain.gain.value = 0
      const sweepFilter = ac.createBiquadFilter()
      sweepFilter.type = 'bandpass'
      sweepFilter.frequency.value = 800
      sweepFilter.Q.value = 8
      sweepGain.connect(sweepFilter)
      sweepFilter.connect(masterVol)

      sweepOsc = ac.createOscillator()
      sweepOsc.type = 'sine'
      sweepOsc.frequency.value = 600
      sweepOsc.connect(sweepGain)
      sweepOsc.start()

      // LFO to modulate sweep gain (slow pulse)
      sweepLfoGain = ac.createGain()
      sweepLfoGain.gain.value = 0.012
      sweepLfoGain.connect(sweepGain.gain)

      sweepLfo = ac.createOscillator()
      sweepLfo.type = 'sine'
      sweepLfo.frequency.value = 0.15 // one sweep every ~6.7s
      sweepLfo.connect(sweepLfoGain)
      sweepLfo.start()

      // --- Cosmic wind: filtered noise ---
      const windBufLen = ac.sampleRate * 4
      const windBuf = ac.createBuffer(1, windBufLen, ac.sampleRate)
      const windData = windBuf.getChannelData(0)
      for (let i = 0; i < windBufLen; i++) {
        windData[i] = (Math.random() * 2 - 1) * 0.5
      }

      windSource = ac.createBufferSource()
      windSource.buffer = windBuf
      windSource.loop = true

      windFilter = ac.createBiquadFilter()
      windFilter.type = 'lowpass'
      windFilter.frequency.value = 300
      windFilter.Q.value = 0.5

      windGain = ac.createGain()
      windGain.gain.value = 0.008

      windSource.connect(windFilter)
      windFilter.connect(windGain)
      windGain.connect(masterVol)
      windSource.start()

      // --- Telemetry beeps: regular interval ---
      beepInterval = window.setInterval(() => {
        playBeep()
      }, 4000)

      // --- Radio static bursts: irregular ---
      scheduleStaticBurst()

    } catch {
      // Audio may not be available
    }
  }

  function playBeep() {
    if (!audioCtxRef || !masterVol) return
    try {
      const ac = audioCtxRef
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = 1200

      const g = ac.createGain()
      g.gain.setValueAtTime(0, ac.currentTime)
      g.gain.linearRampToValueAtTime(0.03, ac.currentTime + 0.005)
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15)

      osc.connect(g)
      g.connect(masterVol)
      osc.start(ac.currentTime)
      osc.stop(ac.currentTime + 0.15)
    } catch { /* ignore */ }
  }

  function playDataReceivedPing() {
    if (!audioCtxRef || !masterVol) return
    try {
      const ac = audioCtxRef
      // Two-tone ping: ascending pair
      const osc1 = ac.createOscillator()
      osc1.type = 'sine'
      osc1.frequency.value = 880

      const osc2 = ac.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.value = 1320

      const g = ac.createGain()
      g.gain.setValueAtTime(0, ac.currentTime)
      g.gain.linearRampToValueAtTime(0.05, ac.currentTime + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.6)

      osc1.connect(g)
      osc2.connect(g)
      g.connect(masterVol)

      osc1.start(ac.currentTime)
      osc1.stop(ac.currentTime + 0.3)
      osc2.start(ac.currentTime + 0.15)
      osc2.stop(ac.currentTime + 0.6)
    } catch { /* ignore */ }
  }

  function scheduleStaticBurst() {
    if (!active) return
    const delay = 3000 + Math.random() * 8000
    staticInterval = window.setTimeout(() => {
      playStaticBurst()
      scheduleStaticBurst()
    }, delay)
  }

  function playStaticBurst() {
    if (!audioCtxRef || !masterVol) return
    try {
      const ac = audioCtxRef
      const duration = 0.1 + Math.random() * 0.3
      const bufLen = Math.ceil(ac.sampleRate * duration)
      const buf = ac.createBuffer(1, bufLen, ac.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < bufLen; i++) {
        data[i] = (Math.random() * 2 - 1)
      }

      const src = ac.createBufferSource()
      src.buffer = buf

      const filter = ac.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 2000 + Math.random() * 3000
      filter.Q.value = 2

      const g = ac.createGain()
      g.gain.setValueAtTime(0, ac.currentTime)
      g.gain.linearRampToValueAtTime(0.015, ac.currentTime + 0.01)
      g.gain.setValueAtTime(0.015, ac.currentTime + duration * 0.7)
      g.gain.linearRampToValueAtTime(0, ac.currentTime + duration)

      src.connect(filter)
      filter.connect(g)
      g.connect(masterVol)
      src.start(ac.currentTime)
      src.stop(ac.currentTime + duration)
    } catch { /* ignore */ }
  }

  function playClickRadioBurst() {
    if (!audioCtxRef || !masterVol) return
    try {
      const ac = audioCtxRef
      const duration = 0.25
      const bufLen = Math.ceil(ac.sampleRate * duration)
      const buf = ac.createBuffer(1, bufLen, ac.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < bufLen; i++) {
        data[i] = (Math.random() * 2 - 1)
      }

      const src = ac.createBufferSource()
      src.buffer = buf

      const filter = ac.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 1500
      filter.Q.value = 5

      const g = ac.createGain()
      g.gain.setValueAtTime(0, ac.currentTime)
      g.gain.linearRampToValueAtTime(0.04, ac.currentTime + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)

      src.connect(filter)
      filter.connect(g)
      g.connect(masterVol)
      src.start(ac.currentTime)
      src.stop(ac.currentTime + duration)
    } catch { /* ignore */ }
  }

  function stopAudio() {
    if (masterVol && audioCtxRef) {
      masterVol.gain.setTargetAtTime(0, audioCtxRef.currentTime, 0.5)
    }
  }

  function destroyAudio() {
    stopAudio()
    if (beepInterval !== null) { clearInterval(beepInterval); beepInterval = null }
    if (staticInterval !== null) { clearTimeout(staticInterval); staticInterval = null }
    try {
      droneOsc1?.stop(); droneOsc2?.stop()
      sweepOsc?.stop(); sweepLfo?.stop()
      windSource?.stop()
    } catch { /* already stopped */ }
    droneOsc1 = null; droneOsc2 = null; droneGain = null
    sweepOsc = null; sweepGain = null; sweepLfo = null; sweepLfoGain = null
    windSource = null; windGain = null; windFilter = null
    masterVol = null; audioCtxRef = null
    audioInitialized = false
  }

  // --- Visual atmosphere helpers ---
  function initStarField() {
    const w = canvas?.width || window.innerWidth
    const h = canvas?.height || window.innerHeight
    starField = []
    for (let i = 0; i < 150; i++) {
      starField.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.05,
        vy: (Math.random() - 0.5) * 0.05,
        size: Math.random() * 1.2 + 0.3,
        alpha: Math.random() * 0.4 + 0.1,
        twinkleSpeed: Math.random() * 2 + 0.5,
      })
    }
    debris = []
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.15 + Math.random() * 0.3
      debris.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.15 + 0.03,
      })
    }
  }

  function updateAndDrawAtmosphere(c: CanvasRenderingContext2D, w: number, h: number) {
    // --- Star field ---
    for (const star of starField) {
      star.x += star.vx
      star.y += star.vy
      if (star.x < 0) star.x = w
      if (star.x > w) star.x = 0
      if (star.y < 0) star.y = h
      if (star.y > h) star.y = 0

      const twinkle = Math.sin(time * star.twinkleSpeed + star.x * 0.01) * 0.3 + 0.7
      const a = star.alpha * twinkle
      c.fillStyle = `rgba(200, 220, 255, ${a})`
      c.beginPath()
      c.arc(star.x, star.y, star.size, 0, Math.PI * 2)
      c.fill()
    }

    // --- Shooting stars ---
    if (Math.random() < 0.003) {
      const startX = Math.random() * w
      const startY = Math.random() * h * 0.4
      const angle = Math.PI * 0.15 + Math.random() * 0.3
      const speed = 4 + Math.random() * 6
      shootingStars.push({
        x: startX, y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1, maxLife: 1,
        length: 20 + Math.random() * 40,
      })
    }

    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const s = shootingStars[i]
      s.x += s.vx
      s.y += s.vy
      s.life -= 0.02
      if (s.life <= 0 || s.x > w + 50 || s.y > h + 50) {
        shootingStars.splice(i, 1)
        continue
      }
      const tailX = s.x - (s.vx / Math.sqrt(s.vx * s.vx + s.vy * s.vy)) * s.length * s.life
      const tailY = s.y - (s.vy / Math.sqrt(s.vx * s.vx + s.vy * s.vy)) * s.length * s.life
      const grad = c.createLinearGradient(tailX, tailY, s.x, s.y)
      grad.addColorStop(0, `rgba(255, 255, 255, 0)`)
      grad.addColorStop(1, `rgba(255, 255, 255, ${0.6 * s.life})`)
      c.strokeStyle = grad
      c.lineWidth = 1.2
      c.beginPath()
      c.moveTo(tailX, tailY)
      c.lineTo(s.x, s.y)
      c.stroke()
      // Bright head
      c.fillStyle = `rgba(255, 255, 255, ${0.8 * s.life})`
      c.beginPath()
      c.arc(s.x, s.y, 1, 0, Math.PI * 2)
      c.fill()
    }

    // --- Orbital debris ---
    for (const d of debris) {
      d.x += d.vx
      d.y += d.vy
      if (d.x < -10) d.x = w + 10
      if (d.x > w + 10) d.x = -10
      if (d.y < -10) d.y = h + 10
      if (d.y > h + 10) d.y = -10
      c.fillStyle = `rgba(150, 150, 160, ${d.alpha})`
      c.beginPath()
      c.arc(d.x, d.y, d.size, 0, Math.PI * 2)
      c.fill()
    }

    // --- Aurora glow at edges ---
    auroraPhase += 0.005
    // Top edge aurora
    const auroraH = h * 0.12
    const topGrad = c.createLinearGradient(0, 0, 0, auroraH)
    const greenA = 0.015 + Math.sin(auroraPhase) * 0.008
    const purpleA = 0.01 + Math.sin(auroraPhase * 1.3 + 1.5) * 0.006
    topGrad.addColorStop(0, `rgba(80, 220, 120, ${greenA})`)
    topGrad.addColorStop(0.5, `rgba(130, 80, 200, ${purpleA})`)
    topGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    c.fillStyle = topGrad
    c.fillRect(0, 0, w, auroraH)

    // Bottom edge aurora (fainter)
    const botGrad = c.createLinearGradient(0, h, 0, h - auroraH * 0.7)
    const greenB = 0.008 + Math.sin(auroraPhase + 2) * 0.004
    const purpleB = 0.006 + Math.sin(auroraPhase * 0.8 + 3) * 0.003
    botGrad.addColorStop(0, `rgba(80, 220, 120, ${greenB})`)
    botGrad.addColorStop(0.5, `rgba(130, 80, 200, ${purpleB})`)
    botGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    c.fillStyle = botGrad
    c.fillRect(0, h - auroraH * 0.7, w, auroraH * 0.7)

    // Left/right edge shimmer
    const sideW = w * 0.06
    const leftGrad = c.createLinearGradient(0, 0, sideW, 0)
    const sideA = 0.006 + Math.sin(auroraPhase * 0.7 + 1) * 0.003
    leftGrad.addColorStop(0, `rgba(100, 200, 160, ${sideA})`)
    leftGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    c.fillStyle = leftGrad
    c.fillRect(0, 0, sideW, h)

    const rightGrad = c.createLinearGradient(w, 0, w - sideW, 0)
    rightGrad.addColorStop(0, `rgba(100, 200, 160, ${sideA})`)
    rightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    c.fillStyle = rightGrad
    c.fillRect(w - sideW, 0, sideW, h)
  }

  // --- Cursor effects ---
  function updateAndDrawCursorEffects(c: CanvasRenderingContext2D, w: number, h: number) {
    // Star trails from mouse
    for (let i = starTrails.length - 1; i >= 0; i--) {
      const t = starTrails[i]
      t.alpha -= 0.008
      if (t.alpha <= 0) {
        starTrails.splice(i, 1)
        continue
      }
      c.fillStyle = `rgba(220, 230, 255, ${t.alpha})`
      c.beginPath()
      c.arc(t.x, t.y, t.size, 0, Math.PI * 2)
      c.fill()
    }

    // Radio bursts from clicks
    for (let i = radioBursts.length - 1; i >= 0; i--) {
      const b = radioBursts[i]
      b.radius += 3
      b.alpha -= 0.02
      if (b.alpha <= 0) {
        radioBursts.splice(i, 1)
        continue
      }
      c.strokeStyle = `rgba(100, 200, 255, ${b.alpha * 0.5})`
      c.lineWidth = 1.5
      c.beginPath()
      c.arc(b.x, b.y, b.radius, 0, Math.PI * 2)
      c.stroke()
      // Inner ring
      if (b.radius > 8) {
        c.strokeStyle = `rgba(100, 200, 255, ${b.alpha * 0.2})`
        c.lineWidth = 0.5
        c.beginPath()
        c.arc(b.x, b.y, b.radius * 0.6, 0, Math.PI * 2)
        c.stroke()
      }
    }

    // Orbital ring effect near ISS icon
    if (canvas) {
      const issP = project(issLat, issLon, w, h)
      const dx = mouseX - issP.x
      const dy = mouseY - issP.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const targetAlpha = dist < 60 ? Math.max(0, 1 - dist / 60) * 0.3 : 0
      orbitalRingAlpha += (targetAlpha - orbitalRingAlpha) * 0.08

      if (orbitalRingAlpha > 0.005) {
        const ringAngle = time * 0.8
        c.strokeStyle = `rgba(255, 215, 0, ${orbitalRingAlpha})`
        c.lineWidth = 0.8
        c.save()
        c.translate(issP.x, issP.y)
        c.rotate(ringAngle)
        c.beginPath()
        c.ellipse(0, 0, 20, 8, 0, 0, Math.PI * 2)
        c.stroke()
        // Second ring at different angle
        c.rotate(Math.PI / 3)
        c.strokeStyle = `rgba(255, 215, 0, ${orbitalRingAlpha * 0.6})`
        c.beginPath()
        c.ellipse(0, 0, 18, 7, 0, 0, Math.PI * 2)
        c.stroke()
        c.restore()
      }
    }
  }

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

    // Visual atmosphere: star field, shooting stars, debris, aurora
    updateAndDrawAtmosphere(c, w, h)

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

        c.font = '11px monospace'
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
    c.font = '12px monospace'
    c.fillStyle = 'rgba(255, 215, 0, 0.12)'
    c.textAlign = 'left'
    c.fillText(`iss: ${issLat.toFixed(2)}°N ${issLon.toFixed(2)}°E`, 12, h - 42)
    c.fillText(`altitude: ~420 km`, 12, h - 30)
    c.fillText(`${beacons.filter(b => !b.received).length} signals awaiting reception`, 12, h - 18)

    // Title
    c.font = '12px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(255, 215, 0, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.fillText('the satellite', w / 2, 25)

    // Stats
    c.font = '12px monospace'
    c.fillStyle = 'rgba(255, 215, 0, 0.08)'
    c.textAlign = 'right'
    c.fillText(`${totalReceived} transmissions received`, w - 12, h - 18)

    // No memories hint
    if (beacons.length === 0) {
      c.font = '12px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(255, 215, 0, 0.1)'
      c.textAlign = 'center'
      c.fillText('no signals to receive', w / 2, h * 0.88)
      c.font = '12px "Cormorant Garamond", serif'
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

    // Cursor interactivity effects (star trails, radio bursts, orbital ring)
    updateAndDrawCursorEffects(c, w, h)

    // Context
    c.font = '12px "Cormorant Garamond", serif'
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

      // Landmark click navigation + radio burst visual/audio
      canvas.addEventListener('click', (e) => {
        // Radio burst visual + sound on any click
        radioBursts.push({ x: e.clientX, y: e.clientY, radius: 2, alpha: 0.8 })
        playClickRadioBurst()

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

      // Landmark hover detection + star trail creation
      canvas.addEventListener('mousemove', (e) => {
        mouseX = e.clientX
        mouseY = e.clientY

        // Star trail: tiny bright points that linger
        if (Math.random() < 0.4) {
          starTrails.push({
            x: e.clientX + (Math.random() - 0.5) * 6,
            y: e.clientY + (Math.random() - 0.5) * 6,
            alpha: 0.3 + Math.random() * 0.3,
            size: Math.random() * 1.2 + 0.3,
          })
        }
        // Cap star trails
        if (starTrails.length > 120) starTrails.splice(0, starTrails.length - 120)

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

    async activate() {
      active = true
      issTrail = []
      totalReceived = 0
      receivedMessage = null
      starTrails = []
      radioBursts = []
      shootingStars = []
      orbitalRingAlpha = 0
      placeBeacons()
      initStarField()
      fetchISS()
      // Fetch ISS position every 5 seconds
      fetchInterval = window.setInterval(fetchISS, 5000)
      render()
      // Initialize audio (requires user gesture, handled by AudioBus)
      await initAudio()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      if (fetchInterval) clearInterval(fetchInterval)
      fetchInterval = null
      stopAudio()
      if (beepInterval !== null) { clearInterval(beepInterval); beepInterval = null }
      if (staticInterval !== null) { clearTimeout(staticInterval); staticInterval = null }
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      if (fetchInterval) clearInterval(fetchInterval)
      fetchInterval = null
      destroyAudio()
      starField = []
      shootingStars = []
      debris = []
      starTrails = []
      radioBursts = []
      overlay?.remove()
    },
  }
}
