/**
 * COLOR MEMORY — the void reflects your emotional tone
 *
 * As you type memories, the system analyzes the emotional valence
 * of your words and gradually shifts the color temperature of the
 * environment. Warm words (love, summer, golden, laughter) push
 * the palette toward golds and pinks. Cold words (lost, alone,
 * winter, gone) push toward blues and violets.
 *
 * The shift is very slow and subtle — you won't notice it happening.
 * But over a 10-minute session where you type sad memories, the
 * void becomes noticeably cooler. Type joyful memories and it warms.
 *
 * The color state persists in localStorage. Return visitors see
 * the cumulative emotional tone of all their previous sessions.
 * Over time, the void becomes colored by your emotional history.
 *
 * This is ambient emotional intelligence — the system responds to
 * what you give it, not through words, but through light.
 *
 * Inspired by: Color therapy, mood rings, James Turrell's light
 * installations, the way cities feel different at different times
 */

const STORAGE_KEY = 'oubli-color-memory'

// Words associated with warmth/joy
const WARM_WORDS = new Set([
  'love', 'happy', 'joy', 'light', 'sun', 'warm', 'golden', 'bright',
  'laugh', 'smile', 'dance', 'summer', 'fire', 'bloom', 'hope', 'dream',
  'sing', 'sweet', 'tender', 'gentle', 'peace', 'kiss', 'hug', 'home',
  'friend', 'family', 'together', 'beautiful', 'alive', 'morning',
  'garden', 'music', 'play', 'wonder', 'magic', 'star', 'shine',
  'glow', 'radiant', 'embrace', 'celebrate', 'cherish', 'delight',
])

// Words associated with cold/melancholy
const COLD_WORDS = new Set([
  'lost', 'alone', 'cold', 'dark', 'gone', 'dead', 'empty', 'shadow',
  'winter', 'rain', 'grey', 'fade', 'forget', 'pain', 'grief', 'miss',
  'silent', 'void', 'nothing', 'never', 'broken', 'end', 'last',
  'ghost', 'absence', 'hollow', 'distant', 'lonely', 'vanish', 'ash',
  'ice', 'fog', 'sorrow', 'weep', 'grave', 'dust', 'rust', 'erode',
  'decay', 'dissolve', 'shatter', 'wither', 'haunt', 'mourn',
])

interface ColorState {
  warmth: number // -1 (cold) to +1 (warm), 0 = neutral
  momentum: number // rate of change
}

export class ColorMemory {
  private state: ColorState
  private overlay: HTMLDivElement

  constructor() {
    this.state = this.load()

    // Create a color overlay that tints the entire page
    this.overlay = document.createElement('div')
    this.overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 2; pointer-events: none;
      transition: background-color 10s ease;
      mix-blend-mode: color;
      opacity: 0.08;
    `
    document.body.appendChild(this.overlay)

    this.applyColor()
  }

  private load(): ColorState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) return JSON.parse(stored)
    } catch { /* */ }
    return { warmth: 0, momentum: 0 }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch { /* */ }
  }

  /** Analyze text and shift the color accordingly */
  processText(text: string) {
    const words = text.toLowerCase().split(/\W+/)
    let warmScore = 0
    let coldScore = 0

    for (const word of words) {
      if (WARM_WORDS.has(word)) warmScore++
      if (COLD_WORDS.has(word)) coldScore++
    }

    // Only shift if there's emotional content
    if (warmScore === 0 && coldScore === 0) return

    const total = warmScore + coldScore
    const direction = (warmScore - coldScore) / total // -1 to 1

    // Shift warmth gradually
    this.state.warmth += direction * 0.05
    this.state.warmth = Math.max(-1, Math.min(1, this.state.warmth))

    // Decay toward neutral over time
    this.state.warmth *= 0.98

    this.save()
    this.applyColor()
  }

  private applyColor() {
    const w = this.state.warmth

    let hue: number
    let sat: number

    if (w > 0) {
      // Warm: gold to pink
      hue = 40 - w * 20 // 40 (gold) → 20 (warm orange)
      sat = 60 + w * 30
    } else {
      // Cold: blue to violet
      hue = 240 + w * 40 // 240 (blue) → 200 (cyan-blue)
      sat = 50 + Math.abs(w) * 40
    }

    const light = 50

    this.overlay.style.backgroundColor = `hsla(${hue}, ${sat}%, ${light}%, 1)`
    this.overlay.style.opacity = `${0.03 + Math.abs(w) * 0.08}`
  }

  getWarmth(): number {
    return this.state.warmth
  }

  destroy() {
    this.overlay.remove()
  }
}
