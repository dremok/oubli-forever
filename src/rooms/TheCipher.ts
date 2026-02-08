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
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface CipherDeps {
  switchTo?: (name: string) => void
}

const STORAGE_KEY = 'oubli-cipher-progress'

const CULTURAL_INSCRIPTIONS = [
  'the enigma machine had 158,962,555,217,826,360,000 possible settings. bletchley park tried them all.',
  'the voynich manuscript has resisted decryption for 600 years. some codes are meant to stay locked.',
  "the zodiac killer's 340 cipher took 51 years to crack. the answer was disappointingly banal.",
  'edward snowden proved that every message is being read. encryption is the last privacy.',
  'quantum computers will break RSA encryption. post-quantum cryptography is already being deployed.',
  "iGluSnFR4: a molecular sensor that eavesdrops on the brain's synaptic whispers in real time",
  "the brain's memory center has four hidden layers. 330,000 RNA molecules map the architecture of remembering.",
  'CRISPR can now silence genes without cutting them. memories can be mechanically un-silenced.',
]

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

// Scrolling code column for background atmosphere
interface CodeColumn {
  x: number
  chars: string[]
  speed: number
  offset: number
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
  let navMatchFlash = 0 // 1 -> 0, gold flash on match
  let navHintTimer = 0 // cycles to show "type a destination..."
  let solvedRoomFlash = 0 // flash room names after solving
  let solvedRoomNames: string[] = []

  // --- Audio state ---
  let audioInitialized = false
  let audioMaster: GainNode | null = null
  let enigmaOsc: OscillatorNode | null = null
  let enigmaGain: GainNode | null = null

  // Track which characters have pinged (to avoid re-triggering)
  let pingedChars: Set<string> = new Set() // key: "puzzleIdx-charIdx"

  // Mouse position for ghost label proximity glow
  let mouseX = 0
  let mouseY = 0

  // Ghost label effective alpha (for smooth transitions)
  let ghostLabelAlphas: number[] = ghostLabels.map(() => 0.05)

  // Cultural inscription cycling
  let currentInscriptionIdx = 0
  let inscriptionTimer = 0

  // Decryption particle burst
  interface DecryptionParticle {
    x: number
    y: number
    life: number // 0..1, starts at 1
    vx: number
    vy: number
    size: number
  }
  let decryptionParticles: DecryptionParticle[] = []

  // Enhanced audio nodes
  let enigmaOsc2: OscillatorNode | null = null
  let enigmaGain2: GainNode | null = null
  let noiseSource: AudioBufferSourceNode | null = null
  let noiseGain: GainNode | null = null

  // --- Visual: ink fade-in ---
  let inkFadeStartTime = 0 // time when current puzzle started
  let lastRenderedPuzzle = -1

  // --- Visual: scrolling code columns ---
  let codeColumns: CodeColumn[] = []

  // --- Visual: cipher wheel rotation ---
  let wheelAngle = 0

  // --- Audio helpers ---

  async function initAudio() {
    if (audioInitialized) return
    try {
      const ac = await getAudioContext()
      const dest = getAudioDestination()

      // Master gain for this room
      audioMaster = ac.createGain()
      audioMaster.gain.value = 0
      audioMaster.connect(dest)

      // Enigma hum: quiet triangle wave drone at 100Hz
      enigmaOsc = ac.createOscillator()
      enigmaOsc.type = 'triangle'
      enigmaOsc.frequency.value = 100
      enigmaGain = ac.createGain()
      enigmaGain.gain.value = 0.01
      enigmaOsc.connect(enigmaGain)
      enigmaGain.connect(audioMaster)
      enigmaOsc.start()

      // Second oscillator detuned by 0.5Hz for beating effect
      enigmaOsc2 = ac.createOscillator()
      enigmaOsc2.type = 'triangle'
      enigmaOsc2.frequency.value = 100.5
      enigmaGain2 = ac.createGain()
      enigmaGain2.gain.value = 0.01
      enigmaOsc2.connect(enigmaGain2)
      enigmaGain2.connect(audioMaster)
      enigmaOsc2.start()

      // Filtered noise layer — mechanical hum texture
      const noiseLen = 2 * ac.sampleRate
      const noiseBuffer = ac.createBuffer(1, noiseLen, ac.sampleRate)
      const noiseData = noiseBuffer.getChannelData(0)
      for (let i = 0; i < noiseLen; i++) {
        noiseData[i] = Math.random() * 2 - 1
      }
      noiseSource = ac.createBufferSource()
      noiseSource.buffer = noiseBuffer
      noiseSource.loop = true
      const noiseBP = ac.createBiquadFilter()
      noiseBP.type = 'bandpass'
      noiseBP.frequency.value = 400
      noiseBP.Q.value = 3
      noiseGain = ac.createGain()
      noiseGain.gain.value = 0.006
      noiseSource.connect(noiseBP)
      noiseBP.connect(noiseGain)
      noiseGain.connect(audioMaster)
      noiseSource.start()

      audioInitialized = true
    } catch {
      // Audio not available — silent fallback
    }
  }

  function fadeAudioIn() {
    if (!audioMaster) return
    const ac = audioMaster.context
    const now = ac.currentTime
    audioMaster.gain.cancelScheduledValues(now)
    audioMaster.gain.setValueAtTime(audioMaster.gain.value, now)
    audioMaster.gain.linearRampToValueAtTime(1.0, now + 0.5)
  }

  function fadeAudioOut() {
    if (!audioMaster) return
    const ac = audioMaster.context
    const now = ac.currentTime
    audioMaster.gain.cancelScheduledValues(now)
    audioMaster.gain.setValueAtTime(audioMaster.gain.value, now)
    audioMaster.gain.linearRampToValueAtTime(0, now + 0.5)
  }

  function destroyAudio() {
    fadeAudioOut()
    setTimeout(() => {
      try { enigmaOsc?.stop() } catch { /* already stopped */ }
      try { enigmaOsc2?.stop() } catch { /* already stopped */ }
      try { noiseSource?.stop() } catch { /* already stopped */ }
      enigmaGain?.disconnect()
      enigmaOsc?.disconnect()
      enigmaGain2?.disconnect()
      enigmaOsc2?.disconnect()
      noiseGain?.disconnect()
      noiseSource?.disconnect()
      audioMaster?.disconnect()
      enigmaOsc = null
      enigmaGain = null
      enigmaOsc2 = null
      enigmaGain2 = null
      noiseSource = null
      noiseGain = null
      audioMaster = null
      audioInitialized = false
    }, 600)
  }

  /** Shift click: mechanical ratchet sound — layered noise burst like a gear clicking into position */
  function playShiftClick() {
    if (!audioInitialized || !audioMaster) return
    try {
      const ac = audioMaster.context as AudioContext
      const now = ac.currentTime

      // Layer 1: sharp high click (very short, bandpass at 2500Hz)
      const clickLen = Math.max(1, Math.round(ac.sampleRate * 0.004))
      const clickBuf = ac.createBuffer(1, clickLen, ac.sampleRate)
      const clickData = clickBuf.getChannelData(0)
      for (let i = 0; i < clickLen; i++) {
        clickData[i] = Math.random() * 2 - 1
      }
      const clickSrc = ac.createBufferSource()
      clickSrc.buffer = clickBuf
      const clickBP = ac.createBiquadFilter()
      clickBP.type = 'bandpass'
      clickBP.frequency.value = 2500
      clickBP.Q.value = 4
      const clickG = ac.createGain()
      clickG.gain.setValueAtTime(0.06, now)
      clickG.gain.exponentialRampToValueAtTime(0.001, now + 0.015)
      clickSrc.connect(clickBP)
      clickBP.connect(clickG)
      clickG.connect(audioMaster!)
      clickSrc.start(now)
      clickSrc.stop(now + 0.02)

      // Layer 2: low thunk (mechanical body resonance, bandpass at 300Hz)
      const thunkLen = Math.max(1, Math.round(ac.sampleRate * 0.02))
      const thunkBuf = ac.createBuffer(1, thunkLen, ac.sampleRate)
      const thunkData = thunkBuf.getChannelData(0)
      for (let i = 0; i < thunkLen; i++) {
        thunkData[i] = Math.random() * 2 - 1
      }
      const thunkSrc = ac.createBufferSource()
      thunkSrc.buffer = thunkBuf
      const thunkBP = ac.createBiquadFilter()
      thunkBP.type = 'bandpass'
      thunkBP.frequency.value = 300
      thunkBP.Q.value = 2
      const thunkG = ac.createGain()
      thunkG.gain.setValueAtTime(0.03, now)
      thunkG.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
      thunkSrc.connect(thunkBP)
      thunkBP.connect(thunkG)
      thunkG.connect(audioMaster!)
      thunkSrc.start(now)
      thunkSrc.stop(now + 0.05)
    } catch { /* ignore */ }
  }

  /** Correct character ping: subtle high sine 880Hz, 30ms */
  function playCharPing() {
    if (!audioInitialized || !audioMaster) return
    try {
      const ac = audioMaster.context
      const now = ac.currentTime
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = 880
      const g = ac.createGain()
      g.gain.setValueAtTime(0.008, now)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.03)
      osc.connect(g)
      g.connect(audioMaster)
      osc.start(now)
      osc.stop(now + 0.04)
    } catch { /* ignore */ }
  }

  /** Solve fanfare: ascending 3-note sequence E4->G#4->B4 */
  function playSolveFanfare() {
    if (!audioInitialized || !audioMaster) return
    try {
      const ac = audioMaster.context
      const now = ac.currentTime
      const notes = [330, 415, 494] // E4, G#4, B4
      for (let i = 0; i < notes.length; i++) {
        const startT = now + i * 0.15
        const osc = ac.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = notes[i]
        const g = ac.createGain()
        g.gain.setValueAtTime(0, startT)
        g.gain.linearRampToValueAtTime(0.04, startT + 0.01)
        g.gain.setValueAtTime(0.04, startT + 0.1)
        g.gain.exponentialRampToValueAtTime(0.001, startT + 0.2)
        osc.connect(g)
        g.connect(audioMaster!)
        osc.start(startT)
        osc.stop(startT + 0.25)
      }
    } catch { /* ignore */ }
  }

  /** Type echo: faint 3ms noise typewriter click */
  function playTypeEcho() {
    if (!audioInitialized || !audioMaster) return
    try {
      const ac = audioMaster.context
      const now = ac.currentTime
      const bufferSize = Math.max(1, Math.round(ac.sampleRate * 0.003))
      const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1
      }
      const src = ac.createBufferSource()
      src.buffer = buffer
      const g = ac.createGain()
      g.gain.setValueAtTime(0.02, now)
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.015)
      src.connect(g)
      g.connect(audioMaster)
      src.start(now)
      src.stop(now + 0.015)
    } catch { /* ignore */ }
  }

  /** Match chime: warm bell 523Hz with detuned 525Hz, 500ms decay */
  function playMatchChime() {
    if (!audioInitialized || !audioMaster) return
    try {
      const ac = audioMaster.context
      const now = ac.currentTime
      const freqs = [523, 525]
      for (const freq of freqs) {
        const osc = ac.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq
        const g = ac.createGain()
        g.gain.setValueAtTime(0.03, now)
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
        osc.connect(g)
        g.connect(audioMaster!)
        osc.start(now)
        osc.stop(now + 0.6)
      }
    } catch { /* ignore */ }
  }

  // --- Visual helpers ---

  function initCodeColumns() {
    codeColumns = []
    const w = canvas?.width || window.innerWidth
    const colCount = Math.floor(w / 30)
    for (let i = 0; i < colCount; i++) {
      const chars: string[] = []
      const len = 10 + Math.floor(Math.random() * 20)
      for (let j = 0; j < len; j++) {
        chars.push(String.fromCharCode(97 + Math.floor(Math.random() * 26)))
      }
      codeColumns.push({
        x: (i + 0.5) * (w / colCount),
        chars,
        speed: 8 + Math.random() * 12,
        offset: Math.random() * 600,
      })
    }
  }

  function drawScrollingCode(c: CanvasRenderingContext2D, w: number, h: number) {
    c.font = '12px monospace'
    c.textAlign = 'center'
    const charH = 14
    for (const col of codeColumns) {
      const y0 = (col.offset + time * col.speed) % (h + col.chars.length * charH)
      for (let j = 0; j < col.chars.length; j++) {
        const cy = y0 + j * charH - col.chars.length * charH
        if (cy < -charH || cy > h + charH) continue
        // Fade at top/bottom edges
        const edgeFade = Math.min(cy / 60, (h - cy) / 60, 1)
        const alpha = Math.max(0, 0.015 * edgeFade)
        c.fillStyle = `rgba(200, 180, 140, ${alpha})`
        c.fillText(col.chars[j], col.x, cy)
      }
    }
  }

  function drawCipherWheel(c: CanvasRenderingContext2D, w: number, h: number) {
    const cx = w / 2
    const cy = h / 2
    const maxR = Math.min(w, h) * 0.38

    c.save()
    c.translate(cx, cy)
    c.globalAlpha = 0.03

    // Outer ring
    c.strokeStyle = 'rgba(200, 180, 140, 1)'
    c.lineWidth = 0.5
    c.beginPath()
    c.arc(0, 0, maxR, 0, Math.PI * 2)
    c.stroke()

    // Inner ring
    c.beginPath()
    c.arc(0, 0, maxR * 0.75, 0, Math.PI * 2)
    c.stroke()

    // Letters on outer ring
    c.font = '13px monospace'
    c.fillStyle = 'rgba(200, 180, 140, 1)'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    for (let i = 0; i < 26; i++) {
      const angle = wheelAngle + (i / 26) * Math.PI * 2
      const lx = Math.cos(angle) * maxR * 0.88
      const ly = Math.sin(angle) * maxR * 0.88
      c.fillText(String.fromCharCode(65 + i), lx, ly)
    }

    // Letters on inner ring (shifted)
    for (let i = 0; i < 26; i++) {
      const angle = -wheelAngle * 0.7 + (i / 26) * Math.PI * 2
      const lx = Math.cos(angle) * maxR * 0.65
      const ly = Math.sin(angle) * maxR * 0.65
      c.fillText(String.fromCharCode(65 + ((i + currentShift) % 26)), lx, ly)
    }

    c.globalAlpha = 1.0
    c.restore()
  }

  function drawCharGlow(c: CanvasRenderingContext2D, x: number, y: number) {
    const grad = c.createRadialGradient(x, y, 0, x, y, 10)
    grad.addColorStop(0, 'rgba(100, 200, 100, 0.08)')
    grad.addColorStop(1, 'rgba(100, 200, 100, 0)')
    c.fillStyle = grad
    c.fillRect(x - 10, y - 10, 20, 20)
  }

  /** Spawn a burst of green particles at (x, y). Count scales with proximity to solution. */
  function spawnDecryptionParticles(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.3 + Math.random() * 1.2
      decryptionParticles.push({
        x,
        y,
        life: 1,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5, // slight upward bias
        size: 2 + Math.random() * 2,
      })
    }
  }

  function updateAndDrawParticles(c: CanvasRenderingContext2D) {
    for (let i = decryptionParticles.length - 1; i >= 0; i--) {
      const p = decryptionParticles[i]
      p.x += p.vx
      p.y += p.vy
      p.life -= 0.03
      if (p.life <= 0) {
        decryptionParticles.splice(i, 1)
        continue
      }
      const alpha = p.life * 0.6
      c.fillStyle = `rgba(80, 220, 80, ${alpha})`
      c.beginPath()
      c.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
      c.fill()
    }
  }

  function drawCulturalInscription(c: CanvasRenderingContext2D, w: number, h: number) {
    inscriptionTimer += 0.016
    if (inscriptionTimer >= 20) {
      inscriptionTimer = 0
      currentInscriptionIdx = (currentInscriptionIdx + 1) % CULTURAL_INSCRIPTIONS.length
    }
    const text = CULTURAL_INSCRIPTIONS[currentInscriptionIdx]
    c.font = '11px "Cormorant Garamond", serif'
    c.textAlign = 'center'
    c.fillStyle = 'rgba(200, 180, 140, 0.045)'
    // Wrap long inscriptions
    const maxW = w * 0.8
    const words = text.split(' ')
    const lines: string[] = []
    let current = ''
    for (const word of words) {
      const test = current ? current + ' ' + word : word
      if (c.measureText(test).width > maxW) {
        lines.push(current)
        current = word
      } else {
        current = test
      }
    }
    if (current) lines.push(current)
    const baseY = h - 55
    for (let i = 0; i < lines.length; i++) {
      c.fillText(lines[i], w / 2, baseY + i * 14)
    }
  }

  // --- Core ---

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
    playShiftClick()
    const puzzle = PUZZLES[currentPuzzle]
    if (currentShift === puzzle.shift) {
      solved = true
      solvedFlash = 1
      solvedCount = Math.max(solvedCount, currentPuzzle + 1)
      saveProgress()
      playSolveFanfare()
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
      pingedChars = new Set()
      inkFadeStartTime = time
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016
    if (solvedFlash > 0) solvedFlash *= 0.98

    // Track puzzle changes for ink fade-in
    if (lastRenderedPuzzle !== currentPuzzle) {
      inkFadeStartTime = time
      lastRenderedPuzzle = currentPuzzle
      pingedChars = new Set()
    }

    // Cipher wheel rotation
    wheelAngle += 0.0003

    const w = canvas.width
    const h = canvas.height

    // Background
    ctx.fillStyle = 'rgba(5, 5, 10, 1)'
    ctx.fillRect(0, 0, w, h)

    // Scrolling code background (Matrix-style, barely visible)
    drawScrollingCode(ctx, w, h)

    // Cipher wheel background decoration
    drawCipherWheel(ctx, w, h)

    // Solved flash
    if (solvedFlash > 0.01) {
      ctx.fillStyle = `rgba(255, 215, 0, ${solvedFlash * 0.1})`
      ctx.fillRect(0, 0, w, h)
    }

    const puzzle = PUZZLES[currentPuzzle]
    const ciphertext = encrypt(puzzle.plaintext, puzzle.shift)
    const attempt = decrypt(ciphertext, currentShift)

    // Ink fade-in timing: characters appear one by one over ~1.5 seconds
    const inkElapsed = time - inkFadeStartTime
    const charsRevealed = Math.floor(inkElapsed * 40) // ~40 chars/sec fade-in

    // Title
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 180, 140, ${0.08 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the cipher', w / 2, 25)

    // Progress
    ctx.font = '12px monospace'
    ctx.fillStyle = 'rgba(200, 180, 140, 0.1)'
    ctx.fillText(`${currentPuzzle + 1} / ${PUZZLES.length}`, w / 2, 42)

    // Ciphertext (the encrypted message) — with ink fade-in
    ctx.font = '20px monospace'
    ctx.textAlign = 'center'

    // Word wrap the ciphertext
    const maxCharsPerLine = Math.floor(w / 15)
    const cipherLines = wrapText(ciphertext, maxCharsPerLine)
    const startY = h * 0.2

    let globalCharIdx = 0
    for (let i = 0; i < cipherLines.length; i++) {
      const line = cipherLines[i]
      for (let ci = 0; ci < line.length; ci++) {
        const charAlpha = Math.min(1, Math.max(0, (charsRevealed - globalCharIdx) * 0.2))
        ctx.fillStyle = `rgba(200, 180, 140, ${0.4 * charAlpha})`
        const charX = w / 2 - (line.length * 12) / 2 + ci * 12
        ctx.fillText(line[ci], charX + 6, startY + i * 30)
        globalCharIdx++
      }
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
      ctx.fillText('\u2193', x, alphaY + 18)

      // Shifted letter (bottom)
      const isMatch = solved && currentShift === puzzle.shift
      ctx.fillStyle = isMatch
        ? `rgba(255, 215, 0, ${0.5 + Math.sin(time * 2 + i * 0.3) * 0.2})`
        : 'rgba(255, 100, 60, 0.35)'
      ctx.fillText(shifted, x, alphaY + 36)
    }

    // Shift indicator
    ctx.font = '12px monospace'
    ctx.fillStyle = 'rgba(200, 180, 140, 0.15)'
    ctx.textAlign = 'center'
    ctx.fillText(`shift: ${currentShift}`, w / 2, alphaY + 56)

    // Left/right arrows for shift control
    ctx.font = '24px monospace'
    ctx.fillStyle = 'rgba(200, 180, 140, 0.2)'
    ctx.fillText('\u25C0', w / 2 - 60, alphaY + 58)
    ctx.fillText('\u25B6', w / 2 + 60, alphaY + 58)

    // Decoded attempt — with character shimmer for correct chars
    ctx.font = '20px monospace'
    const decodeY = h * 0.62
    const attemptLines = wrapText(attempt, maxCharsPerLine)

    for (let li = 0; li < attemptLines.length; li++) {
      const line = attemptLines[li]
      for (let ci = 0; ci < line.length; ci++) {
        const charX = w / 2 - (line.length * 12) / 2 + ci * 12
        const y = decodeY + li * 30

        // Compute global index for this character in the full attempt string
        let lineOffset = 0
        for (let prev = 0; prev < li; prev++) {
          lineOffset += attemptLines[prev].length
        }
        const globalIdx = lineOffset + ci

        if (solved) {
          // Solved — golden glow
          ctx.fillStyle = `rgba(255, 215, 0, ${0.6 + Math.sin(time * 1.5 + ci * 0.2) * 0.15})`
        } else {
          // Working — characters that match the real plaintext are brighter
          const isCorrectChar = globalIdx < puzzle.plaintext.length && attempt[globalIdx] === puzzle.plaintext[globalIdx]
          if (isCorrectChar) {
            // Character shimmer: draw glow behind correct characters
            drawCharGlow(ctx, charX + 6, y - 5)
            ctx.fillStyle = 'rgba(100, 200, 100, 0.4)'

            // Audio ping + particle burst for newly matched characters
            const pingKey = `${currentPuzzle}-${globalIdx}`
            if (!pingedChars.has(pingKey)) {
              pingedChars.add(pingKey)
              playCharPing()
              // Particle burst — count scales with proximity to solution
              const shiftDist = Math.min(
                Math.abs(currentShift - puzzle.shift),
                26 - Math.abs(currentShift - puzzle.shift)
              )
              // Closer to solution = more particles (1-5 range)
              const particleCount = shiftDist <= 2 ? 5 : shiftDist <= 5 ? 3 : 1
              spawnDecryptionParticles(charX + 6, y - 5, particleCount)
            }
          } else {
            ctx.fillStyle = 'rgba(200, 100, 80, 0.25)'
          }
        }

        ctx.textAlign = 'center'
        ctx.font = '20px monospace'
        ctx.fillText(line[ci], charX + 6, y)
      }
    }

    // Draw decryption particles
    updateAndDrawParticles(ctx)

    // Hint
    ctx.font = '13px "Cormorant Garamond", serif'
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

    // Ghost labels — room names scattered at edges with proximity glow
    if (deps?.switchTo) {
      for (let gi = 0; gi < ghostLabels.length; gi++) {
        const gl = ghostLabels[gi]
        const gx = w * gl.xFrac
        const gy = h * gl.yFrac

        // Proximity glow: brighten when cursor is within 100px
        const dist = Math.sqrt((mouseX - gx) ** 2 + (mouseY - gy) ** 2)
        const targetAlpha = dist < 100 ? 0.12 : 0.05
        // Smooth ease: lerp toward target (~0.5s at 60fps)
        ghostLabelAlphas[gi] += (targetAlpha - ghostLabelAlphas[gi]) * 0.04

        ctx.save()
        ctx.translate(gx, gy)
        ctx.rotate(gl.angle)
        // Encrypt the label with a slowly shifting cipher for visual effect
        const ghostShift = Math.floor(time * 0.3) % 26
        const encryptedGhost = encrypt(gl.text, ghostShift)
        ctx.font = '12px monospace'
        ctx.fillStyle = `rgba(200, 180, 140, ${ghostLabelAlphas[gi]})`
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
      ctx.font = '12px monospace'
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
      ctx.font = '12px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(200, 180, 140, ${hintAlpha})`
      ctx.textAlign = 'center'
      ctx.fillText('type a destination...', w / 2, h - 22)
    }

    // Cultural inscription — cycling every 20 seconds near bottom
    drawCulturalInscription(ctx, w, h)

    // Controls hint
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(200, 180, 140, 0.04)'
    ctx.textAlign = 'center'
    ctx.fillText('\u2190 \u2192 or click arrows to shift \u00b7 each cipher hides a fragment of the creation myth', w / 2, h - 8)

    // Stats
    ctx.font = '12px monospace'
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
      playTypeEcho()
      // Check if buffer matches a destination
      const matched = Object.keys(navDestinations).find(name => name === navBuffer)
      if (matched) {
        navMatchFound = matched
        navMatchFlash = 1
        playMatchChime()
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
      canvas.addEventListener('mousemove', (e: MouseEvent) => {
        mouseX = e.clientX
        mouseY = e.clientY
      })

      window.addEventListener('keydown', handleKey)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
          initCodeColumns()
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
      pingedChars = new Set()
      lastRenderedPuzzle = -1
      inkFadeStartTime = 0
      wheelAngle = 0
      decryptionParticles = []
      inscriptionTimer = 0
      currentInscriptionIdx = 0
      ghostLabelAlphas = ghostLabels.map(() => 0.05)
      loadProgress()
      initCodeColumns()
      initAudio().then(() => fadeAudioIn())
      render()
    },

    deactivate() {
      active = false
      navBuffer = ''
      navMatchFound = ''
      cancelAnimationFrame(frameId)
      fadeAudioOut()
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      window.removeEventListener('keydown', handleKey)
      destroyAudio()
      overlay?.remove()
    },
  }
}
