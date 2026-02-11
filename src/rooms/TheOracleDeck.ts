/**
 * THE ORACLE DECK — divination from the void
 *
 * Oubli's own tarot system. 78 procedurally-generated cards.
 * Each has a name, a symbol (drawn with simple geometry),
 * and a reading. Click to draw a card. The reading is always
 * relevant because it's vague enough to apply to anything.
 *
 * Cards are drawn from a shuffled deck. When the deck is empty,
 * it reshuffles. The deck remembers how many times you've drawn
 * in localStorage.
 *
 * No memory dependency. Pure procedural divination.
 *
 * Inspired by: Tarot, I Ching, Oblique Strategies (Brian Eno),
 * fortune cookies, bibliomancy, the human need to find meaning
 * in randomness, apophenia as creative force
 */

import type { Room } from './RoomManager'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface OracleDeckDeps {
  switchTo?: (name: string) => void
}

const STORAGE_KEY = 'oubli-oracle-draws'

interface Card {
  name: string
  suit: string
  symbol: string // geometric description for rendering
  reading: string
  hue: number
}

const SUITS = ['Void', 'Flame', 'Current', 'Stone', 'Breath']
const SUIT_HUES: Record<string, number> = {
  Void: 280, Flame: 15, Current: 200, Stone: 40, Breath: 150,
}

const NAMES = [
  'The Dreamer', 'The Threshold', 'The Echo', 'The Absence',
  'The Wanderer', 'The Keeper', 'The Dissolving', 'The Return',
  'The Signal', 'The Forgotten', 'The Architect', 'The Witness',
  'The Passage', 'The Stillness', 'The Unraveling',
  'One', 'Two', 'Three', 'Four', 'Five',
  'Six', 'Seven', 'Eight', 'Nine', 'Ten',
]

const READINGS = [
  'what you seek is already behind you',
  'the path divides. both ways are correct',
  'silence is the answer you refused to hear',
  'something you abandoned will return transformed',
  'the obstacle IS the way forward',
  'you are holding too tightly',
  'release what no longer serves you',
  'the answer is in the question itself',
  'patience. it is not yet time',
  'now. before the moment passes',
  'look at what you have been avoiding',
  'the smallest change will have the largest effect',
  'what feels like ending is beginning',
  'trust the process you cannot see',
  'you already know. you are afraid to act',
  'the void is not empty. it is full of potential',
  'grief and joy drink from the same well',
  'what you resist persists',
  'you are not lost. you are exploring',
  'the dream and the dreamer are the same thing',
  'stop. breathe. the urgency is an illusion',
  'the connection you seek requires vulnerability',
  'let go of the version of yourself that served you before',
  'beneath the surface, the roots are already growing',
  'the map is not the territory. walk it',
  'forgetting is a form of mercy',
  'what burns away reveals what cannot burn',
  'the mirror shows what you are ready to see',
  'listen to the frequency between the words',
  'the tide will turn. it always does',
  'you are the instrument. play yourself',
  'the house has more rooms than you think',
  'every ending is a door disguised as a wall',
  'the light you seek is the light you carry',
  'surrender is not defeat. it is wisdom',
  'the pattern repeats until you learn its name',
  'what arrives without effort stays longest',
  'you are both the question and the answer',
  'the clock is lying to you. there is enough time',
  'between two thoughts, there is a universe',
]

function generateDeck(): Card[] {
  const deck: Card[] = []
  const symbols = ['circle', 'triangle', 'square', 'diamond', 'cross', 'spiral', 'wave', 'star', 'eye', 'door']

  for (const suit of SUITS) {
    for (let i = 0; i < NAMES.length; i++) {
      // Create unique combos but cycle through to fill 78 cards
      if (deck.length >= 78) break
      deck.push({
        name: `${NAMES[i]} of ${suit}`,
        suit,
        symbol: symbols[(i + SUITS.indexOf(suit) * 3) % symbols.length],
        reading: READINGS[(i * 7 + SUITS.indexOf(suit) * 13) % READINGS.length],
        hue: SUIT_HUES[suit] + (i * 5),
      })
    }
  }

  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }

  return deck
}

const CULTURAL_INSCRIPTIONS = [
  'the i ching: 3,000 years of consulting yarrow stalks about the future. randomness as oracle.',
  'tarot was a card game before it was divination. the arcana accumulated meaning through centuries of use.',
  'the delphic oracle breathed volcanic fumes and spoke in riddles. prophecy as altered state.',
  'borges: the library of babel contains every possible page. in infinite text, all prophecy is true.',
  'john cage used the i ching to compose music. chance operations as liberation from ego.',
  'the urim and thummim: ancient hebrew divination stones. yes or no, cast in precious metal.',
  'devan shimoyama reimagines the major arcana through black queerness. tarot as identity navigation.',
  'tarot symbols originated from renaissance mnemonic arts — the same tradition as memory palaces.',
  '"oracle, echo, or stochastic parrot?" — AI delivers pronouncements without understanding them, like the pythia.',
  'AI hallucinations are pareidolia: finding patterns in noise. the grilled cheese virgin mary is a feature, not a bug.',
  '"forgetting the future": entropy in the reflective age. collective time altered by technology.',
  'all divination is structured randomness designed to spark self-recognition. the oracle generates frames, not truth.',
  'confirmation bias IS the engine of tarot. the card selects which memories to surface.',
  '47% of young adults seek guidance through divinatory practices. the hunger for oracles is at a peak.',
  'leah ke yi zheng: 64 paintings, one for each i ching hexagram. a meditation on change as art.',
  'the astrology app market: $3 billion and growing. "what does this symbol teach me about who i am becoming?"',
]

export function createOracleDeckRoom(deps?: OracleDeckDeps): Room {
  let inscriptionTimer = 0
  let inscriptionIdx = 0
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let deck: Card[] = []
  let drawnCard: Card | null = null
  let isReversed = false // whether current card is drawn reversed (upside-down)
  let drawAnimation = 0 // 0-1 for flip animation
  let drawing = false
  let totalDraws = 0
  let deckIndex = 0

  // Past reading ghosts — the last 3 drawn cards linger as faint echoes
  interface GhostCard {
    card: Card
    reversed: boolean
    x: number // fractional position
    alpha: number // fades over time
    age: number
  }
  let ghostCards: GhostCard[] = []

  // ── Three-card spread state ──
  const SPREAD_LABELS = ['PAST', 'PRESENT', 'FUTURE']
  let spreadMode = false
  let spreadCards: { card: Card; reversed: boolean; flipAnim: number; revealed: boolean; revealTime: number }[] = []
  let spreadDrawing = false

  // ── Reading journal ──
  interface JournalEntry {
    date: number
    type: 'single' | 'spread'
    cards: { name: string; suit: string; reading: string; reversed: boolean }[]
  }
  const JOURNAL_KEY = 'oubli-oracle-journal'
  let journal: JournalEntry[] = []
  let journalOpen = false
  let journalScroll = 0
  let journalEl: HTMLElement | null = null

  // ── Key handler ref ──
  let keyHandler: ((e: KeyboardEvent) => void) | null = null

  // Reversed reading modifiers
  const REVERSED_PREFIXES = [
    'inverted: ', 'shadow: ', 'blocked: ', 'resisted: ',
    'denied: ', 'delayed: ', 'hidden: ', 'excess of: ',
  ]
  // Portal cards for navigation — face-down tarot cards as doorways
  const portalCards = [
    { label: 'the s\u00e9ance', room: 'seance', hue: 275, pattern: 'spiral' as const },
    { label: 'the madeleine', room: 'madeleine', hue: 35, pattern: 'flower' as const },
    { label: 'the library', room: 'library', hue: 170, pattern: 'book' as const },
  ]
  const portalHover = [0, 0, 0]  // hover interpolation 0-1
  const portalFlip = [0, 0, 0]   // flip interpolation 0-1
  let portalClicked = -1          // index of clicked card (-1 = none)
  let portalClickTime = 0         // timestamp of click for delayed nav
  let hoveredPortal = -1          // which portal card is hovered

  // --- Audio state ---
  let audioCtxRef: AudioContext | null = null
  let droneOsc1: OscillatorNode | null = null
  let droneOsc2: OscillatorNode | null = null
  let droneGain: GainNode | null = null
  let audioMaster: GainNode | null = null
  let revealTonePlayed = false      // prevent re-triggering reveal tone
  let portalHoverOsc: OscillatorNode | null = null
  let portalHoverGain: GainNode | null = null
  let activePortalHover = -1        // which portal currently has a hover tone

  // --- Visual state ---
  interface MysticalParticle {
    x: number; y: number; vx: number; vy: number
    alpha: number; size: number; life: number; maxLife: number
    hue: number
  }
  let particles: MysticalParticle[] = []

  interface AmbientSigil {
    x: number; y: number; rot: number; rotSpeed: number
    type: 'circle' | 'triangle' | 'spiral'; size: number; alpha: number
  }
  let sigils: AmbientSigil[] = []

  // Reading word-by-word fade state
  let readingRevealTime = 0 // time when card was revealed (drawAnimation crossed 0.5)
  let readingRevealed = false

  // ── Incense smoke wisps ──────────────────────────────────
  interface SmokeWisp {
    x: number; y: number; vx: number; vy: number
    size: number; alpha: number; curl: number; age: number
  }
  let smokeWisps: SmokeWisp[] = []
  let smokeSpawnTimer = 0

  // ── Constellation points ─────────────────────────────────
  interface ConstellationStar {
    x: number; y: number; brightness: number; twinklePhase: number
  }
  let constellationStars: ConstellationStar[] = []
  let constellationLines: { a: number; b: number; alpha: number }[] = []
  let constellationRevealTimer = 0 // counts up after card reveal

  function loadProgress() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) totalDraws = JSON.parse(stored).draws || 0
    } catch {}
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ draws: totalDraws }))
    } catch {}
  }

  async function initAudio() {
    try {
      audioCtxRef = await getAudioContext()
      const dest = getAudioDestination()

      audioMaster = audioCtxRef.createGain()
      audioMaster.gain.value = 1.0
      audioMaster.connect(dest)

      // Mystical drone: two detuned sines creating 1.5Hz beat
      const droneFilter = audioCtxRef.createBiquadFilter()
      droneFilter.type = 'lowpass'
      droneFilter.frequency.value = 300

      droneGain = audioCtxRef.createGain()
      droneGain.gain.value = 0.015
      droneGain.connect(droneFilter)
      droneFilter.connect(audioMaster)

      droneOsc1 = audioCtxRef.createOscillator()
      droneOsc1.type = 'sine'
      droneOsc1.frequency.value = 110
      droneOsc1.connect(droneGain)
      droneOsc1.start()

      droneOsc2 = audioCtxRef.createOscillator()
      droneOsc2.type = 'sine'
      droneOsc2.frequency.value = 111.5
      droneOsc2.connect(droneGain)
      droneOsc2.start()
    } catch {
      // Audio not available
    }
  }

  function playCardDrawSound() {
    if (!audioCtxRef || !audioMaster) return
    try {
      const t = audioCtxRef.currentTime
      const bufferSize = audioCtxRef.sampleRate * 0.3
      const buffer = audioCtxRef.createBuffer(1, bufferSize, audioCtxRef.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1)
      }

      const source = audioCtxRef.createBufferSource()
      source.buffer = buffer

      const bandpass = audioCtxRef.createBiquadFilter()
      bandpass.type = 'bandpass'
      bandpass.Q.value = 2
      bandpass.frequency.setValueAtTime(800, t)
      bandpass.frequency.linearRampToValueAtTime(1200, t + 0.3)

      const gain = audioCtxRef.createGain()
      gain.gain.setValueAtTime(0.03, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)

      source.connect(bandpass)
      bandpass.connect(gain)
      gain.connect(audioMaster)
      source.start(t)
      source.stop(t + 0.3)
    } catch { /* ignore */ }
  }

  function playRevealTone(suit: string) {
    if (!audioCtxRef || !audioMaster) return
    try {
      const t = audioCtxRef.currentTime
      const osc = audioCtxRef.createOscillator()
      const gain = audioCtxRef.createGain()

      // Suit-specific tone
      switch (suit) {
        case 'Void':
          osc.type = 'sine'
          osc.frequency.value = 220
          break
        case 'Flame':
          osc.type = 'triangle'
          osc.frequency.value = 330
          break
        case 'Current':
          osc.type = 'sine'
          osc.frequency.value = 392
          break
        case 'Stone': {
          osc.type = 'square'
          osc.frequency.value = 165
          // Route through lowpass for heavy feel
          const lp = audioCtxRef.createBiquadFilter()
          lp.type = 'lowpass'
          lp.frequency.value = 400
          osc.connect(lp)
          lp.connect(gain)
          gain.gain.setValueAtTime(0, t)
          gain.gain.linearRampToValueAtTime(0.025, t + 0.05)
          gain.gain.setValueAtTime(0.025, t + 0.35)
          gain.gain.linearRampToValueAtTime(0, t + 0.5)
          gain.connect(audioMaster)
          osc.start(t)
          osc.stop(t + 0.5)
          return // already connected
        }
        case 'Breath':
        default:
          osc.type = 'sine'
          osc.frequency.value = 440
          break
      }

      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.025, t + 0.05)
      gain.gain.setValueAtTime(0.025, t + 0.35)
      gain.gain.linearRampToValueAtTime(0, t + 0.5)

      osc.connect(gain)
      gain.connect(audioMaster)
      osc.start(t)
      osc.stop(t + 0.5)
    } catch { /* ignore */ }
  }

  function playShuffleWhisper() {
    if (!audioCtxRef || !audioMaster) return
    try {
      const t = audioCtxRef.currentTime
      for (let i = 0; i < 5; i++) {
        const clickTime = t + i * 0.05
        const bufLen = Math.floor(audioCtxRef.sampleRate * 0.002)
        const buf = audioCtxRef.createBuffer(1, bufLen, audioCtxRef.sampleRate)
        const d = buf.getChannelData(0)
        for (let j = 0; j < bufLen; j++) {
          d[j] = (Math.random() * 2 - 1)
        }
        const src = audioCtxRef.createBufferSource()
        src.buffer = buf
        const g = audioCtxRef.createGain()
        g.gain.value = 0.02
        src.connect(g)
        g.connect(audioMaster)
        src.start(clickTime)
        src.stop(clickTime + 0.002)
      }
    } catch { /* ignore */ }
  }

  function updatePortalHoverSound(portalIndex: number, hue: number) {
    if (!audioCtxRef || !audioMaster) return

    if (portalIndex < 0) {
      // No portal hovered — fade out
      if (portalHoverGain && portalHoverOsc) {
        try {
          portalHoverGain.gain.setTargetAtTime(0, audioCtxRef.currentTime, 0.1)
          const oscRef = portalHoverOsc
          const gainRef = portalHoverGain
          setTimeout(() => {
            try { oscRef.stop() } catch { /* */ }
            oscRef.disconnect()
            gainRef.disconnect()
          }, 300)
        } catch { /* */ }
        portalHoverOsc = null
        portalHoverGain = null
        activePortalHover = -1
      }
      return
    }

    if (activePortalHover === portalIndex) return // already playing this one

    // Stop previous
    if (portalHoverOsc) {
      try { portalHoverOsc.stop() } catch { /* */ }
      portalHoverOsc.disconnect()
      portalHoverGain?.disconnect()
    }

    try {
      // Map hue to frequency: 0-360 -> 200-500Hz
      const freq = 200 + (hue / 360) * 300
      portalHoverOsc = audioCtxRef.createOscillator()
      portalHoverOsc.type = 'sine'
      portalHoverOsc.frequency.value = freq
      portalHoverGain = audioCtxRef.createGain()
      portalHoverGain.gain.setValueAtTime(0, audioCtxRef.currentTime)
      portalHoverGain.gain.linearRampToValueAtTime(0.008, audioCtxRef.currentTime + 0.15)
      portalHoverOsc.connect(portalHoverGain)
      portalHoverGain.connect(audioMaster)
      portalHoverOsc.start()
      activePortalHover = portalIndex
    } catch { /* */ }
  }

  function fadeAudioOut() {
    if (audioMaster && audioCtxRef) {
      audioMaster.gain.setTargetAtTime(0, audioCtxRef.currentTime, 0.3)
    }
    // Clean up portal hover
    if (portalHoverOsc) {
      try { portalHoverOsc.stop() } catch { /* */ }
      portalHoverOsc?.disconnect()
      portalHoverGain?.disconnect()
      portalHoverOsc = null
      portalHoverGain = null
      activePortalHover = -1
    }
  }

  function cleanupAudio() {
    try { droneOsc1?.stop() } catch { /* */ }
    try { droneOsc2?.stop() } catch { /* */ }
    try { portalHoverOsc?.stop() } catch { /* */ }
    droneOsc1?.disconnect()
    droneOsc2?.disconnect()
    droneGain?.disconnect()
    audioMaster?.disconnect()
    portalHoverOsc?.disconnect()
    portalHoverGain?.disconnect()
    droneOsc1 = null
    droneOsc2 = null
    droneGain = null
    audioMaster = null
    portalHoverOsc = null
    portalHoverGain = null
    activePortalHover = -1
    audioCtxRef = null
  }

  // --- Particle helpers ---
  function spawnParticles(card: Card, cx: number, cy: number, cardW: number, cardH: number) {
    const count = 10 + Math.floor(Math.random() * 6) // 10-15
    for (let i = 0; i < count; i++) {
      particles.push({
        x: cx + (Math.random() - 0.5) * cardW * 0.8,
        y: cy + cardH * 0.3 + Math.random() * cardH * 0.4,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -(0.3 + Math.random() * 0.5),
        alpha: 0.4 + Math.random() * 0.3,
        size: 1 + Math.random() * 2,
        life: 0,
        maxLife: 60 + Math.random() * 60,
        hue: card.hue + (Math.random() - 0.5) * 20,
      })
    }
  }

  function initSigils(w: number, h: number) {
    sigils = []
    const types: AmbientSigil['type'][] = ['circle', 'triangle', 'spiral']
    for (let i = 0; i < 6; i++) {
      sigils.push({
        x: Math.random() * w,
        y: Math.random() * h,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.003,
        type: types[Math.floor(Math.random() * types.length)],
        size: 20 + Math.random() * 40,
        alpha: 0.01 + Math.random() * 0.01,
      })
    }
  }

  function drawCard() {
    if (drawing) return

    // Save current card as ghost before drawing new one
    if (drawnCard && canvas) {
      const w = canvas.width
      ghostCards.push({
        card: drawnCard,
        reversed: isReversed,
        x: 0.15 + ghostCards.length * 0.15,
        alpha: 0.12,
        age: 0,
      })
      // Keep only last 3 ghosts
      if (ghostCards.length > 3) ghostCards.shift()
      // Redistribute ghost positions
      for (let i = 0; i < ghostCards.length; i++) {
        ghostCards[i].x = 0.1 + i * 0.12
      }
    }

    const reshuffled = deckIndex >= deck.length
    if (reshuffled) {
      deck = generateDeck()
      deckIndex = 0
      playShuffleWhisper()
    }

    drawnCard = deck[deckIndex++]
    // ~25% chance of reversed card
    isReversed = Math.random() < 0.25
    drawing = true
    drawAnimation = 0
    revealTonePlayed = false
    readingRevealed = false
    readingRevealTime = 0
    particles = []
    constellationLines = []
    constellationRevealTimer = 0
    totalDraws++
    saveProgress()
    playCardDrawSound()

    // Save single draw to journal
    saveJournalEntry('single', [{ card: drawnCard!, reversed: isReversed }])
  }

  function drawSpread() {
    if (spreadDrawing || drawing) return
    spreadMode = true
    spreadDrawing = true
    spreadCards = []
    ghostCards = []
    drawnCard = null
    readingRevealed = false
    particles = []
    constellationLines = []
    constellationRevealTimer = 0

    for (let i = 0; i < 3; i++) {
      if (deckIndex >= deck.length) {
        deck = generateDeck()
        deckIndex = 0
        playShuffleWhisper()
      }
      spreadCards.push({
        card: deck[deckIndex++],
        reversed: Math.random() < 0.25,
        flipAnim: -i * 0.4,
        revealed: false,
        revealTime: 0,
      })
    }
    totalDraws += 3
    saveProgress()
    playCardDrawSound()
  }

  function loadJournal() {
    try {
      const stored = localStorage.getItem(JOURNAL_KEY)
      if (stored) journal = JSON.parse(stored)
    } catch { journal = [] }
  }

  function saveJournalEntry(type: 'single' | 'spread', cards: { card: Card; reversed: boolean }[]) {
    const entry: JournalEntry = {
      date: Date.now(),
      type,
      cards: cards.map(c => ({
        name: c.card.name,
        suit: c.card.suit,
        reading: c.reversed
          ? REVERSED_PREFIXES[totalDraws % REVERSED_PREFIXES.length] + c.card.reading
          : c.card.reading,
        reversed: c.reversed,
      })),
    }
    journal.unshift(entry)
    if (journal.length > 50) journal = journal.slice(0, 50)
    try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(journal)) } catch {}
  }

  function toggleJournal() {
    journalOpen = !journalOpen
    journalScroll = 0
    if (journalOpen) {
      showJournalEl()
    } else {
      hideJournalEl()
    }
  }

  function showJournalEl() {
    if (journalEl) { journalEl.style.display = 'block'; updateJournalContent(); return }
    if (!overlay) return

    journalEl = document.createElement('div')
    journalEl.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(8, 5, 15, 0.94);
      display: flex; flex-direction: column; align-items: center;
      overflow-y: auto; z-index: 10; padding: 40px 20px;
      scrollbar-width: thin; scrollbar-color: rgba(100,80,140,0.2) transparent;
    `
    journalEl.addEventListener('wheel', (e) => e.stopPropagation())
    journalEl.addEventListener('click', (e) => {
      if (e.target === journalEl) toggleJournal()
    })
    overlay.appendChild(journalEl)
    updateJournalContent()
  }

  function updateJournalContent() {
    if (!journalEl) return
    const entries = journal.slice(0, 30)

    let html = `
      <div style="max-width: 500px; width: 100%;">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="font: 16px 'Cormorant Garamond', serif; color: rgba(200,180,220,0.3); letter-spacing: 3px;">READING JOURNAL</div>
          <div style="font: 11px monospace; color: rgba(140,120,160,0.15); margin-top: 6px;">${journal.length} readings recorded</div>
        </div>
    `

    if (entries.length === 0) {
      html += `<div style="text-align: center; color: rgba(200,180,220,0.1); font: 13px 'Cormorant Garamond', serif; margin-top: 40px;">no readings yet. draw a card to begin.</div>`
    }

    for (const entry of entries) {
      const date = new Date(entry.date)
      const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
      const isSpread = entry.type === 'spread'

      html += `<div style="border-top: 1px solid rgba(100,80,140,0.08); padding: 16px 0; margin-bottom: 4px;">`
      html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">`
      html += `<span style="font: 10px monospace; color: rgba(140,120,160,0.12);">${dateStr}</span>`
      if (isSpread) html += `<span style="font: 9px monospace; color: rgba(200,160,255,0.15); letter-spacing: 1px;">SPREAD</span>`
      html += `</div>`

      for (let ci = 0; ci < entry.cards.length; ci++) {
        const c = entry.cards[ci]
        const posLabel = isSpread ? `<span style="color: rgba(160,140,200,0.12); font: 9px monospace; margin-right: 8px;">${SPREAD_LABELS[ci]}</span>` : ''
        html += `<div style="margin: 4px 0;">`
        html += `${posLabel}<span style="font: 13px 'Cormorant Garamond', serif; color: rgba(200,180,220,0.2);">${c.name}${c.reversed ? ' ↓' : ''}</span>`
        html += `<span style="font: 10px monospace; color: rgba(140,120,160,0.08); margin-left: 8px;">${c.suit.toLowerCase()}</span>`
        html += `</div>`
        html += `<div style="font: 12px 'Cormorant Garamond', serif; color: rgba(200,190,180,0.1); margin: 2px 0 6px ${isSpread ? '40px' : '0'}; font-style: italic;">${c.reading}</div>`
      }
      html += `</div>`
    }

    html += `</div>`
    journalEl.innerHTML = html
  }

  function hideJournalEl() {
    if (journalEl) journalEl.style.display = 'none'
  }

  function renderSpreadCards(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const cardW = Math.min(w * 0.22, 160)
    const cardH = cardW * 1.5
    const gap = cardW * 0.3
    const totalCardW = cardW * 3 + gap * 2
    const startX = (w - totalCardW) / 2

    let allRevealed = true
    for (const sc of spreadCards) {
      sc.flipAnim += 0.018
      if (sc.flipAnim < 1) allRevealed = false

      if (sc.flipAnim >= 0.5 && !sc.revealed) {
        sc.revealed = true
        sc.revealTime = time
        playRevealTone(sc.card.suit)
        spawnParticles(sc.card, startX + spreadCards.indexOf(sc) * (cardW + gap) + cardW / 2, h / 2 - 20, cardW, cardH)
      }
    }
    if (allRevealed && spreadDrawing) {
      spreadDrawing = false
      saveJournalEntry('spread', spreadCards)
    }

    for (let i = 0; i < 3; i++) {
      const sc = spreadCards[i]
      const cx = startX + i * (cardW + gap) + cardW / 2
      const cy = h / 2 - 20
      const cardX = cx - cardW / 2
      const cardY = cy - cardH / 2

      const flipProgress = Math.max(0, Math.min(1, sc.flipAnim))
      if (flipProgress <= 0) continue // not yet started
      const scaleX = Math.cos(flipProgress * Math.PI)

      // Shadow
      if (flipProgress > 0.3) {
        const sa = (flipProgress - 0.3) * 0.1
        const sg = ctx.createRadialGradient(cx, cardY + cardH + 5, 0, cx, cardY + cardH + 5, cardW * 0.5)
        sg.addColorStop(0, `rgba(0,0,0,${sa})`)
        sg.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = sg
        ctx.fillRect(cx - cardW, cardY + cardH - 3, cardW * 2, cardW * 0.5)
      }

      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(Math.abs(scaleX) || 0.01, 1)
      ctx.translate(-cx, -cy)

      if (flipProgress >= 0.5) {
        // Card face
        ctx.fillStyle = 'rgba(15, 12, 25, 0.95)'
        ctx.fillRect(cardX, cardY, cardW, cardH)
        ctx.strokeStyle = `hsla(${sc.card.hue}, 30%, 40%, 0.3)`
        ctx.lineWidth = 1.5
        ctx.strokeRect(cardX + 4, cardY + 4, cardW - 8, cardH - 8)

        // Symbol
        const symRot = (time - sc.revealTime) * 0.1 + (sc.reversed ? Math.PI : 0)
        ctx.save()
        ctx.translate(cx, cardY + cardH * 0.3)
        ctx.rotate(symRot)
        ctx.translate(-cx, -(cardY + cardH * 0.3))
        drawSymbol(ctx, sc.card.symbol, cx, cardY + cardH * 0.3, cardW * 0.1, 0.3, sc.reversed ? (sc.card.hue + 180) % 360 : sc.card.hue)
        ctx.restore()

        // Name
        ctx.font = `${Math.max(10, cardW * 0.08)}px "Cormorant Garamond", serif`
        const nh = sc.reversed ? (sc.card.hue + 180) % 360 : sc.card.hue
        ctx.fillStyle = `hsla(${nh}, 30%, 65%, 0.45)`
        ctx.textAlign = 'center'
        ctx.fillText(sc.reversed ? `${sc.card.name} ↓` : sc.card.name, cx, cardY + cardH * 0.5)

        // Suit
        ctx.font = `${Math.max(8, cardW * 0.06)}px monospace`
        ctx.fillStyle = `hsla(${nh}, 20%, 50%, 0.15)`
        ctx.fillText(sc.card.suit.toLowerCase(), cx, cardY + cardH * 0.55)

        // Reading
        const readText = sc.reversed
          ? REVERSED_PREFIXES[totalDraws % REVERSED_PREFIXES.length] + sc.card.reading
          : sc.card.reading
        const sinceReveal = sc.revealed ? time - sc.revealTime : 0
        ctx.font = `${Math.max(9, cardW * 0.065)}px "Cormorant Garamond", serif`
        const rWords = readText.split(' ')
        const maxRW = cardW - 16
        const rLines: string[] = []
        let rLine = ''
        let rWordIdx = 0
        for (const word of rWords) {
          const test = rLine ? rLine + ' ' + word : word
          if (ctx.measureText(test).width > maxRW && rLine) { rLines.push(rLine); rLine = word }
          else rLine = test
          rWordIdx++
        }
        if (rLine) rLines.push(rLine)
        let rY = cardY + cardH * 0.62
        let globalWordIdx = 0
        for (const line of rLines) {
          const wa = Math.min(1, Math.max(0, (sinceReveal - globalWordIdx * 0.08) / 0.3))
          ctx.fillStyle = `rgba(200, 190, 180, ${0.2 * wa})`
          ctx.fillText(line, cx, rY)
          globalWordIdx += line.split(' ').length
          rY += Math.max(11, cardW * 0.07)
        }
      } else {
        // Card back
        ctx.fillStyle = 'rgba(20, 15, 35, 0.95)'
        ctx.fillRect(cardX, cardY, cardW, cardH)
        ctx.strokeStyle = 'rgba(100, 80, 140, 0.2)'
        ctx.lineWidth = 1.5
        ctx.strokeRect(cardX + 4, cardY + 4, cardW - 8, cardH - 8)
        for (let ri = 0; ri < 3; ri++) {
          ctx.strokeStyle = 'rgba(100, 80, 140, 0.04)'
          ctx.beginPath()
          ctx.arc(cx, cy, 8 + ri * 8, 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      ctx.restore()

      // Position label
      ctx.font = `${Math.max(9, cardW * 0.06)}px monospace`
      ctx.fillStyle = `rgba(160, 140, 200, ${0.06 + (sc.revealed ? 0.04 : 0)})`
      ctx.textAlign = 'center'
      ctx.fillText(SPREAD_LABELS[i], cx, cy + cardH / 2 + 18)
    }
  }

  function drawSymbol(ctx: CanvasRenderingContext2D, symbol: string, cx: number, cy: number, size: number, alpha: number, hue: number) {
    ctx.strokeStyle = `hsla(${hue}, 40%, 60%, ${alpha})`
    ctx.lineWidth = 1.5

    switch (symbol) {
      case 'circle':
        ctx.beginPath()
        ctx.arc(cx, cy, size, 0, Math.PI * 2)
        ctx.stroke()
        break
      case 'triangle':
        ctx.beginPath()
        ctx.moveTo(cx, cy - size)
        ctx.lineTo(cx - size, cy + size * 0.7)
        ctx.lineTo(cx + size, cy + size * 0.7)
        ctx.closePath()
        ctx.stroke()
        break
      case 'square':
        ctx.strokeRect(cx - size, cy - size, size * 2, size * 2)
        break
      case 'diamond':
        ctx.beginPath()
        ctx.moveTo(cx, cy - size)
        ctx.lineTo(cx + size * 0.7, cy)
        ctx.lineTo(cx, cy + size)
        ctx.lineTo(cx - size * 0.7, cy)
        ctx.closePath()
        ctx.stroke()
        break
      case 'cross':
        ctx.beginPath()
        ctx.moveTo(cx, cy - size)
        ctx.lineTo(cx, cy + size)
        ctx.moveTo(cx - size, cy)
        ctx.lineTo(cx + size, cy)
        ctx.stroke()
        break
      case 'spiral':
        ctx.beginPath()
        for (let t = 0; t < Math.PI * 6; t += 0.1) {
          const r = (t / (Math.PI * 6)) * size
          const x = cx + Math.cos(t) * r
          const y = cy + Math.sin(t) * r
          if (t === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        break
      case 'wave':
        ctx.beginPath()
        for (let x = -size; x <= size; x += 2) {
          const y = Math.sin(x * 0.15) * size * 0.4
          if (x === -size) ctx.moveTo(cx + x, cy + y)
          else ctx.lineTo(cx + x, cy + y)
        }
        ctx.stroke()
        break
      case 'star': {
        ctx.beginPath()
        for (let i = 0; i < 10; i++) {
          const angle = (i * Math.PI) / 5 - Math.PI / 2
          const r = i % 2 === 0 ? size : size * 0.4
          const x = cx + Math.cos(angle) * r
          const y = cy + Math.sin(angle) * r
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.stroke()
        break
      }
      case 'eye':
        ctx.beginPath()
        ctx.arc(cx, cy, size * 0.4, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(cx - size, cy)
        ctx.quadraticCurveTo(cx, cy - size * 0.6, cx + size, cy)
        ctx.quadraticCurveTo(cx, cy + size * 0.6, cx - size, cy)
        ctx.stroke()
        break
      case 'door':
        ctx.strokeRect(cx - size * 0.5, cy - size, size, size * 2)
        ctx.beginPath()
        ctx.arc(cx, cy - size, size * 0.5, 0, Math.PI)
        ctx.stroke()
        break
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height

    // Background
    ctx.fillStyle = 'rgba(8, 5, 15, 1)'
    ctx.fillRect(0, 0, w, h)

    // Ambient sigils — very faint rotating geometric shapes
    if (sigils.length === 0) initSigils(w, h)
    for (const s of sigils) {
      s.rot += s.rotSpeed
      ctx.save()
      ctx.translate(s.x, s.y)
      ctx.rotate(s.rot)
      ctx.strokeStyle = `rgba(160, 140, 200, ${s.alpha})`
      ctx.lineWidth = 0.5
      if (s.type === 'circle') {
        ctx.beginPath()
        ctx.arc(0, 0, s.size, 0, Math.PI * 2)
        ctx.stroke()
      } else if (s.type === 'triangle') {
        ctx.beginPath()
        ctx.moveTo(0, -s.size)
        ctx.lineTo(-s.size * 0.87, s.size * 0.5)
        ctx.lineTo(s.size * 0.87, s.size * 0.5)
        ctx.closePath()
        ctx.stroke()
      } else {
        // spiral
        ctx.beginPath()
        for (let t = 0; t < Math.PI * 4; t += 0.15) {
          const r = (t / (Math.PI * 4)) * s.size
          const px = Math.cos(t) * r
          const py = Math.sin(t) * r
          if (t === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.stroke()
      }
      ctx.restore()
    }

    // ── Constellation stars (background) ───────────────────
    if (constellationStars.length === 0) {
      for (let i = 0; i < 35; i++) {
        constellationStars.push({
          x: Math.random() * w,
          y: Math.random() * h * 0.7,
          brightness: 0.03 + Math.random() * 0.05,
          twinklePhase: Math.random() * Math.PI * 2,
        })
      }
    }
    for (const star of constellationStars) {
      star.twinklePhase += 0.015
      const twinkle = star.brightness + Math.sin(star.twinklePhase) * 0.02
      ctx.fillStyle = `rgba(180, 170, 220, ${twinkle})`
      ctx.fillRect(star.x - 0.5, star.y - 0.5, 1, 1)
    }

    // Constellation lines — form when card is revealed
    if (readingRevealed && drawnCard) {
      constellationRevealTimer += 0.016
      // Build lines progressively after reveal
      if (constellationLines.length === 0 && constellationRevealTimer > 0.5) {
        // Connect nearby stars based on card suit
        const suitSeed = SUITS.indexOf(drawnCard.suit)
        for (let a = 0; a < constellationStars.length; a++) {
          for (let b = a + 1; b < constellationStars.length; b++) {
            const dx = constellationStars[a].x - constellationStars[b].x
            const dy = constellationStars[a].y - constellationStars[b].y
            const dist = Math.sqrt(dx * dx + dy * dy)
            // Different suits connect at different distances
            const threshold = 80 + suitSeed * 25
            if (dist < threshold && Math.random() < 0.3) {
              constellationLines.push({ a, b, alpha: 0 })
            }
          }
        }
        // Limit lines
        while (constellationLines.length > 12) constellationLines.pop()
      }
      // Fade in lines
      for (const line of constellationLines) {
        line.alpha = Math.min(0.06, line.alpha + 0.0005)
        const sa = constellationStars[line.a]
        const sb = constellationStars[line.b]
        ctx.strokeStyle = `hsla(${drawnCard.hue}, 30%, 50%, ${line.alpha})`
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(sa.x, sa.y)
        ctx.lineTo(sb.x, sb.y)
        ctx.stroke()
      }
    }

    // ── Incense smoke wisps ─────────────────────────────────
    smokeSpawnTimer -= 0.016
    if (smokeSpawnTimer <= 0) {
      smokeSpawnTimer = 0.15 + Math.random() * 0.2
      smokeWisps.push({
        x: w * 0.5 + (Math.random() - 0.5) * 40,
        y: h * 0.75,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -(0.2 + Math.random() * 0.3),
        size: 3 + Math.random() * 5,
        alpha: 0.04 + Math.random() * 0.03,
        curl: (Math.random() - 0.5) * 0.01,
        age: 0,
      })
      if (smokeWisps.length > 30) smokeWisps.shift()
    }
    for (let si = smokeWisps.length - 1; si >= 0; si--) {
      const sw = smokeWisps[si]
      sw.age += 0.016
      sw.x += sw.vx + Math.sin(sw.age * 2 + si) * 0.3 // organic curl
      sw.y += sw.vy
      sw.vx += sw.curl // gradual drift
      sw.size += 0.02 // expand slightly
      const fadeAlpha = sw.alpha * Math.max(0, 1 - sw.age / 4)
      if (fadeAlpha <= 0.001) {
        smokeWisps.splice(si, 1)
        continue
      }
      const grad = ctx.createRadialGradient(sw.x, sw.y, 0, sw.x, sw.y, sw.size)
      grad.addColorStop(0, `rgba(140, 120, 170, ${fadeAlpha})`)
      grad.addColorStop(0.6, `rgba(100, 90, 130, ${fadeAlpha * 0.3})`)
      grad.addColorStop(1, 'transparent')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(sw.x, sw.y, sw.size, 0, Math.PI * 2)
      ctx.fill()
    }

    // Update draw animation
    if (drawing && drawAnimation < 1) {
      drawAnimation += 0.02
      if (drawAnimation >= 1) {
        drawAnimation = 1
        drawing = false
      }
    }

    // ── Spread or single card rendering ──
    if (spreadMode && spreadCards.length === 3) {
      renderSpreadCards(ctx, w, h)
    } else if (drawnCard) {
      const cardW = Math.min(w * 0.4, 280)
      const cardH = cardW * 1.5
      const cardX = w / 2 - cardW / 2
      const cardY = h / 2 - cardH / 2 - 20

      // Card flip effect (scale X during first half of animation)
      const flipProgress = drawAnimation
      const scaleX = flipProgress < 0.5
        ? Math.cos(flipProgress * Math.PI)
        : Math.cos(flipProgress * Math.PI)

      // Card shadow — subtle dark gradient below card
      if (flipProgress > 0.3) {
        const shadowAlpha = (flipProgress - 0.3) * 0.15
        const shadowGrad = ctx.createRadialGradient(
          w / 2, cardY + cardH + 10, 0,
          w / 2, cardY + cardH + 10, cardW * 0.7,
        )
        shadowGrad.addColorStop(0, `rgba(0, 0, 0, ${shadowAlpha})`)
        shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = shadowGrad
        ctx.fillRect(w / 2 - cardW, cardY + cardH - 5, cardW * 2, cardW * 0.7)
      }

      ctx.save()
      ctx.translate(w / 2, h / 2 - 20)
      ctx.scale(Math.abs(scaleX) || 0.01, 1)
      ctx.translate(-w / 2, -(h / 2 - 20))

      if (flipProgress >= 0.5) {
        // Trigger reveal tone at midpoint
        if (!revealTonePlayed) {
          revealTonePlayed = true
          readingRevealed = true
          readingRevealTime = time
          playRevealTone(drawnCard.suit)
          // Spawn mystical particles
          spawnParticles(drawnCard, w / 2, cardY + cardH / 2, cardW, cardH)
        }

        // Card face (shown after flip midpoint)
        // Card background
        ctx.fillStyle = `rgba(15, 12, 25, 0.95)`
        ctx.fillRect(cardX, cardY, cardW, cardH)

        // Card border
        ctx.strokeStyle = `hsla(${drawnCard.hue}, 30%, 40%, 0.3)`
        ctx.lineWidth = 2
        ctx.strokeRect(cardX + 5, cardY + 5, cardW - 10, cardH - 10)

        // Inner border
        ctx.strokeStyle = `hsla(${drawnCard.hue}, 30%, 40%, 0.1)`
        ctx.lineWidth = 1
        ctx.strokeRect(cardX + 12, cardY + 12, cardW - 24, cardH - 24)

        // Reversed indicator — rotate the symbol 180 degrees if reversed
        const symbolAge = time - readingRevealTime
        const symbolRotation = symbolAge * 0.15 + (isReversed ? Math.PI : 0)
        const symbolPulse = 1 + Math.sin(symbolAge * 1.5) * 0.08
        const breathe = Math.sin(time * 0.8) * 0.05

        ctx.save()
        ctx.translate(w / 2, cardY + cardH * 0.35)
        ctx.rotate(symbolRotation)
        ctx.scale(symbolPulse, symbolPulse)
        ctx.translate(-(w / 2), -(cardY + cardH * 0.35))
        drawSymbol(
          ctx, drawnCard.symbol,
          w / 2, cardY + cardH * 0.35,
          cardW * 0.15,
          0.3 + breathe,
          isReversed ? (drawnCard.hue + 180) % 360 : drawnCard.hue,
        )
        ctx.restore()

        // Card name (with reversed indicator)
        ctx.font = '14px "Cormorant Garamond", serif'
        const nameHue = isReversed ? (drawnCard.hue + 180) % 360 : drawnCard.hue
        ctx.fillStyle = `hsla(${nameHue}, 30%, 65%, 0.5)`
        ctx.textAlign = 'center'
        const nameText = isReversed ? `${drawnCard.name} (reversed)` : drawnCard.name
        ctx.fillText(nameText, w / 2, cardY + cardH * 0.6)

        // Suit
        ctx.font = '12px monospace'
        ctx.fillStyle = `hsla(${nameHue}, 20%, 50%, 0.2)`
        ctx.fillText(drawnCard.suit.toLowerCase(), w / 2, cardY + cardH * 0.65)

        // Reading — sequential word fade-in (modified for reversed)
        const readingText = isReversed
          ? REVERSED_PREFIXES[totalDraws % REVERSED_PREFIXES.length] + drawnCard.reading
          : drawnCard.reading
        ctx.font = '13px "Cormorant Garamond", serif'
        const words = readingText.split(' ')
        const maxWidth = cardW - 40
        const timeSinceReveal = readingRevealed ? time - readingRevealTime : 0
        const wordDelay = 0.12 // seconds between each word appearing

        // Pre-calculate line breaks
        const lines: { words: string[]; indices: number[] }[] = [{ words: [], indices: [] }]
        let testLine = ''
        let wordIdx = 0
        for (const word of words) {
          const test = testLine + (testLine ? ' ' : '') + word
          const metrics = ctx.measureText(test)
          if (metrics.width > maxWidth && testLine) {
            lines.push({ words: [], indices: [] })
            testLine = word
          } else {
            testLine = test
          }
          lines[lines.length - 1].words.push(word)
          lines[lines.length - 1].indices.push(wordIdx)
          wordIdx++
        }

        ctx.textAlign = 'center'
        let lineY = cardY + cardH * 0.75
        for (const lineData of lines) {
          let lineStr = ''
          for (let wi = 0; wi < lineData.words.length; wi++) {
            const globalIdx = lineData.indices[wi]
            const wordAlpha = Math.min(1, Math.max(0, (timeSinceReveal - globalIdx * wordDelay) / 0.3))
            const baseAlpha = (0.25 + Math.sin(time * 0.5) * 0.05) * wordAlpha

            // Draw each word segment with its own alpha
            const prefix = lineStr ? ' ' : ''
            const xOffset = lineStr ? ctx.measureText(lineStr).width : 0
            const fullLine = lineStr + prefix + lineData.words[wi]
            const fullWidth = ctx.measureText(fullLine).width
            const lineStartX = w / 2 - fullWidth / 2

            ctx.fillStyle = `rgba(200, 190, 180, ${baseAlpha})`
            const wordX = lineStartX + xOffset + (lineStr ? ctx.measureText(prefix).width : 0)
            ctx.textAlign = 'left'
            ctx.fillText(lineData.words[wi], wordX, lineY)

            lineStr = fullLine
          }
          lineY += 16
        }
        ctx.textAlign = 'center' // restore
      } else {
        // Card back
        ctx.fillStyle = 'rgba(20, 15, 35, 0.95)'
        ctx.fillRect(cardX, cardY, cardW, cardH)
        ctx.strokeStyle = 'rgba(100, 80, 140, 0.2)'
        ctx.lineWidth = 2
        ctx.strokeRect(cardX + 5, cardY + 5, cardW - 10, cardH - 10)

        // Back pattern
        for (let i = 0; i < 5; i++) {
          ctx.strokeStyle = `rgba(100, 80, 140, 0.05)`
          ctx.beginPath()
          ctx.arc(w / 2, h / 2 - 20, 20 + i * 15, 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      ctx.restore()
    }

    // ── Card aura — breathing glow around revealed card ──
    if (drawnCard && drawAnimation >= 1 && readingRevealed) {
      const cardW_ = Math.min(w * 0.4, 280)
      const cardH_ = cardW_ * 1.5
      const cx_ = w / 2
      const cy_ = h / 2 - 20
      const auraPulse = 0.5 + Math.sin(time * 1.2) * 0.5
      const auraSize = Math.max(cardW_, cardH_) * 0.75
      const auraAlpha = 0.03 + auraPulse * 0.02
      const auraGrad = ctx.createRadialGradient(cx_, cy_, auraSize * 0.3, cx_, cy_, auraSize)
      auraGrad.addColorStop(0, `hsla(${drawnCard.hue}, 40%, 50%, ${auraAlpha})`)
      auraGrad.addColorStop(0.5, `hsla(${drawnCard.hue}, 30%, 40%, ${auraAlpha * 0.4})`)
      auraGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = auraGrad
      ctx.beginPath()
      ctx.arc(cx_, cy_, auraSize, 0, Math.PI * 2)
      ctx.fill()
    }

    // Mystical particles — float upward around the card
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.life++
      p.x += p.vx
      p.y += p.vy
      p.vy *= 0.99 // slow down slightly
      const lifeRatio = p.life / p.maxLife
      const fadeAlpha = lifeRatio < 0.2 ? lifeRatio / 0.2 : (1 - lifeRatio) / 0.8
      const a = p.alpha * Math.max(0, fadeAlpha)

      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${p.hue}, 50%, 65%, ${a})`
      ctx.fill()

      if (p.life >= p.maxLife) {
        particles.splice(i, 1)
      }
    }

    // Ghost cards — fading echoes of past readings
    for (let gi = ghostCards.length - 1; gi >= 0; gi--) {
      const gc = ghostCards[gi]
      gc.age += 0.016
      gc.alpha = Math.max(0, 0.12 - gc.age * 0.002) // slow fade over ~60 seconds
      if (gc.alpha <= 0) {
        ghostCards.splice(gi, 1)
        continue
      }
      const gcx = w * gc.x
      const gcy = h * 0.4
      const gcW = 40
      const gcH = 60

      ctx.save()
      ctx.globalAlpha = gc.alpha
      if (gc.reversed) {
        ctx.translate(gcx, gcy)
        ctx.rotate(Math.PI)
        ctx.translate(-gcx, -gcy)
      }

      // Ghost card outline
      ctx.strokeStyle = `hsla(${gc.card.hue}, 30%, 50%, 1)`
      ctx.lineWidth = 0.5
      ctx.strokeRect(gcx - gcW / 2, gcy - gcH / 2, gcW, gcH)

      // Ghost symbol
      drawSymbol(ctx, gc.card.symbol, gcx, gcy - 5, 8, 1, gc.card.hue)

      // Ghost name
      ctx.font = '7px "Cormorant Garamond", serif'
      ctx.fillStyle = `hsla(${gc.card.hue}, 30%, 60%, 1)`
      ctx.textAlign = 'center'
      ctx.fillText(gc.card.name.split(' ').slice(0, 2).join(' '), gcx, gcy + gcH / 2 - 8)

      ctx.globalAlpha = 1
      ctx.restore()
    }

    // Deck indicator
    ctx.font = '12px monospace'
    ctx.fillStyle = 'rgba(140, 120, 160, 0.1)'
    ctx.textAlign = 'center'
    ctx.fillText(`${78 - deckIndex} cards remaining`, w / 2, h * 0.92)

    // Navigation portal cards — face-down tarot spread at bottom
    if (deps?.switchTo) {
      const cardW = 50
      const cardH = 75
      const gap = 24
      const totalW = portalCards.length * cardW + (portalCards.length - 1) * gap
      const startX = w / 2 - totalW / 2

      // Handle delayed navigation after click animation
      if (portalClicked >= 0 && time - portalClickTime > 0.5) {
        const room = portalCards[portalClicked].room
        portalClicked = -1
        deps.switchTo(room)
      }

      for (let i = 0; i < portalCards.length; i++) {
        const pc = portalCards[i]
        const isHovered = hoveredPortal === i
        const isClicked = portalClicked === i

        // Animate hover interpolation
        const hoverTarget = isHovered || isClicked ? 1 : 0
        portalHover[i] += (hoverTarget - portalHover[i]) * 0.12

        // Animate flip interpolation
        const flipTarget = isClicked ? 1 : (isHovered ? 0.35 : 0)
        portalFlip[i] += (flipTarget - portalFlip[i]) * (isClicked ? 0.15 : 0.08)

        // Bob animation — gentle sine wave
        const bob = Math.sin(time * 1.2 + i * 2.1) * 3

        // Lift on hover/click
        const lift = portalHover[i] * 8

        const cx = startX + i * (cardW + gap) + cardW / 2
        const cy = h - 60 + bob - lift

        // Glow on hover
        if (portalHover[i] > 0.01) {
          const glowAlpha = portalHover[i] * 0.15
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cardW * 0.9)
          grad.addColorStop(0, `hsla(${pc.hue}, 50%, 60%, ${glowAlpha})`)
          grad.addColorStop(1, `hsla(${pc.hue}, 50%, 60%, 0)`)
          ctx.fillStyle = grad
          ctx.fillRect(cx - cardW, cy - cardH / 2 - 10, cardW * 2, cardH + 20)
        }

        // Flip via scaleX
        const flipAmt = portalFlip[i]
        const scaleX = Math.cos(flipAmt * Math.PI)
        const showFace = flipAmt > 0.5

        ctx.save()
        ctx.translate(cx, cy)
        ctx.scale(Math.abs(scaleX) || 0.01, 1)

        const x0 = -cardW / 2
        const y0 = -cardH / 2

        if (!showFace) {
          // --- CARD BACK ---
          // Background fill
          ctx.fillStyle = `hsla(${pc.hue}, 30%, 10%, 0.95)`
          ctx.fillRect(x0, y0, cardW, cardH)

          // Border
          ctx.strokeStyle = `hsla(${pc.hue}, 40%, 35%, ${0.25 + portalHover[i] * 0.2})`
          ctx.lineWidth = 1.2
          ctx.strokeRect(x0 + 2, y0 + 2, cardW - 4, cardH - 4)

          // Inner border
          ctx.strokeStyle = `hsla(${pc.hue}, 30%, 30%, 0.12)`
          ctx.lineWidth = 0.5
          ctx.strokeRect(x0 + 5, y0 + 5, cardW - 10, cardH - 10)

          // Unique back pattern per card
          ctx.strokeStyle = `hsla(${pc.hue}, 35%, 45%, ${0.1 + portalHover[i] * 0.1})`
          ctx.lineWidth = 0.8

          if (pc.pattern === 'spiral') {
            // Séance: spiral pattern
            ctx.beginPath()
            for (let t = 0; t < Math.PI * 5; t += 0.15) {
              const r = (t / (Math.PI * 5)) * 16
              const px = Math.cos(t) * r
              const py = Math.sin(t) * r
              if (t === 0) ctx.moveTo(px, py)
              else ctx.lineTo(px, py)
            }
            ctx.stroke()
          } else if (pc.pattern === 'flower') {
            // Madeleine: flower/petal pattern
            for (let p = 0; p < 6; p++) {
              const angle = (p / 6) * Math.PI * 2
              ctx.beginPath()
              ctx.ellipse(
                Math.cos(angle) * 7, Math.sin(angle) * 7,
                6, 3, angle, 0, Math.PI * 2,
              )
              ctx.stroke()
            }
            // Center dot
            ctx.beginPath()
            ctx.arc(0, 0, 2, 0, Math.PI * 2)
            ctx.stroke()
          } else if (pc.pattern === 'book') {
            // Library: book/page lines
            const lineCount = 5
            for (let l = 0; l < lineCount; l++) {
              const ly = -12 + l * 6
              ctx.beginPath()
              ctx.moveTo(-10, ly)
              ctx.lineTo(10, ly)
              ctx.stroke()
            }
            // Spine
            ctx.beginPath()
            ctx.moveTo(0, -16)
            ctx.lineTo(0, 16)
            ctx.stroke()
          }
        } else {
          // --- CARD FACE (revealed during flip) ---
          ctx.fillStyle = `hsla(${pc.hue}, 20%, 8%, 0.95)`
          ctx.fillRect(x0, y0, cardW, cardH)

          ctx.strokeStyle = `hsla(${pc.hue}, 40%, 40%, 0.3)`
          ctx.lineWidth = 1
          ctx.strokeRect(x0 + 2, y0 + 2, cardW - 4, cardH - 4)

          // Destination label
          ctx.font = '12px "Cormorant Garamond", serif'
          ctx.fillStyle = `hsla(${pc.hue}, 30%, 65%, 0.7)`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(pc.label, 0, 0)
          ctx.textBaseline = 'alphabetic'
        }

        ctx.restore()
      }

      // Portal hover audio — play tone when hovering, silence when not
      if (hoveredPortal >= 0 && portalHover[hoveredPortal] > 0.5) {
        updatePortalHoverSound(hoveredPortal, portalCards[hoveredPortal].hue)
      } else {
        updatePortalHoverSound(-1, 0)
      }
    }

    // Draw prompt
    if (!drawing && !spreadDrawing) {
      ctx.font = '12px "Cormorant Garamond", serif'
      const promptAlpha = 0.1 + Math.sin(time * 1.5) * 0.04
      ctx.fillStyle = `rgba(200, 180, 220, ${promptAlpha})`
      ctx.textAlign = 'center'
      ctx.fillText('click to draw  ·  s for spread', w / 2, h * 0.96)
      // Journal hint
      if (journal.length > 0) {
        ctx.font = '10px monospace'
        ctx.fillStyle = `rgba(140, 120, 160, ${promptAlpha * 0.4})`
        ctx.fillText('j — journal', w / 2, h * 0.98)
      }
    }

    // Title
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 180, 220, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the oracle deck', w / 2, 25)

    // Stats
    ctx.font = '12px monospace'
    ctx.fillStyle = 'rgba(140, 120, 160, 0.06)'
    ctx.textAlign = 'left'
    ctx.fillText(`${totalDraws} readings`, 12, h - 18)

    // Cultural inscription
    inscriptionTimer += 0.016
    if (inscriptionTimer >= 23) {
      inscriptionTimer = 0
      inscriptionIdx = (inscriptionIdx + 1) % CULTURAL_INSCRIPTIONS.length
    }
    const insText = CULTURAL_INSCRIPTIONS[inscriptionIdx]
    ctx.font = '11px "Cormorant Garamond", serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(200, 180, 220, 0.03)'
    const insMaxW = w * 0.75
    const insWords = insText.split(' ')
    const insLines: string[] = []
    let insLine = ''
    for (const word of insWords) {
      const test = insLine ? insLine + ' ' + word : word
      if (ctx.measureText(test).width > insMaxW) { insLines.push(insLine); insLine = word }
      else insLine = test
    }
    if (insLine) insLines.push(insLine)
    for (let li = 0; li < insLines.length; li++) {
      ctx.fillText(insLines[li], w / 2, h - 45 + li * 14)
    }
  }

  return {
    name: 'oracle',
    label: 'the oracle deck',

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        width: 100%; height: 100%;
        pointer-events: auto;
        background: #000;
      `

      canvas = document.createElement('canvas')
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      canvas.style.cssText = 'width: 100%; height: 100%; cursor: pointer;'
      ctx = canvas.getContext('2d')

      canvas.addEventListener('click', (e) => {
        // Check portal card clicks first
        if (deps?.switchTo && canvas) {
          const cw = 50, ch = 75, gap = 24
          const totalW = portalCards.length * cw + (portalCards.length - 1) * gap
          const startX = canvas.width / 2 - totalW / 2
          const baseY = canvas.height - 60

          for (let i = 0; i < portalCards.length; i++) {
            const cx = startX + i * (cw + gap) + cw / 2
            const bob = Math.sin(time * 1.2 + i * 2.1) * 3
            const lift = portalHover[i] * 8
            const cy = baseY + bob - lift

            const dx = e.clientX - cx
            const dy = e.clientY - cy
            if (Math.abs(dx) < cw / 2 + 4 && Math.abs(dy) < ch / 2 + 4) {
              if (portalClicked < 0) {
                portalClicked = i
                portalClickTime = time
              }
              return
            }
          }
        }
        // Reset spread mode on single draw
        if (spreadMode && !spreadDrawing) {
          spreadMode = false
          spreadCards = []
        }
        drawCard()
      })

      // Keyboard handler for spread + journal
      keyHandler = (e: KeyboardEvent) => {
        if (!active) return
        if (e.key === 's' || e.key === 'S') {
          if (journalOpen) return
          if (spreadMode && !spreadDrawing) {
            spreadMode = false
            spreadCards = []
          }
          drawSpread()
        } else if (e.key === 'j' || e.key === 'J') {
          toggleJournal()
        } else if (e.key === 'Escape' && journalOpen) {
          toggleJournal()
        }
      }
      window.addEventListener('keydown', keyHandler)

      canvas.addEventListener('mousemove', (e) => {
        if (!canvas) return
        hoveredPortal = -1
        if (!deps?.switchTo) return

        const cw = 50, ch = 75, gap = 24
        const totalW = portalCards.length * cw + (portalCards.length - 1) * gap
        const startX = canvas.width / 2 - totalW / 2
        const baseY = canvas.height - 60

        for (let i = 0; i < portalCards.length; i++) {
          const cx = startX + i * (cw + gap) + cw / 2
          const bob = Math.sin(time * 1.2 + i * 2.1) * 3
          const lift = portalHover[i] * 8
          const cy = baseY + bob - lift

          const dx = e.clientX - cx
          const dy = e.clientY - cy
          if (Math.abs(dx) < cw / 2 + 4 && Math.abs(dy) < ch / 2 + 4) {
            hoveredPortal = i
            break
          }
        }
      })

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)
      return overlay
    },

    activate() {
      active = true
      loadProgress()
      loadJournal()
      deck = generateDeck()
      deckIndex = 0
      drawnCard = null
      isReversed = false
      particles = []
      sigils = []
      ghostCards = []
      revealTonePlayed = false
      readingRevealed = false
      readingRevealTime = 0
      smokeWisps = []
      smokeSpawnTimer = 0
      constellationStars = []
      constellationLines = []
      constellationRevealTimer = 0
      spreadMode = false
      spreadCards = []
      spreadDrawing = false
      journalOpen = false
      hideJournalEl()
      initAudio()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      fadeAudioOut()
      if (journalOpen) { journalOpen = false; hideJournalEl() }
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      cleanupAudio()
      if (keyHandler) { window.removeEventListener('keydown', keyHandler); keyHandler = null }
      journalEl?.remove(); journalEl = null
      overlay?.remove()
    },
  }
}
