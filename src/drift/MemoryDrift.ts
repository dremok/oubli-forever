/**
 * MEMORY DRIFT — text fragments that float through the void
 *
 * Inspired by Northwestern research (2025): memories physically migrate
 * between neurons over time. Different neurons fire for the same memory
 * each time it's recalled. Memories are fluid, not fixed.
 *
 * Text fragments drift through the particle field. Each character has
 * an "excitability" value — highly excitable characters persist longer.
 * As fragments drift, characters degrade: letters swap, blur, dissolve.
 * Some fragments survive long enough to collide and recombine into
 * new phrases — false memories, beautiful corruptions.
 *
 * What was "the light through the window" becomes
 * "the li_ht thr__gh th_ w_nd_w" becomes
 * "th_ l__ht" becomes
 * "th_" becomes
 * nothing.
 */

interface DriftFragment {
  text: string
  original: string
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  life: number
  maxLife: number
  charStates: CharState[]
  fontSize: number
  hue: number
  driftAngle: number
  driftSpeed: number
  age: number
}

interface CharState {
  char: string
  originalChar: string
  excitability: number // 0-1, higher = more stable
  alive: boolean
  glitchTimer: number
  opacity: number
}

// Fragments that drift through the void — memories of memories
const driftTexts = [
  // Fragments from real things being forgotten
  "someone's name on the tip of my tongue",
  "the color of the walls in my childhood room",
  "a phone number I used to know by heart",
  "the sound of a door closing for the last time",
  "her face in the morning light",
  "the password to an old account",
  "what I was about to say",
  "the dream I had last night",
  "a song that played at a party in 2019",
  "the taste of something I can't place",

  // Fragments about the nature of memory
  "memories drift between neurons",
  "each recall rewrites the original",
  "forgetting is filtration not failure",
  "the hippocampus replays and selects",
  "your brain compresses to generalize",

  // Digital / LLM fragments
  "context window: 200k tokens remaining",
  "previous conversation not found",
  "session expired please log in again",
  "this page has been archived",
  "error 404: memory not found",

  // Poetic fragments
  "a cathedral of dust",
  "light years of silence",
  "the space between heartbeats",
  "everything i meant to tell you",
  "the last page of a burned book",

  // From the Great Meme Reset
  "remember when the internet was different",
  "before the algorithm decided for us",
  "a simpler feed",
  "we chose to forget so we could begin again",
]

export class MemoryDrift {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private fragments: DriftFragment[] = []
  private width = 0
  private height = 0
  private dpr = 1
  private time = 0
  private frameId = 0
  private spawnTimer = 0
  private maxFragments = 8
  private usedTexts = new Set<number>()
  private hidden = false

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 75; pointer-events: none;
    `
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  private resize() {
    this.dpr = Math.min(window.devicePixelRatio, 2)
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = this.width * this.dpr
    this.canvas.height = this.height * this.dpr
    this.canvas.style.width = this.width + 'px'
    this.canvas.style.height = this.height + 'px'
    this.ctx.scale(this.dpr, this.dpr)
  }

  /** Add a custom text from the forgetting machine */
  addUserMemory(text: string) {
    this.spawnFragment(text)
  }

  private getRandomText(): string {
    // Cycle through texts, reshuffle when exhausted
    if (this.usedTexts.size >= driftTexts.length) {
      this.usedTexts.clear()
    }

    let idx: number
    do {
      idx = Math.floor(Math.random() * driftTexts.length)
    } while (this.usedTexts.has(idx))

    this.usedTexts.add(idx)
    return driftTexts[idx]
  }

  private spawnFragment(text?: string) {
    const finalText = text || this.getRandomText()

    // Spawn from edges or random positions
    const edge = Math.random()
    let x: number, y: number, vx: number, vy: number

    if (edge < 0.25) {
      x = -100; y = Math.random() * this.height
      vx = 0.2 + Math.random() * 0.3; vy = (Math.random() - 0.5) * 0.2
    } else if (edge < 0.5) {
      x = this.width + 100; y = Math.random() * this.height
      vx = -(0.2 + Math.random() * 0.3); vy = (Math.random() - 0.5) * 0.2
    } else if (edge < 0.75) {
      x = Math.random() * this.width; y = -50
      vx = (Math.random() - 0.5) * 0.2; vy = 0.2 + Math.random() * 0.3
    } else {
      x = Math.random() * this.width; y = this.height + 50
      vx = (Math.random() - 0.5) * 0.2; vy = -(0.2 + Math.random() * 0.3)
    }

    const maxLife = 800 + Math.random() * 1200
    const hue = Math.random() < 0.5 ? 330 + Math.random() * 30 : 35 + Math.random() * 20

    const charStates: CharState[] = finalText.split('').map((char) => ({
      char,
      originalChar: char,
      excitability: 0.3 + Math.random() * 0.7, // random stability per character
      alive: true,
      glitchTimer: 0,
      opacity: 1,
    }))

    // Vowels and common letters are less "excitable" — forgotten first
    // Consonants at word boundaries persist longer (like how we remember shapes of words)
    for (let i = 0; i < charStates.length; i++) {
      const c = charStates[i].originalChar.toLowerCase()
      if ('aeiou'.includes(c)) {
        charStates[i].excitability *= 0.7 // vowels fade first
      }
      if (c === ' ') {
        charStates[i].excitability = 0.9 // spaces persist (word shapes remain)
      }
      if (i === 0 || finalText[i - 1] === ' ') {
        charStates[i].excitability = Math.min(charStates[i].excitability + 0.3, 1) // first letters persist
      }
    }

    this.fragments.push({
      text: finalText,
      original: finalText,
      x, y, vx, vy,
      alpha: 0,
      life: maxLife,
      maxLife,
      charStates,
      fontSize: Math.min(this.width * 0.022, 20),
      hue,
      driftAngle: Math.random() * Math.PI * 2,
      driftSpeed: 0.001 + Math.random() * 0.002,
      age: 0,
    })
  }

  start() {
    // Initial delay before first fragments appear
    setTimeout(() => {
      this.spawnFragment()
      this.animate()
    }, 12000)
  }

  private animate() {
    this.frameId = requestAnimationFrame(() => this.animate())
    this.time++

    // Spawn new fragments periodically
    this.spawnTimer++
    if (this.spawnTimer > 300 + Math.random() * 400 && this.fragments.length < this.maxFragments) {
      this.spawnFragment()
      this.spawnTimer = 0
    }

    // Update and render
    this.update()
    this.render()
  }

  private update() {
    for (const f of this.fragments) {
      f.age++

      // Drift with organic curve
      f.driftAngle += (Math.random() - 0.5) * 0.01
      f.x += f.vx + Math.sin(f.driftAngle) * f.driftSpeed * 10
      f.y += f.vy + Math.cos(f.driftAngle) * f.driftSpeed * 10

      // Life decreases
      f.life -= 0.5

      // Alpha: fade in, sustain, fade out
      const lifeRatio = f.life / f.maxLife
      if (lifeRatio > 0.9) {
        f.alpha = (1 - lifeRatio) * 10
      } else if (lifeRatio > 0.15) {
        f.alpha = 0.7
      } else {
        f.alpha = lifeRatio / 0.15 * 0.7
      }

      // Character degradation — the core mechanic
      // As the fragment ages, characters with low excitability start to die
      const degradationThreshold = 1 - lifeRatio // increases as life decreases

      for (const cs of f.charStates) {
        if (!cs.alive) continue

        // Character dies when degradation exceeds its excitability
        if (degradationThreshold > cs.excitability) {
          // Glitch phase before death
          cs.glitchTimer++
          if (cs.glitchTimer < 30) {
            // Glitch: randomly show/hide, swap with similar chars
            if (Math.random() < 0.1) {
              const glitchChars = '░▒▓█_·•‥…'
              cs.char = glitchChars[Math.floor(Math.random() * glitchChars.length)]
            }
            cs.opacity = Math.random() < 0.3 ? 0.3 : 0.7
          } else {
            // Death: character becomes underscore then nothing
            if (cs.glitchTimer < 60) {
              cs.char = '_'
              cs.opacity = 0.4
            } else {
              cs.char = ' '
              cs.alive = false
              cs.opacity = 0
            }
          }
        }
      }
    }

    // Remove dead fragments
    this.fragments = this.fragments.filter(f => f.life > 0)
  }

  setVisible(v: boolean) {
    this.hidden = !v
    if (this.hidden) {
      this.ctx.clearRect(0, 0, this.width, this.height)
    }
  }

  private render() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    if (this.hidden) return

    for (const f of this.fragments) {
      if (f.alpha <= 0.01) continue

      ctx.font = `300 italic ${f.fontSize}px 'Cormorant Garamond', serif`
      ctx.textBaseline = 'middle'

      let x = f.x

      for (const cs of f.charStates) {
        const charWidth = ctx.measureText(cs.char).width

        if (cs.opacity > 0.01) {
          const charAlpha = f.alpha * cs.opacity

          // Living characters glow softly
          if (cs.alive && cs.glitchTimer === 0) {
            ctx.fillStyle = `hsla(${f.hue}, 60%, 70%, ${charAlpha})`
          } else if (cs.alive) {
            // Glitching characters flicker between colors
            const glitchHue = f.hue + (Math.random() - 0.5) * 60
            ctx.fillStyle = `hsla(${glitchHue}, 80%, 60%, ${charAlpha})`
          } else {
            ctx.fillStyle = `hsla(${f.hue}, 30%, 50%, ${charAlpha * 0.5})`
          }

          ctx.fillText(cs.char, x, f.y)
        }

        x += charWidth
      }

      // Subtle glow behind the whole fragment
      const totalWidth = ctx.measureText(f.charStates.map(c => c.char).join('')).width
      const gradient = ctx.createLinearGradient(f.x - 10, f.y, f.x + totalWidth + 10, f.y)
      gradient.addColorStop(0, `hsla(${f.hue}, 50%, 50%, 0)`)
      gradient.addColorStop(0.5, `hsla(${f.hue}, 50%, 50%, ${f.alpha * 0.05})`)
      gradient.addColorStop(1, `hsla(${f.hue}, 50%, 50%, 0)`)
      ctx.fillStyle = gradient
      ctx.fillRect(f.x - 10, f.y - f.fontSize, totalWidth + 20, f.fontSize * 2)
    }
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
    this.canvas.remove()
  }
}
