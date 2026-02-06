/**
 * MEMORY ARCHIVE — the journal of forgetting
 *
 * Press 'm' to open a translucent panel showing all stored memories.
 * Slides in from the right edge — discreet, doesn't interrupt the void.
 * Each entry displays its degraded text, age, and how much has been
 * forgotten. Sorted by age — oldest memories at top, most degraded.
 *
 * Won't open while you're typing into the forgetting machine.
 *
 * Inspired by: Victorian memento mori, hospital visitor logs,
 * the Dead Sea Scrolls, degraded film archives
 */

import type { StoredMemory } from './MemoryJournal'

export class MemoryArchive {
  private panel: HTMLDivElement
  private content: HTMLDivElement
  private visible = false
  private memories: StoredMemory[] = []
  private onUpdate: (() => StoredMemory[]) | null = null
  private typingCheck: (() => boolean) | null = null

  constructor() {
    this.panel = document.createElement('div')
    this.panel.setAttribute('data-no-resonance', 'true')
    this.panel.style.cssText = `
      position: fixed; top: 0; right: 0; width: 320px; height: 100%;
      z-index: 400; pointer-events: none;
      transform: translateX(100%);
      transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.6s ease;
      opacity: 0;
      background: linear-gradient(to right, rgba(2, 1, 8, 0) 0%, rgba(2, 1, 8, 0.95) 15%);
      font-family: 'Cormorant Garamond', serif;
      overflow: hidden;
    `

    this.content = document.createElement('div')
    this.content.style.cssText = `
      position: absolute; top: 0; right: 0; width: 280px; height: 100%;
      overflow-y: auto; padding: 40px 24px 40px 16px;
      pointer-events: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 20, 147, 0.2) transparent;
    `

    this.panel.appendChild(this.content)
    document.body.appendChild(this.panel)

    this.bindEvents()
  }

  private bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'm' || e.key === 'M') {
        if (document.activeElement?.tagName === 'INPUT' ||
            document.activeElement?.tagName === 'TEXTAREA') return
        // Don't open while typing into the forgetting machine
        if (this.typingCheck?.()) return
        this.toggle()
      }
      if (e.key === 'Escape' && this.visible) {
        this.hide()
      }
    })
  }

  /** Set the function to call to get current memories */
  setMemorySource(getter: () => StoredMemory[]) {
    this.onUpdate = getter
  }

  /** Set a function that returns true when the user is actively typing */
  setTypingCheck(check: () => boolean) {
    this.typingCheck = check
  }

  private toggle() {
    if (this.visible) {
      this.hide()
    } else {
      this.show()
    }
  }

  private show() {
    if (this.onUpdate) {
      this.memories = this.onUpdate()
    }
    this.renderContent()
    this.visible = true
    this.panel.style.transform = 'translateX(0)'
    this.panel.style.opacity = '1'
    this.panel.style.pointerEvents = 'auto'
  }

  private hide() {
    this.visible = false
    this.panel.style.transform = 'translateX(100%)'
    this.panel.style.opacity = '0'
    this.panel.style.pointerEvents = 'none'
  }

  private renderContent() {
    if (this.memories.length === 0) {
      this.content.innerHTML = `
        <div style="color: rgba(255, 215, 0, 0.3); font-size: 14px; font-weight: 300; margin-top: 40px;">
          <div style="font-size: 16px; margin-bottom: 16px; color: rgba(255, 20, 147, 0.4); letter-spacing: 2px;">memory archive</div>
          <div style="font-style: italic;">no memories yet.</div>
          <div style="margin-top: 8px; font-size: 12px; color: rgba(255, 215, 0, 0.15);">
            type something and press enter.
          </div>
        </div>
      `
      return
    }

    // Sort by timestamp — oldest first (most degraded at top)
    const sorted = [...this.memories].sort((a, b) => a.timestamp - b.timestamp)

    let html = `
      <div style="margin-bottom: 24px;">
        <div style="font-size: 14px; color: rgba(255, 20, 147, 0.4); font-weight: 300; letter-spacing: 2px;">
          memory archive
        </div>
        <div style="font-size: 11px; color: rgba(255, 215, 0, 0.15); margin-top: 4px; font-style: italic;">
          ${this.memories.length} memories
        </div>
      </div>
    `

    for (const memory of sorted) {
      const date = new Date(memory.timestamp)
      const age = Math.floor((Date.now() - memory.timestamp) / (1000 * 60 * 60 * 24))
      const degradePercent = Math.floor(memory.degradation * 100)
      const freshness = 1 - memory.degradation

      const textOpacity = 0.25 + freshness * 0.55
      const hue = freshness > 0.5 ? 45 : 0
      const sat = freshness * 60
      const light = 50 + freshness * 25

      html += `
        <div style="
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255, 20, 147, ${0.03 + freshness * 0.07});
        ">
          <div style="
            font-size: 14px;
            font-weight: 300;
            color: hsla(${hue}, ${sat}%, ${light}%, ${textOpacity});
            letter-spacing: 0.3px;
            line-height: 1.4;
            word-break: break-word;
          ">${this.escapeHtml(memory.currentText)}</div>
          <div style="
            display: flex;
            justify-content: space-between;
            margin-top: 5px;
            font-size: 10px;
            color: rgba(255, 255, 255, 0.12);
          ">
            <span>${date.toLocaleDateString()}</span>
            <span>${age === 0 ? 'today' : age + 'd ago'}</span>
            <span style="color: rgba(255, 20, 147, ${0.15 + memory.degradation * 0.3});">
              ${degradePercent}%
            </span>
          </div>
        </div>
      `
    }

    this.content.innerHTML = html
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  isVisible(): boolean {
    return this.visible
  }

  destroy() {
    this.panel.remove()
  }
}
