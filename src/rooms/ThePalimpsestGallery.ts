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
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

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
  let failureMessage = ''

  // Audio state
  let audioInitialized = false
  let audioMaster: GainNode | null = null
  let ambienceSource: AudioBufferSourceNode | null = null
  let ambienceGain: GainNode | null = null
  let scratchGain: GainNode | null = null
  let scratchLfoGain: GainNode | null = null
  let scratchSource: AudioBufferSourceNode | null = null
  let scratchInterval: ReturnType<typeof setInterval> | null = null
  let prevTextReveal = 0

  // Visual state
  let cursorX = 0
  let cursorY = 0
  let cursorOverPainting = false
  // Ink drip storage
  const inkDrips: { x: number; y: number; length: number; alpha: number }[] = []

  // Met Museum departments with paintings
  const PAINTING_DEPARTMENTS = [11, 21] // European Paintings, Modern Art

  // Cached search results to avoid re-fetching the objectIDs list every time
  let cachedObjectIDs: number[] = []

  async function ensureObjectIDs(): Promise<number[]> {
    if (cachedObjectIDs.length > 0) return cachedObjectIDs

    try {
      const deptId = PAINTING_DEPARTMENTS[Math.floor(Math.random() * PAINTING_DEPARTMENTS.length)]
      const searchResp = await fetch(
        `https://collectionapi.metmuseum.org/public/collection/v1/search?departmentId=${deptId}&hasImages=true&isPublicDomain=true&q=painting`,
        { signal: AbortSignal.timeout(8000) }
      )
      if (!searchResp.ok) throw new Error('search failed')
      const searchData = await searchResp.json()

      if (!searchData.objectIDs || searchData.objectIDs.length === 0) throw new Error('no results')

      cachedObjectIDs = searchData.objectIDs
      return cachedObjectIDs
    } catch {
      return []
    }
  }

  async function fetchRandomArtwork(): Promise<Artwork | null> {
    const objectIDs = await ensureObjectIDs()
    if (objectIDs.length === 0) return null

    // Try up to 5 random IDs to find one with an image
    const maxAttempts = 5
    const tried = new Set<number>()

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let objectId: number
      // Pick a random ID we haven't tried yet
      do {
        objectId = objectIDs[Math.floor(Math.random() * objectIDs.length)]
      } while (tried.has(objectId) && tried.size < objectIDs.length)

      if (tried.has(objectId)) break
      tried.add(objectId)

      try {
        const objResp = await fetch(
          `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`,
          { signal: AbortSignal.timeout(8000) }
        )
        if (!objResp.ok) continue
        const obj = await objResp.json()

        if (!obj.primaryImageSmall && !obj.primaryImage) continue

        return {
          title: obj.title || 'Untitled',
          artist: obj.artistDisplayName || 'Unknown',
          date: obj.objectDate || '',
          imageUrl: obj.primaryImageSmall || obj.primaryImage,
          department: obj.department || '',
        }
      } catch {
        continue
      }
    }

    return null
  }

  // Verify an image URL actually loads, returning a loaded HTMLImageElement or null
  function loadImage(url: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })
  }

  async function loadNewPairing(retryCount = 0) {
    const maxRetries = 3
    loading = true
    imageLoaded = false
    textReveal = 0
    failureMessage = ''

    const memories = deps.getMemories()
    if (memories.length > 0) {
      currentMemory = memories[Math.floor(Math.random() * memories.length)]
    } else {
      currentMemory = null
    }

    const artwork = await fetchRandomArtwork()
    if (artwork) {
      const img = await loadImage(artwork.imageUrl)
      if (img) {
        currentArtwork = artwork
        artworkImage = img
        imageLoaded = true
        loading = false
        pairingsViewed++
        prevTextReveal = 0
        inkDrips.length = 0
        playChime()
        return
      }

      // Image failed to load — retry immediately (no delay) with a new artwork
      if (retryCount < maxRetries) {
        await loadNewPairing(retryCount + 1)
        return
      }
    } else if (retryCount < maxRetries) {
      // No artwork found from API — retry
      await loadNewPairing(retryCount + 1)
      return
    }

    // All retries exhausted
    loading = false
    failureMessage = 'the museum is closed — the paintings rest behind locked doors'
    pairingsViewed++
  }

  // --- Audio functions ---

  async function initAudio() {
    if (audioInitialized) return
    try {
      const ac = await getAudioContext()
      const dest = getAudioDestination()

      audioMaster = ac.createGain()
      audioMaster.gain.value = 0
      audioMaster.connect(dest)

      // Gallery ambience — filtered white noise, reverberant space feel
      const ambienceBuffer = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate)
      const ambienceData = ambienceBuffer.getChannelData(0)
      for (let i = 0; i < ambienceData.length; i++) {
        ambienceData[i] = (Math.random() * 2 - 1)
      }

      ambienceSource = ac.createBufferSource()
      ambienceSource.buffer = ambienceBuffer
      ambienceSource.loop = true

      const ambBandpass = ac.createBiquadFilter()
      ambBandpass.type = 'bandpass'
      ambBandpass.frequency.value = 550
      ambBandpass.Q.value = 0.8

      ambienceGain = ac.createGain()
      ambienceGain.gain.value = 0.008

      ambienceSource.connect(ambBandpass)
      ambBandpass.connect(ambienceGain)
      ambienceGain.connect(audioMaster)
      ambienceSource.start()

      // Scratch/writing sound — highpass filtered noise, pulsing
      // Stays at gain 0 until text is revealing
      const scratchBuffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate)
      const scratchData = scratchBuffer.getChannelData(0)
      for (let i = 0; i < scratchData.length; i++) {
        scratchData[i] = (Math.random() * 2 - 1)
      }

      scratchSource = ac.createBufferSource()
      scratchSource.buffer = scratchBuffer
      scratchSource.loop = true

      const scratchHipass = ac.createBiquadFilter()
      scratchHipass.type = 'highpass'
      scratchHipass.frequency.value = 3000

      scratchGain = ac.createGain()
      scratchGain.gain.value = 0

      // LFO for pulsing at ~10Hz via a gain modulator
      scratchLfoGain = ac.createGain()
      scratchLfoGain.gain.value = 0 // modulated by the interval

      scratchSource.connect(scratchHipass)
      scratchHipass.connect(scratchGain)
      scratchGain.connect(scratchLfoGain)
      scratchLfoGain.connect(audioMaster)
      scratchSource.start()

      // Pulse the scratch LFO gain at ~10Hz
      let lfoPhase = 0
      scratchInterval = setInterval(() => {
        if (!scratchLfoGain) return
        lfoPhase += 0.1 * Math.PI * 2 // ~10Hz at 100ms intervals — but we use shorter interval
        const pulse = (Math.sin(lfoPhase) + 1) * 0.5
        scratchLfoGain.gain.value = pulse
      }, 10)

      audioInitialized = true

      // Fade in master
      const now = ac.currentTime
      audioMaster.gain.setValueAtTime(0, now)
      audioMaster.gain.linearRampToValueAtTime(1, now + 1.5)
    } catch {
      // Audio not available — degrade gracefully
    }
  }

  function playChime() {
    if (!audioMaster) return
    try {
      const ac = audioMaster.context as AudioContext
      const now = ac.currentTime

      // First note: C5 (523Hz)
      const osc1 = ac.createOscillator()
      osc1.type = 'sine'
      osc1.frequency.value = 523
      const g1 = ac.createGain()
      g1.gain.setValueAtTime(0.03, now)
      g1.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
      osc1.connect(g1)
      g1.connect(audioMaster)
      osc1.start(now)
      osc1.stop(now + 0.15)

      // Second note: E5 (659Hz)
      const osc2 = ac.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.value = 659
      const g2 = ac.createGain()
      g2.gain.setValueAtTime(0.03, now + 0.1)
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
      osc2.connect(g2)
      g2.connect(audioMaster)
      osc2.start(now + 0.1)
      osc2.stop(now + 0.3)
    } catch { /* */ }
  }

  function playClick() {
    if (!audioMaster) return
    try {
      const ac = audioMaster.context as AudioContext
      const now = ac.currentTime

      const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * 0.005), ac.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
      }
      const src = ac.createBufferSource()
      src.buffer = buf
      const g = ac.createGain()
      g.gain.value = 0.04
      src.connect(g)
      g.connect(audioMaster)
      src.start(now)
    } catch { /* */ }
  }

  function updateScratchVolume() {
    if (!scratchGain || !audioMaster) return
    // Volume proportional to reveal progress, but stop when done
    if (textReveal < 1 && textReveal > prevTextReveal) {
      scratchGain.gain.value = 0.02 * textReveal
    } else {
      scratchGain.gain.value = 0
    }
    prevTextReveal = textReveal
  }

  function fadeAudioOut() {
    if (!audioMaster) return
    try {
      const ac = audioMaster.context as AudioContext
      const now = ac.currentTime
      audioMaster.gain.cancelScheduledValues(now)
      audioMaster.gain.setValueAtTime(audioMaster.gain.value, now)
      audioMaster.gain.linearRampToValueAtTime(0, now + 0.5)
    } catch { /* */ }
  }

  function destroyAudio() {
    fadeAudioOut()
    if (scratchInterval) {
      clearInterval(scratchInterval)
      scratchInterval = null
    }
    setTimeout(() => {
      try { ambienceSource?.stop() } catch { /* */ }
      try { scratchSource?.stop() } catch { /* */ }
      ambienceSource?.disconnect()
      ambienceGain?.disconnect()
      scratchSource?.disconnect()
      scratchGain?.disconnect()
      scratchLfoGain?.disconnect()
      audioMaster?.disconnect()
      ambienceSource = null
      ambienceGain = null
      scratchSource = null
      scratchGain = null
      scratchLfoGain = null
      audioMaster = null
      audioInitialized = false
    }, 600)
  }

  // --- Mouse tracking ---
  function handleMouseMove(e: MouseEvent) {
    cursorX = e.clientX
    cursorY = e.clientY
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

      // Breathing painting — subtle opacity oscillation
      const breathAlpha = 0.70 + Math.sin(time * 0.6) * 0.02

      // Cursor brightness boost — if cursor over painting, increase alpha
      cursorOverPainting = (
        cursorX >= drawX && cursorX <= drawX + drawW &&
        cursorY >= drawY && cursorY <= drawY + drawH
      )
      const paintingAlpha = cursorOverPainting ? Math.min(breathAlpha + 0.08, 0.85) : breathAlpha

      // The painting itself
      c.globalAlpha = paintingAlpha
      c.drawImage(artworkImage, drawX, drawY, drawW, drawH)

      // Gallery frame shadow — vignette inside the painting
      c.globalAlpha = 1
      const vigGrad = c.createRadialGradient(
        drawX + drawW / 2, drawY + drawH / 2, Math.min(drawW, drawH) * 0.3,
        drawX + drawW / 2, drawY + drawH / 2, Math.max(drawW, drawH) * 0.7,
      )
      vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)')
      vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.15)')
      c.fillStyle = vigGrad
      c.fillRect(drawX, drawY, drawW, drawH)

      // Overlay memory text as palimpsest
      let cursorCharX = 0
      let cursorCharY = 0
      let showCursor = false

      if (currentMemory) {
        textReveal = Math.min(1, textReveal + 0.005)
        updateScratchVolume()

        const text = currentMemory.currentText
        const degradation = currentMemory.degradation

        // Text style — ghostly, like chalk or scraped writing
        c.globalAlpha = 1
        const fontSize = Math.min(28, drawW * 0.05)
        c.font = `${fontSize}px "Cormorant Garamond", serif`
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
            drawTextLine(c, line, w / 2, lineY, charIndex, revealedChars, degradation, drawX, drawW)
            charIndex += line.length + 1
            line = word
            lineY += lineHeight
            if (lineY > drawY + drawH - 30) break
          } else {
            line = test
          }
        }
        if (line && lineY <= drawY + drawH - 30) {
          drawTextLine(c, line, w / 2, lineY, charIndex, revealedChars, degradation, drawX, drawW)
        }

        // Writing cursor position — find where the reveal ends
        if (textReveal < 1) {
          showCursor = true
          // Approximate cursor position by replaying the line-breaking
          let ci = 0
          let ln = ''
          let ly = drawY + drawH * 0.3
          for (const word2 of words) {
            const test2 = ln + (ln ? ' ' : '') + word2
            if (c.measureText(test2).width > maxWidth && ln) {
              if (ci + ln.length >= revealedChars) {
                const partial = revealedChars - ci
                const partialText = ln.substring(0, partial)
                const totalLineW = c.measureText(ln).width
                cursorCharX = (w / 2 - totalLineW / 2) + c.measureText(partialText).width
                cursorCharY = ly
                break
              }
              ci += ln.length + 1
              ln = word2
              ly += lineHeight
              if (ly > drawY + drawH - 30) break
            } else {
              ln = test2
            }
          }
          // If we didn't break early, cursor is on the last line
          if (cursorCharX === 0 && ln) {
            const partial = Math.max(0, revealedChars - ci)
            const partialText = ln.substring(0, Math.min(partial, ln.length))
            const totalLineW = c.measureText(ln).width
            cursorCharX = (w / 2 - totalLineW / 2) + c.measureText(partialText).width
            cursorCharY = ly
          }
        }
      }

      // Draw writing cursor (blinking)
      if (showCursor && cursorCharX > 0) {
        const blink = Math.sin(time * 4) > 0
        if (blink) {
          c.globalAlpha = 0.3
          c.fillStyle = 'rgba(240, 235, 220, 1)'
          c.fillRect(cursorCharX, cursorCharY - 12, 1.5, 16)
        }
      }

      // Draw ink drips
      for (let di = inkDrips.length - 1; di >= 0; di--) {
        const drip = inkDrips[di]
        drip.alpha -= 0.003
        if (drip.alpha <= 0) {
          inkDrips.splice(di, 1)
          continue
        }
        c.globalAlpha = drip.alpha
        c.fillStyle = 'rgba(240, 235, 220, 1)'
        c.fillRect(drip.x, drip.y, 1, drip.length)
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
      c.fillText(failureMessage || 'the gallery is empty tonight', w / 2, h / 2)
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
    _paintX: number,
    _paintW: number,
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

      // Ink drip — ~10% chance per newly revealed character
      if (globalIdx === revealedChars - 1 && Math.random() < 0.10 && char !== ' ') {
        const dripLen = 5 + Math.random() * 10
        inkDrips.push({
          x: x + c.measureText(char).width / 2,
          y: cy + jitter + 2,
          length: dripLen,
          alpha: 0.35,
        })
      }

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
        if (!loading) {
          playClick()
          loadNewPairing()
        }
      })

      canvas.addEventListener('mousemove', handleMouseMove)

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
            font-size: 11px; letter-spacing: 1.5px;
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
      prevTextReveal = 0
      inkDrips.length = 0
      initAudio()
      loadNewPairing()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      fadeAudioOut()
      if (scratchInterval) {
        clearInterval(scratchInterval)
        scratchInterval = null
      }
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      destroyAudio()
      canvas?.removeEventListener('mousemove', handleMouseMove)
      overlay?.remove()
    },
  }
}
