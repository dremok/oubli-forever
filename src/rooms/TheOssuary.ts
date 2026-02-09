/**
 * THE OSSUARY — where dead memories rest
 *
 * A hidden room accessible from BOTH The Roots and The Catacombs.
 * Two underground paths converge here. This is the final resting
 * place for memories that have degraded past 70%.
 *
 * The visual: bone-white fragments arranged in patterns on dark walls,
 * like the Paris catacombs' ossuary where bones become architecture.
 * Each degraded memory is a bone-like glyph. The most degraded are
 * barely visible — just the ghost of a shape.
 *
 * The room is nearly silent — faint wind, an occasional drip, the
 * barely perceptible resonance of bone when touched. A memorial.
 *
 * From here you can return to The Roots OR The Catacombs — the two
 * underground paths remain open.
 *
 * Inspired by: Paris Catacombs ossuary, Sedlec Ossuary (bone church),
 * memento mori, archaeological bone pits, the dignity of the dead,
 * Buddhist charnel grounds
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface OssuaryDeps {
  getMemories: () => StoredMemory[]
  toRoots: () => void
  toCatacombs: () => void
  switchTo?: (name: string) => void
}

// Glyph hit-test info for interaction
interface GlyphHit {
  x: number
  y: number
  size: number
  memId: string
  originalText: string
  // Rendered position after magnetic pull offset
  renderX: number
  renderY: number
}

// Click-expand animation state
interface ExpandAnim {
  glyphIdx: number
  progress: number // 0..1
  memId: string
  originalText: string
  x: number
  y: number
  size: number
}

// Bone dust particle
interface DustParticle {
  x: number
  y: number
  vy: number
  alpha: number
  size: number
  life: number
  maxLife: number
}

const HONORED_KEY = 'oubli-ossuary-honored'
const INSCRIPTIONS = [
  'remember that you will forget',
  'here rest the words that were',
  'dust returns to dust',
  'what was remembered is here released',
]

// Cultural inscriptions — real-world grounding, cycling at near-invisible alpha
const CULTURAL_INSCRIPTIONS = [
  '788 species on the seafloor, most unnamed. mining cut their numbers by a third.',
  'the seabed grows one thousandth of a millimeter per year. we scarred it in an afternoon.',
  'christian boltanski archived the dead. what are we archiving?',
  'felix gonzalez-torres let the candy pile shrink. the viewer takes a piece of someone\u2019s weight.',
  'menopause erases grey matter in the hippocampus. the gateway between memory and self narrows.',
  'the nihilist penguin walked toward a mountain. it never came back. we watched and understood.',
  'see memory: 30,000 hand-painted frames of how forgetting looks. each frame a bone.',
  'judit polgar broke fischer\'s record at 15. the first and only woman in the world top 10. memory is strategy.',
  'silver ions heal nano-fissures at 3 nanometers. between holding and shattering: a coat of silver.',
  'lab-grown brain circuits wire themselves in real time. without the thalamus, neurons stay immature.',
]

export function createOssuaryRoom(deps: OssuaryDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  // Bone archway portal state
  let hoveredArchway: 'left' | 'right' | null = null
  let archwayTransition: { side: 'left' | 'right', progress: number } | null = null
  let archwayDust: DustParticle[] = []

  // Glyph interaction state
  let glyphHits: GlyphHit[] = []
  let hoveredGlyphIdx = -1
  let mouseX = 0
  let mouseY = 0
  let honoredIds: Set<string> = new Set()
  // Honor glow animations: memId -> remaining glow time (seconds)
  const honorGlows: Map<string, number> = new Map()

  // Bone dust particles
  let dustParticles: DustParticle[] = []

  // Inscription state
  let inscriptionIdx = 0
  let inscriptionAlpha = 0
  let inscriptionFading: 'in' | 'hold' | 'out' = 'in'
  let inscriptionTimer = 0

  // Cultural inscription state (separate cycle from main inscriptions)
  let culturalIdx = 0
  let culturalAlpha = 0
  let culturalFading: 'in' | 'hold' | 'out' = 'in'
  let culturalTimer = 0

  // Click-expand animation
  let expandAnim: ExpandAnim | null = null

  // Hover rattle audio state
  let rattleGain: GainNode | null = null
  let rattleSource: AudioBufferSourceNode | null = null
  let rattleFilter: BiquadFilterNode | null = null
  let isRattling = false
  let lastHoveredIdx = -1

  // Audio state
  let audioInitialized = false
  let audioMaster: GainNode | null = null
  let windSource: AudioBufferSourceNode | null = null
  let windGain: GainNode | null = null
  let dripTimeout: ReturnType<typeof setTimeout> | null = null
  let audioCtxRef: AudioContext | null = null

  // --- Bone archway portal rendering ---
  function drawBoneArchway(cx: number, cy: number, archW: number, archH: number, side: 'left' | 'right', hovered: boolean) {
    if (!ctx) return
    const isLeft = side === 'left'

    // Inner glow — the passage beyond
    const glowIntensity = hovered ? 0.12 : 0.04
    const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, archW * 0.6)
    if (isLeft) {
      glowGrad.addColorStop(0, `rgba(140, 100, 50, ${glowIntensity})`)
      glowGrad.addColorStop(0.6, `rgba(100, 70, 30, ${glowIntensity * 0.4})`)
      glowGrad.addColorStop(1, 'rgba(80, 60, 20, 0)')
    } else {
      glowGrad.addColorStop(0, `rgba(200, 190, 170, ${glowIntensity})`)
      glowGrad.addColorStop(0.6, `rgba(180, 170, 150, ${glowIntensity * 0.4})`)
      glowGrad.addColorStop(1, 'rgba(160, 150, 130, 0)')
    }
    ctx.fillStyle = glowGrad
    ctx.beginPath()
    ctx.ellipse(cx, cy, archW * 0.5, archH * 0.45, 0, 0, Math.PI * 2)
    ctx.fill()

    // Draw bone fragments forming the archway
    const boneCount = 14
    const boneColor = isLeft ? 'rgba(120, 85, 40,' : 'rgba(210, 200, 180,'
    const boneColorHover = isLeft ? 'rgba(160, 115, 60,' : 'rgba(230, 220, 200,'

    for (let i = 0; i < boneCount; i++) {
      const t = i / (boneCount - 1) // 0 to 1 around the arch
      const angle = Math.PI * 0.15 + t * Math.PI * 0.7 // arc from ~27deg to ~153deg (top arc)
      const rx = archW * 0.45
      const ry = archH * 0.48
      const bx = cx + Math.cos(angle + Math.PI) * rx
      const by = cy - Math.sin(angle) * ry

      // Slight hover shift
      const shiftX = hovered ? Math.sin(time * 2 + i * 1.3) * 1.5 : 0
      const shiftY = hovered ? Math.cos(time * 1.7 + i * 0.9) * 1 : 0

      const alpha = hovered ? 0.25 : 0.1
      const col = hovered ? boneColorHover : boneColor

      ctx.save()
      ctx.translate(bx + shiftX, by + shiftY)
      ctx.rotate(angle - Math.PI / 2 + Math.sin(i * 7.3) * 0.3)

      // Draw bone-like shapes — mix of types
      ctx.strokeStyle = `${col} ${alpha})`
      ctx.fillStyle = `${col} ${alpha * 0.3})`
      ctx.lineWidth = 0.8

      const boneType = i % 4
      const boneSize = 8 + (i * 3.7 % 6)

      if (boneType === 0) {
        // Long bone fragment
        ctx.beginPath()
        ctx.ellipse(0, 0, boneSize * 0.12, boneSize * 0.4, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(0, -boneSize * 0.35, boneSize * 0.1, 0, Math.PI * 2)
        ctx.arc(0, boneSize * 0.35, boneSize * 0.1, 0, Math.PI * 2)
        ctx.stroke()
      } else if (boneType === 1 && !isLeft) {
        // Skull fragment (catacombs side)
        ctx.beginPath()
        ctx.arc(0, 0, boneSize * 0.25, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(-boneSize * 0.08, -boneSize * 0.04, boneSize * 0.05, 0, Math.PI * 2)
        ctx.arc(boneSize * 0.08, -boneSize * 0.04, boneSize * 0.05, 0, Math.PI * 2)
        ctx.fill()
      } else if (boneType === 1 && isLeft) {
        // Root-like curve (roots side)
        ctx.beginPath()
        ctx.moveTo(0, -boneSize * 0.3)
        ctx.quadraticCurveTo(boneSize * 0.2, 0, -boneSize * 0.1, boneSize * 0.3)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(-boneSize * 0.1, boneSize * 0.3)
        ctx.quadraticCurveTo(-boneSize * 0.25, boneSize * 0.4, -boneSize * 0.15, boneSize * 0.5)
        ctx.stroke()
      } else if (boneType === 2) {
        // Cross / vertebra
        ctx.beginPath()
        ctx.moveTo(-boneSize * 0.2, 0)
        ctx.lineTo(boneSize * 0.2, 0)
        ctx.moveTo(0, -boneSize * 0.15)
        ctx.lineTo(0, boneSize * 0.15)
        ctx.stroke()
      } else {
        // Shard fragment
        ctx.beginPath()
        ctx.moveTo(0, -boneSize * 0.25)
        ctx.lineTo(boneSize * 0.15, boneSize * 0.1)
        ctx.lineTo(-boneSize * 0.12, boneSize * 0.2)
        ctx.closePath()
        ctx.stroke()
      }

      ctx.restore()
    }

    // Threshold stones at the base
    const baseY = cy + archH * 0.42
    const baseAlpha = hovered ? 0.2 : 0.07
    const baseCol = hovered ? boneColorHover : boneColor
    ctx.strokeStyle = `${baseCol} ${baseAlpha})`
    ctx.lineWidth = 0.6
    ctx.beginPath()
    ctx.moveTo(cx - archW * 0.4, baseY)
    ctx.lineTo(cx + archW * 0.4, baseY)
    ctx.stroke()

    // Room label inside the archway glow
    const labelAlpha = hovered ? 0.3 : 0.08
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = isLeft
      ? `rgba(140, 100, 50, ${labelAlpha})`
      : `rgba(200, 190, 170, ${labelAlpha})`
    ctx.textAlign = 'center'
    ctx.fillText(isLeft ? 'the roots' : 'the catacombs', cx, cy + 4)
  }

  function spawnArchwayDust(cx: number, cy: number, archH: number) {
    for (let i = 0; i < 12; i++) {
      archwayDust.push({
        x: cx + (Math.random() - 0.5) * 40,
        y: cy + (Math.random() - 0.5) * archH * 0.6,
        vy: -(0.5 + Math.random() * 1.2),
        alpha: 0.08 + Math.random() * 0.08,
        size: 0.5 + Math.random() * 1.5,
        life: 0,
        maxLife: 30 + Math.random() * 40,
      })
    }
  }

  function updateArchwayDust() {
    for (let i = archwayDust.length - 1; i >= 0; i--) {
      const p = archwayDust[i]
      p.y += p.vy
      p.x += Math.sin(p.life * 0.15 + p.x * 0.05) * 0.4
      p.life++
      if (p.life > p.maxLife) {
        archwayDust.splice(i, 1)
      }
    }
  }

  function renderArchwayDust() {
    if (!ctx) return
    for (const p of archwayDust) {
      const fadeIn = Math.min(1, p.life / 8)
      const fadeOut = Math.max(0, 1 - p.life / p.maxLife)
      const a = p.alpha * fadeIn * fadeOut
      ctx.fillStyle = `rgba(220, 210, 190, ${a})`
      ctx.fillRect(p.x, p.y, p.size, p.size)
    }
  }

  function isInsideArchway(mx: number, my: number, cx: number, cy: number, archW: number, archH: number): boolean {
    const dx = (mx - cx) / (archW * 0.5)
    const dy = (my - cy) / (archH * 0.5)
    return dx * dx + dy * dy < 1
  }

  // --- localStorage for honored memories ---
  function loadHonored() {
    try {
      const raw = localStorage.getItem(HONORED_KEY)
      if (raw) honoredIds = new Set(JSON.parse(raw))
    } catch { /* ignore */ }
  }

  function saveHonored() {
    try {
      localStorage.setItem(HONORED_KEY, JSON.stringify([...honoredIds]))
    } catch { /* ignore */ }
  }

  // --- Audio ---
  async function initAudio() {
    if (audioInitialized) return
    try {
      const ac = await getAudioContext()
      const dest = getAudioDestination()
      audioCtxRef = ac

      audioMaster = ac.createGain()
      audioMaster.gain.value = 0
      audioMaster.connect(dest)

      // Wind: brown noise through lowpass at ~200Hz, extremely quiet
      const bufferLen = ac.sampleRate * 4
      const noiseBuffer = ac.createBuffer(1, bufferLen, ac.sampleRate)
      const data = noiseBuffer.getChannelData(0)
      let lastOut = 0
      for (let i = 0; i < bufferLen; i++) {
        const white = Math.random() * 2 - 1
        lastOut = (lastOut + (0.02 * white)) / 1.02
        data[i] = lastOut * 3.5
      }

      windSource = ac.createBufferSource()
      windSource.buffer = noiseBuffer
      windSource.loop = true

      const windFilter = ac.createBiquadFilter()
      windFilter.type = 'lowpass'
      windFilter.frequency.value = 200

      windGain = ac.createGain()
      windGain.gain.value = 0.06 // very quiet

      windSource.connect(windFilter)
      windFilter.connect(windGain)
      windGain.connect(audioMaster)
      windSource.start()

      audioInitialized = true
      scheduleDrip()
    } catch { /* audio not available */ }
  }

  function scheduleDrip() {
    if (!active || !audioCtxRef || !audioMaster) return
    const delay = 15000 + Math.random() * 10000 // 15-25s
    dripTimeout = setTimeout(() => {
      if (!active || !audioCtxRef || !audioMaster) return
      try {
        const ac = audioCtxRef
        // Short noise burst through high bandpass for drip sound
        const dripLen = 0.04
        const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dripLen), ac.sampleRate)
        const d = buf.getChannelData(0)
        for (let i = 0; i < d.length; i++) {
          d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) // decaying noise
        }
        const src = ac.createBufferSource()
        src.buffer = buf

        const bp = ac.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 3000
        bp.Q.value = 4

        const g = ac.createGain()
        g.gain.value = 0.08

        src.connect(bp)
        bp.connect(g)
        g.connect(audioMaster!)
        src.start()
        src.onended = () => {
          src.disconnect()
          bp.disconnect()
          g.disconnect()
        }
      } catch { /* ignore */ }
      scheduleDrip()
    }, delay)
  }

  function playBoneResonance() {
    if (!audioCtxRef || !audioMaster) return
    try {
      const ac = audioCtxRef
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = 800
      const g = ac.createGain()
      g.gain.value = 0.015 // barely perceptible
      g.gain.setTargetAtTime(0, ac.currentTime + 0.05, 0.03) // fade out over ~100ms total
      osc.connect(g)
      g.connect(audioMaster!)
      osc.start()
      osc.stop(ac.currentTime + 0.15)
      osc.onended = () => {
        osc.disconnect()
        g.disconnect()
      }
    } catch { /* ignore */ }
  }

  // Bone-crack/chime: noise burst through high bandpass + sine tone, very short
  function playBoneCrackChime() {
    if (!audioCtxRef || !audioMaster) return
    try {
      const ac = audioCtxRef
      const now = ac.currentTime

      // Noise burst through high bandpass (2000-4000Hz)
      const crackLen = 0.06
      const noiseBuf = ac.createBuffer(1, Math.ceil(ac.sampleRate * crackLen), ac.sampleRate)
      const nd = noiseBuf.getChannelData(0)
      for (let i = 0; i < nd.length; i++) {
        const env = 1 - i / nd.length // decaying envelope
        nd[i] = (Math.random() * 2 - 1) * env * env
      }
      const noiseSrc = ac.createBufferSource()
      noiseSrc.buffer = noiseBuf

      const bp = ac.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 3000 // center of 2000-4000Hz
      bp.Q.value = 1.5

      const noiseGain = ac.createGain()
      noiseGain.gain.setValueAtTime(0.12, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + crackLen)

      noiseSrc.connect(bp)
      bp.connect(noiseGain)
      noiseGain.connect(audioMaster!)
      noiseSrc.start(now)
      noiseSrc.stop(now + crackLen)
      noiseSrc.onended = () => {
        noiseSrc.disconnect(); bp.disconnect(); noiseGain.disconnect()
      }

      // Sine chime at 400-600Hz range
      const freq = 400 + Math.random() * 200
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq

      const chimeGain = ac.createGain()
      chimeGain.gain.setValueAtTime(0.04, now)
      chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

      osc.connect(chimeGain)
      chimeGain.connect(audioMaster!)
      osc.start(now)
      osc.stop(now + 0.25)
      osc.onended = () => {
        osc.disconnect(); chimeGain.disconnect()
      }
    } catch { /* ignore */ }
  }

  // Start hover rattle: very fast filtered noise at low gain
  function startRattle() {
    if (!audioCtxRef || !audioMaster || isRattling) return
    try {
      const ac = audioCtxRef
      // Create a looping short noise buffer
      const bufLen = Math.ceil(ac.sampleRate * 0.5)
      const buf = ac.createBuffer(1, bufLen, ac.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < bufLen; i++) {
        // Rapid amplitude modulation for rattling effect
        const mod = Math.sin(i / ac.sampleRate * Math.PI * 2 * 40) // 40Hz modulation
        d[i] = (Math.random() * 2 - 1) * Math.abs(mod)
      }

      rattleSource = ac.createBufferSource()
      rattleSource.buffer = buf
      rattleSource.loop = true

      rattleFilter = ac.createBiquadFilter()
      rattleFilter.type = 'bandpass'
      rattleFilter.frequency.value = 2500
      rattleFilter.Q.value = 2

      rattleGain = ac.createGain()
      rattleGain.gain.value = 0
      rattleGain.gain.setTargetAtTime(0.015, ac.currentTime, 0.05)

      rattleSource.connect(rattleFilter)
      rattleFilter.connect(rattleGain)
      rattleGain.connect(audioMaster!)
      rattleSource.start()
      isRattling = true
    } catch { /* ignore */ }
  }

  function stopRattle() {
    if (!isRattling) return
    try {
      if (rattleGain && audioCtxRef) {
        rattleGain.gain.setTargetAtTime(0, audioCtxRef.currentTime, 0.05)
      }
      setTimeout(() => {
        try { rattleSource?.stop() } catch { /* already stopped */ }
        rattleSource?.disconnect()
        rattleFilter?.disconnect()
        rattleGain?.disconnect()
        rattleSource = null
        rattleFilter = null
        rattleGain = null
        isRattling = false
      }, 150)
    } catch {
      rattleSource = null
      rattleFilter = null
      rattleGain = null
      isRattling = false
    }
  }

  // Spawn bone-dust particles at click point (8-15 drifting downward)
  function spawnClickDust(cx: number, cy: number) {
    const count = 8 + Math.floor(Math.random() * 8) // 8-15
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const spread = Math.random() * 6
      dustParticles.push({
        x: cx + Math.cos(angle) * spread,
        y: cy + Math.sin(angle) * spread,
        vy: 0.3 + Math.random() * 0.5, // drift downward
        alpha: 0.06 + Math.random() * 0.06,
        size: 0.5 + Math.random() * 2,
        life: 0,
        maxLife: 120 + Math.random() * 60, // 2-3 seconds at 60fps
      })
    }
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
    stopRattle()
    try { windSource?.stop() } catch { /* already stopped */ }
    windSource?.disconnect()
    windGain?.disconnect()
    audioMaster?.disconnect()
    windSource = null
    windGain = null
    audioMaster = null
    audioInitialized = false
    audioCtxRef = null
  }

  // --- Dust particles ---
  function spawnAmbientDust() {
    if (!canvas) return
    // Spawn a few particles per frame near the glyph area
    if (Math.random() < 0.3) {
      const x = 40 + Math.random() * (canvas.width - 80)
      dustParticles.push({
        x,
        y: -2,
        vy: 0.15 + Math.random() * 0.25,
        alpha: 0.02 + Math.random() * 0.03,
        size: 0.5 + Math.random() * 1,
        life: 0,
        maxLife: 300 + Math.random() * 400,
      })
    }
  }

  function spawnHonorBurst(bx: number, by: number) {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.3 + Math.random() * 0.8
      dustParticles.push({
        x: bx + Math.cos(angle) * 5,
        y: by + Math.sin(angle) * 5,
        vy: Math.sin(angle) * speed - 0.3, // mostly upward
        alpha: 0.06 + Math.random() * 0.06,
        size: 0.5 + Math.random() * 1.5,
        life: 0,
        maxLife: 60 + Math.random() * 80,
      })
      // Also store vx in the x-velocity by abusing the existing structure
      // We'll just give them a slight horizontal drift instead
    }
  }

  function updateDust() {
    for (let i = dustParticles.length - 1; i >= 0; i--) {
      const p = dustParticles[i]
      p.y += p.vy
      p.x += Math.sin(p.life * 0.02 + p.x * 0.01) * 0.15 // tiny horizontal drift
      p.life++
      if (p.life > p.maxLife || (canvas && p.y > canvas.height + 5)) {
        dustParticles.splice(i, 1)
      }
    }
  }

  function renderDust() {
    if (!ctx) return
    for (const p of dustParticles) {
      const fadeIn = Math.min(1, p.life / 30)
      const fadeOut = Math.max(0, 1 - p.life / p.maxLife)
      const a = p.alpha * fadeIn * fadeOut
      ctx.fillStyle = `rgba(220, 210, 190, ${a})`
      ctx.fillRect(p.x, p.y, p.size, p.size)
    }
  }

  // --- Wall texture (sedimentary strata + cracks) ---
  function drawWallTexture(w: number, h: number) {
    if (!ctx) return

    // Horizontal strata lines — like sedimentary rock layers
    ctx.strokeStyle = 'rgba(220, 210, 190, 0.012)'
    ctx.lineWidth = 0.5
    // Deterministic but irregular spacing
    let sy = 8
    let strataIdx = 0
    while (sy < h) {
      const waveSeed = strataIdx * 73.1
      ctx.beginPath()
      ctx.moveTo(0, sy)
      for (let sx = 0; sx < w; sx += 8) {
        const waveY = sy + Math.sin(sx * 0.003 + waveSeed) * 2 + Math.sin(sx * 0.01 + waveSeed * 2.3) * 0.5
        ctx.lineTo(sx, waveY)
      }
      ctx.stroke()
      // Irregular spacing between strata
      sy += 6 + Math.abs(Math.sin(strataIdx * 31.7)) * 14
      strataIdx++
    }

    // Faint cracks — thin lines at irregular intervals
    ctx.strokeStyle = 'rgba(220, 210, 190, 0.015)'
    ctx.lineWidth = 0.3
    const crackCount = 12
    for (let i = 0; i < crackCount; i++) {
      const seed = i * 197.3 + 41.9
      let cx = (Math.sin(seed) * 0.5 + 0.5) * w
      let cy = (Math.sin(seed * 1.7 + 88.1) * 0.5 + 0.5) * h
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      const segments = 3 + Math.floor(Math.abs(Math.sin(seed * 3.1)) * 6)
      for (let s = 0; s < segments; s++) {
        const angle = Math.sin(seed + s * 2.7) * Math.PI * 0.6 + Math.PI * 0.5 // mostly downward
        const len = 8 + Math.abs(Math.sin(seed + s * 4.1)) * 25
        cx += Math.cos(angle) * len
        cy += Math.sin(angle) * len
        ctx.lineTo(cx, cy)
      }
      ctx.stroke()
    }
  }

  // --- Inscription ---
  function updateInscription(dt: number) {
    inscriptionTimer += dt
    const fadeSpeed = 0.4 // alpha per second

    if (inscriptionFading === 'in') {
      inscriptionAlpha = Math.min(1, inscriptionAlpha + dt * fadeSpeed)
      if (inscriptionAlpha >= 1) {
        inscriptionFading = 'hold'
        inscriptionTimer = 0
      }
    } else if (inscriptionFading === 'hold') {
      if (inscriptionTimer >= 30) {
        inscriptionFading = 'out'
      }
    } else if (inscriptionFading === 'out') {
      inscriptionAlpha = Math.max(0, inscriptionAlpha - dt * fadeSpeed)
      if (inscriptionAlpha <= 0) {
        inscriptionIdx = (inscriptionIdx + 1) % INSCRIPTIONS.length
        inscriptionFading = 'in'
      }
    }
  }

  function renderInscription(w: number, h: number) {
    if (!ctx) return
    const a = inscriptionAlpha * 0.06 // the faintest possible
    if (a < 0.001) return
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(220, 210, 190, ${a})`
    ctx.textAlign = 'center'
    ctx.fillText(INSCRIPTIONS[inscriptionIdx], w / 2, h - 22)
  }

  // Cultural inscription — separate cycle, positioned higher, even fainter
  function updateCulturalInscription(dt: number) {
    culturalTimer += dt
    const fadeSpeed = 0.25 // slower fade than main inscriptions

    if (culturalFading === 'in') {
      culturalAlpha = Math.min(1, culturalAlpha + dt * fadeSpeed)
      if (culturalAlpha >= 1) {
        culturalFading = 'hold'
        culturalTimer = 0
      }
    } else if (culturalFading === 'hold') {
      if (culturalTimer >= 20) {
        culturalFading = 'out'
      }
    } else if (culturalFading === 'out') {
      culturalAlpha = Math.max(0, culturalAlpha - dt * fadeSpeed)
      if (culturalAlpha <= 0) {
        culturalIdx = (culturalIdx + 1) % CULTURAL_INSCRIPTIONS.length
        culturalFading = 'in'
      }
    }
  }

  function renderCulturalInscription(w: number, h: number) {
    if (!ctx) return
    const a = culturalAlpha * 0.035 // even fainter than main inscriptions
    if (a < 0.001) return
    ctx.font = '11px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 190, 170, ${a})`
    ctx.textAlign = 'center'
    ctx.fillText(CULTURAL_INSCRIPTIONS[culturalIdx], w / 2, h - 42)
  }

  // Render the expand animation overlay
  function renderExpandAnim(w: number, _h: number) {
    if (!ctx || !expandAnim) return
    const ea = expandAnim
    // Ease-out curve
    const t = ea.progress
    const ease = 1 - (1 - t) * (1 - t)

    // Scale from 1x to 1.8x then back to 1x
    const scalePhase = t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6
    const scale = 1 + scalePhase * 0.8

    // Glow radius grows and fades
    const glowAlpha = (1 - t) * 0.15
    const glowR = ea.size * scale * 1.5

    // Background glow
    const grad = ctx.createRadialGradient(ea.x, ea.y, 0, ea.x, ea.y, glowR)
    grad.addColorStop(0, `rgba(220, 210, 190, ${glowAlpha})`)
    grad.addColorStop(0.5, `rgba(220, 210, 190, ${glowAlpha * 0.3})`)
    grad.addColorStop(1, 'rgba(220, 210, 190, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(ea.x, ea.y, glowR, 0, Math.PI * 2)
    ctx.fill()

    // Draw scaled glyph
    const hash = ea.memId.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0)
    ctx.save()
    ctx.translate(ea.x, ea.y)
    ctx.scale(scale, scale)
    ctx.translate(-ea.x, -ea.y)
    drawGlyph(ea.x, ea.y, hash, ea.size, 0.2 * (1 - t * 0.5))
    ctx.restore()

    // Show full memory text (fading in then out)
    const textAlpha = t < 0.15 ? t / 0.15 : t > 0.7 ? (1 - t) / 0.3 : 1
    if (textAlpha > 0.01) {
      const fullText = ea.originalText
      ctx.font = '13px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(220, 210, 190, ${textAlpha * 0.4})`
      ctx.textAlign = 'center'

      // Word-wrap the full text into lines
      const maxLineWidth = Math.min(w - 80, 400)
      const words = fullText.split(' ')
      const lines: string[] = []
      let currentLine = ''
      for (const word of words) {
        const test = currentLine ? currentLine + ' ' + word : word
        if (ctx.measureText(test).width > maxLineWidth && currentLine) {
          lines.push(currentLine)
          currentLine = word
        } else {
          currentLine = test
        }
      }
      if (currentLine) lines.push(currentLine)

      const lineHeight = 18
      const startY = ea.y + ea.size * scale * 0.6 + 14
      for (let li = 0; li < lines.length; li++) {
        // Faint background behind text for readability
        const tw = ctx.measureText(lines[li]).width
        ctx.fillStyle = `rgba(8, 6, 5, ${textAlpha * 0.6})`
        ctx.fillRect(ea.x - tw / 2 - 4, startY + li * lineHeight - 11, tw + 8, 15)
        ctx.fillStyle = `rgba(220, 210, 190, ${textAlpha * 0.4})`
        ctx.fillText(lines[li], ea.x, startY + li * lineHeight)
      }
    }
  }

  // Glyph shapes for dead memories — abstract bone-like forms
  function drawGlyph(x: number, y: number, seed: number, size: number, alpha: number) {
    if (!ctx) return
    const rng = () => { seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF; return (seed >>> 0) / 0xFFFFFFFF }

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rng() * Math.PI * 2)

    const type = Math.floor(rng() * 4)
    ctx.strokeStyle = `rgba(220, 210, 190, ${alpha})`
    ctx.fillStyle = `rgba(220, 210, 190, ${alpha * 0.3})`
    ctx.lineWidth = 0.5 + rng()

    if (type === 0) {
      // Long bone
      ctx.beginPath()
      ctx.ellipse(0, 0, size * 0.15, size * 0.5, 0, 0, Math.PI * 2)
      ctx.stroke()
      // Knobs at ends
      ctx.beginPath()
      ctx.arc(0, -size * 0.45, size * 0.12, 0, Math.PI * 2)
      ctx.arc(0, size * 0.45, size * 0.12, 0, Math.PI * 2)
      ctx.stroke()
    } else if (type === 1) {
      // Skull-like circle
      ctx.beginPath()
      ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2)
      ctx.stroke()
      // Eye sockets
      ctx.beginPath()
      ctx.arc(-size * 0.1, -size * 0.05, size * 0.06, 0, Math.PI * 2)
      ctx.arc(size * 0.1, -size * 0.05, size * 0.06, 0, Math.PI * 2)
      ctx.fill()
    } else if (type === 2) {
      // Cross / vertebra
      ctx.beginPath()
      ctx.moveTo(-size * 0.3, 0)
      ctx.lineTo(size * 0.3, 0)
      ctx.moveTo(0, -size * 0.2)
      ctx.lineTo(0, size * 0.2)
      ctx.stroke()
    } else {
      // Fragment / shard
      ctx.beginPath()
      ctx.moveTo(0, -size * 0.3)
      ctx.lineTo(size * 0.2, size * 0.1)
      ctx.lineTo(-size * 0.15, size * 0.25)
      ctx.closePath()
      ctx.stroke()
    }

    ctx.restore()
  }

  // Compute glyph positions (shared between render and hit-test)
  function computeGlyphLayout(dead: StoredMemory[], w: number, h: number): GlyphHit[] {
    const hits: GlyphHit[] = []
    const cols = Math.ceil(Math.sqrt(dead.length * 1.5))
    const rows = Math.ceil(dead.length / cols)
    const cellW = (w - 120) / cols
    const cellH = (h - 200) / Math.max(rows, 1)
    const offsetX = 60 + cellW / 2
    const offsetY = 100 + cellH / 2

    for (let i = 0; i < dead.length; i++) {
      const mem = dead[i]
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = offsetX + col * cellW + Math.sin(time * 0.2 + i) * 1
      const y = offsetY + row * cellH + Math.cos(time * 0.15 + i * 0.7) * 1
      const size = 15 + (mem.originalText.length % 20)

      // Magnetic pull toward cursor when hovered
      let renderX = x
      let renderY = y
      const dx = mouseX - x
      const dy = mouseY - y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const hitRadius = size * 0.6
      if (dist < hitRadius * 2.5 && dist > 0.1) {
        // Stronger pull when closer, max 4px shift
        const pullStrength = Math.max(0, 1 - dist / (hitRadius * 2.5))
        const pullPx = pullStrength * 4
        renderX += (dx / dist) * pullPx
        renderY += (dy / dist) * pullPx
      }

      hits.push({ x, y, size, memId: mem.id, originalText: mem.originalText, renderX, renderY })
    }
    return hits
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    const dt = 0.016
    time += dt

    const w = canvas.width
    const h = canvas.height
    const memories = deps.getMemories()

    // Only show memories that are significantly degraded
    const dead = memories.filter(m => m.degradation > 0.4)

    ctx.clearRect(0, 0, w, h)

    // Background — near black with slight warm tone
    ctx.fillStyle = 'rgba(8, 6, 5, 1)'
    ctx.fillRect(0, 0, w, h)

    // Wall texture — sedimentary strata + cracks
    drawWallTexture(w, h)

    // --- Gateway narrowing (inspired by menopause grey matter erosion, Cambridge 2026) ---
    // The hippocampal gateway narrows as more memories die. Vignette tightens.
    const deadCount = memories.filter(m => m.degradation > 0.4).length
    const totalCount = Math.max(1, memories.length)
    const erosion = Math.min(0.6, (deadCount / totalCount) * 0.8) // 0 = no erosion, 0.6 = severe
    if (erosion > 0.05) {
      const vignetteGrad = ctx.createRadialGradient(
        w / 2, h / 2, Math.min(w, h) * (0.4 - erosion * 0.25),
        w / 2, h / 2, Math.min(w, h) * 0.6
      )
      vignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0)')
      vignetteGrad.addColorStop(1, `rgba(0, 0, 0, ${erosion * 0.3})`)
      ctx.fillStyle = vignetteGrad
      ctx.fillRect(0, 0, w, h)
    }

    // Ambient dust
    spawnAmbientDust()
    updateDust()

    // Decay honor glows
    for (const [id, t] of honorGlows) {
      const remaining = t - dt
      if (remaining <= 0) honorGlows.delete(id)
      else honorGlows.set(id, remaining)
    }

    if (dead.length === 0) {
      glyphHits = []
      // No dead memories — the ossuary is empty
      ctx.font = '14px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(220, 210, 190, 0.15)'
      ctx.textAlign = 'center'
      ctx.fillText('the ossuary is empty', w / 2, h / 2 - 10)
      ctx.font = '13px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(220, 210, 190, 0.08)'
      ctx.fillText('no memories have degraded enough to rest here', w / 2, h / 2 + 14)
    } else {
      // Compute glyph positions
      glyphHits = computeGlyphLayout(dead, w, h)

      // Hit-test for hovered glyph
      hoveredGlyphIdx = -1
      for (let i = 0; i < glyphHits.length; i++) {
        const gh = glyphHits[i]
        const dx = mouseX - gh.x
        const dy = mouseY - gh.y
        const hitRadius = gh.size * 0.6
        if (dx * dx + dy * dy < hitRadius * hitRadius) {
          hoveredGlyphIdx = i
          break
        }
      }

      // Manage hover rattle audio
      if (hoveredGlyphIdx >= 0 && hoveredGlyphIdx !== lastHoveredIdx) {
        startRattle()
        lastHoveredIdx = hoveredGlyphIdx
      } else if (hoveredGlyphIdx < 0 && lastHoveredIdx >= 0) {
        stopRattle()
        lastHoveredIdx = -1
      }

      for (let i = 0; i < dead.length; i++) {
        const mem = dead[i]
        const gh = glyphHits[i]
        const hash = mem.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
        let alpha = 0.03 + (1 - mem.degradation) * 0.15
        const rx = gh.renderX
        const ry = gh.renderY

        // Hover brightening + glow
        if (i === hoveredGlyphIdx) {
          alpha = Math.min(1, alpha + 0.12)

          // Subtle hover glow around the element
          const hoverGlowR = gh.size * 1.0
          const hoverGrad = ctx.createRadialGradient(rx, ry, 0, rx, ry, hoverGlowR)
          hoverGrad.addColorStop(0, 'rgba(220, 210, 190, 0.06)')
          hoverGrad.addColorStop(0.6, 'rgba(220, 210, 190, 0.02)')
          hoverGrad.addColorStop(1, 'rgba(220, 210, 190, 0)')
          ctx.fillStyle = hoverGrad
          ctx.beginPath()
          ctx.arc(rx, ry, hoverGlowR, 0, Math.PI * 2)
          ctx.fill()
        }

        // Honored warm glow (permanent)
        const isHonored = honoredIds.has(mem.id)
        if (isHonored) {
          // Faint warm glow behind the glyph
          const glowR = gh.size * 0.8
          const grad = ctx.createRadialGradient(rx, ry, 0, rx, ry, glowR)
          grad.addColorStop(0, 'rgba(180, 120, 60, 0.04)')
          grad.addColorStop(1, 'rgba(180, 120, 60, 0)')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(rx, ry, glowR, 0, Math.PI * 2)
          ctx.fill()
          // Slightly warmer tint on the glyph
          alpha = Math.min(1, alpha + 0.03)
        }

        // Active honor glow (brief candle-lighting animation)
        const glowTime = honorGlows.get(mem.id)
        if (glowTime !== undefined) {
          const glowAlpha = glowTime / 2 // fades over 2 seconds
          const glowR = gh.size * 1.5 * (1 - glowTime / 2) + gh.size * 0.5
          const grad = ctx.createRadialGradient(rx, ry, 0, rx, ry, glowR)
          grad.addColorStop(0, `rgba(220, 170, 80, ${0.15 * glowAlpha})`)
          grad.addColorStop(0.5, `rgba(200, 140, 60, ${0.06 * glowAlpha})`)
          grad.addColorStop(1, 'rgba(180, 120, 40, 0)')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(rx, ry, glowR, 0, Math.PI * 2)
          ctx.fill()
        }

        drawGlyph(rx, ry, hash, gh.size, alpha)

        // Memory text fragment below glyph (use renderX/Y for magnetic offset)
        if (mem.degradation < 0.9) {
          ctx.font = '11px "Cormorant Garamond", serif'
          ctx.fillStyle = `rgba(220, 210, 190, ${alpha * 0.4})`
          ctx.textAlign = 'center'
          ctx.fillText(mem.currentText.slice(0, 20), rx, ry + gh.size * 0.6 + 8)
        }
      }

      // Tooltip for hovered glyph — original text fragment
      if (hoveredGlyphIdx >= 0) {
        const gh = glyphHits[hoveredGlyphIdx]
        const snippet = gh.originalText.slice(0, 30) + (gh.originalText.length > 30 ? '...' : '')
        ctx.font = '12px "Cormorant Garamond", serif'
        const tw = ctx.measureText(snippet).width
        const tx = Math.min(Math.max(mouseX + 12, tw / 2 + 8), w - tw / 2 - 8)
        const ty = mouseY - 10

        // Tiny background
        ctx.fillStyle = 'rgba(8, 6, 5, 0.8)'
        ctx.fillRect(tx - tw / 2 - 4, ty - 10, tw + 8, 14)
        ctx.fillStyle = 'rgba(220, 210, 190, 0.35)'
        ctx.textAlign = 'center'
        ctx.fillText(snippet, tx, ty)
      }

      // Count
      ctx.font = '12px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(220, 210, 190, 0.08)'
      ctx.textAlign = 'center'
      ctx.fillText(`${dead.length} memories at rest`, w / 2, h - 50)
    }

    // Update and render expand animation
    if (expandAnim) {
      expandAnim.progress += dt / 1.5 // 1.5 second total duration
      if (expandAnim.progress >= 1) {
        expandAnim = null
      } else {
        renderExpandAnim(w, h)
      }
    }

    // Bone dust on top of everything
    renderDust()

    // Inscription at the bottom
    updateInscription(dt)
    renderInscription(w, h)

    // Cultural inscription — separate cycle, positioned above main inscription
    updateCulturalInscription(dt)
    renderCulturalInscription(w, h)

    // Title
    ctx.font = '13px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(220, 210, 190, 0.12)'
    ctx.textAlign = 'center'
    ctx.letterSpacing = '3px'
    ctx.fillText('THE OSSUARY', w / 2, 40)

    // Bone archway portals
    const archW = 80
    const archH = 200
    const leftCx = archW * 0.55
    const leftCy = h / 2
    const rightCx = w - archW * 0.55
    const rightCy = h / 2

    // Hover breeze dust on hovered archway
    if (hoveredArchway === 'left' && Math.random() < 0.4) {
      archwayDust.push({
        x: leftCx + (Math.random() - 0.5) * 30,
        y: leftCy + (Math.random() - 0.5) * archH * 0.4,
        vy: -(0.2 + Math.random() * 0.5),
        alpha: 0.04 + Math.random() * 0.04,
        size: 0.5 + Math.random() * 1,
        life: 0,
        maxLife: 40 + Math.random() * 30,
      })
    }
    if (hoveredArchway === 'right' && Math.random() < 0.4) {
      archwayDust.push({
        x: rightCx + (Math.random() - 0.5) * 30,
        y: rightCy + (Math.random() - 0.5) * archH * 0.4,
        vy: -(0.2 + Math.random() * 0.5),
        alpha: 0.04 + Math.random() * 0.04,
        size: 0.5 + Math.random() * 1,
        life: 0,
        maxLife: 40 + Math.random() * 30,
      })
    }
    updateArchwayDust()

    drawBoneArchway(leftCx, leftCy, archW, archH, 'left', hoveredArchway === 'left')
    drawBoneArchway(rightCx, rightCy, archW, archH, 'right', hoveredArchway === 'right')
    renderArchwayDust()

    // Transition blackout overlay
    if (archwayTransition) {
      archwayTransition.progress += dt / 0.4 // 0.4s total
      const p = Math.min(1, archwayTransition.progress)
      ctx.fillStyle = `rgba(0, 0, 0, ${p})`
      ctx.fillRect(0, 0, w, h)
      if (p >= 1) {
        const side = archwayTransition.side
        archwayTransition = null
        if (side === 'left') {
          if (deps.switchTo) deps.switchTo('roots')
          else deps.toRoots()
        } else {
          if (deps.switchTo) deps.switchTo('catacombs')
          else deps.toCatacombs()
        }
      }
    }
  }

  return {
    name: 'ossuary',
    label: 'the ossuary',
    hidden: true,

    create() {
      loadHonored()

      overlay = document.createElement('div')
      overlay.style.cssText = `
        width: 100%; height: 100%;
        pointer-events: auto;
        background: #000;
      `

      canvas = document.createElement('canvas')
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      canvas.style.cssText = 'width: 100%; height: 100%; cursor: pointer;'
      ctx = canvas.getContext('2d')

      // Bone archway click + glyph honoring
      canvas.addEventListener('click', (e) => {
        if (archwayTransition) return // already transitioning

        const cw = canvas!.width
        const ch = canvas!.height
        const aW = 80
        const aH = 200
        const lCx = aW * 0.55
        const lCy = ch / 2
        const rCx = cw - aW * 0.55
        const rCy = ch / 2

        // Check archway clicks
        if (isInsideArchway(e.clientX, e.clientY, lCx, lCy, aW, aH)) {
          spawnArchwayDust(lCx, lCy, aH)
          archwayTransition = { side: 'left', progress: 0 }
          return
        }
        if (isInsideArchway(e.clientX, e.clientY, rCx, rCy, aW, aH)) {
          spawnArchwayDust(rCx, rCy, aH)
          archwayTransition = { side: 'right', progress: 0 }
          return
        }

        // Check if clicking a glyph to honor it + expand + crack sound + dust
        if (hoveredGlyphIdx >= 0) {
          const gh = glyphHits[hoveredGlyphIdx]
          honoredIds.add(gh.memId)
          saveHonored()
          honorGlows.set(gh.memId, 2) // 2-second glow animation
          spawnHonorBurst(gh.renderX, gh.renderY)
          spawnClickDust(gh.renderX, gh.renderY) // bone dust drifting down
          playBoneCrackChime() // bone-crack + chime sound
          playBoneResonance()

          // Trigger expand animation showing full text
          expandAnim = {
            glyphIdx: hoveredGlyphIdx,
            progress: 0,
            memId: gh.memId,
            originalText: gh.originalText,
            x: gh.renderX,
            y: gh.renderY,
            size: gh.size,
          }
          return
        }
      })

      // Mouse move for hover detection
      canvas.addEventListener('mousemove', (e) => {
        mouseX = e.clientX
        mouseY = e.clientY

        // Check archway hover
        if (canvas) {
          const cw = canvas.width
          const ch = canvas.height
          const aW = 80
          const aH = 200
          const lCx = aW * 0.55
          const lCy = ch / 2
          const rCx = cw - aW * 0.55
          const rCy = ch / 2

          if (isInsideArchway(e.clientX, e.clientY, lCx, lCy, aW, aH)) {
            hoveredArchway = 'left'
          } else if (isInsideArchway(e.clientX, e.clientY, rCx, rCy, aW, aH)) {
            hoveredArchway = 'right'
          } else {
            hoveredArchway = null
          }
        }

        // Trigger bone resonance when entering a new glyph hover
        const prevHovered = hoveredGlyphIdx
        // hoveredGlyphIdx is updated in render(); we do a quick pre-check here
        // to trigger sound on glyph entry
        for (let i = 0; i < glyphHits.length; i++) {
          const gh = glyphHits[i]
          const dx = mouseX - gh.x
          const dy = mouseY - gh.y
          const hitRadius = gh.size * 0.6
          if (dx * dx + dy * dy < hitRadius * hitRadius) {
            if (i !== prevHovered) {
              playBoneResonance()
            }
            break
          }
        }
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
      loadHonored()
      dustParticles = []
      archwayDust = []
      archwayTransition = null
      hoveredArchway = null
      initAudio().then(() => fadeAudioIn())
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      fadeAudioOut()
      stopRattle()
      expandAnim = null
      lastHoveredIdx = -1
      if (dripTimeout !== null) {
        clearTimeout(dripTimeout)
        dripTimeout = null
      }
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      cleanupAudio()
      overlay?.remove()
    },
  }
}
