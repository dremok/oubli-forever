/**
 * VOID WHISPER — the system finds its voice
 *
 * The void has always spoken through text. Now it speaks aloud.
 * When the DreamSynthesizer creates a dream, or when whispers
 * cycle through their fragments, the void occasionally vocalizes
 * them through ElevenLabs TTS.
 *
 * The voice is a whisper — breathy, unstable, intimate. As entropy
 * rises (TippingPoint), voice stability decreases: the void stutters,
 * fragments, becomes incoherent.
 *
 * Rate-limited: max 1 utterance per 3 minutes. The void speaks
 * sparingly — when it does, you listen.
 *
 * Inspired by: ASMR culture, sleep-talking, EVP recordings,
 * the "voice" of HAL 9000 degrading, whispered confessions
 */

import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

export class VoidWhisper {
  private apiKey: string
  private lastUtteranceTime = 0
  private cooldownMs = 3 * 60 * 1000 // 3 minutes between utterances
  private speaking = false
  private hidden = false
  private entropy = 0 // 0-1, from TippingPoint
  private voiceId = 'pFZP5JQG7iQjIQuC4Bku' // "Lily" — soft, whisper-like
  private currentSource: AudioBufferSourceNode | null = null

  constructor() {
    this.apiKey = import.meta.env.ELEVENLABS_API_KEY || ''
  }

  /** Called when a dream is synthesized — chance to vocalize it */
  async onDream(dreamText: string) {
    if (!this.canSpeak()) return
    // 40% chance to speak dreams
    if (Math.random() > 0.4) return
    await this.speak(dreamText)
  }

  /** Called when a whisper fragment cycles — rare vocalization */
  async onWhisper(whisperText: string) {
    if (!this.canSpeak()) return
    // 15% chance to speak whispers
    if (Math.random() > 0.15) return
    await this.speak(whisperText)
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
    return !!this.apiKey
  }

  private canSpeak(): boolean {
    if (!this.apiKey || this.speaking || this.hidden) return false
    const now = Date.now()
    return now - this.lastUtteranceTime >= this.cooldownMs
  }

  private async speak(text: string) {
    this.speaking = true
    this.lastUtteranceTime = Date.now()

    try {
      // Degrade text based on entropy
      const degradedText = this.degradeText(text)

      // Voice settings degrade with entropy
      const stability = Math.max(0.1, 0.45 - this.entropy * 0.35)
      const similarity = Math.max(0.3, 0.7 - this.entropy * 0.3)
      const speed = 0.75 + this.entropy * 0.3 // gets faster/more frantic

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}?output_format=mp3_44100_64`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey,
          },
          body: JSON.stringify({
            text: degradedText,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability,
              similarity_boost: similarity,
              style: 0.15 + this.entropy * 0.4,
              speed,
            },
          }),
        }
      )

      if (!response.ok) {
        this.speaking = false
        return
      }

      const arrayBuffer = await response.arrayBuffer()
      const ctx = await getAudioContext()

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      this.currentSource = source

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
      filter.frequency.value = 2500 - this.entropy * 1000 // gets more muffled with entropy
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

  /** Degrade text based on entropy — the void loses coherence */
  private degradeText(text: string): string {
    if (this.entropy < 0.2) return text

    const words = text.split(/\s+/)
    const result: string[] = []

    for (const word of words) {
      // Higher entropy = more words dropped or corrupted
      if (Math.random() < this.entropy * 0.3) {
        // Drop word — insert ellipsis pause
        if (result.length > 0 && result[result.length - 1] !== '...') {
          result.push('...')
        }
        continue
      }

      if (Math.random() < this.entropy * 0.15) {
        // Repeat word (stuttering)
        result.push(word)
        result.push(word)
      } else {
        result.push(word)
      }
    }

    return result.join(' ') || text
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
