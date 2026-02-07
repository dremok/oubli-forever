/**
 * DIGITAL DECAY — the internet forgets itself
 *
 * Ghost URLs of dead websites drift across the void. Now enhanced
 * with live data from the Wayback Machine CDX API — real capture
 * counts, first/last archive dates, years of existence.
 *
 * When the API responds, fragments show real archaeological data:
 * "vine.co — 847,291 captures — existed 2013-2017"
 * When it can't reach the API, it falls back to curated epitaphs.
 *
 * ~40% of links from 2013 are now dead. The internet is a palimpsest
 * of overwritten memories. This feature makes that invisible decay
 * visible — data as elegy.
 *
 * Inspired by: Link rot research, the Internet Archive, digital
 * archaeology, the Geocities archive, the death of Flash
 */

interface DecayFragment {
  url: string
  epitaph: string
  liveData?: string  // from CDX API
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  fadeSpeed: number
  fontSize: number
  born: number
}

interface CDXResult {
  captures: number
  firstYear: number
  lastYear: number
  yearsAlive: number
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
  private cdxCache = new Map<string, CDXResult | null>()
  private hidden = false

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
    this.nextSpawnTime = 20 * 60
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
    if (this.frame >= this.nextSpawnTime) {
      this.spawnFragment()
      this.nextSpawnTime = this.frame + (45 + Math.random() * 45) * 60
    }

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

  /** Query Wayback Machine CDX API for capture statistics */
  private async queryCDX(url: string): Promise<CDXResult | null> {
    if (this.cdxCache.has(url)) return this.cdxCache.get(url) ?? null

    try {
      const cleanUrl = url.replace(/\/$/, '')
      const resp = await fetch(
        `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(cleanUrl)}&output=json&fl=timestamp&limit=5000&collapse=timestamp:6`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (!resp.ok) throw new Error('CDX API error')

      const data = await resp.json() as string[][]
      if (data.length <= 1) {
        this.cdxCache.set(url, null)
        return null
      }

      // First row is headers, rest are captures
      const captures = data.length - 1
      const timestamps = data.slice(1).map(row => row[0])
      const firstYear = parseInt(timestamps[0].substring(0, 4))
      const lastYear = parseInt(timestamps[timestamps.length - 1].substring(0, 4))
      const yearsAlive = Math.max(1, lastYear - firstYear)

      const result: CDXResult = { captures, firstYear, lastYear, yearsAlive }
      this.cdxCache.set(url, result)
      return result
    } catch {
      this.cdxCache.set(url, null)
      return null
    }
  }

  private spawnFragment() {
    const useUrl = Math.random() < 0.6

    let url: string
    let epitaph: string

    if (useUrl) {
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

      // Fire off CDX query — will update the fragment when data arrives
      this.queryCDX(url).then(result => {
        if (result) {
          const frag = this.fragments.find(f => f.url === url && !f.liveData)
          if (frag) {
            const captureStr = result.captures.toLocaleString()
            frag.liveData = `${captureStr} captures — archived ${result.firstYear}–${result.lastYear} — ${result.yearsAlive} years`
          }
        }
      })
    } else {
      const meditation = DECAY_MEDITATIONS[Math.floor(Math.random() * DECAY_MEDITATIONS.length)]
      url = ''
      epitaph = meditation
    }

    // Spawn from edges, drift across
    const side = Math.floor(Math.random() * 4)
    let x: number, y: number, vx: number, vy: number

    switch (side) {
      case 0:
        x = -50
        y = Math.random() * this.height
        vx = 0.2 + Math.random() * 0.3
        vy = (Math.random() - 0.5) * 0.2
        break
      case 1:
        x = this.width + 50
        y = Math.random() * this.height
        vx = -(0.2 + Math.random() * 0.3)
        vy = (Math.random() - 0.5) * 0.2
        break
      case 2:
        x = Math.random() * this.width
        y = -30
        vx = (Math.random() - 0.5) * 0.2
        vy = 0.15 + Math.random() * 0.25
        break
      default:
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
      const age = this.frame - f.born
      const fadeIn = Math.min(age / 60, 1)
      const alpha = f.alpha * fadeIn

      if (alpha < 0.01) continue

      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'

      if (f.url) {
        // URL in monospace
        ctx.font = `${f.fontSize}px monospace`
        ctx.fillStyle = `rgba(120, 120, 140, ${alpha * 0.6})`

        const urlText = f.url
        ctx.fillText(urlText, f.x, f.y)

        // Strikethrough
        const urlWidth = ctx.measureText(urlText).width
        ctx.strokeStyle = `rgba(255, 20, 147, ${alpha * 0.3})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(f.x, f.y + f.fontSize * 0.55)
        ctx.lineTo(f.x + urlWidth, f.y + f.fontSize * 0.55)
        ctx.stroke()

        // Live data from CDX API (if available) or epitaph
        if (f.liveData) {
          // Show live capture data in a distinct color
          ctx.font = `300 ${f.fontSize * 0.8}px 'Cormorant Garamond', serif`
          ctx.fillStyle = `rgba(100, 200, 180, ${alpha * 0.45})`
          ctx.fillText(f.liveData, f.x, f.y + f.fontSize * 1.3)
          // Epitaph below the data
          ctx.font = `300 ${f.fontSize * 0.75}px 'Cormorant Garamond', serif`
          ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.25})`
          ctx.fillText(f.epitaph, f.x, f.y + f.fontSize * 2.3)
        } else {
          ctx.font = `300 ${f.fontSize * 0.85}px 'Cormorant Garamond', serif`
          ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.4})`
          ctx.fillText(f.epitaph, f.x, f.y + f.fontSize * 1.3)
        }
      } else {
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
