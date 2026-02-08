/**
 * THE MADELEINE — involuntary memory
 *
 * Marcel Proust dipped a madeleine in tea and seven volumes
 * of memory flooded back. Involuntary memory — the sudden,
 * unbidden return of the past triggered by a sensory detail.
 *
 * This room presents a stream of "triggers" — colors, shapes,
 * sounds, words — and when you click one that resonates,
 * a stored memory surfaces, chosen by word-association.
 * The trigger and the memory may seem unrelated, but the
 * connection is always there if you look.
 *
 * The twist: you can't choose which memory surfaces.
 * The association algorithm finds connections you didn't
 * know existed in your own words.
 *
 * Background artworks from the Art Institute of Chicago API
 * drift in and out like ghosts — paintings about memory, dream,
 * nostalgia — reinforcing the Proustian atmosphere.
 *
 * Also inspired by: synesthesia research, the tip-of-the-tongue
 * phenomenon, Pavlovian conditioning, how smells bypass the
 * thalamus and hit the amygdala directly, Walter Benjamin's
 * "excavation" metaphor for memory, Sei Shonagon's Pillow Book
 * (cataloguing sensory impressions), the Japanese concept of
 * "mono no aware" (pathos of things)
 *
 * USES MEMORIES. Literary. Associative.
 */

import type { Room } from './RoomManager'

interface Memory {
  id: string
  originalText: string
  currentText: string
  degradation: number
  timestamp: number
}

interface MadeleineDeps {
  getMemories: () => Memory[]
  switchTo?: (name: string) => void
}

interface Trigger {
  text: string
  type: 'sense' | 'word' | 'color' | 'sound'
  x: number
  y: number
  alpha: number
  vx: number
  vy: number
  hue: number
  size: number
}

// --- Art Institute of Chicago API types ---
interface ArtworkResult {
  id: number
  title: string
  artist_display: string
  date_display: string
  image_id: string | null
  thumbnail: { alt_text: string; width: number; height: number } | null
}

interface ArtworkSearchResponse {
  data: ArtworkResult[]
}

interface ActiveArtwork {
  img: HTMLImageElement
  title: string
  artist: string
  alpha: number       // 0..1 — current opacity
  phase: 'in' | 'hold' | 'out'
  holdTimer: number   // seconds remaining in hold phase
  loaded: boolean
}

// Session-level cache keyed by search term
const artworkCache: Map<string, ArtworkResult[]> = new Map()

const ARTWORK_SEARCH_TERMS = ['memory', 'dream', 'nostalgia', 'childhood', 'lost', 'forgotten']

async function fetchArtworks(query: string): Promise<ArtworkResult[]> {
  if (artworkCache.has(query)) return artworkCache.get(query)!

  try {
    const url = `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(query)}&limit=10&fields=id,title,artist_display,date_display,image_id,thumbnail`
    const resp = await fetch(url)
    if (!resp.ok) return []
    const json: ArtworkSearchResponse = await resp.json()
    const results = json.data.filter((a: ArtworkResult) => a.image_id)
    artworkCache.set(query, results)
    return results
  } catch {
    return []
  }
}

function artworkImageUrl(imageId: string): string {
  return `https://www.artic.edu/iiif/2/${imageId}/full/843,/0/default.jpg`
}

// Sensory triggers — Proustian prompts
const SENSE_TRIGGERS = [
  'the smell of rain on hot concrete',
  'a song heard through a wall',
  'cold metal on skin',
  'bread baking somewhere nearby',
  'the weight of a key in your pocket',
  'sunlight through closed eyelids',
  'a hand on your shoulder',
  'the sound of a door closing',
  'ink on paper',
  'salt on your lips',
  'static electricity',
  'the color of 4am',
  'dust in a beam of light',
  'a match being struck',
  'ice cracking underfoot',
  'the hum of fluorescent lights',
  'chlorine',
  'cinnamon',
  'old books',
  'petrichor',
  'lavender',
  'campfire smoke',
  'wet wool',
  'copper pennies',
  'fresh laundry',
  'gasoline',
  'a ticking clock',
  'wind chimes',
  'a phone ringing in another room',
  'footsteps on gravel',
  'the buzz of a bee',
  'paper tearing',
  'a cat purring',
  'waves pulling back',
  'a train in the distance',
]

const WORD_TRIGGERS = [
  'threshold', 'dissolve', 'return', 'absence', 'light',
  'beneath', 'drift', 'echo', 'margin', 'residue',
  'trace', 'passage', 'vessel', 'hollow', 'tide',
  'ember', 'frost', 'vapor', 'grain', 'thread',
  'signal', 'pulse', 'husk', 'silt', 'meridian',
]

export function createMadeleineRoom(deps: MadeleineDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let triggers: Trigger[] = []
  let surfacedMemory: { text: string; trigger: string; alpha: number; y: number } | null = null
  let ripples: { x: number; y: number; radius: number; alpha: number }[] = []
  let spawnTimer = 0

  // --- Artwork state ---
  let currentArtwork: ActiveArtwork | null = null
  let nextArtwork: ActiveArtwork | null = null
  let artworkQueue: ArtworkResult[] = []
  let artworkSearchIndex = 0
  let artworkTimer = 0
  let artworkFetchInProgress = false

  // --- Portal glow animation state ---
  let portalElements: HTMLElement[] = []

  function spawnTrigger() {
    if (!canvas) return
    const w = canvas.width
    const h = canvas.height

    const type = ['sense', 'word', 'color', 'sound'][Math.floor(Math.random() * 4)] as Trigger['type']
    let text = ''
    let hue = 0
    let size = 10

    switch (type) {
      case 'sense':
        text = SENSE_TRIGGERS[Math.floor(Math.random() * SENSE_TRIGGERS.length)]
        hue = 30 + Math.random() * 30 // warm amber
        size = 10
        break
      case 'word':
        text = WORD_TRIGGERS[Math.floor(Math.random() * WORD_TRIGGERS.length)]
        hue = 280 + Math.random() * 40 // violet
        size = 14
        break
      case 'color':
        hue = Math.floor(Math.random() * 360)
        text = '' // just a color blob
        size = 20
        break
      case 'sound':
        text = ['~', '\u266A', '\u00B7\u00B7\u00B7', ')))'][Math.floor(Math.random() * 4)]
        hue = 180 + Math.random() * 40 // teal
        size = 12
        break
    }

    triggers.push({
      text,
      type,
      x: Math.random() * w,
      y: -20,
      alpha: 0.3 + Math.random() * 0.2,
      vx: (Math.random() - 0.5) * 0.3,
      vy: 0.2 + Math.random() * 0.3,
      hue,
      size,
    })
  }

  function findAssociatedMemory(trigger: Trigger): Memory | null {
    const memories = deps.getMemories()
    if (memories.length === 0) return null

    if (trigger.type === 'color' || trigger.type === 'sound') {
      // Random memory for non-text triggers
      return memories[Math.floor(Math.random() * memories.length)]
    }

    // Word association — find memory sharing the most words with trigger
    const triggerWords = trigger.text.toLowerCase().split(/\s+/)

    let bestMatch: Memory | null = null
    let bestScore = -1

    for (const mem of memories) {
      const memWords = mem.currentText.toLowerCase().split(/\s+/)
      let score = 0

      for (const tw of triggerWords) {
        if (tw.length < 3) continue
        for (const mw of memWords) {
          if (mw.includes(tw) || tw.includes(mw)) {
            score += 3
          } else if (mw[0] === tw[0]) {
            score += 1 // same initial letter — loose association
          }
        }
      }

      // Bonus for memories with similar emotional valence
      if (trigger.text.includes('cold') || trigger.text.includes('ice') || trigger.text.includes('frost')) {
        if (mem.currentText.match(/cold|ice|winter|frozen|snow|alone|empty/i)) score += 2
      }
      if (trigger.text.includes('warm') || trigger.text.includes('sun') || trigger.text.includes('light')) {
        if (mem.currentText.match(/warm|sun|light|love|joy|bright|gold/i)) score += 2
      }

      // Small random factor — involuntary means unpredictable
      score += Math.random() * 2

      if (score > bestScore) {
        bestScore = score
        bestMatch = mem
      }
    }

    return bestMatch || memories[Math.floor(Math.random() * memories.length)]
  }

  function handleClick(e: MouseEvent) {
    if (!canvas || surfacedMemory) return

    // Find clicked trigger
    for (let i = triggers.length - 1; i >= 0; i--) {
      const t = triggers[i]
      const dx = e.clientX - t.x
      const dy = e.clientY - t.y
      const clickRadius = t.type === 'color' ? t.size * 2 : t.size * 3

      if (dx * dx + dy * dy < clickRadius * clickRadius) {
        // Found a trigger — surface a memory
        const memory = findAssociatedMemory(t)
        if (memory) {
          surfacedMemory = {
            text: memory.currentText,
            trigger: t.text || `color: hsl(${t.hue}, 50%, 50%)`,
            alpha: 0,
            y: canvas.height * 0.6,
          }

          // Ripple effect
          ripples.push({
            x: t.x,
            y: t.y,
            radius: 0,
            alpha: 0.3,
          })
        }

        // Remove the trigger
        triggers.splice(i, 1)
        break
      }
    }
  }

  // --- Artwork management ---

  async function enqueueArtworks() {
    if (artworkFetchInProgress) return
    artworkFetchInProgress = true

    const term = ARTWORK_SEARCH_TERMS[artworkSearchIndex % ARTWORK_SEARCH_TERMS.length]
    artworkSearchIndex++

    const results = await fetchArtworks(term)
    if (results.length > 0) {
      // Shuffle and add to queue, avoiding duplicates
      const shuffled = [...results].sort(() => Math.random() - 0.5)
      const existingIds = new Set(artworkQueue.map(a => a.id))
      for (const r of shuffled) {
        if (!existingIds.has(r.id)) {
          artworkQueue.push(r)
          existingIds.add(r.id)
        }
      }
    }

    artworkFetchInProgress = false
  }

  function prepareNextArtwork() {
    if (nextArtwork) return  // already preparing
    if (artworkQueue.length === 0) {
      // fetch more
      enqueueArtworks()
      return
    }

    const data = artworkQueue.shift()!
    const img = new Image()
    img.crossOrigin = 'anonymous'

    const artwork: ActiveArtwork = {
      img,
      title: data.title || '',
      artist: data.artist_display || '',
      alpha: 0,
      phase: 'in',
      holdTimer: 60 + Math.random() * 30, // 60-90 seconds
      loaded: false,
    }

    img.onload = () => {
      artwork.loaded = true
    }
    img.onerror = () => {
      // Skip this artwork, try another
      nextArtwork = null
      prepareNextArtwork()
    }
    img.src = artworkImageUrl(data.image_id!)
    nextArtwork = artwork
  }

  function updateArtworks(dt: number) {
    // Current artwork fading/holding
    if (currentArtwork) {
      switch (currentArtwork.phase) {
        case 'in':
          currentArtwork.alpha += dt * 0.08  // ~12s fade in
          if (currentArtwork.alpha >= 1) {
            currentArtwork.alpha = 1
            currentArtwork.phase = 'hold'
          }
          break
        case 'hold':
          currentArtwork.holdTimer -= dt
          if (currentArtwork.holdTimer <= 0) {
            currentArtwork.phase = 'out'
          }
          break
        case 'out':
          currentArtwork.alpha -= dt * 0.08  // ~12s fade out
          if (currentArtwork.alpha <= 0) {
            currentArtwork = null
          }
          break
      }
    }

    // Promote next artwork when current is gone or about to be
    if (!currentArtwork && nextArtwork && nextArtwork.loaded) {
      currentArtwork = nextArtwork
      nextArtwork = null
      prepareNextArtwork()
    }

    // Keep queue populated
    artworkTimer += dt
    if (artworkTimer > 5 && artworkQueue.length < 5) {
      artworkTimer = 0
      enqueueArtworks()
    }

    // Always be preparing next
    if (!nextArtwork && currentArtwork) {
      prepareNextArtwork()
    }
  }

  function drawArtwork(c: CanvasRenderingContext2D, w: number, h: number) {
    if (!currentArtwork || !currentArtwork.loaded) return

    const art = currentArtwork
    const img = art.img

    // Compute dimensions: fit image within canvas, centered, slightly scaled down
    const scale = Math.min(w / img.width, h / img.height) * 0.7
    const dw = img.width * scale
    const dh = img.height * scale
    const dx = (w - dw) / 2
    const dy = (h - dh) / 2

    // Very low opacity — ghostly background element
    const maxOpacity = 0.12
    const opacity = art.alpha * maxOpacity

    c.save()
    c.globalAlpha = opacity
    // Desaturate slightly via composite — draw darkened version
    c.filter = 'saturate(0.4) brightness(0.6)'
    c.drawImage(img, dx, dy, dw, dh)
    c.filter = 'none'
    c.globalAlpha = 1
    c.restore()

    // Draw dissolving title and artist text
    if (art.title || art.artist) {
      const textAlpha = art.alpha * 0.18

      // Title
      if (art.title) {
        c.font = '11px "Cormorant Garamond", serif'
        c.fillStyle = `rgba(200, 180, 140, ${textAlpha})`
        c.textAlign = 'center'

        // Dissolving effect: scatter characters slightly based on fade phase
        const scatter = art.phase === 'out' ? (1 - art.alpha) * 8 : 0
        if (scatter > 0.5) {
          // Character-by-character with scatter
          const chars = art.title.split('')
          let xOff = -c.measureText(art.title).width / 2
          for (let i = 0; i < chars.length; i++) {
            const charW = c.measureText(chars[i]).width
            const sx = (Math.sin(i * 1.7 + time * 2) * scatter)
            const sy = (Math.cos(i * 2.3 + time * 1.5) * scatter)
            const charAlpha = textAlpha * Math.max(0, 1 - Math.random() * scatter * 0.15)
            c.fillStyle = `rgba(200, 180, 140, ${charAlpha})`
            c.fillText(chars[i], w / 2 + xOff + sx, dy + dh + 24 + sy)
            xOff += charW
          }
        } else {
          c.fillText(art.title, w / 2, dy + dh + 24)
        }
      }

      // Artist
      if (art.artist) {
        c.font = '9px "Cormorant Garamond", serif'
        // Truncate long artist strings
        let artistText = art.artist
        if (artistText.length > 60) {
          artistText = artistText.substring(0, 57) + '...'
        }
        const artistAlpha = art.alpha * 0.12
        c.fillStyle = `rgba(200, 180, 140, ${artistAlpha})`
        c.textAlign = 'center'
        c.fillText(artistText, w / 2, dy + dh + 40)
      }
    }
  }

  // --- Portal glow pulse ---
  function updatePortalGlow() {
    const pulse = 0.05 + Math.sin(time * 0.8) * 0.03
    for (const el of portalElements) {
      const baseColor = el.dataset.portalColor || '200,180,140'
      const hovered = el.dataset.hovered === 'true'
      if (!hovered) {
        el.style.color = `rgba(${baseColor}, ${pulse})`
        // Subtle inner glow
        el.style.textShadow = `0 0 ${6 + Math.sin(time * 1.2) * 3}px rgba(${baseColor}, ${pulse * 0.6})`
      }
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016
    const dt = 0.016

    const c = ctx
    const w = canvas.width
    const h = canvas.height

    // Update artwork cycle
    updateArtworks(dt)

    // Warm dark background — tea-stained
    c.fillStyle = 'rgba(12, 9, 6, 1)'
    c.fillRect(0, 0, w, h)

    // Draw ghostly background artwork BEHIND everything
    drawArtwork(c, w, h)

    // Spawn triggers periodically
    spawnTimer += 0.016
    if (spawnTimer > 2.5 && triggers.length < 8) {
      spawnTrigger()
      spawnTimer = 0
    }

    // Update and draw triggers
    triggers = triggers.filter(t => {
      t.x += t.vx
      t.y += t.vy
      t.alpha -= 0.0005

      if (t.y > h + 30 || t.alpha <= 0) return false

      if (t.type === 'color') {
        // Color blob
        const grad = c.createRadialGradient(t.x, t.y, 0, t.x, t.y, t.size)
        grad.addColorStop(0, `hsla(${t.hue}, 50%, 50%, ${t.alpha * 0.3})`)
        grad.addColorStop(1, 'transparent')
        c.fillStyle = grad
        c.beginPath()
        c.arc(t.x, t.y, t.size, 0, Math.PI * 2)
        c.fill()
      } else {
        // Text trigger
        c.font = `${t.size}px "Cormorant Garamond", serif`
        c.fillStyle = `hsla(${t.hue}, 40%, 60%, ${t.alpha})`
        c.textAlign = 'center'
        c.fillText(t.text, t.x, t.y)
      }

      return true
    })

    // Draw ripples
    ripples = ripples.filter(r => {
      r.radius += 2
      r.alpha -= 0.008

      if (r.alpha <= 0) return false

      c.strokeStyle = `rgba(255, 215, 0, ${r.alpha})`
      c.lineWidth = 1
      c.beginPath()
      c.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
      c.stroke()

      return true
    })

    // Surfaced memory
    if (surfacedMemory) {
      if (surfacedMemory.alpha < 1) {
        surfacedMemory.alpha += 0.015
      } else {
        surfacedMemory.alpha -= 0.003
      }

      if (surfacedMemory.alpha <= 0) {
        surfacedMemory = null
      } else {
        const sm = surfacedMemory
        const alpha = Math.min(1, sm.alpha)

        // Trigger text (what caused the memory)
        c.font = '9px "Cormorant Garamond", serif'
        c.fillStyle = `rgba(200, 180, 140, ${alpha * 0.15})`
        c.textAlign = 'center'
        c.fillText(`triggered by: ${sm.trigger}`, w / 2, sm.y - 30)

        // Connection line
        c.strokeStyle = `rgba(255, 215, 0, ${alpha * 0.05})`
        c.lineWidth = 0.5
        c.setLineDash([2, 4])
        c.beginPath()
        c.moveTo(w / 2, sm.y - 25)
        c.lineTo(w / 2, sm.y - 8)
        c.stroke()
        c.setLineDash([])

        // Memory text — golden, centered
        c.font = '15px "Cormorant Garamond", serif'
        c.fillStyle = `rgba(255, 215, 0, ${alpha * 0.4})`
        c.textAlign = 'center'

        // Word wrap
        const words = sm.text.split(' ')
        const maxWidth = w * 0.5
        let line = ''
        let lineY = sm.y

        for (const word of words) {
          const test = line + (line ? ' ' : '') + word
          if (c.measureText(test).width > maxWidth && line) {
            c.fillText(line, w / 2, lineY)
            line = word
            lineY += 22
          } else {
            line = test
          }
        }
        if (line) c.fillText(line, w / 2, lineY)

        // Soft glow around memory text area
        const glow = c.createRadialGradient(w / 2, sm.y, 0, w / 2, sm.y, 150)
        glow.addColorStop(0, `rgba(255, 215, 0, ${alpha * 0.02})`)
        glow.addColorStop(1, 'transparent')
        c.fillStyle = glow
        c.beginPath()
        c.arc(w / 2, sm.y, 150, 0, Math.PI * 2)
        c.fill()
      }
    }

    // Title
    c.font = '10px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 180, 140, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.fillText('the madeleine', w / 2, 25)

    // Hint
    if (!surfacedMemory && triggers.length > 0) {
      c.font = '9px "Cormorant Garamond", serif'
      c.fillStyle = `rgba(200, 180, 140, ${0.04 + Math.sin(time * 1.5) * 0.02})`
      c.textAlign = 'center'
      c.fillText('click a trigger to surface a memory', w / 2, h - 8)
    }

    // No memories hint
    if (deps.getMemories().length === 0) {
      c.font = '12px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(200, 180, 140, 0.1)'
      c.textAlign = 'center'
      c.fillText('no memories to surface', w / 2, h / 2)
      c.font = '10px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(200, 180, 140, 0.06)'
      c.fillText('the triggers drift past, finding nothing', w / 2, h / 2 + 20)
    }

    // Attribution
    c.font = '8px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 180, 140, ${0.03 + Math.sin(time * 0.2) * 0.01})`
    c.textAlign = 'center'
    c.fillText('after Proust \u2014 involuntary memory', w / 2, 40)

    // Stats
    c.font = '9px monospace'
    c.fillStyle = 'rgba(200, 180, 140, 0.06)'
    c.textAlign = 'left'
    c.fillText(`${triggers.length} triggers drifting`, 12, h - 18)

    // Update portal glows
    updatePortalGlow()
  }

  return {
    name: 'madeleine',
    label: 'the madeleine',

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        width: 100%; height: 100%;
        pointer-events: auto;
        background: #000;
      `

      canvas = document.createElement('canvas')
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      canvas.style.cssText = 'width: 100%; height: 100%; cursor: pointer;'
      ctx = canvas.getContext('2d')

      canvas.addEventListener('click', handleClick)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)

      // Navigation portals — doorways of light and scent (Proustian sensory triggers)
      if (deps.switchTo) {
        portalElements = []
        const portalData = [
          {
            name: 'seance',
            label: 'a voice in the dark',
            color: '180, 160, 220',
            pos: 'top: 60px; left: 16px;',
            glyph: '\u2727', // four-pointed star
          },
          {
            name: 'oracle',
            label: 'the taste of fate',
            color: '220, 190, 130',
            pos: 'top: 60px; right: 16px;',
            glyph: '\u2736', // six-pointed star
          },
          {
            name: 'projection',
            label: 'flickering light',
            color: '200, 180, 140',
            pos: 'bottom: 50px; left: 16px;',
            glyph: '\u25C7', // diamond
          },
          {
            name: 'garden',
            label: 'wet earth and bloom',
            color: '130, 180, 130',
            pos: 'bottom: 50px; right: 16px;',
            glyph: '\u2E2C', // squared four-dot punctuation — leaf-like
          },
          {
            name: 'rememory',
            label: 'something half-remembered',
            color: '180, 160, 180',
            pos: 'bottom: 50px; left: 50%; transform: translateX(-50%);',
            glyph: '\u29BE', // circled white bullet
          },
        ]
        for (const p of portalData) {
          const el = document.createElement('div')
          el.dataset.portalColor = p.color
          el.dataset.hovered = 'false'
          el.style.cssText = `
            position: absolute; ${p.pos}
            pointer-events: auto; cursor: pointer;
            font-family: 'Cormorant Garamond', serif;
            font-style: italic; font-size: 9px;
            color: rgba(${p.color}, 0.05);
            transition: color 0.6s ease, text-shadow 0.6s ease, background 0.6s ease, border-color 0.6s ease;
            padding: 8px 14px; z-index: 10;
            border: 1px solid rgba(${p.color}, 0.03);
            border-radius: 2px;
            background: rgba(${p.color}, 0.01);
            letter-spacing: 0.5px;
            display: flex; align-items: center; gap: 6px;
          `

          // Glyph element — doorway icon
          const glyphSpan = document.createElement('span')
          glyphSpan.style.cssText = `
            font-style: normal; font-size: 11px;
            opacity: 0.6;
          `
          glyphSpan.textContent = p.glyph

          const labelSpan = document.createElement('span')
          labelSpan.textContent = p.label

          el.appendChild(glyphSpan)
          el.appendChild(labelSpan)

          el.addEventListener('mouseenter', () => {
            el.dataset.hovered = 'true'
            el.style.color = `rgba(${p.color}, 0.55)`
            el.style.textShadow = `0 0 18px rgba(${p.color}, 0.25), 0 0 40px rgba(${p.color}, 0.08)`
            el.style.borderColor = `rgba(${p.color}, 0.15)`
            el.style.background = `rgba(${p.color}, 0.04)`
          })
          el.addEventListener('mouseleave', () => {
            el.dataset.hovered = 'false'
            el.style.color = `rgba(${p.color}, 0.05)`
            el.style.textShadow = 'none'
            el.style.borderColor = `rgba(${p.color}, 0.03)`
            el.style.background = `rgba(${p.color}, 0.01)`
          })
          el.addEventListener('click', (e) => {
            e.stopPropagation()
            deps.switchTo!(p.name)
          })
          overlay.appendChild(el)
          portalElements.push(el)
        }
      }

      return overlay
    },

    activate() {
      active = true
      triggers = []
      surfacedMemory = null
      ripples = []
      spawnTimer = 0
      artworkTimer = 0

      // Seed initial triggers
      for (let i = 0; i < 4; i++) {
        spawnTrigger()
        if (triggers.length > 0) {
          const last = triggers[triggers.length - 1]
          last.y = Math.random() * (canvas?.height || 600) * 0.7
        }
      }

      // Start artwork pipeline
      if (!currentArtwork && !nextArtwork) {
        enqueueArtworks().then(() => {
          prepareNextArtwork()
        })
      }

      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      portalElements = []
      overlay?.remove()
    },
  }
}
