/**
 * SPEECH HELPER — lightweight speech recognition for rooms
 *
 * Each room that wants voice input creates its own SpeechSession.
 * This does not conflict with VoiceOfAbsence, which only activates
 * in the void room (checked via roomCheck).
 *
 * Usage:
 *   const speech = createSpeechSession()
 *   speech.onUpdate((text) => { ... })
 *   speech.start()
 *   // ... user speaks ...
 *   const finalText = speech.stop()
 */

export interface SpeechSession {
  start(): void
  stop(): string
  isListening(): boolean
  getText(): string
  onUpdate(cb: (text: string) => void): void
  destroy(): void
  readonly supported: boolean
}

export function createSpeechSession(): SpeechSession {
  const SR = (window as any).SpeechRecognition ||
             (window as any).webkitSpeechRecognition

  if (!SR) {
    return {
      start() {},
      stop() { return '' },
      isListening() { return false },
      getText() { return '' },
      onUpdate() {},
      destroy() {},
      supported: false,
    }
  }

  const recognition = new SR()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = 'en-US'

  let listening = false
  let finalText = ''
  let currentText = ''
  let updateCb: ((text: string) => void) | null = null

  recognition.onresult = (event: any) => {
    let interim = ''
    let newFinal = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript
      if (event.results[i].isFinal) newFinal += transcript
      else interim += transcript
    }
    if (newFinal) finalText += newFinal
    currentText = finalText + interim
    updateCb?.(currentText)
  }

  recognition.onerror = () => { listening = false }
  recognition.onend = () => {
    if (listening) {
      try { recognition.start() } catch { /* already running */ }
    }
  }

  return {
    start() {
      if (listening) return
      listening = true
      finalText = ''
      currentText = ''
      try { recognition.start() } catch { /* */ }
    },
    stop() {
      listening = false
      try { recognition.stop() } catch { /* */ }
      const text = currentText.trim()
      currentText = ''
      finalText = ''
      return text
    },
    isListening() { return listening },
    getText() { return currentText },
    onUpdate(cb) { updateCb = cb },
    destroy() {
      listening = false
      try { recognition.stop() } catch { /* */ }
    },
    supported: true,
  }
}
