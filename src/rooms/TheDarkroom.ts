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
  const apiKey = import.meta.env.FAL_KEY || ''

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

  async function generateImage(prompt: string): Promise<string | null> {
    const artPrompt = `analog photograph, darkroom print, silver gelatin, high contrast black and white with subtle warm tone, ${prompt}, grain, slightly soft focus, vintage photographic quality, moody shadows, atmospheric, intimate, 35mm film aesthetic`

    const response = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: artPrompt,
        image_size: 'square',
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: false,
      }),
    })

    if (!response.ok) return null
    const data = await response.json()
    return data?.images?.[0]?.url || null
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
      img.crossOrigin = 'anonymous'
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
    img.crossOrigin = 'anonymous'
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
    if (developing || !apiKey) return
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

    // Phase 2: Developing
    await new Promise(r => setTimeout(r, 1500))
    statusEl.textContent = 'developing...'

    let imageUrl: string | null = null
    try {
      imageUrl = await generateImage(prompt)
    } catch {
      statusEl.textContent = 'development failed. the chemicals have expired.'
      developing = false
      return
    }

    if (!imageUrl) {
      statusEl.textContent = 'the image did not take. try again.'
      developing = false
      return
    }

    // Phase 3: Image slowly appears
    statusEl.textContent = 'image emerging...'

    const img = new Image()
    img.crossOrigin = 'anonymous'

    await new Promise<void>((resolve) => {
      img.onload = () => resolve()
      img.onerror = () => resolve()
      img.src = imageUrl!
    })

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

      if (!apiKey) {
        status.textContent = 'the enlarger is dark. no light source available.'
        status.style.color = 'rgba(200, 100, 100, 0.3)'
      }

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
