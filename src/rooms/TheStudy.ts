/**
 * THE STUDY — a room for writing
 *
 * A focused, minimal writing environment. The particle void dims
 * to a barely-visible background. A large text area takes center
 * stage. The system generates writing prompts based on your previous
 * memories and the time of day.
 *
 * What you write here is saved alongside your dissolved memories,
 * but the text doesn't dissolve — it persists. The Study is where
 * memories are deliberately formed, in contrast to the Void where
 * they are deliberately forgotten.
 *
 * Features:
 * - Distraction-free writing with character/word count
 * - Generative writing prompts from your memory history
 * - Auto-save to localStorage
 * - Export as text file
 * - The ambient drone continues but softened
 * - Stoic philosophical inscriptions from the Stoic Quotes API
 * - Study-themed navigation portals (bookshelves, drawers, windows)
 *
 * Inspired by: iA Writer, Hemingway's standing desk,
 * Japanese tea ceremony (minimal, intentional, present),
 * Marcus Aurelius' Meditations, Seneca's Letters
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'

const STORAGE_KEY = 'oubli-study'
const QUOTE_API = 'https://stoic-quotes.com/api/quote'
const QUOTE_INTERVAL_MS = 90_000
const QUOTE_VISIBLE_MS = 20_000
const QUOTE_FADE_MS = 2000

const PROMPTS_BASE = [
  'Write about a place you can no longer visit...',
  'Describe the last dream you remember...',
  'What sound do you associate with childhood?',
  'Write a letter to someone you\'ve lost touch with...',
  'Describe the taste of a memory...',
  'What does silence sound like in your mind?',
  'Write about something you wish you could forget...',
  'What color is your earliest memory?',
  'Describe the space between two heartbeats...',
  'Write about a door you never opened...',
  'What would you say to yourself from ten years ago?',
  'Describe the weight of a memory you carry...',
  'Write about something beautiful that no longer exists...',
  'What does the word "home" feel like?',
  'Describe a moment that changed everything...',
]

// Fallback quotes for when the API is unreachable
const FALLBACK_QUOTES: Array<{ text: string; author: string }> = [
  { text: 'We suffer more often in imagination than in reality.', author: 'Seneca' },
  { text: 'The happiness of your life depends upon the quality of your thoughts.', author: 'Marcus Aurelius' },
  { text: 'Man is not worried by real problems so much as by his imagined anxieties about real problems.', author: 'Epictetus' },
  { text: 'It is not that we have a short time to live, but that we waste a great deal of it.', author: 'Seneca' },
  { text: 'You have power over your mind — not outside events. Realize this, and you will find strength.', author: 'Marcus Aurelius' },
  { text: 'No man is free who is not master of himself.', author: 'Epictetus' },
  { text: 'Begin at once to live, and count each separate day as a separate life.', author: 'Seneca' },
  { text: 'The soul becomes dyed with the colour of its thoughts.', author: 'Marcus Aurelius' },
  { text: 'First say to yourself what you would be; and then do what you have to do.', author: 'Epictetus' },
  { text: 'Loss is nothing else but change, and change is nature\'s delight.', author: 'Marcus Aurelius' },
]

interface StoicQuote {
  text: string
  author: string
}

interface StudyDeps {
  getMemories: () => StoredMemory[]
  onNewText?: (text: string) => void
  switchTo?: (name: string) => void
}

// Session-level quote cache to avoid repeats
const seenQuoteTexts = new Set<string>()

async function fetchStoicQuote(): Promise<StoicQuote> {
  try {
    const resp = await fetch(QUOTE_API)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json() as { text: string; author: string }
    if (!data.text || !data.author) throw new Error('Invalid response shape')
    return { text: data.text, author: data.author }
  } catch {
    // Fallback: pick a random fallback quote not yet seen
    const unseen = FALLBACK_QUOTES.filter(q => !seenQuoteTexts.has(q.text))
    const pool = unseen.length > 0 ? unseen : FALLBACK_QUOTES
    return pool[Math.floor(Math.random() * pool.length)]
  }
}

async function fetchUniqueQuote(): Promise<StoicQuote> {
  // Try up to 3 times to get a quote we haven't shown yet
  for (let attempt = 0; attempt < 3; attempt++) {
    const quote = await fetchStoicQuote()
    if (!seenQuoteTexts.has(quote.text)) {
      seenQuoteTexts.add(quote.text)
      return quote
    }
  }
  // If all attempts returned duplicates, just use the last one
  const quote = await fetchStoicQuote()
  seenQuoteTexts.add(quote.text)
  return quote
}

export function createStudyRoom(getMemoriesOrDeps: (() => StoredMemory[]) | StudyDeps, onNewText?: (text: string) => void): Room {
  // Support both old (positional) and new (deps object) signatures
  const deps: StudyDeps = typeof getMemoriesOrDeps === 'function'
    ? { getMemories: getMemoriesOrDeps, onNewText }
    : getMemoriesOrDeps
  const getMemories = deps.getMemories
  onNewText = deps.onNewText
  let overlay: HTMLElement | null = null
  let textarea: HTMLTextAreaElement | null = null
  let promptEl: HTMLElement | null = null
  let countEl: HTMLElement | null = null
  let saveInterval: number | null = null
  let quoteInterval: number | null = null
  let quoteTimeout: number | null = null
  let quoteEl: HTMLElement | null = null
  let quoteAuthorEl: HTMLElement | null = null
  let active = false
  let lastWordCount = 0

  function loadText(): string {
    try {
      return localStorage.getItem(STORAGE_KEY) || ''
    } catch { return '' }
  }

  function saveText(text: string) {
    try {
      localStorage.setItem(STORAGE_KEY, text)
    } catch { /* */ }
  }

  function generatePrompt(): string {
    const memories = getMemories()
    const memTexts = memories.map(m => m.currentText)

    // Sometimes use a memory-inspired prompt
    if (memTexts.length > 0 && Math.random() < 0.4) {
      const mem = memTexts[Math.floor(Math.random() * memTexts.length)]
      const words = mem.split(/\s+/).filter(w => w.length > 3)
      if (words.length > 0) {
        const word = words[Math.floor(Math.random() * words.length)]
        const templates = [
          `Write more about "${word}"...`,
          `What does "${word}" remind you of?`,
          `Continue the thought: "${mem}"`,
          `The word "${word}" appeared in the void. What does it mean to you?`,
        ]
        return templates[Math.floor(Math.random() * templates.length)]
      }
    }

    // Time-of-day prompts
    const hour = new Date().getHours()
    if (hour >= 0 && hour < 6 && Math.random() < 0.3) {
      return 'It\'s late. What keeps you awake?'
    }
    if (hour >= 6 && hour < 10 && Math.random() < 0.3) {
      return 'What did you dream about?'
    }

    return PROMPTS_BASE[Math.floor(Math.random() * PROMPTS_BASE.length)]
  }

  function updateCount() {
    if (!textarea || !countEl) return
    const text = textarea.value
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    const chars = text.length
    countEl.textContent = `${words} words \u00b7 ${chars} characters`
  }

  function newPrompt() {
    if (promptEl) {
      promptEl.style.opacity = '0'
      setTimeout(() => {
        if (promptEl) {
          promptEl.textContent = generatePrompt()
          promptEl.style.opacity = '1'
        }
      }, 500)
    }
  }

  function exportText() {
    if (!textarea) return
    const text = textarea.value
    if (!text.trim()) return

    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `oubli-study-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  /** Show a stoic quote inscription with fade-in, hold, fade-out */
  async function showQuoteInscription() {
    if (!quoteEl || !quoteAuthorEl || !active) return

    const quote = await fetchUniqueQuote()
    if (!active) return // room may have been deactivated during fetch

    // Set text
    quoteEl.textContent = `\u201c${quote.text}\u201d`
    quoteAuthorEl.textContent = `\u2014 ${quote.author}`

    // Fade in
    quoteEl.style.transition = `opacity ${QUOTE_FADE_MS}ms ease-in`
    quoteAuthorEl.style.transition = `opacity ${QUOTE_FADE_MS}ms ease-in ${QUOTE_FADE_MS * 0.3}ms`
    quoteEl.style.opacity = '1'
    quoteAuthorEl.style.opacity = '1'

    // Hold, then fade out
    quoteTimeout = window.setTimeout(() => {
      if (!quoteEl || !quoteAuthorEl) return
      quoteEl.style.transition = `opacity ${QUOTE_FADE_MS}ms ease-out`
      quoteAuthorEl.style.transition = `opacity ${QUOTE_FADE_MS}ms ease-out`
      quoteEl.style.opacity = '0'
      quoteAuthorEl.style.opacity = '0'
    }, QUOTE_VISIBLE_MS)
  }

  function startQuoteCycle() {
    // Show first quote after a short delay so the room settles
    quoteTimeout = window.setTimeout(() => {
      showQuoteInscription()
    }, 2000)

    // Then periodically
    quoteInterval = window.setInterval(() => {
      showQuoteInscription()
    }, QUOTE_INTERVAL_MS)
  }

  function stopQuoteCycle() {
    if (quoteInterval) { clearInterval(quoteInterval); quoteInterval = null }
    if (quoteTimeout) { clearTimeout(quoteTimeout); quoteTimeout = null }
  }

  /** Build a study-themed navigation portal */
  function createPortal(config: {
    label: string
    roomName: string
    icon: string
    description: string
    position: string
    baseColor: string
    hoverColor: string
    glowColor: string
    borderStyle: string
  }): HTMLElement {
    const portal = document.createElement('div')
    portal.style.cssText = `
      ${config.position}
      pointer-events: auto; cursor: pointer;
      padding: 12px 16px;
      border: ${config.borderStyle};
      border-radius: 3px;
      background: rgba(2, 1, 8, 0.4);
      transition: all 0.6s ease;
      text-align: center;
      min-width: 80px;
    `

    const iconSpan = document.createElement('div')
    iconSpan.style.cssText = `
      font-size: 18px;
      margin-bottom: 6px;
      opacity: 0.4;
      transition: opacity 0.6s ease;
    `
    iconSpan.textContent = config.icon

    const labelSpan = document.createElement('div')
    labelSpan.style.cssText = `
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300; font-size: 10px;
      letter-spacing: 2px; text-transform: lowercase;
      font-style: italic;
      color: ${config.baseColor};
      transition: color 0.5s ease;
    `
    labelSpan.textContent = config.label

    const descSpan = document.createElement('div')
    descSpan.style.cssText = `
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300; font-size: 8px;
      letter-spacing: 1px;
      color: rgba(255, 255, 255, 0.06);
      margin-top: 4px;
      transition: color 0.5s ease;
    `
    descSpan.textContent = config.description

    portal.appendChild(iconSpan)
    portal.appendChild(labelSpan)
    portal.appendChild(descSpan)

    portal.addEventListener('mouseenter', () => {
      portal.style.background = 'rgba(2, 1, 8, 0.7)'
      portal.style.boxShadow = `0 0 20px ${config.glowColor}, inset 0 0 15px ${config.glowColor}`
      labelSpan.style.color = config.hoverColor
      descSpan.style.color = 'rgba(255, 255, 255, 0.2)'
      iconSpan.style.opacity = '0.8'
    })

    portal.addEventListener('mouseleave', () => {
      portal.style.background = 'rgba(2, 1, 8, 0.4)'
      portal.style.boxShadow = 'none'
      labelSpan.style.color = config.baseColor
      descSpan.style.color = 'rgba(255, 255, 255, 0.06)'
      iconSpan.style.opacity = '0.4'
    })

    portal.addEventListener('click', (e) => {
      e.stopPropagation()
      // Brief flash effect before navigating
      portal.style.boxShadow = `0 0 40px ${config.hoverColor}`
      portal.style.background = 'rgba(2, 1, 8, 0.9)'
      setTimeout(() => {
        deps.switchTo!(config.roomName)
      }, 200)
    })

    return portal
  }

  return {
    name: 'study',
    label: 'the study',

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        height: 100%;
        pointer-events: auto;
        background: rgba(2, 1, 8, 0.85);
      `

      // Prompt
      promptEl = document.createElement('div')
      promptEl.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 16px;
        font-style: italic;
        color: rgba(255, 215, 0, 0.35);
        margin-bottom: 24px;
        max-width: 500px;
        text-align: center;
        letter-spacing: 1px;
        cursor: pointer;
        transition: opacity 0.5s ease;
      `
      promptEl.textContent = generatePrompt()
      promptEl.title = 'Click for a new prompt'
      promptEl.addEventListener('click', newPrompt)
      overlay.appendChild(promptEl)

      // Textarea
      textarea = document.createElement('textarea')
      textarea.value = loadText()
      textarea.placeholder = 'Write here...'
      textarea.style.cssText = `
        width: 560px; max-width: 90vw;
        height: 400px; max-height: 60vh;
        background: transparent;
        border: 1px solid rgba(255, 20, 147, 0.1);
        border-radius: 2px;
        color: rgba(255, 215, 0, 0.7);
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 18px;
        line-height: 1.8;
        letter-spacing: 0.5px;
        padding: 24px;
        resize: none;
        outline: none;
        caret-color: rgba(255, 20, 147, 0.7);
      `
      textarea.addEventListener('input', () => {
        updateCount()
        // Emit new text passages every 20+ words
        if (textarea && onNewText) {
          const text = textarea.value.trim()
          const words = text ? text.split(/\s+/).length : 0
          if (words >= lastWordCount + 20) {
            const newWords = text.split(/\s+/).slice(lastWordCount).join(' ')
            lastWordCount = words
            onNewText(newWords)
          }
        }
      })
      overlay.appendChild(textarea)

      // Bottom bar: word count + actions
      const bottom = document.createElement('div')
      bottom.style.cssText = `
        display: flex; justify-content: space-between;
        align-items: center;
        width: 560px; max-width: 90vw;
        margin-top: 16px;
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 11px;
      `

      countEl = document.createElement('div')
      countEl.style.cssText = `
        color: rgba(255, 255, 255, 0.15);
        letter-spacing: 1px;
      `
      updateCount()
      bottom.appendChild(countEl)

      const exportBtn = document.createElement('div')
      exportBtn.style.cssText = `
        color: rgba(255, 20, 147, 0.3);
        cursor: pointer;
        letter-spacing: 2px;
        transition: color 0.3s ease;
      `
      exportBtn.textContent = 'export'
      exportBtn.addEventListener('mouseenter', () => {
        exportBtn.style.color = 'rgba(255, 20, 147, 0.7)'
      })
      exportBtn.addEventListener('mouseleave', () => {
        exportBtn.style.color = 'rgba(255, 20, 147, 0.3)'
      })
      exportBtn.addEventListener('click', exportText)
      bottom.appendChild(exportBtn)

      overlay.appendChild(bottom)

      // --- Stoic Quote Inscription ---
      // Positioned below the bottom bar, like words carved into the desk surface
      const inscriptionContainer = document.createElement('div')
      inscriptionContainer.style.cssText = `
        position: relative;
        width: 560px; max-width: 90vw;
        margin-top: 28px;
        text-align: center;
        min-height: 60px;
      `

      quoteEl = document.createElement('div')
      quoteEl.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 14px;
        font-style: italic;
        color: rgba(180, 160, 120, 0.35);
        letter-spacing: 1.5px;
        line-height: 1.6;
        opacity: 0;
        text-shadow: 0 0 8px rgba(180, 160, 120, 0.08);
      `

      quoteAuthorEl = document.createElement('div')
      quoteAuthorEl.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 10px;
        font-style: italic;
        color: rgba(180, 160, 120, 0.2);
        letter-spacing: 2px;
        margin-top: 8px;
        opacity: 0;
      `

      inscriptionContainer.appendChild(quoteEl)
      inscriptionContainer.appendChild(quoteAuthorEl)
      overlay.appendChild(inscriptionContainer)

      // --- In-room Navigation Portals ---
      if (deps.switchTo) {
        const navContainer = document.createElement('div')
        navContainer.style.cssText = `
          position: absolute; top: 0; left: 0; width: 100%; height: 100%;
          pointer-events: none; z-index: 2;
        `

        // Bookshelf sliding open -> Library (top-left)
        const libraryPortal = createPortal({
          label: 'the library',
          roomName: 'library',
          icon: '\u{1F4DA}',
          description: 'a bookshelf slides open',
          position: 'position: absolute; top: 24px; left: 20px;',
          baseColor: 'rgba(180, 160, 120, 0.12)',
          hoverColor: 'rgba(180, 160, 120, 0.6)',
          glowColor: 'rgba(180, 160, 120, 0.1)',
          borderStyle: '1px solid rgba(180, 160, 120, 0.06)',
        })
        navContainer.appendChild(libraryPortal)

        // Spool of thread on desk -> Loom (top-right)
        const loomPortal = createPortal({
          label: 'the loom',
          roomName: 'loom',
          icon: '\u{1F9F5}',
          description: 'a thread unravels',
          position: 'position: absolute; top: 24px; right: 20px;',
          baseColor: 'rgba(200, 160, 80, 0.12)',
          hoverColor: 'rgba(200, 160, 80, 0.6)',
          glowColor: 'rgba(200, 160, 80, 0.1)',
          borderStyle: '1px solid rgba(200, 160, 80, 0.06)',
        })
        navContainer.appendChild(loomPortal)

        // Locked desk drawer -> Cipher (bottom-left)
        const cipherPortal = createPortal({
          label: 'the cipher',
          roomName: 'cipher',
          icon: '\u{1F512}',
          description: 'a drawer with a strange lock',
          position: 'position: absolute; bottom: 50px; left: 20px;',
          baseColor: 'rgba(150, 200, 150, 0.12)',
          hoverColor: 'rgba(150, 200, 150, 0.6)',
          glowColor: 'rgba(150, 200, 150, 0.1)',
          borderStyle: '1px solid rgba(150, 200, 150, 0.06)',
        })
        navContainer.appendChild(cipherPortal)

        // Window to the void -> Void (bottom-right)
        const voidPortal = createPortal({
          label: 'the void',
          roomName: 'void',
          icon: '\u25C6',
          description: 'a window into darkness',
          position: 'position: absolute; bottom: 50px; right: 20px;',
          baseColor: 'rgba(255, 20, 147, 0.12)',
          hoverColor: 'rgba(255, 20, 147, 0.6)',
          glowColor: 'rgba(255, 20, 147, 0.1)',
          borderStyle: '1px solid rgba(255, 20, 147, 0.06)',
        })
        navContainer.appendChild(voidPortal)

        overlay.appendChild(navContainer)
      }

      return overlay
    },

    activate() {
      active = true
      // Track word count for new text emissions
      if (textarea) {
        const text = textarea.value.trim()
        lastWordCount = text ? text.split(/\s+/).length : 0
      }
      // Auto-save every 5 seconds
      saveInterval = window.setInterval(() => {
        if (textarea) saveText(textarea.value)
      }, 5000)
      // Focus textarea after transition
      setTimeout(() => textarea?.focus(), 1600)
      // Start stoic quote cycle
      startQuoteCycle()
    },

    deactivate() {
      active = false
      if (saveInterval) clearInterval(saveInterval)
      if (textarea) saveText(textarea.value)
      stopQuoteCycle()
    },

    destroy() {
      if (saveInterval) clearInterval(saveInterval)
      if (textarea) saveText(textarea.value)
      stopQuoteCycle()
      overlay?.remove()
    },
  }
}
