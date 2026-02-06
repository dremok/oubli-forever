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
 *
 * Inspired by: iA Writer, Hemingway's standing desk,
 * Japanese tea ceremony (minimal, intentional, present)
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'

const STORAGE_KEY = 'oubli-study'
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

export function createStudyRoom(getMemories: () => StoredMemory[]): Room {
  let overlay: HTMLElement | null = null
  let textarea: HTMLTextAreaElement | null = null
  let promptEl: HTMLElement | null = null
  let countEl: HTMLElement | null = null
  let saveInterval: number | null = null
  let active = false

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
    countEl.textContent = `${words} words · ${chars} characters`
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
      textarea.addEventListener('input', updateCount)
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

      return overlay
    },

    activate() {
      active = true
      // Auto-save every 5 seconds
      saveInterval = window.setInterval(() => {
        if (textarea) saveText(textarea.value)
      }, 5000)
      // Focus textarea after transition
      setTimeout(() => textarea?.focus(), 1600)
    },

    deactivate() {
      active = false
      if (saveInterval) clearInterval(saveInterval)
      if (textarea) saveText(textarea.value)
    },

    destroy() {
      if (saveInterval) clearInterval(saveInterval)
      if (textarea) saveText(textarea.value)
      overlay?.remove()
    },
  }
}
