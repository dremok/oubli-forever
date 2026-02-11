/**
 * THE POSTBOX — letters to your future self
 *
 * A warm candlelit desk where you write letters sealed with wax.
 * Choose when each letter should arrive: 5 minutes, 1 hour, 1 day, or 1 week.
 * When you return and a letter is ready, you find it waiting on the desk.
 * Break the seal. Read words from a self you've already forgotten.
 *
 * Past letters line a shelf on the wall, their ink slowly fading.
 * The postbox is functional: it actually works as a time capsule system.
 *
 * Inspired by:
 * - Virginia Woolf's 3,800 letters ("I write to discover what I know")
 * - Kafka's Letter to His Father (never delivered, eternally preserved)
 * - FutureMe.org (500,000 letters/year to future selves since 2002)
 * - Laisul Hoque "The Ground Beneath Me" (Feb 2026): a room that exists
 *   because its inhabitant left — the letter exists because the writer moved on
 * - J. Cole "The Fall-Off" (Feb 2026): a farewell that refuses to confirm
 *   its own ending — every sealed letter is an ending that might reopen
 * - Message in a bottle from 1886, found in 2019: 133 years in transit
 */

import type { Room } from './RoomManager'
import { shareDeadLetter, fetchDeadLetters, type DeadLetter } from '../shared/FootprintReporter'

interface PostboxDeps {
  switchTo?: (name: string) => void
}

interface SealedLetter {
  id: string
  text: string
  sealedAt: number
  deliverAt: number
  opened: boolean
  openedAt?: number
}

const STORAGE_KEY = 'oubli-postbox-letters'
const MAX_LETTERS = 30

const DELAY_OPTIONS = [
  { label: '5 minutes', ms: 5 * 60 * 1000 },
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '1 day', ms: 24 * 60 * 60 * 1000 },
  { label: '1 week', ms: 7 * 24 * 60 * 60 * 1000 },
]

const CULTURAL_INSCRIPTIONS = [
  'virginia woolf wrote 3,800 letters. "I write to discover what I know."',
  'kafka\'s letter to his father was never delivered. the most important letters are never sent.',
  'futureme.org: 500,000 letters per year to future selves. the inbox as time capsule.',
  'the dead letter office: mail that can never be delivered. washington held 4.7 million.',
  'hoque relocated her bedroom to a gallery. the room exists because the inhabitant left.',
  'j. cole\'s farewell refuses to confirm its own ending. every sealed letter is an open wound.',
  'proust sealed his memories in involuntary triggers. the letter seals itself.',
  'emily dickinson left 1,800 poems in a drawer. letters to a reader who hadn\'t been born yet.',
  'love letters decompose at different rates. the words "I love you" are the last to fade.',
  'a message in a bottle from 1886 was found in 2019. 133 years in transit.',
  'the voyager golden record: a letter to aliens. 40,000 years until it reaches another star.',
  'borges imagined a book with infinite pages. every letter you write adds one.',
  'southern africa flooded — mozambique, zimbabwe, letters washed from houses into rivers. mail that returns to water.',
  '2026 is the new 2016: people write nostalgic letters to the year they thought was the worst. time forgives everything.',
]

function loadLetters(): SealedLetter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch { return [] }
}

function saveLetters(letters: SealedLetter[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(letters))
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'moments ago'
  if (mins < 60) return `${mins} minutes ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`
  const months = Math.floor(days / 30)
  return `${months} month${months !== 1 ? 's' : ''} ago`
}

function formatDuration(ms: number): string {
  if (ms < 0) return 'now'
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${Math.max(1, mins)} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

interface FlameParticle {
  x: number; y: number; vy: number
  life: number; maxLife: number; size: number
}

interface WaxDrip {
  x: number; y: number; vy: number
  alpha: number; size: number
}

export function createPostboxRoom(deps: PostboxDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let letters: SealedLetter[] = []

  // State machine
  let mode: 'idle' | 'compose' | 'received' | 'reading' = 'idle'
  let selectedDelay = 1
  let sealAnimProgress = 0
  let sealAnimating = false

  // HTML overlay elements
  let composeEl: HTMLElement | null = null
  let receivedEl: HTMLElement | null = null
  let readingEl: HTMLElement | null = null
  let textareaEl: HTMLTextAreaElement | null = null

  // Visual effects
  const flameParticles: FlameParticle[] = []
  const waxDrips: WaxDrip[] = []

  // Inscription
  let inscriptionIdx = Math.floor(Math.random() * CULTURAL_INSCRIPTIONS.length)
  let inscriptionTimer = 0

  // Hover
  let hoverTarget: string | null = null

  // Dead letters from other visitors
  let deadLetters: DeadLetter[] = []
  let deadLettersLoaded = false
  let deadLetterDrawerOpen = false
  let deadLetterReading: DeadLetter | null = null
  let deadLetterReadEl: HTMLElement | null = null

  // ── Helpers ──

  function getDeliverable(): SealedLetter[] {
    const now = Date.now()
    return letters.filter(l => !l.opened && l.deliverAt <= now)
  }

  function getShelf(): SealedLetter[] {
    return letters.filter(l => l.opened)
      .sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0))
  }

  function getPending(): SealedLetter[] {
    const now = Date.now()
    return letters.filter(l => !l.opened && l.deliverAt > now)
      .sort((a, b) => a.deliverAt - b.deliverAt)
  }

  function checkDeliveries() {
    if (mode !== 'idle') return
    const deliverable = getDeliverable()
    if (deliverable.length > 0) {
      mode = 'received'
      showReceived(deliverable[0])
    }
  }

  // ── Seal a letter ──

  function sealLetter(text: string) {
    if (!text.trim() || sealAnimating) return
    sealAnimating = true
    sealAnimProgress = 0

    // Drip wax animation
    for (let i = 0; i < 5; i++) {
      waxDrips.push({
        x: window.innerWidth / 2 + (Math.random() - 0.5) * 20,
        y: window.innerHeight * 0.45,
        vy: 0.5 + Math.random(),
        alpha: 0.8,
        size: 3 + Math.random() * 4,
      })
    }

    const animId = setInterval(() => {
      sealAnimProgress += 0.025
      if (sealAnimProgress >= 1) {
        clearInterval(animId)
        sealAnimProgress = 1
        sealAnimating = false

        const letter: SealedLetter = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          text: text.trim(),
          sealedAt: Date.now(),
          deliverAt: Date.now() + DELAY_OPTIONS[selectedDelay].ms,
          opened: false,
        }
        letters.push(letter)

        // Share a fragment to the dead letter office
        const words = text.trim().split(/\s+/)
        const start = Math.floor(Math.random() * Math.max(1, words.length - 8))
        const fragment = words.slice(start, start + Math.min(12, words.length)).join(' ')
        shareDeadLetter(fragment, DELAY_OPTIONS[selectedDelay].label)
        while (letters.length > MAX_LETTERS) {
          const oldest = letters.findIndex(l => l.opened)
          if (oldest >= 0) letters.splice(oldest, 1)
          else break
        }
        saveLetters(letters)

        mode = 'idle'
        hideCompose()
        checkDeliveries()
      }
    }, 16)
  }

  function openLetter(letter: SealedLetter) {
    letter.opened = true
    letter.openedAt = Date.now()
    saveLetters(letters)

    mode = 'reading'
    hideReceived()
    showReading(letter)
  }

  // ── HTML: Compose ──

  function showCompose() {
    if (composeEl) return
    mode = 'compose'

    composeEl = document.createElement('div')
    composeEl.style.cssText = `
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 440px; max-width: 88vw;
      padding: 32px;
      background: rgba(28, 20, 14, 0.96);
      border: 1px solid rgba(180, 140, 80, 0.12);
      border-radius: 2px;
      box-shadow: 0 0 60px rgba(0,0,0,0.6);
      z-index: 10; pointer-events: auto;
      animation: postbox-fadein 0.6s ease;
    `

    // Title
    const title = document.createElement('div')
    title.style.cssText = `
      font-family: 'Cormorant Garamond', serif;
      font-size: 15px; font-weight: 300;
      color: rgba(200, 170, 120, 0.45);
      letter-spacing: 3px; text-transform: lowercase;
      text-align: center; margin-bottom: 20px;
    `
    title.textContent = 'write a letter to your future self'
    composeEl.appendChild(title)

    // Textarea
    textareaEl = document.createElement('textarea')
    textareaEl.placeholder = 'dear future me...'
    textareaEl.style.cssText = `
      width: 100%; height: 160px; box-sizing: border-box;
      background: rgba(40, 30, 20, 0.5);
      border: 1px solid rgba(180, 140, 80, 0.08);
      border-radius: 2px;
      color: rgba(220, 200, 170, 0.8);
      font-family: 'Cormorant Garamond', serif;
      font-size: 17px; line-height: 1.7;
      padding: 16px; resize: none; outline: none;
      letter-spacing: 0.5px;
    `
    // Prevent keyboard events from leaking to other systems
    textareaEl.addEventListener('keydown', (e) => e.stopPropagation())
    textareaEl.addEventListener('keyup', (e) => e.stopPropagation())
    composeEl.appendChild(textareaEl)

    // Delay label
    const delayLabel = document.createElement('div')
    delayLabel.style.cssText = `
      font-family: 'Cormorant Garamond', serif;
      font-size: 12px; color: rgba(200, 170, 120, 0.25);
      text-align: center; margin-top: 16px; margin-bottom: 8px;
      letter-spacing: 2px;
    `
    delayLabel.textContent = 'deliver in'
    composeEl.appendChild(delayLabel)

    // Delay buttons
    const delayRow = document.createElement('div')
    delayRow.style.cssText = 'display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;'
    const delayBtns: HTMLElement[] = []
    DELAY_OPTIONS.forEach((opt, i) => {
      const btn = document.createElement('button')
      btn.textContent = opt.label
      const isActive = i === selectedDelay
      btn.style.cssText = `
        background: transparent;
        border: 1px solid rgba(180, 140, 80, ${isActive ? 0.35 : 0.08});
        color: rgba(200, 170, 120, ${isActive ? 0.65 : 0.25});
        font-family: 'Cormorant Garamond', serif;
        font-size: 14px; padding: 6px 14px;
        cursor: pointer; border-radius: 2px;
        transition: all 0.3s ease; letter-spacing: 1px;
      `
      btn.addEventListener('click', () => {
        selectedDelay = i
        delayBtns.forEach((b, j) => {
          const a = j === i
          b.style.borderColor = a ? 'rgba(180, 140, 80, 0.35)' : 'rgba(180, 140, 80, 0.08)'
          b.style.color = a ? 'rgba(200, 170, 120, 0.65)' : 'rgba(200, 170, 120, 0.25)'
        })
      })
      delayRow.appendChild(btn)
      delayBtns.push(btn)
    })
    composeEl.appendChild(delayRow)

    // Seal button
    const sealBtn = document.createElement('button')
    sealBtn.innerHTML = '<span style="color:rgba(180,40,40,0.8)">●</span> seal with wax'
    sealBtn.style.cssText = `
      display: block; margin: 24px auto 0;
      background: rgba(120, 25, 25, 0.25);
      border: 1px solid rgba(180, 50, 50, 0.25);
      color: rgba(220, 170, 150, 0.65);
      font-family: 'Cormorant Garamond', serif;
      font-size: 15px; padding: 10px 28px;
      cursor: pointer; border-radius: 2px;
      transition: all 0.3s ease; letter-spacing: 2px;
    `
    sealBtn.addEventListener('mouseenter', () => {
      sealBtn.style.background = 'rgba(150, 35, 35, 0.35)'
      sealBtn.style.borderColor = 'rgba(200, 60, 60, 0.4)'
    })
    sealBtn.addEventListener('mouseleave', () => {
      sealBtn.style.background = 'rgba(120, 25, 25, 0.25)'
      sealBtn.style.borderColor = 'rgba(180, 50, 50, 0.25)'
    })
    sealBtn.addEventListener('click', () => {
      if (textareaEl) sealLetter(textareaEl.value)
    })
    composeEl.appendChild(sealBtn)

    // Cancel
    const cancelBtn = document.createElement('div')
    cancelBtn.textContent = 'nevermind'
    cancelBtn.style.cssText = `
      text-align: center; margin-top: 14px;
      font-family: 'Cormorant Garamond', serif;
      font-size: 12px; color: rgba(200, 170, 120, 0.18);
      cursor: pointer; letter-spacing: 1px;
    `
    cancelBtn.addEventListener('click', () => {
      mode = 'idle'
      hideCompose()
      checkDeliveries()
    })
    composeEl.appendChild(cancelBtn)

    overlay?.appendChild(composeEl)
    setTimeout(() => textareaEl?.focus(), 100)
  }

  function hideCompose() {
    composeEl?.remove()
    composeEl = null
    textareaEl = null
  }

  // ── HTML: Received letter ──

  function showReceived(letter: SealedLetter) {
    if (receivedEl) return

    receivedEl = document.createElement('div')
    receivedEl.style.cssText = `
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      z-index: 10; pointer-events: auto; cursor: pointer;
      animation: postbox-fadein 1s ease;
    `

    // Envelope
    const envelope = document.createElement('div')
    envelope.style.cssText = `
      width: 220px; height: 140px;
      background: linear-gradient(135deg, rgba(55, 40, 25, 0.9), rgba(38, 28, 16, 0.95));
      border: 1px solid rgba(180, 140, 80, 0.15);
      margin: 0 auto 20px; position: relative;
      border-radius: 2px;
      box-shadow: 0 6px 30px rgba(0,0,0,0.5);
    `

    // Flap (triangle at top)
    const flap = document.createElement('div')
    flap.style.cssText = `
      position: absolute; top: -1px; left: -1px; right: -1px;
      height: 50px;
      background: linear-gradient(to bottom, rgba(65, 48, 30, 0.9), transparent);
      clip-path: polygon(0 0, 50% 100%, 100% 0);
      border-top: 1px solid rgba(180, 140, 80, 0.15);
    `
    envelope.appendChild(flap)

    // Wax seal
    const seal = document.createElement('div')
    seal.style.cssText = `
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 44px; height: 44px;
      background: radial-gradient(circle at 38% 35%,
        rgba(190, 45, 45, 0.95),
        rgba(130, 20, 20, 0.85));
      border-radius: 50%;
      box-shadow: 0 2px 10px rgba(0,0,0,0.5),
        inset 0 1px 3px rgba(255,200,200,0.15),
        inset 0 -2px 4px rgba(60,0,0,0.3);
    `
    // Seal letter
    const sealLetter = document.createElement('div')
    sealLetter.style.cssText = `
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      font-family: 'Cormorant Garamond', serif;
      font-size: 18px; font-weight: 600;
      color: rgba(255, 200, 180, 0.4);
    `
    sealLetter.textContent = 'O'
    seal.appendChild(sealLetter)
    envelope.appendChild(seal)
    receivedEl.appendChild(envelope)

    // Info
    const info = document.createElement('div')
    info.style.cssText = `
      font-family: 'Cormorant Garamond', serif;
      font-size: 14px; color: rgba(200, 170, 120, 0.35);
      letter-spacing: 2px; margin-bottom: 10px;
    `
    info.textContent = `sealed ${formatTimeAgo(letter.sealedAt)}`
    receivedEl.appendChild(info)

    const hint = document.createElement('div')
    hint.style.cssText = `
      font-family: 'Cormorant Garamond', serif;
      font-size: 13px; color: rgba(200, 170, 120, 0.2);
      letter-spacing: 1px;
      animation: postbox-pulse 2s ease-in-out infinite;
    `
    hint.textContent = 'click to break the seal'
    receivedEl.appendChild(hint)

    receivedEl.addEventListener('click', () => openLetter(letter))
    overlay?.appendChild(receivedEl)
  }

  function hideReceived() {
    receivedEl?.remove()
    receivedEl = null
  }

  // ── HTML: Reading a letter ──

  function showReading(letter: SealedLetter) {
    if (readingEl) return

    readingEl = document.createElement('div')
    readingEl.style.cssText = `
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 440px; max-width: 88vw;
      padding: 36px;
      background: rgba(28, 20, 14, 0.96);
      border: 1px solid rgba(180, 140, 80, 0.12);
      border-radius: 2px;
      box-shadow: 0 0 60px rgba(0,0,0,0.6);
      z-index: 10; pointer-events: auto;
      opacity: 0; transition: opacity 1.5s ease;
    `

    // Broken seal indicator
    const brokenSeal = document.createElement('div')
    brokenSeal.style.cssText = `
      text-align: center; margin-bottom: 20px;
    `
    brokenSeal.innerHTML = `
      <span style="
        display: inline-block; width: 36px; height: 36px;
        background: radial-gradient(circle at 38% 35%,
          rgba(100, 30, 30, 0.5), rgba(60, 15, 15, 0.4));
        border-radius: 50%;
        box-shadow: inset 0 0 6px rgba(0,0,0,0.3);
        line-height: 36px;
        font-family: 'Cormorant Garamond', serif;
        font-size: 14px; color: rgba(200, 150, 130, 0.25);
      ">O</span>
    `
    readingEl.appendChild(brokenSeal)

    const header = document.createElement('div')
    header.style.cssText = `
      font-family: 'Cormorant Garamond', serif;
      font-size: 12px; color: rgba(200, 170, 120, 0.25);
      letter-spacing: 2px; text-align: center;
      margin-bottom: 24px;
    `
    header.textContent = `you wrote this ${formatTimeAgo(letter.sealedAt)}`
    readingEl.appendChild(header)

    const content = document.createElement('div')
    content.style.cssText = `
      font-family: 'Cormorant Garamond', serif;
      font-size: 18px; line-height: 1.8;
      color: rgba(220, 200, 170, 0.7);
      white-space: pre-wrap; word-wrap: break-word;
      padding: 20px;
      border-left: 2px solid rgba(180, 140, 80, 0.1);
      min-height: 60px;
    `
    content.textContent = letter.text
    readingEl.appendChild(content)

    const closeBtn = document.createElement('div')
    closeBtn.textContent = 'fold and shelve'
    closeBtn.style.cssText = `
      text-align: center; margin-top: 28px;
      font-family: 'Cormorant Garamond', serif;
      font-size: 13px; color: rgba(200, 170, 120, 0.25);
      cursor: pointer; letter-spacing: 2px;
      transition: color 0.3s;
    `
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.color = 'rgba(200, 170, 120, 0.5)'
    })
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.color = 'rgba(200, 170, 120, 0.25)'
    })
    closeBtn.addEventListener('click', () => {
      mode = 'idle'
      hideReading()
      checkDeliveries()
    })
    readingEl.appendChild(closeBtn)

    overlay?.appendChild(readingEl)
    requestAnimationFrame(() => {
      if (readingEl) readingEl.style.opacity = '1'
    })
  }

  function hideReading() {
    readingEl?.remove()
    readingEl = null
  }

  // ── Portal definitions ──

  const portals = [
    { name: 'study', label: 'the study', pos: 'tl' as const },
    { name: 'clocktower', label: 'the clock tower', pos: 'tr' as const },
    { name: 'madeleine', label: 'the madeleine', pos: 'br' as const },
    { name: 'void', label: 'the void', pos: 'bl' as const },
  ]

  function portalXY(pos: string, w: number, h: number): [number, number] {
    const m = 55
    switch (pos) {
      case 'tl': return [m, m]
      case 'tr': return [w - m, m]
      case 'bl': return [m, h - 50]
      case 'br': return [w - m, h - 50]
      default: return [m, m]
    }
  }

  // ── Canvas render ──

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height

    ctx.clearRect(0, 0, w, h)

    // Background — warm dark
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, 'rgb(14, 10, 7)')
    bg.addColorStop(0.4, 'rgb(18, 13, 9)')
    bg.addColorStop(1, 'rgb(16, 11, 7)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // Desk surface
    const deskY = h * 0.52
    const deskGrad = ctx.createLinearGradient(0, deskY, 0, h)
    deskGrad.addColorStop(0, 'rgba(38, 26, 16, 0.9)')
    deskGrad.addColorStop(0.05, 'rgba(32, 22, 14, 0.95)')
    deskGrad.addColorStop(1, 'rgba(22, 15, 9, 1)')
    ctx.fillStyle = deskGrad
    ctx.fillRect(0, deskY, w, h - deskY)

    // Desk edge
    ctx.strokeStyle = 'rgba(100, 70, 40, 0.12)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, deskY)
    ctx.lineTo(w, deskY)
    ctx.stroke()

    // Wood grain
    ctx.strokeStyle = 'rgba(55, 38, 22, 0.05)'
    ctx.lineWidth = 0.5
    for (let i = 0; i < 25; i++) {
      const gy = deskY + 8 + (i * (h - deskY) / 25)
      ctx.beginPath()
      for (let x = 0; x < w; x += 15) {
        const yy = gy + Math.sin(x * 0.008 + i * 0.6) * 1.5
        if (x === 0) ctx.moveTo(x, yy)
        else ctx.lineTo(x, yy)
      }
      ctx.stroke()
    }

    // ── Candle ──
    const cx = w - 80
    const cy = deskY - 8

    // Candle body
    const candleGrad = ctx.createLinearGradient(cx - 7, cy - 45, cx + 7, cy - 45)
    candleGrad.addColorStop(0, 'rgba(210, 195, 170, 0.12)')
    candleGrad.addColorStop(0.5, 'rgba(220, 205, 180, 0.18)')
    candleGrad.addColorStop(1, 'rgba(190, 175, 150, 0.1)')
    ctx.fillStyle = candleGrad
    ctx.fillRect(cx - 7, cy - 45, 14, 45)

    // Candle holder
    ctx.fillStyle = 'rgba(120, 90, 50, 0.15)'
    ctx.beginPath()
    ctx.ellipse(cx, cy, 14, 5, 0, 0, Math.PI * 2)
    ctx.fill()

    // Wick
    ctx.strokeStyle = 'rgba(60, 40, 25, 0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx, cy - 45)
    ctx.lineTo(cx, cy - 52)
    ctx.stroke()

    // Flame
    const flicker = Math.sin(time * 9) * 0.12 + Math.sin(time * 14.7) * 0.08 + Math.sin(time * 5.3) * 0.05
    const flameH = 15 + flicker * 5
    const flameW = 5.5 + flicker * 2

    // Warm glow on the room
    const warmGlow = ctx.createRadialGradient(cx, cy - 55, 0, cx, cy - 40, 200)
    warmGlow.addColorStop(0, `rgba(255, 180, 60, ${0.04 + flicker * 0.015})`)
    warmGlow.addColorStop(0.3, `rgba(255, 140, 40, ${0.015 + flicker * 0.005})`)
    warmGlow.addColorStop(1, 'transparent')
    ctx.fillStyle = warmGlow
    ctx.beginPath()
    ctx.arc(cx, cy - 40, 200, 0, Math.PI * 2)
    ctx.fill()

    // Flame shape
    const fGrad = ctx.createRadialGradient(cx, cy - 52 - flameH * 0.3, 1, cx, cy - 52 - flameH * 0.45, flameH * 0.55)
    fGrad.addColorStop(0, 'rgba(255, 255, 230, 0.85)')
    fGrad.addColorStop(0.25, 'rgba(255, 210, 80, 0.65)')
    fGrad.addColorStop(0.6, 'rgba(255, 130, 20, 0.35)')
    fGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = fGrad
    ctx.beginPath()
    ctx.moveTo(cx, cy - 52)
    ctx.quadraticCurveTo(cx - flameW, cy - 52 - flameH * 0.45, cx + flicker * 2.5, cy - 52 - flameH)
    ctx.quadraticCurveTo(cx + flameW, cy - 52 - flameH * 0.45, cx, cy - 52)
    ctx.fill()

    // Flame particles
    if (Math.random() < 0.35) {
      flameParticles.push({
        x: cx + (Math.random() - 0.5) * 5,
        y: cy - 52 - flameH,
        vy: -0.6 - Math.random() * 1.2,
        life: 0, maxLife: 0.4 + Math.random() * 0.4,
        size: 0.4 + Math.random() * 1.5,
      })
    }
    for (let i = flameParticles.length - 1; i >= 0; i--) {
      const p = flameParticles[i]
      p.y += p.vy
      p.x += (Math.random() - 0.5) * 0.4
      p.life += 0.016
      if (p.life > p.maxLife) { flameParticles.splice(i, 1); continue }
      const a = (1 - p.life / p.maxLife) * 0.35
      ctx.fillStyle = `rgba(255, 180, 60, ${a})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * (1 - p.life / p.maxLife * 0.5), 0, Math.PI * 2)
      ctx.fill()
    }
    while (flameParticles.length > 25) flameParticles.shift()

    // Wax drips
    for (let i = waxDrips.length - 1; i >= 0; i--) {
      const d = waxDrips[i]
      d.y += d.vy
      d.alpha -= 0.008
      if (d.alpha <= 0) { waxDrips.splice(i, 1); continue }
      ctx.fillStyle = `rgba(160, 35, 35, ${d.alpha})`
      ctx.beginPath()
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2)
      ctx.fill()
    }

    // ── Shelf of opened letters (left wall) ──
    const shelf = getShelf()
    if (shelf.length > 0) {
      const sx = 28, sy = 55
      ctx.font = '11px "Cormorant Garamond", serif'
      ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(200, 170, 120, 0.12)'
      ctx.fillText('opened letters', sx, sy - 10)

      const maxVis = Math.min(shelf.length, 8)
      for (let i = 0; i < maxVis; i++) {
        const sl = shelf[i]
        const ly = sy + i * 28
        const ageDays = sl.openedAt ? (Date.now() - sl.openedAt) / (24 * 60 * 60 * 1000) : 0
        const fade = Math.max(0.15, 1 - ageDays / 60)

        // Letter rect
        ctx.fillStyle = `rgba(45, 33, 22, ${0.25 * fade})`
        ctx.fillRect(sx, ly, 175, 22)
        ctx.strokeStyle = `rgba(100, 75, 45, ${0.08 * fade})`
        ctx.lineWidth = 0.5
        ctx.strokeRect(sx, ly, 175, 22)

        // Broken seal dot
        ctx.fillStyle = `rgba(100, 30, 30, ${0.25 * fade})`
        ctx.beginPath()
        ctx.arc(sx + 10, ly + 11, 3.5, 0, Math.PI * 2)
        ctx.fill()

        // Preview text
        ctx.font = '11px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(200, 180, 150, ${0.25 * fade})`
        ctx.fillText(sl.text.slice(0, 22) + (sl.text.length > 22 ? '…' : ''), sx + 20, ly + 14)
      }
      if (shelf.length > maxVis) {
        ctx.fillStyle = 'rgba(200, 170, 120, 0.08)'
        ctx.fillText(`+ ${shelf.length - maxVis} more`, sx, sy + maxVis * 28 + 14)
      }
    }

    // ── Pending letters (right side) ──
    const pending = getPending()
    if (pending.length > 0) {
      const px = w - 210, py = 55
      ctx.font = '11px "Cormorant Garamond", serif'
      ctx.textAlign = 'right'
      ctx.fillStyle = 'rgba(200, 170, 120, 0.12)'
      ctx.fillText('in transit', px + 170, py - 10)

      ctx.textAlign = 'left'
      for (let i = 0; i < Math.min(pending.length, 5); i++) {
        const pl = pending[i]
        const ly = py + i * 28
        const remains = pl.deliverAt - Date.now()

        ctx.fillStyle = 'rgba(45, 33, 22, 0.2)'
        ctx.fillRect(px, ly, 170, 22)

        // Sealed indicator
        ctx.fillStyle = 'rgba(160, 40, 40, 0.35)'
        ctx.beginPath()
        ctx.arc(px + 10, ly + 11, 3.5, 0, Math.PI * 2)
        ctx.fill()

        ctx.font = '11px "Cormorant Garamond", serif'
        ctx.fillStyle = 'rgba(200, 170, 120, 0.2)'
        ctx.fillText(`arrives in ${formatDuration(remains)}`, px + 20, ly + 14)
      }
    }

    // ── Idle prompt ──
    if (mode === 'idle' && getDeliverable().length === 0) {
      const py = deskY + (h - deskY) * 0.3

      // Subtle parchment area
      const parchW = 260, parchH = 80
      const parchX = w / 2 - parchW / 2
      const parchY2 = py - 25
      ctx.fillStyle = 'rgba(50, 38, 25, 0.08)'
      ctx.fillRect(parchX, parchY2, parchW, parchH)
      ctx.strokeStyle = 'rgba(120, 90, 55, 0.06)'
      ctx.lineWidth = 0.5
      ctx.strokeRect(parchX, parchY2, parchW, parchH)

      ctx.font = '15px "Cormorant Garamond", serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = `rgba(200, 170, 120, ${0.18 + Math.sin(time * 0.6) * 0.03})`
      ctx.fillText('click to write a letter', w / 2, py)

      ctx.font = '12px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(200, 170, 120, 0.08)'
      ctx.fillText('it will arrive when you\'ve forgotten writing it', w / 2, py + 22)
    }

    // ── Seal animation ──
    if (sealAnimating && sealAnimProgress > 0) {
      const sealR = 25
      const sealX = w / 2
      const sealY = h * 0.42
      const progress = sealAnimProgress

      // Growing wax circle
      const curR = sealR * progress
      const sealGrad = ctx.createRadialGradient(sealX, sealY, 0, sealX, sealY, curR)
      sealGrad.addColorStop(0, `rgba(180, 40, 40, ${0.8 * progress})`)
      sealGrad.addColorStop(0.7, `rgba(140, 25, 25, ${0.7 * progress})`)
      sealGrad.addColorStop(1, `rgba(100, 15, 15, ${0.3 * progress})`)
      ctx.fillStyle = sealGrad
      ctx.beginPath()
      ctx.arc(sealX, sealY, curR, 0, Math.PI * 2)
      ctx.fill()

      if (progress > 0.5) {
        ctx.font = '16px "Cormorant Garamond", serif'
        ctx.textAlign = 'center'
        ctx.fillStyle = `rgba(255, 200, 180, ${(progress - 0.5) * 0.5})`
        ctx.fillText('O', sealX, sealY + 5)
      }
    }

    // ── Cultural inscription ──
    inscriptionTimer += 0.016
    if (inscriptionTimer >= 22) {
      inscriptionTimer = 0
      inscriptionIdx = (inscriptionIdx + 1) % CULTURAL_INSCRIPTIONS.length
    }
    let insAlpha = 0
    if (inscriptionTimer < 1.5) insAlpha = inscriptionTimer / 1.5
    else if (inscriptionTimer > 20) insAlpha = (22 - inscriptionTimer) / 2
    else insAlpha = 1
    insAlpha *= 0.03

    ctx.font = '11px "Cormorant Garamond", serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = `rgba(200, 170, 120, ${insAlpha})`
    ctx.fillText(CULTURAL_INSCRIPTIONS[inscriptionIdx], w / 2, h - 18, w * 0.85)

    // ── Dead letter drawer ──
    if (deadLettersLoaded && deadLetters.length > 0 && mode === 'idle' && !deadLetterDrawerOpen) {
      const drawerX = w / 2
      const drawerY = h * 0.52 + (h - h * 0.52) * 0.68
      const isDrawerHover = hoverTarget === 'dead-drawer'
      const drawerAlpha = isDrawerHover ? 0.3 : (0.1 + Math.sin(time * 0.7) * 0.02)

      // Drawer shape — a small drawer in the desk
      ctx.fillStyle = `rgba(35, 25, 16, ${drawerAlpha * 2})`
      ctx.fillRect(drawerX - 75, drawerY - 10, 150, 22)
      ctx.strokeStyle = `rgba(120, 90, 55, ${drawerAlpha})`
      ctx.lineWidth = 0.5
      ctx.strokeRect(drawerX - 75, drawerY - 10, 150, 22)

      // Drawer handle
      ctx.fillStyle = `rgba(150, 110, 60, ${drawerAlpha * 1.5})`
      ctx.fillRect(drawerX - 10, drawerY - 2, 20, 6)

      ctx.font = '10px "Cormorant Garamond", serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = `rgba(180, 150, 100, ${drawerAlpha * 0.9})`
      ctx.fillText(`dead letters · ${deadLetters.length}`, drawerX, drawerY + 26)
    }

    // ── Open drawer view ──
    if (deadLetterDrawerOpen && deadLetters.length > 0 && mode === 'idle') {
      const dY = h * 0.52 + 20
      const maxShow = Math.min(deadLetters.length, 5)

      // Drawer background
      ctx.fillStyle = 'rgba(22, 16, 10, 0.85)'
      ctx.fillRect(w / 2 - 180, dY, 360, maxShow * 42 + 40)
      ctx.strokeStyle = 'rgba(100, 75, 45, 0.1)'
      ctx.lineWidth = 0.5
      ctx.strokeRect(w / 2 - 180, dY, 360, maxShow * 42 + 40)

      ctx.font = '11px "Cormorant Garamond", serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(120, 150, 180, 0.2)'
      ctx.fillText('uncollected letters from other visitors', w / 2, dY + 18)

      for (let i = 0; i < maxShow; i++) {
        const dl = deadLetters[i]
        const ly = dY + 30 + i * 42
        const isHov = hoverTarget === `dead-${i}`
        const ageHours = dl.age / (1000 * 60 * 60)
        const fade = Math.max(0.25, 1 - ageHours / 168) // fade over 1 week

        // Letter background
        ctx.fillStyle = `rgba(40, 35, 28, ${isHov ? 0.45 : 0.2})`
        ctx.fillRect(w / 2 - 160, ly, 320, 34)

        if (isHov) {
          ctx.strokeStyle = 'rgba(100, 130, 170, 0.15)'
          ctx.lineWidth = 0.5
          ctx.strokeRect(w / 2 - 160, ly, 320, 34)
        }

        // Ghost seal
        ctx.fillStyle = `rgba(80, 90, 120, ${0.2 * fade})`
        ctx.beginPath()
        ctx.arc(w / 2 - 145, ly + 17, 4, 0, Math.PI * 2)
        ctx.fill()

        // Fragment text — partially obscured
        ctx.font = '13px "Cormorant Garamond", serif'
        ctx.textAlign = 'left'
        ctx.fillStyle = `rgba(140, 160, 190, ${0.35 * fade})`
        const visibleText = dl.fragment.length > 40 ? dl.fragment.slice(0, 40) + '…' : dl.fragment
        ctx.fillText(`"${visibleText}"`, w / 2 - 130, ly + 20)

        // Delay hint
        ctx.font = '9px "Cormorant Garamond", serif'
        ctx.textAlign = 'right'
        ctx.fillStyle = `rgba(120, 140, 170, ${0.15 * fade})`
        ctx.fillText(dl.delay ? `sealed for ${dl.delay}` : 'sealed', w / 2 + 150, ly + 20)
      }

      // Close hint
      ctx.font = '10px "Cormorant Garamond", serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(150, 130, 100, 0.12)'
      ctx.fillText('click outside to close', w / 2, dY + maxShow * 42 + 34)
    }

    // ── Navigation portals ──
    if (deps.switchTo) {
      for (const portal of portals) {
        const [ppx, ppy] = portalXY(portal.pos, w, h)
        const isHover = hoverTarget === portal.name
        const pulse = 0.5 + 0.5 * Math.sin(time * 1.3 + portals.indexOf(portal) * 1.7)
        const glow = isHover ? 0.25 : (0.07 + pulse * 0.03)

        const grad = ctx.createRadialGradient(ppx, ppy, 0, ppx, ppy, isHover ? 32 : 22)
        grad.addColorStop(0, `rgba(180, 140, 80, ${glow})`)
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(ppx, ppy, isHover ? 32 : 22, 0, Math.PI * 2)
        ctx.fill()

        ctx.font = `${isHover ? 12 : 11}px "Cormorant Garamond", serif`
        ctx.textAlign = 'center'
        ctx.fillStyle = `rgba(200, 170, 120, ${glow * 1.2})`
        ctx.fillText(portal.label, ppx, ppy + 4)
      }
    }
  }

  // ── Event handlers ──

  function handleClick(e: MouseEvent) {
    if (!canvas || !active) return
    const rect = canvas.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width)
    const my = (e.clientY - rect.top) * (canvas.height / rect.height)
    const w = canvas.width
    const h = canvas.height

    // Portal clicks
    if (deps.switchTo) {
      for (const portal of portals) {
        const [ppx, ppy] = portalXY(portal.pos, w, h)
        if (Math.hypot(mx - ppx, my - ppy) < 30) {
          deps.switchTo(portal.name)
          return
        }
      }
    }

    // Dead letter drawer interactions
    if (mode === 'idle' && deadLettersLoaded && deadLetters.length > 0) {
      const deskY = h * 0.52

      if (deadLetterDrawerOpen) {
        const dY = deskY + 20
        const maxShow = Math.min(deadLetters.length, 5)

        // Check if clicking a dead letter
        for (let i = 0; i < maxShow; i++) {
          const ly = dY + 30 + i * 42
          if (mx > w / 2 - 160 && mx < w / 2 + 160 && my > ly && my < ly + 34) {
            showDeadLetterReading(deadLetters[i])
            return
          }
        }

        // Click outside drawer → close
        deadLetterDrawerOpen = false
        return
      }

      // Click drawer handle
      const drawerX = w / 2
      const drawerY = deskY + (h - deskY) * 0.68
      if (mx > drawerX - 75 && mx < drawerX + 75 && my > drawerY - 10 && my < drawerY + 30) {
        deadLetterDrawerOpen = true
        return
      }
    }

    // Desk click → compose
    if (mode === 'idle' && getDeliverable().length === 0 && !deadLetterDrawerOpen) {
      const deskY = h * 0.52
      if (my > deskY * 0.85) {
        showCompose()
      }
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width)
    const my = (e.clientY - rect.top) * (canvas.height / rect.height)
    const w = canvas.width
    const h = canvas.height

    hoverTarget = null
    let cursorStyle = 'default'

    // Portal hover
    if (deps.switchTo) {
      for (const portal of portals) {
        const [ppx, ppy] = portalXY(portal.pos, w, h)
        if (Math.hypot(mx - ppx, my - ppy) < 30) {
          hoverTarget = portal.name
          cursorStyle = 'pointer'
          break
        }
      }
    }

    // Dead letter drawer hover
    if (mode === 'idle' && deadLettersLoaded && deadLetters.length > 0 && !hoverTarget) {
      const deskY = h * 0.52

      if (deadLetterDrawerOpen) {
        const dY = deskY + 20
        const maxShow = Math.min(deadLetters.length, 5)
        for (let i = 0; i < maxShow; i++) {
          const ly = dY + 30 + i * 42
          if (mx > w / 2 - 160 && mx < w / 2 + 160 && my > ly && my < ly + 34) {
            hoverTarget = `dead-${i}`
            cursorStyle = 'pointer'
            break
          }
        }
      } else {
        const drawerX = w / 2
        const drawerY = deskY + (h - deskY) * 0.68
        if (mx > drawerX - 75 && mx < drawerX + 75 && my > drawerY - 10 && my < drawerY + 30) {
          hoverTarget = 'dead-drawer'
          cursorStyle = 'pointer'
        }
      }
    }

    // Desk area hover
    const deskY = h * 0.52
    if (mode === 'idle' && getDeliverable().length === 0 && my > deskY * 0.85 && !hoverTarget && !deadLetterDrawerOpen) {
      cursorStyle = 'pointer'
    }

    canvas.style.cursor = cursorStyle
  }

  // ── Dead letter functions ──

  function loadDeadLetters() {
    fetchDeadLetters().then(data => {
      if (data && data.letters.length > 0) {
        deadLetters = data.letters
        deadLettersLoaded = true
      }
    })
  }

  function showDeadLetterReading(dl: DeadLetter) {
    if (deadLetterReadEl) return
    deadLetterDrawerOpen = false

    deadLetterReadEl = document.createElement('div')
    deadLetterReadEl.style.cssText = `
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 400px; max-width: 85vw;
      padding: 32px;
      background: rgba(20, 22, 30, 0.96);
      border: 1px solid rgba(100, 130, 170, 0.1);
      border-radius: 2px;
      box-shadow: 0 0 50px rgba(0,0,0,0.6);
      z-index: 10; pointer-events: auto;
      animation: postbox-fadein 0.8s ease;
    `

    // Ghost seal
    const seal = document.createElement('div')
    seal.style.cssText = 'text-align: center; margin-bottom: 18px;'
    seal.innerHTML = `
      <span style="
        display: inline-block; width: 32px; height: 32px;
        background: radial-gradient(circle at 38% 35%,
          rgba(70, 80, 110, 0.4), rgba(50, 55, 75, 0.3));
        border-radius: 50%;
        box-shadow: inset 0 0 6px rgba(0,0,0,0.2);
        line-height: 32px;
        font-family: 'Cormorant Garamond', serif;
        font-size: 13px; color: rgba(140, 160, 200, 0.2);
      ">?</span>
    `
    deadLetterReadEl.appendChild(seal)

    const header = document.createElement('div')
    header.style.cssText = `
      font-family: 'Cormorant Garamond', serif;
      font-size: 11px; color: rgba(120, 150, 190, 0.2);
      letter-spacing: 2px; text-align: center;
      margin-bottom: 20px;
    `
    const ageH = Math.floor(dl.age / (1000 * 60 * 60))
    const ageStr = ageH < 1 ? 'moments ago' : ageH < 24 ? `${ageH} hours ago` : `${Math.floor(ageH / 24)} days ago`
    header.textContent = `a stranger sealed this ${ageStr}` + (dl.delay ? ` · meant to arrive in ${dl.delay}` : '')
    deadLetterReadEl.appendChild(header)

    const content = document.createElement('div')
    content.style.cssText = `
      font-family: 'Cormorant Garamond', serif;
      font-size: 17px; line-height: 1.8;
      color: rgba(150, 170, 200, 0.5);
      white-space: pre-wrap; word-wrap: break-word;
      padding: 18px;
      border-left: 2px solid rgba(100, 130, 170, 0.08);
      font-style: italic;
      min-height: 40px;
    `
    // Partially degrade the text — replace some characters with thin spaces
    let degraded = ''
    for (let i = 0; i < dl.fragment.length; i++) {
      if (dl.fragment[i] === ' ') {
        degraded += ' '
      } else if (Math.random() < 0.12) {
        degraded += '\u2009' // thin space — a hole in the text
      } else {
        degraded += dl.fragment[i]
      }
    }
    content.textContent = `…${degraded}…`
    deadLetterReadEl.appendChild(content)

    const note = document.createElement('div')
    note.style.cssText = `
      font-family: 'Cormorant Garamond', serif;
      font-size: 10px; color: rgba(120, 140, 170, 0.12);
      text-align: center; margin-top: 16px;
      letter-spacing: 1px;
    `
    note.textContent = 'this letter was never collected'
    deadLetterReadEl.appendChild(note)

    const closeBtn = document.createElement('div')
    closeBtn.textContent = 'return to drawer'
    closeBtn.style.cssText = `
      text-align: center; margin-top: 20px;
      font-family: 'Cormorant Garamond', serif;
      font-size: 12px; color: rgba(140, 160, 190, 0.2);
      cursor: pointer; letter-spacing: 2px;
      transition: color 0.3s;
    `
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.color = 'rgba(140, 160, 190, 0.4)'
    })
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.color = 'rgba(140, 160, 190, 0.2)'
    })
    closeBtn.addEventListener('click', () => {
      hideDeadLetterReading()
    })
    deadLetterReadEl.appendChild(closeBtn)

    overlay?.appendChild(deadLetterReadEl)
  }

  function hideDeadLetterReading() {
    deadLetterReadEl?.remove()
    deadLetterReadEl = null
    deadLetterReading = null
  }

  return {
    name: 'postbox',
    label: 'the postbox',

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        width: 100%; height: 100%;
        position: relative; pointer-events: auto;
      `

      // Inject animations
      const style = document.createElement('style')
      style.textContent = `
        @keyframes postbox-fadein {
          from { opacity: 0; transform: translate(-50%, -48%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
        @keyframes postbox-pulse {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.4; }
        }
      `
      overlay.appendChild(style)

      canvas = document.createElement('canvas')
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      canvas.style.cssText = 'width: 100%; height: 100%;'
      ctx = canvas.getContext('2d')

      canvas.addEventListener('click', handleClick)
      canvas.addEventListener('mousemove', handleMouseMove)
      overlay.appendChild(canvas)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      return overlay
    },

    activate() {
      active = true
      letters = loadLetters()
      mode = 'idle'
      deadLetterDrawerOpen = false
      checkDeliveries()
      render()

      // Load dead letters from other visitors
      setTimeout(() => {
        if (active) loadDeadLetters()
      }, 2500)
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      hideCompose()
      hideReceived()
      hideReading()
      hideDeadLetterReading()
      deadLetterDrawerOpen = false
      mode = 'idle'
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      hideCompose()
      hideReceived()
      hideReading()
      hideDeadLetterReading()
      overlay?.remove()
    },
  }
}
