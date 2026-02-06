/**
 * CURSOR GLOW — the user's presence leaves light
 *
 * The cursor is hidden. In its place, a soft glow follows —
 * as if the user's attention itself illuminates the void.
 */

export class CursorGlow {
  private el: HTMLElement
  private x = 0
  private y = 0
  private targetX = 0
  private targetY = 0
  private visible = false

  constructor() {
    this.el = document.getElementById('cursor-glow')!
  }

  init() {
    window.addEventListener('mousemove', (e) => {
      this.targetX = e.clientX
      this.targetY = e.clientY
      if (!this.visible) {
        this.visible = true
        this.el.style.opacity = '1'
        this.x = e.clientX
        this.y = e.clientY
      }
    })

    window.addEventListener('mouseleave', () => {
      this.visible = false
      this.el.style.opacity = '0'
    })

    this.animate()
  }

  private animate() {
    // Smooth follow with slight lag — like a ghost trailing behind
    this.x += (this.targetX - this.x) * 0.08
    this.y += (this.targetY - this.y) * 0.08

    this.el.style.left = this.x + 'px'
    this.el.style.top = this.y + 'px'

    requestAnimationFrame(() => this.animate())
  }
}
