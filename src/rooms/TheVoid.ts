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
 */

import type { Room } from './RoomManager'

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
        font-size: 11px;
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
      color: rgba(255, 215, 0, 0.18);
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
        color: rgba(255, 215, 0, 0.18);
        font-style: italic;
      `
      voiceLine.textContent = 'hold space to speak'
      voiceHintEl.appendChild(voiceLine)
    }

    portalContainer.appendChild(voiceHintEl)

    // Fade in after 8 seconds
    voiceHintTimeout = window.setTimeout(() => {
      if (voiceHintEl) voiceHintEl.style.opacity = '1'
    }, 8000)
  }

  function addBreathingAnimation() {
    // Gentle breathing — portals pulse slowly
    let frame = 0
    function breathe() {
      if (!portalContainer) return
      frame++
      for (let i = 0; i < PORTALS.length; i++) {
        const el = PORTALS[i].el
        if (!el) continue
        const s = PORTAL_STYLES[PORTALS[i].name]
        const breathVal = 0.08 + Math.sin(frame * 0.01 + i * 1.5) * 0.04
        el.style.color = s.color.replace('VAR', String(breathVal))
      }
      portalTimeout = requestAnimationFrame(breathe) as unknown as number
    }
    // Start breathing after portals have faded in
    setTimeout(breathe, 20000)
  }

  return {
    name: 'void',
    label: 'the void',

    create() {
      // The Void's overlay is transparent — the particle system IS the room
      overlay = document.createElement('div')
      overlay.style.cssText = `
        width: 100%; height: 100%;
        pointer-events: none;
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
      if (deps) {
        createPortals()
        createVoiceHint()
        addBreathingAnimation()
      }
    },

    deactivate() {
      if (portalTimeout) cancelAnimationFrame(portalTimeout)
      portalTimeout = null
      if (voiceHintTimeout) clearTimeout(voiceHintTimeout)
      voiceHintTimeout = null
      voiceHintEl = null
      // Clear portals so they re-create fresh on next visit
      if (portalContainer) portalContainer.innerHTML = ''
      for (const p of PORTALS) p.el = undefined
    },

    destroy() {
      if (portalTimeout) cancelAnimationFrame(portalTimeout)
      overlay?.remove()
    },
  }
}
