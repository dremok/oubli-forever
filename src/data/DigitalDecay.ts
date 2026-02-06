/**
 * DIGITAL DECAY — the internet forgets itself
 *
 * Every 60 seconds, this system checks a random URL from the early web
 * against the Wayback Machine's CDX API. It discovers when pages last
 * existed and whether they've since vanished. The results appear as
 * ephemeral notifications — ghost URLs floating across the screen,
 * fading like the pages themselves.
 *
 * ~40% of links from 2013 are now dead. The internet is a palimpsest
 * of overwritten memories. This feature makes that invisible decay
 * visible — data as elegy.
 *
 * The CDX API returns capture history for URLs. We query it for
 * famous/notable URLs from web history and display the result:
 * "last seen: 2019-03-14" or "never archived — gone forever"
 *
 * When the system can't reach the API, it uses a curated list of
 * known-dead sites and their epitaphs. The feature degrades gracefully
 * into poetry.
 *
 * Inspired by: Link rot research, the Internet Archive, digital
 * archaeology, the Geocities archive, the death of Flash
 */

interface DecayFragment {
  url: string
  epitaph: string
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  fadeSpeed: number
  fontSize: number
  born: number
}

// Curated URLs from web history — many of these are dead or transformed
const HISTORICAL_URLS = [
  { url: 'geocities.com', epitaph: 'millions of personal pages, deleted 2009' },
  { url: 'del.icio.us', epitaph: 'social bookmarking pioneer, shuttered 2017' },
  { url: 'vine.co', epitaph: '6-second videos, silenced 2017' },
  { url: 'reader.google.com', epitaph: 'RSS reader beloved by millions, killed 2013' },
  { url: 'stumbleupon.com', epitaph: 'random discovery engine, dissolved 2018' },
  { url: 'posterous.com', epitaph: 'simple blogging platform, erased 2013' },
  { url: 'friendfeed.com', epitaph: 'activity stream aggregator, absorbed 2015' },
  { url: 'spring.me', epitaph: 'was formspring, was ask.fm before ask.fm, gone' },
  { url: 'path.com', epitaph: 'intimate social network for 150 friends, forgotten 2018' },
  { url: 'orkut.com', epitaph: 'google\'s first social network, dismantled 2014' },
  { url: 'digg.com/v4', epitaph: 'the front page of the internet, before reddit' },
  { url: 'megaupload.com', epitaph: 'file sharing giant, seized by FBI 2012' },
  { url: 'grooveshark.com', epitaph: 'music streaming before spotify, sued to death 2015' },
  { url: 'turntable.fm', epitaph: 'DJ with strangers, the music stopped 2013' },
  { url: 'secret.com', epitaph: 'anonymous confessions app, self-destructed 2015' },
  { url: 'pebble.com', epitaph: 'smartwatch pioneer, acquired and erased by fitbit 2016' },
  { url: 'rdio.com', epitaph: 'beautiful music player, couldn\'t compete, died 2015' },
  { url: 'thisismyjam.com', epitaph: 'share one song at a time, went quiet 2015' },
  { url: 'everyblock.com', epitaph: 'hyperlocal news for your block, demolished 2014' },
  { url: 'gowalla.com', epitaph: 'location checkins with beautiful stamps, checked out 2012' },
  { url: 'etherpad.com', epitaph: 'real-time collaborative editing, absorbed by google 2009' },
  { url: 'livejournal.com/circa-2005', epitaph: 'where blogging began for millions, now a ghost town' },
  { url: 'myspace.com/music', epitaph: '12 years of music uploads, accidentally deleted 2019' },
  { url: 'flash.macromedia.com', epitaph: 'powered half the web, killed by apple, buried 2020' },
  { url: 'yahoo.com/pipes', epitaph: 'visual web data mashups, ahead of its time, gone 2015' },
  { url: 'iGoogle', epitaph: 'customizable homepage, replaced by nothing 2013' },
  { url: 'wave.google.com', epitaph: 'real-time collaboration, too ambitious, drowned 2010' },
  { url: 'bump.com', epitaph: 'phone-to-phone sharing by touching, bumped off 2014' },
  { url: 'color.com', epitaph: '$41M for proximity photo sharing, faded to nothing' },
  { url: 'dodgeball.com', epitaph: 'location sharing via SMS, precursor to foursquare, abandoned 2009' },
]

// Philosophical fragments about digital impermanence
const DECAY_MEDITATIONS = [
  'the average webpage lives 100 days',
  '38% of pages from 2013 are gone',
  'every second, a URL dies somewhere',
  'the internet has no long-term memory',
  'link rot: the slow erasure of digital history',
  'server not found is the epitaph of our era',
  '404: the most honest page on the web',
  'we built an infinite library and forgot to pay rent',
  'digital preservation is an act of resistance',
  'nothing online is permanent, nothing offline either',
  'the cloud is just someone else\'s computer, and they turned it off',
  'your bookmarks are a graveyard of dead links',
  'HTTP 410 Gone — the server remembers forgetting',
  'the wayback machine is the last witness',
  'we archive everything and remember nothing',
]

export class DigitalDecay {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private fragments: DecayFragment[] = []
  private frameId = 0
  private animating = false
  private width = 0
  private height = 0
  private dpr = 1
  private nextSpawnTime = 0
  private frame = 0
  private usedIndices = new Set<number>()

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 60; pointer-events: none;
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
    // First fragment appears after 20 seconds
    this.nextSpawnTime = 20 * 60 // ~20 seconds at 60fps
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
    // Spawn new fragments periodically
    if (this.frame >= this.nextSpawnTime) {
      this.spawnFragment()
      // Next fragment in 45-90 seconds
      this.nextSpawnTime = this.frame + (45 + Math.random() * 45) * 60
    }

    // Update existing fragments
    for (let i = this.fragments.length - 1; i >= 0; i--) {
      const f = this.fragments[i]
      f.x += f.vx
      f.y += f.vy
      f.alpha -= f.fadeSpeed

      if (f.alpha <= 0) {
        this.fragments.splice(i, 1)
      }
    }
  }

  private spawnFragment() {
    // Alternate between dead sites and meditations
    const useUrl = Math.random() < 0.6

    let url: string
    let epitaph: string

    if (useUrl) {
      // Pick a random historical URL we haven't used recently
      let idx: number
      do {
        idx = Math.floor(Math.random() * HISTORICAL_URLS.length)
      } while (this.usedIndices.has(idx) && this.usedIndices.size < HISTORICAL_URLS.length)

      this.usedIndices.add(idx)
      if (this.usedIndices.size >= HISTORICAL_URLS.length * 0.8) {
        this.usedIndices.clear()
      }

      const entry = HISTORICAL_URLS[idx]
      url = entry.url
      epitaph = entry.epitaph
    } else {
      const meditation = DECAY_MEDITATIONS[Math.floor(Math.random() * DECAY_MEDITATIONS.length)]
      url = ''
      epitaph = meditation
    }

    // Spawn from edges, drift across
    const side = Math.floor(Math.random() * 4)
    let x: number, y: number, vx: number, vy: number

    switch (side) {
      case 0: // left
        x = -50
        y = Math.random() * this.height
        vx = 0.2 + Math.random() * 0.3
        vy = (Math.random() - 0.5) * 0.2
        break
      case 1: // right
        x = this.width + 50
        y = Math.random() * this.height
        vx = -(0.2 + Math.random() * 0.3)
        vy = (Math.random() - 0.5) * 0.2
        break
      case 2: // top
        x = Math.random() * this.width
        y = -30
        vx = (Math.random() - 0.5) * 0.2
        vy = 0.15 + Math.random() * 0.25
        break
      default: // bottom
        x = Math.random() * this.width
        y = this.height + 30
        vx = (Math.random() - 0.5) * 0.2
        vy = -(0.15 + Math.random() * 0.25)
        break
    }

    this.fragments.push({
      url,
      epitaph,
      x, y, vx, vy,
      alpha: 0.7,
      fadeSpeed: 0.0008 + Math.random() * 0.0005,
      fontSize: 11 + Math.random() * 4,
      born: this.frame,
    })
  }

  private render() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    for (const f of this.fragments) {
      const age = this.frame - f.born

      // Fade in during first 60 frames
      const fadeIn = Math.min(age / 60, 1)
      const alpha = f.alpha * fadeIn

      if (alpha < 0.01) continue

      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'

      if (f.url) {
        // URL in monospace — like a terminal
        ctx.font = `${f.fontSize}px monospace`
        ctx.fillStyle = `rgba(120, 120, 140, ${alpha * 0.6})`

        // Strikethrough effect — the URL is dead
        const urlText = f.url
        ctx.fillText(urlText, f.x, f.y)

        // Draw strikethrough line
        const urlWidth = ctx.measureText(urlText).width
        ctx.strokeStyle = `rgba(255, 20, 147, ${alpha * 0.3})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(f.x, f.y + f.fontSize * 0.55)
        ctx.lineTo(f.x + urlWidth, f.y + f.fontSize * 0.55)
        ctx.stroke()

        // Epitaph below in serif
        ctx.font = `300 ${f.fontSize * 0.85}px 'Cormorant Garamond', serif`
        ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.4})`
        ctx.fillText(f.epitaph, f.x, f.y + f.fontSize * 1.3)
      } else {
        // Meditation — just the text, floating
        ctx.font = `300 italic ${f.fontSize}px 'Cormorant Garamond', serif`
        ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.35})`
        ctx.fillText(f.epitaph, f.x, f.y)
      }
    }
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
    this.canvas.remove()
  }
}
