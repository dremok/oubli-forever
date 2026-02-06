/**
 * VISITOR LOG — souls who have passed through the void
 *
 * A faint inscription in the bottom-left corner records:
 * - How many times you've visited
 * - When you first arrived
 * - When you last returned
 *
 * The count is stored in localStorage. Each visit, the first-visit
 * date degrades slightly — like the system is forgetting when you
 * first came. After enough visits, the original date is gone,
 * replaced by fragments. You can't prove you were here before.
 *
 * Inspired by: Guest books in abandoned buildings, ship logs,
 * the visitor counters on 90s websites ("You are visitor #4,382"),
 * the concept of anamnesis (recollection of past lives)
 */

const STORAGE_KEY = 'oubli-visitor-log'

interface VisitorData {
  visits: number
  firstVisit: number
  lastVisit: number
}

export class VisitorLog {
  private element: HTMLDivElement
  private data: VisitorData

  constructor() {
    this.data = this.load()
    this.data.visits++
    this.data.lastVisit = Date.now()
    this.save()

    this.element = document.createElement('div')
    this.element.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 20px;
      z-index: 90;
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300;
      font-size: 11px;
      color: rgba(255, 215, 0, 0.12);
      line-height: 1.6;
      pointer-events: none;
      user-select: none;
      max-width: 200px;
    `
    document.body.appendChild(this.element)

    this.render()
  }

  private load(): VisitorData {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) return JSON.parse(stored)
    } catch { /* */ }

    return {
      visits: 0,
      firstVisit: Date.now(),
      lastVisit: Date.now(),
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data))
    } catch { /* */ }
  }

  private render() {
    const { visits, firstVisit } = this.data

    // The first-visit date degrades with each visit
    const firstDate = new Date(firstVisit)
    const dateStr = this.degradeDate(firstDate, visits)

    // Poetic visit descriptions
    let visitWord: string
    if (visits === 1) visitWord = 'first passage'
    else if (visits === 2) visitWord = 'second passage'
    else if (visits === 3) visitWord = 'third return'
    else if (visits < 10) visitWord = `return #${visits}`
    else if (visits < 50) visitWord = `${visits} passages through`
    else if (visits < 100) visitWord = `${visits} returns to the void`
    else visitWord = `${visits} lives lived here`

    this.element.innerHTML = `
      <div style="opacity: 0.7;">${visitWord}</div>
      <div style="opacity: 0.5;">first seen: ${dateStr}</div>
    `
  }

  private degradeDate(date: Date, visits: number): string {
    const full = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    // Degradation increases with visits
    const degradation = Math.min((visits - 1) * 0.04, 0.85)
    if (degradation < 0.05) return full

    let result = ''
    for (const char of full) {
      if (char === ' ' || char === ',') {
        result += char
        continue
      }
      if (Math.random() < degradation) {
        result += '_'
      } else {
        result += char
      }
    }
    return result
  }

  getVisitCount(): number {
    return this.data.visits
  }

  destroy() {
    this.element.remove()
  }
}
