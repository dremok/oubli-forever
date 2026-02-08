/**
 * THE CATACOMBS — beneath the archive, bones of the old internet
 *
 * A hidden room accessible ONLY from The Archive. When you search for
 * certain URLs in the archive, a faint link appears: "descend deeper."
 * Clicking it takes you here.
 *
 * The Catacombs is a scrolling descent through layers of dead internet
 * history, rendered as carved stone inscriptions. Each layer goes deeper
 * in time — 2020s, 2010s, 2000s, 1990s — and the aesthetic degrades
 * with each era. The deepest layer is raw HTML source code from the
 * earliest web pages.
 *
 * The room auto-scrolls downward slowly. You can scroll faster. At the
 * bottom, there's nothing — just void. The descent is the experience.
 *
 * This room is NOT in the tab bar. It can only be reached through
 * The Archive, and you return to The Archive when you leave.
 *
 * Inspired by: Paris catacombs, geological strata, archaeological digs,
 * internet archaeology, the Deep Web metaphor, Dante's descent
 */

import type { Room } from './RoomManager'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface CatacombLayer {
  era: string
  depth: string
  color: string
  bgColor: string
  entries: { text: string; style: 'inscription' | 'code' | 'url' | 'epitaph' }[]
}

const LAYERS: CatacombLayer[] = [
  {
    era: '2020s',
    depth: 'surface level',
    color: 'rgba(180, 160, 120, 0.5)',
    bgColor: 'rgba(20, 15, 10, 0.95)',
    entries: [
      { text: 'here lie the platforms that promised forever', style: 'epitaph' },
      { text: 'vine.co — 6-second loops, infinite replay, gone', style: 'inscription' },
      { text: 'Google Stadia — the future of gaming (2019-2023)', style: 'inscription' },
      { text: 'Clubhouse — every voice mattered, briefly', style: 'inscription' },
      { text: 'Quibi — $1.75 billion, 6 months', style: 'inscription' },
      { text: 'the social contract: we give you our data, you give us a place to exist', style: 'epitaph' },
    ],
  },
  {
    era: '2010s',
    depth: 'first descent',
    color: 'rgba(160, 140, 100, 0.4)',
    bgColor: 'rgba(18, 12, 8, 0.95)',
    entries: [
      { text: 'the age of aggregation. everything in one feed.', style: 'epitaph' },
      { text: 'reader.google.com — where we read before the algorithm decided for us', style: 'inscription' },
      { text: 'del.icio.us — social bookmarking, the original curation', style: 'inscription' },
      { text: 'StumbleUpon — serendipity as a service (2001-2018)', style: 'inscription' },
      { text: 'Posterous — blog anywhere, gone everywhere', style: 'inscription' },
      { text: 'Path — the intimate social network, 150 friends max', style: 'inscription' },
      { text: 'every shutdown email began the same way: "we have made the difficult decision"', style: 'epitaph' },
    ],
  },
  {
    era: '2000s',
    depth: 'the middle depths',
    color: 'rgba(140, 120, 80, 0.35)',
    bgColor: 'rgba(15, 10, 6, 0.95)',
    entries: [
      { text: 'the web was still weird. that was the point.', style: 'epitaph' },
      { text: 'GeoCities — 38 million user pages, deleted in one afternoon (2009)', style: 'inscription' },
      { text: 'Friendster — the first social network, outlived by its successor\'s successor', style: 'inscription' },
      { text: 'Digg — front page of the internet, before Reddit took the name', style: 'inscription' },
      { text: 'Bebo — bought for $850M, sold for $1M', style: 'inscription' },
      { text: '<blink>YOU ARE VISITOR NUMBER 000847</blink>', style: 'code' },
      { text: 'http://www.hamsterdance.com', style: 'url' },
      { text: 'they called it Web 2.0 as if version numbers could contain the chaos', style: 'epitaph' },
    ],
  },
  {
    era: '1990s',
    depth: 'the deep strata',
    color: 'rgba(120, 100, 60, 0.3)',
    bgColor: 'rgba(12, 8, 4, 0.95)',
    entries: [
      { text: 'before the corporations. before the feeds. before the metrics.', style: 'epitaph' },
      { text: 'TheGlobe.com — first social network IPO, rose 606% day one, dead by 2001', style: 'inscription' },
      { text: 'Xoom.com — free web hosting, free email, free everything, free to disappear', style: 'inscription' },
      { text: 'SixDegrees.com — the original social network (1997-2001)', style: 'inscription' },
      { text: '<html><body bgcolor="#000000"><font color="#00ff00">', style: 'code' },
      { text: '<marquee>WELCOME TO MY HOMEPAGE</marquee>', style: 'code' },
      { text: '<img src="under_construction.gif">', style: 'code' },
      { text: '<a href="mailto:webmaster@angelfire.com">email the webmaster</a>', style: 'code' },
      { text: 'the web was a gift. we built cathedrals in our bedrooms.', style: 'epitaph' },
    ],
  },
  {
    era: 'before',
    depth: 'bedrock',
    color: 'rgba(100, 80, 40, 0.2)',
    bgColor: 'rgba(8, 5, 2, 0.95)',
    entries: [
      { text: 'before the web there was the dream of the web', style: 'epitaph' },
      { text: 'Usenet, 1980 — the first social network was text-only', style: 'inscription' },
      { text: 'BBS — you called a phone number to enter a world', style: 'inscription' },
      { text: 'Gopher — the internet that almost was', style: 'inscription' },
      { text: 'ARPANET Message #1: "LO" (tried to type LOGIN, crashed after two letters)', style: 'inscription' },
      { text: '...', style: 'epitaph' },
      { text: '', style: 'epitaph' },
      { text: '', style: 'epitaph' },
      { text: 'there is nothing below this.', style: 'epitaph' },
      { text: '', style: 'epitaph' },
      { text: '', style: 'epitaph' },
      { text: 'or is there?', style: 'epitaph' },
    ],
  },
]

interface CatacombsDeps {
  onReturn: () => void
  onOssuary?: () => void
  switchTo?: (name: string) => void
}

// --- Dust particle type ---
interface DustMote {
  el: HTMLElement
  x: number
  y: number
  vx: number
  vy: number
  opacity: number
  life: number
  maxLife: number
}

export function createCatacombsRoom(deps: CatacombsDeps): Room {
  let overlay: HTMLElement | null = null
  let active = false
  let autoScrollId: number | null = null

  // --- Audio state ---
  let audioCtxRef: AudioContext | null = null
  let audioMaster: GainNode | null = null
  let droneOsc: OscillatorNode | null = null
  let droneGain: GainNode | null = null
  let droneFilter: BiquadFilterNode | null = null
  let dripTimeout: ReturnType<typeof setTimeout> | null = null
  let dripGain: GainNode | null = null
  let audioInitialized = false

  // --- Visual state ---
  let dustMotes: DustMote[] = []
  let dustContainer: HTMLElement | null = null
  let depthIndicator: HTMLElement | null = null
  let depthFill: HTMLElement | null = null
  let dustFrameId: number | null = null
  let torchElements: HTMLElement[] = []
  let layerSections: HTMLElement[] = []

  // --- Scroll tracking ---
  let lastScrollTop = 0
  let scrollSpeed = 0
  let lastLayerIndex = -1
  let scrollHandler: (() => void) | null = null

  // --- Audio helpers ---

  function getScrollFraction(): number {
    if (!overlay) return 0
    const max = overlay.scrollHeight - overlay.clientHeight
    if (max <= 0) return 0
    return Math.min(1, Math.max(0, overlay.scrollTop / max))
  }

  async function initAudio() {
    if (audioInitialized) return
    try {
      const ac = await getAudioContext()
      const dest = getAudioDestination()
      audioCtxRef = ac

      audioMaster = ac.createGain()
      audioMaster.gain.value = 0
      audioMaster.connect(dest)

      // Deep stone drone: sine oscillator through lowpass filter
      droneOsc = ac.createOscillator()
      droneOsc.type = 'sine'
      droneOsc.frequency.value = 55 // start ~middle of 40-60Hz range

      droneFilter = ac.createBiquadFilter()
      droneFilter.type = 'lowpass'
      droneFilter.frequency.value = 80
      droneFilter.Q.value = 1

      droneGain = ac.createGain()
      droneGain.gain.value = 0.02

      droneOsc.connect(droneFilter)
      droneFilter.connect(droneGain)
      droneGain.connect(audioMaster)
      droneOsc.start()

      // Drip gain node (shared by all drip sounds)
      dripGain = ac.createGain()
      dripGain.gain.value = 0.015 // base drip volume
      dripGain.connect(audioMaster)

      audioInitialized = true
      scheduleDrip()
    } catch { /* audio not available */ }
  }

  function scheduleDrip() {
    if (!active || !audioCtxRef || !audioMaster || !dripGain) return
    // 3-8 seconds between drips
    const delay = 3000 + Math.random() * 5000
    dripTimeout = setTimeout(() => {
      if (!active || !audioCtxRef || !audioMaster || !dripGain) return
      try {
        playDrip()
      } catch { /* ignore */ }
      scheduleDrip()
    }, delay)
  }

  function playDrip() {
    if (!audioCtxRef || !dripGain) return
    const ac = audioCtxRef
    // Short noise burst (2-5ms) through highpass at 2000Hz
    const dripLen = 0.002 + Math.random() * 0.003
    const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dripLen), ac.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      // Decaying noise burst
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    }
    const src = ac.createBufferSource()
    src.buffer = buf

    const hp = ac.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 2000 + Math.random() * 1000
    hp.Q.value = 2

    // Volume scales with scroll speed (0.01-0.03 base, up to 0.05 when scrolling fast)
    const speedBoost = Math.min(0.02, scrollSpeed * 0.002)
    const g = ac.createGain()
    g.gain.value = 0.01 + Math.random() * 0.02 + speedBoost

    src.connect(hp)
    hp.connect(g)
    g.connect(dripGain)
    src.start()
    src.onended = () => {
      src.disconnect()
      hp.disconnect()
      g.disconnect()
    }
  }

  function playLayerTransition() {
    if (!audioCtxRef || !audioMaster) return
    try {
      const ac = audioCtxRef
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = 75 + Math.random() * 10 // ~80Hz
      const g = ac.createGain()
      g.gain.value = 0.03
      // Quick fade over ~100ms
      g.gain.setTargetAtTime(0, ac.currentTime + 0.05, 0.03)
      osc.connect(g)
      g.connect(audioMaster)
      osc.start()
      osc.stop(ac.currentTime + 0.15)
      osc.onended = () => {
        osc.disconnect()
        g.disconnect()
      }
    } catch { /* ignore */ }
  }

  function updateDroneFrequency() {
    if (!droneOsc || !audioCtxRef) return
    // 60Hz at top → 30Hz at bottom
    const frac = getScrollFraction()
    const freq = 60 - frac * 30
    droneOsc.frequency.setTargetAtTime(freq, audioCtxRef.currentTime, 0.3)
  }

  function fadeAudioIn() {
    if (audioMaster && audioCtxRef) {
      audioMaster.gain.setTargetAtTime(1, audioCtxRef.currentTime, 0.5)
    }
  }

  function fadeAudioOut() {
    if (audioMaster && audioCtxRef) {
      audioMaster.gain.setTargetAtTime(0, audioCtxRef.currentTime, 0.3)
    }
  }

  function cleanupAudio() {
    if (dripTimeout !== null) {
      clearTimeout(dripTimeout)
      dripTimeout = null
    }
    try { droneOsc?.stop() } catch { /* already stopped */ }
    droneOsc?.disconnect()
    droneFilter?.disconnect()
    droneGain?.disconnect()
    dripGain?.disconnect()
    audioMaster?.disconnect()
    droneOsc = null
    droneFilter = null
    droneGain = null
    dripGain = null
    audioMaster = null
    audioInitialized = false
    audioCtxRef = null
  }

  // --- Scroll handler ---

  function detectCurrentLayer(): number {
    if (!overlay || layerSections.length === 0) return -1
    const scrollMid = overlay.scrollTop + overlay.clientHeight / 2
    for (let i = layerSections.length - 1; i >= 0; i--) {
      if (layerSections[i].offsetTop <= scrollMid) return i
    }
    return 0
  }

  function onScroll() {
    if (!overlay || !active) return
    // Track scroll speed
    const currentTop = overlay.scrollTop
    scrollSpeed = Math.abs(currentTop - lastScrollTop)
    lastScrollTop = currentTop

    // Update drone frequency based on depth
    updateDroneFrequency()

    // Detect layer transitions
    const currentLayer = detectCurrentLayer()
    if (currentLayer !== lastLayerIndex && lastLayerIndex !== -1 && currentLayer >= 0) {
      playLayerTransition()
    }
    lastLayerIndex = currentLayer

    // Update depth indicator
    updateDepthIndicator()
  }

  // --- Visual helpers ---

  function updateDepthIndicator() {
    if (!depthFill || !overlay) return
    const frac = getScrollFraction()
    depthFill.style.height = `${frac * 100}%`
  }

  function createDustMote(): DustMote | null {
    if (!dustContainer || !overlay) return null
    const el = document.createElement('div')
    const size = 1 + Math.random()
    el.style.cssText = `
      position: absolute;
      width: ${size}px; height: ${size}px;
      border-radius: 50%;
      background: rgba(180, 160, 120, 1);
      pointer-events: none;
    `
    const x = Math.random() * (overlay.clientWidth - 20) + 10
    // Spawn near top of visible area
    const y = overlay.scrollTop + Math.random() * overlay.clientHeight * 0.3
    el.style.left = `${x}px`
    el.style.top = `${y}px`

    const opacity = 0.03 + Math.random() * 0.05
    el.style.opacity = String(opacity)

    dustContainer.appendChild(el)

    const maxLife = 300 + Math.random() * 400 // frames
    return {
      el,
      x,
      y,
      vx: (Math.random() - 0.5) * 0.15,
      vy: 0.1 + Math.random() * 0.2,
      opacity,
      life: 0,
      maxLife,
    }
  }

  function updateDustMotes() {
    if (!active || !dustContainer) return

    // Spawn new motes — more when scrolling fast
    const spawnChance = 0.08 + Math.min(0.15, scrollSpeed * 0.01)
    if (dustMotes.length < 20 && Math.random() < spawnChance) {
      const mote = createDustMote()
      if (mote) dustMotes.push(mote)
    }

    // Update existing
    for (let i = dustMotes.length - 1; i >= 0; i--) {
      const m = dustMotes[i]
      m.life++
      m.x += m.vx
      m.y += m.vy

      // Fade in for first 30 frames, fade out for last 60 frames
      let alpha = m.opacity
      if (m.life < 30) {
        alpha = m.opacity * (m.life / 30)
      } else if (m.life > m.maxLife - 60) {
        alpha = m.opacity * ((m.maxLife - m.life) / 60)
      }

      m.el.style.left = `${m.x}px`
      m.el.style.top = `${m.y}px`
      m.el.style.opacity = String(Math.max(0, alpha))

      // Remove dead motes
      if (m.life >= m.maxLife) {
        m.el.remove()
        dustMotes.splice(i, 1)
      }
    }

    dustFrameId = requestAnimationFrame(updateDustMotes)
  }

  function createTorch(section: HTMLElement, layerIndex: number) {
    // Only add torches to some layers (not the deepest — too far underground)
    if (layerIndex >= LAYERS.length - 1) return

    const torch = document.createElement('div')
    // Alternate left/right
    const side = layerIndex % 2 === 0 ? 'left' : 'right'
    const warmth = Math.max(0.02, 0.06 - layerIndex * 0.01)
    torch.style.cssText = `
      position: absolute;
      ${side}: 8px;
      top: 30%;
      width: 40px; height: 60px;
      background: radial-gradient(ellipse at center, rgba(200, 140, 50, ${warmth}) 0%, transparent 70%);
      pointer-events: none;
      animation: catacombTorchFlicker${layerIndex} ${3 + layerIndex * 0.5}s ease-in-out infinite alternate;
    `
    // Each torch needs its own keyframes for variety
    const style = document.createElement('style')
    style.textContent = `
      @keyframes catacombTorchFlicker${layerIndex} {
        0% { opacity: 0.6; transform: scale(1); }
        25% { opacity: 0.9; transform: scale(1.05); }
        50% { opacity: 0.5; transform: scale(0.95); }
        75% { opacity: 1.0; transform: scale(1.02); }
        100% { opacity: 0.7; transform: scale(0.98); }
      }
    `
    torch.appendChild(style)

    // Section needs relative positioning for absolute torch
    section.style.position = 'relative'
    section.appendChild(torch)
    torchElements.push(torch)
  }

  return {
    name: 'catacombs',
    label: 'the catacombs',
    hidden: true,

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        width: 100%; height: 100%;
        pointer-events: auto;
        overflow-y: auto;
        scrollbar-width: none;
        background: rgba(10, 7, 4, 1);
      `

      const style = document.createElement('style')
      style.textContent = `
        .catacombs-scroll::-webkit-scrollbar { display: none; }
        @keyframes catacombFlicker {
          0%, 90%, 100% { opacity: 1; }
          92% { opacity: 0.7; }
          95% { opacity: 0.9; }
        }
      `
      overlay.appendChild(style)
      overlay.classList.add('catacombs-scroll')

      // --- Depth indicator (left edge) ---
      depthIndicator = document.createElement('div')
      depthIndicator.style.cssText = `
        position: fixed;
        left: 4px; top: 10%;
        width: 1px; height: 80%;
        background: rgba(180, 160, 120, 0.04);
        pointer-events: none;
        z-index: 10;
      `
      depthFill = document.createElement('div')
      depthFill.style.cssText = `
        width: 100%; height: 0%;
        background: rgba(180, 160, 120, 0.1);
        transition: height 0.3s ease;
      `
      depthIndicator.appendChild(depthFill)
      overlay.appendChild(depthIndicator)

      // --- Dust container (absolute positioned within scrollable area) ---
      dustContainer = document.createElement('div')
      dustContainer.style.cssText = `
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
        pointer-events: none;
        z-index: 5;
      `
      overlay.appendChild(dustContainer)

      // Entrance text
      const entrance = document.createElement('div')
      entrance.style.cssText = `
        text-align: center;
        padding: 80px 20px 60px;
      `

      const entranceTitle = document.createElement('div')
      entranceTitle.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 18px;
        color: rgba(180, 160, 120, 0.3);
        letter-spacing: 6px; text-transform: uppercase;
        margin-bottom: 16px;
      `
      entranceTitle.textContent = 'descending'
      entrance.appendChild(entranceTitle)

      const arrow = document.createElement('div')
      arrow.style.cssText = `
        font-size: 24px;
        color: rgba(180, 160, 120, 0.1);
        animation: catacombFlicker 4s ease-in-out infinite;
      `
      arrow.textContent = '\u25BC'
      entrance.appendChild(arrow)

      overlay.appendChild(entrance)

      // Build layers
      layerSections = []
      for (let li = 0; li < LAYERS.length; li++) {
        const layer = LAYERS[li]
        const section = document.createElement('div')
        section.style.cssText = `
          padding: 40px 20px;
          background: ${layer.bgColor};
          min-height: 60vh;
          display: flex; flex-direction: column;
          align-items: center;
          border-top: 1px solid rgba(180, 160, 120, 0.03);
        `

        // Era header
        const header = document.createElement('div')
        header.style.cssText = `
          text-align: center; margin-bottom: 40px;
        `

        const eraLabel = document.createElement('div')
        eraLabel.style.cssText = `
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300; font-size: 12px;
          color: ${layer.color};
          letter-spacing: 4px; text-transform: uppercase;
          margin-bottom: 4px;
        `
        eraLabel.textContent = layer.era
        header.appendChild(eraLabel)

        const depthLabel = document.createElement('div')
        depthLabel.style.cssText = `
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300; font-size: 10px; font-style: italic;
          color: rgba(180, 160, 120, 0.12);
          letter-spacing: 2px;
        `
        depthLabel.textContent = layer.depth
        header.appendChild(depthLabel)

        section.appendChild(header)

        // Entries
        for (const entry of layer.entries) {
          const el = document.createElement('div')
          el.style.cssText = `
            max-width: 500px;
            margin-bottom: 24px;
            text-align: center;
          `

          if (entry.style === 'inscription') {
            el.style.cssText += `
              font-family: 'Cormorant Garamond', serif;
              font-weight: 300; font-size: 14px;
              color: ${layer.color};
              letter-spacing: 0.5px;
              line-height: 1.6;
            `
          } else if (entry.style === 'code') {
            el.style.cssText += `
              font-family: 'Courier New', monospace;
              font-size: 11px;
              color: rgba(100, 180, 80, 0.25);
              letter-spacing: 0;
              opacity: 0.7;
            `
          } else if (entry.style === 'url') {
            el.style.cssText += `
              font-family: 'Courier New', monospace;
              font-size: 11px;
              color: rgba(100, 140, 200, 0.25);
              text-decoration: line-through;
            `
          } else if (entry.style === 'epitaph') {
            el.style.cssText += `
              font-family: 'Cormorant Garamond', serif;
              font-weight: 300; font-size: 13px; font-style: italic;
              color: rgba(180, 160, 120, ${parseFloat(layer.color.match(/[\d.]+(?=\))/)?.[0] || '0.3') * 0.5});
              letter-spacing: 1px;
              line-height: 1.8;
            `
          }

          el.textContent = entry.text
          section.appendChild(el)
        }

        // Add torch flicker to this layer section
        createTorch(section, li)

        overlay.appendChild(section)
        layerSections.push(section)
      }

      // Bottom void
      const bottom = document.createElement('div')
      bottom.style.cssText = `
        height: 100vh;
        background: linear-gradient(rgba(8, 5, 2, 1), rgba(0, 0, 0, 1));
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 40px;
      `

      // Return link
      const returnLink = document.createElement('div')
      returnLink.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 12px;
        color: rgba(180, 160, 120, 0.15);
        letter-spacing: 3px; text-transform: uppercase;
        cursor: pointer;
        transition: color 0.5s ease;
      `
      returnLink.textContent = '\u25B2 ascend to the archive'
      returnLink.addEventListener('mouseenter', () => {
        returnLink.style.color = 'rgba(180, 160, 120, 0.5)'
      })
      returnLink.addEventListener('mouseleave', () => {
        returnLink.style.color = 'rgba(180, 160, 120, 0.15)'
      })
      returnLink.addEventListener('click', deps.onReturn)
      bottom.appendChild(returnLink)

      // Ossuary link
      if (deps.onOssuary) {
        const ossuaryLink = document.createElement('div')
        ossuaryLink.style.cssText = `
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300; font-size: 11px;
          color: rgba(220, 210, 190, 0.08);
          letter-spacing: 2px;
          cursor: pointer;
          transition: color 0.5s ease;
        `
        ossuaryLink.textContent = '\u2192 the ossuary'
        ossuaryLink.addEventListener('mouseenter', () => {
          ossuaryLink.style.color = 'rgba(220, 210, 190, 0.3)'
        })
        ossuaryLink.addEventListener('mouseleave', () => {
          ossuaryLink.style.color = 'rgba(220, 210, 190, 0.08)'
        })
        ossuaryLink.addEventListener('click', deps.onOssuary)
        bottom.appendChild(ossuaryLink)
      }

      // Navigation portals — carved stone inscriptions to connected rooms
      if (deps.switchTo) {
        const portalData = [
          { label: '\u2191 the archive', room: 'archive' },
          { label: '\u2192 the ossuary', room: 'ossuary' },
        ]
        const portalRow = document.createElement('div')
        portalRow.style.cssText = `
          display: flex; gap: 40px; margin-top: 30px;
        `
        for (const portal of portalData) {
          const el = document.createElement('div')
          el.style.cssText = `
            font-family: 'Cormorant Garamond', serif;
            font-weight: 300; font-size: 10px;
            color: rgba(180, 160, 120, 0.06);
            letter-spacing: 2px;
            cursor: pointer;
            transition: color 0.5s ease;
          `
          el.textContent = portal.label
          el.addEventListener('mouseenter', () => {
            el.style.color = 'rgba(180, 160, 120, 0.35)'
          })
          el.addEventListener('mouseleave', () => {
            el.style.color = 'rgba(180, 160, 120, 0.06)'
          })
          el.addEventListener('click', () => deps.switchTo!(portal.room))
          portalRow.appendChild(el)
        }
        bottom.appendChild(portalRow)
      }

      overlay.appendChild(bottom)

      return overlay
    },

    activate() {
      active = true
      lastScrollTop = overlay?.scrollTop ?? 0
      scrollSpeed = 0
      lastLayerIndex = -1

      // Scroll listener
      scrollHandler = onScroll
      overlay?.addEventListener('scroll', scrollHandler, { passive: true })

      // Auto-scroll that slows as you descend
      if (overlay) {
        autoScrollId = window.setInterval(() => {
          if (overlay && active) {
            // Slow down with depth: 0.5 px at top → 0.2 px at bottom
            const frac = getScrollFraction()
            const speed = 0.5 - frac * 0.3
            overlay.scrollTop += speed
          }
        }, 16)
      }

      // Init audio
      initAudio().then(() => fadeAudioIn())

      // Start dust particle loop
      dustFrameId = requestAnimationFrame(updateDustMotes)

      // Initial depth indicator update
      updateDepthIndicator()
    },

    deactivate() {
      active = false
      if (autoScrollId) clearInterval(autoScrollId)
      autoScrollId = null

      // Remove scroll listener
      if (scrollHandler && overlay) {
        overlay.removeEventListener('scroll', scrollHandler)
        scrollHandler = null
      }

      // Fade audio out
      fadeAudioOut()
      if (dripTimeout !== null) {
        clearTimeout(dripTimeout)
        dripTimeout = null
      }

      // Stop dust animation
      if (dustFrameId !== null) {
        cancelAnimationFrame(dustFrameId)
        dustFrameId = null
      }
    },

    destroy() {
      active = false
      if (autoScrollId) clearInterval(autoScrollId)
      autoScrollId = null

      // Remove scroll listener
      if (scrollHandler && overlay) {
        overlay.removeEventListener('scroll', scrollHandler)
        scrollHandler = null
      }

      // Full audio cleanup
      cleanupAudio()

      // Stop dust animation and remove motes
      if (dustFrameId !== null) {
        cancelAnimationFrame(dustFrameId)
        dustFrameId = null
      }
      for (const m of dustMotes) {
        m.el.remove()
      }
      dustMotes = []
      dustContainer = null
      depthIndicator = null
      depthFill = null
      torchElements = []
      layerSections = []

      overlay?.remove()
    },
  }
}
