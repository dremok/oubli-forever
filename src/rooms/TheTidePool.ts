/**
 * THE TIDE POOL — memories wash ashore
 *
 * An ocean-edge room where memories arrive as flotsam on waves.
 * The water is rendered as layered sine waves on canvas. Memory
 * fragments float on the surface, tumbling in the surf. Some
 * wash up on the beach. Others are pulled back out to sea.
 *
 * The sound is procedural ocean — filtered noise shaped by
 * wave frequency, with occasional gull-like tones.
 *
 * Degraded memories are waterlogged — blurred, colors faded,
 * text barely readable. Fresh memories are bright driftwood.
 *
 * The tide slowly comes in and goes out over minutes. At high
 * tide, more memories are visible. At low tide, the beach
 * stretches out, empty.
 *
 * Inspired by: Tide pools, messages in bottles, flotsam and
 * jetsam, the liminal zone between land and sea, beach
 * combing, Hokusai's Great Wave, oceanic time scales
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'
import { getAudioContext } from '../sound/AudioBus'

interface TidePoolDeps {
  getMemories: () => StoredMemory[]
  switchTo?: (name: string) => void
}

interface Flotsam {
  memory: StoredMemory
  x: number
  y: number
  vx: number
  bobPhase: number
  bobSpeed: number
  rotation: number
  onBeach: boolean
}

export function createTidePoolRoom(deps: TidePoolDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let flotsam: Flotsam[] = []
  let audioCtx: AudioContext | null = null
  let noiseSource: AudioBufferSourceNode | null = null
  let noiseGain: GainNode | null = null
  let hoveredLandmark = -1

  const landmarks = [
    { label: 'garden', room: 'garden', xFrac: 0.12 },
    { label: 'well', room: 'well', xFrac: 0.32 },
    { label: 'lighthouse', room: 'lighthouse', xFrac: 0.68 },
    { label: 'glacarium', room: 'glacarium', xFrac: 0.82 },
    { label: 'weathervane', room: 'weathervane', xFrac: 0.92 },
  ]

  function buildFlotsam() {
    const memories = deps.getMemories()
    if (!canvas) return

    const w = canvas.width
    flotsam = []

    for (let i = 0; i < Math.min(memories.length, 25); i++) {
      const mem = memories[i]
      flotsam.push({
        memory: mem,
        x: Math.random() * w,
        y: 0, // will be set by wave position
        vx: (Math.random() - 0.5) * 0.3,
        bobPhase: Math.random() * Math.PI * 2,
        bobSpeed: 0.5 + Math.random() * 0.5,
        rotation: (Math.random() - 0.5) * 0.3,
        onBeach: Math.random() < 0.3,
      })
    }
  }

  async function startOceanSound() {
    try {
      audioCtx = await getAudioContext()
      if (!audioCtx) return

      // Create noise buffer for ocean
      const bufferSize = audioCtx.sampleRate * 2
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
      const data = buffer.getChannelData(0)

      // Brown noise (more oceanic than white)
      let last = 0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        last = (last + 0.02 * white) / 1.02
        data[i] = last * 3.5
      }

      noiseSource = audioCtx.createBufferSource()
      noiseSource.buffer = buffer
      noiseSource.loop = true

      // Low-pass filter — ocean is bassy
      const filter = audioCtx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 400
      filter.Q.value = 0.5

      noiseGain = audioCtx.createGain()
      noiseGain.gain.value = 0

      noiseSource.connect(filter)
      filter.connect(noiseGain)
      noiseGain.connect(audioCtx.destination)

      noiseSource.start()

      // Fade in
      noiseGain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 2)
    } catch {
      // Audio failed — continue without sound
    }
  }

  function stopOceanSound() {
    if (noiseGain && audioCtx) {
      noiseGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1)
      setTimeout(() => {
        noiseSource?.stop()
        noiseSource = null
        noiseGain = null
      }, 1500)
    }
  }

  function getWaveY(x: number, w: number, h: number): number {
    // Tide level oscillates over ~3 minutes
    const tide = Math.sin(time * 0.006) * 0.1 // ±10% of height
    const baseY = h * (0.55 + tide)

    // Multiple wave layers
    const wave1 = Math.sin(x * 0.008 + time * 0.7) * 15
    const wave2 = Math.sin(x * 0.015 + time * 1.1 + 1) * 8
    const wave3 = Math.sin(x * 0.003 + time * 0.3 + 2) * 20

    return baseY + wave1 + wave2 + wave3
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Sky — dark ocean night
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.5)
    sky.addColorStop(0, 'rgba(5, 8, 20, 1)')
    sky.addColorStop(1, 'rgba(10, 15, 30, 1)')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h * 0.6)

    // Moon reflection shimmer
    const moonX = w * 0.7
    const moonY = h * 0.1
    ctx.beginPath()
    ctx.arc(moonX, moonY, 20, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(200, 210, 230, 0.06)'
    ctx.fill()

    // Moon reflection on water
    for (let i = 0; i < 20; i++) {
      const ry = getWaveY(moonX + (Math.random() - 0.5) * 40, w, h) + i * 8
      ctx.beginPath()
      ctx.ellipse(moonX + Math.sin(time + i) * 3, ry, 15 - i * 0.5, 1, 0, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(200, 210, 230, ${0.03 - i * 0.001})`
      ctx.fill()
    }

    // Beach (bottom)
    const beachY = h * 0.75
    const beach = ctx.createLinearGradient(0, beachY, 0, h)
    beach.addColorStop(0, 'rgba(60, 50, 35, 0.8)')
    beach.addColorStop(1, 'rgba(30, 25, 18, 1)')
    ctx.fillStyle = beach
    ctx.fillRect(0, beachY, w, h - beachY)

    // Draw water layers (back to front)
    for (let layer = 3; layer >= 0; layer--) {
      const layerOffset = layer * 15
      const alpha = 0.15 + (3 - layer) * 0.1

      ctx.beginPath()
      ctx.moveTo(0, h)

      for (let x = 0; x <= w; x += 4) {
        const y = getWaveY(x, w, h) + layerOffset
        ctx.lineTo(x, y)
      }

      ctx.lineTo(w, h)
      ctx.closePath()

      const hue = 200 + layer * 10
      ctx.fillStyle = `hsla(${hue}, 40%, ${10 + layer * 3}%, ${alpha})`
      ctx.fill()
    }

    // Foam line at wave edge
    ctx.strokeStyle = 'rgba(200, 220, 240, 0.08)'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let x = 0; x <= w; x += 3) {
      const y = getWaveY(x, w, h)
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Draw flotsam
    for (const f of flotsam) {
      const waveY = getWaveY(f.x, w, h)

      // Update position
      if (!f.onBeach) {
        f.x += f.vx + Math.sin(time * 0.5) * 0.5
        f.y = waveY - 5 + Math.sin(time * f.bobSpeed + f.bobPhase) * 4

        // Wrap around
        if (f.x < -50) f.x = w + 50
        if (f.x > w + 50) f.x = -50

        // Occasionally wash up
        if (waveY > beachY - 10 && Math.random() < 0.001) {
          f.onBeach = true
        }
      } else {
        f.y = beachY + 5 + (f.bobPhase % 30)
      }

      const health = 1 - f.memory.degradation
      const text = f.memory.currentText.slice(0, 30)
      if (!text.trim()) continue

      ctx.save()
      ctx.translate(f.x, f.y)
      ctx.rotate(f.rotation + (f.onBeach ? 0 : Math.sin(time * f.bobSpeed + f.bobPhase) * 0.1))

      // Text on driftwood
      ctx.font = `${10 + health * 3}px "Cormorant Garamond", serif`
      const textAlpha = f.onBeach ? 0.15 + health * 0.2 : 0.1 + health * 0.3
      ctx.fillStyle = f.onBeach
        ? `rgba(180, 160, 130, ${textAlpha})` // beach: sandy
        : `rgba(200, 220, 240, ${textAlpha})` // water: sea-foam

      // Waterlogged effect — blur via multiple offset draws
      if (f.memory.degradation > 0.3) {
        ctx.globalAlpha = 0.3
        ctx.fillText(text, 1, 1)
        ctx.fillText(text, -1, 0)
        ctx.globalAlpha = 1
      }

      ctx.fillText(text, 0, 0)
      ctx.restore()
    }

    // Horizon landmarks (navigation)
    if (deps.switchTo) {
      const horizonY = h * 0.35
      for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i]
        const lx = w * lm.xFrac
        const hovered = hoveredLandmark === i
        const a = hovered ? 0.3 : 0.06
        // Silhouette dot on horizon
        ctx.beginPath()
        ctx.arc(lx, horizonY, hovered ? 5 : 3, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200, 220, 240, ${a})`
        ctx.fill()
        // Label
        ctx.font = '8px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(200, 220, 240, ${hovered ? 0.3 : 0.05})`
        ctx.textAlign = 'center'
        ctx.fillText(lm.label, lx, horizonY - 10)
      }
    }

    // Title
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(200, 220, 240, 0.1)'
    ctx.textAlign = 'center'
    ctx.fillText('the tide pool', w / 2, 30)

    // Tide indicator
    const tideLevel = Math.sin(time * 0.006)
    const tideWord = tideLevel > 0.3 ? 'high tide' : tideLevel < -0.3 ? 'low tide' : 'mid tide'
    ctx.font = '9px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(200, 220, 240, 0.06)'
    ctx.textAlign = 'right'
    ctx.fillText(tideWord, w - 16, 30)

    // Stats
    const onWater = flotsam.filter(f => !f.onBeach).length
    const onShore = flotsam.filter(f => f.onBeach).length
    ctx.font = '9px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(180, 160, 130, 0.08)'
    ctx.textAlign = 'left'
    ctx.fillText(`${onWater} adrift · ${onShore} ashore`, 16, h - 16)
  }

  return {
    name: 'tidepool',
    label: 'the tide pool',

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

      // Click and hover for horizon landmarks
      canvas.addEventListener('click', (e) => {
        if (!deps.switchTo || !canvas) return
        const horizonY = canvas.height * 0.35
        for (let i = 0; i < landmarks.length; i++) {
          const lx = canvas.width * landmarks[i].xFrac
          const dx = e.clientX - lx
          const dy = e.clientY - horizonY
          if (dx * dx + dy * dy < 400) { // 20px radius
            deps.switchTo(landmarks[i].room)
            return
          }
        }
      })

      canvas.addEventListener('mousemove', (e) => {
        if (!canvas) return
        hoveredLandmark = -1
        const horizonY = canvas.height * 0.35
        for (let i = 0; i < landmarks.length; i++) {
          const lx = canvas.width * landmarks[i].xFrac
          const dx = e.clientX - lx
          const dy = e.clientY - horizonY
          if (dx * dx + dy * dy < 400) {
            hoveredLandmark = i
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
      buildFlotsam()
      startOceanSound()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      stopOceanSound()
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      stopOceanSound()
      overlay?.remove()
    },
  }
}
