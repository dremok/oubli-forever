/**
 * AMBIENT TEXTURES — the void generates its own atmosphere
 *
 * Uses ElevenLabs Sound Effects API to generate procedural ambient
 * sounds from text descriptions of the void's current state. Each
 * drift state, each entropy phase, each time of day produces a
 * different atmospheric texture.
 *
 * Generated sounds loop seamlessly and crossfade between states.
 * The void literally sounds different depending on how it feels.
 *
 * Rate-limited: max 1 generation per 8 minutes. Textures are cached
 * in memory so returning to a state reuses the previous generation.
 *
 * Inspired by: Éliane Radigue's feedback works, field recordings,
 * Brian Eno's "Music for Airports" generative system, ASMR
 */

import { getAudioContext, getAudioDestination } from './AudioBus'

interface TextureLayer {
  buffer: AudioBuffer
  source: AudioBufferSourceNode | null
  gain: GainNode | null
  prompt: string
}

// Prompts keyed by drift state name
const DRIFT_PROMPTS: Record<string, string> = {
  void: 'deep space ambient drone with distant crystalline resonance and subtle wind',
  deep: 'underwater ambient sound with distant whale calls and deep ocean pressure',
  burn: 'crackling fire and distant volcanic rumble with hissing steam vents',
  garden: 'gentle rain on leaves with distant birdsong and soft wind through grass',
  archive: 'old library ambience with faint paper rustling and distant clock ticking',
}

// Entropy-dependent prompts
const ENTROPY_PROMPTS: Record<string, string> = {
  normal: '', // no extra texture in normal state
  accelerating: 'electrical interference and static buzzing with unstable radio signal',
  cascade: 'digital glitching and data corruption sounds with distorted feedback noise',
}

export class AmbientTextures {
  private apiKey: string
  private cache = new Map<string, AudioBuffer>()
  private currentLayer: TextureLayer | null = null
  private entropyLayer: TextureLayer | null = null
  private lastGenerationTime = 0
  private cooldownMs = 8 * 60 * 1000 // 8 minutes between generations
  private generating = false
  private hidden = false
  private currentDriftState = 'void'
  private currentEntropyPhase = 'normal'

  constructor() {
    this.apiKey = import.meta.env.ELEVENLABS_API_KEY || ''
  }

  isAvailable(): boolean {
    return !!this.apiKey
  }

  /** Called when drift state changes */
  async setDriftState(state: string) {
    if (state === this.currentDriftState) return
    this.currentDriftState = state
    await this.updateTexture()
  }

  /** Called when entropy phase changes */
  async setEntropyPhase(phase: string) {
    if (phase === this.currentEntropyPhase) return
    this.currentEntropyPhase = phase
    await this.updateEntropyTexture()
  }

  setVisible(v: boolean) {
    this.hidden = !v
    if (this.hidden) {
      this.fadeOut(this.currentLayer)
      this.fadeOut(this.entropyLayer)
    } else {
      this.fadeIn(this.currentLayer)
      this.fadeIn(this.entropyLayer)
    }
  }

  private async updateTexture() {
    if (!this.apiKey || this.hidden) return

    const prompt = DRIFT_PROMPTS[this.currentDriftState]
    if (!prompt) return

    // Check cache first
    const cached = this.cache.get(prompt)
    if (cached) {
      this.crossfadeTo(cached, prompt, 'drift')
      return
    }

    // Rate limit new generations
    if (!this.canGenerate()) return

    await this.generateAndPlay(prompt, 'drift')
  }

  private async updateEntropyTexture() {
    if (!this.apiKey || this.hidden) return

    const prompt = ENTROPY_PROMPTS[this.currentEntropyPhase]
    if (!prompt) {
      // Normal state — fade out entropy layer
      this.fadeOut(this.entropyLayer)
      this.entropyLayer = null
      return
    }

    const cached = this.cache.get(prompt)
    if (cached) {
      this.crossfadeTo(cached, prompt, 'entropy')
      return
    }

    if (!this.canGenerate()) return

    await this.generateAndPlay(prompt, 'entropy')
  }

  private canGenerate(): boolean {
    if (this.generating) return false
    const now = Date.now()
    return now - this.lastGenerationTime >= this.cooldownMs
  }

  private async generateAndPlay(prompt: string, layer: 'drift' | 'entropy') {
    this.generating = true
    this.lastGenerationTime = Date.now()

    try {
      const response = await fetch(
        'https://api.elevenlabs.io/v1/sound-generation',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey,
          },
          body: JSON.stringify({
            text: prompt,
            duration_seconds: 15,
            prompt_influence: 0.4,
            loop: true,
          }),
        }
      )

      if (!response.ok) {
        this.generating = false
        return
      }

      const arrayBuffer = await response.arrayBuffer()
      const ctx = await getAudioContext()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)

      // Cache for reuse
      this.cache.set(prompt, audioBuffer)

      this.crossfadeTo(audioBuffer, prompt, layer)
    } catch {
      // API error — silently continue
    } finally {
      this.generating = false
    }
  }

  private async crossfadeTo(buffer: AudioBuffer, prompt: string, layerType: 'drift' | 'entropy') {
    const ctx = await getAudioContext()
    const targetLayer = layerType === 'drift' ? this.currentLayer : this.entropyLayer

    // Fade out old layer
    if (targetLayer?.gain) {
      const oldGain = targetLayer.gain
      oldGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 3)
      setTimeout(() => {
        targetLayer.source?.stop()
        oldGain.disconnect()
      }, 3500)
    }

    // Create new layer
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    const gain = ctx.createGain()
    gain.gain.value = 0
    const targetVol = layerType === 'drift' ? 0.15 : 0.1

    source.connect(gain)
    gain.connect(getAudioDestination())

    source.start()
    gain.gain.linearRampToValueAtTime(
      this.hidden ? 0 : targetVol,
      ctx.currentTime + 4
    )

    const newLayer: TextureLayer = { buffer, source, gain, prompt }

    if (layerType === 'drift') {
      this.currentLayer = newLayer
    } else {
      this.entropyLayer = newLayer
    }
  }

  private async fadeOut(layer: TextureLayer | null) {
    if (!layer?.gain) return
    const ctx = await getAudioContext()
    layer.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2)
  }

  private async fadeIn(layer: TextureLayer | null) {
    if (!layer?.gain) return
    const ctx = await getAudioContext()
    const vol = layer === this.entropyLayer ? 0.1 : 0.15
    layer.gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 2)
  }

  destroy() {
    this.currentLayer?.source?.stop()
    this.entropyLayer?.source?.stop()
    this.currentLayer?.gain?.disconnect()
    this.entropyLayer?.gain?.disconnect()
  }
}
