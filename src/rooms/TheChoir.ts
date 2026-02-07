/**
 * THE CHOIR — voices in the dark
 *
 * Generative choral music. Multiple oscillators simulate singing voices,
 * each with vibrato, vowel formants, and slow harmonic drift.
 * Click to place a new voice in space. Each voice has a pitch
 * determined by its vertical position and a timbre from its horizontal.
 *
 * Voices slowly fade over time. The choir is always changing.
 * At any moment it might be a single voice or a wall of sound.
 *
 * No memories. Pure generative music and spatial interaction.
 *
 * Inspired by: Gregorian chant, Arvo Pärt's tintinnabuli,
 * Pauline Oliveros' deep listening, throat singing,
 * the sound of wind through architecture, how voices
 * combine to create something none of them contain alone
 */

import type { Room } from './RoomManager'
import { getAudioContext } from '../sound/AudioBus'

interface Voice {
  x: number
  y: number
  freq: number
  osc: OscillatorNode | null
  gain: GainNode | null
  vibrato: OscillatorNode | null
  filter: BiquadFilterNode | null
  birth: number
  life: number // max life in seconds
  alpha: number
}

export function createChoirRoom(): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let voices: Voice[] = []
  let audioCtx: AudioContext | null = null
  let masterGain: GainNode | null = null
  let reverb: ConvolverNode | null = null
  let totalVoices = 0

  // Create a simple reverb impulse response
  function createReverbIR(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
    const length = ctx.sampleRate * duration
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch)
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
      }
    }
    return buffer
  }

  async function initAudio() {
    try {
      audioCtx = await getAudioContext()
      masterGain = audioCtx.createGain()
      masterGain.gain.value = 0.15

      // Reverb for cathedral-like space
      reverb = audioCtx.createConvolver()
      reverb.buffer = createReverbIR(audioCtx, 4, 2)

      const reverbGain = audioCtx.createGain()
      reverbGain.gain.value = 0.5

      masterGain.connect(audioCtx.destination)
      masterGain.connect(reverb)
      reverb.connect(reverbGain)
      reverbGain.connect(audioCtx.destination)
    } catch {
      // Audio not available
    }
  }

  function addVoice(x: number, y: number) {
    if (!audioCtx || !masterGain || !canvas) return

    const w = canvas.width
    const h = canvas.height

    // Y → pitch (top = high, bottom = low)
    // Use a pentatonic-ish scale for harmony
    const pitchRatio = 1 - y / h
    const baseFreq = 110 // A2
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24] // pentatonic over 2 octaves
    const noteIndex = Math.floor(pitchRatio * scale.length)
    const semitone = scale[Math.min(noteIndex, scale.length - 1)]
    const freq = baseFreq * Math.pow(2, semitone / 12)

    // X → timbre (left = dark/warm, right = bright/nasal)
    const brightness = x / w

    try {
      // Main oscillator (triangle for voice-like quality)
      const osc = audioCtx.createOscillator()
      osc.type = brightness < 0.3 ? 'sine' : brightness < 0.7 ? 'triangle' : 'sawtooth'
      osc.frequency.value = freq

      // Vibrato
      const vibrato = audioCtx.createOscillator()
      vibrato.frequency.value = 4.5 + Math.random() * 2 // 4.5-6.5 Hz
      const vibratoGain = audioCtx.createGain()
      vibratoGain.gain.value = freq * 0.008 // subtle pitch wobble
      vibrato.connect(vibratoGain)
      vibratoGain.connect(osc.frequency)

      // Formant filter (simulates vowel)
      const filter = audioCtx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 300 + brightness * 2000 // 300-2300 Hz
      filter.Q.value = 2 + brightness * 4

      // Gain envelope
      const gain = audioCtx.createGain()
      gain.gain.value = 0

      // Fade in
      const now = audioCtx.currentTime
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.3, now + 2)

      // Connect
      osc.connect(filter)
      filter.connect(gain)
      gain.connect(masterGain)

      osc.start()
      vibrato.start()

      const life = 15 + Math.random() * 20 // 15-35 seconds

      voices.push({
        x, y, freq,
        osc, gain, vibrato, filter,
        birth: time,
        life,
        alpha: 0,
      })

      totalVoices++

      // Schedule fade out
      gain.gain.setValueAtTime(0.3, now + life - 3)
      gain.gain.linearRampToValueAtTime(0, now + life)

      // Stop after fade
      setTimeout(() => {
        try {
          osc.stop()
          vibrato.stop()
        } catch {}
      }, life * 1000 + 500)
    } catch {
      // Audio error
    }
  }

  function removeDeadVoices() {
    voices = voices.filter(v => {
      const age = time - v.birth
      if (age > v.life) {
        try {
          v.osc?.disconnect()
          v.gain?.disconnect()
          v.vibrato?.disconnect()
          v.filter?.disconnect()
        } catch {}
        return false
      }
      return true
    })
  }

  // Seed some initial voices
  function seedVoices() {
    if (!canvas) return
    const w = canvas.width
    const h = canvas.height
    // 3 initial voices
    addVoice(w * 0.3, h * 0.5)
    addVoice(w * 0.5, h * 0.35)
    addVoice(w * 0.7, h * 0.6)
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    removeDeadVoices()

    const w = canvas.width
    const h = canvas.height

    // Background — cathedral dark
    ctx.fillStyle = 'rgba(3, 2, 8, 1)'
    ctx.fillRect(0, 0, w, h)

    // Draw voices
    for (const v of voices) {
      const age = time - v.birth
      const lifeRatio = age / v.life

      // Fade in/out
      if (age < 2) {
        v.alpha = age / 2
      } else if (lifeRatio > 0.8) {
        v.alpha = (1 - lifeRatio) / 0.2
      } else {
        v.alpha = 1
      }

      const breathe = Math.sin(time * 1.2 + v.x * 0.01) * 0.1

      // Voice visualization — concentric rings
      const maxRadius = 30 + v.freq * 0.05
      for (let ring = 0; ring < 3; ring++) {
        const radius = maxRadius * (0.3 + ring * 0.35)
        const ringPhase = Math.sin(time * 2 + ring * 2 + v.x * 0.01)
        const ringAlpha = v.alpha * (0.05 + breathe) * (1 - ring * 0.25)

        ctx.strokeStyle = `rgba(200, 180, 255, ${ringAlpha})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(v.x, v.y, radius + ringPhase * 3, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Core glow
      const glow = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, 15)
      glow.addColorStop(0, `rgba(200, 180, 255, ${v.alpha * 0.2})`)
      glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(v.x, v.y, 15, 0, Math.PI * 2)
      ctx.fill()

      // Center dot
      ctx.fillStyle = `rgba(220, 200, 255, ${v.alpha * 0.4})`
      ctx.beginPath()
      ctx.arc(v.x, v.y, 3, 0, Math.PI * 2)
      ctx.fill()

      // Note label (very faint)
      ctx.font = '8px monospace'
      ctx.fillStyle = `rgba(200, 180, 255, ${v.alpha * 0.06})`
      ctx.textAlign = 'center'
      ctx.fillText(`${v.freq.toFixed(0)}Hz`, v.x, v.y + 22)
    }

    // Auto-add voices occasionally to keep the choir alive
    if (voices.length < 2 && Math.random() < 0.005) {
      addVoice(
        w * 0.2 + Math.random() * w * 0.6,
        h * 0.2 + Math.random() * h * 0.6,
      )
    }

    // Title
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 180, 255, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the choir', w / 2, 25)

    // Stats
    ctx.font = '9px monospace'
    ctx.fillStyle = 'rgba(200, 180, 255, 0.06)'
    ctx.textAlign = 'left'
    ctx.fillText(`${voices.length} voices`, 12, h - 30)
    ctx.fillText(`${totalVoices} total`, 12, h - 18)

    // Pitch guide (very faint)
    ctx.textAlign = 'right'
    ctx.fillText('high ↑', w - 12, h * 0.15)
    ctx.fillText('low ↓', w - 12, h * 0.85)
    ctx.fillText('← warm · bright →', w - 12, h - 18)

    // Hint
    ctx.font = '9px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(200, 180, 255, 0.04)'
    ctx.textAlign = 'center'
    ctx.fillText('click to add a voice · position determines pitch and timbre', w / 2, h - 8)
  }

  return {
    name: 'choir',
    label: 'the choir',

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
      canvas.style.cssText = 'width: 100%; height: 100%; cursor: pointer;'
      ctx = canvas.getContext('2d')

      canvas.addEventListener('click', (e) => {
        addVoice(e.clientX, e.clientY)
      })

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)
      return overlay
    },

    async activate() {
      active = true
      await initAudio()
      seedVoices()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      // Stop all voices
      for (const v of voices) {
        try {
          v.osc?.stop()
          v.vibrato?.stop()
          v.osc?.disconnect()
          v.gain?.disconnect()
          v.vibrato?.disconnect()
          v.filter?.disconnect()
        } catch {}
      }
      voices = []
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      for (const v of voices) {
        try {
          v.osc?.stop()
          v.vibrato?.stop()
        } catch {}
      }
      voices = []
      overlay?.remove()
    },
  }
}
