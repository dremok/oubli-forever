/**
 * THE ARCHIVE — search through the world's library
 *
 * A room that connects to the Open Library Search API to find
 * books across the entirety of recorded human knowledge. You type
 * a subject, title, or author, and the system searches for matching
 * books with their covers, publication dates, and editions.
 *
 * Results are displayed as archival cards showing:
 * - The book cover image
 * - Title and author
 * - First publication year
 * - Edition count and subjects
 *
 * The aesthetic is a filing cabinet / card catalog in a dusty library.
 * Sepia tones, typewriter font for metadata, faded paper textures.
 *
 * Atmosphere:
 * - Audio: Cathedral-sized library drone, page rustles, distant footsteps,
 *   whispering catalogue hum, shelf-sliding on new results
 * - Cursor: Ink-ripple effects — dark circles spreading where the cursor moves
 * - Visual: Floating dust motes in golden light, flickering distant lights,
 *   deep vignette suggesting infinite receding shelves
 *
 * Inspired by: Borges' Library of Babel, the archive as memory palace,
 * Open Library's mission to catalog every book ever published
 */

import type { Room } from './RoomManager'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface BookResult {
  title: string
  author: string
  firstPublishYear: number | null
  coverId: number | null
  key: string
  editionCount: number
  pageCount: number | null
  subjects: string[]
}

interface ArchiveDeps {
  onDescend?: () => void
  switchTo?: (name: string) => void
}

export function createArchiveRoom(deps?: ArchiveDeps): Room {
  let overlay: HTMLElement | null = null
  let active = false
  let searching = false
  let searchCount = 0

  // ── Visual atmosphere state ──
  let effectCanvas: HTMLCanvasElement | null = null
  let effectCtx: CanvasRenderingContext2D | null = null
  let frameId = 0
  let mouseX = -1000
  let mouseY = -1000
  let lastMouseX = -1000
  let lastMouseY = -1000
  let mouseSpeed = 0

  interface InkRipple {
    x: number; y: number; radius: number; maxRadius: number; alpha: number
  }
  const inkRipples: InkRipple[] = []

  interface DustMote {
    x: number; y: number; vx: number; vy: number
    size: number; alpha: number; baseAlpha: number
    drift: number; driftSpeed: number
  }
  const dustMotes: DustMote[] = []

  interface DistantLight {
    x: number; y: number; radius: number
    alpha: number; baseAlpha: number; flickerSpeed: number; flickerPhase: number
  }
  const distantLights: DistantLight[] = []

  let resizeHandler: (() => void) | null = null
  let mouseMoveHandler: ((e: MouseEvent) => void) | null = null

  // ── Audio state ──
  let audioInitialized = false
  let audioMaster: GainNode | null = null
  let droneOsc: OscillatorNode | null = null
  let droneOsc2: OscillatorNode | null = null
  let droneGain: GainNode | null = null
  let humOsc: OscillatorNode | null = null
  let humGain: GainNode | null = null
  let rustleInterval: ReturnType<typeof setInterval> | null = null
  let footstepInterval: ReturnType<typeof setInterval> | null = null
  let reverbDelay: DelayNode | null = null
  let reverbFeedback: GainNode | null = null
  let reverbWet: GainNode | null = null

  // ── Audio initialization ──
  async function initAudio() {
    if (audioInitialized) return
    try {
      const ac = await getAudioContext()
      const dest = getAudioDestination()

      audioMaster = ac.createGain()
      audioMaster.gain.value = 0
      audioMaster.connect(dest)

      // Cathedral reverb via delay + feedback
      reverbDelay = ac.createDelay(1.0)
      reverbDelay.delayTime.value = 0.6
      reverbFeedback = ac.createGain()
      reverbFeedback.gain.value = 0.4
      reverbWet = ac.createGain()
      reverbWet.gain.value = 0.3
      reverbDelay.connect(reverbFeedback)
      reverbFeedback.connect(reverbDelay)
      reverbDelay.connect(reverbWet)
      reverbWet.connect(audioMaster)

      // Low drone — vast space hum (triangle ~55Hz + sine ~82Hz for depth)
      droneGain = ac.createGain()
      droneGain.gain.value = 0
      droneGain.connect(audioMaster)
      droneGain.connect(reverbDelay)

      droneOsc = ac.createOscillator()
      droneOsc.type = 'triangle'
      droneOsc.frequency.value = 55
      droneOsc.connect(droneGain)
      droneOsc.start()

      droneOsc2 = ac.createOscillator()
      droneOsc2.type = 'sine'
      droneOsc2.frequency.value = 82.5
      const drone2Gain = ac.createGain()
      drone2Gain.gain.value = 0.4
      droneOsc2.connect(drone2Gain)
      drone2Gain.connect(droneGain)
      droneOsc2.start()

      // Whispering catalogue hum — very high, barely audible sine
      humGain = ac.createGain()
      humGain.gain.value = 0
      humGain.connect(audioMaster)

      humOsc = ac.createOscillator()
      humOsc.type = 'sine'
      humOsc.frequency.value = 2200
      const humFilter = ac.createBiquadFilter()
      humFilter.type = 'bandpass'
      humFilter.frequency.value = 2200
      humFilter.Q.value = 20
      humOsc.connect(humFilter)
      humFilter.connect(humGain)
      humOsc.start()

      audioInitialized = true

      // Fade in master
      const now = ac.currentTime
      audioMaster.gain.setValueAtTime(0, now)
      audioMaster.gain.linearRampToValueAtTime(1, now + 3)

      // Fade drone in
      droneGain.gain.setValueAtTime(0, now)
      droneGain.gain.linearRampToValueAtTime(0.025, now + 4)

      // Fade catalogue hum in
      humGain.gain.setValueAtTime(0, now)
      humGain.gain.linearRampToValueAtTime(0.004, now + 5)

      // Page rustles — filtered noise bursts at random intervals
      startPageRustles(ac)
      // Distant footsteps
      startFootsteps(ac)
    } catch {
      // Audio not available — degrade gracefully
    }
  }

  function startPageRustles(ac: AudioContext) {
    if (rustleInterval) clearInterval(rustleInterval)
    const scheduleNext = () => {
      const delay = 3000 + Math.random() * 8000
      rustleInterval = setTimeout(() => {
        if (!active || !audioMaster) return
        playPageRustle(ac)
        scheduleNext()
      }, delay) as unknown as ReturnType<typeof setInterval>
    }
    scheduleNext()
  }

  function playPageRustle(ac: AudioContext) {
    if (!audioMaster) return
    try {
      const now = ac.currentTime
      // White noise burst shaped to sound like paper
      const bufferSize = ac.sampleRate * 0.15
      const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
      }
      const source = ac.createBufferSource()
      source.buffer = buffer

      const filter = ac.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 3000 + Math.random() * 2000
      filter.Q.value = 0.8

      const gain = ac.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.015 + Math.random() * 0.01, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)

      source.connect(filter)
      filter.connect(gain)
      gain.connect(audioMaster)
      if (reverbDelay) gain.connect(reverbDelay)
      source.start(now)
      source.onended = () => {
        source.disconnect()
        filter.disconnect()
        gain.disconnect()
      }
    } catch { /* ignore */ }
  }

  function startFootsteps(ac: AudioContext) {
    if (footstepInterval) clearInterval(footstepInterval)
    const scheduleNext = () => {
      const delay = 5000 + Math.random() * 12000
      footstepInterval = setTimeout(() => {
        if (!active || !audioMaster) return
        playFootstep(ac)
        // Sometimes play a second step shortly after
        if (Math.random() < 0.6) {
          setTimeout(() => {
            if (active && audioMaster) playFootstep(ac)
          }, 400 + Math.random() * 200)
        }
        scheduleNext()
      }, delay) as unknown as ReturnType<typeof setInterval>
    }
    scheduleNext()
  }

  function playFootstep(ac: AudioContext) {
    if (!audioMaster) return
    try {
      const now = ac.currentTime
      // Short low thud — filtered noise
      const bufferSize = ac.sampleRate * 0.08
      const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2))
      }
      const source = ac.createBufferSource()
      source.buffer = buffer

      const filter = ac.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 200 + Math.random() * 100
      filter.Q.value = 1

      const gain = ac.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.008 + Math.random() * 0.006, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

      source.connect(filter)
      filter.connect(gain)
      gain.connect(audioMaster)
      if (reverbDelay) gain.connect(reverbDelay) // reverb makes it sound distant
      source.start(now)
      source.onended = () => {
        source.disconnect()
        filter.disconnect()
        gain.disconnect()
      }
    } catch { /* ignore */ }
  }

  function playShelfSlide() {
    if (!audioInitialized || !audioMaster) return
    try {
      const ac = audioMaster.context as AudioContext
      const now = ac.currentTime

      // Shelf sliding: filtered noise sweep (low to mid)
      const bufferSize = ac.sampleRate * 0.4
      const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - (i / bufferSize) * 0.7)
      }
      const source = ac.createBufferSource()
      source.buffer = buffer

      const filter = ac.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(400, now)
      filter.frequency.linearRampToValueAtTime(1200, now + 0.15)
      filter.frequency.linearRampToValueAtTime(600, now + 0.4)
      filter.Q.value = 1.5

      const gain = ac.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.012, now + 0.05)
      gain.gain.linearRampToValueAtTime(0.008, now + 0.2)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)

      source.connect(filter)
      filter.connect(gain)
      gain.connect(audioMaster)
      if (reverbDelay) gain.connect(reverbDelay)
      source.start(now)
      source.onended = () => {
        source.disconnect()
        filter.disconnect()
        gain.disconnect()
      }
    } catch { /* ignore */ }
  }

  function fadeAudioOut() {
    if (!audioMaster) return
    try {
      const ac = audioMaster.context as AudioContext
      const now = ac.currentTime
      audioMaster.gain.cancelScheduledValues(now)
      audioMaster.gain.setValueAtTime(audioMaster.gain.value, now)
      audioMaster.gain.linearRampToValueAtTime(0, now + 0.5)
    } catch { /* ignore */ }
  }

  function destroyAudio() {
    fadeAudioOut()
    if (rustleInterval) {
      clearTimeout(rustleInterval as unknown as number)
      rustleInterval = null
    }
    if (footstepInterval) {
      clearTimeout(footstepInterval as unknown as number)
      footstepInterval = null
    }
    setTimeout(() => {
      try { droneOsc?.stop() } catch { /* */ }
      try { droneOsc2?.stop() } catch { /* */ }
      try { humOsc?.stop() } catch { /* */ }
      droneOsc?.disconnect()
      droneOsc2?.disconnect()
      droneGain?.disconnect()
      humOsc?.disconnect()
      humGain?.disconnect()
      reverbDelay?.disconnect()
      reverbFeedback?.disconnect()
      reverbWet?.disconnect()
      audioMaster?.disconnect()
      droneOsc = null
      droneOsc2 = null
      droneGain = null
      humOsc = null
      humGain = null
      reverbDelay = null
      reverbFeedback = null
      reverbWet = null
      audioMaster = null
      audioInitialized = false
    }, 600)
  }

  // ── Visual atmosphere helpers ──
  function initDustMotes() {
    dustMotes.length = 0
    const w = effectCanvas?.width || window.innerWidth
    const h = effectCanvas?.height || window.innerHeight
    for (let i = 0; i < 60; i++) {
      dustMotes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -0.1 - Math.random() * 0.2, // drift upward slowly
        size: 0.5 + Math.random() * 1.5,
        alpha: 0,
        baseAlpha: 0.15 + Math.random() * 0.25,
        drift: Math.random() * Math.PI * 2,
        driftSpeed: 0.003 + Math.random() * 0.005,
      })
    }
  }

  function initDistantLights() {
    distantLights.length = 0
    const w = effectCanvas?.width || window.innerWidth
    const h = effectCanvas?.height || window.innerHeight
    // Lights along edges and corners — suggesting infinite corridors
    const positions = [
      { x: w * 0.05, y: h * 0.15 },
      { x: w * 0.95, y: h * 0.25 },
      { x: w * 0.02, y: h * 0.65 },
      { x: w * 0.98, y: h * 0.75 },
      { x: w * 0.08, y: h * 0.9 },
      { x: w * 0.92, y: h * 0.1 },
    ]
    for (const pos of positions) {
      distantLights.push({
        x: pos.x,
        y: pos.y,
        radius: 40 + Math.random() * 60,
        alpha: 0,
        baseAlpha: 0.03 + Math.random() * 0.04,
        flickerSpeed: 0.5 + Math.random() * 1.5,
        flickerPhase: Math.random() * Math.PI * 2,
      })
    }
  }

  function drawEffects(time: number) {
    if (!effectCtx || !effectCanvas || !active) return
    const w = effectCanvas.width
    const h = effectCanvas.height
    effectCtx.clearRect(0, 0, w, h)

    // ── Vignette — deep darkness at edges suggesting infinite shelves ──
    const vigGrad = effectCtx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.75)
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)')
    vigGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.15)')
    vigGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.5)')
    vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.75)')
    effectCtx.fillStyle = vigGrad
    effectCtx.fillRect(0, 0, w, h)

    // ── Distant flickering lights ──
    for (const light of distantLights) {
      const flicker = Math.sin(time * light.flickerSpeed + light.flickerPhase)
      const flicker2 = Math.sin(time * light.flickerSpeed * 1.7 + light.flickerPhase * 0.5)
      light.alpha = light.baseAlpha * (0.5 + 0.3 * flicker + 0.2 * flicker2)
      // Occasional stronger flicker
      if (Math.random() < 0.002) light.alpha *= 2.5

      if (light.alpha > 0.005) {
        const grad = effectCtx.createRadialGradient(
          light.x, light.y, 0, light.x, light.y, light.radius
        )
        grad.addColorStop(0, `rgba(200, 170, 100, ${light.alpha})`)
        grad.addColorStop(0.4, `rgba(180, 150, 80, ${light.alpha * 0.4})`)
        grad.addColorStop(1, 'rgba(180, 150, 80, 0)')
        effectCtx.fillStyle = grad
        effectCtx.fillRect(
          light.x - light.radius, light.y - light.radius,
          light.radius * 2, light.radius * 2
        )
      }
    }

    // ── Dust motes — golden-brown particles drifting in library light ──
    for (const mote of dustMotes) {
      mote.drift += mote.driftSpeed
      mote.x += mote.vx + Math.sin(mote.drift) * 0.1
      mote.y += mote.vy

      // Wrap around
      if (mote.y < -5) { mote.y = h + 5; mote.x = Math.random() * w }
      if (mote.x < -5) mote.x = w + 5
      if (mote.x > w + 5) mote.x = -5

      // Glow brighter when near mouse (like catching light)
      const dx = mote.x - mouseX
      const dy = mote.y - mouseY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const nearCursor = dist < 120 ? (1 - dist / 120) * 0.3 : 0
      mote.alpha += ((mote.baseAlpha + nearCursor) - mote.alpha) * 0.05

      if (mote.alpha > 0.02) {
        effectCtx.beginPath()
        effectCtx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2)
        effectCtx.fillStyle = `rgba(200, 175, 120, ${mote.alpha})`
        effectCtx.fill()

        // Tiny glow around bright motes
        if (mote.alpha > 0.2) {
          effectCtx.beginPath()
          effectCtx.arc(mote.x, mote.y, mote.size * 3, 0, Math.PI * 2)
          effectCtx.fillStyle = `rgba(200, 175, 120, ${mote.alpha * 0.1})`
          effectCtx.fill()
        }
      }
    }

    // ── Ink ripples — dark spreading circles where cursor moves ──
    // Spawn new ripples based on mouse speed
    if (mouseSpeed > 2 && mouseX > 0 && mouseY > 0) {
      const spawnChance = Math.min(mouseSpeed / 30, 0.6)
      if (Math.random() < spawnChance) {
        inkRipples.push({
          x: mouseX + (Math.random() - 0.5) * 10,
          y: mouseY + (Math.random() - 0.5) * 10,
          radius: 2,
          maxRadius: 30 + Math.random() * 40,
          alpha: 0.15 + Math.random() * 0.1,
        })
      }
    }

    // Draw and update ripples
    for (let i = inkRipples.length - 1; i >= 0; i--) {
      const r = inkRipples[i]
      r.radius += 0.8
      r.alpha *= 0.975

      if (r.alpha < 0.005 || r.radius > r.maxRadius) {
        inkRipples.splice(i, 1)
        continue
      }

      effectCtx.beginPath()
      effectCtx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
      effectCtx.strokeStyle = `rgba(20, 15, 10, ${r.alpha})`
      effectCtx.lineWidth = 1.5
      effectCtx.stroke()

      // Inner darker fill that fades quickly
      if (r.alpha > 0.08) {
        effectCtx.beginPath()
        effectCtx.arc(r.x, r.y, r.radius * 0.6, 0, Math.PI * 2)
        effectCtx.fillStyle = `rgba(15, 10, 5, ${r.alpha * 0.3})`
        effectCtx.fill()
      }
    }

    // ── Light beam near center — subtle warm glow suggesting a distant reading lamp ──
    const beamAlpha = 0.02 + Math.sin(time * 0.3) * 0.008
    const beamGrad = effectCtx.createRadialGradient(w * 0.5, h * 0.05, 0, w * 0.5, h * 0.05, h * 0.6)
    beamGrad.addColorStop(0, `rgba(200, 170, 100, ${beamAlpha})`)
    beamGrad.addColorStop(0.3, `rgba(180, 150, 80, ${beamAlpha * 0.3})`)
    beamGrad.addColorStop(1, 'rgba(180, 150, 80, 0)')
    effectCtx.fillStyle = beamGrad
    effectCtx.fillRect(0, 0, w, h * 0.7)
  }

  function animationLoop(timestamp: number) {
    if (!active) return
    const t = timestamp * 0.001 // seconds

    // Track mouse speed
    const dx = mouseX - lastMouseX
    const dy = mouseY - lastMouseY
    mouseSpeed = Math.sqrt(dx * dx + dy * dy)
    lastMouseX = mouseX
    lastMouseY = mouseY

    drawEffects(t)
    frameId = requestAnimationFrame(animationLoop)
  }

  async function searchBooks(query: string): Promise<BookResult[]> {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=20`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)
      if (!response.ok) return []

      const json = await response.json()
      const docs: any[] = json.docs || []

      return docs.map((doc: any) => ({
        title: doc.title || 'Untitled',
        author: Array.isArray(doc.author_name) ? doc.author_name[0] || 'Unknown' : 'Unknown',
        firstPublishYear: typeof doc.first_publish_year === 'number' ? doc.first_publish_year : null,
        coverId: typeof doc.cover_i === 'number' ? doc.cover_i : null,
        key: doc.key || '',
        editionCount: typeof doc.edition_count === 'number' ? doc.edition_count : 0,
        pageCount: typeof doc.number_of_pages_median === 'number' ? doc.number_of_pages_median : null,
        subjects: Array.isArray(doc.subject) ? doc.subject.slice(0, 4) : [],
      }))
    } catch (err) {
      clearTimeout(timeoutId)
      throw err
    }
  }

  function renderResults(books: BookResult[], container: HTMLElement, statusEl: HTMLElement) {
    container.innerHTML = ''

    if (books.length === 0) {
      statusEl.textContent = 'nothing found in the archive. the shelves are bare.'
      return
    }

    statusEl.textContent = `${books.length} books unearthed`

    // Shelf-slide sound when results appear
    playShelfSlide()

    for (const book of books) {
      const card = document.createElement('div')
      card.style.cssText = `
        background: rgba(40, 30, 20, 0.3);
        border: 1px solid rgba(180, 160, 120, 0.08);
        padding: 14px 18px;
        margin-bottom: 8px;
        transition: border-color 0.3s ease, background 0.3s ease;
        cursor: pointer;
        display: flex;
        gap: 14px;
        align-items: flex-start;
      `
      card.addEventListener('mouseenter', () => {
        card.style.borderColor = 'rgba(180, 160, 120, 0.25)'
        card.style.background = 'rgba(40, 30, 20, 0.5)'
      })
      card.addEventListener('mouseleave', () => {
        card.style.borderColor = 'rgba(180, 160, 120, 0.08)'
        card.style.background = 'rgba(40, 30, 20, 0.3)'
      })

      // Cover image
      if (book.coverId) {
        const img = document.createElement('img')
        img.src = `https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg`
        img.alt = book.title
        img.style.cssText = `
          width: 50px;
          min-width: 50px;
          height: 72px;
          object-fit: cover;
          opacity: 0.7;
          filter: sepia(0.4);
          border: 1px solid rgba(180, 160, 120, 0.1);
        `
        img.addEventListener('error', () => { img.style.display = 'none' })
        card.appendChild(img)
      }

      // Text content
      const textCol = document.createElement('div')
      textCol.style.cssText = `flex: 1; min-width: 0;`

      // Title
      const titleEl = document.createElement('div')
      titleEl.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-size: 14px;
        color: rgba(180, 160, 120, 0.6);
        margin-bottom: 4px;
        line-height: 1.3;
      `
      titleEl.textContent = book.title
      textCol.appendChild(titleEl)

      // Author
      const authorEl = document.createElement('div')
      authorEl.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-size: 12px; font-style: italic;
        color: rgba(180, 160, 120, 0.35);
        margin-bottom: 4px;
      `
      authorEl.textContent = book.author
      textCol.appendChild(authorEl)

      // Meta line: year, editions, pages
      const meta = document.createElement('div')
      meta.style.cssText = `
        font-family: 'Courier New', monospace;
        font-size: 12px;
        color: rgba(180, 160, 120, 0.2);
        margin-bottom: 4px;
      `
      const parts: string[] = []
      if (book.firstPublishYear) parts.push(`first published ${book.firstPublishYear}`)
      if (book.editionCount > 0) parts.push(`${book.editionCount} edition${book.editionCount === 1 ? '' : 's'}`)
      if (book.pageCount) parts.push(`~${book.pageCount} pages`)
      meta.textContent = parts.join(' \u00b7 ')
      textCol.appendChild(meta)

      // Subjects
      if (book.subjects.length > 0) {
        const subjectsEl = document.createElement('div')
        subjectsEl.style.cssText = `
          font-family: 'Cormorant Garamond', serif;
          font-size: 12px; font-style: italic;
          color: rgba(180, 160, 120, 0.15);
          line-height: 1.4;
        `
        subjectsEl.textContent = book.subjects.join(', ')
        textCol.appendChild(subjectsEl)
      }

      card.appendChild(textCol)

      // Click to open on Open Library
      card.addEventListener('click', () => {
        if (book.key) {
          window.open(`https://openlibrary.org${book.key}`, '_blank')
        }
      })

      container.appendChild(card)
    }
  }

  // Reference to the restricted drawer element for revealing after N searches
  let restrictedDrawer: HTMLElement | null = null

  return {
    name: 'archive',
    label: 'the archive',

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        display: flex; flex-direction: column;
        align-items: center;
        height: 100%;
        pointer-events: auto;
        background: rgba(15, 12, 8, 0.95);
        overflow-y: auto;
        scrollbar-width: none;
      `

      const style = document.createElement('style')
      style.textContent = `
        .archive-scroll::-webkit-scrollbar { display: none; }
      `
      overlay.appendChild(style)
      overlay.classList.add('archive-scroll')

      // Title
      const title = document.createElement('div')
      title.style.cssText = `
        margin-top: 40px;
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 14px;
        color: rgba(180, 160, 120, 0.4);
        letter-spacing: 4px; text-transform: uppercase;
      `
      title.textContent = 'the archive'
      overlay.appendChild(title)

      const sub = document.createElement('div')
      sub.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 12px; font-style: italic;
        color: rgba(180, 160, 120, 0.2);
        margin-top: 6px; margin-bottom: 24px;
        text-align: center; max-width: 400px;
      `
      sub.textContent = 'search through the world\'s library \u2014 every book ever written'
      overlay.appendChild(sub)

      // Search input
      const searchArea = document.createElement('div')
      searchArea.style.cssText = `
        display: flex; gap: 10px; align-items: center;
        width: 480px; max-width: 90vw;
        margin-bottom: 16px;
      `

      const input = document.createElement('input')
      input.type = 'text'
      input.placeholder = 'a title, author, or subject...'
      input.style.cssText = `
        flex: 1;
        background: transparent;
        border: none;
        border-bottom: 1px solid rgba(180, 160, 120, 0.15);
        color: rgba(180, 160, 120, 0.6);
        font-family: 'Courier New', monospace;
        font-size: 13px;
        padding: 10px 0;
        outline: none;
        caret-color: rgba(180, 160, 120, 0.5);
      `

      const searchBtn = document.createElement('button')
      searchBtn.textContent = 'search'
      searchBtn.style.cssText = `
        background: transparent;
        border: 1px solid rgba(180, 160, 120, 0.2);
        color: rgba(180, 160, 120, 0.4);
        font-family: 'Cormorant Garamond', serif;
        font-size: 13px; padding: 6px 20px;
        cursor: pointer; border-radius: 2px;
        letter-spacing: 2px; text-transform: uppercase;
        transition: all 0.3s ease;
      `
      searchBtn.addEventListener('mouseenter', () => {
        searchBtn.style.borderColor = 'rgba(180, 160, 120, 0.5)'
        searchBtn.style.color = 'rgba(180, 160, 120, 0.8)'
      })
      searchBtn.addEventListener('mouseleave', () => {
        searchBtn.style.borderColor = 'rgba(180, 160, 120, 0.2)'
        searchBtn.style.color = 'rgba(180, 160, 120, 0.4)'
      })

      searchArea.appendChild(input)
      searchArea.appendChild(searchBtn)
      overlay.appendChild(searchArea)

      // Status
      const status = document.createElement('div')
      status.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 12px; font-style: italic;
        color: rgba(180, 160, 120, 0.2);
        margin-bottom: 16px;
        min-height: 18px;
      `
      overlay.appendChild(status)

      // Results container
      const results = document.createElement('div')
      results.style.cssText = `
        width: 480px; max-width: 90vw;
        margin-bottom: 40px;
      `
      overlay.appendChild(results)

      // Curated suggestions
      const suggestions = document.createElement('div')
      suggestions.style.cssText = `
        display: flex; flex-wrap: wrap; gap: 8px;
        justify-content: center;
        width: 480px; max-width: 90vw;
        margin-bottom: 24px;
      `

      const curated = [
        'memory', 'forgetting', 'time', 'dreams',
        'loss', 'ruins', 'labyrinth', 'photographs',
      ]

      for (const term of curated) {
        const chip = document.createElement('span')
        chip.style.cssText = `
          font-family: 'Courier New', monospace;
          font-size: 12px;
          color: rgba(180, 160, 120, 0.25);
          border: 1px solid rgba(180, 160, 120, 0.08);
          padding: 4px 10px;
          cursor: pointer;
          transition: all 0.3s ease;
        `
        chip.textContent = term
        chip.addEventListener('mouseenter', () => {
          chip.style.borderColor = 'rgba(180, 160, 120, 0.3)'
          chip.style.color = 'rgba(180, 160, 120, 0.5)'
        })
        chip.addEventListener('mouseleave', () => {
          chip.style.borderColor = 'rgba(180, 160, 120, 0.08)'
          chip.style.color = 'rgba(180, 160, 120, 0.25)'
        })
        chip.addEventListener('click', () => {
          input.value = term
          doSearch()
        })
        suggestions.appendChild(chip)
      }
      overlay.appendChild(suggestions)

      // Hint
      const hint = document.createElement('div')
      hint.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 12px; font-style: italic;
        color: rgba(180, 160, 120, 0.1);
        margin-bottom: 40px;
        text-align: center;
      `
      hint.textContent = 'every book is a memory someone refused to let die'
      overlay.appendChild(hint)

      // ── Filing cabinet drawer navigation ──
      // Positioned along the right edge, styled as archival drawer labels
      const drawerRail = document.createElement('div')
      drawerRail.style.cssText = `
        position: fixed;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        gap: 2px;
        z-index: 10;
        pointer-events: auto;
      `

      const drawerDefs: { code: string; hint: string; room: string; restricted?: boolean }[] = [
        { code: 'CAT.', hint: 'cataloguing', room: 'cartographer' },
        { code: 'REF.', hint: 'reference section', room: 'library' },
        { code: 'IMG.', hint: 'image archive', room: 'palimpsestgallery' },
        { code: 'DATE', hint: 'date index', room: 'datepaintings' },
      ]

      // Add restricted drawer for catacombs descent if available
      if (deps?.onDescend) {
        drawerDefs.push({ code: 'RSTR', hint: 'restricted', room: '', restricted: true })
      }

      for (const drawer of drawerDefs) {
        const el = document.createElement('div')
        const isRestricted = drawer.restricted === true
        el.style.cssText = `
          font-family: 'Courier New', monospace;
          font-size: 12px;
          letter-spacing: 1.5px;
          color: ${isRestricted ? 'rgba(160, 100, 80, 0)' : 'rgba(180, 160, 120, 0.18)'};
          background: ${isRestricted ? 'rgba(60, 20, 15, 0)' : 'rgba(30, 25, 18, 0.6)'};
          border: 1px solid ${isRestricted ? 'rgba(160, 100, 80, 0)' : 'rgba(180, 160, 120, 0.06)'};
          border-right: none;
          padding: 8px 10px 8px 12px;
          cursor: ${isRestricted ? 'default' : 'pointer'};
          transition: transform 0.3s ease, color 0.3s ease, background 0.3s ease,
                      border-color 0.3s ease;
          transform: translateX(0px);
          white-space: nowrap;
          user-select: none;
          pointer-events: ${isRestricted ? 'none' : 'auto'};
        `
        el.textContent = drawer.code

        // Hint text that appears on hover
        const hintEl = document.createElement('span')
        hintEl.style.cssText = `
          font-family: 'Cormorant Garamond', serif;
          font-size: 12px;
          font-style: italic;
          color: rgba(180, 160, 120, 0);
          margin-left: 6px;
          transition: color 0.3s ease;
          letter-spacing: 0.5px;
        `
        hintEl.textContent = drawer.hint
        el.appendChild(hintEl)

        if (!isRestricted) {
          el.addEventListener('mouseenter', () => {
            el.style.transform = 'translateX(-8px)'
            el.style.color = 'rgba(180, 160, 120, 0.6)'
            el.style.background = 'rgba(40, 32, 22, 0.85)'
            el.style.borderColor = 'rgba(180, 160, 120, 0.2)'
            hintEl.style.color = 'rgba(180, 160, 120, 0.35)'
          })
          el.addEventListener('mouseleave', () => {
            el.style.transform = 'translateX(0px)'
            el.style.color = 'rgba(180, 160, 120, 0.18)'
            el.style.background = 'rgba(30, 25, 18, 0.6)'
            el.style.borderColor = 'rgba(180, 160, 120, 0.06)'
            hintEl.style.color = 'rgba(180, 160, 120, 0)'
          })
          el.addEventListener('click', () => {
            if (deps?.switchTo) deps.switchTo(drawer.room)
          })
        } else {
          // Restricted drawer: hover and click only work after 5+ searches
          el.addEventListener('mouseenter', () => {
            if (searchCount >= 5) {
              el.style.transform = 'translateX(-8px)'
              el.style.color = 'rgba(160, 100, 80, 0.6)'
              el.style.background = 'rgba(60, 20, 15, 0.7)'
              el.style.borderColor = 'rgba(160, 100, 80, 0.25)'
              hintEl.style.color = 'rgba(160, 100, 80, 0.35)'
            }
          })
          el.addEventListener('mouseleave', () => {
            if (searchCount >= 5) {
              el.style.transform = 'translateX(0px)'
              el.style.color = 'rgba(160, 100, 80, 0.2)'
              el.style.background = 'rgba(60, 20, 15, 0.4)'
              el.style.borderColor = 'rgba(160, 100, 80, 0.08)'
              hintEl.style.color = 'rgba(160, 100, 80, 0)'
            }
          })
          el.addEventListener('click', () => {
            if (searchCount >= 5 && deps?.onDescend) deps.onDescend()
          })
          // Store reference so we can reveal it after enough searches
          restrictedDrawer = el
        }

        drawerRail.appendChild(el)
      }
      overlay.appendChild(drawerRail)

      async function doSearch() {
        const query = input.value.trim()

        // Safety: prevent double searches
        if (searching) {
          console.warn('[archive] search already in progress, skipping')
          return
        }

        if (!query) {
          status.textContent = 'type a title, author, or subject first'
          status.style.color = 'rgba(180, 160, 120, 0.3)'
          input.style.borderBottomColor = 'rgba(255, 180, 100, 0.5)'
          setTimeout(() => {
            input.style.borderBottomColor = 'rgba(180, 160, 120, 0.15)'
          }, 1500)
          input.focus()
          return
        }

        searching = true
        searchBtn.textContent = '...'
        searchBtn.style.opacity = '0.5'
        status.textContent = `searching for "${query}"...`
        status.style.color = 'rgba(180, 160, 120, 0.4)'
        results.innerHTML = ''

        try {
          const data = await searchBooks(query)
          renderResults(data, results, status)
          searchCount++
          // Reveal restricted drawer after 5 searches
          if (searchCount >= 5 && restrictedDrawer) {
            restrictedDrawer.style.color = 'rgba(160, 100, 80, 0.2)'
            restrictedDrawer.style.background = 'rgba(60, 20, 15, 0.4)'
            restrictedDrawer.style.borderColor = 'rgba(160, 100, 80, 0.08)'
            restrictedDrawer.style.pointerEvents = 'auto'
            restrictedDrawer.style.cursor = 'pointer'
          }
        } catch (err) {
          const errMsg = err instanceof Error && err.name === 'AbortError'
            ? 'the library took too long to respond. try again.'
            : 'the archive is unreachable. try again.'
          status.textContent = errMsg
          status.style.color = 'rgba(180, 120, 80, 0.4)'
          console.warn('[archive] search failed:', err)
        } finally {
          searching = false
          searchBtn.textContent = 'search'
          searchBtn.style.opacity = '1'
        }
      }

      input.addEventListener('keydown', (e) => {
        e.stopPropagation()
        if (e.key === 'Enter') doSearch()
      })
      searchBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()
        doSearch()
      })
      searchBtn.addEventListener('mousedown', (e) => {
        e.stopPropagation()
      })

      // ── Effect canvas overlay ──
      effectCanvas = document.createElement('canvas')
      effectCanvas.width = window.innerWidth
      effectCanvas.height = window.innerHeight
      effectCanvas.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        pointer-events: none;
        z-index: 5;
      `
      effectCtx = effectCanvas.getContext('2d')
      overlay.appendChild(effectCanvas)

      // Resize handler
      resizeHandler = () => {
        if (effectCanvas) {
          effectCanvas.width = window.innerWidth
          effectCanvas.height = window.innerHeight
        }
        initDistantLights()
      }
      window.addEventListener('resize', resizeHandler)

      // Mouse tracking
      mouseMoveHandler = (e: MouseEvent) => {
        mouseX = e.clientX
        mouseY = e.clientY
      }
      window.addEventListener('mousemove', mouseMoveHandler)

      // Initialize particles
      initDustMotes()
      initDistantLights()

      return overlay
    },

    async activate() {
      active = true
      frameId = requestAnimationFrame(animationLoop)
      await initAudio()
    },

    deactivate() {
      active = false
      if (frameId) {
        cancelAnimationFrame(frameId)
        frameId = 0
      }
      fadeAudioOut()
      if (rustleInterval) {
        clearTimeout(rustleInterval as unknown as number)
        rustleInterval = null
      }
      if (footstepInterval) {
        clearTimeout(footstepInterval as unknown as number)
        footstepInterval = null
      }
      inkRipples.length = 0
    },

    destroy() {
      active = false
      if (frameId) {
        cancelAnimationFrame(frameId)
        frameId = 0
      }
      destroyAudio()

      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler)
        resizeHandler = null
      }
      if (mouseMoveHandler) {
        window.removeEventListener('mousemove', mouseMoveHandler)
        mouseMoveHandler = null
      }

      effectCanvas = null
      effectCtx = null
      dustMotes.length = 0
      distantLights.length = 0
      inkRipples.length = 0

      overlay?.remove()
    },
  }
}
