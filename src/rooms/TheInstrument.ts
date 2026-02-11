/**
 * THE INSTRUMENT — the void becomes something you play
 *
 * A full synthesizer mapped to the keyboard. Two octaves of keys,
 * mouse controls filter and reverb, a delay loop records and
 * echoes your phrases. A waveform visualizer breathes in the center.
 *
 * This is not ambient background music — this is active creation.
 * The particle void pulses and shifts color with every note you play.
 * Your music is ephemeral — there's no save, no export. Play it,
 * hear it, let it dissolve.
 *
 * Key mapping (two octaves, chromatic):
 *   Lower: a w s e d f t g y h u j
 *   Upper: k o l p ; [ '
 *
 * Mouse Y → filter cutoff
 * Mouse X → delay feedback
 *
 * Inspired by: Moog synthesizers, Pocket Operator, the Theremin,
 * the idea that every instrument is also a forgetting machine
 */

import type { Room } from './RoomManager'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'
import { shareInstrumentNotes, fetchGhostNotes } from '../shared/FootprintReporter'

// Chromatic note mapping — two octaves starting from C3
const KEY_MAP: Record<string, number> = {
  // Lower octave: C3 to B3
  'a': 0, 'w': 1, 's': 2, 'e': 3, 'd': 4,
  'f': 5, 't': 6, 'g': 7, 'y': 8, 'h': 9, 'u': 10, 'j': 11,
  // Upper octave: C4 to E4
  'k': 12, 'o': 13, 'l': 14, 'p': 15, ';': 16, '[': 17, "'": 18,
}

const BASE_FREQ = 130.81 // C3

interface ActiveNote {
  key: string
  osc: OscillatorNode
  osc2: OscillatorNode
  env: GainNode
  freq: number
}

interface NoteParticle {
  x: number
  y: number
  vx: number
  vy: number
  hue: number
  alpha: number
  size: number
  birth: number
}

interface PortalParticle {
  x: number
  y: number
  vy: number
  hue: number
  alpha: number
  size: number
}

interface GhostKey {
  key: string
  label: string
  glow: number       // current glow intensity (0..1)
  targetGlow: number  // target glow
  hue: number
}

interface LoopEvent {
  time: number      // relative time within loop (0..loopLength)
  semitone: number
  velocity: number
  duration: number  // in seconds
}

interface NoteTrail {
  semitone: number
  hue: number
  alpha: number
  x: number  // normalized 0..1 position in canvas
}

const CULTURAL_INSCRIPTIONS = [
  'bob moog built the first modular synthesizer in 1964. sound as voltage. music as circuitry.',
  'pauline oliveros: "listen to everything all the time and remind yourself when you are not listening."',
  'wendy carlos, switched-on bach (1968): the first synth album to go platinum. classical music, transistorized.',
  'the theremin (1920): you play it by not touching it. the first electronic instrument is pure gesture.',
  'brian eno, music for airports (1978): "as ignorable as it is interesting." ambient as forgetting.',
  'the ondes martenot: instrument of radiohead and messiaen. a ribbon you never quite control.',
  'éliane radigue spent 3 years on a single ARP 2500 patch. one sound, perfected across months.',
  'neural resonance theory (2025): we don\'t just hear music — we become it. the brain physically synchronizes.',
  'korg phase8 (2026): an electromagnet excites tuned steel resonators. touch them. the physical world is the synth.',
  'cmu research (2026): AI music uses fewer notes, is judged less creative. human gesture remains irreplaceable.',
  'daphni, butterfly (2026): sixteen tracks of pure molten center. no intros, no outros. just being inside the sound.',
  'devon turnbull\'s listening room at cooper hewitt: the act of listening is the instrument.',
  '"i got rhythm" entered the public domain in 2026. melodies a century old, finally free to be forgotten.',
  'suno generates spotify\'s entire catalog every two weeks. 7 million songs per day. what is a song now?',
  'teenage engineering\'s choir at cooper hewitt: sonic sculptures with names and personalities, singing together.',
]

interface InstrumentDeps {
  onNote?: (freq: number, velocity: number) => void
  switchTo?: (name: string) => void
}

export function createInstrumentRoom(onNoteOrDeps?: ((freq: number, velocity: number) => void) | InstrumentDeps): Room {
  const instrumentDeps: InstrumentDeps = typeof onNoteOrDeps === 'function'
    ? { onNote: onNoteOrDeps }
    : (onNoteOrDeps ?? {})
  const onNote = instrumentDeps.onNote
  let overlay: HTMLElement | null = null
  let audioCtx: AudioContext | null = null
  let masterGain: GainNode | null = null
  let filterNode: BiquadFilterNode | null = null
  let delayNode: DelayNode | null = null
  let feedbackGain: GainNode | null = null
  let reverbNode: ConvolverNode | null = null
  let analyser: AnalyserNode | null = null
  let waveCanvas: HTMLCanvasElement | null = null
  let waveCtx: CanvasRenderingContext2D | null = null
  let activeNotes = new Map<string, ActiveNote>()
  let animFrameId = 0
  let active = false
  let waveformData: Uint8Array<ArrayBuffer> | null = null

  // Synth parameters
  let filterCutoff = 2000
  let delayFeedback = 0.3
  let waveType: OscillatorType = 'sawtooth'
  let detune = 7

  // Visual state
  let noteFlash = 0
  let lastNoteHue = 0
  let lastNotePitch = 0.5 // normalized 0..1 based on semitone

  // Cultural inscriptions
  let inscriptionTimer = 0
  let inscriptionIdx = Math.floor(Math.random() * CULTURAL_INSCRIPTIONS.length)

  // Idle ambient pad — fades in when no notes are being played
  let idlePadOsc1: OscillatorNode | null = null
  let idlePadOsc2: OscillatorNode | null = null
  let idlePadGain: GainNode | null = null
  let idlePadFilter: BiquadFilterNode | null = null
  let idleTime = 0  // seconds since last note
  let idlePadActive = false

  // Loop recorder — record a phrase, it plays back and degrades each pass
  let loopRecording = false
  let loopPlaying = false
  let loopEvents: LoopEvent[] = []
  let loopStartTime = 0
  let loopLength = 0
  let loopPlaybackStart = 0
  let loopPass = 0  // how many times the loop has replayed
  let loopDegradation = 0  // 0..1, increases each pass
  let loopScheduledNotes: number[] = []  // timeout IDs for scheduled notes
  let loopIndicatorAlpha = 0

  // Note history trail — recent notes leave fading marks on the waveform
  const noteTrails: NoteTrail[] = []
  const MAX_TRAILS = 40

  // Note particles — spawned on noteOn, drift outward and fade
  const noteParticles: NoteParticle[] = []
  const MAX_NOTE_PARTICLES = 100

  // Portal hover particles — emitted while hovering a portal band
  const portalParticles: PortalParticle[] = []

  // Ghost keyboard — faint key labels that light up when pressed
  const ghostKeys: GhostKey[] = []
  const LOWER_KEYS = ['a','w','s','e','d','f','t','g','y','h','u','j']
  const UPPER_KEYS = ['k','o','l','p',';','[',"'"]
  for (let i = 0; i < LOWER_KEYS.length; i++) {
    ghostKeys.push({ key: LOWER_KEYS[i], label: LOWER_KEYS[i], glow: 0, targetGlow: 0, hue: (i / 12) * 360 })
  }
  for (let i = 0; i < UPPER_KEYS.length; i++) {
    ghostKeys.push({ key: UPPER_KEYS[i], label: UPPER_KEYS[i] === ';' ? ';' : UPPER_KEYS[i] === '[' ? '[' : UPPER_KEYS[i] === "'" ? "'" : UPPER_KEYS[i], glow: 0, targetGlow: 0, hue: ((12 + i) / 12) * 360 })
  }

  // Cursor crosshair state — shows filter (Y) and echo (X)
  let cursorNormX = 0.3 // delay feedback normalized
  let cursorNormY = 0.5 // filter cutoff normalized

  // Portal band state — frequency zones on the waveform canvas
  const portalBands = [
    { name: 'study', label: 'the study', freqRange: [0, 0.2] as [number, number], hue: 200, hoverGlow: 0 },
    { name: 'choir', label: 'the choir', freqRange: [0.2, 0.4] as [number, number], hue: 280, hoverGlow: 0 },
    { name: 'pendulum', label: 'the pendulum', freqRange: [0.4, 0.6] as [number, number], hue: 45, hoverGlow: 0 },
    { name: 'disintegration', label: 'the disintegration loops', freqRange: [0.6, 0.8] as [number, number], hue: 15, hoverGlow: 0 },
    { name: 'void', label: 'the void', freqRange: [0.8, 1.0] as [number, number], hue: 320, hoverGlow: 0 },
  ]
  let hoveredBand = -1
  let clickedBand = -1
  let clickTime = 0

  // === GHOST PHRASE SYSTEM — involuntary musical memories ===
  // The instrument remembers what you played and replays fragments
  // at lower volume, gradually degrading — like earworms or déjà vu
  interface GhostNoteEvent {
    semitone: number
    time: number        // absolute timestamp (performance.now)
    velocity: number
  }
  interface GhostPhrase {
    notes: GhostNoteEvent[]
    scheduledIds: number[]
    replayCount: number
    maxReplays: number
    degradation: number  // 0..1
    startedAt: number
  }
  const noteHistory: GhostNoteEvent[] = []
  const ghostPhrases: GhostPhrase[] = []
  let lastNoteOnTime = 0
  let ghostCheckTimer = 0
  const MAX_GHOST_PHRASES = 3
  const MAX_NOTE_HISTORY = 80

  // === SHARED GHOST NOTES — melodies from other visitors ===
  const shareBuffer: Array<{ semitone: number; velocity: number }> = []
  let shareFlushTimer = 0
  let remoteGhostLoaded = false

  function flushShareBuffer() {
    if (shareBuffer.length === 0) return
    shareInstrumentNotes([...shareBuffer])
    shareBuffer.length = 0
  }

  async function loadRemoteGhosts() {
    if (remoteGhostLoaded) return
    remoteGhostLoaded = true
    const data = await fetchGhostNotes()
    if (!data || !data.phrases || data.phrases.length === 0) return
    // Inject remote phrases as ghost phrases with cyan hue and higher degradation
    for (const remotePhrase of data.phrases) {
      if (ghostPhrases.length >= MAX_GHOST_PHRASES + 2) break // allow up to 5 for remote
      const now = performance.now()
      const phrase: GhostPhrase = {
        notes: remotePhrase.map((n, i) => ({
          semitone: n.semitone,
          velocity: (n.velocity || 0.6) * 0.5, // quieter
          time: now + i * (200 + Math.random() * 300), // reconstruct timing
        })),
        scheduledIds: [],
        replayCount: 0,
        maxReplays: 2, // fewer replays for remote
        degradation: 0.25, // start degraded
        startedAt: now,
      }
      ghostPhrases.push(phrase)
      // Delay scheduling so they arrive staggered
      setTimeout(() => {
        if (active) scheduleGhostReplay(phrase)
      }, 3000 + Math.random() * 8000)
    }
  }

  // === SYMPATHETIC RESONANCE — harmonically related notes ring softly ===
  // Like a piano with sustain pedal: unplayed strings vibrate in sympathy
  interface SympatheticNote {
    osc: OscillatorNode
    gain: GainNode
    semitone: number
  }
  const sympatheticNotes: SympatheticNote[] = []

  // === VISUAL EVOLUTION — waveform memory ===
  // The canvas accumulates traces of past waveforms, building up
  // like geological strata of sound
  let traceCanvas: HTMLCanvasElement | null = null
  let traceCtx: CanvasRenderingContext2D | null = null
  let playDuration = 0  // total seconds of active playing
  let traceOpacity = 0  // builds up over time

  // === HARMONIC BLOOM — visual response to intervals ===
  interface HarmonicBloom {
    x: number
    y: number
    radius: number
    maxRadius: number
    hue: number
    consonance: number  // 0=dissonant, 1=consonant
    alpha: number
    birth: number
  }
  const harmonicBlooms: HarmonicBloom[] = []

  // === LISTENING MODE — deep listening as interaction ===
  let listeningMode = false
  let listeningFade = 0  // 0..1

  function semitoneToFreq(semitone: number): number {
    return BASE_FREQ * Math.pow(2, semitone / 12)
  }

  async function initAudio() {
    if (audioCtx) return

    audioCtx = await getAudioContext()

    // Master gain
    masterGain = audioCtx.createGain()
    masterGain.gain.value = 0.25

    // Analyser for waveform
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048
    waveformData = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>

    // Filter
    filterNode = audioCtx.createBiquadFilter()
    filterNode.type = 'lowpass'
    filterNode.frequency.value = filterCutoff
    filterNode.Q.value = 4

    // Delay with feedback
    delayNode = audioCtx.createDelay(2.0)
    delayNode.delayTime.value = 0.375 // dotted eighth

    feedbackGain = audioCtx.createGain()
    feedbackGain.gain.value = delayFeedback

    // Reverb
    reverbNode = createReverb(audioCtx)

    // Signal chain: filter → analyser → master → destination
    //                    ↓
    //              delay → feedback → filter (loop)
    //                    ↓
    //              reverb → master
    const dryGain = audioCtx.createGain()
    dryGain.gain.value = 0.6
    const wetGain = audioCtx.createGain()
    wetGain.gain.value = 0.4

    filterNode.connect(analyser)
    analyser.connect(dryGain)
    dryGain.connect(masterGain)

    filterNode.connect(delayNode)
    delayNode.connect(feedbackGain)
    feedbackGain.connect(filterNode) // feedback loop

    delayNode.connect(reverbNode)
    reverbNode.connect(wetGain)
    wetGain.connect(masterGain)

    masterGain.connect(getAudioDestination())

    // Initialize idle ambient pad
    initIdlePad(audioCtx)
  }

  function initIdlePad(ctx: AudioContext) {
    idlePadGain = ctx.createGain()
    idlePadGain.gain.value = 0
    idlePadFilter = ctx.createBiquadFilter()
    idlePadFilter.type = 'lowpass'
    idlePadFilter.frequency.value = 400
    idlePadFilter.Q.value = 1

    // Two detuned oscillators: C2 and G2 (fundamental + fifth)
    idlePadOsc1 = ctx.createOscillator()
    idlePadOsc1.type = 'sine'
    idlePadOsc1.frequency.value = 65.41 // C2
    idlePadOsc2 = ctx.createOscillator()
    idlePadOsc2.type = 'sine'
    idlePadOsc2.frequency.value = 98.0  // G2
    idlePadOsc2.detune.value = 3

    idlePadOsc1.connect(idlePadFilter)
    idlePadOsc2.connect(idlePadFilter)
    idlePadFilter.connect(idlePadGain!)
    idlePadGain!.connect(getAudioDestination())

    idlePadOsc1.start()
    idlePadOsc2.start()
    idlePadActive = true
  }

  function updateIdlePad(dt: number) {
    if (!idlePadGain || !audioCtx) return
    if (activeNotes.size > 0 || loopPlaying) {
      idleTime = 0
    } else {
      idleTime += dt
    }
    // Fade in pad after 3 seconds idle, max volume 0.04
    const targetGain = idleTime > 3 ? Math.min(0.04, (idleTime - 3) * 0.004) : 0
    idlePadGain.gain.linearRampToValueAtTime(targetGain, audioCtx.currentTime + 0.1)
    // Slow filter sweep on the pad
    if (idlePadFilter) {
      const sweep = 300 + 200 * Math.sin(idleTime * 0.15)
      idlePadFilter.frequency.linearRampToValueAtTime(sweep, audioCtx.currentTime + 0.1)
    }
  }

  // --- Loop Recorder ---
  function startLoopRecording() {
    loopEvents = []
    loopRecording = true
    loopPlaying = false
    loopStartTime = performance.now()
    loopPass = 0
    loopDegradation = 0
    clearLoopSchedule()
  }

  function stopLoopRecording() {
    loopRecording = false
    loopLength = (performance.now() - loopStartTime) / 1000
    if (loopEvents.length > 0 && loopLength > 0.2) {
      loopPlaying = true
      loopPass = 0
      loopDegradation = 0
      scheduleLoopPlayback()
    }
  }

  function recordNoteEvent(semitone: number, velocity: number) {
    if (!loopRecording) return
    const relTime = (performance.now() - loopStartTime) / 1000
    loopEvents.push({ time: relTime, semitone, velocity, duration: 0.15 })
  }

  function clearLoopSchedule() {
    for (const id of loopScheduledNotes) {
      clearTimeout(id)
    }
    loopScheduledNotes = []
  }

  function scheduleLoopPlayback() {
    if (!loopPlaying || !audioCtx || !filterNode) return
    clearLoopSchedule()
    loopPlaybackStart = performance.now()

    for (const ev of loopEvents) {
      // Degradation: skip notes randomly, detune, reduce velocity
      if (Math.random() < loopDegradation * 0.4) continue // drop notes

      const detuneOffset = (Math.random() - 0.5) * loopDegradation * 100 // cents
      const velScale = Math.max(0.05, 1 - loopDegradation * 0.6)

      const id = window.setTimeout(() => {
        if (!loopPlaying || !audioCtx || !filterNode) return
        const freq = semitoneToFreq(ev.semitone)
        const now = audioCtx.currentTime

        const env = audioCtx.createGain()
        env.gain.setValueAtTime(0, now)
        env.gain.linearRampToValueAtTime(ev.velocity * velScale * 0.25, now + 0.01)
        env.gain.setTargetAtTime(0.001, now + 0.01, ev.duration * 0.8)

        const osc = audioCtx.createOscillator()
        osc.type = waveType
        osc.frequency.value = freq
        osc.detune.value = detune + detuneOffset

        osc.connect(env)
        env.connect(filterNode!)

        osc.start(now)
        osc.stop(now + ev.duration + 0.3)

        // Visual: note flash
        noteFlash = Math.max(noteFlash, 0.3 * velScale)
        lastNoteHue = (ev.semitone % 12) / 12 * 360

        // Add to trail
        noteTrails.push({
          semitone: ev.semitone,
          hue: lastNoteHue,
          alpha: 0.5 * velScale,
          x: ev.time / loopLength,
        })
        while (noteTrails.length > MAX_TRAILS) noteTrails.shift()
      }, ev.time * 1000)

      loopScheduledNotes.push(id)
    }

    // Schedule next pass
    const nextPassId = window.setTimeout(() => {
      if (!loopPlaying) return
      loopPass++
      loopDegradation = Math.min(0.95, loopPass * 0.08) // degrades ~8% per pass
      if (loopDegradation >= 0.95) {
        // Loop has fully decayed — silence
        loopPlaying = false
        clearLoopSchedule()
      } else {
        scheduleLoopPlayback()
      }
    }, loopLength * 1000)
    loopScheduledNotes.push(nextPassId)
  }

  function stopLoop() {
    loopPlaying = false
    loopRecording = false
    clearLoopSchedule()
  }

  // === GHOST PHRASE FUNCTIONS ===

  function recordToHistory(semitone: number, velocity: number) {
    noteHistory.push({ semitone, time: performance.now(), velocity })
    lastNoteOnTime = performance.now()
    while (noteHistory.length > MAX_NOTE_HISTORY) noteHistory.shift()
    // Buffer for sharing with other visitors
    shareBuffer.push({ semitone, velocity })
  }

  function checkForGhostPhrase() {
    if (ghostPhrases.length >= MAX_GHOST_PHRASES) return
    if (noteHistory.length < 4) return

    // Extract a random phrase fragment (3-8 notes from recent history)
    const phraseLen = 3 + Math.floor(Math.random() * 6)
    const startIdx = Math.max(0, noteHistory.length - 20 - Math.floor(Math.random() * 20))
    const fragment = noteHistory.slice(startIdx, startIdx + phraseLen)
    if (fragment.length < 3) return

    const phrase: GhostPhrase = {
      notes: fragment.map(n => ({ ...n })),
      scheduledIds: [],
      replayCount: 0,
      maxReplays: 3 + Math.floor(Math.random() * 4),
      degradation: 0,
      startedAt: performance.now(),
    }
    ghostPhrases.push(phrase)
    scheduleGhostReplay(phrase)
  }

  function scheduleGhostReplay(phrase: GhostPhrase) {
    if (!audioCtx || !filterNode || !active) return
    // Clear previous schedule
    for (const id of phrase.scheduledIds) clearTimeout(id)
    phrase.scheduledIds = []

    const baseTime = phrase.notes[0].time
    const detuneAmount = phrase.degradation * 150 // cents of detune
    const volScale = Math.max(0.03, 0.12 * (1 - phrase.degradation * 0.7))

    for (const note of phrase.notes) {
      // Random note dropout with degradation
      if (Math.random() < phrase.degradation * 0.5) continue

      const relTime = (note.time - baseTime)
      // Add timing jitter with degradation
      const jitter = (Math.random() - 0.5) * phrase.degradation * 200
      const delay = Math.max(0, relTime + jitter)

      const id = window.setTimeout(() => {
        if (!audioCtx || !filterNode || !active) return
        const freq = semitoneToFreq(note.semitone)
        const now = audioCtx.currentTime

        const env = audioCtx.createGain()
        env.gain.setValueAtTime(0, now)
        env.gain.linearRampToValueAtTime(volScale * note.velocity, now + 0.02)
        env.gain.setTargetAtTime(0.001, now + 0.02, 0.2)

        const osc = audioCtx.createOscillator()
        osc.type = 'triangle'  // softer timbre for ghosts
        osc.frequency.value = freq
        osc.detune.value = detune + (Math.random() - 0.5) * detuneAmount

        osc.connect(env)
        env.connect(filterNode!)

        osc.start(now)
        osc.stop(now + 0.4)

        // Ghost visual — dim particles
        if (waveCanvas) {
          const cx = waveCanvas.width / 2
          const cy = waveCanvas.height / 2
          const ghostHue = (note.semitone % 12) / 12 * 360
          noteParticles.push({
            x: cx + (Math.random() - 0.5) * 100,
            y: cy + (Math.random() - 0.5) * 40,
            vx: (Math.random() - 0.5) * 0.5,
            vy: -0.3 - Math.random() * 0.5,
            hue: ghostHue,
            alpha: 0.15 * (1 - phrase.degradation),
            size: 1 + Math.random() * 1.5,
            birth: performance.now(),
          })
        }

        // Light ghost key dimly
        const gk = ghostKeys.find(g => KEY_MAP[g.key] === note.semitone)
        if (gk) {
          gk.targetGlow = Math.max(gk.targetGlow, 0.3 * (1 - phrase.degradation))
          gk.hue = (note.semitone % 12) / 12 * 360
          setTimeout(() => { gk.targetGlow = 0 }, 150)
        }
      }, delay)

      phrase.scheduledIds.push(id)
    }

    // Schedule next replay
    const phraseLength = phrase.notes[phrase.notes.length - 1].time - baseTime
    const nextDelay = phraseLength + 2000 + Math.random() * 4000
    const nextId = window.setTimeout(() => {
      phrase.replayCount++
      phrase.degradation = Math.min(0.95, phrase.replayCount / phrase.maxReplays)
      if (phrase.replayCount >= phrase.maxReplays) {
        // Ghost has fully faded
        const idx = ghostPhrases.indexOf(phrase)
        if (idx >= 0) ghostPhrases.splice(idx, 1)
      } else {
        scheduleGhostReplay(phrase)
      }
    }, nextDelay)
    phrase.scheduledIds.push(nextId)
  }

  function clearGhostPhrases() {
    for (const phrase of ghostPhrases) {
      for (const id of phrase.scheduledIds) clearTimeout(id)
    }
    ghostPhrases.length = 0
  }

  // === SYMPATHETIC RESONANCE FUNCTIONS ===

  function triggerSympatheticResonance(semitone: number) {
    if (!audioCtx || !filterNode) return
    const dest = getAudioDestination()
    // Intervals that resonate: octave (12), fifth (7), fourth (5), major third (4)
    const resonantIntervals = [12, -12, 7, -7, 5, 4]
    for (const interval of resonantIntervals) {
      const resSemitone = semitone + interval
      if (resSemitone < 0 || resSemitone > 18) continue
      // Don't resonate notes already being played
      if ([...activeNotes.values()].some(n => KEY_MAP[n.key] === resSemitone)) continue
      // Don't stack too many sympathetics
      if (sympatheticNotes.length >= 6) break

      const freq = semitoneToFreq(resSemitone)
      const now = audioCtx.currentTime

      const gain = audioCtx.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.02, now + 0.3) // very quiet
      gain.gain.setTargetAtTime(0.001, now + 0.3, 1.5)   // long fade

      const osc = audioCtx.createOscillator()
      osc.type = 'sine' // pure sine for sympathetic resonance
      osc.frequency.value = freq
      osc.detune.value = (Math.random() - 0.5) * 4 // tiny detune

      osc.connect(gain)
      gain.connect(filterNode)

      osc.start(now)
      osc.stop(now + 3)

      const sn: SympatheticNote = { osc, gain, semitone: resSemitone }
      sympatheticNotes.push(sn)

      // Light the ghost key very faintly
      const gk = ghostKeys.find(g => KEY_MAP[g.key] === resSemitone)
      if (gk) {
        gk.targetGlow = Math.max(gk.targetGlow, 0.15)
        gk.hue = (resSemitone % 12) / 12 * 360
      }

      // Clean up after done
      setTimeout(() => {
        const idx = sympatheticNotes.indexOf(sn)
        if (idx >= 0) sympatheticNotes.splice(idx, 1)
        if (gk && gk.targetGlow <= 0.15) gk.targetGlow = 0
      }, 3000)
    }
  }

  // === HARMONIC BLOOM FUNCTIONS ===

  function checkHarmonicIntervals() {
    if (!waveCanvas) return
    const held = [...activeNotes.values()].map(n => KEY_MAP[n.key]).filter(s => s !== undefined)
    if (held.length < 2) return

    // Check all pairs
    for (let i = 0; i < held.length; i++) {
      for (let j = i + 1; j < held.length; j++) {
        const interval = Math.abs(held[i] - held[j]) % 12
        // Consonance rating: 0=unison, 7=fifth, 5=fourth, 4/3=thirds are consonant
        const consonantIntervals: Record<number, number> = {
          0: 1, 7: 0.95, 5: 0.85, 4: 0.8, 3: 0.75, 8: 0.7, 9: 0.7,
        }
        const consonance = consonantIntervals[interval] ?? 0.2

        const cx = waveCanvas.width / 2 + (Math.random() - 0.5) * 100
        const cy = waveCanvas.height / 2 + (Math.random() - 0.5) * 40
        const avgSemitone = (held[i] + held[j]) / 2

        harmonicBlooms.push({
          x: cx,
          y: cy,
          radius: 0,
          maxRadius: consonance > 0.6 ? 60 + consonance * 80 : 20 + Math.random() * 30,
          hue: (avgSemitone % 12) / 12 * 360,
          consonance,
          alpha: 0.3,
          birth: performance.now(),
        })
      }
    }
    // Cap blooms
    while (harmonicBlooms.length > 15) harmonicBlooms.shift()
  }

  function createReverb(ctx: AudioContext): ConvolverNode {
    const length = ctx.sampleRate * 4
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch)
      for (let i = 0; i < length; i++) {
        const t = i / length
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.5) * 0.4
      }
    }
    const conv = ctx.createConvolver()
    conv.buffer = impulse
    return conv
  }

  function noteOn(key: string) {
    if (!audioCtx || !filterNode || activeNotes.has(key)) return
    const semitone = KEY_MAP[key]
    if (semitone === undefined) return

    const freq = semitoneToFreq(semitone)
    const now = audioCtx.currentTime

    // Envelope
    const env = audioCtx.createGain()
    env.gain.setValueAtTime(0, now)
    env.gain.linearRampToValueAtTime(0.35, now + 0.01)
    env.gain.setTargetAtTime(0.2, now + 0.01, 0.3)

    // Main oscillator
    const osc = audioCtx.createOscillator()
    osc.type = waveType
    osc.frequency.value = freq

    // Detuned second oscillator for thickness
    const osc2 = audioCtx.createOscillator()
    osc2.type = waveType === 'sawtooth' ? 'square' : 'triangle'
    osc2.frequency.value = freq
    osc2.detune.value = detune

    const osc2gain = audioCtx.createGain()
    osc2gain.gain.value = 0.15

    osc.connect(env)
    osc2.connect(osc2gain)
    osc2gain.connect(env)
    env.connect(filterNode)

    osc.start(now)
    osc2.start(now)

    activeNotes.set(key, { key, osc, osc2, env, freq })

    // Notify external systems
    onNote?.(freq, 0.35)

    // Record into loop if recording
    recordNoteEvent(semitone, 0.35)

    // Reset idle timer
    idleTime = 0

    // Visual feedback
    noteFlash = 1.0
    lastNoteHue = (semitone % 12) / 12 * 360
    lastNotePitch = semitone / 18 // normalize across the 19 semitone range

    // Add to note trail
    noteTrails.push({
      semitone,
      hue: lastNoteHue,
      alpha: 0.6,
      x: 0.5 + (Math.random() - 0.5) * 0.3,
    })
    while (noteTrails.length > MAX_TRAILS) noteTrails.shift()

    // Spawn note particles at canvas center
    if (waveCanvas) {
      const cx = waveCanvas.width / 2
      const cy = waveCanvas.height / 2
      const count = 5 + Math.floor(Math.random() * 4)
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 0.5 + Math.random() * 2
        noteParticles.push({
          x: cx + (Math.random() - 0.5) * 20,
          y: cy + (Math.random() - 0.5) * 10,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          hue: lastNoteHue,
          alpha: 0.6,
          size: 1.5 + Math.random() * 3,
          birth: performance.now(),
        })
      }
      // Trim to max
      while (noteParticles.length > MAX_NOTE_PARTICLES) {
        noteParticles.shift()
      }
    }

    // Light up ghost key
    const gk = ghostKeys.find(g => g.key === key)
    if (gk) {
      gk.targetGlow = 1
      gk.hue = lastNoteHue
    }

    // Record to ghost phrase history
    recordToHistory(semitone, 0.35)

    // Trigger sympathetic resonance
    triggerSympatheticResonance(semitone)

    // Check harmonic intervals for visual blooms
    checkHarmonicIntervals()
  }

  function noteOff(key: string) {
    const note = activeNotes.get(key)
    if (!note || !audioCtx) return

    const now = audioCtx.currentTime
    note.env.gain.cancelScheduledValues(now)
    note.env.gain.setValueAtTime(note.env.gain.value, now)
    note.env.gain.linearRampToValueAtTime(0.001, now + 0.3)

    // Clean up after release
    setTimeout(() => {
      note.osc.stop()
      note.osc2.stop()
    }, 400)

    activeNotes.delete(key)

    // Release ghost key
    const gk = ghostKeys.find(g => g.key === key)
    if (gk) {
      gk.targetGlow = 0
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!active) return
    const key = e.key.toLowerCase()
    if (KEY_MAP[key] !== undefined) {
      e.preventDefault()
      e.stopPropagation()
      noteOn(key)
    }
    // Right-click to cycle wave type
    if (key === '`') {
      cycleWaveType()
    }
    // R to toggle loop recording
    if (key === 'r') {
      e.preventDefault()
      if (loopRecording) {
        stopLoopRecording()
      } else if (loopPlaying) {
        stopLoop()
      } else {
        startLoopRecording()
      }
    }
    // Escape stops loop
    if (key === 'escape' && (loopPlaying || loopRecording)) {
      stopLoop()
    }
    // L to toggle listening mode
    if (key === 'l') {
      listeningMode = !listeningMode
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (!active) return
    const key = e.key.toLowerCase()
    if (KEY_MAP[key] !== undefined) {
      e.preventDefault()
      noteOff(key)
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (!active || !filterNode || !feedbackGain || !audioCtx) return
    // Y → filter cutoff (top = open, bottom = closed)
    const yRatio = 1 - (e.clientY / window.innerHeight)
    filterCutoff = 200 + yRatio * yRatio * 8000
    filterNode.frequency.linearRampToValueAtTime(filterCutoff, audioCtx.currentTime + 0.1)

    // X → delay feedback (left = dry, right = echoing)
    const xRatio = e.clientX / window.innerWidth
    delayFeedback = xRatio * 0.75
    feedbackGain.gain.linearRampToValueAtTime(delayFeedback, audioCtx.currentTime + 0.1)

    // Track for crosshair
    cursorNormX = xRatio
    cursorNormY = 1 - yRatio // flip so top=0 in canvas coords
  }

  let waveButtons: HTMLElement[] = []
  const WAVE_TYPES: OscillatorType[] = ['sawtooth', 'square', 'triangle', 'sine']

  function cycleWaveType() {
    const idx = WAVE_TYPES.indexOf(waveType)
    waveType = WAVE_TYPES[(idx + 1) % WAVE_TYPES.length]
    updateWaveButtons()
  }

  function updateWaveButtons() {
    for (const btn of waveButtons) {
      const isActive = btn.dataset.wave === waveType
      btn.style.color = isActive ? 'rgba(255, 20, 147, 0.8)' : 'rgba(255, 255, 255, 0.15)'
      btn.style.borderColor = isActive ? 'rgba(255, 20, 147, 0.4)' : 'rgba(255, 255, 255, 0.08)'
    }
  }

  function renderWaveform() {
    if (!waveCanvas || !waveCtx || !analyser || !waveformData) return

    analyser.getByteTimeDomainData(waveformData)

    const w = waveCanvas.width
    const h = waveCanvas.height
    const ctx = waveCtx
    const bandBarH = 20
    const ghostKeyH = 28 // height reserved for ghost keyboard at bottom (above portal bars)
    const now = performance.now()

    ctx.clearRect(0, 0, w, h)

    // === 1. AMBIENT GLOW BACKGROUND ===
    // Radial gradient that pulses with noteFlash, center shifts with pitch
    {
      const glowAlpha = 0.02 + noteFlash * 0.08
      const centerX = w * (0.35 + lastNotePitch * 0.3) // shifts with pitch
      const centerY = h * 0.45
      const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, w * 0.6)
      grad.addColorStop(0, `hsla(${lastNoteHue}, 60%, 50%, ${glowAlpha})`)
      grad.addColorStop(0.5, `hsla(${lastNoteHue}, 40%, 30%, ${glowAlpha * 0.4})`)
      grad.addColorStop(1, `hsla(${lastNoteHue}, 30%, 10%, 0)`)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)
    }

    // === 1b. WAVEFORM TRACES — visual memory of past sound ===
    if (traceCanvas && traceCtx && traceOpacity > 0.001) {
      // Draw current waveform onto trace canvas at very low opacity
      if (noteFlash > 0.1 || activeNotes.size > 0) {
        traceCtx.globalAlpha = 0.015
        traceCtx.strokeStyle = `hsla(${lastNoteHue}, 50%, 50%, 1)`
        traceCtx.lineWidth = 1
        traceCtx.beginPath()
        let x = 0
        const slw = w / waveformData.length
        for (let i = 0; i < waveformData.length; i++) {
          const v = waveformData[i] / 128.0
          const y2 = (v * h) / 2
          if (i === 0) traceCtx.moveTo(x, y2)
          else traceCtx.lineTo(x, y2)
          x += slw
        }
        traceCtx.stroke()
        traceCtx.globalAlpha = 1
      }

      // Slowly fade the trace canvas
      traceCtx.globalCompositeOperation = 'destination-out'
      traceCtx.fillStyle = 'rgba(0,0,0,0.002)'
      traceCtx.fillRect(0, 0, w, h)
      traceCtx.globalCompositeOperation = 'source-over'

      // Composite traces behind the live waveform
      ctx.globalAlpha = traceOpacity
      ctx.drawImage(traceCanvas, 0, 0)
      ctx.globalAlpha = 1
    }

    // === 1c. HARMONIC BLOOMS — visual response to intervals ===
    for (const bloom of harmonicBlooms) {
      if (bloom.alpha <= 0.01) continue
      if (bloom.consonance > 0.6) {
        // Consonant — smooth expanding circle
        const grad = ctx.createRadialGradient(bloom.x, bloom.y, 0, bloom.x, bloom.y, bloom.radius)
        grad.addColorStop(0, `hsla(${bloom.hue}, 60%, 65%, ${bloom.alpha * 0.4})`)
        grad.addColorStop(0.5, `hsla(${bloom.hue}, 50%, 50%, ${bloom.alpha * 0.15})`)
        grad.addColorStop(1, `hsla(${bloom.hue}, 40%, 40%, 0)`)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(bloom.x, bloom.y, bloom.radius, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // Dissonant — jagged interference pattern
        ctx.strokeStyle = `hsla(${bloom.hue}, 40%, 50%, ${bloom.alpha * 0.3})`
        ctx.lineWidth = 0.5
        const points = 8 + Math.floor(bloom.radius / 5)
        ctx.beginPath()
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2
          const jitter = (Math.sin(i * 7.3) * 0.4 + Math.cos(i * 3.1) * 0.3) * bloom.radius * 0.3
          const r = bloom.radius + jitter
          const px = bloom.x + Math.cos(angle) * r
          const py = bloom.y + Math.sin(angle) * r
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.stroke()
      }
    }

    // === 1d. LISTENING MODE OVERLAY ===
    if (listeningFade > 0.01) {
      // Deep blue-violet overlay
      ctx.fillStyle = `rgba(20, 10, 40, ${listeningFade * 0.3})`
      ctx.fillRect(0, 0, w, h)
      // "listening" text
      ctx.font = '13px "Cormorant Garamond", serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = `rgba(180, 160, 255, ${listeningFade * 0.3})`
      ctx.fillText('deep listening', w / 2, 20)
      // Breathing circle in center
      const breathe = 0.5 + 0.5 * Math.sin(now / 2000)
      const radius = 30 + breathe * 20
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, radius)
      grad.addColorStop(0, `rgba(140, 100, 220, ${listeningFade * 0.08})`)
      grad.addColorStop(1, `rgba(80, 50, 160, 0)`)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    // === 2. CURSOR CROSSHAIR (filter Y / echo X) ===
    {
      const crossX = cursorNormX * w
      const crossY = cursorNormY * (h - bandBarH - ghostKeyH)
      const crossAlpha = 0.06

      // Vertical line (echo / delay feedback)
      ctx.beginPath()
      ctx.moveTo(crossX, 0)
      ctx.lineTo(crossX, h - bandBarH - ghostKeyH)
      ctx.strokeStyle = `rgba(255, 255, 255, ${crossAlpha})`
      ctx.lineWidth = 0.5
      ctx.setLineDash([4, 6])
      ctx.stroke()
      ctx.setLineDash([])

      // Horizontal line (filter cutoff)
      ctx.beginPath()
      ctx.moveTo(0, crossY)
      ctx.lineTo(w, crossY)
      ctx.strokeStyle = `rgba(255, 255, 255, ${crossAlpha})`
      ctx.lineWidth = 0.5
      ctx.setLineDash([4, 6])
      ctx.stroke()
      ctx.setLineDash([])

      // Labels
      ctx.font = '9px monospace'
      ctx.fillStyle = `rgba(255, 255, 255, 0.08)`
      ctx.textAlign = 'left'
      ctx.fillText('filter', 4, crossY - 4)
      ctx.textAlign = 'center'
      ctx.fillText('echo', crossX, 10)
    }

    // === 3. PORTAL FREQUENCY BAND BARS (at the very bottom) ===
    for (let bi = 0; bi < portalBands.length; bi++) {
      const band = portalBands[bi]
      const x0 = Math.floor(band.freqRange[0] * w)
      const x1 = Math.floor(band.freqRange[1] * w)
      const bw = x1 - x0

      // Interpolate hover glow toward target
      const target = bi === hoveredBand ? 1 : 0
      band.hoverGlow += (target - band.hoverGlow) * 0.12

      // Idle pulse — each band pulses at a different rate, staggered by index
      const idlePulse = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(now / 2000 + bi * 1.3))

      // Flash white on click
      const isClicked = bi === clickedBand
      const clickElapsed = clickTime ? (now - clickTime) / 1000 : 1
      const clickFlash = isClicked ? Math.max(0, 1 - clickElapsed / 0.3) : 0

      // Bar background
      const baseAlpha = 0.06 + idlePulse * 0.03 + band.hoverGlow * 0.2 + clickFlash * 0.6
      if (clickFlash > 0) {
        const r = Math.round(255 * clickFlash + (1 - clickFlash) * 128)
        const g = Math.round(255 * clickFlash + (1 - clickFlash) * 128)
        const b2 = Math.round(255 * clickFlash + (1 - clickFlash) * 128)
        ctx.fillStyle = `rgba(${r}, ${g}, ${b2}, ${baseAlpha})`
      } else {
        ctx.fillStyle = `hsla(${band.hue}, 60%, 55%, ${baseAlpha})`
      }
      ctx.fillRect(x0, h - bandBarH, bw, bandBarH)

      // Top edge line of the bar
      const edgeAlpha = 0.08 + idlePulse * 0.04 + band.hoverGlow * 0.35
      ctx.beginPath()
      ctx.moveTo(x0, h - bandBarH)
      ctx.lineTo(x1, h - bandBarH)
      ctx.strokeStyle = `hsla(${band.hue}, 60%, 65%, ${edgeAlpha})`
      ctx.lineWidth = 0.5
      ctx.stroke()

      // Vertical separator between bands (except first)
      if (bi > 0) {
        ctx.beginPath()
        ctx.moveTo(x0, h - bandBarH)
        ctx.lineTo(x0, h)
        ctx.strokeStyle = `rgba(255, 255, 255, 0.04)`
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      // Label — always faintly visible, brighter on hover
      {
        const idleLabelAlpha = 0.08 + idlePulse * 0.04
        const labelAlpha = band.hoverGlow > 0.05
          ? band.hoverGlow * 0.7
          : idleLabelAlpha
        ctx.font = '11px "Cormorant Garamond", serif'
        ctx.textAlign = 'center'
        ctx.fillStyle = `hsla(${band.hue}, 50%, 75%, ${labelAlpha})`
        ctx.fillText(band.label, x0 + bw / 2, h - bandBarH - ghostKeyH - 6)
      }

      // === 5. PORTAL BAND HOVER PARTICLES ===
      if (bi === hoveredBand && band.hoverGlow > 0.3) {
        // Emit 2-3 particles per frame from this band zone
        const emitCount = 2 + Math.floor(Math.random() * 2)
        for (let ei = 0; ei < emitCount; ei++) {
          portalParticles.push({
            x: x0 + Math.random() * bw,
            y: h - bandBarH,
            vy: -(0.3 + Math.random() * 1.2),
            hue: band.hue,
            alpha: 0.3 + Math.random() * 0.2,
            size: 1 + Math.random() * 2,
          })
        }
      }
    }

    // Update and render portal particles
    for (let i = portalParticles.length - 1; i >= 0; i--) {
      const p = portalParticles[i]
      p.y += p.vy
      p.alpha -= 0.008
      if (p.alpha <= 0 || p.y < 0) {
        portalParticles.splice(i, 1)
        continue
      }
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${p.hue}, 70%, 65%, ${p.alpha})`
      ctx.fill()
    }
    // Cap portal particles
    while (portalParticles.length > 60) {
      portalParticles.shift()
    }

    // --- Handle delayed navigation on click ---
    if (clickedBand >= 0 && clickTime) {
      const elapsed = (now - clickTime) / 1000
      if (elapsed >= 0.3 && instrumentDeps.switchTo) {
        const dest = portalBands[clickedBand].name
        clickedBand = -1
        clickTime = 0
        instrumentDeps.switchTo(dest)
        return // stop rendering, we're navigating away
      }
    }

    // === 4. GHOST KEYBOARD (above portal bars) ===
    {
      const keyW = 22
      const keyH = 18
      const gap = 3
      const totalKeys = ghostKeys.length
      const totalW = totalKeys * (keyW + gap) - gap
      const startX = (w - totalW) / 2
      const keyY = h - bandBarH - ghostKeyH + 4

      ctx.font = '10px monospace'
      ctx.textAlign = 'center'

      for (let i = 0; i < ghostKeys.length; i++) {
        const gk = ghostKeys[i]
        // Smooth glow interpolation
        gk.glow += (gk.targetGlow - gk.glow) * 0.15

        const kx = startX + i * (keyW + gap)
        const ky = keyY

        // Key background
        const bgAlpha = 0.02 + gk.glow * 0.2
        if (gk.glow > 0.05) {
          ctx.fillStyle = `hsla(${gk.hue}, 70%, 55%, ${bgAlpha})`
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${bgAlpha})`
        }
        ctx.fillRect(kx, ky, keyW, keyH)

        // Key border
        const borderAlpha = 0.04 + gk.glow * 0.25
        ctx.strokeStyle = gk.glow > 0.05
          ? `hsla(${gk.hue}, 60%, 60%, ${borderAlpha})`
          : `rgba(255, 255, 255, ${borderAlpha})`
        ctx.lineWidth = 0.5
        ctx.strokeRect(kx, ky, keyW, keyH)

        // Key label
        const labelAlpha = 0.06 + gk.glow * 0.6
        ctx.fillStyle = gk.glow > 0.05
          ? `hsla(${gk.hue}, 60%, 75%, ${labelAlpha})`
          : `rgba(255, 255, 255, ${labelAlpha})`
        ctx.fillText(gk.label, kx + keyW / 2, ky + keyH - 4)
      }
    }

    // --- Draw waveform with per-band tinting ---
    const sliceWidth = w / waveformData.length

    // Note flash decays
    const alpha = 0.15 + noteFlash * 0.6
    noteFlash *= 0.95

    if (hoveredBand >= 0) {
      // Draw waveform in segments, tinting the hovered band's region
      for (let bi = 0; bi < portalBands.length; bi++) {
        const band = portalBands[bi]
        const startX = Math.floor(band.freqRange[0] * w)
        const endX = Math.floor(band.freqRange[1] * w)

        ctx.save()
        ctx.beginPath()
        ctx.rect(startX, 0, endX - startX, h)
        ctx.clip()

        ctx.beginPath()
        let x = 0
        for (let i = 0; i < waveformData.length; i++) {
          const v = waveformData[i] / 128.0
          const y = (v * h) / 2
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
          x += sliceWidth
        }

        if (bi === hoveredBand) {
          // Tint the waveform in this zone with the portal's color
          const tintAlpha = alpha + band.hoverGlow * 0.3
          ctx.strokeStyle = `hsla(${band.hue}, 80%, 65%, ${tintAlpha})`
          ctx.lineWidth = 2
        } else {
          ctx.strokeStyle = `hsla(${lastNoteHue}, 70%, 65%, ${alpha})`
          ctx.lineWidth = 1.5
        }
        ctx.stroke()
        ctx.restore()
      }
    } else {
      // No hover — draw waveform normally
      let x = 0
      ctx.beginPath()
      for (let i = 0; i < waveformData.length; i++) {
        const v = waveformData[i] / 128.0
        const y = (v * h) / 2
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += sliceWidth
      }
      ctx.strokeStyle = `hsla(${lastNoteHue}, 70%, 65%, ${alpha})`
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // Soft glow line at center
    ctx.beginPath()
    ctx.moveTo(0, h / 2)
    ctx.lineTo(w, h / 2)
    ctx.strokeStyle = `rgba(255, 20, 147, 0.05)`
    ctx.lineWidth = 0.5
    ctx.stroke()

    // === 1b. NOTE PARTICLES (rendered on top of waveform) ===
    for (let i = noteParticles.length - 1; i >= 0; i--) {
      const p = noteParticles[i]
      const age = (now - p.birth) / 1000
      if (age > 2.0 || p.alpha <= 0) {
        noteParticles.splice(i, 1)
        continue
      }
      // Update position
      p.x += p.vx
      p.y += p.vy
      // Slow down slightly
      p.vx *= 0.99
      p.vy *= 0.99
      // Fade out over lifetime
      p.alpha = Math.max(0, 0.6 * (1 - age / 2.0))

      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * (1 - age * 0.3), 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${p.hue}, 70%, 65%, ${p.alpha})`
      ctx.fill()
    }

    // === 6. NOTE HISTORY TRAIL (fading marks showing recent notes) ===
    for (const trail of noteTrails) {
      if (trail.alpha <= 0.01) continue
      const tx = trail.x * w
      const ty = h * 0.15 + (1 - trail.semitone / 18) * (h * 0.5)
      const radius = 2 + trail.alpha * 4
      const grad = ctx.createRadialGradient(tx, ty, 0, tx, ty, radius * 3)
      grad.addColorStop(0, `hsla(${trail.hue}, 60%, 60%, ${trail.alpha * 0.3})`)
      grad.addColorStop(1, `hsla(${trail.hue}, 40%, 40%, 0)`)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(tx, ty, radius * 3, 0, Math.PI * 2)
      ctx.fill()
      // Core dot
      ctx.fillStyle = `hsla(${trail.hue}, 70%, 75%, ${trail.alpha * 0.5})`
      ctx.beginPath()
      ctx.arc(tx, ty, radius * 0.5, 0, Math.PI * 2)
      ctx.fill()
    }

    // === 7. LOOP RECORDER INDICATOR ===
    if (loopIndicatorAlpha > 0.01) {
      const lx = 14
      const ly = 16
      if (loopRecording) {
        // Red recording dot
        ctx.fillStyle = `rgba(255, 60, 60, ${loopIndicatorAlpha})`
        ctx.beginPath()
        ctx.arc(lx, ly, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.font = '11px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(255, 60, 60, ${loopIndicatorAlpha * 0.7})`
        ctx.textAlign = 'left'
        ctx.fillText('recording...', lx + 10, ly + 4)
      } else if (loopPlaying) {
        // Loop playback indicator — degrades visually
        const passLabel = `loop pass ${loopPass + 1}`
        const degradeLabel = `${Math.round(loopDegradation * 100)}% degraded`
        ctx.font = '11px "Cormorant Garamond", serif'
        ctx.textAlign = 'left'
        // Loop progress bar
        const barW = 80
        const elapsed = ((performance.now() - loopPlaybackStart) / 1000) % loopLength
        const progress = elapsed / loopLength
        ctx.fillStyle = `rgba(255, 215, 0, ${loopIndicatorAlpha * 0.15})`
        ctx.fillRect(lx, ly - 5, barW, 8)
        ctx.fillStyle = `rgba(255, 215, 0, ${loopIndicatorAlpha * 0.4})`
        ctx.fillRect(lx, ly - 5, barW * progress, 8)
        // Labels
        ctx.fillStyle = `rgba(255, 215, 0, ${loopIndicatorAlpha * 0.6})`
        ctx.fillText(passLabel, lx, ly + 16)
        ctx.fillStyle = `rgba(255, 150, 150, ${loopIndicatorAlpha * 0.5})`
        ctx.fillText(degradeLabel, lx, ly + 30)
      }
    }

    // === 8. CULTURAL INSCRIPTION ===
    {
      const text = CULTURAL_INSCRIPTIONS[inscriptionIdx]
      // Fade in/out over the 22-second cycle
      let textAlpha = 0
      if (inscriptionTimer < 1.5) textAlpha = inscriptionTimer / 1.5
      else if (inscriptionTimer > 20) textAlpha = (22 - inscriptionTimer) / 2
      else textAlpha = 1
      textAlpha *= 0.04

      if (textAlpha > 0.002) {
        ctx.font = '11px "Cormorant Garamond", serif'
        ctx.textAlign = 'center'
        ctx.fillStyle = `rgba(255, 215, 0, ${textAlpha})`
        ctx.fillText(text, w / 2, h - bandBarH - ghostKeyH - 22, w * 0.85)
      }
    }
  }

  let lastAnimTime = 0
  function animate() {
    if (!active) return
    animFrameId = requestAnimationFrame(animate)

    const now = performance.now()
    const dt = lastAnimTime ? Math.min((now - lastAnimTime) / 1000, 0.1) : 0.016
    lastAnimTime = now

    // Update inscription timer
    inscriptionTimer += dt
    if (inscriptionTimer > 22) {
      inscriptionTimer = 0
      inscriptionIdx = (inscriptionIdx + 1) % CULTURAL_INSCRIPTIONS.length
    }

    // Update idle pad
    updateIdlePad(dt)

    // Fade note trails
    for (let i = noteTrails.length - 1; i >= 0; i--) {
      noteTrails[i].alpha -= dt * 0.08
      if (noteTrails[i].alpha <= 0) noteTrails.splice(i, 1)
    }

    // Loop indicator pulse
    if (loopRecording) {
      loopIndicatorAlpha = 0.5 + 0.5 * Math.sin(now / 300)
    } else if (loopPlaying) {
      // Fade with degradation
      loopIndicatorAlpha = Math.max(0.1, 0.6 * (1 - loopDegradation))
    } else {
      loopIndicatorAlpha *= 0.95
    }

    // Ghost phrase system — check if player stopped and spawn ghosts
    if (activeNotes.size > 0) {
      playDuration += dt
    }
    if (lastNoteOnTime > 0 && activeNotes.size === 0 && !loopPlaying) {
      ghostCheckTimer += dt
      if (ghostCheckTimer > 5 && noteHistory.length >= 4) {
        checkForGhostPhrase()
        ghostCheckTimer = -8 - Math.random() * 10 // wait 8-18s before next ghost
      }
    } else {
      ghostCheckTimer = 0
    }

    // Flush shared notes every 10s if there are buffered notes
    shareFlushTimer += dt
    if (shareFlushTimer > 10 && shareBuffer.length > 0) {
      flushShareBuffer()
      shareFlushTimer = 0
    }

    // Visual evolution — trace opacity builds with play duration
    traceOpacity = Math.min(0.4, playDuration * 0.002)

    // Listening mode fade
    const listenTarget = listeningMode ? 1 : 0
    listeningFade += (listenTarget - listeningFade) * dt * 2

    // Update harmonic blooms
    for (let i = harmonicBlooms.length - 1; i >= 0; i--) {
      const b = harmonicBlooms[i]
      const age = (now - b.birth) / 1000
      b.radius = b.maxRadius * Math.min(1, age * 2)
      b.alpha = Math.max(0, 0.3 * (1 - age / 2))
      if (b.alpha <= 0) harmonicBlooms.splice(i, 1)
    }

    renderWaveform()
  }

  return {
    name: 'instrument',
    label: 'the instrument',

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        height: 100%;
        pointer-events: auto;
        background: rgba(2, 1, 8, 0.7);
      `

      // Title
      const title = document.createElement('div')
      title.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 14px;
        color: rgba(255, 20, 147, 0.3);
        letter-spacing: 4px;
        margin-bottom: 32px;
        text-transform: lowercase;
      `
      title.textContent = 'play the void'
      overlay.appendChild(title)

      // Waveform canvas
      waveCanvas = document.createElement('canvas')
      waveCanvas.width = 600
      waveCanvas.height = 240
      waveCanvas.style.cssText = `
        width: 560px; max-width: 90vw;
        height: 216px;
        border: 1px solid rgba(255, 20, 147, 0.08);
        border-radius: 2px;
        margin-bottom: 24px;
      `
      waveCtx = waveCanvas.getContext('2d')!
      overlay.appendChild(waveCanvas)

      // Trace canvas for visual evolution (offscreen — same dimensions)
      traceCanvas = document.createElement('canvas')
      traceCanvas.width = 600
      traceCanvas.height = 240
      traceCtx = traceCanvas.getContext('2d')!

      // Keyboard hint
      const hint = document.createElement('div')
      hint.style.cssText = `
        font-family: monospace;
        font-size: 13px;
        color: rgba(255, 215, 0, 0.2);
        letter-spacing: 2px;
        margin-bottom: 8px;
        text-align: center;
        max-width: 500px;
        line-height: 2;
      `
      hint.innerHTML = `
        <span style="color: rgba(255, 20, 147, 0.35);">keys</span>
        a w s e d f t g y h u j · k o l p ; [ '
        <br>
        <span style="color: rgba(255, 20, 147, 0.35);">mouse</span>
        ↕ filter · ↔ echo
        <br>
        <span style="color: rgba(255, 20, 147, 0.35);">r</span>
        record loop · degrades each pass ·
        <span style="color: rgba(255, 20, 147, 0.35);">l</span>
        deep listening
      `
      overlay.appendChild(hint)

      // Wave type selector — clickable buttons
      const waveRow = document.createElement('div')
      waveRow.style.cssText = `
        display: flex; align-items: center; gap: 8px;
        margin-top: 16px;
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 13px;
        color: rgba(255, 255, 255, 0.15);
        letter-spacing: 1px;
      `
      const waveLabel = document.createElement('span')
      waveLabel.textContent = 'wave'
      waveLabel.style.cssText = 'margin-right: 4px;'
      waveRow.appendChild(waveLabel)

      waveButtons = []
      for (const type of WAVE_TYPES) {
        const btn = document.createElement('button')
        btn.dataset.wave = type
        btn.textContent = type
        btn.style.cssText = `
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 2px;
          color: rgba(255, 255, 255, 0.15);
          font-family: monospace;
          font-size: 13px;
          padding: 4px 10px;
          cursor: pointer;
          transition: color 0.3s ease, border-color 0.3s ease;
          letter-spacing: 1px;
        `
        btn.addEventListener('click', () => {
          waveType = type as OscillatorType
          updateWaveButtons()
        })
        btn.addEventListener('mouseenter', () => {
          if (btn.dataset.wave !== waveType) {
            btn.style.color = 'rgba(255, 215, 0, 0.4)'
          }
        })
        btn.addEventListener('mouseleave', () => {
          updateWaveButtons()
        })
        waveRow.appendChild(btn)
        waveButtons.push(btn)
      }

      overlay.appendChild(waveRow)
      updateWaveButtons()

      // Canvas-based portal band interaction
      if (instrumentDeps.switchTo) {
        waveCanvas.style.cursor = 'default'

        waveCanvas.addEventListener('mousemove', (e) => {
          const rect = waveCanvas!.getBoundingClientRect()
          const scaleX = waveCanvas!.width / rect.width
          const scaleY = waveCanvas!.height / rect.height
          const cx = (e.clientX - rect.left) * scaleX
          const cy = (e.clientY - rect.top) * scaleY
          const bandBarH = 20
          const h = waveCanvas!.height
          const w = waveCanvas!.width

          if (cy >= h - bandBarH) {
            // In the bar region — find which band
            const ratio = cx / w
            let found = -1
            for (let i = 0; i < portalBands.length; i++) {
              if (ratio >= portalBands[i].freqRange[0] && ratio < portalBands[i].freqRange[1]) {
                found = i
                break
              }
            }
            hoveredBand = found
            waveCanvas!.style.cursor = found >= 0 ? 'pointer' : 'default'
          } else {
            hoveredBand = -1
            waveCanvas!.style.cursor = 'default'
          }
        })

        waveCanvas.addEventListener('mouseleave', () => {
          hoveredBand = -1
          waveCanvas!.style.cursor = 'default'
        })

        waveCanvas.addEventListener('click', (e) => {
          if (hoveredBand >= 0 && clickedBand < 0) {
            clickedBand = hoveredBand
            clickTime = performance.now()
            e.stopPropagation()
          }
        })
      }

      return overlay
    },

    async activate() {
      active = true
      remoteGhostLoaded = false
      await initAudio()
      window.addEventListener('keydown', handleKeyDown, true)
      window.addEventListener('keyup', handleKeyUp, true)
      window.addEventListener('mousemove', handleMouseMove)
      animate()
      // Load ghost notes from other visitors after a short delay
      setTimeout(() => { if (active) loadRemoteGhosts() }, 5000)
    },

    deactivate() {
      active = false
      cancelAnimationFrame(animFrameId)
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      window.removeEventListener('mousemove', handleMouseMove)
      // Release all held notes
      for (const key of activeNotes.keys()) {
        noteOff(key)
      }
      // Stop loop playback
      stopLoop()
      // Stop ghost phrases
      clearGhostPhrases()
      // Flush remaining shared notes
      flushShareBuffer()
      // Reset listening mode
      listeningMode = false
      listeningFade = 0
      // Fade out idle pad
      if (idlePadGain && audioCtx) {
        idlePadGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5)
      }
    },

    destroy() {
      active = false
      cancelAnimationFrame(animFrameId)
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      window.removeEventListener('mousemove', handleMouseMove)
      for (const key of activeNotes.keys()) {
        noteOff(key)
      }
      stopLoop()
      clearGhostPhrases()
      // Stop idle pad oscillators
      try {
        idlePadOsc1?.stop()
        idlePadOsc2?.stop()
      } catch { /* already stopped */ }
      overlay?.remove()
    },
  }
}
