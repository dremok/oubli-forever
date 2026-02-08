/**
 * THE GLACARIUM — memories frozen in ice
 *
 * Inspired by the record-low Arctic sea ice extent of February 2026.
 * Your memories crystallize as ice formations on a dark ocean — but
 * the warming world melts them. Degraded memories drip and dissolve.
 *
 * INTERACTIVE: Your cursor radiates warmth — ice crystals near it
 * melt faster and glow. Click a crystal to expand and read the full
 * memory. The Arctic is a visceral metaphor: as the ice goes,
 * so do your memories.
 *
 * SPACE WEATHER: Real-time NOAA planetary K-index drives the aurora
 * display. Quiet geomagnetic conditions produce faint shimmer; storms
 * unleash vivid curtains of color and shake the glacarium itself.
 *
 * USES MEMORIES. Data-driven. Climate-aware. Space-weather-aware.
 *
 * Inspired by: Olafur Eliasson's Ice Watch, Arctic sea ice decline,
 * cryosphere science, frozen memories thawing, Svalbard Seed Vault,
 * NOAA Space Weather Prediction Center
 */

import { getAudioContext, getAudioDestination } from '../sound/AudioBus'
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
  switchTo?: (name: string) => void
}

interface IceCrystal {
  x: number
  y: number
  memory: Memory
  width: number
  height: number
  facets: { x: number; y: number; w: number; h: number; angle: number }[]
  meltProgress: number
  drips: { x: number; y: number; vy: number; alpha: number }[]
  shimmer: number
  warmth: number // 0-1, how much cursor heat this crystal has absorbed
  expanded: boolean
  expandProgress: number // 0-1 animation
}

// --- Kp index types and cache ---
interface KpCache {
  kp: number
  label: string
  fetchedAt: number
}

const KP_CACHE_MS = 15 * 60 * 1000 // 15 minutes

function kpLabel(kp: number): string {
  if (kp <= 1) return 'quiet skies'
  if (kp <= 2) return 'calm geomagnetic field'
  if (kp <= 3) return 'slight unrest'
  if (kp <= 4) return 'unsettled conditions'
  if (kp <= 5) return 'minor geomagnetic storm'
  if (kp <= 6) return 'geomagnetic storm'
  if (kp <= 7) return 'strong geomagnetic storm'
  if (kp <= 8) return 'severe geomagnetic storm'
  return 'extreme geomagnetic storm'
}

export function createGlaciariumRoom(deps: GlaciariumDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let crystals: IceCrystal[] = []
  let oceanLevel = 0.7
  let seaIceExtent = 14.0
  let meltRate = 1.0
  let waterDrops: { x: number; y: number; vy: number; alpha: number }[] = []

  // Mouse state
  let mouseX = 0
  let mouseY = 0

  // Audio (routed through shared AudioBus)
  let audioCtx: AudioContext | null = null
  let audioDest: AudioNode | null = null
  let windGain: GainNode | null = null
  let subBassGain: GainNode | null = null
  let iceGroanGain: GainNode | null = null
  let iceGroanFilter: BiquadFilterNode | null = null
  let sizzleGain: GainNode | null = null
  let sizzleFilter: BiquadFilterNode | null = null
  let sizzleSource: AudioBufferSourceNode | null = null
  let crackTimeout: ReturnType<typeof setTimeout> | null = null
  let audioInitialized = false

  // Steam particles (warmth near crystals)
  let steamParticles: { x: number; y: number; vy: number; vx: number; alpha: number; size: number }[] = []

  // Cultural inscriptions
  const INSCRIPTIONS = [
    'arctic sea ice has lost 13% per decade since satellites began watching',
    'svalbard seed vault: 1.3 million samples. the memory of agriculture, frozen at -18\u00B0C',
    'olafur eliasson brought 30 blocks of greenland glacier ice to london. they melted in three days.',
    'the oldest ice core is 2.7 million years old. it remembers an atmosphere we\u2019ve already forgotten.',
    'permafrost thaws and releases methane \u2014 the earth forgetting to hold its breath',
    'the doomsday clock reads 85 seconds to midnight. the closest it has ever been.',
    '7,000 atoms placed in quantum superposition \u2014 the largest schr\u00F6dinger\u2019s cat ever observed',
    'in some materials, electrons stop being particles. topology persists after identity dissolves.',
    'february 17, 2026: a ring of fire over antarctica. an eclipse that only penguins will witness.',
    'snow drought: colorado and utah at record-low snowpack. the mountains forgot how to hold winter.',
  ]
  let inscriptionIndex = 0
  let inscriptionTimer = 0
  const INSCRIPTION_CYCLE_S = 25

  const NORMAL_FEB_EXTENT = 14.5
  const RECORD_LOW_2026 = 13.2

  // --- Space weather (Kp index) state ---
  let currentKp = 1 // fallback: quiet
  let kpStatusText = ''
  let kpCache: KpCache | null = null
  // Smoothed Kp for visual transitions (avoids jarring jumps)
  let smoothKp = 1
  // Screen shake state for Kp 7+
  let shakeX = 0
  let shakeY = 0
  // Ice crack lines that appear during storms
  let stormCracks: { x1: number; y1: number; x2: number; y2: number; alpha: number }[] = []

  // Navigation portals — ice pillars
  const portals: { name: string; label: string; x: number; y: number; r: number; color: string; hovered: boolean }[] = []

  function buildPortals() {
    if (!canvas) return
    const w = canvas.width
    const h = canvas.height
    const waterY = h * (1 - oceanLevel)

    portals.length = 0
    portals.push(
      // Frozen light pillar — satellite (sky)
      { name: 'satellite', label: 'a frozen signal rises toward orbit', x: w * 0.85, y: waterY * 0.15, r: 6, color: '180, 220, 255', hovered: false },
      // Ice formation — weathervane (horizon)
      { name: 'weathervane', label: 'an ice vane turns on the horizon', x: w * 0.12, y: waterY - 15, r: 8, color: '200, 210, 240', hovered: false },
      // Frozen tidepool (below ice shelf)
      { name: 'tidepool', label: 'a frozen pool glimmers beneath the ice', x: w * 0.7, y: waterY + 50, r: 20, color: '100, 180, 220', hovered: false },
      // Ice shard — asteroids (sky)
      { name: 'asteroids', label: 'an ice shard catches starlight', x: w * 0.45, y: waterY * 0.08, r: 5, color: '220, 200, 255', hovered: false },
    )
  }

  async function fetchKpIndex(): Promise<void> {
    // Check cache
    if (kpCache && Date.now() - kpCache.fetchedAt < KP_CACHE_MS) {
      currentKp = kpCache.kp
      kpStatusText = `Kp ${kpCache.kp} — ${kpCache.label}`
      return
    }

    try {
      const resp = await fetch(
        'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
        { signal: AbortSignal.timeout(6000) }
      )
      if (!resp.ok) throw new Error('fetch failed')

      const data: string[][] = await resp.json()
      // data[0] is header row; last entry is the most recent
      if (data.length < 2) throw new Error('no data')

      const latest = data[data.length - 1]
      // latest[1] is Kp value (string like "3.00")
      const kpRaw = parseFloat(latest[1])
      if (isNaN(kpRaw)) throw new Error('invalid kp')

      const kp = Math.max(0, Math.min(9, Math.round(kpRaw)))
      currentKp = kp
      kpStatusText = `Kp ${kp} — ${kpLabel(kp)}`

      kpCache = { kp, label: kpLabel(kp), fetchedAt: Date.now() }
    } catch {
      // Fallback: keep whatever we had (default 1 = quiet)
      if (!kpStatusText) {
        kpStatusText = `Kp ${currentKp} — ${kpLabel(currentKp)}`
      }
    }
  }

  async function fetchSeaIceData() {
    try {
      const resp = await fetch('https://noaadata.apps.nsidc.org/NOAA/G02135/seaice_analysis/Sea_Ice_Index_Regional_Daily_Data_G02135_v3.0.xlsx', {
        signal: AbortSignal.timeout(5000),
      })
      if (!resp.ok) throw new Error('fetch failed')
      throw new Error('use fallback')
    } catch {
      seaIceExtent = RECORD_LOW_2026
      meltRate = 1 + (NORMAL_FEB_EXTENT - seaIceExtent) / NORMAL_FEB_EXTENT * 3
    }
  }

  async function initAudio() {
    if (audioInitialized) return
    audioInitialized = true
    try {
      audioCtx = await getAudioContext()
      audioDest = getAudioDestination()

      // --- 1. Wind — filtered white noise ---
      const bufferSize = audioCtx.sampleRate * 2
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
      const noiseSamples = noiseBuffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        noiseSamples[i] = (Math.random() * 2 - 1) * 0.3
      }
      const noise = audioCtx.createBufferSource()
      noise.buffer = noiseBuffer
      noise.loop = true

      const windFilter = audioCtx.createBiquadFilter()
      windFilter.type = 'bandpass'
      windFilter.frequency.value = 300
      windFilter.Q.value = 0.5

      windGain = audioCtx.createGain()
      windGain.gain.value = 0

      noise.connect(windFilter)
      windFilter.connect(windGain)
      windGain.connect(audioDest)
      noise.start()

      windGain.gain.linearRampToValueAtTime(0.025, audioCtx.currentTime + 3)

      // --- 2. Sub-bass pressure drone: 2 detuned sines (55Hz + 55.3Hz) ---
      const subOsc1 = audioCtx.createOscillator()
      subOsc1.type = 'sine'
      subOsc1.frequency.value = 55

      const subOsc2 = audioCtx.createOscillator()
      subOsc2.type = 'sine'
      subOsc2.frequency.value = 55.3

      subBassGain = audioCtx.createGain()
      subBassGain.gain.value = 0

      subOsc1.connect(subBassGain)
      subOsc2.connect(subBassGain)
      subBassGain.connect(audioDest)
      subOsc1.start()
      subOsc2.start()

      subBassGain.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + 4)

      // --- 3. Ice groaning texture: brown noise through tight bandpass at 200Hz, LFO-modulated ---
      const brownBuf = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
      const brownSamples = brownBuf.getChannelData(0)
      let lastBrown = 0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        lastBrown = (lastBrown + 0.02 * white) / 1.02
        brownSamples[i] = lastBrown * 3.5
      }
      const brownNoise = audioCtx.createBufferSource()
      brownNoise.buffer = brownBuf
      brownNoise.loop = true

      iceGroanFilter = audioCtx.createBiquadFilter()
      iceGroanFilter.type = 'bandpass'
      iceGroanFilter.frequency.value = 200
      iceGroanFilter.Q.value = 8

      // LFO to modulate the bandpass frequency slowly
      const groanLfo = audioCtx.createOscillator()
      groanLfo.type = 'sine'
      groanLfo.frequency.value = 0.08
      const groanLfoGain = audioCtx.createGain()
      groanLfoGain.gain.value = 60
      groanLfo.connect(groanLfoGain)
      groanLfoGain.connect(iceGroanFilter.frequency)
      groanLfo.start()

      iceGroanGain = audioCtx.createGain()
      iceGroanGain.gain.value = 0

      brownNoise.connect(iceGroanFilter)
      iceGroanFilter.connect(iceGroanGain)
      iceGroanGain.connect(audioDest)
      brownNoise.start()

      iceGroanGain.gain.linearRampToValueAtTime(0.02, audioCtx.currentTime + 5)

      // --- 4. Sizzle sound (cursor near crystals) — always-running filtered noise, gain controlled per frame ---
      const sizzleBuf = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
      const sizzleSamples = sizzleBuf.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        sizzleSamples[i] = (Math.random() * 2 - 1)
      }
      sizzleSource = audioCtx.createBufferSource()
      sizzleSource.buffer = sizzleBuf
      sizzleSource.loop = true

      sizzleFilter = audioCtx.createBiquadFilter()
      sizzleFilter.type = 'highpass'
      sizzleFilter.frequency.value = 3000
      sizzleFilter.Q.value = 1

      sizzleGain = audioCtx.createGain()
      sizzleGain.gain.value = 0

      sizzleSource.connect(sizzleFilter)
      sizzleFilter.connect(sizzleGain)
      sizzleGain.connect(audioDest)
      sizzleSource.start()

      // Schedule periodic ice crack sounds
      scheduleIceCrack()
    } catch {
      // Audio not available
    }
  }

  function scheduleIceCrack() {
    if (!active) return
    // More frequent cracks during geomagnetic storms
    const stormFactor = Math.max(1, smoothKp / 3)
    const delay = (4000 + Math.random() * 12000) / stormFactor
    crackTimeout = setTimeout(() => {
      playIceCrack()
      scheduleIceCrack()
    }, delay)
  }

  function playIceCrack() {
    if (!audioCtx || !audioDest || !active) return
    const now = audioCtx.currentTime
    const osc = audioCtx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(800 + Math.random() * 400, now)
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15)

    // Louder cracks during storms
    const volume = 0.03 + Math.max(0, (smoothKp - 5) / 4) * 0.04
    const gain = audioCtx.createGain()
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)

    const filter = audioCtx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 200

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(audioDest)
    osc.start(now)
    osc.stop(now + 0.25)
  }

  function buildCrystals() {
    if (!canvas) return
    const memories = deps.getMemories()
    const w = canvas.width
    const h = canvas.height
    const waterY = h * (1 - oceanLevel)

    crystals = []
    if (memories.length === 0) return

    const maxCrystals = Math.min(memories.length, 12)
    const spacing = (w - 100) / maxCrystals

    for (let i = 0; i < maxCrystals; i++) {
      const mem = memories[i]
      const cx = 50 + spacing * i + spacing / 2
      const crystalH = 40 + (1 - mem.degradation) * 80
      const crystalW = 20 + (1 - mem.degradation) * 40

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
        warmth: 0,
        expanded: false,
        expandProgress: 0,
      })
    }

    buildPortals()
  }

  function handleMouseMove(e: MouseEvent) {
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    mouseX = (e.clientX - rect.left) * (canvas.width / rect.width)
    mouseY = (e.clientY - rect.top) * (canvas.height / rect.height)

    // Check portal hover
    for (const p of portals) {
      const dx = mouseX - p.x
      const dy = mouseY - p.y
      p.hovered = Math.sqrt(dx * dx + dy * dy) < p.r + 15
    }

    // Check crystal hover — change cursor
    let overCrystal = false
    for (const crystal of crystals) {
      const dx = mouseX - crystal.x
      const dy = mouseY - (crystal.y - crystal.height * (1 - crystal.meltProgress) * 0.5)
      if (Math.abs(dx) < crystal.width && Math.abs(dy) < crystal.height * 0.6) {
        overCrystal = true
        break
      }
    }

    if (canvas) {
      canvas.style.cursor = overCrystal || portals.some(p => p.hovered)
        ? 'pointer' : 'default'
    }
  }

  function handleClick(e: MouseEvent) {
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cx = (e.clientX - rect.left) * (canvas.width / rect.width)
    const cy = (e.clientY - rect.top) * (canvas.height / rect.height)

    // Check portal clicks
    for (const p of portals) {
      const dx = cx - p.x
      const dy = cy - p.y
      if (Math.sqrt(dx * dx + dy * dy) < p.r + 15 && deps.switchTo) {
        deps.switchTo(p.name)
        return
      }
    }

    // Check crystal clicks
    for (const crystal of crystals) {
      const dx = cx - crystal.x
      const dy = cy - (crystal.y - crystal.height * (1 - crystal.meltProgress) * 0.5)
      if (Math.abs(dx) < crystal.width * 1.2 && Math.abs(dy) < crystal.height * 0.7) {
        // Toggle expansion
        crystal.expanded = !crystal.expanded
        // Collapse all others
        for (const other of crystals) {
          if (other !== crystal) other.expanded = false
        }
        return
      }
    }

    // Click empty space -> collapse all
    for (const crystal of crystals) crystal.expanded = false
  }

  // --- Aurora rendering driven by Kp ---
  function renderAurora(c: CanvasRenderingContext2D, w: number, waterY: number) {
    const kp = smoothKp

    if (kp < 0.5) {
      // Nearly invisible shimmer
      const auroraY = waterY * 0.3
      const faintAlpha = 0.01 + Math.sin(time * 0.2) * 0.005
      const grad = c.createRadialGradient(w * 0.5, auroraY, 0, w * 0.5, auroraY, 100)
      grad.addColorStop(0, `rgba(100, 200, 150, ${faintAlpha})`)
      grad.addColorStop(1, 'transparent')
      c.fillStyle = grad
      c.beginPath()
      c.ellipse(w * 0.5, auroraY, 120, 30, 0, 0, Math.PI * 2)
      c.fill()
      return
    }

    // Number of aurora bands scales with Kp
    const bandCount = kp <= 2 ? 2 : kp <= 4 ? 4 : kp <= 6 ? 6 : 8
    // Speed scales with Kp
    const speed = 0.08 + kp * 0.03
    // Height coverage scales with Kp
    const heightFraction = kp <= 2 ? 0.15 : kp <= 4 ? 0.3 : kp <= 6 ? 0.5 : 0.7
    // Alpha intensity scales with Kp
    const baseIntensity = kp <= 2 ? 0.015 : kp <= 4 ? 0.04 : kp <= 6 ? 0.08 : 0.14
    // Vertical spread
    const vSpread = kp <= 2 ? 25 : kp <= 4 ? 45 : kp <= 6 ? 70 : 100

    for (let i = 0; i < bandCount; i++) {
      const phase = i * 1.7 + time * speed
      const ax = w * (0.1 + 0.8 * ((i / bandCount + Math.sin(phase) * 0.15 + 1) % 1))
      const ay = waterY * (0.1 + heightFraction * (0.3 + 0.5 * Math.sin(time * 0.1 + i * 2.3)))

      // Color depends on Kp level
      let hue: number
      let sat: number
      let light: number
      if (kp <= 2) {
        // Faint green
        hue = 120 + Math.sin(time * 0.15 + i) * 10
        sat = 40
        light = 30
      } else if (kp <= 4) {
        // Green-blue curtains
        hue = 140 + i * 20 + Math.sin(time * 0.2 + i) * 15
        sat = 55
        light = 35
      } else if (kp <= 6) {
        // Vivid purples, greens, reds
        hue = 80 + i * 40 + Math.sin(time * 0.25 + i * 1.5) * 30
        sat = 65
        light = 40
      } else {
        // Intense storm — rapid color cycling, wide spectrum
        hue = (time * 20 + i * 50) % 360
        sat = 75
        light = 45
      }

      const intensity = baseIntensity + Math.sin(time * 0.3 + i * 2) * baseIntensity * 0.5
      const spreadX = 80 + kp * 20 + i * 15

      const grad = c.createRadialGradient(ax, ay, 0, ax, ay, spreadX)
      grad.addColorStop(0, `hsla(${hue}, ${sat}%, ${light}%, ${intensity})`)
      grad.addColorStop(0.6, `hsla(${hue + 20}, ${sat - 10}%, ${light - 5}%, ${intensity * 0.4})`)
      grad.addColorStop(1, 'transparent')
      c.fillStyle = grad
      c.beginPath()
      c.ellipse(ax, ay, spreadX, vSpread, 0.1 * Math.sin(time * 0.15 + i), 0, Math.PI * 2)
      c.fill()

      // Vertical curtain lines for Kp >= 3
      if (kp >= 3) {
        const curtainCount = kp <= 4 ? 3 : kp <= 6 ? 6 : 10
        for (let j = 0; j < curtainCount; j++) {
          const cx2 = ax - spreadX * 0.6 + (spreadX * 1.2 * j / curtainCount)
          const curtainH = vSpread * (1.5 + Math.sin(time * 0.4 + j * 0.7 + i) * 0.5)
          const curtainAlpha = intensity * (0.3 + Math.sin(time * 0.5 + j + i) * 0.15)
          c.strokeStyle = `hsla(${hue + j * 5}, ${sat}%, ${light + 10}%, ${curtainAlpha})`
          c.lineWidth = kp >= 7 ? 2.5 : kp >= 5 ? 1.5 : 0.8
          c.beginPath()
          c.moveTo(cx2, ay - curtainH * 0.5)
          c.quadraticCurveTo(
            cx2 + Math.sin(time * 0.3 + j) * 8,
            ay,
            cx2 + Math.sin(time * 0.2 + j * 1.3) * 5,
            ay + curtainH * 0.5
          )
          c.stroke()
        }
      }
    }

    // Kp 7+ : broad sky-wide color wash
    if (kp >= 7) {
      const washHue = (time * 15) % 360
      const washAlpha = 0.03 + (kp - 7) * 0.015 + Math.sin(time * 0.5) * 0.01
      const skyGrad2 = c.createLinearGradient(0, 0, 0, waterY)
      skyGrad2.addColorStop(0, `hsla(${washHue}, 60%, 30%, ${washAlpha})`)
      skyGrad2.addColorStop(0.5, `hsla(${washHue + 60}, 50%, 25%, ${washAlpha * 0.5})`)
      skyGrad2.addColorStop(1, 'transparent')
      c.fillStyle = skyGrad2
      c.fillRect(0, 0, w, waterY)
    }
  }

  // --- Portal rendering as ice formations / frozen light pillars ---
  function renderPortals(c: CanvasRenderingContext2D) {
    for (const p of portals) {
      const pulse = Math.sin(time * 1.5 + p.x * 0.01) * 0.3 + 0.5
      const baseAlpha = p.hovered ? 0.5 : 0.12 * pulse
      // Aurora tint on portals during storms
      const stormTint = smoothKp >= 5 ? Math.sin(time * 0.8 + p.x * 0.005) * 0.1 : 0

      if (p.name === 'satellite') {
        // Frozen light pillar rising from ice into sky
        const pillarH = p.hovered ? 60 : 35
        const pillarW = p.hovered ? 6 : 3

        // Vertical light pillar
        const pillarGrad = c.createLinearGradient(p.x, p.y + pillarH * 0.3, p.x, p.y - pillarH * 0.7)
        pillarGrad.addColorStop(0, `rgba(${p.color}, ${baseAlpha * 0.2})`)
        pillarGrad.addColorStop(0.4, `rgba(${p.color}, ${baseAlpha})`)
        pillarGrad.addColorStop(0.8, `rgba(${p.color}, ${baseAlpha * 0.6})`)
        pillarGrad.addColorStop(1, 'transparent')
        c.fillStyle = pillarGrad
        c.beginPath()
        c.moveTo(p.x - pillarW, p.y + pillarH * 0.3)
        c.lineTo(p.x - pillarW * 0.3, p.y - pillarH * 0.7)
        c.lineTo(p.x + pillarW * 0.3, p.y - pillarH * 0.7)
        c.lineTo(p.x + pillarW, p.y + pillarH * 0.3)
        c.closePath()
        c.fill()

        // Bright core
        c.fillStyle = `rgba(220, 240, 255, ${baseAlpha * 0.4})`
        c.beginPath()
        c.arc(p.x, p.y, p.r * (p.hovered ? 1.5 : 0.8), 0, Math.PI * 2)
        c.fill()

        // Blinking satellite dot at top
        const blink = Math.sin(time * 3) > 0.3 ? 0.6 : 0.1
        c.fillStyle = `rgba(255, 255, 255, ${blink * (p.hovered ? 1 : 0.5)})`
        c.beginPath()
        c.arc(p.x, p.y - pillarH * 0.6, 1.5, 0, Math.PI * 2)
        c.fill()

        if (p.hovered) {
          c.font = '12px "Cormorant Garamond", serif'
          c.fillStyle = `rgba(${p.color}, 0.5)`
          c.textAlign = 'center'
          c.fillText(p.label, p.x, p.y + pillarH * 0.3 + 18)
        }
      } else if (p.name === 'asteroids') {
        // Ice shard / frozen prism catching light
        const shardH = p.hovered ? 28 : 16
        const shardW = p.hovered ? 8 : 4

        // Prismatic ice shard
        c.save()
        c.translate(p.x, p.y)
        c.rotate(0.3 + Math.sin(time * 0.2) * 0.1)

        // Shard body
        c.beginPath()
        c.moveTo(0, -shardH * 0.6)
        c.lineTo(shardW, 0)
        c.lineTo(shardW * 0.3, shardH * 0.4)
        c.lineTo(-shardW * 0.3, shardH * 0.4)
        c.lineTo(-shardW, 0)
        c.closePath()
        c.fillStyle = `rgba(${p.color}, ${baseAlpha * 0.4 + stormTint})`
        c.fill()
        c.strokeStyle = `rgba(${p.color}, ${baseAlpha * 0.6})`
        c.lineWidth = 0.5
        c.stroke()

        // Rainbow refraction for storm conditions
        if (smoothKp >= 5) {
          const refractAlpha = (smoothKp - 4) / 5 * baseAlpha * 0.3
          const refractGrad = c.createLinearGradient(-shardW, -shardH * 0.3, shardW * 2, shardH * 0.2)
          refractGrad.addColorStop(0, `rgba(255, 100, 100, ${refractAlpha})`)
          refractGrad.addColorStop(0.5, `rgba(100, 255, 100, ${refractAlpha})`)
          refractGrad.addColorStop(1, `rgba(100, 100, 255, ${refractAlpha})`)
          c.fillStyle = refractGrad
          c.fill()
        }

        c.restore()

        if (p.hovered) {
          c.font = '12px "Cormorant Garamond", serif'
          c.fillStyle = `rgba(${p.color}, 0.5)`
          c.textAlign = 'center'
          c.fillText(p.label, p.x, p.y + shardH * 0.4 + 18)
        }
      } else if (p.name === 'weathervane') {
        // Ice formation on horizon — jagged frozen pillar with wind direction
        const pillarH = p.hovered ? 40 : 25
        const pillarW = p.hovered ? 10 : 6

        c.save()
        c.translate(p.x, p.y)

        // Jagged ice pillar
        c.beginPath()
        c.moveTo(-pillarW * 0.5, 0)
        c.lineTo(-pillarW * 0.3, -pillarH * 0.3)
        c.lineTo(-pillarW * 0.6, -pillarH * 0.5)
        c.lineTo(-pillarW * 0.15, -pillarH * 0.65)
        c.lineTo(0, -pillarH)
        c.lineTo(pillarW * 0.2, -pillarH * 0.7)
        c.lineTo(pillarW * 0.5, -pillarH * 0.55)
        c.lineTo(pillarW * 0.3, -pillarH * 0.3)
        c.lineTo(pillarW * 0.5, 0)
        c.closePath()
        c.fillStyle = `rgba(${p.color}, ${baseAlpha * 0.3 + stormTint})`
        c.fill()
        c.strokeStyle = `rgba(${p.color}, ${baseAlpha * 0.5})`
        c.lineWidth = 0.5
        c.stroke()

        // Internal fracture lines
        c.strokeStyle = `rgba(${p.color}, ${baseAlpha * 0.2})`
        c.lineWidth = 0.3
        c.beginPath()
        c.moveTo(-pillarW * 0.2, -pillarH * 0.2)
        c.lineTo(pillarW * 0.1, -pillarH * 0.5)
        c.stroke()
        c.beginPath()
        c.moveTo(pillarW * 0.15, -pillarH * 0.15)
        c.lineTo(-pillarW * 0.1, -pillarH * 0.4)
        c.stroke()

        // Wind direction indicator — ice crystal at top
        const windAngle = time * 0.5
        c.save()
        c.translate(0, -pillarH)
        c.rotate(windAngle)
        c.strokeStyle = `rgba(${p.color}, ${baseAlpha * 0.7})`
        c.lineWidth = p.hovered ? 1.5 : 0.8
        c.beginPath()
        c.moveTo(-6, 0)
        c.lineTo(6, 0)
        c.moveTo(4, -2)
        c.lineTo(6, 0)
        c.lineTo(4, 2)
        c.stroke()
        c.restore()

        c.restore()

        if (p.hovered) {
          c.font = '12px "Cormorant Garamond", serif'
          c.fillStyle = `rgba(${p.color}, 0.5)`
          c.textAlign = 'center'
          c.fillText(p.label, p.x, p.y + 15)
        }
      } else if (p.name === 'tidepool') {
        // Frozen tidepool — cracked ice disc with light underneath
        const poolRx = p.r * (p.hovered ? 2 : 1.5)
        const poolRy = p.r * (p.hovered ? 0.8 : 0.6)

        // Glow from beneath the ice
        const underGlow = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, poolRx)
        underGlow.addColorStop(0, `rgba(${p.color}, ${(baseAlpha * 0.4) + stormTint})`)
        underGlow.addColorStop(0.6, `rgba(${p.color}, ${baseAlpha * 0.15})`)
        underGlow.addColorStop(1, 'transparent')
        c.fillStyle = underGlow
        c.beginPath()
        c.ellipse(p.x, p.y, poolRx, poolRy, 0, 0, Math.PI * 2)
        c.fill()

        // Ice surface
        c.strokeStyle = `rgba(200, 230, 255, ${baseAlpha * 0.4})`
        c.lineWidth = 0.5
        c.beginPath()
        c.ellipse(p.x, p.y, poolRx * 0.9, poolRy * 0.9, 0, 0, Math.PI * 2)
        c.stroke()

        // Crack lines across the frozen surface
        c.strokeStyle = `rgba(180, 220, 255, ${baseAlpha * 0.25})`
        c.lineWidth = 0.4
        for (let ci = 0; ci < 3; ci++) {
          const angle = ci * 1.2 + 0.3
          c.beginPath()
          c.moveTo(p.x - Math.cos(angle) * poolRx * 0.6, p.y - Math.sin(angle) * poolRy * 0.4)
          c.lineTo(p.x + Math.cos(angle + 0.5) * poolRx * 0.5, p.y + Math.sin(angle + 0.8) * poolRy * 0.3)
          c.stroke()
        }

        if (p.hovered) {
          c.font = '12px "Cormorant Garamond", serif'
          c.fillStyle = `rgba(${p.color}, 0.5)`
          c.textAlign = 'center'
          c.fillText(p.label, p.x, p.y + poolRy + 18)
        }
      }
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    // Smooth Kp transition
    smoothKp += (currentKp - smoothKp) * 0.01

    const c = ctx
    const w = canvas.width
    const h = canvas.height
    const waterY = h * (1 - oceanLevel)

    // Kp 7+ : screen shake
    if (smoothKp >= 7) {
      const intensity = (smoothKp - 6) * 1.5
      shakeX = (Math.random() - 0.5) * intensity
      shakeY = (Math.random() - 0.5) * intensity
    } else {
      shakeX *= 0.9
      shakeY *= 0.9
    }

    c.save()
    if (Math.abs(shakeX) > 0.05 || Math.abs(shakeY) > 0.05) {
      c.translate(shakeX, shakeY)
    }

    // Background
    c.fillStyle = 'rgba(5, 8, 18, 1)'
    c.fillRect(0, 0, w, h)

    // Sky
    const skyGrad = c.createLinearGradient(0, 0, 0, waterY)
    skyGrad.addColorStop(0, 'rgba(3, 5, 15, 1)')
    skyGrad.addColorStop(0.5, 'rgba(8, 15, 30, 1)')
    skyGrad.addColorStop(1, 'rgba(12, 20, 40, 1)')
    c.fillStyle = skyGrad
    c.fillRect(0, 0, w, waterY)

    // Aurora borealis — driven by Kp
    renderAurora(c, w, waterY)

    // Eclipse awareness — ring of fire approaching Feb 17, 2026
    {
      const eclipseDate = new Date('2026-02-17T12:12:00Z').getTime()
      const now = Date.now()
      const daysUntil = (eclipseDate - now) / (1000 * 60 * 60 * 24)

      // Visible within 14 days before and 3 days after
      if (daysUntil > -3 && daysUntil < 14) {
        // Intensity: grows as eclipse approaches, peaks on the day
        const proximity = daysUntil <= 0
          ? Math.max(0, 1 - Math.abs(daysUntil) / 3)  // fading after
          : Math.max(0, 1 - daysUntil / 14)            // growing before
        const intensity = proximity * proximity // quadratic — accelerates near the event

        // Position: upper-right sky area
        const ecx = w * 0.75
        const ecy = waterY * 0.25

        // The ring of fire — annular eclipse (dark center, bright ring)
        const ringR = 18 + intensity * 8
        const ringWidth = 2 + intensity * 3

        // Outer glow
        const glowR = ringR + 15 + intensity * 20
        const glowGrad = c.createRadialGradient(ecx, ecy, ringR * 0.5, ecx, ecy, glowR)
        glowGrad.addColorStop(0, `rgba(255, 140, 40, 0)`)
        glowGrad.addColorStop(0.4, `rgba(255, 100, 20, ${0.02 * intensity})`)
        glowGrad.addColorStop(0.7, `rgba(255, 60, 10, ${0.015 * intensity})`)
        glowGrad.addColorStop(1, 'rgba(255, 40, 0, 0)')
        c.fillStyle = glowGrad
        c.beginPath()
        c.arc(ecx, ecy, glowR, 0, Math.PI * 2)
        c.fill()

        // The ring itself — pulsing slightly
        const pulse = 1 + Math.sin(time * 0.8) * 0.1 * intensity
        c.strokeStyle = `rgba(255, 120, 30, ${0.08 + intensity * 0.15})`
        c.lineWidth = ringWidth * pulse
        c.beginPath()
        c.arc(ecx, ecy, ringR, 0, Math.PI * 2)
        c.stroke()

        // Inner bright edge
        c.strokeStyle = `rgba(255, 200, 100, ${0.04 + intensity * 0.1})`
        c.lineWidth = 1
        c.beginPath()
        c.arc(ecx, ecy, ringR - ringWidth * 0.5, 0, Math.PI * 2)
        c.stroke()

        // Dark center (the moon's shadow)
        const centerGrad = c.createRadialGradient(ecx, ecy, 0, ecx, ecy, ringR - ringWidth)
        centerGrad.addColorStop(0, `rgba(3, 5, 15, ${0.5 * intensity})`)
        centerGrad.addColorStop(1, `rgba(3, 5, 15, ${0.2 * intensity})`)
        c.fillStyle = centerGrad
        c.beginPath()
        c.arc(ecx, ecy, ringR - ringWidth, 0, Math.PI * 2)
        c.fill()

        // Label
        if (intensity > 0.1) {
          c.font = '10px "Cormorant Garamond", serif'
          c.textAlign = 'center'
          const daysText = daysUntil <= 0
            ? 'ring of fire \u2014 antarctica'
            : daysUntil < 1
              ? 'eclipse imminent'
              : `eclipse in ${Math.ceil(daysUntil)} days`
          c.fillStyle = `rgba(255, 140, 60, ${0.06 + intensity * 0.08})`
          c.fillText(daysText, ecx, ecy + ringR + 18)
        }
      }
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

    // Navigation portals — ice formations
    renderPortals(c)

    // Ocean
    const oceanGrad = c.createLinearGradient(0, waterY, 0, h)
    oceanGrad.addColorStop(0, 'rgba(8, 20, 40, 1)')
    oceanGrad.addColorStop(0.3, 'rgba(5, 15, 35, 1)')
    oceanGrad.addColorStop(1, 'rgba(3, 8, 20, 1)')
    c.fillStyle = oceanGrad
    c.fillRect(0, waterY, w, h - waterY)

    // Aurora reflection on water during storms
    if (smoothKp >= 4) {
      const reflectAlpha = (smoothKp - 3) / 6 * 0.04
      const reflectHue = smoothKp >= 7 ? (time * 15) % 360 : 120 + Math.sin(time * 0.2) * 30
      const reflectGrad = c.createLinearGradient(0, waterY, 0, waterY + 80)
      reflectGrad.addColorStop(0, `hsla(${reflectHue}, 50%, 35%, ${reflectAlpha})`)
      reflectGrad.addColorStop(1, 'transparent')
      c.fillStyle = reflectGrad
      c.fillRect(0, waterY, w, 80)
    }

    // Wave lines
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

    // Ice shelf
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

    // Kp 7+ : storm ice cracks across the screen
    if (smoothKp >= 7 && Math.random() < 0.03 * (smoothKp - 6)) {
      const crackX = Math.random() * w
      const crackY = waterY + Math.random() * (h - waterY) * 0.3
      stormCracks.push({
        x1: crackX,
        y1: crackY,
        x2: crackX + (Math.random() - 0.5) * 100,
        y2: crackY + (Math.random() - 0.5) * 40,
        alpha: 0.4,
      })
    }
    stormCracks = stormCracks.filter(crack => {
      crack.alpha -= 0.008
      if (crack.alpha <= 0) return false
      c.strokeStyle = `rgba(200, 240, 255, ${crack.alpha})`
      c.lineWidth = 0.6
      c.beginPath()
      c.moveTo(crack.x1, crack.y1)
      c.lineTo(crack.x2, crack.y2)
      c.stroke()
      return true
    })

    // Cursor warmth radius (visible glow)
    const warmthRadius = 120
    const warmthGrad2 = c.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, warmthRadius)
    warmthGrad2.addColorStop(0, 'rgba(255, 80, 40, 0.03)')
    warmthGrad2.addColorStop(0.5, 'rgba(255, 60, 30, 0.01)')
    warmthGrad2.addColorStop(1, 'transparent')
    c.fillStyle = warmthGrad2
    c.beginPath()
    c.arc(mouseX, mouseY, warmthRadius, 0, Math.PI * 2)
    c.fill()

    // Update sizzle audio gain based on max warmth across crystals
    let maxWarmth = 0

    // Draw crystals
    for (const crystal of crystals) {
      const melt = crystal.meltProgress
      const intact = 1 - melt

      crystal.meltProgress = crystal.memory.degradation

      // Cursor warmth effect
      const dist = Math.hypot(mouseX - crystal.x, mouseY - crystal.y)
      if (dist < warmthRadius) {
        crystal.warmth = Math.min(1, crystal.warmth + 0.01 * (1 - dist / warmthRadius))
      } else {
        crystal.warmth = Math.max(0, crystal.warmth - 0.005)
      }

      if (crystal.warmth > maxWarmth) maxWarmth = crystal.warmth

      // Spawn steam particles when cursor warms a crystal
      if (crystal.warmth > 0.15 && Math.random() < crystal.warmth * 0.3) {
        const steamX = crystal.x + (Math.random() - 0.5) * crystal.width * 0.8
        const steamY = crystal.y - crystal.height * intact * (0.2 + Math.random() * 0.6)
        steamParticles.push({
          x: steamX,
          y: steamY,
          vy: -(0.3 + Math.random() * 0.5),
          vx: (Math.random() - 0.5) * 0.3,
          alpha: 0.25 + crystal.warmth * 0.2,
          size: 1 + Math.random() * 2,
        })
      }

      // Expand/collapse animation
      if (crystal.expanded) {
        crystal.expandProgress = Math.min(1, crystal.expandProgress + 0.04)
      } else {
        crystal.expandProgress = Math.max(0, crystal.expandProgress - 0.06)
      }

      const baseAlpha = intact * 0.6
      const shimmer = Math.sin(time * 1.5 + crystal.shimmer) * 0.1
      const warmthGlow = crystal.warmth * 0.15

      c.save()
      c.translate(crystal.x, crystal.y)

      // Warmth-induced glow (red-orange when cursor is near)
      if (crystal.warmth > 0.01) {
        const wGrad = c.createRadialGradient(0, -crystal.height * intact * 0.3, 0, 0, -crystal.height * intact * 0.3, crystal.width * 3)
        wGrad.addColorStop(0, `rgba(255, 100, 50, ${crystal.warmth * 0.08})`)
        wGrad.addColorStop(1, 'transparent')
        c.fillStyle = wGrad
        c.beginPath()
        c.arc(0, -crystal.height * intact * 0.3, crystal.width * 3, 0, Math.PI * 2)
        c.fill()

        // Extra drips from warmth
        if (Math.random() < crystal.warmth * 0.15) {
          crystal.drips.push({
            x: (Math.random() - 0.5) * crystal.width,
            y: -Math.random() * crystal.height * intact * 0.5,
            vy: 0.3 + Math.random(),
            alpha: 0.5,
          })
        }
      }

      // Aurora glow on crystal during storms
      if (smoothKp >= 4) {
        const auroraOnIce = (smoothKp - 3) / 6 * 0.06
        const auroraHue = smoothKp >= 7 ? (time * 20 + crystal.shimmer * 50) % 360 : 120 + Math.sin(time * 0.3 + crystal.shimmer) * 40
        const aGlow = c.createRadialGradient(0, -crystal.height * intact * 0.5, 0, 0, -crystal.height * intact * 0.5, crystal.width * 2.5)
        aGlow.addColorStop(0, `hsla(${auroraHue}, 60%, 40%, ${auroraOnIce})`)
        aGlow.addColorStop(1, 'transparent')
        c.fillStyle = aGlow
        c.beginPath()
        c.arc(0, -crystal.height * intact * 0.5, crystal.width * 2.5, 0, Math.PI * 2)
        c.fill()
      }

      // Ice glow
      const glow = c.createRadialGradient(0, -crystal.height * intact * 0.5, 0, 0, -crystal.height * intact * 0.5, crystal.width * 2)
      glow.addColorStop(0, `rgba(150, 200, 255, ${(baseAlpha + shimmer + warmthGlow) * 0.15})`)
      glow.addColorStop(1, 'transparent')
      c.fillStyle = glow
      c.beginPath()
      c.arc(0, -crystal.height * intact * 0.5, crystal.width * 2, 0, Math.PI * 2)
      c.fill()

      // Crystal facets
      for (const facet of crystal.facets) {
        if (facet.y < -crystal.height * intact) continue

        c.save()
        c.translate(facet.x, facet.y * intact)
        c.rotate(facet.angle)

        const facetAlpha = baseAlpha + shimmer + warmthGlow
        c.fillStyle = `rgba(180, 220, 255, ${facetAlpha * 0.3})`
        c.fillRect(-facet.w / 2, -facet.h / 2, facet.w, facet.h)

        c.strokeStyle = `rgba(200, 240, 255, ${facetAlpha * 0.4})`
        c.lineWidth = 0.5
        c.strokeRect(-facet.w / 2, -facet.h / 2, facet.w, facet.h)

        c.restore()
      }

      // Main crystal body
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

      // Fracture lines
      for (let f = 0; f < 3; f++) {
        const fy = -crystH * (0.2 + f * 0.3)
        c.strokeStyle = `rgba(200, 240, 255, ${baseAlpha * 0.1})`
        c.beginPath()
        c.moveTo(-topW * 0.5 + f * 3, fy)
        c.lineTo(topW * 0.3 - f * 2, fy + 10)
        c.stroke()
      }

      // Drips
      if (melt > 0.1 || crystal.warmth > 0.1) {
        if (Math.random() < (melt + crystal.warmth) * meltRate * 0.08) {
          crystal.drips.push({
            x: (Math.random() - 0.5) * botW,
            y: 0,
            vy: 0.5 + Math.random() * 1,
            alpha: 0.4,
          })
        }

        crystal.drips = crystal.drips.filter(drip => {
          drip.y += drip.vy
          drip.vy += 0.05
          drip.alpha -= 0.005

          if (drip.alpha <= 0) return false

          c.fillStyle = `rgba(150, 200, 255, ${drip.alpha})`
          c.beginPath()
          c.ellipse(drip.x, drip.y, 1.5, 3, 0, 0, Math.PI * 2)
          c.fill()

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

      // Memory text on crystal surface
      c.font = '12px "Cormorant Garamond", serif'
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

      // Expanded memory panel
      if (crystal.expandProgress > 0) {
        const ep = crystal.expandProgress
        const panelW = 240 * ep
        const panelH = 100 * ep
        const px = crystal.x - panelW / 2
        const py = crystal.y - crystal.height * intact - panelH - 20

        c.fillStyle = `rgba(8, 15, 35, ${0.85 * ep})`
        c.fillRect(px, py, panelW, panelH)
        c.strokeStyle = `rgba(150, 200, 255, ${0.2 * ep})`
        c.lineWidth = 1
        c.strokeRect(px, py, panelW, panelH)

        if (ep > 0.5) {
          c.font = '13px "Cormorant Garamond", serif'
          c.fillStyle = `rgba(220, 240, 255, ${0.7 * ep})`
          c.textAlign = 'left'

          // Word wrap the full text
          const fullWords = crystal.memory.currentText.split(' ')
          let ly = py + 18
          let ln = ''
          for (const word of fullWords) {
            const test = ln + (ln ? ' ' : '') + word
            if (c.measureText(test).width > panelW - 20 && ln) {
              c.fillText(ln, px + 10, ly)
              ln = word
              ly += 15
              if (ly > py + panelH - 10) break
            } else {
              ln = test
            }
          }
          if (ln && ly <= py + panelH - 10) c.fillText(ln, px + 10, ly)

          // Degradation indicator
          c.font = '11px monospace'
          c.fillStyle = `rgba(255, ${Math.floor(200 * (1 - crystal.memory.degradation))}, ${Math.floor(200 * (1 - crystal.memory.degradation))}, ${0.3 * ep})`
          c.fillText(`${(crystal.memory.degradation * 100).toFixed(0)}% melted`, px + 10, py + panelH - 8)
        }
      }
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

    // Update sizzle audio proportional to warmth
    if (sizzleGain && audioCtx) {
      const targetSizzle = maxWarmth * 0.06
      sizzleGain.gain.linearRampToValueAtTime(targetSizzle, audioCtx.currentTime + 0.05)
    }

    // Steam particles (rising white dots from warmed crystals)
    steamParticles = steamParticles.filter(p => {
      p.y += p.vy
      p.x += p.vx
      p.alpha -= 0.004
      p.size *= 0.998
      if (p.alpha <= 0) return false
      c.fillStyle = `rgba(220, 235, 255, ${p.alpha})`
      c.beginPath()
      c.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      c.fill()
      return true
    })

    // Cultural inscription (cycling every 25s)
    inscriptionTimer += 0.016
    if (inscriptionTimer >= INSCRIPTION_CYCLE_S) {
      inscriptionTimer = 0
      inscriptionIndex = (inscriptionIndex + 1) % INSCRIPTIONS.length
    }
    {
      // Fade in for first 3s, hold, fade out for last 3s
      const cyclePos = inscriptionTimer / INSCRIPTION_CYCLE_S
      let insAlpha: number
      if (cyclePos < 0.12) insAlpha = cyclePos / 0.12
      else if (cyclePos > 0.88) insAlpha = (1 - cyclePos) / 0.12
      else insAlpha = 1
      insAlpha *= 0.06

      c.font = '11px "Cormorant Garamond", serif'
      c.fillStyle = `rgba(180, 220, 255, ${insAlpha})`
      c.textAlign = 'right'
      c.fillText(INSCRIPTIONS[inscriptionIndex], w - 14, h / 2)
    }

    // Sea ice extent data (bottom-left)
    c.font = '12px monospace'
    c.fillStyle = 'rgba(150, 200, 255, 0.12)'
    c.textAlign = 'left'
    c.fillText(`arctic sea ice: ${seaIceExtent.toFixed(1)} million km\u00B2`, 12, h - 54)

    const deviation = ((NORMAL_FEB_EXTENT - seaIceExtent) / NORMAL_FEB_EXTENT * 100).toFixed(1)
    c.fillStyle = 'rgba(255, 100, 100, 0.12)'
    c.fillText(`${deviation}% below february average`, 12, h - 42)

    c.fillStyle = 'rgba(150, 200, 255, 0.08)'
    c.fillText(`melt rate: ${meltRate.toFixed(2)}x`, 12, h - 30)

    // Geomagnetic conditions (bottom-left, below sea ice)
    if (kpStatusText) {
      const kpColor = smoothKp >= 7 ? 'rgba(255, 100, 100, 0.15)'
        : smoothKp >= 5 ? 'rgba(255, 180, 100, 0.13)'
        : 'rgba(150, 200, 255, 0.10)'
      c.fillStyle = kpColor
      c.fillText(kpStatusText, 12, h - 18)
    }

    // Title
    c.font = '12px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(180, 220, 255, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.fillText('the glacarium', w / 2, 25)

    // Interaction hint
    c.font = '12px "Cormorant Garamond", serif'
    c.fillStyle = 'rgba(180, 220, 255, 0.04)'
    c.textAlign = 'center'
    c.fillText('your warmth melts the ice \u00B7 click a crystal to read', w / 2, 40)

    // No memories hint
    if (crystals.length === 0) {
      c.font = '12px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(180, 220, 255, 0.1)'
      c.textAlign = 'center'
      c.fillText('no memories to freeze', w / 2, h / 2 - 20)
      c.font = '12px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(180, 220, 255, 0.06)'
      c.fillText('type something into the void first', w / 2, h / 2 + 5)
    }

    // Context quote
    c.font = '12px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(180, 220, 255, ${0.04 + Math.sin(time * 0.2) * 0.01})`
    c.textAlign = 'center'
    c.fillText('february 2026 \u2014 arctic sea ice reaches record low', w / 2, h - 8)

    c.restore() // restore from shake transform
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

      canvas.addEventListener('mousemove', handleMouseMove)
      canvas.addEventListener('click', handleClick)

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
      fetchKpIndex()
      buildCrystals()
      initAudio()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      if (crackTimeout) clearTimeout(crackTimeout)
      if (audioCtx) {
        const fadeTime = audioCtx.currentTime + 1
        if (windGain) windGain.gain.linearRampToValueAtTime(0, fadeTime)
        if (subBassGain) subBassGain.gain.linearRampToValueAtTime(0, fadeTime)
        if (iceGroanGain) iceGroanGain.gain.linearRampToValueAtTime(0, fadeTime)
        if (sizzleGain) sizzleGain.gain.linearRampToValueAtTime(0, fadeTime)
      }
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      if (crackTimeout) clearTimeout(crackTimeout)
      // Don't close shared AudioContext — just disconnect our nodes
      if (audioCtx) {
        const fadeTime = audioCtx.currentTime + 0.1
        if (windGain) { windGain.gain.linearRampToValueAtTime(0, fadeTime); windGain.disconnect() }
        if (subBassGain) { subBassGain.gain.linearRampToValueAtTime(0, fadeTime); subBassGain.disconnect() }
        if (iceGroanGain) { iceGroanGain.gain.linearRampToValueAtTime(0, fadeTime); iceGroanGain.disconnect() }
        if (sizzleGain) { sizzleGain.gain.linearRampToValueAtTime(0, fadeTime); sizzleGain.disconnect() }
        audioCtx = null
        audioDest = null
      }
      audioInitialized = false
      canvas?.removeEventListener('mousemove', handleMouseMove)
      canvas?.removeEventListener('click', handleClick)
      overlay?.remove()
    },
  }
}
