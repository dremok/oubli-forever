/**
 * RESONANCE MAP — the void as musical instrument
 *
 * Click anywhere in the void and it sings back. The pitch is
 * determined by vertical position (high = high pitch, low = low).
 * The timbre varies with horizontal position (left = pure sine,
 * right = complex harmonics). Each click creates a brief, bell-like
 * tone that decays into the ambient drone.
 *
 * The tones are pentatonic (no dissonance), so random clicking
 * always sounds musical. Each note leaves a visual ripple at the
 * click point — a circle that expands and fades.
 *
 * This transforms the void from something you observe into
 * something you play. Your clicks are a composition. Each note
 * is a small memory — heard once, then gone.
 *
 * Inspired by: Theremin, Brian Eno's "Music for Airports",
 * singing bowls, the idea that the universe is made of vibrating strings
 */

import { getAudioContext, getAudioDestination } from './AudioBus'

// Pentatonic scale — always consonant
const PENTATONIC = [0, 2, 4, 7, 9] // semitones from root

interface Ripple {
  x: number
  y: number
  radius: number
  alpha: number
  hue: number
  born: number
}

export class ResonanceMap {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private reverb: ConvolverNode | null = null
  private canvas: HTMLCanvasElement
  private drawCtx: CanvasRenderingContext2D
  private ripples: Ripple[] = []
  private width = 0
  private height = 0
  private dpr = 1
  private frameId = 0
  private animating = false
  private frame = 0
  private initialized = false
  private roomCheck: (() => string) | null = null

  constructor() {
    // Visual ripple canvas
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 110; pointer-events: none;
    `
    document.body.appendChild(this.canvas)
    this.drawCtx = this.canvas.getContext('2d')!
    this.resize()

    window.addEventListener('resize', () => this.resize())

    // Listen for clicks on the main canvas area
    window.addEventListener('click', (e) => {
      // Don't trigger when clicking UI elements
      const target = e.target as HTMLElement
      if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' ||
          target.tagName === 'A' || target.closest('[data-no-resonance]')) return

      // Only play notes in void room
      if (this.roomCheck && this.roomCheck() !== 'void') return

      this.playNote(e.clientX, e.clientY)
    })
  }

  private resize() {
    this.dpr = Math.min(window.devicePixelRatio, 2)
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = this.width * this.dpr
    this.canvas.height = this.height * this.dpr
    this.canvas.style.width = this.width + 'px'
    this.canvas.style.height = this.height + 'px'
    this.drawCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  /** Set a function that returns the current room name */
  setRoomCheck(check: () => string) {
    this.roomCheck = check
  }

  private async initAudio() {
    if (this.initialized) return
    this.initialized = true

    this.ctx = await getAudioContext()

    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 0.15
    this.masterGain.connect(getAudioDestination())

    // Create reverb for sustained decay
    this.reverb = this.createReverb()
    this.reverb.connect(this.masterGain)
  }

  private createReverb(): ConvolverNode {
    const ctx = this.ctx!
    const length = ctx.sampleRate * 3 // 3 second tail
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        const t = i / length
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3) * 0.3
      }
    }

    const convolver = ctx.createConvolver()
    convolver.buffer = impulse
    return convolver
  }

  private async playNote(x: number, y: number) {
    await this.initAudio()
    if (!this.ctx || !this.masterGain || !this.reverb) return

    // Map Y position to octave (top = high, bottom = low)
    const yRatio = 1 - (y / this.height) // 0 at bottom, 1 at top
    const octave = 3 + Math.floor(yRatio * 3) // octaves 3-5
    const baseFreq = 440 * Math.pow(2, octave - 4) // A in that octave

    // Pick a pentatonic note
    const noteIdx = Math.floor((y / this.height) * PENTATONIC.length) % PENTATONIC.length
    const semitones = PENTATONIC[noteIdx]
    const freq = baseFreq * Math.pow(2, semitones / 12)

    // Map X to timbre complexity
    const xRatio = x / this.width

    // Create the note
    const now = this.ctx.currentTime

    // Primary oscillator
    const osc = this.ctx.createOscillator()
    osc.type = xRatio < 0.3 ? 'sine' : xRatio < 0.6 ? 'triangle' : 'sine'
    osc.frequency.value = freq

    // Envelope — bell-like attack and decay
    const env = this.ctx.createGain()
    env.gain.setValueAtTime(0, now)
    env.gain.linearRampToValueAtTime(0.3, now + 0.01) // fast attack
    env.gain.exponentialRampToValueAtTime(0.001, now + 2.5) // slow decay

    // Filter — brighter notes at the top
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1000 + yRatio * 4000
    filter.Q.value = 1

    osc.connect(filter)
    filter.connect(env)
    env.connect(this.reverb)

    // Add a quiet harmonic for richness
    if (xRatio > 0.4) {
      const osc2 = this.ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.value = freq * 2 // octave above
      const env2 = this.ctx.createGain()
      env2.gain.setValueAtTime(0, now)
      env2.gain.linearRampToValueAtTime(0.05 * xRatio, now + 0.01)
      env2.gain.exponentialRampToValueAtTime(0.001, now + 1.5)
      osc2.connect(env2)
      env2.connect(this.reverb)
      osc2.start(now)
      osc2.stop(now + 2.5)
    }

    osc.start(now)
    osc.stop(now + 3)

    // Visual ripple
    const hue = 330 + yRatio * 60 // pink to gold
    this.ripples.push({
      x, y,
      radius: 0,
      alpha: 0.5,
      hue,
      born: this.frame,
    })

    if (!this.animating) {
      this.startAnimation()
    }
  }

  private startAnimation() {
    if (this.animating) return
    this.animating = true

    const animate = () => {
      this.frameId = requestAnimationFrame(animate)
      this.frame++
      this.renderRipples()
    }
    animate()
  }

  private renderRipples() {
    const ctx = this.drawCtx
    ctx.clearRect(0, 0, this.width, this.height)

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i]

      r.radius += 2.5
      r.alpha -= 0.005

      if (r.alpha <= 0) {
        this.ripples.splice(i, 1)
        continue
      }

      ctx.beginPath()
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
      ctx.strokeStyle = `hsla(${r.hue}, 70%, 60%, ${r.alpha})`
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Inner glow ring
      if (r.radius > 10) {
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.radius * 0.6, 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${r.hue}, 50%, 70%, ${r.alpha * 0.3})`
        ctx.lineWidth = 0.5
        ctx.stroke()
      }
    }

    // Stop animation when no more ripples
    if (this.ripples.length === 0) {
      cancelAnimationFrame(this.frameId)
      this.animating = false
    }
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
    this.canvas.remove()
  }
}
