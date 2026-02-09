/**
 * THE TIDE POOL — memories wash ashore
 *
 * An ocean-edge room where memories arrive as flotsam on waves.
 * The water is rendered as layered sine waves on canvas. Memory
 * fragments float on the surface, tumbling in the surf. Some
 * wash up on the beach. Others are pulled back out to sea.
 *
 * Uses REAL sunrise/sunset data from the Sunrise-Sunset API to
 * drive the room's lighting. The sky shifts from deep night blues
 * to golden dawn to bright midday based on your actual local time
 * relative to real sunrise/sunset. Tides are simulated with a
 * 12.4-hour sine wave from midnight, shifting water level.
 *
 * Navigation portals appear as tide pool creatures: a starfish
 * (garden), a spiral shell (well), a bioluminescent jellyfish
 * (lighthouse), an ice-blue anemone (glacarium), a weathered
 * barnacle cluster (weathervane).
 *
 * Inspired by: Tide pools, messages in bottles, flotsam and
 * jetsam, the liminal zone between land and sea, beach
 * combing, Hokusai's Great Wave, oceanic time scales,
 * circadian rhythms, lunar tidal forces
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface TidePoolDeps {
  getMemories: () => StoredMemory[]
  switchTo?: (name: string) => void
}

interface Flotsam {
  memory: StoredMemory
  x: number
  y: number
  vx: number
  bobPhase: number
  bobSpeed: number
  rotation: number
  onBeach: boolean
}

/** Sunrise-Sunset API response shape */
interface SunData {
  sunrise: number    // ms since epoch
  sunset: number     // ms since epoch
  solarNoon: number
  civilTwilightBegin: number
  civilTwilightEnd: number
  dayLength: number  // seconds
  fetchedAt: number  // ms since epoch (for cache)
}

/** Portal creature for in-room navigation */
interface PortalCreature {
  room: string
  label: string
  kind: 'starfish' | 'shell' | 'jellyfish' | 'anemone' | 'barnacle'
  x: number
  y: number
  phase: number
  hovered: boolean
}

/** Water crisis data fragment drifting on the surface */
interface CrisisFragment {
  text: string
  x: number
  y: number
  alpha: number
  fadeDir: 'in' | 'hold' | 'out'
  life: number
  maxLife: number
  speed: number
  drift: number
}

const CULTURAL_INSCRIPTIONS = [
  'hokusai painted the great wave at age 71. he said: by 90 I will have penetrated the mystery of things.',
  'rachel carson wrote the sea around us (1951). the ocean as memory bank, older than any continent.',
  'the mariana trench is 11km deep. at the bottom, single-celled organisms carry memories of the first oceans.',
  'sylvia earle: the ocean is the planet\'s life support system. and we\'ve explored less than 5%.',
  'messages in bottles have been found after 108 years. glass preserves what the sea cannot erase.',
  'the ocean absorbs 30% of CO2 emissions. it\'s acidifying — dissolving the shells of creatures that remember the old pH.',
  'tarkovsky flooded entire sets for stalker. water as the medium of the unconscious.',
  'the UN declared global water bankruptcy in january 2026. 50% of large lakes have shrunk since 1990.',
  'deep-sea mining threatens hydrothermal vents — ecosystems that have existed for millions of years.',
  'an ice-cold earth discovered in kepler archives. a frozen ocean world, 146 light-years away.',
  'the global plastics treaty collapsed in geneva. 170 trillion particles float on the ocean. nothing is removed.',
  'seurat painted the sea in dots of pure color (courtauld, feb 2026). up close, chaos. at distance, a wave.',
  'florence banned fossil fuel ads. the visual landscape of a renaissance city, cleared of petrochemical noise.',
  'ENSO returns to neutral by april 2026. the ocean\'s thermostat resets. the baseline was always an illusion.',
  'the nihilist penguin walked toward the mountain. the ocean watched. the internet watched. nobody followed.',
  'see memory: 30,000 hand-painted frames of forgetting. the documentary is itself a memory of memory.',
]

const WATER_CRISIS_FACTS = [
  'fifty percent of large lakes have shrunk since 1990',
  'seventy percent of major aquifers in long-term decline',
  'wetlands the size of the EU have vanished',
  'glaciers have shrunk thirty percent since 1970',
  'mexico city sinks twenty inches per year',
  'kabul may be the first city to run out of water',
  'the aral sea has lost ninety percent of its water',
  'lake chad has shrunk ninety-five percent since the 1960s',
  'the colorado river no longer reaches the sea',
  'groundwater depletion accelerates globally',
  'two billion people lack safe drinking water',
  'the dead sea drops one meter per year',
  'cape town nearly reached day zero in 2018',
  'the ogallala aquifer will be seventy percent depleted by 2060',
  'forty percent of the world\'s rivers are severely polluted',
  'the ganges carries more plastic than any other river',
  'three point six billion people face water scarcity',
  'global water demand will exceed supply by forty percent by 2030',
  'one in four children will live in water-stressed areas',
  'the UN declared global water bankruptcy in january 2026',
]

type TimeOfDay = 'night' | 'preDawn' | 'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk' | 'postDusk'

const CACHE_KEY = 'oubli_tidepool_sundata'
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour

export function createTidePoolRoom(deps: TidePoolDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let inscriptionTimer = 0
  let inscriptionIdx = 0
  let flotsam: Flotsam[] = []
  let audioCtx: AudioContext | null = null
  let noiseSource: AudioBufferSourceNode | null = null
  let noiseGain: GainNode | null = null

  // Water crisis overlay
  let crisisFragments: CrisisFragment[] = []
  let lastCrisisSpawn = 0
  let nextCrisisInterval = 20 + Math.random() * 20 // 20-40s
  let crisisFactIndex = 0
  let sessionStartTime = 0
  let recedingShown = false

  // Crisis audio timers
  let foghornTimer: ReturnType<typeof setTimeout> | null = null
  let dripTimer: ReturnType<typeof setTimeout> | null = null

  // Micro-plastic particles — inspired by the collapsed plastics treaty (Feb 2026)
  // These NEVER disappear. Every interaction adds more. The room accumulates.
  interface MicroPlastic { x: number; y: number; size: number; hue: number; alpha: number; drift: number }
  let microPlastics: MicroPlastic[] = []
  let microPlasticTimer = 0

  // Sun data
  let sunData: SunData | null = null
  let sunDataLoading = false

  // Portal creatures (positioned on the beach / in shallow pools)
  let portals: PortalCreature[] = []

  // ── Sunrise-Sunset API ──────────────────────────────────────

  function getCachedSunData(): SunData | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (!raw) return null
      const data = JSON.parse(raw) as SunData
      if (Date.now() - data.fetchedAt > CACHE_DURATION) return null
      return data
    } catch {
      return null
    }
  }

  function cacheSunData(data: SunData) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data))
    } catch {
      // localStorage full or unavailable — ignore
    }
  }

  function getUserCoords(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: 40.7128, lng: -74.0060 }) // NYC fallback
        return
      }
      const timeout = setTimeout(() => {
        resolve({ lat: 40.7128, lng: -74.0060 })
      }, 3000) // 3s timeout

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timeout)
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        },
        () => {
          clearTimeout(timeout)
          resolve({ lat: 40.7128, lng: -74.0060 })
        },
        { timeout: 3000, maximumAge: 60000 }
      )
    })
  }

  async function fetchSunData() {
    // Check cache first
    const cached = getCachedSunData()
    if (cached) {
      sunData = cached
      return
    }

    sunDataLoading = true
    try {
      const coords = await getUserCoords()
      const url = `https://api.sunrise-sunset.org/json?lat=${coords.lat}&lng=${coords.lng}&formatted=0`
      const resp = await fetch(url)
      if (!resp.ok) throw new Error('API failed')
      const json = await resp.json()
      if (json.status !== 'OK') throw new Error('API status not OK')

      const r = json.results
      sunData = {
        sunrise: new Date(r.sunrise).getTime(),
        sunset: new Date(r.sunset).getTime(),
        solarNoon: new Date(r.solar_noon).getTime(),
        civilTwilightBegin: new Date(r.civil_twilight_begin).getTime(),
        civilTwilightEnd: new Date(r.civil_twilight_end).getTime(),
        dayLength: r.day_length,
        fetchedAt: Date.now(),
      }
      cacheSunData(sunData)
    } catch {
      // Graceful fallback — use approximate values for NYC
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const ms = (h: number, m: number) => today.getTime() + h * 3600000 + m * 60000
      sunData = {
        sunrise: ms(7, 0),
        sunset: ms(17, 30),
        solarNoon: ms(12, 15),
        civilTwilightBegin: ms(6, 30),
        civilTwilightEnd: ms(18, 0),
        dayLength: 10.5 * 3600,
        fetchedAt: Date.now(),
      }
    }
    sunDataLoading = false
  }

  // ── Time-of-day classification ──────────────────────────────

  function getTimeOfDay(): TimeOfDay {
    if (!sunData) return 'night'
    const now = Date.now()
    const { sunrise, sunset, civilTwilightBegin, civilTwilightEnd, solarNoon } = sunData

    if (now < civilTwilightBegin) return 'night'
    if (now < sunrise) return 'preDawn'
    if (now < sunrise + (solarNoon - sunrise) * 0.3) return 'dawn'
    if (now < solarNoon - 3600000) return 'morning'
    if (now < solarNoon + 3600000) return 'midday'
    if (now < sunset - (sunset - solarNoon) * 0.3) return 'afternoon'
    if (now < sunset) return 'dusk'
    if (now < civilTwilightEnd) return 'postDusk'
    return 'night'
  }

  /** Get a 0-1 value representing sun progress through the day (0=midnight, 0.5=noon) */
  function getSunProgress(): number {
    if (!sunData) return 0
    const now = Date.now()
    const { sunrise, sunset } = sunData
    if (now < sunrise) return Math.max(0, (now - (sunrise - 7200000)) / 7200000) * 0.15
    if (now > sunset) return Math.max(0, 1 - (now - sunset) / 7200000) * 0.15
    return 0.15 + 0.7 * ((now - sunrise) / (sunset - sunrise))
  }

  // ── Sky colors based on time of day ─────────────────────────

  interface SkyColors {
    top: string
    bottom: string
    waterHue: number
    waterSat: number
    waterLight: number
    moonAlpha: number
    bioLuminAlpha: number
    textColor: string
    foamColor: string
    beachTop: string
    beachBottom: string
    starAlpha: number
  }

  function getSkyColors(): SkyColors {
    const tod = getTimeOfDay()
    switch (tod) {
      case 'night':
        return {
          top: 'rgba(3, 5, 15, 1)',
          bottom: 'rgba(8, 12, 25, 1)',
          waterHue: 210, waterSat: 35, waterLight: 8,
          moonAlpha: 0.08,
          bioLuminAlpha: 0.15,
          textColor: '160, 180, 220',
          foamColor: 'rgba(140, 170, 220, 0.06)',
          beachTop: 'rgba(30, 25, 18, 0.8)',
          beachBottom: 'rgba(15, 12, 8, 1)',
          starAlpha: 0.3,
        }
      case 'preDawn':
        return {
          top: 'rgba(10, 12, 35, 1)',
          bottom: 'rgba(30, 25, 50, 1)',
          waterHue: 220, waterSat: 30, waterLight: 10,
          moonAlpha: 0.04,
          bioLuminAlpha: 0.08,
          textColor: '170, 170, 200',
          foamColor: 'rgba(160, 160, 200, 0.06)',
          beachTop: 'rgba(40, 32, 28, 0.8)',
          beachBottom: 'rgba(20, 16, 12, 1)',
          starAlpha: 0.12,
        }
      case 'dawn':
        return {
          top: 'rgba(40, 30, 60, 1)',
          bottom: 'rgba(180, 120, 60, 1)',
          waterHue: 25, waterSat: 40, waterLight: 18,
          moonAlpha: 0.0,
          bioLuminAlpha: 0.0,
          textColor: '220, 180, 120',
          foamColor: 'rgba(240, 200, 140, 0.10)',
          beachTop: 'rgba(100, 75, 45, 0.8)',
          beachBottom: 'rgba(60, 45, 30, 1)',
          starAlpha: 0.0,
        }
      case 'morning':
        return {
          top: 'rgba(70, 100, 150, 1)',
          bottom: 'rgba(140, 170, 200, 1)',
          waterHue: 200, waterSat: 45, waterLight: 22,
          moonAlpha: 0.0,
          bioLuminAlpha: 0.0,
          textColor: '80, 120, 160',
          foamColor: 'rgba(220, 230, 240, 0.12)',
          beachTop: 'rgba(130, 110, 75, 0.8)',
          beachBottom: 'rgba(80, 65, 45, 1)',
          starAlpha: 0.0,
        }
      case 'midday':
        return {
          top: 'rgba(100, 140, 190, 1)',
          bottom: 'rgba(160, 200, 230, 1)',
          waterHue: 195, waterSat: 50, waterLight: 28,
          moonAlpha: 0.0,
          bioLuminAlpha: 0.0,
          textColor: '60, 100, 150',
          foamColor: 'rgba(230, 240, 250, 0.15)',
          beachTop: 'rgba(150, 130, 90, 0.8)',
          beachBottom: 'rgba(100, 85, 60, 1)',
          starAlpha: 0.0,
        }
      case 'afternoon':
        return {
          top: 'rgba(80, 110, 160, 1)',
          bottom: 'rgba(150, 170, 190, 1)',
          waterHue: 200, waterSat: 42, waterLight: 24,
          moonAlpha: 0.0,
          bioLuminAlpha: 0.0,
          textColor: '90, 120, 160',
          foamColor: 'rgba(220, 225, 235, 0.12)',
          beachTop: 'rgba(130, 110, 75, 0.8)',
          beachBottom: 'rgba(85, 70, 48, 1)',
          starAlpha: 0.0,
        }
      case 'dusk':
        return {
          top: 'rgba(50, 30, 60, 1)',
          bottom: 'rgba(200, 100, 50, 1)',
          waterHue: 15, waterSat: 35, waterLight: 16,
          moonAlpha: 0.02,
          bioLuminAlpha: 0.02,
          textColor: '220, 160, 100',
          foamColor: 'rgba(240, 180, 120, 0.08)',
          beachTop: 'rgba(90, 65, 40, 0.8)',
          beachBottom: 'rgba(50, 38, 25, 1)',
          starAlpha: 0.0,
        }
      case 'postDusk':
        return {
          top: 'rgba(15, 12, 30, 1)',
          bottom: 'rgba(40, 25, 45, 1)',
          waterHue: 240, waterSat: 30, waterLight: 10,
          moonAlpha: 0.05,
          bioLuminAlpha: 0.06,
          textColor: '180, 160, 200',
          foamColor: 'rgba(170, 160, 210, 0.06)',
          beachTop: 'rgba(40, 32, 28, 0.8)',
          beachBottom: 'rgba(20, 16, 12, 1)',
          starAlpha: 0.08,
        }
    }
  }

  // ── Real tide simulation ────────────────────────────────────

  /** Tide level from -1 (low) to +1 (high) based on ~12.4-hour lunar cycle from midnight */
  function getRealTideLevel(): number {
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const msSinceMidnight = now.getTime() - midnight
    // Lunar tidal period ~ 12.4 hours = 44640 seconds
    const tidalPeriodMs = 12.4 * 3600 * 1000
    return Math.sin((msSinceMidnight / tidalPeriodMs) * Math.PI * 2)
  }

  function getTideWord(): string {
    const level = getRealTideLevel()
    if (level > 0.6) return 'high tide'
    if (level > 0.2) return 'rising tide'
    if (level > -0.2) return 'mid tide'
    if (level > -0.6) return 'ebbing tide'
    return 'low tide'
  }

  // ── Portal creature setup ───────────────────────────────────

  function buildPortals() {
    if (!canvas) return
    const w = canvas.width
    const h = canvas.height
    const beachY = h * 0.78

    portals = [
      {
        room: 'garden', label: 'the garden',
        kind: 'starfish',
        x: w * 0.10, y: beachY + 30,
        phase: Math.random() * Math.PI * 2,
        hovered: false,
      },
      {
        room: 'well', label: 'the well',
        kind: 'shell',
        x: w * 0.30, y: beachY + 50,
        phase: Math.random() * Math.PI * 2,
        hovered: false,
      },
      {
        room: 'lighthouse', label: 'the lighthouse',
        kind: 'jellyfish',
        x: w * 0.55, y: beachY - 20, // shallow water
        phase: Math.random() * Math.PI * 2,
        hovered: false,
      },
      {
        room: 'glacarium', label: 'the glacarium',
        kind: 'anemone',
        x: w * 0.75, y: beachY + 15,
        phase: Math.random() * Math.PI * 2,
        hovered: false,
      },
      {
        room: 'weathervane', label: 'the weathervane',
        kind: 'barnacle',
        x: w * 0.90, y: beachY + 40,
        phase: Math.random() * Math.PI * 2,
        hovered: false,
      },
    ]
  }

  // ── Draw portal creatures ───────────────────────────────────

  function drawStarfish(cx: number, cy: number, r: number, hovered: boolean, t: number) {
    if (!ctx) return
    const arms = 5
    const alpha = hovered ? 0.5 : 0.18
    const pulse = 1 + Math.sin(t * 1.2) * 0.08
    const rr = r * pulse
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(Math.sin(t * 0.3) * 0.1)

    ctx.beginPath()
    for (let i = 0; i < arms * 2; i++) {
      const angle = (i * Math.PI) / arms - Math.PI / 2
      const dist = i % 2 === 0 ? rr : rr * 0.4
      const px = Math.cos(angle) * dist
      const py = Math.sin(angle) * dist
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fillStyle = `rgba(200, 120, 80, ${alpha})`
    ctx.fill()
    ctx.strokeStyle = `rgba(220, 140, 100, ${alpha * 0.8})`
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()
  }

  function drawShell(cx: number, cy: number, r: number, hovered: boolean, t: number) {
    if (!ctx) return
    const alpha = hovered ? 0.5 : 0.18
    const pulse = 1 + Math.sin(t * 0.8) * 0.05
    ctx.save()
    ctx.translate(cx, cy)

    // Spiral shell
    ctx.beginPath()
    const turns = 2.5
    for (let a = 0; a < turns * Math.PI * 2; a += 0.1) {
      const sr = (a / (turns * Math.PI * 2)) * r * pulse
      const sx = Math.cos(a) * sr
      const sy = Math.sin(a) * sr * 0.7
      if (a === 0) ctx.moveTo(sx, sy)
      else ctx.lineTo(sx, sy)
    }
    ctx.strokeStyle = `rgba(210, 190, 160, ${alpha})`
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Shell body
    ctx.beginPath()
    ctx.ellipse(0, 0, r * pulse * 0.6, r * pulse * 0.4, 0, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(200, 180, 150, ${alpha * 0.5})`
    ctx.fill()
    ctx.restore()
  }

  function drawJellyfish(cx: number, cy: number, r: number, hovered: boolean, t: number) {
    if (!ctx) return
    const colors = getSkyColors()
    const isNight = colors.bioLuminAlpha > 0.02
    const baseAlpha = hovered ? 0.55 : (isNight ? 0.3 : 0.18)
    const bob = Math.sin(t * 1.5) * 4
    ctx.save()
    ctx.translate(cx, cy + bob)

    // Bell
    ctx.beginPath()
    ctx.ellipse(0, -r * 0.2, r * 0.7, r * 0.5, 0, Math.PI, 0)
    const bellAlpha = baseAlpha * (isNight ? 1.5 : 1)
    ctx.fillStyle = isNight
      ? `rgba(100, 200, 255, ${bellAlpha})`
      : `rgba(180, 160, 220, ${bellAlpha})`
    ctx.fill()

    // Tentacles
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath()
      const tx = i * r * 0.25
      ctx.moveTo(tx, r * 0.1)
      const sway = Math.sin(t * 2 + i * 0.7) * 6
      ctx.quadraticCurveTo(tx + sway, r * 0.5, tx + sway * 0.5, r * 0.9)
      ctx.strokeStyle = isNight
        ? `rgba(80, 180, 240, ${baseAlpha * 0.6})`
        : `rgba(160, 140, 200, ${baseAlpha * 0.6})`
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Bioluminescence glow at night
    if (isNight) {
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.5)
      glow.addColorStop(0, `rgba(80, 200, 255, ${baseAlpha * 0.3})`)
      glow.addColorStop(1, 'rgba(80, 200, 255, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 3)
    }
    ctx.restore()
  }

  function drawAnemone(cx: number, cy: number, r: number, hovered: boolean, t: number) {
    if (!ctx) return
    const alpha = hovered ? 0.5 : 0.18
    ctx.save()
    ctx.translate(cx, cy)

    // Base
    ctx.beginPath()
    ctx.ellipse(0, r * 0.3, r * 0.5, r * 0.2, 0, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(100, 160, 200, ${alpha * 0.6})`
    ctx.fill()

    // Tentacles waving
    const tentacles = 9
    for (let i = 0; i < tentacles; i++) {
      const angle = ((i / tentacles) * Math.PI) - Math.PI * 0.5
      const baseX = Math.cos(angle) * r * 0.35
      const sway = Math.sin(t * 1.8 + i * 0.9) * 5
      ctx.beginPath()
      ctx.moveTo(baseX, 0)
      ctx.quadraticCurveTo(
        baseX + sway,
        -r * 0.4,
        baseX + sway * 1.3,
        -r * 0.7 + Math.sin(t * 2 + i) * 3,
      )
      // Ice-blue color
      ctx.strokeStyle = `rgba(140, 200, 230, ${alpha})`
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Tip glow
      const tipX = baseX + sway * 1.3
      const tipY = -r * 0.7 + Math.sin(t * 2 + i) * 3
      ctx.beginPath()
      ctx.arc(tipX, tipY, 1.5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(180, 230, 255, ${alpha * 1.2})`
      ctx.fill()
    }
    ctx.restore()
  }

  function drawBarnacle(cx: number, cy: number, r: number, hovered: boolean, t: number) {
    if (!ctx) return
    const alpha = hovered ? 0.45 : 0.16
    ctx.save()
    ctx.translate(cx, cy)

    // Cluster of 3-4 barnacles
    const cluster = [
      { dx: 0, dy: 0, sr: r * 0.5 },
      { dx: r * 0.4, dy: -r * 0.2, sr: r * 0.35 },
      { dx: -r * 0.35, dy: r * 0.15, sr: r * 0.4 },
      { dx: r * 0.15, dy: r * 0.35, sr: r * 0.3 },
    ]

    for (const b of cluster) {
      // Shell cone
      ctx.beginPath()
      ctx.ellipse(b.dx, b.dy, b.sr, b.sr * 0.7, 0, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(160, 155, 140, ${alpha})`
      ctx.fill()
      ctx.strokeStyle = `rgba(180, 175, 160, ${alpha * 0.8})`
      ctx.lineWidth = 0.8
      ctx.stroke()

      // Opening — cirri wave when hovered
      if (hovered) {
        const openR = b.sr * 0.3
        for (let j = 0; j < 4; j++) {
          const a = ((j / 4) * Math.PI * 0.8) + Math.PI * 0.1
          const featherLen = openR + Math.sin(t * 3 + j) * 2
          ctx.beginPath()
          ctx.moveTo(b.dx, b.dy - b.sr * 0.2)
          ctx.lineTo(
            b.dx + Math.cos(a - Math.PI / 2) * featherLen,
            b.dy - b.sr * 0.2 - Math.sin(a - Math.PI / 2) * featherLen - 3,
          )
          ctx.strokeStyle = `rgba(190, 180, 160, ${alpha * 0.6})`
          ctx.lineWidth = 0.7
          ctx.stroke()
        }
      }
    }
    ctx.restore()
  }

  function drawPortal(p: PortalCreature, t: number) {
    if (!ctx) return
    const r = p.hovered ? 18 : 14

    switch (p.kind) {
      case 'starfish': drawStarfish(p.x, p.y, r, p.hovered, t + p.phase); break
      case 'shell': drawShell(p.x, p.y, r, p.hovered, t + p.phase); break
      case 'jellyfish': drawJellyfish(p.x, p.y, r, p.hovered, t + p.phase); break
      case 'anemone': drawAnemone(p.x, p.y, r, p.hovered, t + p.phase); break
      case 'barnacle': drawBarnacle(p.x, p.y, r, p.hovered, t + p.phase); break
    }

    // Label on hover
    if (p.hovered && ctx) {
      ctx.save()
      ctx.font = '12px "Cormorant Garamond", serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(200, 210, 220, 0.35)'
      ctx.fillText(p.label, p.x, p.y - 22)
      ctx.restore()
    }
  }

  // ── Stars (only at night) ───────────────────────────────────

  // Stable star positions generated once
  let stars: Array<{ xFrac: number; yFrac: number; brightness: number; twinklePhase: number }> = []

  function buildStars() {
    stars = []
    for (let i = 0; i < 80; i++) {
      stars.push({
        xFrac: Math.random(),
        yFrac: Math.random() * 0.35, // upper sky only
        brightness: 0.3 + Math.random() * 0.7,
        twinklePhase: Math.random() * Math.PI * 2,
      })
    }
  }

  function drawStars(w: number, h: number, alpha: number, t: number) {
    if (!ctx || alpha < 0.01) return
    for (const s of stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(t * 0.5 + s.twinklePhase)
      const a = alpha * s.brightness * twinkle
      if (a < 0.01) continue
      ctx.beginPath()
      ctx.arc(s.xFrac * w, s.yFrac * h, 0.8, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(220, 230, 250, ${a})`
      ctx.fill()
    }
  }

  // ── Bioluminescent plankton (night only) ────────────────────

  let plankton: Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number }> = []

  function spawnPlankton(w: number, waveBaseY: number) {
    if (plankton.length > 60) return
    plankton.push({
      x: Math.random() * w,
      y: waveBaseY + Math.random() * 40 - 20,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.15,
      life: 0,
      maxLife: 120 + Math.random() * 180,
    })
  }

  function updateAndDrawPlankton(w: number, h: number, alpha: number, t: number) {
    if (!ctx || alpha < 0.01) return
    const waveBase = h * 0.55
    if (Math.random() < 0.15) spawnPlankton(w, waveBase)

    for (let i = plankton.length - 1; i >= 0; i--) {
      const p = plankton[i]
      p.x += p.vx + Math.sin(t * 0.3 + p.y * 0.01) * 0.2
      p.y += p.vy
      p.life++

      if (p.life > p.maxLife || p.x < -10 || p.x > w + 10) {
        plankton.splice(i, 1)
        continue
      }

      const lifeRatio = p.life / p.maxLife
      const fade = lifeRatio < 0.2 ? lifeRatio / 0.2 : lifeRatio > 0.8 ? (1 - lifeRatio) / 0.2 : 1
      const a = alpha * fade * (0.3 + 0.7 * Math.sin(t * 2 + p.x * 0.1))

      ctx.beginPath()
      ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(80, 220, 255, ${a})`
      ctx.fill()
    }
  }

  // ── Flotsam builder ─────────────────────────────────────────

  function buildFlotsam() {
    const memories = deps.getMemories()
    if (!canvas) return

    const w = canvas.width
    flotsam = []

    for (let i = 0; i < Math.min(memories.length, 25); i++) {
      const mem = memories[i]
      flotsam.push({
        memory: mem,
        x: Math.random() * w,
        y: 0,
        vx: (Math.random() - 0.5) * 0.3,
        bobPhase: Math.random() * Math.PI * 2,
        bobSpeed: 0.5 + Math.random() * 0.5,
        rotation: (Math.random() - 0.5) * 0.3,
        onBeach: Math.random() < 0.3,
      })
    }
  }

  // ── Ocean sound ─────────────────────────────────────────────

  async function startOceanSound() {
    try {
      audioCtx = await getAudioContext()
      if (!audioCtx) return

      const bufferSize = audioCtx.sampleRate * 2
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
      const data = buffer.getChannelData(0)

      // Brown noise (more oceanic than white)
      let last = 0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        last = (last + 0.02 * white) / 1.02
        data[i] = last * 3.5
      }

      noiseSource = audioCtx.createBufferSource()
      noiseSource.buffer = buffer
      noiseSource.loop = true

      const filter = audioCtx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 400
      filter.Q.value = 0.5

      noiseGain = audioCtx.createGain()
      noiseGain.gain.value = 0

      noiseSource.connect(filter)
      filter.connect(noiseGain)
      noiseGain.connect(audioCtx.destination)

      noiseSource.start()
      noiseGain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 2)
    } catch {
      // Audio failed — continue without sound
    }
  }

  function stopOceanSound() {
    if (noiseGain && audioCtx) {
      noiseGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1)
      setTimeout(() => {
        noiseSource?.stop()
        noiseSource = null
        noiseGain = null
      }, 1500)
    }
  }

  // ── Water crisis data overlay ──────────────────────────────

  function spawnCrisisFragment(w: number, h: number) {
    const text = WATER_CRISIS_FACTS[crisisFactIndex % WATER_CRISIS_FACTS.length]
    crisisFactIndex++

    const fadeInFrames = Math.floor((8 + Math.random() * 4) * 60) // 8-12 seconds total
    crisisFragments.push({
      text,
      x: Math.random() * w * 0.6 + w * 0.2, // center 60% of screen
      y: h * (0.56 + Math.random() * 0.12), // in the water zone
      alpha: 0,
      fadeDir: 'in',
      life: 0,
      maxLife: fadeInFrames,
      speed: 0.1 + Math.random() * 0.15,
      drift: (Math.random() - 0.5) * 0.3,
    })
  }

  function updateAndDrawCrisisFragments(w: number, h: number, colors: SkyColors) {
    if (!ctx) return

    // Check if it's time to spawn a new fragment
    const elapsed = time - lastCrisisSpawn
    if (elapsed > nextCrisisInterval) {
      spawnCrisisFragment(w, h)
      lastCrisisSpawn = time
      nextCrisisInterval = 20 + Math.random() * 20 // 20-40s
    }

    for (let i = crisisFragments.length - 1; i >= 0; i--) {
      const frag = crisisFragments[i]
      frag.life++

      // Fade phases: first 30% fading in, middle 40% hold, last 30% fading out
      const lifeRatio = frag.life / frag.maxLife
      if (lifeRatio < 0.3) {
        frag.fadeDir = 'in'
        frag.alpha = (lifeRatio / 0.3) * (0.08 + Math.random() * 0.07) // 0.08-0.15
      } else if (lifeRatio < 0.7) {
        frag.fadeDir = 'hold'
        frag.alpha = 0.08 + Math.random() * 0.04 // subtle flicker in hold
      } else {
        frag.fadeDir = 'out'
        frag.alpha = ((1 - lifeRatio) / 0.3) * 0.12
      }

      // Drift with the tide
      frag.x += frag.drift + Math.sin(time * 0.3) * 0.2
      frag.y += Math.sin(time * 0.5 + frag.x * 0.01) * 0.15

      // Remove when done
      if (frag.life > frag.maxLife) {
        crisisFragments.splice(i, 1)
        continue
      }

      // Draw the fragment
      ctx.save()
      ctx.font = '11px "Cormorant Garamond", serif'
      ctx.textAlign = 'center'
      ctx.globalAlpha = Math.max(0, Math.min(frag.alpha, 0.15))
      ctx.fillStyle = `rgba(${colors.textColor}, 1)`
      ctx.fillText(frag.text, frag.x, frag.y)
      ctx.restore()
    }
  }

  // ── Session drift — water receding ────────────────────────

  /** Returns a 0-1 value representing how much the water has dropped this session.
   *  Drops ~1-2% per minute. After 10 minutes, noticeably lower. */
  function getSessionDrift(): number {
    if (sessionStartTime === 0) return 0
    const elapsedMs = Date.now() - sessionStartTime
    const elapsedMinutes = elapsedMs / 60000
    // 1.5% drop per minute, capped at ~20% after ~13 minutes
    return Math.min(0.20, elapsedMinutes * 0.015)
  }

  // ── Crisis audio — foghorn and dripping ───────────────────

  function playFoghorn() {
    if (!audioCtx || !active) return
    try {
      const dest = getAudioDestination()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 65
      gain.gain.setValueAtTime(0, audioCtx.currentTime)
      gain.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + 0.5)
      gain.gain.linearRampToValueAtTime(0.03, audioCtx.currentTime + 1.5)
      gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2.0)
      osc.connect(gain)
      gain.connect(dest)
      osc.start(audioCtx.currentTime)
      osc.stop(audioCtx.currentTime + 2.2)
    } catch {
      // audio failed — ignore
    }
  }

  function playDrip() {
    if (!audioCtx || !active) return
    try {
      const dest = getAudioDestination()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 3000 + Math.random() * 5000 // 3-8kHz
      gain.gain.setValueAtTime(0, audioCtx.currentTime)
      gain.gain.linearRampToValueAtTime(0.015, audioCtx.currentTime + 0.01)
      gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.06)
      osc.connect(gain)
      gain.connect(dest)
      osc.start(audioCtx.currentTime)
      osc.stop(audioCtx.currentTime + 0.08)
    } catch {
      // audio failed — ignore
    }
  }

  function scheduleFoghorn() {
    if (!active) return
    const delay = (45 + Math.random() * 45) * 1000 // 45-90s
    foghornTimer = setTimeout(() => {
      playFoghorn()
      scheduleFoghorn()
    }, delay)
  }

  function scheduleDrip() {
    if (!active) return
    const delay = (10 + Math.random() * 10) * 1000 // 10-20s
    dripTimer = setTimeout(() => {
      playDrip()
      scheduleDrip()
    }, delay)
  }

  function stopCrisisAudio() {
    if (foghornTimer !== null) { clearTimeout(foghornTimer); foghornTimer = null }
    if (dripTimer !== null) { clearTimeout(dripTimer); dripTimer = null }
  }

  // ── Wave calculation (now uses real tide level) ─────────────

  function getWaveY(x: number, w: number, h: number): number {
    // Real tide shifts water level ±10% of height
    const tide = getRealTideLevel() * 0.1
    // Session drift: water level drops over time (water crisis metaphor)
    const drift = getSessionDrift()
    const baseY = h * (0.55 + tide + drift)

    const wave1 = Math.sin(x * 0.008 + time * 0.7) * 15
    const wave2 = Math.sin(x * 0.015 + time * 1.1 + 1) * 8
    const wave3 = Math.sin(x * 0.003 + time * 0.3 + 2) * 20

    return baseY + wave1 + wave2 + wave3
  }

  // ── Main render ─────────────────────────────────────────────

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height
    const colors = getSkyColors()

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Sky gradient — driven by real time of day
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.5)
    sky.addColorStop(0, colors.top)
    sky.addColorStop(1, colors.bottom)
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h * 0.6)

    // --- Seurat pointillist sky (inspired by Courtauld exhibition Feb 2026) ---
    // The horizon dissolves into visible dots of pure color, like Seurat's seascapes
    const horizonY = h * 0.48
    const pointillismBand = 80 // px band where dots are visible
    for (let pi = 0; pi < 25; pi++) {
      const px = Math.random() * w
      const py = horizonY + (Math.random() - 0.5) * pointillismBand
      const dotSize = 1 + Math.random() * 2
      // Color sampled from sky/water boundary with slight variation
      const hueShift = (Math.random() - 0.5) * 30
      const dotHue = colors.waterHue + hueShift
      const dotAlpha = 0.04 + Math.random() * 0.04
      ctx.beginPath()
      ctx.arc(px, py, dotSize, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${dotHue}, ${colors.waterSat + 10}%, ${colors.waterLight + 15}%, ${dotAlpha})`
      ctx.fill()
    }

    // Stars (night / twilight only)
    drawStars(w, h, colors.starAlpha, time)

    // Moon (night only)
    if (colors.moonAlpha > 0.01) {
      const moonX = w * 0.7
      const moonY = h * 0.1
      ctx.beginPath()
      ctx.arc(moonX, moonY, 20, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(200, 210, 230, ${colors.moonAlpha})`
      ctx.fill()

      // Moon reflection on water
      for (let i = 0; i < 20; i++) {
        const ry = getWaveY(moonX + (Math.random() - 0.5) * 40, w, h) + i * 8
        ctx.beginPath()
        ctx.ellipse(moonX + Math.sin(time + i) * 3, ry, 15 - i * 0.5, 1, 0, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200, 210, 230, ${colors.moonAlpha * 0.4 - i * 0.001})`
        ctx.fill()
      }
    }

    // Beach (bottom) — colors shift with time of day
    const tideLevel = getRealTideLevel()
    const beachY = h * (0.75 + tideLevel * 0.05) // beach exposed more at low tide
    const beach = ctx.createLinearGradient(0, beachY, 0, h)
    beach.addColorStop(0, colors.beachTop)
    beach.addColorStop(1, colors.beachBottom)
    ctx.fillStyle = beach
    ctx.fillRect(0, beachY, w, h - beachY)

    // Draw water layers (back to front)
    for (let layer = 3; layer >= 0; layer--) {
      const layerOffset = layer * 15
      const alpha = 0.15 + (3 - layer) * 0.1

      ctx.beginPath()
      ctx.moveTo(0, h)

      for (let x = 0; x <= w; x += 4) {
        const y = getWaveY(x, w, h) + layerOffset
        ctx.lineTo(x, y)
      }

      ctx.lineTo(w, h)
      ctx.closePath()

      ctx.fillStyle = `hsla(${colors.waterHue + layer * 10}, ${colors.waterSat}%, ${colors.waterLight + layer * 3}%, ${alpha})`
      ctx.fill()
    }

    // Foam line at wave edge
    ctx.strokeStyle = colors.foamColor
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let x = 0; x <= w; x += 3) {
      const y = getWaveY(x, w, h)
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Bioluminescent plankton (night & twilight)
    updateAndDrawPlankton(w, h, colors.bioLuminAlpha, time)

    // Water crisis data overlay — drifting fragments
    updateAndDrawCrisisFragments(w, h, colors)

    // --- Micro-plastic particles (global plastics treaty collapse, Feb 2026) ---
    // Every 2-4 seconds, a new particle appears. They NEVER disappear.
    microPlasticTimer += 0.016
    if (microPlasticTimer > 2 + Math.random() * 2) {
      microPlasticTimer = 0
      const waveY = getWaveY(Math.random() * w, w, h)
      microPlastics.push({
        x: Math.random() * w,
        y: waveY + Math.random() * 40 - 10,
        size: 0.5 + Math.random() * 1.5,
        hue: [0, 30, 60, 180, 200, 280, 320][Math.floor(Math.random() * 7)], // bright plastic colors
        alpha: 0.06 + Math.random() * 0.08,
        drift: (Math.random() - 0.5) * 0.3,
      })
    }
    // Render all accumulated micro-plastics
    for (const mp of microPlastics) {
      mp.x += mp.drift + Math.sin(time * 0.3 + mp.y * 0.01) * 0.15
      mp.y += Math.sin(time * 0.5 + mp.x * 0.005) * 0.1
      if (mp.x < -5) mp.x = w + 5
      if (mp.x > w + 5) mp.x = -5
      ctx.beginPath()
      ctx.arc(mp.x, mp.y, mp.size, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${mp.hue}, 60%, 60%, ${mp.alpha})`
      ctx.fill()
    }

    // "the water is receding" message after 10 minutes
    const drift = getSessionDrift()
    if (drift > 0.14 && !recedingShown) {
      recedingShown = true
    }
    if (recedingShown) {
      const recedingAlpha = Math.min(0.08, (drift - 0.14) * 0.8)
      ctx.save()
      ctx.font = '13px "Cormorant Garamond", serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = `rgba(${colors.textColor}, ${recedingAlpha})`
      ctx.fillText('the water is receding', w / 2, h * 0.50)
      ctx.restore()
    }

    // Draw flotsam
    for (const f of flotsam) {
      const waveY = getWaveY(f.x, w, h)

      if (!f.onBeach) {
        f.x += f.vx + Math.sin(time * 0.5) * 0.5
        f.y = waveY - 5 + Math.sin(time * f.bobSpeed + f.bobPhase) * 4

        if (f.x < -50) f.x = w + 50
        if (f.x > w + 50) f.x = -50

        if (waveY > beachY - 10 && Math.random() < 0.001) {
          f.onBeach = true
        }
      } else {
        f.y = beachY + 5 + (f.bobPhase % 30)
      }

      const health = 1 - f.memory.degradation
      const text = f.memory.currentText.slice(0, 30)
      if (!text.trim()) continue

      ctx.save()
      ctx.translate(f.x, f.y)
      ctx.rotate(f.rotation + (f.onBeach ? 0 : Math.sin(time * f.bobSpeed + f.bobPhase) * 0.1))

      ctx.font = `${10 + health * 3}px "Cormorant Garamond", serif`
      const textAlpha = f.onBeach ? 0.15 + health * 0.2 : 0.1 + health * 0.3
      ctx.fillStyle = f.onBeach
        ? `rgba(180, 160, 130, ${textAlpha})`
        : `rgba(${colors.textColor}, ${textAlpha})`

      if (f.memory.degradation > 0.3) {
        ctx.globalAlpha = 0.3
        ctx.fillText(text, 1, 1)
        ctx.fillText(text, -1, 0)
        ctx.globalAlpha = 1
      }

      ctx.fillText(text, 0, 0)
      ctx.restore()
    }

    // Portal creatures (in-room navigation)
    if (deps.switchTo) {
      for (const p of portals) {
        drawPortal(p, time)
      }
    }

    // Title
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(${colors.textColor}, 0.1)`
    ctx.textAlign = 'center'
    ctx.fillText('the tide pool', w / 2, 30)

    // Tide indicator — now based on real tidal simulation
    const tideWord = getTideWord()
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(${colors.textColor}, 0.08)`
    ctx.textAlign = 'right'
    ctx.fillText(tideWord, w - 16, 30)

    // Sun progress indicator (subtle)
    if (sunData) {
      const tod = getTimeOfDay()
      let timeLabel = ''
      if (tod === 'dawn') timeLabel = 'dawn'
      else if (tod === 'dusk') timeLabel = 'dusk'
      else if (tod === 'midday') timeLabel = 'solar noon'
      else if (tod === 'night') timeLabel = 'night'
      else if (tod === 'preDawn') timeLabel = 'before dawn'
      else if (tod === 'postDusk') timeLabel = 'twilight'
      else if (tod === 'morning') timeLabel = 'morning'
      else if (tod === 'afternoon') timeLabel = 'afternoon'

      if (timeLabel) {
        ctx.font = '11px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(${colors.textColor}, 0.06)`
        ctx.textAlign = 'left'
        ctx.fillText(timeLabel, 16, 30)
      }

      // Sun progress bar (very subtle thin line)
      const progress = getSunProgress()
      ctx.strokeStyle = `rgba(${colors.textColor}, 0.04)`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(16, 38)
      ctx.lineTo(16 + 60, 38)
      ctx.stroke()
      // Filled portion
      ctx.strokeStyle = `rgba(${colors.textColor}, 0.1)`
      ctx.beginPath()
      ctx.moveTo(16, 38)
      ctx.lineTo(16 + 60 * progress, 38)
      ctx.stroke()
    } else if (sunDataLoading) {
      ctx.font = '11px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(${colors.textColor}, 0.04)`
      ctx.textAlign = 'left'
      ctx.fillText('reading the sky...', 16, 30)
    }

    // Stats
    const onWater = flotsam.filter(f => !f.onBeach).length
    const onShore = flotsam.filter(f => f.onBeach).length
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(${colors.textColor}, 0.08)`
    ctx.textAlign = 'left'
    ctx.fillText(`${onWater} adrift \u00b7 ${onShore} ashore`, 16, h - 16)

    // Cultural inscription
    inscriptionTimer += 0.016
    if (inscriptionTimer >= 23) {
      inscriptionTimer = 0
      inscriptionIdx = (inscriptionIdx + 1) % CULTURAL_INSCRIPTIONS.length
    }
    const insText = CULTURAL_INSCRIPTIONS[inscriptionIdx]
    ctx.font = '11px "Cormorant Garamond", serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = `rgba(${colors.textColor}, 0.03)`
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
      ctx.fillText(insLines[li], w / 2, h - 40 + li * 14)
    }
  }

  // ── Hit testing for portal creatures ────────────────────────

  function hitTestPortals(mx: number, my: number): number {
    for (let i = 0; i < portals.length; i++) {
      const p = portals[i]
      const dx = mx - p.x
      const dy = my - p.y
      if (dx * dx + dy * dy < 25 * 25) return i // 25px radius
    }
    return -1
  }

  return {
    name: 'tidepool',
    label: 'the tide pool',

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

      buildStars()

      // Click handler for portal creatures
      canvas.addEventListener('click', (e) => {
        if (!deps.switchTo) return
        const idx = hitTestPortals(e.clientX, e.clientY)
        if (idx >= 0) {
          deps.switchTo(portals[idx].room)
          return
        }
      })

      // Hover handler for portal creatures
      canvas.addEventListener('mousemove', (e) => {
        if (!canvas) return
        for (const p of portals) p.hovered = false
        const idx = hitTestPortals(e.clientX, e.clientY)
        if (idx >= 0) {
          portals[idx].hovered = true
          canvas.style.cursor = 'pointer'
        } else {
          canvas.style.cursor = 'default'
        }
      })

      overlay.appendChild(canvas)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
          buildPortals() // reposition portals for new dimensions
        }
      }
      window.addEventListener('resize', onResize)

      return overlay
    },

    activate() {
      active = true
      sessionStartTime = Date.now()
      recedingShown = false
      crisisFragments = []
      lastCrisisSpawn = 0
      crisisFactIndex = Math.floor(Math.random() * WATER_CRISIS_FACTS.length)
      buildFlotsam()
      buildPortals()
      startOceanSound()
      fetchSunData() // fire-and-forget — will update colors when ready
      scheduleFoghorn()
      scheduleDrip()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      stopOceanSound()
      stopCrisisAudio()
      plankton = []
      crisisFragments = []
      microPlastics = []
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      stopOceanSound()
      stopCrisisAudio()
      overlay?.remove()
      plankton = []
      crisisFragments = []
      microPlastics = []
    },
  }
}
