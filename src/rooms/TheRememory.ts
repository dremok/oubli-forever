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
 * Cultural grounding: CRISPR epigenetic editing breakthrough (Jan 2026) —
 * genes can now be switched on/off WITHOUT cutting DNA, by removing
 * chemical tags. Memories here degrade similarly — not deleted but
 * having their "tags" slowly removed. Dragging a memory to another
 * column temporarily re-tags it, but the underlying process reasserts.
 *
 * Inspired by: Toni Morrison's "Beloved" (1987), Sydney Biennale 2026,
 * UMOCA "In Memory" exhibition, the idea that memory is not storage
 * but re-creation, Hisham Matar's "My Friends" (2025 NBCC Prize),
 * how trauma makes ghosts of the living, CRISPR epigenetic editing
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
  visualState: MemoryState // visual column (may differ during drag)
  x: number
  y: number
  targetX: number
  targetY: number
  phase: number
  // Dissolve transition state
  dissolving: boolean
  dissolveTime: number
  reforming: boolean
  reformTime: number
  // Drag override — snaps back after timeout
  dragOverrideState: MemoryState | null
  dragOverrideExpiry: number
}

interface TransitionParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size?: number
}

interface FogCircle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
}

// Morrison floating quote
interface MorrisonQuote {
  text: string
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
}

// Column atmosphere particles
interface AtmosphereParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  type: 'matrix' | 'streak' | 'mist'
}

function getState(degradation: number): MemoryState {
  if (degradation < 0.3) return 'document'
  if (degradation < 0.7) return 'trace'
  return 'ghost'
}

function stateToColIdx(state: MemoryState): number {
  return state === 'document' ? 0 : state === 'trace' ? 1 : 2
}

function colIdxToState(idx: number): MemoryState {
  return idx === 0 ? 'document' : idx === 1 ? 'trace' : 'ghost'
}

const MORRISON_QUOTES = [
  "It's never going away.",
  'Anything dead coming back to life hurts.',
  'Definitions belong to the definers, not the defined.',
  'Something that is loved is never lost.',
  'She is a friend of my mind. She gather me, man.',
  'Freeing yourself was one thing; claiming ownership of that freed self was another.',
]

const CULTURAL_INSCRIPTIONS = [
  'toni morrison\'s beloved: "rememory" — the past is a place you can walk into.',
  'episodic and semantic memory share the same brain networks (2026). remembering is reimagining.',
  'CRISPR memory reversal (virginia tech 2026): silenced genes reactivated. the ghost remembers.',
  'iGluSnFR4: molecular sensor eavesdrops on synaptic whispers. catching memories mid-transmission.',
  'proust\'s madeleine: involuntary memory triggered by taste. the body remembers what the mind forgets.',
  'sydney biennale 2026 "rememory": art as collective remembering in a forgetting world.',
  'shape-shifting molecular devices (CeNSE 2026): matter that remembers its former shape.',
  'w.g. sebald walked through ruins with a camera. documentation as memorial practice.',
  'the hippocampus replays experiences during sleep. dreaming is memory rehearsal.',
  'hosnedlova echo (white cube 2026): living fungal art that mutates. memory as organism.',
]

export function createRememoryRoom(deps: RememoryDeps): Room {
  let inscriptionTimer = 0
  let inscriptionIdx = 0
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let nodes: RememoryNode[] = []
  let particles: TransitionParticle[] = []
  let fogCircles: FogCircle[] = []
  let morrisonQuotes: MorrisonQuote[] = []
  let atmosphereParticles: AtmosphereParticle[] = []

  // Cursor tracking
  let cursorX = -1
  let cursorY = -1

  // Drag state
  let dragNode: RememoryNode | null = null
  let dragOffsetX = 0
  let dragOffsetY = 0
  let isDragging = false

  // Expand panel state
  let expandedNode: RememoryNode | null = null
  let expandPanelEl: HTMLElement | null = null

  // Audio state
  let audioInitialized = false
  let audioMaster: GainNode | null = null
  let breathLfo: OscillatorNode | null = null
  let breathGain: GainNode | null = null

  // Drone oscillators per state
  let docOsc: OscillatorNode | null = null
  let docGainNode: GainNode | null = null
  let traceOsc: OscillatorNode | null = null
  let traceGainNode: GainNode | null = null
  let ghostOsc1: OscillatorNode | null = null
  let ghostOsc2: OscillatorNode | null = null
  let ghostGainNode: GainNode | null = null

  // Current drone target gains for crossfade
  let docTarget = 0
  let traceTarget = 0
  let ghostTarget = 0

  function handleMouseMove(e: MouseEvent) {
    cursorX = e.clientX
    cursorY = e.clientY

    if (isDragging && dragNode && canvas) {
      dragNode.x = cursorX - dragOffsetX
      dragNode.y = cursorY - dragOffsetY
      // Update visual state based on current column
      const colW = canvas.width / 3
      const colIdx = Math.max(0, Math.min(2, Math.floor(dragNode.x / colW)))
      dragNode.visualState = colIdxToState(colIdx)
    }
  }

  function handleMouseDown(e: MouseEvent) {
    if (!canvas || expandedNode) return

    const mx = e.clientX
    const my = e.clientY

    // Find closest node within click radius
    let closest: RememoryNode | null = null
    let closestDist = Infinity
    for (const node of nodes) {
      const breatheX = Math.sin(time * 0.3 + node.phase) * 3
      const breatheY = Math.cos(time * 0.2 + node.phase * 1.3) * 2
      const drawX = node.x + breatheX
      const drawY = node.y + breatheY
      const dx = mx - drawX
      const dy = my - drawY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 60 && dist < closestDist) {
        closest = node
        closestDist = dist
      }
    }

    if (closest) {
      dragNode = closest
      dragOffsetX = mx - closest.x
      dragOffsetY = my - closest.y
      isDragging = false // Will become true on move
      if (canvas) canvas.style.cursor = 'grabbing'
    }
  }

  function handleMouseMoveDrag(e: MouseEvent) {
    if (dragNode && !isDragging) {
      const dx = e.clientX - (dragNode.x + dragOffsetX)
      const dy = e.clientY - (dragNode.y + dragOffsetY)
      if (dx * dx + dy * dy > 25) {
        isDragging = true
      }
    }
  }

  function handleMouseUp(_e: MouseEvent) {
    if (dragNode && !isDragging) {
      // This was a click, not a drag — expand
      showExpandPanel(dragNode)
    } else if (dragNode && isDragging && canvas) {
      // Drag ended — determine target column
      const colW = canvas.width / 3
      const colIdx = Math.max(0, Math.min(2, Math.floor(dragNode.x / colW)))
      const newState = colIdxToState(colIdx)
      const realState = getState(dragNode.memory.degradation)

      if (newState !== realState) {
        // Dropped in a different column — apply cosmetic override
        dragNode.dragOverrideState = newState
        dragNode.dragOverrideExpiry = time + 10 + Math.random() * 5 // 10-15s

        // Place in new column visually
        const newTargetX = colIdx * colW + colW * 0.2 + Math.random() * colW * 0.6
        dragNode.targetX = newTargetX
        dragNode.visualState = newState

        // Burst particles at drop location
        spawnBurstParticles(dragNode.x, dragNode.y, newState, 15)

        // Chime
        playTransitionChime(newState)
      } else {
        // Dropped back in same column — just settle
        const colIdx2 = stateToColIdx(realState)
        dragNode.targetX = colIdx2 * colW + colW * 0.2 + Math.random() * colW * 0.6
        dragNode.visualState = realState
      }
    }

    dragNode = null
    isDragging = false
    if (canvas) canvas.style.cursor = 'default'
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && expandedNode) {
      hideExpandPanel()
    }
  }

  // --- Expand panel ---
  function showExpandPanel(node: RememoryNode) {
    if (!overlay) return
    expandedNode = node

    // Remove existing if any
    hideExpandPanel()
    expandedNode = node

    const panel = document.createElement('div')
    expandPanelEl = panel

    const state = node.visualState

    // State-specific styling
    let fontFamily: string
    let color: string
    let borderColor: string
    let extraCss = ''

    if (state === 'document') {
      fontFamily = 'monospace'
      color = 'rgba(240, 235, 225, 0.9)'
      borderColor = 'rgba(240, 235, 225, 0.08)'
    } else if (state === 'trace') {
      fontFamily = '"Cormorant Garamond", serif'
      color = 'rgba(220, 190, 130, 0.85)'
      borderColor = 'rgba(220, 190, 130, 0.1)'
      extraCss = 'filter: blur(0.3px);'
    } else {
      fontFamily = '"Cormorant Garamond", serif'
      color = 'rgba(180, 160, 220, 0.7)'
      borderColor = 'rgba(180, 160, 220, 0.08)'
      extraCss = 'font-style: italic;'
    }

    panel.style.cssText = `
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%) scale(0.95);
      max-width: 420px; width: 80%;
      padding: 30px 36px;
      background: rgba(10, 8, 14, 0.95);
      border: 1px solid ${borderColor};
      border-radius: 2px;
      font-family: ${fontFamily};
      font-size: 14px;
      line-height: 1.7;
      color: ${color};
      z-index: 100;
      pointer-events: auto;
      opacity: 0;
      transition: opacity 0.4s ease, transform 0.4s ease;
      ${extraCss}
    `

    // Ghost pulse animation
    if (state === 'ghost') {
      const style = document.createElement('style')
      style.textContent = `
        @keyframes rememory-ghost-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.85; }
        }
      `
      panel.appendChild(style)
      panel.style.animation = 'rememory-ghost-pulse 3s ease-in-out infinite'
    }

    // State label
    const label = document.createElement('div')
    label.style.cssText = `
      font-size: 9px; letter-spacing: 3px; text-transform: uppercase;
      opacity: 0.3; margin-bottom: 16px;
      font-family: monospace;
    `
    label.textContent = state
    panel.appendChild(label)

    // Original text
    const original = document.createElement('div')
    original.style.cssText = 'margin-bottom: 12px;'
    original.textContent = node.memory.originalText
    panel.appendChild(original)

    // If degraded, show current text too
    if (node.memory.currentText !== node.memory.originalText) {
      const current = document.createElement('div')
      current.style.cssText = `
        margin-top: 12px; padding-top: 12px;
        border-top: 1px solid ${borderColor};
        opacity: 0.5; font-size: 12px;
      `
      current.textContent = node.memory.currentText
      panel.appendChild(current)
    }

    // Degradation meter
    const meter = document.createElement('div')
    meter.style.cssText = `
      margin-top: 16px; height: 2px; width: 100%;
      background: rgba(100, 90, 80, 0.15); border-radius: 1px;
      overflow: hidden;
    `
    const fill = document.createElement('div')
    const pct = Math.round(node.memory.degradation * 100)
    fill.style.cssText = `
      height: 100%; width: ${pct}%;
      background: ${color};
      opacity: 0.4;
      transition: width 0.3s ease;
    `
    meter.appendChild(fill)
    panel.appendChild(meter)

    const pctLabel = document.createElement('div')
    pctLabel.style.cssText = `
      font-size: 9px; opacity: 0.25; margin-top: 4px;
      font-family: monospace;
    `
    pctLabel.textContent = `${pct}% degraded`
    panel.appendChild(pctLabel)

    // Backdrop for click-outside-to-dismiss
    const backdrop = document.createElement('div')
    backdrop.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 99; pointer-events: auto;
    `
    backdrop.addEventListener('click', () => hideExpandPanel())
    overlay.appendChild(backdrop)
    overlay.appendChild(panel)

    // Trigger transition
    requestAnimationFrame(() => {
      panel.style.opacity = '1'
      panel.style.transform = 'translate(-50%, -50%) scale(1)'
    })
  }

  function hideExpandPanel() {
    expandedNode = null
    if (expandPanelEl) {
      expandPanelEl.style.opacity = '0'
      expandPanelEl.style.transform = 'translate(-50%, -50%) scale(0.95)'
      const el = expandPanelEl
      setTimeout(() => el.remove(), 400)
      expandPanelEl = null
    }
    // Remove backdrop
    if (overlay) {
      const backdrops = overlay.querySelectorAll('div[style*="z-index: 99"]')
      backdrops.forEach(b => b.remove())
    }
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

  // Initialize Morrison quotes
  function initMorrisonQuotes(w: number, h: number) {
    morrisonQuotes = []
    for (let i = 0; i < MORRISON_QUOTES.length; i++) {
      morrisonQuotes.push({
        text: MORRISON_QUOTES[i],
        x: Math.random() * w * 0.8 + w * 0.1,
        y: Math.random() * h * 0.6 + h * 0.2,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.05,
        alpha: 0.04 + Math.random() * 0.02,
      })
    }
  }

  // Spawn atmosphere particles for columns
  function spawnAtmosphereParticles(w: number, h: number) {
    // Only spawn occasionally
    const colW = w / 3

    // Document column: matrix rain particles
    if (Math.random() < 0.15) {
      atmosphereParticles.push({
        x: Math.random() * colW,
        y: 70,
        vx: (Math.random() - 0.5) * 0.1,
        vy: 0.3 + Math.random() * 0.5,
        life: 1.0,
        maxLife: 120 + Math.floor(Math.random() * 80),
        type: 'matrix',
      })
    }

    // Trace column: horizontal amber streaks
    if (Math.random() < 0.08) {
      atmosphereParticles.push({
        x: colW,
        y: 80 + Math.random() * (h - 160),
        vx: 0.4 + Math.random() * 0.6,
        vy: (Math.random() - 0.5) * 0.05,
        life: 1.0,
        maxLife: 80 + Math.floor(Math.random() * 60),
        type: 'streak',
      })
    }

    // Ghost column: rising mist
    if (Math.random() < 0.12) {
      atmosphereParticles.push({
        x: colW * 2 + Math.random() * colW,
        y: h - 40,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -(0.2 + Math.random() * 0.4),
        life: 1.0,
        maxLife: 150 + Math.floor(Math.random() * 100),
        type: 'mist',
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
      docGainNode = ac.createGain()
      docGainNode.gain.value = 0
      docOsc.connect(docGainNode)
      docGainNode.connect(breathGain)
      docOsc.start()

      // Trace drone — warm triangle 165Hz
      traceOsc = ac.createOscillator()
      traceOsc.type = 'triangle'
      traceOsc.frequency.value = 165
      traceGainNode = ac.createGain()
      traceGainNode.gain.value = 0
      traceOsc.connect(traceGainNode)
      traceGainNode.connect(breathGain)
      traceOsc.start()

      // Ghost drone — two detuned sines ~130Hz for slow beats
      ghostOsc1 = ac.createOscillator()
      ghostOsc1.type = 'sine'
      ghostOsc1.frequency.value = 130
      ghostOsc2 = ac.createOscillator()
      ghostOsc2.type = 'sine'
      ghostOsc2.frequency.value = 131.5 // slight detune for beating
      ghostGainNode = ac.createGain()
      ghostGainNode.gain.value = 0
      ghostOsc1.connect(ghostGainNode)
      ghostOsc2.connect(ghostGainNode)
      ghostGainNode.connect(breathGain)
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
    const maxDoc = dominance.document
    const maxTrace = dominance.trace
    const maxGhost = dominance.ghost
    const maxVal = Math.max(maxDoc, maxTrace, maxGhost, 0.01)

    docTarget = (maxDoc / maxVal) * 0.015
    traceTarget = (maxTrace / maxVal) * 0.02
    ghostTarget = (maxGhost / maxVal) * 0.015

    // Smooth crossfade via exponential approach
    if (docGainNode) {
      const cur = docGainNode.gain.value
      docGainNode.gain.value = cur + (docTarget - cur) * 0.02
    }
    if (traceGainNode) {
      const cur = traceGainNode.gain.value
      traceGainNode.gain.value = cur + (traceTarget - cur) * 0.02
    }
    if (ghostGainNode) {
      const cur = ghostGainNode.gain.value
      ghostGainNode.gain.value = cur + (ghostTarget - cur) * 0.02
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

  // Burst particles at a point — used for drag-drop
  function spawnBurstParticles(cx: number, cy: number, newState: MemoryState, count: number) {
    const color = newState === 'document'
      ? '240, 235, 225'
      : newState === 'trace'
        ? '220, 190, 130'
        : '180, 160, 220'
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5
      const speed = 0.8 + Math.random() * 1.2
      particles.push({
        x: cx + (Math.random() - 0.5) * 6,
        y: cy + (Math.random() - 0.5) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        maxLife: 40 + Math.floor(Math.random() * 30),
        color,
        size: 1.5 + Math.random() * 1.5,
      })
    }
  }

  // Dissolve particles — text shatters into particles that drift to new column
  function spawnDissolveParticles(x: number, y: number, textWidth: number, fromState: MemoryState, toState: MemoryState) {
    const fromColor = fromState === 'document'
      ? '240, 235, 225'
      : fromState === 'trace'
        ? '220, 190, 130'
        : '180, 160, 220'
    const toColor = toState === 'document'
      ? '240, 235, 225'
      : toState === 'trace'
        ? '220, 190, 130'
        : '180, 160, 220'

    // Spawn particles along the text width
    const count = 12 + Math.floor(Math.random() * 8)
    for (let i = 0; i < count; i++) {
      const px = x + (i / count) * textWidth
      const py = y + (Math.random() - 0.5) * 8
      // Mix from and to colors
      const useToColor = Math.random() > 0.5
      particles.push({
        x: px,
        y: py,
        vx: (Math.random() - 0.5) * 2.0,
        vy: (Math.random() - 0.5) * 1.5,
        life: 1.0,
        maxLife: 50 + Math.floor(Math.random() * 40),
        color: useToColor ? toColor : fromColor,
        size: 1.0 + Math.random() * 1.0,
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
      docGainNode?.disconnect()
      traceOsc?.disconnect()
      traceGainNode?.disconnect()
      ghostOsc1?.disconnect()
      ghostOsc2?.disconnect()
      ghostGainNode?.disconnect()
      breathLfo?.disconnect()
      breathGain?.disconnect()
      audioMaster?.disconnect()
      docOsc = null
      docGainNode = null
      traceOsc = null
      traceGainNode = null
      ghostOsc1 = null
      ghostOsc2 = null
      ghostGainNode = null
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
          visualState: state,
          x: targetX + (Math.random() - 0.5) * 100,
          y: targetY + (Math.random() - 0.5) * 50,
          targetX,
          targetY,
          phase: Math.random() * Math.PI * 2,
          dissolving: false,
          dissolveTime: 0,
          reforming: false,
          reformTime: 0,
          dragOverrideState: null,
          dragOverrideExpiry: 0,
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

    // --- Column atmosphere effects ---
    const colW = w / 3

    // Spawn new atmosphere particles
    spawnAtmosphereParticles(w, h)

    // Update and render atmosphere particles
    for (let i = atmosphereParticles.length - 1; i >= 0; i--) {
      const ap = atmosphereParticles[i]
      ap.x += ap.vx
      ap.y += ap.vy
      ap.life -= 1 / ap.maxLife

      if (ap.life <= 0 || ap.y < 60 || ap.y > h) {
        atmosphereParticles.splice(i, 1)
        continue
      }

      if (ap.type === 'matrix') {
        // Falling data particles in document column — matrix rain
        const alpha = ap.life * 0.06
        c.fillStyle = `rgba(240, 235, 225, ${alpha})`
        // Small character-like dots
        c.fillRect(ap.x, ap.y, 1, 3)
        // Occasional brighter dot
        if (Math.random() < 0.02) {
          c.fillStyle = `rgba(240, 235, 225, ${alpha * 2})`
          c.fillRect(ap.x, ap.y, 1.5, 1.5)
        }
      } else if (ap.type === 'streak') {
        // Horizontal amber streaks in trace column
        const alpha = ap.life * 0.04
        const grad = c.createLinearGradient(ap.x, ap.y, ap.x + 40, ap.y)
        grad.addColorStop(0, 'transparent')
        grad.addColorStop(0.3, `rgba(220, 190, 130, ${alpha})`)
        grad.addColorStop(0.7, `rgba(220, 190, 130, ${alpha * 0.6})`)
        grad.addColorStop(1, 'transparent')
        c.fillStyle = grad
        c.fillRect(ap.x, ap.y - 0.5, 40, 1)
      } else if (ap.type === 'mist') {
        // Rising mist in ghost column
        const alpha = ap.life * 0.03
        const r = 15 + (1 - ap.life) * 20
        const grad = c.createRadialGradient(ap.x, ap.y, 0, ap.x, ap.y, r)
        grad.addColorStop(0, `rgba(180, 160, 220, ${alpha})`)
        grad.addColorStop(1, 'transparent')
        c.fillStyle = grad
        c.beginPath()
        c.arc(ap.x, ap.y, r, 0, Math.PI * 2)
        c.fill()
      }
    }

    // Cap atmosphere particles
    if (atmosphereParticles.length > 80) {
      atmosphereParticles.splice(0, atmosphereParticles.length - 80)
    }

    // Column dividers (subtle)
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
    const docGlowGrad = c.createLinearGradient(0, 45, 0, 45 + colGlowHeight)
    docGlowGrad.addColorStop(0, `rgba(240, 235, 225, ${0.02 + dominance.document * 0.02})`)
    docGlowGrad.addColorStop(1, 'transparent')
    c.fillStyle = docGlowGrad
    c.fillRect(0, 45, colW, colGlowHeight)

    // Trace column glow
    const traceGlowGrad = c.createLinearGradient(0, 45, 0, 45 + colGlowHeight)
    traceGlowGrad.addColorStop(0, `rgba(220, 190, 130, ${0.02 + dominance.trace * 0.02})`)
    traceGlowGrad.addColorStop(1, 'transparent')
    c.fillStyle = traceGlowGrad
    c.fillRect(colW, 45, colW, colGlowHeight)

    // Ghost column glow
    const ghostGlowGrad = c.createLinearGradient(0, 45, 0, 45 + colGlowHeight)
    ghostGlowGrad.addColorStop(0, `rgba(180, 160, 220, ${0.02 + dominance.ghost * 0.02})`)
    ghostGlowGrad.addColorStop(1, 'transparent')
    c.fillStyle = ghostGlowGrad
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

    // --- Morrison quotes drifting in background ---
    c.save()
    c.font = '300 14px "Cormorant Garamond", serif'
    c.textAlign = 'left'
    for (const q of morrisonQuotes) {
      q.x += q.vx
      q.y += q.vy

      // Wrap around
      if (q.x < -200) q.x = w + 50
      if (q.x > w + 50) q.x = -200
      if (q.y < 60) q.y = h - 60
      if (q.y > h - 40) q.y = 80

      const pulseAlpha = q.alpha + Math.sin(time * 0.2 + q.x * 0.01) * 0.01
      c.fillStyle = `rgba(200, 180, 160, ${Math.max(0, pulseAlpha)})`
      c.fillText(q.text, q.x, q.y)
    }
    c.restore()

    // Update node positions (smooth drift toward targets)
    for (const node of nodes) {
      // Check drag override expiry
      if (node.dragOverrideState !== null && time > node.dragOverrideExpiry) {
        // Override expired — snap back to real state with dissolve effect
        const realState = getState(node.memory.degradation)
        const oldVisual = node.visualState

        // Spawn dissolve particles for the snap-back
        const breatheX = Math.sin(time * 0.3 + node.phase) * 3
        const breatheY = Math.cos(time * 0.2 + node.phase * 1.3) * 2
        spawnDissolveParticles(
          node.x + breatheX, node.y + breatheY, 150,
          oldVisual, realState
        )

        node.dragOverrideState = null
        node.state = realState
        node.visualState = realState
        const colIdx = stateToColIdx(realState)
        node.targetX = colIdx * colW + colW * 0.2 + Math.random() * colW * 0.6

        // Dissolve animation
        node.dissolving = true
        node.dissolveTime = time
        node.reforming = false

        playTransitionChime(realState)
      }

      // Check if real state has changed (natural degradation)
      const newState = getState(node.memory.degradation)
      if (newState !== node.state && node.dragOverrideState === null) {
        // Memory has transitioned naturally
        const oldState = node.state

        // Spawn dissolve particles for dramatic transition
        const breatheX = Math.sin(time * 0.3 + node.phase) * 3
        const breatheY = Math.cos(time * 0.2 + node.phase * 1.3) * 2
        spawnDissolveParticles(
          node.x + breatheX, node.y + breatheY, 150,
          oldState, newState
        )

        node.state = newState
        node.visualState = newState
        const colIdx = stateToColIdx(newState)
        const newTargetX = colIdx * colW + colW * 0.2 + Math.random() * colW * 0.6
        node.targetX = newTargetX

        // Also spawn the original directional particles
        const oldColIdx = stateToColIdx(oldState)
        const oldCenterX = oldColIdx * colW + colW * 0.5
        const newCenterX = colIdx * colW + colW * 0.5
        spawnTransitionParticles(oldCenterX, node.y, newCenterX, node.y, newState)

        // Begin dissolve animation
        node.dissolving = true
        node.dissolveTime = time
        node.reforming = false

        // Transition chime
        playTransitionChime(newState)
      }

      // Handle dissolve/reform animation timing
      if (node.dissolving) {
        const elapsed = time - node.dissolveTime
        if (elapsed > 0.5 && !node.reforming) {
          // Start reforming
          node.reforming = true
          node.reformTime = time
        }
        if (elapsed > 1.2) {
          // Animation complete
          node.dissolving = false
          node.reforming = false
        }
      }

      // Skip position update if being dragged
      if (dragNode === node && isDragging) continue

      // Smooth movement
      node.x += (node.targetX - node.x) * 0.01
      node.y += (node.targetY - node.y) * 0.01

      // Breathing motion
      const breatheX = Math.sin(time * 0.3 + node.phase) * 3
      const breatheY = Math.cos(time * 0.2 + node.phase * 1.3) * 2

      const drawX = node.x + breatheX
      const drawY = node.y + breatheY

      // Compute dissolve alpha multiplier
      let dissolveAlpha = 1.0
      if (node.dissolving) {
        const elapsed = time - node.dissolveTime
        if (elapsed < 0.4) {
          // Dissolving out
          dissolveAlpha = 1.0 - (elapsed / 0.4)
        } else if (node.reforming) {
          const reformElapsed = time - node.reformTime
          dissolveAlpha = Math.min(1.0, reformElapsed / 0.5)
        } else {
          dissolveAlpha = 0
        }
      }

      // Cursor hover detection — gentle pulse
      const dx = cursorX - drawX
      const dy = cursorY - drawY
      const distSq = dx * dx + dy * dy
      const hoverRadius = 60
      const isHovered = distSq < hoverRadius * hoverRadius && !isDragging
      const hoverPulse = isHovered ? 0.15 + Math.sin(time * 4) * 0.05 : 0
      const hoverScale = isHovered ? 1.0 + Math.sin(time * 3) * 0.1 : 1.0

      // Cursor style
      if (isHovered && canvas && !isDragging) {
        canvas.style.cursor = 'pointer'
      }

      // Draw based on visual state (may differ from real state during drag override)
      const renderState = node.visualState
      const text = node.memory.currentText
      const shortText = text.length > 35 ? text.slice(0, 35) + '...' : text

      if (renderState === 'document') {
        // Document: crisp, white, factual
        c.font = '12px monospace'
        c.fillStyle = `rgba(240, 235, 225, ${(0.3 + hoverPulse) * dissolveAlpha})`
        c.textAlign = 'left'
        c.fillText(shortText, drawX, drawY)

        // Underline
        const textW = c.measureText(shortText).width
        c.strokeStyle = `rgba(240, 235, 225, ${(0.1 + hoverPulse * 0.3) * dissolveAlpha})`
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

      } else if (renderState === 'trace') {
        // Trace: amber, blurred, smudged
        c.font = '12px "Cormorant Garamond", serif'
        c.fillStyle = `rgba(220, 190, 130, ${(0.2 + hoverPulse) * dissolveAlpha})`
        c.textAlign = 'left'

        // Double-render for blur effect
        c.fillText(shortText, drawX, drawY)
        c.fillStyle = `rgba(220, 190, 130, ${(0.08 + hoverPulse * 0.3) * dissolveAlpha})`
        c.fillText(shortText, drawX + 1, drawY + 1)

        // Smudge dot
        const smudgeR = 15 * hoverScale
        const smudge = c.createRadialGradient(drawX + 20, drawY - 3, 0, drawX + 20, drawY - 3, smudgeR)
        smudge.addColorStop(0, `rgba(220, 190, 130, ${(0.03 + hoverPulse * 0.2) * dissolveAlpha})`)
        smudge.addColorStop(1, 'transparent')
        c.fillStyle = smudge
        c.beginPath()
        c.arc(drawX + 20, drawY - 3, smudgeR, 0, Math.PI * 2)
        c.fill()

      } else {
        // Ghost: violet, transparent, drifting
        c.font = '12px "Cormorant Garamond", serif'
        const ghostAlpha = (0.08 + Math.sin(time * 1.5 + node.phase) * 0.03 + hoverPulse) * dissolveAlpha
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

      // Drag override indicator — faint pulsing border when in override
      if (node.dragOverrideState !== null) {
        const remaining = node.dragOverrideExpiry - time
        const urgency = remaining < 3 ? 0.5 + Math.sin(time * 6) * 0.3 : 0.15
        const oColor = renderState === 'document' ? '240, 235, 225'
          : renderState === 'trace' ? '220, 190, 130'
            : '180, 160, 220'
        c.strokeStyle = `rgba(${oColor}, ${urgency * 0.15 * dissolveAlpha})`
        c.lineWidth = 0.5
        c.setLineDash([1, 3])
        c.strokeRect(drawX - 4, drawY - 12, 160, 16)
        c.setLineDash([])
      }
    }

    // Reset cursor if not hovering any node
    if (!isDragging && canvas) {
      let anyHovered = false
      for (const node of nodes) {
        const breatheX = Math.sin(time * 0.3 + node.phase) * 3
        const breatheY = Math.cos(time * 0.2 + node.phase * 1.3) * 2
        const drawX = node.x + breatheX
        const drawY = node.y + breatheY
        const dx = cursorX - drawX
        const dy = cursorY - drawY
        if (dx * dx + dy * dy < 3600) { anyHovered = true; break }
      }
      if (!anyHovered) canvas.style.cursor = 'default'
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
      const r = (p.size ?? 1.5) * p.life
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
      if (dragNode === node && isDragging) continue
      const ddx = node.targetX - node.x
      if (Math.abs(ddx) > 20) {
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
    c.fillText('after Toni Morrison \u2014 Sydney Biennale 2026', w / 2, 40)

    // Bottom — Morrison quote
    c.font = '12px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 180, 160, ${0.03 + Math.sin(time * 0.15) * 0.01})`
    c.fillText('a rememory is a memory that lives outside the person who has it', w / 2, h - 20)

    // Epigenetic inscription
    c.font = '10px monospace'
    c.fillStyle = `rgba(160, 150, 140, ${0.025 + Math.sin(time * 0.12) * 0.008})`
    c.fillText('epigenetic memory: what the cell remembers without remembering how', w / 2, h - 4)

    // Cultural inscriptions
    inscriptionTimer += 0.016
    if (inscriptionTimer >= 25) {
      inscriptionTimer = 0
      inscriptionIdx = (inscriptionIdx + 1) % CULTURAL_INSCRIPTIONS.length
    }
    const insText = CULTURAL_INSCRIPTIONS[inscriptionIdx]
    c.font = '11px "Cormorant Garamond", serif'
    c.textAlign = 'center'
    c.fillStyle = 'rgba(160, 150, 170, 0.03)'
    const insMaxW = w * 0.75
    const insWords = insText.split(' ')
    const insLines: string[] = []
    let insLine = ''
    for (const word of insWords) {
      const test = insLine ? insLine + ' ' + word : word
      if (c.measureText(test).width > insMaxW) { insLines.push(insLine); insLine = word }
      else insLine = test
    }
    if (insLine) insLines.push(insLine)
    for (let li = 0; li < insLines.length; li++) {
      c.fillText(insLines[li], w / 2, h - 50 + li * 14)
    }
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
          initMorrisonQuotes(canvas.width, canvas.height)
        }
      }
      window.addEventListener('resize', onResize)

      // Cursor + interaction tracking
      canvas.addEventListener('mousemove', handleMouseMove)
      canvas.addEventListener('mousemove', handleMouseMoveDrag)
      canvas.addEventListener('mousedown', handleMouseDown)
      canvas.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('keydown', handleKeyDown)

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
      if (canvas) {
        initFogCircles(canvas.width, canvas.height)
        initMorrisonQuotes(canvas.width, canvas.height)
      }
      particles = []
      atmosphereParticles = []
      cursorX = -1
      cursorY = -1
      dragNode = null
      isDragging = false
      expandedNode = null
      initAudio()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      fadeAudioOut()
      hideExpandPanel()
      canvas?.removeEventListener('mousemove', handleMouseMove)
      canvas?.removeEventListener('mousemove', handleMouseMoveDrag)
      canvas?.removeEventListener('mousedown', handleMouseDown)
      canvas?.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('keydown', handleKeyDown)
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      hideExpandPanel()
      canvas?.removeEventListener('mousemove', handleMouseMove)
      canvas?.removeEventListener('mousemove', handleMouseMoveDrag)
      canvas?.removeEventListener('mousedown', handleMouseDown)
      canvas?.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('keydown', handleKeyDown)
      destroyAudio()
      particles = []
      fogCircles = []
      morrisonQuotes = []
      atmosphereParticles = []
      overlay?.remove()
    },
  }
}
