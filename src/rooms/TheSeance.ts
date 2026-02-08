/**
 * THE SÉANCE — commune with the void
 *
 * A darkened room where you can ask questions and the void answers.
 * The void draws from your stored memories, dream synthesizer output,
 * and philosophical fragments to construct responses. It speaks them
 * aloud via ElevenLabs TTS when available.
 *
 * The conversation is not intelligent — it's oracular. The void
 * recombines your own words back at you, twisted through templates
 * and cut-up techniques. Sometimes it's nonsense. Sometimes it's
 * accidentally profound. Like a real séance.
 *
 * The visual style: a single candle-like glow in the center,
 * conversation scrolling upward, your questions in gold,
 * the void's answers in violet. Everything fades over time.
 *
 * Inspired by: ELIZA, spirit boards, the Oracle at Delphi,
 * therapy sessions, late-night conversations with yourself,
 * the Turing test as performance art
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'
import { createSpeechSession, type SpeechSession } from '../voice/SpeechHelper'

// Oracle response templates — the void speaks in riddles
const ORACLE_TEMPLATES = [
  'you already know the answer. it lives in {fragment}',
  'the void remembers: {fragment}',
  '{fragment} — that is what remains',
  'in the space between your words, {fragment}',
  'you asked this before. the answer was always {fragment}',
  'the darkness says: {fragment}',
  'listen: {fragment}',
  'what you seek is dissolving. {fragment}',
  '{fragment}... but you knew that',
  'the void has no answers. only {fragment}',
  'once, someone here said: {fragment}. was it you?',
  'between forgetting and remembering: {fragment}',
  'the particles rearrange: {fragment}',
  '{fragment}. the void returns your words, altered.',
  'this was written on the walls of a room you forgot: {fragment}',
]

// Existential redirections when the void has nothing to draw from
const EMPTY_RESPONSES = [
  'the void is empty. you have given it nothing to remember.',
  'silence. feed me your words first.',
  'i am made of what you give me. give me something.',
  'there is nothing here yet. only potential.',
  'speak into the forgetting machine. then ask again.',
  'the séance requires memories. you have none here.',
]

interface Message {
  text: string
  role: 'user' | 'void'
  alpha: number
  y: number
  time: number
}

// Trigger words that reveal the passage to The Between
const BETWEEN_TRIGGERS = ['between', 'liminal', 'threshold', 'doorway', 'passage', 'corridor', 'hallway', 'bardo', 'transition']

const BETWEEN_RESPONSES = [
  'you speak of the space between... there is a place like that. a corridor. you can feel it, can\'t you?',
  'the threshold. yes. there is a hallway here, between all rooms. it has always been here.',
  'between... between... the corridor flickers. a door appears in the darkness.',
  'the liminal space calls to you. look below — a passage has opened.',
  'you named it. the between-place. the hallway of doors. it materializes.',
]

interface SeanceDeps {
  getMemories: () => StoredMemory[]
  speakText?: (text: string) => Promise<void>
  onBetween?: () => void
  switchTo?: (name: string) => void
}

interface SpiritWisp {
  name: string
  label: string
  baseX: number  // anchor as fraction of screen width
  baseY: number  // anchor as fraction of screen height
  currentX: number
  currentY: number
  hue: string    // CSS color for the gradient
  r: number; g: number; b: number  // RGB components for canvas drawing
  glowAlpha: number
  driftPhase: number
  trail: { x: number; y: number; alpha: number }[]
  labelReveal: number  // 0..label.length, how many chars revealed
}

export function createSeanceRoom(deps: SeanceDeps): Room {
  let overlay: HTMLElement | null = null
  let inputEl: HTMLInputElement | null = null
  let messagesEl: HTMLElement | null = null
  let candleEl: HTMLElement | null = null
  let betweenLink: HTMLElement | null = null
  let wispCanvas: HTMLCanvasElement | null = null
  let wispCtx: CanvasRenderingContext2D | null = null
  let wispAnimFrame: number | null = null
  const messages: Message[] = []
  let fadeInterval: number | null = null
  let betweenRevealed = false

  // Voice input — speak to the spirits
  let speech: SpeechSession | null = null
  let voiceIndicatorEl: HTMLElement | null = null
  let voiceTextEl: HTMLElement | null = null
  let spaceHeld = false

  // Spirit wisp state
  let hoveredWisp = -1
  let clickedWisp = -1
  let clickTime = 0

  const spiritWisps: SpiritWisp[] = [
    { name: 'oracle', label: 'the oracle deck', baseX: 0.12, baseY: 0.15, currentX: 0, currentY: 0, hue: 'rgba(220, 190, 80, 0.6)', r: 220, g: 190, b: 80, glowAlpha: 0.5, driftPhase: 0, trail: [], labelReveal: 0 },
    { name: 'madeleine', label: 'the madeleine', baseX: 0.88, baseY: 0.15, currentX: 0, currentY: 0, hue: 'rgba(220, 150, 170, 0.6)', r: 220, g: 150, b: 170, glowAlpha: 0.5, driftPhase: Math.PI * 0.5, trail: [], labelReveal: 0 },
    { name: 'rememory', label: 'the rememory', baseX: 0.88, baseY: 0.82, currentX: 0, currentY: 0, hue: 'rgba(170, 150, 220, 0.6)', r: 170, g: 150, b: 220, glowAlpha: 0.5, driftPhase: Math.PI, trail: [], labelReveal: 0 },
    { name: 'void', label: 'the void', baseX: 0.12, baseY: 0.82, currentX: 0, currentY: 0, hue: 'rgba(255, 80, 180, 0.6)', r: 255, g: 80, b: 180, glowAlpha: 0.5, driftPhase: Math.PI * 1.5, trail: [], labelReveal: 0 },
  ]

  function getFragment(): string {
    const memories = deps.getMemories()
    if (memories.length === 0) return ''

    const mem = memories[Math.floor(Math.random() * memories.length)]
    const words = mem.currentText.toLowerCase().split(/\s+/)

    // Extract 3-8 word fragment
    const start = Math.floor(Math.random() * Math.max(1, words.length - 4))
    const len = 3 + Math.floor(Math.random() * 5)
    return words.slice(start, start + len).join(' ')
  }

  function generateResponse(question: string): string {
    const memories = deps.getMemories()

    if (memories.length === 0) {
      return EMPTY_RESPONSES[Math.floor(Math.random() * EMPTY_RESPONSES.length)]
    }

    // Find memories that share words with the question
    const qWords = new Set(question.toLowerCase().split(/\s+/).filter(w => w.length > 3))
    let bestMemory: StoredMemory | null = null
    let bestScore = 0

    for (const mem of memories) {
      const mWords = mem.currentText.toLowerCase().split(/\s+/)
      let score = 0
      for (const w of mWords) {
        if (qWords.has(w)) score++
      }
      if (score > bestScore) {
        bestScore = score
        bestMemory = mem
      }
    }

    // Use matched memory or random fragment
    let fragment: string
    if (bestMemory && bestScore > 0) {
      const words = bestMemory.currentText.toLowerCase().split(/\s+/)
      const start = Math.floor(Math.random() * Math.max(1, words.length - 5))
      const len = 3 + Math.floor(Math.random() * 6)
      fragment = words.slice(start, start + len).join(' ')
    } else {
      fragment = getFragment()
    }

    // Apply template
    const template = ORACLE_TEMPLATES[Math.floor(Math.random() * ORACLE_TEMPLATES.length)]
    return template.replace('{fragment}', fragment)
  }

  function addMessage(text: string, role: 'user' | 'void') {
    messages.push({
      text,
      role,
      alpha: 1,
      y: 0,
      time: Date.now(),
    })

    renderMessages()
  }

  function renderMessages() {
    if (!messagesEl) return
    messagesEl.innerHTML = ''

    // Show last 12 messages
    const visible = messages.slice(-12)

    for (const msg of visible) {
      const el = document.createElement('div')
      el.style.cssText = `
        margin-bottom: 16px;
        opacity: ${msg.alpha};
        transition: opacity 0.5s ease;
        text-align: ${msg.role === 'user' ? 'right' : 'left'};
        padding: ${msg.role === 'user' ? '0 0 0 60px' : '0 60px 0 0'};
      `

      const textEl = document.createElement('div')
      textEl.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: ${msg.role === 'user' ? '400' : '300'};
        font-style: ${msg.role === 'void' ? 'italic' : 'normal'};
        font-size: ${msg.role === 'user' ? '15px' : '17px'};
        color: ${msg.role === 'user' ? 'rgba(255, 215, 0, 0.6)' : 'rgba(180, 160, 220, 0.7)'};
        letter-spacing: ${msg.role === 'void' ? '0.5px' : '0'};
        line-height: 1.6;
      `
      textEl.textContent = msg.text
      el.appendChild(textEl)

      if (msg.role === 'user') {
        const label = document.createElement('div')
        label.style.cssText = `
          font-family: monospace; font-size: 9px;
          color: rgba(255, 215, 0, 0.15);
          margin-top: 4px;
        `
        label.textContent = 'you'
        el.appendChild(label)
      } else {
        const label = document.createElement('div')
        label.style.cssText = `
          font-family: monospace; font-size: 9px;
          color: rgba(180, 160, 220, 0.15);
          margin-top: 4px;
        `
        label.textContent = 'the void'
        el.appendChild(label)
      }

      messagesEl.appendChild(el)
    }

    // Scroll to bottom
    messagesEl.scrollTop = messagesEl.scrollHeight
  }

  function checkBetweenTrigger(text: string): boolean {
    const lower = text.toLowerCase()
    return BETWEEN_TRIGGERS.some(t => lower.includes(t))
  }

  async function handleSubmit() {
    if (!inputEl) return
    const text = inputEl.value.trim()
    if (!text) return

    inputEl.value = ''
    addMessage(text, 'user')

    // Flicker candle
    if (candleEl) {
      candleEl.style.transform = 'scale(1.3)'
      setTimeout(() => { if (candleEl) candleEl.style.transform = 'scale(1)' }, 300)
    }

    // Check for between-trigger words
    const isBetweenTrigger = !betweenRevealed && deps.onBetween && checkBetweenTrigger(text)

    // Delay before void responds (1-3 seconds)
    const delay = 1000 + Math.random() * 2000
    setTimeout(async () => {
      let response: string
      if (isBetweenTrigger) {
        response = BETWEEN_RESPONSES[Math.floor(Math.random() * BETWEEN_RESPONSES.length)]
        // Reveal the between link
        betweenRevealed = true
        if (betweenLink) {
          betweenLink.style.color = 'rgba(180, 160, 220, 0.15)'
          betweenLink.style.pointerEvents = 'auto'
        }
      } else {
        response = generateResponse(text)
      }
      addMessage(response, 'void')

      // Speak the response if TTS is available
      deps.speakText?.(response)
    }, delay)
  }

  // --- Voice input for séance ---

  function handleSeanceKeyDown(e: KeyboardEvent) {
    if (e.code !== 'Space' || e.repeat) return
    // Don't capture if typing in the input
    if (document.activeElement === inputEl) return
    if (document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA') return
    if (!speech?.supported) return

    e.preventDefault()
    spaceHeld = true
    speech.start()

    // Show voice indicator
    if (voiceIndicatorEl) {
      voiceIndicatorEl.style.opacity = '1'
    }
    if (voiceTextEl) {
      voiceTextEl.textContent = ''
      voiceTextEl.style.opacity = '1'
    }

    // Candle flares when spirits listen
    if (candleEl) {
      candleEl.style.animation = 'candleFlicker 0.4s ease-in-out infinite alternate'
      candleEl.style.filter = 'brightness(2.0)'
      candleEl.style.boxShadow = `
        0 0 40px rgba(255, 180, 60, 0.6),
        0 0 80px rgba(255, 140, 20, 0.3),
        0 -12px 40px rgba(255, 100, 0, 0.2)
      `
    }
  }

  function handleSeanceKeyUp(e: KeyboardEvent) {
    if (e.code !== 'Space') return
    if (!spaceHeld) return
    spaceHeld = false

    const text = speech?.stop() || ''

    // Reset candle
    if (candleEl) {
      candleEl.style.animation = 'candleFlicker 3s ease-in-out infinite alternate'
      candleEl.style.filter = ''
      candleEl.style.boxShadow = `
        0 0 20px rgba(255, 180, 60, 0.4),
        0 0 60px rgba(255, 140, 20, 0.15),
        0 -8px 30px rgba(255, 100, 0, 0.1)
      `
    }

    // Hide indicator
    if (voiceIndicatorEl) voiceIndicatorEl.style.opacity = '0'

    if (text) {
      // Submit spoken text as a question to the void
      if (voiceTextEl) {
        voiceTextEl.style.opacity = '0'
        voiceTextEl.textContent = ''
      }
      addMessage(text, 'user')

      // Check for between trigger
      const isBetweenTrigger = !betweenRevealed && deps.onBetween && checkBetweenTrigger(text)

      const delay = 1000 + Math.random() * 2000
      setTimeout(async () => {
        let response: string
        if (isBetweenTrigger) {
          response = BETWEEN_RESPONSES[Math.floor(Math.random() * BETWEEN_RESPONSES.length)]
          betweenRevealed = true
          if (betweenLink) {
            betweenLink.style.color = 'rgba(180, 160, 220, 0.15)'
            betweenLink.style.pointerEvents = 'auto'
          }
        } else {
          response = generateResponse(text)
        }
        addMessage(response, 'void')
        deps.speakText?.(response)
      }, delay)
    } else {
      if (voiceTextEl) {
        voiceTextEl.style.opacity = '0'
      }
    }
  }

  function fadeOldMessages() {
    const now = Date.now()
    for (const msg of messages) {
      const age = (now - msg.time) / 1000
      // Messages fade after 60 seconds
      if (age > 60) {
        msg.alpha = Math.max(0.15, 1 - (age - 60) / 120)
      }
    }
    renderMessages()
  }

  // --- Spirit wisp rendering ---

  function resizeWispCanvas() {
    if (!wispCanvas || !overlay) return
    wispCanvas.width = overlay.clientWidth
    wispCanvas.height = overlay.clientHeight
  }

  function getWispScreenPos(w: SpiritWisp): { x: number; y: number } {
    const cw = wispCanvas ? wispCanvas.width : window.innerWidth
    const ch = wispCanvas ? wispCanvas.height : window.innerHeight
    return { x: w.baseX * cw + w.currentX, y: w.baseY * ch + w.currentY }
  }

  function hitTestWisps(mx: number, my: number): number {
    const hitRadius = 40
    for (let i = 0; i < spiritWisps.length; i++) {
      const pos = getWispScreenPos(spiritWisps[i])
      const dx = mx - pos.x
      const dy = my - pos.y
      if (dx * dx + dy * dy < hitRadius * hitRadius) return i
    }
    return -1
  }

  function renderWisps(time: number) {
    if (!wispCtx || !wispCanvas) return

    const w = wispCanvas.width
    const h = wispCanvas.height
    if (w === 0 || h === 0) return

    wispCtx.clearRect(0, 0, w, h)

    const dt = time * 0.001

    for (let i = 0; i < spiritWisps.length; i++) {
      const wisp = spiritWisps[i]
      const isHovered = hoveredWisp === i
      const isClicked = clickedWisp === i

      // Drift orbit around anchor — slower when hovered
      const driftSpeed = isHovered ? 0.15 : 0.4
      const driftRadius = isHovered ? 8 : 25
      wisp.currentX = Math.cos(dt * driftSpeed + wisp.driftPhase) * driftRadius
      wisp.currentY = Math.sin(dt * driftSpeed * 0.7 + wisp.driftPhase + 1.3) * driftRadius * 0.7

      // Breathing alpha
      const breathe = 0.3 + 0.2 * Math.sin(dt * 0.8 + wisp.driftPhase)
      wisp.glowAlpha = isHovered ? 0.85 : (isClicked ? 1.0 : breathe)

      const pos = getWispScreenPos(wisp)

      // Update trail
      wisp.trail.push({ x: pos.x, y: pos.y, alpha: 0.3 })
      if (wisp.trail.length > 12) wisp.trail.shift()
      for (const tp of wisp.trail) {
        tp.alpha *= 0.92
      }

      // Draw trail particles
      for (const tp of wisp.trail) {
        if (tp.alpha < 0.01) continue
        wispCtx.beginPath()
        wispCtx.arc(tp.x, tp.y, 2, 0, Math.PI * 2)
        wispCtx.fillStyle = `rgba(${wisp.r}, ${wisp.g}, ${wisp.b}, ${tp.alpha * wisp.glowAlpha * 0.5})`
        wispCtx.fill()
      }

      // Click flash expansion
      let flashScale = 1
      if (isClicked) {
        const elapsed = Date.now() - clickTime
        flashScale = 1 + (elapsed / 500) * 3
        const flashAlpha = Math.max(0, 1 - elapsed / 500)
        if (flashAlpha > 0) {
          const flashGrad = wispCtx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 60 * flashScale)
          flashGrad.addColorStop(0, `rgba(${wisp.r}, ${wisp.g}, ${wisp.b}, ${flashAlpha * 0.9})`)
          flashGrad.addColorStop(0.5, `rgba(${wisp.r}, ${wisp.g}, ${wisp.b}, ${flashAlpha * 0.3})`)
          flashGrad.addColorStop(1, `rgba(${wisp.r}, ${wisp.g}, ${wisp.b}, 0)`)
          wispCtx.beginPath()
          wispCtx.arc(pos.x, pos.y, 60 * flashScale, 0, Math.PI * 2)
          wispCtx.fillStyle = flashGrad
          wispCtx.fill()
        }
      }

      // Main wisp glow — radial gradient
      const baseRadius = isHovered ? 28 : 18
      const grad = wispCtx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, baseRadius)
      grad.addColorStop(0, `rgba(${wisp.r}, ${wisp.g}, ${wisp.b}, ${wisp.glowAlpha})`)
      grad.addColorStop(0.4, `rgba(${wisp.r}, ${wisp.g}, ${wisp.b}, ${wisp.glowAlpha * 0.4})`)
      grad.addColorStop(1, `rgba(${wisp.r}, ${wisp.g}, ${wisp.b}, 0)`)
      wispCtx.beginPath()
      wispCtx.arc(pos.x, pos.y, baseRadius, 0, Math.PI * 2)
      wispCtx.fillStyle = grad
      wispCtx.fill()

      // Outer halo
      const haloGrad = wispCtx.createRadialGradient(pos.x, pos.y, baseRadius * 0.8, pos.x, pos.y, baseRadius * 2.5)
      haloGrad.addColorStop(0, `rgba(${wisp.r}, ${wisp.g}, ${wisp.b}, ${wisp.glowAlpha * 0.12})`)
      haloGrad.addColorStop(1, `rgba(${wisp.r}, ${wisp.g}, ${wisp.b}, 0)`)
      wispCtx.beginPath()
      wispCtx.arc(pos.x, pos.y, baseRadius * 2.5, 0, Math.PI * 2)
      wispCtx.fillStyle = haloGrad
      wispCtx.fill()

      // Label reveal — letter by letter on hover
      if (isHovered) {
        wisp.labelReveal = Math.min(wisp.label.length, wisp.labelReveal + 0.15)
      } else {
        wisp.labelReveal = Math.max(0, wisp.labelReveal - 0.3)
      }

      if (wisp.labelReveal > 0.5) {
        const visibleChars = Math.floor(wisp.labelReveal)
        const partial = wisp.label.slice(0, visibleChars)
        const labelAlpha = isHovered ? 0.7 : Math.min(0.7, wisp.labelReveal / wisp.label.length)

        wispCtx.save()
        wispCtx.font = '11px "Cormorant Garamond", serif'
        wispCtx.fillStyle = `rgba(${wisp.r}, ${wisp.g}, ${wisp.b}, ${labelAlpha})`
        wispCtx.textAlign = 'center'
        wispCtx.fillText(partial, pos.x, pos.y + baseRadius + 18)
        wispCtx.restore()
      }
    }

    wispAnimFrame = requestAnimationFrame(renderWisps)
  }

  function handleOverlayMouseMove(e: MouseEvent) {
    if (!overlay) return
    const rect = overlay.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const prev = hoveredWisp
    hoveredWisp = deps.switchTo ? hitTestWisps(mx, my) : -1

    // Update cursor on overlay — but only change style if we aren't over an interactive child
    const target = e.target as HTMLElement
    const isInteractiveChild = target === inputEl || target === betweenLink || target.tagName === 'INPUT'
    if (!isInteractiveChild) {
      overlay.style.cursor = hoveredWisp >= 0 ? 'pointer' : ''
    }

    // Candle flicker intensification on wisp hover
    if (candleEl) {
      if (hoveredWisp >= 0 && prev < 0) {
        candleEl.style.animation = 'candleFlicker 0.6s ease-in-out infinite alternate'
        candleEl.style.filter = 'brightness(1.5)'
      } else if (hoveredWisp < 0 && prev >= 0) {
        candleEl.style.animation = 'candleFlicker 3s ease-in-out infinite alternate'
        candleEl.style.filter = ''
      }
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if (!overlay || !deps.switchTo) return
    // Don't intercept clicks on interactive children
    const target = e.target as HTMLElement
    if (target === inputEl || target === betweenLink || target.tagName === 'INPUT') return
    // Also skip if the target is inside messagesEl
    if (messagesEl && messagesEl.contains(target) && target !== overlay) return

    const rect = overlay.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const idx = hitTestWisps(mx, my)
    if (idx >= 0) {
      clickedWisp = idx
      clickTime = Date.now()
      const targetRoom = spiritWisps[idx].name
      // Navigate after flash animation
      setTimeout(() => {
        deps.switchTo!(targetRoom)
        clickedWisp = -1
      }, 500)
    }
  }

  return {
    name: 'seance',
    label: 'the séance',

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        display: flex; flex-direction: column;
        align-items: center; justify-content: flex-end;
        height: 100%;
        pointer-events: auto;
        background: rgba(2, 1, 8, 0.92);
        padding-bottom: 80px;
      `

      // Candle glow
      candleEl = document.createElement('div')
      candleEl.style.cssText = `
        position: absolute; top: 15%; left: 50%;
        transform: translateX(-50%);
        width: 4px; height: 12px;
        background: rgba(255, 200, 100, 0.8);
        border-radius: 50% 50% 20% 20%;
        box-shadow:
          0 0 20px rgba(255, 180, 60, 0.4),
          0 0 60px rgba(255, 140, 20, 0.15),
          0 -8px 30px rgba(255, 100, 0, 0.1);
        transition: transform 0.3s ease;
        animation: candleFlicker 3s ease-in-out infinite alternate;
      `
      overlay.appendChild(candleEl)

      // Add flicker animation
      const style = document.createElement('style')
      style.textContent = `
        @keyframes candleFlicker {
          0%, 100% { opacity: 0.8; transform: translateX(-50%) scale(1); }
          25% { opacity: 0.9; transform: translateX(-50%) scale(1.05) translateY(-1px); }
          50% { opacity: 0.7; transform: translateX(-50%) scale(0.95); }
          75% { opacity: 0.85; transform: translateX(-50%) scale(1.02) translateY(1px); }
        }
      `
      overlay.appendChild(style)

      // Title
      const title = document.createElement('div')
      title.style.cssText = `
        position: absolute; top: 22%;
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 11px;
        color: rgba(180, 160, 220, 0.2);
        letter-spacing: 4px;
        text-transform: uppercase;
      `
      title.textContent = 'ask the void'
      overlay.appendChild(title)

      // Messages area
      messagesEl = document.createElement('div')
      messagesEl.style.cssText = `
        width: 480px; max-width: 90vw;
        max-height: 50vh;
        overflow-y: auto;
        margin-bottom: 24px;
        scrollbar-width: none;
        -ms-overflow-style: none;
      `
      // Hide scrollbar
      const scrollStyle = document.createElement('style')
      scrollStyle.textContent = `.seance-messages::-webkit-scrollbar { display: none; }`
      messagesEl.className = 'seance-messages'
      overlay.appendChild(scrollStyle)
      overlay.appendChild(messagesEl)

      // Input
      inputEl = document.createElement('input')
      inputEl.type = 'text'
      inputEl.placeholder = 'ask a question...'
      inputEl.style.cssText = `
        width: 480px; max-width: 90vw;
        background: transparent;
        border: none;
        border-bottom: 1px solid rgba(180, 160, 220, 0.15);
        color: rgba(255, 215, 0, 0.6);
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 16px;
        padding: 12px 0;
        outline: none;
        caret-color: rgba(255, 20, 147, 0.5);
        letter-spacing: 0.5px;
      `
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          handleSubmit()
        }
        // Stop propagation so void-level keyboard handlers don't fire
        e.stopPropagation()
      })
      overlay.appendChild(inputEl)

      // Hint
      const hint = document.createElement('div')
      hint.style.cssText = `
        font-family: monospace; font-size: 9px;
        color: rgba(255, 255, 255, 0.08);
        margin-top: 12px;
        letter-spacing: 2px;
      `
      hint.textContent = 'the void answers from your memories'
      overlay.appendChild(hint)

      // Voice input setup
      speech = createSpeechSession()
      if (speech.supported) {
        // Voice indicator — appears near candle when listening
        voiceIndicatorEl = document.createElement('div')
        voiceIndicatorEl.style.cssText = `
          position: absolute; top: 28%;
          left: 50%; transform: translateX(-50%);
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300; font-size: 12px;
          font-style: italic;
          color: rgba(255, 180, 60, 0.5);
          letter-spacing: 3px;
          opacity: 0;
          transition: opacity 0.8s ease;
          pointer-events: none;
          text-shadow: 0 0 20px rgba(255, 180, 60, 0.3);
        `
        voiceIndicatorEl.textContent = 'the spirits listen...'
        overlay.appendChild(voiceIndicatorEl)

        // Spoken text display — shows interim text
        voiceTextEl = document.createElement('div')
        voiceTextEl.style.cssText = `
          position: absolute; top: 35%;
          left: 50%; transform: translateX(-50%);
          max-width: 60vw;
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300; font-size: 18px;
          color: rgba(255, 215, 0, 0.5);
          letter-spacing: 1px;
          text-align: center;
          line-height: 1.6;
          opacity: 0;
          transition: opacity 0.5s ease;
          pointer-events: none;
        `
        overlay.appendChild(voiceTextEl)

        speech.onUpdate((text) => {
          if (voiceTextEl) voiceTextEl.textContent = text
        })

        // Voice hint near input
        const voiceHint = document.createElement('div')
        voiceHint.style.cssText = `
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300; font-size: 12px;
          font-style: italic;
          color: rgba(180, 160, 220, 0.12);
          margin-top: 8px;
          letter-spacing: 2px;
          transition: opacity 4s ease;
        `
        voiceHint.textContent = 'hold space to speak'
        overlay.appendChild(voiceHint)
        // Fade in the voice hint after 5s
        setTimeout(() => { voiceHint.style.color = 'rgba(180, 160, 220, 0.3)' }, 5000)
      }

      // Hidden passage to The Between
      if (deps.onBetween) {
        betweenLink = document.createElement('div')
        betweenLink.style.cssText = `
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300; font-size: 11px; font-style: italic;
          color: rgba(180, 160, 220, 0);
          letter-spacing: 2px;
          cursor: pointer;
          transition: color 2s ease;
          margin-top: 20px;
          pointer-events: none;
        `
        betweenLink.textContent = '▸ step into the between'
        betweenLink.addEventListener('mouseenter', () => {
          if (betweenRevealed && betweenLink) betweenLink.style.color = 'rgba(180, 160, 220, 0.4)'
        })
        betweenLink.addEventListener('mouseleave', () => {
          if (betweenRevealed && betweenLink) betweenLink.style.color = 'rgba(180, 160, 220, 0.15)'
        })
        betweenLink.addEventListener('click', () => {
          if (betweenRevealed) deps.onBetween!()
        })
        overlay.appendChild(betweenLink)
      }

      // Spirit wisp canvas — renders behind messages/input
      if (deps.switchTo) {
        wispCanvas = document.createElement('canvas')
        wispCanvas.style.cssText = `
          position: absolute; top: 0; left: 0;
          width: 100%; height: 100%;
          pointer-events: none;
          z-index: 0;
        `
        // Insert canvas as first child so it's behind everything
        overlay.insertBefore(wispCanvas, overlay.firstChild)
        wispCtx = wispCanvas.getContext('2d')

        resizeWispCanvas()
        window.addEventListener('resize', resizeWispCanvas)

        // Interaction listeners on the overlay itself
        overlay.addEventListener('mousemove', handleOverlayMouseMove)
        overlay.addEventListener('click', handleOverlayClick)
      }

      return overlay
    },

    activate() {
      // Start message fading
      fadeInterval = window.setInterval(fadeOldMessages, 5000)
      // Focus input after transition
      setTimeout(() => inputEl?.focus(), 1600)
      // Start wisp animation
      if (wispCanvas && wispCtx) {
        resizeWispCanvas()
        wispAnimFrame = requestAnimationFrame(renderWisps)
      }
      // Voice input listeners
      if (speech?.supported) {
        window.addEventListener('keydown', handleSeanceKeyDown)
        window.addEventListener('keyup', handleSeanceKeyUp)
      }
    },

    deactivate() {
      if (fadeInterval) clearInterval(fadeInterval)
      if (wispAnimFrame) cancelAnimationFrame(wispAnimFrame)
      wispAnimFrame = null
      hoveredWisp = -1
      clickedWisp = -1
      // Clean up voice
      if (speech?.supported) {
        window.removeEventListener('keydown', handleSeanceKeyDown)
        window.removeEventListener('keyup', handleSeanceKeyUp)
        if (spaceHeld) {
          speech.stop()
          spaceHeld = false
        }
      }
    },

    destroy() {
      if (fadeInterval) clearInterval(fadeInterval)
      if (wispAnimFrame) cancelAnimationFrame(wispAnimFrame)
      wispAnimFrame = null
      window.removeEventListener('resize', resizeWispCanvas)
      window.removeEventListener('keydown', handleSeanceKeyDown)
      window.removeEventListener('keyup', handleSeanceKeyUp)
      speech?.destroy()
      overlay?.remove()
    },
  }
}
