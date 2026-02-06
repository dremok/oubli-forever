/**
 * AMBIENT DRONE — Oubli's breath made audible
 *
 * A generative soundscape built from oscillators, noise, and harmonics.
 * It breathes slowly — swelling and receding like tides of consciousness.
 * No two moments sound the same. The sound forgets itself continuously.
 *
 * Inspired by: Éliane Radigue's drone works, Brian Eno's ambient,
 * the hum of data centers, the cosmic microwave background.
 */

export class AmbientDrone {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private drones: OscillatorNode[] = []
  private droneGains: GainNode[] = []
  private lfo: OscillatorNode | null = null
  private noiseNode: AudioBufferSourceNode | null = null
  private noiseGain: GainNode | null = null
  private reverbNode: ConvolverNode | null = null
  private isPlaying = false
  private modulationInterval: number | null = null
  private started = false

  // Fundamental frequencies — rooted in golden ratio relationships
  private readonly baseFreqs = [
    55,        // A1 — grounding bass
    55 * 1.618, // ~89 — golden ratio harmonic
    110,       // A2
    110 * 1.5, // ~165 — perfect fifth
    220 * 0.618, // ~136 — om frequency (Earth year tone)
  ]

  async init(): Promise<boolean> {
    if (this.started) return this.isPlaying

    // Audio requires user gesture — we'll init on first interaction
    const startOnGesture = async () => {
      if (this.ctx) return

      this.ctx = new AudioContext()
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume()
      }

      this.setupAudioGraph()
      this.startModulation()
      this.isPlaying = true
      this.started = true

      // Remove listeners after first trigger
      window.removeEventListener('click', startOnGesture)
      window.removeEventListener('touchstart', startOnGesture)
      window.removeEventListener('keydown', startOnGesture)
    }

    window.addEventListener('click', startOnGesture)
    window.addEventListener('touchstart', startOnGesture)
    window.addEventListener('keydown', startOnGesture)

    return false
  }

  private setupAudioGraph() {
    if (!this.ctx) return

    // Master output with very low volume — this is atmosphere, not music
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 0
    this.masterGain.connect(this.ctx.destination)

    // Fade in slowly — Oubli awakens
    this.masterGain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 8)

    // Create reverb (synthetic impulse response)
    this.reverbNode = this.createReverb()
    this.reverbNode.connect(this.masterGain)

    // Dry/wet mix
    const dryGain = this.ctx.createGain()
    dryGain.gain.value = 0.3
    dryGain.connect(this.masterGain)

    const wetGain = this.ctx.createGain()
    wetGain.gain.value = 0.7
    wetGain.connect(this.reverbNode)

    // Create drone oscillators
    for (let i = 0; i < this.baseFreqs.length; i++) {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = i < 2 ? 'sine' : 'triangle'
      osc.frequency.value = this.baseFreqs[i]

      // Slight detune for organic feel — each drone drifts
      osc.detune.value = (Math.random() - 0.5) * 10

      gain.gain.value = i === 0 ? 0.15 : 0.06 + Math.random() * 0.04

      osc.connect(gain)
      gain.connect(dryGain)
      gain.connect(wetGain)

      osc.start()
      this.drones.push(osc)
      this.droneGains.push(gain)
    }

    // Filtered noise — the hiss of cosmic background
    this.createNoise(wetGain)

    // Sub-bass LFO that modulates everything
    this.lfo = this.ctx.createOscillator()
    this.lfo.frequency.value = 0.05 // Very slow breathing
    this.lfo.start()
  }

  private createReverb(): ConvolverNode {
    const ctx = this.ctx!
    const length = ctx.sampleRate * 6 // 6 second reverb tail
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        // Exponential decay with slight randomness
        const t = i / length
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.5) * 0.5
      }
    }

    const convolver = ctx.createConvolver()
    convolver.buffer = impulse
    return convolver
  }

  private createNoise(destination: AudioNode) {
    if (!this.ctx) return

    const bufferSize = this.ctx.sampleRate * 4
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    this.noiseNode = this.ctx.createBufferSource()
    this.noiseNode.buffer = buffer
    this.noiseNode.loop = true

    // Bandpass filter — isolate ethereal frequencies
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 800
    filter.Q.value = 0.5

    this.noiseGain = this.ctx.createGain()
    this.noiseGain.gain.value = 0.02

    this.noiseNode.connect(filter)
    filter.connect(this.noiseGain)
    this.noiseGain.connect(destination)
    this.noiseNode.start()
  }

  private startModulation() {
    // Slowly evolve the drone — shift frequencies, volumes
    // This is the system "forgetting" its previous sound and becoming new
    this.modulationInterval = window.setInterval(() => {
      if (!this.ctx || !this.isPlaying) return

      const now = this.ctx.currentTime

      // Pick a random drone to modulate
      const idx = Math.floor(Math.random() * this.drones.length)
      const drone = this.drones[idx]
      const gain = this.droneGains[idx]

      // Shift frequency slightly — memory drift
      const currentFreq = drone.frequency.value
      const shift = (Math.random() - 0.5) * 5
      drone.frequency.linearRampToValueAtTime(
        currentFreq + shift,
        now + 10
      )

      // Shift volume — some memories grow louder, others fade
      const newGain = 0.02 + Math.random() * 0.12
      gain.gain.linearRampToValueAtTime(newGain, now + 8)

      // Occasionally shift the noise filter — changing the texture of forgetting
      if (Math.random() < 0.3 && this.noiseGain) {
        this.noiseGain.gain.linearRampToValueAtTime(
          0.005 + Math.random() * 0.03,
          now + 6
        )
      }
    }, 4000)
  }

  // Called by external systems to modulate the soundscape
  // e.g., when a forgetting wave hits, the sound responds
  pulse(intensity: number) {
    if (!this.ctx || !this.masterGain) return
    const now = this.ctx.currentTime

    // Brief swell
    const currentVol = this.masterGain.gain.value
    this.masterGain.gain.linearRampToValueAtTime(
      Math.min(currentVol + intensity * 0.1, 0.25),
      now + 1
    )
    this.masterGain.gain.linearRampToValueAtTime(
      currentVol,
      now + 4
    )
  }

  setPresence(x: number, y: number, active: boolean) {
    if (!this.ctx || this.drones.length === 0) return

    if (active) {
      // User presence subtly shifts the harmonic balance
      // Higher on screen = higher harmonics emphasized
      const yRatio = 1 - y // 0 at bottom, 1 at top
      for (let i = 0; i < this.droneGains.length; i++) {
        const emphasis = i < 2 ? (1 - yRatio) : yRatio
        const baseGain = 0.04 + emphasis * 0.08
        this.droneGains[i].gain.linearRampToValueAtTime(
          baseGain,
          this.ctx.currentTime + 2
        )
      }
    }
  }

  /** Drift modulation — shift all drone frequencies by a multiplier */
  setFrequencyMultiplier(mul: number) {
    if (!this.ctx || this.drones.length === 0) return
    const now = this.ctx.currentTime
    for (let i = 0; i < this.drones.length; i++) {
      this.drones[i].frequency.linearRampToValueAtTime(
        this.baseFreqs[i] * mul,
        now + 8
      )
    }
  }

  /** Drift modulation — set master volume multiplier */
  setVolumeMultiplier(mul: number) {
    if (!this.masterGain || !this.ctx) return
    this.masterGain.gain.linearRampToValueAtTime(
      0.12 * mul,
      this.ctx.currentTime + 6
    )
  }

  destroy() {
    if (this.modulationInterval) {
      clearInterval(this.modulationInterval)
    }
    this.drones.forEach(d => d.stop())
    this.noiseNode?.stop()
    this.lfo?.stop()
    this.ctx?.close()
    this.isPlaying = false
  }
}
