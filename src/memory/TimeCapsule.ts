/**
 * TIME CAPSULE — seal a memory for the future
 *
 * Press 'c' to open the capsule interface. Write a message and choose
 * when it should unseal (1 day, 1 week, 1 month, 1 year). The memory
 * becomes a frozen cyan star in the constellation — visible but
 * unreadable until the date arrives.
 *
 * When a capsule unseals, the text is revealed and begins degrading
 * normally. There's a moment of pristine clarity before entropy takes hold.
 *
 * This gives users a reason to return. Somewhere in the void, a star
 * is waiting to thaw.
 *
 * Inspired by: Time capsules, letter to future self, cryogenics,
 * delayed-send emails, messages in bottles, the Voyager golden record
 */

import type { StoredMemory } from './MemoryJournal'

interface CapsuleDeps {
  addTimeCapsule: (text: string, date: Date) => StoredMemory
  processNewMemory?: (memory: StoredMemory) => void
  roomCheck: () => string
  typingCheck: () => boolean
}

const DURATION_OPTIONS = [
  { label: '1 day', ms: 24 * 60 * 60 * 1000 },
  { label: '1 week', ms: 7 * 24 * 60 * 60 * 1000 },
  { label: '1 month', ms: 30 * 24 * 60 * 60 * 1000 },
  { label: '3 months', ms: 90 * 24 * 60 * 60 * 1000 },
  { label: '1 year', ms: 365 * 24 * 60 * 60 * 1000 },
]

export class TimeCapsule {
  private overlay: HTMLElement | null = null
  private visible = false
  private deps: CapsuleDeps

  constructor(deps: CapsuleDeps) {
    this.deps = deps
    window.addEventListener('keydown', (e) => this.handleKey(e))
  }

  private handleKey(e: KeyboardEvent) {
    if (e.key !== 'c' || e.repeat) return
    if (this.deps.typingCheck()) return
    if (this.deps.roomCheck() !== 'void') return

    if (this.visible) {
      this.hide()
    } else {
      this.show()
    }
  }

  private show() {
    if (this.overlay) this.hide()

    this.visible = true
    this.overlay = document.createElement('div')
    this.overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 300; display: flex; align-items: center; justify-content: center;
      background: rgba(2, 1, 8, 0.85);
      animation: capsuleFadeIn 0.5s ease;
    `

    const style = document.createElement('style')
    style.textContent = `
      @keyframes capsuleFadeIn { from { opacity: 0; } to { opacity: 1; } }
    `
    this.overlay.appendChild(style)

    const panel = document.createElement('div')
    panel.style.cssText = `
      width: 400px; max-width: 90vw;
      display: flex; flex-direction: column;
      align-items: center; gap: 20px;
    `

    // Title
    const title = document.createElement('div')
    title.style.cssText = `
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300; font-size: 14px;
      color: rgba(100, 220, 200, 0.5);
      letter-spacing: 4px; text-transform: uppercase;
    `
    title.textContent = 'time capsule'
    panel.appendChild(title)

    // Subtitle
    const sub = document.createElement('div')
    sub.style.cssText = `
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300; font-size: 12px; font-style: italic;
      color: rgba(255, 255, 255, 0.15);
      text-align: center;
    `
    sub.textContent = 'seal a memory for the future. it will wait as a frozen star.'
    panel.appendChild(sub)

    // Textarea
    const textarea = document.createElement('textarea')
    textarea.placeholder = 'write a message to your future self...'
    textarea.style.cssText = `
      width: 100%; height: 120px;
      background: transparent;
      border: 1px solid rgba(100, 220, 200, 0.15);
      border-radius: 2px;
      color: rgba(100, 220, 200, 0.6);
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300; font-size: 16px;
      line-height: 1.6; padding: 16px;
      resize: none; outline: none;
      caret-color: rgba(100, 220, 200, 0.5);
    `
    textarea.addEventListener('keydown', (e) => e.stopPropagation())
    panel.appendChild(textarea)

    // Duration buttons
    const durations = document.createElement('div')
    durations.style.cssText = `
      display: flex; gap: 8px; flex-wrap: wrap;
      justify-content: center;
    `

    let selectedDuration = DURATION_OPTIONS[1] // default: 1 week
    const buttons: HTMLElement[] = []

    for (const opt of DURATION_OPTIONS) {
      const btn = document.createElement('button')
      btn.textContent = opt.label
      btn.style.cssText = `
        background: transparent;
        border: 1px solid rgba(100, 220, 200, 0.2);
        color: rgba(100, 220, 200, 0.4);
        font-family: 'Cormorant Garamond', serif;
        font-size: 13px; padding: 6px 14px;
        cursor: pointer; border-radius: 2px;
        transition: all 0.2s ease;
      `
      if (opt === selectedDuration) {
        btn.style.borderColor = 'rgba(100, 220, 200, 0.6)'
        btn.style.color = 'rgba(100, 220, 200, 0.8)'
      }
      btn.addEventListener('click', () => {
        selectedDuration = opt
        for (const b of buttons) {
          b.style.borderColor = 'rgba(100, 220, 200, 0.2)'
          b.style.color = 'rgba(100, 220, 200, 0.4)'
        }
        btn.style.borderColor = 'rgba(100, 220, 200, 0.6)'
        btn.style.color = 'rgba(100, 220, 200, 0.8)'
      })
      buttons.push(btn)
      durations.appendChild(btn)
    }
    panel.appendChild(durations)

    // Seal button
    const seal = document.createElement('button')
    seal.textContent = 'seal'
    seal.style.cssText = `
      background: transparent;
      border: 1px solid rgba(100, 220, 200, 0.3);
      color: rgba(100, 220, 200, 0.6);
      font-family: 'Cormorant Garamond', serif;
      font-size: 15px; padding: 10px 40px;
      cursor: pointer; border-radius: 2px;
      letter-spacing: 3px; text-transform: uppercase;
      transition: all 0.3s ease;
    `
    seal.addEventListener('mouseenter', () => {
      seal.style.borderColor = 'rgba(100, 220, 200, 0.7)'
      seal.style.color = 'rgba(100, 220, 200, 0.9)'
      seal.style.boxShadow = '0 0 20px rgba(100, 220, 200, 0.1)'
    })
    seal.addEventListener('mouseleave', () => {
      seal.style.borderColor = 'rgba(100, 220, 200, 0.3)'
      seal.style.color = 'rgba(100, 220, 200, 0.6)'
      seal.style.boxShadow = 'none'
    })
    seal.addEventListener('click', () => {
      const text = textarea.value.trim()
      if (!text) return

      const unlockDate = new Date(Date.now() + selectedDuration.ms)
      const memory = this.deps.addTimeCapsule(text, unlockDate)
      this.deps.processNewMemory?.(memory)

      // Show confirmation
      panel.innerHTML = ''
      const confirm = document.createElement('div')
      confirm.style.cssText = `
        text-align: center;
        font-family: 'Cormorant Garamond', serif;
      `
      const icon = document.createElement('div')
      icon.style.cssText = `
        font-size: 40px; margin-bottom: 16px;
        color: rgba(100, 220, 200, 0.3);
      `
      icon.textContent = '▓'
      confirm.appendChild(icon)

      const msg = document.createElement('div')
      msg.style.cssText = `
        font-weight: 300; font-size: 15px; font-style: italic;
        color: rgba(100, 220, 200, 0.5);
        line-height: 1.8;
      `
      msg.textContent = `sealed until ${unlockDate.toLocaleDateString()}. a frozen star now waits in the void.`
      confirm.appendChild(msg)

      panel.appendChild(confirm)

      setTimeout(() => this.hide(), 3000)
    })
    panel.appendChild(seal)

    // Escape hint
    const hint = document.createElement('div')
    hint.style.cssText = `
      font-family: monospace; font-size: 9px;
      color: rgba(255, 255, 255, 0.08);
      letter-spacing: 2px;
    `
    hint.textContent = 'esc or c to close'
    panel.appendChild(hint)

    this.overlay.appendChild(panel)

    // Close on escape or clicking background
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide()
    })
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hide()
        window.removeEventListener('keydown', escHandler)
      }
    }
    window.addEventListener('keydown', escHandler)

    document.body.appendChild(this.overlay)

    // Focus textarea
    setTimeout(() => textarea.focus(), 100)
  }

  private hide() {
    this.visible = false
    this.overlay?.remove()
    this.overlay = null
  }

  destroy() {
    this.hide()
  }
}
