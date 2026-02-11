/**
 * THE GARDEN — memories grow as living things
 *
 * A generative garden where each stored memory is a plant. New memories
 * are seeds. Over time they grow — branching, leafing, blooming. But
 * as the memory degrades, the plant withers. Fully degraded memories
 * become dry husks that still stand as monuments to what was.
 *
 * The garden uses procedural L-system-like growth rendered on canvas.
 * Each plant's shape is deterministically derived from the memory text
 * (text → hash → growth parameters). So the same memory always grows
 * the same plant, but each memory grows a unique one.
 *
 * Wind blows gently. Plants sway. The garden breathes.
 *
 * Inspired by: L-systems (Lindenmayer), Cellular automata gardens,
 * The Secret Garden, Japanese moss gardens, digital bonsai,
 * growth as metaphor for memory consolidation
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'
import { shareGardenPlant, fetchGardenPlants, type SharedPlant } from '../shared/FootprintReporter'

interface GardenDeps {
  getMemories: () => StoredMemory[]
  onDescend?: () => void
  switchTo?: (name: string) => void
}

interface Plant {
  memory: StoredMemory
  x: number
  segments: PlantSegment[]
  swayPhase: number
  swaySpeed: number
  isShared?: boolean // from another visitor
}

interface PlantSegment {
  x1: number; y1: number
  x2: number; y2: number
  thickness: number
  hue: number
  saturation: number
  lightness: number
  alpha: number
  isLeaf: boolean
  isFlower: boolean
}

function hashString(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
    return (s >>> 0) / 0xFFFFFFFF
  }
}

function generatePlant(memory: StoredMemory, baseX: number, groundY: number): Plant {
  const hash = hashString(memory.originalText)
  const rng = seededRandom(hash)

  const segments: PlantSegment[] = []
  const health = 1 - memory.degradation // 0 = dead, 1 = full
  const textLen = memory.originalText.length

  // Plant parameters derived from text
  const maxHeight = 60 + (textLen % 80) + rng() * 40 // taller for longer memories
  const branchiness = 0.15 + (hash % 100) / 300 // 0.15-0.48
  const curviness = 0.3 + rng() * 0.5
  const baseHue = memory.hue * 360 // use memory's hue

  // Grow from bottom up
  const numSegments = 5 + Math.floor(rng() * 6)
  let curX = baseX
  let curY = groundY
  const segHeight = maxHeight / numSegments

  function growBranch(
    startX: number, startY: number,
    angle: number, length: number,
    thickness: number, depth: number
  ) {
    if (depth > 4 || length < 4) return

    const endX = startX + Math.sin(angle) * length
    const endY = startY - Math.cos(angle) * length

    // Health affects color — dying plants go brown/gray
    const h = health > 0.3 ? baseHue : 30 + (1 - health) * 20
    const s = health > 0.3 ? (40 + health * 30) : (10 + health * 20)
    const l = 20 + health * 25
    const a = 0.3 + health * 0.5

    segments.push({
      x1: startX, y1: startY,
      x2: endX, y2: endY,
      thickness: thickness * (health * 0.7 + 0.3),
      hue: h, saturation: s, lightness: l,
      alpha: a,
      isLeaf: false,
      isFlower: false,
    })

    // Branch?
    if (rng() < branchiness && depth < 3) {
      const branchAngle = angle + (rng() - 0.5) * 1.5
      growBranch(endX, endY, branchAngle, length * 0.6, thickness * 0.6, depth + 1)
    }

    // Continue main stem with slight curve
    const nextAngle = angle + (rng() - 0.5) * curviness
    growBranch(endX, endY, nextAngle, length * 0.85, thickness * 0.8, depth + 1)

    // Leaf at end of thin branches
    if (depth >= 2 && thickness < 1.5 && health > 0.2) {
      segments.push({
        x1: endX, y1: endY,
        x2: endX + (rng() - 0.5) * 8, y2: endY - rng() * 6,
        thickness: 3 + health * 4,
        hue: baseHue + 20, saturation: 50 + health * 30,
        lightness: 30 + health * 20,
        alpha: 0.2 + health * 0.4,
        isLeaf: true,
        isFlower: false,
      })
    }

    // Flower at tips of healthy plants
    if (depth >= 3 && health > 0.6 && rng() < 0.4) {
      segments.push({
        x1: endX, y1: endY,
        x2: endX, y2: endY,
        thickness: 3 + rng() * 4,
        hue: (baseHue + 180) % 360, // complementary color
        saturation: 60 + health * 30,
        lightness: 50 + health * 20,
        alpha: 0.4 + health * 0.4,
        isLeaf: false,
        isFlower: true,
      })
    }
  }

  // Start growing
  const initialAngle = (rng() - 0.5) * 0.3 // slight lean
  growBranch(curX, curY, initialAngle, segHeight * 2, 2.5, 0)

  return {
    memory,
    x: baseX,
    segments,
    swayPhase: rng() * Math.PI * 2,
    swaySpeed: 0.3 + rng() * 0.5,
  }
}

interface Pollen {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  size: number
}

interface WaterDrop {
  x: number
  y: number
  radius: number
  alpha: number
}

interface PlantTooltip {
  plant: Plant
  x: number
  y: number
  alpha: number
}

interface GardenPortal {
  name: string
  label: string
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  hovered: boolean
  clickFlash: number // 0-1, decays after click
}

const CULTURAL_INSCRIPTIONS = [
  'the alerce trees of patagonia are 3,600 years old. this february, they burn.',
  'the oldest seagrass meadow in australia: 4,500 years old, one plant, cloning itself forever.',
  'linnaeus gave every living thing two names. he believed naming was the first act of understanding.',
  'the bodhi tree under which buddha sat still grows in anuradhapura, sri lanka. it remembers enlightenment.',
  'proust\'s madeleine triggered a garden: combray rising from his teacup, petal by petal.',
  'a garden is a memory palace you can eat. each plant marks a season you survived.',
  'global water bankruptcy (UN, jan 2026): 50% of large lakes have shrunk since 1990.',
  'seed vaults in svalbard hold 1.3 million varieties. insurance against forgetting how to grow food.',
  'e.O. wilson: half of all species will be extinct by 2100. the garden is closing.',
  'shape-shifting molecular devices: matter that remembers, thinks, and learns. the new root system.',
  'fungi use electrical spikes to communicate. up to 50 words. the roots are speaking beneath you.',
  '474 plant species are critically endangered, possibly extinct. the laurel family lost the most: 74 species of silent trees.',
  'the mycorrhizal network: trees share sugar and warnings through fungal threads. a forest is one organism.',
  'three species of seed-bearing plants vanish per year — 500 times the natural rate. the garden thins.',
  'adamatzky found fungal spike trains lasting 1 to 21 hours. the slowest language on earth.',
  'the word "garden" comes from old english "geard" — an enclosure. every garden is a wall against forgetting.',
]

export function createGardenRoom(deps: GardenDeps): Room {
  let inscriptionTimer = 0
  let inscriptionIdx = 0
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let plants: Plant[] = []
  let time = 0
  let waterDrops: WaterDrop[] = []
  let tooltip: PlantTooltip | null = null
  let mouseX = 0
  let mouseY = 0
  let pollenParticles: Pollen[] = []

  // Mycorrhizal network — underground connections between plants
  interface MycorrhizalPulse {
    fromIdx: number
    toIdx: number
    progress: number // 0..1 along the path
    speed: number
    alpha: number
    hue: number // warm = sugar sharing, cool = warning signal
  }
  let mycorrhizalPulses: MycorrhizalPulse[] = []
  let mycorrhizalTimer = 0

  // Fallen leaves — particles that drop from degrading plants
  interface FallenLeaf {
    x: number
    y: number
    rotation: number
    rotSpeed: number
    vy: number
    vx: number
    size: number
    hue: number
    alpha: number
    grounded: boolean
  }
  let fallenLeaves: FallenLeaf[] = []
  let leafDropTimer = 0

  // Fireflies — tiny lights attracted to healthy plants
  interface Firefly {
    x: number
    y: number
    vx: number
    vy: number
    phase: number
    speed: number
    brightness: number
    targetX: number
    targetY: number
  }
  let fireflies: Firefly[] = []

  // Audio state
  let audioMaster: GainNode | null = null
  let windNoiseNode: AudioBufferSourceNode | null = null
  let windFilter: BiquadFilterNode | null = null
  let windGain: GainNode | null = null
  let windLfoOsc: OscillatorNode | null = null
  let windLfoGain: GainNode | null = null
  let rustleLfoInterval: ReturnType<typeof setInterval> | null = null
  let witherInterval: ReturnType<typeof setInterval> | null = null
  let audioInitialized = false

  // ─── Audio functions ───

  async function initAudio() {
    if (audioInitialized) return
    try {
      const ac = await getAudioContext()
      const dest = getAudioDestination()

      audioMaster = ac.createGain()
      audioMaster.gain.value = 0
      audioMaster.connect(dest)

      // ── Wind ambience: brown noise → bandpass 300-800Hz → LFO-modulated gain ──
      const bufferLen = ac.sampleRate * 2
      const noiseBuf = ac.createBuffer(1, bufferLen, ac.sampleRate)
      const noiseData = noiseBuf.getChannelData(0)
      let lastOut = 0
      for (let i = 0; i < bufferLen; i++) {
        const white = Math.random() * 2 - 1
        lastOut = (lastOut + 0.02 * white) / 1.02
        noiseData[i] = lastOut * 3.5
      }

      windNoiseNode = ac.createBufferSource()
      windNoiseNode.buffer = noiseBuf
      windNoiseNode.loop = true

      windFilter = ac.createBiquadFilter()
      windFilter.type = 'bandpass'
      windFilter.frequency.value = 550 // center of 300-800Hz
      windFilter.Q.value = 0.8

      windGain = ac.createGain()
      windGain.gain.value = 0.01 // midpoint of 0.005-0.015

      // LFO for wind gain modulation (0.1Hz, range 0.005-0.015)
      windLfoOsc = ac.createOscillator()
      windLfoOsc.type = 'sine'
      windLfoOsc.frequency.value = 0.1

      windLfoGain = ac.createGain()
      windLfoGain.gain.value = 0.005 // amplitude: ±0.005 around the 0.01 center

      windLfoOsc.connect(windLfoGain)
      windLfoGain.connect(windGain.gain)

      windNoiseNode.connect(windFilter)
      windFilter.connect(windGain)
      windGain.connect(audioMaster)

      windNoiseNode.start()
      windLfoOsc.start()

      // ── Leaf rustle: periodic high-frequency noise bursts at LFO peaks ──
      rustleLfoInterval = setInterval(() => {
        if (!active || !audioMaster) return
        try {
          const now = ac.currentTime
          // Check if we're near an LFO peak (sine ≈ 1 at peaks every 10s)
          const lfoPhase = (now * 0.1 * Math.PI * 2) % (Math.PI * 2)
          if (Math.sin(lfoPhase) > 0.7) {
            playRustle(ac)
          }
        } catch { /* silent */ }
      }, 800)

      // ── Wither crackle: periodic dry noise for degraded plants ──
      witherInterval = setInterval(() => {
        if (!active || !audioMaster || plants.length === 0) return
        try {
          const witheredPlants = plants.filter(p => p.memory.degradation > 0.7)
          if (witheredPlants.length > 0 && Math.random() < 0.3) {
            playCrackle(ac)
          }
        } catch { /* silent */ }
      }, 2000)

      audioInitialized = true
    } catch {
      // silent fallback — audio not critical
    }
  }

  function playRustle(ac: AudioContext) {
    if (!audioMaster) return
    try {
      const duration = 0.05
      const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * duration), ac.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1
      }

      const src = ac.createBufferSource()
      src.buffer = buf

      const hp = ac.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 3000

      const g = ac.createGain()
      const now = ac.currentTime
      g.gain.setValueAtTime(0.008, now)
      g.gain.linearRampToValueAtTime(0, now + duration)

      src.connect(hp)
      hp.connect(g)
      g.connect(audioMaster)
      src.start(now)
      src.stop(now + duration)

      src.onended = () => {
        src.disconnect()
        hp.disconnect()
        g.disconnect()
      }
    } catch { /* silent */ }
  }

  function playCrackle(ac: AudioContext) {
    if (!audioMaster) return
    try {
      const duration = 0.003
      const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * duration), ac.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1
      }

      const src = ac.createBufferSource()
      src.buffer = buf

      const hp = ac.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 4000

      const g = ac.createGain()
      const now = ac.currentTime
      g.gain.setValueAtTime(0.005, now)
      g.gain.linearRampToValueAtTime(0, now + 0.02)

      src.connect(hp)
      hp.connect(g)
      g.connect(audioMaster)
      src.start(now)
      src.stop(now + 0.02)

      src.onended = () => {
        src.disconnect()
        hp.disconnect()
        g.disconnect()
      }
    } catch { /* silent */ }
  }

  function playGrowthTone(ac: AudioContext) {
    if (!audioMaster) return
    try {
      const osc = ac.createOscillator()
      osc.type = 'sine'
      const now = ac.currentTime
      osc.frequency.setValueAtTime(200, now)
      osc.frequency.linearRampToValueAtTime(250, now + 0.1)

      const g = ac.createGain()
      g.gain.setValueAtTime(0.005, now)
      g.gain.linearRampToValueAtTime(0, now + 0.1)

      osc.connect(g)
      g.connect(audioMaster)
      osc.start(now)
      osc.stop(now + 0.1)

      osc.onended = () => {
        osc.disconnect()
        g.disconnect()
      }
    } catch { /* silent */ }
  }

  function fadeAudioIn() {
    if (!audioMaster) return
    const ac = audioMaster.context as AudioContext
    const now = ac.currentTime
    audioMaster.gain.cancelScheduledValues(now)
    audioMaster.gain.setValueAtTime(audioMaster.gain.value, now)
    audioMaster.gain.linearRampToValueAtTime(1.0, now + 1.0)
  }

  function fadeAudioOut() {
    if (!audioMaster) return
    try {
      const ac = audioMaster.context as AudioContext
      const now = ac.currentTime
      audioMaster.gain.cancelScheduledValues(now)
      audioMaster.gain.setValueAtTime(audioMaster.gain.value, now)
      audioMaster.gain.linearRampToValueAtTime(0, now + 0.5)
    } catch { /* silent */ }
  }

  function destroyAudio() {
    fadeAudioOut()
    if (rustleLfoInterval) { clearInterval(rustleLfoInterval); rustleLfoInterval = null }
    if (witherInterval) { clearInterval(witherInterval); witherInterval = null }

    setTimeout(() => {
      try { windNoiseNode?.stop() } catch { /* already stopped */ }
      try { windLfoOsc?.stop() } catch { /* already stopped */ }
      windNoiseNode?.disconnect()
      windFilter?.disconnect()
      windGain?.disconnect()
      windLfoOsc?.disconnect()
      windLfoGain?.disconnect()
      audioMaster?.disconnect()

      windNoiseNode = null
      windFilter = null
      windGain = null
      windLfoOsc = null
      windLfoGain = null
      audioMaster = null
      audioInitialized = false
    }, 600)
  }

  const gardenPortals: GardenPortal[] = [
    { name: 'terrarium', label: 'the terrarium', corner: 'top-right', hovered: false, clickFlash: 0 },
    { name: 'tidepool', label: 'the tide pool', corner: 'top-left', hovered: false, clickFlash: 0 },
    { name: 'madeleine', label: 'the madeleine', corner: 'bottom-right', hovered: false, clickFlash: 0 },
    { name: 'void', label: 'the void', corner: 'bottom-left', hovered: false, clickFlash: 0 },
  ]

  function getPortalPosition(portal: GardenPortal, w: number, h: number): { x: number; y: number } {
    const margin = 50
    switch (portal.corner) {
      case 'top-right': return { x: w - margin, y: margin }
      case 'top-left': return { x: margin, y: margin }
      case 'bottom-right': return { x: w - margin, y: h - 70 }
      case 'bottom-left': return { x: margin, y: h - 70 }
    }
  }

  function isInsidePortal(px: number, py: number, portal: GardenPortal, w: number, h: number): boolean {
    const pos = getPortalPosition(portal, w, h)
    const dx = px - pos.x
    const dy = py - pos.y
    return dx * dx + dy * dy < 30 * 30
  }

  function renderPortals(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (!deps.switchTo) return

    for (const portal of gardenPortals) {
      const pos = getPortalPosition(portal, w, h)
      const hover = portal.hovered
      const flash = portal.clickFlash
      const glowBase = hover ? 0.6 : 0.15
      const glowPulse = Math.sin(time * (hover ? 3 : 1.2)) * 0.05

      // Decay click flash
      if (portal.clickFlash > 0) {
        portal.clickFlash = Math.max(0, portal.clickFlash - 0.03)
      }

      ctx.save()
      ctx.translate(pos.x, pos.y)

      if (portal.name === 'terrarium') {
        // Glass dome / bell jar with tiny plant
        const domeH = hover ? 26 : 22
        const domeW = hover ? 16 : 14
        const glow = glowBase + glowPulse + flash * 0.5

        // Glow aura
        const auraR = 30 + flash * 20
        const aura = ctx.createRadialGradient(0, -4, 2, 0, -4, auraR)
        aura.addColorStop(0, `rgba(80, 180, 60, ${glow * 0.25})`)
        aura.addColorStop(1, `rgba(80, 180, 60, 0)`)
        ctx.fillStyle = aura
        ctx.beginPath()
        ctx.arc(0, -4, auraR, 0, Math.PI * 2)
        ctx.fill()

        // Bell jar outline
        ctx.strokeStyle = `rgba(140, 200, 120, ${glow * 0.7})`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(-domeW / 2, 6)
        ctx.lineTo(-domeW / 2, -domeH * 0.3)
        ctx.quadraticCurveTo(-domeW / 2, -domeH, 0, -domeH)
        ctx.quadraticCurveTo(domeW / 2, -domeH, domeW / 2, -domeH * 0.3)
        ctx.lineTo(domeW / 2, 6)
        ctx.stroke()

        // Base
        ctx.fillStyle = `rgba(100, 160, 80, ${glow * 0.4})`
        ctx.fillRect(-domeW / 2 - 2, 5, domeW + 4, 3)

        // Tiny plant inside
        const plantSway = Math.sin(time * (hover ? 2.5 : 1.5)) * 1.5
        ctx.strokeStyle = `rgba(80, 180, 50, ${glow})`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(0, 4)
        ctx.quadraticCurveTo(plantSway, -6, plantSway * 0.6, -12)
        ctx.stroke()

        // Tiny leaves
        ctx.fillStyle = `rgba(100, 200, 60, ${glow * 0.8})`
        ctx.beginPath()
        ctx.ellipse(plantSway * 0.3 + 3, -8, 3, 1.5, 0.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(plantSway * 0.5 - 2, -5, 2.5, 1.2, -0.5, 0, Math.PI * 2)
        ctx.fill()

      } else if (portal.name === 'tidepool') {
        // Puddle with rippling concentric circles
        const glow = glowBase + glowPulse + flash * 0.5
        const rippleSpeed = hover ? 2.5 : 1.2

        // Glow aura
        const auraR = 28 + flash * 18
        const aura = ctx.createRadialGradient(0, 0, 2, 0, 0, auraR)
        aura.addColorStop(0, `rgba(60, 130, 200, ${glow * 0.3})`)
        aura.addColorStop(1, `rgba(60, 130, 200, 0)`)
        ctx.fillStyle = aura
        ctx.beginPath()
        ctx.arc(0, 0, auraR, 0, Math.PI * 2)
        ctx.fill()

        // Puddle base ellipse
        ctx.fillStyle = `rgba(30, 70, 120, ${glow * 0.4})`
        ctx.beginPath()
        ctx.ellipse(0, 2, 20, 10, 0, 0, Math.PI * 2)
        ctx.fill()

        // Concentric ripples
        for (let r = 0; r < 3; r++) {
          const phase = (time * rippleSpeed + r * 1.2) % 3
          const radius = 4 + phase * 7
          const alpha = (1 - phase / 3) * glow * 0.5
          ctx.strokeStyle = `rgba(100, 170, 220, ${alpha})`
          ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.ellipse(0, 2, radius, radius * 0.5, 0, 0, Math.PI * 2)
          ctx.stroke()
        }

        // Sparkle
        const sparklePhase = Math.sin(time * 3.7) * 0.5 + 0.5
        ctx.fillStyle = `rgba(180, 220, 255, ${sparklePhase * glow * 0.4})`
        ctx.beginPath()
        ctx.arc(-5 + Math.sin(time * 1.3) * 3, -1, 1, 0, Math.PI * 2)
        ctx.fill()

      } else if (portal.name === 'madeleine') {
        // Flower with slowly opening petals
        const glow = glowBase + glowPulse + flash * 0.5
        const openAmount = hover ? 0.9 : 0.5 + Math.sin(time * 0.4) * 0.15
        const petalCount = 6

        // Glow aura
        const auraR = 28 + flash * 18
        const aura = ctx.createRadialGradient(0, -2, 2, 0, -2, auraR)
        aura.addColorStop(0, `rgba(220, 120, 160, ${glow * 0.25})`)
        aura.addColorStop(1, `rgba(220, 120, 160, 0)`)
        ctx.fillStyle = aura
        ctx.beginPath()
        ctx.arc(0, -2, auraR, 0, Math.PI * 2)
        ctx.fill()

        // Stem
        ctx.strokeStyle = `rgba(80, 140, 60, ${glow * 0.5})`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(0, 14)
        ctx.quadraticCurveTo(Math.sin(time * 0.8) * 2, 6, 0, -2)
        ctx.stroke()

        // Petals
        for (let i = 0; i < petalCount; i++) {
          const angle = (i / petalCount) * Math.PI * 2 + time * (hover ? 0.15 : 0.05)
          const petalLen = 8 + openAmount * 6
          const px = Math.cos(angle) * petalLen
          const py = Math.sin(angle) * petalLen * 0.6 - 2
          const hue = 330 + i * 8
          ctx.fillStyle = `hsla(${hue}, 60%, ${50 + glow * 20}%, ${glow * 0.7})`
          ctx.beginPath()
          ctx.ellipse(px * 0.5, py * 0.5 - 2, petalLen * 0.45, petalLen * 0.2,
            angle, 0, Math.PI * 2)
          ctx.fill()
        }

        // Center
        ctx.fillStyle = `rgba(255, 220, 140, ${glow * 0.6})`
        ctx.beginPath()
        ctx.arc(0, -2, 2.5, 0, Math.PI * 2)
        ctx.fill()

      } else if (portal.name === 'void') {
        // Dark hole in the ground with magenta glow at edges
        const glow = glowBase + glowPulse + flash * 0.5
        const pulseSize = hover ? 3 : 1.5
        const holeRadius = 14 + Math.sin(time * (hover ? 2 : 0.8)) * pulseSize

        // Magenta edge glow
        const auraR = holeRadius + 16 + flash * 15
        const aura = ctx.createRadialGradient(0, 0, holeRadius * 0.5, 0, 0, auraR)
        aura.addColorStop(0, `rgba(0, 0, 0, 0)`)
        aura.addColorStop(0.5, `rgba(180, 20, 120, ${glow * 0.3})`)
        aura.addColorStop(1, `rgba(180, 20, 120, 0)`)
        ctx.fillStyle = aura
        ctx.beginPath()
        ctx.arc(0, 0, auraR, 0, Math.PI * 2)
        ctx.fill()

        // Dark hole
        const hole = ctx.createRadialGradient(0, 0, 0, 0, 0, holeRadius)
        hole.addColorStop(0, `rgba(0, 0, 0, ${0.8 + glow * 0.2})`)
        hole.addColorStop(0.7, `rgba(5, 0, 10, ${0.6 + glow * 0.2})`)
        hole.addColorStop(1, `rgba(80, 10, 60, ${glow * 0.4})`)
        ctx.fillStyle = hole
        ctx.beginPath()
        ctx.ellipse(0, 0, holeRadius, holeRadius * 0.55, 0, 0, Math.PI * 2)
        ctx.fill()

        // Rim highlight
        ctx.strokeStyle = `rgba(200, 30, 140, ${glow * 0.4})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.ellipse(0, 0, holeRadius, holeRadius * 0.55, 0, 0, Math.PI * 2)
        ctx.stroke()

        // Tiny swirling particles inside
        for (let i = 0; i < 3; i++) {
          const a = time * (1.5 + i * 0.3) + i * 2.1
          const pr = (holeRadius * 0.4) * (0.3 + (Math.sin(time + i) * 0.5 + 0.5) * 0.7)
          const ppx = Math.cos(a) * pr
          const ppy = Math.sin(a) * pr * 0.5
          ctx.fillStyle = `rgba(200, 50, 150, ${glow * 0.5})`
          ctx.beginPath()
          ctx.arc(ppx, ppy, 0.8, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Label on hover
      if (hover) {
        ctx.font = '12px "Cormorant Garamond", serif'
        ctx.textAlign = 'center'
        ctx.fillStyle = `rgba(200, 180, 140, 0.5)`
        const labelY = portal.corner.startsWith('top') ? 28 : -22
        ctx.fillText(portal.label, 0, labelY)
      }

      ctx.restore()
    }
  }

  let prevPlantCount = 0

  // Shared garden state
  let sharedPlants: SharedPlant[] = []
  let sharedPlantsLoaded = false

  async function loadSharedPlants() {
    const data = await fetchGardenPlants()
    if (data && data.plants) {
      sharedPlants = data.plants
      sharedPlantsLoaded = true
      buildGarden() // rebuild with shared plants
    }
  }

  function buildGarden() {
    const memories = deps.getMemories()
    if (!canvas) return

    const w = canvas.width
    const groundY = canvas.height * 0.82

    plants = []

    // Combine local memories with shared plants
    const allItems: Array<{ memory: StoredMemory; isShared: boolean }> = []
    for (const m of memories) {
      allItems.push({ memory: m, isShared: false })
    }
    // Add shared plants as pseudo-memories
    for (const sp of sharedPlants) {
      const h = hashString(sp.text)
      const pseudoMemory: StoredMemory = {
        id: `shared-${h}`,
        originalText: sp.text,
        currentText: sp.text,
        degradation: sp.degradation,
        hue: (h % 1000) / 1000,
        timestamp: Date.now() - sp.age,
        position: { x: 0, y: 0, z: 0 },
      }
      allItems.push({ memory: pseudoMemory, isShared: true })
    }

    if (allItems.length === 0) { prevPlantCount = 0; return }

    // Space plants evenly across the ground
    const spacing = Math.min(80, (w - 80) / allItems.length)
    const startX = (w - (allItems.length - 1) * spacing) / 2

    for (let i = 0; i < allItems.length; i++) {
      const x = startX + i * spacing
      const plant = generatePlant(allItems[i].memory, x, groundY)
      plant.isShared = allItems[i].isShared
      plants.push(plant)
    }

    // Growth tone — play when new plants appear
    if (audioInitialized && plants.length > prevPlantCount) {
      getAudioContext().then(ac => {
        if (active) playGrowthTone(ac)
      }).catch(() => { /* silent */ })
    }
    prevPlantCount = plants.length

    // Share local plants to server (just the most recent one)
    if (memories.length > 0) {
      const newest = memories[memories.length - 1]
      shareGardenPlant(newest.originalText)
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Sky gradient — dark blue to deep void
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, 'rgba(5, 3, 15, 1)')
    sky.addColorStop(0.6, 'rgba(8, 5, 20, 1)')
    sky.addColorStop(1, 'rgba(12, 8, 5, 1)')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    // Ground
    const groundY = h * 0.82
    const ground = ctx.createLinearGradient(0, groundY, 0, h)
    ground.addColorStop(0, 'rgba(20, 12, 8, 0.8)')
    ground.addColorStop(1, 'rgba(10, 6, 3, 1)')
    ctx.fillStyle = ground
    ctx.fillRect(0, groundY, w, h - groundY)

    // Ground line
    ctx.strokeStyle = 'rgba(80, 50, 30, 0.15)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, groundY)
    ctx.lineTo(w, groundY)
    ctx.stroke()

    // Soil texture — subtle noise grain across the ground
    const soilSeed = seededRandom(77)
    for (let i = 0; i < 200; i++) {
      const sx = soilSeed() * w
      const sy = groundY + soilSeed() * (h - groundY)
      const brightness = 15 + soilSeed() * 20
      const a = 0.03 + soilSeed() * 0.06
      ctx.fillStyle = `rgba(${brightness + 10}, ${brightness}, ${brightness - 5}, ${a})`
      ctx.fillRect(sx, sy, 1 + soilSeed() * 2, 1)
    }

    // Stars — subtle background
    const starSeed = seededRandom(42)
    ctx.fillStyle = 'rgba(255, 215, 0, 0.15)'
    for (let i = 0; i < 40; i++) {
      const sx = starSeed() * w
      const sy = starSeed() * groundY * 0.8
      const sr = 0.5 + starSeed() * 1
      const twinkle = 0.5 + 0.5 * Math.sin(time * (0.5 + starSeed()) + starSeed() * 10)
      ctx.globalAlpha = twinkle * 0.3
      ctx.beginPath()
      ctx.arc(sx, sy, sr, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Wind
    const wind = Math.sin(time * 0.3) * 0.02

    // Draw plant shadows (rendered first, behind plants)
    for (const plant of plants) {
      const sway = Math.sin(time * plant.swaySpeed + plant.swayPhase) * 3 + wind * 20
      const shadowOffsetX = 4
      const shadowOffsetY = 2

      for (const seg of plant.segments) {
        const swayFactor1 = Math.max(0, (groundY - seg.y1) / (groundY * 0.5))
        const swayFactor2 = Math.max(0, (groundY - seg.y2) / (groundY * 0.5))
        const sx1 = seg.x1 + sway * swayFactor1 + shadowOffsetX
        const sy1 = seg.y1 + shadowOffsetY
        const sx2 = seg.x2 + sway * swayFactor2 + shadowOffsetX
        const sy2 = seg.y2 + shadowOffsetY

        if (seg.isFlower) {
          ctx.beginPath()
          ctx.arc(sx2, sy2, seg.thickness, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(0, 0, 0, 0.04)'
          ctx.fill()
        } else if (seg.isLeaf) {
          ctx.save()
          ctx.translate(sx2, sy2)
          ctx.rotate(Math.atan2(sy2 - sy1, sx2 - sx1))
          ctx.scale(1, 0.5)
          ctx.beginPath()
          ctx.arc(0, 0, seg.thickness, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(0, 0, 0, 0.03)'
          ctx.fill()
          ctx.restore()
        } else {
          ctx.beginPath()
          ctx.moveTo(sx1, sy1)
          ctx.lineTo(sx2, sy2)
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.03)'
          ctx.lineWidth = seg.thickness
          ctx.lineCap = 'round'
          ctx.stroke()
        }
      }
    }

    // Draw plants
    for (const plant of plants) {
      const sway = Math.sin(time * plant.swaySpeed + plant.swayPhase) * 3 + wind * 20
      // Shared plants: ghostly blue-green tint, lower opacity, gentle shimmer
      const isShared = plant.isShared
      const sharedAlpha = isShared ? (0.35 + 0.1 * Math.sin(time * 0.8 + plant.swayPhase)) : 1
      const sharedHueShift = isShared ? 160 : 0 // shift toward cyan

      for (const seg of plant.segments) {
        // Apply sway — more at top (lower y = higher on screen)
        const swayFactor1 = Math.max(0, (groundY - seg.y1) / (groundY * 0.5))
        const swayFactor2 = Math.max(0, (groundY - seg.y2) / (groundY * 0.5))

        const sx1 = seg.x1 + sway * swayFactor1
        const sy1 = seg.y1
        const sx2 = seg.x2 + sway * swayFactor2
        const sy2 = seg.y2

        const hue = isShared ? (seg.hue + sharedHueShift) % 360 : seg.hue
        const alpha = seg.alpha * sharedAlpha

        if (seg.isFlower) {
          // Draw flower as small circle
          ctx.beginPath()
          ctx.arc(sx2, sy2, seg.thickness, 0, Math.PI * 2)
          ctx.fillStyle = `hsla(${hue}, ${seg.saturation}%, ${seg.lightness}%, ${alpha})`
          ctx.fill()

          // Glow
          ctx.beginPath()
          ctx.arc(sx2, sy2, seg.thickness * 2, 0, Math.PI * 2)
          ctx.fillStyle = `hsla(${hue}, ${seg.saturation}%, ${seg.lightness}%, ${alpha * 0.15})`
          ctx.fill()
        } else if (seg.isLeaf) {
          // Draw leaf as small ellipse
          ctx.save()
          ctx.translate(sx2, sy2)
          ctx.rotate(Math.atan2(sy2 - sy1, sx2 - sx1))
          ctx.scale(1, 0.5)
          ctx.beginPath()
          ctx.arc(0, 0, seg.thickness, 0, Math.PI * 2)
          ctx.fillStyle = `hsla(${hue}, ${seg.saturation}%, ${seg.lightness}%, ${alpha})`
          ctx.fill()
          ctx.restore()
        } else {
          // Draw branch segment
          ctx.beginPath()
          ctx.moveTo(sx1, sy1)
          ctx.lineTo(sx2, sy2)
          ctx.strokeStyle = `hsla(${hue}, ${seg.saturation}%, ${seg.lightness}%, ${alpha})`
          ctx.lineWidth = seg.thickness
          ctx.lineCap = 'round'
          ctx.stroke()
        }
      }

      // Label for shared plants — faint "from another garden" text
      if (isShared) {
        const labelY = groundY + 12
        ctx.save()
        ctx.globalAlpha = 0.12 + 0.03 * Math.sin(time * 0.5 + plant.swayPhase)
        ctx.font = '9px "Cormorant Garamond", serif'
        ctx.fillStyle = 'rgba(120, 220, 200, 0.6)'
        ctx.textAlign = 'center'
        ctx.fillText('~', plant.x, labelY)
        ctx.restore()
      }
    }

    // Pollen / spore particles — float upward from healthy (blooming) plants
    const bloomingPlants = plants.filter(p => p.memory.degradation < 0.3)
    // Spawn new pollen from blooming plants
    if (bloomingPlants.length > 0 && pollenParticles.length < 10 && Math.random() < 0.05) {
      const srcPlant = bloomingPlants[Math.floor(Math.random() * bloomingPlants.length)]
      const sway = Math.sin(time * srcPlant.swaySpeed + srcPlant.swayPhase) * 3 + wind * 20
      pollenParticles.push({
        x: srcPlant.x + sway + (Math.random() - 0.5) * 20,
        y: groundY - 20 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.15 - Math.random() * 0.2,
        alpha: 0.3 + Math.random() * 0.3,
        size: 0.8 + Math.random() * 1.2,
      })
    }
    // Update and draw pollen
    for (let i = pollenParticles.length - 1; i >= 0; i--) {
      const p = pollenParticles[i]
      p.x += p.vx + wind * 5
      p.y += p.vy
      p.alpha -= 0.002
      if (p.alpha <= 0 || p.y < 0) {
        pollenParticles.splice(i, 1)
        continue
      }
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 215, 100, ${p.alpha})`
      ctx.fill()
      // Tiny glow
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 215, 100, ${p.alpha * 0.15})`
      ctx.fill()
    }

    // --- Mycorrhizal network (underground) ---
    const groundY2 = h * 0.82
    if (plants.length >= 2) {
      // Draw faint root connections between adjacent plants
      for (let i = 0; i < plants.length - 1; i++) {
        const p1 = plants[i]
        const p2 = plants[i + 1]
        const health = Math.min(1 - p1.memory.degradation, 1 - p2.memory.degradation)
        if (health < 0.1) continue
        const rootAlpha = 0.02 + health * 0.02
        const sway1 = Math.sin(time * p1.swaySpeed + p1.swayPhase) * 1
        const sway2 = Math.sin(time * p2.swaySpeed + p2.swayPhase) * 1

        // Underground bezier curve between plants
        const sx1 = p1.x + sway1
        const sx2 = p2.x + sway2
        const depth = groundY2 + 15 + Math.abs(sx2 - sx1) * 0.08
        ctx.strokeStyle = `rgba(80, 50, 30, ${rootAlpha})`
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(sx1, groundY2 + 3)
        ctx.quadraticCurveTo((sx1 + sx2) / 2, depth, sx2, groundY2 + 3)
        ctx.stroke()
      }

      // Spawn mycorrhizal pulses periodically
      mycorrhizalTimer += 0.016
      if (mycorrhizalTimer > 3 && plants.length >= 2) {
        mycorrhizalTimer = 0
        if (mycorrhizalPulses.length < 6 && Math.random() < 0.4) {
          const fromIdx = Math.floor(Math.random() * (plants.length - 1))
          const toIdx = fromIdx + 1
          const fromHealth = 1 - plants[fromIdx].memory.degradation
          const toHealth = 1 - plants[toIdx].memory.degradation
          // Sugar flows from healthy to struggling; warnings flow from dying
          const isWarning = plants[fromIdx].memory.degradation > 0.6 || plants[toIdx].memory.degradation > 0.6
          mycorrhizalPulses.push({
            fromIdx,
            toIdx,
            progress: 0,
            speed: 0.008 + Math.random() * 0.005,
            alpha: 0.15 + Math.max(fromHealth, toHealth) * 0.15,
            hue: isWarning ? 0 : 40, // red = warning, amber = sugar
          })
        }
      }

      // Draw and update pulses
      mycorrhizalPulses = mycorrhizalPulses.filter(pulse => {
        pulse.progress += pulse.speed
        if (pulse.progress > 1) return false
        if (pulse.fromIdx >= plants.length || pulse.toIdx >= plants.length) return false

        const p1 = plants[pulse.fromIdx]
        const p2 = plants[pulse.toIdx]
        const sx1 = p1.x
        const sx2 = p2.x
        const depth = groundY2 + 15 + Math.abs(sx2 - sx1) * 0.08

        // Bezier point at progress
        const t2 = pulse.progress
        const mt = 1 - t2
        const px = mt * mt * sx1 + 2 * mt * t2 * ((sx1 + sx2) / 2) + t2 * t2 * sx2
        const py = mt * mt * (groundY2 + 3) + 2 * mt * t2 * depth + t2 * t2 * (groundY2 + 3)

        const glow = ctx!.createRadialGradient(px, py, 0, px, py, 6)
        glow.addColorStop(0, `hsla(${pulse.hue}, 60%, 50%, ${pulse.alpha})`)
        glow.addColorStop(1, 'transparent')
        ctx!.fillStyle = glow
        ctx!.beginPath()
        ctx!.arc(px, py, 6, 0, Math.PI * 2)
        ctx!.fill()

        return true
      })
    }

    // --- Fallen leaves ---
    leafDropTimer += 0.016
    if (leafDropTimer > 2 && fallenLeaves.length < 30) {
      leafDropTimer = 0
      // Drop leaves from degrading plants
      const degrading = plants.filter(p => p.memory.degradation > 0.4)
      if (degrading.length > 0 && Math.random() < 0.3) {
        const src = degrading[Math.floor(Math.random() * degrading.length)]
        const health = 1 - src.memory.degradation
        fallenLeaves.push({
          x: src.x + (Math.random() - 0.5) * 20,
          y: groundY2 - 30 - Math.random() * 40,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.05,
          vy: 0.2 + Math.random() * 0.3,
          vx: (Math.random() - 0.5) * 0.4 + wind * 10,
          size: 2 + Math.random() * 3,
          hue: health > 0.3 ? 30 + Math.random() * 20 : 20 + Math.random() * 10,
          alpha: 0.2 + health * 0.3,
          grounded: false,
        })
      }
    }
    for (const leaf of fallenLeaves) {
      if (!leaf.grounded) {
        leaf.y += leaf.vy
        leaf.x += leaf.vx + wind * 3
        leaf.rotation += leaf.rotSpeed
        if (leaf.y >= groundY2 - 2) {
          leaf.y = groundY2 - 2
          leaf.grounded = true
        }
      } else {
        // Grounded leaves slowly fade
        leaf.alpha -= 0.0003
      }

      if (leaf.alpha <= 0) continue

      ctx.save()
      ctx.translate(leaf.x, leaf.y)
      ctx.rotate(leaf.rotation)
      ctx.fillStyle = `hsla(${leaf.hue}, 40%, 25%, ${leaf.alpha})`
      // Small leaf shape
      ctx.beginPath()
      ctx.ellipse(0, 0, leaf.size, leaf.size * 0.5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    fallenLeaves = fallenLeaves.filter(l => l.alpha > 0)

    // --- Fireflies ---
    if (fireflies.length < 8 && Math.random() < 0.01) {
      const healthyPlants = plants.filter(p => p.memory.degradation < 0.3)
      const targetPlant = healthyPlants.length > 0
        ? healthyPlants[Math.floor(Math.random() * healthyPlants.length)]
        : null
      fireflies.push({
        x: Math.random() * w,
        y: groundY2 - 40 - Math.random() * 80,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: 1.5 + Math.random() * 2,
        brightness: 0,
        targetX: targetPlant ? targetPlant.x + (Math.random() - 0.5) * 30 : Math.random() * w,
        targetY: targetPlant ? groundY2 - 20 - Math.random() * 50 : groundY2 - 50,
      })
    }
    for (let fi = fireflies.length - 1; fi >= 0; fi--) {
      const ff = fireflies[fi]
      // Drift toward target
      ff.vx += (ff.targetX - ff.x) * 0.0003
      ff.vy += (ff.targetY - ff.y) * 0.0003
      ff.vx *= 0.99
      ff.vy *= 0.99
      ff.x += ff.vx
      ff.y += ff.vy
      ff.phase += ff.speed * 0.016

      // Blink pattern
      ff.brightness = Math.max(0, Math.sin(ff.phase) * 0.5 + Math.sin(ff.phase * 2.7) * 0.3)

      if (ff.x < -20 || ff.x > w + 20 || ff.y < -20 || ff.y > h + 20) {
        fireflies.splice(fi, 1)
        continue
      }

      if (ff.brightness > 0.05) {
        const glow = ctx.createRadialGradient(ff.x, ff.y, 0, ff.x, ff.y, 8)
        glow.addColorStop(0, `rgba(200, 255, 100, ${ff.brightness * 0.3})`)
        glow.addColorStop(0.5, `rgba(180, 230, 80, ${ff.brightness * 0.1})`)
        glow.addColorStop(1, 'transparent')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(ff.x, ff.y, 8, 0, Math.PI * 2)
        ctx.fill()

        // Core dot
        ctx.fillStyle = `rgba(220, 255, 150, ${ff.brightness * 0.5})`
        ctx.beginPath()
        ctx.arc(ff.x, ff.y, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Labels — memory fragments below plants
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.textAlign = 'center'
    for (const plant of plants) {
      const label = plant.memory.currentText.slice(0, 20)
      if (!label.trim()) continue
      ctx.fillStyle = `rgba(200, 180, 140, ${0.1 + (1 - plant.memory.degradation) * 0.15})`
      ctx.fillText(label, plant.x + Math.sin(time * plant.swaySpeed + plant.swayPhase) * 1, groundY + 18)
    }

    // Water drop animations
    for (let i = waterDrops.length - 1; i >= 0; i--) {
      const drop = waterDrops[i]
      drop.radius += 0.8
      drop.alpha -= 0.008

      if (drop.alpha <= 0) {
        waterDrops.splice(i, 1)
        continue
      }

      ctx.beginPath()
      ctx.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(100, 160, 200, ${drop.alpha})`
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Hover highlight — glow around nearest plant
    if (mouseY < groundY) {
      for (const plant of plants) {
        const dist = Math.abs(mouseX - plant.x)
        if (dist < 30) {
          ctx.beginPath()
          ctx.arc(plant.x, groundY - 5, 4, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(255, 215, 0, 0.08)'
          ctx.fill()
        }
      }
    }

    // Plant tooltip
    if (tooltip) {
      tooltip.alpha -= 0.003
      if (tooltip.alpha <= 0) {
        tooltip = null
      } else {
        const t = tooltip
        const mem = t.plant.memory
        const health = Math.floor((1 - mem.degradation) * 100)
        const age = Math.floor((Date.now() - mem.timestamp) / (1000 * 60 * 60 * 24))

        // Background
        ctx.fillStyle = `rgba(10, 8, 5, ${t.alpha * 0.85})`
        ctx.fillRect(t.x - 120, t.y - 45, 240, 75)
        ctx.strokeStyle = `rgba(120, 90, 50, ${t.alpha * 0.15})`
        ctx.lineWidth = 1
        ctx.strokeRect(t.x - 120, t.y - 45, 240, 75)

        // Text
        ctx.font = '12px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(200, 180, 140, ${t.alpha * 0.6})`
        ctx.textAlign = 'center'
        const label = mem.currentText.slice(0, 40) || '(empty)'
        ctx.fillText(`"${label}"`, t.x, t.y - 20)

        ctx.font = '12px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(200, 180, 140, ${t.alpha * 0.3})`
        ctx.fillText(`${health}% alive · ${age} days old`, t.x, t.y)

        ctx.font = '12px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(200, 180, 140, ${t.alpha * 0.15})`
        ctx.fillText('click water to nurture · click soil to descend', t.x, t.y + 16)
      }
    }

    // Descent hint — click ground to go to roots
    if (deps.onDescend && plants.length > 0) {
      ctx.font = '12px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(120, 90, 50, ${0.06 + Math.sin(time * 0.3) * 0.02})`
      ctx.textAlign = 'center'
      ctx.fillText('▼ click the soil to see the roots', w / 2, groundY + 40)
    }

    // Info text
    const memCount = plants.length
    const avgHealth = plants.length > 0
      ? plants.reduce((s, p) => s + (1 - p.memory.degradation), 0) / plants.length
      : 0
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(200, 180, 140, 0.12)'
    ctx.textAlign = 'left'
    ctx.fillText(`${memCount} memories growing · ${Math.floor(avgHealth * 100)}% average vitality`, 16, h - 16)

    // Cultural inscription
    inscriptionTimer += 0.016
    if (inscriptionTimer >= 24) {
      inscriptionTimer = 0
      inscriptionIdx = (inscriptionIdx + 1) % CULTURAL_INSCRIPTIONS.length
    }
    const insText = CULTURAL_INSCRIPTIONS[inscriptionIdx]
    ctx.font = '11px "Cormorant Garamond", serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(120, 160, 80, 0.035)'
    const insMaxW = w * 0.75
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

    // Garden portals — organic exits at the edges
    renderPortals(ctx, w, h)
  }

  return {
    name: 'garden',
    label: 'the garden',

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
      canvas.style.cssText = `
        width: 100%; height: 100%;
      `
      ctx = canvas.getContext('2d')

      // Click interactions
      canvas.addEventListener('click', (e) => {
        const rect = canvas!.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const clickY = e.clientY - rect.top
        const cw = canvas!.width
        const ch = canvas!.height
        const groundY = ch * 0.82

        // Check portal clicks first
        if (deps.switchTo) {
          for (const portal of gardenPortals) {
            if (isInsidePortal(clickX, clickY, portal, cw, ch)) {
              portal.clickFlash = 1
              const targetName = portal.name
              setTimeout(() => deps.switchTo!(targetName), 300)
              return
            }
          }
        }

        if (clickY > groundY && deps.onDescend) {
          deps.onDescend()
          return
        }

        // Check if clicked near a plant
        let clickedPlant: Plant | null = null
        let closestDist = 40 // max click distance
        for (const plant of plants) {
          const dist = Math.abs(clickX - plant.x)
          if (dist < closestDist && clickY < groundY) {
            closestDist = dist
            clickedPlant = plant
          }
        }

        if (clickedPlant) {
          // Show tooltip for this plant
          tooltip = {
            plant: clickedPlant,
            x: clickedPlant.x,
            y: groundY - 80,
            alpha: 1,
          }
        } else {
          // Water effect — click on ground near plants
          waterDrops.push({
            x: clickX,
            y: clickY,
            radius: 2,
            alpha: 0.4,
          })
          // Dismiss tooltip
          tooltip = null
        }
      })

      // Track mouse for hover effects
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas!.getBoundingClientRect()
        mouseX = e.clientX - rect.left
        mouseY = e.clientY - rect.top

        // Update portal hover states
        let anyPortalHovered = false
        if (deps.switchTo) {
          const cw = canvas!.width
          const ch = canvas!.height
          for (const portal of gardenPortals) {
            portal.hovered = isInsidePortal(mouseX, mouseY, portal, cw, ch)
            if (portal.hovered) anyPortalHovered = true
          }
        }
        canvas!.style.cursor = anyPortalHovered ? 'pointer' : 'default'
      })

      overlay.appendChild(canvas)

      // Handle resize
      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
          buildGarden()
        }
      }
      window.addEventListener('resize', onResize)

      return overlay
    },

    activate() {
      active = true
      // Reset new feature state
      mycorrhizalPulses = []
      mycorrhizalTimer = 0
      fallenLeaves = []
      leafDropTimer = 0
      fireflies = []
      sharedPlantsLoaded = false
      sharedPlants = []
      buildGarden()
      render()

      // Load shared plants from other visitors
      loadSharedPlants()

      // Initialize and fade in audio
      initAudio().then(() => {
        if (active) fadeAudioIn()
      })
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      fadeAudioOut()
      if (rustleLfoInterval) { clearInterval(rustleLfoInterval); rustleLfoInterval = null }
      if (witherInterval) { clearInterval(witherInterval); witherInterval = null }
      pollenParticles.length = 0
      mycorrhizalPulses = []
      fallenLeaves = []
      fireflies = []
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      destroyAudio()
      pollenParticles.length = 0
      mycorrhizalPulses = []
      fallenLeaves = []
      fireflies = []
      overlay?.remove()
    },
  }
}
