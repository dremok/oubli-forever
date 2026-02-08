/**
 * THE PALIMPSEST GALLERY — your words on borrowed paintings
 *
 * Fetches random public domain artworks from the Metropolitan Museum
 * of Art's Open Access API. Your stored memories are written over
 * the paintings — text layered on images, the way medieval monks
 * scraped old text from parchment to write new text over it.
 *
 * The memory text is HIDDEN beneath the painting. Move your cursor
 * over the surface to scrape away the paint, revealing confessions
 * written underneath. Like Tracey Emin's raw, confessional works —
 * every surface carries the weight of what was written on it.
 *
 * The Met has 470,000+ works in its Open Access program — enough
 * paintings for every memory you'll ever have.
 *
 * Inspired by: palimpsests (reused manuscripts), Cy Twombly's
 * writing-on-painting, Jenny Holzer's projections on buildings,
 * Robert Rauschenberg erasing a de Kooning drawing (1953),
 * Christian Boltanski's archive installations, Tracey Emin's
 * confessional practice and "A Second Life" retrospective (2026),
 * how museums are repositories of other people's memories
 *
 * USES MEMORIES. Art API. Layered meaning. Cursor interaction.
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

interface GallerySlot {
  artwork: Artwork
  image: HTMLImageElement
  memory: Memory | null
}

interface InkDrip {
  x: number
  y: number
  vy: number      // velocity — accelerates with gravity
  length: number
  alpha: number
  trail: number[] // y-positions of permanent trail marks
}

const CULTURAL_INSCRIPTIONS = [
  'palimpsest: a manuscript scraped clean and rewritten. every surface hides an earlier text.',
  'tracey emin\'s "my bed": confession as found object. the mattress remembers what you did.',
  'anti-AI movement 2026: 45% of creative directors reject AI images. the hand is proof.',
  'cy twombly scrawled over classical beauty. vandalism or love letter? both.',
  'the dead sea scrolls: text surviving 2000 years by accident. meaning persists in fragments.',
  'intentional imperfection (2026 trend): scan artifacts, tape marks. proof of human making.',
  'borges\' "library of babel": every possible book already exists. meaning drowns in completeness.',
  'the met has 1.5 million artworks. most are in storage. the gallery is always a palimpsest of omissions.',
  'CRISPR memory reversal: genes that forgot how to remember. the text resurfaces.',
  'gerhard richter paints photographs then scrapes them. the squeegee as editing tool.',
]

export function createPalimpsestGalleryRoom(deps: PalimpsestGalleryDeps): Room {
  let inscriptionTimer = 0
  let inscriptionIdx = 0
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  // Multi-painting gallery state
  let gallerySlots: GallerySlot[] = []
  let activeSlotIndex = 0
  let loading = true
  let pairingsViewed = 0
  let failureMessage = ''

  // Reveal mask — offscreen canvas tracking where cursor has scraped
  let revealMask: HTMLCanvasElement | null = null
  let revealCtx: CanvasRenderingContext2D | null = null
  const BRUSH_RADIUS = 50
  let allTextRevealed = false
  let confessionFlashTime = 0 // when confession started showing
  let confessionShown = false

  // Audio state
  let audioInitialized = false
  let audioMaster: GainNode | null = null
  let ambienceSource: AudioBufferSourceNode | null = null
  let ambienceGain: GainNode | null = null
  let scratchGain: GainNode | null = null
  let scratchLfoGain: GainNode | null = null
  let scratchSource: AudioBufferSourceNode | null = null
  let scratchInterval: ReturnType<typeof setInterval> | null = null

  // Cursor tracking
  let cursorX = 0
  let cursorY = 0
  let prevCursorX = 0
  let prevCursorY = 0
  let cursorSpeed = 0
  let cursorOverPainting = false
  let isScratching = false // cursor is moving over painting

  // Ink drips — now with gravity and trails
  const inkDrips: InkDrip[] = []

  // Painting draw rect — cached for hit testing
  let paintDrawX = 0
  let paintDrawY = 0
  let paintDrawW = 0
  let paintDrawH = 0

  // Character position cache for cursor-based reveal
  interface CharPos {
    x: number
    y: number
    char: string
    globalIdx: number
    width: number
  }
  let charPositions: CharPos[] = []
  let charPositionsDirty = true

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

    const maxAttempts = 5
    const tried = new Set<number>()

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let objectId: number
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

  function loadImage(url: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })
  }

  async function loadSingleSlot(): Promise<GallerySlot | null> {
    const maxRetries = 3
    for (let retry = 0; retry < maxRetries; retry++) {
      const artwork = await fetchRandomArtwork()
      if (!artwork) continue
      const img = await loadImage(artwork.imageUrl)
      if (!img) continue

      const memories = deps.getMemories()
      const memory = memories.length > 0
        ? memories[Math.floor(Math.random() * memories.length)]
        : null

      return { artwork, image: img, memory }
    }
    return null
  }

  async function loadGallery() {
    loading = true
    failureMessage = ''
    gallerySlots = []
    activeSlotIndex = 0

    // Load 3 paintings in parallel
    const results = await Promise.all([
      loadSingleSlot(),
      loadSingleSlot(),
      loadSingleSlot(),
    ])

    for (const r of results) {
      if (r) gallerySlots.push(r)
    }

    if (gallerySlots.length === 0) {
      loading = false
      failureMessage = 'the museum is closed \u2014 the paintings rest behind locked doors'
      pairingsViewed++
      return
    }

    loading = false
    pairingsViewed += gallerySlots.length
    resetRevealMask()
    charPositionsDirty = true
    allTextRevealed = false
    confessionShown = false
    confessionFlashTime = 0
    inkDrips.length = 0
    playChime()
  }

  function selectSlot(index: number) {
    if (index < 0 || index >= gallerySlots.length || index === activeSlotIndex) return
    activeSlotIndex = index
    resetRevealMask()
    charPositionsDirty = true
    allTextRevealed = false
    confessionShown = false
    confessionFlashTime = 0
    inkDrips.length = 0
    playClick()
  }

  function resetRevealMask() {
    if (!revealMask) {
      revealMask = document.createElement('canvas')
    }
    revealMask.width = window.innerWidth
    revealMask.height = window.innerHeight
    revealCtx = revealMask.getContext('2d')
    if (revealCtx) {
      revealCtx.clearRect(0, 0, revealMask.width, revealMask.height)
    }
  }

  function stampRevealBrush(x: number, y: number) {
    if (!revealCtx || !revealMask) return
    // Paint white circle on the reveal mask — white = revealed
    const grad = revealCtx.createRadialGradient(x, y, 0, x, y, BRUSH_RADIUS)
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.4)')
    grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.2)')
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
    revealCtx.fillStyle = grad
    revealCtx.beginPath()
    revealCtx.arc(x, y, BRUSH_RADIUS, 0, Math.PI * 2)
    revealCtx.fill()
  }

  function getRevealAmount(x: number, y: number): number {
    if (!revealCtx || !revealMask) return 0
    // Sample the reveal mask at this position
    try {
      const pixel = revealCtx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data
      // Use the red channel (0-255) as reveal amount (0-1)
      return Math.min(1, pixel[0] / 180)
    } catch {
      return 0
    }
  }

  // Compute character positions for the current memory/painting combo
  function computeCharPositions(c: CanvasRenderingContext2D, drawX: number, drawY: number, drawW: number, drawH: number) {
    charPositions = []
    const slot = gallerySlots[activeSlotIndex]
    if (!slot || !slot.memory) return

    const text = slot.memory.currentText
    const fontSize = Math.min(28, drawW * 0.05)
    c.font = `${fontSize}px "Cormorant Garamond", serif`
    c.textAlign = 'center'

    const words = text.split(' ')
    const maxWidth = drawW * 0.7
    const w = drawX + drawW / 2 // center x in canvas coords
    let line = ''
    let lineY = drawY + drawH * 0.3
    const lineHeight = Math.min(36, drawW * 0.06)
    let charIndex = 0

    const lines: { text: string; y: number; startIdx: number }[] = []

    for (const word of words) {
      const test = line + (line ? ' ' : '') + word
      if (c.measureText(test).width > maxWidth && line) {
        lines.push({ text: line, y: lineY, startIdx: charIndex })
        charIndex += line.length + 1
        line = word
        lineY += lineHeight
        if (lineY > drawY + drawH - 30) break
      } else {
        line = test
      }
    }
    if (line && lineY <= drawY + drawH - 30) {
      lines.push({ text: line, y: lineY, startIdx: charIndex })
    }

    for (const ln of lines) {
      const chars = ln.text.split('')
      const totalWidth = c.measureText(ln.text).width
      let x = w - totalWidth / 2

      for (let i = 0; i < chars.length; i++) {
        const charWidth = c.measureText(chars[i]).width
        charPositions.push({
          x: x + charWidth / 2,
          y: ln.y,
          char: chars[i],
          globalIdx: ln.startIdx + i,
          width: charWidth,
        })
        x += charWidth
      }
    }

    charPositionsDirty = false
  }

  // Check what fraction of all characters are revealed
  function computeRevealFraction(): number {
    if (charPositions.length === 0) return 0
    let revealed = 0
    for (const cp of charPositions) {
      if (cp.char === ' ') { revealed++; continue }
      if (getRevealAmount(cp.x, cp.y) > 0.3) revealed++
    }
    return revealed / charPositions.length
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

      // Scratch/scraping sound — highpass filtered noise, pulsing
      // Driven by cursor movement, not auto-reveal
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
      scratchLfoGain.gain.value = 0

      scratchSource.connect(scratchHipass)
      scratchHipass.connect(scratchGain)
      scratchGain.connect(scratchLfoGain)
      scratchLfoGain.connect(audioMaster)
      scratchSource.start()

      // Pulse the scratch LFO gain at ~10Hz
      let lfoPhase = 0
      scratchInterval = setInterval(() => {
        if (!scratchLfoGain) return
        lfoPhase += 0.1 * Math.PI * 2
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

  function updateScratchAudio() {
    if (!scratchGain) return
    // Volume proportional to cursor speed when scratching over painting
    if (isScratching && cursorSpeed > 0.5) {
      // Map speed (0-30) to volume (0-0.04), clamped
      const vol = Math.min(0.04, cursorSpeed * 0.0015)
      scratchGain.gain.value = vol
    } else {
      // Decay smoothly
      scratchGain.gain.value *= 0.85
      if (scratchGain.gain.value < 0.0001) scratchGain.gain.value = 0
    }
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
    prevCursorX = cursorX
    prevCursorY = cursorY
    cursorX = e.clientX
    cursorY = e.clientY

    const dx = cursorX - prevCursorX
    const dy = cursorY - prevCursorY
    cursorSpeed = Math.sqrt(dx * dx + dy * dy)

    // Check if cursor is over the painting area
    cursorOverPainting = (
      cursorX >= paintDrawX && cursorX <= paintDrawX + paintDrawW &&
      cursorY >= paintDrawY && cursorY <= paintDrawY + paintDrawH
    )

    // Stamp reveal brush when cursor is over painting
    if (cursorOverPainting && gallerySlots[activeSlotIndex]?.memory) {
      isScratching = true

      // Interpolate between prev and current for smooth strokes
      const steps = Math.max(1, Math.floor(cursorSpeed / 5))
      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        const ix = prevCursorX + (cursorX - prevCursorX) * t
        const iy = prevCursorY + (cursorY - prevCursorY) * t
        stampRevealBrush(ix, iy)
      }

      // Spawn ink drips from nearby revealed characters
      if (cursorSpeed > 2) {
        for (const cp of charPositions) {
          if (cp.char === ' ') continue
          const cdx = cp.x - cursorX
          const cdy = cp.y - cursorY
          const dist = Math.sqrt(cdx * cdx + cdy * cdy)
          if (dist < BRUSH_RADIUS * 0.7 && Math.random() < 0.03) {
            inkDrips.push({
              x: cp.x + (Math.random() - 0.5) * 4,
              y: cp.y + 4,
              vy: 0.2 + Math.random() * 0.3,
              length: 2 + Math.random() * 4,
              alpha: 0.3 + Math.random() * 0.15,
              trail: [],
            })
          }
        }
      }
    } else {
      isScratching = false
    }
  }

  function handleClick(e: MouseEvent) {
    const x = e.clientX
    const y = e.clientY

    // Check if click is on a thumbnail
    if (gallerySlots.length > 1 && canvas) {
      const thumbY = canvas.height - 90
      const thumbSize = 60
      const totalThumbW = gallerySlots.length * (thumbSize + 10) - 10
      const thumbStartX = (canvas.width - totalThumbW) / 2

      for (let i = 0; i < gallerySlots.length; i++) {
        const tx = thumbStartX + i * (thumbSize + 10)
        if (x >= tx && x <= tx + thumbSize && y >= thumbY && y <= thumbY + thumbSize) {
          selectSlot(i)
          return
        }
      }
    }

    // Otherwise reload gallery
    if (!loading) {
      playClick()
      loadGallery()
    }
  }

  // --- Drawing helpers ---

  function drawPaintingDistortion(
    c: CanvasRenderingContext2D,
    img: HTMLImageElement,
    dx: number, dy: number, dw: number, dh: number,
    degradation: number,
    paintingAlpha: number,
  ) {
    if (degradation <= 0.5) {
      // No distortion — draw normally
      c.globalAlpha = paintingAlpha
      c.drawImage(img, dx, dy, dw, dh)
      return
    }

    // Distortion intensity scales from 0 at deg=0.5 to 1 at deg=1
    const intensity = (degradation - 0.5) * 2

    // Base image (slightly desaturated)
    c.globalAlpha = paintingAlpha
    c.drawImage(img, dx, dy, dw, dh)

    // RGB channel separation — draw red and blue channels offset
    const offset = intensity * 4 // 0-4px offset

    // Red channel shift
    c.globalCompositeOperation = 'lighter'
    c.globalAlpha = intensity * 0.15
    c.drawImage(img, dx - offset, dy, dw, dh)

    // Blue channel shift
    c.globalAlpha = intensity * 0.12
    c.drawImage(img, dx + offset, dy + offset * 0.5, dw, dh)

    c.globalCompositeOperation = 'source-over'

    // Crack lines for heavily degraded memories
    if (intensity > 0.3) {
      c.globalAlpha = intensity * 0.2
      c.strokeStyle = 'rgba(30, 20, 10, 1)'
      c.lineWidth = 0.5

      // Deterministic cracks based on degradation
      const seed = degradation * 1000
      const numCracks = Math.floor(intensity * 8)
      for (let i = 0; i < numCracks; i++) {
        const startX = dx + (Math.sin(seed + i * 3.7) * 0.5 + 0.5) * dw
        const startY = dy + (Math.cos(seed + i * 2.3) * 0.5 + 0.5) * dh
        c.beginPath()
        c.moveTo(startX, startY)

        let cx = startX
        let cy = startY
        const segments = 3 + Math.floor(intensity * 5)
        for (let s = 0; s < segments; s++) {
          cx += (Math.sin(seed + i * 7 + s * 13) * 15) * intensity
          cy += (Math.cos(seed + i * 11 + s * 17) * 10 + 5) * intensity
          c.lineTo(cx, cy)
        }
        c.stroke()
      }
    }

    c.globalAlpha = 1
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
      c.font = '12px "Cormorant Garamond", serif'
      c.fillStyle = `rgba(200, 180, 140, ${0.1 + Math.sin(time * 2) * 0.05})`
      c.textAlign = 'center'
      c.fillText('finding paintings...', w / 2, h / 2)
    } else if (gallerySlots.length > 0) {
      const slot = gallerySlots[activeSlotIndex]
      if (!slot) return

      const img = slot.image
      const mem = slot.memory
      const degradation = mem ? mem.degradation : 0

      // Calculate image display size — leave room for thumbnails at bottom
      const maxW = w * 0.7
      const maxH = h * 0.55
      const imgAspect = img.width / img.height
      let drawW: number, drawH: number

      if (imgAspect > maxW / maxH) {
        drawW = maxW
        drawH = maxW / imgAspect
      } else {
        drawH = maxH
        drawW = maxH * imgAspect
      }

      const drawX = (w - drawW) / 2
      const drawY = (h - drawH) / 2 - 50

      // Cache paint rect for hit testing
      paintDrawX = drawX
      paintDrawY = drawY
      paintDrawW = drawW
      paintDrawH = drawH

      c.save()

      // Subtle frame
      c.strokeStyle = 'rgba(80, 60, 40, 0.2)'
      c.lineWidth = 3
      c.strokeRect(drawX - 5, drawY - 5, drawW + 10, drawH + 10)

      // Breathing painting — subtle opacity oscillation
      const breathAlpha = 0.70 + Math.sin(time * 0.6) * 0.02
      const paintingAlpha = cursorOverPainting ? Math.min(breathAlpha + 0.08, 0.85) : breathAlpha

      // Draw painting with distortion for degraded memories
      drawPaintingDistortion(c, img, drawX, drawY, drawW, drawH, degradation, paintingAlpha)

      // Vignette
      c.globalAlpha = 1
      const vigGrad = c.createRadialGradient(
        drawX + drawW / 2, drawY + drawH / 2, Math.min(drawW, drawH) * 0.3,
        drawX + drawW / 2, drawY + drawH / 2, Math.max(drawW, drawH) * 0.7,
      )
      vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)')
      vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.15)')
      c.fillStyle = vigGrad
      c.fillRect(drawX, drawY, drawW, drawH)

      // --- Cursor-driven text reveal ---
      if (mem) {
        // Recompute char positions if needed
        if (charPositionsDirty) {
          computeCharPositions(c, drawX, drawY, drawW, drawH)
        }

        const fontSize = Math.min(28, drawW * 0.05)
        c.font = `${fontSize}px "Cormorant Garamond", serif`
        c.textAlign = 'left'

        // Draw each character based on reveal mask
        for (const cp of charPositions) {
          if (cp.char === ' ') continue

          const revealAmt = getRevealAmount(cp.x, cp.y)
          if (revealAmt < 0.05) continue

          // Degraded characters become glitchy
          let ch = cp.char
          if (degradation > 0.3 && Math.random() < (degradation - 0.3) * 0.15) {
            ch = ' '
          }

          // Ghostly white text with breathing
          const breathe = Math.sin(time * 0.8 + cp.globalIdx * 0.3) * 0.05
          const baseAlpha = 0.5 - degradation * 0.3 + breathe
          const alpha = baseAlpha * Math.min(1, revealAmt * 2)

          c.fillStyle = `rgba(240, 235, 220, ${Math.max(0, alpha)})`

          // Slight vertical jitter for handwritten feel
          const jitter = Math.sin(cp.globalIdx * 7.3) * 1.5

          c.fillText(ch, cp.x - cp.width / 2, cp.y + jitter)
        }

        // Update scratch audio
        updateScratchAudio()

        // Check if all text revealed
        if (!allTextRevealed) {
          const fraction = computeRevealFraction()
          if (fraction > 0.92) {
            allTextRevealed = true
            confessionFlashTime = time
          }
        }

        // Emin confession flash
        if (allTextRevealed && !confessionShown) {
          const elapsed = time - confessionFlashTime
          if (elapsed < 6) {
            // Fade in over 1s, hold for 3s, fade out over 2s
            let alpha = 0
            if (elapsed < 1) {
              alpha = elapsed * 0.18
            } else if (elapsed < 4) {
              alpha = 0.18
            } else {
              alpha = 0.18 * (1 - (elapsed - 4) / 2)
            }

            c.font = '11px "Cormorant Garamond", serif'
            c.fillStyle = `rgba(220, 200, 170, ${Math.max(0, alpha)})`
            c.textAlign = 'center'
            c.fillText(
              'every surface carries the weight of confession',
              w / 2,
              drawY + drawH + 70,
            )
            c.font = '10px "Cormorant Garamond", serif'
            c.fillStyle = `rgba(220, 200, 170, ${Math.max(0, alpha * 0.6)})`
            c.fillText(
              '\u2014 after Emin, 2026',
              w / 2,
              drawY + drawH + 84,
            )
          } else {
            confessionShown = true
          }
        }
      }

      // Draw cursor brush indicator when over painting
      if (cursorOverPainting && mem) {
        c.globalAlpha = 0.06
        c.strokeStyle = 'rgba(240, 235, 220, 1)'
        c.lineWidth = 0.5
        c.beginPath()
        c.arc(cursorX, cursorY, BRUSH_RADIUS, 0, Math.PI * 2)
        c.stroke()
        c.globalAlpha = 1
      }

      // Draw ink drips — with gravity acceleration and permanent trails
      for (let di = inkDrips.length - 1; di >= 0; di--) {
        const drip = inkDrips[di]

        // Gravity acceleration
        drip.vy += 0.04
        drip.y += drip.vy
        drip.alpha -= 0.002

        // Leave trail mark every few pixels
        if (drip.trail.length === 0 || drip.y - drip.trail[drip.trail.length - 1] > 3) {
          drip.trail.push(drip.y)
        }

        // Remove if off painting or faded
        if (drip.alpha <= 0 || drip.y > paintDrawY + paintDrawH + 20) {
          // Keep trails as permanent marks — draw them one last time
          inkDrips.splice(di, 1)
          continue
        }

        // Draw drip head
        c.globalAlpha = drip.alpha
        c.fillStyle = 'rgba(240, 235, 220, 1)'
        c.fillRect(drip.x - 0.5, drip.y, 1, drip.length)

        // Draw trail
        for (let ti = 0; ti < drip.trail.length; ti++) {
          const trailAlpha = drip.alpha * (0.3 - ti * 0.01)
          if (trailAlpha <= 0) continue
          c.globalAlpha = Math.max(0, trailAlpha)
          c.fillRect(drip.x - 0.3, drip.trail[ti], 0.6, 2)
        }
      }

      c.restore()

      // Artwork info — below the painting
      if (slot.artwork) {
        c.font = '12px "Cormorant Garamond", serif'
        c.fillStyle = 'rgba(200, 180, 140, 0.15)'
        c.textAlign = 'center'
        c.fillText(slot.artwork.title, w / 2, drawY + drawH + 25)

        c.font = '12px "Cormorant Garamond", serif'
        c.fillStyle = 'rgba(200, 180, 140, 0.1)'
        c.fillText(
          `${slot.artwork.artist}${slot.artwork.date ? `, ${slot.artwork.date}` : ''}`,
          w / 2, drawY + drawH + 40,
        )

        c.font = '11px monospace'
        c.fillStyle = 'rgba(200, 180, 140, 0.05)'
        c.fillText('The Metropolitan Museum of Art, Open Access', w / 2, drawY + drawH + 55)
      }

      // --- Thumbnail gallery at bottom ---
      if (gallerySlots.length > 1) {
        const thumbSize = 60
        const thumbGap = 10
        const totalThumbW = gallerySlots.length * (thumbSize + thumbGap) - thumbGap
        const thumbStartX = (w - totalThumbW) / 2
        const thumbY = h - 90

        for (let i = 0; i < gallerySlots.length; i++) {
          const tx = thumbStartX + i * (thumbSize + thumbGap)
          const isActive = i === activeSlotIndex
          const thumbImg = gallerySlots[i].image

          // Thumbnail border
          c.strokeStyle = isActive
            ? 'rgba(240, 235, 220, 0.3)'
            : 'rgba(80, 60, 40, 0.15)'
          c.lineWidth = isActive ? 2 : 1
          c.strokeRect(tx - 1, thumbY - 1, thumbSize + 2, thumbSize + 2)

          // Thumbnail image — fit cover
          const tAspect = thumbImg.width / thumbImg.height
          let sx = 0, sy = 0, sw = thumbImg.width, sh = thumbImg.height
          if (tAspect > 1) {
            sx = (thumbImg.width - thumbImg.height) / 2
            sw = thumbImg.height
          } else {
            sy = (thumbImg.height - thumbImg.width) / 2
            sh = thumbImg.width
          }

          c.globalAlpha = isActive ? 0.7 : 0.3
          c.drawImage(thumbImg, sx, sy, sw, sh, tx, thumbY, thumbSize, thumbSize)
          c.globalAlpha = 1

          // Dot indicator for which has memory
          if (gallerySlots[i].memory) {
            c.fillStyle = 'rgba(240, 235, 220, 0.2)'
            c.beginPath()
            c.arc(tx + thumbSize / 2, thumbY + thumbSize + 6, 2, 0, Math.PI * 2)
            c.fill()
          }
        }
      }

    } else if (!loading) {
      c.font = '13px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(200, 180, 140, 0.1)'
      c.textAlign = 'center'
      c.fillText(failureMessage || 'the gallery is empty tonight', w / 2, h / 2)
      c.font = '12px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(200, 180, 140, 0.06)'
      c.fillText('click to try again', w / 2, h / 2 + 20)
    }

    // Title
    c.font = '12px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 180, 140, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.fillText('the palimpsest gallery', w / 2, 25)

    // Hint — changes based on state
    c.font = '12px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 180, 140, ${0.04 + Math.sin(time * 1.5) * 0.02})`
    c.textAlign = 'center'
    const hint = gallerySlots[activeSlotIndex]?.memory && !allTextRevealed
      ? 'scrape the surface to reveal what is written beneath'
      : 'click for new paintings'
    c.fillText(hint, w / 2, h - 8)

    // Stats
    c.font = '12px monospace'
    c.fillStyle = 'rgba(200, 180, 140, 0.06)'
    c.textAlign = 'left'
    c.fillText(`${pairingsViewed} pairings`, 12, h - 18)

    // Cultural inscriptions
    inscriptionTimer += 0.016
    if (inscriptionTimer >= 23) {
      inscriptionTimer = 0
      inscriptionIdx = (inscriptionIdx + 1) % CULTURAL_INSCRIPTIONS.length
    }
    const insText = CULTURAL_INSCRIPTIONS[inscriptionIdx]
    c.font = '11px "Cormorant Garamond", serif'
    c.textAlign = 'center'
    c.fillStyle = 'rgba(200, 180, 140, 0.03)'
    const insMaxW = w * 0.75
    const insWords = insText.split(' ')
    const insLines: string[] = []
    let insLine = ''
    for (const word of insWords) {
      const test = insLine ? insLine + ' ' + word : word
      if (c.measureText(test).width > insMaxW) { insLines.push(insLine); insLine = word }
      else insLine = test
    }
    if (insLine) insLines.push(insLine)
    for (let li = 0; li < insLines.length; li++) {
      c.fillText(insLines[li], w / 2, h - 50 + li * 14)
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
      canvas.style.cssText = 'width: 100%; height: 100%; cursor: crosshair;'
      ctx = canvas.getContext('2d')

      canvas.addEventListener('click', handleClick)
      canvas.addEventListener('mousemove', handleMouseMove)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
          resetRevealMask()
          charPositionsDirty = true
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)

      // Navigation portals — small gallery placard text
      if (deps.switchTo) {
        const portalData = [
          { name: 'darkroom', label: 'Gallery A \u2014 The Darkroom', color: '200, 180, 140', pos: 'bottom: 40px; left: 20px;' },
          { name: 'loom', label: 'Gallery B \u2014 The Loom', color: '180, 170, 160', pos: 'bottom: 40px; left: 50%; transform: translateX(-50%);' },
          { name: 'archive', label: 'Gallery C \u2014 The Archive', color: '160, 160, 180', pos: 'bottom: 40px; right: 20px;' },
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
      inkDrips.length = 0
      charPositionsDirty = true
      allTextRevealed = false
      confessionShown = false
      confessionFlashTime = 0
      resetRevealMask()
      initAudio()
      loadGallery()
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
      canvas?.removeEventListener('click', handleClick)
      overlay?.remove()
    },
  }
}
