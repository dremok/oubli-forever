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
 * at 40-80Hz) breathes beneath the global drone.
 * Cursor: proximity glow on portals, subtle golden ripples.
 * Vignette: breathing radial darkness at the edges.
 */

import type { Room } from './RoomManager'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface VoidDeps {
  switchTo: (name: string) => void
  voiceSupported?: boolean
}

interface Portal {
  name: string
  hint: string
  position: string // CSS positioning
  el?: HTMLElement
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

  // --- Cursor state ---
  let lastRippleTime = 0
  let mouseMoveHandler: ((e: MouseEvent) => void) | null = null

  // --- Vignette state ---
  let vignetteEl: HTMLElement | null = null

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

  function fadeOutAudio() {
    if (resonanceGain && audioCtx) {
      resonanceGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.15)
    }
    if (filterSweepInterval !== null) {
      clearInterval(filterSweepInterval)
      filterSweepInterval = null
    }
    // Stop oscillators after fade completes
    setTimeout(() => {
      for (const osc of oscillators) {
        try { osc.stop() } catch (_) { /* already stopped */ }
      }
      oscillators = []
      filterNode?.disconnect()
      resonanceGain?.disconnect()
      filterNode = null
      resonanceGain = null
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
  // CURSOR INTERACTION — proximity + ripples
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
  // BREATHING VIGNETTE
  // =========================================================

  function createVignette() {
    if (!overlay) return

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
        rgba(0, 0, 0, 0.3) 70%,
        rgba(0, 0, 0, 0.6) 100%
      );
      transition: opacity 2s ease;
    `
    overlay.appendChild(vignetteEl)
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
      overlay?.remove()
    },
  }
}
