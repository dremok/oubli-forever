/**
 * THE LIGHTHOUSE — communication through darkness
 *
 * A lighthouse beam sweeps across darkness. Type a message and it
 * blinks out in Morse code through the light. When idle, the lighthouse
 * transmits random fragments from a library of maritime distress calls,
 * poetry about the sea, and coordinates of shipwrecks.
 *
 * The beam is the only light source. Everything else is darkness and
 * the sound of waves.
 *
 * No memory dependency. Pure signal and noise.
 *
 * Inspired by: Morse code, maritime communication, lighthouses as
 * liminal spaces (between land and sea, safety and danger),
 * semaphore, signal fires, the desperate need to communicate
 * across distance and darkness
 */

import type { Room } from './RoomManager'

const MORSE: Record<string, string> = {
  'a': '.-', 'b': '-...', 'c': '-.-.', 'd': '-..', 'e': '.', 'f': '..-.',
  'g': '--.', 'h': '....', 'i': '..', 'j': '.---', 'k': '-.-', 'l': '.-..',
  'm': '--', 'n': '-.', 'o': '---', 'p': '.--.', 'q': '--.-', 'r': '.-.',
  's': '...', 't': '-', 'u': '..-', 'v': '...-', 'w': '.--', 'x': '-..-',
  'y': '-.--', 'z': '--..', '0': '-----', '1': '.----', '2': '..---',
  '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
  '8': '---..', '9': '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..',
  ' ': '/',
}

const AUTO_MESSAGES = [
  'sos sos sos',
  'all is well',
  'the sea remembers what the shore forgets',
  'lat 41.7 lon 49.9 titanic',
  'we are not lost we are waiting',
  'come home',
  'the light is the only language the dark understands',
  'mayday mayday mayday',
  'nothing is permanent not even stone',
  'three short three long three short',
  'do not go gentle into that good night',
  'i am a lighthouse i am a lighthouse',
  'lat 28.2 lon 80.6 challenger',
  'the fog is lifting',
  'all who wander are not lost',
  'the keeper has gone but the light remains',
  'signal received no reply',
  'lat 36.0 lon 25.4 minoan eruption',
]

interface LighthouseDeps {
  onDescend?: () => void // navigate to tide pool
}

export function createLighthouseRoom(deps: LighthouseDeps = {}): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let morseQueue: string[] = [] // dots and dashes to transmit
  let currentSymbol: string | null = null
  let symbolTimer = 0
  let lightOn = false
  let beamAngle = 0
  let inputText = ''
  let transmitting = false
  let autoMode = true
  let autoTimer = 0
  let currentMessage = ''
  let decodedSoFar = ''
  let transmitCount = 0
  let shoreLink: HTMLElement | null = null
  let shoreLinkVisible = false

  // Morse timing (in frames at 60fps)
  const DOT_DURATION = 8
  const DASH_DURATION = 24
  const SYMBOL_GAP = 8
  const LETTER_GAP = 20
  const WORD_GAP = 40

  function textToMorse(text: string): string[] {
    const queue: string[] = []
    const lower = text.toLowerCase()
    for (let i = 0; i < lower.length; i++) {
      const ch = lower[i]
      const morse = MORSE[ch]
      if (!morse) continue
      if (ch === ' ') {
        queue.push('word_gap')
        continue
      }
      for (let j = 0; j < morse.length; j++) {
        queue.push(morse[j] === '.' ? 'dot' : 'dash')
        if (j < morse.length - 1) queue.push('symbol_gap')
      }
      if (i < lower.length - 1 && lower[i + 1] !== ' ') {
        queue.push('letter_gap')
      }
    }
    return queue
  }

  function transmitMessage(text: string) {
    morseQueue = textToMorse(text)
    currentMessage = text
    decodedSoFar = ''
    transmitting = true
    autoMode = false
    transmitCount++

    // After 3 manual transmissions, reveal the shore link
    if (transmitCount >= 3 && !shoreLinkVisible && shoreLink && deps.onDescend) {
      shoreLinkVisible = true
      shoreLink.style.opacity = '0.3'
      shoreLink.style.pointerEvents = 'auto'
    }
  }

  function processQueue() {
    if (symbolTimer > 0) {
      symbolTimer--
      return
    }

    if (morseQueue.length === 0) {
      lightOn = false
      transmitting = false
      if (!autoMode) {
        // Return to auto mode after a pause
        autoTimer = 180 // 3 seconds
        autoMode = true
      }
      return
    }

    const next = morseQueue.shift()!
    currentSymbol = next

    switch (next) {
      case 'dot':
        lightOn = true
        symbolTimer = DOT_DURATION
        break
      case 'dash':
        lightOn = true
        symbolTimer = DASH_DURATION
        break
      case 'symbol_gap':
        lightOn = false
        symbolTimer = SYMBOL_GAP
        break
      case 'letter_gap':
        lightOn = false
        symbolTimer = LETTER_GAP
        // Reveal next letter of decoded text
        if (currentMessage) {
          const nextCharIdx = decodedSoFar.length
          if (nextCharIdx < currentMessage.length) {
            decodedSoFar = currentMessage.slice(0, nextCharIdx + 1)
          }
        }
        break
      case 'word_gap':
        lightOn = false
        symbolTimer = WORD_GAP
        if (currentMessage) {
          const nextCharIdx = decodedSoFar.length
          if (nextCharIdx < currentMessage.length) {
            decodedSoFar = currentMessage.slice(0, nextCharIdx + 1)
          }
        }
        break
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height

    // Process morse queue
    processQueue()

    // Auto-transmit when idle
    if (autoMode && !transmitting) {
      autoTimer--
      if (autoTimer <= 0) {
        const msg = AUTO_MESSAGES[Math.floor(Math.random() * AUTO_MESSAGES.length)]
        morseQueue = textToMorse(msg)
        currentMessage = msg
        decodedSoFar = ''
        transmitting = true
        autoTimer = 300 + Math.random() * 300 // 5-10s between messages
      }
    }

    // Beam rotation (slow sweep)
    beamAngle += 0.003

    // Background — deep dark
    ctx.fillStyle = 'rgba(2, 3, 8, 1)'
    ctx.fillRect(0, 0, w, h)

    // Horizon line
    const horizonY = h * 0.65
    ctx.strokeStyle = 'rgba(20, 30, 50, 0.3)'
    ctx.beginPath()
    ctx.moveTo(0, horizonY)
    ctx.lineTo(w, horizonY)
    ctx.stroke()

    // Water shimmer
    for (let i = 0; i < 30; i++) {
      const wx = Math.sin(time * 0.5 + i * 0.7) * w * 0.4 + w / 2
      const wy = horizonY + 10 + i * ((h - horizonY - 10) / 30)
      const wAlpha = 0.02 + Math.sin(time * 1.5 + i) * 0.01
      ctx.fillStyle = `rgba(30, 50, 80, ${wAlpha})`
      ctx.fillRect(wx - 20, wy, 40, 1)
    }

    // Lighthouse tower
    const towerX = w / 2
    const towerBase = horizonY - 5
    const towerTop = horizonY - 120
    const towerWidth = 16

    // Tower body
    const towerGrad = ctx.createLinearGradient(towerX - towerWidth, towerTop, towerX + towerWidth, towerTop)
    towerGrad.addColorStop(0, 'rgba(60, 55, 50, 0.3)')
    towerGrad.addColorStop(0.5, 'rgba(80, 75, 70, 0.3)')
    towerGrad.addColorStop(1, 'rgba(50, 45, 40, 0.3)')
    ctx.fillStyle = towerGrad
    ctx.beginPath()
    ctx.moveTo(towerX - towerWidth * 1.3, towerBase)
    ctx.lineTo(towerX - towerWidth * 0.7, towerTop + 15)
    ctx.lineTo(towerX + towerWidth * 0.7, towerTop + 15)
    ctx.lineTo(towerX + towerWidth * 1.3, towerBase)
    ctx.fill()

    // Lantern room
    ctx.fillStyle = 'rgba(40, 35, 30, 0.4)'
    ctx.fillRect(towerX - towerWidth, towerTop, towerWidth * 2, 15)

    // Light source
    const lightX = towerX
    const lightY = towerTop + 7
    const lightIntensity = lightOn ? 1 : 0.05

    // Light beam
    if (lightIntensity > 0.1) {
      const beamLen = Math.max(w, h) * 1.5
      const beamWidth = 0.12

      // Two beams (lighthouse rotates)
      for (let b = 0; b < 2; b++) {
        const angle = beamAngle + b * Math.PI
        const endX = lightX + Math.cos(angle) * beamLen
        const endY = lightY + Math.sin(angle) * beamLen

        const grad = ctx.createLinearGradient(lightX, lightY, endX, endY)
        grad.addColorStop(0, `rgba(255, 250, 220, ${0.4 * lightIntensity})`)
        grad.addColorStop(0.1, `rgba(255, 250, 220, ${0.15 * lightIntensity})`)
        grad.addColorStop(0.4, `rgba(255, 250, 220, ${0.03 * lightIntensity})`)
        grad.addColorStop(1, 'transparent')

        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.moveTo(lightX, lightY)
        ctx.lineTo(
          lightX + Math.cos(angle - beamWidth) * beamLen,
          lightY + Math.sin(angle - beamWidth) * beamLen,
        )
        ctx.lineTo(
          lightX + Math.cos(angle + beamWidth) * beamLen,
          lightY + Math.sin(angle + beamWidth) * beamLen,
        )
        ctx.fill()
      }
    }

    // Light source glow
    const glowSize = 15 + lightIntensity * 20
    const glow = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, glowSize)
    glow.addColorStop(0, `rgba(255, 250, 200, ${0.8 * lightIntensity})`)
    glow.addColorStop(0.3, `rgba(255, 240, 180, ${0.3 * lightIntensity})`)
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(lightX, lightY, glowSize, 0, Math.PI * 2)
    ctx.fill()

    // Stars (above horizon)
    ctx.fillStyle = 'rgba(200, 210, 230, 0.15)'
    for (let i = 0; i < 50; i++) {
      const sx = (Math.sin(i * 127.1) * 0.5 + 0.5) * w
      const sy = (Math.sin(i * 311.7) * 0.5 + 0.5) * horizonY * 0.9
      const twinkle = Math.sin(time * 2 + i * 1.3) > 0.7 ? 0.3 : 0.1
      ctx.fillStyle = `rgba(200, 210, 230, ${twinkle})`
      ctx.fillRect(sx, sy, 1, 1)
    }

    // Decoded message (appears letter by letter)
    if (decodedSoFar) {
      ctx.font = '16px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(255, 250, 200, ${0.3 + (lightOn ? 0.2 : 0)})`
      ctx.textAlign = 'center'
      ctx.fillText(decodedSoFar, w / 2, h * 0.25)
    }

    // Morse visual (current symbol)
    if (transmitting && currentSymbol) {
      ctx.font = '24px monospace'
      ctx.fillStyle = `rgba(255, 250, 200, ${lightOn ? 0.3 : 0.05})`
      ctx.textAlign = 'center'
      const morseStr = currentMessage ? textToMorse(currentMessage.slice(0, decodedSoFar.length + 1))
        .filter(s => s === 'dot' || s === 'dash')
        .map(s => s === 'dot' ? '·' : '—')
        .join(' ') : ''
      ctx.fillText(morseStr.slice(-30), w / 2, h * 0.3)
    }

    // Input area
    ctx.font = '12px monospace'
    ctx.fillStyle = 'rgba(255, 250, 200, 0.15)'
    ctx.textAlign = 'center'

    if (inputText) {
      ctx.fillText(`> ${inputText}_`, w / 2, h * 0.92)
    } else if (!transmitting) {
      ctx.fillStyle = 'rgba(255, 250, 200, 0.06)'
      ctx.fillText('type a message, press enter to transmit', w / 2, h * 0.92)
    }

    // Title
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(255, 250, 200, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the lighthouse', w / 2, 25)

    // Stats
    ctx.font = '9px monospace'
    ctx.fillStyle = 'rgba(255, 250, 200, 0.06)'
    ctx.textAlign = 'left'
    ctx.fillText(lightOn ? '■ transmitting' : '□ silence', 12, h - 18)
    ctx.textAlign = 'right'
    ctx.fillText(autoMode ? 'auto' : 'manual', w - 12, h - 18)
  }

  function handleKey(e: KeyboardEvent) {
    if (!active) return

    if (e.key === 'Enter' && inputText.length > 0) {
      transmitMessage(inputText)
      inputText = ''
      e.preventDefault()
      return
    }

    if (e.key === 'Backspace') {
      inputText = inputText.slice(0, -1)
      e.preventDefault()
      return
    }

    if (e.key === 'Escape') {
      inputText = ''
      e.preventDefault()
      return
    }

    // Only accept printable characters
    if (e.key.length === 1 && inputText.length < 60) {
      const lower = e.key.toLowerCase()
      if (MORSE[lower] || lower === ' ') {
        inputText += lower
        e.preventDefault()
      }
    }
  }

  return {
    name: 'lighthouse',
    label: 'the lighthouse',

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
      canvas.style.cssText = 'width: 100%; height: 100%;'
      ctx = canvas.getContext('2d')

      window.addEventListener('keydown', handleKey)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      // Shore link — hidden passage to tide pool
      if (deps.onDescend) {
        shoreLink = document.createElement('div')
        shoreLink.style.cssText = `
          position: absolute; bottom: 40px; left: 50%;
          transform: translateX(-50%);
          font-family: 'Cormorant Garamond', serif;
          font-size: 10px; font-style: italic;
          letter-spacing: 2px;
          color: rgba(80, 120, 180, 0.4);
          cursor: pointer; pointer-events: none;
          opacity: 0; transition: opacity 2s ease;
        `
        shoreLink.textContent = 'descend to the shore'
        shoreLink.addEventListener('click', () => deps.onDescend?.())
        overlay.appendChild(shoreLink)
      }

      overlay.appendChild(canvas)
      return overlay
    },

    activate() {
      active = true
      autoTimer = 60 // start auto-transmit after 1 second
      transmitCount = 0
      shoreLinkVisible = false
      if (shoreLink) {
        shoreLink.style.opacity = '0'
        shoreLink.style.pointerEvents = 'none'
      }
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
