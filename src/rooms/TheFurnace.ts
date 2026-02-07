/**
 * THE FURNACE — active destruction of memories
 *
 * Every other room in Oubli is about passive decay. The Furnace is different:
 * here, you choose to destroy. You select a memory and feed it to the fire.
 * The text burns character by character, embers rise, and the memory is
 * permanently accelerated toward full degradation.
 *
 * This is cathartic. Sometimes forgetting isn't something that happens to you —
 * it's something you need to do. The furnace gives you that agency.
 *
 * The visual: a central fire rendered in canvas, memories listed as paper
 * fragments around it. Drag or click a memory into the fire. Watch it burn.
 * The fire grows larger the more you feed it.
 *
 * Inspired by: Book burning (as catharsis, not censorship), Japanese
 * oharai purification rituals, burning letters from ex-lovers,
 * the Phoenix myth, thermodynamics (entropy always increases),
 * Marie Kondo's "does it spark joy?" reframed as "does it still hurt?"
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'

interface FurnaceDeps {
  getMemories: () => StoredMemory[]
  accelerateDegradation: (id: string, amount: number) => void
}

interface Ember {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  hue: number
  char: string
}

interface BurningChar {
  char: string
  x: number
  y: number
  alpha: number
  burnPhase: number // 0→1
  hue: number
}

export function createFurnaceRoom(deps: FurnaceDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let embers: Ember[] = []
  let burningChars: BurningChar[] = []
  let fireIntensity = 0.3 // grows as you burn
  let selectedMemory: StoredMemory | null = null
  let burnProgress = 0
  let listEl: HTMLElement | null = null
  let statusEl: HTMLElement | null = null

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height
    const fireX = w / 2
    const fireY = h * 0.55

    ctx.clearRect(0, 0, w, h)

    // Background — dark with warm undertone
    const bg = ctx.createRadialGradient(fireX, fireY, 0, fireX, fireY, h)
    bg.addColorStop(0, `rgba(30, 10, 5, ${0.95 - fireIntensity * 0.1})`)
    bg.addColorStop(0.4, 'rgba(15, 5, 2, 0.98)')
    bg.addColorStop(1, 'rgba(5, 2, 1, 1)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // Fire glow on ground
    ctx.beginPath()
    ctx.ellipse(fireX, fireY + 40, 80 + fireIntensity * 40, 15, 0, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 80, 20, ${0.03 + fireIntensity * 0.04})`
    ctx.fill()

    // Fire — layered flame shapes
    const flameCount = 8 + Math.floor(fireIntensity * 12)
    for (let i = 0; i < flameCount; i++) {
      const seed = i * 137.5
      const phase = time * 3 + seed
      const sway = Math.sin(phase) * (8 + fireIntensity * 15)
      const flameH = (40 + Math.sin(phase * 0.7) * 15) * (0.5 + fireIntensity * 0.8)
      const flameW = 6 + Math.sin(phase * 1.3) * 3 + fireIntensity * 8
      const baseX = fireX + (Math.sin(seed) * 20 * fireIntensity)

      // Inner flame (yellow-white)
      ctx.beginPath()
      ctx.moveTo(baseX - flameW * 0.3 + sway * 0.5, fireY)
      ctx.quadraticCurveTo(
        baseX + sway, fireY - flameH * 0.8,
        baseX + sway * 0.3, fireY - flameH
      )
      ctx.quadraticCurveTo(
        baseX + sway, fireY - flameH * 0.5,
        baseX + flameW * 0.3 + sway * 0.5, fireY
      )
      ctx.closePath()
      const innerAlpha = 0.03 + fireIntensity * 0.04
      ctx.fillStyle = `rgba(255, 200, 80, ${innerAlpha})`
      ctx.fill()

      // Outer flame (orange-red)
      ctx.beginPath()
      ctx.moveTo(baseX - flameW + sway * 0.3, fireY + 5)
      ctx.quadraticCurveTo(
        baseX + sway * 1.2, fireY - flameH * 1.1,
        baseX + sway * 0.5, fireY - flameH * 1.3
      )
      ctx.quadraticCurveTo(
        baseX + sway * 1.2, fireY - flameH * 0.7,
        baseX + flameW + sway * 0.3, fireY + 5
      )
      ctx.closePath()
      ctx.fillStyle = `rgba(255, 60, 10, ${innerAlpha * 0.6})`
      ctx.fill()
    }

    // Fire base glow
    ctx.beginPath()
    ctx.arc(fireX, fireY, 20 + fireIntensity * 30, 0, Math.PI * 2)
    const glow = ctx.createRadialGradient(
      fireX, fireY, 0,
      fireX, fireY, 20 + fireIntensity * 30
    )
    glow.addColorStop(0, `rgba(255, 150, 50, ${0.1 + fireIntensity * 0.15})`)
    glow.addColorStop(1, 'rgba(255, 50, 10, 0)')
    ctx.fillStyle = glow
    ctx.fill()

    // Burning characters — text that's actively disintegrating
    for (let i = burningChars.length - 1; i >= 0; i--) {
      const bc = burningChars[i]
      bc.burnPhase += 0.008 + fireIntensity * 0.005
      bc.alpha -= 0.005

      if (bc.burnPhase >= 1 || bc.alpha <= 0) {
        // Character is fully burned — spawn embers
        for (let e = 0; e < 2; e++) {
          embers.push({
            x: bc.x, y: bc.y,
            vx: (Math.random() - 0.5) * 2,
            vy: -1 - Math.random() * 3,
            size: 1 + Math.random() * 2,
            alpha: 0.5 + Math.random() * 0.3,
            hue: bc.hue,
            char: bc.char,
          })
        }
        burningChars.splice(i, 1)
        continue
      }

      // Draw burning character
      const burnColor = bc.burnPhase < 0.3
        ? `rgba(255, 200, 100, ${bc.alpha})`    // bright yellow
        : bc.burnPhase < 0.6
        ? `rgba(255, 100, 30, ${bc.alpha * 0.8})` // orange
        : `rgba(200, 50, 10, ${bc.alpha * 0.5})`  // dark red ember

      ctx.font = `${14 - bc.burnPhase * 4}px "Cormorant Garamond", serif`
      ctx.fillStyle = burnColor
      ctx.textAlign = 'center'
      // Jitter as it burns
      const jx = (Math.random() - 0.5) * bc.burnPhase * 6
      const jy = (Math.random() - 0.5) * bc.burnPhase * 4 - bc.burnPhase * 20
      ctx.fillText(bc.char, bc.x + jx, bc.y + jy)
    }

    // Embers — rise and fade
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i]
      e.vy -= 0.02 // rise
      e.vx += (Math.random() - 0.5) * 0.1
      e.x += e.vx
      e.y += e.vy
      e.alpha -= 0.004
      e.size *= 0.998

      if (e.alpha <= 0 || e.y < -20) {
        embers.splice(i, 1)
        continue
      }

      ctx.beginPath()
      ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${e.hue}, 80%, 60%, ${e.alpha})`
      ctx.fill()
    }

    // Keep embers manageable
    if (embers.length > 200) embers.splice(0, 50)

    // Fire slowly dies down
    fireIntensity *= 0.9995
    if (fireIntensity < 0.3) fireIntensity = 0.3

    // Title
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(255, 150, 80, ${0.1 + Math.sin(time * 0.3) * 0.03})`
    ctx.textAlign = 'center'
    ctx.fillText('the furnace', w / 2, 30)

    // Burn progress indicator
    if (selectedMemory && burnProgress > 0 && burnProgress < 1) {
      const barW = 200
      const barX = w / 2 - barW / 2
      const barY = h * 0.82
      ctx.fillStyle = 'rgba(80, 30, 10, 0.3)'
      ctx.fillRect(barX, barY, barW, 3)
      ctx.fillStyle = `rgba(255, ${150 - burnProgress * 100}, ${50 - burnProgress * 50}, 0.6)`
      ctx.fillRect(barX, barY, barW * burnProgress, 3)
    }
  }

  function startBurn(memory: StoredMemory) {
    if (!canvas) return
    selectedMemory = memory
    burnProgress = 0
    const w = canvas.width
    const fireY = canvas.height * 0.55

    // Place characters in an arc above the fire
    const text = memory.currentText
    const chars = text.split('')
    const startX = w / 2 - (chars.length * 7) / 2
    const textY = fireY - 60

    for (let i = 0; i < chars.length; i++) {
      burningChars.push({
        char: chars[i],
        x: startX + i * 7,
        y: textY + Math.sin(i * 0.3) * 5,
        alpha: 0.8,
        burnPhase: 0,
        hue: 30 + (memory.hue || 0) * 30,
      })
    }

    // Stagger the burn — characters don't all burn at once
    const burnInterval = setInterval(() => {
      burnProgress += 0.02
      fireIntensity = Math.min(1, fireIntensity + 0.01)

      if (burnProgress >= 1) {
        clearInterval(burnInterval)
        // Accelerate degradation on the actual memory
        deps.accelerateDegradation(memory.id, 0.3)
        selectedMemory = null
        if (statusEl) {
          statusEl.textContent = 'it is done. the fire remembers nothing.'
          setTimeout(() => {
            if (statusEl) statusEl.textContent = ''
          }, 4000)
        }
        rebuildList()
      }
    }, 100)
  }

  function rebuildList() {
    if (!listEl) return
    listEl.innerHTML = ''
    const memories = deps.getMemories()
    const burnable = memories.filter(m => m.degradation < 0.9)

    if (burnable.length === 0) {
      const empty = document.createElement('div')
      empty.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-size: 12px; font-style: italic;
        color: rgba(255, 150, 80, 0.15);
        text-align: center; padding: 20px;
      `
      empty.textContent = 'nothing left to burn.'
      listEl.appendChild(empty)
      return
    }

    for (const mem of burnable.slice(0, 15)) {
      const item = document.createElement('div')
      item.style.cssText = `
        padding: 8px 12px;
        border-bottom: 1px solid rgba(255, 80, 20, 0.05);
        cursor: pointer;
        transition: background 0.3s ease;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `
      item.addEventListener('mouseenter', () => {
        item.style.background = 'rgba(255, 60, 10, 0.08)'
      })
      item.addEventListener('mouseleave', () => {
        item.style.background = 'transparent'
      })

      const textEl = document.createElement('div')
      textEl.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-size: 12px;
        color: rgba(255, 180, 100, 0.35);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 250px;
      `
      textEl.textContent = mem.currentText
      item.appendChild(textEl)

      const burnBtn = document.createElement('span')
      burnBtn.style.cssText = `
        font-family: monospace;
        font-size: 9px;
        color: rgba(255, 60, 10, 0.25);
        cursor: pointer;
        padding: 2px 8px;
        border: 1px solid rgba(255, 60, 10, 0.1);
        transition: all 0.3s ease;
        white-space: nowrap;
      `
      burnBtn.textContent = 'burn'
      burnBtn.addEventListener('mouseenter', () => {
        burnBtn.style.borderColor = 'rgba(255, 60, 10, 0.5)'
        burnBtn.style.color = 'rgba(255, 60, 10, 0.7)'
      })
      burnBtn.addEventListener('mouseleave', () => {
        burnBtn.style.borderColor = 'rgba(255, 60, 10, 0.1)'
        burnBtn.style.color = 'rgba(255, 60, 10, 0.25)'
      })
      burnBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        if (!selectedMemory) {
          startBurn(mem)
        }
      })
      item.appendChild(burnBtn)

      listEl.appendChild(item)
    }
  }

  return {
    name: 'furnace',
    label: 'the furnace',

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        width: 100%; height: 100%;
        pointer-events: auto;
        background: #000;
        display: flex;
        flex-direction: column;
        align-items: center;
      `

      canvas = document.createElement('canvas')
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      canvas.style.cssText = `
        position: absolute; top: 0; left: 0;
        width: 100%; height: 100%;
        pointer-events: none;
      `
      ctx = canvas.getContext('2d')
      overlay.appendChild(canvas)

      // Memory list — right side panel
      const panel = document.createElement('div')
      panel.style.cssText = `
        position: absolute;
        right: 20px; top: 60px;
        width: 320px; max-width: 40vw;
        max-height: 70vh;
        overflow-y: auto;
        scrollbar-width: none;
        z-index: 2;
        pointer-events: auto;
      `

      const panelTitle = document.createElement('div')
      panelTitle.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 11px;
        color: rgba(255, 150, 80, 0.2);
        letter-spacing: 3px;
        text-transform: uppercase;
        margin-bottom: 12px;
        padding: 0 12px;
      `
      panelTitle.textContent = 'choose what to forget'
      panel.appendChild(panelTitle)

      listEl = document.createElement('div')
      panel.appendChild(listEl)
      overlay.appendChild(panel)

      // Status
      statusEl = document.createElement('div')
      statusEl.style.cssText = `
        position: absolute;
        bottom: 40px; left: 0; right: 0;
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 12px; font-style: italic;
        color: rgba(255, 150, 80, 0.2);
        text-align: center;
        z-index: 2;
        pointer-events: none;
      `
      overlay.appendChild(statusEl)

      // Hint
      const hint = document.createElement('div')
      hint.style.cssText = `
        position: absolute;
        bottom: 20px; left: 0; right: 0;
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 9px;
        color: rgba(255, 100, 50, 0.08);
        text-align: center;
        z-index: 2;
        pointer-events: none;
      `
      hint.textContent = 'some things are easier to let go of than others'
      overlay.appendChild(hint)

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
      embers = []
      burningChars = []
      fireIntensity = 0.3
      rebuildList()
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
