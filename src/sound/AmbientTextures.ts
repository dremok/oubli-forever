/**
 * AMBIENT TEXTURES — stub
 *
 * Previously used ElevenLabs Sound Effects API at runtime.
 * Now a no-op — the void's atmosphere is handled by the
 * generative sound engine in AudioBus.ts (drone + tonal engine).
 *
 * This class is kept for interface compatibility but does nothing.
 */

export class AmbientTextures {
  isAvailable(): boolean {
    return false
  }

  async setDriftState(_state: string) {
    // no-op
  }

  async setEntropyPhase(_phase: string) {
    // no-op
  }

  setVisible(_v: boolean) {
    // no-op
  }

  destroy() {
    // no-op
  }
}
