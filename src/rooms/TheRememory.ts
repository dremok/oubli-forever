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

interface Memory {
  id: string
  originalText: string
  currentText: string
  degradation: number
  timestamp: number
}

interface RememoryDeps {
  getMemories: () => Memory[]
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

    // Background shifts based on dominant state
    const bgR = Math.floor(8 + dominance.ghost * 8)
    const bgG = Math.floor(6 + dominance.document * 6)
    const bgB = Math.floor(12 + dominance.ghost * 15)
    c.fillStyle = `rgb(${bgR}, ${bgG}, ${bgB})`
    c.fillRect(0, 0, w, h)

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

    // Column headers
    c.font = '11px "Cormorant Garamond", serif'
    c.textAlign = 'center'

    // Document column
    c.fillStyle = `rgba(240, 235, 225, ${0.12 + Math.sin(time * 0.5) * 0.03})`
    c.fillText('DOCUMENT', colW * 0.5, 55)
    c.font = '8px monospace'
    c.fillStyle = 'rgba(240, 235, 225, 0.06)'
    c.fillText(`${docCount}`, colW * 0.5, 68)

    // Trace column
    c.font = '11px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(220, 190, 130, ${0.12 + Math.sin(time * 0.5 + 1) * 0.03})`
    c.fillText('TRACE', colW * 1.5, 55)
    c.font = '8px monospace'
    c.fillStyle = 'rgba(220, 190, 130, 0.06)'
    c.fillText(`${traceCount}`, colW * 1.5, 68)

    // Ghost column
    c.font = '11px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(180, 160, 220, ${0.12 + Math.sin(time * 0.5 + 2) * 0.03})`
    c.fillText('GHOST', colW * 2.5, 55)
    c.font = '8px monospace'
    c.fillStyle = 'rgba(180, 160, 220, 0.06)'
    c.fillText(`${ghostCount}`, colW * 2.5, 68)

    // Update node positions (smooth drift toward targets)
    for (const node of nodes) {
      // Check if state has changed
      const newState = getState(node.memory.degradation)
      if (newState !== node.state) {
        // Memory has transitioned! Update target position
        node.state = newState
        const colIdx = newState === 'document' ? 0 : newState === 'trace' ? 1 : 2
        node.targetX = colIdx * colW + colW * 0.2 + Math.random() * colW * 0.6
      }

      // Smooth movement
      node.x += (node.targetX - node.x) * 0.01
      node.y += (node.targetY - node.y) * 0.01

      // Breathing motion
      const breatheX = Math.sin(time * 0.3 + node.phase) * 3
      const breatheY = Math.cos(time * 0.2 + node.phase * 1.3) * 2

      const drawX = node.x + breatheX
      const drawY = node.y + breatheY

      // Draw based on state
      const text = node.memory.currentText
      const shortText = text.length > 35 ? text.slice(0, 35) + '...' : text

      if (node.state === 'document') {
        // Document: crisp, white, factual
        c.font = '10px monospace'
        c.fillStyle = `rgba(240, 235, 225, 0.3)`
        c.textAlign = 'left'
        c.fillText(shortText, drawX, drawY)

        // Underline
        const textW = c.measureText(shortText).width
        c.strokeStyle = 'rgba(240, 235, 225, 0.1)'
        c.lineWidth = 0.5
        c.beginPath()
        c.moveTo(drawX, drawY + 3)
        c.lineTo(drawX + textW, drawY + 3)
        c.stroke()

      } else if (node.state === 'trace') {
        // Trace: amber, blurred, smudged
        c.font = '10px "Cormorant Garamond", serif'
        c.fillStyle = `rgba(220, 190, 130, 0.2)`
        c.textAlign = 'left'

        // Double-render for blur effect
        c.fillText(shortText, drawX, drawY)
        c.fillStyle = `rgba(220, 190, 130, 0.08)`
        c.fillText(shortText, drawX + 1, drawY + 1)

        // Smudge dot
        const smudge = c.createRadialGradient(drawX + 20, drawY - 3, 0, drawX + 20, drawY - 3, 15)
        smudge.addColorStop(0, `rgba(220, 190, 130, 0.03)`)
        smudge.addColorStop(1, 'transparent')
        c.fillStyle = smudge
        c.beginPath()
        c.arc(drawX + 20, drawY - 3, 15, 0, Math.PI * 2)
        c.fill()

      } else {
        // Ghost: violet, transparent, drifting
        c.font = '10px "Cormorant Garamond", serif'
        const ghostAlpha = 0.08 + Math.sin(time * 1.5 + node.phase) * 0.03
        c.fillStyle = `rgba(180, 160, 220, ${ghostAlpha})`
        c.textAlign = 'left'
        c.fillText(shortText, drawX, drawY)

        // Ghost glow
        const glow = c.createRadialGradient(drawX + 30, drawY - 3, 0, drawX + 30, drawY - 3, 25)
        glow.addColorStop(0, `rgba(180, 160, 220, ${ghostAlpha * 0.3})`)
        glow.addColorStop(1, 'transparent')
        c.fillStyle = glow
        c.beginPath()
        c.arc(drawX + 30, drawY - 3, 25, 0, Math.PI * 2)
        c.fill()
      }
    }

    // No memories
    if (nodes.length === 0) {
      c.font = '12px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(200, 180, 160, 0.1)'
      c.textAlign = 'center'
      c.fillText('nothing to rememory', w / 2, h / 2)
      c.font = '10px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(200, 180, 160, 0.06)'
      c.fillText('type something into the void to begin', w / 2, h / 2 + 20)
    }

    // Transition lines — when memories drift between columns
    for (const node of nodes) {
      const dx = node.targetX - node.x
      if (Math.abs(dx) > 20) {
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
    c.font = '10px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 180, 160, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.fillText('the rememory', w / 2, 25)

    // Attribution
    c.font = '8px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 180, 160, ${0.03 + Math.sin(time * 0.2) * 0.01})`
    c.fillText('after Toni Morrison — Sydney Biennale 2026', w / 2, 40)

    // Bottom
    c.font = '9px "Cormorant Garamond", serif'
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
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)
      return overlay
    },

    activate() {
      active = true
      buildNodes()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      overlay?.remove()
    },
  }
}
