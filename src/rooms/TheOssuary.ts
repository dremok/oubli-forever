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

export function createOssuaryRoom(deps: OssuaryDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let hoveredNav = -1

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

  // Audio state
  let audioInitialized = false
  let audioMaster: GainNode | null = null
  let windSource: AudioBufferSourceNode | null = null
  let windGain: GainNode | null = null
  let dripTimeout: ReturnType<typeof setTimeout> | null = null
  let audioCtxRef: AudioContext | null = null

  // Navigation portals — bone-fragment markers leading to connected rooms
  const navPoints = [
    { label: '☽ the roots', room: 'roots', xFrac: 0.08, yFrac: 0.92 },
    { label: '☽ the catacombs', room: 'catacombs', xFrac: 0.92, yFrac: 0.92 },
  ]

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
    ctx.font = '9px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(220, 210, 190, ${a})`
    ctx.textAlign = 'center'
    ctx.fillText(INSCRIPTIONS[inscriptionIdx], w / 2, h - 22)
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
      hits.push({ x, y, size, memId: mem.id, originalText: mem.originalText })
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
      ctx.font = '11px "Cormorant Garamond", serif'
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

      for (let i = 0; i < dead.length; i++) {
        const mem = dead[i]
        const gh = glyphHits[i]
        const hash = mem.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
        let alpha = 0.03 + (1 - mem.degradation) * 0.15

        // Hover brightening
        if (i === hoveredGlyphIdx) {
          alpha = Math.min(1, alpha + 0.12)
        }

        // Honored warm glow (permanent)
        const isHonored = honoredIds.has(mem.id)
        if (isHonored) {
          // Faint warm glow behind the glyph
          const glowR = gh.size * 0.8
          const grad = ctx.createRadialGradient(gh.x, gh.y, 0, gh.x, gh.y, glowR)
          grad.addColorStop(0, 'rgba(180, 120, 60, 0.04)')
          grad.addColorStop(1, 'rgba(180, 120, 60, 0)')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(gh.x, gh.y, glowR, 0, Math.PI * 2)
          ctx.fill()
          // Slightly warmer tint on the glyph
          alpha = Math.min(1, alpha + 0.03)
        }

        // Active honor glow (brief candle-lighting animation)
        const glowTime = honorGlows.get(mem.id)
        if (glowTime !== undefined) {
          const glowAlpha = glowTime / 2 // fades over 2 seconds
          const glowR = gh.size * 1.5 * (1 - glowTime / 2) + gh.size * 0.5
          const grad = ctx.createRadialGradient(gh.x, gh.y, 0, gh.x, gh.y, glowR)
          grad.addColorStop(0, `rgba(220, 170, 80, ${0.15 * glowAlpha})`)
          grad.addColorStop(0.5, `rgba(200, 140, 60, ${0.06 * glowAlpha})`)
          grad.addColorStop(1, 'rgba(180, 120, 40, 0)')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(gh.x, gh.y, glowR, 0, Math.PI * 2)
          ctx.fill()
        }

        drawGlyph(gh.x, gh.y, hash, gh.size, alpha)

        // Memory text fragment below glyph
        if (mem.degradation < 0.9) {
          ctx.font = '8px "Cormorant Garamond", serif'
          ctx.fillStyle = `rgba(220, 210, 190, ${alpha * 0.4})`
          ctx.textAlign = 'center'
          ctx.fillText(mem.currentText.slice(0, 20), gh.x, gh.y + gh.size * 0.6 + 8)
        }
      }

      // Tooltip for hovered glyph — original text fragment
      if (hoveredGlyphIdx >= 0) {
        const gh = glyphHits[hoveredGlyphIdx]
        const snippet = gh.originalText.slice(0, 30) + (gh.originalText.length > 30 ? '...' : '')
        ctx.font = '10px "Cormorant Garamond", serif'
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
      ctx.font = '9px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(220, 210, 190, 0.08)'
      ctx.textAlign = 'center'
      ctx.fillText(`${dead.length} memories at rest`, w / 2, h - 50)
    }

    // Bone dust on top of everything
    renderDust()

    // Inscription at the bottom
    updateInscription(dt)
    renderInscription(w, h)

    // Title
    ctx.font = '11px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(220, 210, 190, 0.12)'
    ctx.textAlign = 'center'
    ctx.letterSpacing = '3px'
    ctx.fillText('THE OSSUARY', w / 2, 40)

    // Navigation links
    ctx.font = '10px "Cormorant Garamond", serif'

    // Left: to roots
    ctx.fillStyle = `rgba(120, 90, 50, ${0.08 + Math.sin(time * 0.4) * 0.03})`
    ctx.textAlign = 'left'
    ctx.fillText('← the roots', 20, h / 2)

    // Right: to catacombs
    ctx.fillStyle = `rgba(180, 160, 120, ${0.08 + Math.sin(time * 0.4 + 1) * 0.03})`
    ctx.textAlign = 'right'
    ctx.fillText('the catacombs →', w - 20, h / 2)

    // Navigation portals
    if (deps.switchTo) {
      for (let i = 0; i < navPoints.length; i++) {
        const np = navPoints[i]
        const nx = w * np.xFrac
        const ny = h * np.yFrac
        const hovered = hoveredNav === i
        const a = hovered ? 0.35 : 0.06
        ctx.font = '9px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(220, 210, 190, ${a})`
        ctx.textAlign = np.xFrac < 0.5 ? 'left' : 'right'
        ctx.fillText(np.label, nx, ny)
        if (hovered) {
          ctx.fillStyle = 'rgba(220, 210, 190, 0.12)'
          ctx.beginPath()
          ctx.arc(nx + (np.xFrac < 0.5 ? -6 : 6), ny - 3, 3, 0, Math.PI * 2)
          ctx.fill()
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

      // Portal navigation click + glyph honoring
      canvas.addEventListener('click', (e) => {
        if (deps.switchTo && canvas) {
          for (let i = 0; i < navPoints.length; i++) {
            const nx = canvas.width * navPoints[i].xFrac
            const ny = canvas.height * navPoints[i].yFrac
            const dx = e.clientX - nx
            const dy = e.clientY - ny
            if (dx * dx + dy * dy < 600) {
              deps.switchTo(navPoints[i].room)
              return
            }
          }
        }

        // Check if clicking a glyph to honor it
        if (hoveredGlyphIdx >= 0) {
          const gh = glyphHits[hoveredGlyphIdx]
          honoredIds.add(gh.memId)
          saveHonored()
          honorGlows.set(gh.memId, 2) // 2-second glow animation
          spawnHonorBurst(gh.x, gh.y)
          playBoneResonance()
          return
        }

        // Click left half → roots, right half → catacombs
        const x = e.clientX
        const mid = window.innerWidth / 2
        if (x < mid * 0.3) {
          deps.toRoots()
        } else if (x > mid * 1.7) {
          deps.toCatacombs()
        }
      })

      // Mouse move for hover detection
      canvas.addEventListener('mousemove', (e) => {
        mouseX = e.clientX
        mouseY = e.clientY

        // Check nav portal hover
        if (deps.switchTo && canvas) {
          hoveredNav = -1
          for (let i = 0; i < navPoints.length; i++) {
            const nx = canvas.width * navPoints[i].xFrac
            const ny = canvas.height * navPoints[i].yFrac
            const dx = e.clientX - nx
            const dy = e.clientY - ny
            if (dx * dx + dy * dy < 600) {
              hoveredNav = i
              break
            }
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
      initAudio().then(() => fadeAudioIn())
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      fadeAudioOut()
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
