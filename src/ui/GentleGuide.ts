/**
 * GENTLE GUIDE — the void shows you what it can do
 *
 * A brief, elegant overlay that appears 5 seconds after page load,
 * showing the key interactions available. It's not a tutorial — it's
 * a whispered invitation. The guide fades in very softly, stays for
 * 12 seconds, then dissolves. Any interaction dismisses it instantly.
 *
 * On return visits, the guide is shorter (just shows new features
 * the user hasn't tried yet). After 3 visits, the guide stops
 * appearing entirely — the user has learned the void.
 *
 * Inspired by: Museum wall labels, the subtle signage in Japanese
 * gardens, how a good host gestures rather than explains
 */

const STORAGE_KEY = 'oubli-guide'

interface GuideState {
  visits: number
  dismissed: boolean
  triedFeatures: string[]
}

interface GuideItem {
  key: string       // feature ID
  action: string    // what to do
  result: string    // what happens
  position: 'left' | 'right' | 'center'
}

const ALL_ITEMS: GuideItem[] = [
  { key: 'type', action: 'type + enter', result: 'give a memory to the void', position: 'center' },
  { key: 'voice', action: 'hold spacebar', result: 'speak into the darkness', position: 'center' },
  { key: 'click', action: 'click anywhere', result: 'the void sings', position: 'center' },
  { key: 'rooms', action: 'navigation bar above', result: 'rooms to explore', position: 'center' },
  { key: 'keys', action: 'a  m  h  t', result: 'ascii · memories · heatmap · trails', position: 'center' },
]

export class GentleGuide {
  private overlay: HTMLDivElement
  private state: GuideState
  private visible = false
  private timeout: number | null = null
  private dismissHandler: ((e: Event) => void) | null = null

  constructor() {
    this.state = this.load()
    this.state.visits++
    this.save()

    this.overlay = document.createElement('div')
    this.overlay.setAttribute('data-no-resonance', 'true')
    this.overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 600; pointer-events: none;
      display: flex; align-items: center; justify-content: flex-start;
      opacity: 0;
      transition: opacity 2s ease;
    `
    document.body.appendChild(this.overlay)

    // Dismiss on any interaction (only if visible)
    this.dismissHandler = () => {
      if (this.visible) {
        this.hide()
        this.removeDismissListeners()
      }
    }
    window.addEventListener('keydown', this.dismissHandler)
    window.addEventListener('click', this.dismissHandler)
    window.addEventListener('touchstart', this.dismissHandler)
  }

  private load(): GuideState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) return JSON.parse(stored)
    } catch { /* */ }
    return { visits: 0, dismissed: false, triedFeatures: [] }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch { /* */ }
  }

  /** Show the guide after a delay */
  show(voiceSupported: boolean) {
    // After many visits, only show on ~20% of visits as a gentle reminder
    if (this.state.visits > 5 && Math.random() > 0.2) return

    const items = ALL_ITEMS.filter(item => {
      if (item.key === 'voice' && !voiceSupported) return false
      // On return visits, only show features not yet tried
      if (this.state.visits > 2) {
        return !this.state.triedFeatures.includes(item.key)
      }
      return true
    })

    if (items.length === 0) return

    this.renderItems(items)

    // Show after 5 seconds
    this.timeout = window.setTimeout(() => {
      this.visible = true
      this.overlay.style.opacity = '1'

      // Auto-hide after 12 seconds
      this.timeout = window.setTimeout(() => {
        this.hide()
      }, 12000)
    }, 5000)
  }

  private renderItems(items: GuideItem[]) {
    let html = `
      <div style="
        text-align: left;
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300;
        max-width: 400px;
        padding: 30px 30px 30px 40px;
      ">
    `

    for (const item of items) {
      html += `
        <div style="
          margin-bottom: 18px;
          opacity: 0.9;
        ">
          <div style="
            font-size: 13px;
            letter-spacing: 3px;
            color: rgba(255, 20, 147, 0.5);
            margin-bottom: 3px;
            font-family: monospace;
          ">${item.action}</div>
          <div style="
            font-size: 14px;
            letter-spacing: 1px;
            color: rgba(255, 215, 0, 0.35);
            font-style: italic;
          ">${item.result}</div>
        </div>
      `
    }

    html += `</div>`
    this.overlay.innerHTML = html
  }

  private hide() {
    this.visible = false
    this.overlay.style.opacity = '0'
    if (this.timeout) clearTimeout(this.timeout)
  }

  /** Mark a feature as tried (won't show in guide on future visits) */
  markTried(featureKey: string) {
    if (!this.state.triedFeatures.includes(featureKey)) {
      this.state.triedFeatures.push(featureKey)
      this.save()
    }
  }

  private removeDismissListeners() {
    if (this.dismissHandler) {
      window.removeEventListener('keydown', this.dismissHandler)
      window.removeEventListener('click', this.dismissHandler)
      window.removeEventListener('touchstart', this.dismissHandler)
    }
  }

  destroy() {
    if (this.timeout) clearTimeout(this.timeout)
    this.removeDismissListeners()
    this.overlay.remove()
  }
}
