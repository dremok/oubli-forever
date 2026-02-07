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

    ctx.clearRect(0, 0, w, h)

    // Draw waveform
    const sliceWidth = w / waveformData.length
    let x = 0

    ctx.beginPath()
    for (let i = 0; i < waveformData.length; i++) {
      const v = waveformData[i] / 128.0
      const y = (v * h) / 2

      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
      x += sliceWidth
    }

    // Note flash decays
    const alpha = 0.15 + noteFlash * 0.6
    noteFlash *= 0.95

    ctx.strokeStyle = `hsla(${lastNoteHue}, 70%, 65%, ${alpha})`
    ctx.lineWidth = 1.5
    ctx.stroke()

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
        font-size: 11px;
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
        font-weight: 300; font-size: 11px;
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
          font-size: 11px;
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

      // In-room portals: sound-themed connections
      if (instrumentDeps.switchTo) {
        const portalData = [
          { name: 'choir', symbol: '\uD83C\uDFB6', hint: 'the choir', color: '180, 140, 200', pos: 'top: 24px; left: 24px;' },
          { name: 'radio', symbol: '\uD83D\uDCE1', hint: 'the radio', color: '120, 200, 120', pos: 'top: 24px; right: 24px;' },
          { name: 'pendulum', symbol: '\u2384', hint: 'the pendulum', color: '200, 200, 140', pos: 'bottom: 60px; right: 24px;' },
          { name: 'void', symbol: '\u25C6', hint: 'the void', color: '255, 20, 147', pos: 'bottom: 60px; left: 24px;' },
        ]
        for (const p of portalData) {
          const el = document.createElement('div')
          el.style.cssText = `
            position: absolute; ${p.pos}
            pointer-events: auto; cursor: pointer;
            font-family: 'Cormorant Garamond', serif;
            font-weight: 300; font-size: 10px;
            letter-spacing: 2px; text-transform: lowercase;
            color: rgba(${p.color}, 0.06);
            transition: color 0.5s ease, text-shadow 0.5s ease;
            padding: 8px; z-index: 10;
          `
          el.innerHTML = `<span style="font-size:14px; display:block; margin-bottom:2px;">${p.symbol}</span><span style="font-style:italic;">${p.hint}</span>`
          el.addEventListener('mouseenter', () => {
            el.style.color = `rgba(${p.color}, 0.5)`
            el.style.textShadow = `0 0 15px rgba(${p.color}, 0.2)`
          })
          el.addEventListener('mouseleave', () => {
            el.style.color = `rgba(${p.color}, 0.06)`
            el.style.textShadow = 'none'
          })
          el.addEventListener('click', (e) => {
            e.stopPropagation()
            instrumentDeps.switchTo!(p.name)
          })
          overlay.appendChild(el)
        }
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
