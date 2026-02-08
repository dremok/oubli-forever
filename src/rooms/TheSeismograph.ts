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
 * Data refreshes every 5 minutes from USGS FDSNWS query API (with fallback
 * to the summary feed). Place names fade in and drift near their epicenters.
 * Magnitude drives visual intensity — larger quakes produce bigger ripples,
 * stronger glows, and screen-shake effects.
 *
 * Completely independent of the memory system.
 *
 * Inspired by: seismology, Richter scale, plate tectonics,
 * the earth as a living organism, how the ground beneath us
 * is never really still
 */

import type { Room } from './RoomManager'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

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

/** A place-name label that fades in, lingers, then fades out near its quake */
interface FadingLabel {
  text: string
  x: number
  y: number
  mag: number
  depth: number
  alpha: number       // current opacity (0..1)
  phase: 'in' | 'hold' | 'out'
  phaseTimer: number  // seconds remaining in current phase
  driftY: number      // slow upward drift offset
}

const CULTURAL_INSCRIPTIONS = [
  'the earth\'s crust is 5-70km thick. beneath it, the mantle moves at 2cm per year. patience as geology.',
  'the 2011 tōhoku earthquake shifted earth\'s axis by 17cm. the planet tilted and forgot its angle.',
  'seismographs were invented in 132 AD by zhang heng. a bronze vessel with dragon mouths that caught bronze balls.',
  'nikola tesla once accidentally triggered an earthquake in manhattan. resonance as accidental violence.',
  'the deepest earthquake ever recorded: 735km below the sea of okhotsk. the earth groans from within.',
  'plate tectonics wasn\'t accepted until the 1960s. for decades, geologists argued the continents didn\'t move.',
  'every earthquake is the earth adjusting its memory. stress accumulates, then releases.',
  'the cascadia subduction zone last ruptured in 1700. the indigenous peoples of the northwest coast remember.',
  'moonquakes last up to an hour. on earth, tremors fade in minutes. the moon holds its grief longer.',
  'a hidden geometry bends electrons like gravity bends light. invisible forces warping the space of memory.',
  'colorado mountains bare of snow in february 2026. the landscape is forgetting winter.',
  'virtual particles emerge from nothing — quantum twins with perfect spin correlation. the void is never empty.',
  'an annular eclipse over antarctica, february 17. a ring of fire witnessed by sixteen scientists and penguins.',
  'ruthenium molecules that act as memory, logic, or learning — materials that think like brains.',
  'the doomsday clock reads 85 seconds to midnight. the earth trembles not just from below.',
  'iñárritu resurrected a million feet of discarded film. what was cut is never truly gone.',
  'the polar vortex splits in two, february 2026. the atmosphere\'s protective memory fracturing.',
  'seven thousand atoms held in quantum superposition. the largest schrödinger\'s cat ever — memory in two states at once.',
  'CRISPR reactivates silenced memory genes in aging brains. what was forgotten can be switched back on.',
  'a molecular sensor eavesdrops on the brain\'s synaptic whispers. we can finally hear neurons remembering.',
]

// Simplified continent outlines (lat, lon pairs) — just enough to be recognizable
const CONTINENTS: [number, number][][] = [
  // North America
  [[72,-168],[72,-140],[70,-100],[60,-95],[55,-75],[50,-58],[45,-65],[43,-70],[30,-82],[25,-80],[18,-88],
   [15,-85],[10,-84],[8,-77],[15,-92],[17,-100],[22,-105],[30,-115],[35,-120],[48,-125],[55,-130],
   [58,-138],[60,-145],[65,-168]],
  // South America
  [[12,-72],[8,-60],[2,-50],[-5,-35],[-10,-37],[-18,-40],[-23,-42],[-33,-52],[-42,-64],[-55,-68],
   [-56,-66],[-52,-70],[-46,-75],[-40,-73],[-30,-71],[-18,-70],[-5,-80],[5,-77],[10,-72]],
  // Africa
  [[37,-10],[37,10],[32,32],[30,33],[22,37],[12,44],[5,42],[0,42],[-5,40],[-12,40],[-20,35],[-26,33],
   [-34,26],[-35,18],[-34,18],[-28,16],[-18,12],[-8,13],[0,10],[5,1],[5,-5],[10,-14],[15,-17],
   [20,-17],[22,-16],[25,-15],[30,-10],[35,-5],[37,-3]],
  // Europe
  [[40,-10],[44,-8],[46,-2],[48,2],[51,2],[53,5],[55,8],[56,10],[58,10],[60,5],[63,6],[65,13],
   [70,20],[71,28],[70,30],[65,28],[60,30],[56,22],[54,14],[51,14],[48,16],[45,14],[44,12],[42,15],
   [40,18],[38,24],[36,22],[36,28],[39,26],[42,28],[44,26],[45,12],[43,3],[41,-5],[38,-8]],
  // Asia (mainland)
  [[42,30],[45,40],[48,45],[50,55],[55,60],[58,60],[60,68],[62,75],[65,78],[68,85],[70,100],[72,120],
   [72,140],[70,165],[68,170],[65,180],[62,170],[58,160],[56,140],[52,136],[50,132],[46,142],[44,145],
   [42,140],[38,138],[35,136],[32,132],[30,122],[22,108],[20,106],[10,106],[8,100],[6,100],
   [8,98],[14,99],[22,90],[25,88],[22,72],[25,62],[28,56],[26,50],[30,48],[33,44],[36,36],[40,30]],
  // Australia
  [[-12,130],[-14,137],[-18,146],[-24,152],[-28,154],[-34,151],[-38,146],[-37,140],[-35,137],
   [-32,132],[-28,114],[-22,114],[-15,125],[-12,130]],
  // Greenland
  [[76,-72],[78,-56],[80,-40],[82,-30],[82,-20],[80,-18],[76,-22],[72,-25],[68,-28],[65,-42],
   [68,-53],[72,-56],[75,-64]],
  // Antarctica (partial)
  [[-65,-60],[-68,-60],[-70,-30],[-70,0],[-70,30],[-70,60],[-68,80],[-70,100],[-70,130],[-70,160],
   [-70,180],[-70,-170],[-70,-140],[-70,-120],[-68,-90],[-65,-60]],
]

/** P-wave ripple from a new earthquake */
interface Pwave {
  x: number; y: number
  radius: number
  maxRadius: number
  alpha: number
  speed: number  // pixels per frame
}

/** Micro-tremor visual noise dot */
interface MicroTremor {
  x: number; y: number
  alpha: number
  life: number
}

// Primary: USGS FDSNWS query API (20 most recent quakes, no key needed, CORS-friendly)
const FDSNWS_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=20&orderby=time'
// Fallback: summary feed (all quakes in last 24h)
const FALLBACK_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'

const CACHE_DURATION_MS = 5 * 60 * 1000 // 5 minutes

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
  let hoveredStation = -1
  let inscriptionTimer = 0
  let inscriptionIdx = 0
  let mouseX = 0
  let mouseY = 0
  let fadingLabels: FadingLabel[] = []
  let screenShake = 0  // decaying screen-shake intensity from large quakes
  let isFetching = false
  let needleWobble = 0 // micro-vibration phase for seismograph needle
  let pwaves: Pwave[] = []
  let microTremors: MicroTremor[] = []
  let hoveredQuake: Quake | null = null
  let lastMicroTremorTime = 0

  // --- Audio state ---
  let audioCtxRef: AudioContext | null = null
  let audioInitialized = false
  let masterVol: GainNode | null = null

  // Earth drone (continuous low hum)
  let droneOsc: OscillatorNode | null = null
  let droneGain: GainNode | null = null
  let droneLowpass: BiquadFilterNode | null = null

  // Seismograph scratch (continuous needle-on-paper noise)
  let scratchSource: AudioBufferSourceNode | null = null
  let scratchGain: GainNode | null = null
  let scratchBandpass: BiquadFilterNode | null = null

  // Pending rumble timeouts (for cleanup)
  const rumbleTimeouts: number[] = []

  async function initAudio() {
    if (audioInitialized) return
    try {
      const ac = await getAudioContext()
      const dest = getAudioDestination()
      audioCtxRef = ac
      audioInitialized = true

      // Master volume for this room
      masterVol = ac.createGain()
      masterVol.gain.setValueAtTime(0, ac.currentTime)
      masterVol.gain.linearRampToValueAtTime(1, ac.currentTime + 1)
      masterVol.connect(dest)

      // --- Earth drone: sine at 25Hz, lowpass 60Hz ---
      droneOsc = ac.createOscillator()
      droneOsc.type = 'sine'
      droneOsc.frequency.setValueAtTime(25, ac.currentTime)

      droneLowpass = ac.createBiquadFilter()
      droneLowpass.type = 'lowpass'
      droneLowpass.frequency.setValueAtTime(60, ac.currentTime)

      droneGain = ac.createGain()
      droneGain.gain.setValueAtTime(0.01, ac.currentTime)

      droneOsc.connect(droneLowpass)
      droneLowpass.connect(droneGain)
      droneGain.connect(masterVol)
      droneOsc.start(ac.currentTime)

      // --- Seismograph scratch: filtered noise ---
      const scratchBufferLength = ac.sampleRate * 2
      const scratchBuffer = ac.createBuffer(1, scratchBufferLength, ac.sampleRate)
      const scratchData = scratchBuffer.getChannelData(0)
      for (let i = 0; i < scratchBufferLength; i++) {
        scratchData[i] = Math.random() * 2 - 1
      }

      scratchSource = ac.createBufferSource()
      scratchSource.buffer = scratchBuffer
      scratchSource.loop = true

      scratchBandpass = ac.createBiquadFilter()
      scratchBandpass.type = 'bandpass'
      scratchBandpass.frequency.setValueAtTime(2000, ac.currentTime) // center of 1500-3000
      scratchBandpass.Q.setValueAtTime(0.5, ac.currentTime)

      scratchGain = ac.createGain()
      scratchGain.gain.setValueAtTime(0.005, ac.currentTime)

      scratchSource.connect(scratchBandpass)
      scratchBandpass.connect(scratchGain)
      scratchGain.connect(masterVol)
      scratchSource.start(ac.currentTime)
    } catch {
      // Audio not ready yet — user hasn't interacted
    }
  }

  /** Play a rumble when an earthquake ring expands — proportional to magnitude */
  function playQuakeRumble(mag: number) {
    if (!audioCtxRef || !masterVol) return
    try {
      const ac = audioCtxRef

      // Brown noise (random walk) via buffer
      const duration = mag * 0.2 // magnitude * 200ms
      const sampleLen = Math.max(1, Math.floor(ac.sampleRate * duration))
      const buffer = ac.createBuffer(1, sampleLen, ac.sampleRate)
      const data = buffer.getChannelData(0)
      let last = 0
      for (let i = 0; i < sampleLen; i++) {
        const white = Math.random() * 2 - 1
        last = (last + (0.02 * white)) / 1.02
        data[i] = last * 3.5 // normalize brown noise amplitude
      }

      const source = ac.createBufferSource()
      source.buffer = buffer

      const lowpass = ac.createBiquadFilter()
      lowpass.type = 'lowpass'
      lowpass.frequency.setValueAtTime(mag * 50 + 100, ac.currentTime)

      // Gain scales with magnitude: 0.005 at M1, up to 0.04 at M9
      const gain = ac.createGain()
      const vol = Math.min(0.04, Math.max(0.005, 0.005 + (mag - 1) * 0.00438))
      gain.gain.setValueAtTime(0, ac.currentTime)
      gain.gain.linearRampToValueAtTime(vol, ac.currentTime + 0.02)
      gain.gain.linearRampToValueAtTime(0, ac.currentTime + duration)

      source.connect(lowpass)
      lowpass.connect(gain)
      gain.connect(masterVol)

      source.start(ac.currentTime)
      source.stop(ac.currentTime + duration + 0.05)

      // Cleanup nodes after playback
      const tid = window.setTimeout(() => {
        try {
          source.disconnect()
          lowpass.disconnect()
          gain.disconnect()
        } catch { /* already disconnected */ }
      }, (duration + 0.5) * 1000)
      rumbleTimeouts.push(tid)
    } catch { /* audio error */ }
  }

  /** Play a sonar ping when new earthquake data arrives */
  function playDataPing() {
    if (!audioCtxRef || !masterVol) return
    try {
      const ac = audioCtxRef

      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, ac.currentTime)

      const gain = ac.createGain()
      gain.gain.setValueAtTime(0, ac.currentTime)
      gain.gain.linearRampToValueAtTime(0.02, ac.currentTime + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.1)

      osc.connect(gain)
      gain.connect(masterVol)

      osc.start(ac.currentTime)
      osc.stop(ac.currentTime + 0.15)
    } catch { /* audio error */ }
  }

  function stopAudio() {
    if (masterVol && audioCtxRef) {
      masterVol.gain.setTargetAtTime(0, audioCtxRef.currentTime, 0.3)
    }
  }

  function destroyAudio() {
    stopAudio()
    // Clear rumble timeouts
    for (const tid of rumbleTimeouts) clearTimeout(tid)
    rumbleTimeouts.length = 0
    try {
      droneOsc?.stop()
      scratchSource?.stop()
    } catch { /* already stopped */ }
    try {
      droneOsc?.disconnect()
      droneLowpass?.disconnect()
      droneGain?.disconnect()
      scratchSource?.disconnect()
      scratchBandpass?.disconnect()
      scratchGain?.disconnect()
      masterVol?.disconnect()
    } catch { /* already disconnected */ }
    droneOsc = null
    droneLowpass = null
    droneGain = null
    scratchSource = null
    scratchBandpass = null
    scratchGain = null
    masterVol = null
    audioCtxRef = null
    audioInitialized = false
  }

  /** Spawn P-wave ripples from newly arrived quakes */
  function spawnPwaves(newQuakes: Quake[]) {
    // Only spawn for significant quakes (M2+), limit to 5
    const significant = newQuakes.filter(q => q.mag >= 2).slice(0, 5)
    for (const q of significant) {
      pwaves.push({
        x: q.x, y: q.y,
        radius: 0,
        maxRadius: 80 + q.mag * 30,
        alpha: 0.15 + q.mag * 0.02,
        speed: 1.5 + q.mag * 0.3,
      })
    }
  }

  /** Draw simplified continent shapes as subtle filled polygons */
  function drawContinents(c: CanvasRenderingContext2D, w: number, h: number) {
    const alpha = 0.04 + Math.sin(time * 0.15) * 0.005
    c.fillStyle = `rgba(40, 80, 40, ${alpha})`
    c.strokeStyle = `rgba(60, 100, 60, ${alpha * 1.5})`
    c.lineWidth = 0.5

    for (const continent of CONTINENTS) {
      c.beginPath()
      for (let i = 0; i < continent.length; i++) {
        const [lat, lon] = continent[i]
        const [x, y] = latLonToScreen(lat, lon, w, h)
        if (i === 0) c.moveTo(x, y)
        else c.lineTo(x, y)
      }
      c.closePath()
      c.fill()
      c.stroke()
    }
  }

  /** Draw and update P-wave propagation ripples */
  function drawPwaves(c: CanvasRenderingContext2D) {
    for (let i = pwaves.length - 1; i >= 0; i--) {
      const pw = pwaves[i]
      pw.radius += pw.speed
      const t = pw.radius / pw.maxRadius
      const a = pw.alpha * (1 - t) * (1 - t)

      if (pw.radius >= pw.maxRadius || a < 0.001) {
        pwaves.splice(i, 1)
        continue
      }

      // P-wave (fast, tight)
      c.strokeStyle = `rgba(60, 200, 255, ${a})`
      c.lineWidth = 1.5
      c.beginPath()
      c.arc(pw.x, pw.y, pw.radius, 0, Math.PI * 2)
      c.stroke()

      // S-wave (slower, behind P-wave)
      const sRadius = pw.radius * 0.6
      if (sRadius > 3) {
        c.strokeStyle = `rgba(255, 140, 60, ${a * 0.7})`
        c.lineWidth = 1
        c.beginPath()
        c.arc(pw.x, pw.y, sRadius, 0, Math.PI * 2)
        c.stroke()
      }
    }
  }

  /** Draw micro-tremor noise dots across the map */
  function drawMicroTremors(c: CanvasRenderingContext2D, w: number, h: number) {
    const mapX = w * 0.08
    const mapY = h * 0.06
    const mapW = w * 0.84
    const mapH = h * 0.58

    // Spawn new micro-tremors periodically
    if (time - lastMicroTremorTime > 0.08) {
      lastMicroTremorTime = time
      if (microTremors.length < 30) {
        microTremors.push({
          x: mapX + Math.random() * mapW,
          y: mapY + Math.random() * mapH,
          alpha: 0.03 + Math.random() * 0.06,
          life: 0.3 + Math.random() * 0.6,
        })
      }
    }

    // Draw and decay
    for (let i = microTremors.length - 1; i >= 0; i--) {
      const mt = microTremors[i]
      mt.life -= 0.016
      if (mt.life <= 0) {
        microTremors.splice(i, 1)
        continue
      }
      const fadeAlpha = mt.alpha * Math.min(1, mt.life * 3)
      c.fillStyle = `rgba(40, 255, 80, ${fadeAlpha})`
      c.fillRect(mt.x, mt.y, 1, 1)
    }
  }

  /** Draw depth cross-section panel on right side */
  function drawDepthSection(c: CanvasRenderingContext2D, w: number, h: number) {
    const panelX = w - 60
    const panelY = h * 0.08
    const panelW = 40
    const panelH = h * 0.52
    const maxDepth = 700 // km

    // Panel background
    c.fillStyle = 'rgba(5, 10, 5, 0.4)'
    c.fillRect(panelX, panelY, panelW, panelH)
    c.strokeStyle = 'rgba(40, 80, 40, 0.08)'
    c.strokeRect(panelX, panelY, panelW, panelH)

    // Depth scale labels
    c.font = '8px monospace'
    c.fillStyle = 'rgba(40, 255, 80, 0.1)'
    c.textAlign = 'center'
    const depths = [0, 100, 300, 500, 700]
    for (const d of depths) {
      const y = panelY + (d / maxDepth) * panelH
      c.fillText(`${d}km`, panelX + panelW / 2, y - 2)
      c.strokeStyle = 'rgba(40, 80, 40, 0.04)'
      c.beginPath()
      c.moveTo(panelX, y)
      c.lineTo(panelX + panelW, y)
      c.stroke()
    }

    // Plot quakes as dots at their depth
    for (const q of quakes) {
      const y = panelY + Math.min(q.depth, maxDepth) / maxDepth * panelH
      const x = panelX + 5 + Math.random() * (panelW - 10) // jitter horizontally
      const size = Math.max(1.5, q.mag * 0.5)
      const pulse = Math.sin(time * 1.5 + q.pulsePhase) * 0.2 + 0.8
      c.fillStyle = depthColor(q.depth, 0.3 * pulse)
      c.beginPath()
      c.arc(x, y, size, 0, Math.PI * 2)
      c.fill()
    }

    // Panel title
    c.save()
    c.translate(panelX - 4, panelY + panelH / 2)
    c.rotate(-Math.PI / 2)
    c.font = '9px monospace'
    c.fillStyle = 'rgba(40, 255, 80, 0.08)'
    c.textAlign = 'center'
    c.fillText('depth cross-section', 0, 0)
    c.restore()
  }

  // Earthquake epicenter navigation stations — placed at real-world coordinates
  const stations = [
    { label: 'automaton', room: 'automaton', lat: 35.68, lon: 139.69, illumination: 0 },   // Tokyo — Ring of Fire
    { label: 'asteroids', room: 'asteroids', lat: 21.3, lon: -89.5, illumination: 0 },      // Chicxulub crater
    { label: 'weathervane', room: 'weathervane', lat: 64.13, lon: -21.9, illumination: 0 },  // Reykjavik, Iceland
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

  /** Parse a USGS GeoJSON response into Quake objects */
  function parseGeoJSON(data: any, w: number, h: number): Quake[] {
    if (!data || !Array.isArray(data.features)) return []
    return data.features.slice(0, 200).map((f: any) => {
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
  }

  /** Build fading labels from the quake list (significant quakes only) */
  function buildFadingLabels(quakeList: Quake[]) {
    // Pick quakes with magnitude >= 2.5 for labels, limit to 8 to avoid clutter
    const significant = quakeList
      .filter(q => q.mag >= 2.5 && q.place !== 'unknown')
      .slice(0, 8)

    fadingLabels = significant.map(q => ({
      text: `M${q.mag.toFixed(1)} ${q.place}`,
      x: q.x,
      y: q.y,
      mag: q.mag,
      depth: q.depth,
      alpha: 0,
      phase: 'in' as const,
      // Stagger entry: higher magnitude quakes appear sooner
      phaseTimer: 1.5 + (8 - q.mag) * 0.3,
      driftY: 0,
    }))

    // Trigger screen-shake proportional to the largest quake magnitude
    const maxMag = quakeList.reduce((m, q) => Math.max(m, q.mag), 0)
    if (maxMag >= 4) {
      screenShake = Math.min((maxMag - 3) * 2, 12)
    }

    // Play rumbles for significant quakes (staggered)
    for (let i = 0; i < significant.length; i++) {
      const q = significant[i]
      const delay = i * 300 // stagger rumbles 300ms apart
      const tid = window.setTimeout(() => playQuakeRumble(q.mag), delay)
      rumbleTimeouts.push(tid)
    }
  }

  async function fetchQuakes() {
    // Skip if already fetching or data is still fresh
    if (isFetching) return
    if (lastFetch > 0 && Date.now() - lastFetch < CACHE_DURATION_MS) return

    isFetching = true
    const hadData = quakes.length > 0
    if (!hadData) loading = true
    fetchError = false

    if (!canvas) { isFetching = false; return }
    const w = canvas.width
    const h = canvas.height

    // Try primary FDSNWS endpoint first
    let parsed: Quake[] = []
    try {
      const resp = await fetch(FDSNWS_URL)
      if (!resp.ok) throw new Error(`FDSNWS status ${resp.status}`)
      const data = await resp.json()
      parsed = parseGeoJSON(data, w, h)
    } catch {
      // Primary failed — try fallback summary feed
      try {
        const resp2 = await fetch(FALLBACK_URL)
        if (!resp2.ok) throw new Error(`Fallback status ${resp2.status}`)
        const data2 = await resp2.json()
        parsed = parseGeoJSON(data2, w, h)
      } catch {
        // Both failed
        fetchError = true
        loading = false
        isFetching = false
        return
      }
    }

    if (parsed.length > 0) {
      quakes = parsed
      buildFadingLabels(parsed)
      spawnPwaves(parsed)
      // Build trace from magnitudes (simulate seismograph needle)
      traceData = quakes.slice(0, 100).map(q => q.mag).reverse()
      lastFetch = Date.now()
      // Sonar ping: new data received
      playDataPing()
    }

    loading = false
    isFetching = false
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
    // Very faint — alpha 0.02-0.03, suggesting hidden structure
    const plateAlpha = 0.02 + Math.sin(time * 0.2) * 0.005
    ctx.strokeStyle = `rgba(120, 40, 30, ${plateAlpha})`
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
      // East African Rift
      [[12, 42], [8, 38], [2, 36], [-4, 35], [-10, 34], [-15, 35]],
      // San Andreas / North American west coast
      [[62, -150], [58, -136], [50, -130], [42, -125], [37, -122], [32, -117]],
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

    // Update needle micro-wobble (the earth is never truly still)
    needleWobble += 0.016

    const step = traceW / traceData.length

    // Build trace path points once, reuse for glow + crisp passes
    const tracePoints: { x: number; y: number }[] = []
    for (let i = 0; i < traceData.length; i++) {
      const x = traceX + i * step
      const mag = traceData[i]
      // Jitter/noise + constant micro-vibration (earth is never still)
      const noise = Math.sin(time * 3 + i * 0.5) * 2 + Math.sin(time * 7.3 + i * 1.2) * 1
      const wobble = Math.sin(needleWobble * 11.3 + i * 0.3) * 0.6
        + Math.sin(needleWobble * 17.7 + i * 0.7) * 0.3
      const deflection = (mag / 9) * (traceH * 0.45) + noise + wobble
      tracePoints.push({ x, y: centerY - deflection })
    }

    // Pass 1: Phosphor glow (wider, lower alpha, amber-green)
    ctx.strokeStyle = 'rgba(60, 255, 100, 0.12)'
    ctx.lineWidth = 4
    ctx.beginPath()
    for (let i = 0; i < tracePoints.length; i++) {
      if (i === 0) ctx.moveTo(tracePoints[i].x, tracePoints[i].y)
      else ctx.lineTo(tracePoints[i].x, tracePoints[i].y)
    }
    ctx.stroke()

    // Pass 2: Crisp trace on top
    ctx.strokeStyle = 'rgba(40, 255, 80, 0.5)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let i = 0; i < tracePoints.length; i++) {
      if (i === 0) ctx.moveTo(tracePoints[i].x, tracePoints[i].y)
      else ctx.lineTo(tracePoints[i].x, tracePoints[i].y)
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
    ctx.font = '12px monospace'
    ctx.fillStyle = 'rgba(40, 255, 80, 0.15)'
    ctx.textAlign = 'left'
    ctx.fillText('seismograph trace — last 24h magnitudes', traceX + 6, traceY + 12)
  }

  /** Animate and draw fading place-name labels near their epicenters */
  function drawFadingLabels(c: CanvasRenderingContext2D, _w: number, _h: number) {
    const dt = 0.016 // approx frame time

    for (let i = fadingLabels.length - 1; i >= 0; i--) {
      const lbl = fadingLabels[i]

      // Update phase timer and alpha
      lbl.phaseTimer -= dt
      if (lbl.phase === 'in') {
        lbl.alpha = Math.min(1, lbl.alpha + dt * 0.8)
        if (lbl.phaseTimer <= 0) {
          lbl.phase = 'hold'
          lbl.phaseTimer = 3 + lbl.mag * 0.5 // hold longer for bigger quakes
        }
      } else if (lbl.phase === 'hold') {
        lbl.alpha = 1
        if (lbl.phaseTimer <= 0) {
          lbl.phase = 'out'
          lbl.phaseTimer = 2
        }
      } else if (lbl.phase === 'out') {
        lbl.alpha = Math.max(0, lbl.alpha - dt * 0.5)
        if (lbl.alpha <= 0) {
          // Restart cycle with a pause
          lbl.phase = 'in'
          lbl.phaseTimer = 4 + Math.random() * 6
          lbl.alpha = 0
          lbl.driftY = 0
          continue
        }
      }

      // Slow upward drift
      lbl.driftY -= dt * 3

      // Compute final alpha scaled by magnitude (bigger = more visible)
      const magScale = Math.min(1, 0.3 + (lbl.mag / 8) * 0.7)
      const finalAlpha = lbl.alpha * magScale * 0.6

      if (finalAlpha < 0.01) continue

      // Draw label text
      const fontSize = Math.max(8, Math.min(13, 8 + lbl.mag * 0.6))
      c.font = `${fontSize}px "Cormorant Garamond", serif`
      c.textAlign = 'center'
      c.fillStyle = depthColor(lbl.depth, finalAlpha)

      const labelY = lbl.y - magToSize(lbl.mag) * 2 - 6 + lbl.driftY
      c.fillText(lbl.text, lbl.x, labelY)
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height

    // Screen-shake offset (decays over time)
    let shakeX = 0
    let shakeY = 0
    if (screenShake > 0.1) {
      shakeX = (Math.random() - 0.5) * screenShake
      shakeY = (Math.random() - 0.5) * screenShake
      screenShake *= 0.95
    } else {
      screenShake = 0
    }

    ctx.save()
    ctx.translate(shakeX, shakeY)

    // Clear
    ctx.fillStyle = 'rgba(5, 8, 5, 1)'
    ctx.fillRect(-shakeX, -shakeY, w, h)

    // World outline + continents
    drawWorldOutline(ctx, w, h)
    drawContinents(ctx, w, h)
    drawMicroTremors(ctx, w, h)

    // Draw quakes
    for (const q of quakes) {
      const size = magToSize(q.mag)
      const pulse = Math.sin(time * 1.5 + q.pulsePhase) * 0.3 + 0.7

      // Expanding ring — speed and max radius scale with magnitude
      const ringSpeed = 0.02 + q.mag * 0.005
      const ringMaxRadius = size * (3 + q.mag * 0.5)
      q.ringRadius += ringSpeed
      if (q.ringRadius > ringMaxRadius) {
        q.ringRadius = 0
        q.ringAlpha = 0.5
      }
      if (q.ringRadius > 0) {
        ctx.strokeStyle = depthColor(q.depth, q.ringAlpha * 0.3 * pulse)
        ctx.lineWidth = q.mag >= 5 ? 2 : 1
        ctx.beginPath()
        ctx.arc(q.x, q.y, q.ringRadius, 0, Math.PI * 2)
        ctx.stroke()
        q.ringAlpha *= 0.995

        // Extra concentric rings for M5+ quakes
        if (q.mag >= 5) {
          const ring2 = q.ringRadius * 0.6
          ctx.strokeStyle = depthColor(q.depth, q.ringAlpha * 0.15 * pulse)
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(q.x, q.y, ring2, 0, Math.PI * 2)
          ctx.stroke()
        }
        // Third ring for M6+
        if (q.mag >= 6) {
          const ring3 = q.ringRadius * 0.35
          ctx.strokeStyle = depthColor(q.depth, q.ringAlpha * 0.1 * pulse)
          ctx.beginPath()
          ctx.arc(q.x, q.y, ring3, 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      // Core dot — size proportional to magnitude
      ctx.fillStyle = depthColor(q.depth, 0.4 + pulse * 0.3)
      ctx.beginPath()
      ctx.arc(q.x, q.y, size * pulse, 0, Math.PI * 2)
      ctx.fill()

      // Glow for larger quakes — radius scales with magnitude
      if (q.mag >= 3) {
        const glowRadius = size * (2 + q.mag * 0.4)
        const glowIntensity = Math.min(0.2, 0.05 + (q.mag - 3) * 0.03)
        const glow = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, glowRadius)
        glow.addColorStop(0, depthColor(q.depth, glowIntensity * pulse))
        glow.addColorStop(1, 'transparent')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(q.x, q.y, glowRadius, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Draw fading place-name labels
    drawFadingLabels(ctx, w, h)

    // P-wave / S-wave propagation ripples
    drawPwaves(ctx)

    // Depth cross-section
    drawDepthSection(ctx, w, h)

    // Seismograph trace
    drawSeismographTrace(ctx, w, h)

    // Hover tooltip for nearest quake
    if (hoveredQuake) {
      const hq = hoveredQuake
      const tipX = hq.x + 15
      const tipY = hq.y - 15

      // Background
      ctx.fillStyle = 'rgba(5, 10, 5, 0.7)'
      ctx.fillRect(tipX - 4, tipY - 14, 180, 46)
      ctx.strokeStyle = 'rgba(40, 255, 80, 0.15)'
      ctx.strokeRect(tipX - 4, tipY - 14, 180, 46)

      ctx.font = '11px "Cormorant Garamond", serif'
      ctx.textAlign = 'left'
      ctx.fillStyle = depthColor(hq.depth, 0.7)
      ctx.fillText(`M${hq.mag.toFixed(1)} — ${hq.place}`, tipX, tipY)
      ctx.fillStyle = 'rgba(40, 255, 80, 0.4)'
      ctx.fillText(`depth: ${hq.depth.toFixed(1)}km · ${timeAgo(hq.time)}`, tipX, tipY + 14)
      const energy = Math.pow(10, 1.5 * hq.mag + 4.8)
      const energyStr = energy > 1e12 ? `${(energy / 1e12).toFixed(1)} TJ` :
        energy > 1e9 ? `${(energy / 1e9).toFixed(1)} GJ` :
        energy > 1e6 ? `${(energy / 1e6).toFixed(1)} MJ` : `${energy.toFixed(0)} J`
      ctx.fillText(`energy: ~${energyStr}`, tipX, tipY + 28)
    }

    // Selected quake info
    if (selectedQuake) {
      const sq = selectedQuake
      ctx.font = '13px "Cormorant Garamond", serif'
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

    ctx.font = '12px monospace'
    ctx.fillStyle = 'rgba(40, 255, 80, 0.12)'
    ctx.textAlign = 'left'
    ctx.fillText(`${totalQuakes} earthquakes · real-time USGS data`, 12, h - 30)
    ctx.fillText(`max M${maxMag.toFixed(1)}`, 12, h - 18)

    ctx.textAlign = 'right'
    const mins = Math.floor((Date.now() - lastFetch) / 60000)
    ctx.fillText(`updated ${mins}m ago`, w - 12, h - 30)
    ctx.fillText('usgs.gov', w - 12, h - 18)

    // Title
    ctx.font = '12px "Cormorant Garamond", serif'
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

    // Earthquake epicenter navigation stations
    if (deps?.switchTo) {
      // Update station illumination based on nearby quakes
      for (const stn of stations) {
        let nearbyEnergy = 0
        for (const q of quakes) {
          const dLat = q.lat - stn.lat
          const dLon = q.lon - stn.lon
          const dist = Math.sqrt(dLat * dLat + dLon * dLon)
          if (dist < 15) {
            // Closer + bigger quakes = more energy
            const proximity = 1 - dist / 15
            nearbyEnergy += proximity * (q.mag / 9) * 0.4
          }
        }
        // Smoothly approach target illumination, decay when no quakes nearby
        const target = Math.min(nearbyEnergy, 0.5)
        stn.illumination += (target - stn.illumination) * 0.02
        if (stn.illumination < 0.001) stn.illumination = 0
      }

      for (let i = 0; i < stations.length; i++) {
        const stn = stations[i]
        const [sx, sy] = latLonToScreen(stn.lat, stn.lon, w, h)
        const hovered = hoveredStation === i
        const illum = stn.illumination
        const baseAlpha = 0.03
        const alpha = hovered ? Math.max(illum, 0.35) : Math.max(illum, baseAlpha)

        // Pulsing ring when illuminated
        if (illum > 0.05) {
          const ringPulse = Math.sin(time * 2 + i * 2.1) * 0.5 + 0.5
          const ringR = 8 + ringPulse * 12
          ctx.strokeStyle = `rgba(40, 255, 80, ${illum * 0.4 * ringPulse})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(sx, sy, ringR, 0, Math.PI * 2)
          ctx.stroke()

          // Second outer ring, offset phase
          const ringPulse2 = Math.sin(time * 2 + i * 2.1 + Math.PI) * 0.5 + 0.5
          const ringR2 = 14 + ringPulse2 * 10
          ctx.strokeStyle = `rgba(40, 255, 80, ${illum * 0.2 * ringPulse2})`
          ctx.beginPath()
          ctx.arc(sx, sy, ringR2, 0, Math.PI * 2)
          ctx.stroke()
        }

        // Mini seismograph waveform icon (3-4 tiny oscillating lines)
        ctx.strokeStyle = `rgba(40, 255, 80, ${alpha})`
        ctx.lineWidth = 1
        const waveW = 16
        const waveH = 6
        for (let line = 0; line < 4; line++) {
          ctx.beginPath()
          const ly = sy - waveH + line * (waveH * 2 / 3)
          for (let px = 0; px < waveW; px++) {
            const freq = 3 + line * 1.5
            const amp = (illum > 0.05 ? illum * 4 : 0.3) * (1 + Math.sin(line * 1.7))
            const val = Math.sin((time * freq) + px * 0.8 + line * 1.2 + i * 3) * amp
            const x = sx - waveW / 2 + px
            const y = ly + val
            if (px === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.stroke()
        }

        // Center dot
        ctx.fillStyle = `rgba(40, 255, 80, ${alpha * 1.5})`
        ctx.beginPath()
        ctx.arc(sx, sy, 2, 0, Math.PI * 2)
        ctx.fill()

        // Glow halo when illuminated or hovered
        if (illum > 0.05 || hovered) {
          const glowAlpha = hovered ? 0.12 : illum * 0.15
          const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 20)
          glow.addColorStop(0, `rgba(40, 255, 80, ${glowAlpha})`)
          glow.addColorStop(1, 'transparent')
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(sx, sy, 20, 0, Math.PI * 2)
          ctx.fill()
        }

        // Room label on hover
        if (hovered) {
          ctx.font = '12px monospace'
          ctx.fillStyle = `rgba(40, 255, 80, 0.6)`
          ctx.textAlign = 'center'
          ctx.fillText(stn.label, sx, sy - 18)
          if (illum <= 0.05) {
            ctx.font = '7px monospace'
            ctx.fillStyle = `rgba(40, 255, 80, 0.25)`
            ctx.fillText('(dormant)', sx, sy + 22)
          }
        }
      }
    }

    // Depth legend
    ctx.font = '11px monospace'
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

    ctx.restore()

    // Cultural inscription
    inscriptionTimer += 0.016
    if (inscriptionTimer >= 25) {
      inscriptionTimer = 0
      inscriptionIdx = (inscriptionIdx + 1) % CULTURAL_INSCRIPTIONS.length
    }
    const insText = CULTURAL_INSCRIPTIONS[inscriptionIdx]
    ctx.font = '11px "Cormorant Garamond", serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(40, 255, 80, 0.035)'
    const insMaxW = w * 0.8
    const insWords = insText.split(' ')
    const insLines: string[] = []
    let insLine = ''
    for (const word of insWords) {
      const test = insLine ? insLine + ' ' + word : word
      if (ctx.measureText(test).width > insMaxW) { insLines.push(insLine); insLine = word }
      else insLine = test
    }
    if (insLine) insLines.push(insLine)
    for (let li = 0; li < insLines.length; li++) {
      ctx.fillText(insLines[li], w / 2, h - 50 + li * 14)
    }

    // Refresh data every 5 minutes (respects cache)
    if (Date.now() - lastFetch > CACHE_DURATION_MS) {
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
    const w = canvas.width
    const h = canvas.height

    // Check epicenter station clicks FIRST
    if (deps?.switchTo) {
      for (const stn of stations) {
        const [sx, sy] = latLonToScreen(stn.lat, stn.lon, w, h)
        const dx = x - sx
        const dy = y - sy
        if (dx * dx + dy * dy < 625 && stn.illumination > 0.05) {  // 25px radius, must be illuminated
          deps.switchTo(stn.room)
          return
        }
      }
    }

    // Fall through to quake selection
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

      // Epicenter station + quake hover detection
      canvas.addEventListener('mousemove', (e) => {
        if (!canvas) return
        mouseX = e.clientX
        mouseY = e.clientY
        const w = canvas.width
        const h = canvas.height
        hoveredStation = -1
        hoveredQuake = null
        canvas.style.cursor = 'crosshair'

        // Check navigation stations first
        for (let i = 0; i < stations.length; i++) {
          const [sx, sy] = latLonToScreen(stations[i].lat, stations[i].lon, w, h)
          const dx = mouseX - sx
          const dy = mouseY - sy
          if (dx * dx + dy * dy < 625) {  // 25px radius
            hoveredStation = i
            canvas.style.cursor = 'pointer'
            return
          }
        }

        // Check quake proximity for tooltip
        let closestDist = Infinity
        for (const q of quakes) {
          const dx = q.x - mouseX
          const dy = q.y - mouseY
          const dist = dx * dx + dy * dy
          if (dist < 900 && dist < closestDist) {  // 30px radius
            closestDist = dist
            hoveredQuake = q
          }
        }
        if (hoveredQuake) canvas.style.cursor = 'pointer'
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
          // Recalculate fading label positions from their associated quakes
          for (const lbl of fadingLabels) {
            // Find matching quake by text prefix to update x/y
            const matchingQuake = quakes.find(q =>
              lbl.text === `M${q.mag.toFixed(1)} ${q.place}`
            )
            if (matchingQuake) {
              lbl.x = matchingQuake.x
              lbl.y = matchingQuake.y
            }
          }
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)
      return overlay
    },

    activate() {
      active = true
      // fetchQuakes respects the 5-min cache internally, safe to call every activate
      fetchQuakes()
      initAudio()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      stopAudio()
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      destroyAudio()
      overlay?.remove()
    },
  }
}
