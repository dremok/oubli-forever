/**
 * THE DISINTEGRATION LOOPS — memory as degrading tape
 *
 * Inspired by William Basinski's masterpiece "The Disintegration Loops"
 * (2002) — recorded as old tape loops were being digitized, the magnetic
 * coating flaking off with each pass through the machine. What began as
 * lush ambient music gradually crumbled into silence. He finished
 * recording on September 11, 2001, watching the towers fall from his
 * Brooklyn rooftop as the tapes disintegrated.
 *
 * In this room, your stored memories become tape loops. Each loop
 * plays visually — text scrolling across the screen like tape through
 * a machine. With each pass, characters degrade: letters drop out,
 * words blur, the "tape" develops gaps and static. Eventually only
 * fragments remain, then silence.
 *
 * The degradation is REAL — it reflects and slightly accelerates
 * each memory's actual degradation value. Watching costs something.
 *
 * Also inspired by: Alvin Lucier's "I Am Sitting in a Room" (speech
 * re-recorded until only room resonance remains), vaporwave's
 * degraded nostalgia loops, cassette culture, the warmth of
 * analog decay vs. digital perfection, how re-remembering changes
 * the memory each time (reconsolidation theory)
 *
 * USES MEMORIES. Destructive observation. Audio-visual.
 */

import type { Room } from './RoomManager'
import { getAudioContext } from '../sound/AudioBus'

interface Memory {
  id: string
  originalText: string
  currentText: string
  degradation: number
  timestamp: number
}

interface DisintegrationDeps {
  getMemories: () => Memory[]
  accelerateDegradation: (id: string, amount: number) => void
  switchTo?: (name: string) => void
}

interface TapeLoop {
  memory: Memory
  position: number // 0-1 through the loop
  pass: number // how many times it's looped
  degradedText: string
  particles: { x: number; y: number; char: string; alpha: number; vy: number }[]
}

export function createDisintegrationLoopsRoom(deps: DisintegrationDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let loops: TapeLoop[] = []
  let activeLoop = 0
  let audioCtx: AudioContext | null = null
  let droneOsc: OscillatorNode | null = null
  let droneGain: GainNode | null = null
  let totalPasses = 0

  function buildLoops() {
    const memories = deps.getMemories()
    loops = memories.slice(0, 8).map(mem => ({
      memory: mem,
      position: 0,
      pass: 0,
      degradedText: mem.currentText,
      particles: [],
    }))
  }

  function degradeText(text: string, intensity: number): { text: string; lost: string[] } {
    const chars = text.split('')
    const lost: string[] = []

    for (let i = 0; i < chars.length; i++) {
      if (chars[i] === ' ') continue

      // Probability of degradation increases with intensity
      const chance = intensity * 0.15
      if (Math.random() < chance) {
        // Degradation types
        const r = Math.random()
        if (r < 0.3) {
          // Drop character entirely
          lost.push(chars[i])
          chars[i] = ' '
        } else if (r < 0.5) {
          // Replace with static
          lost.push(chars[i])
          chars[i] = ['░', '▒', '▓', '·', '~'][Math.floor(Math.random() * 5)]
        } else if (r < 0.7) {
          // Duplicate previous character (tape echo)
          if (i > 0 && chars[i - 1] !== ' ') {
            lost.push(chars[i])
            chars[i] = chars[i - 1]
          }
        }
        // else: survives this pass
      }
    }

    return { text: chars.join(''), lost }
  }

  async function initAudio() {
    try {
      audioCtx = await getAudioContext()

      // Low drone — the sound of the tape machine
      droneOsc = audioCtx.createOscillator()
      droneOsc.type = 'sine'
      droneOsc.frequency.value = 55 // low A

      droneGain = audioCtx.createGain()
      droneGain.gain.value = 0

      // Warm it with slight overdrive
      const filter = audioCtx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 200
      filter.Q.value = 1

      droneOsc.connect(filter)
      filter.connect(droneGain)
      droneGain.connect(audioCtx.destination)

      droneOsc.start()

      // Fade in
      droneGain.gain.setValueAtTime(0, audioCtx.currentTime)
      droneGain.gain.linearRampToValueAtTime(0.03, audioCtx.currentTime + 3)
    } catch {
      // Audio not available
    }
  }

  function playDegradationClick() {
    if (!audioCtx) return
    try {
      const osc = audioCtx.createOscillator()
      osc.type = 'square'
      osc.frequency.value = 800 + Math.random() * 2000
      const gain = audioCtx.createGain()
      gain.gain.value = 0.01
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start()
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05)
      osc.stop(audioCtx.currentTime + 0.05)
    } catch {}
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const c = ctx
    const w = canvas.width
    const h = canvas.height

    // Dark background — machine room
    c.fillStyle = 'rgba(8, 6, 4, 1)'
    c.fillRect(0, 0, w, h)

    if (loops.length === 0) {
      c.font = '12px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(200, 180, 140, 0.1)'
      c.textAlign = 'center'
      c.fillText('no tapes to play', w / 2, h / 2)
      c.font = '10px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(200, 180, 140, 0.06)'
      c.fillText('the machine waits for memories', w / 2, h / 2 + 20)

      // Title
      c.font = '10px "Cormorant Garamond", serif'
      c.fillStyle = `rgba(200, 180, 140, ${0.06 + Math.sin(time * 0.3) * 0.02})`
      c.textAlign = 'center'
      c.fillText('the disintegration loops', w / 2, 25)
      return
    }

    const loop = loops[activeLoop % loops.length]

    // Advance tape position
    const speed = 0.003
    loop.position += speed

    // Loop completed — degrade and restart
    if (loop.position >= 1) {
      loop.position = 0
      loop.pass++
      totalPasses++

      // Degrade the text
      const degradation = loop.memory.degradation + loop.pass * 0.1
      const result = degradeText(loop.degradedText, degradation)
      loop.degradedText = result.text

      // Spawn particles from lost characters
      for (const lostChar of result.lost) {
        loop.particles.push({
          x: w * 0.2 + Math.random() * w * 0.6,
          y: h * 0.4 + Math.random() * h * 0.2,
          char: lostChar,
          alpha: 0.4,
          vy: -0.3 - Math.random() * 0.5,
        })
      }

      // Actually accelerate real degradation (small amount)
      if (loop.pass % 3 === 0) {
        deps.accelerateDegradation(loop.memory.id, 0.02)
        playDegradationClick()
      }

      // After many passes, switch to next loop
      if (loop.pass >= 20 || loop.degradedText.trim().length === 0) {
        activeLoop++
        if (activeLoop >= loops.length) activeLoop = 0
      }
    }

    // Tape reel visualization — two circles
    const reelY = h * 0.18
    const reelR = 35
    const leftReelX = w * 0.35
    const rightReelX = w * 0.65

    // Reel rotation
    const rot = time * 2

    // Left reel (supply)
    c.strokeStyle = 'rgba(120, 100, 80, 0.15)'
    c.lineWidth = 2
    c.beginPath()
    c.arc(leftReelX, reelY, reelR, 0, Math.PI * 2)
    c.stroke()

    // Spokes
    for (let s = 0; s < 3; s++) {
      const a = rot + s * (Math.PI * 2 / 3)
      c.beginPath()
      c.moveTo(leftReelX, reelY)
      c.lineTo(leftReelX + Math.cos(a) * reelR, reelY + Math.sin(a) * reelR)
      c.stroke()
    }

    // Right reel (takeup)
    c.beginPath()
    c.arc(rightReelX, reelY, reelR, 0, Math.PI * 2)
    c.stroke()
    for (let s = 0; s < 3; s++) {
      const a = -rot + s * (Math.PI * 2 / 3)
      c.beginPath()
      c.moveTo(rightReelX, reelY)
      c.lineTo(rightReelX + Math.cos(a) * reelR, reelY + Math.sin(a) * reelR)
      c.stroke()
    }

    // Tape path between reels
    c.strokeStyle = 'rgba(160, 130, 90, 0.1)'
    c.lineWidth = 3
    c.beginPath()
    c.moveTo(leftReelX + reelR, reelY)
    c.lineTo(rightReelX - reelR, reelY)
    c.stroke()

    // Main text display — tape content scrolling
    const displayY = h * 0.45
    const text = loop.degradedText
    const charWidth = 14
    const totalWidth = text.length * charWidth
    const scrollX = -loop.position * totalWidth

    c.font = '18px monospace'
    c.textAlign = 'left'

    for (let i = 0; i < text.length; i++) {
      const cx = w * 0.1 + scrollX + i * charWidth
      if (cx < -charWidth || cx > w + charWidth) continue

      const char = text[i]
      if (char === ' ') continue

      // Characters degrade visually based on pass count
      const passAlpha = Math.max(0.05, 1 - loop.pass * 0.04)
      const jitter = loop.pass > 5 ? (Math.random() - 0.5) * loop.pass * 0.3 : 0

      // Color shifts from warm amber to gray with degradation
      const warmth = Math.max(0, 1 - loop.pass * 0.05)
      const r = Math.floor(200 * warmth + 100 * (1 - warmth))
      const g = Math.floor(170 * warmth + 90 * (1 - warmth))
      const b = Math.floor(120 * warmth + 80 * (1 - warmth))

      c.fillStyle = `rgba(${r}, ${g}, ${b}, ${passAlpha * 0.5})`
      c.fillText(char, cx, displayY + jitter)
    }

    // Tape head position indicator
    const headX = w * 0.1 + (w * 0.8) * loop.position
    c.strokeStyle = 'rgba(255, 200, 100, 0.08)'
    c.lineWidth = 1
    c.beginPath()
    c.moveTo(headX, displayY - 30)
    c.lineTo(headX, displayY + 15)
    c.stroke()

    // Magnetic oxide particles (falling from tape)
    loop.particles = loop.particles.filter(p => {
      p.y += p.vy
      p.alpha -= 0.003

      if (p.alpha <= 0) return false

      c.font = '10px monospace'
      c.fillStyle = `rgba(160, 130, 90, ${p.alpha})`
      c.textAlign = 'center'
      c.fillText(p.char, p.x, p.y)

      return true
    })

    // Pass counter — like a VU meter
    const passRatio = loop.pass / 20
    const meterW = w * 0.3
    const meterX = (w - meterW) / 2
    const meterY = h * 0.65

    c.strokeStyle = 'rgba(120, 100, 80, 0.08)'
    c.lineWidth = 1
    c.strokeRect(meterX, meterY, meterW, 4)

    c.fillStyle = `rgba(${passRatio > 0.7 ? 200 : 160}, ${passRatio > 0.7 ? 80 : 130}, ${passRatio > 0.7 ? 60 : 90}, 0.2)`
    c.fillRect(meterX, meterY, meterW * Math.min(1, passRatio), 4)

    // Loop selector — small dots at bottom
    const selectorY = h * 0.72
    for (let i = 0; i < loops.length; i++) {
      const sx = w / 2 + (i - loops.length / 2) * 20
      const isActive = i === activeLoop % loops.length
      c.fillStyle = isActive
        ? 'rgba(255, 200, 100, 0.3)'
        : `rgba(120, 100, 80, ${0.05 + (loops[i].pass > 0 ? 0.05 : 0)})`
      c.beginPath()
      c.arc(sx, selectorY, isActive ? 4 : 2, 0, Math.PI * 2)
      c.fill()
    }

    // Info
    c.font = '9px monospace'
    c.fillStyle = 'rgba(160, 130, 90, 0.12)'
    c.textAlign = 'left'
    c.fillText(`loop ${(activeLoop % loops.length) + 1}/${loops.length}`, 12, h - 42)
    c.fillText(`pass ${loop.pass}`, 12, h - 30)
    c.fillText(`${totalPasses} total passes`, 12, h - 18)

    // Memory source text (original, very faint)
    c.font = '8px "Cormorant Garamond", serif'
    c.fillStyle = 'rgba(160, 130, 90, 0.04)'
    c.textAlign = 'center'
    const origText = loop.memory.originalText
    const shortOrig = origText.length > 60 ? origText.slice(0, 60) + '...' : origText
    c.fillText(`original: ${shortOrig}`, w / 2, h * 0.78)

    // Title
    c.font = '10px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 180, 140, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.fillText('the disintegration loops', w / 2, 25)

    // Attribution
    c.font = '8px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(160, 130, 90, ${0.03 + Math.sin(time * 0.2) * 0.01})`
    c.textAlign = 'center'
    c.fillText('after William Basinski, 2001', w / 2, 40)

    // Bottom context
    c.font = '9px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(160, 130, 90, ${0.03 + Math.sin(time * 0.15) * 0.01})`
    c.fillText('each pass through the machine costs something', w / 2, h - 4)
  }

  return {
    name: 'disintegration',
    label: 'the disintegration loops',

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

      // Click to advance to next loop
      canvas.addEventListener('click', () => {
        activeLoop++
        if (loops.length > 0 && activeLoop >= loops.length) activeLoop = 0
      })

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)

      // Navigation portals — styled as tape transport buttons
      if (deps.switchTo) {
        const portalData = [
          { name: 'furnace', label: '⏪ FURNACE', color: '200, 140, 80', pos: 'bottom: 60px; left: 24px;' },
          { name: 'radio', label: '⏩ RADIO', color: '160, 180, 200', pos: 'bottom: 60px; right: 24px;' },
          { name: 'projection', label: '⏏ PROJECTION', color: '200, 180, 140', pos: 'bottom: 60px; left: 50%; transform: translateX(-50%);' },
        ]
        for (const p of portalData) {
          const el = document.createElement('div')
          el.style.cssText = `
            position: absolute; ${p.pos}
            pointer-events: auto; cursor: pointer;
            font-family: monospace;
            font-size: 8px; letter-spacing: 3px;
            color: rgba(${p.color}, 0.06);
            transition: color 0.5s ease, text-shadow 0.5s ease;
            padding: 6px 10px; z-index: 10;
          `
          el.textContent = p.label
          el.addEventListener('mouseenter', () => {
            el.style.color = `rgba(${p.color}, 0.45)`
            el.style.textShadow = `0 0 12px rgba(${p.color}, 0.15)`
          })
          el.addEventListener('mouseleave', () => {
            el.style.color = `rgba(${p.color}, 0.06)`
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

    async activate() {
      active = true
      activeLoop = 0
      totalPasses = 0
      buildLoops()
      await initAudio()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      try {
        droneOsc?.stop()
        droneOsc?.disconnect()
        droneGain?.disconnect()
      } catch {}
      droneOsc = null
      droneGain = null
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      try {
        droneOsc?.stop()
      } catch {}
      overlay?.remove()
    },
  }
}
