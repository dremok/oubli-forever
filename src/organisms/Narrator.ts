/**
 * THE NARRATOR — the house speaks about its own biology
 *
 * Reads the state of all organisms and generates brief, poetic
 * status narrations that appear at the very bottom of the screen.
 * Not whispers (those are cultural fragments). Not transposons
 * (those are room content). The narrator speaks about what is
 * happening to the house RIGHT NOW.
 *
 * "moss is colonizing the labyrinth. no one has visited in hours."
 * "the seasonal clock turns to fall. the mycelium slows."
 * "your phenotype shifts toward water. the house turns blue for you."
 *
 * Narrations are rare (every 30-60s), last 8-10s, and are very
 * subtle — almost invisible. You have to be paying attention.
 *
 * Inspired by:
 * - Dracula: A Love Tale (Besson, Feb 2026) — 400 years of waiting,
 *   the house as immortal observer narrating its own decay
 * - Sonsbeek 2026 "Against Forgetting" — deliberate narration as
 *   resistance to dissolution
 * - Gabriel Garcia Marquez — the narrator who sees everything,
 *   including the future, from a position of infinite patience
 * - Tarkovsky's "Stalker" — the Zone speaks through what it shows you
 */

import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

const MIN_INTERVAL = 30000  // 30s minimum between narrations
const MAX_INTERVAL = 60000  // 60s maximum
const DISPLAY_DURATION = 9000  // 9s display time
const FADE_IN = 1500
const FADE_OUT = 2500
const VOICE_CHANCE = 0.15   // 15% chance of speaking aloud
const VOICE_COOLDOWN = 180000 // 3 min between voice utterances

// Map narration text keywords to audio files
const VOICE_FILES: Array<{ match: RegExp; file: string }> = [
  { match: /approaches.*(decay|change)/, file: '/assets/audio/narrator/narrator-season.mp3' },
  { match: /moss.*creep|reclaimed/, file: '/assets/audio/narrator/narrator-moss.mp3' },
  { match: /cracks.*not metaphor|house is aging/, file: '/assets/audio/narrator/narrator-cracks.mp3' },
  { match: /golden fragments|dismantles/, file: '/assets/audio/narrator/narrator-autophagy.mp3' },
  { match: /fever|antibodies/, file: '/assets/audio/narrator/narrator-fever.mp3' },
  { match: /house was dreaming|still waking/, file: '/assets/audio/narrator/narrator-dreaming.mp3' },
  { match: /protective marks|content escapes|methylation/, file: '/assets/audio/narrator/narrator-methylation.mp3' },
  { match: /sweetness.*temporary/, file: '/assets/audio/narrator/narrator-ripe.mp3' },
  { match: /void watches|says nothing/, file: '/assets/audio/narrator/narrator-void.mp3' },
  { match: /moment of goodbye|reveals itself/, file: '/assets/audio/narrator/narrator-departure.mp3' },
]

interface NarratorDeps {
  getActiveRoom: () => string
  getSeason: () => string
  getSeasonProgress: () => number
  getSystemRipeness: () => number
  getNutrients: (room: string) => number
  getRipeness: (room: string) => number
  getMethylation: (room: string) => number
  getParasitesInRoom: (room: string) => { type: string; strength: number }[]
  getTotalDreams: () => number
  getFeverLevel: () => number
  isImmuneResponding: () => boolean
  getAvgMethylation?: () => number
  getErosionLevel?: () => number
  getAutophagyLevel?: (room: string) => number
  getAvgAutophagy?: () => number
  getDreamIntensity?: () => number
  getDreamDepth?: () => string
  getTideLevel?: () => number
  getTideHighWater?: () => number
  getBatteryLevel?: () => number | null
  getThreadCount?: () => number
}

type NarrationGenerator = (deps: NarratorDeps) => string | null

// Each generator tries to produce a narration from the current state.
// Returns null if conditions aren't interesting enough to narrate.
const GENERATORS: NarrationGenerator[] = [
  // Season narrations
  (d) => {
    const season = d.getSeason()
    const progress = d.getSeasonProgress()
    if (progress > 0.85) {
      const next: Record<string, string> = {
        seed: 'growth', growth: 'ripe', ripe: 'fall', fall: 'decay', decay: 'seed',
      }
      return `the house approaches ${next[season]}. something is about to change.`
    }
    if (progress < 0.1 && season === 'decay') {
      return 'the season of decay begins. the house composts itself.'
    }
    if (progress < 0.1 && season === 'seed') {
      return 'a new cycle begins. the house remembers nothing of the last season.'
    }
    return null
  },

  // Ripeness narrations
  (d) => {
    const ripeness = d.getSystemRipeness()
    if (ripeness > 0.8) return 'the house is golden. every room is ripening. the air smells sweet.'
    if (ripeness > 0.5) return 'more than half the rooms are ripening now. ethylene cascading.'
    if (ripeness < 0.05) return 'the house is young. barely any rooms have begun to ripen.'
    return null
  },

  // Room-specific narrations
  (d) => {
    const room = d.getActiveRoom()
    const nutrients = d.getNutrients(room)
    const ripeness = d.getRipeness(room)
    const methylation = d.getMethylation(room)

    if (nutrients > 10) return `this room is overflowing with nutrients. the mycelium is thick here.`
    if (ripeness > 0.9) return `this room has almost fully ripened. it glows golden in the dark.`
    if (methylation < 0.3) return `this room's protective marks are failing. content drifts outward.`
    if (methylation > 0.95 && nutrients < 0.5) return `this room is pristine but starving. stability without life.`
    return null
  },

  // Parasite narrations
  (d) => {
    const room = d.getActiveRoom()
    const parasites = d.getParasitesInRoom(room)
    if (parasites.length === 0) return null

    const strongest = parasites.reduce((a, b) => a.strength > b.strength ? a : b)
    const typeDescs: Record<string, string> = {
      moss: 'moss creeps in from the edges. the room is being reclaimed.',
      barnacle: 'barnacles encrust the surfaces. well-traveled rooms attract them.',
      scavenger: 'a scavenger feeds on stagnant nutrients. it dims the light.',
      phosphor: 'phosphorescence glows from strong connections. bioluminescence.',
      lichen: 'lichen grows in symbiosis. the room is shared now.',
    }
    if (strongest.strength > 0.5) {
      return typeDescs[strongest.type] || null
    }
    return null
  },

  // Croak dream narrations
  (d) => {
    const dreams = d.getTotalDreams()
    if (dreams === 1) return 'the house had its first death dream. a premonition of forgetting.'
    if (dreams === 5) return 'five croak dreams now. the house sees its end more often.'
    if (dreams > 10 && Math.random() < 0.3) return `${dreams} premonitions. the house dreams of dissolution.`
    return null
  },

  // Methylation narrations (cross-room)
  (d) => {
    const room = d.getActiveRoom()
    // Check neighboring rooms for low methylation
    const neighbors = ['void', 'study', 'garden', 'observatory', 'instrument', 'seance',
      'darkroom', 'archive', 'loom', 'furnace', 'clocktower', 'pendulum']
      .filter(r => r !== room)

    const failing = neighbors.filter(r => d.getMethylation(r) < 0.3)
    if (failing.length >= 3) {
      return 'multiple rooms are losing their protective marks. the genome destabilizes.'
    }
    if (failing.length === 1) {
      const name = failing[0].replace(/([A-Z])/g, ' $1').trim().toLowerCase()
      return `the ${name}'s methylation is failing. its content escapes into the house.`
    }
    return null
  },

  // Immune system narrations
  (d) => {
    const fever = d.getFeverLevel()
    const responding = d.isImmuneResponding()
    if (fever > 0.6) return 'the house is running a fever. golden antibodies swarm the edges.'
    if (fever > 0.3) return 'warmth rises. the immune system stirs against the decay.'
    if (responding) return 'golden particles drift outward. the house is defending itself.'
    return null
  },

  // Scrambled replay narrations
  (d) => {
    const avgMeth = d.getAvgMethylation?.()
    if (avgMeth !== undefined && avgMeth < 0.5) {
      const options = [
        'the house replays your path. the order is wrong.',
        'hippocampal replay — but the sequence has scrambled.',
        'it remembers you were here. it forgets the order.',
        'a corrupted signal: your path, reassembled incorrectly.',
      ]
      return options[Math.floor(Math.random() * options.length)]
    }
    return null
  },

  // Erosion narrations
  (d) => {
    const erosion = d.getErosionLevel?.()
    if (erosion === undefined) return null
    if (erosion > 0.5) return 'the cracks are not metaphor. the house is aging. this cannot be undone.'
    if (erosion > 0.3) return 'watermarks appear on surfaces that were once clean. the erosion is permanent.'
    if (erosion > 0.15) return 'age spots. hairline fractures. the house accrues what it cannot shed.'
    if (erosion > 0.05) return 'something is accumulating that will never go away. the first cracks appear.'
    return null
  },

  // Autophagy narrations
  (d) => {
    const room = d.getActiveRoom()
    const level = d.getAutophagyLevel?.(room)
    if (level === undefined) return null
    if (level > 0.5) return 'this room has stripped itself to the bone. it survives by becoming less.'
    if (level > 0.3) return 'the house is eating its own walls here. this is not decay — this is survival.'
    if (level > 0.15) return 'golden fragments rise. the room is lighter now. it chose to let go.'
    if (level > 0.05) return 'autophagy begins. the room dismantles what it no longer needs.'
    const avg = d.getAvgAutophagy?.()
    if (avg !== undefined && avg > 0.2) return 'the house has learned: to endure is to reduce. the longest-lived rooms are the emptiest.'
    return null
  },

  // Hypnagogia narrations — the house just woke up
  (d) => {
    const intensity = d.getDreamIntensity?.()
    const depth = d.getDreamDepth?.()
    if (!intensity || !depth || depth === 'none') return null
    if (intensity > 0.7) return 'the house barely recognizes you. it was somewhere else entirely.'
    if (intensity > 0.4) return 'the house is still waking up. its dreams cling to the walls.'
    if (intensity > 0.1) return 'the rooms are settling. the house was dreaming while you were gone.'
    if (depth === 'light') return 'a brief sleep. the house dozed. it dreamed of particles.'
    return null
  },

  // Tide narrations — the water level of the house
  (d) => {
    const level = d.getTideLevel?.()
    const highWater = d.getTideHighWater?.()
    if (level === undefined) return null
    if (level > 0.8) return 'the tide is high. hidden content surfaces. the house is full of you.'
    if (level > 0.6) return 'the water rises with your presence. rooms that were dry are filling.'
    if (level < 0.1 && highWater !== undefined && highWater > 0.5) {
      return 'the tide has receded past its old watermarks. the drought deepens.'
    }
    if (level < 0.2) return 'the house is drying out. presence is scarce. the foundation shows.'
    return null
  },

  // Mortality narrations — battery awareness
  (d) => {
    const battery = d.getBatteryLevel?.()
    if (battery === null || battery === undefined) return null
    if (battery < 0.1) return 'the device flickers. the house holds on.'
    if (battery < 0.2) return 'your battery is low. the house knows this feeling — running out of time.'
    return null
  },

  // Poetic/atmospheric
  (d) => {
    const season = d.getSeason()
    const room = d.getActiveRoom()
    const poetics: string[] = []

    if (season === 'ripe') poetics.push('the sweetness is temporary. enjoy it.')
    if (season === 'fall') poetics.push('everything beautiful is leaving now.')
    if (season === 'decay') poetics.push('what falls nourishes what grows next.')
    if (room === 'void') poetics.push('the void watches everything and says nothing.')
    if (room === 'garden') poetics.push('the plants are your thoughts, given roots.')
    if (room === 'lighthouse') poetics.push('the signal repeats. no one answers.')

    return poetics.length > 0 ? poetics[Math.floor(Math.random() * poetics.length)] : null
  },

  // Thread narrations — the navigation web
  (deps) => {
    const count = deps.getThreadCount?.() ?? 0
    if (count < 10) return null

    if (count > 200) {
      return [
        'the threads between rooms are denser than the rooms themselves.',
        'the connections have become the structure. rooms are secondary.',
        'so many paths walked. the web is becoming opaque.',
      ][Math.floor(Math.random() * 3)]
    }
    if (count > 100) {
      return [
        'threads accumulate between rooms. the web is thickening.',
        'every passage leaves a thread. the house is being stitched together.',
      ][Math.floor(Math.random() * 2)]
    }
    if (count > 30 && Math.random() < 0.3) {
      return 'threads of navigation criss-cross the house. your movement is the weaving.'
    }
    return null
  },
]

export class Narrator {
  private el: HTMLElement
  private deps: NarratorDeps | null = null
  private timer: number | null = null
  private displayTimer: number | null = null
  private lastNarration = ''
  private usedNarrations = new Set<string>()
  private lastVoiceTime = 0
  private voiceBuffers = new Map<string, AudioBuffer>()

  constructor() {
    this.el = document.createElement('div')
    this.el.style.cssText = `
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 60;
      pointer-events: none;
      font: italic 11px Cormorant Garamond, serif;
      color: rgba(180, 160, 140, 0);
      text-align: center;
      max-width: 500px;
      letter-spacing: 0.5px;
      transition: color ${FADE_IN}ms ease;
      white-space: nowrap;
    `
    document.body.appendChild(this.el)
  }

  setDeps(deps: NarratorDeps) {
    this.deps = deps
  }

  start() {
    this.scheduleNext()
    // Preload voice files lazily (don't block)
    this.preloadVoices()
  }

  private async preloadVoices() {
    try {
      const ctx = await getAudioContext()
      for (const { file } of VOICE_FILES) {
        try {
          const resp = await fetch(file)
          if (!resp.ok) continue
          const buf = await resp.arrayBuffer()
          const audioBuf = await ctx.decodeAudioData(buf)
          this.voiceBuffers.set(file, audioBuf)
        } catch { /* silent — individual file failure is fine */ }
      }
    } catch { /* audio context not available */ }
  }

  private maybeSpeak(text: string) {
    const now = Date.now()
    if (now - this.lastVoiceTime < VOICE_COOLDOWN) return
    if (Math.random() > VOICE_CHANCE) return

    // Find matching voice file
    const match = VOICE_FILES.find(v => v.match.test(text))
    if (!match) return

    const buffer = this.voiceBuffers.get(match.file)
    if (!buffer) return

    let dest: AudioNode
    try {
      dest = getAudioDestination()
    } catch { return }

    // Need the audio context for playback
    getAudioContext().then(ctx => {
      this.lastVoiceTime = now

      const source = ctx.createBufferSource()
      source.buffer = buffer
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.5)
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + buffer.duration)
      source.connect(gain)
      gain.connect(dest)
      source.start()
    }).catch(() => { /* silent */ })
  }

  private scheduleNext() {
    const delay = MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL)
    this.timer = window.setTimeout(() => this.tryNarrate(), delay)
  }

  private tryNarrate() {
    if (!this.deps) {
      this.scheduleNext()
      return
    }

    // Shuffle generators and try each until one produces a narration
    const shuffled = [...GENERATORS].sort(() => Math.random() - 0.5)

    for (const gen of shuffled) {
      const text = gen(this.deps)
      if (text && text !== this.lastNarration && !this.usedNarrations.has(text)) {
        this.display(text)
        this.lastNarration = text
        this.usedNarrations.add(text)

        // Keep used set manageable
        if (this.usedNarrations.size > 30) {
          const first = this.usedNarrations.values().next().value
          if (first) this.usedNarrations.delete(first)
        }
        break
      }
    }

    this.scheduleNext()
  }

  private display(text: string) {
    this.el.textContent = text
    // Fade in
    this.el.style.color = 'rgba(180, 160, 140, 0.18)'
    // Occasionally speak aloud
    this.maybeSpeak(text)

    // Fade out after display duration
    if (this.displayTimer) clearTimeout(this.displayTimer)
    this.displayTimer = window.setTimeout(() => {
      this.el.style.transition = `color ${FADE_OUT}ms ease`
      this.el.style.color = 'rgba(180, 160, 140, 0)'
      // Reset transition timing for next fade-in
      setTimeout(() => {
        this.el.style.transition = `color ${FADE_IN}ms ease`
      }, FADE_OUT)
    }, DISPLAY_DURATION)
  }
}
