/**
 * AMBIENT TEXTURES — the void generates its own atmosphere
 *
 * Each drift state and entropy phase has a pre-generated ambient
 * soundscape. Textures loop seamlessly and crossfade between states.
 * The void literally sounds different depending on how it feels.
 *
 * Audio files are pre-generated with ElevenLabs Sound Effects API
 * and stored as static assets — no runtime API calls needed.
 *
 * Inspired by: Éliane Radigue's feedback works, field recordings,
 * Brian Eno's "Music for Airports" generative system, ASMR
 */

import { getAudioContext, getAudioDestination } from './AudioBus'

interface TextureLayer {
  buffer: AudioBuffer
  source: AudioBufferSourceNode | null
  gain: GainNode | null
  key: string
}

// Pre-generated soundscape files keyed by drift state
const DRIFT_FILES: Record<string, string> = {
  void: '/assets/audio/ambient/drift-void.mp3',
  deep: '/assets/audio/ambient/drift-deep.mp3',
  burn: '/assets/audio/ambient/drift-burn.mp3',
  garden: '/assets/audio/ambient/drift-garden.mp3',
  archive: '/assets/audio/ambient/drift-archive.mp3',
}

// Pre-generated entropy soundscape files
const ENTROPY_FILES: Record<string, string> = {
  accelerating: '/assets/audio/ambient/entropy-accelerating.mp3',
  cascade: '/assets/audio/ambient/entropy-cascade.mp3',
}

export class AmbientTextures {
  private cache = new Map<string, AudioBuffer>()
  private currentLayer: TextureLayer | null = null
  private entropyLayer: TextureLayer | null = null
  private hidden = false
  private currentDriftState = 'void'
  private currentEntropyPhase = 'normal'

  isAvailable(): boolean {
    return true
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
    if (this.hidden) return

    const file = DRIFT_FILES[this.currentDriftState]
    if (!file) return

    const buffer = await this.loadBuffer(file)
    if (buffer) {
      this.crossfadeTo(buffer, file, 'drift')
    }
  }

  private async updateEntropyTexture() {
    if (this.hidden) return

    const file = ENTROPY_FILES[this.currentEntropyPhase]
    if (!file) {
      // Normal state — fade out entropy layer
      this.fadeOut(this.entropyLayer)
      this.entropyLayer = null
      return
    }

    const buffer = await this.loadBuffer(file)
    if (buffer) {
      this.crossfadeTo(buffer, file, 'entropy')
    }
  }

  private async loadBuffer(file: string): Promise<AudioBuffer | null> {
    // Check cache first
    const cached = this.cache.get(file)
    if (cached) return cached

    try {
      const response = await fetch(file)
      if (!response.ok) return null

      const arrayBuffer = await response.arrayBuffer()
      const ctx = await getAudioContext()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)

      this.cache.set(file, audioBuffer)
      return audioBuffer
    } catch {
      return null
    }
  }

  private async crossfadeTo(buffer: AudioBuffer, key: string, layerType: 'drift' | 'entropy') {
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

    const newLayer: TextureLayer = { buffer, source, gain, key }

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
