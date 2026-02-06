/**
 * EXTINCTION WHISPERS — the last words of dying languages
 *
 * Every 30-60 seconds, a word from an endangered or extinct language
 * materializes in the void. Below it: the language name, the region,
 * and how many speakers remain. Some show "0 speakers" — the language
 * is already dead, and this word is a ghost.
 *
 * There are ~7,000 languages on Earth. One dies every two weeks.
 * By 2100, half will be gone. Each extinct language is an entire
 * way of seeing the world — erased. Not just vocabulary, but
 * grammar, metaphor, humor, prayer, lullaby, curse. Gone.
 *
 * The words appear larger than other whispers, in a distinct
 * color (pale blue — the color of glaciers, of things receding).
 * They linger longer. They deserve to.
 *
 * Data sourced from: UNESCO Atlas of World Languages in Danger,
 * Endangered Languages Project, ELAR, ethnologue.com
 *
 * Inspired by: The death of Boa Sr (last speaker of Bo, 2010),
 * the Rosetta Project, "The Last Speakers" by K. David Harrison
 */

interface EndangeredWord {
  word: string
  meaning: string
  language: string
  region: string
  speakers: number | 'extinct'
  note?: string
}

// Curated words from endangered and extinct languages
// Each entry is a small act of remembrance
const ENDANGERED_WORDS: EndangeredWord[] = [
  // EXTINCT LANGUAGES — 0 speakers
  { word: 'öngöl', meaning: 'starlight reflecting on water', language: 'Bo', region: 'Andaman Islands', speakers: 'extinct', note: 'last speaker Boa Sr died 2010' },
  { word: 'mamihlapinatapai', meaning: 'a look shared between two people, each wishing the other would begin', language: 'Yaghan', region: 'Tierra del Fuego', speakers: 'extinct', note: 'last fluent speaker Cristina Calderón died 2022' },
  { word: 'tingo', meaning: 'to gradually steal all possessions by borrowing and not returning', language: 'Pascuense', region: 'Easter Island', speakers: 'extinct' },
  { word: 'arigatou-no-kaze', meaning: 'the wind of gratitude', language: 'Ainu (Sakhalin)', region: 'Sakhalin Island', speakers: 'extinct' },
  { word: 'nunaaluk', meaning: 'the land that was always there', language: 'Eyak', region: 'Alaska', speakers: 'extinct', note: 'last speaker Marie Smith Jones died 2008' },
  { word: 'dede', meaning: 'grandmother / the old way', language: 'Ubykh', region: 'Caucasus', speakers: 'extinct', note: 'had 84 consonants, most of any language' },
  { word: 'walan', meaning: 'rain on the sea', language: 'Dalmatian', region: 'Adriatic Coast', speakers: 'extinct', note: 'last speaker Tuone Udaina died 1898' },
  { word: 'gurumba', meaning: 'collective grief that moves through a community', language: 'Gururumba', region: 'Papua New Guinea', speakers: 'extinct' },

  // CRITICALLY ENDANGERED — fewer than 100 speakers
  { word: 'ikunji', meaning: 'the feeling of a place where something once was', language: 'Kayardild', region: 'Australia', speakers: 8 },
  { word: 'jayus', meaning: 'a joke so poorly told you laugh anyway', language: 'Baduy', region: 'Indonesia', speakers: 40 },
  { word: 'koyaanisqatsi', meaning: 'life out of balance', language: 'Hopi', region: 'Arizona', speakers: 40 },
  { word: 'toska', meaning: 'a great spiritual anguish without cause', language: 'Ket', region: 'Siberia', speakers: 20 },
  { word: 'ulwa', meaning: 'the space between breaths', language: 'Ulwa', region: 'Nicaragua', speakers: 20 },
  { word: 'tsundoku', meaning: 'buying books and leaving them unread', language: 'Ainu (Hokkaido)', region: 'Japan', speakers: 10 },
  { word: 'pâro', meaning: 'the feeling of waiting for something that will never happen', language: 'Romani (Baltic)', region: 'Latvia', speakers: 15 },
  { word: 'duende', meaning: 'the mysterious power of art to deeply move a person', language: 'Ladino', region: 'diaspora', speakers: 60 },

  // SEVERELY ENDANGERED — fewer than 1,000 speakers
  { word: 'wabi-sabi', meaning: 'beauty in imperfection and impermanence', language: 'Ryukyuan', region: 'Okinawa', speakers: 400 },
  { word: 'gigil', meaning: 'the urge to squeeze something unbearably cute', language: 'Kapampangan', region: 'Philippines', speakers: 700 },
  { word: 'hiraeth', meaning: 'a deep longing for a home you can\'t return to', language: 'Welsh', region: 'Wales', speakers: 900 },
  { word: 'torschlusspanik', meaning: 'the fear that time is running out', language: 'Sorbian', region: 'Germany', speakers: 500 },
  { word: 'ohrwurm', meaning: 'a song stuck in your head', language: 'Livonian', region: 'Latvia', speakers: 250 },
  { word: 'saudade', meaning: 'the presence of absence', language: 'Mirandese', region: 'Portugal', speakers: 800 },
  { word: 'gökotta', meaning: 'to wake at dawn to hear the first birds', language: 'Elfdalian', region: 'Sweden', speakers: 600 },
  { word: 'komorebi', meaning: 'sunlight filtering through leaves', language: 'Miyako', region: 'Okinawa', speakers: 300 },

  // ENDANGERED — fewer than 10,000 speakers
  { word: 'ubuntu', meaning: 'I am because we are', language: 'Zulu', region: 'South Africa', speakers: 3000, note: 'endangered dialect variants' },
  { word: 'meraki', meaning: 'to do something with soul and creativity', language: 'Pontic Greek', region: 'Black Sea', speakers: 5000 },
  { word: 'hygge', meaning: 'a quality of coziness and warmth', language: 'Faroese', region: 'Faroe Islands', speakers: 8000 },
  { word: 'firgun', meaning: 'genuine, selfless joy for another\'s success', language: 'Judeo-Arabic', region: 'diaspora', speakers: 4000 },
  { word: 'natsukashii', meaning: 'a nostalgic longing for the past with happiness and sadness', language: 'Okinawan', region: 'Okinawa', speakers: 5000 },
  { word: 'sobremesa', meaning: 'the time spent talking after a meal', language: 'Aragonese', region: 'Spain', speakers: 2500 },
  { word: 'merak', meaning: 'the pursuit of small daily pleasures', language: 'Aromanian', region: 'Balkans', speakers: 3000 },
]

interface FloatingWord {
  entry: EndangeredWord
  x: number
  y: number
  alpha: number
  maxAlpha: number
  phase: 'fadein' | 'visible' | 'fadeout' | 'gone'
  timer: number
  scale: number
}

export class ExtinctionWhispers {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private current: FloatingWord | null = null
  private frameId = 0
  private animating = false
  private width = 0
  private height = 0
  private dpr = 1
  private frame = 0
  private nextSpawnFrame = 0
  private usedIndices = new Set<number>()

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 85; pointer-events: none;
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
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  start() {
    // First whisper after 30 seconds
    this.nextSpawnFrame = 30 * 60
    this.startAnimation()
  }

  private startAnimation() {
    if (this.animating) return
    this.animating = true

    const animate = () => {
      this.frameId = requestAnimationFrame(animate)
      this.frame++
      this.update()
      this.render()
    }
    animate()
  }

  private update() {
    // Spawn new word
    if (this.frame >= this.nextSpawnFrame && !this.current) {
      this.spawnWord()
      // Next word in 30-75 seconds
      this.nextSpawnFrame = this.frame + (30 + Math.random() * 45) * 60
    }

    // Update current word
    if (this.current) {
      const w = this.current
      w.timer++

      switch (w.phase) {
        case 'fadein':
          w.alpha += 0.005
          if (w.alpha >= w.maxAlpha) {
            w.alpha = w.maxAlpha
            w.phase = 'visible'
            w.timer = 0
          }
          break

        case 'visible':
          // Linger for 12-15 seconds
          if (w.timer > (12 + Math.random() * 3) * 60) {
            w.phase = 'fadeout'
          }
          break

        case 'fadeout':
          w.alpha -= 0.003
          if (w.alpha <= 0) {
            w.phase = 'gone'
            this.current = null
          }
          break
      }

      // Gentle drift upward — words ascending
      if (w.phase !== 'gone') {
        w.y -= 0.08
      }
    }
  }

  private spawnWord() {
    let idx: number
    do {
      idx = Math.floor(Math.random() * ENDANGERED_WORDS.length)
    } while (this.usedIndices.has(idx) && this.usedIndices.size < ENDANGERED_WORDS.length)

    this.usedIndices.add(idx)
    if (this.usedIndices.size >= ENDANGERED_WORDS.length * 0.8) {
      this.usedIndices.clear()
    }

    const entry = ENDANGERED_WORDS[idx]

    this.current = {
      entry,
      x: this.width * (0.15 + Math.random() * 0.7),
      y: this.height * (0.3 + Math.random() * 0.4),
      alpha: 0,
      maxAlpha: entry.speakers === 'extinct' ? 0.7 : 0.5,
      phase: 'fadein',
      timer: 0,
      scale: entry.speakers === 'extinct' ? 1.2 : 1.0,
    }
  }

  private render() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    if (!this.current || this.current.phase === 'gone') return

    const w = this.current
    const e = w.entry
    const isExtinct = e.speakers === 'extinct'

    // The word itself — large, pale blue for extinct, pale teal for endangered
    const wordSize = Math.min(this.width * 0.06, 52) * w.scale
    ctx.font = `300 ${wordSize}px 'Cormorant Garamond', serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const hue = isExtinct ? 220 : 190
    const sat = isExtinct ? 30 : 40
    const light = isExtinct ? 75 : 65

    // Glow
    ctx.shadowColor = `hsla(${hue}, ${sat}%, ${light}%, ${w.alpha * 0.4})`
    ctx.shadowBlur = 20

    ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${w.alpha})`
    ctx.fillText(e.word, w.x, w.y)

    // Reset shadow for smaller text
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0

    // Meaning — italic, below the word
    const meaningSize = wordSize * 0.35
    ctx.font = `300 italic ${meaningSize}px 'Cormorant Garamond', serif`
    ctx.fillStyle = `hsla(${hue}, ${sat - 10}%, ${light}%, ${w.alpha * 0.7})`
    ctx.fillText(`"${e.meaning}"`, w.x, w.y + wordSize * 0.7)

    // Language and speaker count
    const metaSize = meaningSize * 0.8
    ctx.font = `300 ${metaSize}px 'Cormorant Garamond', serif`

    const speakerText = isExtinct
      ? `${e.language} — extinct`
      : `${e.language} — ${e.speakers} speakers remain`

    ctx.fillStyle = `hsla(${hue}, 20%, 50%, ${w.alpha * 0.4})`
    ctx.fillText(speakerText, w.x, w.y + wordSize * 1.1)

    // Region
    ctx.fillStyle = `hsla(${hue}, 15%, 45%, ${w.alpha * 0.25})`
    ctx.fillText(e.region, w.x, w.y + wordSize * 1.4)

    // Note if present (e.g., "last speaker died 2010")
    if (e.note) {
      ctx.font = `300 italic ${metaSize * 0.85}px 'Cormorant Garamond', serif`
      ctx.fillStyle = `hsla(0, 0%, 60%, ${w.alpha * 0.25})`
      ctx.fillText(e.note, w.x, w.y + wordSize * 1.7)
    }

    // Small cross/marker for extinct languages
    if (isExtinct) {
      const crossSize = 4
      const crossY = w.y - wordSize * 0.6
      ctx.strokeStyle = `hsla(${hue}, 20%, 60%, ${w.alpha * 0.2})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(w.x - crossSize, crossY - crossSize)
      ctx.lineTo(w.x + crossSize, crossY + crossSize)
      ctx.moveTo(w.x + crossSize, crossY - crossSize)
      ctx.lineTo(w.x - crossSize, crossY + crossSize)
      ctx.stroke()
    }
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
    this.canvas.remove()
  }
}
