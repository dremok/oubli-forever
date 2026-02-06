/**
 * TONAL ENGINE — particles sing
 *
 * The particle field is sonified. Different regions of 3D space
 * map to different pitches. As particles cluster, harmonics emerge.
 * As they disperse, the harmony dissolves into noise.
 *
 * This creates an ever-evolving generative composition that is
 * literally driven by the visual state of the system. You cannot
 * separate the sight from the sound — they are one.
 *
 * Scale: Pentatonic (no dissonance) → shifts to modes of limited
 * transposition (Messiaen) as the system ages. Beauty → complexity.
 *
 * Inspired by: Xenakis's stochastic music, Ryoji Ikeda's data
 * sonification, the music of the spheres, whale song.
 */

// Pentatonic scale frequencies (A minor pentatonic, multiple octaves)
const SCALE_FREQS = [
  // Octave 2
  110.00, 130.81, 146.83, 164.81, 196.00,
  // Octave 3
  220.00, 261.63, 293.66, 329.63, 392.00,
  // Octave 4
  440.00, 523.25, 587.33, 659.25, 783.99,
  // Octave 5 (higher shimmer)
  880.00, 1046.50,
]

interface TonalVoice {
  oscillator: OscillatorNode
  gainNode: GainNode
  filterNode: BiquadFilterNode
  targetGain: number
  currentFreq: number
  targetFreq: number
  active: boolean
}

export class TonalEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private reverb: ConvolverNode | null = null
  private voices: TonalVoice[] = []
  private maxVoices = 6
  private isRunning = false
  private updateInterval: number | null = null
  private particleDensities: number[] = new Array(8).fill(0) // 8 spatial regions

  async init(): Promise<void> {
    const startOnGesture = async () => {
      if (this.ctx) return

      this.ctx = new AudioContext()
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume()
      }

      this.setupAudio()
      this.isRunning = true

      window.removeEventListener('click', startOnGesture)
      window.removeEventListener('touchstart', startOnGesture)
      window.removeEventListener('mousemove', startOnGesture)
    }

    window.addEventListener('click', startOnGesture)
    window.addEventListener('touchstart', startOnGesture)
    window.addEventListener('mousemove', startOnGesture, { once: true })
  }

  private setupAudio() {
    if (!this.ctx) return

    // Master output — very quiet, this is atmosphere
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 0
    this.masterGain.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 10)
    this.masterGain.connect(this.ctx.destination)

    // Long reverb for ethereal quality
    this.reverb = this.createReverb()
    this.reverb.connect(this.masterGain)

    const reverbGain = this.ctx.createGain()
    reverbGain.gain.value = 0.8
    reverbGain.connect(this.reverb)

    const dryGain = this.ctx.createGain()
    dryGain.gain.value = 0.2
    dryGain.connect(this.masterGain)

    // Create voices — each one is an oscillator with filter
    for (let i = 0; i < this.maxVoices; i++) {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const filter = this.ctx.createBiquadFilter()

      osc.type = i < 3 ? 'sine' : 'triangle'
      osc.frequency.value = SCALE_FREQS[Math.floor(Math.random() * SCALE_FREQS.length)]

      filter.type = 'lowpass'
      filter.frequency.value = 800 + Math.random() * 2000
      filter.Q.value = 1 + Math.random() * 3

      gain.gain.value = 0

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(reverbGain)
      gain.connect(dryGain)
      osc.start()

      this.voices.push({
        oscillator: osc,
        gainNode: gain,
        filterNode: filter,
        targetGain: 0,
        currentFreq: osc.frequency.value,
        targetFreq: osc.frequency.value,
        active: false,
      })
    }

    // Start the update loop — slowly evolve the harmonic content
    this.updateInterval = window.setInterval(() => this.evolve(), 3000)
  }

  private createReverb(): ConvolverNode {
    const ctx = this.ctx!
    const length = ctx.sampleRate * 8 // 8 second cathedral reverb
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        const t = i / length
        // Shaped decay with early reflections
        const earlyReflections = i < ctx.sampleRate * 0.1
          ? Math.random() * 0.5
          : 0
        data[i] = (Math.random() * 2 - 1 + earlyReflections) * Math.pow(1 - t, 3) * 0.3
      }
    }

    const convolver = ctx.createConvolver()
    convolver.buffer = impulse
    return convolver
  }

  /** Called by the main system with particle density information
   *  densities: array of 8 values (0-1) representing particle density
   *  in 8 spatial octants of the 3D space
   */
  updateParticleDensities(densities: number[]) {
    this.particleDensities = densities
  }

  private evolve() {
    if (!this.ctx || !this.isRunning) return
    const now = this.ctx.currentTime

    // Map particle densities to musical events
    // Higher density regions trigger notes; sparse regions fade voices

    for (let i = 0; i < this.maxVoices; i++) {
      const voice = this.voices[i]
      const regionIdx = i % this.particleDensities.length
      const density = this.particleDensities[regionIdx]

      if (density > 0.1) {
        // This region has particles — activate a voice

        // Choose a note from the scale, weighted by density
        // Higher density = higher octave (brighter memory)
        const octaveOffset = Math.floor(density * 10)
        const noteIdx = Math.min(
          Math.floor(Math.random() * 5) + octaveOffset,
          SCALE_FREQS.length - 1
        )
        const targetFreq = SCALE_FREQS[noteIdx]

        // Glide to new frequency
        voice.oscillator.frequency.linearRampToValueAtTime(targetFreq, now + 4)

        // Volume proportional to density
        const targetGain = density * 0.08
        voice.gainNode.gain.linearRampToValueAtTime(targetGain, now + 3)

        // Filter opens with density
        voice.filterNode.frequency.linearRampToValueAtTime(
          400 + density * 4000,
          now + 3
        )

        voice.active = true
      } else {
        // Sparse region — fade voice
        voice.gainNode.gain.linearRampToValueAtTime(0.001, now + 5)
        voice.active = false
      }
    }
  }

  destroy() {
    if (this.updateInterval) clearInterval(this.updateInterval)
    this.voices.forEach(v => v.oscillator.stop())
    this.ctx?.close()
  }
}
