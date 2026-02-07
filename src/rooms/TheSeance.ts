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

interface SeanceDeps {
  getMemories: () => StoredMemory[]
  speakText?: (text: string) => Promise<void>
}

export function createSeanceRoom(deps: SeanceDeps): Room {
  let overlay: HTMLElement | null = null
  let inputEl: HTMLInputElement | null = null
  let messagesEl: HTMLElement | null = null
  let candleEl: HTMLElement | null = null
  const messages: Message[] = []
  let fadeInterval: number | null = null

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

    // Delay before void responds (1-3 seconds)
    const delay = 1000 + Math.random() * 2000
    setTimeout(async () => {
      const response = generateResponse(text)
      addMessage(response, 'void')

      // Speak the response if TTS is available
      deps.speakText?.(response)
    }, delay)
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

      return overlay
    },

    activate() {
      // Start message fading
      fadeInterval = window.setInterval(fadeOldMessages, 5000)
      // Focus input after transition
      setTimeout(() => inputEl?.focus(), 1600)
    },

    deactivate() {
      if (fadeInterval) clearInterval(fadeInterval)
    },

    destroy() {
      if (fadeInterval) clearInterval(fadeInterval)
      overlay?.remove()
    },
  }
}
