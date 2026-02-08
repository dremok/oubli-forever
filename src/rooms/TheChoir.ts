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
 * VOICE RESONANCE PORTALS: voices placed near the edges of the room
 * resonate with adjacent rooms. Sustain a voice at the boundary
 * to open a passage through sound.
 *
 * Inspired by: Gregorian chant, Arvo P\u00e4rt's tintinnabuli,
 * Pauline Oliveros' deep listening, throat singing,
 * the sound of wind through architecture, how voices
 * combine to create something none of them contain alone
 */

import type { Room } from './RoomManager'
import { getAudioContext } from '../sound/AudioBus'

interface ChoirDeps {
  switchTo?: (name: string) => void
}

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

interface ResonanceZone {
  label: string
  room: string
  resonance: number
  test: (x: number, y: number, w: number, h: number) => boolean
}

export function createChoirRoom(deps?: ChoirDeps): Room {
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

  // Resonance zones — voices placed near edges create portals to adjacent rooms
  const resonanceZones: ResonanceZone[] = [
    {
      label: 'the instrument',
      room: 'instrument',
      resonance: 0,
      test: (_x, y, _w, h) => y < h * 0.15,
    },
    {
      label: 'the s\u00e9ance',
      room: 'seance',
      resonance: 0,
      test: (_x, y, _w, h) => y > h * 0.85,
    },
    {
      label: 'the terrarium',
      room: 'terrarium',
      resonance: 0,
      test: (x, y, w, h) => x < w * 0.15 && y > h * 0.3 && y < h * 0.7,
    },
  ]

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

    // EMaj7add9 chord with proper voicing:
    // E and B (root+fifth) tend lower, F# G# D# (color tones) tend higher
    const pitchRatio = 1 - y / h // 0=low, 1=high
    const baseFreq = 82.41 // E2

    // 5 chord tones across 3 octaves with octave-preference weights
    // weights: [octave2, octave3, octave4] — higher weight = more likely
    const voicedNotes = [
      { semitones: [0, 12, 24],  weights: [0.55, 0.35, 0.10] },  // E: strongly low
      { semitones: [7, 19, 31],  weights: [0.50, 0.35, 0.15] },  // B: strongly low
      { semitones: [2, 14, 26],  weights: [0.10, 0.35, 0.55] },  // F#: tends high
      { semitones: [4, 16, 28],  weights: [0.08, 0.27, 0.65] },  // G#: strongly high
      { semitones: [11, 23, 35], weights: [0.08, 0.22, 0.70] },  // D#: strongly high
    ]

    // Pick a random chord tone
    const note = voicedNotes[Math.floor(Math.random() * voicedNotes.length)]

    // Y position shifts the octave preference (higher click → higher octaves)
    const adjusted = note.weights.map((w, i) => {
      const octaveBias = (i - 1) * 0.6 // -0.6, 0, +0.6
      return Math.max(0.01, w * (1 + (pitchRatio - 0.5) * octaveBias))
    })
    const wSum = adjusted[0] + adjusted[1] + adjusted[2]
    const norm = adjusted.map(w => w / wSum)

    // Weighted random octave selection
    const roll = Math.random()
    const octIdx = roll < norm[0] ? 0 : roll < norm[0] + norm[1] ? 1 : 2
    const semitone = note.semitones[octIdx]
    const freq = baseFreq * Math.pow(2, semitone / 12)

    // X,Y -> continuous waveform shape via custom PeriodicWave
    const xNorm = x / w // 0=left(pure), 1=right(bright)
    const yNorm = y / h // 0=top, 1=bottom

    try {
      const osc = audioCtx.createOscillator()

      // Build custom waveform: X controls harmonic richness, Y affects even/odd balance
      const nH = 20
      const real = new Float32Array(nH)
      const imag = new Float32Array(nH)
      real[0] = 0; imag[0] = 0
      for (let k = 1; k < nH; k++) {
        if (k === 1) { imag[k] = 1.0; continue }
        const isOdd = k % 2 === 1
        // X: left=fundamental only, middle=odd harmonics(hollow), right=all harmonics(bright)
        const evenPresence = isOdd ? 1.0 : Math.max(0, (xNorm - 0.25) / 0.75)
        const richness = Math.pow(xNorm, 0.4)
        // Y: top adds slight emphasis on higher partials, bottom on lower
        const yShift = 1.0 + (1 - yNorm - 0.5) * 0.3
        const falloff = 1.0 / Math.pow(k, (1.8 - xNorm * 0.9) * yShift)
        imag[k] = richness * evenPresence * falloff
      }
      const wave = audioCtx.createPeriodicWave(real, imag, { disableNormalization: false })
      osc.setPeriodicWave(wave)
      osc.frequency.value = freq

      // Vibrato
      const vibrato = audioCtx.createOscillator()
      vibrato.frequency.value = 4.5 + Math.random() * 2 // 4.5-6.5 Hz
      const vibratoGain = audioCtx.createGain()
      vibratoGain.gain.value = freq * 0.008 // subtle pitch wobble
      vibrato.connect(vibratoGain)
      vibratoGain.connect(osc.frequency)

      // Formant filter: X controls openness, Y affects resonance
      const filter = audioCtx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 300 + xNorm * 2200 + pitchRatio * 800 // 300-3300 Hz
      filter.Q.value = 1.5 + (1 - xNorm) * 3 + yNorm * 1.5 // more resonant when pure/low

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

  // Draw resonance zone edge effects
  function drawResonanceEdge(
    c: CanvasRenderingContext2D,
    zoneIndex: number,
    w: number, h: number,
    r: number, t: number,
  ) {
    if (r < 0.01) return

    if (zoneIndex === 0) {
      // TOP edge — instrument portal
      for (let i = 0; i < 5; i++) {
        const spread = w * 0.1 + i * w * 0.18
        const pulse = Math.sin(t * 2 + i * 1.3) * 0.3 + 0.7
        const a = r * 0.25 * pulse
        c.strokeStyle = `rgba(200, 180, 255, ${a})`
        c.lineWidth = 1
        c.beginPath()
        c.arc(w / 2, -10, spread, 0.1 * Math.PI, 0.9 * Math.PI)
        c.stroke()
      }
    } else if (zoneIndex === 1) {
      // BOTTOM edge — seance portal
      for (let i = 0; i < 5; i++) {
        const spread = w * 0.1 + i * w * 0.18
        const pulse = Math.sin(t * 1.8 + i * 1.1) * 0.3 + 0.7
        const a = r * 0.25 * pulse
        c.strokeStyle = `rgba(200, 180, 255, ${a})`
        c.lineWidth = 1
        c.beginPath()
        c.arc(w / 2, h + 10, spread, 1.1 * Math.PI, 1.9 * Math.PI)
        c.stroke()
      }
    } else if (zoneIndex === 2) {
      // LEFT edge — terrarium portal
      for (let i = 0; i < 5; i++) {
        const spread = h * 0.06 + i * h * 0.1
        const pulse = Math.sin(t * 2.2 + i * 0.9) * 0.3 + 0.7
        const a = r * 0.25 * pulse
        c.strokeStyle = `rgba(200, 180, 255, ${a})`
        c.lineWidth = 1
        c.beginPath()
        c.arc(-10, h / 2, spread, -0.4 * Math.PI, 0.4 * Math.PI)
        c.stroke()
      }
    }
  }

  // Draw connecting wave lines from a voice to the edge of the zone
  function drawVoiceConnection(
    c: CanvasRenderingContext2D,
    v: Voice,
    zoneIndex: number,
    w: number, h: number,
    t: number,
  ) {
    // Target point on the edge
    let tx: number, ty: number
    if (zoneIndex === 0) {
      tx = v.x; ty = 0
    } else if (zoneIndex === 1) {
      tx = v.x; ty = h
    } else {
      tx = 0; ty = v.y
    }

    const dx = tx - v.x
    const dy = ty - v.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 1) return

    const steps = 20
    const perpX = -dy / dist
    const perpY = dx / dist

    c.beginPath()
    for (let s = 0; s <= steps; s++) {
      const frac = s / steps
      const px = v.x + dx * frac
      const py = v.y + dy * frac
      // Sine wave perpendicular to the line
      const wave = Math.sin(frac * 8 + t * 4) * 6 * (1 - frac) * v.alpha
      const fx = px + perpX * wave
      const fy = py + perpY * wave
      if (s === 0) c.moveTo(fx, fy)
      else c.lineTo(fx, fy)
    }
    c.strokeStyle = `rgba(200, 180, 255, ${v.alpha * 0.06})`
    c.lineWidth = 1
    c.stroke()
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

    // --- Update resonance zones ---
    const livingVoices = voices.filter(v => {
      const age = time - v.birth
      return age > 0.5 && age < v.life - 1 // only count stable voices
    })

    for (let zi = 0; zi < resonanceZones.length; zi++) {
      const zone = resonanceZones[zi]
      let hasVoice = false
      for (const v of livingVoices) {
        if (zone.test(v.x, v.y, w, h)) {
          hasVoice = true
          break
        }
      }
      if (hasVoice) {
        zone.resonance = Math.min(1.0, zone.resonance + 0.01)
      } else {
        zone.resonance = Math.max(0, zone.resonance - 0.005)
      }
    }

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
      ctx.font = '11px monospace'
      ctx.fillStyle = `rgba(200, 180, 255, ${v.alpha * 0.06})`
      ctx.textAlign = 'center'
      ctx.fillText(`${v.freq.toFixed(0)}Hz`, v.x, v.y + 22)

      // Draw wave connections from voices to resonance zones they're in
      for (let zi = 0; zi < resonanceZones.length; zi++) {
        if (resonanceZones[zi].test(v.x, v.y, w, h)) {
          drawVoiceConnection(ctx, v, zi, w, h, time)
        }
      }
    }

    // Auto-add voices occasionally to keep the choir alive
    if (voices.length < 2 && Math.random() < 0.005) {
      addVoice(
        w * 0.2 + Math.random() * w * 0.6,
        h * 0.2 + Math.random() * h * 0.6,
      )
    }

    // Title
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 180, 255, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the choir', w / 2, 25)

    // Stats
    ctx.font = '12px monospace'
    ctx.fillStyle = 'rgba(200, 180, 255, 0.06)'
    ctx.textAlign = 'left'
    ctx.fillText(`${voices.length} voices`, 12, h - 30)
    ctx.fillText(`${totalVoices} total`, 12, h - 18)

    // Pitch guide (very faint)
    ctx.textAlign = 'right'
    ctx.fillText('high \u2191', w - 12, h * 0.15)
    ctx.fillText('low \u2193', w - 12, h * 0.85)
    ctx.fillText('\u2190 pure \u00b7 rich \u2192', w - 12, h - 18)

    // --- Draw resonance zone effects ---
    if (deps?.switchTo) {
      for (let zi = 0; zi < resonanceZones.length; zi++) {
        const zone = resonanceZones[zi]

        // Draw edge arcs when resonance > 0
        if (zone.resonance > 0.01) {
          drawResonanceEdge(ctx, zi, w, h, zone.resonance, time)
        }

        // Show label when resonance > 0.7
        if (zone.resonance > 0.7) {
          const labelAlpha = (zone.resonance - 0.7) / 0.3 * 0.25
          ctx.font = '12px "Cormorant Garamond", serif'
          ctx.fillStyle = `rgba(200, 180, 255, ${labelAlpha})`
          ctx.textAlign = 'center'
          if (zi === 0) {
            // Top edge
            ctx.fillText(`resonance detected... ${zone.label}`, w / 2, 50)
          } else if (zi === 1) {
            // Bottom edge
            ctx.fillText(`resonance detected... ${zone.label}`, w / 2, h - 45)
          } else if (zi === 2) {
            // Left edge
            ctx.save()
            ctx.translate(30, h / 2)
            ctx.rotate(-Math.PI / 2)
            ctx.fillText(`resonance detected... ${zone.label}`, 0, 0)
            ctx.restore()
          }
        }
      }
    }

    // Hint — show only when no zones are active
    const anyZoneActive = resonanceZones.some(z => z.resonance > 0.1)
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(200, 180, 255, 0.04)'
    ctx.fillText('click to add a voice \u00b7 position determines pitch and timbre', w / 2, h - 8)

    if (!anyZoneActive) {
      ctx.fillStyle = 'rgba(200, 180, 255, 0.03)'
      ctx.fillText('voices placed near the edges create resonance...', w / 2, h - 22)
    }
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
        // Check resonance zone clicks — navigate if resonance > 0.5
        if (deps?.switchTo && canvas) {
          for (let zi = 0; zi < resonanceZones.length; zi++) {
            const zone = resonanceZones[zi]
            if (zone.resonance > 0.5 && zone.test(e.clientX, e.clientY, canvas.width, canvas.height)) {
              deps.switchTo(zone.room)
              return
            }
          }
        }
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
      // Reset resonance on re-entry
      for (const z of resonanceZones) z.resonance = 0
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
