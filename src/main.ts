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
import { PresenceHeatmap } from './ui/PresenceHeatmap'
import { SessionClock } from './ui/SessionClock'
import { VisitorLog } from './ui/VisitorLog'
import { DreamSynthesizer } from './dreams/DreamSynthesizer'
import { InteractionCues } from './ui/InteractionCues'
import { ParticleTrails } from './effects/ParticleTrails'
import { ResonanceMap } from './sound/ResonanceMap'
import { Palimpsest } from './narrative/Palimpsest'
import { ColorMemory } from './effects/ColorMemory'
import { GhostTyping } from './narrative/GhostTyping'
import { GentleGuide } from './ui/GentleGuide'
import { CircadianVoid } from './time/CircadianVoid'
import { DriftEngine } from './drift/DriftEngine'
import { DeviceDrift } from './input/DeviceDrift'
import { RoomManager } from './rooms/RoomManager'
import { createVoidRoom } from './rooms/TheVoid'
import { createStudyRoom } from './rooms/TheStudy'
import { createInstrumentRoom } from './rooms/TheInstrument'
import { createObservatoryRoom } from './rooms/TheObservatory'
import { createSeanceRoom } from './rooms/TheSeance'
import { createDarkroomRoom } from './rooms/TheDarkroom'
import { createGardenRoom } from './rooms/TheGarden'
import { createArchiveRoom } from './rooms/TheArchive'
import { createCatacombsRoom } from './rooms/TheCatacombs'
import { createLoomRoom } from './rooms/TheLoom'
import { createRootsRoom } from './rooms/TheRoots'
import { createOssuaryRoom } from './rooms/TheOssuary'
import { createTidePoolRoom } from './rooms/TheTidePool'
import { createBetweenRoom } from './rooms/TheBetween'
import { createFurnaceRoom } from './rooms/TheFurnace'
import { SharpWaveRipples } from './replay/SharpWaveRipples'
import { DreamVisions } from './dreams/DreamVisions'
import { TippingPoint } from './events/TippingPoint'
import { VoidWhisper } from './voice/VoidWhisper'
import { AmbientTextures } from './sound/AmbientTextures'
import { TimeCapsule } from './memory/TimeCapsule'

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

// Dream Synthesizer — the system recombines your memories into surreal sentences
const dreams = new DreamSynthesizer()
dreams.loadMemories(journal.getMemories().map(m => m.currentText))

// Ghost Typing — the void types your memories back at you when idle
const ghostTyping = new GhostTyping()
ghostTyping.loadMemories(journal.getMemories())

// Palimpsest — ghosts of previous sessions' text bleed through
const palimpsest = new Palimpsest()

// Color Memory — the void shifts color based on emotional tone of your words
const colorMemory = new ColorMemory()

// Helper: save memory to all systems
function processNewMemory(text: string) {
  const memory = journal.addMemory(text)
  drift.addUserMemory(text)
  const memText = journal.getMemories().map(m => m.currentText).join(' ')
  asciiVoid.updateMemoryText(memText)
  constellations.addMemory(memory)
  dreams.addMemory(text)
  palimpsest.addText(text)
  colorMemory.processText(text)
  ripples.addMemory(memory)
}

// Voice of Absence — speak memories into the void (hold spacebar)
const voice = new VoiceOfAbsence()
voice.onSpoken((text) => processNewMemory(text))
voice.setTypingCheck(() => forgettingMachine.hasActiveInput())

// The forgetting machine — dissolved letters are both forgotten and remembered
const forgettingMachine = new ForgettingMachine(
  canvas,
  undefined, // no particle injection (we're in WebGL now)
  (text) => processNewMemory(text),
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

// Memory Archive — press 'm' to view stored memories (slides in from right)
const archive = new MemoryArchive()
archive.setMemorySource(() => journal.getMemories())
archive.setTypingCheck(() => forgettingMachine.hasActiveInput())

// Extinction Whispers — words from dying languages drift through the void
const extinction = new ExtinctionWhispers()
extinction.start()

// Presence Heatmap — your attention mapped, slowly cooling (press 'h' to see)
const heatmap = new PresenceHeatmap()
heatmap.start()

// Session Clock — time that forgets itself
const clock = new SessionClock()
clock.start()

// Visitor Log — how many times you've returned
const _visitor = new VisitorLog()

// Sharp Wave Ripples — periodic memory replay events
const ripples = new SharpWaveRipples()
ripples.loadMemories(journal.getMemories())

// Dream Visions — fal.ai generates images from dream sentences
const dreamVisions = new DreamVisions()

// Void Whisper — ElevenLabs TTS gives the void a voice
const voidWhisper = new VoidWhisper()

// Wire dreams to both vision and voice
dreams.onDream((text) => {
  dreamVisions.onDream(text)
  voidWhisper.onDream(text)
})

// Wire whispers to voice
whispers.onWhisper((text) => voidWhisper.onWhisper(text))

// Ambient Textures — ElevenLabs generates procedural atmosphere per drift state
const ambientTextures = new AmbientTextures()

// Tipping Point — entropy cascade when memories degrade past thresholds
const tippingPoint = new TippingPoint()
tippingPoint.setMemorySource(() => journal.getMemories())
tippingPoint.onChange((state) => {
  // Modulate visuals based on entropy phase
  voidRenderer.setGrainIntensity(0.08 * state.grainMultiplier)
  voidRenderer.setBloomStrength(1.2 * state.bloomMultiplier)
  voidRenderer.setDriftSpeed(state.speedMultiplier)
  voidRenderer.setChromaticAberration(0.002 * state.chromaticIntensity)
  // Modulate sound — dissonance increases with entropy
  drone.setDissonance(state.droneDissonance)
  // Feed entropy to void whisper — voice degrades with entropy
  voidWhisper.setEntropy(state.entropy)
  // Feed entropy phase to ambient textures
  ambientTextures.setEntropyPhase(state.phase)
})

// Start dreams, ghost typing, ripples, and tipping point
dreams.start()
ghostTyping.start()
ripples.start()
tippingPoint.start()

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

// Device Drift — mobile gyroscope controls camera on tilt
const deviceDrift = new DeviceDrift()
deviceDrift.onOrientation((tiltX, tiltY) => {
  voidRenderer.setDeviceTilt(tiltX, tiltY)
  drone.setPresence(
    0.5 + tiltX * 0.5,
    0.5 + tiltY * 0.5,
    true
  )
})

// Title fades after the user starts typing — Oubli makes room
window.addEventListener('keydown', () => {
  titleOverlay.style.transition = 'opacity 3s ease'
  titleOverlay.style.opacity = '0.15'
}, { once: true })

palimpsest.start()

// Resonance Map — click anywhere to play the void like an instrument
const resonance = new ResonanceMap()

// Particle Trails — press 't' for comet-like afterimages
const trails = new ParticleTrails()
trails.setSource(canvas)

// Circadian Void — the void breathes with the Earth's day/night cycle
const circadian = new CircadianVoid()
voidRenderer.setBloomStrength(circadian.getBloomStrength())
voidRenderer.setFogDensity(circadian.getFogDensity())

// Update circadian influence every 30 seconds
setInterval(() => {
  voidRenderer.setBloomStrength(circadian.getBloomStrength())
  voidRenderer.setFogDensity(circadian.getFogDensity())
}, 30000)

// Drift Engine — consciousness moves between states (1-5 keys, void room only)
const driftEngine = new DriftEngine()
driftEngine.setTypingCheck(() => forgettingMachine.hasActiveInput())
driftEngine.onChange((state) => {
  // Particle modulation
  voidRenderer.setDriftSpeed(state.speedMultiplier)
  voidRenderer.setDriftSize(state.sizeMultiplier)
  voidRenderer.setDriftGravity(state.gravityMultiplier)
  voidRenderer.setDriftHueShift(state.hueShift)
  voidRenderer.setDriftSaturation(state.saturation)
  // Visual modulation
  voidRenderer.setBackgroundColor(state.bgColor[0], state.bgColor[1], state.bgColor[2])
  voidRenderer.setBloomStrength(state.bloomStrength)
  voidRenderer.setFogDensity(state.fogDensity)
  voidRenderer.setGrainIntensity(state.grainIntensity)
  // Sound modulation
  drone.setFrequencyMultiplier(state.droneFreqMultiplier)
  drone.setVolumeMultiplier(state.droneVolume)
  // Ambient texture changes with drift state
  ambientTextures.setDriftState(state.name)
})

// Interaction Cues — subtle hints about what's possible
const cues = new InteractionCues()
cues.setVoiceSupported(voice.isSupported())
cues.start()

// Gentle Guide — shows interaction hints on first few visits
const guide = new GentleGuide()
guide.show(voice.isSupported())

// Room System — tab-based navigation
const roomManager = new RoomManager()

// Register rooms — Study emits new text, Instrument emits notes
roomManager.addRoom(createVoidRoom())
roomManager.addRoom(createStudyRoom(
  () => journal.getMemories(),
  (text) => processNewMemory(text),
))
roomManager.addRoom(createInstrumentRoom((freq, velocity) => {
  // Instrument notes cause subtle particle pulses and color shifts
  voidRenderer.setBeatIntensity(velocity * 0.5)
  voidRenderer.setDriftHueShift((freq % 440) / 440)
}))
roomManager.addRoom(createObservatoryRoom({
  getMemories: () => journal.getMemories(),
  getConstellationSprites: () => constellations.getSprites(),
  getMemoryById: (id) => constellations.getMemoryById(id),
  getCamera: () => voidRenderer.getCamera(),
  getCanvas: () => voidRenderer.getCanvas(),
  pauseCamera: () => voidRenderer.pauseCameraDrift(),
  resumeCamera: () => voidRenderer.resumeCameraDrift(),
}))
roomManager.addRoom(createSeanceRoom({
  getMemories: () => journal.getMemories(),
  speakText: voidWhisper.isAvailable()
    ? (text) => voidWhisper.onDream(text)
    : undefined,
  onBetween: () => roomManager.switchTo('between'),
}))
roomManager.addRoom(createDarkroomRoom({
  getMemories: () => journal.getMemories(),
}))
roomManager.addRoom(createGardenRoom({
  getMemories: () => journal.getMemories(),
  onDescend: () => roomManager.switchTo('roots'),
}))
roomManager.addRoom(createArchiveRoom({
  onDescend: () => roomManager.switchTo('catacombs'),
}))
roomManager.addRoom(createCatacombsRoom({
  onReturn: () => roomManager.switchTo('archive'),
  onOssuary: () => roomManager.switchTo('ossuary'),
}))
roomManager.addRoom(createLoomRoom({
  getMemories: () => journal.getMemories(),
}))
roomManager.addRoom(createRootsRoom({
  getMemories: () => journal.getMemories(),
  onAscend: () => roomManager.switchTo('garden'),
  onDeeper: () => roomManager.switchTo('ossuary'),
}))
roomManager.addRoom(createOssuaryRoom({
  getMemories: () => journal.getMemories(),
  toRoots: () => roomManager.switchTo('roots'),
  toCatacombs: () => roomManager.switchTo('catacombs'),
}))
roomManager.addRoom(createTidePoolRoom({
  getMemories: () => journal.getMemories(),
}))
roomManager.addRoom(createBetweenRoom({
  switchTo: (name) => roomManager.switchTo(name),
  getActiveRoom: () => roomManager.getActiveRoom(),
}))
roomManager.addRoom(createFurnaceRoom({
  getMemories: () => journal.getMemories(),
  accelerateDegradation: (id, amount) => journal.accelerateDegradation(id, amount),
}))

// Wire room checks — features only fire in the right room
const getRoomName = () => roomManager.getActiveRoom()
driftEngine.setRoomCheck(getRoomName)
forgettingMachine.setRoomCheck(getRoomName)
asciiVoid.setRoomCheck(getRoomName)
trails.setRoomCheck(getRoomName)
heatmap.setRoomCheck(getRoomName)
voice.setRoomCheck(getRoomName)
resonance.setRoomCheck(getRoomName)

// Room change: toggle void-only text overlays
roomManager.onRoomChange((room) => {
  const inVoid = room === 'void'
  // Whispers pause/resume
  if (inVoid) whispers.resume(); else whispers.pause()
  // Canvas-based text overlays show/hide
  extinction.setVisible(inVoid)
  drift.setVisible(inVoid)
  decay.setVisible(inVoid)
  dreams.setVisible(inVoid)
  ghostTyping.setVisible(inVoid)
  ripples.setVisible(inVoid)
  dreamVisions.setVisible(inVoid)
  tippingPoint.setVisible(inVoid)
  voidWhisper.setVisible(inVoid)
  ambientTextures.setVisible(inVoid)
})

// Time Capsule — seal a memory for the future (press 'c' in void room)
const _timeCapsule = new TimeCapsule({
  addTimeCapsule: (text, date) => journal.addTimeCapsule(text, date),
  processNewMemory: (memory) => {
    constellations.addMemory(memory)
    ripples.addMemory(memory)
  },
  roomCheck: () => roomManager.getActiveRoom(),
  typingCheck: () => forgettingMachine.hasActiveInput(),
})

// Show the tab bar after the initial animation settles
setTimeout(() => roomManager.init(), 8000)

// Oubli breathes
const memCount = journal.getCount()
console.log('%c OUBLI ', 'background: #ff1493; color: #ffd700; font-size: 24px; font-weight: bold; padding: 10px 20px;')
console.log('%c a system that remembers by forgetting ', 'color: #ffd700; font-style: italic; font-size: 12px;')
console.log(`%c ${memCount} memories saved. type or hold spacebar to speak. watch it dissolve. `, 'color: rgba(255,215,0,0.5); font-style: italic; font-size: 11px;')
if (voice.isSupported()) {
  console.log('%c voice recognition active — hold spacebar to speak into the void ', 'color: rgba(255,20,147,0.5); font-style: italic; font-size: 11px;')
}
