/**
 * THE TERRARIUM — artificial life in a glass box
 *
 * A self-sustaining ecosystem of simple creatures. They eat, reproduce,
 * age, and die. Food grows from the bottom. Creatures evolve simple
 * behaviors through genetic variation.
 *
 * No memories. No text. Just life happening.
 *
 * Creatures have: position, velocity, energy, age, color (genes).
 * They seek food, avoid walls, and reproduce when energy is high.
 * Offspring inherit parents' color with slight mutations.
 *
 * Over time, the population finds an equilibrium — or crashes.
 * Each reset produces a different evolutionary trajectory.
 *
 * Inspired by: terrariums, closed ecosystems, Tierra (artificial life),
 * boids, genetic algorithms, the Game of Life's cousin that has
 * metabolism and death. How ecosystems are just physics with hunger.
 */

import type { Room } from './RoomManager'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface Creature {
  x: number
  y: number
  vx: number
  vy: number
  energy: number
  age: number
  maxAge: number
  speed: number
  size: number
  senseRange: number
  hue: number
  generation: number
}

interface Food {
  x: number
  y: number
  energy: number
  size: number
  growth: number
}

interface TerrariumDeps {
  onGarden?: () => void // passage to the garden
  switchTo?: (name: string) => void
}

const CULTURAL_INSCRIPTIONS = [
  'david biosphere 2 (1991): 8 humans sealed in a glass dome for 2 years. the oxygen ran out.',
  'karl sims evolved virtual creatures in 1994. they learned to swim, walk, and fight. none survived power-off.',
  'the oldest living organism: a seagrass meadow in australia, 4,500 years old. one plant, cloning itself.',
  'e.O. wilson: half of all species will be extinct by 2100. the terrarium of earth is cracking.',
  'lynn margulis proved that mitochondria were once free-living bacteria. symbiosis as the engine of complexity.',
  'the doomsday clock reads 85 seconds to midnight. the ecosystem of civilization, running out of time.',
  'craig venter created the first synthetic life form in 2010. JCVI-syn1.0. life, authored.',
  'tardigrades survive in space, boiling water, and radiation. memory encoded in survival itself.',
  'the alerce trees of patagonia have lived 3,600 years. this winter, they burned.',
  'USC pacific asia museum: mythical creatures as immigrant memory. 12 immersive rooms, 5000 years of objects.',
]

export function createTerrariumRoom(deps: TerrariumDeps = {}): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let creatures: Creature[] = []
  let food: Food[] = []
  let deathParticles: { x: number; y: number; vx: number; vy: number; life: number; hue: number }[] = []

  let inscriptionTimer = 0
  let inscriptionIdx = 0
  let totalBorn = 0
  let totalDied = 0
  let maxGeneration = 0
  let gardenLink: HTMLElement | null = null
  let gardenLinkVisible = false

  // Audio state
  let ac: AudioContext | null = null
  let audioReady = false
  let ambientNoiseSource: AudioBufferSourceNode | null = null
  let ambientGain: GainNode | null = null
  let pulseOsc: OscillatorNode | null = null
  let pulseGain: GainNode | null = null
  let pulseInterval: ReturnType<typeof setInterval> | null = null

  // Creature trails: map from creature index to array of past positions
  let creatureTrails: Map<Creature, { x: number; y: number }[]> = new Map()

  // Swarm migration zones — creatures discover the exits
  const migrationZones = [
    { wall: 'left', room: 'garden', hint: 'they sense the garden beyond...' },
    { wall: 'top', room: 'automaton', hint: 'mechanical rhythms attract them...' },
    { wall: 'right', room: 'choir', hint: 'they sing together...' },
  ]
  let zoneDensity = [0, 0, 0]
  let hoveredZone = -1
  // Glass crack lines per zone — generated once when density threshold is first reached
  let zoneCracks: { x: number; y: number; dx: number; dy: number; len: number }[][] = [[], [], []]
  let zoneCracksGenerated = [false, false, false]
  // Escape particles drifting through glass
  let escapeParticles: { x: number; y: number; vx: number; vy: number; life: number; hue: number }[] = []
  // Shatter animation state
  let shatterZone = -1
  let shatterTime = 0
  let shatterParticles: { x: number; y: number; vx: number; vy: number; life: number; size: number }[] = []

  // --- Audio functions ---

  function initAudio() {
    getAudioContext().then((context) => {
      if (!active) return
      ac = context
      audioReady = true
      try {
        const dest = getAudioDestination()

        // Ambient hum: filtered noise (glass enclosure sound)
        const bufferSize = ac.sampleRate * 2
        const noiseBuffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
        const noiseData = noiseBuffer.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) {
          noiseData[i] = (Math.random() * 2 - 1)
        }
        ambientNoiseSource = ac.createBufferSource()
        ambientNoiseSource.buffer = noiseBuffer
        ambientNoiseSource.loop = true

        const bandpass = ac.createBiquadFilter()
        bandpass.type = 'bandpass'
        bandpass.frequency.value = 400
        bandpass.Q.value = 1.5

        ambientGain = ac.createGain()
        ambientGain.gain.value = 0
        ambientGain.gain.setTargetAtTime(0.008, ac.currentTime, 2.0)

        ambientNoiseSource.connect(bandpass)
        bandpass.connect(ambientGain)
        ambientGain.connect(dest)
        ambientNoiseSource.start(ac.currentTime)

        // Population pulse oscillator
        pulseOsc = ac.createOscillator()
        pulseOsc.type = 'sine'
        pulseOsc.frequency.value = 80
        pulseGain = ac.createGain()
        pulseGain.gain.value = 0
        pulseOsc.connect(pulseGain)
        pulseGain.connect(dest)
        pulseOsc.start(ac.currentTime)

        // Pulse scheduler — pulses based on population
        startPopulationPulse()
      } catch (_) { /* audio node creation can fail */ }
    }).catch(() => { /* audio init failed, room still works silently */ })
  }

  function startPopulationPulse() {
    if (pulseInterval) clearInterval(pulseInterval)
    pulseInterval = setInterval(() => {
      if (!ac || !pulseGain || !audioReady) return
      try {
        const pop = creatures.length
        if (pop === 0) return
        // Pulse rate: more creatures = faster pulse (200ms to 800ms interval)
        const now = ac.currentTime
        pulseGain.gain.setTargetAtTime(0.005, now, 0.005)
        pulseGain.gain.setTargetAtTime(0, now + 0.01, 0.005)
      } catch (_) { /* */ }
    }, 400) // base interval, adjusted dynamically below
  }

  function updatePulseRate() {
    if (!pulseInterval) return
    clearInterval(pulseInterval)
    const pop = creatures.length
    // Map population 0-80 to interval 800ms-200ms
    const interval = Math.max(200, 800 - pop * 8)
    pulseInterval = setInterval(() => {
      if (!ac || !pulseGain || !audioReady) return
      try {
        if (creatures.length === 0) return
        const now = ac.currentTime
        pulseGain.gain.setTargetAtTime(0.005, now, 0.005)
        pulseGain.gain.setTargetAtTime(0, now + 0.01, 0.005)
      } catch (_) { /* */ }
    }, interval)
  }

  function playChirp(hue: number) {
    if (!ac || !audioReady) return
    try {
      const dest = getAudioDestination()
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'sine'
      // Map hue 0-360 to frequency 200-800Hz
      osc.frequency.value = 200 + (hue / 360) * 600
      gain.gain.value = 0.01
      osc.connect(gain)
      gain.connect(dest)
      const now = ac.currentTime
      osc.start(now)
      gain.gain.setTargetAtTime(0, now + 0.015, 0.005)
      osc.stop(now + 0.05)
    } catch (_) { /* */ }
  }

  function playReproductionPop() {
    if (!ac || !audioReady) return
    try {
      const dest = getAudioDestination()
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'sine'
      osc.frequency.value = 440
      gain.gain.value = 0.015
      osc.connect(gain)
      gain.connect(dest)
      const now = ac.currentTime
      osc.start(now)
      osc.frequency.setValueAtTime(660, now + 0.005)
      gain.gain.setTargetAtTime(0, now + 0.008, 0.002)
      osc.stop(now + 0.03)
    } catch (_) { /* */ }
  }

  function playDeathSigh() {
    if (!ac || !audioReady) return
    try {
      const dest = getAudioDestination()
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      const lowpass = ac.createBiquadFilter()
      lowpass.type = 'lowpass'
      lowpass.frequency.value = 400
      osc.type = 'sine'
      osc.frequency.value = 300
      gain.gain.value = 0.008
      osc.connect(lowpass)
      lowpass.connect(gain)
      gain.connect(dest)
      const now = ac.currentTime
      osc.start(now)
      osc.frequency.linearRampToValueAtTime(100, now + 0.2)
      gain.gain.setTargetAtTime(0, now + 0.15, 0.03)
      osc.stop(now + 0.3)
    } catch (_) { /* */ }
  }

  function cleanupAudio(fadeTime = 0.5) {
    audioReady = false
    if (pulseInterval) {
      clearInterval(pulseInterval)
      pulseInterval = null
    }
    if (!ac) return
    const now = ac.currentTime
    if (ambientGain) {
      try { ambientGain.gain.setTargetAtTime(0, now, fadeTime * 0.3) } catch (_) { /* */ }
    }
    if (ambientNoiseSource) {
      try { ambientNoiseSource.stop(now + fadeTime + 0.1) } catch (_) { /* */ }
    }
    if (pulseGain) {
      try { pulseGain.gain.setTargetAtTime(0, now, fadeTime * 0.3) } catch (_) { /* */ }
    }
    if (pulseOsc) {
      try { pulseOsc.stop(now + fadeTime + 0.1) } catch (_) { /* */ }
    }
  }

  function destroyAudio() {
    cleanupAudio(0)
    try { ambientNoiseSource?.disconnect() } catch (_) { /* */ }
    try { ambientGain?.disconnect() } catch (_) { /* */ }
    try { pulseOsc?.disconnect() } catch (_) { /* */ }
    try { pulseGain?.disconnect() } catch (_) { /* */ }
    ambientNoiseSource = null
    ambientGain = null
    pulseOsc = null
    pulseGain = null
    ac = null
  }

  function init() {
    if (!canvas) return
    creatures = []
    food = []
    deathParticles = []
    creatureTrails = new Map()
    totalBorn = 0
    totalDied = 0
    maxGeneration = 0

    const w = canvas.width
    const h = canvas.height

    // Seed initial creatures
    for (let i = 0; i < 20; i++) {
      creatures.push(spawnCreature(
        w * 0.2 + Math.random() * w * 0.6,
        h * 0.2 + Math.random() * h * 0.6,
        0,
      ))
    }

    // Seed initial food
    for (let i = 0; i < 40; i++) {
      food.push(spawnFood(w, h))
    }
  }

  function spawnCreature(x: number, y: number, gen: number, parentHue?: number): Creature {
    const hue = parentHue !== undefined
      ? parentHue + (Math.random() - 0.5) * 30 // mutation
      : Math.random() * 360

    totalBorn++
    maxGeneration = Math.max(maxGeneration, gen)

    return {
      x, y,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      energy: 50 + Math.random() * 30,
      age: 0,
      maxAge: 800 + Math.random() * 400,
      speed: 0.8 + Math.random() * 0.8,
      size: 3 + Math.random() * 2,
      senseRange: 60 + Math.random() * 40,
      hue: ((hue % 360) + 360) % 360,
      generation: gen,
    }
  }

  function spawnFood(w: number, h: number): Food {
    return {
      x: Math.random() * w,
      y: h * 0.4 + Math.random() * h * 0.55, // food grows mostly in lower half
      energy: 20 + Math.random() * 15,
      size: 2 + Math.random() * 2,
      growth: 0,
    }
  }

  function update() {
    if (!canvas) return
    const w = canvas.width
    const h = canvas.height

    // Grow new food occasionally
    if (food.length < 60 && Math.random() < 0.05) {
      food.push(spawnFood(w, h))
    }

    // Food growth animation
    for (const f of food) {
      if (f.growth < 1) f.growth += 0.02
    }

    // Update creatures
    const newCreatures: Creature[] = []

    for (const c of creatures) {
      c.age++
      c.energy -= 0.1 + c.speed * 0.05 // metabolism cost

      // Find nearest food
      let nearestFood: Food | null = null
      let nearestDist = Infinity
      for (const f of food) {
        const dx = f.x - c.x
        const dy = f.y - c.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < nearestDist && dist < c.senseRange) {
          nearestFood = f
          nearestDist = dist
        }
      }

      // Steering
      if (nearestFood) {
        const dx = nearestFood.x - c.x
        const dy = nearestFood.y - c.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        c.vx += (dx / dist) * 0.15
        c.vy += (dy / dist) * 0.15

        // Eat
        if (dist < c.size + nearestFood.size) {
          c.energy += nearestFood.energy
          food.splice(food.indexOf(nearestFood), 1)
          playChirp(c.hue)
        }
      } else {
        // Wander
        c.vx += (Math.random() - 0.5) * 0.3
        c.vy += (Math.random() - 0.5) * 0.3
      }

      // Speed limit
      const speed = Math.sqrt(c.vx * c.vx + c.vy * c.vy)
      if (speed > c.speed) {
        c.vx = (c.vx / speed) * c.speed
        c.vy = (c.vy / speed) * c.speed
      }

      // Move
      c.x += c.vx
      c.y += c.vy

      // Subtle drift toward nearest wall — creatures occasionally explore edges
      if (Math.random() < 0.01) {
        const distLeft = c.x
        const distRight = w - c.x
        const distTop = c.y
        const distBottom = h - c.y
        const minDist = Math.min(distLeft, distRight, distTop, distBottom)
        if (minDist === distLeft) c.vx -= 0.3
        else if (minDist === distRight) c.vx += 0.3
        else if (minDist === distTop) c.vy -= 0.3
        else c.vy += 0.3
      }

      // Bounce off walls (terrarium glass)
      const margin = 20
      if (c.x < margin) { c.x = margin; c.vx *= -0.5 }
      if (c.x > w - margin) { c.x = w - margin; c.vx *= -0.5 }
      if (c.y < margin) { c.y = margin; c.vy *= -0.5 }
      if (c.y > h - margin) { c.y = h - margin; c.vy *= -0.5 }

      // Reproduce when energy is high and population isn't too large
      if (c.energy > 100 && creatures.length + newCreatures.length < 80 && Math.random() < 0.02) {
        c.energy *= 0.5
        newCreatures.push(spawnCreature(
          c.x + (Math.random() - 0.5) * 20,
          c.y + (Math.random() - 0.5) * 20,
          c.generation + 1,
          c.hue,
        ))
        playReproductionPop()
      }

      // Update creature trail
      let trail = creatureTrails.get(c)
      if (!trail) {
        trail = []
        creatureTrails.set(c, trail)
      }
      trail.push({ x: c.x, y: c.y })
      if (trail.length > 8) trail.shift()
    }

    creatures.push(...newCreatures)

    // Death
    creatures = creatures.filter(c => {
      if (c.energy <= 0 || c.age > c.maxAge) {
        totalDied++
        playDeathSigh()
        creatureTrails.delete(c)
        // Death particles
        for (let i = 0; i < 5; i++) {
          deathParticles.push({
            x: c.x,
            y: c.y,
            vx: (Math.random() - 0.5) * 2,
            vy: -Math.random() * 2,
            life: 1,
            hue: c.hue,
          })
        }
        // Dead creatures become food
        food.push({
          x: c.x, y: c.y,
          energy: 10,
          size: 1.5,
          growth: 1,
        })
        return false
      }
      return true
    })

    // Update death particles
    deathParticles = deathParticles.filter(p => {
      p.x += p.vx
      p.y += p.vy
      p.vy -= 0.02
      p.life -= 0.02
      return p.life > 0
    })

    // Auto-reseed if population crashes
    if (creatures.length === 0 && food.length > 5) {
      for (let i = 0; i < 8; i++) {
        creatures.push(spawnCreature(
          w * 0.3 + Math.random() * w * 0.4,
          h * 0.3 + Math.random() * h * 0.4,
          0,
        ))
      }
    }

    // Compute zone densities — how many creatures are near each wall
    const zoneThreshold = 40
    zoneDensity = [0, 0, 0]
    for (const c of creatures) {
      if (c.x < zoneThreshold) zoneDensity[0]++ // left wall → garden
      if (c.y < zoneThreshold) zoneDensity[1]++ // top wall → automaton
      if (c.x > w - zoneThreshold) zoneDensity[2]++ // right wall → choir
    }

    // Generate crack patterns when density threshold first reached
    for (let i = 0; i < 3; i++) {
      if (zoneDensity[i] >= 5 && !zoneCracksGenerated[i]) {
        zoneCracksGenerated[i] = true
        zoneCracks[i] = []
        const numCracks = 4 + Math.floor(Math.random() * 4)
        for (let j = 0; j < numCracks; j++) {
          let cx: number, cy: number, cdx: number, cdy: number
          if (i === 0) { // left wall
            cx = 15; cy = h * 0.3 + Math.random() * h * 0.4
            cdx = -1 - Math.random() * 3; cdy = (Math.random() - 0.5) * 4
          } else if (i === 1) { // top wall
            cx = w * 0.3 + Math.random() * w * 0.4; cy = 15
            cdx = (Math.random() - 0.5) * 4; cdy = -1 - Math.random() * 3
          } else { // right wall
            cx = w - 15; cy = h * 0.3 + Math.random() * h * 0.4
            cdx = 1 + Math.random() * 3; cdy = (Math.random() - 0.5) * 4
          }
          zoneCracks[i].push({ x: cx, y: cy, dx: cdx, dy: cdy, len: 8 + Math.random() * 15 })
        }
      }
      // Reset cracks when density drops below threshold
      if (zoneDensity[i] < 3 && zoneCracksGenerated[i]) {
        zoneCracksGenerated[i] = false
        zoneCracks[i] = []
      }
    }

    // Spawn escape particles from active zones
    for (let i = 0; i < 3; i++) {
      if (zoneDensity[i] >= 5 && Math.random() < 0.15) {
        let px: number, py: number, pvx: number, pvy: number
        if (i === 0) { // left
          px = 10; py = h * 0.3 + Math.random() * h * 0.4
          pvx = -0.3 - Math.random() * 0.5; pvy = (Math.random() - 0.5) * 0.3
        } else if (i === 1) { // top
          px = w * 0.3 + Math.random() * w * 0.4; py = 10
          pvx = (Math.random() - 0.5) * 0.3; pvy = -0.3 - Math.random() * 0.5
        } else { // right
          px = w - 10; py = h * 0.3 + Math.random() * h * 0.4
          pvx = 0.3 + Math.random() * 0.5; pvy = (Math.random() - 0.5) * 0.3
        }
        // Pick hue from a nearby creature
        const nearbyHue = creatures.length > 0 ? creatures[Math.floor(Math.random() * creatures.length)].hue : 120
        escapeParticles.push({ x: px, y: py, vx: pvx, vy: pvy, life: 1, hue: nearbyHue })
      }
    }

    // Update escape particles
    escapeParticles = escapeParticles.filter(p => {
      p.x += p.vx
      p.y += p.vy
      p.life -= 0.012
      return p.life > 0
    })

    // Update shatter animation
    if (shatterZone >= 0) {
      shatterTime += 0.016
      shatterParticles = shatterParticles.filter(p => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.05
        p.life -= 0.025
        return p.life > 0
      })
      // Accelerate creatures toward the shatter wall
      for (const c of creatures) {
        if (shatterZone === 0 && c.x < 60) c.vx -= 0.5
        if (shatterZone === 1 && c.y < 60) c.vy -= 0.5
        if (shatterZone === 2 && c.x > w - 60) c.vx += 0.5
      }
      // Navigate after brief animation
      if (shatterTime > 0.5) {
        const targetRoom = migrationZones[shatterZone].room
        shatterZone = -1
        shatterTime = 0
        shatterParticles = []
        if (deps.switchTo) deps.switchTo(targetRoom)
      }
    }

    // Update population pulse rate every ~60 frames
    if (Math.round(time * 60) % 60 === 0) {
      updatePulseRate()
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    update()

    const w = canvas.width
    const h = canvas.height

    // Background
    ctx.fillStyle = 'rgba(8, 12, 8, 1)'
    ctx.fillRect(0, 0, w, h)

    // Terrarium glass (border)
    ctx.strokeStyle = 'rgba(80, 100, 80, 0.08)'
    ctx.lineWidth = 2
    ctx.strokeRect(15, 15, w - 30, h - 30)

    // Inner glass reflection
    ctx.strokeStyle = 'rgba(120, 150, 120, 0.03)'
    ctx.lineWidth = 1
    ctx.strokeRect(18, 18, w - 36, h - 36)

    // Glass reflection stripes — diagonal light catching
    ctx.save()
    const reflectionAlpha = 0.015 + Math.sin(time * 0.2) * 0.005
    for (let stripe = 0; stripe < 3; stripe++) {
      const offset = w * 0.2 + stripe * w * 0.25
      const grad = ctx.createLinearGradient(
        offset - 30, 0,
        offset + 30, 0,
      )
      grad.addColorStop(0, 'transparent')
      grad.addColorStop(0.5, `rgba(180, 220, 180, ${reflectionAlpha})`)
      grad.addColorStop(1, 'transparent')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.moveTo(offset - 15, 15)
      ctx.lineTo(offset + 15, 15)
      ctx.lineTo(offset - 25 + 15, h - 15)
      ctx.lineTo(offset - 25 - 15, h - 15)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()

    // Soil line
    ctx.fillStyle = 'rgba(40, 30, 20, 0.15)'
    ctx.fillRect(20, h * 0.85, w - 40, h * 0.15 - 15)

    // Draw food with warm glow
    for (const f of food) {
      const alpha = 0.3 * f.growth

      // Outer warm glow
      const warmGlow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.size * 4)
      warmGlow.addColorStop(0, `rgba(140, 200, 60, ${alpha * 0.3})`)
      warmGlow.addColorStop(0.5, `rgba(100, 180, 40, ${alpha * 0.1})`)
      warmGlow.addColorStop(1, 'transparent')
      ctx.fillStyle = warmGlow
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.size * 4, 0, Math.PI * 2)
      ctx.fill()

      // Inner glow
      const glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.size * 2)
      glow.addColorStop(0, `rgba(80, 200, 60, ${alpha})`)
      glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.size * 2, 0, Math.PI * 2)
      ctx.fill()

      // Core
      ctx.fillStyle = `rgba(80, 200, 60, ${alpha * 1.5})`
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.size * f.growth, 0, Math.PI * 2)
      ctx.fill()
    }

    // Draw creature trails
    for (const c of creatures) {
      const trail = creatureTrails.get(c)
      if (trail && trail.length > 1) {
        const ageRatio = c.age / c.maxAge
        const sat = Math.max(20, 60 - ageRatio * 40)
        for (let i = 0; i < trail.length - 1; i++) {
          const trailAlpha = (i / trail.length) * 0.08
          ctx.fillStyle = `hsla(${c.hue}, ${sat}%, 55%, ${trailAlpha})`
          ctx.beginPath()
          ctx.arc(trail[i].x, trail[i].y, c.size * 0.4, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    // Draw creatures
    for (const c of creatures) {
      const energyRatio = c.energy / 120
      const ageRatio = c.age / c.maxAge
      const alpha = Math.min(0.8, 0.3 + energyRatio * 0.5)
      const sat = Math.max(20, 60 - ageRatio * 40)

      // Body
      ctx.fillStyle = `hsla(${c.hue}, ${sat}%, 55%, ${alpha})`
      ctx.beginPath()
      ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2)
      ctx.fill()

      // Direction indicator (eye)
      const angle = Math.atan2(c.vy, c.vx)
      const eyeX = c.x + Math.cos(angle) * c.size * 0.6
      const eyeY = c.y + Math.sin(angle) * c.size * 0.6
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.6})`
      ctx.beginPath()
      ctx.arc(eyeX, eyeY, 1, 0, Math.PI * 2)
      ctx.fill()

      // Sense range (very faint)
      if (c.energy < 30) {
        // Hungry — show sense range
        ctx.strokeStyle = `hsla(${c.hue}, 30%, 50%, 0.03)`
        ctx.beginPath()
        ctx.arc(c.x, c.y, c.senseRange, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Energy bar (tiny)
      const barW = c.size * 2
      const barH = 1.5
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
      ctx.fillRect(c.x - barW / 2, c.y - c.size - 4, barW, barH)
      ctx.fillStyle = energyRatio > 0.5
        ? `rgba(80, 200, 80, ${alpha * 0.5})`
        : `rgba(200, 80, 40, ${alpha * 0.5})`
      ctx.fillRect(c.x - barW / 2, c.y - c.size - 4, barW * Math.min(1, energyRatio), barH)
    }

    // Death particles
    for (const p of deathParticles) {
      ctx.fillStyle = `hsla(${p.hue}, 30%, 60%, ${p.life * 0.5})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }

    // Title
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(120, 160, 120, ${0.08 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the terrarium', w / 2, 30)

    // Stats
    ctx.font = '12px monospace'
    ctx.fillStyle = 'rgba(120, 160, 120, 0.1)'
    ctx.textAlign = 'left'
    ctx.fillText(`population: ${creatures.length}`, 25, h - 35)
    ctx.fillText(`food: ${food.length}`, 25, h - 23)

    ctx.textAlign = 'center'
    ctx.fillText(`born: ${totalBorn} · died: ${totalDied}`, w / 2, h - 23)

    ctx.textAlign = 'right'
    ctx.fillText(`gen ${maxGeneration}`, w - 25, h - 35)
    ctx.fillText(`ratio: ${creatures.length > 0 ? (food.length / creatures.length).toFixed(1) : '∞'}`, w - 25, h - 23)

    // Garden passage — life evolved enough to find the garden
    if (maxGeneration >= 10 && deps.onGarden && gardenLink && !gardenLinkVisible) {
      gardenLinkVisible = true
      gardenLink.style.opacity = '0.3'
      gardenLink.style.pointerEvents = 'auto'
    }

    // Swarm migration zone visualization
    if (deps.switchTo) {
      for (let i = 0; i < migrationZones.length; i++) {
        const density = zoneDensity[i]
        const intensity = Math.min(1, density / 10)
        const isActive = density >= 5
        const isHovered = hoveredZone === i

        if (density >= 2) {
          // Pulsing glow on the glass wall
          const pulse = 0.5 + 0.5 * Math.sin(time * 2 + i * 2)
          const glowAlpha = intensity * 0.15 * (0.7 + pulse * 0.3) * (isHovered ? 2 : 1)

          ctx.save()
          if (i === 0) { // left wall
            const grad = ctx.createLinearGradient(0, 0, 60, 0)
            grad.addColorStop(0, `rgba(80, 200, 100, ${glowAlpha})`)
            grad.addColorStop(1, 'transparent')
            ctx.fillStyle = grad
            ctx.fillRect(0, h * 0.15, 60, h * 0.7)
          } else if (i === 1) { // top wall
            const grad = ctx.createLinearGradient(0, 0, 0, 60)
            grad.addColorStop(0, `rgba(120, 180, 220, ${glowAlpha})`)
            grad.addColorStop(1, 'transparent')
            ctx.fillStyle = grad
            ctx.fillRect(w * 0.15, 0, w * 0.7, 60)
          } else { // right wall
            const grad = ctx.createLinearGradient(w, 0, w - 60, 0)
            grad.addColorStop(0, `rgba(180, 140, 200, ${glowAlpha})`)
            grad.addColorStop(1, 'transparent')
            ctx.fillStyle = grad
            ctx.fillRect(w - 60, h * 0.15, 60, h * 0.7)
          }
          ctx.restore()
        }

        // Glass cracks
        if (isActive && zoneCracks[i].length > 0) {
          ctx.save()
          const crackAlpha = intensity * 0.3 * (isHovered ? 1.5 : 1)
          ctx.strokeStyle = i === 0
            ? `rgba(80, 200, 100, ${crackAlpha})`
            : i === 1
              ? `rgba(120, 180, 220, ${crackAlpha})`
              : `rgba(180, 140, 200, ${crackAlpha})`
          ctx.lineWidth = 0.5
          for (const crack of zoneCracks[i]) {
            ctx.beginPath()
            ctx.moveTo(crack.x, crack.y)
            // Draw a jagged crack line
            const steps = 3
            let cx = crack.x, cy = crack.y
            for (let s = 1; s <= steps; s++) {
              cx += crack.dx * (crack.len / steps) / Math.abs(crack.dx + 0.01) + (Math.random() - 0.5) * 2
              cy += crack.dy * (crack.len / steps) / Math.abs(crack.dy + 0.01) + (Math.random() - 0.5) * 2
              ctx.lineTo(cx, cy)
            }
            ctx.stroke()
          }
          ctx.restore()
        }

        // Hint text when active
        if (isActive) {
          ctx.save()
          ctx.font = '12px "Cormorant Garamond", serif'
          const hintAlpha = intensity * 0.2 * (0.7 + 0.3 * Math.sin(time * 1.5 + i))
          if (i === 0) {
            ctx.fillStyle = `rgba(80, 200, 100, ${hintAlpha})`
            ctx.textAlign = 'left'
            ctx.save()
            ctx.translate(12, h / 2)
            ctx.rotate(-Math.PI / 2)
            ctx.fillText(migrationZones[i].hint, 0, 0)
            ctx.restore()
          } else if (i === 1) {
            ctx.fillStyle = `rgba(120, 180, 220, ${hintAlpha})`
            ctx.textAlign = 'center'
            ctx.fillText(migrationZones[i].hint, w / 2, 42)
          } else {
            ctx.fillStyle = `rgba(180, 140, 200, ${hintAlpha})`
            ctx.textAlign = 'right'
            ctx.save()
            ctx.translate(w - 12, h / 2)
            ctx.rotate(Math.PI / 2)
            ctx.fillText(migrationZones[i].hint, 0, 0)
            ctx.restore()
          }
          ctx.restore()
        }
      }
    }

    // Escape particles drifting through glass
    for (const p of escapeParticles) {
      const alpha = p.life * 0.5
      ctx.fillStyle = `hsla(${p.hue}, 40%, 65%, ${alpha})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, 1.5 + (1 - p.life) * 1, 0, Math.PI * 2)
      ctx.fill()
    }

    // Shatter animation
    if (shatterZone >= 0) {
      for (const p of shatterParticles) {
        const alpha = p.life * 0.6
        ctx.fillStyle = `rgba(180, 220, 180, ${alpha})`
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
      }
    }

    // Hint
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(120, 160, 120, 0.04)'
    ctx.textAlign = 'center'
    ctx.fillText('click to add food · watch them live and die', w / 2, h - 8)

    // Cultural inscription
    inscriptionTimer += 0.016
    if (inscriptionTimer >= 24) {
      inscriptionTimer = 0
      inscriptionIdx = (inscriptionIdx + 1) % CULTURAL_INSCRIPTIONS.length
    }
    const insText = CULTURAL_INSCRIPTIONS[inscriptionIdx]
    ctx.font = '11px "Cormorant Garamond", serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(80, 160, 80, 0.035)'
    const insMaxW = w * 0.75
    const insWords = insText.split(' ')
    const insLines: string[] = []
    let insLine = ''
    for (const word of insWords) {
      const test = insLine ? insLine + ' ' + word : word
      if (ctx.measureText(test).width > insMaxW) { insLines.push(insLine); insLine = word }
      else insLine = test
    }
    if (insLine) insLines.push(insLine)
    for (let li = 0; li < insLines.length; li++) {
      ctx.fillText(insLines[li], w / 2, h - 28 + li * 14)
    }
  }

  function handleClick(e: MouseEvent) {
    // Check swarm migration zone clicks — follow the creatures through the glass
    if (deps.switchTo && canvas && shatterZone < 0) {
      const w = canvas.width
      const edgeThreshold = 60

      for (let i = 0; i < migrationZones.length; i++) {
        if (zoneDensity[i] < 5) continue // not enough creatures clustered

        let inZone = false
        if (i === 0 && e.clientX < edgeThreshold) inZone = true
        if (i === 1 && e.clientY < edgeThreshold) inZone = true
        if (i === 2 && e.clientX > w - edgeThreshold) inZone = true

        if (inZone) {
          // Trigger shatter animation
          shatterZone = i
          shatterTime = 0
          shatterParticles = []
          // Burst of glass shards from the click point
          for (let j = 0; j < 25; j++) {
            const angle = Math.random() * Math.PI * 2
            const speed = 1 + Math.random() * 4
            shatterParticles.push({
              x: e.clientX,
              y: e.clientY,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 1,
              size: 1 + Math.random() * 3,
            })
          }
          return
        }
      }
    }

    // Click to drop food
    food.push({
      x: e.clientX,
      y: e.clientY,
      energy: 25,
      size: 3,
      growth: 0,
    })
  }

  return {
    name: 'terrarium',
    label: 'the terrarium',

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

      canvas.addEventListener('mousemove', (e) => {
        if (!canvas) return
        hoveredZone = -1
        const cw = canvas.width
        const edgeThreshold = 60

        // Check if hovering over an active migration zone
        if (deps.switchTo) {
          for (let i = 0; i < migrationZones.length; i++) {
            if (zoneDensity[i] < 5) continue
            let inZone = false
            if (i === 0 && e.clientX < edgeThreshold) inZone = true
            if (i === 1 && e.clientY < edgeThreshold) inZone = true
            if (i === 2 && e.clientX > cw - edgeThreshold) inZone = true
            if (inZone) {
              hoveredZone = i
              break
            }
          }
        }
        canvas.style.cursor = hoveredZone >= 0 ? 'pointer' : 'crosshair'
      })

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      // Garden link — appears when life evolves enough
      if (deps.onGarden) {
        gardenLink = document.createElement('div')
        gardenLink.style.cssText = `
          position: absolute; top: 12px; right: 16px;
          font-family: 'Cormorant Garamond', serif;
          font-size: 12px; font-style: italic;
          letter-spacing: 2px;
          color: rgba(80, 180, 80, 0.4);
          cursor: pointer; pointer-events: none;
          opacity: 0; transition: opacity 2s ease;
        `
        gardenLink.textContent = 'life finds the garden'
        gardenLink.addEventListener('click', () => deps.onGarden?.())
        overlay.appendChild(gardenLink)
      }

      overlay.appendChild(canvas)
      return overlay
    },

    activate() {
      active = true
      gardenLinkVisible = false
      if (gardenLink) {
        gardenLink.style.opacity = '0'
        gardenLink.style.pointerEvents = 'none'
      }
      init()
      initAudio()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      cleanupAudio(0.5)
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      destroyAudio()
      overlay?.remove()
    },
  }
}
