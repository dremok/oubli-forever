/**
 * THE AQUIFER — underground water where memories dissolve and mingle
 *
 * A hidden room beneath The Well. Accessible when the well's water
 * level is high enough (drop enough memories). The aquifer is where
 * all dropped memories end up — a vast underground lake where text
 * fragments float, dissolve, and recombine in the water.
 *
 * The aesthetic is deep underwater: dark blues, bioluminescent glows,
 * text fragments drifting in currents. Memories from the well are
 * mixed together — you can't tell which came from which original.
 *
 * A passage leads to The Tide Pool — the aquifer feeds the ocean.
 * Another passage leads back up to The Well.
 *
 * Inspired by: Underground rivers, the water table, aquatic caves,
 * the collective unconscious (Jung), how memories blend together
 * over time, the water cycle as a metaphor for memory recycling
 *
 * Deepened with: underwater audio (drone, bubbles, water pressure),
 * depth zones (surface/midwater/depths), bioluminescence (cursor trails,
 * spontaneous pulses, click bursts), fragment catching mechanic,
 * water surface effect with light rays from above
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface AquiferDeps {
  getMemories: () => StoredMemory[]
  toWell: () => void
  toTidePool: () => void
  switchTo?: (name: string) => void
}

interface FloatingFragment {
  text: string
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  size: number
  hue: number
  // Bioluminescence glow (0-1), decays over time
  glow: number
}

interface Bubble {
  x: number
  y: number
  vy: number
  size: number
  alpha: number
}

interface GlowTrail {
  x: number
  y: number
  alpha: number
}

interface BurstParticle {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  size: number
}

interface CurrentParticle {
  x: number
  y: number
  alpha: number
  speed: number
  phase: number  // for sinusoidal wobble
  size: number
}

export function createAquiferRoom(deps: AquiferDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let fragments: FloatingFragment[] = []
  let bubbles: Bubble[] = []
  let mouseX = 0
  let mouseY = 0
  let prevMouseX = 0
  let prevMouseY = 0
  let mouseSpeed = 0

  // Water current navigation streams
  let wellCurrentParticles: CurrentParticle[] = []
  let tidepoolCurrentParticles: CurrentParticle[] = []
  let hoveredCurrent: 'well' | 'tidepool' | null = null

  // Bioluminescence trails and burst particles
  let glowTrails: GlowTrail[] = []
  let burstParticles: BurstParticle[] = []

  // Fragment catching
  let caughtFragment: FloatingFragment | null = null
  let caughtTimer = 0
  let caughtDisplayText = ''

  // Audio nodes
  let audioInitialized = false
  let audioCtxRef: AudioContext | null = null
  let masterVol: GainNode | null = null
  let droneOsc: OscillatorNode | null = null
  let droneOsc2: OscillatorNode | null = null
  let droneGain: GainNode | null = null
  let droneLowpass: BiquadFilterNode | null = null
  let pressureSource: AudioBufferSourceNode | null = null
  let pressureGain: GainNode | null = null
  let pressureLowpass: BiquadFilterNode | null = null
  let swishSource: AudioBufferSourceNode | null = null
  let swishGain: GainNode | null = null
  let swishBandpass: BiquadFilterNode | null = null

  // --- Depth zone helpers ---
  // Returns 0.0 (surface) to 1.0 (depths) based on y position
  function getDepthFactor(y: number, h: number): number {
    return Math.min(1, Math.max(0, y / h))
  }

  // Returns 'surface' | 'midwater' | 'depths'
  function getZone(y: number, h: number): string {
    const ratio = y / h
    if (ratio < 0.2) return 'surface'
    if (ratio < 0.8) return 'midwater'
    return 'depths'
  }

  // Speed multiplier based on depth: surface=1.4, mid=1.0, depths=0.6
  function depthSpeedFactor(y: number, h: number): number {
    const d = getDepthFactor(y, h)
    return 1.4 - d * 0.8
  }

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
      // Fade in
      masterVol.gain.setTargetAtTime(1, ac.currentTime, 0.5)

      // --- Deep drone: two slightly detuned low sines ---
      droneGain = ac.createGain()
      droneGain.gain.value = 0.04
      droneLowpass = ac.createBiquadFilter()
      droneLowpass.type = 'lowpass'
      droneLowpass.frequency.value = 120
      droneLowpass.Q.value = 1
      droneGain.connect(droneLowpass)
      droneLowpass.connect(masterVol)

      droneOsc = ac.createOscillator()
      droneOsc.type = 'sine'
      droneOsc.frequency.value = 50
      droneOsc.connect(droneGain)
      droneOsc.start()

      droneOsc2 = ac.createOscillator()
      droneOsc2.type = 'sine'
      droneOsc2.frequency.value = 50.7 // slight detune for beating
      droneOsc2.connect(droneGain)
      droneOsc2.start()

      // --- Water pressure: brown noise through tight lowpass ---
      const brownBuffer = createBrownNoise(ac, 4)
      pressureGain = ac.createGain()
      pressureGain.gain.value = 0.025
      pressureLowpass = ac.createBiquadFilter()
      pressureLowpass.type = 'lowpass'
      pressureLowpass.frequency.value = 100
      pressureLowpass.Q.value = 0.7
      pressureGain.connect(pressureLowpass)
      pressureLowpass.connect(masterVol)

      pressureSource = ac.createBufferSource()
      pressureSource.buffer = brownBuffer
      pressureSource.loop = true
      pressureSource.connect(pressureGain)
      pressureSource.start()

      // --- Swish: white noise through bandpass, volume controlled by mouse speed ---
      const swishBuffer = createWhiteNoise(ac, 2)
      swishGain = ac.createGain()
      swishGain.gain.value = 0 // controlled by mouse speed
      swishBandpass = ac.createBiquadFilter()
      swishBandpass.type = 'bandpass'
      swishBandpass.frequency.value = 800
      swishBandpass.Q.value = 2
      swishGain.connect(swishBandpass)
      swishBandpass.connect(masterVol)

      swishSource = ac.createBufferSource()
      swishSource.buffer = swishBuffer
      swishSource.loop = true
      swishSource.connect(swishGain)
      swishSource.start()
    } catch (_) {
      /* audio not available */
    }
  }

  function createBrownNoise(ac: AudioContext, seconds: number): AudioBuffer {
    const length = ac.sampleRate * seconds
    const buffer = ac.createBuffer(1, length, ac.sampleRate)
    const data = buffer.getChannelData(0)
    let lastOut = 0
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      lastOut = (lastOut + 0.02 * white) / 1.02
      data[i] = lastOut * 3.5
    }
    return buffer
  }

  function createWhiteNoise(ac: AudioContext, seconds: number): AudioBuffer {
    const length = ac.sampleRate * seconds
    const buffer = ac.createBuffer(1, length, ac.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1
    }
    return buffer
  }

  function playBubblePop() {
    if (!audioCtxRef || !masterVol) return
    try {
      const ac = audioCtxRef
      const freq = 2000 + Math.random() * 2000
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const g = ac.createGain()
      g.gain.value = 0.008 + Math.random() * 0.006
      g.gain.setTargetAtTime(0, ac.currentTime + 0.02, 0.015)
      osc.connect(g)
      g.connect(masterVol)
      osc.start()
      osc.stop(ac.currentTime + 0.08)
    } catch (_) { /* */ }
  }

  function updateAudioForDepth() {
    if (!audioCtxRef || !droneOsc || !droneOsc2 || !droneLowpass) return
    const h = canvas?.height || window.innerHeight
    const depthFactor = getDepthFactor(mouseY, h)
    // Drone pitch: 50Hz at depths, 65Hz at surface
    const basePitch = 50 + (1 - depthFactor) * 15
    const t = audioCtxRef.currentTime
    droneOsc.frequency.setTargetAtTime(basePitch, t, 0.3)
    droneOsc2.frequency.setTargetAtTime(basePitch + 0.7, t, 0.3)
    // Lowpass opens slightly at surface
    droneLowpass.frequency.setTargetAtTime(120 + (1 - depthFactor) * 40, t, 0.3)
  }

  function updateSwish() {
    if (!audioCtxRef || !swishGain) return
    // Volume proportional to mouse speed, capped
    const vol = Math.min(0.03, mouseSpeed * 0.002)
    swishGain.gain.setTargetAtTime(vol, audioCtxRef.currentTime, 0.05)
  }

  function stopAudio() {
    if (masterVol && audioCtxRef) {
      masterVol.gain.setTargetAtTime(0, audioCtxRef.currentTime, 0.3)
    }
  }

  function destroyAudio() {
    stopAudio()
    try {
      droneOsc?.stop()
      droneOsc2?.stop()
      pressureSource?.stop()
      swishSource?.stop()
    } catch (_) { /* already stopped */ }
    droneOsc = null
    droneOsc2 = null
    droneGain = null
    droneLowpass = null
    pressureSource = null
    pressureGain = null
    pressureLowpass = null
    swishSource = null
    swishGain = null
    swishBandpass = null
    masterVol = null
    audioCtxRef = null
    audioInitialized = false
  }

  // --- Fragment shattering ---
  function shatterMemories() {
    fragments = []
    const memories = deps.getMemories()
    if (memories.length === 0) return

    const w = canvas?.width || window.innerWidth
    const h = canvas?.height || window.innerHeight

    // Take words from all memories, shuffle them
    const allWords: { word: string; hue: number }[] = []
    for (const mem of memories) {
      const words = mem.currentText.split(/\s+/).filter(w => w.length > 2)
      for (const word of words) {
        allWords.push({ word, hue: mem.hue })
      }
    }

    // Create floating fragments from random combinations
    const fragCount = Math.min(allWords.length, 40)
    for (let i = 0; i < fragCount; i++) {
      const wordData = allWords[Math.floor(Math.random() * allWords.length)]
      // Sometimes combine 2-3 words
      let text = wordData.word
      if (Math.random() < 0.4 && allWords.length > 1) {
        const other = allWords[Math.floor(Math.random() * allWords.length)]
        text = `${wordData.word} ${other.word}`
      }

      fragments.push({
        text,
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.2,
        alpha: 0.1 + Math.random() * 0.2,
        size: 10 + Math.random() * 6,
        hue: wordData.hue * 360,
        glow: 0,
      })
    }
  }

  // --- Water surface drawing ---
  function drawWaterSurface(w: number, h: number) {
    if (!ctx) return
    // Wavy surface line at the very top — as if looking up from underwater
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(0, 0)
    for (let x = 0; x <= w; x += 4) {
      const waveY = 12 + Math.sin(x * 0.015 + time * 0.8) * 5
        + Math.sin(x * 0.03 + time * 1.2) * 3
        + Math.sin(x * 0.007 + time * 0.4) * 4
      ctx.lineTo(x, waveY)
    }
    ctx.lineTo(w, 0)
    ctx.closePath()
    // Above the surface line: lighter, like sky through water
    const surfGrad = ctx.createLinearGradient(0, 0, 0, 25)
    surfGrad.addColorStop(0, 'rgba(60, 130, 180, 0.08)')
    surfGrad.addColorStop(1, 'rgba(20, 60, 100, 0)')
    ctx.fillStyle = surfGrad
    ctx.fill()

    // Surface line itself — bright rippling edge
    ctx.beginPath()
    for (let x = 0; x <= w; x += 4) {
      const waveY = 12 + Math.sin(x * 0.015 + time * 0.8) * 5
        + Math.sin(x * 0.03 + time * 1.2) * 3
        + Math.sin(x * 0.007 + time * 0.4) * 4
      if (x === 0) ctx.moveTo(x, waveY)
      else ctx.lineTo(x, waveY)
    }
    ctx.strokeStyle = `rgba(120, 200, 240, ${0.08 + Math.sin(time * 0.6) * 0.02})`
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()
  }

  // --- Light rays from surface ---
  function drawLightRays(w: number, h: number) {
    if (!ctx) return
    ctx.save()
    for (let i = 0; i < 5; i++) {
      const baseX = w * (0.15 + i * 0.18) + Math.sin(time * 0.15 + i * 1.3) * 30
      const spread = 40 + Math.sin(time * 0.2 + i * 0.7) * 15
      const alpha = 0.012 + Math.sin(time * 0.25 + i * 2) * 0.004

      ctx.beginPath()
      ctx.moveTo(baseX - spread * 0.3, 0)
      ctx.lineTo(baseX + spread * 0.3, 0)
      ctx.lineTo(baseX + spread * 2, h * 0.6)
      ctx.lineTo(baseX - spread * 0.5, h * 0.6)
      ctx.closePath()

      const rayGrad = ctx.createLinearGradient(baseX, 0, baseX, h * 0.6)
      rayGrad.addColorStop(0, `rgba(100, 180, 220, ${alpha})`)
      rayGrad.addColorStop(0.5, `rgba(60, 140, 200, ${alpha * 0.4})`)
      rayGrad.addColorStop(1, 'rgba(40, 100, 160, 0)')
      ctx.fillStyle = rayGrad
      ctx.fill()
    }
    ctx.restore()
  }

  // --- Depth zone background coloring ---
  function drawDepthZones(w: number, h: number) {
    if (!ctx) return
    // Base gradient with zone differences
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    // Surface zone (top 20%): slightly lighter
    bg.addColorStop(0, 'rgba(5, 15, 35, 1)')
    bg.addColorStop(0.15, 'rgba(4, 12, 28, 1)')
    // Midwater (20-80%): standard deep blue
    bg.addColorStop(0.2, 'rgba(3, 10, 25, 1)')
    bg.addColorStop(0.5, 'rgba(3, 12, 30, 1)')
    bg.addColorStop(0.8, 'rgba(2, 8, 22, 1)')
    // Depths (bottom 20%): darkest, near black
    bg.addColorStop(0.85, 'rgba(1, 5, 14, 1)')
    bg.addColorStop(1, 'rgba(1, 3, 10, 1)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
  }

  // --- Bioluminescence ---
  function updateGlowTrails() {
    // Add trail point if mouse is moving
    if (mouseSpeed > 1) {
      glowTrails.push({ x: mouseX, y: mouseY, alpha: Math.min(0.25, mouseSpeed * 0.015) })
    }
    // Decay and remove
    for (let i = glowTrails.length - 1; i >= 0; i--) {
      glowTrails[i].alpha -= 0.003
      if (glowTrails[i].alpha <= 0) {
        glowTrails.splice(i, 1)
      }
    }
    if (glowTrails.length > 80) glowTrails.splice(0, 20)
  }

  function drawGlowTrails() {
    if (!ctx) return
    for (const t of glowTrails) {
      const grad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, 15)
      grad.addColorStop(0, `rgba(80, 200, 180, ${t.alpha})`)
      grad.addColorStop(1, 'rgba(40, 160, 140, 0)')
      ctx.fillStyle = grad
      ctx.fillRect(t.x - 15, t.y - 15, 30, 30)
    }
  }

  function updateBurstParticles() {
    for (let i = burstParticles.length - 1; i >= 0; i--) {
      const p = burstParticles[i]
      p.x += p.vx
      p.y += p.vy
      p.vx *= 0.97
      p.vy *= 0.97
      p.alpha -= 0.008
      if (p.alpha <= 0) {
        burstParticles.splice(i, 1)
      }
    }
    if (burstParticles.length > 100) burstParticles.splice(0, 30)
  }

  function drawBurstParticles() {
    if (!ctx) return
    for (const p of burstParticles) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(80, 220, 180, ${p.alpha})`
      ctx.fill()
    }
  }

  function spawnBurst(x: number, y: number) {
    const count = 12 + Math.floor(Math.random() * 8)
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.5 + Math.random() * 1.5
      burstParticles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 0.3 + Math.random() * 0.3,
        size: 1 + Math.random() * 2,
      })
    }
  }

  // Spontaneous bioluminescent pulses on random fragments
  function triggerSpontaneousPulse() {
    if (fragments.length === 0) return
    const frag = fragments[Math.floor(Math.random() * fragments.length)]
    if (frag !== caughtFragment) {
      frag.glow = 0.6 + Math.random() * 0.4
    }
  }

  // --- Caught fragment logic ---
  function updateCaughtFragment(dt: number) {
    if (!caughtFragment) return
    caughtTimer += dt
    // Dissolve after 5 seconds
    if (caughtTimer > 5) {
      // Release — rejoin as new words
      const w = canvas?.width || window.innerWidth
      const h = canvas?.height || window.innerHeight
      caughtFragment.x = Math.random() * w
      caughtFragment.y = Math.random() * h
      caughtFragment.vx = (Math.random() - 0.5) * 0.3
      caughtFragment.vy = (Math.random() - 0.5) * 0.2
      caughtFragment.alpha = 0.1 + Math.random() * 0.2
      caughtFragment.glow = 0
      caughtFragment = null
      caughtTimer = 0
      caughtDisplayText = ''
    } else {
      // Keep caught fragment stationary, glowing
      caughtFragment.vx = 0
      caughtFragment.vy = 0
      caughtFragment.glow = Math.max(0.5, 1 - caughtTimer * 0.15)
      // Fade out in last 2 seconds
      if (caughtTimer > 3) {
        caughtFragment.alpha = Math.max(0, 0.5 * (1 - (caughtTimer - 3) / 2))
      } else {
        caughtFragment.alpha = 0.5
      }
    }
  }

  function drawCaughtText(w: number, h: number) {
    if (!ctx || !caughtDisplayText || !caughtFragment) return
    // Fade factor for the display text
    const fade = caughtTimer > 3 ? Math.max(0, 1 - (caughtTimer - 3) / 2) : 1
    ctx.font = '18px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(120, 220, 200, ${0.4 * fade})`
    ctx.textAlign = 'center'
    ctx.fillText(caughtDisplayText, w / 2, h - 50)
  }

  // --- Water current navigation ---
  function spawnWellParticle(w: number, h: number) {
    // Spawn near center-bottom, rising upward
    wellCurrentParticles.push({
      x: w * 0.5 + (Math.random() - 0.5) * 30,
      y: h * 0.55 + Math.random() * 60,
      alpha: 0.05 + Math.random() * 0.15,
      speed: 0.6 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
      size: 1 + Math.random() * 2,
    })
  }

  function spawnTidepoolParticle(w: number, h: number) {
    // Spawn near left-center, flowing rightward
    tidepoolCurrentParticles.push({
      x: w * 0.45 + Math.random() * 40,
      y: h * 0.5 + (Math.random() - 0.5) * 20,
      alpha: 0.05 + Math.random() * 0.15,
      speed: 0.5 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
      size: 1 + Math.random() * 2,
    })
  }

  function updateCurrentParticles(w: number, h: number) {
    const isWellHovered = hoveredCurrent === 'well'
    const isTidepoolHovered = hoveredCurrent === 'tidepool'

    // Spawn new particles to maintain 15-30 per stream
    while (wellCurrentParticles.length < (isWellHovered ? 30 : 18)) {
      spawnWellParticle(w, h)
    }
    while (tidepoolCurrentParticles.length < (isTidepoolHovered ? 30 : 18)) {
      spawnTidepoolParticle(w, h)
    }

    const wellSpeedMul = isWellHovered ? 2.0 : 1.0
    const tidepoolSpeedMul = isTidepoolHovered ? 2.0 : 1.0

    // Update well current (upward)
    for (let i = wellCurrentParticles.length - 1; i >= 0; i--) {
      const p = wellCurrentParticles[i]
      p.y -= p.speed * wellSpeedMul
      // Sinusoidal wobble in X
      p.x += Math.sin(time * 1.5 + p.phase) * 0.4
      p.phase += 0.02
      // Fade in near spawn, fade out near top
      const normalY = 1 - (p.y / (h * 0.55))  // 0 at bottom, 1 at top
      if (normalY > 0.85) {
        p.alpha *= 0.96  // fade out near surface
      }
      // Remove if off-screen or faded
      if (p.y < 10 || p.alpha < 0.005) {
        wellCurrentParticles.splice(i, 1)
      }
    }

    // Update tidepool current (rightward)
    for (let i = tidepoolCurrentParticles.length - 1; i >= 0; i--) {
      const p = tidepoolCurrentParticles[i]
      p.x += p.speed * tidepoolSpeedMul
      // Vertical wobble
      p.y += Math.sin(time * 1.2 + p.phase) * 0.3
      p.phase += 0.02
      // Spread vertically as it moves right (widens toward edge)
      const progressX = (p.x - w * 0.45) / (w * 0.55)
      p.y += (Math.random() - 0.5) * progressX * 0.5
      // Fade out near right edge
      if (p.x > w - 60) {
        p.alpha *= 0.96
      }
      // Remove if off-screen or faded
      if (p.x > w + 10 || p.alpha < 0.005) {
        tidepoolCurrentParticles.splice(i, 1)
      }
    }
  }

  // Draw a directional arrow chevron at (x, y) pointing in direction angle (radians)
  function drawArrowChevron(x: number, y: number, angle: number, size: number, alpha: number) {
    if (!ctx) return
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    ctx.beginPath()
    ctx.moveTo(-size, -size * 0.6)
    ctx.lineTo(0, 0)
    ctx.lineTo(-size, size * 0.6)
    ctx.strokeStyle = `rgba(100, 200, 240, ${alpha})`
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.restore()
  }

  function drawCurrentParticles(w: number, h: number) {
    if (!ctx) return
    const isWellHovered = hoveredCurrent === 'well'
    const isTidepoolHovered = hoveredCurrent === 'tidepool'

    // --- Well current (upward column) ---
    const wellCenterX = w * 0.5

    // Source glow (bottom of column)
    const wellSourceY = h * 0.55
    const srcGlow = ctx.createRadialGradient(wellCenterX, wellSourceY, 0, wellCenterX, wellSourceY, 25)
    srcGlow.addColorStop(0, `rgba(80, 180, 220, ${isWellHovered ? 0.15 : 0.05})`)
    srcGlow.addColorStop(1, 'rgba(80, 180, 220, 0)')
    ctx.fillStyle = srcGlow
    ctx.fillRect(wellCenterX - 25, wellSourceY - 25, 50, 50)

    // Destination glow (top, at the water surface)
    const wellDestY = 25
    const destRadius = isWellHovered ? 45 : 25
    const destGlow = ctx.createRadialGradient(wellCenterX, wellDestY, 0, wellCenterX, wellDestY, destRadius)
    destGlow.addColorStop(0, `rgba(80, 180, 220, ${isWellHovered ? 0.30 : 0.08})`)
    destGlow.addColorStop(1, 'rgba(80, 180, 220, 0)')
    ctx.fillStyle = destGlow
    ctx.fillRect(wellCenterX - destRadius, wellDestY - destRadius, destRadius * 2, destRadius * 2)

    // Upward arrow chevrons along the column (animated, scrolling upward)
    const wellArrowCount = isWellHovered ? 6 : 4
    for (let i = 0; i < wellArrowCount; i++) {
      // Each arrow scrolls upward continuously
      const period = 3.0  // seconds for full cycle
      const normalT = ((time / period + i / wellArrowCount) % 1)
      const arrowY = wellSourceY - normalT * (wellSourceY - wellDestY - 10)
      const arrowAlpha = isWellHovered
        ? 0.35 * Math.sin(normalT * Math.PI)
        : 0.12 * Math.sin(normalT * Math.PI)
      const wobbleX = Math.sin(time * 1.2 + i * 1.5) * 3
      drawArrowChevron(wellCenterX + wobbleX, arrowY, -Math.PI / 2, 6, arrowAlpha)
    }

    // Label — only visible on hover
    if (isWellHovered) {
      ctx.font = '12px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(140, 220, 255, 0.55)`
      ctx.textAlign = 'center'
      ctx.fillText('ascend to the well', wellCenterX, wellDestY + 5)
    }

    // Particles
    for (const p of wellCurrentParticles) {
      const brightness = isWellHovered ? 1.5 : 1.0
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(80, 180, 220, ${p.alpha * brightness})`
      ctx.fill()
      if (p.alpha > 0.08) {
        const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3)
        pg.addColorStop(0, `rgba(80, 180, 220, ${p.alpha * 0.3 * brightness})`)
        pg.addColorStop(1, 'rgba(80, 180, 220, 0)')
        ctx.fillStyle = pg
        ctx.fillRect(p.x - p.size * 3, p.y - p.size * 3, p.size * 6, p.size * 6)
      }
    }

    // --- Tidepool current (rightward stream) ---
    const tpSourceX = w * 0.45
    const tpSourceY = h * 0.5
    const tpDestX = w - 20
    const tpDestY = h * 0.5

    // Source glow (left side)
    const tpSrcGlow = ctx.createRadialGradient(tpSourceX, tpSourceY, 0, tpSourceX, tpSourceY, 20)
    tpSrcGlow.addColorStop(0, `rgba(80, 180, 220, ${isTidepoolHovered ? 0.12 : 0.04})`)
    tpSrcGlow.addColorStop(1, 'rgba(80, 180, 220, 0)')
    ctx.fillStyle = tpSrcGlow
    ctx.fillRect(tpSourceX - 20, tpSourceY - 20, 40, 40)

    // Destination glow (right edge)
    const tpDestRadius = isTidepoolHovered ? 50 : 28
    const tpDestGlow = ctx.createRadialGradient(tpDestX, tpDestY, 0, tpDestX, tpDestY, tpDestRadius)
    tpDestGlow.addColorStop(0, `rgba(80, 180, 220, ${isTidepoolHovered ? 0.30 : 0.08})`)
    tpDestGlow.addColorStop(1, 'rgba(80, 180, 220, 0)')
    ctx.fillStyle = tpDestGlow
    ctx.fillRect(tpDestX - tpDestRadius, tpDestY - tpDestRadius, tpDestRadius * 2, tpDestRadius * 2)

    // Rightward arrow chevrons along the stream (animated, scrolling right)
    const tpArrowCount = isTidepoolHovered ? 6 : 4
    const streamLen = tpDestX - tpSourceX
    for (let i = 0; i < tpArrowCount; i++) {
      const period = 4.0
      const normalT = ((time / period + i / tpArrowCount) % 1)
      const arrowX = tpSourceX + normalT * streamLen
      // Vertical wobble matching the stream
      const arrowWobbleY = Math.sin(time * 1.0 + i * 1.8) * 5
      const arrowAlpha = isTidepoolHovered
        ? 0.35 * Math.sin(normalT * Math.PI)
        : 0.12 * Math.sin(normalT * Math.PI)
      drawArrowChevron(arrowX, tpSourceY + arrowWobbleY, 0, 6, arrowAlpha)
    }

    // Label — only visible on hover
    if (isTidepoolHovered) {
      ctx.font = '12px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(140, 220, 255, 0.55)`
      ctx.textAlign = 'center'
      ctx.fillText('follow the current to the tide pool', tpDestX - 120, tpDestY - 18)
    }

    // Particles
    for (const p of tidepoolCurrentParticles) {
      const brightness = isTidepoolHovered ? 1.5 : 1.0
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(80, 180, 220, ${p.alpha * brightness})`
      ctx.fill()
      if (p.alpha > 0.08) {
        const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3)
        pg.addColorStop(0, `rgba(80, 180, 220, ${p.alpha * 0.3 * brightness})`)
        pg.addColorStop(1, 'rgba(80, 180, 220, 0)')
        ctx.fillStyle = pg
        ctx.fillRect(p.x - p.size * 3, p.y - p.size * 3, p.size * 6, p.size * 6)
      }
    }
  }

  function detectCurrentHover(mx: number, my: number) {
    if (!canvas) return
    const w = canvas.width
    const h = canvas.height

    // Well current: vertical column from h*0.55 up to y=25, centered at w*0.5
    // Hit region: a vertical strip ~60px wide along the column
    const wellCenterX = w * 0.5
    const wellTopY = 10
    const wellBottomY = h * 0.55 + 30
    if (Math.abs(mx - wellCenterX) < 35 && my > wellTopY && my < wellBottomY) {
      hoveredCurrent = 'well'
      return
    }

    // Tidepool current: horizontal stream from w*0.45 to right edge, at h*0.5
    // Hit region: a horizontal strip ~50px tall along the stream
    const tpLeft = w * 0.45 - 15
    const tpCenterY = h * 0.5
    if (mx > tpLeft && mx < w && Math.abs(my - tpCenterY) < 30) {
      hoveredCurrent = 'tidepool'
      return
    }

    hoveredCurrent = null
  }

  // --- Main render ---
  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    const dt = 0.016
    time += dt

    const w = canvas.width
    const h = canvas.height

    // Mouse speed calculation
    const mdx = mouseX - prevMouseX
    const mdy = mouseY - prevMouseY
    mouseSpeed = Math.sqrt(mdx * mdx + mdy * mdy)
    prevMouseX = mouseX
    prevMouseY = mouseY

    ctx.clearRect(0, 0, w, h)

    // Depth zone background
    drawDepthZones(w, h)

    // Light rays from surface
    drawLightRays(w, h)

    // Underwater caustic patterns
    for (let i = 0; i < 6; i++) {
      const cx = w * 0.5 + Math.sin(time * 0.2 + i * 2) * w * 0.3
      const cy = h * 0.3 + Math.cos(time * 0.15 + i * 1.5) * h * 0.2
      const radius = 100 + Math.sin(time * 0.3 + i) * 30
      const caustic = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
      caustic.addColorStop(0, 'rgba(40, 100, 180, 0.015)')
      caustic.addColorStop(1, 'rgba(20, 60, 120, 0)')
      ctx.fillStyle = caustic
      ctx.fillRect(0, 0, w, h)
    }

    // Water current lines
    ctx.strokeStyle = 'rgba(60, 120, 180, 0.02)'
    ctx.lineWidth = 0.5
    for (let i = 0; i < 8; i++) {
      const y = (h * 0.2 + i * h * 0.08 + Math.sin(time * 0.1 + i) * 20)
      ctx.beginPath()
      ctx.moveTo(0, y)
      for (let x = 0; x < w; x += 20) {
        const dy = Math.sin(x * 0.01 + time * 0.3 + i) * 10
        ctx.lineTo(x, y + dy)
      }
      ctx.stroke()
    }

    // Bioluminescence trails
    updateGlowTrails()
    drawGlowTrails()

    // Burst particles
    updateBurstParticles()
    drawBurstParticles()

    // Spontaneous bioluminescent pulses (~every 3 seconds on average)
    if (Math.random() < 0.005) {
      triggerSpontaneousPulse()
    }

    // Update caught fragment
    updateCaughtFragment(dt)

    // Floating text fragments — the dissolved memories
    for (const frag of fragments) {
      // Skip movement for caught fragment
      if (frag === caughtFragment) {
        // Draw caught fragment with strong glow
        drawFragment(frag, w, h)
        continue
      }

      // Depth-aware speed
      const speedMul = depthSpeedFactor(frag.y, h)

      // Current drift (scaled by depth)
      frag.x += (frag.vx + Math.sin(time * 0.5 + frag.y * 0.01) * 0.2) * speedMul
      frag.y += (frag.vy + Math.cos(time * 0.3 + frag.x * 0.01) * 0.1) * speedMul

      // Mouse influence — fragments drift away from cursor
      const dx = frag.x - mouseX
      const dy = frag.y - mouseY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 150) {
        const force = (150 - dist) / 150 * 0.3
        frag.vx += (dx / dist) * force * 0.01
        frag.vy += (dy / dist) * force * 0.01
      }

      // Proximity bioluminescence: cursor near fragment makes it glow
      if (dist < 100) {
        frag.glow = Math.max(frag.glow, (100 - dist) / 100 * 0.6)
      }

      // Decay glow
      frag.glow = Math.max(0, frag.glow - 0.008)

      // Dampen velocity
      frag.vx *= 0.99
      frag.vy *= 0.99

      // Wrap around
      if (frag.x < -100) frag.x = w + 50
      if (frag.x > w + 100) frag.x = -50
      if (frag.y < -50) frag.y = h + 30
      if (frag.y > h + 50) frag.y = -30

      drawFragment(frag, w, h)
    }

    // Bubbles — more common in depths, rare at surface
    const bubbleChance = (() => {
      // Mouse zone affects bubble spawn
      const cursorZone = getZone(mouseY, h)
      if (cursorZone === 'depths') return 0.08
      if (cursorZone === 'midwater') return 0.05
      return 0.02
    })()
    if (Math.random() < bubbleChance) {
      const spawnX = Math.random() * w
      // Bubbles spawn in lower half more often
      const spawnY = h * (0.5 + Math.random() * 0.5)
      const newBubble: Bubble = {
        x: spawnX,
        y: spawnY,
        vy: -0.5 - Math.random() * 1,
        size: 1 + Math.random() * 3,
        alpha: 0.1 + Math.random() * 0.1,
      }
      bubbles.push(newBubble)
      // Occasional bubble pop sound (~20% of spawns)
      if (Math.random() < 0.2) {
        playBubblePop()
      }
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]
      b.y += b.vy
      b.x += Math.sin(time * 2 + b.y * 0.05) * 0.3
      b.alpha -= 0.0005

      if (b.y < -10 || b.alpha <= 0) {
        bubbles.splice(i, 1)
        continue
      }

      ctx.beginPath()
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(100, 180, 220, ${b.alpha})`
      ctx.lineWidth = 0.5
      ctx.stroke()
    }
    if (bubbles.length > 50) bubbles.splice(0, 10)

    // Water surface effect
    drawWaterSurface(w, h)

    // Mouse proximity glow
    ctx.beginPath()
    ctx.arc(mouseX, mouseY, 60, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(60, 120, 200, 0.015)'
    ctx.fill()

    // Caught fragment display text
    drawCaughtText(w, h)

    // Water current navigation streams
    updateCurrentParticles(w, h)
    drawCurrentParticles(w, h)

    // Title
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(80, 140, 200, ${0.08 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'left'
    ctx.fillText('the aquifer', 15, h - 15)

    // Info
    ctx.font = '9px monospace'
    ctx.fillStyle = 'rgba(80, 140, 200, 0.06)'
    ctx.textAlign = 'right'
    ctx.fillText(`${fragments.length} fragments dissolved`, w - 15, h - 15)

    // Depth indicator
    const cursorZone = getZone(mouseY, h)
    ctx.font = '8px monospace'
    ctx.fillStyle = 'rgba(60, 120, 180, 0.04)'
    ctx.textAlign = 'right'
    ctx.fillText(`depth: ${cursorZone}`, w - 15, h - 28)

    // Update audio based on cursor depth and speed
    updateAudioForDepth()
    updateSwish()
  }

  // Draw a single fragment with its glow
  function drawFragment(frag: FloatingFragment, _w: number, _h: number) {
    if (!ctx) return
    // Bioluminescent glow aura
    if (frag.glow > 0.05) {
      const glowRadius = 20 + frag.glow * 15
      const grad = ctx.createRadialGradient(frag.x, frag.y - frag.size * 0.3, 0, frag.x, frag.y - frag.size * 0.3, glowRadius)
      grad.addColorStop(0, `rgba(60, 200, 170, ${frag.glow * 0.15})`)
      grad.addColorStop(1, 'rgba(40, 160, 140, 0)')
      ctx.fillStyle = grad
      ctx.fillRect(frag.x - glowRadius, frag.y - frag.size * 0.3 - glowRadius, glowRadius * 2, glowRadius * 2)
    }

    // Fragment text
    ctx.font = `${frag.size}px "Cormorant Garamond", serif`
    // Mix in bioluminescent color when glowing
    const baseAlpha = frag.alpha + frag.glow * 0.3
    if (frag.glow > 0.1) {
      // Shift toward cyan-green when glowing
      ctx.fillStyle = `rgba(${80 + frag.glow * 60}, ${180 + frag.glow * 40}, ${170 + frag.glow * 30}, ${baseAlpha})`
    } else {
      ctx.fillStyle = `hsla(${200 + frag.hue * 0.2}, 50%, 60%, ${baseAlpha})`
    }
    ctx.textAlign = 'center'
    ctx.fillText(frag.text, frag.x, frag.y)
  }

  return {
    name: 'aquifer',
    label: 'the aquifer',
    hidden: true,

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        width: 100%; height: 100%;
        pointer-events: auto;
        background: #000;
        cursor: pointer;
      `

      canvas = document.createElement('canvas')
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      canvas.style.cssText = 'width: 100%; height: 100%;'
      ctx = canvas.getContext('2d')

      canvas.addEventListener('mousemove', (e) => {
        mouseX = e.clientX
        mouseY = e.clientY
        // Water current hover detection
        detectCurrentHover(e.clientX, e.clientY)
        // Update cursor style
        if (canvas) {
          canvas.style.cursor = hoveredCurrent ? 'pointer' : 'default'
        }
      })

      canvas.addEventListener('click', (e) => {
        // Check water current destinations first
        if (hoveredCurrent === 'well') {
          if (deps.switchTo) deps.switchTo('well')
          else deps.toWell()
          return
        }
        if (hoveredCurrent === 'tidepool') {
          if (deps.switchTo) deps.switchTo('tidepool')
          else deps.toTidePool()
          return
        }
        // Top area → ascend to well
        if (e.clientY < 50) {
          deps.toWell()
          return
        }
        // Right edge → tide pool
        if (e.clientX > window.innerWidth * 0.85) {
          deps.toTidePool()
          return
        }

        // Check if clicking near a fragment to catch it
        let closestFrag: FloatingFragment | null = null
        let closestDist = Infinity
        for (const frag of fragments) {
          if (frag === caughtFragment) continue
          const dx = frag.x - e.clientX
          const dy = frag.y - e.clientY
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < 40 && d < closestDist) {
            closestDist = d
            closestFrag = frag
          }
        }

        if (closestFrag) {
          // Release any previously caught fragment
          if (caughtFragment) {
            caughtFragment.glow = 0
            caughtFragment.alpha = 0.1 + Math.random() * 0.2
          }
          // Catch this fragment
          caughtFragment = closestFrag
          caughtTimer = 0
          caughtDisplayText = closestFrag.text
          closestFrag.glow = 1
        }

        // Always spawn bioluminescent burst on click
        spawnBurst(e.clientX, e.clientY)
      })

      overlay.appendChild(canvas)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      return overlay
    },

    activate() {
      active = true
      bubbles = []
      glowTrails = []
      burstParticles = []
      wellCurrentParticles = []
      tidepoolCurrentParticles = []
      hoveredCurrent = null
      caughtFragment = null
      caughtTimer = 0
      caughtDisplayText = ''
      shatterMemories()
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
