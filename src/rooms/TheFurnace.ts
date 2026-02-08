/**
 * THE FURNACE — active destruction of memories
 *
 * Every other room in Oubli is about passive decay. The Furnace is different:
 * here, you choose to destroy. You select a memory and feed it to the fire.
 * The text burns character by character, embers rise, and the memory is
 * permanently accelerated toward full degradation.
 *
 * This is cathartic. Sometimes forgetting isn't something that happens to you —
 * it's something you need to do. The furnace gives you that agency.
 *
 * The visual: a central fire rendered in canvas, memories listed as paper
 * fragments around it. Drag or click a memory into the fire. Watch it burn.
 * The fire grows larger the more you feed it.
 *
 * Inspired by: Book burning (as catharsis, not censorship), Japanese
 * oharai purification rituals, burning letters from ex-lovers,
 * the Phoenix myth, thermodynamics (entropy always increases),
 * Marie Kondo's "does it spark joy?" reframed as "does it still hurt?",
 * EMPAC "staging grounds" festival (Feb 2026) — Korakrit Arunanondchai's
 * thermal imaging installation where presence lingers as heat residue.
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface FurnaceDeps {
  getMemories: () => StoredMemory[]
  accelerateDegradation: (id: string, amount: number) => void
  switchTo?: (name: string) => void
}

interface Ember {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  hue: number
  char: string
}

interface BurningChar {
  char: string
  x: number
  y: number
  alpha: number
  burnPhase: number // 0→1
  hue: number
}

interface IronPortal {
  name: string
  label: string
  /** Position as fraction of canvas width/height */
  fx: number
  fy: number
  hue: number
  shape: 'tuning-fork' | 'gear' | 'hook' | 'star'
  glowIntensity: number
}

interface HeatPoint {
  x: number
  y: number
  timestamp: number
}

interface AshParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  rotation: number
  rotSpeed: number
  /** true = glowing ember, false = grey ash */
  isEmber: boolean
}

export function createFurnaceRoom(deps: FurnaceDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let embers: Ember[] = []
  let burningChars: BurningChar[] = []
  let fireIntensity = 0.3 // grows as you burn
  let selectedMemory: StoredMemory | null = null
  let burnProgress = 0
  let listEl: HTMLElement | null = null
  let statusEl: HTMLElement | null = null

  // --- Audio state ---
  let audioCtxRef: AudioContext | null = null
  let audioMaster: GainNode | null = null
  let droneOsc: OscillatorNode | null = null
  let droneGain: GainNode | null = null
  let droneFilter: BiquadFilterNode | null = null
  let crackleInterval: ReturnType<typeof setTimeout> | null = null
  let audioInitialized = false

  // --- Heat trail state (EMPAC thermal trace) ---
  const heatTrail: HeatPoint[] = []
  const HEAT_TRAIL_MAX = 100
  const HEAT_TRAIL_LIFETIME = 10000 // 10 seconds in ms

  // --- Floating ash/ember particles ---
  let ashParticles: AshParticle[] = []
  const ASH_COUNT_TARGET = 30

  // Iron brand portal navigation
  const ironPortals: IronPortal[] = [
    { name: 'disintegration', label: 'the disintegration loops', fx: 0.18, fy: 0.22, hue: 30, shape: 'tuning-fork', glowIntensity: 0 },
    { name: 'clocktower', label: 'the clock tower', fx: 0.82, fy: 0.22, hue: 42, shape: 'gear', glowIntensity: 0 },
    { name: 'well', label: 'the well', fx: 0.82, fy: 0.72, hue: 210, shape: 'hook', glowIntensity: 0 },
    { name: 'void', label: 'the void', fx: 0.18, fy: 0.72, hue: 300, shape: 'star', glowIntensity: 0 },
  ]
  let hoveredIron = -1
  let clickedIron = -1
  let clickedIronTime = 0
  let ironSparks: { x: number; y: number; vx: number; vy: number; alpha: number; hue: number }[] = []

  // --- Audio functions ---
  async function initAudio() {
    if (audioInitialized) return
    try {
      const ac = await getAudioContext()
      audioCtxRef = ac
      const dest = getAudioDestination()

      audioMaster = ac.createGain()
      audioMaster.gain.value = 0
      audioMaster.connect(dest)

      // Deep furnace drone — low sawtooth ~60Hz, heavily filtered
      droneOsc = ac.createOscillator()
      droneOsc.type = 'sawtooth'
      droneOsc.frequency.value = 60
      droneFilter = ac.createBiquadFilter()
      droneFilter.type = 'lowpass'
      droneFilter.frequency.value = 120
      droneFilter.Q.value = 2
      droneGain = ac.createGain()
      droneGain.gain.value = 0.06

      droneOsc.connect(droneFilter)
      droneFilter.connect(droneGain)
      droneGain.connect(audioMaster)
      droneOsc.start()

      // Fade master in
      audioMaster.gain.setTargetAtTime(1, ac.currentTime, 0.8)

      // Start crackling loop
      scheduleCrackle()

      audioInitialized = true
    } catch {
      /* audio init failed — room still works without sound */
    }
  }

  function scheduleCrackle() {
    if (!active || !audioCtxRef || !audioMaster) return
    const delay = 100 + Math.random() * 200 // 100-300ms
    crackleInterval = setTimeout(() => {
      if (!active || !audioCtxRef || !audioMaster) return
      playCrackle()
      scheduleCrackle()
    }, delay)
  }

  function playCrackle() {
    if (!audioCtxRef || !audioMaster) return
    const ac = audioCtxRef
    try {
      // Crackling: short burst of bandpass-filtered noise
      const bufferLen = Math.floor(ac.sampleRate * (0.02 + Math.random() * 0.04))
      const buffer = ac.createBuffer(1, bufferLen, ac.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferLen; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferLen)
      }

      const source = ac.createBufferSource()
      source.buffer = buffer

      const bandpass = ac.createBiquadFilter()
      bandpass.type = 'bandpass'
      bandpass.frequency.value = 800 + Math.random() * 1200 // 800-2000Hz
      bandpass.Q.value = 1 + Math.random() * 2

      const crackGain = ac.createGain()
      // Louder when burning
      const baseVol = 0.04 + fireIntensity * 0.06
      crackGain.gain.value = baseVol * (0.3 + Math.random() * 0.7)

      source.connect(bandpass)
      bandpass.connect(crackGain)
      crackGain.connect(audioMaster)
      source.start()
      source.onended = () => {
        source.disconnect()
        bandpass.disconnect()
        crackGain.disconnect()
      }
    } catch {
      /* ignore crackle errors */
    }
  }

  function playEmberSizzle() {
    if (!audioCtxRef || !audioMaster) return
    const ac = audioCtxRef
    try {
      // Brief high-frequency noise burst — sizzle on burn event
      const bufferLen = Math.floor(ac.sampleRate * 0.15)
      const buffer = ac.createBuffer(1, bufferLen, ac.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferLen; i++) {
        const env = Math.exp(-i / (bufferLen * 0.2))
        data[i] = (Math.random() * 2 - 1) * env
      }

      const source = ac.createBufferSource()
      source.buffer = buffer

      const hipass = ac.createBiquadFilter()
      hipass.type = 'highpass'
      hipass.frequency.value = 3000 + Math.random() * 2000
      hipass.Q.value = 0.7

      const sizzGain = ac.createGain()
      sizzGain.gain.value = 0.08

      source.connect(hipass)
      hipass.connect(sizzGain)
      sizzGain.connect(audioMaster)
      source.start()
      source.onended = () => {
        source.disconnect()
        hipass.disconnect()
        sizzGain.disconnect()
      }
    } catch {
      /* ignore sizzle errors */
    }
  }

  function updateAudioIntensity() {
    // Drone gets louder and filter opens when burning intensely
    if (!audioCtxRef || !droneGain || !droneFilter) return
    const t = audioCtxRef.currentTime
    const intensity = fireIntensity
    droneGain.gain.setTargetAtTime(0.06 + intensity * 0.08, t, 0.3)
    droneFilter.frequency.setTargetAtTime(120 + intensity * 180, t, 0.3)
  }

  function fadeAudioOut() {
    if (audioMaster && audioCtxRef) {
      audioMaster.gain.setTargetAtTime(0, audioCtxRef.currentTime, 0.4)
    }
    if (crackleInterval !== null) {
      clearTimeout(crackleInterval)
      crackleInterval = null
    }
  }

  function cleanupAudio() {
    if (crackleInterval !== null) {
      clearTimeout(crackleInterval)
      crackleInterval = null
    }
    try { droneOsc?.stop() } catch { /* already stopped */ }
    droneOsc?.disconnect()
    droneFilter?.disconnect()
    droneGain?.disconnect()
    audioMaster?.disconnect()
    droneOsc = null
    droneFilter = null
    droneGain = null
    audioMaster = null
    audioInitialized = false
    audioCtxRef = null
  }

  // --- Ash/ember particle helpers ---
  function spawnAshParticle() {
    if (!canvas) return
    const w = canvas.width
    const h = canvas.height
    const fireX = w / 2
    const fireY = h * 0.55
    const isEmber = Math.random() < 0.4
    ashParticles.push({
      x: fireX + (Math.random() - 0.5) * (60 + fireIntensity * 80),
      y: fireY - Math.random() * 30,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -0.3 - Math.random() * 0.8 - fireIntensity * 0.5,
      size: isEmber ? 1 + Math.random() * 2 : 2 + Math.random() * 3,
      alpha: isEmber ? 0.5 + Math.random() * 0.4 : 0.15 + Math.random() * 0.15,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.03,
      isEmber,
    })
  }

  // --- Heat trail rendering ---
  function renderHeatTrail() {
    if (!ctx || !canvas) return
    const now = Date.now()
    // Prune old heat points
    while (heatTrail.length > 0 && now - heatTrail[0].timestamp > HEAT_TRAIL_LIFETIME) {
      heatTrail.shift()
    }

    for (const pt of heatTrail) {
      const age = (now - pt.timestamp) / HEAT_TRAIL_LIFETIME // 0 = fresh, 1 = expired
      if (age >= 1) continue

      // Color transitions: fresh = bright orange-white → warm red → cool blue → black
      const radius = 12 + age * 8
      let r: number, g: number, b: number, a: number
      if (age < 0.2) {
        // Hot: orange-white
        const t = age / 0.2
        r = 255
        g = Math.floor(220 - t * 120)
        b = Math.floor(100 - t * 80)
        a = (1 - age) * 0.12
      } else if (age < 0.5) {
        // Warm: orange → red
        const t = (age - 0.2) / 0.3
        r = Math.floor(255 - t * 80)
        g = Math.floor(100 - t * 80)
        b = Math.floor(20 + t * 30)
        a = (1 - age) * 0.10
      } else {
        // Cooling: red → blue → black
        const t = (age - 0.5) / 0.5
        r = Math.floor(175 - t * 155)
        g = Math.floor(20 + t * 20)
        b = Math.floor(50 + t * 130)
        a = (1 - age) * 0.08
      }

      const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius)
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a})`)
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // --- Ash particles rendering ---
  function renderAshParticles() {
    if (!ctx) return
    for (let i = ashParticles.length - 1; i >= 0; i--) {
      const p = ashParticles[i]
      p.x += p.vx
      p.y += p.vy
      p.vx += (Math.random() - 0.5) * 0.05 // gentle drift
      p.vy -= 0.003 // slight upward acceleration
      p.alpha -= 0.001
      p.rotation += p.rotSpeed

      if (p.alpha <= 0 || p.y < -20) {
        ashParticles.splice(i, 1)
        continue
      }

      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)

      if (p.isEmber) {
        // Glowing ember — small bright dot
        ctx.beginPath()
        ctx.arc(0, 0, p.size, 0, Math.PI * 2)
        const hue = 20 + Math.random() * 20
        ctx.fillStyle = `hsla(${hue}, 90%, 60%, ${p.alpha})`
        ctx.fill()
        // Tiny glow
        ctx.beginPath()
        ctx.arc(0, 0, p.size * 2.5, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${hue}, 80%, 50%, ${p.alpha * 0.2})`
        ctx.fill()
      } else {
        // Grey ash flake — irregular shape
        ctx.beginPath()
        ctx.moveTo(-p.size * 0.5, -p.size * 0.3)
        ctx.lineTo(p.size * 0.3, -p.size * 0.5)
        ctx.lineTo(p.size * 0.5, p.size * 0.2)
        ctx.lineTo(-p.size * 0.2, p.size * 0.4)
        ctx.closePath()
        ctx.fillStyle = `rgba(120, 110, 100, ${p.alpha})`
        ctx.fill()
      }

      ctx.restore()
    }

    // Spawn new particles to maintain count
    while (ashParticles.length < ASH_COUNT_TARGET) {
      spawnAshParticle()
    }
  }

  // --- Heat shimmer effect ---
  function renderHeatShimmer() {
    if (!ctx || !canvas) return
    const w = canvas.width
    const h = canvas.height
    const fireX = w / 2
    const fireY = h * 0.55
    // Very subtle: thin vertical distortion bands above the fire
    const shimmerCount = 3 + Math.floor(fireIntensity * 4)
    for (let i = 0; i < shimmerCount; i++) {
      const sx = fireX + (Math.random() - 0.5) * (40 + fireIntensity * 60)
      const sy = fireY - 40 - Math.random() * (80 + fireIntensity * 60)
      const sw = 2 + Math.random() * 4
      const sh = 15 + Math.random() * 25
      const shimmerAlpha = 0.01 + fireIntensity * 0.015
      ctx.fillStyle = `rgba(255, 200, 120, ${shimmerAlpha})`
      ctx.fillRect(sx, sy, sw, sh)
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height
    const fireX = w / 2
    const fireY = h * 0.55

    ctx.clearRect(0, 0, w, h)

    // Background — dark with warm undertone
    const bg = ctx.createRadialGradient(fireX, fireY, 0, fireX, fireY, h)
    bg.addColorStop(0, `rgba(30, 10, 5, ${0.95 - fireIntensity * 0.1})`)
    bg.addColorStop(0.4, 'rgba(15, 5, 2, 0.98)')
    bg.addColorStop(1, 'rgba(5, 2, 1, 1)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // Heat trail — EMPAC thermal trace (render before fire so fire draws over it)
    renderHeatTrail()

    // Fire glow on ground
    ctx.beginPath()
    ctx.ellipse(fireX, fireY + 40, 80 + fireIntensity * 40, 15, 0, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 80, 20, ${0.03 + fireIntensity * 0.04})`
    ctx.fill()

    // Fire — layered flame shapes
    const flameCount = 8 + Math.floor(fireIntensity * 12)
    for (let i = 0; i < flameCount; i++) {
      const seed = i * 137.5
      const phase = time * 3 + seed
      const sway = Math.sin(phase) * (8 + fireIntensity * 15)
      const flameH = (40 + Math.sin(phase * 0.7) * 15) * (0.5 + fireIntensity * 0.8)
      const flameW = 6 + Math.sin(phase * 1.3) * 3 + fireIntensity * 8
      const baseX = fireX + (Math.sin(seed) * 20 * fireIntensity)

      // Inner flame (yellow-white)
      ctx.beginPath()
      ctx.moveTo(baseX - flameW * 0.3 + sway * 0.5, fireY)
      ctx.quadraticCurveTo(
        baseX + sway, fireY - flameH * 0.8,
        baseX + sway * 0.3, fireY - flameH
      )
      ctx.quadraticCurveTo(
        baseX + sway, fireY - flameH * 0.5,
        baseX + flameW * 0.3 + sway * 0.5, fireY
      )
      ctx.closePath()
      const innerAlpha = 0.03 + fireIntensity * 0.04
      ctx.fillStyle = `rgba(255, 200, 80, ${innerAlpha})`
      ctx.fill()

      // Outer flame (orange-red)
      ctx.beginPath()
      ctx.moveTo(baseX - flameW + sway * 0.3, fireY + 5)
      ctx.quadraticCurveTo(
        baseX + sway * 1.2, fireY - flameH * 1.1,
        baseX + sway * 0.5, fireY - flameH * 1.3
      )
      ctx.quadraticCurveTo(
        baseX + sway * 1.2, fireY - flameH * 0.7,
        baseX + flameW + sway * 0.3, fireY + 5
      )
      ctx.closePath()
      ctx.fillStyle = `rgba(255, 60, 10, ${innerAlpha * 0.6})`
      ctx.fill()
    }

    // Fire base glow
    ctx.beginPath()
    ctx.arc(fireX, fireY, 20 + fireIntensity * 30, 0, Math.PI * 2)
    const glow = ctx.createRadialGradient(
      fireX, fireY, 0,
      fireX, fireY, 20 + fireIntensity * 30
    )
    glow.addColorStop(0, `rgba(255, 150, 50, ${0.1 + fireIntensity * 0.15})`)
    glow.addColorStop(1, 'rgba(255, 50, 10, 0)')
    ctx.fillStyle = glow
    ctx.fill()

    // Heat shimmer — subtle distortion above fire
    renderHeatShimmer()

    // Floating ash and embers
    renderAshParticles()

    // Update audio intensity each frame
    updateAudioIntensity()

    // Burning characters — text that's actively disintegrating
    for (let i = burningChars.length - 1; i >= 0; i--) {
      const bc = burningChars[i]
      bc.burnPhase += 0.008 + fireIntensity * 0.005
      bc.alpha -= 0.005

      if (bc.burnPhase >= 1 || bc.alpha <= 0) {
        // Character is fully burned — spawn embers
        for (let e = 0; e < 2; e++) {
          embers.push({
            x: bc.x, y: bc.y,
            vx: (Math.random() - 0.5) * 2,
            vy: -1 - Math.random() * 3,
            size: 1 + Math.random() * 2,
            alpha: 0.5 + Math.random() * 0.3,
            hue: bc.hue,
            char: bc.char,
          })
        }
        burningChars.splice(i, 1)
        continue
      }

      // Draw burning character
      const burnColor = bc.burnPhase < 0.3
        ? `rgba(255, 200, 100, ${bc.alpha})`    // bright yellow
        : bc.burnPhase < 0.6
        ? `rgba(255, 100, 30, ${bc.alpha * 0.8})` // orange
        : `rgba(200, 50, 10, ${bc.alpha * 0.5})`  // dark red ember

      ctx.font = `${14 - bc.burnPhase * 4}px "Cormorant Garamond", serif`
      ctx.fillStyle = burnColor
      ctx.textAlign = 'center'
      // Jitter as it burns
      const jx = (Math.random() - 0.5) * bc.burnPhase * 6
      const jy = (Math.random() - 0.5) * bc.burnPhase * 4 - bc.burnPhase * 20
      ctx.fillText(bc.char, bc.x + jx, bc.y + jy)
    }

    // Embers — rise and fade
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i]
      e.vy -= 0.02 // rise
      e.vx += (Math.random() - 0.5) * 0.1
      e.x += e.vx
      e.y += e.vy
      e.alpha -= 0.004
      e.size *= 0.998

      if (e.alpha <= 0 || e.y < -20) {
        embers.splice(i, 1)
        continue
      }

      ctx.beginPath()
      ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${e.hue}, 80%, 60%, ${e.alpha})`
      ctx.fill()
    }

    // Keep embers manageable
    if (embers.length > 200) embers.splice(0, 50)

    // Fire slowly dies down
    fireIntensity *= 0.9995
    if (fireIntensity < 0.3) fireIntensity = 0.3

    // Title
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(255, 150, 80, ${0.1 + Math.sin(time * 0.3) * 0.03})`
    ctx.textAlign = 'center'
    ctx.fillText('the furnace', w / 2, 30)

    // Burn progress indicator
    if (selectedMemory && burnProgress > 0 && burnProgress < 1) {
      const barW = 200
      const barX = w / 2 - barW / 2
      const barY = h * 0.82
      ctx.fillStyle = 'rgba(80, 30, 10, 0.3)'
      ctx.fillRect(barX, barY, barW, 3)
      ctx.fillStyle = `rgba(255, ${150 - burnProgress * 100}, ${50 - burnProgress * 50}, 0.6)`
      ctx.fillRect(barX, barY, barW * burnProgress, 3)
    }

    // --- Iron brand portal navigation ---
    if (deps.switchTo) {
      for (let pi = 0; pi < ironPortals.length; pi++) {
        const p = ironPortals[pi]
        const px = p.fx * w
        const py = p.fy * h
        const isHovered = hoveredIron === pi
        const isClicked = clickedIron === pi

        // Interpolate glow intensity toward target
        const targetGlow = isClicked ? 1 : isHovered ? 0.7 : 0
        p.glowIntensity += (targetGlow - p.glowIntensity) * 0.08

        // Base pulse synced with fire
        const basePulse = 0.08 + fireIntensity * 0.12 + Math.sin(time * 1.5 + pi * 1.7) * 0.03
        const intensity = basePulse + p.glowIntensity * 0.8

        // Color: dark iron at rest, orange when warm, white-hot when clicked
        const warmth = p.glowIntensity
        const r = Math.floor(60 + warmth * 195)
        const g = Math.floor(25 + warmth * (warmth > 0.8 ? 175 : 95))
        const b = Math.floor(15 + warmth * (warmth > 0.8 ? 140 : 20))

        // Outer glow
        if (intensity > 0.1) {
          ctx.save()
          ctx.shadowColor = `hsla(${p.hue}, 80%, ${40 + warmth * 30}%, ${intensity * 0.6})`
          ctx.shadowBlur = 12 + warmth * 20
          ctx.restore()
        }

        // Draw the shape
        const sz = 18
        ctx.save()
        ctx.translate(px, py)
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${intensity})`
        ctx.lineWidth = 1.5 + warmth * 1
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        // Apply glow via shadow on the context
        if (warmth > 0.1) {
          ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${warmth * 0.5})`
          ctx.shadowBlur = 8 + warmth * 16
        }

        ctx.beginPath()
        if (p.shape === 'tuning-fork') {
          // Two prongs + handle
          ctx.moveTo(-5, -sz)
          ctx.lineTo(-5, -sz * 0.3)
          ctx.quadraticCurveTo(-5, 0, 0, 0)
          ctx.quadraticCurveTo(5, 0, 5, -sz * 0.3)
          ctx.lineTo(5, -sz)
          ctx.moveTo(0, 0)
          ctx.lineTo(0, sz)
        } else if (p.shape === 'gear') {
          // Cog outline — 6 teeth around a circle
          const teeth = 6
          const outerR = sz * 0.7
          const innerR = sz * 0.45
          for (let t = 0; t < teeth; t++) {
            const a1 = (t / teeth) * Math.PI * 2 - Math.PI / 2
            const a2 = ((t + 0.35) / teeth) * Math.PI * 2 - Math.PI / 2
            const a3 = ((t + 0.65) / teeth) * Math.PI * 2 - Math.PI / 2
            const a4 = ((t + 1) / teeth) * Math.PI * 2 - Math.PI / 2
            if (t === 0) {
              ctx.moveTo(Math.cos(a1) * outerR, Math.sin(a1) * outerR)
            }
            ctx.lineTo(Math.cos(a2) * outerR, Math.sin(a2) * outerR)
            ctx.lineTo(Math.cos(a2) * innerR, Math.sin(a2) * innerR)
            ctx.lineTo(Math.cos(a3) * innerR, Math.sin(a3) * innerR)
            ctx.lineTo(Math.cos(a3) * outerR, Math.sin(a3) * outerR)
            ctx.lineTo(Math.cos(a4) * outerR, Math.sin(a4) * outerR)
          }
          ctx.closePath()
          // Center dot
          ctx.moveTo(3, 0)
          ctx.arc(0, 0, 3, 0, Math.PI * 2)
        } else if (p.shape === 'hook') {
          // Hook with chain links
          ctx.moveTo(0, -sz)
          ctx.lineTo(0, -sz * 0.3)
          ctx.quadraticCurveTo(0, sz * 0.3, -sz * 0.4, sz * 0.5)
          ctx.quadraticCurveTo(-sz * 0.5, sz * 0.7, -sz * 0.15, sz * 0.7)
          // Chain links above
          ctx.moveTo(-2, -sz)
          ctx.ellipse(0, -sz - 4, 3, 4, 0, 0, Math.PI * 2)
          ctx.moveTo(-2, -sz - 8)
          ctx.ellipse(0, -sz - 12, 3, 4, 0, 0, Math.PI * 2)
        } else if (p.shape === 'star') {
          // Spike star — 5 sharp points
          const spikes = 5
          const outerR = sz * 0.7
          const innerR = sz * 0.25
          for (let s = 0; s < spikes * 2; s++) {
            const angle = (s / (spikes * 2)) * Math.PI * 2 - Math.PI / 2
            const r2 = s % 2 === 0 ? outerR : innerR
            if (s === 0) ctx.moveTo(Math.cos(angle) * r2, Math.sin(angle) * r2)
            else ctx.lineTo(Math.cos(angle) * r2, Math.sin(angle) * r2)
          }
          ctx.closePath()
        }
        ctx.stroke()

        // Label (visible on hover/click)
        if (warmth > 0.05) {
          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
          ctx.font = '10px "Cormorant Garamond", serif'
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${warmth * 0.7})`
          ctx.textAlign = 'center'
          ctx.fillText(p.label, 0, sz + 16)
        }

        ctx.restore()
      }

      // Iron sparks (from clicked brand)
      for (let si = ironSparks.length - 1; si >= 0; si--) {
        const s = ironSparks[si]
        s.x += s.vx
        s.y += s.vy
        s.vy += 0.05 // gravity
        s.alpha -= 0.02
        if (s.alpha <= 0) {
          ironSparks.splice(si, 1)
          continue
        }
        ctx.beginPath()
        ctx.arc(s.x, s.y, 1.2, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${s.hue}, 90%, 70%, ${s.alpha})`
        ctx.fill()
      }

      // Handle delayed navigation after click
      if (clickedIron >= 0 && time - clickedIronTime > 0.4) {
        const target = ironPortals[clickedIron].name
        clickedIron = -1
        deps.switchTo!(target)
      }
    }
  }

  function startBurn(memory: StoredMemory) {
    if (!canvas) return
    selectedMemory = memory
    burnProgress = 0
    const w = canvas.width
    const fireY = canvas.height * 0.55

    // Ember sizzle on burn start
    playEmberSizzle()

    // Place characters in an arc above the fire
    const text = memory.currentText
    const chars = text.split('')
    const startX = w / 2 - (chars.length * 7) / 2
    const textY = fireY - 60

    for (let i = 0; i < chars.length; i++) {
      burningChars.push({
        char: chars[i],
        x: startX + i * 7,
        y: textY + Math.sin(i * 0.3) * 5,
        alpha: 0.8,
        burnPhase: 0,
        hue: 30 + (memory.hue || 0) * 30,
      })
    }

    // Stagger the burn — characters don't all burn at once
    const burnInterval = setInterval(() => {
      burnProgress += 0.02
      fireIntensity = Math.min(1, fireIntensity + 0.01)

      // Occasional sizzle during active burn
      if (Math.random() < 0.15) playEmberSizzle()

      if (burnProgress >= 1) {
        clearInterval(burnInterval)
        // Accelerate degradation on the actual memory
        deps.accelerateDegradation(memory.id, 0.3)
        selectedMemory = null
        // Final sizzle
        playEmberSizzle()
        if (statusEl) {
          statusEl.textContent = 'it is done. the fire remembers nothing.'
          setTimeout(() => {
            if (statusEl) statusEl.textContent = ''
          }, 4000)
        }
        rebuildList()
      }
    }, 100)
  }

  function rebuildList() {
    if (!listEl) return
    listEl.innerHTML = ''
    const memories = deps.getMemories()
    const burnable = memories.filter(m => m.degradation < 0.9)

    if (burnable.length === 0) {
      const empty = document.createElement('div')
      empty.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-size: 12px; font-style: italic;
        color: rgba(255, 150, 80, 0.15);
        text-align: center; padding: 20px;
      `
      empty.textContent = 'nothing left to burn.'
      listEl.appendChild(empty)
      return
    }

    for (const mem of burnable.slice(0, 15)) {
      const item = document.createElement('div')
      item.style.cssText = `
        padding: 8px 12px;
        border-bottom: 1px solid rgba(255, 80, 20, 0.05);
        cursor: pointer;
        transition: background 0.3s ease;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `
      item.addEventListener('mouseenter', () => {
        item.style.background = 'rgba(255, 60, 10, 0.08)'
        item.style.boxShadow = 'inset 0 0 20px rgba(255, 80, 20, 0.06)'
        textEl.style.color = 'rgba(255, 200, 120, 0.55)'
      })
      item.addEventListener('mouseleave', () => {
        item.style.background = 'transparent'
        item.style.boxShadow = 'none'
        textEl.style.color = 'rgba(255, 180, 100, 0.35)'
      })

      const textEl = document.createElement('div')
      textEl.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-size: 12px;
        color: rgba(255, 180, 100, 0.35);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 250px;
      `
      textEl.textContent = mem.currentText
      item.appendChild(textEl)

      const burnBtn = document.createElement('span')
      burnBtn.style.cssText = `
        font-family: monospace;
        font-size: 12px;
        color: rgba(255, 60, 10, 0.25);
        cursor: pointer;
        padding: 2px 8px;
        border: 1px solid rgba(255, 60, 10, 0.1);
        transition: all 0.3s ease;
        white-space: nowrap;
      `
      burnBtn.textContent = 'burn'
      burnBtn.addEventListener('mouseenter', () => {
        burnBtn.style.borderColor = 'rgba(255, 60, 10, 0.5)'
        burnBtn.style.color = 'rgba(255, 60, 10, 0.7)'
      })
      burnBtn.addEventListener('mouseleave', () => {
        burnBtn.style.borderColor = 'rgba(255, 60, 10, 0.1)'
        burnBtn.style.color = 'rgba(255, 60, 10, 0.25)'
      })
      burnBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        if (!selectedMemory) {
          startBurn(mem)
        }
      })
      item.appendChild(burnBtn)

      listEl.appendChild(item)
    }
  }

  return {
    name: 'furnace',
    label: 'the furnace',

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        width: 100%; height: 100%;
        pointer-events: auto;
        background: #000;
        display: flex;
        flex-direction: column;
        align-items: center;
      `

      canvas = document.createElement('canvas')
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      canvas.style.cssText = `
        position: absolute; top: 0; left: 0;
        width: 100%; height: 100%;
        pointer-events: none;
      `
      ctx = canvas.getContext('2d')
      overlay.appendChild(canvas)

      // Memory list — right side panel
      const panel = document.createElement('div')
      panel.style.cssText = `
        position: absolute;
        right: 20px; top: 60px;
        width: 320px; max-width: 40vw;
        max-height: 70vh;
        overflow-y: auto;
        scrollbar-width: none;
        z-index: 2;
        pointer-events: auto;
      `

      const panelTitle = document.createElement('div')
      panelTitle.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 13px;
        color: rgba(255, 150, 80, 0.2);
        letter-spacing: 3px;
        text-transform: uppercase;
        margin-bottom: 12px;
        padding: 0 12px;
      `
      panelTitle.textContent = 'choose what to forget'
      panel.appendChild(panelTitle)

      listEl = document.createElement('div')
      panel.appendChild(listEl)
      overlay.appendChild(panel)

      // Status
      statusEl = document.createElement('div')
      statusEl.style.cssText = `
        position: absolute;
        bottom: 40px; left: 0; right: 0;
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 12px; font-style: italic;
        color: rgba(255, 150, 80, 0.2);
        text-align: center;
        z-index: 2;
        pointer-events: none;
      `
      overlay.appendChild(statusEl)

      // Hint
      const hint = document.createElement('div')
      hint.style.cssText = `
        position: absolute;
        bottom: 20px; left: 0; right: 0;
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 12px;
        color: rgba(255, 100, 50, 0.08);
        text-align: center;
        z-index: 2;
        pointer-events: none;
      `
      hint.textContent = 'some things are easier to let go of than others'
      overlay.appendChild(hint)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      // Cursor tracking for heat trail — EMPAC thermal trace
      overlay.addEventListener('mousemove', (e) => {
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const mx = (e.clientX - rect.left) * (canvas.width / rect.width)
        const my = (e.clientY - rect.top) * (canvas.height / rect.height)

        // Record heat trail point
        heatTrail.push({ x: mx, y: my, timestamp: Date.now() })
        if (heatTrail.length > HEAT_TRAIL_MAX) {
          heatTrail.shift()
        }
      })

      // Iron brand portal — mouse interaction via overlay
      if (deps.switchTo) {
        const hitRadius = 28
        overlay.addEventListener('mousemove', (e) => {
          if (!canvas) return
          const rect = canvas.getBoundingClientRect()
          const mx = (e.clientX - rect.left) * (canvas.width / rect.width)
          const my = (e.clientY - rect.top) * (canvas.height / rect.height)
          hoveredIron = -1
          for (let i = 0; i < ironPortals.length; i++) {
            const p = ironPortals[i]
            const px = p.fx * canvas.width
            const py = p.fy * canvas.height
            const dx = mx - px
            const dy = my - py
            if (dx * dx + dy * dy < hitRadius * hitRadius) {
              hoveredIron = i
              break
            }
          }
          overlay!.style.cursor = hoveredIron >= 0 ? 'pointer' : ''
        })
        overlay.addEventListener('click', (e) => {
          if (hoveredIron < 0 || clickedIron >= 0 || !canvas) return
          // Don't intercept clicks on the panel area
          const target = e.target as HTMLElement
          if (target !== overlay && target !== canvas) return
          clickedIron = hoveredIron
          clickedIronTime = time
          // Spawn sparks from the brand
          const p = ironPortals[clickedIron]
          const px = p.fx * canvas.width
          const py = p.fy * canvas.height
          for (let s = 0; s < 20; s++) {
            const angle = Math.random() * Math.PI * 2
            const speed = 1 + Math.random() * 4
            ironSparks.push({
              x: px, y: py,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 1,
              alpha: 0.6 + Math.random() * 0.4,
              hue: p.hue,
            })
          }
        })
      }

      return overlay
    },

    activate() {
      active = true
      embers = []
      burningChars = []
      fireIntensity = 0.3
      hoveredIron = -1
      clickedIron = -1
      ironSparks = []
      ashParticles = []
      heatTrail.length = 0
      for (const p of ironPortals) p.glowIntensity = 0
      rebuildList()
      initAudio()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      fadeAudioOut()
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      cleanupAudio()
      overlay?.remove()
    },
  }
}
