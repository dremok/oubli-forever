/**
 * VOID WHISPER — the system finds its voice
 *
 * The void speaks aloud using pre-generated whisper audio clips.
 * When the DreamSynthesizer creates a dream, or when whispers
 * cycle through their fragments, the void occasionally plays
 * one of its stored utterances.
 *
 * The voice is a whisper — breathy, unstable, intimate. As entropy
 * rises (TippingPoint), audio processing degrades: the void stutters,
 * fragments, becomes distorted.
 *
 * Rate-limited: max 1 utterance per 3 minutes. The void speaks
 * sparingly — when it does, you listen.
 *
 * Audio files are pre-generated with ElevenLabs and stored as
 * static assets — no runtime API calls needed.
 */

import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

const WHISPER_FILES = [
  '/assets/audio/whisper-remember.mp3',
  '/assets/audio/whisper-forget.mp3',
  '/assets/audio/whisper-welcome.mp3',
  '/assets/audio/whisper-void.mp3',
  '/assets/audio/whisper-time.mp3',
  '/assets/audio/whisper-name.mp3',
  '/assets/audio/whisper-lost.mp3',
  '/assets/audio/whisper-door.mp3',
  '/assets/audio/whisper-between.mp3',
  '/assets/audio/whisper-dissolve.mp3',
]

export class VoidWhisper {
  private lastUtteranceTime = 0
  private cooldownMs = 3 * 60 * 1000 // 3 minutes between utterances
  private speaking = false
  private hidden = false
  private entropy = 0 // 0-1, from TippingPoint
  private currentSource: AudioBufferSourceNode | null = null
  private audioCache = new Map<string, AudioBuffer>()

  /** Called when a dream is synthesized — chance to vocalize it */
  async onDream(_dreamText: string) {
    if (!this.canSpeak()) return
    if (Math.random() > 0.4) return
    await this.speak()
  }

  /** Called when a whisper fragment cycles — rare vocalization */
  async onWhisper(_whisperText: string) {
    if (!this.canSpeak()) return
    if (Math.random() > 0.15) return
    await this.speak()
  }

  /** Set current entropy level (0-1) from TippingPoint */
  setEntropy(entropy: number) {
    this.entropy = entropy
  }

  setVisible(v: boolean) {
    this.hidden = !v
    if (this.hidden) this.stop()
  }

  isAvailable(): boolean {
    return WHISPER_FILES.length > 0
  }

  private canSpeak(): boolean {
    if (this.speaking || this.hidden) return false
    const now = Date.now()
    return now - this.lastUtteranceTime >= this.cooldownMs
  }

  private async speak() {
    this.speaking = true
    this.lastUtteranceTime = Date.now()

    try {
      // Pick a random whisper file
      const file = WHISPER_FILES[Math.floor(Math.random() * WHISPER_FILES.length)]

      // Check cache
      let audioBuffer = this.audioCache.get(file)
      if (!audioBuffer) {
        const response = await fetch(file)
        if (!response.ok) {
          this.speaking = false
          return
        }
        const arrayBuffer = await response.arrayBuffer()
        const ctx = await getAudioContext()
        audioBuffer = await ctx.decodeAudioData(arrayBuffer)
        this.audioCache.set(file, audioBuffer)
      }

      const ctx = await getAudioContext()
      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      this.currentSource = source

      // Playback rate affected by entropy
      source.playbackRate.value = 0.85 + this.entropy * 0.3

      // Create processing chain
      const gain = ctx.createGain()
      gain.gain.value = 0

      // Reverb-like delay for ethereal quality
      const delay = ctx.createDelay(1.0)
      delay.delayTime.value = 0.15
      const delayGain = ctx.createGain()
      delayGain.gain.value = 0.25
      delay.connect(delayGain)
      delayGain.connect(delay)
      delayGain.connect(gain)

      // Subtle filter — sounds like it's coming from far away
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 2500 - this.entropy * 1000
      filter.Q.value = 0.5

      source.connect(filter)
      filter.connect(gain)
      filter.connect(delay)
      gain.connect(getAudioDestination())

      // Fade in
      gain.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 1.5)

      // Fade out before end
      const duration = audioBuffer.duration
      if (duration > 2) {
        gain.gain.setValueAtTime(0.6, ctx.currentTime + duration - 1.5)
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration)
      }

      source.start()
      source.onended = () => {
        this.speaking = false
        this.currentSource = null
        gain.disconnect()
        filter.disconnect()
        delay.disconnect()
        delayGain.disconnect()
      }
    } catch {
      this.speaking = false
    }
  }

  stop() {
    if (this.currentSource) {
      try { this.currentSource.stop() } catch { /* already stopped */ }
      this.currentSource = null
    }
    this.speaking = false
  }

  destroy() {
    this.stop()
  }
}
