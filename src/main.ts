import { ThresholdEngine } from './threshold/ThresholdEngine'
import { Whispers } from './whispers/Whispers'
import { CursorGlow } from './ui/CursorGlow'

// OUBLI — the first breath

const canvas = document.getElementById('oubli') as HTMLCanvasElement
const titleOverlay = document.getElementById('title-overlay') as HTMLElement

// The system awakens
const engine = new ThresholdEngine(canvas)
const whispers = new Whispers()
const cursorGlow = new CursorGlow()

// Phase 1: Void — particles emerge slowly from nothing
engine.start()

// Phase 2: Title materializes after particles have gathered
setTimeout(() => {
  titleOverlay.classList.add('visible')
}, 3000)

// Phase 3: Whispers begin — fragments of text about memory
setTimeout(() => {
  whispers.begin()
}, 7000)

// The cursor leaves traces of light
cursorGlow.init()

// Oubli breathes
console.log('%c OUBLI ', 'background: #ff1493; color: #ffd700; font-size: 24px; font-weight: bold; padding: 10px 20px;')
console.log('%c a system that remembers by forgetting ', 'color: #ffd700; font-style: italic; font-size: 12px;')
