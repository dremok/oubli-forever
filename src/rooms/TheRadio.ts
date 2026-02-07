/**
 * THE RADIO — tune through frequencies to find memory fragments
 *
 * A room that reimagines memories as radio broadcasts. You turn a dial
 * (horizontal slider or drag) to scan through frequencies. Between
 * stations, there's static. When you land on a frequency, you hear
 * a memory — either spoken via speech synthesis or displayed as text
 * that fades in through the noise.
 *
 * Each memory occupies a narrow band on the frequency spectrum.
 * Degraded memories have weaker signals — more static, harder to tune.
 * Fully degraded memories are just ghost signals: a brief flicker
 * of something that was once there.
 *
 * The visual: a dark panel with a glowing frequency display,
 * a tuning dial, signal strength meter, and the memory text
 * appearing through noise patterns.
 *
 * Inspired by: Number stations, EVP (Electronic Voice Phenomena),
 * shortwave radio DXing, the Conet Project, ghost frequencies,
 * the way radio waves carry voices across impossible distances,
 * Radiohead's "OK Computer" static aesthetic
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'
import { getAudioContext } from '../sound/AudioBus'

interface RadioDeps {
  getMemories: () => StoredMemory[]
}

interface Station {
  frequency: number // 88.0 - 108.0 MHz (display)
  memory: StoredMemory
  bandwidth: number // how wide the signal is (healthy = wider)
}

export function createRadioRoom(deps: RadioDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let frequency = 98.0 // current dial position
  let stations: Station[] = []
  let isDragging = false
  let signalStrength = 0
  let currentStation: Station | null = null
  let noiseNode: AudioBufferSourceNode | null = null
  let noiseGain: GainNode | null = null
  let toneOsc: OscillatorNode | null = null
  let toneGain: GainNode | null = null
  let audioInitialized = false
  let staticLines: { y: number; speed: number; alpha: number }[] = []

  function buildStations() {
    const memories = deps.getMemories()
    stations = []
    if (memories.length === 0) return

    // Distribute memories across the frequency band
    const bandStart = 88.0
    const bandEnd = 108.0
    const step = (bandEnd - bandStart) / Math.max(memories.length, 1)

    for (let i = 0; i < memories.length; i++) {
      const mem = memories[i]
      const health = 1 - mem.degradation
      stations.push({
        frequency: bandStart + i * step + step * 0.5,
        memory: mem,
        bandwidth: 0.1 + health * 0.4, // healthy = easier to tune
      })
    }
  }

  function getSignalAt(freq: number): { strength: number; station: Station | null } {
    let bestStrength = 0
    let bestStation: Station | null = null

    for (const s of stations) {
      const dist = Math.abs(freq - s.frequency)
      if (dist < s.bandwidth) {
        const strength = 1 - (dist / s.bandwidth)
        if (strength > bestStrength) {
          bestStrength = strength
          bestStation = s
        }
      }
    }

    return { strength: bestStrength, station: bestStation }
  }

  async function initAudio() {
    if (audioInitialized) return
    try {
      const audioCtx = await getAudioContext()
      if (!audioCtx) return

      // Create white noise buffer
      const bufferSize = audioCtx.sampleRate * 2
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.3
      }

      noiseNode = audioCtx.createBufferSource()
      noiseNode.buffer = buffer
      noiseNode.loop = true

      noiseGain = audioCtx.createGain()
      noiseGain.gain.value = 0.05

      // Bandpass filter for radio-like static
      const filter = audioCtx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 2000
      filter.Q.value = 0.5

      noiseNode.connect(filter)
      filter.connect(noiseGain)
      noiseGain.connect(audioCtx.destination)
      noiseNode.start()

      // Tone oscillator for station signal
      toneOsc = audioCtx.createOscillator()
      toneOsc.type = 'sine'
      toneOsc.frequency.value = 440
      toneGain = audioCtx.createGain()
      toneGain.gain.value = 0
      toneOsc.connect(toneGain)
      toneGain.connect(audioCtx.destination)
      toneOsc.start()

      audioInitialized = true
    } catch {
      // Audio not available
    }
  }

  function updateAudio() {
    if (!audioInitialized) return

    // Static volume inversely proportional to signal strength
    if (noiseGain) {
      noiseGain.gain.value = 0.03 * (1 - signalStrength * 0.8)
    }

    // Tone when on a station
    if (toneGain && toneOsc) {
      if (currentStation && signalStrength > 0.3) {
        const health = 1 - currentStation.memory.degradation
        toneOsc.frequency.value = 200 + currentStation.memory.hue * 400
        toneGain.gain.value = signalStrength * health * 0.02
      } else {
        toneGain.gain.value = 0
      }
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height

    // Get signal info
    const signal = getSignalAt(frequency)
    signalStrength += (signal.strength - signalStrength) * 0.1
    currentStation = signal.station

    updateAudio()

    ctx.clearRect(0, 0, w, h)

    // Background — dark with CRT-like vignette
    ctx.fillStyle = 'rgba(5, 8, 5, 1)'
    ctx.fillRect(0, 0, w, h)

    // CRT scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1)
    }

    // Static noise overlay (more when no signal)
    const staticIntensity = 1 - signalStrength * 0.8
    if (staticIntensity > 0.1) {
      // Horizontal static lines
      if (Math.random() < staticIntensity * 0.3) {
        staticLines.push({
          y: Math.random() * h,
          speed: 2 + Math.random() * 5,
          alpha: staticIntensity * 0.15,
        })
      }
      for (let i = staticLines.length - 1; i >= 0; i--) {
        const line = staticLines[i]
        line.y += line.speed
        line.alpha -= 0.005
        if (line.alpha <= 0 || line.y > h) {
          staticLines.splice(i, 1)
          continue
        }
        ctx.fillStyle = `rgba(200, 200, 180, ${line.alpha})`
        ctx.fillRect(0, line.y, w, 1)
      }
      if (staticLines.length > 30) staticLines.splice(0, 10)

      // Random noise pixels
      for (let i = 0; i < Math.floor(staticIntensity * 80); i++) {
        const nx = Math.random() * w
        const ny = Math.random() * h
        const ns = 1 + Math.random() * 2
        ctx.fillStyle = `rgba(${150 + Math.random() * 100}, ${150 + Math.random() * 80}, ${130 + Math.random() * 60}, ${staticIntensity * 0.08})`
        ctx.fillRect(nx, ny, ns, ns)
      }
    }

    // --- RADIO PANEL ---
    const panelX = w * 0.15
    const panelW = w * 0.7
    const panelY = h * 0.15

    // Frequency display
    ctx.font = '32px "Courier New", monospace'
    ctx.fillStyle = `rgba(100, 255, 100, ${0.6 + Math.sin(time * 2) * 0.05})`
    ctx.textAlign = 'center'
    ctx.fillText(`${frequency.toFixed(1)} MHz`, w / 2, panelY + 40)

    // Glow behind frequency
    ctx.shadowColor = 'rgba(100, 255, 100, 0.3)'
    ctx.shadowBlur = 20
    ctx.fillText(`${frequency.toFixed(1)} MHz`, w / 2, panelY + 40)
    ctx.shadowBlur = 0

    // Signal strength meter
    const meterX = panelX + panelW - 80
    const meterY = panelY + 15
    ctx.font = '9px monospace'
    ctx.fillStyle = 'rgba(100, 255, 100, 0.2)'
    ctx.textAlign = 'left'
    ctx.fillText('SIGNAL', meterX, meterY)

    const bars = 8
    for (let i = 0; i < bars; i++) {
      const barH = 3 + i * 1.5
      const barFilled = signalStrength > (i + 1) / bars
      ctx.fillStyle = barFilled
        ? `rgba(100, 255, 100, ${0.4 + i * 0.06})`
        : 'rgba(100, 255, 100, 0.05)'
      ctx.fillRect(meterX + i * 9, meterY + 6 + (15 - barH), 6, barH)
    }

    // --- FREQUENCY BAND VISUALIZATION ---
    const bandY = panelY + 70
    const bandH = 60

    // Band background
    ctx.fillStyle = 'rgba(10, 20, 10, 0.5)'
    ctx.fillRect(panelX, bandY, panelW, bandH)
    ctx.strokeStyle = 'rgba(100, 255, 100, 0.1)'
    ctx.lineWidth = 0.5
    ctx.strokeRect(panelX, bandY, panelW, bandH)

    // Frequency ticks
    for (let f = 88; f <= 108; f += 2) {
      const x = panelX + ((f - 88) / 20) * panelW
      ctx.strokeStyle = 'rgba(100, 255, 100, 0.15)'
      ctx.beginPath()
      ctx.moveTo(x, bandY)
      ctx.lineTo(x, bandY + bandH)
      ctx.stroke()

      ctx.font = '8px monospace'
      ctx.fillStyle = 'rgba(100, 255, 100, 0.2)'
      ctx.textAlign = 'center'
      ctx.fillText(String(f), x, bandY + bandH + 12)
    }

    // Station markers on the band
    for (const s of stations) {
      const x = panelX + ((s.frequency - 88) / 20) * panelW
      const health = 1 - s.memory.degradation
      const barHeight = health * bandH * 0.8

      // Station signal bar
      ctx.fillStyle = `rgba(100, 255, 100, ${0.05 + health * 0.15})`
      ctx.fillRect(x - 1, bandY + bandH - barHeight, 3, barHeight)

      // Highlight if near current frequency
      const dist = Math.abs(frequency - s.frequency)
      if (dist < s.bandwidth) {
        ctx.fillStyle = `rgba(100, 255, 100, ${0.1 * (1 - dist / s.bandwidth)})`
        const glowW = s.bandwidth / 20 * panelW
        ctx.fillRect(x - glowW / 2, bandY, glowW, bandH)
      }
    }

    // Current frequency needle
    const needleX = panelX + ((frequency - 88) / 20) * panelW
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.6)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(needleX, bandY - 5)
    ctx.lineTo(needleX, bandY + bandH + 5)
    ctx.stroke()

    // Needle glow
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.15)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(needleX, bandY)
    ctx.lineTo(needleX, bandY + bandH)
    ctx.stroke()

    // --- TUNING DIAL ---
    const dialY = bandY + bandH + 40
    const dialW = panelW * 0.8
    const dialX = panelX + (panelW - dialW) / 2

    // Dial track
    ctx.fillStyle = 'rgba(30, 40, 30, 0.5)'
    ctx.fillRect(dialX, dialY, dialW, 8)
    ctx.strokeStyle = 'rgba(100, 255, 100, 0.1)'
    ctx.lineWidth = 0.5
    ctx.strokeRect(dialX, dialY, dialW, 8)

    // Dial thumb
    const thumbX = dialX + ((frequency - 88) / 20) * dialW
    ctx.beginPath()
    ctx.arc(thumbX, dialY + 4, 10, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(100, 255, 100, 0.3)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(100, 255, 100, 0.5)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Notch on thumb
    ctx.beginPath()
    ctx.moveTo(thumbX, dialY - 2)
    ctx.lineTo(thumbX, dialY + 10)
    ctx.strokeStyle = 'rgba(100, 255, 100, 0.4)'
    ctx.stroke()

    // --- MEMORY TEXT DISPLAY ---
    const textY = dialY + 60
    const textAreaH = h - textY - 60

    if (currentStation && signalStrength > 0.2) {
      const mem = currentStation.memory
      const health = 1 - mem.degradation
      const clarity = signalStrength * health

      // Station label
      ctx.font = '10px monospace'
      ctx.fillStyle = `rgba(100, 255, 100, ${clarity * 0.3})`
      ctx.textAlign = 'center'
      ctx.fillText(
        `station ${currentStation.frequency.toFixed(1)} — signal ${Math.floor(signalStrength * 100)}%`,
        w / 2, textY
      )

      // Memory text — clarity affects visibility
      const text = mem.currentText
      const lines = wrapText(text, 50)
      ctx.font = '14px "Cormorant Garamond", serif'
      ctx.textAlign = 'center'

      for (let i = 0; i < lines.length; i++) {
        const lineY = textY + 30 + i * 22
        if (lineY > textY + textAreaH) break

        // Each character rendered individually with noise
        const line = lines[i]
        const lineW = line.length * 8
        const startX = w / 2 - lineW / 2

        for (let j = 0; j < line.length; j++) {
          const charClarity = clarity * (0.7 + Math.sin(time * 3 + j * 0.5) * 0.3)
          if (Math.random() > charClarity && clarity < 0.8) continue // static dropout

          const charX = startX + j * 8
          const jitter = (1 - clarity) * 2
          ctx.fillStyle = `rgba(100, 255, 100, ${charClarity * 0.7})`
          ctx.fillText(
            line[j],
            charX + (Math.random() - 0.5) * jitter,
            lineY + (Math.random() - 0.5) * jitter
          )
        }
      }

      // Time info
      const age = Math.floor((Date.now() - mem.timestamp) / (1000 * 60 * 60 * 24))
      ctx.font = '9px monospace'
      ctx.fillStyle = `rgba(100, 255, 100, ${clarity * 0.15})`
      ctx.textAlign = 'center'
      ctx.fillText(
        `${age}d old · ${Math.floor(mem.degradation * 100)}% degraded`,
        w / 2, textY + 30 + Math.min(lines.length, 4) * 22 + 20
      )
    } else {
      // No signal — show noise text
      ctx.font = '11px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(100, 255, 100, ${0.08 + Math.sin(time * 2) * 0.03})`
      ctx.textAlign = 'center'

      if (stations.length === 0) {
        ctx.fillText('no stations broadcasting. the airwaves are empty.', w / 2, textY + 40)
        ctx.fillText('feed the void your memories first.', w / 2, textY + 60)
      } else {
        const noiseTexts = ['...', '▓▒░', '~~~', '···', '---']
        ctx.fillText(
          noiseTexts[Math.floor(time * 2) % noiseTexts.length],
          w / 2, textY + 40
        )
      }
    }

    // Title
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(100, 255, 100, ${0.1 + Math.sin(time * 0.3) * 0.03})`
    ctx.textAlign = 'center'
    ctx.fillText('the radio', w / 2, 30)

    // Hint
    ctx.font = '9px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(100, 255, 100, 0.06)'
    ctx.fillText('drag the dial to tune · memories broadcast on different frequencies', w / 2, h - 20)
  }

  function wrapText(text: string, maxChars: number): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let current = ''

    for (const word of words) {
      if ((current + ' ' + word).length > maxChars) {
        if (current) lines.push(current)
        current = word
      } else {
        current = current ? current + ' ' + word : word
      }
    }
    if (current) lines.push(current)
    return lines
  }

  function handleDrag(clientX: number) {
    if (!canvas) return
    const w = canvas.width
    const panelX = w * 0.15
    const panelW = w * 0.7
    const dialW = panelW * 0.8
    const dialX = panelX + (panelW - dialW) / 2

    const normalized = (clientX - dialX) / dialW
    frequency = Math.max(88, Math.min(108, 88 + normalized * 20))
  }

  return {
    name: 'radio',
    label: 'the radio',

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        width: 100%; height: 100%;
        pointer-events: auto;
        background: #000;
        cursor: pointer;
      `

      canvas = document.createElement('canvas')
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      canvas.style.cssText = 'width: 100%; height: 100%;'
      ctx = canvas.getContext('2d')

      // Mouse/touch events for dial
      canvas.addEventListener('mousedown', (e) => {
        isDragging = true
        handleDrag(e.clientX)
        initAudio()
      })
      canvas.addEventListener('mousemove', (e) => {
        if (isDragging) handleDrag(e.clientX)
      })
      canvas.addEventListener('mouseup', () => { isDragging = false })
      canvas.addEventListener('mouseleave', () => { isDragging = false })

      // Touch support
      canvas.addEventListener('touchstart', (e) => {
        isDragging = true
        handleDrag(e.touches[0].clientX)
        initAudio()
        e.preventDefault()
      }, { passive: false })
      canvas.addEventListener('touchmove', (e) => {
        if (isDragging) handleDrag(e.touches[0].clientX)
        e.preventDefault()
      }, { passive: false })
      canvas.addEventListener('touchend', () => { isDragging = false })

      // Scroll to fine-tune
      canvas.addEventListener('wheel', (e) => {
        frequency = Math.max(88, Math.min(108, frequency + e.deltaY * 0.01))
        e.preventDefault()
        initAudio()
      }, { passive: false })

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
      staticLines = []
      buildStations()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      // Fade out audio
      if (noiseGain) noiseGain.gain.value = 0
      if (toneGain) toneGain.gain.value = 0
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      if (noiseNode) { try { noiseNode.stop() } catch {} }
      if (toneOsc) { try { toneOsc.stop() } catch {} }
      overlay?.remove()
    },
  }
}
