/**
 * THE REMEMORY — document, trace, ghost
 *
 * Inspired by the Sydney Biennale 2026 theme "Rememory" (from
 * Toni Morrison's "Beloved"): memory as something living, where
 * history informs the present and repeats itself in different forms.
 *
 * The biennale organizes around three states: DOCUMENT, TRACE, GHOST.
 * Each memory exists in one of these states based on its degradation:
 * - DOCUMENT (0-30%): crisp, factual, present — white text, sharp edges
 * - TRACE (30-70%): residue, imprint, echo — amber text, blurred edges
 * - GHOST (70-100%): haunting, spectral, barely there — violet text, transparent
 *
 * Memories drift between these states in real-time. You can see
 * the exact moment a document becomes a trace, a trace becomes a ghost.
 *
 * The room itself shifts its aesthetic based on the dominant state
 * of your memory collection. If most memories are ghosts, the room
 * is spectral. If most are documents, it's clinical.
 *
 * Inspired by: Toni Morrison's "Beloved" (1987), Sydney Biennale 2026,
 * UMOCA "In Memory" exhibition, the idea that memory is not storage
 * but re-creation, Hisham Matar's "My Friends" (2025 NBCC Prize),
 * how trauma makes ghosts of the living
 *
 * USES MEMORIES. Exhibition-inspired. State-based visualization.
 */

import type { Room } from './RoomManager'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface Memory {
  id: string
  originalText: string
  currentText: string
  degradation: number
  timestamp: number
}

interface RememoryDeps {
  getMemories: () => Memory[]
  switchTo?: (name: string) => void
}

type MemoryState = 'document' | 'trace' | 'ghost'

interface RememoryNode {
  memory: Memory
  state: MemoryState
  x: number
  y: number
  targetX: number
  targetY: number
  phase: number
}

interface TransitionParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
}

interface FogCircle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
}

function getState(degradation: number): MemoryState {
  if (degradation < 0.3) return 'document'
  if (degradation < 0.7) return 'trace'
  return 'ghost'
}

export function createRememoryRoom(deps: RememoryDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let nodes: RememoryNode[] = []
  let particles: TransitionParticle[] = []
  let fogCircles: FogCircle[] = []

  // Cursor tracking
  let cursorX = -1
  let cursorY = -1

  // Audio state
  let audioInitialized = false
  let audioMaster: GainNode | null = null
  let breathLfo: OscillatorNode | null = null
  let breathGain: GainNode | null = null

  // Drone oscillators per state
  let docOsc: OscillatorNode | null = null
  let docGain: GainNode | null = null
  let traceOsc: OscillatorNode | null = null
  let traceGain: GainNode | null = null
  let ghostOsc1: OscillatorNode | null = null
  let ghostOsc2: OscillatorNode | null = null
  let ghostGain: GainNode | null = null

  // Current drone target gains for crossfade
  let docTarget = 0
  let traceTarget = 0
  let ghostTarget = 0

  function handleMouseMove(e: MouseEvent) {
    cursorX = e.clientX
    cursorY = e.clientY
  }

  // Initialize fog circles for ghost-dominant background
  function initFogCircles(w: number, h: number) {
    fogCircles = []
    for (let i = 0; i < 6; i++) {
      fogCircles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.2,
        radius: 80 + Math.random() * 120,
      })
    }
  }

  async function initAudio() {
    if (audioInitialized) return
    try {
      const ac = await getAudioContext()
      const dest = getAudioDestination()

      audioMaster = ac.createGain()
      audioMaster.gain.value = 1.0
      audioMaster.connect(dest)

      // Breathing LFO — modulates master gain at 0.1Hz
      breathGain = ac.createGain()
      breathGain.gain.value = 1.0
      breathGain.connect(audioMaster)

      breathLfo = ac.createOscillator()
      breathLfo.type = 'sine'
      breathLfo.frequency.value = 0.1
      const lfoGain = ac.createGain()
      lfoGain.gain.value = 0.15 // depth of breath modulation
      breathLfo.connect(lfoGain)
      lfoGain.connect(breathGain.gain)
      breathLfo.start()

      // Document drone — clean sine 220Hz
      docOsc = ac.createOscillator()
      docOsc.type = 'sine'
      docOsc.frequency.value = 220
      docGain = ac.createGain()
      docGain.gain.value = 0
      docOsc.connect(docGain)
      docGain.connect(breathGain)
      docOsc.start()

      // Trace drone — warm triangle 165Hz
      traceOsc = ac.createOscillator()
      traceOsc.type = 'triangle'
      traceOsc.frequency.value = 165
      traceGain = ac.createGain()
      traceGain.gain.value = 0
      traceOsc.connect(traceGain)
      traceGain.connect(breathGain)
      traceOsc.start()

      // Ghost drone — two detuned sines ~130Hz for slow beats
      ghostOsc1 = ac.createOscillator()
      ghostOsc1.type = 'sine'
      ghostOsc1.frequency.value = 130
      ghostOsc2 = ac.createOscillator()
      ghostOsc2.type = 'sine'
      ghostOsc2.frequency.value = 131.5 // slight detune for beating
      ghostGain = ac.createGain()
      ghostGain.gain.value = 0
      ghostOsc1.connect(ghostGain)
      ghostOsc2.connect(ghostGain)
      ghostGain.connect(breathGain)
      ghostOsc1.start()
      ghostOsc2.start()

      audioInitialized = true
    } catch {
      /* audio init failed — silent fallback */
    }
  }

  function updateDroneGains(dominance: { document: number; trace: number; ghost: number }) {
    if (!audioInitialized) return

    // Determine target gains based on dominance
    // The dominant state gets full gain, others are reduced
    const maxDoc = dominance.document
    const maxTrace = dominance.trace
    const maxGhost = dominance.ghost
    const maxVal = Math.max(maxDoc, maxTrace, maxGhost, 0.01)

    docTarget = (maxDoc / maxVal) * 0.015
    traceTarget = (maxTrace / maxVal) * 0.02
    ghostTarget = (maxGhost / maxVal) * 0.015

    // Smooth crossfade via exponential approach
    if (docGain) {
      const cur = docGain.gain.value
      docGain.gain.value = cur + (docTarget - cur) * 0.02
    }
    if (traceGain) {
      const cur = traceGain.gain.value
      traceGain.gain.value = cur + (traceTarget - cur) * 0.02
    }
    if (ghostGain) {
      const cur = ghostGain.gain.value
      ghostGain.gain.value = cur + (ghostTarget - cur) * 0.02
    }
  }

  function playTransitionChime(newState: MemoryState) {
    if (!audioInitialized || !breathGain) return
    try {
      const ac = breathGain.context as AudioContext
      const freq = newState === 'document' ? 440 : newState === 'trace' ? 330 : 220
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const gain = ac.createGain()
      const now = ac.currentTime
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.03, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
      osc.connect(gain)
      gain.connect(breathGain)
      osc.start(now)
      osc.stop(now + 0.25)
      osc.onended = () => { osc.disconnect(); gain.disconnect() }
    } catch {
      /* chime failed — silent */
    }
  }

  function spawnTransitionParticles(fromX: number, fromY: number, toX: number, toY: number, newState: MemoryState) {
    const color = newState === 'document'
      ? '240, 235, 225'
      : newState === 'trace'
        ? '220, 190, 130'
        : '180, 160, 220'
    const count = 3 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) {
      const dx = toX - fromX
      const dy = toY - fromY
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const speed = 0.5 + Math.random() * 0.5
      particles.push({
        x: fromX + (Math.random() - 0.5) * 10,
        y: fromY + (Math.random() - 0.5) * 10,
        vx: (dx / dist) * speed + (Math.random() - 0.5) * 0.3,
        vy: (dy / dist) * speed + (Math.random() - 0.5) * 0.3,
        life: 1.0,
        maxLife: 60 + Math.floor(Math.random() * 40),
        color,
      })
    }
  }

  function fadeAudioOut() {
    if (!audioMaster) return
    const ac = audioMaster.context as AudioContext
    const now = ac.currentTime
    audioMaster.gain.cancelScheduledValues(now)
    audioMaster.gain.setValueAtTime(audioMaster.gain.value, now)
    audioMaster.gain.linearRampToValueAtTime(0, now + 0.5)
  }

  function destroyAudio() {
    fadeAudioOut()
    setTimeout(() => {
      try { docOsc?.stop() } catch { /* */ }
      try { traceOsc?.stop() } catch { /* */ }
      try { ghostOsc1?.stop() } catch { /* */ }
      try { ghostOsc2?.stop() } catch { /* */ }
      try { breathLfo?.stop() } catch { /* */ }
      docOsc?.disconnect()
      docGain?.disconnect()
      traceOsc?.disconnect()
      traceGain?.disconnect()
      ghostOsc1?.disconnect()
      ghostOsc2?.disconnect()
      ghostGain?.disconnect()
      breathLfo?.disconnect()
      breathGain?.disconnect()
      audioMaster?.disconnect()
      docOsc = null
      docGain = null
      traceOsc = null
      traceGain = null
      ghostOsc1 = null
      ghostOsc2 = null
      ghostGain = null
      breathLfo = null
      breathGain = null
      audioMaster = null
      audioInitialized = false
    }, 600)
  }

  function buildNodes() {
    if (!canvas) return
    const memories = deps.getMemories()
    const w = canvas.width
    const h = canvas.height

    // Three columns: document | trace | ghost
    const colW = w / 3

    const docs = memories.filter(m => getState(m.degradation) === 'document')
    const traces = memories.filter(m => getState(m.degradation) === 'trace')
    const ghosts = memories.filter(m => getState(m.degradation) === 'ghost')

    nodes = []

    const placeInColumn = (mems: Memory[], colIdx: number, state: MemoryState) => {
      const startX = colIdx * colW + colW * 0.1
      const endX = colIdx * colW + colW * 0.9
      const startY = 80
      const spacing = Math.min(60, (h - 160) / Math.max(1, mems.length))

      for (let i = 0; i < mems.length; i++) {
        const targetX = startX + Math.random() * (endX - startX)
        const targetY = startY + i * spacing

        nodes.push({
          memory: mems[i],
          state,
          x: targetX + (Math.random() - 0.5) * 100,
          y: targetY + (Math.random() - 0.5) * 50,
          targetX,
          targetY,
          phase: Math.random() * Math.PI * 2,
        })
      }
    }

    placeInColumn(docs, 0, 'document')
    placeInColumn(traces, 1, 'trace')
    placeInColumn(ghosts, 2, 'ghost')
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const c = ctx
    const w = canvas.width
    const h = canvas.height

    // Determine dominant state
    const memories = deps.getMemories()
    let docCount = 0, traceCount = 0, ghostCount = 0
    for (const m of memories) {
      const s = getState(m.degradation)
      if (s === 'document') docCount++
      else if (s === 'trace') traceCount++
      else ghostCount++
    }
    const total = Math.max(1, memories.length)
    const dominance = {
      document: docCount / total,
      trace: traceCount / total,
      ghost: ghostCount / total,
    }

    // Update audio drone crossfade
    updateDroneGains(dominance)

    // Background shifts based on dominant state
    const bgR = Math.floor(8 + dominance.ghost * 8)
    const bgG = Math.floor(6 + dominance.document * 6)
    const bgB = Math.floor(12 + dominance.ghost * 15)
    c.fillStyle = `rgb(${bgR}, ${bgG}, ${bgB})`
    c.fillRect(0, 0, w, h)

    // --- State-reactive background ---

    // GHOST dominant: slow-moving fog circles
    if (dominance.ghost > 0.3) {
      const fogAlpha = Math.min(0.03, dominance.ghost * 0.04)
      for (const fog of fogCircles) {
        fog.x += fog.vx
        fog.y += fog.vy
        if (fog.x < -fog.radius) fog.x = w + fog.radius
        if (fog.x > w + fog.radius) fog.x = -fog.radius
        if (fog.y < -fog.radius) fog.y = h + fog.radius
        if (fog.y > h + fog.radius) fog.y = -fog.radius

        const grad = c.createRadialGradient(fog.x, fog.y, 0, fog.x, fog.y, fog.radius)
        grad.addColorStop(0, `rgba(180, 160, 220, ${fogAlpha})`)
        grad.addColorStop(1, 'transparent')
        c.fillStyle = grad
        c.beginPath()
        c.arc(fog.x, fog.y, fog.radius, 0, Math.PI * 2)
        c.fill()
      }
    }

    // DOCUMENT dominant: faint grid lines (clinical)
    if (dominance.document > 0.3) {
      const gridAlpha = Math.min(0.025, dominance.document * 0.03)
      c.strokeStyle = `rgba(240, 235, 225, ${gridAlpha})`
      c.lineWidth = 0.5
      const gridSpacing = 40
      for (let gx = 0; gx < w; gx += gridSpacing) {
        c.beginPath()
        c.moveTo(gx, 0)
        c.lineTo(gx, h)
        c.stroke()
      }
      for (let gy = 0; gy < h; gy += gridSpacing) {
        c.beginPath()
        c.moveTo(0, gy)
        c.lineTo(w, gy)
        c.stroke()
      }
    }

    // TRACE dominant: faint horizontal streaks (residue)
    if (dominance.trace > 0.3) {
      const streakAlpha = Math.min(0.02, dominance.trace * 0.025)
      c.strokeStyle = `rgba(220, 190, 130, ${streakAlpha})`
      c.lineWidth = 1
      for (let i = 0; i < 12; i++) {
        const sy = 60 + (i / 12) * (h - 120)
        const offset = Math.sin(time * 0.1 + i * 0.7) * 30
        c.beginPath()
        c.moveTo(offset, sy)
        c.lineTo(w + offset, sy)
        c.stroke()
      }
    }

    // Column dividers (subtle)
    const colW = w / 3
    for (let i = 1; i < 3; i++) {
      c.strokeStyle = 'rgba(100, 90, 80, 0.04)'
      c.lineWidth = 1
      c.setLineDash([2, 8])
      c.beginPath()
      c.moveTo(colW * i, 60)
      c.lineTo(colW * i, h - 40)
      c.stroke()
      c.setLineDash([])
    }

    // --- Column atmosphere glow ---
    const colGlowHeight = 60
    // Document column glow
    const docGlow = c.createLinearGradient(0, 45, 0, 45 + colGlowHeight)
    docGlow.addColorStop(0, `rgba(240, 235, 225, ${0.02 + dominance.document * 0.02})`)
    docGlow.addColorStop(1, 'transparent')
    c.fillStyle = docGlow
    c.fillRect(0, 45, colW, colGlowHeight)

    // Trace column glow
    const traceGlow = c.createLinearGradient(0, 45, 0, 45 + colGlowHeight)
    traceGlow.addColorStop(0, `rgba(220, 190, 130, ${0.02 + dominance.trace * 0.02})`)
    traceGlow.addColorStop(1, 'transparent')
    c.fillStyle = traceGlow
    c.fillRect(colW, 45, colW, colGlowHeight)

    // Ghost column glow
    const ghostGlow = c.createLinearGradient(0, 45, 0, 45 + colGlowHeight)
    ghostGlow.addColorStop(0, `rgba(180, 160, 220, ${0.02 + dominance.ghost * 0.02})`)
    ghostGlow.addColorStop(1, 'transparent')
    c.fillStyle = ghostGlow
    c.fillRect(colW * 2, 45, colW, colGlowHeight)

    // Column headers
    c.font = '13px "Cormorant Garamond", serif'
    c.textAlign = 'center'

    // Document column
    c.fillStyle = `rgba(240, 235, 225, ${0.12 + Math.sin(time * 0.5) * 0.03})`
    c.fillText('DOCUMENT', colW * 0.5, 55)
    c.font = '11px monospace'
    c.fillStyle = 'rgba(240, 235, 225, 0.06)'
    c.fillText(`${docCount}`, colW * 0.5, 68)

    // Trace column
    c.font = '13px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(220, 190, 130, ${0.12 + Math.sin(time * 0.5 + 1) * 0.03})`
    c.fillText('TRACE', colW * 1.5, 55)
    c.font = '11px monospace'
    c.fillStyle = 'rgba(220, 190, 130, 0.06)'
    c.fillText(`${traceCount}`, colW * 1.5, 68)

    // Ghost column
    c.font = '13px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(180, 160, 220, ${0.12 + Math.sin(time * 0.5 + 2) * 0.03})`
    c.fillText('GHOST', colW * 2.5, 55)
    c.font = '11px monospace'
    c.fillStyle = 'rgba(180, 160, 220, 0.06)'
    c.fillText(`${ghostCount}`, colW * 2.5, 68)

    // Update node positions (smooth drift toward targets)
    for (const node of nodes) {
      // Check if state has changed
      const newState = getState(node.memory.degradation)
      if (newState !== node.state) {
        // Memory has transitioned! Spawn particles + chime
        const oldState = node.state
        const oldColIdx = oldState === 'document' ? 0 : oldState === 'trace' ? 1 : 2
        const oldCenterX = oldColIdx * colW + colW * 0.5
        node.state = newState
        const colIdx = newState === 'document' ? 0 : newState === 'trace' ? 1 : 2
        const newTargetX = colIdx * colW + colW * 0.2 + Math.random() * colW * 0.6
        node.targetX = newTargetX

        // Transition particles from old position toward new column
        const newCenterX = colIdx * colW + colW * 0.5
        spawnTransitionParticles(oldCenterX, node.y, newCenterX, node.y, newState)

        // Transition chime
        playTransitionChime(newState)
      }

      // Smooth movement
      node.x += (node.targetX - node.x) * 0.01
      node.y += (node.targetY - node.y) * 0.01

      // Breathing motion
      const breatheX = Math.sin(time * 0.3 + node.phase) * 3
      const breatheY = Math.cos(time * 0.2 + node.phase * 1.3) * 2

      const drawX = node.x + breatheX
      const drawY = node.y + breatheY

      // Cursor hover detection — gentle pulse
      const dx = cursorX - drawX
      const dy = cursorY - drawY
      const distSq = dx * dx + dy * dy
      const hoverRadius = 60
      const isHovered = distSq < hoverRadius * hoverRadius
      const hoverPulse = isHovered ? 0.15 + Math.sin(time * 4) * 0.05 : 0
      const hoverScale = isHovered ? 1.0 + Math.sin(time * 3) * 0.1 : 1.0

      // Draw based on state
      const text = node.memory.currentText
      const shortText = text.length > 35 ? text.slice(0, 35) + '...' : text

      if (node.state === 'document') {
        // Document: crisp, white, factual
        c.font = '12px monospace'
        c.fillStyle = `rgba(240, 235, 225, ${0.3 + hoverPulse})`
        c.textAlign = 'left'
        c.fillText(shortText, drawX, drawY)

        // Underline
        const textW = c.measureText(shortText).width
        c.strokeStyle = `rgba(240, 235, 225, ${0.1 + hoverPulse * 0.3})`
        c.lineWidth = 0.5
        c.beginPath()
        c.moveTo(drawX, drawY + 3)
        c.lineTo(drawX + textW, drawY + 3)
        c.stroke()

        // Hover glow
        if (isHovered) {
          const hGlow = c.createRadialGradient(drawX + textW * 0.5, drawY, 0, drawX + textW * 0.5, drawY, 30 * hoverScale)
          hGlow.addColorStop(0, `rgba(240, 235, 225, 0.04)`)
          hGlow.addColorStop(1, 'transparent')
          c.fillStyle = hGlow
          c.beginPath()
          c.arc(drawX + textW * 0.5, drawY, 30 * hoverScale, 0, Math.PI * 2)
          c.fill()
        }

      } else if (node.state === 'trace') {
        // Trace: amber, blurred, smudged
        c.font = '12px "Cormorant Garamond", serif'
        c.fillStyle = `rgba(220, 190, 130, ${0.2 + hoverPulse})`
        c.textAlign = 'left'

        // Double-render for blur effect
        c.fillText(shortText, drawX, drawY)
        c.fillStyle = `rgba(220, 190, 130, ${0.08 + hoverPulse * 0.3})`
        c.fillText(shortText, drawX + 1, drawY + 1)

        // Smudge dot
        const smudgeR = 15 * hoverScale
        const smudge = c.createRadialGradient(drawX + 20, drawY - 3, 0, drawX + 20, drawY - 3, smudgeR)
        smudge.addColorStop(0, `rgba(220, 190, 130, ${0.03 + hoverPulse * 0.2})`)
        smudge.addColorStop(1, 'transparent')
        c.fillStyle = smudge
        c.beginPath()
        c.arc(drawX + 20, drawY - 3, smudgeR, 0, Math.PI * 2)
        c.fill()

      } else {
        // Ghost: violet, transparent, drifting
        c.font = '12px "Cormorant Garamond", serif'
        const ghostAlpha = 0.08 + Math.sin(time * 1.5 + node.phase) * 0.03 + hoverPulse
        c.fillStyle = `rgba(180, 160, 220, ${ghostAlpha})`
        c.textAlign = 'left'
        c.fillText(shortText, drawX, drawY)

        // Ghost glow
        const glowR = 25 * hoverScale
        const glow = c.createRadialGradient(drawX + 30, drawY - 3, 0, drawX + 30, drawY - 3, glowR)
        glow.addColorStop(0, `rgba(180, 160, 220, ${ghostAlpha * 0.3})`)
        glow.addColorStop(1, 'transparent')
        c.fillStyle = glow
        c.beginPath()
        c.arc(drawX + 30, drawY - 3, glowR, 0, Math.PI * 2)
        c.fill()
      }
    }

    // --- Transition particles ---
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.005 // very slight gravity
      p.life -= 1 / p.maxLife
      if (p.life <= 0) {
        particles.splice(i, 1)
        continue
      }
      const alpha = p.life * 0.15
      const r = 1.5 * p.life
      c.fillStyle = `rgba(${p.color}, ${alpha})`
      c.beginPath()
      c.arc(p.x, p.y, r, 0, Math.PI * 2)
      c.fill()
    }

    // No memories
    if (nodes.length === 0) {
      c.font = '12px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(200, 180, 160, 0.1)'
      c.textAlign = 'center'
      c.fillText('nothing to rememory', w / 2, h / 2)
      c.font = '12px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(200, 180, 160, 0.06)'
      c.fillText('type something into the void to begin', w / 2, h / 2 + 20)
    }

    // Transition lines — when memories drift between columns
    for (const node of nodes) {
      const ddx = node.targetX - node.x
      if (Math.abs(ddx) > 20) {
        // Memory is transitioning between states
        c.strokeStyle = 'rgba(255, 215, 0, 0.04)'
        c.lineWidth = 0.5
        c.setLineDash([2, 4])
        c.beginPath()
        c.moveTo(node.x, node.y)
        c.lineTo(node.targetX, node.targetY)
        c.stroke()
        c.setLineDash([])
      }
    }

    // Title
    c.font = '12px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 180, 160, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.fillText('the rememory', w / 2, 25)

    // Attribution
    c.font = '11px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 180, 160, ${0.03 + Math.sin(time * 0.2) * 0.01})`
    c.fillText('after Toni Morrison — Sydney Biennale 2026', w / 2, 40)

    // Bottom
    c.font = '12px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 180, 160, ${0.03 + Math.sin(time * 0.15) * 0.01})`
    c.fillText('a rememory is a memory that lives outside the person who has it', w / 2, h - 4)
  }

  return {
    name: 'rememory',
    label: 'the rememory',

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

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
          buildNodes()
          initFogCircles(canvas.width, canvas.height)
        }
      }
      window.addEventListener('resize', onResize)

      // Cursor tracking
      canvas.addEventListener('mousemove', handleMouseMove)

      overlay.appendChild(canvas)

      // Navigation portals — state transition labels (document/trace/ghost themed)
      if (deps.switchTo) {
        const portalData = [
          { name: 'madeleine', label: 'DOCUMENT \u2192 madeleine', color: '240, 235, 225', pos: 'bottom: 40px; left: 20px;' },
          { name: 'projection', label: 'TRACE \u2192 projection', color: '220, 190, 130', pos: 'bottom: 40px; left: 50%; transform: translateX(-50%);' },
          { name: 'seance', label: 'GHOST \u2192 s\u00e9ance', color: '180, 160, 220', pos: 'bottom: 40px; right: 20px;' },
        ]
        for (const p of portalData) {
          const el = document.createElement('div')
          el.style.cssText = `
            position: absolute; ${p.pos}
            pointer-events: auto; cursor: pointer;
            font-family: monospace;
            font-size: 7px; letter-spacing: 2px;
            color: rgba(${p.color}, 0.05);
            transition: color 0.5s ease, text-shadow 0.5s ease;
            padding: 6px 10px; z-index: 10;
          `
          el.textContent = p.label
          el.addEventListener('mouseenter', () => {
            el.style.color = `rgba(${p.color}, 0.4)`
            el.style.textShadow = `0 0 10px rgba(${p.color}, 0.15)`
          })
          el.addEventListener('mouseleave', () => {
            el.style.color = `rgba(${p.color}, 0.05)`
            el.style.textShadow = 'none'
          })
          el.addEventListener('click', (e) => {
            e.stopPropagation()
            deps.switchTo!(p.name)
          })
          overlay.appendChild(el)
        }
      }

      return overlay
    },

    activate() {
      active = true
      buildNodes()
      if (canvas) initFogCircles(canvas.width, canvas.height)
      particles = []
      cursorX = -1
      cursorY = -1
      initAudio()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      fadeAudioOut()
      canvas?.removeEventListener('mousemove', handleMouseMove)
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      canvas?.removeEventListener('mousemove', handleMouseMove)
      destroyAudio()
      particles = []
      fogCircles = []
      overlay?.remove()
    },
  }
}
