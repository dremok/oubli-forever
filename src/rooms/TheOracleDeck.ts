/**
 * THE ORACLE DECK — divination from the void
 *
 * Oubli's own tarot system. 78 procedurally-generated cards.
 * Each has a name, a symbol (drawn with simple geometry),
 * and a reading. Click to draw a card. The reading is always
 * relevant because it's vague enough to apply to anything.
 *
 * Cards are drawn from a shuffled deck. When the deck is empty,
 * it reshuffles. The deck remembers how many times you've drawn
 * in localStorage.
 *
 * No memory dependency. Pure procedural divination.
 *
 * Inspired by: Tarot, I Ching, Oblique Strategies (Brian Eno),
 * fortune cookies, bibliomancy, the human need to find meaning
 * in randomness, apophenia as creative force
 */

import type { Room } from './RoomManager'

interface OracleDeckDeps {
  switchTo?: (name: string) => void
}

const STORAGE_KEY = 'oubli-oracle-draws'

interface Card {
  name: string
  suit: string
  symbol: string // geometric description for rendering
  reading: string
  hue: number
}

const SUITS = ['Void', 'Flame', 'Current', 'Stone', 'Breath']
const SUIT_HUES: Record<string, number> = {
  Void: 280, Flame: 15, Current: 200, Stone: 40, Breath: 150,
}

const NAMES = [
  'The Dreamer', 'The Threshold', 'The Echo', 'The Absence',
  'The Wanderer', 'The Keeper', 'The Dissolving', 'The Return',
  'The Signal', 'The Forgotten', 'The Architect', 'The Witness',
  'The Passage', 'The Stillness', 'The Unraveling',
  'One', 'Two', 'Three', 'Four', 'Five',
  'Six', 'Seven', 'Eight', 'Nine', 'Ten',
]

const READINGS = [
  'what you seek is already behind you',
  'the path divides. both ways are correct',
  'silence is the answer you refused to hear',
  'something you abandoned will return transformed',
  'the obstacle IS the way forward',
  'you are holding too tightly',
  'release what no longer serves you',
  'the answer is in the question itself',
  'patience. it is not yet time',
  'now. before the moment passes',
  'look at what you have been avoiding',
  'the smallest change will have the largest effect',
  'what feels like ending is beginning',
  'trust the process you cannot see',
  'you already know. you are afraid to act',
  'the void is not empty. it is full of potential',
  'grief and joy drink from the same well',
  'what you resist persists',
  'you are not lost. you are exploring',
  'the dream and the dreamer are the same thing',
  'stop. breathe. the urgency is an illusion',
  'the connection you seek requires vulnerability',
  'let go of the version of yourself that served you before',
  'beneath the surface, the roots are already growing',
  'the map is not the territory. walk it',
  'forgetting is a form of mercy',
  'what burns away reveals what cannot burn',
  'the mirror shows what you are ready to see',
  'listen to the frequency between the words',
  'the tide will turn. it always does',
  'you are the instrument. play yourself',
  'the house has more rooms than you think',
  'every ending is a door disguised as a wall',
  'the light you seek is the light you carry',
  'surrender is not defeat. it is wisdom',
  'the pattern repeats until you learn its name',
  'what arrives without effort stays longest',
  'you are both the question and the answer',
  'the clock is lying to you. there is enough time',
  'between two thoughts, there is a universe',
]

function generateDeck(): Card[] {
  const deck: Card[] = []
  const symbols = ['circle', 'triangle', 'square', 'diamond', 'cross', 'spiral', 'wave', 'star', 'eye', 'door']

  for (const suit of SUITS) {
    for (let i = 0; i < NAMES.length; i++) {
      // Create unique combos but cycle through to fill 78 cards
      if (deck.length >= 78) break
      deck.push({
        name: `${NAMES[i]} of ${suit}`,
        suit,
        symbol: symbols[(i + SUITS.indexOf(suit) * 3) % symbols.length],
        reading: READINGS[(i * 7 + SUITS.indexOf(suit) * 13) % READINGS.length],
        hue: SUIT_HUES[suit] + (i * 5),
      })
    }
  }

  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }

  return deck
}

export function createOracleDeckRoom(deps?: OracleDeckDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let deck: Card[] = []
  let drawnCard: Card | null = null
  let drawAnimation = 0 // 0-1 for flip animation
  let drawing = false
  let totalDraws = 0
  let deckIndex = 0
  let hoveredNav = -1

  // Tarot/divination arcana labels
  const navPoints = [
    { label: '\u2660 the s\u00e9ance', room: 'seance', xFrac: 0.5, yFrac: 0.04 },
    { label: '\u2666 the madeleine', room: 'madeleine', xFrac: 0.04, yFrac: 0.5 },
    { label: '\u2663 the library', room: 'library', xFrac: 0.96, yFrac: 0.5 },
  ]

  function loadProgress() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) totalDraws = JSON.parse(stored).draws || 0
    } catch {}
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ draws: totalDraws }))
    } catch {}
  }

  function drawCard() {
    if (drawing) return

    if (deckIndex >= deck.length) {
      deck = generateDeck()
      deckIndex = 0
    }

    drawnCard = deck[deckIndex++]
    drawing = true
    drawAnimation = 0
    totalDraws++
    saveProgress()
  }

  function drawSymbol(ctx: CanvasRenderingContext2D, symbol: string, cx: number, cy: number, size: number, alpha: number, hue: number) {
    ctx.strokeStyle = `hsla(${hue}, 40%, 60%, ${alpha})`
    ctx.lineWidth = 1.5

    switch (symbol) {
      case 'circle':
        ctx.beginPath()
        ctx.arc(cx, cy, size, 0, Math.PI * 2)
        ctx.stroke()
        break
      case 'triangle':
        ctx.beginPath()
        ctx.moveTo(cx, cy - size)
        ctx.lineTo(cx - size, cy + size * 0.7)
        ctx.lineTo(cx + size, cy + size * 0.7)
        ctx.closePath()
        ctx.stroke()
        break
      case 'square':
        ctx.strokeRect(cx - size, cy - size, size * 2, size * 2)
        break
      case 'diamond':
        ctx.beginPath()
        ctx.moveTo(cx, cy - size)
        ctx.lineTo(cx + size * 0.7, cy)
        ctx.lineTo(cx, cy + size)
        ctx.lineTo(cx - size * 0.7, cy)
        ctx.closePath()
        ctx.stroke()
        break
      case 'cross':
        ctx.beginPath()
        ctx.moveTo(cx, cy - size)
        ctx.lineTo(cx, cy + size)
        ctx.moveTo(cx - size, cy)
        ctx.lineTo(cx + size, cy)
        ctx.stroke()
        break
      case 'spiral':
        ctx.beginPath()
        for (let t = 0; t < Math.PI * 6; t += 0.1) {
          const r = (t / (Math.PI * 6)) * size
          const x = cx + Math.cos(t) * r
          const y = cy + Math.sin(t) * r
          if (t === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        break
      case 'wave':
        ctx.beginPath()
        for (let x = -size; x <= size; x += 2) {
          const y = Math.sin(x * 0.15) * size * 0.4
          if (x === -size) ctx.moveTo(cx + x, cy + y)
          else ctx.lineTo(cx + x, cy + y)
        }
        ctx.stroke()
        break
      case 'star': {
        ctx.beginPath()
        for (let i = 0; i < 10; i++) {
          const angle = (i * Math.PI) / 5 - Math.PI / 2
          const r = i % 2 === 0 ? size : size * 0.4
          const x = cx + Math.cos(angle) * r
          const y = cy + Math.sin(angle) * r
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.stroke()
        break
      }
      case 'eye':
        ctx.beginPath()
        ctx.arc(cx, cy, size * 0.4, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(cx - size, cy)
        ctx.quadraticCurveTo(cx, cy - size * 0.6, cx + size, cy)
        ctx.quadraticCurveTo(cx, cy + size * 0.6, cx - size, cy)
        ctx.stroke()
        break
      case 'door':
        ctx.strokeRect(cx - size * 0.5, cy - size, size, size * 2)
        ctx.beginPath()
        ctx.arc(cx, cy - size, size * 0.5, 0, Math.PI)
        ctx.stroke()
        break
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height

    // Background
    ctx.fillStyle = 'rgba(8, 5, 15, 1)'
    ctx.fillRect(0, 0, w, h)

    // Update draw animation
    if (drawing && drawAnimation < 1) {
      drawAnimation += 0.02
      if (drawAnimation >= 1) {
        drawAnimation = 1
        drawing = false
      }
    }

    if (drawnCard) {
      const cardW = Math.min(w * 0.4, 280)
      const cardH = cardW * 1.5
      const cardX = w / 2 - cardW / 2
      const cardY = h / 2 - cardH / 2 - 20

      // Card flip effect (scale X during first half of animation)
      const flipProgress = drawAnimation
      const scaleX = flipProgress < 0.5
        ? Math.cos(flipProgress * Math.PI)
        : Math.cos(flipProgress * Math.PI)

      ctx.save()
      ctx.translate(w / 2, h / 2 - 20)
      ctx.scale(Math.abs(scaleX) || 0.01, 1)
      ctx.translate(-w / 2, -(h / 2 - 20))

      if (flipProgress >= 0.5) {
        // Card face (shown after flip midpoint)
        // Card background
        ctx.fillStyle = `rgba(15, 12, 25, 0.95)`
        ctx.fillRect(cardX, cardY, cardW, cardH)

        // Card border
        ctx.strokeStyle = `hsla(${drawnCard.hue}, 30%, 40%, 0.3)`
        ctx.lineWidth = 2
        ctx.strokeRect(cardX + 5, cardY + 5, cardW - 10, cardH - 10)

        // Inner border
        ctx.strokeStyle = `hsla(${drawnCard.hue}, 30%, 40%, 0.1)`
        ctx.lineWidth = 1
        ctx.strokeRect(cardX + 12, cardY + 12, cardW - 24, cardH - 24)

        // Symbol
        const breathe = Math.sin(time * 0.8) * 0.05
        drawSymbol(
          ctx, drawnCard.symbol,
          w / 2, cardY + cardH * 0.35,
          cardW * 0.15,
          0.3 + breathe,
          drawnCard.hue,
        )

        // Card name
        ctx.font = '14px "Cormorant Garamond", serif'
        ctx.fillStyle = `hsla(${drawnCard.hue}, 30%, 65%, 0.5)`
        ctx.textAlign = 'center'
        ctx.fillText(drawnCard.name, w / 2, cardY + cardH * 0.6)

        // Suit
        ctx.font = '9px monospace'
        ctx.fillStyle = `hsla(${drawnCard.hue}, 20%, 50%, 0.2)`
        ctx.fillText(drawnCard.suit.toLowerCase(), w / 2, cardY + cardH * 0.65)

        // Reading
        ctx.font = '11px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(200, 190, 180, ${0.25 + Math.sin(time * 0.5) * 0.05})`

        // Word wrap the reading
        const words = drawnCard.reading.split(' ')
        const maxWidth = cardW - 40
        let line = ''
        let lineY = cardY + cardH * 0.75

        for (const word of words) {
          const test = line + (line ? ' ' : '') + word
          const metrics = ctx.measureText(test)
          if (metrics.width > maxWidth && line) {
            ctx.fillText(line, w / 2, lineY)
            line = word
            lineY += 16
          } else {
            line = test
          }
        }
        if (line) ctx.fillText(line, w / 2, lineY)
      } else {
        // Card back
        ctx.fillStyle = 'rgba(20, 15, 35, 0.95)'
        ctx.fillRect(cardX, cardY, cardW, cardH)
        ctx.strokeStyle = 'rgba(100, 80, 140, 0.2)'
        ctx.lineWidth = 2
        ctx.strokeRect(cardX + 5, cardY + 5, cardW - 10, cardH - 10)

        // Back pattern
        for (let i = 0; i < 5; i++) {
          ctx.strokeStyle = `rgba(100, 80, 140, 0.05)`
          ctx.beginPath()
          ctx.arc(w / 2, h / 2 - 20, 20 + i * 15, 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      ctx.restore()
    }

    // Deck indicator
    ctx.font = '9px monospace'
    ctx.fillStyle = 'rgba(140, 120, 160, 0.1)'
    ctx.textAlign = 'center'
    ctx.fillText(`${78 - deckIndex} cards remaining`, w / 2, h * 0.92)

    // Navigation portals — card suit symbols
    if (deps?.switchTo) {
      for (let i = 0; i < navPoints.length; i++) {
        const np = navPoints[i]
        const nx = w * np.xFrac
        const ny = h * np.yFrac
        const hovered = hoveredNav === i
        const a = hovered ? 0.3 : 0.06
        ctx.font = '9px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(200, 180, 220, ${a})`
        ctx.textAlign = np.xFrac < 0.2 ? 'left' : np.xFrac > 0.8 ? 'right' : 'center'
        ctx.fillText(np.label, nx, ny)
        if (hovered) {
          ctx.fillStyle = 'rgba(200, 180, 220, 0.15)'
          ctx.beginPath()
          ctx.arc(nx, ny + 6, 3, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    // Draw prompt
    if (!drawing) {
      ctx.font = '12px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(200, 180, 220, ${0.1 + Math.sin(time * 1.5) * 0.04})`
      ctx.textAlign = 'center'
      ctx.fillText('click to draw', w / 2, h * 0.96)
    }

    // Title
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 180, 220, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the oracle deck', w / 2, 25)

    // Stats
    ctx.font = '9px monospace'
    ctx.fillStyle = 'rgba(140, 120, 160, 0.06)'
    ctx.textAlign = 'left'
    ctx.fillText(`${totalDraws} readings`, 12, h - 18)
  }

  return {
    name: 'oracle',
    label: 'the oracle deck',

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

      canvas.addEventListener('click', (e) => {
        // Check portal clicks first
        if (deps?.switchTo && canvas) {
          for (let i = 0; i < navPoints.length; i++) {
            const nx = canvas.width * navPoints[i].xFrac
            const ny = canvas.height * navPoints[i].yFrac
            const dx = e.clientX - nx
            const dy = e.clientY - ny
            if (dx * dx + dy * dy < 600) {
              deps.switchTo(navPoints[i].room)
              return
            }
          }
        }
        drawCard()
      })
      canvas.addEventListener('mousemove', (e) => {
        if (!deps?.switchTo || !canvas) return
        hoveredNav = -1
        for (let i = 0; i < navPoints.length; i++) {
          const nx = canvas.width * navPoints[i].xFrac
          const ny = canvas.height * navPoints[i].yFrac
          const dx = e.clientX - nx
          const dy = e.clientY - ny
          if (dx * dx + dy * dy < 600) {
            hoveredNav = i
            break
          }
        }
      })

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)
      return overlay
    },

    activate() {
      active = true
      loadProgress()
      deck = generateDeck()
      deckIndex = 0
      drawnCard = null
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      overlay?.remove()
    },
  }
}
