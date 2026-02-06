/**
 * SESSION CLOCK — time that forgets itself
 *
 * A subtle clock in the bottom-right corner shows how long you've
 * been in the void. But the display degrades. After 5 minutes,
 * digits start glitching. After 15 minutes, some digits are
 * replaced with symbols. After 30 minutes, the clock is barely
 * legible — a smear of characters that might be numbers.
 *
 * The clock is paradoxically the most useful AND most poetic
 * element. You want to know how long you've been here.
 * But the longer you stay, the less the system can tell you.
 * Time melts like Dalí clocks.
 *
 * Inspired by: Salvador Dalí's melting clocks, Alzheimer's
 * time disorientation, time dilation in dreams, the ship
 * of Theseus applied to moments
 */

const GLITCH_CHARS = '░▒▓█_·•‥…⊘∅◌⏐⏑'

export class SessionClock {
  private element: HTMLDivElement
  private startTime: number
  private intervalId: number | null = null

  constructor() {
    this.startTime = Date.now()

    this.element = document.createElement('div')
    this.element.style.cssText = `
      position: fixed;
      bottom: 16px;
      right: 20px;
      z-index: 90;
      font-family: monospace;
      font-size: 12px;
      color: rgba(255, 215, 0, 0.15);
      letter-spacing: 1px;
      pointer-events: none;
      user-select: none;
      text-align: right;
      line-height: 1.4;
    `
    document.body.appendChild(this.element)
  }

  start() {
    this.update()
    this.intervalId = window.setInterval(() => this.update(), 1000)
  }

  private update() {
    const elapsed = Date.now() - this.startTime
    const seconds = Math.floor(elapsed / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    const s = seconds % 60
    const m = minutes % 60
    const h = hours

    // Format: HH:MM:SS
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`

    // Degradation level based on time spent
    const degradation = Math.min(minutes / 30, 0.9) // maxes out at ~30 min

    // Apply degradation to the time string
    const degraded = this.degradeTime(timeStr, degradation)

    // Opacity decreases slightly with time — the clock fades
    const opacity = Math.max(0.08, 0.2 - degradation * 0.12)

    this.element.style.color = `rgba(255, 215, 0, ${opacity})`
    this.element.innerHTML = degraded

    // Add a label below that also degrades
    const label = this.degradeText('time in the void', degradation * 0.7)
    this.element.innerHTML += `<br><span style="font-size: 9px; font-family: 'Cormorant Garamond', serif; letter-spacing: 2px; opacity: 0.6;">${label}</span>`
  }

  private degradeTime(timeStr: string, degradation: number): string {
    if (degradation < 0.05) return timeStr

    let result = ''
    for (let i = 0; i < timeStr.length; i++) {
      const char = timeStr[i]

      if (char === ':') {
        // Colons sometimes become other separators
        if (degradation > 0.5 && Math.random() < degradation * 0.3) {
          result += ['·', '∶', '⁚', '‥'][Math.floor(Math.random() * 4)]
        } else {
          result += ':'
        }
        continue
      }

      // Each digit has a chance of being corrupted
      if (Math.random() < degradation * 0.4) {
        if (degradation > 0.6 && Math.random() < 0.5) {
          // Heavy degradation — glitch characters
          result += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
        } else {
          // Light degradation — wrong digits or underscores
          if (Math.random() < 0.5) {
            result += '_'
          } else {
            result += String(Math.floor(Math.random() * 10))
          }
        }
      } else {
        result += char
      }
    }

    return result
  }

  private degradeText(text: string, degradation: number): string {
    if (degradation < 0.1) return text

    let result = ''
    for (const char of text) {
      if (char === ' ') {
        result += ' '
        continue
      }

      if (Math.random() < degradation * 0.5) {
        result += '_'
      } else {
        result += char
      }
    }

    return result
  }

  destroy() {
    if (this.intervalId) clearInterval(this.intervalId)
    this.element.remove()
  }
}
