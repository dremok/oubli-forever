/**
 * ROOM AMBIENCE — each room has its own atmosphere
 *
 * Pre-generated ambient sounds that play when you enter a room.
 * Crossfades smoothly between rooms. Loops seamlessly.
 * Rooms without a specific sound get silence.
 *
 * This is separate from AmbientTextures (void-specific drift states).
 */

import { getAudioContext, getAudioDestination } from './AudioBus'

const ROOM_SOUNDS: Record<string, string> = {
  well: '/assets/audio/ambient/room-well.mp3',
  observatory: '/assets/audio/ambient/room-observatory.mp3',
  furnace: '/assets/audio/ambient/room-furnace.mp3',
  garden: '/assets/audio/ambient/room-garden.mp3',
  seance: '/assets/audio/ambient/room-seance.mp3',
  clocktower: '/assets/audio/ambient/room-clocktower.mp3',
}

const CROSSFADE_SECONDS = 3
const VOLUME = 0.12

export class RoomAmbience {
  private cache = new Map<string, AudioBuffer>()
  private currentSource: AudioBufferSourceNode | null = null
  private currentGain: GainNode | null = null
  private currentRoom = ''

  async setRoom(room: string) {
    if (room === this.currentRoom) return
    this.currentRoom = room

    // Fade out current
    if (this.currentGain) {
      const ctx = await getAudioContext()
      const oldGain = this.currentGain
      const oldSource = this.currentSource
      oldGain.gain.linearRampToValueAtTime(0, ctx.currentTime + CROSSFADE_SECONDS)
      setTimeout(() => {
        try { oldSource?.stop() } catch { /* */ }
        oldGain.disconnect()
      }, CROSSFADE_SECONDS * 1000 + 500)
      this.currentGain = null
      this.currentSource = null
    }

    const file = ROOM_SOUNDS[room]
    if (!file) return

    const buffer = await this.loadBuffer(file)
    if (!buffer || this.currentRoom !== room) return

    const ctx = await getAudioContext()
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    const gain = ctx.createGain()
    gain.gain.value = 0
    source.connect(gain)
    gain.connect(getAudioDestination())

    source.start()
    gain.gain.linearRampToValueAtTime(VOLUME, ctx.currentTime + CROSSFADE_SECONDS)

    this.currentSource = source
    this.currentGain = gain
  }

  private async loadBuffer(file: string): Promise<AudioBuffer | null> {
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

  destroy() {
    try { this.currentSource?.stop() } catch { /* */ }
    this.currentGain?.disconnect()
  }
}
