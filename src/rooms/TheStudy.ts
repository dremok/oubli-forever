/**
 * THE STUDY — a room for writing
 *
 * A focused, minimal writing environment. The particle void dims
 * to a barely-visible background. A large text area takes center
 * stage. The system generates writing prompts based on your previous
 * memories and the time of day.
 *
 * What you write here is saved alongside your dissolved memories,
 * but the text doesn't dissolve — it persists. The Study is where
 * memories are deliberately formed, in contrast to the Void where
 * they are deliberately forgotten.
 *
 * Features:
 * - Distraction-free writing with character/word count
 * - Generative writing prompts from your memory history
 * - Auto-save to localStorage
 * - Export as text file
 * - The ambient drone continues but softened
 * - Stoic philosophical inscriptions from the Stoic Quotes API
 * - Study-themed navigation portals (bookshelves, drawers, windows)
 *
 * Inspired by: iA Writer, Hemingway's standing desk,
 * Japanese tea ceremony (minimal, intentional, present),
 * Marcus Aurelius' Meditations, Seneca's Letters
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

const STORAGE_KEY = 'oubli-study'
const QUOTE_API = 'https://stoic-quotes.com/api/quote'
const QUOTE_INTERVAL_MS = 90_000
const QUOTE_VISIBLE_MS = 20_000
const QUOTE_FADE_MS = 2000

const PROMPTS_BASE = [
  'Write about a place you can no longer visit...',
  'Describe the last dream you remember...',
  'What sound do you associate with childhood?',
  'Write a letter to someone you\'ve lost touch with...',
  'Describe the taste of a memory...',
  'What does silence sound like in your mind?',
  'Write about something you wish you could forget...',
  'What color is your earliest memory?',
  'Describe the space between two heartbeats...',
  'Write about a door you never opened...',
  'What would you say to yourself from ten years ago?',
  'Describe the weight of a memory you carry...',
  'Write about something beautiful that no longer exists...',
  'What does the word "home" feel like?',
  'Describe a moment that changed everything...',

  // Feb 2026 — culturally grounded prompts
  'Confess: what is the most embarrassing version of yourself you try to forget?',
  'The mountains have no snow this year. Write about something that was always there until it wasn\'t...',
  'An eclipse is happening right now that almost no one will see. Describe a beautiful thing you witnessed alone...',
  'If your memories were made of used clothing, which garments would they be?',
  'Something emerged from nothing and existed for one second. Write about a brief, perfect moment...',
  'The void is not empty. What fills the emptiness you carry?',
  'Write about a landscape that has changed beyond recognition...',
  'A material that can be memory, logic, or learning — what would you choose to be right now?',

  // Feb 2026 — round 2 culturally grounded prompts
  'AI generates 7 million songs per day. Write about a song that could never be generated...',
  'Korg built a synth where you touch steel resonators to shape sound. What would you touch to shape a memory?',
  'Scientists say we don\'t hear music — we become it. What rhythm has your body memorized?',
  'A melody from 1926 just entered the public domain. What would you set free after 100 years?',
  'The Doomsday Clock reads 85 seconds to midnight. What would you write in the last 85 seconds?',
  'Devon Turnbull built a listening room as art. Describe the room where you listen best...',
  'An AI can now drive a rover on Mars. Write about a place only a machine has seen...',
  'The polar vortex is splitting. Write about something protective that broke apart...',

  // Feb 2026 — round 3 culturally grounded prompts
  'The Sagrada Familia has been building itself for 144 years. What in your life has been under construction that long?',
  'Two black holes merged and the ripple took a billion years to reach us. Write about a message that arrived too late...',
  'The universe is held together by something invisible. What invisible thing holds your life together?',
  'They traveled 240,000 miles to look at a place they could not touch. Write about something you can see but never reach...',
  '"Melted for love": what would you dissolve into if you could let go completely?',
  'In zero gravity, the body begins to forget its own weight. What would your body forget first?',
  'They built six buildings knowing everyone inside would leave in sixteen days. Write about a place built to be abandoned...',
  'LIGO heard two absences collide. Write about two losses that, together, created something new...',
]

// Fallback quotes for when the API is unreachable
const FALLBACK_QUOTES: Array<{ text: string; author: string }> = [
  { text: 'We suffer more often in imagination than in reality.', author: 'Seneca' },
  { text: 'The happiness of your life depends upon the quality of your thoughts.', author: 'Marcus Aurelius' },
  { text: 'Man is not worried by real problems so much as by his imagined anxieties about real problems.', author: 'Epictetus' },
  { text: 'It is not that we have a short time to live, but that we waste a great deal of it.', author: 'Seneca' },
  { text: 'You have power over your mind — not outside events. Realize this, and you will find strength.', author: 'Marcus Aurelius' },
  { text: 'No man is free who is not master of himself.', author: 'Epictetus' },
  { text: 'Begin at once to live, and count each separate day as a separate life.', author: 'Seneca' },
  { text: 'The soul becomes dyed with the colour of its thoughts.', author: 'Marcus Aurelius' },
  { text: 'First say to yourself what you would be; and then do what you have to do.', author: 'Epictetus' },
  { text: 'Loss is nothing else but change, and change is nature\'s delight.', author: 'Marcus Aurelius' },
]

interface StoicQuote {
  text: string
  author: string
}

interface StudyDeps {
  getMemories: () => StoredMemory[]
  onNewText?: (text: string) => void
  switchTo?: (name: string) => void
}

// Session-level quote cache to avoid repeats
const seenQuoteTexts = new Set<string>()

async function fetchStoicQuote(): Promise<StoicQuote> {
  try {
    const resp = await fetch(QUOTE_API)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json() as { text: string; author: string }
    if (!data.text || !data.author) throw new Error('Invalid response shape')
    return { text: data.text, author: data.author }
  } catch {
    // Fallback: pick a random fallback quote not yet seen
    const unseen = FALLBACK_QUOTES.filter(q => !seenQuoteTexts.has(q.text))
    const pool = unseen.length > 0 ? unseen : FALLBACK_QUOTES
    return pool[Math.floor(Math.random() * pool.length)]
  }
}

async function fetchUniqueQuote(): Promise<StoicQuote> {
  // Try up to 3 times to get a quote we haven't shown yet
  for (let attempt = 0; attempt < 3; attempt++) {
    const quote = await fetchStoicQuote()
    if (!seenQuoteTexts.has(quote.text)) {
      seenQuoteTexts.add(quote.text)
      return quote
    }
  }
  // If all attempts returned duplicates, just use the last one
  const quote = await fetchStoicQuote()
  seenQuoteTexts.add(quote.text)
  return quote
}

export function createStudyRoom(getMemoriesOrDeps: (() => StoredMemory[]) | StudyDeps, onNewText?: (text: string) => void): Room {
  // Support both old (positional) and new (deps object) signatures
  const deps: StudyDeps = typeof getMemoriesOrDeps === 'function'
    ? { getMemories: getMemoriesOrDeps, onNewText }
    : getMemoriesOrDeps
  const getMemories = deps.getMemories
  onNewText = deps.onNewText
  let overlay: HTMLElement | null = null
  let textarea: HTMLTextAreaElement | null = null
  let promptEl: HTMLElement | null = null
  let countEl: HTMLElement | null = null
  let saveInterval: number | null = null
  let quoteInterval: number | null = null
  let quoteTimeout: number | null = null
  let quoteEl: HTMLElement | null = null
  let quoteAuthorEl: HTMLElement | null = null
  let active = false
  let lastWordCount = 0

  // --- Audio state ---
  let audioNodes: {
    fireplaceNoise: AudioBufferSourceNode | null
    fireplaceGain: GainNode | null
    fireplaceFilter: BiquadFilterNode | null
    clockOsc: OscillatorNode | null
    clockGain: GainNode | null
    creakGain: GainNode | null
    masterGain: GainNode | null
  } = {
    fireplaceNoise: null, fireplaceGain: null, fireplaceFilter: null,
    clockOsc: null, clockGain: null, creakGain: null, masterGain: null,
  }
  let clockTickInterval: number | null = null
  let creakInterval: number | null = null
  let audioCtx: AudioContext | null = null

  // --- Visual state ---
  let atmosCanvas: HTMLCanvasElement | null = null
  let atmosCtx: CanvasRenderingContext2D | null = null
  let animFrame: number | null = null
  let mouseX = -1000
  let mouseY = -1000
  let mouseMoveHandler: ((e: MouseEvent) => void) | null = null

  // Dust motes
  interface DustMote {
    x: number; y: number; vx: number; vy: number
    size: number; alpha: number; warmth: number
  }
  const dustMotes: DustMote[] = []
  const DUST_COUNT = 40

  // Flicker state for oil lamp effect
  let flickerPhase = 0
  let flickerIntensity = 0.03

  // Writing streak warmth
  let lastKeyTime = 0
  let streakWarmth = 0 // 0-1, builds during continuous typing

  // Ink blot drops
  interface InkBlot {
    x: number; y: number
    radius: number; maxRadius: number
    alpha: number; age: number
    spreading: boolean
  }
  const inkBlots: InkBlot[] = []
  let lastBlotTime = 0
  let streakEndTime = 0

  // Word count milestones
  const MILESTONES = [100, 250, 500, 1000, 2000]
  let lastMilestone = 0
  let milestoneFlash = 0
  let milestoneLabel = ''

  // Margin notes (memory fragments that appear as you write)
  interface MarginNote {
    text: string
    y: number
    side: 'left' | 'right'
    alpha: number
    targetAlpha: number
  }
  const marginNotes: MarginNote[] = []
  let lastMarginNoteWord = 0

  function loadText(): string {
    try {
      return localStorage.getItem(STORAGE_KEY) || ''
    } catch { return '' }
  }

  function saveText(text: string) {
    try {
      localStorage.setItem(STORAGE_KEY, text)
    } catch { /* */ }
  }

  function generatePrompt(): string {
    const memories = getMemories()
    const memTexts = memories.map(m => m.currentText)

    // Sometimes use a memory-inspired prompt
    if (memTexts.length > 0 && Math.random() < 0.4) {
      const mem = memTexts[Math.floor(Math.random() * memTexts.length)]
      const words = mem.split(/\s+/).filter(w => w.length > 3)
      if (words.length > 0) {
        const word = words[Math.floor(Math.random() * words.length)]
        const templates = [
          `Write more about "${word}"...`,
          `What does "${word}" remind you of?`,
          `Continue the thought: "${mem}"`,
          `The word "${word}" appeared in the void. What does it mean to you?`,
        ]
        return templates[Math.floor(Math.random() * templates.length)]
      }
    }

    // Time-of-day prompts
    const hour = new Date().getHours()
    if (hour >= 0 && hour < 6 && Math.random() < 0.3) {
      return 'It\'s late. What keeps you awake?'
    }
    if (hour >= 6 && hour < 10 && Math.random() < 0.3) {
      return 'What did you dream about?'
    }

    return PROMPTS_BASE[Math.floor(Math.random() * PROMPTS_BASE.length)]
  }

  function updateCount() {
    if (!textarea || !countEl) return
    const text = textarea.value
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    const chars = text.length
    countEl.textContent = `${words} words \u00b7 ${chars} characters`

    // Check milestones
    for (const m of MILESTONES) {
      if (words >= m && lastMilestone < m) {
        lastMilestone = m
        milestoneFlash = 1.0
        milestoneLabel = `${m} words`
        playPageTurn()
        break
      }
    }

    // Spawn margin notes every ~50 words
    if (words >= lastMarginNoteWord + 50 && marginNotes.length < 12) {
      lastMarginNoteWord = words
      const memories = getMemories()
      if (memories.length > 0) {
        const mem = memories[Math.floor(Math.random() * memories.length)]
        const fragment = mem.currentText.split(' ').slice(0, 4).join(' ') + '...'
        const h = atmosCanvas?.height || window.innerHeight
        marginNotes.push({
          text: fragment,
          y: 80 + Math.random() * (h - 200),
          side: Math.random() < 0.5 ? 'left' : 'right',
          alpha: 0,
          targetAlpha: 0.06 + Math.random() * 0.04,
        })
      }
    }
  }

  function newPrompt() {
    if (promptEl) {
      promptEl.style.opacity = '0'
      setTimeout(() => {
        if (promptEl) {
          promptEl.textContent = generatePrompt()
          promptEl.style.opacity = '1'
        }
      }, 500)
    }
  }

  function exportText() {
    if (!textarea) return
    const text = textarea.value
    if (!text.trim()) return

    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `oubli-study-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  /** Show a stoic quote inscription with fade-in, hold, fade-out */
  async function showQuoteInscription() {
    if (!quoteEl || !quoteAuthorEl || !active) return

    const quote = await fetchUniqueQuote()
    if (!active) return // room may have been deactivated during fetch

    // Set text
    quoteEl.textContent = `\u201c${quote.text}\u201d`
    quoteAuthorEl.textContent = `\u2014 ${quote.author}`

    // Page-turn sound when quote appears
    playPageTurn()

    // Fade in
    quoteEl.style.transition = `opacity ${QUOTE_FADE_MS}ms ease-in`
    quoteAuthorEl.style.transition = `opacity ${QUOTE_FADE_MS}ms ease-in ${QUOTE_FADE_MS * 0.3}ms`
    quoteEl.style.opacity = '1'
    quoteAuthorEl.style.opacity = '1'

    // Hold, then fade out
    quoteTimeout = window.setTimeout(() => {
      if (!quoteEl || !quoteAuthorEl) return
      quoteEl.style.transition = `opacity ${QUOTE_FADE_MS}ms ease-out`
      quoteAuthorEl.style.transition = `opacity ${QUOTE_FADE_MS}ms ease-out`
      quoteEl.style.opacity = '0'
      quoteAuthorEl.style.opacity = '0'
    }, QUOTE_VISIBLE_MS)
  }

  function startQuoteCycle() {
    // Show first quote after a short delay so the room settles
    quoteTimeout = window.setTimeout(() => {
      showQuoteInscription()
    }, 2000)

    // Then periodically
    quoteInterval = window.setInterval(() => {
      showQuoteInscription()
    }, QUOTE_INTERVAL_MS)
  }

  function stopQuoteCycle() {
    if (quoteInterval) { clearInterval(quoteInterval); quoteInterval = null }
    if (quoteTimeout) { clearTimeout(quoteTimeout); quoteTimeout = null }
  }

  // =============================================
  // AUDIO SYSTEM — warm study ambience
  // =============================================

  async function initAudio() {
    try {
      audioCtx = await getAudioContext()
      const dest = getAudioDestination()

      // Master gain for the study's audio
      const master = audioCtx.createGain()
      master.gain.value = 0
      master.connect(dest)
      audioNodes.masterGain = master

      // --- Fireplace crackle: filtered noise ---
      const sampleRate = audioCtx.sampleRate
      const noiseDuration = 4 // seconds of noise buffer, looped
      const noiseBuffer = audioCtx.createBuffer(1, sampleRate * noiseDuration, sampleRate)
      const noiseData = noiseBuffer.getChannelData(0)
      for (let i = 0; i < noiseData.length; i++) {
        // Shaped noise: mix white noise with bursts for crackle character
        const base = (Math.random() * 2 - 1) * 0.3
        // Occasional louder pops
        const pop = Math.random() < 0.001 ? (Math.random() * 2 - 1) * 0.8 : 0
        noiseData[i] = base + pop
      }

      const noiseSource = audioCtx.createBufferSource()
      noiseSource.buffer = noiseBuffer
      noiseSource.loop = true

      // Bandpass filter for fireplace warmth
      const fireFilter = audioCtx.createBiquadFilter()
      fireFilter.type = 'bandpass'
      fireFilter.frequency.value = 600
      fireFilter.Q.value = 0.5

      // Additional lowpass to remove harshness
      const fireLowpass = audioCtx.createBiquadFilter()
      fireLowpass.type = 'lowpass'
      fireLowpass.frequency.value = 1800
      fireLowpass.Q.value = 0.3

      const fireGain = audioCtx.createGain()
      fireGain.gain.value = 0.12

      noiseSource.connect(fireFilter)
      fireFilter.connect(fireLowpass)
      fireLowpass.connect(fireGain)
      fireGain.connect(master)
      noiseSource.start()

      audioNodes.fireplaceNoise = noiseSource
      audioNodes.fireplaceGain = fireGain
      audioNodes.fireplaceFilter = fireFilter

      // --- Clock tick: subtle metronome ---
      // We use a repeating scheduled click sound
      const clockGain = audioCtx.createGain()
      clockGain.gain.value = 0
      clockGain.connect(master)
      audioNodes.clockGain = clockGain

      // Tick every 1 second using interval + short oscillator bursts
      clockTickInterval = window.setInterval(() => {
        if (!audioCtx || !active) return
        playClockTick()
      }, 1000)

      // --- Occasional wood creak ---
      const creakGain = audioCtx.createGain()
      creakGain.gain.value = 0.04
      creakGain.connect(master)
      audioNodes.creakGain = creakGain

      creakInterval = window.setInterval(() => {
        if (!audioCtx || !active) return
        if (Math.random() < 0.15) playCreak()
      }, 6000)

      // Fade master in over 2 seconds
      master.gain.setTargetAtTime(1.0, audioCtx.currentTime, 0.6)

    } catch {
      // Audio init failed silently — no audio, no problem
    }
  }

  function playClockTick() {
    if (!audioCtx || !audioNodes.clockGain) return
    const now = audioCtx.currentTime
    // Short click using oscillator
    const osc = audioCtx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 800 + Math.random() * 100
    const tickEnv = audioCtx.createGain()
    tickEnv.gain.setValueAtTime(0.03, now)
    tickEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
    osc.connect(tickEnv)
    tickEnv.connect(audioNodes.clockGain)
    osc.start(now)
    osc.stop(now + 0.05)
  }

  function playCreak() {
    if (!audioCtx || !audioNodes.creakGain) return
    const now = audioCtx.currentTime
    // Wood creak: low frequency sweep
    const osc = audioCtx.createOscillator()
    osc.type = 'sawtooth'
    const baseFreq = 60 + Math.random() * 40
    osc.frequency.setValueAtTime(baseFreq, now)
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.3, now + 0.15)
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, now + 0.4)

    const filter = audioCtx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 300
    filter.Q.value = 2

    const env = audioCtx.createGain()
    env.gain.setValueAtTime(0, now)
    env.gain.linearRampToValueAtTime(0.06, now + 0.05)
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.5)

    osc.connect(filter)
    filter.connect(env)
    env.connect(audioNodes.creakGain)
    osc.start(now)
    osc.stop(now + 0.6)
  }

  /** Play a typewriter click sound on keypress */
  function playTypewriterClick(keyType: 'letter' | 'space' | 'enter' | 'backspace') {
    if (!audioCtx || !audioNodes.masterGain) return
    const now = audioCtx.currentTime

    // Different character for each key type
    const configs = {
      letter: { freq: 2200 + Math.random() * 600, dur: 0.025, vol: 0.04, decay: 0.02 },
      space: { freq: 1400 + Math.random() * 200, dur: 0.04, vol: 0.05, decay: 0.03 },
      enter: { freq: 800, dur: 0.08, vol: 0.06, decay: 0.06 }, // carriage return
      backspace: { freq: 3000 + Math.random() * 400, dur: 0.015, vol: 0.025, decay: 0.015 },
    }
    const cfg = configs[keyType]

    // Short noise burst filtered to give mechanical character
    const sampleRate = audioCtx.sampleRate
    const bufLen = Math.ceil(sampleRate * cfg.dur)
    const buf = audioCtx.createBuffer(1, bufLen, sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1)
    }

    const src = audioCtx.createBufferSource()
    src.buffer = buf

    const bp = audioCtx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = cfg.freq
    bp.Q.value = 3

    const env = audioCtx.createGain()
    env.gain.setValueAtTime(cfg.vol, now)
    env.gain.exponentialRampToValueAtTime(0.001, now + cfg.dur + cfg.decay)

    src.connect(bp)
    bp.connect(env)
    env.connect(audioNodes.masterGain)
    src.start(now)
    src.stop(now + cfg.dur + cfg.decay + 0.01)

    // Enter gets a secondary low thump (carriage return feel)
    if (keyType === 'enter') {
      const osc = audioCtx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(200, now)
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.06)
      const thumpEnv = audioCtx.createGain()
      thumpEnv.gain.setValueAtTime(0.03, now)
      thumpEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
      osc.connect(thumpEnv)
      thumpEnv.connect(audioNodes.masterGain)
      osc.start(now)
      osc.stop(now + 0.1)
    }
  }

  /** Play a soft page-turn sound (called when quotes change) */
  function playPageTurn() {
    if (!audioCtx || !audioNodes.masterGain) return
    const now = audioCtx.currentTime

    // Page turn: short burst of filtered noise with envelope
    const sampleRate = audioCtx.sampleRate
    const duration = 0.3
    const buf = audioCtx.createBuffer(1, sampleRate * duration, sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5
    }

    const src = audioCtx.createBufferSource()
    src.buffer = buf

    const hp = audioCtx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 2000
    hp.Q.value = 0.3

    const lp = audioCtx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 6000

    const env = audioCtx.createGain()
    env.gain.setValueAtTime(0, now)
    env.gain.linearRampToValueAtTime(0.06, now + 0.02)
    env.gain.exponentialRampToValueAtTime(0.001, now + duration)

    src.connect(hp)
    hp.connect(lp)
    lp.connect(env)
    env.connect(audioNodes.masterGain)
    src.start(now)
    src.stop(now + duration + 0.05)
  }

  function fadeOutAudio() {
    if (!audioCtx || !audioNodes.masterGain) return
    const now = audioCtx.currentTime
    audioNodes.masterGain.gain.setTargetAtTime(0, now, 0.15)

    if (clockTickInterval) { clearInterval(clockTickInterval); clockTickInterval = null }
    if (creakInterval) { clearInterval(creakInterval); creakInterval = null }
  }

  function destroyAudio() {
    fadeOutAudio()
    // Disconnect and stop after fade
    setTimeout(() => {
      try { audioNodes.fireplaceNoise?.stop() } catch { /* already stopped */ }
      try { audioNodes.fireplaceNoise?.disconnect() } catch { /* */ }
      try { audioNodes.fireplaceGain?.disconnect() } catch { /* */ }
      try { audioNodes.fireplaceFilter?.disconnect() } catch { /* */ }
      try { audioNodes.clockGain?.disconnect() } catch { /* */ }
      try { audioNodes.creakGain?.disconnect() } catch { /* */ }
      try { audioNodes.masterGain?.disconnect() } catch { /* */ }
      audioNodes = {
        fireplaceNoise: null, fireplaceGain: null, fireplaceFilter: null,
        clockOsc: null, clockGain: null, creakGain: null, masterGain: null,
      }
      audioCtx = null
    }, 600)
  }

  // =============================================
  // VISUAL ATMOSPHERE — dust motes, vignette, flicker, candle cursor
  // =============================================

  function initDustMotes(w: number, h: number) {
    dustMotes.length = 0
    for (let i = 0; i < DUST_COUNT; i++) {
      dustMotes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.4 - 0.1, // drift upward
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.3 + 0.05,
        warmth: Math.random(), // 0 = dim, 1 = warm golden
      })
    }
  }

  function createAtmosphereCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.style.cssText = `
      position: fixed; top: 0; left: 0;
      width: 100vw; height: 100vh;
      pointer-events: none;
      z-index: 3;
    `
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    return canvas
  }

  function drawAtmosphere() {
    if (!atmosCtx || !atmosCanvas || !active) return
    const w = atmosCanvas.width
    const h = atmosCanvas.height

    atmosCtx.clearRect(0, 0, w, h)

    // --- Writing streak warmth ---
    const now = Date.now()
    const timeSinceKey = now - lastKeyTime
    if (timeSinceKey < 800) {
      // Actively typing — build warmth
      streakWarmth = Math.min(1, streakWarmth + 0.003)
    } else {
      // Not typing — cool down
      if (streakWarmth > 0 && streakEndTime === 0) {
        streakEndTime = now // mark when streak ended
      }
      streakWarmth = Math.max(0, streakWarmth - 0.001)
    }

    // --- Ink blot drops (spawn after writing pauses) ---
    if (streakEndTime > 0 && now - streakEndTime > 3000 && now - lastBlotTime > 8000 && Math.random() < 0.02) {
      // Ink blots appear after you stop writing — like ink pooling on the page
      const bx = w * 0.2 + Math.random() * w * 0.6
      const by = h * 0.2 + Math.random() * h * 0.6
      inkBlots.push({
        x: bx, y: by,
        radius: 0, maxRadius: 15 + Math.random() * 35,
        alpha: 0.12 + Math.random() * 0.08,
        age: 0,
        spreading: true,
      })
      lastBlotTime = now
      streakEndTime = 0
    }

    // Update and draw ink blots
    for (let i = inkBlots.length - 1; i >= 0; i--) {
      const blot = inkBlots[i]
      blot.age++
      if (blot.spreading) {
        blot.radius += (blot.maxRadius - blot.radius) * 0.02
        if (blot.radius > blot.maxRadius * 0.95) blot.spreading = false
      } else {
        blot.alpha -= 0.0003
      }
      if (blot.alpha <= 0) { inkBlots.splice(i, 1); continue }

      const blotGrad = atmosCtx.createRadialGradient(blot.x, blot.y, 0, blot.x, blot.y, blot.radius)
      blotGrad.addColorStop(0, `rgba(5, 2, 15, ${blot.alpha})`)
      blotGrad.addColorStop(0.6, `rgba(10, 4, 25, ${blot.alpha * 0.6})`)
      blotGrad.addColorStop(1, `rgba(10, 4, 25, 0)`)
      atmosCtx.fillStyle = blotGrad
      atmosCtx.fillRect(blot.x - blot.radius, blot.y - blot.radius, blot.radius * 2, blot.radius * 2)
    }

    // --- Oil lamp flicker ---
    flickerPhase += 0.02 + Math.random() * 0.01
    const baseFlicker = 0.02 + Math.sin(flickerPhase) * 0.01
      + Math.sin(flickerPhase * 2.3) * 0.008
      + Math.sin(flickerPhase * 5.7) * 0.005
    flickerIntensity = baseFlicker + streakWarmth * 0.03 // writing makes the flame burn brighter

    // Subtle warm overlay that flickers — warmer during writing streaks
    const flickerAlpha = 0.015 + flickerIntensity + streakWarmth * 0.02
    const warmR = 255
    const warmG = Math.floor(200 - streakWarmth * 30) // shifts warmer/oranger
    const warmB = Math.floor(100 - streakWarmth * 40)
    atmosCtx.fillStyle = `rgba(${warmR}, ${warmG}, ${warmB}, ${flickerAlpha})`
    atmosCtx.fillRect(0, 0, w, h)

    // --- Vignette (opens up during writing streaks) ---
    const vigInner = 0.25 + streakWarmth * 0.1 // vignette opens wider while writing
    const vigOuter = 0.75 + streakWarmth * 0.1
    const vigEdge = 0.5 - streakWarmth * 0.15 // edge darkens less while in flow
    const vigGrad = atmosCtx.createRadialGradient(w / 2, h / 2, w * vigInner, w / 2, h / 2, w * vigOuter)
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)')
    vigGrad.addColorStop(0.6, `rgba(0, 0, 0, ${0.15 - streakWarmth * 0.05})`)
    vigGrad.addColorStop(1, `rgba(0, 0, 0, ${vigEdge})`)
    atmosCtx.fillStyle = vigGrad
    atmosCtx.fillRect(0, 0, w, h)

    // --- Candle cursor glow ---
    if (mouseX > 0 && mouseY > 0) {
      const glowRadius = 180 + Math.sin(flickerPhase * 1.5) * 20
      const cursorGrad = atmosCtx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, glowRadius)
      cursorGrad.addColorStop(0, `rgba(255, 200, 120, ${0.08 + flickerIntensity})`)
      cursorGrad.addColorStop(0.3, `rgba(255, 180, 80, ${0.04 + flickerIntensity * 0.5})`)
      cursorGrad.addColorStop(1, 'rgba(255, 180, 80, 0)')
      atmosCtx.fillStyle = cursorGrad
      atmosCtx.fillRect(0, 0, w, h)
    }

    // --- Dust motes ---
    for (const mote of dustMotes) {
      // Update position
      mote.x += mote.vx + Math.sin(flickerPhase + mote.warmth * 10) * 0.15
      mote.y += mote.vy

      // Wrap around
      if (mote.y < -10) { mote.y = h + 10; mote.x = Math.random() * w }
      if (mote.x < -10) mote.x = w + 10
      if (mote.x > w + 10) mote.x = -10

      // Brighter near cursor (candle illumination) + writing streak
      let cursorBoost = 0
      if (mouseX > 0 && mouseY > 0) {
        const dx = mote.x - mouseX
        const dy = mote.y - mouseY
        const dist = Math.sqrt(dx * dx + dy * dy)
        cursorBoost = Math.max(0, 1 - dist / 200) * 0.4
      }
      const streakBoost = streakWarmth * 0.15 // motes glow brighter as writing heats up

      const r = 255
      const g = Math.floor(180 + mote.warmth * 40)
      const b = Math.floor(80 + mote.warmth * 40)
      const a = mote.alpha + cursorBoost + streakBoost

      atmosCtx.beginPath()
      atmosCtx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2)
      atmosCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`
      atmosCtx.fill()
    }

    // --- Word count milestone flash ---
    if (milestoneFlash > 0.01) {
      const ringR = (1 - milestoneFlash) * Math.min(w, h) * 0.3
      atmosCtx.strokeStyle = `rgba(255, 215, 0, ${milestoneFlash * 0.15})`
      atmosCtx.lineWidth = 1
      atmosCtx.beginPath()
      atmosCtx.arc(w / 2, h / 2, ringR, 0, Math.PI * 2)
      atmosCtx.stroke()
      // Label
      atmosCtx.font = '13px "Cormorant Garamond", serif'
      atmosCtx.fillStyle = `rgba(255, 215, 0, ${milestoneFlash * 0.3})`
      atmosCtx.textAlign = 'center'
      atmosCtx.fillText(milestoneLabel, w / 2, h / 2 + ringR + 20)
      milestoneFlash *= 0.985
    }

    // --- Margin notes (memory fragments in margins) ---
    for (const note of marginNotes) {
      note.alpha += (note.targetAlpha - note.alpha) * 0.01
      if (note.alpha < 0.003) continue
      atmosCtx.font = '11px "Cormorant Garamond", serif'
      atmosCtx.fillStyle = `rgba(180, 160, 120, ${note.alpha})`
      atmosCtx.textAlign = note.side === 'left' ? 'left' : 'right'
      const nx = note.side === 'left' ? 16 : w - 16
      atmosCtx.fillText(note.text, nx, note.y)
    }

    // --- Warm quote proximity glow (via cursor affecting quote container) ---
    updateQuoteWarmth()

    animFrame = requestAnimationFrame(drawAtmosphere)
  }

  /** Make quotes glow warmer when cursor is near them */
  function updateQuoteWarmth() {
    if (!quoteEl || !quoteAuthorEl) return
    const rect = quoteEl.getBoundingClientRect()
    if (rect.width === 0) return // not visible

    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = mouseX - cx
    const dy = mouseY - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const proximity = Math.max(0, 1 - dist / 300)

    // Shift quote color warmer when cursor approaches
    const baseAlpha = 0.35
    const warmAlpha = baseAlpha + proximity * 0.25
    const warmR = Math.floor(180 + proximity * 55)
    const warmG = Math.floor(160 + proximity * 40)
    const warmB = Math.floor(120 + proximity * 20)
    const glow = proximity * 12
    quoteEl.style.color = `rgba(${warmR}, ${warmG}, ${warmB}, ${warmAlpha})`
    quoteEl.style.textShadow = `0 0 ${8 + glow}px rgba(${warmR}, ${warmG}, ${warmB}, ${0.08 + proximity * 0.1})`
  }

  function startAtmosphere() {
    atmosCanvas = createAtmosphereCanvas()
    atmosCtx = atmosCanvas.getContext('2d')
    document.body.appendChild(atmosCanvas)
    initDustMotes(atmosCanvas.width, atmosCanvas.height)

    mouseMoveHandler = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }
    window.addEventListener('mousemove', mouseMoveHandler)

    // Handle resize
    const onResize = () => {
      if (!atmosCanvas) return
      atmosCanvas.width = window.innerWidth
      atmosCanvas.height = window.innerHeight
      initDustMotes(atmosCanvas.width, atmosCanvas.height)
    }
    window.addEventListener('resize', onResize)
    // Store for cleanup
    ;(atmosCanvas as any)._resizeHandler = onResize

    drawAtmosphere()
  }

  function stopAtmosphere() {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null }
    if (mouseMoveHandler) {
      window.removeEventListener('mousemove', mouseMoveHandler)
      mouseMoveHandler = null
    }
    if (atmosCanvas) {
      const onResize = (atmosCanvas as any)._resizeHandler
      if (onResize) window.removeEventListener('resize', onResize)
      atmosCanvas.remove()
      atmosCanvas = null
    }
    atmosCtx = null
    mouseX = -1000
    mouseY = -1000
  }

  /** Build a study-themed navigation portal */
  function createPortal(config: {
    label: string
    roomName: string
    icon: string
    description: string
    position: string
    baseColor: string
    hoverColor: string
    glowColor: string
    borderStyle: string
  }): HTMLElement {
    const portal = document.createElement('div')
    portal.style.cssText = `
      ${config.position}
      pointer-events: auto; cursor: pointer;
      padding: 12px 16px;
      border: ${config.borderStyle};
      border-radius: 3px;
      background: rgba(2, 1, 8, 0.4);
      transition: all 0.6s ease;
      text-align: center;
      min-width: 80px;
    `

    const iconSpan = document.createElement('div')
    iconSpan.style.cssText = `
      font-size: 18px;
      margin-bottom: 6px;
      opacity: 0.4;
      transition: opacity 0.6s ease;
    `
    iconSpan.textContent = config.icon

    const labelSpan = document.createElement('div')
    labelSpan.style.cssText = `
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300; font-size: 12px;
      letter-spacing: 2px; text-transform: lowercase;
      font-style: italic;
      color: ${config.baseColor};
      transition: color 0.5s ease;
    `
    labelSpan.textContent = config.label

    const descSpan = document.createElement('div')
    descSpan.style.cssText = `
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300; font-size: 11px;
      letter-spacing: 1px;
      color: rgba(255, 255, 255, 0.06);
      margin-top: 4px;
      transition: color 0.5s ease;
    `
    descSpan.textContent = config.description

    portal.appendChild(iconSpan)
    portal.appendChild(labelSpan)
    portal.appendChild(descSpan)

    portal.addEventListener('mouseenter', () => {
      portal.style.background = 'rgba(2, 1, 8, 0.7)'
      portal.style.boxShadow = `0 0 20px ${config.glowColor}, inset 0 0 15px ${config.glowColor}`
      labelSpan.style.color = config.hoverColor
      descSpan.style.color = 'rgba(255, 255, 255, 0.2)'
      iconSpan.style.opacity = '0.8'
    })

    portal.addEventListener('mouseleave', () => {
      portal.style.background = 'rgba(2, 1, 8, 0.4)'
      portal.style.boxShadow = 'none'
      labelSpan.style.color = config.baseColor
      descSpan.style.color = 'rgba(255, 255, 255, 0.06)'
      iconSpan.style.opacity = '0.4'
    })

    portal.addEventListener('click', (e) => {
      e.stopPropagation()
      // Brief flash effect before navigating
      portal.style.boxShadow = `0 0 40px ${config.hoverColor}`
      portal.style.background = 'rgba(2, 1, 8, 0.9)'
      setTimeout(() => {
        deps.switchTo!(config.roomName)
      }, 200)
    })

    return portal
  }

  return {
    name: 'study',
    label: 'the study',

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        height: 100%;
        pointer-events: auto;
        background: rgba(2, 1, 8, 0.85);
      `

      // Prompt
      promptEl = document.createElement('div')
      promptEl.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 16px;
        font-style: italic;
        color: rgba(255, 215, 0, 0.35);
        margin-bottom: 24px;
        max-width: 500px;
        text-align: center;
        letter-spacing: 1px;
        cursor: pointer;
        transition: opacity 0.5s ease;
      `
      promptEl.textContent = generatePrompt()
      promptEl.title = 'Click for a new prompt'
      promptEl.addEventListener('click', newPrompt)
      overlay.appendChild(promptEl)

      // Textarea
      textarea = document.createElement('textarea')
      textarea.value = loadText()
      textarea.placeholder = 'Write here...'
      textarea.style.cssText = `
        width: 560px; max-width: 90vw;
        height: 400px; max-height: 60vh;
        background: transparent;
        border: 1px solid rgba(255, 20, 147, 0.1);
        border-radius: 2px;
        color: rgba(255, 215, 0, 0.7);
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 18px;
        line-height: 1.8;
        letter-spacing: 0.5px;
        padding: 24px;
        resize: none;
        outline: none;
        caret-color: rgba(255, 20, 147, 0.7);
      `
      textarea.addEventListener('input', () => {
        updateCount()
        // Emit new text passages every 20+ words
        if (textarea && onNewText) {
          const text = textarea.value.trim()
          const words = text ? text.split(/\s+/).length : 0
          if (words >= lastWordCount + 20) {
            const newWords = text.split(/\s+/).slice(lastWordCount).join(' ')
            lastWordCount = words
            onNewText(newWords)
          }
        }
      })
      // Typewriter click sounds on keypress
      textarea.addEventListener('keydown', (e: KeyboardEvent) => {
        lastKeyTime = Date.now()
        streakEndTime = 0
        if (e.key === 'Enter') playTypewriterClick('enter')
        else if (e.key === ' ') playTypewriterClick('space')
        else if (e.key === 'Backspace') playTypewriterClick('backspace')
        else if (e.key.length === 1) playTypewriterClick('letter')
        // Boost fireplace crackling during writing
        if (audioNodes.fireplaceGain && audioCtx) {
          const targetVol = 0.12 + streakWarmth * 0.08
          audioNodes.fireplaceGain.gain.setTargetAtTime(targetVol, audioCtx.currentTime, 0.3)
        }
      })
      overlay.appendChild(textarea)

      // Bottom bar: word count + actions
      const bottom = document.createElement('div')
      bottom.style.cssText = `
        display: flex; justify-content: space-between;
        align-items: center;
        width: 560px; max-width: 90vw;
        margin-top: 16px;
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 13px;
      `

      countEl = document.createElement('div')
      countEl.style.cssText = `
        color: rgba(255, 255, 255, 0.15);
        letter-spacing: 1px;
      `
      updateCount()
      bottom.appendChild(countEl)

      const exportBtn = document.createElement('div')
      exportBtn.style.cssText = `
        color: rgba(255, 20, 147, 0.3);
        cursor: pointer;
        letter-spacing: 2px;
        transition: color 0.3s ease;
      `
      exportBtn.textContent = 'export'
      exportBtn.addEventListener('mouseenter', () => {
        exportBtn.style.color = 'rgba(255, 20, 147, 0.7)'
      })
      exportBtn.addEventListener('mouseleave', () => {
        exportBtn.style.color = 'rgba(255, 20, 147, 0.3)'
      })
      exportBtn.addEventListener('click', exportText)
      bottom.appendChild(exportBtn)

      overlay.appendChild(bottom)

      // --- Stoic Quote Inscription ---
      // Positioned below the bottom bar, like words carved into the desk surface
      const inscriptionContainer = document.createElement('div')
      inscriptionContainer.style.cssText = `
        position: relative;
        width: 560px; max-width: 90vw;
        margin-top: 28px;
        text-align: center;
        min-height: 60px;
      `

      quoteEl = document.createElement('div')
      quoteEl.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 14px;
        font-style: italic;
        color: rgba(180, 160, 120, 0.35);
        letter-spacing: 1.5px;
        line-height: 1.6;
        opacity: 0;
        text-shadow: 0 0 8px rgba(180, 160, 120, 0.08);
      `

      quoteAuthorEl = document.createElement('div')
      quoteAuthorEl.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 12px;
        font-style: italic;
        color: rgba(180, 160, 120, 0.2);
        letter-spacing: 2px;
        margin-top: 8px;
        opacity: 0;
      `

      inscriptionContainer.appendChild(quoteEl)
      inscriptionContainer.appendChild(quoteAuthorEl)
      overlay.appendChild(inscriptionContainer)

      // --- In-room Navigation Portals ---
      if (deps.switchTo) {
        const navContainer = document.createElement('div')
        navContainer.style.cssText = `
          position: absolute; top: 0; left: 0; width: 100%; height: 100%;
          pointer-events: none; z-index: 2;
        `

        // Bookshelf sliding open -> Library (top-left)
        const libraryPortal = createPortal({
          label: 'the library',
          roomName: 'library',
          icon: '\u{1F4DA}',
          description: 'a bookshelf slides open',
          position: 'position: absolute; top: 24px; left: 20px;',
          baseColor: 'rgba(180, 160, 120, 0.12)',
          hoverColor: 'rgba(180, 160, 120, 0.6)',
          glowColor: 'rgba(180, 160, 120, 0.1)',
          borderStyle: '1px solid rgba(180, 160, 120, 0.06)',
        })
        navContainer.appendChild(libraryPortal)

        // Spool of thread on desk -> Loom (top-right)
        const loomPortal = createPortal({
          label: 'the loom',
          roomName: 'loom',
          icon: '\u{1F9F5}',
          description: 'a thread unravels',
          position: 'position: absolute; top: 24px; right: 20px;',
          baseColor: 'rgba(200, 160, 80, 0.12)',
          hoverColor: 'rgba(200, 160, 80, 0.6)',
          glowColor: 'rgba(200, 160, 80, 0.1)',
          borderStyle: '1px solid rgba(200, 160, 80, 0.06)',
        })
        navContainer.appendChild(loomPortal)

        // Locked desk drawer -> Cipher (bottom-left)
        const cipherPortal = createPortal({
          label: 'the cipher',
          roomName: 'cipher',
          icon: '\u{1F512}',
          description: 'a drawer with a strange lock',
          position: 'position: absolute; bottom: 50px; left: 20px;',
          baseColor: 'rgba(150, 200, 150, 0.12)',
          hoverColor: 'rgba(150, 200, 150, 0.6)',
          glowColor: 'rgba(150, 200, 150, 0.1)',
          borderStyle: '1px solid rgba(150, 200, 150, 0.06)',
        })
        navContainer.appendChild(cipherPortal)

        // Window to the void -> Void (bottom-right)
        const voidPortal = createPortal({
          label: 'the void',
          roomName: 'void',
          icon: '\u25C6',
          description: 'a window into darkness',
          position: 'position: absolute; bottom: 50px; right: 20px;',
          baseColor: 'rgba(255, 20, 147, 0.12)',
          hoverColor: 'rgba(255, 20, 147, 0.6)',
          glowColor: 'rgba(255, 20, 147, 0.1)',
          borderStyle: '1px solid rgba(255, 20, 147, 0.06)',
        })
        navContainer.appendChild(voidPortal)

        overlay.appendChild(navContainer)
      }

      return overlay
    },

    async activate() {
      active = true
      milestoneFlash = 0
      milestoneLabel = ''
      marginNotes.length = 0
      lastMarginNoteWord = 0
      // Track word count for new text emissions
      if (textarea) {
        const text = textarea.value.trim()
        lastWordCount = text ? text.split(/\s+/).length : 0
        // Set milestone to current word count to avoid immediate triggers
        const currentWords = text ? text.split(/\s+/).length : 0
        lastMilestone = 0
        for (const m of MILESTONES) {
          if (currentWords >= m) lastMilestone = m
        }
      }
      // Auto-save every 5 seconds
      saveInterval = window.setInterval(() => {
        if (textarea) saveText(textarea.value)
      }, 5000)
      // Focus textarea after transition
      setTimeout(() => textarea?.focus(), 1600)
      // Start stoic quote cycle
      startQuoteCycle()
      // Start ambient audio
      await initAudio()
      // Start visual atmosphere
      startAtmosphere()
    },

    deactivate() {
      active = false
      if (saveInterval) clearInterval(saveInterval)
      if (textarea) saveText(textarea.value)
      stopQuoteCycle()
      fadeOutAudio()
      stopAtmosphere()
      inkBlots.length = 0
      streakWarmth = 0
    },

    destroy() {
      if (saveInterval) clearInterval(saveInterval)
      if (textarea) saveText(textarea.value)
      stopQuoteCycle()
      destroyAudio()
      stopAtmosphere()
      inkBlots.length = 0
      streakWarmth = 0
      overlay?.remove()
    },
  }
}
