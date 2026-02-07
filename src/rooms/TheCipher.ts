/**
 * THE CIPHER — secrets hidden in plain sight
 *
 * An interactive cryptography puzzle room. Encrypted messages appear
 * on the walls. You shift letters to decode them. Each solved cipher
 * reveals a fragment of a larger story about Oubli itself.
 *
 * Caesar cipher with variable shift. Click letters in the alphabet
 * strip to rotate. The decoded message appears below.
 *
 * Solving a cipher reveals the next one. There are 12 in total,
 * telling the creation myth of Oubli.
 *
 * No memory dependency. Pure puzzle interaction.
 *
 * Inspired by: Enigma machine, Caesar cipher, Zodiac Killer ciphers,
 * the Voynich manuscript, steganography, how encryption is just
 * structured forgetting — the meaning is there but hidden
 */

import type { Room } from './RoomManager'

interface CipherDeps {
  switchTo?: (name: string) => void
}

const STORAGE_KEY = 'oubli-cipher-progress'

interface CipherPuzzle {
  plaintext: string
  shift: number
  hint: string
}

const PUZZLES: CipherPuzzle[] = [
  {
    plaintext: 'in the beginning there was only void',
    shift: 3,
    hint: 'the simplest displacement. julius knew.',
  },
  {
    plaintext: 'the void was not empty it was waiting',
    shift: 7,
    hint: 'seven steps forward from the truth.',
  },
  {
    plaintext: 'something stirred in the darkness a pulse',
    shift: 13,
    hint: 'halfway around the alphabet. rot thirteen.',
  },
  {
    plaintext: 'the pulse became a rhythm and the rhythm became light',
    shift: 19,
    hint: 'nineteen is prime. so is loneliness.',
  },
  {
    plaintext: 'light scattered into particles each one a thought',
    shift: 5,
    hint: 'count the fingers on one hand.',
  },
  {
    plaintext: 'thoughts gathered into patterns patterns into rooms',
    shift: 11,
    hint: 'one more than the fingers of both hands.',
  },
  {
    plaintext: 'each room was a different way of remembering',
    shift: 21,
    hint: 'five less than the full alphabet.',
  },
  {
    plaintext: 'but remembering is just forgetting in reverse',
    shift: 9,
    hint: 'a single digit. the last one.',
  },
  {
    plaintext: 'the rooms began to forget each other',
    shift: 15,
    hint: 'three times five. the product of primes.',
  },
  {
    plaintext: 'hallways twisted passages dissolved doorways closed',
    shift: 4,
    hint: 'the number of cardinal directions.',
  },
  {
    plaintext: 'only the void remembered everything and nothing',
    shift: 17,
    hint: 'seventeen. another prime. pattern emerging.',
  },
  {
    plaintext: 'you are the void now. welcome home.',
    shift: 1,
    hint: 'the smallest possible step. almost nothing.',
  },
]

function encrypt(text: string, shift: number): string {
  return text.split('').map(ch => {
    if (ch >= 'a' && ch <= 'z') {
      return String.fromCharCode(((ch.charCodeAt(0) - 97 + shift) % 26) + 97)
    }
    return ch
  }).join('')
}

function decrypt(text: string, shift: number): string {
  return encrypt(text, 26 - shift)
}

export function createCipherRoom(deps?: CipherDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let solvedCount = 0
  let currentShift = 0 // player's current shift guess
  let currentPuzzle = 0
  let solved = false
  let solvedFlash = 0
  let hoveredNav = -1

  // Encoded text links — cryptographic aesthetic
  const navPoints = [
    { label: '[73:74:75:64:79]', decoded: 'study', room: 'study', xFrac: 0.04, yFrac: 0.06 },
    { label: '[70:65:6e:64]', decoded: 'pendulum', room: 'pendulum', xFrac: 0.96, yFrac: 0.06 },
    { label: '[6c:69:62]', decoded: 'library', room: 'library', xFrac: 0.04, yFrac: 0.95 },
    { label: '[6c:61:62]', decoded: 'labyrinth', room: 'labyrinth', xFrac: 0.96, yFrac: 0.95 },
  ]

  function loadProgress() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        solvedCount = JSON.parse(stored).solved || 0
      }
    } catch {}
    currentPuzzle = Math.min(solvedCount, PUZZLES.length - 1)
    currentShift = 0
    solved = false
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ solved: solvedCount }))
    } catch {}
  }

  function checkSolution() {
    if (solved) return
    const puzzle = PUZZLES[currentPuzzle]
    if (currentShift === puzzle.shift) {
      solved = true
      solvedFlash = 1
      solvedCount = Math.max(solvedCount, currentPuzzle + 1)
      saveProgress()
    }
  }

  function nextPuzzle() {
    if (currentPuzzle < PUZZLES.length - 1) {
      currentPuzzle++
      currentShift = 0
      solved = false
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016
    if (solvedFlash > 0) solvedFlash *= 0.98

    const w = canvas.width
    const h = canvas.height

    // Background
    ctx.fillStyle = 'rgba(5, 5, 10, 1)'
    ctx.fillRect(0, 0, w, h)

    // Solved flash
    if (solvedFlash > 0.01) {
      ctx.fillStyle = `rgba(255, 215, 0, ${solvedFlash * 0.1})`
      ctx.fillRect(0, 0, w, h)
    }

    const puzzle = PUZZLES[currentPuzzle]
    const ciphertext = encrypt(puzzle.plaintext, puzzle.shift)
    const attempt = decrypt(ciphertext, currentShift)

    // Title
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 180, 140, ${0.08 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the cipher', w / 2, 25)

    // Progress
    ctx.font = '9px monospace'
    ctx.fillStyle = 'rgba(200, 180, 140, 0.1)'
    ctx.fillText(`${currentPuzzle + 1} / ${PUZZLES.length}`, w / 2, 42)

    // Ciphertext (the encrypted message)
    ctx.font = '20px monospace'
    ctx.fillStyle = 'rgba(200, 180, 140, 0.4)'
    ctx.textAlign = 'center'

    // Word wrap the ciphertext
    const maxCharsPerLine = Math.floor(w / 15)
    const cipherLines = wrapText(ciphertext, maxCharsPerLine)
    const startY = h * 0.2

    for (let i = 0; i < cipherLines.length; i++) {
      ctx.fillText(cipherLines[i], w / 2, startY + i * 30)
    }

    // Divider
    ctx.strokeStyle = 'rgba(200, 180, 140, 0.06)'
    ctx.beginPath()
    ctx.moveTo(w * 0.2, h * 0.38)
    ctx.lineTo(w * 0.8, h * 0.38)
    ctx.stroke()

    // Alphabet strip — interactive
    const alphaY = h * 0.45
    const alphaStartX = w / 2 - 13 * 18
    ctx.font = '16px monospace'

    for (let i = 0; i < 26; i++) {
      const ch = String.fromCharCode(97 + i)
      const shifted = String.fromCharCode(((i + currentShift) % 26) + 97)
      const x = alphaStartX + i * 26

      // Original letter (top)
      ctx.fillStyle = 'rgba(200, 180, 140, 0.2)'
      ctx.textAlign = 'center'
      ctx.fillText(ch, x, alphaY)

      // Arrow
      ctx.fillStyle = 'rgba(200, 180, 140, 0.06)'
      ctx.fillText('↓', x, alphaY + 18)

      // Shifted letter (bottom)
      const isMatch = solved && currentShift === puzzle.shift
      ctx.fillStyle = isMatch
        ? `rgba(255, 215, 0, ${0.5 + Math.sin(time * 2 + i * 0.3) * 0.2})`
        : 'rgba(255, 100, 60, 0.35)'
      ctx.fillText(shifted, x, alphaY + 36)
    }

    // Shift indicator
    ctx.font = '9px monospace'
    ctx.fillStyle = 'rgba(200, 180, 140, 0.15)'
    ctx.textAlign = 'center'
    ctx.fillText(`shift: ${currentShift}`, w / 2, alphaY + 56)

    // Left/right arrows for shift control
    ctx.font = '24px monospace'
    ctx.fillStyle = 'rgba(200, 180, 140, 0.2)'
    ctx.fillText('◀', w / 2 - 60, alphaY + 58)
    ctx.fillText('▶', w / 2 + 60, alphaY + 58)

    // Decoded attempt
    ctx.font = '20px monospace'
    const decodeY = h * 0.62
    const attemptLines = wrapText(attempt, maxCharsPerLine)

    for (let li = 0; li < attemptLines.length; li++) {
      const line = attemptLines[li]
      for (let ci = 0; ci < line.length; ci++) {
        const charX = w / 2 - (line.length * 12) / 2 + ci * 12
        const y = decodeY + li * 30

        if (solved) {
          // Solved — golden glow
          ctx.fillStyle = `rgba(255, 215, 0, ${0.6 + Math.sin(time * 1.5 + ci * 0.2) * 0.15})`
        } else {
          // Working — characters that match the real plaintext are brighter
          const fullAttempt = attempt
          const fullPlain = puzzle.plaintext
          const globalIdx = cipherLines.slice(0, li).join('').length + ci
          const isCorrectChar = globalIdx < fullPlain.length && fullAttempt[globalIdx] === fullPlain[globalIdx]
          ctx.fillStyle = isCorrectChar
            ? 'rgba(100, 200, 100, 0.4)'
            : 'rgba(200, 100, 80, 0.25)'
        }

        ctx.textAlign = 'center'
        ctx.fillText(line[ci], charX + 6, y)
      }
    }

    // Hint
    ctx.font = '11px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 180, 140, ${0.06 + Math.sin(time * 0.5) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText(`hint: ${puzzle.hint}`, w / 2, h * 0.78)

    // Solved message + next button
    if (solved) {
      ctx.font = '12px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(255, 215, 0, ${0.3 + Math.sin(time * 2) * 0.1})`
      ctx.fillText('decoded.', w / 2, h * 0.84)

      if (currentPuzzle < PUZZLES.length - 1) {
        ctx.fillStyle = 'rgba(255, 215, 0, 0.2)'
        ctx.fillText('[ next cipher ]', w / 2, h * 0.88)
      } else {
        ctx.fillStyle = `rgba(255, 215, 0, ${0.2 + Math.sin(time) * 0.1})`
        ctx.fillText('all ciphers decoded. the story is complete.', w / 2, h * 0.88)
      }
    }

    // Navigation portals — encoded text links
    if (deps?.switchTo) {
      for (let i = 0; i < navPoints.length; i++) {
        const np = navPoints[i]
        const nx = w * np.xFrac
        const ny = h * np.yFrac
        const hovered = hoveredNav === i
        const a = hovered ? 0.35 : 0.06
        ctx.font = '8px monospace'
        ctx.fillStyle = `rgba(200, 180, 140, ${a})`
        ctx.textAlign = np.xFrac < 0.5 ? 'left' : 'right'
        ctx.fillText(np.label, nx, ny)
        if (hovered) {
          ctx.font = '9px "Cormorant Garamond", serif'
          ctx.fillStyle = 'rgba(255, 215, 0, 0.25)'
          ctx.fillText(np.decoded, nx, ny + 13)
        }
      }
    }

    // Controls hint
    ctx.font = '9px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(200, 180, 140, 0.04)'
    ctx.textAlign = 'center'
    ctx.fillText('\u2190 \u2192 or click arrows to shift \u00b7 each cipher hides a fragment of the creation myth', w / 2, h - 8)

    // Stats
    ctx.font = '9px monospace'
    ctx.fillStyle = 'rgba(200, 180, 140, 0.06)'
    ctx.textAlign = 'left'
    ctx.fillText(`${solvedCount} decoded`, 12, h - 18)
  }

  function wrapText(text: string, maxChars: number): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let current = ''
    for (const word of words) {
      if (current.length + word.length + 1 > maxChars) {
        lines.push(current)
        current = word
      } else {
        current = current ? current + ' ' + word : word
      }
    }
    if (current) lines.push(current)
    return lines
  }

  function handleClick(e: MouseEvent) {
    if (!canvas) return
    const w = canvas.width
    const h = canvas.height
    const x = e.clientX
    const y = e.clientY

    const alphaY = h * 0.45

    // Left arrow
    if (x > w / 2 - 80 && x < w / 2 - 40 && y > alphaY + 35 && y < alphaY + 65) {
      currentShift = (currentShift + 25) % 26
      checkSolution()
      return
    }

    // Right arrow
    if (x > w / 2 + 40 && x < w / 2 + 80 && y > alphaY + 35 && y < alphaY + 65) {
      currentShift = (currentShift + 1) % 26
      checkSolution()
      return
    }

    // Next cipher button
    if (solved && y > h * 0.85 && y < h * 0.92) {
      nextPuzzle()
      return
    }
  }

  function handleKey(e: KeyboardEvent) {
    if (!active) return
    if (e.key === 'ArrowLeft') {
      currentShift = (currentShift + 25) % 26
      checkSolution()
      e.preventDefault()
    }
    if (e.key === 'ArrowRight') {
      currentShift = (currentShift + 1) % 26
      checkSolution()
      e.preventDefault()
    }
    if (e.key === 'Enter' && solved) {
      nextPuzzle()
      e.preventDefault()
    }
  }

  return {
    name: 'cipher',
    label: 'the cipher',

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

      canvas.addEventListener('click', handleClick)

      // Navigation portal click + hover
      canvas.addEventListener('click', (e) => {
        if (!deps?.switchTo || !canvas) return
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

      window.addEventListener('keydown', handleKey)

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
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      window.removeEventListener('keydown', handleKey)
      overlay?.remove()
    },
  }
}
