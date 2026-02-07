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

  // Typed navigation system — the cipher IS the navigation
  const navDestinations: Record<string, string> = {
    study: 'study',
    pendulum: 'pendulum',
    library: 'library',
    labyrinth: 'labyrinth',
  }
  // Ghost labels scattered at edges — barely visible encrypted hints
  const ghostLabels = [
    { text: 'study', xFrac: 0.08, yFrac: 0.12, angle: -0.05 },
    { text: 'pendulum', xFrac: 0.92, yFrac: 0.15, angle: 0.04 },
    { text: 'library', xFrac: 0.06, yFrac: 0.88, angle: 0.03 },
    { text: 'labyrinth', xFrac: 0.94, yFrac: 0.91, angle: -0.06 },
  ]
  let navBuffer = ''
  let navMatchFound = ''
  let navMatchFlash = 0 // 1 → 0, gold flash on match
  let navHintTimer = 0 // cycles to show "type a destination..."
  let solvedRoomFlash = 0 // flash room names after solving
  let solvedRoomNames: string[] = []

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
      // Flash connected room names as "decoded" hints
      solvedRoomFlash = 1
      solvedRoomNames = Object.keys(navDestinations)
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

    // Ghost labels — barely visible room names scattered at edges
    if (deps?.switchTo) {
      for (const gl of ghostLabels) {
        const gx = w * gl.xFrac
        const gy = h * gl.yFrac
        ctx.save()
        ctx.translate(gx, gy)
        ctx.rotate(gl.angle)
        // Encrypt the label with a slowly shifting cipher for visual effect
        const ghostShift = Math.floor(time * 0.3) % 26
        const encryptedGhost = encrypt(gl.text, ghostShift)
        ctx.font = '9px monospace'
        ctx.fillStyle = 'rgba(200, 180, 140, 0.02)'
        ctx.textAlign = gl.xFrac < 0.5 ? 'left' : 'right'
        ctx.fillText(encryptedGhost, 0, 0)
        ctx.restore()
      }
    }

    // Nav buffer — show typed characters spaced out like decrypted text
    if (navBuffer.length > 0 && !navMatchFound) {
      ctx.font = '14px monospace'
      ctx.textAlign = 'center'
      const bufferStr = navBuffer.split('').join(' ')
      const cursorBlink = Math.sin(time * 6) > 0 ? '|' : ' '
      const displayStr = bufferStr + ' ' + cursorBlink
      ctx.fillStyle = 'rgba(200, 180, 140, 0.2)'
      ctx.fillText(displayStr, w / 2, h - 35)
    }

    // Nav match flash — gold glow when a room name is matched
    if (navMatchFound && navMatchFlash > 0.01) {
      // Gold screen flash
      ctx.fillStyle = `rgba(255, 215, 0, ${navMatchFlash * 0.08})`
      ctx.fillRect(0, 0, w, h)
      // Show matched name glowing gold
      ctx.font = '20px "Cormorant Garamond", serif'
      ctx.textAlign = 'center'
      const matchStr = navMatchFound.split('').join(' ')
      ctx.fillStyle = `rgba(255, 215, 0, ${navMatchFlash * 0.7})`
      ctx.fillText(matchStr, w / 2, h - 30)
    }
    if (navMatchFlash > 0) navMatchFlash *= 0.97

    // Solved room name flash — briefly show connected rooms after solving a cipher
    if (solvedRoomFlash > 0.01 && solvedRoomNames.length > 0) {
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      const spacing = w / (solvedRoomNames.length + 1)
      for (let ri = 0; ri < solvedRoomNames.length; ri++) {
        const rx = spacing * (ri + 1)
        const ry = h * 0.92
        ctx.fillStyle = `rgba(255, 215, 0, ${solvedRoomFlash * 0.2})`
        ctx.fillText(solvedRoomNames[ri], rx, ry)
      }
      solvedRoomFlash *= 0.992
    }

    // Nav hint — periodically suggest typing a destination
    navHintTimer += 0.016
    const hintCycle = navHintTimer % 12 // 12-second cycle
    if (hintCycle > 8 && hintCycle < 11 && navBuffer.length === 0 && !navMatchFound) {
      const hintAlpha = Math.sin((hintCycle - 8) / 3 * Math.PI) * 0.06
      ctx.font = '9px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(200, 180, 140, ${hintAlpha})`
      ctx.textAlign = 'center'
      ctx.fillText('type a destination...', w / 2, h - 22)
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
    // Navigation by typing room names (letter keys only)
    if (e.key.length === 1 && /[a-z]/i.test(e.key) && !navMatchFound && deps?.switchTo) {
      navBuffer += e.key.toLowerCase()
      // Check if buffer matches a destination
      const matched = Object.keys(navDestinations).find(name => name === navBuffer)
      if (matched) {
        navMatchFound = matched
        navMatchFlash = 1
        setTimeout(() => {
          if (deps?.switchTo) deps.switchTo(navDestinations[matched])
          navBuffer = ''
          navMatchFound = ''
          navMatchFlash = 0
        }, 500)
      } else {
        // Check if buffer is a prefix of any destination
        const isPrefix = Object.keys(navDestinations).some(name => name.startsWith(navBuffer))
        if (!isPrefix || navBuffer.length > 12) {
          navBuffer = '' // reset — no match possible
        }
      }
    }
    // Backspace clears nav buffer
    if (e.key === 'Backspace' && navBuffer.length > 0 && !navMatchFound) {
      navBuffer = navBuffer.slice(0, -1)
    }
    // Escape clears nav buffer
    if (e.key === 'Escape' && navBuffer.length > 0) {
      navBuffer = ''
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
      navBuffer = ''
      navMatchFound = ''
      navMatchFlash = 0
      navHintTimer = 0
      loadProgress()
      render()
    },

    deactivate() {
      active = false
      navBuffer = ''
      navMatchFound = ''
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
