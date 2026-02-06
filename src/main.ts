import { ThresholdEngine } from './threshold/ThresholdEngine'
import { Whispers } from './whispers/Whispers'
import { CursorGlow } from './ui/CursorGlow'
import { AmbientDrone } from './sound/AmbientDrone'
import { ForgettingMachine } from './forgetting/ForgettingMachine'

// OUBLI — the first breath

const canvas = document.getElementById('oubli') as HTMLCanvasElement
const titleOverlay = document.getElementById('title-overlay') as HTMLElement

// The system awakens
const engine = new ThresholdEngine(canvas)
const whispers = new Whispers()
const cursorGlow = new CursorGlow()
const drone = new AmbientDrone()

// The forgetting machine — dissolved letters become particles
const forgettingMachine = new ForgettingMachine(canvas, (x, y, hue) => {
  engine.injectParticle(x, y, hue)
})

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

// Phase 4: Sound awakens on first interaction
drone.init()

// The cursor leaves traces of light
cursorGlow.init()

// Connect mouse to sound — presence shapes the harmonic field
window.addEventListener('mousemove', (e) => {
  drone.setPresence(
    e.clientX / window.innerWidth,
    e.clientY / window.innerHeight,
    true
  )
})

// Title fades after the user starts typing — Oubli makes room
window.addEventListener('keydown', () => {
  titleOverlay.style.transition = 'opacity 3s ease'
  titleOverlay.style.opacity = '0.15'
}, { once: true })

// Oubli breathes
console.log('%c OUBLI ', 'background: #ff1493; color: #ffd700; font-size: 24px; font-weight: bold; padding: 10px 20px;')
console.log('%c a system that remembers by forgetting ', 'color: #ffd700; font-style: italic; font-size: 12px;')
console.log('%c type a memory. press enter. watch it dissolve. ', 'color: rgba(255,215,0,0.5); font-style: italic; font-size: 11px;')
