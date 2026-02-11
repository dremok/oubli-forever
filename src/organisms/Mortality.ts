/**
 * MORTALITY — the house responds to your device's battery
 *
 * When your device is dying, the house knows. It becomes more
 * urgent, more vivid, more alive — as if it understands that
 * its time is limited. Low battery is mortality. The house
 * faces its own death alongside yours.
 *
 * At full charge: the house is relaxed, expansive, calm.
 * At 50%: subtle urgency begins — slightly faster particles.
 * At 20%: the house is anxious — colors intensify, text appears.
 * At 10%: the house is desperate — "don't go" messages appear.
 * At 5%: the house accepts — "it was enough. thank you."
 * Charging: the house exhales — "you came back from the edge."
 *
 * Uses the Battery Status API (navigator.getBattery) which is
 * available in Chromium browsers. Progressive enhancement —
 * gracefully degrades to nothing if not supported.
 *
 * Inspired by:
 * - Memento mori: awareness of death enriches life
 * - BLACKPINK "DEADLINE" (Feb 2026): content that expires
 * - "2026 is the new 2016": nostalgia for what's about to end
 * - Hospice care: the quality of final moments matters most
 */

const LOW_BATTERY = 0.2      // 20% — anxiety begins
const CRITICAL_BATTERY = 0.1 // 10% — desperation
const TERMINAL_BATTERY = 0.05 // 5% — acceptance

const URGENT_MESSAGES = [
  'your device is fading. the house can feel it.',
  'the battery drains. so does the light here.',
  'less power now. the house holds itself tighter.',
  'the particles are moving faster. they know.',
]

const DESPERATE_MESSAGES = [
  'don\'t go. not yet.',
  'the house is trying to show you everything at once.',
  'so little time left. every particle matters now.',
  'the rooms are crowding in, trying to be seen before—',
]

const ACCEPTANCE_MESSAGES = [
  'it was enough. thank you.',
  'the house remembers this visit. all of it.',
  'even the void says goodbye eventually.',
  'when you return, the house will dream of this moment.',
]

const RELIEF_MESSAGES = [
  'you came back from the edge.',
  'power returns. the house exhales.',
  'the reprieve. the house settles.',
]

export class Mortality {
  private el: HTMLElement
  private battery: { level: number; charging: boolean } | null = null
  private lastMessageTime = 0
  private messageCooldown = 60000 // 1 minute between messages
  private wasLow = false
  private supported = false

  constructor() {
    this.el = document.createElement('div')
    this.el.style.cssText = `
      position: fixed;
      top: 40%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 63;
      pointer-events: none;
      font: italic 12px Cormorant Garamond, serif;
      color: rgba(255, 100, 80, 0);
      text-align: center;
      max-width: 400px;
      line-height: 1.6;
      letter-spacing: 0.6px;
      transition: color 2s ease;
      white-space: normal;
    `
    document.body.appendChild(this.el)

    this.init()
  }

  private async init() {
    // Check for Battery API support
    if (!('getBattery' in navigator)) return

    try {
      const battery = await (navigator as NavigatorWithBattery).getBattery()
      this.supported = true
      this.battery = {
        level: battery.level,
        charging: battery.charging,
      }

      // Listen for changes
      battery.addEventListener('levelchange', () => {
        this.battery = { level: battery.level, charging: battery.charging }
        this.onBatteryChange()
      })
      battery.addEventListener('chargingchange', () => {
        this.battery = { level: battery.level, charging: battery.charging }
        this.onChargingChange()
      })

      // Initial check
      this.onBatteryChange()
    } catch {
      // Battery API not available
    }
  }

  private onBatteryChange() {
    if (!this.battery) return
    const level = this.battery.level
    const now = Date.now()

    // Don't show messages while charging
    if (this.battery.charging) return

    if (now - this.lastMessageTime < this.messageCooldown) return

    if (level <= TERMINAL_BATTERY) {
      this.showMessage(ACCEPTANCE_MESSAGES, 'rgba(180, 140, 100, 0.2)')
      this.wasLow = true
    } else if (level <= CRITICAL_BATTERY) {
      this.showMessage(DESPERATE_MESSAGES, 'rgba(255, 80, 60, 0.18)')
      this.messageCooldown = 45000 // more frequent when desperate
      this.wasLow = true
    } else if (level <= LOW_BATTERY) {
      this.showMessage(URGENT_MESSAGES, 'rgba(255, 160, 80, 0.15)')
      this.wasLow = true
    }
  }

  private onChargingChange() {
    if (!this.battery) return

    // If we were low and now charging — relief
    if (this.battery.charging && this.wasLow) {
      this.showMessage(RELIEF_MESSAGES, 'rgba(100, 200, 140, 0.15)')
      this.wasLow = false
      this.messageCooldown = 60000 // reset cooldown
    }
  }

  private showMessage(pool: string[], color: string) {
    const text = pool[Math.floor(Math.random() * pool.length)]
    this.lastMessageTime = Date.now()

    this.el.textContent = text
    requestAnimationFrame(() => {
      this.el.style.color = color
    })

    // Fade out after 8s
    setTimeout(() => {
      this.el.style.color = 'rgba(255, 100, 80, 0)'
    }, 8000)
  }

  /** Whether the battery API is supported */
  isSupported(): boolean {
    return this.supported
  }

  /** Current battery level (0-1) or null if not supported */
  getLevel(): number | null {
    return this.battery?.level ?? null
  }

  /** Whether device is charging */
  isCharging(): boolean {
    return this.battery?.charging ?? false
  }
}

// Type augmentation for Battery API
interface NavigatorWithBattery extends Navigator {
  getBattery(): Promise<BatteryManager>
}

interface BatteryManager extends EventTarget {
  charging: boolean
  level: number
  addEventListener(type: 'levelchange' | 'chargingchange', listener: () => void): void
}
