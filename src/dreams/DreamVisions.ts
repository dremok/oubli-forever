/**
 * DREAM VISIONS — the void sees what you remember
 *
 * When the DreamSynthesizer creates a dream sentence, this system
 * sends it to fal.ai's image generation API. The resulting image
 * fades in as a ghostly overlay — a visual hallucination that
 * dissolves over 15-20 seconds.
 *
 * The images are surreal and dreamlike because the prompts are
 * already surreal (cut-up technique recombinations of memories
 * and philosophical fragments). The AI becomes a dream renderer.
 *
 * Rate-limited: max 1 image per 5 minutes to preserve API credits.
 * Images start translucent and fade further — they're glimpses,
 * not destinations. The void dreams in images the way you dream
 * in fragments.
 *
 * Inspired by: Refik Anadol's data sculptures, hypnagogic imagery,
 * the way memories replay as images during REM sleep,
 * AI as dreaming machine (2026 Dataland installation)
 */

interface DreamImage {
  url: string
  alpha: number
  targetAlpha: number
  phase: 'fadein' | 'visible' | 'fadeout' | 'gone'
  timer: number
  x: number
  y: number
  width: number
  height: number
  element: HTMLImageElement
}

export class DreamVisions {
  private container: HTMLElement
  private currentDream: DreamImage | null = null
  private lastGenerationTime = 0
  private cooldownMs = 5 * 60 * 1000 // 5 minutes between generations
  private generating = false
  private frameId = 0
  private animating = false
  private hidden = false
  private apiKey: string

  constructor() {
    this.apiKey = import.meta.env.FAL_KEY || ''

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
    if (!this.apiKey || this.generating || this.hidden) return

    // Rate limit
    const now = Date.now()
    if (now - this.lastGenerationTime < this.cooldownMs) return

    this.generating = true
    this.lastGenerationTime = now

    try {
      const imageUrl = await this.generateImage(dreamText)
      if (imageUrl) {
        this.displayDream(imageUrl)
      }
    } catch {
      // API error — silently continue
    } finally {
      this.generating = false
    }
  }

  private async generateImage(prompt: string): Promise<string | null> {
    // Wrap the dream text in a surreal art prompt
    const artPrompt = `surreal dreamlike digital art, ethereal and ghostly, ${prompt}, dark void background, glowing particles, memory dissolving into light, abstract, cosmic, pink and gold and violet tones, atmospheric fog, painterly, 4k`

    const response = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: artPrompt,
        image_size: 'landscape_16_9',
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: false,
      }),
    })

    if (!response.ok) return null

    const data = await response.json()
    return data?.images?.[0]?.url || null
  }

  private displayDream(url: string) {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      // Size: large but not fullscreen
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

      this.currentDream = {
        url,
        alpha: 0,
        targetAlpha: 0.35,
        phase: 'fadein',
        timer: 0,
        x: 0,
        y: 0,
        width: w,
        height: h,
        element: img,
      }

      // Fade in
      requestAnimationFrame(() => {
        img.style.opacity = '0.35'
        img.style.filter = 'blur(2px) saturate(0.6)'
      })

      // Start animation loop for lifecycle
      if (!this.animating) this.startAnimation()

      // Schedule fadeout
      setTimeout(() => {
        if (this.currentDream) {
          this.currentDream.phase = 'fadeout'
          img.style.opacity = '0'
          img.style.filter = 'blur(8px) saturate(0.3)'
        }
      }, 12000) // Visible for ~12 seconds

      // Remove after fade
      setTimeout(() => {
        img.remove()
        this.currentDream = null
      }, 18000) // 12s visible + 6s fade
    }

    img.onerror = () => {
      // Failed to load — ignore
    }

    img.src = url
  }

  private startAnimation() {
    if (this.animating) return
    this.animating = true

    const animate = () => {
      this.frameId = requestAnimationFrame(animate)
      if (!this.currentDream) {
        cancelAnimationFrame(this.frameId)
        this.animating = false
        return
      }
    }
    animate()
  }

  setVisible(v: boolean) {
    this.hidden = !v
    this.container.style.display = v ? 'flex' : 'none'
  }

  isAvailable(): boolean {
    return !!this.apiKey
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
    this.container.remove()
  }
}
