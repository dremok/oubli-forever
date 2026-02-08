/**
 * THE DARKROOM — develop memories into photographs
 *
 * A photographic darkroom where memories become images. Under red safelight,
 * you choose a memory (or write a new prompt), and the system "develops" it
 * into a photograph using fal.ai. The image emerges slowly — first as dark
 * nothing, then shapes appear in the developer tray, then the full image
 * resolves.
 *
 * The room maintains a gallery of developed prints that persists in
 * localStorage. Old prints yellow and fade over time. You can only develop
 * one print per visit (like a real darkroom session).
 *
 * Visual style: Deep red safelight, chemical trays, the slow magic of
 * analog photography. A meditation on how we develop memories into
 * fixed images, and how those images still decay.
 *
 * Inspired by: Analog photography, Man Ray's rayographs, Gerhard Richter's
 * photo-paintings, the darkroom as transformative space, developing as
 * metaphor for memory consolidation
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'

interface DarkroomDeps {
  getMemories: () => StoredMemory[]
  switchTo?: (name: string) => void
}

interface DevelopedPrint {
  id: string
  prompt: string
  imageUrl: string
  timestamp: number
  age: number // 0-1, how much the print has yellowed
}

const STORAGE_KEY = 'oubli-darkroom-prints'
const MAX_PRINTS = 12

export function createDarkroomRoom(deps: DarkroomDeps): Room {
  let overlay: HTMLElement | null = null
  let active = false
  let developing = false
  let prints: DevelopedPrint[] = loadPrints()

  function loadPrints(): DevelopedPrint[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const p = JSON.parse(stored) as DevelopedPrint[]
        // Age prints based on time elapsed
        const now = Date.now()
        for (const print of p) {
          const days = (now - print.timestamp) / (1000 * 60 * 60 * 24)
          print.age = Math.min(days * 0.05, 0.8) // 5% per day, max 80%
        }
        return p
      }
    } catch { /* */ }
    return []
  }

  function savePrints() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prints))
    } catch { /* */ }
  }

  function getRandomMemoryPrompt(): string {
    const memories = deps.getMemories()
    if (memories.length === 0) return ''
    const mem = memories[Math.floor(Math.random() * memories.length)]
    return mem.currentText
  }

  function generateProceduralPrint(prompt: string): string {
    // Create a procedural darkroom print from the text
    const size = 400
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')!

    // Seed RNG from prompt text
    let seed = 0
    for (let i = 0; i < prompt.length; i++) {
      seed = ((seed << 5) - seed + prompt.charCodeAt(i)) | 0
    }
    const rng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }

    // Dark background with subtle warmth
    const bgR = 8 + Math.floor(rng() * 12)
    const bgG = 4 + Math.floor(rng() * 8)
    const bgB = 2 + Math.floor(rng() * 6)
    ctx.fillStyle = `rgb(${bgR}, ${bgG}, ${bgB})`
    ctx.fillRect(0, 0, size, size)

    // Extract words for visual seeds
    const words = prompt.toLowerCase().split(/\s+/).filter(w => w.length > 2)

    // Layer 1: Large radial gradient washes (2-4)
    const washes = 2 + Math.floor(rng() * 3)
    for (let i = 0; i < washes; i++) {
      const cx = rng() * size
      const cy = rng() * size
      const radius = 80 + rng() * 180
      const warmth = rng()
      const r = Math.floor(120 + warmth * 80)
      const g = Math.floor(60 + warmth * 40)
      const b = Math.floor(30 + warmth * 20)
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.08 + rng() * 0.12})`)
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, size, size)
    }

    // Layer 2: Geometric shapes derived from words
    for (let i = 0; i < Math.min(words.length, 8); i++) {
      const word = words[i]
      const charSum = word.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
      const alpha = 0.03 + rng() * 0.08
      const warm = 100 + (charSum % 100)
      ctx.fillStyle = `rgba(${warm}, ${Math.floor(warm * 0.5)}, ${Math.floor(warm * 0.3)}, ${alpha})`

      const shape = charSum % 4
      const x = rng() * size
      const y = rng() * size
      const s = 30 + rng() * 120

      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rng() * Math.PI * 2)

      if (shape === 0) {
        // Circle
        ctx.beginPath()
        ctx.arc(0, 0, s / 2, 0, Math.PI * 2)
        ctx.fill()
      } else if (shape === 1) {
        // Rectangle
        ctx.fillRect(-s / 2, -s / 3, s, s * 0.66)
      } else if (shape === 2) {
        // Triangle
        ctx.beginPath()
        ctx.moveTo(0, -s / 2)
        ctx.lineTo(s / 2, s / 2)
        ctx.lineTo(-s / 2, s / 2)
        ctx.closePath()
        ctx.fill()
      } else {
        // Ellipse
        ctx.beginPath()
        ctx.ellipse(0, 0, s / 2, s / 3, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    // Layer 3: Fine line structures
    ctx.strokeStyle = `rgba(180, 140, 100, ${0.04 + rng() * 0.06})`
    ctx.lineWidth = 0.5
    for (let i = 0; i < 8 + Math.floor(rng() * 12); i++) {
      ctx.beginPath()
      ctx.moveTo(rng() * size, rng() * size)
      ctx.quadraticCurveTo(rng() * size, rng() * size, rng() * size, rng() * size)
      ctx.stroke()
    }

    // Layer 4: Text fragments scattered
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.textAlign = 'center'
    for (let i = 0; i < Math.min(words.length, 6); i++) {
      const alpha = 0.04 + rng() * 0.1
      ctx.fillStyle = `rgba(200, 160, 120, ${alpha})`
      ctx.save()
      ctx.translate(rng() * size, rng() * size)
      ctx.rotate((rng() - 0.5) * 0.6)
      ctx.fillText(words[i], 0, 0)
      ctx.restore()
    }

    // Layer 5: Film grain
    const imageData = ctx.getImageData(0, 0, size, size)
    const d = imageData.data
    for (let i = 0; i < d.length; i += 4) {
      const noise = (rng() - 0.5) * 16
      d[i] = Math.max(0, Math.min(255, d[i] + noise))
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + noise * 0.8))
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + noise * 0.6))
    }
    ctx.putImageData(imageData, 0, 0)

    // Layer 6: Vignette
    const vignette = ctx.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.7)
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.5)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, size, size)

    return c.toDataURL('image/jpeg', 0.85)
  }

  function renderGallery(galleryEl: HTMLElement) {
    galleryEl.innerHTML = ''

    if (prints.length === 0) {
      const empty = document.createElement('div')
      empty.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 13px; font-style: italic;
        color: rgba(200, 100, 100, 0.25);
        text-align: center; padding: 40px;
      `
      empty.textContent = 'no prints developed yet'
      galleryEl.appendChild(empty)
      return
    }

    // Grid of prints — newest first
    const grid = document.createElement('div')
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px; padding: 8px;
    `

    for (const print of [...prints].reverse()) {
      const card = document.createElement('div')
      card.style.cssText = `
        position: relative;
        aspect-ratio: 1;
        overflow: hidden;
        border: 1px solid rgba(200, 100, 100, 0.1);
        cursor: pointer;
        transition: border-color 0.3s ease;
      `
      card.addEventListener('mouseenter', () => {
        card.style.borderColor = 'rgba(200, 100, 100, 0.4)'
      })
      card.addEventListener('mouseleave', () => {
        card.style.borderColor = 'rgba(200, 100, 100, 0.1)'
      })

      const img = document.createElement('img')
      img.src = print.imageUrl
      // Age effect: sepia increases, contrast decreases
      const sepia = print.age * 80
      const contrast = 100 - print.age * 30
      const brightness = 100 - print.age * 15
      img.style.cssText = `
        width: 100%; height: 100%; object-fit: cover;
        filter: sepia(${sepia}%) contrast(${contrast}%) brightness(${brightness}%);
        transition: filter 0.3s ease;
      `
      card.appendChild(img)

      // Prompt label on hover
      const label = document.createElement('div')
      label.style.cssText = `
        position: absolute; bottom: 0; left: 0; width: 100%;
        background: rgba(0, 0, 0, 0.7);
        padding: 6px 8px;
        font-family: 'Cormorant Garamond', serif;
        font-size: 10px; font-style: italic;
        color: rgba(200, 100, 100, 0.5);
        opacity: 0; transition: opacity 0.3s ease;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      `
      label.textContent = print.prompt
      card.appendChild(label)
      card.addEventListener('mouseenter', () => { label.style.opacity = '1' })
      card.addEventListener('mouseleave', () => { label.style.opacity = '0' })

      // Click to view full
      card.addEventListener('click', () => showFullPrint(print))

      grid.appendChild(card)
    }

    galleryEl.appendChild(grid)
  }

  function showFullPrint(print: DevelopedPrint) {
    const viewer = document.createElement('div')
    viewer.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 400; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.95);
      animation: darkroomFadeIn 0.3s ease;
      cursor: pointer;
    `
    viewer.addEventListener('click', () => viewer.remove())

    const img = document.createElement('img')
    img.src = print.imageUrl
    const sepia = print.age * 80
    const contrast = 100 - print.age * 30
    img.style.cssText = `
      max-width: 80vw; max-height: 70vh;
      filter: sepia(${sepia}%) contrast(${contrast}%);
      box-shadow: 0 0 60px rgba(200, 100, 100, 0.1);
    `
    viewer.appendChild(img)

    const caption = document.createElement('div')
    caption.style.cssText = `
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300; font-size: 14px; font-style: italic;
      color: rgba(200, 100, 100, 0.4);
      margin-top: 20px; max-width: 400px;
      text-align: center; line-height: 1.6;
    `
    const date = new Date(print.timestamp).toLocaleDateString()
    const agePercent = Math.floor(print.age * 100)
    caption.textContent = `"${print.prompt}" — developed ${date} · ${agePercent}% yellowed`
    viewer.appendChild(caption)

    document.body.appendChild(viewer)
  }

  async function developPrint(
    prompt: string,
    trayEl: HTMLElement,
    statusEl: HTMLElement,
    galleryEl: HTMLElement
  ) {
    if (developing) return
    developing = true

    // Phase 1: Darkness
    statusEl.textContent = 'exposing...'
    statusEl.style.color = 'rgba(200, 100, 100, 0.4)'

    // Show empty tray
    trayEl.innerHTML = ''
    const trayBg = document.createElement('div')
    trayBg.style.cssText = `
      width: 280px; height: 280px; max-width: 70vw; max-height: 40vh;
      background: rgba(20, 5, 5, 0.9);
      border: 1px solid rgba(200, 100, 100, 0.1);
      display: flex; align-items: center; justify-content: center;
      position: relative; overflow: hidden;
    `
    trayEl.appendChild(trayBg)

    // Chemical wash animation
    const wash = document.createElement('div')
    wash.style.cssText = `
      position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(200, 100, 100, 0.05), transparent);
      animation: chemicalWash 3s ease-in-out infinite;
    `
    trayBg.appendChild(wash)

    // Phase 2: Developing (procedural generation from text)
    await new Promise(r => setTimeout(r, 1500))
    statusEl.textContent = 'developing...'

    const imageUrl = generateProceduralPrint(prompt)

    // Phase 3: Image slowly appears
    await new Promise(r => setTimeout(r, 500))
    statusEl.textContent = 'image emerging...'

    const img = new Image()
    img.src = imageUrl

    img.style.cssText = `
      width: 100%; height: 100%; object-fit: cover;
      opacity: 0; filter: contrast(30%) brightness(40%) blur(8px);
      transition: opacity 4s ease, filter 6s ease;
    `
    trayBg.innerHTML = ''
    trayBg.appendChild(img)

    // Slow reveal — like watching a print develop
    await new Promise(r => setTimeout(r, 100))
    img.style.opacity = '0.3'
    img.style.filter = 'contrast(50%) brightness(60%) blur(4px)'

    await new Promise(r => setTimeout(r, 2000))
    statusEl.textContent = 'fixing...'
    img.style.opacity = '0.7'
    img.style.filter = 'contrast(80%) brightness(80%) blur(1px)'

    await new Promise(r => setTimeout(r, 2500))
    img.style.opacity = '1'
    img.style.filter = 'contrast(100%) brightness(100%) blur(0px)'
    statusEl.textContent = 'print developed'

    // Save to gallery
    const print: DevelopedPrint = {
      id: Date.now().toString(36),
      prompt,
      imageUrl,
      timestamp: Date.now(),
      age: 0,
    }
    prints.push(print)
    if (prints.length > MAX_PRINTS) prints.shift()
    savePrints()
    renderGallery(galleryEl)

    developing = false

    // Fade status
    await new Promise(r => setTimeout(r, 3000))
    if (statusEl) {
      statusEl.textContent = 'ready for another'
      statusEl.style.color = 'rgba(200, 100, 100, 0.2)'
    }
  }

  return {
    name: 'darkroom',
    label: 'the darkroom',

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        display: flex; flex-direction: column;
        align-items: center;
        height: 100%;
        pointer-events: auto;
        background: rgba(15, 2, 2, 0.95);
        overflow-y: auto;
        scrollbar-width: none;
      `

      // Add styles
      const style = document.createElement('style')
      style.textContent = `
        @keyframes darkroomFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes chemicalWash {
          0% { left: -100%; }
          50% { left: 100%; }
          100% { left: -100%; }
        }
        .darkroom-scroll::-webkit-scrollbar { display: none; }
        @keyframes trayRipple {
          0% { border-color: rgba(120, 30, 25, 0.25); }
          50% { border-color: rgba(180, 50, 40, 0.45); }
          100% { border-color: rgba(120, 30, 25, 0.25); }
        }
        @keyframes trayFlash {
          0% { background-color: rgba(200, 60, 50, 0.6); }
          100% { background-color: rgba(15, 2, 2, 0.9); }
        }
        .dev-tray { cursor: pointer; position: relative; }
        .dev-tray:hover { animation: trayRipple 2s ease-in-out infinite; }
        .dev-tray:hover .tray-silhouette { opacity: 0.4 !important; }
        .dev-tray .tray-silhouette { transition: opacity 2s ease; }
        .dev-tray .tray-label { transition: opacity 1.5s ease; }
        .dev-tray:hover .tray-label { opacity: 0.5 !important; }
        .dev-tray-flash { animation: trayFlash 200ms ease-out forwards; }
      `
      overlay.appendChild(style)
      overlay.classList.add('darkroom-scroll')

      // Safelight glow — red ambient light at top
      const safelight = document.createElement('div')
      safelight.style.cssText = `
        position: absolute; top: -50px; left: 50%;
        transform: translateX(-50%);
        width: 300px; height: 200px;
        background: radial-gradient(ellipse, rgba(180, 40, 30, 0.08) 0%, transparent 70%);
        pointer-events: none;
      `
      overlay.appendChild(safelight)

      // Title
      const title = document.createElement('div')
      title.style.cssText = `
        margin-top: 40px;
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 14px;
        color: rgba(200, 100, 100, 0.4);
        letter-spacing: 4px; text-transform: uppercase;
      `
      title.textContent = 'the darkroom'
      overlay.appendChild(title)

      const sub = document.createElement('div')
      sub.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 12px; font-style: italic;
        color: rgba(200, 100, 100, 0.2);
        margin-top: 6px; margin-bottom: 24px;
      `
      sub.textContent = 'develop memories into photographs'
      overlay.appendChild(sub)

      // Developer tray — where the image appears
      const tray = document.createElement('div')
      tray.style.cssText = `
        display: flex; align-items: center; justify-content: center;
        min-height: 120px;
        margin-bottom: 20px;
      `
      overlay.appendChild(tray)

      // Status text
      const status = document.createElement('div')
      status.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 12px; font-style: italic;
        color: rgba(200, 100, 100, 0.2);
        margin-bottom: 20px;
        min-height: 18px;
        transition: color 0.5s ease;
      `
      overlay.appendChild(status)

      // Input area — prompt or use a memory
      const inputArea = document.createElement('div')
      inputArea.style.cssText = `
        display: flex; flex-direction: column;
        align-items: center; gap: 10px;
        margin-bottom: 24px;
        width: 360px; max-width: 90vw;
      `

      const input = document.createElement('input')
      input.type = 'text'
      input.placeholder = 'describe what you want to develop...'
      input.style.cssText = `
        width: 100%;
        background: transparent;
        border: none;
        border-bottom: 1px solid rgba(200, 100, 100, 0.15);
        color: rgba(200, 100, 100, 0.6);
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 15px;
        padding: 10px 0;
        outline: none;
        caret-color: rgba(200, 100, 100, 0.5);
      `
      input.addEventListener('keydown', (e) => {
        e.stopPropagation()
        if (e.key === 'Enter') {
          const text = input.value.trim()
          if (text && !developing) {
            developPrint(text, tray, status, gallery)
            input.value = ''
          }
        }
      })
      inputArea.appendChild(input)

      // Button row
      const btnRow = document.createElement('div')
      btnRow.style.cssText = `
        display: flex; gap: 12px; align-items: center;
      `

      const developBtn = document.createElement('button')
      developBtn.textContent = 'develop'
      developBtn.style.cssText = `
        background: transparent;
        border: 1px solid rgba(200, 100, 100, 0.2);
        color: rgba(200, 100, 100, 0.5);
        font-family: 'Cormorant Garamond', serif;
        font-size: 13px; padding: 6px 20px;
        cursor: pointer; border-radius: 2px;
        letter-spacing: 2px; text-transform: uppercase;
        transition: all 0.3s ease;
      `
      developBtn.addEventListener('mouseenter', () => {
        developBtn.style.borderColor = 'rgba(200, 100, 100, 0.5)'
        developBtn.style.color = 'rgba(200, 100, 100, 0.8)'
      })
      developBtn.addEventListener('mouseleave', () => {
        developBtn.style.borderColor = 'rgba(200, 100, 100, 0.2)'
        developBtn.style.color = 'rgba(200, 100, 100, 0.5)'
      })
      developBtn.addEventListener('click', () => {
        const text = input.value.trim()
        if (text && !developing) {
          developPrint(text, tray, status, gallery)
          input.value = ''
        }
      })
      btnRow.appendChild(developBtn)

      // "Use a memory" button
      const memBtn = document.createElement('button')
      memBtn.textContent = 'use a memory'
      memBtn.style.cssText = `
        background: transparent;
        border: 1px solid rgba(200, 100, 100, 0.1);
        color: rgba(200, 100, 100, 0.3);
        font-family: 'Cormorant Garamond', serif;
        font-size: 12px; font-style: italic;
        padding: 6px 16px;
        cursor: pointer; border-radius: 2px;
        transition: all 0.3s ease;
      `
      memBtn.addEventListener('mouseenter', () => {
        memBtn.style.borderColor = 'rgba(200, 100, 100, 0.4)'
        memBtn.style.color = 'rgba(200, 100, 100, 0.6)'
      })
      memBtn.addEventListener('mouseleave', () => {
        memBtn.style.borderColor = 'rgba(200, 100, 100, 0.1)'
        memBtn.style.color = 'rgba(200, 100, 100, 0.3)'
      })
      memBtn.addEventListener('click', () => {
        const memText = getRandomMemoryPrompt()
        if (memText) {
          input.value = memText
        } else {
          status.textContent = 'no memories to develop. visit the void first.'
          status.style.color = 'rgba(200, 100, 100, 0.3)'
        }
      })
      btnRow.appendChild(memBtn)

      inputArea.appendChild(btnRow)
      overlay.appendChild(inputArea)

      // === DEVELOPING TRAYS — navigation as darkroom process ===
      if (deps.switchTo) {
        const traysContainer = document.createElement('div')
        traysContainer.style.cssText = `
          display: flex; gap: 20px; justify-content: center;
          align-items: flex-start;
          margin-bottom: 28px; margin-top: 4px;
          padding: 16px 24px 12px;
          background: rgba(10, 1, 1, 0.6);
          border-top: 1px solid rgba(120, 30, 25, 0.1);
          border-bottom: 1px solid rgba(120, 30, 25, 0.1);
        `

        const trayDefs: { room: string; label: string; silhouette: string }[] = [
          {
            room: 'projection',
            label: 'projection',
            // Projector body (small rect) + light beam (triangle via borders)
            silhouette: `
              <svg viewBox="0 0 60 44" width="60" height="44" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="16" width="12" height="10" rx="1" fill="rgba(200,80,70,0.7)"/>
                <polygon points="14,18 56,4 56,38 14,28" fill="rgba(200,80,70,0.3)"/>
                <circle cx="8" cy="21" r="3" fill="rgba(200,80,70,0.5)"/>
              </svg>
            `,
          },
          {
            room: 'palimpsestgallery',
            label: 'gallery',
            // Two overlapping frames at slight angles
            silhouette: `
              <svg viewBox="0 0 60 44" width="60" height="44" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="6" width="28" height="22" rx="1" fill="none" stroke="rgba(200,80,70,0.6)" stroke-width="1.5" transform="rotate(-6 20 17)"/>
                <rect x="22" y="12" width="28" height="22" rx="1" fill="none" stroke="rgba(200,80,70,0.5)" stroke-width="1.5" transform="rotate(4 36 23)"/>
                <line x1="12" y1="14" x2="28" y2="14" stroke="rgba(200,80,70,0.2)" stroke-width="0.5" transform="rotate(-6 20 17)"/>
              </svg>
            `,
          },
          {
            room: 'sketchpad',
            label: 'sketchpad',
            // Diagonal pencil stroke with dot
            silhouette: `
              <svg viewBox="0 0 60 44" width="60" height="44" xmlns="http://www.w3.org/2000/svg">
                <line x1="10" y1="38" x2="50" y2="8" stroke="rgba(200,80,70,0.6)" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="14" y1="32" x2="36" y2="18" stroke="rgba(200,80,70,0.3)" stroke-width="0.8" stroke-linecap="round"/>
                <circle cx="50" cy="8" r="2.5" fill="rgba(200,80,70,0.5)"/>
                <circle cx="10" cy="38" r="1.5" fill="rgba(200,80,70,0.3)"/>
              </svg>
            `,
          },
          {
            room: 'loom',
            label: 'thread',
            // Three horizontal wavy lines (threads)
            silhouette: `
              <svg viewBox="0 0 60 44" width="60" height="44" xmlns="http://www.w3.org/2000/svg">
                <path d="M4,12 Q15,8 22,12 Q30,16 38,12 Q46,8 56,12" fill="none" stroke="rgba(200,80,70,0.6)" stroke-width="1.2"/>
                <path d="M4,22 Q15,18 22,22 Q30,26 38,22 Q46,18 56,22" fill="none" stroke="rgba(200,80,70,0.5)" stroke-width="1.2"/>
                <path d="M4,32 Q15,28 22,32 Q30,36 38,32 Q46,28 56,32" fill="none" stroke="rgba(200,80,70,0.4)" stroke-width="1.2"/>
              </svg>
            `,
          },
        ]

        for (const def of trayDefs) {
          const trayWrap = document.createElement('div')
          trayWrap.style.cssText = `
            display: flex; flex-direction: column;
            align-items: center; gap: 6px;
          `

          const trayDiv = document.createElement('div')
          trayDiv.className = 'dev-tray'
          trayDiv.style.cssText = `
            width: 80px; height: 60px;
            background: rgba(15, 2, 2, 0.9);
            border: 1px solid rgba(120, 30, 25, 0.25);
            display: flex; align-items: center; justify-content: center;
            overflow: hidden;
            border-radius: 1px;
          `

          const silDiv = document.createElement('div')
          silDiv.className = 'tray-silhouette'
          silDiv.style.cssText = `
            opacity: 0.05;
            display: flex; align-items: center; justify-content: center;
            width: 100%; height: 100%;
          `
          silDiv.innerHTML = def.silhouette.trim()
          trayDiv.appendChild(silDiv)

          const labelDiv = document.createElement('div')
          labelDiv.className = 'tray-label'
          labelDiv.style.cssText = `
            font-family: 'Cormorant Garamond', serif;
            font-size: 9px; font-style: italic;
            color: rgba(200, 100, 100, 0.15);
            letter-spacing: 1px;
            opacity: 0.3;
          `
          labelDiv.textContent = def.label

          // Click → flash then navigate
          trayDiv.addEventListener('click', () => {
            trayDiv.classList.add('dev-tray-flash')
            setTimeout(() => {
              deps.switchTo!(def.room)
            }, 220)
          })

          trayWrap.appendChild(trayDiv)
          trayWrap.appendChild(labelDiv)
          traysContainer.appendChild(trayWrap)
        }

        overlay.appendChild(traysContainer)
      }

      // Divider
      const divider = document.createElement('div')
      divider.style.cssText = `
        width: 200px; height: 1px;
        background: rgba(200, 100, 100, 0.08);
        margin-bottom: 20px;
      `
      overlay.appendChild(divider)

      // Gallery label
      const galleryLabel = document.createElement('div')
      galleryLabel.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 11px;
        color: rgba(200, 100, 100, 0.2);
        letter-spacing: 3px; text-transform: uppercase;
        margin-bottom: 12px;
      `
      galleryLabel.textContent = 'developed prints'
      overlay.appendChild(galleryLabel)

      // Gallery
      const gallery = document.createElement('div')
      gallery.style.cssText = `
        width: 480px; max-width: 90vw;
        margin-bottom: 40px;
      `
      renderGallery(gallery)
      overlay.appendChild(gallery)

      return overlay
    },

    activate() {
      active = true
    },

    deactivate() {
      active = false
    },

    destroy() {
      overlay?.remove()
    },
  }
}
