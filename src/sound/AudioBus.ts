/**
 * AUDIO BUS — shared AudioContext singleton
 *
 * Browsers limit concurrent AudioContexts. All sound systems
 * share this one context and route through a master gain.
 */

let audioCtx: AudioContext | null = null
let masterGain: GainNode | null = null
let initPromise: Promise<AudioContext> | null = null

export async function getAudioContext(): Promise<AudioContext> {
  if (audioCtx) return audioCtx

  if (initPromise) return initPromise

  initPromise = new Promise<AudioContext>((resolve) => {
    const create = async () => {
      if (audioCtx) {
        resolve(audioCtx)
        return
      }
      audioCtx = new AudioContext()
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume()
      }
      masterGain = audioCtx.createGain()
      masterGain.gain.value = 1.0
      masterGain.connect(audioCtx.destination)
      resolve(audioCtx)

      window.removeEventListener('click', create)
      window.removeEventListener('touchstart', create)
      window.removeEventListener('keydown', create)
    }

    window.addEventListener('click', create)
    window.addEventListener('touchstart', create)
    window.addEventListener('keydown', create)
  })

  return initPromise
}

export function getAudioDestination(): AudioNode {
  if (masterGain) return masterGain
  // Fallback — shouldn't happen if getAudioContext() is awaited first
  throw new Error('AudioBus not initialized — call getAudioContext() first')
}
