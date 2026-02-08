/**
 * THE OBSERVATORY — where memories become navigable stars
 *
 * A room for exploring the memory constellation in 3D space.
 * The camera is freed from its drift — orbit controls let you
 * fly through the cosmos of your stored memories. Click on any
 * star to read its text, see its connections, hear its tone.
 *
 * This is the memory palace made visible. Not a list, not an
 * archive, but a spatial experience — memories exist in locations,
 * and the journey between them is part of the remembering.
 *
 * Spatial audio via PannerNode: each memory star hums from its
 * position in 3D space. As you orbit, sounds shift around you.
 *
 * Inspired by: Planetariums, star charts, memory palaces,
 * Refik Anadol's Infinity Room, hippocampal place cells,
 * the 2026 finding that hippocampus reorganizes memories spatially
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface ObservatoryDeps {
  getMemories: () => StoredMemory[]
  getConstellationSprites: () => THREE.Sprite[]
  getMemoryById: (id: string) => StoredMemory | null
  getCamera: () => THREE.PerspectiveCamera
  getCanvas: () => HTMLCanvasElement
  getScene: () => THREE.Scene
  pauseCamera: () => void
  resumeCamera: () => void
  switchTo?: (name: string) => void
}

// --- APOD cache (module-level, survives room re-creation) ---
interface APODData {
  title: string
  explanation: string
  url: string
  hdurl?: string
  date: string
  media_type: string
}

let apodCache: { data: APODData; fetchedAt: number } | null = null
const APOD_CACHE_MS = 60 * 60 * 1000 // 1 hour

async function fetchAPOD(): Promise<APODData | null> {
  // Return cached data if fresh
  if (apodCache && Date.now() - apodCache.fetchedAt < APOD_CACHE_MS) {
    return apodCache.data
  }
  try {
    const res = await fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY')
    if (!res.ok) return null
    const data = await res.json() as APODData
    if (data.media_type !== 'image') return null // only images
    apodCache = { data, fetchedAt: Date.now() }
    return data
  } catch {
    return null
  }
}

// --- Nebula particle system ---
const NEBULA_COUNT = 6000

function createNebulaSystem(): THREE.Points {
  const positions = new Float32Array(NEBULA_COUNT * 3)
  const colors = new Float32Array(NEBULA_COUNT * 3)
  const sizes = new Float32Array(NEBULA_COUNT)
  const phases = new Float32Array(NEBULA_COUNT) // for orbital drift

  // Color palette: deep purples, blues, golds, warm magentas
  const palette = [
    [0.35, 0.15, 0.65], // purple
    [0.20, 0.25, 0.70], // deep blue
    [0.50, 0.18, 0.55], // magenta-purple
    [0.75, 0.60, 0.20], // gold
    [0.15, 0.35, 0.70], // cerulean
    [0.60, 0.25, 0.50], // warm magenta
    [0.25, 0.40, 0.65], // slate blue
    [0.80, 0.70, 0.30], // bright gold
  ]

  for (let i = 0; i < NEBULA_COUNT; i++) {
    // Distribute in a large sphere with clusters
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = 300 + Math.random() * 600 + Math.pow(Math.random(), 3) * 400

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = r * Math.cos(phi)

    // Pick a color from palette with slight randomness
    const col = palette[Math.floor(Math.random() * palette.length)]
    const variation = 0.15
    colors[i * 3] = Math.max(0, Math.min(1, col[0] + (Math.random() - 0.5) * variation))
    colors[i * 3 + 1] = Math.max(0, Math.min(1, col[1] + (Math.random() - 0.5) * variation))
    colors[i * 3 + 2] = Math.max(0, Math.min(1, col[2] + (Math.random() - 0.5) * variation))

    sizes[i] = 1.0 + Math.random() * 3.0
    phases[i] = Math.random() * Math.PI * 2
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

  // Store phases as userData for animation
  ;(geometry as THREE.BufferGeometry & { userData: { phases: Float32Array } }).userData = { phases }

  const material = new THREE.PointsMaterial({
    size: 2.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  })

  const points = new THREE.Points(geometry, material)
  points.name = 'observatory-nebula'
  return points
}

function animateNebula(nebula: THREE.Points, t: number) {
  const positions = nebula.geometry.getAttribute('position') as THREE.BufferAttribute
  const geoData = (nebula.geometry as THREE.BufferGeometry & { userData: { phases: Float32Array } }).userData
  const phases = geoData.phases
  if (!positions || !phases) return

  const arr = positions.array as Float32Array
  for (let i = 0; i < NEBULA_COUNT; i++) {
    const phase = phases[i]
    const ix = i * 3
    const x = arr[ix]
    const y = arr[ix + 1]
    const z = arr[ix + 2]

    // Slow orbital drift — rotate around Y axis with slight vertical undulation
    const speed = 0.0003 + (phase / (Math.PI * 2)) * 0.0004
    const angle = speed * t
    const cosA = Math.cos(angle)
    const sinA = Math.sin(angle)

    // Rotate XZ around origin
    const nx = x * cosA - z * sinA
    const nz = x * sinA + z * cosA
    // Gentle vertical drift
    const ny = y + Math.sin(t * 0.0005 + phase) * 0.15

    arr[ix] = nx
    arr[ix + 1] = ny
    arr[ix + 2] = nz
  }
  positions.needsUpdate = true
}

// --- Star twinkle data ---
interface TwinkleData {
  phase: number
  frequency: number
  baseScale: number
  isDegraded: boolean
}

function buildTwinkleData(sprites: THREE.Sprite[], memories: StoredMemory[], getMemoryById: (id: string) => StoredMemory | null): TwinkleData[] {
  return sprites.map(sprite => {
    const memoryId = sprite.userData.memoryId as string | undefined
    const memory = memoryId ? getMemoryById(memoryId) : null
    const isDegraded = memory ? memory.degradation > 0.3 : false
    return {
      phase: Math.random() * Math.PI * 2,
      frequency: isDegraded
        ? 1.5 + Math.random() * 3.0   // erratic fast twinkle for degraded
        : 0.3 + Math.random() * 0.8,  // calm slow twinkle for healthy
      baseScale: sprite.scale.x,
      isDegraded,
    }
  })
}

function animateTwinkle(sprites: THREE.Sprite[], twinkleData: TwinkleData[], t: number) {
  for (let i = 0; i < sprites.length && i < twinkleData.length; i++) {
    const sprite = sprites[i]
    const td = twinkleData[i]

    let flicker: number
    if (td.isDegraded) {
      // Erratic twinkle — sum of two sine waves at different frequencies
      flicker = 0.5 + 0.3 * Math.sin(t * td.frequency + td.phase)
        + 0.2 * Math.sin(t * td.frequency * 1.7 + td.phase * 0.6)
    } else {
      // Smooth gentle twinkle
      flicker = 0.75 + 0.25 * Math.sin(t * td.frequency + td.phase)
    }

    // Apply to scale and opacity
    const s = td.baseScale * (0.8 + flicker * 0.4)
    sprite.scale.set(s, s, 1)

    const mat = sprite.material as THREE.SpriteMaterial
    if (mat.opacity !== undefined) {
      mat.opacity = Math.max(0.15, Math.min(1.0, flicker))
    }
  }
}

// --- Constellation connection lines ---
interface ConnectionLine {
  line: THREE.Line
  strength: number // 0-1 based on shared word count
}

function findConnections(
  memory: StoredMemory,
  allMemories: StoredMemory[],
  sprites: THREE.Sprite[],
  sourceSprite: THREE.Sprite
): ConnectionLine[] {
  const words = new Set(
    memory.currentText.toLowerCase().split(/\W+/).filter(w => w.length > 3)
  )
  const lines: ConnectionLine[] = []

  for (const other of allMemories) {
    if (other.id === memory.id) continue
    const otherWords = other.currentText.toLowerCase().split(/\W+/).filter(w => w.length > 3)
    const shared = otherWords.filter(w => words.has(w)).length
    if (shared === 0) continue

    // Find the sprite for this memory
    const targetSprite = sprites.find(s => s.userData.memoryId === other.id)
    if (!targetSprite) continue

    const strength = Math.min(1, shared / 5) // normalize: 5+ shared words = full strength

    const geometry = new THREE.BufferGeometry().setFromPoints([
      sourceSprite.position.clone(),
      targetSprite.position.clone(),
    ])

    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color().setHSL(memory.hue, 0.5, 0.6),
      transparent: true,
      opacity: 0.08 + strength * 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    const line = new THREE.Line(geometry, material)
    line.name = 'observatory-connection'
    lines.push({ line, strength })
  }

  return lines
}

// --- Ambient deep space audio ---
interface SpaceAudio {
  droneOsc1: OscillatorNode | null
  droneOsc2: OscillatorNode | null
  droneGain: GainNode | null
  lfoOsc: OscillatorNode | null
  lfoGain: GainNode | null
  pulsarInterval: ReturnType<typeof setInterval> | null
  started: boolean
}

async function startSpaceAudio(sprites: THREE.Sprite[], camera: THREE.PerspectiveCamera): Promise<SpaceAudio> {
  const audio: SpaceAudio = {
    droneOsc1: null,
    droneOsc2: null,
    droneGain: null,
    lfoOsc: null,
    lfoGain: null,
    pulsarInterval: null,
    started: false,
  }

  try {
    const ctx = await getAudioContext()
    const dest = getAudioDestination()

    // Deep space drone — very low frequency, slowly modulating
    const droneGain = ctx.createGain()
    droneGain.gain.setValueAtTime(0, ctx.currentTime)
    droneGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 4) // slow fade in

    // LFO to modulate drone frequency
    const lfoOsc = ctx.createOscillator()
    lfoOsc.type = 'sine'
    lfoOsc.frequency.setValueAtTime(0.05, ctx.currentTime) // very slow modulation
    const lfoGain = ctx.createGain()
    lfoGain.gain.setValueAtTime(5, ctx.currentTime) // modulate by +/- 5Hz

    // Main drone oscillator — sub-bass
    const droneOsc1 = ctx.createOscillator()
    droneOsc1.type = 'sine'
    droneOsc1.frequency.setValueAtTime(38, ctx.currentTime) // ~38Hz

    // Second drone — slightly detuned for richness
    const droneOsc2 = ctx.createOscillator()
    droneOsc2.type = 'sine'
    droneOsc2.frequency.setValueAtTime(42, ctx.currentTime) // ~42Hz, creates slow beating

    // LFO -> frequency modulation
    lfoOsc.connect(lfoGain)
    lfoGain.connect(droneOsc1.frequency)

    // Drone -> gain -> convolver (reverb simulation via delay feedback) -> dest
    // Simple reverb via delay feedback
    const preDelay = ctx.createDelay(1.0)
    preDelay.delayTime.setValueAtTime(0.3, ctx.currentTime)
    const feedbackGain = ctx.createGain()
    feedbackGain.gain.setValueAtTime(0.4, ctx.currentTime)
    const reverbFilter = ctx.createBiquadFilter()
    reverbFilter.type = 'lowpass'
    reverbFilter.frequency.setValueAtTime(800, ctx.currentTime)

    droneOsc1.connect(droneGain)
    droneOsc2.connect(droneGain)

    // Dry path
    droneGain.connect(dest)

    // Wet path (simple reverb)
    droneGain.connect(preDelay)
    preDelay.connect(reverbFilter)
    reverbFilter.connect(feedbackGain)
    feedbackGain.connect(preDelay) // feedback loop
    feedbackGain.connect(dest)

    droneOsc1.start(ctx.currentTime)
    droneOsc2.start(ctx.currentTime)
    lfoOsc.start(ctx.currentTime)

    audio.droneOsc1 = droneOsc1
    audio.droneOsc2 = droneOsc2
    audio.droneGain = droneGain
    audio.lfoOsc = lfoOsc
    audio.lfoGain = lfoGain
    audio.started = true

    // Pulsar pings — occasional short high-frequency tones
    // from random star positions using PannerNode
    audio.pulsarInterval = setInterval(() => {
      if (sprites.length === 0) return

      try {
        const sprite = sprites[Math.floor(Math.random() * sprites.length)]

        const panner = ctx.createPanner()
        panner.panningModel = 'HRTF'
        panner.distanceModel = 'inverse'
        panner.refDistance = 2
        panner.maxDistance = 20
        panner.rolloffFactor = 1.5

        const s = 0.01
        panner.positionX.setValueAtTime(sprite.position.x * s, ctx.currentTime)
        panner.positionY.setValueAtTime(sprite.position.y * s, ctx.currentTime)
        panner.positionZ.setValueAtTime(sprite.position.z * s, ctx.currentTime)

        // Update listener
        ctx.listener.positionX.setValueAtTime(camera.position.x * s, ctx.currentTime)
        ctx.listener.positionY.setValueAtTime(camera.position.y * s, ctx.currentTime)
        ctx.listener.positionZ.setValueAtTime(camera.position.z * s, ctx.currentTime)

        // Short high-frequency ping
        const pingOsc = ctx.createOscillator()
        pingOsc.type = 'sine'
        const freq = 1200 + Math.random() * 2400 // 1200-3600Hz
        pingOsc.frequency.setValueAtTime(freq, ctx.currentTime)
        pingOsc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + 0.3)

        const pingGain = ctx.createGain()
        pingGain.gain.setValueAtTime(0, ctx.currentTime)
        pingGain.gain.linearRampToValueAtTime(0.03 + Math.random() * 0.02, ctx.currentTime + 0.005)
        pingGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)

        pingOsc.connect(pingGain)
        pingGain.connect(panner)
        panner.connect(dest)

        pingOsc.start(ctx.currentTime)
        pingOsc.stop(ctx.currentTime + 0.5)
      } catch {
        // Audio context might be in a bad state
      }
    }, 3000 + Math.random() * 5000) // every 3-8 seconds

    return audio
  } catch {
    return audio
  }
}

function stopSpaceAudio(audio: SpaceAudio) {
  if (!audio.started) return
  try {
    const fadeTime = 2
    if (audio.droneGain) {
      const ctx = audio.droneGain.context
      audio.droneGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeTime)
      // Stop oscillators after fade
      setTimeout(() => {
        try {
          audio.droneOsc1?.stop()
          audio.droneOsc2?.stop()
          audio.lfoOsc?.stop()
        } catch { /* already stopped */ }
      }, fadeTime * 1000 + 100)
    }
  } catch { /* ignore */ }
  if (audio.pulsarInterval) {
    clearInterval(audio.pulsarInterval)
    audio.pulsarInterval = null
  }
  audio.started = false
}

// --- Telescope zoom animation ---
interface ZoomState {
  active: boolean
  startPos: THREE.Vector3
  startTarget: THREE.Vector3
  endPos: THREE.Vector3
  endTarget: THREE.Vector3
  startTime: number
  duration: number
}

function animateZoom(
  zoomState: ZoomState,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  t: number
): boolean {
  if (!zoomState.active) return false

  const elapsed = t - zoomState.startTime
  const progress = Math.min(1, elapsed / zoomState.duration)
  // Smooth ease-in-out
  const ease = progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2

  camera.position.lerpVectors(zoomState.startPos, zoomState.endPos, ease)
  controls.target.lerpVectors(zoomState.startTarget, zoomState.endTarget, ease)

  if (progress >= 1) {
    zoomState.active = false
    return false
  }
  return true
}


export function createObservatoryRoom(deps: ObservatoryDeps): Room {
  let overlay: HTMLElement | null = null
  let controls: OrbitControls | null = null
  let focusPanel: HTMLElement | null = null
  let focusedId: string | null = null
  let controlsRAF = 0
  let compassCanvases: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; draw: (t: number) => void; wrapper: HTMLElement }[] = []

  // APOD elements
  let apodContainer: HTMLElement | null = null
  let apodTextEl: HTMLElement | null = null
  let apodFadeTimer: ReturnType<typeof setTimeout> | null = null

  // Nebula
  let nebulaSystem: THREE.Points | null = null

  // Twinkle
  let twinkleData: TwinkleData[] = []

  // Constellation lines
  let activeConnectionLines: ConnectionLine[] = []
  let hoveredSpriteId: string | null = null

  // Telescope zoom
  let zoomState: ZoomState = {
    active: false,
    startPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
    startTime: 0,
    duration: 1.5,
  }
  let savedCameraPos: THREE.Vector3 | null = null
  let savedTarget: THREE.Vector3 | null = null
  let isZoomedIn = false

  // Ambient audio
  let spaceAudio: SpaceAudio | null = null

  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()

  // Event handler references for cleanup
  let clickHandler: ((e: MouseEvent) => void) | null = null
  let dblClickHandler: ((e: MouseEvent) => void) | null = null
  let contextMenuHandler: ((e: MouseEvent) => void) | null = null
  let moveHandler: ((e: MouseEvent) => void) | null = null
  let escHandler: ((e: KeyboardEvent) => void) | null = null

  function clearConnectionLines() {
    const scene = deps.getScene()
    for (const cl of activeConnectionLines) {
      scene.remove(cl.line)
      cl.line.geometry.dispose()
      ;(cl.line.material as THREE.Material).dispose()
    }
    activeConnectionLines = []
    hoveredSpriteId = null
  }

  function showConnectionLines(memory: StoredMemory, sprite: THREE.Sprite) {
    // Don't rebuild if already showing this memory's connections
    if (hoveredSpriteId === memory.id) return
    clearConnectionLines()

    const allMemories = deps.getMemories()
    const sprites = deps.getConstellationSprites()
    const scene = deps.getScene()

    const connections = findConnections(memory, allMemories, sprites, sprite)
    for (const conn of connections) {
      scene.add(conn.line)
    }
    activeConnectionLines = connections
    hoveredSpriteId = memory.id
  }

  function startZoomTo(target: THREE.Vector3, camera: THREE.PerspectiveCamera) {
    if (!controls) return

    // Save current position for reset
    if (!isZoomedIn) {
      savedCameraPos = camera.position.clone()
      savedTarget = controls.target.clone()
    }

    // Zoom toward target — stop at a distance proportional to current distance
    const direction = new THREE.Vector3().subVectors(target, camera.position).normalize()
    const currentDist = camera.position.distanceTo(target)
    const zoomDist = Math.max(30, currentDist * 0.3) // zoom to 30% of current distance, min 30

    zoomState = {
      active: true,
      startPos: camera.position.clone(),
      startTarget: controls.target.clone(),
      endPos: new THREE.Vector3().addVectors(target, direction.multiplyScalar(-zoomDist)),
      endTarget: target.clone(),
      startTime: performance.now() * 0.001,
      duration: 1.5,
    }
    isZoomedIn = true
  }

  function resetZoom(camera: THREE.PerspectiveCamera) {
    if (!isZoomedIn || !savedCameraPos || !savedTarget || !controls) return

    zoomState = {
      active: true,
      startPos: camera.position.clone(),
      startTarget: controls.target.clone(),
      endPos: savedCameraPos.clone(),
      endTarget: savedTarget.clone(),
      startTime: performance.now() * 0.001,
      duration: 1.2,
    }
    isZoomedIn = false
  }

  function createFocusPanel(): HTMLElement {
    const panel = document.createElement('div')
    panel.style.cssText = `
      position: fixed;
      right: -340px;
      top: 50%;
      transform: translateY(-50%);
      width: 300px;
      max-height: 60vh;
      background: rgba(2, 1, 8, 0.92);
      border: 1px solid rgba(255, 20, 147, 0.15);
      border-right: none;
      border-radius: 4px 0 0 4px;
      padding: 24px;
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300;
      transition: right 0.6s cubic-bezier(0.23, 1, 0.32, 1);
      z-index: 500;
      overflow-y: auto;
      pointer-events: auto;
    `
    return panel
  }

  function showFocusPanel(memory: StoredMemory) {
    if (!focusPanel) return

    const degradePercent = Math.floor(memory.degradation * 100)
    const hueDeg = Math.floor(memory.hue * 360)
    const age = Date.now() - memory.timestamp
    const days = Math.floor(age / (1000 * 60 * 60 * 24))
    const hours = Math.floor(age / (1000 * 60 * 60)) % 24

    let timeStr = ''
    if (days > 0) timeStr = `${days} day${days > 1 ? 's' : ''} ago`
    else if (hours > 0) timeStr = `${hours} hour${hours > 1 ? 's' : ''} ago`
    else timeStr = 'moments ago'

    // Count connections (shared words with other memories)
    const memories = deps.getMemories()
    const words = new Set(
      memory.currentText.toLowerCase().split(/\W+/).filter(w => w.length > 2)
    )
    let connections = 0
    for (const m of memories) {
      if (m.id === memory.id) continue
      const mWords = m.currentText.toLowerCase().split(/\W+/).filter(w => w.length > 2)
      if (mWords.some(w => words.has(w))) connections++
    }

    focusPanel.innerHTML = `
      <div style="
        color: hsla(${hueDeg}, 70%, 75%, 0.9);
        font-size: 20px;
        line-height: 1.6;
        margin-bottom: 16px;
      ">${memory.currentText}</div>
      <div style="
        color: rgba(255, 215, 0, 0.25);
        font-size: 13px;
        letter-spacing: 2px;
        line-height: 2;
      ">
        ${degradePercent > 0 ? `<div>${degradePercent}% forgotten</div>` : '<div>pristine</div>'}
        <div>${timeStr}</div>
        <div>${connections} connection${connections !== 1 ? 's' : ''}</div>
        <div style="margin-top: 8px; color: rgba(255, 20, 147, 0.15);">
          ${memory.position.x.toFixed(0)}, ${memory.position.y.toFixed(0)}, ${memory.position.z.toFixed(0)}
        </div>
      </div>
    `

    focusPanel.style.right = '0px'
    focusedId = memory.id
  }

  function hideFocusPanel() {
    if (focusPanel) focusPanel.style.right = '-340px'
    focusedId = null
  }

  async function playMemoryTone(memory: StoredMemory, position: THREE.Vector3) {
    try {
      const ctx = await getAudioContext()
      const dest = getAudioDestination()

      // Spatial panner — memory hums from its position
      const panner = ctx.createPanner()
      panner.panningModel = 'HRTF'
      panner.distanceModel = 'inverse'
      panner.refDistance = 1
      panner.maxDistance = 10
      panner.rolloffFactor = 1

      // Scale Three.js coords to audio space
      const s = 0.01
      panner.positionX.setValueAtTime(position.x * s, ctx.currentTime)
      panner.positionY.setValueAtTime(position.y * s, ctx.currentTime)
      panner.positionZ.setValueAtTime(position.z * s, ctx.currentTime)

      // Update listener to camera
      const camera = deps.getCamera()
      ctx.listener.positionX.setValueAtTime(camera.position.x * s, ctx.currentTime)
      ctx.listener.positionY.setValueAtTime(camera.position.y * s, ctx.currentTime)
      ctx.listener.positionZ.setValueAtTime(camera.position.z * s, ctx.currentTime)

      // Bell tone — frequency from memory hue
      const baseFreq = 220 + memory.hue * 440

      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime)

      // Detuned harmonic for richness
      const osc2 = ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(baseFreq * 2.01, ctx.currentTime)

      // Envelopes
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3)

      const gain2 = ctx.createGain()
      gain2.gain.setValueAtTime(0, ctx.currentTime)
      gain2.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.02)
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2)

      osc.connect(gain)
      osc2.connect(gain2)
      gain.connect(panner)
      gain2.connect(panner)
      panner.connect(dest)

      osc.start(ctx.currentTime)
      osc2.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 3)
      osc2.stop(ctx.currentTime + 2)
    } catch {
      // Audio might not be initialized yet
    }
  }

  return {
    name: 'observatory',
    label: 'the observatory',

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        display: flex; flex-direction: column;
        align-items: center; justify-content: flex-start;
        height: 100%;
        pointer-events: none;
        background: rgba(2, 1, 8, 0.15);
      `

      // Instruction hint
      const hint = document.createElement('div')
      hint.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300;
        font-size: 12px;
        color: rgba(255, 215, 0, 0.2);
        letter-spacing: 2px;
        margin-top: 24px;
        text-align: center;
        transition: opacity 3s ease;
      `
      hint.textContent = 'drag to orbit \u00b7 scroll to zoom \u00b7 click a star \u00b7 double-click to telescope'
      overlay.appendChild(hint)

      // Fade hint after 8 seconds
      setTimeout(() => { hint.style.opacity = '0' }, 8000)

      // Memory count
      const countEl = document.createElement('div')
      countEl.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.1);
        letter-spacing: 2px;
        margin-top: 8px;
        pointer-events: none;
      `
      const memories = deps.getMemories()
      countEl.textContent = memories.length > 0
        ? `${memories.length} memor${memories.length === 1 ? 'y' : 'ies'} in the constellation`
        : 'no memories yet \u2014 type in the void to create stars'
      overlay.appendChild(countEl)

      // Focus panel
      focusPanel = createFocusPanel()
      document.body.appendChild(focusPanel)

      // Celestial compass markers — mini canvas navigation at viewport edges
      if (deps.switchTo) {
        compassCanvases = []
        const SIZE = 60

        const markers: { name: string; label: string; pos: string; labelPos: string; draw: (ctx: CanvasRenderingContext2D, t: number, hover: boolean) => void }[] = [
          {
            name: 'satellite',
            label: 'satellite',
            pos: 'top: 18px; right: 18px;',
            labelPos: 'top: 100%; left: 50%; transform: translateX(-50%); margin-top: 4px;',
            draw(ctx, t, hover) {
              const cx = SIZE / 2, cy = SIZE / 2
              const bright = hover ? 1.0 : 0.35
              // Orbit ring
              ctx.strokeStyle = `rgba(100, 200, 255, ${0.15 * bright})`
              ctx.lineWidth = 0.8
              ctx.beginPath()
              ctx.ellipse(cx, cy, 22, 10, -0.4, 0, Math.PI * 2)
              ctx.stroke()
              // Central body
              ctx.fillStyle = `rgba(100, 200, 255, ${0.3 * bright})`
              ctx.beginPath()
              ctx.arc(cx, cy, 2.5, 0, Math.PI * 2)
              ctx.fill()
              // Orbiting dot
              const angle = t * 1.2
              const ox = cx + Math.cos(angle) * 22
              const oy = cy + Math.sin(angle) * 10 * Math.cos(-0.4) - Math.cos(angle) * 10 * Math.sin(-0.4)
              // Trail
              for (let i = 1; i <= 6; i++) {
                const ta = angle - i * 0.15
                const tx = cx + Math.cos(ta) * 22
                const ty = cy + Math.sin(ta) * 10 * Math.cos(-0.4) - Math.cos(ta) * 10 * Math.sin(-0.4)
                ctx.fillStyle = `rgba(100, 200, 255, ${(0.2 - i * 0.03) * bright})`
                ctx.beginPath()
                ctx.arc(tx, ty, 1.5 - i * 0.15, 0, Math.PI * 2)
                ctx.fill()
              }
              // Satellite dot
              ctx.fillStyle = `rgba(180, 230, 255, ${0.9 * bright})`
              ctx.beginPath()
              ctx.arc(ox, oy, 2, 0, Math.PI * 2)
              ctx.fill()
              // Glow
              if (hover) {
                ctx.shadowColor = 'rgba(100, 200, 255, 0.6)'
                ctx.shadowBlur = 12
                ctx.beginPath()
                ctx.arc(ox, oy, 2, 0, Math.PI * 2)
                ctx.fill()
                ctx.shadowBlur = 0
              }
            },
          },
          {
            name: 'asteroids',
            label: 'asteroids',
            pos: 'bottom: 54px; left: 18px;',
            labelPos: 'bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 4px;',
            draw(ctx, t, hover) {
              const cx = SIZE / 2, cy = SIZE / 2
              const bright = hover ? 1.0 : 0.35
              // Asteroid shapes — irregular polygons
              const rocks = [
                { x: cx - 8, y: cy - 4, r: 7, sides: 6, phase: 0 },
                { x: cx + 10, y: cy + 2, r: 5, sides: 5, phase: 1.2 },
                { x: cx + 1, y: cy + 10, r: 4, sides: 7, phase: 2.5 },
                { x: cx - 6, y: cy + 8, r: 3, sides: 5, phase: 3.8 },
              ]
              for (const rock of rocks) {
                const wobble = Math.sin(t * 0.3 + rock.phase) * 1.2
                ctx.fillStyle = `rgba(200, 150, 100, ${0.2 * bright})`
                ctx.strokeStyle = `rgba(200, 150, 100, ${0.35 * bright})`
                ctx.lineWidth = 0.7
                ctx.beginPath()
                for (let i = 0; i < rock.sides; i++) {
                  const a = (i / rock.sides) * Math.PI * 2 + t * 0.08 + rock.phase
                  const jitter = Math.sin(a * 3 + rock.phase) * 1.5
                  const px = rock.x + wobble * 0.3 + Math.cos(a) * (rock.r + jitter)
                  const py = rock.y + wobble * 0.5 + Math.sin(a) * (rock.r + jitter)
                  if (i === 0) ctx.moveTo(px, py)
                  else ctx.lineTo(px, py)
                }
                ctx.closePath()
                ctx.fill()
                ctx.stroke()
              }
              if (hover) {
                ctx.shadowColor = 'rgba(200, 150, 100, 0.5)'
                ctx.shadowBlur = 10
                for (const rock of rocks) {
                  ctx.beginPath()
                  ctx.arc(rock.x, rock.y, rock.r * 0.5, 0, Math.PI * 2)
                  ctx.fill()
                }
                ctx.shadowBlur = 0
              }
            },
          },
          {
            name: 'clocktower',
            label: 'clock tower',
            pos: 'bottom: 54px; right: 18px;',
            labelPos: 'bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 4px;',
            draw(ctx, t, hover) {
              const cx = SIZE / 2, cy = SIZE / 2
              const bright = hover ? 1.0 : 0.35
              // Clock face
              ctx.strokeStyle = `rgba(200, 180, 140, ${0.25 * bright})`
              ctx.lineWidth = 1
              ctx.beginPath()
              ctx.arc(cx, cy, 20, 0, Math.PI * 2)
              ctx.stroke()
              // Hour ticks
              for (let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2 - Math.PI / 2
                const inner = 17
                const outer = 20
                ctx.strokeStyle = `rgba(200, 180, 140, ${0.2 * bright})`
                ctx.lineWidth = i % 3 === 0 ? 1.2 : 0.5
                ctx.beginPath()
                ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner)
                ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer)
                ctx.stroke()
              }
              // Single sweeping hand — continuous motion
              const handAngle = t * 0.5 - Math.PI / 2
              ctx.strokeStyle = `rgba(200, 180, 140, ${0.6 * bright})`
              ctx.lineWidth = 1.2
              ctx.beginPath()
              ctx.moveTo(cx, cy)
              ctx.lineTo(cx + Math.cos(handAngle) * 15, cy + Math.sin(handAngle) * 15)
              ctx.stroke()
              // Center dot
              ctx.fillStyle = `rgba(200, 180, 140, ${0.5 * bright})`
              ctx.beginPath()
              ctx.arc(cx, cy, 1.5, 0, Math.PI * 2)
              ctx.fill()
              if (hover) {
                ctx.shadowColor = 'rgba(200, 180, 140, 0.5)'
                ctx.shadowBlur = 10
                ctx.beginPath()
                ctx.arc(cx, cy, 20, 0, Math.PI * 2)
                ctx.stroke()
                ctx.shadowBlur = 0
              }
            },
          },
          {
            name: 'void',
            label: 'the void',
            pos: 'top: 18px; left: 18px;',
            labelPos: 'top: 100%; left: 50%; transform: translateX(-50%); margin-top: 4px;',
            draw(ctx, t, hover) {
              const cx = SIZE / 2, cy = SIZE / 2
              const bright = hover ? 1.0 : 0.35
              const pulse = 0.85 + Math.sin(t * 1.5) * 0.15
              const radius = 14 * pulse
              // Dark center
              const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius + 6)
              grad.addColorStop(0, `rgba(2, 1, 8, ${0.9 * bright})`)
              grad.addColorStop(0.6, `rgba(2, 1, 8, ${0.5 * bright})`)
              grad.addColorStop(1, 'rgba(2, 1, 8, 0)')
              ctx.fillStyle = grad
              ctx.beginPath()
              ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2)
              ctx.fill()
              // Magenta rim
              ctx.strokeStyle = `rgba(255, 20, 147, ${(0.3 + Math.sin(t * 2) * 0.1) * bright})`
              ctx.lineWidth = 1.5
              ctx.beginPath()
              ctx.arc(cx, cy, radius, 0, Math.PI * 2)
              ctx.stroke()
              // Inner glow ring
              ctx.strokeStyle = `rgba(255, 20, 147, ${0.1 * bright})`
              ctx.lineWidth = 0.5
              ctx.beginPath()
              ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2)
              ctx.stroke()
              if (hover) {
                ctx.shadowColor = 'rgba(255, 20, 147, 0.6)'
                ctx.shadowBlur = 15
                ctx.beginPath()
                ctx.arc(cx, cy, radius, 0, Math.PI * 2)
                ctx.stroke()
                ctx.shadowBlur = 0
              }
            },
          },
        ]

        for (const m of markers) {
          // Wrapper div for positioning
          const wrapper = document.createElement('div')
          wrapper.style.cssText = `
            position: absolute; ${m.pos}
            width: ${SIZE}px; height: ${SIZE}px;
            pointer-events: auto; cursor: pointer;
            z-index: 10;
          `

          // Mini canvas for procedural drawing
          const c = document.createElement('canvas')
          c.width = SIZE
          c.height = SIZE
          c.style.cssText = `width: ${SIZE}px; height: ${SIZE}px; display: block;`
          wrapper.appendChild(c)

          // Label — hidden until hover
          const label = document.createElement('div')
          label.style.cssText = `
            position: absolute; ${m.labelPos}
            font-family: 'Cormorant Garamond', serif;
            font-weight: 300; font-size: 12px;
            letter-spacing: 2px; white-space: nowrap;
            color: rgba(255, 255, 255, 0.5);
            opacity: 0;
            transition: opacity 0.4s ease;
            pointer-events: none;
          `
          label.textContent = m.label
          wrapper.appendChild(label)

          let hovered = false
          wrapper.addEventListener('mouseenter', () => {
            hovered = true
            label.style.opacity = '1'
          })
          wrapper.addEventListener('mouseleave', () => {
            hovered = false
            label.style.opacity = '0'
          })
          wrapper.addEventListener('click', (e) => {
            e.stopPropagation()
            // Flash effect — briefly brighten before navigating
            const flashCtx = c.getContext('2d')
            if (flashCtx) {
              flashCtx.clearRect(0, 0, SIZE, SIZE)
              flashCtx.fillStyle = 'rgba(255, 255, 255, 0.3)'
              flashCtx.beginPath()
              flashCtx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2)
              flashCtx.fill()
            }
            setTimeout(() => deps.switchTo!(m.name), 300)
          })

          overlay.appendChild(wrapper)

          const ctx2d = c.getContext('2d')
          if (ctx2d) {
            compassCanvases.push({
              canvas: c,
              ctx: ctx2d,
              draw: (t: number) => {
                ctx2d.clearRect(0, 0, SIZE, SIZE)
                m.draw(ctx2d, t, hovered)
              },
              wrapper,
            })
          }
        }
      }

      return overlay
    },

    activate() {
      const camera = deps.getCamera()
      const canvas = deps.getCanvas()
      const scene = deps.getScene()

      // --- Add nebula particle system ---
      nebulaSystem = createNebulaSystem()
      scene.add(nebulaSystem)

      // --- Build twinkle data for existing sprites ---
      const sprites = deps.getConstellationSprites()
      const memories = deps.getMemories()
      twinkleData = buildTwinkleData(sprites, memories, deps.getMemoryById)

      // --- Start ambient space audio ---
      startSpaceAudio(sprites, camera).then(audio => {
        spaceAudio = audio
      })

      // --- APOD: fetch and display today's astronomy picture ---
      fetchAPOD().then(apod => {
        if (!apod || !overlay) return

        // Container: fixed behind everything, telescope vignette
        apodContainer = document.createElement('div')
        apodContainer.style.cssText = `
          position: fixed;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          opacity: 0;
          transition: opacity 4s ease;
        `

        // The image itself
        const img = document.createElement('img')
        img.crossOrigin = 'anonymous'
        img.src = apod.hdurl || apod.url
        img.alt = ''
        img.style.cssText = `
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.12;
          filter: blur(2px) saturate(0.6);
        `
        apodContainer.appendChild(img)

        // Telescope vignette overlay — dark edges, clear center
        const vignette = document.createElement('div')
        vignette.style.cssText = `
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse 50% 50% at center,
            transparent 0%,
            rgba(2, 1, 8, 0.3) 40%,
            rgba(2, 1, 8, 0.7) 65%,
            rgba(2, 1, 8, 0.95) 85%,
            rgb(2, 1, 8) 100%
          );
          pointer-events: none;
        `
        apodContainer.appendChild(vignette)

        document.body.appendChild(apodContainer)

        // Fade in after image loads (or immediately if cached)
        const reveal = () => {
          if (apodContainer) apodContainer.style.opacity = '1'
        }
        if (img.complete) reveal()
        else img.addEventListener('load', reveal)

        // Text overlay: title + explanation fragment
        apodTextEl = document.createElement('div')
        apodTextEl.style.cssText = `
          position: fixed;
          bottom: 48px;
          left: 50%;
          transform: translateX(-50%);
          max-width: 520px;
          text-align: center;
          pointer-events: none;
          z-index: 5;
          opacity: 0;
          transition: opacity 6s ease;
        `

        // Extract a short fragment from explanation (first ~120 chars, end at sentence/word boundary)
        let fragment = apod.explanation
        if (fragment.length > 120) {
          const cut = fragment.lastIndexOf(' ', 120)
          fragment = fragment.substring(0, cut > 60 ? cut : 120) + '...'
        }

        apodTextEl.innerHTML = `
          <div style="
            font-family: 'Cormorant Garamond', serif;
            font-weight: 300;
            font-size: 14px;
            letter-spacing: 3px;
            color: rgba(200, 210, 255, 0.35);
            margin-bottom: 8px;
            text-transform: uppercase;
          ">${apod.title}</div>
          <div style="
            font-family: 'Cormorant Garamond', serif;
            font-weight: 300;
            font-size: 12px;
            line-height: 1.8;
            color: rgba(200, 210, 255, 0.2);
            letter-spacing: 1px;
          ">${fragment}</div>
          <div style="
            font-family: 'Cormorant Garamond', serif;
            font-weight: 300;
            font-size: 12px;
            color: rgba(200, 210, 255, 0.1);
            margin-top: 6px;
            letter-spacing: 2px;
          ">NASA APOD \u00b7 ${apod.date}</div>
        `
        document.body.appendChild(apodTextEl)

        // Fade text in after a short delay
        setTimeout(() => {
          if (apodTextEl) apodTextEl.style.opacity = '1'
        }, 2000)

        // Slowly dissolve the text away after 20 seconds
        apodFadeTimer = setTimeout(() => {
          if (apodTextEl) {
            apodTextEl.style.transition = 'opacity 10s ease'
            apodTextEl.style.opacity = '0'
          }
        }, 20000)
      }).catch(() => {
        // Graceful fallback — room works without APOD
      })

      // Take over camera
      deps.pauseCamera()

      // Orbit controls
      controls = new OrbitControls(camera, canvas)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.rotateSpeed = 0.5
      controls.zoomSpeed = 0.8
      controls.minDistance = 50
      controls.maxDistance = 800
      controls.target.set(0, 0, 0)
      controls.enablePan = true
      controls.panSpeed = 0.5

      // Update controls + compass canvases + nebula + twinkle each frame
      const updateLoop = () => {
        if (!controls) return
        controls.update()
        const t = performance.now() * 0.001
        for (const cc of compassCanvases) cc.draw(t)

        // Animate nebula
        if (nebulaSystem) animateNebula(nebulaSystem, t)

        // Animate star twinkle
        const currentSprites = deps.getConstellationSprites()
        if (currentSprites.length > 0) {
          // Rebuild twinkle data if sprite count changed
          if (twinkleData.length !== currentSprites.length) {
            twinkleData = buildTwinkleData(currentSprites, deps.getMemories(), deps.getMemoryById)
          }
          animateTwinkle(currentSprites, twinkleData, t)
        }

        // Animate telescope zoom
        if (zoomState.active && controls) {
          animateZoom(zoomState, camera, controls, t)
        }

        controlsRAF = requestAnimationFrame(updateLoop)
      }
      controlsRAF = requestAnimationFrame(updateLoop)

      // Click -> raycast against constellation sprites + zoom to star
      clickHandler = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect()
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(mouse, camera)

        const currentSprites = deps.getConstellationSprites()
        const intersects = raycaster.intersectObjects(currentSprites)

        if (intersects.length > 0) {
          const sprite = intersects[0].object as THREE.Sprite
          const memoryId = sprite.userData.memoryId
          if (memoryId) {
            const memory = deps.getMemoryById(memoryId)
            if (memory) {
              showFocusPanel(memory)
              playMemoryTone(memory, sprite.position)
              // Zoom to the clicked star
              startZoomTo(sprite.position, camera)
            }
          }
        } else {
          hideFocusPanel()
        }
      }
      canvas.addEventListener('click', clickHandler)

      // Double-click on empty space -> telescope zoom toward that direction
      dblClickHandler = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect()
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(mouse, camera)

        const currentSprites = deps.getConstellationSprites()
        const intersects = raycaster.intersectObjects(currentSprites)

        // Only zoom into empty space on double-click (star clicks handled by single-click)
        if (intersects.length === 0) {
          // Project a point 200 units along the ray direction
          const targetPoint = new THREE.Vector3()
          raycaster.ray.at(200, targetPoint)
          startZoomTo(targetPoint, camera)
        }
      }
      canvas.addEventListener('dblclick', dblClickHandler)

      // Right-click -> reset zoom
      contextMenuHandler = (e: MouseEvent) => {
        if (isZoomedIn) {
          e.preventDefault()
          resetZoom(camera)
        }
      }
      canvas.addEventListener('contextmenu', contextMenuHandler)

      // Hover cursor + constellation lines
      moveHandler = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect()
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(mouse, camera)
        const currentSprites = deps.getConstellationSprites()
        const intersects = raycaster.intersectObjects(currentSprites)

        if (intersects.length > 0) {
          canvas.style.cursor = 'pointer'
          const sprite = intersects[0].object as THREE.Sprite
          const memoryId = sprite.userData.memoryId as string | undefined
          if (memoryId) {
            const memory = deps.getMemoryById(memoryId)
            if (memory) {
              showConnectionLines(memory, sprite)
            }
          }
        } else {
          canvas.style.cursor = 'grab'
          // Clear connection lines when not hovering a star
          if (hoveredSpriteId !== null) {
            clearConnectionLines()
          }
        }
      }
      canvas.addEventListener('mousemove', moveHandler)

      // Escape unfocuses + resets zoom
      escHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          hideFocusPanel()
          if (isZoomedIn) {
            resetZoom(camera)
          }
        }
      }
      window.addEventListener('keydown', escHandler)
    },

    deactivate() {
      const canvas = deps.getCanvas()
      const scene = deps.getScene()

      // Cleanup controls
      if (controls) {
        controls.dispose()
        controls = null
      }
      cancelAnimationFrame(controlsRAF)

      // Remove nebula
      if (nebulaSystem) {
        scene.remove(nebulaSystem)
        nebulaSystem.geometry.dispose()
        ;(nebulaSystem.material as THREE.Material).dispose()
        nebulaSystem = null
      }

      // Clear constellation lines
      clearConnectionLines()

      // Stop space audio
      if (spaceAudio) {
        stopSpaceAudio(spaceAudio)
        spaceAudio = null
      }

      // Reset twinkle — restore original sprite opacities
      const sprites = deps.getConstellationSprites()
      for (let i = 0; i < sprites.length; i++) {
        const mat = sprites[i].material as THREE.SpriteMaterial
        mat.opacity = 1.0
        if (twinkleData[i]) {
          sprites[i].scale.setScalar(twinkleData[i].baseScale)
        }
      }
      twinkleData = []

      // Reset zoom state
      zoomState.active = false
      isZoomedIn = false
      savedCameraPos = null
      savedTarget = null

      // Resume void camera
      deps.resumeCamera()

      // Remove listeners
      if (clickHandler) {
        canvas.removeEventListener('click', clickHandler)
        clickHandler = null
      }
      if (dblClickHandler) {
        canvas.removeEventListener('dblclick', dblClickHandler)
        dblClickHandler = null
      }
      if (contextMenuHandler) {
        canvas.removeEventListener('contextmenu', contextMenuHandler)
        contextMenuHandler = null
      }
      if (moveHandler) {
        canvas.removeEventListener('mousemove', moveHandler)
        moveHandler = null
      }
      if (escHandler) {
        window.removeEventListener('keydown', escHandler)
        escHandler = null
      }

      // Cleanup APOD elements
      if (apodFadeTimer) { clearTimeout(apodFadeTimer); apodFadeTimer = null }
      if (apodContainer) { apodContainer.remove(); apodContainer = null }
      if (apodTextEl) { apodTextEl.remove(); apodTextEl = null }

      hideFocusPanel()
      canvas.style.cursor = ''
    },

    destroy() {
      if (controls) {
        controls.dispose()
        controls = null
      }
      cancelAnimationFrame(controlsRAF)
      compassCanvases = []

      // Cleanup nebula if still present
      if (nebulaSystem) {
        const scene = deps.getScene()
        scene.remove(nebulaSystem)
        nebulaSystem.geometry.dispose()
        ;(nebulaSystem.material as THREE.Material).dispose()
        nebulaSystem = null
      }

      // Clear constellation lines
      clearConnectionLines()

      // Stop space audio
      if (spaceAudio) {
        stopSpaceAudio(spaceAudio)
        spaceAudio = null
      }

      if (apodFadeTimer) { clearTimeout(apodFadeTimer); apodFadeTimer = null }
      apodContainer?.remove()
      apodTextEl?.remove()
      focusPanel?.remove()
      overlay?.remove()
    },
  }
}
