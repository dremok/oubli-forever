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
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface RadioDeps {
  getMemories: () => StoredMemory[]
  switchTo?: (name: string) => void
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
  let lastFrameTime = 0

  // AM/FM band toggle
  let bandMode: 'FM' | 'AM' = 'FM'
  // FM: 88.0–108.0 MHz, AM: 530–1700 kHz (mapped to same 0–1 internal range)
  // Internal frequency always stored as FM range 88–108 for station logic
  let keyHandler: ((e: KeyboardEvent) => void) | null = null

  // Number station easter egg
  let numberStationFrame = 0
  let numberStationActive = false
  let numberStationText = ''
  let numberStationAlpha = 0
  let numberStationOscs: OscillatorNode[] = []
  let numberStationGainNode: GainNode | null = null
  let numberStationSequence: number[] = []
  let numberStationStep = 0
  let numberStationStepTime = 0

  // Scanner line
  let scannerX = 0 // 0–1 normalized position

  // Shortwave ambience audio
  let shortwaveNoiseNode: AudioBufferSourceNode | null = null
  let shortwaveFilter1: BiquadFilterNode | null = null
  let shortwaveFilter2: BiquadFilterNode | null = null
  let shortwaveGain: GainNode | null = null
  let formantFilter1: BiquadFilterNode | null = null
  let formantFilter2: BiquadFilterNode | null = null
  let formantGain: GainNode | null = null
  let formantNoiseNode: AudioBufferSourceNode | null = null

  // Hidden signal frequencies — navigation via lock-on tuning
  const hiddenSignals = [
    { freq: 89.1, room: 'instrument', sound: 'strings' as const, label: '♪ the instrument', lockTime: 0 },
    { freq: 94.7, room: 'lighthouse', sound: 'foghorn' as const, label: '◉ the lighthouse', lockTime: 0 },
    { freq: 101.3, room: 'satellite', sound: 'telemetry' as const, label: '◇ the satellite', lockTime: 0 },
    { freq: 106.5, room: 'weathervane', sound: 'wind' as const, label: '≋ the weathervane', lockTime: 0 },
  ]
  let lockedSignal: (typeof hiddenSignals)[number] | null = null
  const LOCK_THRESHOLD = 0.3 // MHz proximity required
  const LOCK_DURATION = 2.5 // seconds to full lock
  let lockFlashTime = 0 // flash animation on full lock
  let navigatingTo: string | null = null

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
      const dest = getAudioDestination()

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
      noiseGain.connect(dest)
      noiseNode.start()

      // Tone oscillator for station signal
      toneOsc = audioCtx.createOscillator()
      toneOsc.type = 'sine'
      toneOsc.frequency.value = 440
      toneGain = audioCtx.createGain()
      toneGain.gain.value = 0
      toneOsc.connect(toneGain)
      toneGain.connect(dest)
      toneOsc.start()

      // --- Shortwave ambience: filtered noise that varies with frequency ---
      const swBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
      const swData = swBuffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        // Slightly colored noise — emphasize low mids
        swData[i] = (Math.random() * 2 - 1) * 0.15
      }
      shortwaveNoiseNode = audioCtx.createBufferSource()
      shortwaveNoiseNode.buffer = swBuffer
      shortwaveNoiseNode.loop = true

      shortwaveFilter1 = audioCtx.createBiquadFilter()
      shortwaveFilter1.type = 'bandpass'
      shortwaveFilter1.frequency.value = 800
      shortwaveFilter1.Q.value = 2.0

      shortwaveFilter2 = audioCtx.createBiquadFilter()
      shortwaveFilter2.type = 'lowpass'
      shortwaveFilter2.frequency.value = 3000
      shortwaveFilter2.Q.value = 0.7

      shortwaveGain = audioCtx.createGain()
      shortwaveGain.gain.value = 0.008

      shortwaveNoiseNode.connect(shortwaveFilter1)
      shortwaveFilter1.connect(shortwaveFilter2)
      shortwaveFilter2.connect(shortwaveGain)
      shortwaveGain.connect(dest)
      shortwaveNoiseNode.start()

      // --- Formant voice-like modulations: bandpass-shaped noise ---
      const fmtBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
      const fmtData = fmtBuffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        fmtData[i] = (Math.random() * 2 - 1) * 0.1
      }
      formantNoiseNode = audioCtx.createBufferSource()
      formantNoiseNode.buffer = fmtBuffer
      formantNoiseNode.loop = true

      formantFilter1 = audioCtx.createBiquadFilter()
      formantFilter1.type = 'bandpass'
      formantFilter1.frequency.value = 700 // vowel-like formant ~"ah"
      formantFilter1.Q.value = 8.0

      formantFilter2 = audioCtx.createBiquadFilter()
      formantFilter2.type = 'bandpass'
      formantFilter2.frequency.value = 1200 // second formant
      formantFilter2.Q.value = 6.0

      formantGain = audioCtx.createGain()
      formantGain.gain.value = 0

      // Parallel formant chain
      const formantMerge = audioCtx.createGain()
      formantMerge.gain.value = 0.5
      formantNoiseNode.connect(formantFilter1)
      formantNoiseNode.connect(formantFilter2)
      formantFilter1.connect(formantMerge)
      formantFilter2.connect(formantMerge)
      formantMerge.connect(formantGain)
      formantGain.connect(dest)
      formantNoiseNode.start()

      // Number station gain node (shared for the digit oscillators)
      numberStationGainNode = audioCtx.createGain()
      numberStationGainNode.gain.value = 0
      numberStationGainNode.connect(dest)

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

    // Tone when on a station (memory station)
    if (toneGain && toneOsc) {
      if (currentStation && signalStrength > 0.3 && !lockedSignal) {
        const health = 1 - currentStation.memory.degradation
        toneOsc.frequency.value = 200 + currentStation.memory.hue * 400
        toneGain.gain.value = signalStrength * health * 0.02
      } else if (!lockedSignal) {
        toneGain.gain.value = 0
      }
    }
  }

  function updateLockAudio() {
    if (!audioInitialized || !toneOsc || !toneGain) return

    if (lockedSignal) {
      const lockProgress = Math.min(lockedSignal.lockTime / LOCK_DURATION, 1)
      const volume = 0.01 + lockProgress * 0.025

      switch (lockedSignal.sound) {
        case 'strings':
          // Harmonious chord — oscillates between chord tones
          toneOsc.frequency.value = 220 + Math.sin(time * 2) * 50 + Math.sin(time * 3.01) * 30
          toneGain.gain.value = volume
          break
        case 'foghorn':
          // Low foghorn-like drone
          toneOsc.frequency.value = 55 + Math.sin(time * 0.3) * 10
          toneGain.gain.value = volume * 1.5
          break
        case 'telemetry':
          // Rapid high-pitched beeping
          toneOsc.frequency.value = 1200 + Math.sin(time * 15) * 800
          toneGain.gain.value = volume * (Math.sin(time * 12) > 0 ? 1 : 0.1)
          break
        case 'wind':
          // Wind-like filtered noise — modulate the tone to simulate
          toneOsc.frequency.value = 300 + Math.sin(time * 0.7) * 200 + Math.sin(time * 2.3) * 100
          toneGain.gain.value = volume * (0.5 + Math.sin(time * 1.1) * 0.3)
          break
      }
    }
  }

  function updateShortwaveAmbience() {
    if (!audioInitialized) return
    // Vary the shortwave filter center frequency based on dial position
    const normalizedFreq = (frequency - 88) / 20 // 0–1
    if (shortwaveFilter1) {
      shortwaveFilter1.frequency.value = 400 + normalizedFreq * 1200
    }
    if (shortwaveFilter2) {
      shortwaveFilter2.frequency.value = 1500 + normalizedFreq * 3000
    }
    // Shortwave is louder between stations (no signal)
    if (shortwaveGain) {
      const noSignalFactor = 1 - signalStrength
      shortwaveGain.gain.value = 0.005 + noSignalFactor * 0.012
    }
    // Formant voice-like modulation — occasional, ghostly
    if (formantGain && formantFilter1 && formantFilter2) {
      // Slow modulation cycle — creates the illusion of distant voices
      const voiceCycle = Math.sin(time * 0.15) * Math.sin(time * 0.37)
      const voiceActive = voiceCycle > 0.6 // only active ~15% of the time
      if (voiceActive) {
        // Shift formant frequencies slowly — like someone speaking far away
        formantFilter1.frequency.value = 500 + Math.sin(time * 1.2) * 200
        formantFilter2.frequency.value = 1000 + Math.sin(time * 0.8) * 400
        formantGain.gain.value = (voiceCycle - 0.6) * 0.04 * (1 - signalStrength)
      } else {
        formantGain.gain.value = 0
      }
    }
  }

  // --- NUMBER STATION EASTER EGG ---
  function triggerNumberStation(deltaTime: number) {
    numberStationFrame++
    // Trigger randomly — roughly every ~300 frames (at 60fps, about every 5 seconds)
    // but only ~10% chance each window, so effectively quite rare
    if (!numberStationActive && numberStationFrame > 300) {
      numberStationFrame = 0
      if (Math.random() < 0.08 && signalStrength < 0.3) {
        startNumberSequence()
      }
    }
    if (numberStationActive) {
      updateNumberSequence(deltaTime)
    }
    // Fade out text
    if (numberStationAlpha > 0 && !numberStationActive) {
      numberStationAlpha -= deltaTime * 0.5
      if (numberStationAlpha < 0) numberStationAlpha = 0
    }
  }

  async function startNumberSequence() {
    numberStationActive = true
    numberStationStep = 0
    numberStationStepTime = 0
    // Generate 4–6 random digits
    const len = 4 + Math.floor(Math.random() * 3)
    numberStationSequence = []
    for (let i = 0; i < len; i++) {
      numberStationSequence.push(Math.floor(Math.random() * 10))
    }
    numberStationText = numberStationSequence.join(' ')
    numberStationAlpha = 0.7

    // Create oscillators for digit tones
    try {
      const audioCtx = await getAudioContext()
      if (!audioCtx || !numberStationGainNode) return
      numberStationGainNode.gain.value = 0.015

      // Stop any old oscillators
      for (const osc of numberStationOscs) {
        try { osc.stop() } catch { /* ok */ }
      }
      numberStationOscs = []
    } catch { /* ok */ }
  }

  async function updateNumberSequence(deltaTime: number) {
    numberStationStepTime += deltaTime
    const stepDuration = 0.35 // seconds per digit tone

    if (numberStationStepTime >= stepDuration) {
      numberStationStepTime -= stepDuration
      numberStationStep++

      if (numberStationStep > numberStationSequence.length) {
        // Sequence complete
        numberStationActive = false
        if (numberStationGainNode) numberStationGainNode.gain.value = 0
        // Clean up oscillators
        for (const osc of numberStationOscs) {
          try { osc.stop() } catch { /* ok */ }
        }
        numberStationOscs = []
        return
      }

      // Play tone for current digit
      try {
        const audioCtx = await getAudioContext()
        if (!audioCtx || !numberStationGainNode) return

        const digit = numberStationSequence[numberStationStep - 1]
        // Map digits 0–9 to frequencies (DTMF-inspired but not exact)
        const freqMap = [900, 300, 350, 400, 450, 500, 550, 600, 700, 800]
        const osc = audioCtx.createOscillator()
        osc.type = 'square'
        osc.frequency.value = freqMap[digit]
        osc.connect(numberStationGainNode)
        osc.start()
        osc.stop(audioCtx.currentTime + stepDuration * 0.8)
        numberStationOscs.push(osc)
      } catch { /* ok */ }
    }
  }

  // --- INTERFERENCE PATTERNS (Lissajous / moire between stations) ---
  function renderInterference(ctx: CanvasRenderingContext2D, w: number, h: number, centerX: number, centerY: number, radius: number) {
    if (signalStrength > 0.5) return // No interference when signal is strong

    const intensity = (1 - signalStrength) * 0.6
    const freqNorm = (frequency - 88) / 20

    ctx.save()
    ctx.globalAlpha = intensity * 0.25

    // Lissajous curve parameters driven by frequency
    const a = 2 + Math.floor(freqNorm * 5)
    const b = 3 + Math.floor((1 - freqNorm) * 4)
    const delta = time * 0.5 + freqNorm * Math.PI

    const isAM = bandMode === 'AM'
    const r = isAM ? 200 : 100
    const g = isAM ? 170 : 255
    const bVal = isAM ? 80 : 100

    ctx.strokeStyle = `rgba(${r}, ${g}, ${bVal}, ${intensity * 0.3})`
    ctx.lineWidth = 0.8
    ctx.beginPath()

    const steps = 300
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2
      const x = centerX + Math.sin(a * t + delta) * radius
      const y = centerY + Math.sin(b * t) * radius
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Second, offset Lissajous for moire effect
    ctx.strokeStyle = `rgba(${r}, ${g}, ${bVal}, ${intensity * 0.15})`
    ctx.lineWidth = 0.5
    ctx.beginPath()
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2
      const x = centerX + Math.sin((a + 1) * t + delta + 0.3) * radius * 0.9
      const y = centerY + Math.sin((b + 1) * t + 0.7) * radius * 0.9
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    ctx.restore()
  }

  // --- SCANNER LINE ---
  function renderScannerLine(ctx: CanvasRenderingContext2D, panelX: number, bandY: number, bandH: number, panelW: number) {
    // Scanner sweeps and tracks the current frequency position
    const targetX = (frequency - 88) / 20
    // Smooth movement toward target
    scannerX += (targetX - scannerX) * 0.04

    const sx = panelX + scannerX * panelW
    const isAM = bandMode === 'AM'
    const r = isAM ? 200 : 50
    const g = isAM ? 170 : 255
    const bVal = isAM ? 50 : 50

    // Main scanner line
    ctx.save()
    ctx.strokeStyle = `rgba(${r}, ${g}, ${bVal}, 0.4)`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(sx, bandY - 2)
    ctx.lineTo(sx, bandY + bandH + 2)
    ctx.stroke()

    // Glow/fade trail behind the scanner
    const gradient = ctx.createLinearGradient(sx - 30, 0, sx, 0)
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${bVal}, 0)`)
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${bVal}, 0.1)`)
    ctx.fillStyle = gradient
    ctx.fillRect(sx - 30, bandY, 30, bandH)

    // Bright tip dot
    ctx.beginPath()
    ctx.arc(sx, bandY + bandH / 2, 2, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${r}, ${g}, ${bVal}, 0.6)`
    ctx.fill()

    ctx.restore()
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)

    const now = performance.now()
    const deltaTime = lastFrameTime > 0 ? Math.min((now - lastFrameTime) / 1000, 0.1) : 0.016
    lastFrameTime = now
    time += deltaTime

    const w = canvas.width
    const h = canvas.height

    // Get signal info
    const signal = getSignalAt(frequency)
    signalStrength += (signal.strength - signalStrength) * 0.1
    currentStation = signal.station

    updateAudio()
    updateShortwaveAmbience()
    triggerNumberStation(deltaTime)

    // --- LOCK-ON MECHANIC ---
    if (navigatingTo) {
      // Already navigating — wait for flash
      lockFlashTime += deltaTime
      if (lockFlashTime > 0.6 && deps.switchTo) {
        const target = navigatingTo
        navigatingTo = null
        lockFlashTime = 0
        // Reset all lock times
        for (const sig of hiddenSignals) sig.lockTime = 0
        lockedSignal = null
        deps.switchTo(target)
        return
      }
    } else {
      // Check proximity to hidden signals
      let nearestSignal: (typeof hiddenSignals)[number] | null = null
      let nearestDist = Infinity

      for (const sig of hiddenSignals) {
        const dist = Math.abs(frequency - sig.freq)
        if (dist < LOCK_THRESHOLD && dist < nearestDist) {
          nearestDist = dist
          nearestSignal = sig
        }
      }

      // Update lock times
      for (const sig of hiddenSignals) {
        if (sig === nearestSignal) {
          // Closer to center = faster lock
          const proximity = 1 - (nearestDist / LOCK_THRESHOLD)
          sig.lockTime += deltaTime * (0.5 + proximity * 0.5)
          lockedSignal = sig
        } else {
          // Decay lock time when not tuned in
          sig.lockTime = Math.max(0, sig.lockTime - deltaTime * 2)
        }
      }

      if (!nearestSignal) {
        lockedSignal = null
      }

      // Check for full lock
      if (lockedSignal && lockedSignal.lockTime >= LOCK_DURATION) {
        navigatingTo = lockedSignal.room
        lockFlashTime = 0
      }

      // Update audio for hidden signal lock-on
      updateLockAudio()
    }

    ctx.clearRect(0, 0, w, h)

    const isAM = bandMode === 'AM'

    // Background — dark, tinted by band mode
    ctx.fillStyle = isAM ? 'rgba(8, 6, 3, 1)' : 'rgba(5, 8, 5, 1)'
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
        ctx.fillStyle = isAM
          ? `rgba(200, 180, 130, ${line.alpha})`
          : `rgba(200, 200, 180, ${line.alpha})`
        ctx.fillRect(0, line.y, w, 1)
      }
      if (staticLines.length > 30) staticLines.splice(0, 10)

      // Random noise pixels
      for (let i = 0; i < Math.floor(staticIntensity * 80); i++) {
        const nx = Math.random() * w
        const ny = Math.random() * h
        const ns = 1 + Math.random() * 2
        ctx.fillStyle = isAM
          ? `rgba(${180 + Math.random() * 75}, ${150 + Math.random() * 60}, ${80 + Math.random() * 40}, ${staticIntensity * 0.08})`
          : `rgba(${150 + Math.random() * 100}, ${150 + Math.random() * 80}, ${130 + Math.random() * 60}, ${staticIntensity * 0.08})`
        ctx.fillRect(nx, ny, ns, ns)
      }
    }

    // --- RADIO PANEL ---
    const panelX = w * 0.15
    const panelW = w * 0.7
    const panelY = h * 0.15

    // Band-mode color palette
    const bandColor = isAM ? '220, 180, 80' : '100, 255, 100'
    const bandGlow = isAM ? 'rgba(220, 180, 80, 0.3)' : 'rgba(100, 255, 100, 0.3)'

    // Frequency display — show AM kHz or FM MHz
    const displayFreq = isAM
      ? `${Math.round(530 + ((frequency - 88) / 20) * 1170)} kHz`
      : `${frequency.toFixed(1)} MHz`

    ctx.font = '32px "Courier New", monospace'
    ctx.fillStyle = `rgba(${bandColor}, ${0.6 + Math.sin(time * 2) * 0.05})`
    ctx.textAlign = 'center'
    ctx.fillText(displayFreq, w / 2, panelY + 40)

    // Glow behind frequency
    ctx.shadowColor = bandGlow
    ctx.shadowBlur = 20
    ctx.fillText(displayFreq, w / 2, panelY + 40)
    ctx.shadowBlur = 0

    // Band mode indicator
    ctx.font = '11px monospace'
    ctx.fillStyle = `rgba(${bandColor}, 0.25)`
    ctx.textAlign = 'left'
    ctx.fillText(`${bandMode} BAND`, panelX + 5, panelY + 15)
    ctx.fillStyle = `rgba(${bandColor}, 0.1)`
    ctx.fillText('[M] toggle', panelX + 5, panelY + 28)

    // Signal strength meter
    const meterX = panelX + panelW - 80
    const meterY = panelY + 15
    ctx.font = '12px monospace'
    ctx.fillStyle = `rgba(${bandColor}, 0.2)`
    ctx.textAlign = 'left'
    ctx.fillText('SIGNAL', meterX, meterY)

    const bars = 8
    for (let i = 0; i < bars; i++) {
      const barH = 3 + i * 1.5
      const barFilled = signalStrength > (i + 1) / bars
      ctx.fillStyle = barFilled
        ? `rgba(${bandColor}, ${0.4 + i * 0.06})`
        : `rgba(${bandColor}, 0.05)`
      ctx.fillRect(meterX + i * 9, meterY + 6 + (15 - barH), 6, barH)
    }

    // --- FREQUENCY BAND VISUALIZATION ---
    const bandY = panelY + 70
    const bandH = 60

    // Band background
    ctx.fillStyle = isAM ? 'rgba(15, 12, 5, 0.5)' : 'rgba(10, 20, 10, 0.5)'
    ctx.fillRect(panelX, bandY, panelW, bandH)
    ctx.strokeStyle = `rgba(${bandColor}, 0.1)`
    ctx.lineWidth = 0.5
    ctx.strokeRect(panelX, bandY, panelW, bandH)

    // Frequency ticks — different labels for AM vs FM
    if (isAM) {
      for (let f = 600; f <= 1600; f += 200) {
        const x = panelX + ((f - 530) / 1170) * panelW
        ctx.strokeStyle = `rgba(${bandColor}, 0.15)`
        ctx.beginPath()
        ctx.moveTo(x, bandY)
        ctx.lineTo(x, bandY + bandH)
        ctx.stroke()

        ctx.font = '11px monospace'
        ctx.fillStyle = `rgba(${bandColor}, 0.2)`
        ctx.textAlign = 'center'
        ctx.fillText(String(f), x, bandY + bandH + 12)
      }
    } else {
      for (let f = 88; f <= 108; f += 2) {
        const x = panelX + ((f - 88) / 20) * panelW
        ctx.strokeStyle = `rgba(${bandColor}, 0.15)`
        ctx.beginPath()
        ctx.moveTo(x, bandY)
        ctx.lineTo(x, bandY + bandH)
        ctx.stroke()

        ctx.font = '11px monospace'
        ctx.fillStyle = `rgba(${bandColor}, 0.2)`
        ctx.textAlign = 'center'
        ctx.fillText(String(f), x, bandY + bandH + 12)
      }
    }

    // Station markers on the band
    for (const s of stations) {
      const x = panelX + ((s.frequency - 88) / 20) * panelW
      const health = 1 - s.memory.degradation
      const barHeight = health * bandH * 0.8

      // Station signal bar
      ctx.fillStyle = `rgba(${bandColor}, ${0.05 + health * 0.15})`
      ctx.fillRect(x - 1, bandY + bandH - barHeight, 3, barHeight)

      // Highlight if near current frequency
      const dist = Math.abs(frequency - s.frequency)
      if (dist < s.bandwidth) {
        ctx.fillStyle = `rgba(${bandColor}, ${0.1 * (1 - dist / s.bandwidth)})`
        const glowW = s.bandwidth / 20 * panelW
        ctx.fillRect(x - glowW / 2, bandY, glowW, bandH)
      }
    }

    // Hidden signal blips — very faint markers on the band
    for (const sig of hiddenSignals) {
      const sx = panelX + ((sig.freq - 88) / 20) * panelW
      const dist = Math.abs(frequency - sig.freq)
      const isNear = dist < LOCK_THRESHOLD * 2

      // Base blip — barely visible (like a tiny signal spike among noise)
      const baseAlpha = 0.025 + Math.sin(time * 1.5 + sig.freq) * 0.01
      ctx.fillStyle = `rgba(${bandColor}, ${baseAlpha})`
      ctx.fillRect(sx - 0.5, bandY + bandH * 0.4, 1.5, bandH * 0.2)

      // When tuning near, the blip pulses and grows
      if (isNear) {
        const nearness = 1 - (dist / (LOCK_THRESHOLD * 2))
        const pulse = 0.05 + nearness * 0.15 + Math.sin(time * 5 + sig.freq) * nearness * 0.08
        const blipH = bandH * (0.3 + nearness * 0.5)
        ctx.fillStyle = `rgba(${bandColor}, ${pulse})`
        ctx.fillRect(sx - 1, bandY + (bandH - blipH) / 2, 2.5, blipH)

        // Faint glow around the blip when very close
        if (dist < LOCK_THRESHOLD) {
          const lockGlow = 0.03 + nearness * 0.08
          const glowW = LOCK_THRESHOLD / 20 * panelW
          ctx.fillStyle = `rgba(${bandColor}, ${lockGlow})`
          ctx.fillRect(sx - glowW / 2, bandY, glowW, bandH)
        }
      }
    }

    // --- SCANNER LINE ---
    renderScannerLine(ctx, panelX, bandY, bandH, panelW)

    // --- INTERFERENCE PATTERNS ---
    const interferenceY = bandY + bandH + 120
    renderInterference(ctx, w, h, w / 2, interferenceY, Math.min(w, h) * 0.12)

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
    ctx.fillStyle = isAM ? 'rgba(40, 30, 15, 0.5)' : 'rgba(30, 40, 30, 0.5)'
    ctx.fillRect(dialX, dialY, dialW, 8)
    ctx.strokeStyle = `rgba(${bandColor}, 0.1)`
    ctx.lineWidth = 0.5
    ctx.strokeRect(dialX, dialY, dialW, 8)

    // Dial thumb
    const thumbX = dialX + ((frequency - 88) / 20) * dialW
    ctx.beginPath()
    ctx.arc(thumbX, dialY + 4, 10, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${bandColor}, 0.3)`
    ctx.fill()
    ctx.strokeStyle = `rgba(${bandColor}, 0.5)`
    ctx.lineWidth = 1
    ctx.stroke()

    // Notch on thumb
    ctx.beginPath()
    ctx.moveTo(thumbX, dialY - 2)
    ctx.lineTo(thumbX, dialY + 10)
    ctx.strokeStyle = `rgba(${bandColor}, 0.4)`
    ctx.stroke()

    // --- MEMORY TEXT DISPLAY ---
    const textY = dialY + 60
    const textAreaH = h - textY - 60

    if (currentStation && signalStrength > 0.2) {
      const mem = currentStation.memory
      const health = 1 - mem.degradation
      const clarity = signalStrength * health

      // Station label
      ctx.font = '12px monospace'
      ctx.fillStyle = `rgba(${bandColor}, ${clarity * 0.3})`
      ctx.textAlign = 'center'
      const stationLabel = isAM
        ? `station ${Math.round(530 + ((currentStation.frequency - 88) / 20) * 1170)} — signal ${Math.floor(signalStrength * 100)}%`
        : `station ${currentStation.frequency.toFixed(1)} — signal ${Math.floor(signalStrength * 100)}%`
      ctx.fillText(stationLabel, w / 2, textY)

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
          ctx.fillStyle = `rgba(${bandColor}, ${charClarity * 0.7})`
          ctx.fillText(
            line[j],
            charX + (Math.random() - 0.5) * jitter,
            lineY + (Math.random() - 0.5) * jitter
          )
        }
      }

      // Time info
      const age = Math.floor((Date.now() - mem.timestamp) / (1000 * 60 * 60 * 24))
      ctx.font = '12px monospace'
      ctx.fillStyle = `rgba(${bandColor}, ${clarity * 0.15})`
      ctx.textAlign = 'center'
      ctx.fillText(
        `${age}d old · ${Math.floor(mem.degradation * 100)}% degraded`,
        w / 2, textY + 30 + Math.min(lines.length, 4) * 22 + 20
      )
    } else {
      // No signal — show noise text
      ctx.font = '13px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(${bandColor}, ${0.08 + Math.sin(time * 2) * 0.03})`
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

    // --- LOCK-ON FEEDBACK (below the dial) ---
    if (lockedSignal) {
      const lockProgress = Math.min(lockedSignal.lockTime / LOCK_DURATION, 1)
      const lockCenterX = w / 2
      const lockY = dialY + 45

      // Pulsing ring around frequency display when near a hidden signal
      const pulseRadius = 80 + Math.sin(time * 6) * 5
      const pulseAlpha = 0.05 + lockProgress * 0.15 + Math.sin(time * 4) * 0.03
      ctx.beginPath()
      ctx.arc(lockCenterX, panelY + 35, pulseRadius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(${bandColor}, ${pulseAlpha})`
      ctx.lineWidth = 1 + lockProgress * 2
      ctx.stroke()

      // Second ring, slightly delayed
      if (lockProgress > 0.2) {
        const pulseRadius2 = 90 + Math.sin(time * 6 + 1) * 6
        ctx.beginPath()
        ctx.arc(lockCenterX, panelY + 35, pulseRadius2, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${bandColor}, ${pulseAlpha * 0.5})`
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      // Lock-on progress bar — retro segmented signal strength indicator
      const barW = 200
      const barX = lockCenterX - barW / 2
      const barH = 10
      const segments = 20

      // Bar background
      ctx.fillStyle = 'rgba(10, 20, 10, 0.4)'
      ctx.fillRect(barX - 2, lockY - 2, barW + 4, barH + 4)
      ctx.strokeStyle = `rgba(${bandColor}, 0.15)`
      ctx.lineWidth = 0.5
      ctx.strokeRect(barX - 2, lockY - 2, barW + 4, barH + 4)

      // Filled segments
      const filledSegments = Math.floor(lockProgress * segments)
      const segmentW = barW / segments
      for (let i = 0; i < segments; i++) {
        const isFilled = i < filledSegments
        const segX = barX + i * segmentW
        // Color transitions: green -> bright green -> white at full
        let r = 50, g = 200, b = 50
        if (i > segments * 0.6) { r = 80; g = 255; b = 80 }
        if (i > segments * 0.85) { r = 180; g = 255; b = 180 }

        if (isFilled) {
          const flicker = 0.6 + Math.sin(time * 10 + i * 0.5) * 0.15
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${flicker})`
        } else {
          ctx.fillStyle = `rgba(${bandColor}, 0.03)`
        }
        ctx.fillRect(segX + 0.5, lockY, segmentW - 1, barH)
      }

      // LOCK label above the bar
      ctx.font = '11px monospace'
      ctx.textAlign = 'left'
      ctx.fillStyle = `rgba(${bandColor}, ${0.15 + lockProgress * 0.3})`
      ctx.fillText('LOCK', barX, lockY - 5)
      ctx.textAlign = 'right'
      ctx.fillText(`${Math.floor(lockProgress * 100)}%`, barX + barW, lockY - 5)

      // Signal label text — phases in as lock progresses
      const labelY = lockY + barH + 20
      ctx.textAlign = 'center'
      if (lockProgress >= 1.0) {
        // Full lock — LOCKED text with flash
        ctx.font = '14px monospace'
        const flashAlpha = 0.5 + Math.sin(time * 8) * 0.3
        ctx.fillStyle = `rgba(200, 255, 200, ${flashAlpha})`
        ctx.fillText('⟫ LOCKED ⟫', lockCenterX, labelY)

        // Glow
        ctx.shadowColor = bandGlow
        ctx.shadowBlur = 15
        ctx.fillText('⟫ LOCKED ⟫', lockCenterX, labelY)
        ctx.shadowBlur = 0
      } else if (lockProgress >= 0.6) {
        // Show room label
        ctx.font = '12px "Cormorant Garamond", serif'
        const labelAlpha = (lockProgress - 0.6) / 0.4 * 0.5
        ctx.fillStyle = `rgba(${bandColor}, ${labelAlpha})`
        ctx.fillText(lockedSignal.label, lockCenterX, labelY)
      } else if (lockProgress >= 0.3) {
        // "signal detected..."
        ctx.font = '12px monospace'
        const detectAlpha = (lockProgress - 0.3) / 0.3 * 0.25
        ctx.fillStyle = `rgba(${bandColor}, ${detectAlpha})`
        const dots = '.'.repeat(1 + Math.floor(time * 3) % 3)
        ctx.fillText(`signal detected${dots}`, lockCenterX, labelY)
      }
    }

    // --- NUMBER STATION TEXT (overlaid when active) ---
    if (numberStationAlpha > 0.01) {
      ctx.save()
      ctx.font = '24px "Courier New", monospace'
      ctx.textAlign = 'center'
      // Red-tinted encoded text, slightly flickering
      const nsFlicker = numberStationAlpha * (0.8 + Math.sin(time * 12) * 0.2)
      ctx.fillStyle = `rgba(255, 80, 60, ${nsFlicker})`
      ctx.shadowColor = 'rgba(255, 80, 60, 0.4)'
      ctx.shadowBlur = 10
      ctx.fillText(numberStationText, w / 2, h * 0.45)
      ctx.shadowBlur = 0

      // "ENCODED TRANSMISSION" label above
      ctx.font = '10px monospace'
      ctx.fillStyle = `rgba(255, 80, 60, ${nsFlicker * 0.5})`
      ctx.fillText('ENCODED TRANSMISSION', w / 2, h * 0.45 - 20)
      ctx.restore()
    }

    // Title
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(${bandColor}, ${0.1 + Math.sin(time * 0.3) * 0.03})`
    ctx.textAlign = 'center'
    ctx.fillText('the radio', w / 2, 30)

    // Hint
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(${bandColor}, 0.06)`
    ctx.fillText('drag the dial to tune · hold steady on hidden frequencies to lock on', w / 2, h - 20)

    // Navigation flash overlay (rendered last, on top of everything)
    if (navigatingTo && lockFlashTime > 0) {
      const flashAlpha = Math.sin(lockFlashTime * Math.PI / 0.6) * 0.6
      ctx.fillStyle = `rgba(${bandColor}, ${Math.max(0, flashAlpha)})`
      ctx.fillRect(0, 0, w, h)
    }
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

      // Mouse/touch events for dial tuning
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

      // AM/FM toggle key handler
      keyHandler = (e: KeyboardEvent) => {
        if (!active) return
        if (e.key === 'm' || e.key === 'M') {
          bandMode = bandMode === 'FM' ? 'AM' : 'FM'
        }
      }
      window.addEventListener('keydown', keyHandler)

      return overlay
    },

    activate() {
      active = true
      staticLines = []
      lastFrameTime = 0
      lockedSignal = null
      navigatingTo = null
      lockFlashTime = 0
      for (const sig of hiddenSignals) sig.lockTime = 0
      buildStations()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      lockedSignal = null
      navigatingTo = null
      for (const sig of hiddenSignals) sig.lockTime = 0
      // Fade out audio
      if (noiseGain) noiseGain.gain.value = 0
      if (toneGain) toneGain.gain.value = 0
      if (shortwaveGain) shortwaveGain.gain.value = 0
      if (formantGain) formantGain.gain.value = 0
      if (numberStationGainNode) numberStationGainNode.gain.value = 0
      // Stop any active number station oscillators
      for (const osc of numberStationOscs) {
        try { osc.stop() } catch { /* ok */ }
      }
      numberStationOscs = []
      numberStationActive = false
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      if (noiseNode) { try { noiseNode.stop() } catch { /* ok */ } }
      if (toneOsc) { try { toneOsc.stop() } catch { /* ok */ } }
      if (shortwaveNoiseNode) { try { shortwaveNoiseNode.stop() } catch { /* ok */ } }
      if (formantNoiseNode) { try { formantNoiseNode.stop() } catch { /* ok */ } }
      for (const osc of numberStationOscs) {
        try { osc.stop() } catch { /* ok */ }
      }
      numberStationOscs = []
      if (keyHandler) {
        window.removeEventListener('keydown', keyHandler)
        keyHandler = null
      }
      overlay?.remove()
    },
  }
}
