/**
 * MEMORY ARCHIVE — the journal of forgetting
 *
 * Press 'm' to open a translucent overlay showing all stored memories.
 * Each entry displays its degraded text, age, and how much has been
 * forgotten. The archive is sorted by age — oldest memories at top,
 * most degraded, barely legible.
 *
 * This is the functional counterpart to the constellation view.
 * Where constellations show memories as stars in space, the archive
 * shows them as text in time. Both reveal the same truth: everything
 * you gave to Oubli is still here, just... less.
 *
 * Scroll through your memories. Watch the vowels disappear.
 * Watch the words become skeletal. Watch the spaces widen
 * between what remains.
 *
 * Inspired by: Victorian memento mori, hospital visitor logs,
 * the Dead Sea Scrolls, degraded film archives
 */

import type { StoredMemory } from './MemoryJournal'

export class MemoryArchive {
  private overlay: HTMLDivElement
  private content: HTMLDivElement
  private visible = false
  private memories: StoredMemory[] = []
  private onUpdate: (() => StoredMemory[]) | null = null

  constructor() {
    this.overlay = document.createElement('div')
    this.overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 400; pointer-events: none; opacity: 0;
      transition: opacity 0.8s ease;
      display: flex; align-items: center; justify-content: center;
    `

    this.content = document.createElement('div')
    this.content.style.cssText = `
      width: 500px; max-height: 70vh; overflow-y: auto;
      padding: 40px; pointer-events: auto;
      background: rgba(2, 1, 8, 0.92);
      border: 1px solid rgba(255, 20, 147, 0.15);
      border-radius: 2px;
      font-family: 'Cormorant Garamond', serif;
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 20, 147, 0.3) transparent;
    `

    this.overlay.appendChild(this.content)
    document.body.appendChild(this.overlay)

    this.bindEvents()
  }

  private bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'm' || e.key === 'M') {
        if (document.activeElement?.tagName === 'INPUT' ||
            document.activeElement?.tagName === 'TEXTAREA') return
        this.toggle()
      }
      if (e.key === 'Escape' && this.visible) {
        this.hide()
      }
    })

    // Click outside to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide()
      }
    })
  }

  /** Set the function to call to get current memories */
  setMemorySource(getter: () => StoredMemory[]) {
    this.onUpdate = getter
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
    this.overlay.style.opacity = '1'
    this.overlay.style.pointerEvents = 'auto'
  }

  private hide() {
    this.visible = false
    this.overlay.style.opacity = '0'
    this.overlay.style.pointerEvents = 'none'
  }

  private renderContent() {
    if (this.memories.length === 0) {
      this.content.innerHTML = `
        <div style="text-align: center; color: rgba(255, 215, 0, 0.3); font-size: 16px; font-weight: 300;">
          <div style="font-size: 24px; margin-bottom: 20px; color: rgba(255, 20, 147, 0.4);">memory archive</div>
          <div style="font-style: italic;">no memories yet.</div>
          <div style="margin-top: 10px; font-size: 13px; color: rgba(255, 215, 0, 0.2);">
            type something and press enter.<br>
            or hold spacebar and speak.
          </div>
        </div>
      `
      return
    }

    // Sort by timestamp — oldest first (most degraded at top)
    const sorted = [...this.memories].sort((a, b) => a.timestamp - b.timestamp)

    let html = `
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="font-size: 22px; color: rgba(255, 20, 147, 0.5); font-weight: 300; letter-spacing: 3px;">
          memory archive
        </div>
        <div style="font-size: 12px; color: rgba(255, 215, 0, 0.2); margin-top: 6px; font-style: italic;">
          ${this.memories.length} memories — press m or esc to close
        </div>
      </div>
    `

    for (const memory of sorted) {
      const date = new Date(memory.timestamp)
      const age = Math.floor((Date.now() - memory.timestamp) / (1000 * 60 * 60 * 24))
      const degradePercent = Math.floor(memory.degradation * 100)
      const freshness = 1 - memory.degradation

      // Opacity based on degradation — more degraded = harder to read
      const textOpacity = 0.3 + freshness * 0.6

      // Color shifts from gold (fresh) to grey (degraded)
      const hue = freshness > 0.5 ? 45 : 0
      const sat = freshness * 60
      const light = 50 + freshness * 25

      html += `
        <div style="
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(255, 20, 147, ${0.05 + freshness * 0.1});
        ">
          <div style="
            font-size: 17px;
            font-weight: 300;
            color: hsla(${hue}, ${sat}%, ${light}%, ${textOpacity});
            letter-spacing: 0.5px;
            line-height: 1.5;
            word-break: break-word;
          ">${this.escapeHtml(memory.currentText)}</div>
          <div style="
            display: flex;
            justify-content: space-between;
            margin-top: 8px;
            font-size: 11px;
            color: rgba(255, 255, 255, 0.15);
          ">
            <span>${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span>${age === 0 ? 'today' : age + 'd ago'}</span>
            <span style="color: rgba(255, 20, 147, ${0.2 + memory.degradation * 0.4});">
              ${degradePercent}% forgotten
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
    this.overlay.remove()
  }
}
