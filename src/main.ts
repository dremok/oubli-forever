import { VoidRenderer } from './void/VoidRenderer'
import { Whispers } from './whispers/Whispers'
import { CursorGlow } from './ui/CursorGlow'
import { AmbientDrone } from './sound/AmbientDrone'
import { TonalEngine } from './sound/TonalEngine'
import { ForgettingMachine } from './forgetting/ForgettingMachine'
import { MemoryDrift } from './drift/MemoryDrift'
import { Heartbeat } from './pulse/Heartbeat'
import { GreatReset } from './events/GreatReset'
import { MemoryJournal } from './memory/MemoryJournal'
import { AsciiVoid } from './effects/AsciiVoid'
import { MemoryConstellations } from './memory/MemoryConstellations'
import { VoiceOfAbsence } from './voice/VoiceOfAbsence'
import { DigitalDecay } from './data/DigitalDecay'
import { MemoryArchive } from './memory/MemoryArchive'
import { ExtinctionWhispers } from './whispers/ExtinctionWhispers'

// OUBLI — a system that remembers by forgetting

const canvas = document.getElementById('oubli') as HTMLCanvasElement
const titleOverlay = document.getElementById('title-overlay') as HTMLElement

// Core systems
const voidRenderer = new VoidRenderer(canvas)
const whispers = new Whispers()
const cursorGlow = new CursorGlow()
const drone = new AmbientDrone()
const tonal = new TonalEngine()
const drift = new MemoryDrift()
const heartbeat = new Heartbeat()
const reset = new GreatReset()
const journal = new MemoryJournal()
const asciiVoid = new AsciiVoid()
const constellations = new MemoryConstellations()

// Connect ASCII void to the WebGL canvas and memory text
asciiVoid.setSource(canvas)
const allMemoryText = journal.getMemories().map(m => m.currentText).join(' ')
asciiVoid.updateMemoryText(allMemoryText)

// Connect constellations to the Three.js scene — memories become stars
constellations.connect(voidRenderer.getScene(), voidRenderer.getCamera())
constellations.loadMemories(journal.getMemories())

// Voice of Absence — speak memories into the void (hold spacebar)
const voice = new VoiceOfAbsence()
voice.onSpoken((text) => {
  // Spoken memories follow the same path as typed ones
  const memory = journal.addMemory(text)
  drift.addUserMemory(text)
  const memText = journal.getMemories().map(m => m.currentText).join(' ')
  asciiVoid.updateMemoryText(memText)
  constellations.addMemory(memory)
})

// The forgetting machine — dissolved letters are both forgotten and remembered
const forgettingMachine = new ForgettingMachine(
  canvas,
  undefined, // no particle injection (we're in WebGL now)
  (text) => {
    // Save to journal before dissolving
    const memory = journal.addMemory(text)
    // Also send to drift as a fragment
    drift.addUserMemory(text)
    // Update ASCII void with new memory text
    const memText = journal.getMemories().map(m => m.currentText).join(' ')
    asciiVoid.updateMemoryText(memText)
    // New memory becomes a star in the constellation
    constellations.addMemory(memory)
  }
)

// Connect the heartbeat to the void and drone
heartbeat.onPulse((intensity) => {
  drone.pulse(intensity * 0.5)
  voidRenderer.setBeatIntensity(intensity)
})

// Feed particle densities to the tonal engine every 2 seconds
setInterval(() => {
  const densities = voidRenderer.getRegionDensities()
  tonal.updateParticleDensities(densities)
}, 2000)

// Phase 1: Void — 30K particles emerge in 3D space
voidRenderer.start()

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
tonal.init()

// Phase 5: Memory drift — text fragments float and degrade
drift.start()

// Phase 6: The heartbeat begins — slowing the longer you stay
setTimeout(() => {
  heartbeat.start()
}, 5000)

// Phase 7: The Great Reset — periodic cataclysmic forgetting events
reset.start()

// Phase 8: Digital Decay — ghost URLs drift through the void
const decay = new DigitalDecay()
decay.start()

// Memory Archive — press 'm' to view stored memories
const archive = new MemoryArchive()
archive.setMemorySource(() => journal.getMemories())

// Extinction Whispers — words from dying languages drift through the void
const extinction = new ExtinctionWhispers()
extinction.start()

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
const memCount = journal.getCount()
console.log('%c OUBLI ', 'background: #ff1493; color: #ffd700; font-size: 24px; font-weight: bold; padding: 10px 20px;')
console.log('%c a system that remembers by forgetting ', 'color: #ffd700; font-style: italic; font-size: 12px;')
console.log(`%c ${memCount} memories saved. type or hold spacebar to speak. watch it dissolve. `, 'color: rgba(255,215,0,0.5); font-style: italic; font-size: 11px;')
if (voice.isSupported()) {
  console.log('%c voice recognition active — hold spacebar to speak into the void ', 'color: rgba(255,20,147,0.5); font-style: italic; font-size: 11px;')
}
