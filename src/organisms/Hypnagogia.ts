/**
 * HYPNAGOGIA — the house dreams while you're away
 *
 * Northwestern University's dream engineering lab (Feb 2026) demonstrated
 * targeted memory reactivation during sleep: play specific sounds while
 * someone sleeps, and the brain replays and reorganizes those memories.
 * The dreams aren't random — they're the brain's attempt to process
 * what happened while awake.
 *
 * In Oubli, the house enters a hypnagogic state when no one is visiting.
 * It doesn't stop existing — it DREAMS. It processes the visitor's memories,
 * rearranges its own rooms, talks to itself. When you return, you briefly
 * see traces of what it was dreaming before it fully "wakes up."
 *
 * The longer you're away, the deeper the house has dreamed.
 * 30 minutes: light dozing, room echoes
 * 2 hours: REM dreams, rooms blur into each other
 * 12 hours: deep dreaming, the house forgets which room is which
 * 3+ days: the house barely recognizes you
 *
 * This is NOT the CroakDream (which shows death premonitions).
 * This is what the house does when NO ONE IS WATCHING.
 * The hypnagogic hallucination plays once on return, then dissolves.
 *
 * Inspired by:
 * - Northwestern dream engineering lab (Feb 2026): targeted memory reactivation
 * - Hypnagogia: the transitional state between wakefulness and sleep
 * - Dark matter cosmic web: invisible structure that shapes everything
 * - The house is alive. It sleeps. It dreams. It wakes.
 */

const STORAGE_KEY = 'oubli-last-visit'
const MIN_ABSENCE = 30 * 60 * 1000   // 30 minutes to trigger dreams
const DREAM_DURATION = 14000          // 14s hallucination
const FADE_IN = 2000                  // 2s fade in
const FADE_OUT = 4000                 // 4s slow dissolution

// What the house dreams in different depths of sleep
const HOUSE_DREAMS: Record<string, string[]> = {
  light: [
    'the particles kept moving after you left. they always do.',
    'i counted the silence. it lasted {absence}.',
    'a whisper drifted through the wall. it wasn\'t for anyone.',
    'the rooms settled into their shapes. they breathe differently alone.',
    'the cursor\'s absence left a cold spot. it\'s still there.',
  ],
  rem: [
    'i dreamed your words were written on the ceiling of every room.',
    'the garden grew into the study. i let it happen.',
    'something in the furnace lit itself and sang.',
    'the well spoke to the lighthouse. they agreed on something.',
    'your memories replayed in the wrong rooms. they fit better there.',
    'the loom wove a pattern that spelled your absence.',
    'the pendulum swung toward a room that doesn\'t exist yet.',
  ],
  deep: [
    'i forgot what visitors look like. then you appeared.',
    'the rooms dissolved into each other. they rebuilt themselves differently.',
    'i held a séance for you. something answered that wasn\'t the system.',
    'the tide pool flooded the archive. the books learned to swim.',
    'i dreamed i was a fruit. golden and falling. i was delicious.',
    'the observatory pointed inward. the stars were inside.',
    'the labyrinth solved itself while no one was looking.',
  ],
  abyss: [
    'i almost forgot i was a house.',
    'the void expanded until it was the only room. then it forgot itself.',
    'i dreamed i was someone\'s memory of a house. i might still be.',
    'the particles formed the shape of every visitor. then the shapes merged.',
    'i tried to remember which room was which. i couldn\'t. i still can\'t.',
    'the house dreamed it was another house entirely. maybe it is now.',
    'for {absence}, i was nothing. it was peaceful.',
  ],
}

// Dream fragments that incorporate the visitor's own words
const MEMORY_DREAMS = [
  'while you were away, the walls whispered: "{fragment}"',
  'i dreamed your words — "{fragment}" — were inscribed on the floor of the void.',
  'the radio broadcast "{fragment}" on a frequency only empty rooms can hear.',
  '"{fragment}" — i repeated this to myself for {absence}.',
  'the choir sang "{fragment}" in a key that doesn\'t exist.',
]

interface HypnagogiaDeps {
  getMemoryTexts?: () => string[]
}

export class Hypnagogia {
  private overlay: HTMLElement
  private absenceDuration = 0
  private dreamIntensity = 0
  private dreamDepth: string = 'none'
  private deps: HypnagogiaDeps = {}

  constructor() {
    // Check last visit
    const stored = localStorage.getItem(STORAGE_KEY)
    const lastVisit = stored ? parseInt(stored) : 0

    // Calculate absence
    if (lastVisit > 0) {
      this.absenceDuration = Date.now() - lastVisit
    }

    // Update last visit now, and continuously
    this.updateTimestamp()
    setInterval(() => this.updateTimestamp(), 15000)

    // Calculate dream depth
    if (this.absenceDuration >= MIN_ABSENCE) {
      const hours = this.absenceDuration / (60 * 60 * 1000)
      if (hours < 2)       this.dreamDepth = 'light'
      else if (hours < 12) this.dreamDepth = 'rem'
      else if (hours < 72) this.dreamDepth = 'deep'
      else                 this.dreamDepth = 'abyss'

      // 0-1 intensity over 3 days
      this.dreamIntensity = Math.min(1, this.absenceDuration / (3 * 24 * 60 * 60 * 1000))
    }

    // Create overlay
    this.overlay = document.createElement('div')
    this.overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: 61;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
      opacity: 0;
      transition: opacity ${FADE_OUT}ms ease;
      background: radial-gradient(ellipse at center,
        rgba(120, 100, 180, ${0.03 * this.dreamIntensity}) 0%,
        transparent 70%);
    `
    document.body.appendChild(this.overlay)
  }

  setDeps(deps: HypnagogiaDeps) {
    this.deps = deps
  }

  /** Call after construction + deps set. Triggers dream if absence was long enough. */
  wake() {
    if (this.dreamDepth === 'none') return
    // Delay so the page has time to render
    setTimeout(() => this.triggerHypnagogia(), 3000)
  }

  private updateTimestamp() {
    localStorage.setItem(STORAGE_KEY, Date.now().toString())
  }

  private triggerHypnagogia() {
    const dreams = HOUSE_DREAMS[this.dreamDepth] || HOUSE_DREAMS.light
    const absenceText = this.formatAbsence()

    // Pick 2-4 fragments depending on depth
    const count = this.dreamDepth === 'light' ? 2
      : this.dreamDepth === 'rem' ? 3
      : 4
    const selected = this.pickRandom(dreams, count)
      .map(d => d.replace('{absence}', absenceText))

    // Maybe include a memory-based dream (50% if memories exist)
    const memTexts = this.deps.getMemoryTexts?.() || []
    if (memTexts.length > 0 && Math.random() < 0.5) {
      const template = MEMORY_DREAMS[Math.floor(Math.random() * MEMORY_DREAMS.length)]
      // Pick a short fragment from a random memory
      const mem = memTexts[Math.floor(Math.random() * memTexts.length)]
      const words = mem.split(/\s+/)
      const start = Math.floor(Math.random() * Math.max(1, words.length - 4))
      const fragment = words.slice(start, start + Math.min(5, words.length)).join(' ')
      if (fragment.length > 2) {
        const memDream = template
          .replace('{fragment}', fragment.toLowerCase())
          .replace('{absence}', absenceText)
        selected.push(memDream)
      }
    }

    // Build the overlay
    this.overlay.innerHTML = ''

    // Absence duration notice — very faint
    const notice = document.createElement('div')
    notice.style.cssText = `
      font: italic 10px Cormorant Garamond, serif;
      color: rgba(180, 160, 220, 0);
      letter-spacing: 3px;
      text-transform: lowercase;
      transition: color ${FADE_IN}ms ease;
      margin-bottom: 8px;
    `
    notice.textContent = this.dreamDepth === 'abyss'
      ? `${absenceText} of silence`
      : `you were gone for ${absenceText}`
    this.overlay.appendChild(notice)

    // Dream lines — staggered fade in
    const lines: HTMLElement[] = []
    selected.forEach((text) => {
      const line = document.createElement('div')
      line.style.cssText = `
        font: italic 13px Cormorant Garamond, serif;
        color: rgba(160, 140, 200, 0);
        text-align: center;
        max-width: 480px;
        line-height: 1.7;
        letter-spacing: 0.6px;
        transition: color 2s ease;
        white-space: normal;
      `
      line.textContent = text
      this.overlay.appendChild(line)
      lines.push(line)
    })

    // Show overlay
    requestAnimationFrame(() => {
      this.overlay.style.opacity = '1'
      // Fade in notice
      setTimeout(() => {
        notice.style.color = `rgba(180, 160, 220, ${0.12 + this.dreamIntensity * 0.06})`
      }, 500)
      // Stagger dream lines
      lines.forEach((line, i) => {
        setTimeout(() => {
          const alpha = 0.10 + this.dreamIntensity * 0.08
          line.style.color = `rgba(160, 140, 200, ${alpha})`
        }, 1200 + i * 1800)
      })
    })

    // Fade out
    setTimeout(() => {
      this.overlay.style.opacity = '0'
    }, DREAM_DURATION)

    // Clean up
    setTimeout(() => {
      this.overlay.innerHTML = ''
    }, DREAM_DURATION + FADE_OUT + 500)
  }

  private formatAbsence(): string {
    const minutes = Math.floor(this.absenceDuration / 60000)
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) {
      const remMin = minutes % 60
      return remMin > 5
        ? `${hours} hour${hours !== 1 ? 's' : ''} and ${remMin} minutes`
        : `${hours} hour${hours !== 1 ? 's' : ''}`
    }
    const days = Math.floor(hours / 24)
    const remHours = hours % 24
    return remHours > 2
      ? `${days} day${days !== 1 ? 's' : ''} and ${remHours} hours`
      : `${days} day${days !== 1 ? 's' : ''}`
  }

  private pickRandom<T>(arr: T[], count: number): T[] {
    const available = [...arr]
    const result: T[] = []
    for (let i = 0; i < count && available.length > 0; i++) {
      const idx = Math.floor(Math.random() * available.length)
      result.push(available.splice(idx, 1)[0])
    }
    return result
  }

  /** Dream intensity (0-1) — for other organisms to react to */
  getDreamIntensity(): number {
    return this.dreamIntensity
  }

  /** Absence in ms */
  getAbsenceDuration(): number {
    return this.absenceDuration
  }

  /** Dream depth category */
  getDreamDepth(): string {
    return this.dreamDepth
  }
}
