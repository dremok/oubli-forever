/**
 * DREAM VISIONS — the void sees what you remember
 *
 * When the DreamSynthesizer creates a dream sentence, this system
 * shows a pre-generated image as a ghostly overlay — a visual
 * hallucination that dissolves over 15-20 seconds.
 *
 * Images are pre-generated with fal.ai and stored as static assets.
 * No runtime API calls needed. The dream text is hashed to
 * deterministically select an image, so the same dream always
 * evokes the same vision.
 *
 * Inspired by: Refik Anadol's data sculptures, hypnagogic imagery,
 * the way memories replay as images during REM sleep
 */

const DREAM_IMAGES = [
  '/assets/generated/void-nebula.jpg',
  '/assets/generated/furnace-embers.jpg',
  '/assets/generated/garden-overgrown.jpg',
  '/assets/generated/library-infinite.jpg',
  '/assets/generated/observatory-stars.jpg',
  '/assets/generated/seance-candle.jpg',
  '/assets/generated/darkroom-safelight.jpg',
  '/assets/generated/ruins-texture.jpg',
  '/assets/generated/well-depths.jpg',
  '/assets/generated/glacier-aurora.jpg',
  '/assets/generated/clocktower-gears.jpg',
  '/assets/generated/loom-threads.jpg',
  '/assets/generated/tidepool-bioluminescence.jpg',
  '/assets/generated/labyrinth-fog.jpg',
  '/assets/generated/mirror-shattered.jpg',
  '/assets/generated/radio-static.jpg',
]

export class DreamVisions {
  private container: HTMLElement
  private currentDream: { element: HTMLImageElement } | null = null
  private lastGenerationTime = 0
  private cooldownMs = 5 * 60 * 1000 // 5 minutes between visions
  private hidden = false

  constructor() {
    this.container = document.createElement('div')
    this.container.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 175; pointer-events: none;
      display: flex; align-items: center; justify-content: center;
    `
    document.body.appendChild(this.container)
  }

  /** Called when the DreamSynthesizer creates a new dream */
  async onDream(dreamText: string) {
    if (this.hidden || this.currentDream) return

    // Rate limit
    const now = Date.now()
    if (now - this.lastGenerationTime < this.cooldownMs) return
    this.lastGenerationTime = now

    // Hash the dream text to pick an image deterministically
    let hash = 0
    for (let i = 0; i < dreamText.length; i++) {
      hash = ((hash << 5) - hash + dreamText.charCodeAt(i)) | 0
    }
    const idx = Math.abs(hash) % DREAM_IMAGES.length
    this.displayDream(DREAM_IMAGES[idx])
  }

  private displayDream(url: string) {
    const img = new Image()

    img.onload = () => {
      const maxW = window.innerWidth * 0.6
      const maxH = window.innerHeight * 0.5
      const aspect = img.naturalWidth / img.naturalHeight
      let w = maxW
      let h = w / aspect
      if (h > maxH) {
        h = maxH
        w = h * aspect
      }

      img.style.cssText = `
        width: ${w}px;
        height: ${h}px;
        opacity: 0;
        filter: blur(4px) saturate(0.7);
        border-radius: 4px;
        transition: opacity 3s ease, filter 5s ease;
        mix-blend-mode: screen;
      `

      this.container.appendChild(img)
      this.currentDream = { element: img }

      // Fade in
      requestAnimationFrame(() => {
        img.style.opacity = '0.35'
        img.style.filter = 'blur(2px) saturate(0.6)'
      })

      // Schedule fadeout
      setTimeout(() => {
        img.style.opacity = '0'
        img.style.filter = 'blur(8px) saturate(0.3)'
      }, 12000)

      // Remove after fade
      setTimeout(() => {
        img.remove()
        this.currentDream = null
      }, 18000)
    }

    img.onerror = () => {
      // Failed to load — ignore
    }

    img.src = url
  }

  setVisible(v: boolean) {
    this.hidden = !v
    this.container.style.display = v ? 'flex' : 'none'
  }

  isAvailable(): boolean {
    return DREAM_IMAGES.length > 0
  }

  destroy() {
    this.container.remove()
  }
}
