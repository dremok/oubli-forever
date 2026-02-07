/**
 * VOICE OF ABSENCE — speak your memories into the void
 *
 * Hold spacebar to listen. Speak. Release. Your words appear as text,
 * hover for a breath, then dissolve through the Forgetting Machine.
 *
 * The Web Speech API converts your voice to text in real-time.
 * As you speak, the words materialize letter by letter in the center
 * of the screen — gold text that trembles with the amplitude of
 * your voice. When you stop, the text lingers for 2 seconds,
 * then feeds itself to the Forgetting Machine for dissolution.
 *
 * A spoken memory is more intimate than a typed one. The system
 * heard you. It understood. Then it forgot.
 *
 * Technical: Uses SpeechRecognition (Web Speech API).
 * Fallback: If not supported, the feature silently disables.
 *
 * Inspired by: Confessionals, whisper networks, the last words
 * of dying languages, voicemail messages from the dead
 */

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionResultList {
  length: number
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

export class VoiceOfAbsence {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private recognition: any = null // SpeechRecognition instance
  private supported = false
  private listening = false
  private currentText = ''
  private finalText = ''
  private displayText = ''
  private textAlpha = 0
  private targetAlpha = 0
  private animating = false
  private frameId = 0
  private width = 0
  private height = 0
  private dpr = 1
  private spaceHeld = false
  private dissolveTimer: number | null = null
  private onMemorySpoken: ((text: string) => void) | null = null
  private indicatorPulse = 0
  private shimmerPhase = 0
  private roomCheck: (() => string) | null = null

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 250; pointer-events: none;
    `
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!
    this.resize()

    this.initSpeechRecognition()
    this.bindEvents()
  }

  private resize() {
    this.dpr = Math.min(window.devicePixelRatio, 2)
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = this.width * this.dpr
    this.canvas.height = this.height * this.dpr
    this.canvas.style.width = this.width + 'px'
    this.canvas.style.height = this.height + 'px'
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  private initSpeechRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition ||
                               (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      this.supported = false
      return
    }

    this.supported = true
    this.recognition = new SpeechRecognition()
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.lang = 'en-US'

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }

      if (final) {
        this.finalText += final
      }
      this.currentText = this.finalText + interim
      this.displayText = this.currentText
      this.targetAlpha = 1

      if (!this.animating) {
        this.startAnimation()
      }
    }

    this.recognition.onerror = () => {
      // Silently handle — the void accepts silence too
      this.listening = false
    }

    this.recognition.onend = () => {
      // If space is still held, restart
      if (this.spaceHeld && this.listening) {
        try {
          this.recognition.start()
        } catch {
          // Already running or other error
        }
      }
    }
  }

  private bindEvents() {
    window.addEventListener('resize', () => this.resize())

    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' || e.repeat) return
      if (!this.supported) return

      // Don't capture if typing in forgetting machine
      if (document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA') return

      // Only in void room
      if (this.roomCheck && this.roomCheck() !== 'void') return

      // Only activate with spacebar held (not just pressed)
      // The forgetting machine uses regular typing, this uses hold-space
      this.spaceHeld = true

      // Clear any pending dissolve
      if (this.dissolveTimer) {
        clearTimeout(this.dissolveTimer)
        this.dissolveTimer = null
      }

      this.startListening()
      e.preventDefault()
    })

    window.addEventListener('keyup', (e) => {
      if (e.code !== 'Space') return
      this.spaceHeld = false
      this.stopListening()
    })
  }

  private startListening() {
    if (this.listening || !this.supported) return
    this.listening = true
    this.currentText = ''
    this.finalText = ''
    this.displayText = ''
    this.targetAlpha = 0.5 // Dim while waiting for speech

    try {
      this.recognition.start()
    } catch {
      // May already be started
    }

    if (!this.animating) {
      this.startAnimation()
    }
  }

  private stopListening() {
    if (!this.listening) return
    this.listening = false

    try {
      this.recognition.stop()
    } catch {
      // Already stopped
    }

    // If we have text, dissolve it after a pause
    if (this.displayText.trim()) {
      this.dissolveTimer = window.setTimeout(() => {
        const text = this.displayText.trim()
        if (text && this.onMemorySpoken) {
          this.onMemorySpoken(text)
        }
        this.targetAlpha = 0
        this.displayText = ''
        this.currentText = ''
        this.finalText = ''
      }, 2000) // 2 seconds to read your words one last time
    } else {
      this.targetAlpha = 0
    }
  }

  private startAnimation() {
    if (this.animating) return
    this.animating = true

    const animate = () => {
      this.frameId = requestAnimationFrame(animate)
      this.render()
    }
    animate()
  }

  private render() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    // Smooth alpha transitions
    this.textAlpha += (this.targetAlpha - this.textAlpha) * 0.08

    this.shimmerPhase += 0.03
    this.indicatorPulse += 0.05

    // Stop animation when fully faded
    if (this.textAlpha < 0.01 && !this.listening && !this.displayText) {
      cancelAnimationFrame(this.frameId)
      this.animating = false
      return
    }

    const centerX = this.width / 2
    const centerY = this.height * 0.4 // Above center — speech rises

    // Listening indicator
    if (this.listening) {
      this.renderListeningIndicator(ctx, centerX, centerY)
    }

    // Spoken text
    if (this.displayText) {
      this.renderSpokenText(ctx, centerX, centerY)
    }
  }

  private renderListeningIndicator(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number
  ) {
    // Pulsing circle — the void is listening
    const pulse = Math.sin(this.indicatorPulse) * 0.5 + 0.5
    const radius = 30 + pulse * 15

    ctx.beginPath()
    ctx.arc(centerX, centerY - 60, radius, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255, 20, 147, ${0.3 + pulse * 0.3})`
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Inner glow
    const gradient = ctx.createRadialGradient(
      centerX, centerY - 60, 0,
      centerX, centerY - 60, radius
    )
    gradient.addColorStop(0, `rgba(255, 20, 147, ${0.1 + pulse * 0.1})`)
    gradient.addColorStop(1, 'rgba(255, 20, 147, 0)')
    ctx.fillStyle = gradient
    ctx.fill()

    // "listening..." text
    ctx.font = `300 11px 'Cormorant Garamond', serif`
    ctx.textAlign = 'center'
    ctx.fillStyle = `rgba(255, 215, 0, ${0.3 + pulse * 0.2})`
    ctx.fillText('speak into the void...', centerX, centerY - 15)
  }

  private renderSpokenText(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number
  ) {
    const text = this.displayText
    const fontSize = Math.min(this.width * 0.04, 36)
    ctx.font = `300 ${fontSize}px 'Cormorant Garamond', serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Word wrap
    const maxWidth = this.width * 0.6
    const lines = this.wrapText(ctx, text, maxWidth)
    const lineHeight = fontSize * 1.4
    const totalHeight = lines.length * lineHeight
    const startY = centerY - totalHeight / 2

    for (let l = 0; l < lines.length; l++) {
      const lineText = lines[l]
      const lineY = startY + l * lineHeight

      // Each character rendered individually with shimmer
      const lineWidth = ctx.measureText(lineText).width
      let x = centerX - lineWidth / 2

      for (let i = 0; i < lineText.length; i++) {
        const char = lineText[i]
        const charWidth = ctx.measureText(char).width

        // Shimmer — each character has a slightly different phase
        const shimmer = Math.sin(this.shimmerPhase + i * 0.3 + l * 1.2) * 0.15 + 0.85
        const alpha = this.textAlpha * shimmer

        // Color shifts from gold to pink across the text
        const hue = 40 + (i / lineText.length) * (-10) // warm gold
        const sat = 70 + shimmer * 20

        ctx.fillStyle = `hsla(${hue}, ${sat}%, 75%, ${alpha})`

        // Slight vertical tremor — voice vibration
        const tremor = this.listening ? Math.sin(Date.now() * 0.01 + i) * 1.5 : 0

        ctx.fillText(char, x + charWidth / 2, lineY + tremor)
        x += charWidth
      }
    }
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }
    if (currentLine) lines.push(currentLine)
    return lines
  }

  /** Set a function that returns the current room name */
  setRoomCheck(check: () => string) {
    this.roomCheck = check
  }

  /** Register callback for when a spoken memory is ready to dissolve */
  onSpoken(callback: (text: string) => void) {
    this.onMemorySpoken = callback
  }

  isSupported(): boolean {
    return this.supported
  }

  isListening(): boolean {
    return this.listening
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
    if (this.dissolveTimer) clearTimeout(this.dissolveTimer)
    try { this.recognition?.stop() } catch { /* */ }
    this.canvas.remove()
  }
}
