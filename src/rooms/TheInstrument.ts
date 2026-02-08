/**
 * THE INSTRUMENT — the void becomes something you play
 *
 * A full synthesizer mapped to the keyboard. Two octaves of keys,
 * mouse controls filter and reverb, a delay loop records and
 * echoes your phrases. A waveform visualizer breathes in the center.
 *
 * This is not ambient background music — this is active creation.
 * The particle void pulses and shifts color with every note you play.
 * Your music is ephemeral — there's no save, no export. Play it,
 * hear it, let it dissolve.
 *
 * Key mapping (two octaves, chromatic):
 *   Lower: a w s e d f t g y h u j
 *   Upper: k o l p ; [ '
 *
 * Mouse Y → filter cutoff
 * Mouse X → delay feedback
 *
 * Inspired by: Moog synthesizers, Pocket Operator, the Theremin,
 * the idea that every instrument is also a forgetting machine
 */

import type { Room } from './RoomManager'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

// Chromatic note mapping — two octaves starting from C3
const KEY_MAP: Record<string, number> = {
  // Lower octave: C3 to B3
  'a': 0, 'w': 1, 's': 2, 'e': 3, 'd': 4,
  'f': 5, 't': 6, 'g': 7, 'y': 8, 'h': 9, 'u': 10, 'j': 11,
  // Upper octave: C4 to E4
  'k': 12, 'o': 13, 'l': 14, 'p': 15, ';': 16, '[': 17, "'": 18,
}

const BASE_FREQ = 130.81 // C3

interface ActiveNote {
  key: string
  osc: OscillatorNode
  osc2: OscillatorNode
  env: GainNode
  freq: number
}

interface InstrumentDeps {
  onNote?: (freq: number, velocity: number) => void
  switchTo?: (name: string) => void
}

export function createInstrumentRoom(onNoteOrDeps?: ((freq: number, velocity: number) => void) | InstrumentDeps): Room {
  const instrumentDeps: InstrumentDeps = typeof onNoteOrDeps === 'function'
    ? { onNote: onNoteOrDeps }
    : (onNoteOrDeps ?? {})
  const onNote = instrumentDeps.onNote
  let overlay: HTMLElement | null = null
  let audioCtx: AudioContext | null = null
  let masterGain: GainNode | null = null
  let filterNode: BiquadFilterNode | null = null
  let delayNode: DelayNode | null = null
  let feedbackGain: GainNode | null = null
  let reverbNode: ConvolverNode | null = null
  let analyser: AnalyserNode | null = null
  let waveCanvas: HTMLCanvasElement | null = null
  let waveCtx: CanvasRenderingContext2D | null = null
  let activeNotes = new Map<string, ActiveNote>()
  let animFrameId = 0
  let active = false
  let waveformData: Uint8Array<ArrayBuffer> | null = null

  // Synth parameters
  let filterCutoff = 2000
  let delayFeedback = 0.3
  let waveType: OscillatorType = 'sawtooth'
  let detune = 7

  // Visual state
  let noteFlash = 0
  let lastNoteHue = 0

  // Portal band state — frequency zones on the waveform canvas
  const portalBands = [
    { name: 'choir', label: 'the choir', freqRange: [0, 0.25] as [number, number], hue: 280, hoverGlow: 0 },
    { name: 'radio', label: 'the radio', freqRange: [0.25, 0.5] as [number, number], hue: 120, hoverGlow: 0 },
    { name: 'pendulum', label: 'the pendulum', freqRange: [0.5, 0.75] as [number, number], hue: 45, hoverGlow: 0 },
    { name: 'void', label: 'the void', freqRange: [0.75, 1.0] as [number, number], hue: 320, hoverGlow: 0 },
  ]
  let hoveredBand = -1
  let clickedBand = -1
  let clickTime = 0

  function semitoneToFreq(semitone: number): number {
    return BASE_FREQ * Math.pow(2, semitone / 12)
  }

  async function initAudio() {
    if (audioCtx) return

    audioCtx = await getAudioContext()

    // Master gain
    masterGain = audioCtx.createGain()
    masterGain.gain.value = 0.25

    // Analyser for waveform
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048
    waveformData = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>

    // Filter
    filterNode = audioCtx.createBiquadFilter()
    filterNode.type = 'lowpass'
    filterNode.frequency.value = filterCutoff
    filterNode.Q.value = 4

    // Delay with feedback
    delayNode = audioCtx.createDelay(2.0)
    delayNode.delayTime.value = 0.375 // dotted eighth

    feedbackGain = audioCtx.createGain()
    feedbackGain.gain.value = delayFeedback

    // Reverb
    reverbNode = createReverb(audioCtx)

    // Signal chain: filter → analyser → master → destination
    //                    ↓
    //              delay → feedback → filter (loop)
    //                    ↓
    //              reverb → master
    const dryGain = audioCtx.createGain()
    dryGain.gain.value = 0.6
    const wetGain = audioCtx.createGain()
    wetGain.gain.value = 0.4

    filterNode.connect(analyser)
    analyser.connect(dryGain)
    dryGain.connect(masterGain)

    filterNode.connect(delayNode)
    delayNode.connect(feedbackGain)
    feedbackGain.connect(filterNode) // feedback loop

    delayNode.connect(reverbNode)
    reverbNode.connect(wetGain)
    wetGain.connect(masterGain)

    masterGain.connect(getAudioDestination())
  }

  function createReverb(ctx: AudioContext): ConvolverNode {
    const length = ctx.sampleRate * 4
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch)
      for (let i = 0; i < length; i++) {
        const t = i / length
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.5) * 0.4
      }
    }
    const conv = ctx.createConvolver()
    conv.buffer = impulse
    return conv
  }

  function noteOn(key: string) {
    if (!audioCtx || !filterNode || activeNotes.has(key)) return
    const semitone = KEY_MAP[key]
    if (semitone === undefined) return

    const freq = semitoneToFreq(semitone)
    const now = audioCtx.currentTime

    // Envelope
    const env = audioCtx.createGain()
    env.gain.setValueAtTime(0, now)
    env.gain.linearRampToValueAtTime(0.35, now + 0.01)
    env.gain.setTargetAtTime(0.2, now + 0.01, 0.3)

    // Main oscillator
    const osc = audioCtx.createOscillator()
    osc.type = waveType
    osc.frequency.value = freq

    // Detuned second oscillator for thickness
    const osc2 = audioCtx.createOscillator()
    osc2.type = waveType === 'sawtooth' ? 'square' : 'triangle'
    osc2.frequency.value = freq
    osc2.detune.value = detune

    const osc2gain = audioCtx.createGain()
    osc2gain.gain.value = 0.15

    osc.connect(env)
    osc2.connect(osc2gain)
    osc2gain.connect(env)
    env.connect(filterNode)

    osc.start(now)
    osc2.start(now)

    activeNotes.set(key, { key, osc, osc2, env, freq })

    // Notify external systems
    onNote?.(freq, 0.35)

    // Visual feedback
    noteFlash = 1.0
    lastNoteHue = (semitone % 12) / 12 * 360
  }

  function noteOff(key: string) {
    const note = activeNotes.get(key)
    if (!note || !audioCtx) return

    const now = audioCtx.currentTime
    note.env.gain.cancelScheduledValues(now)
    note.env.gain.setValueAtTime(note.env.gain.value, now)
    note.env.gain.linearRampToValueAtTime(0.001, now + 0.3)

    // Clean up after release
    setTimeout(() => {
      note.osc.stop()
      note.osc2.stop()
    }, 400)

    activeNotes.delete(key)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!active) return
    const key = e.key.toLowerCase()
    if (KEY_MAP[key] !== undefined) {
      e.preventDefault()
      e.stopPropagation()
      noteOn(key)
    }
    // Right-click to cycle wave type
    if (key === '`') {
      cycleWaveType()
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (!active) return
    const key = e.key.toLowerCase()
    if (KEY_MAP[key] !== undefined) {
      e.preventDefault()
      noteOff(key)
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (!active || !filterNode || !feedbackGain || !audioCtx) return
    // Y → filter cutoff (top = open, bottom = closed)
    const yRatio = 1 - (e.clientY / window.innerHeight)
    filterCutoff = 200 + yRatio * yRatio * 8000
    filterNode.frequency.linearRampToValueAtTime(filterCutoff, audioCtx.currentTime + 0.1)

    // X → delay feedback (left = dry, right = echoing)
    const xRatio = e.clientX / window.innerWidth
    delayFeedback = xRatio * 0.75
    feedbackGain.gain.linearRampToValueAtTime(delayFeedback, audioCtx.currentTime + 0.1)
  }

  let waveButtons: HTMLElement[] = []
  const WAVE_TYPES: OscillatorType[] = ['sawtooth', 'square', 'triangle', 'sine']

  function cycleWaveType() {
    const idx = WAVE_TYPES.indexOf(waveType)
    waveType = WAVE_TYPES[(idx + 1) % WAVE_TYPES.length]
    updateWaveButtons()
  }

  function updateWaveButtons() {
    for (const btn of waveButtons) {
      const isActive = btn.dataset.wave === waveType
      btn.style.color = isActive ? 'rgba(255, 20, 147, 0.8)' : 'rgba(255, 255, 255, 0.15)'
      btn.style.borderColor = isActive ? 'rgba(255, 20, 147, 0.4)' : 'rgba(255, 255, 255, 0.08)'
    }
  }

  function renderWaveform() {
    if (!waveCanvas || !waveCtx || !analyser || !waveformData) return

    analyser.getByteTimeDomainData(waveformData)

    const w = waveCanvas.width
    const h = waveCanvas.height
    const ctx = waveCtx
    const bandBarH = 15

    ctx.clearRect(0, 0, w, h)

    // --- Portal frequency band bars at the bottom of the canvas ---
    for (let bi = 0; bi < portalBands.length; bi++) {
      const band = portalBands[bi]
      const x0 = Math.floor(band.freqRange[0] * w)
      const x1 = Math.floor(band.freqRange[1] * w)
      const bw = x1 - x0

      // Interpolate hover glow toward target
      const target = bi === hoveredBand ? 1 : 0
      band.hoverGlow += (target - band.hoverGlow) * 0.12

      // Flash white on click
      const isClicked = bi === clickedBand
      const clickElapsed = clickTime ? (performance.now() - clickTime) / 1000 : 1
      const clickFlash = isClicked ? Math.max(0, 1 - clickElapsed / 0.3) : 0

      // Bar background
      const baseAlpha = 0.04 + band.hoverGlow * 0.18 + clickFlash * 0.6
      if (clickFlash > 0) {
        const r = Math.round(255 * clickFlash + (1 - clickFlash) * 128)
        const g = Math.round(255 * clickFlash + (1 - clickFlash) * 128)
        const b = Math.round(255 * clickFlash + (1 - clickFlash) * 128)
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${baseAlpha})`
      } else {
        ctx.fillStyle = `hsla(${band.hue}, 60%, 55%, ${baseAlpha})`
      }
      ctx.fillRect(x0, h - bandBarH, bw, bandBarH)

      // Top edge line of the bar
      const edgeAlpha = 0.06 + band.hoverGlow * 0.35
      ctx.beginPath()
      ctx.moveTo(x0, h - bandBarH)
      ctx.lineTo(x1, h - bandBarH)
      ctx.strokeStyle = `hsla(${band.hue}, 60%, 65%, ${edgeAlpha})`
      ctx.lineWidth = 0.5
      ctx.stroke()

      // Vertical separator between bands (except first)
      if (bi > 0) {
        ctx.beginPath()
        ctx.moveTo(x0, h - bandBarH)
        ctx.lineTo(x0, h)
        ctx.strokeStyle = `rgba(255, 255, 255, 0.04)`
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      // Label on hover
      if (band.hoverGlow > 0.05) {
        const labelAlpha = band.hoverGlow * 0.7
        ctx.font = '12px "Cormorant Garamond", serif'
        ctx.textAlign = 'center'
        ctx.fillStyle = `hsla(${band.hue}, 50%, 75%, ${labelAlpha})`
        ctx.fillText(band.label, x0 + bw / 2, h - bandBarH - 6)
      }
    }

    // --- Handle delayed navigation on click ---
    if (clickedBand >= 0 && clickTime) {
      const elapsed = (performance.now() - clickTime) / 1000
      if (elapsed >= 0.3 && instrumentDeps.switchTo) {
        const dest = portalBands[clickedBand].name
        clickedBand = -1
        clickTime = 0
        instrumentDeps.switchTo(dest)
        return // stop rendering, we're navigating away
      }
    }

    // --- Draw waveform with per-band tinting ---
    const sliceWidth = w / waveformData.length

    // Note flash decays
    const alpha = 0.15 + noteFlash * 0.6
    noteFlash *= 0.95

    if (hoveredBand >= 0) {
      // Draw waveform in segments, tinting the hovered band's region
      for (let bi = 0; bi < portalBands.length; bi++) {
        const band = portalBands[bi]
        const startX = Math.floor(band.freqRange[0] * w)
        const endX = Math.floor(band.freqRange[1] * w)

        ctx.save()
        ctx.beginPath()
        ctx.rect(startX, 0, endX - startX, h)
        ctx.clip()

        ctx.beginPath()
        let x = 0
        for (let i = 0; i < waveformData.length; i++) {
          const v = waveformData[i] / 128.0
          const y = (v * h) / 2
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
          x += sliceWidth
        }

        if (bi === hoveredBand) {
          // Tint the waveform in this zone with the portal's color
          const tintAlpha = alpha + band.hoverGlow * 0.3
          ctx.strokeStyle = `hsla(${band.hue}, 80%, 65%, ${tintAlpha})`
          ctx.lineWidth = 2
        } else {
          ctx.strokeStyle = `hsla(${lastNoteHue}, 70%, 65%, ${alpha})`
          ctx.lineWidth = 1.5
        }
        ctx.stroke()
        ctx.restore()
      }
    } else {
      // No hover — draw waveform normally
      let x = 0
      ctx.beginPath()
      for (let i = 0; i < waveformData.length; i++) {
        const v = waveformData[i] / 128.0
        const y = (v * h) / 2
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += sliceWidth
      }
      ctx.strokeStyle = `hsla(${lastNoteHue}, 70%, 65%, ${alpha})`
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // Soft glow line at center
    ctx.beginPath()
    ctx.moveTo(0, h / 2)
    ctx.lineTo(w, h / 2)
    ctx.strokeStyle = `rgba(255, 20, 147, 0.05)`
    ctx.lineWidth = 0.5
    ctx.stroke()
  }

  function animate() {
    if (!active) return
    animFrameId = requestAnimationFrame(animate)
    renderWaveform()
  }

  return {
    name: 'instrument',
    label: 'the instrument',

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        height: 100%;
        pointer-events: auto;
        background: rgba(2, 1, 8, 0.7);
      `

      // Title
      const title = document.createElement('div')
      title.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 14px;
        color: rgba(255, 20, 147, 0.3);
        letter-spacing: 4px;
        margin-bottom: 32px;
        text-transform: lowercase;
      `
      title.textContent = 'play the void'
      overlay.appendChild(title)

      // Waveform canvas
      waveCanvas = document.createElement('canvas')
      waveCanvas.width = 600
      waveCanvas.height = 200
      waveCanvas.style.cssText = `
        width: 560px; max-width: 90vw;
        height: 180px;
        border: 1px solid rgba(255, 20, 147, 0.08);
        border-radius: 2px;
        margin-bottom: 24px;
      `
      waveCtx = waveCanvas.getContext('2d')!
      overlay.appendChild(waveCanvas)

      // Keyboard hint
      const hint = document.createElement('div')
      hint.style.cssText = `
        font-family: monospace;
        font-size: 13px;
        color: rgba(255, 215, 0, 0.2);
        letter-spacing: 2px;
        margin-bottom: 8px;
        text-align: center;
        max-width: 500px;
        line-height: 2;
      `
      hint.innerHTML = `
        <span style="color: rgba(255, 20, 147, 0.35);">keys</span>
        a w s e d f t g y h u j · k o l p ; [ '
        <br>
        <span style="color: rgba(255, 20, 147, 0.35);">mouse</span>
        ↕ filter · ↔ echo
      `
      overlay.appendChild(hint)

      // Wave type selector — clickable buttons
      const waveRow = document.createElement('div')
      waveRow.style.cssText = `
        display: flex; align-items: center; gap: 8px;
        margin-top: 16px;
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 13px;
        color: rgba(255, 255, 255, 0.15);
        letter-spacing: 1px;
      `
      const waveLabel = document.createElement('span')
      waveLabel.textContent = 'wave'
      waveLabel.style.cssText = 'margin-right: 4px;'
      waveRow.appendChild(waveLabel)

      waveButtons = []
      for (const type of WAVE_TYPES) {
        const btn = document.createElement('button')
        btn.dataset.wave = type
        btn.textContent = type
        btn.style.cssText = `
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 2px;
          color: rgba(255, 255, 255, 0.15);
          font-family: monospace;
          font-size: 13px;
          padding: 4px 10px;
          cursor: pointer;
          transition: color 0.3s ease, border-color 0.3s ease;
          letter-spacing: 1px;
        `
        btn.addEventListener('click', () => {
          waveType = type as OscillatorType
          updateWaveButtons()
        })
        btn.addEventListener('mouseenter', () => {
          if (btn.dataset.wave !== waveType) {
            btn.style.color = 'rgba(255, 215, 0, 0.4)'
          }
        })
        btn.addEventListener('mouseleave', () => {
          updateWaveButtons()
        })
        waveRow.appendChild(btn)
        waveButtons.push(btn)
      }

      overlay.appendChild(waveRow)
      updateWaveButtons()

      // Canvas-based portal band interaction
      if (instrumentDeps.switchTo) {
        waveCanvas.style.cursor = 'default'

        waveCanvas.addEventListener('mousemove', (e) => {
          const rect = waveCanvas!.getBoundingClientRect()
          const scaleX = waveCanvas!.width / rect.width
          const scaleY = waveCanvas!.height / rect.height
          const cx = (e.clientX - rect.left) * scaleX
          const cy = (e.clientY - rect.top) * scaleY
          const bandBarH = 15
          const h = waveCanvas!.height
          const w = waveCanvas!.width

          if (cy >= h - bandBarH) {
            // In the bar region — find which band
            const ratio = cx / w
            let found = -1
            for (let i = 0; i < portalBands.length; i++) {
              if (ratio >= portalBands[i].freqRange[0] && ratio < portalBands[i].freqRange[1]) {
                found = i
                break
              }
            }
            hoveredBand = found
            waveCanvas!.style.cursor = found >= 0 ? 'pointer' : 'default'
          } else {
            hoveredBand = -1
            waveCanvas!.style.cursor = 'default'
          }
        })

        waveCanvas.addEventListener('mouseleave', () => {
          hoveredBand = -1
          waveCanvas!.style.cursor = 'default'
        })

        waveCanvas.addEventListener('click', (e) => {
          if (hoveredBand >= 0 && clickedBand < 0) {
            clickedBand = hoveredBand
            clickTime = performance.now()
            e.stopPropagation()
          }
        })
      }

      return overlay
    },

    async activate() {
      active = true
      await initAudio()
      window.addEventListener('keydown', handleKeyDown, true)
      window.addEventListener('keyup', handleKeyUp, true)
      window.addEventListener('mousemove', handleMouseMove)
      animate()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(animFrameId)
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      window.removeEventListener('mousemove', handleMouseMove)
      // Release all held notes
      for (const key of activeNotes.keys()) {
        noteOff(key)
      }
    },

    destroy() {
      active = false
      cancelAnimationFrame(animFrameId)
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      window.removeEventListener('mousemove', handleMouseMove)
      for (const key of activeNotes.keys()) {
        noteOff(key)
      }
      overlay?.remove()
    },
  }
}
