/**
 * THE MIRROR — a portrait of your behavior in Oubli
 *
 * A hidden room that reflects who you are based on how you've used
 * Oubli. It tracks which rooms you visit, how long you stay, what
 * you type, and renders this data as a text-based self-portrait.
 *
 * The mirror doesn't show your face — it shows your patterns.
 * The rooms you visit most are the brightest. The words you type
 * most frequently form the features. Your browsing rhythm becomes
 * a pulse.
 *
 * The portrait degrades if you don't visit — the mirror forgets
 * you just like everything else in Oubli.
 *
 * Accessible from The Between (one of the doors leads here instead
 * of to a normal room), or discovered by visiting every visible room.
 *
 * Inspired by: Black mirrors (scrying), funhouse mirrors,
 * Dorian Gray, data portraits, quantified self,
 * the observer effect (looking changes what's seen)
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface MirrorDeps {
  getMemories: () => StoredMemory[]
  getRoomVisits: () => Map<string, number>
  switchTo?: (name: string) => void
}

interface DataPoint {
  x: number
  y: number
  char: string
  alpha: number
  hue: number
}

interface Ripple {
  x: number
  y: number
  age: number       // seconds since creation
  maxAge: number    // total lifetime
}

interface FogParticle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  alpha: number
}

interface ShimmerSpot {
  x: number         // 0..1 relative to mirror area
  y: number         // 0..1 relative to mirror area
  vx: number
  vy: number
  radius: number
  brightness: number
}

const STORAGE_KEY = 'oubli-mirror-data'

interface MirrorData {
  roomTimes: Record<string, number>  // room name → total seconds
  wordFrequencies: Record<string, number>  // word → count
  lastVisit: number
  visitCount: number
}

export function createMirrorRoom(deps: MirrorDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let portraitData: DataPoint[] = []
  let mirrorData: MirrorData

  // Reflection distortion navigation zones
  let hoveredZone = -1
  let shatterTime = -1  // when a shatter animation started (-1 = none)
  let shatterTarget = ''  // room to navigate to after shatter
  const navZones = [
    { room: 'darkroom', side: 'left' as const },
    { room: 'datepaintings', side: 'right' as const },
  ]

  // --- Visual state ---
  const ripples: Ripple[] = []
  const fogParticles: FogParticle[] = []
  const shimmerSpots: ShimmerSpot[] = []
  let mouseX = -1
  let mouseY = -1

  // Initialize shimmer spots
  for (let i = 0; i < 6; i++) {
    shimmerSpots.push({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.02,
      vy: (Math.random() - 0.5) * 0.015,
      radius: 15 + Math.random() * 30,
      brightness: 0.02 + Math.random() * 0.03,
    })
  }

  // --- Audio state ---
  let audioInitialized = false
  let audioMaster: GainNode | null = null
  // Mirror hum
  let humOsc1: OscillatorNode | null = null
  let humOsc2: OscillatorNode | null = null
  let humGain: GainNode | null = null
  // Fog whisper (brown noise)
  let fogNoiseNode: AudioBufferSourceNode | null = null
  let fogFilter: BiquadFilterNode | null = null
  let fogGain: GainNode | null = null
  let fogActive = false

  async function initAudio() {
    if (audioInitialized) return
    try {
      const ac = await getAudioContext()
      const dest = getAudioDestination()

      // Master gain for this room
      audioMaster = ac.createGain()
      audioMaster.gain.value = 0
      audioMaster.connect(dest)

      // --- Mirror hum: detuned sine pair creating 1Hz beat ---
      humGain = ac.createGain()
      humGain.gain.value = 0.012
      humGain.connect(audioMaster)

      humOsc1 = ac.createOscillator()
      humOsc1.type = 'sine'
      humOsc1.frequency.value = 180
      humOsc1.connect(humGain)
      humOsc1.start()

      humOsc2 = ac.createOscillator()
      humOsc2.type = 'sine'
      humOsc2.frequency.value = 181
      humOsc2.connect(humGain)
      humOsc2.start()

      audioInitialized = true
    } catch {
      // Audio not available — silent fallback
    }
  }

  function startFogAudio() {
    if (!audioInitialized || !audioMaster || fogActive) return
    try {
      const ac = audioMaster.context as AudioContext

      // Brown noise: integrate white noise
      const bufferSize = ac.sampleRate * 2
      const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
      const data = buffer.getChannelData(0)
      let lastOut = 0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        lastOut = (lastOut + (0.02 * white)) / 1.02
        data[i] = lastOut * 3.5 // normalize a bit
      }

      fogNoiseNode = ac.createBufferSource()
      fogNoiseNode.buffer = buffer
      fogNoiseNode.loop = true

      fogFilter = ac.createBiquadFilter()
      fogFilter.type = 'lowpass'
      fogFilter.frequency.value = 200
      fogFilter.Q.value = 0.5

      fogGain = ac.createGain()
      fogGain.gain.value = 0.008

      fogNoiseNode.connect(fogFilter)
      fogFilter.connect(fogGain)
      fogGain.connect(audioMaster)
      fogNoiseNode.start()

      fogActive = true
    } catch {
      // silent fallback
    }
  }

  function stopFogAudio() {
    if (!fogActive) return
    try {
      if (fogGain) {
        const ac = fogGain.context as AudioContext
        fogGain.gain.setValueAtTime(fogGain.gain.value, ac.currentTime)
        fogGain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.3)
      }
      setTimeout(() => {
        try { fogNoiseNode?.stop() } catch { /* already stopped */ }
        fogNoiseNode?.disconnect()
        fogFilter?.disconnect()
        fogGain?.disconnect()
        fogNoiseNode = null
        fogFilter = null
        fogGain = null
        fogActive = false
      }, 350)
    } catch {
      fogActive = false
    }
  }

  function playShimmerSound() {
    if (!audioInitialized || !audioMaster) return
    try {
      const ac = audioMaster.context as AudioContext
      const now = ac.currentTime

      // Ascending glissando: 400 -> 800Hz over 500ms
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(400, now)
      osc.frequency.linearRampToValueAtTime(800, now + 0.5)

      // Gain envelope
      const g = ac.createGain()
      g.gain.setValueAtTime(0.02, now)
      g.gain.linearRampToValueAtTime(0.005, now + 0.3)
      g.gain.linearRampToValueAtTime(0, now + 0.5)

      // Simple delay for reverb-like effect
      const delay = ac.createDelay(0.5)
      delay.delayTime.value = 0.15
      const feedback = ac.createGain()
      feedback.gain.value = 0.25
      const wetGain = ac.createGain()
      wetGain.gain.value = 0.3

      osc.connect(g)
      // Dry path
      g.connect(audioMaster)
      // Wet path
      g.connect(delay)
      delay.connect(feedback)
      feedback.connect(delay)
      delay.connect(wetGain)
      wetGain.connect(audioMaster)

      osc.start(now)
      osc.stop(now + 0.6)

      // Cleanup after sound finishes (including delay tail)
      setTimeout(() => {
        osc.disconnect()
        g.disconnect()
        delay.disconnect()
        feedback.disconnect()
        wetGain.disconnect()
      }, 1200)
    } catch {
      // silent fallback
    }
  }

  function playShatterSound() {
    if (!audioInitialized || !audioMaster) return
    try {
      const ac = audioMaster.context as AudioContext
      const now = ac.currentTime

      // White noise burst through highpass
      const noiseLen = 0.1
      const noiseBuf = ac.createBuffer(1, Math.ceil(ac.sampleRate * noiseLen), ac.sampleRate)
      const noiseData = noiseBuf.getChannelData(0)
      for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = Math.random() * 2 - 1
      }
      const noiseSrc = ac.createBufferSource()
      noiseSrc.buffer = noiseBuf

      const highpass = ac.createBiquadFilter()
      highpass.type = 'highpass'
      highpass.frequency.value = 2000

      const noiseGain = ac.createGain()
      noiseGain.gain.setValueAtTime(0.05, now)
      noiseGain.gain.linearRampToValueAtTime(0, now + 0.1)

      noiseSrc.connect(highpass)
      highpass.connect(noiseGain)
      noiseGain.connect(audioMaster)
      noiseSrc.start(now)
      noiseSrc.stop(now + noiseLen)

      // Descending tone: 600 -> 200Hz over 300ms
      const tone = ac.createOscillator()
      tone.type = 'sine'
      tone.frequency.setValueAtTime(600, now)
      tone.frequency.linearRampToValueAtTime(200, now + 0.3)

      const toneGain = ac.createGain()
      toneGain.gain.setValueAtTime(0.04, now)
      toneGain.gain.linearRampToValueAtTime(0, now + 0.3)

      tone.connect(toneGain)
      toneGain.connect(audioMaster)
      tone.start(now)
      tone.stop(now + 0.35)

      // Cleanup
      setTimeout(() => {
        noiseSrc.disconnect()
        highpass.disconnect()
        noiseGain.disconnect()
        tone.disconnect()
        toneGain.disconnect()
      }, 600)
    } catch {
      // silent fallback
    }
  }

  function fadeAudioIn() {
    if (!audioMaster) return
    const ac = audioMaster.context as AudioContext
    const now = ac.currentTime
    audioMaster.gain.cancelScheduledValues(now)
    audioMaster.gain.setValueAtTime(audioMaster.gain.value, now)
    audioMaster.gain.linearRampToValueAtTime(1.0, now + 0.8)
  }

  function fadeAudioOut() {
    if (!audioMaster) return
    const ac = audioMaster.context as AudioContext
    const now = ac.currentTime
    audioMaster.gain.cancelScheduledValues(now)
    audioMaster.gain.setValueAtTime(audioMaster.gain.value, now)
    audioMaster.gain.linearRampToValueAtTime(0, now + 0.5)
  }

  function destroyAudio() {
    fadeAudioOut()
    setTimeout(() => {
      try { humOsc1?.stop() } catch { /* already stopped */ }
      try { humOsc2?.stop() } catch { /* already stopped */ }
      try { fogNoiseNode?.stop() } catch { /* already stopped */ }
      humOsc1?.disconnect()
      humOsc2?.disconnect()
      humGain?.disconnect()
      fogNoiseNode?.disconnect()
      fogFilter?.disconnect()
      fogGain?.disconnect()
      audioMaster?.disconnect()

      humOsc1 = null
      humOsc2 = null
      humGain = null
      fogNoiseNode = null
      fogFilter = null
      fogGain = null
      audioMaster = null
      fogActive = false
      audioInitialized = false
    }, 600)
  }

  function loadData(): MirrorData {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) return JSON.parse(stored)
    } catch {}
    return {
      roomTimes: {},
      wordFrequencies: {},
      lastVisit: Date.now(),
      visitCount: 0,
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mirrorData))
    } catch {}
  }

  function buildPortrait() {
    if (!canvas) return
    portraitData = []
    const w = canvas.width
    const h = canvas.height
    const memories = deps.getMemories()

    // Build word frequency from all memories
    for (const mem of memories) {
      const words = mem.currentText.toLowerCase().split(/\s+/).filter(w => w.length > 2)
      for (const word of words) {
        mirrorData.wordFrequencies[word] = (mirrorData.wordFrequencies[word] || 0) + 1
      }
    }

    // Sort words by frequency
    const sortedWords = Object.entries(mirrorData.wordFrequencies)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)

    if (sortedWords.length === 0 && memories.length === 0) return

    // Create an oval portrait shape
    const centerX = w / 2
    const centerY = h * 0.45
    const radiusX = w * 0.2
    const radiusY = h * 0.3

    // Fill the oval with words, sized by frequency
    const maxFreq = sortedWords.length > 0 ? sortedWords[0][1] : 1
    let attempts = 0

    for (const [word, freq] of sortedWords) {
      const normalizedFreq = freq / maxFreq
      const angle = Math.random() * Math.PI * 2
      const dist = Math.random() * 0.9
      const x = centerX + Math.cos(angle) * radiusX * dist
      const y = centerY + Math.sin(angle) * radiusY * dist

      for (const char of word) {
        portraitData.push({
          x: x + (Math.random() - 0.5) * word.length * 8,
          y: y + (Math.random() - 0.5) * 10,
          char,
          alpha: 0.1 + normalizedFreq * 0.4,
          hue: (freq * 37) % 360,
        })
      }

      attempts++
      if (attempts > 200) break
    }

    // Add room-based shading
    const roomVisits = deps.getRoomVisits()
    const totalVisits = [...roomVisits.values()].reduce((s, v) => s + v, 0) || 1

    // Room data creates background texture
    for (const [room, visits] of roomVisits) {
      const intensity = visits / totalVisits
      const roomAngle = hashRoom(room) * Math.PI * 2
      const rx = centerX + Math.cos(roomAngle) * radiusX * 0.5
      const ry = centerY + Math.sin(roomAngle) * radiusY * 0.5

      for (let i = 0; i < Math.ceil(intensity * 20); i++) {
        portraitData.push({
          x: rx + (Math.random() - 0.5) * 40,
          y: ry + (Math.random() - 0.5) * 40,
          char: room[Math.floor(Math.random() * room.length)],
          alpha: intensity * 0.1,
          hue: hashRoom(room) * 360,
        })
      }
    }

    saveData()

    // Play shimmer sound when portrait rebuilds
    playShimmerSound()
  }

  function hashRoom(name: string): number {
    let h = 0
    for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0
    return Math.abs(h) / 0xFFFFFFFF
  }

  // Helper: check if a point is inside the mirror area
  function isInMirrorArea(px: number, py: number, w: number, h: number): boolean {
    const frameX = w * 0.2 + 10
    const frameY = h * 0.08 + 10
    const frameW = w * 0.6 - 20
    const frameH = h * 0.75 - 20
    return px >= frameX && px <= frameX + frameW && py >= frameY && py <= frameY + frameH
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height

    ctx.clearRect(0, 0, w, h)

    // Background — very dark, reflective
    ctx.fillStyle = 'rgba(3, 3, 8, 1)'
    ctx.fillRect(0, 0, w, h)

    // Mirror frame
    const frameX = w * 0.2
    const frameY = h * 0.08
    const frameW = w * 0.6
    const frameH = h * 0.75
    ctx.strokeStyle = 'rgba(120, 100, 80, 0.08)'
    ctx.lineWidth = 3
    ctx.strokeRect(frameX, frameY, frameW, frameH)

    // Inner frame
    ctx.strokeStyle = 'rgba(120, 100, 80, 0.04)'
    ctx.lineWidth = 1
    ctx.strokeRect(frameX + 8, frameY + 8, frameW - 16, frameH - 16)

    // Mirror surface — slight gradient
    const mirrorGrad = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, h * 0.4)
    mirrorGrad.addColorStop(0, 'rgba(15, 15, 25, 0.3)')
    mirrorGrad.addColorStop(1, 'rgba(5, 5, 10, 0.1)')
    ctx.fillStyle = mirrorGrad
    ctx.fillRect(frameX + 10, frameY + 10, frameW - 20, frameH - 20)

    // --- Mirror surface shimmer: drifting bright spots ---
    const mirrorInnerX = frameX + 10
    const mirrorInnerY = frameY + 10
    const mirrorInnerW = frameW - 20
    const mirrorInnerH = frameH - 20

    ctx.save()
    ctx.beginPath()
    ctx.rect(mirrorInnerX, mirrorInnerY, mirrorInnerW, mirrorInnerH)
    ctx.clip()

    for (const spot of shimmerSpots) {
      // Update position
      spot.x += spot.vx * 0.016
      spot.y += spot.vy * 0.016
      // Bounce off edges
      if (spot.x < 0 || spot.x > 1) spot.vx *= -1
      if (spot.y < 0 || spot.y > 1) spot.vy *= -1
      spot.x = Math.max(0, Math.min(1, spot.x))
      spot.y = Math.max(0, Math.min(1, spot.y))

      const sx = mirrorInnerX + spot.x * mirrorInnerW
      const sy = mirrorInnerY + spot.y * mirrorInnerH
      const pulse = Math.sin(time * 0.7 + spot.x * 5 + spot.y * 3) * 0.3 + 0.7

      const shimGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, spot.radius)
      shimGrad.addColorStop(0, `rgba(180, 180, 220, ${spot.brightness * pulse})`)
      shimGrad.addColorStop(1, 'rgba(180, 180, 220, 0)')
      ctx.fillStyle = shimGrad
      ctx.fillRect(sx - spot.radius, sy - spot.radius, spot.radius * 2, spot.radius * 2)
    }

    ctx.restore()

    // --- Portrait breathing: synchronized alpha pulsing ---
    const breathCycle = Math.sin(time * 0.8) * 0.04 // slow rhythm

    // Portrait data points
    if (portraitData.length > 0) {
      for (const dp of portraitData) {
        const breathe = Math.sin(time * 0.5 + dp.x * 0.01 + dp.y * 0.01) * 0.02
        const synced = breathCycle
        ctx.font = '12px "Cormorant Garamond", serif'
        ctx.fillStyle = `hsla(${dp.hue}, 30%, 60%, ${Math.max(0, dp.alpha + breathe + synced)})`
        ctx.textAlign = 'center'
        ctx.fillText(dp.char, dp.x, dp.y)
      }
    } else {
      // Empty mirror
      ctx.font = '14px "Cormorant Garamond", serif'
      ctx.fillStyle = 'rgba(120, 120, 160, 0.1)'
      ctx.textAlign = 'center'
      ctx.fillText('the mirror is blank.', w / 2, h * 0.4)
      ctx.fillText('it needs more of you to reflect.', w / 2, h * 0.45)
      ctx.fillText('visit rooms. type memories. return.', w / 2, h * 0.5)
    }

    // --- Mirror ripple at cursor position ---
    // Update and render ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rip = ripples[i]
      rip.age += 0.016
      if (rip.age > rip.maxAge) {
        ripples.splice(i, 1)
        continue
      }

      const progress = rip.age / rip.maxAge
      const maxRadius = 40
      for (let ring = 0; ring < 3; ring++) {
        const ringProgress = Math.max(0, progress - ring * 0.1)
        if (ringProgress <= 0 || ringProgress > 1) continue
        const radius = ringProgress * maxRadius
        const alpha = 0.06 * (1 - ringProgress)
        ctx.beginPath()
        ctx.arc(rip.x, rip.y, radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(160, 160, 200, ${alpha})`
        ctx.lineWidth = 0.8
        ctx.stroke()
      }
    }

    // Degradation based on time since last visit
    const daysSinceVisit = (Date.now() - mirrorData.lastVisit) / (1000 * 60 * 60 * 24)
    const fogAlpha = daysSinceVisit > 1 ? Math.min(0.7, daysSinceVisit * 0.05) : 0

    if (daysSinceVisit > 1) {
      // Fog over the mirror — it forgets you
      ctx.fillStyle = `rgba(10, 10, 15, ${fogAlpha})`
      ctx.fillRect(frameX + 10, frameY + 10, frameW - 20, frameH - 20)

      ctx.font = '12px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(120, 120, 160, ${0.1 + Math.sin(time) * 0.03})`
      ctx.fillText('the mirror is forgetting your face.', w / 2, h * 0.9)

      // Start fog audio if not already running
      if (!fogActive) startFogAudio()
    } else {
      // Stop fog audio if running
      if (fogActive) stopFogAudio()
    }

    // --- Fog particles when fogAlpha > 0 ---
    if (fogAlpha > 0) {
      // Spawn new particles occasionally
      if (Math.random() < 0.15) {
        fogParticles.push({
          x: mirrorInnerX - 10,
          y: mirrorInnerY + Math.random() * mirrorInnerH,
          vx: 8 + Math.random() * 12,
          vy: (Math.random() - 0.5) * 3,
          radius: 3 + Math.random() * 6,
          alpha: 0.02 + Math.random() * 0.04,
        })
      }

      // Update and render fog particles
      ctx.save()
      ctx.beginPath()
      ctx.rect(mirrorInnerX, mirrorInnerY, mirrorInnerW, mirrorInnerH)
      ctx.clip()

      for (let i = fogParticles.length - 1; i >= 0; i--) {
        const fp = fogParticles[i]
        fp.x += fp.vx * 0.016
        fp.y += fp.vy * 0.016
        fp.vy += (Math.random() - 0.5) * 0.5

        // Remove if off-screen
        if (fp.x > mirrorInnerX + mirrorInnerW + 20) {
          fogParticles.splice(i, 1)
          continue
        }

        ctx.beginPath()
        ctx.arc(fp.x, fp.y, fp.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(80, 80, 100, ${fp.alpha * Math.min(fogAlpha * 3, 1)})`
        ctx.fill()
      }

      ctx.restore()
    } else {
      // Clear fog particles when not fogged
      fogParticles.length = 0
    }

    // Stats
    const roomVisits = deps.getRoomVisits()
    const totalVisits = [...roomVisits.values()].reduce((s, v) => s + v, 0)
    const wordCount = Object.keys(mirrorData.wordFrequencies).length

    ctx.font = '12px monospace'
    ctx.fillStyle = 'rgba(120, 120, 160, 0.06)'
    ctx.textAlign = 'center'
    ctx.fillText(
      `${totalVisits} room visits · ${wordCount} unique words · visit #${mirrorData.visitCount}`,
      w / 2, h - 15
    )

    // Title
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(120, 120, 160, ${0.08 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the mirror', w / 2, 30)

    // Reflection distortion navigation zones within the mirror frame
    if (deps.switchTo) {
      const mirrorLeft = frameX + 10
      const mirrorRight = frameX + frameW - 10
      const mirrorCenterY = frameY + frameH * 0.5
      const zoneRadius = Math.min(frameW * 0.1, 50)

      for (let i = 0; i < navZones.length; i++) {
        const zone = navZones[i]
        const zx = zone.side === 'left'
          ? mirrorLeft + frameW * 0.18
          : mirrorRight - frameW * 0.18
        const zy = mirrorCenterY
        const hovered = hoveredZone === i
        const isShatteringThis = shatterTime > 0 && shatterTarget === zone.room
        const shatterElapsed = isShatteringThis ? time - shatterTime : 0

        ctx.save()

        // Clipping — keep reflections inside mirror frame
        ctx.beginPath()
        ctx.rect(frameX + 10, frameY + 10, frameW - 20, frameH - 20)
        ctx.clip()

        if (isShatteringThis && shatterElapsed < 0.5) {
          // --- Shatter animation: crack pattern radiating outward ---
          const progress = shatterElapsed / 0.4
          const crackAlpha = 1.0 - progress
          const numCracks = 8
          for (let c = 0; c < numCracks; c++) {
            const angle = (c / numCracks) * Math.PI * 2 + 0.3
            const len = progress * zoneRadius * 2.5
            ctx.beginPath()
            ctx.moveTo(zx, zy)
            // Jagged crack lines
            const segments = 4
            for (let s = 1; s <= segments; s++) {
              const frac = s / segments
              const jitterX = (Math.sin(c * 13.7 + s * 7.3) * 6) * frac
              const jitterY = (Math.cos(c * 9.1 + s * 11.2) * 6) * frac
              ctx.lineTo(
                zx + Math.cos(angle) * len * frac + jitterX,
                zy + Math.sin(angle) * len * frac + jitterY
              )
            }
            ctx.strokeStyle = `rgba(200, 200, 240, ${crackAlpha * 0.6})`
            ctx.lineWidth = 1.5 - progress
            ctx.stroke()
          }
          // Flash at center
          const flashAlpha = Math.max(0, 0.5 - progress * 1.2)
          const flashGrad = ctx.createRadialGradient(zx, zy, 0, zx, zy, zoneRadius * progress * 2)
          flashGrad.addColorStop(0, `rgba(200, 200, 255, ${flashAlpha})`)
          flashGrad.addColorStop(1, 'rgba(200, 200, 255, 0)')
          ctx.fillStyle = flashGrad
          ctx.fillRect(zx - zoneRadius * 3, zy - zoneRadius * 3, zoneRadius * 6, zoneRadius * 6)
        } else if (!isShatteringThis) {
          // --- Normal reflection distortion zone ---
          const baseAlpha = hovered ? 0.18 : 0.05
          const shimmer = Math.sin(time * 2.0 + i * 3.0) * 0.02

          if (zone.room === 'darkroom') {
            // Darkroom: faint red safe-light glow with developing tray shapes
            const redGrad = ctx.createRadialGradient(zx, zy, 0, zx, zy, zoneRadius * 1.3)
            redGrad.addColorStop(0, `rgba(180, 30, 20, ${(baseAlpha + shimmer) * 1.5})`)
            redGrad.addColorStop(0.6, `rgba(120, 15, 10, ${(baseAlpha + shimmer) * 0.8})`)
            redGrad.addColorStop(1, 'rgba(80, 10, 5, 0)')
            ctx.fillStyle = redGrad
            ctx.fillRect(zx - zoneRadius * 1.5, zy - zoneRadius * 1.5, zoneRadius * 3, zoneRadius * 3)

            // Developing tray shapes — faint rectangles
            ctx.strokeStyle = `rgba(160, 40, 30, ${baseAlpha * 1.8 + shimmer})`
            ctx.lineWidth = 0.6
            const trayW = zoneRadius * 0.7
            const trayH = zoneRadius * 0.45
            for (let t = 0; t < 3; t++) {
              const trayOffsetX = (t - 1) * trayW * 0.9
              const trayOffsetY = Math.sin(time * 0.8 + t * 1.5) * 3
              ctx.strokeRect(
                zx + trayOffsetX - trayW / 2,
                zy + trayOffsetY - trayH / 2 + 8,
                trayW, trayH
              )
            }
          } else {
            // Date paintings: faint rectangular shapes with date-like text
            const paintGrad = ctx.createRadialGradient(zx, zy, 0, zx, zy, zoneRadius * 1.3)
            paintGrad.addColorStop(0, `rgba(140, 130, 100, ${(baseAlpha + shimmer) * 1.2})`)
            paintGrad.addColorStop(0.6, `rgba(100, 90, 70, ${(baseAlpha + shimmer) * 0.6})`)
            paintGrad.addColorStop(1, 'rgba(60, 55, 40, 0)')
            ctx.fillStyle = paintGrad
            ctx.fillRect(zx - zoneRadius * 1.5, zy - zoneRadius * 1.5, zoneRadius * 3, zoneRadius * 3)

            // Small painting frames with tiny dates
            const pW = zoneRadius * 0.5
            const pH = zoneRadius * 0.65
            const dates = ['FEB.8', 'JAN.3', 'DEC.1', 'OCT.19']
            for (let p = 0; p < 4; p++) {
              const col = p % 2
              const row = Math.floor(p / 2)
              const px = zx + (col - 0.5) * pW * 1.4
              const py = zy + (row - 0.5) * pH * 1.2
              const drift = Math.sin(time * 0.6 + p * 2.1) * 2
              ctx.strokeStyle = `rgba(130, 120, 90, ${baseAlpha * 1.5 + shimmer})`
              ctx.lineWidth = 0.5
              ctx.strokeRect(px - pW / 2 + drift, py - pH / 2, pW, pH)
              // Tiny date text inside
              ctx.font = '6px monospace'
              ctx.fillStyle = `rgba(140, 130, 100, ${baseAlpha * 2.0 + shimmer})`
              ctx.textAlign = 'center'
              ctx.fillText(dates[p], px + drift, py + 2)
            }
          }

          // Hover effect: ripple (concentric circles expanding outward)
          if (hovered) {
            const rippleCount = 3
            for (let r = 0; r < rippleCount; r++) {
              const phase = (time * 1.5 + r * 0.7) % 2.0
              const rippleRadius = phase * zoneRadius * 1.5
              const rippleAlpha = Math.max(0, 0.15 * (1.0 - phase / 2.0))
              ctx.beginPath()
              ctx.arc(zx, zy, rippleRadius, 0, Math.PI * 2)
              ctx.strokeStyle = zone.room === 'darkroom'
                ? `rgba(180, 50, 40, ${rippleAlpha})`
                : `rgba(150, 140, 110, ${rippleAlpha})`
              ctx.lineWidth = 1.0
              ctx.stroke()
            }
            // Cursor hint
            canvas!.style.cursor = 'pointer'
          }
        }

        ctx.restore()
      }

      // Reset cursor when not hovering any zone
      if (hoveredZone === -1 && canvas) {
        canvas.style.cursor = 'default'
      }
    }
  }

  mirrorData = loadData()

  // Throttle for ripple creation on mouse move
  let lastRippleTime = 0

  return {
    name: 'mirror',
    label: 'the mirror',
    hidden: true,

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

      // Reflection distortion zone click + hover
      const getZonePositions = () => {
        if (!canvas) return []
        const cw = canvas.width
        const ch = canvas.height
        const fX = cw * 0.2 + 10
        const fW = cw * 0.6 - 20
        const fY = ch * 0.08
        const fH = ch * 0.75
        const centerY = fY + fH * 0.5
        const radius = Math.min(fW * 0.1, 50)
        return navZones.map(zone => ({
          x: zone.side === 'left' ? fX + fW * 0.18 : fX + fW - fW * 0.18,
          y: centerY,
          radius: radius * 1.3,
          room: zone.room,
        }))
      }

      canvas.addEventListener('click', (e) => {
        if (!deps.switchTo || !canvas || shatterTime > 0) return
        const zones = getZonePositions()
        for (let i = 0; i < zones.length; i++) {
          const z = zones[i]
          const dx = e.clientX - z.x
          const dy = e.clientY - z.y
          if (dx * dx + dy * dy < z.radius * z.radius) {
            // Start shatter animation, navigate after delay
            shatterTime = time
            shatterTarget = z.room
            // Play shatter sound
            playShatterSound()
            setTimeout(() => {
              if (deps.switchTo) deps.switchTo(z.room)
              shatterTime = -1
              shatterTarget = ''
            }, 400)
            return
          }
        }
      })
      canvas.addEventListener('mousemove', (e) => {
        if (!canvas) return
        mouseX = e.clientX
        mouseY = e.clientY

        // Mirror ripple: create ripple when mouse is over mirror area
        const now = performance.now()
        if (now - lastRippleTime > 120 && isInMirrorArea(mouseX, mouseY, canvas.width, canvas.height)) {
          ripples.push({
            x: mouseX,
            y: mouseY,
            age: 0,
            maxAge: 1.2,
          })
          lastRippleTime = now
          // Cap ripple count
          if (ripples.length > 15) ripples.shift()
        }

        // Navigation zone hover detection
        if (!deps.switchTo) return
        hoveredZone = -1
        const zones = getZonePositions()
        for (let i = 0; i < zones.length; i++) {
          const z = zones[i]
          const dx = e.clientX - z.x
          const dy = e.clientY - z.y
          if (dx * dx + dy * dy < z.radius * z.radius) {
            hoveredZone = i
            break
          }
        }
      })

      overlay.appendChild(canvas)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
          buildPortrait()
        }
      }
      window.addEventListener('resize', onResize)

      return overlay
    },

    activate() {
      active = true
      mirrorData.visitCount++
      mirrorData.lastVisit = Date.now()
      saveData()
      buildPortrait()
      render()

      // Initialize and fade in audio
      initAudio().then(() => {
        if (active) fadeAudioIn()
      })
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      fadeAudioOut()
      stopFogAudio()
      // Clear visual state
      ripples.length = 0
      fogParticles.length = 0
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      destroyAudio()
      ripples.length = 0
      fogParticles.length = 0
      overlay?.remove()
    },
  }
}
