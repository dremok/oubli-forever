/**
 * THE PALIMPSEST GALLERY — your words on borrowed paintings
 *
 * Fetches random public domain artworks from the Metropolitan Museum
 * of Art's Open Access API. Your stored memories are written over
 * the paintings — text layered on images, the way medieval monks
 * scraped old text from parchment to write new text over it.
 *
 * Each visit shows a different painting with a different memory
 * inscribed on it. The memory text fades in slowly, ghostly,
 * as if emerging from beneath the paint. Degraded memories
 * appear more fragmentary and harder to read.
 *
 * The Met has 470,000+ works in its Open Access program — enough
 * paintings for every memory you'll ever have.
 *
 * Inspired by: palimpsests (reused manuscripts), Cy Twombly's
 * writing-on-painting, Jenny Holzer's projections on buildings,
 * the idea that every surface carries invisible histories,
 * Robert Rauschenberg erasing a de Kooning drawing (1953),
 * Christian Boltanski's archive installations, how museums
 * are repositories of other people's memories
 *
 * USES MEMORIES. Art API. Layered meaning.
 */

import type { Room } from './RoomManager'

interface Memory {
  id: string
  originalText: string
  currentText: string
  degradation: number
  timestamp: number
}

interface PalimpsestGalleryDeps {
  getMemories: () => Memory[]
  switchTo?: (name: string) => void
}

interface Artwork {
  title: string
  artist: string
  date: string
  imageUrl: string
  department: string
}

export function createPalimpsestGalleryRoom(deps: PalimpsestGalleryDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let currentArtwork: Artwork | null = null
  let artworkImage: HTMLImageElement | null = null
  let imageLoaded = false
  let currentMemory: Memory | null = null
  let textReveal = 0 // 0-1, how much text is visible
  let loading = true
  let pairingsViewed = 0

  // Met Museum departments with paintings
  const PAINTING_DEPARTMENTS = [11, 21] // European Paintings, Modern Art

  async function fetchRandomArtwork(): Promise<Artwork | null> {
    try {
      // Get a random painting from the Met's Open Access collection
      // First, search for a random object ID from paintings
      const deptId = PAINTING_DEPARTMENTS[Math.floor(Math.random() * PAINTING_DEPARTMENTS.length)]
      const searchResp = await fetch(
        `https://collectionapi.metmuseum.org/public/collection/v1/search?departmentId=${deptId}&hasImages=true&isPublicDomain=true&q=painting`,
        { signal: AbortSignal.timeout(8000) }
      )
      if (!searchResp.ok) throw new Error('search failed')
      const searchData = await searchResp.json()

      if (!searchData.objectIDs || searchData.objectIDs.length === 0) throw new Error('no results')

      // Pick a random object
      const objectId = searchData.objectIDs[Math.floor(Math.random() * searchData.objectIDs.length)]

      // Fetch the object details
      const objResp = await fetch(
        `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`,
        { signal: AbortSignal.timeout(8000) }
      )
      if (!objResp.ok) throw new Error('object fetch failed')
      const obj = await objResp.json()

      if (!obj.primaryImageSmall && !obj.primaryImage) throw new Error('no image')

      return {
        title: obj.title || 'Untitled',
        artist: obj.artistDisplayName || 'Unknown',
        date: obj.objectDate || '',
        imageUrl: obj.primaryImageSmall || obj.primaryImage,
        department: obj.department || '',
      }
    } catch {
      return null
    }
  }

  async function loadNewPairing() {
    loading = true
    imageLoaded = false
    textReveal = 0

    const memories = deps.getMemories()
    if (memories.length > 0) {
      currentMemory = memories[Math.floor(Math.random() * memories.length)]
    } else {
      currentMemory = null
    }

    const artwork = await fetchRandomArtwork()
    if (artwork) {
      currentArtwork = artwork

      // Load the image
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        artworkImage = img
        imageLoaded = true
        loading = false
      }
      img.onerror = () => {
        loading = false
        // Try again with a different artwork
        setTimeout(loadNewPairing, 2000)
      }
      img.src = artwork.imageUrl
    } else {
      loading = false
    }

    pairingsViewed++
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const c = ctx
    const w = canvas.width
    const h = canvas.height

    // Gallery wall — deep warm gray
    c.fillStyle = 'rgba(15, 12, 10, 1)'
    c.fillRect(0, 0, w, h)

    if (loading) {
      c.font = '10px "Cormorant Garamond", serif'
      c.fillStyle = `rgba(200, 180, 140, ${0.1 + Math.sin(time * 2) * 0.05})`
      c.textAlign = 'center'
      c.fillText('finding a painting...', w / 2, h / 2)
    } else if (imageLoaded && artworkImage) {
      // Calculate image display size (fit within canvas with margins)
      const maxW = w * 0.7
      const maxH = h * 0.65
      const imgAspect = artworkImage.width / artworkImage.height
      let drawW: number, drawH: number

      if (imgAspect > maxW / maxH) {
        drawW = maxW
        drawH = maxW / imgAspect
      } else {
        drawH = maxH
        drawW = maxH * imgAspect
      }

      const drawX = (w - drawW) / 2
      const drawY = (h - drawH) / 2 - 20

      // Draw the painting
      c.save()

      // Subtle frame
      c.strokeStyle = 'rgba(80, 60, 40, 0.2)'
      c.lineWidth = 3
      c.strokeRect(drawX - 5, drawY - 5, drawW + 10, drawH + 10)

      // The painting itself
      c.globalAlpha = 0.7 // slightly dimmed, like a gallery at night
      c.drawImage(artworkImage, drawX, drawY, drawW, drawH)

      // Overlay memory text as palimpsest
      if (currentMemory) {
        textReveal = Math.min(1, textReveal + 0.005)

        const text = currentMemory.currentText
        const degradation = currentMemory.degradation

        // Text style — ghostly, like chalk or scraped writing
        c.globalAlpha = 1
        c.font = `${Math.min(28, drawW * 0.05)}px "Cormorant Garamond", serif`
        c.textAlign = 'center'

        const words = text.split(' ')
        const maxWidth = drawW * 0.7
        let line = ''
        let lineY = drawY + drawH * 0.3
        const lineHeight = Math.min(36, drawW * 0.06)
        let charIndex = 0
        const totalChars = text.length
        const revealedChars = Math.floor(totalChars * textReveal)

        for (const word of words) {
          const test = line + (line ? ' ' : '') + word
          if (c.measureText(test).width > maxWidth && line) {
            // Draw this line
            drawTextLine(c, line, w / 2, lineY, charIndex, revealedChars, degradation)
            charIndex += line.length + 1
            line = word
            lineY += lineHeight
            if (lineY > drawY + drawH - 30) break
          } else {
            line = test
          }
        }
        if (line && lineY <= drawY + drawH - 30) {
          drawTextLine(c, line, w / 2, lineY, charIndex, revealedChars, degradation)
        }
      }

      c.restore()

      // Artwork info — below the painting
      if (currentArtwork) {
        c.font = '10px "Cormorant Garamond", serif'
        c.fillStyle = 'rgba(200, 180, 140, 0.15)'
        c.textAlign = 'center'
        c.fillText(currentArtwork.title, w / 2, drawY + drawH + 25)

        c.font = '9px "Cormorant Garamond", serif'
        c.fillStyle = 'rgba(200, 180, 140, 0.1)'
        c.fillText(
          `${currentArtwork.artist}${currentArtwork.date ? `, ${currentArtwork.date}` : ''}`,
          w / 2, drawY + drawH + 40,
        )

        c.font = '8px monospace'
        c.fillStyle = 'rgba(200, 180, 140, 0.05)'
        c.fillText('The Metropolitan Museum of Art, Open Access', w / 2, drawY + drawH + 55)
      }
    } else if (!loading) {
      c.font = '11px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(200, 180, 140, 0.1)'
      c.textAlign = 'center'
      c.fillText('the gallery is empty tonight', w / 2, h / 2)
      c.font = '9px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(200, 180, 140, 0.06)'
      c.fillText('click to try again', w / 2, h / 2 + 20)
    }

    // Title
    c.font = '10px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 180, 140, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.fillText('the palimpsest gallery', w / 2, 25)

    // Hint
    c.font = '9px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 180, 140, ${0.04 + Math.sin(time * 1.5) * 0.02})`
    c.textAlign = 'center'
    c.fillText('click for a new pairing', w / 2, h - 8)

    // Stats
    c.font = '9px monospace'
    c.fillStyle = 'rgba(200, 180, 140, 0.06)'
    c.textAlign = 'left'
    c.fillText(`${pairingsViewed} pairings`, 12, h - 18)
  }

  function drawTextLine(
    c: CanvasRenderingContext2D,
    line: string,
    cx: number,
    cy: number,
    startIdx: number,
    revealedChars: number,
    degradation: number,
  ) {
    const chars = line.split('')
    const totalWidth = c.measureText(line).width
    let x = cx - totalWidth / 2

    for (let i = 0; i < chars.length; i++) {
      const globalIdx = startIdx + i
      const revealed = globalIdx < revealedChars

      if (!revealed) continue

      // Degraded characters become glitchy
      let char = chars[i]
      if (degradation > 0.3 && Math.random() < (degradation - 0.3) * 0.3) {
        char = ' '
      }

      // Ghostly white text with breathing
      const breathe = Math.sin(time * 0.8 + globalIdx * 0.3) * 0.05
      const alpha = (0.5 - degradation * 0.3 + breathe)

      // White/cream text — like chalk on a painting
      c.fillStyle = `rgba(240, 235, 220, ${Math.max(0, alpha)})`

      // Slight vertical jitter for handwritten feel
      const jitter = Math.sin(globalIdx * 7.3) * 1.5

      c.fillText(char, x, cy + jitter)

      x += c.measureText(chars[i]).width
    }
  }

  return {
    name: 'palimpsestgallery',
    label: 'the palimpsest gallery',

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

      canvas.addEventListener('click', () => {
        if (!loading) loadNewPairing()
      })

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)

      // Navigation portals — small gallery placard text
      if (deps.switchTo) {
        const portalData = [
          { name: 'darkroom', label: 'Gallery A — The Darkroom', color: '200, 180, 140', pos: 'bottom: 40px; left: 20px;' },
          { name: 'loom', label: 'Gallery B — The Loom', color: '180, 170, 160', pos: 'bottom: 40px; left: 50%; transform: translateX(-50%);' },
          { name: 'archive', label: 'Gallery C — The Archive', color: '160, 160, 180', pos: 'bottom: 40px; right: 20px;' },
        ]
        for (const p of portalData) {
          const el = document.createElement('div')
          el.style.cssText = `
            position: absolute; ${p.pos}
            pointer-events: auto; cursor: pointer;
            font-family: 'Cormorant Garamond', serif;
            font-size: 8px; letter-spacing: 1.5px;
            text-transform: uppercase;
            color: rgba(${p.color}, 0.05);
            transition: color 0.5s ease, text-shadow 0.5s ease;
            padding: 5px 10px; z-index: 10;
            border-bottom: 1px solid rgba(${p.color}, 0.03);
          `
          el.textContent = p.label
          el.addEventListener('mouseenter', () => {
            el.style.color = `rgba(${p.color}, 0.4)`
            el.style.textShadow = `0 0 8px rgba(${p.color}, 0.1)`
            el.style.borderBottomColor = `rgba(${p.color}, 0.15)`
          })
          el.addEventListener('mouseleave', () => {
            el.style.color = `rgba(${p.color}, 0.05)`
            el.style.textShadow = 'none'
            el.style.borderBottomColor = `rgba(${p.color}, 0.03)`
          })
          el.addEventListener('click', (e) => {
            e.stopPropagation()
            deps.switchTo!(p.name)
          })
          overlay.appendChild(el)
        }
      }

      return overlay
    },

    activate() {
      active = true
      pairingsViewed = 0
      loadNewPairing()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      overlay?.remove()
    },
  }
}
