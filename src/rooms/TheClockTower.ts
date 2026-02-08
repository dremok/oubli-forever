/**
 * THE CLOCK TOWER — time visualized through memory
 *
 * A room dominated by a massive clock face. But this isn't a normal
 * clock — the 12 positions correspond to your 12 most recent memories.
 * The hour hand points toward the memory that's degrading fastest.
 * The minute hand sweeps through time since your last visit.
 * The second hand ticks erratically — sometimes backwards.
 *
 * As memories degrade, their positions on the clock face distort:
 * numbers blur, the face cracks, the ticking becomes irregular.
 * At high degradation, the clock starts running backwards.
 *
 * There's a pendulum below the face that swings with a period
 * determined by your total time spent in Oubli across all sessions.
 *
 * Inspired by: Dali's melting clocks, the Clock of the Long Now,
 * the doomsday clock, grandfather clocks in empty houses,
 * how dementia patients lose time perception, chronobiology
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface ClockTowerDeps {
  getMemories: () => StoredMemory[]
  onMidnight?: () => void
  switchTo?: (name: string) => void
}

export function createClockTowerRoom(deps: ClockTowerDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let pendulumAngle = 0
  let pendulumVelocity = 0
  let tickSound = 0 // visual tick flash
  let lastHour = -1
  let portalVisible = false
  let portalAlpha = 0
  let hoveredClockPos = -1
  let mouseX = 0
  let mouseY = 0

  // Clock face navigation positions — rooms mapped to clock hours
  // Angles: 12=top(-PI/2), 3=right(0), 6=bottom(PI/2), 9=left(PI)
  const clockNav = [
    { label: 'III', hint: 'observatory', room: 'observatory', hourPos: 3 },
    { label: 'VI', hint: 'date paintings', room: 'datepaintings', hourPos: 6 },
    { label: 'IX', hint: 'furnace', room: 'furnace', hourPos: 9 },
    { label: 'XII', hint: 'pendulum', room: 'pendulum', hourPos: 12 },
  ]

  // Track glow intensity for each position (0-1, decays over time)
  const handGlow = [0, 0, 0, 0]

  // --- Pendulum trail ---
  const pendulumTrail: { x: number; y: number }[] = []
  const TRAIL_LENGTH = 8

  // --- Dust particles (degradation effect) ---
  interface DustParticle {
    x: number
    y: number
    vy: number
    alpha: number
    size: number
  }
  const dustParticles: DustParticle[] = []

  // --- Gear shadow rotation ---
  let gearAngle = 0

  // --- Audio state ---
  let audioCtxRef: AudioContext | null = null
  let audioMaster: GainNode | null = null
  let audioInitialized = false

  // Tower ambience nodes
  let droneSine: OscillatorNode | null = null
  let droneGain: GainNode | null = null
  let windSource: AudioBufferSourceNode | null = null
  let windGain: GainNode | null = null
  let windFilter: BiquadFilterNode | null = null

  // Pendulum swoosh
  let swooshSource: AudioBufferSourceNode | null = null
  let swooshFilter: BiquadFilterNode | null = null
  let swooshGain: GainNode | null = null

  // Tick tracking
  let lastTickSecond = -1
  let tickInterval: ReturnType<typeof setTimeout> | null = null

  // Creak scheduling
  let creakTimeout: ReturnType<typeof setTimeout> | null = null

  // Current degradation (updated each frame, read by audio schedulers)
  let currentAvgDeg = 0

  // --- Audio functions ---

  async function initAudio() {
    if (audioInitialized) return
    try {
      const ac = await getAudioContext()
      audioCtxRef = ac
      const dest = getAudioDestination()

      audioMaster = ac.createGain()
      audioMaster.gain.value = 0
      audioMaster.connect(dest)

      // === Tower ambience: low drone ===
      droneSine = ac.createOscillator()
      droneSine.type = 'sine'
      droneSine.frequency.value = 30
      droneGain = ac.createGain()
      droneGain.gain.value = 0.01
      droneSine.connect(droneGain)
      droneGain.connect(audioMaster)
      droneSine.start()

      // === Tower ambience: wind noise ===
      const windDuration = 4
      const windBufLen = Math.floor(ac.sampleRate * windDuration)
      const windBuffer = ac.createBuffer(1, windBufLen, ac.sampleRate)
      const windData = windBuffer.getChannelData(0)
      for (let i = 0; i < windBufLen; i++) {
        windData[i] = Math.random() * 2 - 1
      }
      windSource = ac.createBufferSource()
      windSource.buffer = windBuffer
      windSource.loop = true
      windFilter = ac.createBiquadFilter()
      windFilter.type = 'highpass'
      windFilter.frequency.value = 800
      windFilter.Q.value = 0.5
      windGain = ac.createGain()
      windGain.gain.value = 0.005
      windSource.connect(windFilter)
      windFilter.connect(windGain)
      windGain.connect(audioMaster)
      windSource.start()

      // === Pendulum swoosh: brown noise through sweeping bandpass ===
      const swooshDuration = 4
      const swooshBufLen = Math.floor(ac.sampleRate * swooshDuration)
      const swooshBuffer = ac.createBuffer(1, swooshBufLen, ac.sampleRate)
      const swooshData = swooshBuffer.getChannelData(0)
      // Generate brown noise (integrated white noise)
      let brownVal = 0
      for (let i = 0; i < swooshBufLen; i++) {
        const white = Math.random() * 2 - 1
        brownVal = (brownVal + 0.02 * white) / 1.02
        swooshData[i] = brownVal * 3.5
      }
      swooshSource = ac.createBufferSource()
      swooshSource.buffer = swooshBuffer
      swooshSource.loop = true
      swooshFilter = ac.createBiquadFilter()
      swooshFilter.type = 'bandpass'
      swooshFilter.frequency.value = 300
      swooshFilter.Q.value = 1.5
      swooshGain = ac.createGain()
      swooshGain.gain.value = 0.01
      swooshSource.connect(swooshFilter)
      swooshFilter.connect(swooshGain)
      swooshGain.connect(audioMaster)
      swooshSource.start()

      // Fade master in
      audioMaster.gain.setTargetAtTime(1, ac.currentTime, 0.8)

      // Start tick scheduling
      scheduleTick()

      // Start creak scheduling
      scheduleCreak()

      audioInitialized = true
    } catch {
      /* audio init failed — room still works without sound */
    }
  }

  function scheduleTick() {
    if (!active) return
    // Check roughly every 50ms for second changes
    tickInterval = setTimeout(() => {
      if (!active || !audioCtxRef || !audioMaster) return
      const now = new Date()
      const sec = now.getSeconds()
      if (sec !== lastTickSecond) {
        lastTickSecond = sec

        const deg = currentAvgDeg

        // At high degradation, irregularly skip ticks
        if (deg > 0.3 && Math.random() < deg * 0.3) {
          // Skip this tick
        } else {
          playTick()
          // At high degradation, sometimes double-tick (stutter)
          if (deg > 0.4 && Math.random() < deg * 0.2) {
            setTimeout(() => {
              if (active) playTick()
            }, 30 + Math.random() * 50)
          }
        }

        // Backwards mode: add a subtle second click
        if (deg > 0.6) {
          setTimeout(() => {
            if (active) playTick()
          }, 80 + Math.random() * 40)
        }
      }
      scheduleTick()
    }, 50)
  }

  function playTick() {
    if (!audioCtxRef || !audioMaster) return
    const ac = audioCtxRef
    try {
      // Very short noise burst through bandpass — mechanical click
      const tickLen = Math.floor(ac.sampleRate * 0.003)
      const tickBuf = ac.createBuffer(1, tickLen, ac.sampleRate)
      const tickData = tickBuf.getChannelData(0)
      for (let i = 0; i < tickLen; i++) {
        tickData[i] = (Math.random() * 2 - 1) * (1 - i / tickLen)
      }

      const src = ac.createBufferSource()
      src.buffer = tickBuf

      const bp = ac.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1500
      bp.Q.value = 3

      const gain = ac.createGain()
      gain.gain.value = 0.04

      src.connect(bp)
      bp.connect(gain)
      gain.connect(audioMaster!)
      src.start()
      src.onended = () => {
        src.disconnect()
        bp.disconnect()
        gain.disconnect()
      }
    } catch {
      /* ignore tick errors */
    }
  }

  function playChime() {
    if (!audioCtxRef || !audioMaster) return
    const ac = audioCtxRef
    try {
      // Bell-like tone: fundamental + octave
      const now = ac.currentTime

      const osc1 = ac.createOscillator()
      osc1.type = 'sine'
      osc1.frequency.value = 523 // C5

      const osc2 = ac.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.value = 1047 // C6 (octave)

      const chimeGain = ac.createGain()
      // Quick attack, long decay
      chimeGain.gain.setValueAtTime(0, now)
      chimeGain.gain.linearRampToValueAtTime(0.05, now + 0.01)
      chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0)

      osc1.connect(chimeGain)
      osc2.connect(chimeGain)
      chimeGain.connect(audioMaster!)

      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + 2.1)
      osc2.stop(now + 2.1)

      osc1.onended = () => {
        osc1.disconnect()
        osc2.disconnect()
        chimeGain.disconnect()
      }
    } catch {
      /* ignore chime errors */
    }
  }

  function scheduleCreak() {
    if (!active) return
    const delay = 5000 + Math.random() * 10000 // 5-15 seconds
    creakTimeout = setTimeout(() => {
      if (!active || !audioCtxRef || !audioMaster) return
      if (currentAvgDeg > 0.4) {
        playCreak()
      }
      scheduleCreak()
    }, delay)
  }

  function playCreak() {
    if (!audioCtxRef || !audioMaster) return
    const ac = audioCtxRef
    try {
      // Metallic creak: swept sine from 200->400Hz over 200ms
      const now = ac.currentTime

      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(200, now)
      osc.frequency.linearRampToValueAtTime(400, now + 0.2)

      const creakGain = ac.createGain()
      creakGain.gain.setValueAtTime(0, now)
      creakGain.gain.linearRampToValueAtTime(0.02, now + 0.02)
      creakGain.gain.linearRampToValueAtTime(0, now + 0.22)

      osc.connect(creakGain)
      creakGain.connect(audioMaster!)
      osc.start(now)
      osc.stop(now + 0.25)

      osc.onended = () => {
        osc.disconnect()
        creakGain.disconnect()
      }
    } catch {
      /* ignore creak errors */
    }
  }

  function updatePendulumAudio() {
    // Modulate swoosh filter based on pendulum position
    if (!audioCtxRef || !swooshFilter || !swooshGain) return
    const t = audioCtxRef.currentTime
    // Pendulum velocity drives swoosh loudness — louder at center (max velocity)
    const vel = Math.abs(pendulumVelocity)
    const maxVel = 0.005 // approximate max velocity
    const velNorm = Math.min(vel / maxVel, 1)

    // Sweep bandpass frequency: 200Hz at extremes, 400Hz at center
    const freq = 200 + velNorm * 200
    swooshFilter.frequency.setTargetAtTime(freq, t, 0.05)

    // Volume tracks velocity
    swooshGain.gain.setTargetAtTime(0.005 + velNorm * 0.01, t, 0.05)
  }

  function fadeAudioOut() {
    if (audioMaster && audioCtxRef) {
      audioMaster.gain.setTargetAtTime(0, audioCtxRef.currentTime, 0.3)
    }
    if (tickInterval !== null) {
      clearTimeout(tickInterval)
      tickInterval = null
    }
    if (creakTimeout !== null) {
      clearTimeout(creakTimeout)
      creakTimeout = null
    }
  }

  function cleanupAudio() {
    if (tickInterval !== null) {
      clearTimeout(tickInterval)
      tickInterval = null
    }
    if (creakTimeout !== null) {
      clearTimeout(creakTimeout)
      creakTimeout = null
    }
    try { droneSine?.stop() } catch { /* already stopped */ }
    droneSine?.disconnect()
    droneGain?.disconnect()
    try { windSource?.stop() } catch { /* already stopped */ }
    windSource?.disconnect()
    windFilter?.disconnect()
    windGain?.disconnect()
    try { swooshSource?.stop() } catch { /* already stopped */ }
    swooshSource?.disconnect()
    swooshFilter?.disconnect()
    swooshGain?.disconnect()
    audioMaster?.disconnect()

    droneSine = null
    droneGain = null
    windSource = null
    windFilter = null
    windGain = null
    swooshSource = null
    swooshFilter = null
    swooshGain = null
    audioMaster = null
    audioCtxRef = null
    audioInitialized = false
    lastTickSecond = -1
  }

  // --- Visual helpers ---

  function spawnDust(cx: number, cy: number, radius: number) {
    if (dustParticles.length > 40) return
    const angle = Math.random() * Math.PI * 2
    const dist = Math.random() * radius * 0.9
    dustParticles.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      vy: 0.2 + Math.random() * 0.3,
      alpha: 0.06 + Math.random() * 0.04,
      size: 0.5 + Math.random() * 1,
    })
  }

  function drawGearShadows(
    drawCtx: CanvasRenderingContext2D,
    cx: number, cy: number, radius: number
  ) {
    drawCtx.save()
    drawCtx.globalAlpha = 0.03

    // Draw 3 gear-like circles with teeth behind the clock face
    const gears = [
      { ox: -radius * 0.35, oy: -radius * 0.3, r: radius * 0.25, teeth: 12, speed: 1 },
      { ox: radius * 0.3, oy: -radius * 0.2, r: radius * 0.2, teeth: 10, speed: -1.3 },
      { ox: 0, oy: radius * 0.35, r: radius * 0.18, teeth: 8, speed: 0.8 },
    ]

    for (const gear of gears) {
      const gx = cx + gear.ox
      const gy = cy + gear.oy
      const rot = gearAngle * gear.speed

      drawCtx.save()
      drawCtx.translate(gx, gy)
      drawCtx.rotate(rot)

      // Inner circle
      drawCtx.beginPath()
      drawCtx.arc(0, 0, gear.r * 0.7, 0, Math.PI * 2)
      drawCtx.strokeStyle = 'rgba(180, 160, 120, 1)'
      drawCtx.lineWidth = 0.5
      drawCtx.stroke()

      // Teeth
      for (let t = 0; t < gear.teeth; t++) {
        const a = (t / gear.teeth) * Math.PI * 2
        const innerR = gear.r * 0.85
        const outerR = gear.r
        const halfTooth = (Math.PI / gear.teeth) * 0.5
        drawCtx.beginPath()
        drawCtx.moveTo(Math.cos(a - halfTooth) * innerR, Math.sin(a - halfTooth) * innerR)
        drawCtx.lineTo(Math.cos(a - halfTooth) * outerR, Math.sin(a - halfTooth) * outerR)
        drawCtx.lineTo(Math.cos(a + halfTooth) * outerR, Math.sin(a + halfTooth) * outerR)
        drawCtx.lineTo(Math.cos(a + halfTooth) * innerR, Math.sin(a + halfTooth) * innerR)
        drawCtx.strokeStyle = 'rgba(180, 160, 120, 1)'
        drawCtx.lineWidth = 0.5
        drawCtx.stroke()
      }

      drawCtx.restore()
    }

    drawCtx.restore()
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016
    gearAngle += 0.0005

    const w = canvas.width
    const h = canvas.height
    const cx = w / 2
    const cy = h * 0.4
    const radius = Math.min(w, h) * 0.28
    const memories = deps.getMemories()

    // Average degradation affects the clock's behavior
    const avgDeg = memories.length > 0
      ? memories.reduce((s, m) => s + m.degradation, 0) / memories.length
      : 0

    // Update shared degradation for audio schedulers
    currentAvgDeg = avgDeg

    ctx.clearRect(0, 0, w, h)

    // Background — dark tower interior
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, h)
    bg.addColorStop(0, 'rgba(15, 12, 18, 1)')
    bg.addColorStop(1, 'rgba(5, 3, 8, 1)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // Tower walls — subtle stone texture lines
    ctx.strokeStyle = 'rgba(40, 35, 45, 0.08)'
    ctx.lineWidth = 0.5
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath()
      ctx.moveTo(0, y + Math.sin(y * 0.1) * 2)
      ctx.lineTo(w, y + Math.sin(y * 0.1 + 1) * 2)
      ctx.stroke()
    }

    // === GEAR SHADOWS (behind clock face) ===
    drawGearShadows(ctx, cx, cy, radius)

    // === CLOCK FACE ===

    // Apply wobble at high degradation
    if (avgDeg > 0.5) {
      ctx.save()
      const wobbleAmount = (avgDeg - 0.5) * 4 // 0-2 pixels
      const wobbleX = Math.sin(time * 3.7) * wobbleAmount
      const wobbleY = Math.cos(time * 2.9) * wobbleAmount
      ctx.translate(wobbleX, wobbleY)
    }

    // Outer ring
    ctx.beginPath()
    ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(180, 160, 120, ${0.1 - avgDeg * 0.05})`
    ctx.lineWidth = 2
    ctx.stroke()

    // Clock face background
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(20, 18, 25, ${0.8 + avgDeg * 0.15})`
    ctx.fill()

    // Cracks in the face (appear with degradation)
    if (avgDeg > 0.2) {
      ctx.strokeStyle = `rgba(60, 50, 40, ${avgDeg * 0.15})`
      ctx.lineWidth = 0.5
      for (let i = 0; i < Math.floor(avgDeg * 8); i++) {
        const angle = (i * 2.3) % (Math.PI * 2)
        const len = radius * (0.3 + avgDeg * 0.5)
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(angle) * 10, cy + Math.sin(angle) * 10)
        const endX = cx + Math.cos(angle + 0.2) * len
        const endY = cy + Math.sin(angle + 0.2) * len
        ctx.lineTo(endX, endY)
        ctx.stroke()
      }
    }

    // Hour markers — each position is a memory
    const displayMemories = memories.slice(0, 12)
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 - Math.PI / 2
      const markerDist = radius * 0.85
      const mx = cx + Math.cos(angle) * markerDist
      const my = cy + Math.sin(angle) * markerDist

      if (i < displayMemories.length) {
        const mem = displayMemories[i]
        const health = 1 - mem.degradation

        // Distortion — degraded memories wobble their position
        const wobble = mem.degradation * 5
        const wmx = mx + Math.sin(time * 2 + i) * wobble
        const wmy = my + Math.cos(time * 2 + i) * wobble

        // Memory marker
        ctx.beginPath()
        ctx.arc(wmx, wmy, 3 + health * 3, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${mem.hue * 360}, ${30 + health * 30}%, ${30 + health * 20}%, ${0.2 + health * 0.3})`
        ctx.fill()

        // Number (or degraded glyph)
        ctx.font = `${10 + health * 4}px "Cormorant Garamond", serif`
        ctx.fillStyle = `rgba(180, 160, 120, ${0.1 + health * 0.2})`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        if (health > 0.3) {
          ctx.fillText(String(i === 0 ? 12 : i), wmx, wmy)
        } else {
          // Degraded: show glitch character
          const glitchChars = '░▒▓█?·'
          ctx.fillText(glitchChars[Math.floor(time * 3 + i) % glitchChars.length], wmx, wmy)
        }

        // Memory text fragment below the marker (very faint)
        const textDist = radius * 0.65
        const tx = cx + Math.cos(angle) * textDist
        const ty = cy + Math.sin(angle) * textDist
        ctx.font = '11px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(180, 160, 120, ${health * 0.08})`
        const fragment = mem.currentText.slice(0, 12)
        ctx.fillText(fragment, tx, ty)
      } else {
        // Empty position — just a faint tick mark
        const tickInner = radius * 0.82
        const tickOuter = radius * 0.88
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(angle) * tickInner, cy + Math.sin(angle) * tickInner)
        ctx.lineTo(cx + Math.cos(angle) * tickOuter, cy + Math.sin(angle) * tickOuter)
        ctx.strokeStyle = 'rgba(180, 160, 120, 0.06)'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }

    // Minute ticks
    for (let i = 0; i < 60; i++) {
      if (i % 5 === 0) continue // skip hour positions
      const angle = (i / 60) * Math.PI * 2 - Math.PI / 2
      const tickInner = radius * 0.92
      const tickOuter = radius * 0.95
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(angle) * tickInner, cy + Math.sin(angle) * tickInner)
      ctx.lineTo(cx + Math.cos(angle) * tickOuter, cy + Math.sin(angle) * tickOuter)
      ctx.strokeStyle = 'rgba(180, 160, 120, 0.04)'
      ctx.lineWidth = 0.5
      ctx.stroke()
    }

    // === CLOCK HANDS ===

    const now = new Date()
    const realSeconds = now.getSeconds() + now.getMilliseconds() / 1000
    const realMinutes = now.getMinutes() + realSeconds / 60
    const realHours = (now.getHours() % 12) + realMinutes / 60

    // Time distortion from degradation
    const timeDistort = avgDeg * 0.5 // up to 50% time distortion
    const direction = avgDeg > 0.6 ? -1 : 1 // backwards at high degradation

    // Hour hand — points toward the degrading memory (or real time)
    const hourAngle = ((realHours * direction) / 12 * Math.PI * 2 - Math.PI / 2) +
      Math.sin(time * 0.1) * timeDistort * 0.5
    const hourLen = radius * 0.5
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(hourAngle) * hourLen, cy + Math.sin(hourAngle) * hourLen)
    ctx.strokeStyle = `rgba(180, 160, 120, ${0.25 - avgDeg * 0.1})`
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.stroke()

    // Minute hand
    const minuteAngle = ((realMinutes * direction) / 60 * Math.PI * 2 - Math.PI / 2) +
      Math.sin(time * 0.2) * timeDistort * 0.3
    const minuteLen = radius * 0.7
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(minuteAngle) * minuteLen, cy + Math.sin(minuteAngle) * minuteLen)
    ctx.strokeStyle = `rgba(180, 160, 120, ${0.2 - avgDeg * 0.08})`
    ctx.lineWidth = 2
    ctx.stroke()

    // Second hand — erratic ticking
    const secondJitter = avgDeg > 0.3 ? Math.sin(time * 8) * avgDeg * 0.3 : 0
    const secondAngle = ((realSeconds * direction) / 60 * Math.PI * 2 - Math.PI / 2) + secondJitter
    const secondLen = radius * 0.8
    ctx.beginPath()
    ctx.moveTo(cx - Math.cos(secondAngle) * 15, cy - Math.sin(secondAngle) * 15)
    ctx.lineTo(cx + Math.cos(secondAngle) * secondLen, cy + Math.sin(secondAngle) * secondLen)
    ctx.strokeStyle = `rgba(255, 80, 80, ${0.15 + tickSound * 0.2})`
    ctx.lineWidth = 1
    ctx.stroke()

    // Center pivot
    ctx.beginPath()
    ctx.arc(cx, cy, 4, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(180, 160, 120, 0.3)'
    ctx.fill()

    // Tick flash
    tickSound *= 0.95

    // Detect second hand crossing a new second
    const currentSecond = Math.floor(realSeconds)
    if (Math.abs(realSeconds - currentSecond) < 0.05) {
      tickSound = 0.5
    }

    // === DUST PARTICLES (degradation) ===
    if (avgDeg > 0.3) {
      // Spawn dust from the clock face
      if (Math.random() < avgDeg * 0.15) {
        spawnDust(cx, cy, radius)
      }
    }

    // Update and draw dust
    for (let i = dustParticles.length - 1; i >= 0; i--) {
      const d = dustParticles[i]
      d.y += d.vy
      d.alpha -= 0.0004
      if (d.alpha <= 0 || d.y > h) {
        dustParticles.splice(i, 1)
        continue
      }
      ctx.beginPath()
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(140, 120, 90, ${d.alpha})`
      ctx.fill()
    }

    // Restore wobble transform
    if (avgDeg > 0.5) {
      ctx.restore()
    }

    // === PENDULUM ===
    const pendulumX = cx
    const pendulumTopY = cy + radius + 30
    const pendulumLength = h * 0.25

    // Physics-based pendulum
    const gravity = 0.0003
    const damping = 0.9999
    pendulumVelocity -= Math.sin(pendulumAngle) * gravity
    pendulumVelocity *= damping
    pendulumAngle += pendulumVelocity

    // Keep swinging with small kicks
    if (Math.abs(pendulumAngle) < 0.01 && Math.abs(pendulumVelocity) < 0.0001) {
      pendulumAngle = 0.15 // restart swing
    }

    const bobX = pendulumX + Math.sin(pendulumAngle) * pendulumLength
    const bobY = pendulumTopY + Math.cos(pendulumAngle) * pendulumLength

    // Update pendulum trail
    pendulumTrail.push({ x: bobX, y: bobY })
    if (pendulumTrail.length > TRAIL_LENGTH) {
      pendulumTrail.shift()
    }

    // Draw pendulum trail (faint ghost positions)
    for (let i = 0; i < pendulumTrail.length - 1; i++) {
      const t_pos = pendulumTrail[i]
      const trailAlpha = (i / pendulumTrail.length) * 0.06
      ctx.beginPath()
      ctx.arc(t_pos.x, t_pos.y, 10 - (pendulumTrail.length - 1 - i) * 0.8, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(200, 180, 120, ${trailAlpha})`
      ctx.fill()
    }

    // Pendulum rod
    ctx.beginPath()
    ctx.moveTo(pendulumX, pendulumTopY)
    ctx.lineTo(bobX, bobY)
    ctx.strokeStyle = 'rgba(180, 160, 120, 0.1)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Pendulum bob
    ctx.beginPath()
    ctx.arc(bobX, bobY, 12, 0, Math.PI * 2)
    const bobGrad = ctx.createRadialGradient(bobX, bobY, 0, bobX, bobY, 12)
    bobGrad.addColorStop(0, 'rgba(200, 180, 120, 0.15)')
    bobGrad.addColorStop(1, 'rgba(200, 180, 120, 0.02)')
    ctx.fillStyle = bobGrad
    ctx.fill()

    // Update pendulum audio
    updatePendulumAudio()

    // === CLOCK FACE POSITION NAVIGATION ===
    if (deps.switchTo) {
      const navRadius = radius * 0.85
      const hitRadius = 25

      for (let i = 0; i < clockNav.length; i++) {
        const nav = clockNav[i]
        // Convert hour position to angle (12=top, 3=right, 6=bottom, 9=left)
        const navAngle = (nav.hourPos / 12) * Math.PI * 2 - Math.PI / 2
        const nx = cx + Math.cos(navAngle) * navRadius
        const ny = cy + Math.sin(navAngle) * navRadius

        // Check if any clock hand is within ~15 degrees of this position
        const threshold = (15 / 180) * Math.PI
        const handAngles = [hourAngle, minuteAngle, secondAngle]
        let handNear = false
        for (const ha of handAngles) {
          // Normalize angles to 0..2PI for comparison
          let diff = Math.abs(((ha % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) -
                              ((navAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2))
          if (diff > Math.PI) diff = Math.PI * 2 - diff
          if (diff < threshold) {
            handNear = true
            break
          }
        }

        // Update glow: ramp up when hand is near, decay when not
        if (handNear) {
          handGlow[i] = Math.min(1, handGlow[i] + 0.05)
        } else {
          handGlow[i] *= 0.97
        }

        const hovered = hoveredClockPos === i
        const glow = handGlow[i]
        const baseAlpha = 0.08
        const alpha = hovered ? 0.5 : (baseAlpha + glow * 0.35)

        // Outer glow when hand passes or hovered
        if (glow > 0.05 || hovered) {
          const glowRadius = 18 + (hovered ? 6 : glow * 10)
          const glowGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, glowRadius)
          glowGrad.addColorStop(0, `rgba(210, 190, 120, ${(hovered ? 0.15 : glow * 0.1)})`)
          glowGrad.addColorStop(1, 'rgba(210, 190, 120, 0)')
          ctx.beginPath()
          ctx.arc(nx, ny, glowRadius, 0, Math.PI * 2)
          ctx.fillStyle = glowGrad
          ctx.fill()
        }

        // Roman numeral glyph
        ctx.font = `${hovered ? 15 : 13}px "Cormorant Garamond", serif`
        ctx.fillStyle = `rgba(210, 190, 120, ${alpha})`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(nav.label, nx, ny)

        // Small pulsing dot beneath the numeral
        const dotAlpha = baseAlpha * 0.5 + glow * 0.3 + (hovered ? 0.2 : 0) +
                         Math.sin(time * 2 + i * 1.5) * 0.02
        ctx.beginPath()
        ctx.arc(nx, ny + 10, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(210, 190, 120, ${dotAlpha})`
        ctx.fill()

        // Room name hint — only visible on hover
        if (hovered) {
          // Position the hint label just outside the clock face
          const hintRadius = navRadius + 22
          const hx = cx + Math.cos(navAngle) * hintRadius
          const hy = cy + Math.sin(navAngle) * hintRadius
          ctx.font = '12px "Cormorant Garamond", serif'
          ctx.fillStyle = 'rgba(210, 190, 120, 0.25)'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(nav.hint, hx, hy)

          // Change cursor
          if (canvas) canvas.style.cursor = 'pointer'
        }
      }

      // Reset cursor if nothing hovered
      if (hoveredClockPos === -1 && canvas) {
        canvas.style.cursor = 'default'
      }

      // Detect hover: check mouse distance to each nav position
      hoveredClockPos = -1
      for (let i = 0; i < clockNav.length; i++) {
        const nav = clockNav[i]
        const navAngle = (nav.hourPos / 12) * Math.PI * 2 - Math.PI / 2
        const nx = cx + Math.cos(navAngle) * navRadius
        const ny = cy + Math.sin(navAngle) * navRadius
        const dx = mouseX - nx
        const dy = mouseY - ny
        if (Math.sqrt(dx * dx + dy * dy) < hitRadius) {
          hoveredClockPos = i
          break
        }
      }
    }

    // === TITLE & INFO ===
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(180, 160, 120, ${0.08 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText('the clock tower', w / 2, 30)

    // Time display (degrading)
    const timeStr = now.toLocaleTimeString()
    const degradedTime = avgDeg > 0.2
      ? timeStr.split('').map(c => Math.random() < avgDeg * 0.3 ? '?' : c).join('')
      : timeStr
    ctx.font = '13px monospace'
    ctx.fillStyle = 'rgba(180, 160, 120, 0.1)'
    ctx.fillText(degradedTime, w / 2, h - 30)

    // Memory count
    ctx.font = '12px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(180, 160, 120, 0.06)'
    ctx.fillText(
      `${memories.length} memories on the face · ${Math.floor(avgDeg * 100)}% degraded`,
      w / 2, h - 15
    )

    // Direction indicator (when running backwards)
    if (avgDeg > 0.6) {
      ctx.font = '12px monospace'
      ctx.fillStyle = `rgba(255, 80, 80, ${0.1 + Math.sin(time * 2) * 0.05})`
      ctx.fillText('◄ time is running backwards', w / 2, cy + radius + 18)
    }

    // Portal to The Midnight — appears when the hour changes
    const currentHour = now.getHours()
    if (lastHour >= 0 && currentHour !== lastHour && deps.onMidnight) {
      portalVisible = true
      portalAlpha = 0.4
      // Play chime on hour change
      playChime()
    }
    lastHour = currentHour

    if (portalVisible && portalAlpha > 0.02) {
      portalAlpha *= 0.998 // slow fade
      ctx.font = '13px "Cormorant Garamond", serif'
      ctx.fillStyle = `rgba(180, 160, 220, ${portalAlpha})`
      ctx.textAlign = 'center'
      ctx.fillText('▸ the hour has changed. step through.', w / 2, h - 60)
    }
  }

  return {
    name: 'clocktower',
    label: 'the clock tower',

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
      canvas.style.cssText = 'width: 100%; height: 100%; cursor: default;'
      ctx = canvas.getContext('2d')

      // Click: clock face positions or midnight portal
      canvas.addEventListener('click', (e) => {
        // Check clock face navigation positions
        if (deps.switchTo && canvas && hoveredClockPos >= 0) {
          deps.switchTo(clockNav[hoveredClockPos].room)
          return
        }

        if (portalVisible && portalAlpha > 0.02 && deps.onMidnight) {
          if (e.clientY > window.innerHeight * 0.8) {
            deps.onMidnight()
          }
        }
      })

      // Track mouse position for clock face hover detection
      canvas.addEventListener('mousemove', (e) => {
        mouseX = e.clientX
        mouseY = e.clientY
      })

      overlay.appendChild(canvas)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      return overlay
    },

    activate() {
      active = true
      pendulumAngle = 0.2
      pendulumVelocity = 0
      pendulumTrail.length = 0
      dustParticles.length = 0
      initAudio()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      fadeAudioOut()
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      cleanupAudio()
      overlay?.remove()
    },
  }
}
