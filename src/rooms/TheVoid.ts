/**
 * THE VOID — the original room, where memories dissolve
 *
 * The Void is the central hub. Its overlay is transparent —
 * the particle cosmos IS the room. But at its edges, passages
 * whisper: atmospheric portals leading to connected rooms.
 *
 * Each portal is a different sensory element:
 * - Stars intensify above → the observatory
 * - Green tendrils below → the garden
 * - Serif text to the left → the study
 * - Waveform ripple right → the instrument
 * - Spirit glow top-right → the séance
 * - Ember warmth bottom-left → the furnace
 *
 * Audio: a soft sub-harmonic resonance layer (2-3 oscillators
 * at 40-80Hz) breathes beneath the global drone. A filtered
 * noise buffer adds cosmic wind at very low gain.
 * Cursor: proximity glow on portals, subtle golden ripples.
 * Portal particle trails drift toward cursor on hover.
 * Vignette: breathing radial darkness at the edges, tinted
 * by time-of-day (blue at night, amber at dawn/dusk).
 *
 * Memory constellation hints drift across the void as
 * near-invisible text ghosts. Concentric breathing rings
 * expand from center in sync with the vignette pulse.
 * A philosophical inscription cycles at the bottom edge.
 */

import type { Room } from './RoomManager'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface VoidDeps {
  switchTo: (name: string) => void
  voiceSupported?: boolean
  getMemories?: () => Array<{currentText: string, degradation: number, hue: number}>
}

interface Portal {
  name: string
  hint: string
  position: string // CSS positioning
  el?: HTMLElement
}

// RGB values extracted from PORTAL_STYLES for particle trails
const PORTAL_RGB: Record<string, [number, number, number]> = {
  observatory: [200, 180, 255],
  garden: [100, 180, 80],
  study: [255, 215, 0],
  instrument: [100, 200, 255],
  seance: [180, 160, 220],
  furnace: [255, 120, 50],
}

// Curated philosophical fragments — cycling inscription at the bottom
const INSCRIPTIONS = [
  'the universe remembers its invisible architecture',
  'entropy is the universe\'s way of forgetting',
  'between two heartbeats, everything changes',
  'what the hand forgets, the body remembers',
  'every star is a memory the sky refuses to release',
  'silence is the language of everything that has already been said',
  'we are the universe\'s attempt to remember itself',
  'the void is not empty — it is full of what has been removed',
  'forgetting is the shadow that memory casts',
  'time does not pass — it accumulates',
  'what dissolves here was never truly solid',
  'the space between words is where meaning lives',
  'all rivers remember the mountain',
]

interface TrailParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  r: number
  g: number
  b: number
  size: number
}

interface MemoryGhost {
  text: string
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  targetAlpha: number
  fadeDir: number // 1 = fading in, -1 = fading out
  hue: number
  size: number
}

export function createVoidRoom(deps?: VoidDeps): Room {
  let overlay: HTMLElement | null = null
  let portalContainer: HTMLElement | null = null
  let portalTimeout: number | null = null
  let voiceHintEl: HTMLElement | null = null
  let voiceHintTimeout: number | null = null
  let active = false

  // --- Audio state ---
  let audioCtx: AudioContext | null = null
  let resonanceGain: GainNode | null = null
  let filterNode: BiquadFilterNode | null = null
  let oscillators: OscillatorNode[] = []
  let filterSweepInterval: number | null = null

  // --- Cosmic wind audio state ---
  let windGain: GainNode | null = null
  let windFilter: BiquadFilterNode | null = null
  let windSource: AudioBufferSourceNode | null = null
  let windSweepInterval: number | null = null

  // --- Cursor state ---
  let lastRippleTime = 0
  let mouseMoveHandler: ((e: MouseEvent) => void) | null = null

  // --- Vignette state ---
  let vignetteEl: HTMLElement | null = null

  // --- Canvas overlay state (breathing rings + portal trails + memory ghosts) ---
  let effectsCanvas: HTMLCanvasElement | null = null
  let effectsCtx: CanvasRenderingContext2D | null = null
  let effectsRAF: number | null = null

  // --- Portal particle trails ---
  let trailParticles: TrailParticle[] = []

  // --- Memory constellation ghosts ---
  let memoryGhosts: MemoryGhost[] = []
  let lastGhostSpawnTime = 0

  // --- Inscription state ---
  let inscriptionEl: HTMLElement | null = null
  let inscriptionIndex = 0
  let inscriptionInterval: number | null = null

  const PORTALS: Portal[] = [
    {
      name: 'observatory',
      hint: 'look up',
      position: 'top: 60px; left: 50%; transform: translateX(-50%);',
    },
    {
      name: 'garden',
      hint: 'something grows below',
      position: 'bottom: 60px; left: 50%; transform: translateX(-50%);',
    },
    {
      name: 'study',
      hint: 'a quieter place',
      position: 'left: 24px; top: 50%; transform: translateY(-50%);',
    },
    {
      name: 'instrument',
      hint: 'sound waits',
      position: 'right: 24px; top: 50%; transform: translateY(-50%);',
    },
    {
      name: 'seance',
      hint: 'voices',
      position: 'top: 80px; right: 40px;',
    },
    {
      name: 'furnace',
      hint: 'fire',
      position: 'bottom: 80px; left: 40px;',
    },
  ]

  // Each portal has a unique visual flavor
  const PORTAL_STYLES: Record<string, { color: string; glow: string; symbol: string }> = {
    observatory: {
      color: 'rgba(200, 180, 255, VAR)',
      glow: '0 0 20px rgba(200, 180, 255, 0.15)',
      symbol: '\u2726',  // ✦
    },
    garden: {
      color: 'rgba(100, 180, 80, VAR)',
      glow: '0 0 20px rgba(100, 180, 80, 0.15)',
      symbol: '\u2E19',  // ⸙ (floral)
    },
    study: {
      color: 'rgba(255, 215, 0, VAR)',
      glow: '0 0 20px rgba(255, 215, 0, 0.1)',
      symbol: '\u270E',  // ✎
    },
    instrument: {
      color: 'rgba(100, 200, 255, VAR)',
      glow: '0 0 20px rgba(100, 200, 255, 0.15)',
      symbol: '\u266B',  // ♫
    },
    seance: {
      color: 'rgba(180, 160, 220, VAR)',
      glow: '0 0 20px rgba(180, 160, 220, 0.15)',
      symbol: '\u2727',  // ✧
    },
    furnace: {
      color: 'rgba(255, 120, 50, VAR)',
      glow: '0 0 20px rgba(255, 120, 50, 0.15)',
      symbol: '\u2632',  // ☲ (fire trigram)
    },
  }

  // =========================================================
  // AUDIO — sub-harmonic resonance layer
  // =========================================================

  async function initAudio() {
    try {
      audioCtx = await getAudioContext()
      const dest = getAudioDestination()

      // Shared filter for all oscillators — slow sweeping lowpass
      filterNode = audioCtx.createBiquadFilter()
      filterNode.type = 'lowpass'
      filterNode.frequency.value = 60
      filterNode.Q.value = 2

      // Master gain for this layer — very quiet
      resonanceGain = audioCtx.createGain()
      resonanceGain.gain.value = 0 // start silent, fade in
      filterNode.connect(resonanceGain)
      resonanceGain.connect(dest)

      // 3 oscillators at sub-harmonic frequencies
      const freqs = [42, 56, 73]
      const types: OscillatorType[] = ['sine', 'sine', 'triangle']

      for (let i = 0; i < freqs.length; i++) {
        const osc = audioCtx.createOscillator()
        osc.type = types[i]
        osc.frequency.value = freqs[i]
        // Slight detune for organic feel
        osc.detune.value = (Math.random() - 0.5) * 8
        osc.connect(filterNode)
        osc.start()
        oscillators.push(osc)
      }

      // Fade in over 2.5s
      resonanceGain.gain.setTargetAtTime(0.03, audioCtx.currentTime, 0.8)

      // Slow filter sweep — modulate cutoff between 40-120Hz
      startFilterSweep()

      // --- Cosmic wind layer ---
      initCosmicWind(audioCtx, dest)
    } catch (_) {
      // Audio init failed silently — room still works without sound
    }
  }

  function startFilterSweep() {
    if (!filterNode || !audioCtx) return
    let phase = 0
    filterSweepInterval = window.setInterval(() => {
      if (!filterNode || !audioCtx) return
      phase += 0.02
      // Organic sweep: 40-120Hz over ~30s cycle
      const cutoff = 80 + Math.sin(phase) * 40 + Math.sin(phase * 0.37) * 15
      filterNode.frequency.setTargetAtTime(cutoff, audioCtx.currentTime, 0.5)
    }, 200)
  }

  // =========================================================
  // AUDIO — cosmic wind (filtered noise buffer)
  // =========================================================

  function initCosmicWind(ctx: AudioContext, dest: AudioNode) {
    // Create a noise buffer — 2 seconds of white noise
    const bufferSize = ctx.sampleRate * 2
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    // Bandpass filter: 40-200Hz range
    windFilter = ctx.createBiquadFilter()
    windFilter.type = 'bandpass'
    windFilter.frequency.value = 100
    windFilter.Q.value = 0.8

    // Very low gain — cosmic wind is felt more than heard
    windGain = ctx.createGain()
    windGain.gain.value = 0
    windFilter.connect(windGain)
    windGain.connect(dest)

    // Looping noise source
    windSource = ctx.createBufferSource()
    windSource.buffer = noiseBuffer
    windSource.loop = true
    windSource.connect(windFilter)
    windSource.start()

    // Fade in slowly
    windGain.gain.setTargetAtTime(0.015, ctx.currentTime, 1.5)

    // Slow sweep of the bandpass center frequency
    let windPhase = 0
    windSweepInterval = window.setInterval(() => {
      if (!windFilter || !audioCtx) return
      windPhase += 0.015
      // Sweep between 40-200Hz — very slow undulation
      const center = 120 + Math.sin(windPhase) * 60 + Math.sin(windPhase * 0.6) * 20
      windFilter.frequency.setTargetAtTime(center, audioCtx.currentTime, 0.8)
    }, 250)
  }

  function fadeOutAudio() {
    if (resonanceGain && audioCtx) {
      resonanceGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.15)
    }
    if (windGain && audioCtx) {
      windGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.15)
    }
    if (filterSweepInterval !== null) {
      clearInterval(filterSweepInterval)
      filterSweepInterval = null
    }
    if (windSweepInterval !== null) {
      clearInterval(windSweepInterval)
      windSweepInterval = null
    }
    // Stop oscillators + wind after fade completes
    setTimeout(() => {
      for (const osc of oscillators) {
        try { osc.stop() } catch (_) { /* already stopped */ }
      }
      oscillators = []
      try { windSource?.stop() } catch (_) { /* already stopped */ }
      windSource = null
      filterNode?.disconnect()
      resonanceGain?.disconnect()
      windFilter?.disconnect()
      windGain?.disconnect()
      filterNode = null
      resonanceGain = null
      windFilter = null
      windGain = null
    }, 600)
  }

  // =========================================================
  // PORTALS — creation + proximity effects
  // =========================================================

  function createPortals() {
    if (!portalContainer || !deps) return

    for (const portal of PORTALS) {
      const style = PORTAL_STYLES[portal.name]
      if (!style) continue

      const el = document.createElement('div')
      el.style.cssText = `
        position: absolute; ${portal.position}
        pointer-events: auto;
        cursor: pointer;
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300;
        font-size: 13px;
        letter-spacing: 3px;
        text-transform: lowercase;
        color: ${style.color.replace('VAR', '0')};
        text-shadow: ${style.glow};
        opacity: 0;
        transition: opacity 3s ease, color 0.5s ease, text-shadow 0.5s ease;
        text-align: center;
        user-select: none;
        padding: 12px 16px;
        z-index: 5;
      `

      // Symbol above/before the hint text
      el.innerHTML = `
        <span style="display:block; font-size: 16px; margin-bottom: 4px; opacity: 0.6;">${style.symbol}</span>
        <span style="font-style: italic;">${portal.hint}</span>
      `

      // Hover: brighten
      el.addEventListener('mouseenter', () => {
        el.style.color = style.color.replace('VAR', '0.5')
        el.style.textShadow = style.glow.replace('0.15', '0.4')
      })
      el.addEventListener('mouseleave', () => {
        el.style.color = style.color.replace('VAR', '0.12')
        el.style.textShadow = style.glow
      })

      // Click: navigate
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        deps.switchTo(portal.name)
      })

      portal.el = el
      portalContainer.appendChild(el)
    }

    // Stagger portal appearances (8-15 seconds after entering)
    let delay = 8000
    for (const portal of PORTALS) {
      if (!portal.el) continue
      const thisEl = portal.el
      const s = PORTAL_STYLES[portal.name]
      setTimeout(() => {
        thisEl.style.opacity = '1'
        thisEl.style.color = s.color.replace('VAR', '0.12')
      }, delay)
      delay += 1200 + Math.random() * 800
    }
  }

  function createVoiceHint() {
    if (!portalContainer || !deps) return

    voiceHintEl = document.createElement('div')
    voiceHintEl.style.cssText = `
      position: absolute;
      bottom: 24%; left: 50%;
      transform: translateX(-50%);
      pointer-events: none;
      text-align: center;
      opacity: 0;
      transition: opacity 4s ease;
      z-index: 4;
    `

    // Typing instruction
    const typeLine = document.createElement('div')
    typeLine.style.cssText = `
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300;
      font-size: 14px;
      letter-spacing: 2px;
      color: rgba(255, 215, 0, 0.3);
      font-style: italic;
      margin-bottom: 8px;
    `
    typeLine.textContent = 'type to give a memory'
    voiceHintEl.appendChild(typeLine)

    // Voice instruction
    if (deps.voiceSupported) {
      const voiceLine = document.createElement('div')
      voiceLine.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300;
        font-size: 14px;
        letter-spacing: 2px;
        color: rgba(255, 215, 0, 0.3);
        font-style: italic;
      `
      voiceLine.textContent = 'hold space to speak'
      voiceHintEl.appendChild(voiceLine)
    }

    portalContainer.appendChild(voiceHintEl)

    // Fade in after 5 seconds
    voiceHintTimeout = window.setTimeout(() => {
      if (voiceHintEl) voiceHintEl.style.opacity = '1'
    }, 5000)
  }

  // =========================================================
  // BREATHING ANIMATION — portal pulse + proximity + vignette
  // =========================================================

  function addBreathingAnimation() {
    // Gentle breathing — portals pulse slowly
    let frame = 0
    function breathe() {
      if (!portalContainer || !active) return
      frame++

      for (let i = 0; i < PORTALS.length; i++) {
        const el = PORTALS[i].el
        if (!el) continue
        const s = PORTAL_STYLES[PORTALS[i].name]
        const breathVal = 0.08 + Math.sin(frame * 0.01 + i * 1.5) * 0.04

        // Proximity boost is stored as a data attribute by mousemove handler
        const proximityBoost = parseFloat(el.dataset.proximityBoost || '0')
        const finalVal = Math.min(breathVal + proximityBoost, 0.5)

        el.style.color = s.color.replace('VAR', String(finalVal))

        // Also boost glow when proximity is active
        if (proximityBoost > 0.02) {
          const glowStrength = 0.15 + proximityBoost * 1.5
          el.style.textShadow = s.glow.replace('0.15', String(Math.min(glowStrength, 0.5)))
        }
      }

      // Breathing vignette — sync with resonance
      if (vignetteEl) {
        const vignetteBreath = 0.3 + Math.sin(frame * 0.008) * 0.1
        vignetteEl.style.opacity = String(vignetteBreath)
      }

      portalTimeout = requestAnimationFrame(breathe) as unknown as number
    }
    // Start breathing after portals have faded in
    setTimeout(breathe, 20000)
  }

  // =========================================================
  // CURSOR INTERACTION — proximity + ripples + portal trails
  // =========================================================

  function initCursorEffects() {
    if (!portalContainer) return

    mouseMoveHandler = (e: MouseEvent) => {
      if (!active || !portalContainer) return

      // --- Portal proximity effect ---
      for (const portal of PORTALS) {
        if (!portal.el) continue
        const rect = portal.el.getBoundingClientRect()
        const portalCenterX = rect.left + rect.width / 2
        const portalCenterY = rect.top + rect.height / 2
        const dx = e.clientX - portalCenterX
        const dy = e.clientY - portalCenterY
        const dist = Math.sqrt(dx * dx + dy * dy)

        // Proximity radius: 200px
        if (dist < 200) {
          // Linear falloff: 0 at 200px, 0.15 at 0px
          const boost = (1 - dist / 200) * 0.15
          portal.el.dataset.proximityBoost = String(boost)

          // --- Portal particle trails ---
          // Spawn trail particles when within 150px
          if (dist < 150) {
            spawnTrailParticle(portal.name, portalCenterX, portalCenterY, e.clientX, e.clientY)
          }
        } else {
          portal.el.dataset.proximityBoost = '0'
        }
      }

      // --- Cursor ripple ---
      const now = performance.now()
      if (now - lastRippleTime < 200) return
      lastRippleTime = now

      spawnRipple(e.clientX, e.clientY)
    }

    // Listen on the overlay (which covers the whole void)
    // but use capture since overlay has pointer-events: none
    window.addEventListener('mousemove', mouseMoveHandler)
  }

  function spawnRipple(x: number, y: number) {
    if (!overlay) return

    // Convert from viewport coords to overlay-relative coords
    const overlayRect = overlay.getBoundingClientRect()
    const rx = x - overlayRect.left
    const ry = y - overlayRect.top

    const ripple = document.createElement('div')
    const size = 20 + Math.random() * 20 // 20-40px initial
    ripple.style.cssText = `
      position: absolute;
      left: ${rx - size / 2}px;
      top: ${ry - size / 2}px;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: 1px solid rgba(255, 215, 0, 0.1);
      pointer-events: none;
      z-index: 3;
      transition: width 0.8s ease-out, height 0.8s ease-out, opacity 0.8s ease-out, left 0.8s ease-out, top 0.8s ease-out;
      opacity: 1;
    `
    overlay.appendChild(ripple)

    // Trigger expansion + fade
    requestAnimationFrame(() => {
      const endSize = 60 + Math.random() * 40 // 60-100px
      ripple.style.width = `${endSize}px`
      ripple.style.height = `${endSize}px`
      ripple.style.left = `${rx - endSize / 2}px`
      ripple.style.top = `${ry - endSize / 2}px`
      ripple.style.opacity = '0'
    })

    // Remove after animation
    setTimeout(() => {
      ripple.remove()
    }, 900)
  }

  // =========================================================
  // PORTAL PARTICLE TRAILS — particles drift from portal to cursor
  // =========================================================

  function spawnTrailParticle(
    portalName: string,
    portalX: number, portalY: number,
    cursorX: number, cursorY: number
  ) {
    // Limit particles per portal: count existing for this portal color
    const rgb = PORTAL_RGB[portalName]
    if (!rgb) return

    const sameColorCount = trailParticles.filter(
      p => p.r === rgb[0] && p.g === rgb[1] && p.b === rgb[2]
    ).length
    if (sameColorCount >= 7) return

    // Random chance to not spawn every frame — keeps it sparse
    if (Math.random() > 0.15) return

    // Direction from portal toward cursor, with some spread
    const dx = cursorX - portalX
    const dy = cursorY - portalY
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const speed = 0.4 + Math.random() * 0.6
    const spread = (Math.random() - 0.5) * 0.4

    trailParticles.push({
      x: portalX + (Math.random() - 0.5) * 16,
      y: portalY + (Math.random() - 0.5) * 16,
      vx: (dx / dist) * speed + spread,
      vy: (dy / dist) * speed + spread,
      life: 1,
      maxLife: 60 + Math.random() * 40, // frames
      r: rgb[0],
      g: rgb[1],
      b: rgb[2],
      size: 1 + Math.random() * 2,
    })
  }

  // =========================================================
  // BREATHING VIGNETTE — with time-of-day tinting
  // =========================================================

  function getTimeOfDayTint(): string {
    const hour = new Date().getHours()

    // Night: 10pm-6am — slightly blue
    if (hour >= 22 || hour < 6) {
      return 'rgba(20, 30, 60, 0.3)'
    }
    // Dawn: 6-8am — warm amber
    if (hour >= 6 && hour < 8) {
      const t = (hour - 6 + new Date().getMinutes() / 60) / 2 // 0-1 over 2 hours
      const r = Math.floor(20 + t * 20)
      const g = Math.floor(30 - t * 10)
      const b = Math.floor(60 - t * 50)
      return `rgba(${r}, ${g}, ${b}, 0.3)`
    }
    // Dusk: 6-8pm — warm amber
    if (hour >= 18 && hour < 20) {
      const t = (hour - 18 + new Date().getMinutes() / 60) / 2 // 0-1 over 2 hours
      const r = Math.floor(40 - t * 20)
      const g = Math.floor(20 + t * 10)
      const b = Math.floor(10 + t * 50)
      return `rgba(${r}, ${g}, ${b}, 0.3)`
    }
    // Day — neutral black
    return 'rgba(0, 0, 0, 0.3)'
  }

  function createVignette() {
    if (!overlay) return

    const tint = getTimeOfDayTint()

    vignetteEl = document.createElement('div')
    vignetteEl.style.cssText = `
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none;
      z-index: 2;
      opacity: 0.3;
      background: radial-gradient(
        ellipse at center,
        transparent 40%,
        ${tint} 70%,
        rgba(0, 0, 0, 0.6) 100%
      );
      transition: opacity 2s ease;
    `
    overlay.appendChild(vignetteEl)
  }

  // =========================================================
  // CANVAS OVERLAY — breathing rings, portal trails, memory ghosts
  // =========================================================

  function initEffectsCanvas() {
    effectsCanvas = document.createElement('canvas')
    effectsCanvas.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100vh;
      pointer-events: none;
      z-index: 1;
    `
    // Set canvas resolution
    const dpr = window.devicePixelRatio || 1
    effectsCanvas.width = window.innerWidth * dpr
    effectsCanvas.height = window.innerHeight * dpr
    effectsCtx = effectsCanvas.getContext('2d')
    if (effectsCtx) {
      effectsCtx.scale(dpr, dpr)
    }
    document.body.appendChild(effectsCanvas)

    // Start the render loop
    renderEffectsLoop()
  }

  function renderEffectsLoop() {
    if (!active || !effectsCtx || !effectsCanvas) return

    const w = window.innerWidth
    const h = window.innerHeight

    // Handle resize
    const dpr = window.devicePixelRatio || 1
    if (effectsCanvas.width !== w * dpr || effectsCanvas.height !== h * dpr) {
      effectsCanvas.width = w * dpr
      effectsCanvas.height = h * dpr
      effectsCtx.setTransform(1, 0, 0, 1, 0, 0)
      effectsCtx.scale(dpr, dpr)
    }

    // Clear
    effectsCtx.clearRect(0, 0, w, h)

    // 1. Breathing concentric rings
    drawBreathingRings(effectsCtx, w, h)

    // 2. Portal particle trails
    drawTrailParticles(effectsCtx)

    // 3. Memory constellation ghosts
    drawMemoryGhosts(effectsCtx, w, h)

    effectsRAF = requestAnimationFrame(renderEffectsLoop)
  }

  // =========================================================
  // BREATHING RINGS — concentric expanding circles from center
  // =========================================================

  let ringPhase = 0

  function drawBreathingRings(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ringPhase += 0.008 // sync approximately with vignette breathing (frame * 0.008)
    const cx = w / 2
    const cy = h / 2
    const maxRadius = Math.max(w, h) * 0.6

    // Draw 5 expanding rings at different phases
    for (let i = 0; i < 5; i++) {
      const phase = (ringPhase + i * 0.4) % 2
      // Ring expands from 0 to maxRadius over phase 0-2
      const radius = (phase / 2) * maxRadius
      // Alpha peaks in middle of expansion, fades at start and end
      const lifeFraction = phase / 2
      const alpha = Math.sin(lifeFraction * Math.PI) * 0.03 // max 0.03

      if (alpha < 0.005) continue

      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  // =========================================================
  // TRAIL PARTICLES — render + update
  // =========================================================

  function drawTrailParticles(ctx: CanvasRenderingContext2D) {
    const toRemove: number[] = []

    for (let i = 0; i < trailParticles.length; i++) {
      const p = trailParticles[i]
      p.x += p.vx
      p.y += p.vy
      p.life++

      const lifeRatio = p.life / p.maxLife
      if (lifeRatio >= 1) {
        toRemove.push(i)
        continue
      }

      // Alpha: fade in quickly, sustain, fade out
      let alpha: number
      if (lifeRatio < 0.1) {
        alpha = lifeRatio / 0.1 * 0.15
      } else if (lifeRatio > 0.7) {
        alpha = (1 - (lifeRatio - 0.7) / 0.3) * 0.15
      } else {
        alpha = 0.15
      }

      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${alpha})`
      ctx.fill()
    }

    // Remove dead particles (iterate backwards)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      trailParticles.splice(toRemove[i], 1)
    }
  }

  // =========================================================
  // MEMORY CONSTELLATION GHOSTS — faint drifting text
  // =========================================================

  function drawMemoryGhosts(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (!deps?.getMemories) return

    const now = performance.now()

    // Spawn new ghosts periodically (every 3-6 seconds)
    if (now - lastGhostSpawnTime > 3000 + Math.random() * 3000) {
      lastGhostSpawnTime = now

      const memories = deps.getMemories()
      if (memories.length > 0 && memoryGhosts.length < 6) {
        const mem = memories[Math.floor(Math.random() * memories.length)]
        // Take a fragment of the memory text (max 30 chars)
        const text = mem.currentText.slice(0, 30)
        if (text.trim().length > 2) {
          // Spawn from a random edge
          const edge = Math.floor(Math.random() * 4)
          let x: number, y: number, vx: number, vy: number
          switch (edge) {
            case 0: // top
              x = Math.random() * w
              y = -20
              vx = (Math.random() - 0.5) * 0.2
              vy = 0.15 + Math.random() * 0.15
              break
            case 1: // right
              x = w + 20
              y = Math.random() * h
              vx = -(0.15 + Math.random() * 0.15)
              vy = (Math.random() - 0.5) * 0.2
              break
            case 2: // bottom
              x = Math.random() * w
              y = h + 20
              vx = (Math.random() - 0.5) * 0.2
              vy = -(0.15 + Math.random() * 0.15)
              break
            default: // left
              x = -20
              y = Math.random() * h
              vx = 0.15 + Math.random() * 0.15
              vy = (Math.random() - 0.5) * 0.2
              break
          }

          const targetAlpha = 0.03 + Math.random() * 0.03 // 0.03-0.06
          memoryGhosts.push({
            text,
            x, y, vx, vy,
            alpha: 0,
            targetAlpha,
            fadeDir: 1,
            hue: mem.hue,
            size: 10 + Math.random() * 4,
          })
        }
      }
    }

    // Draw and update ghosts
    const toRemove: number[] = []
    for (let i = 0; i < memoryGhosts.length; i++) {
      const g = memoryGhosts[i]
      g.x += g.vx
      g.y += g.vy

      // Fade in/out
      if (g.fadeDir > 0) {
        g.alpha = Math.min(g.alpha + 0.0005, g.targetAlpha)
        // After reaching target, drift for a while then fade out
        if (g.alpha >= g.targetAlpha) {
          g.fadeDir = 0 // sustain
          // Schedule fade out after a few seconds (via frame counting)
          setTimeout(() => { g.fadeDir = -1 }, 4000 + Math.random() * 3000)
        }
      } else if (g.fadeDir < 0) {
        g.alpha = Math.max(g.alpha - 0.0003, 0)
        if (g.alpha <= 0) {
          toRemove.push(i)
          continue
        }
      }

      // Remove if off screen
      if (g.x < -200 || g.x > w + 200 || g.y < -50 || g.y > h + 50) {
        toRemove.push(i)
        continue
      }

      // Draw ghost text — use hsl for the gold family
      const hDeg = Math.floor(g.hue * 360)
      ctx.font = `300 ${g.size}px 'Cormorant Garamond', serif`
      ctx.fillStyle = `hsla(${hDeg}, 60%, 70%, ${g.alpha})`
      ctx.fillText(g.text, g.x, g.y)
    }

    // Remove dead ghosts (iterate backwards)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      memoryGhosts.splice(toRemove[i], 1)
    }
  }

  // =========================================================
  // INSCRIPTION — philosophical fragments at bottom center
  // =========================================================

  function createInscription() {
    if (!overlay) return

    inscriptionEl = document.createElement('div')
    inscriptionEl.style.cssText = `
      position: absolute;
      bottom: 16px; left: 50%;
      transform: translateX(-50%);
      pointer-events: none;
      z-index: 3;
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300;
      font-size: 11px;
      letter-spacing: 3px;
      color: rgba(255, 215, 0, 0.03);
      font-style: italic;
      text-align: center;
      white-space: nowrap;
      transition: opacity 5s ease;
      opacity: 0;
    `

    // Start with a random inscription
    inscriptionIndex = Math.floor(Math.random() * INSCRIPTIONS.length)
    inscriptionEl.textContent = INSCRIPTIONS[inscriptionIndex]
    overlay.appendChild(inscriptionEl)

    // Fade in after 12 seconds (after the initial quiet)
    setTimeout(() => {
      if (inscriptionEl) inscriptionEl.style.opacity = '1'
    }, 12000)

    // Cycle every 20 seconds with 5-second fade transition
    inscriptionInterval = window.setInterval(() => {
      if (!inscriptionEl) return
      // Fade out
      inscriptionEl.style.opacity = '0'
      // After fade out, change text and fade back in
      setTimeout(() => {
        if (!inscriptionEl) return
        inscriptionIndex = (inscriptionIndex + 1) % INSCRIPTIONS.length
        inscriptionEl.textContent = INSCRIPTIONS[inscriptionIndex]
        inscriptionEl.style.opacity = '1'
      }, 5000)
    }, 20000)
  }

  // =========================================================
  // ROOM LIFECYCLE
  // =========================================================

  return {
    name: 'void',
    label: 'the void',

    create() {
      // The Void's overlay is transparent — the particle system IS the room
      overlay = document.createElement('div')
      overlay.style.cssText = `
        position: relative;
        width: 100%; height: 100%;
        pointer-events: none;
        overflow: hidden;
      `

      // Portal container — edge whispers
      if (deps) {
        portalContainer = document.createElement('div')
        portalContainer.style.cssText = `
          position: absolute; top: 0; left: 0; width: 100%; height: 100%;
          pointer-events: none;
          z-index: 5;
        `
        overlay.appendChild(portalContainer)
      }

      return overlay
    },

    activate() {
      active = true
      if (deps) {
        createPortals()
        createVoiceHint()
        addBreathingAnimation()
      }
      createVignette()
      initCursorEffects()
      initAudio()
      initEffectsCanvas()
      createInscription()
    },

    deactivate() {
      active = false
      if (portalTimeout) cancelAnimationFrame(portalTimeout)
      portalTimeout = null
      if (voiceHintTimeout) clearTimeout(voiceHintTimeout)
      voiceHintTimeout = null
      voiceHintEl = null

      // Tear down audio
      fadeOutAudio()

      // Tear down cursor effects
      if (mouseMoveHandler) {
        window.removeEventListener('mousemove', mouseMoveHandler)
        mouseMoveHandler = null
      }
      // Tear down vignette
      vignetteEl?.remove()
      vignetteEl = null

      // Tear down effects canvas
      if (effectsRAF) cancelAnimationFrame(effectsRAF)
      effectsRAF = null
      effectsCanvas?.remove()
      effectsCanvas = null
      effectsCtx = null
      trailParticles = []
      memoryGhosts = []
      ringPhase = 0

      // Tear down inscription
      if (inscriptionInterval !== null) {
        clearInterval(inscriptionInterval)
        inscriptionInterval = null
      }
      inscriptionEl?.remove()
      inscriptionEl = null

      // Clear portals so they re-create fresh on next visit
      if (portalContainer) portalContainer.innerHTML = ''
      for (const p of PORTALS) p.el = undefined
    },

    destroy() {
      active = false
      if (portalTimeout) cancelAnimationFrame(portalTimeout)
      fadeOutAudio()
      if (mouseMoveHandler) {
        window.removeEventListener('mousemove', mouseMoveHandler)
        mouseMoveHandler = null
      }
      if (effectsRAF) cancelAnimationFrame(effectsRAF)
      effectsCanvas?.remove()
      if (inscriptionInterval !== null) clearInterval(inscriptionInterval)
      overlay?.remove()
    },
  }
}
