/**
 * THE MIDNIGHT — a room that exists most fully at midnight
 *
 * Hidden room accessible from The Clock Tower when the real-world
 * hour changes. A brief portal text appears, and clicking it takes
 * you here.
 *
 * The Midnight is a room that responds to the actual time of day.
 * At midnight (00:00), it's most vivid — colors bright, text clear,
 * the room fully materialized. During the day, it's a ghost: barely
 * visible, text faded, colors desaturated.
 *
 * The room contains a single poem that changes based on the hour.
 * 24 poems, one per hour. The poem degrades inversely to its hour —
 * the midnight poem is pristine, the noon poem is barely legible.
 *
 * Inspired by: Cinderella's midnight, the witching hour,
 * New Year's Eve, shift workers, insomnia, the hours before dawn,
 * how the world feels different at 3am vs 3pm.
 *
 * Deepened with: the Doomsday Clock at 85 seconds to midnight
 * (January 2026), Venice Biennale 2026 "In Minor Keys" —
 * quiet registers, ambient audio that shifts with the hour,
 * falling moon-dust particles, click-to-illuminate interaction.
 */

import type { Room } from './RoomManager'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

const HOURLY_POEMS: string[] = [
  // 00:00 — Midnight (most vivid)
  'this is the hour the world holds its breath.\neverything that was becomes what will be.\nthe clock strikes nothing, and that nothing\nis the most honest sound.',

  // 01:00
  'the last person still awake\ncarries the weight of the sleeping world.\ntheir thoughts are the only thoughts.\nfor one hour, they are everyone.',

  // 02:00
  'the house remembers itself at 2am.\nevery creak is a sentence.\nevery shadow, a paragraph.\nthe architecture of night is written in sounds.',

  // 03:00
  'the witching hour.\nnot because of magic\nbut because at 3am\nyou finally stop lying to yourself.',

  // 04:00
  'the birds begin before the light.\nthey sing into darkness\ntrusting that their song\nwill pull the sun upward.',

  // 05:00
  'dawn is forgetting the night.\nthe sky practices colors\nit hasn\'t used in hours.\npink is always a surprise.',

  // 06:00
  'the alarm is the cruelest invention.\nit tears you from a world\nwhere you could fly\nand returns you to one where you walk.',

  // 07:00
  'morning is a mask you put on.\nyou were someone else five minutes ago.\nnow you are the person\nwho gets out of bed.',

  // 08:00
  'the commute is a river\nof people who have all agreed\nto pretend they are going somewhere\nimportant.',

  // 09:00
  'nine o\'clock is when the world\nstarts taking itself seriously.\nthe coffee helps.\nthe seriousness does not.',

  // 10:00
  'mid-morning is a plateau.\nyou have been awake long enough\nto forget you were ever asleep.\nthe dream was someone else\'s.',

  // 11:00
  'the hour before lunch\nis the longest hour.\nhunger makes time thick.\nthe clock becomes a countdown.',

  // 12:00 — Noon (most faded)
  'noon is the death of shadow.\neverything is lit equally.\nnothing hides.\nthis is the hour of no mystery.',

  // 13:00
  'the afternoon is a slow descent\ninto the gravity of the day.\nwhat you started this morning\nnow starts to weigh something.',

  // 14:00
  'two o\'clock is the hour of doubt.\nwhat am i doing here.\nwas this the right choice.\nthe answer is always: keep going.',

  // 15:00
  'three pm sun is different.\nit comes in at an angle\nthat makes everything golden\nand nothing permanent.',

  // 16:00
  'the hour of lengthening shadows.\neach object grows a dark twin\nthat reaches toward the east\nas if trying to escape.',

  // 17:00
  'the end of something.\nnot the day, not yet.\nbut the pretense\nthat the day would last forever.',

  // 18:00
  'dusk is the most honest light.\nit doesn\'t illuminate or conceal.\nit simply says:\nthings are leaving now.',

  // 19:00
  'dinner is the ritual\nof pretending the day was worth it.\nyou eat the evidence.\ntomorrow, you\'ll do it again.',

  // 20:00
  'eight o\'clock is the hour\nwhen the world divides:\nthose going out\nand those staying in.\nboth are correct.',

  // 21:00
  'the night has settled in.\nit is no longer arriving.\nit lives here now.\nyou are a guest.',

  // 22:00
  'ten pm is the hour of almost.\nalmost asleep. almost honest.\nalmost ready to let go\nof who you were today.',

  // 23:00
  'eleven is midnight\'s shadow.\nthe anticipation of ending.\neverything winds down.\nthe clock begins to lean forward.',
]

// --- Particle system ---
interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
}

// --- Click ripple ---
interface Ripple {
  x: number
  y: number
  radius: number
  alpha: number
}

interface MidnightDeps {
  switchTo?: (name: string) => void
}

export function createMidnightRoom(deps?: MidnightDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let hoveredNav = -1

  // --- Audio state ---
  let audioInitialized = false
  let droneOsc: OscillatorNode | null = null
  let droneGain: GainNode | null = null
  let noiseSource: AudioBufferSourceNode | null = null
  let noiseGain: GainNode | null = null
  let noiseLfo: OscillatorNode | null = null
  let noiseLfoGain: GainNode | null = null
  let birdOsc: OscillatorNode | null = null
  let birdGain: GainNode | null = null
  let windSource: AudioBufferSourceNode | null = null
  let windGain: GainNode | null = null
  let windLfo: OscillatorNode | null = null
  let windLfoGain: GainNode | null = null
  let masterVol: GainNode | null = null
  let audioCtxRef: AudioContext | null = null
  let barkTimeoutId: ReturnType<typeof setTimeout> | null = null

  // --- Particle state ---
  const particles: Particle[] = []
  const MAX_PARTICLES = 80

  // --- Click interaction state ---
  let clickBoost = 0         // current boost (0 to 0.3)
  let presenceMeter = 1.0    // refills slowly, depletes on click
  const ripples: Ripple[] = []

  // --- Doomsday flash state ---
  let midnightFlash = 0      // brightness flash at midnight strike
  let lastCheckedMinute = -1

  // Navigation portal
  const navPoints = [
    { label: '\u263E the clock tower', room: 'clocktower', xFrac: 0.5, yFrac: 0.95 },
  ]

  function getHourVividness(hour: number): number {
    // Midnight (0) = 1.0, Noon (12) = 0.1, scales sinusoidally
    return 0.1 + 0.9 * ((Math.cos(hour / 12 * Math.PI) + 1) / 2)
  }

  // --- Audio ---
  function createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
    const sampleRate = ctx.sampleRate
    const length = sampleRate * duration
    const buffer = ctx.createBuffer(1, length, sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1
    }
    return buffer
  }

  async function initAudio() {
    if (audioInitialized) return
    audioInitialized = true
    try {
      const ac = await getAudioContext()
      const dest = getAudioDestination()
      audioCtxRef = ac

      // Master volume for this room
      masterVol = ac.createGain()
      masterVol.gain.value = 0
      masterVol.connect(dest)

      // --- Base drone oscillator ---
      droneOsc = ac.createOscillator()
      droneOsc.type = 'sine'
      droneOsc.frequency.value = 65 // will be updated per frame
      droneGain = ac.createGain()
      droneGain.gain.value = 0.06
      droneOsc.connect(droneGain)
      droneGain.connect(masterVol)
      droneOsc.start()

      // --- Cricket noise (filtered noise modulated by LFO) ---
      const noiseBuf = createNoiseBuffer(ac, 4)
      noiseSource = ac.createBufferSource()
      noiseSource.buffer = noiseBuf
      noiseSource.loop = true
      const noiseFilter = ac.createBiquadFilter()
      noiseFilter.type = 'bandpass'
      noiseFilter.frequency.value = 4000
      noiseFilter.Q.value = 8
      noiseGain = ac.createGain()
      noiseGain.gain.value = 0 // controlled dynamically
      noiseLfo = ac.createOscillator()
      noiseLfo.frequency.value = 4 // cricket chirp rate
      noiseLfoGain = ac.createGain()
      noiseLfoGain.gain.value = 0.015
      noiseLfo.connect(noiseLfoGain)
      noiseLfoGain.connect(noiseGain.gain)
      noiseSource.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(masterVol)
      noiseSource.start()
      noiseLfo.start()

      // --- Bird-like tones (high sine with pitch sweep) ---
      birdOsc = ac.createOscillator()
      birdOsc.type = 'sine'
      birdOsc.frequency.value = 2000
      birdGain = ac.createGain()
      birdGain.gain.value = 0 // controlled dynamically
      birdOsc.connect(birdGain)
      birdGain.connect(masterVol)
      birdOsc.start()

      // --- Wind sound (slow-modulated filtered noise) ---
      const windBuf = createNoiseBuffer(ac, 4)
      windSource = ac.createBufferSource()
      windSource.buffer = windBuf
      windSource.loop = true
      const windFilter = ac.createBiquadFilter()
      windFilter.type = 'lowpass'
      windFilter.frequency.value = 800
      windFilter.Q.value = 1
      windGain = ac.createGain()
      windGain.gain.value = 0
      windLfo = ac.createOscillator()
      windLfo.frequency.value = 0.15
      windLfoGain = ac.createGain()
      windLfoGain.gain.value = 0.02
      windLfo.connect(windLfoGain)
      windLfoGain.connect(windGain.gain)
      windSource.connect(windFilter)
      windFilter.connect(windGain)
      windGain.connect(masterVol)
      windSource.start()
      windLfo.start()

    } catch (_) {
      // Audio init can fail silently
    }
  }

  function scheduleBark() {
    if (!active || !audioCtxRef || !masterVol) return
    const delay = 30000 + Math.random() * 30000 // 30-60s
    barkTimeoutId = setTimeout(() => {
      if (!active || !audioCtxRef || !masterVol) return
      const now = new Date()
      const hour = now.getHours()
      // Only bark during midnight hours (22-02)
      if (hour >= 22 || hour <= 2) {
        const ac = audioCtxRef
        const bark = ac.createOscillator()
        bark.type = 'sawtooth'
        bark.frequency.value = 150 + Math.random() * 50
        const barkEnv = ac.createGain()
        barkEnv.gain.setValueAtTime(0, ac.currentTime)
        barkEnv.gain.linearRampToValueAtTime(0.02, ac.currentTime + 0.02)
        barkEnv.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3)
        const barkFilter = ac.createBiquadFilter()
        barkFilter.type = 'bandpass'
        barkFilter.frequency.value = 300
        barkFilter.Q.value = 2
        bark.connect(barkFilter)
        barkFilter.connect(barkEnv)
        barkEnv.connect(masterVol)
        bark.start(ac.currentTime)
        bark.stop(ac.currentTime + 0.4)
      }
      scheduleBark()
    }, delay)
  }

  function updateAudio(hour: number, vividness: number) {
    if (!audioCtxRef || !masterVol) return
    const ac = audioCtxRef
    const t = ac.currentTime

    // Master volume scales with vividness
    masterVol.gain.setTargetAtTime(vividness * 0.5, t, 0.5)

    // Drone frequency: midnight ~65Hz (low C), noon ~262Hz (middle C)
    if (droneOsc) {
      const freq = 65 + (1 - vividness) * 197
      droneOsc.frequency.setTargetAtTime(freq, t, 0.5)
    }

    // Cricket noise: midnight hours (22-02) only
    if (noiseGain) {
      const isMidnightHours = hour >= 22 || hour <= 2
      const cricketVol = isMidnightHours ? 0.015 * vividness : 0
      noiseGain.gain.setTargetAtTime(cricketVol, t, 0.3)
    }

    // Bird tones: morning hours (05-08)
    if (birdOsc && birdGain) {
      const isMorning = hour >= 5 && hour <= 8
      if (isMorning) {
        // Subtle pitch sweeps
        const sweepPhase = Math.sin(time * 1.5) * 0.5 + 0.5
        birdOsc.frequency.setTargetAtTime(1800 + sweepPhase * 800, t, 0.1)
        birdGain.gain.setTargetAtTime(0.008 * vividness, t, 0.3)
      } else {
        birdGain.gain.setTargetAtTime(0, t, 0.3)
      }
    }

    // Wind: evening hours (18-21)
    if (windGain) {
      const isEvening = hour >= 18 && hour <= 21
      const windVol = isEvening ? 0.02 * vividness : 0
      windGain.gain.setTargetAtTime(windVol, t, 0.5)
    }

    // Day hours (09-17): everything very quiet, drone almost silent
    if (hour >= 9 && hour <= 17 && droneGain) {
      droneGain.gain.setTargetAtTime(0.01, t, 0.5)
    } else if (droneGain) {
      droneGain.gain.setTargetAtTime(0.06, t, 0.5)
    }
  }

  function stopAudio() {
    if (masterVol && audioCtxRef) {
      masterVol.gain.setTargetAtTime(0, audioCtxRef.currentTime, 0.3)
    }
    if (barkTimeoutId !== null) {
      clearTimeout(barkTimeoutId)
      barkTimeoutId = null
    }
  }

  function destroyAudio() {
    stopAudio()
    try {
      droneOsc?.stop()
      noiseSource?.stop()
      noiseLfo?.stop()
      birdOsc?.stop()
      windSource?.stop()
      windLfo?.stop()
    } catch (_) { /* already stopped */ }
    droneOsc = null
    droneGain = null
    noiseSource = null
    noiseGain = null
    noiseLfo = null
    noiseLfoGain = null
    birdOsc = null
    birdGain = null
    windSource = null
    windGain = null
    windLfo = null
    windLfoGain = null
    masterVol = null
    audioCtxRef = null
    audioInitialized = false
  }

  // --- Particles ---
  function spawnParticle(w: number, h: number) {
    if (particles.length >= MAX_PARTICLES) return
    particles.push({
      x: Math.random() * w,
      y: -2,
      vx: (Math.random() - 0.5) * 0.3,
      vy: 0.2 + Math.random() * 0.4,
      size: 0.5 + Math.random() * 1.5,
      alpha: 0.2 + Math.random() * 0.5,
    })
  }

  function updateParticles(w: number, h: number, vividness: number) {
    // Spawn rate scales with vividness
    if (vividness > 0.15 && Math.random() < vividness * 0.3) {
      spawnParticle(w, h)
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.x += p.vx + Math.sin(time * 0.5 + p.y * 0.01) * 0.15
      p.y += p.vy
      p.alpha -= 0.001

      if (p.y > h + 5 || p.alpha <= 0) {
        particles.splice(i, 1)
      }
    }
  }

  function drawParticles(c: CanvasRenderingContext2D, vividness: number) {
    if (vividness < 0.1) return
    for (const p of particles) {
      const glow = vividness > 0.7 ? 1.5 : 1
      const a = p.alpha * vividness * 0.4
      if (a < 0.01) continue

      // Faint glow around particle near midnight
      if (vividness > 0.6) {
        c.beginPath()
        c.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2)
        c.fillStyle = `rgba(180, 180, 220, ${a * 0.15})`
        c.fill()
      }

      c.beginPath()
      c.arc(p.x, p.y, p.size * glow, 0, Math.PI * 2)
      c.fillStyle = `rgba(200, 200, 240, ${a})`
      c.fill()
    }
  }

  // --- Click interaction ---
  function handleClick(e: MouseEvent) {
    if (!canvas || !active) return

    // Check portal navigation first
    if (deps?.switchTo) {
      for (let i = 0; i < navPoints.length; i++) {
        const nx = canvas.width * navPoints[i].xFrac
        const ny = canvas.height * navPoints[i].yFrac
        const dx = e.clientX - nx
        const dy = e.clientY - ny
        if (dx * dx + dy * dy < 600) {
          deps.switchTo(navPoints[i].room)
          return
        }
      }
    }

    // Click-to-illuminate
    if (presenceMeter >= 0.2) {
      clickBoost = Math.min(clickBoost + 0.3, 0.4)
      presenceMeter = Math.max(0, presenceMeter - 0.25)

      // Add ripple
      ripples.push({
        x: e.clientX,
        y: e.clientY,
        radius: 0,
        alpha: 0.3,
      })
    }
  }

  function updateClickState() {
    // Decay click boost
    if (clickBoost > 0) {
      clickBoost = Math.max(0, clickBoost - 0.016 / 3) // ~3s fade
    }

    // Refill presence meter slowly
    if (presenceMeter < 1) {
      presenceMeter = Math.min(1, presenceMeter + 0.016 / 8) // ~8s to refill
    }

    // Update ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i]
      r.radius += 1.5
      r.alpha -= 0.005
      if (r.alpha <= 0) {
        ripples.splice(i, 1)
      }
    }
  }

  function drawRipples(c: CanvasRenderingContext2D) {
    for (const r of ripples) {
      c.beginPath()
      c.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
      c.strokeStyle = `rgba(200, 190, 240, ${r.alpha})`
      c.lineWidth = 1
      c.stroke()
    }
  }

  // --- Doomsday clock ---
  function checkMidnightStrike() {
    const now = new Date()
    const minute = now.getMinutes()
    if (now.getHours() === 0 && minute === 0 && lastCheckedMinute !== 0) {
      midnightFlash = 1.0
    }
    lastCheckedMinute = minute
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height
    const now = new Date()
    const hour = now.getHours()
    const baseVividness = getHourVividness(hour)
    const vividness = Math.min(1, baseVividness + clickBoost + midnightFlash * 0.5)

    // Decay midnight flash
    if (midnightFlash > 0) {
      midnightFlash = Math.max(0, midnightFlash - 0.008) // ~2s flash
    }

    // Update subsystems
    updateClickState()
    checkMidnightStrike()
    updateParticles(w, h, vividness)
    updateAudio(hour, vividness)

    ctx.clearRect(0, 0, w, h)

    // Background — deeper at midnight, washed out at noon
    // Midnight flash briefly brightens the room
    const flashAdd = midnightFlash * 20
    const bgDark = Math.floor(5 * vividness + flashAdd)
    const bgLight = Math.floor(3 + (1 - vividness) * 15 + flashAdd * 0.3)
    ctx.fillStyle = `rgb(${Math.min(255, bgLight)}, ${Math.min(255, bgLight)}, ${Math.min(255, bgDark + bgLight)})`
    ctx.fillRect(0, 0, w, h)

    // Stars (more visible at night)
    if (vividness > 0.3) {
      for (let i = 0; i < 60; i++) {
        const sx = (Math.sin(i * 83.7) * 0.5 + 0.5) * w
        const sy = (Math.sin(i * 47.3) * 0.5 + 0.5) * h
        const brightness = vividness * (0.02 + Math.sin(time * 0.5 + i) * 0.01)
        ctx.beginPath()
        ctx.arc(sx, sy, 0.5 + vividness, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200, 200, 240, ${brightness})`
        ctx.fill()
      }
    }

    // Falling particles (moon dust)
    drawParticles(ctx, vividness)

    // Moon (midnight = high and bright, noon = invisible)
    if (vividness > 0.2) {
      const moonX = w * 0.75
      const moonY = h * 0.15
      ctx.beginPath()
      ctx.arc(moonX, moonY, 20, 0, Math.PI * 2)
      const moonGrad = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 25)
      moonGrad.addColorStop(0, `rgba(220, 220, 240, ${vividness * 0.15})`)
      moonGrad.addColorStop(1, 'rgba(220, 220, 240, 0)')
      ctx.fillStyle = moonGrad
      ctx.fill()
    }

    // Hour display
    ctx.font = '48px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 190, 220, ${vividness * 0.3})`
    ctx.textAlign = 'center'
    const hourStr = String(hour).padStart(2, '0') + ':00'
    ctx.fillText(hourStr, w / 2, h * 0.2)

    // --- Doomsday clock reference (22:00 - 01:00) ---
    if (hour >= 22 || hour <= 1) {
      const secondsInHour = now.getMinutes() * 60 + now.getSeconds()
      const doomAlpha = vividness * 0.12
      ctx.font = '10px monospace'
      ctx.fillStyle = `rgba(220, 180, 180, ${doomAlpha})`
      ctx.textAlign = 'center'
      ctx.fillText(`${85 - (secondsInHour % 85)}s to midnight`, w / 2, h * 0.25)
      // Faint subtitle
      ctx.font = '8px monospace'
      ctx.fillStyle = `rgba(220, 180, 180, ${doomAlpha * 0.5})`
      ctx.fillText('doomsday clock: 85 seconds', w / 2, h * 0.27)
    }

    // Poem
    const poem = HOURLY_POEMS[hour] || ''
    const lines = poem.split('\n')
    ctx.font = '16px "Cormorant Garamond", serif'
    ctx.textAlign = 'center'

    for (let i = 0; i < lines.length; i++) {
      const lineY = h * 0.35 + i * 30
      const line = lines[i]

      // Each character's visibility depends on vividness
      for (let j = 0; j < line.length; j++) {
        const charVividness = vividness * (0.6 + Math.sin(time * 0.3 + j * 0.2) * 0.4)
        if (charVividness < 0.15 && line[j] !== ' ') {
          // Too faded — show as underscore or nothing
          if (Math.random() < 0.3) continue
          ctx.fillStyle = `rgba(200, 190, 220, ${0.03})`
          ctx.fillText('_', w / 2 - (line.length * 4.5) + j * 9, lineY)
        } else {
          ctx.fillStyle = `rgba(200, 190, 220, ${charVividness * 0.5})`
          ctx.fillText(line[j], w / 2 - (line.length * 4.5) + j * 9, lineY)
        }
      }
    }

    // Ripples from clicks
    drawRipples(ctx)

    // Vividness meter
    ctx.font = '9px monospace'
    ctx.fillStyle = `rgba(200, 190, 220, ${vividness * 0.1})`
    ctx.textAlign = 'center'
    const meterChars = '\u2591\u2592\u2593\u2588'
    const meterLen = 20
    let meter = ''
    for (let i = 0; i < meterLen; i++) {
      const threshold = i / meterLen
      if (vividness > threshold) {
        meter += meterChars[Math.min(3, Math.floor((vividness - threshold) * 8))]
      } else {
        meter += '\u00B7'
      }
    }
    ctx.fillText(`presence: ${meter}`, w / 2, h * 0.7)

    // Presence / click meter (shows remaining click energy)
    if (presenceMeter < 0.99) {
      const pMeterLen = 10
      let pMeter = ''
      for (let i = 0; i < pMeterLen; i++) {
        pMeter += i / pMeterLen < presenceMeter ? '\u2588' : '\u00B7'
      }
      ctx.font = '8px monospace'
      ctx.fillStyle = `rgba(180, 180, 220, ${0.15})`
      ctx.fillText(`illuminate: ${pMeter}`, w / 2, h * 0.73)
    }

    // Hint about vividness
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 190, 220, ${vividness * 0.06})`
    ctx.fillText(
      vividness > 0.7
        ? 'the midnight hour. the room is most itself.'
        : vividness > 0.4
        ? 'the room is dimming. come back when the sun sets.'
        : 'barely here. the daylight dissolves this place. [click to illuminate]',
      w / 2, h * 0.8
    )

    // Title
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 190, 220, ${vividness * 0.08})`
    ctx.textAlign = 'center'
    ctx.fillText('the midnight', w / 2, 30)

    // Hour context
    ctx.font = '9px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 190, 220, ${vividness * 0.05})`
    ctx.fillText(
      `this room is ${Math.floor(vividness * 100)}% materialized at ${hourStr}`,
      w / 2, h - 15
    )

    // Navigation portals — moonlit passage
    if (deps?.switchTo) {
      for (let i = 0; i < navPoints.length; i++) {
        const np = navPoints[i]
        const nx = w * np.xFrac
        const ny = h * np.yFrac
        const hovered = hoveredNav === i
        const a = hovered ? 0.3 * vividness + 0.1 : 0.05 * vividness + 0.02
        ctx.font = '9px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(200, 190, 220, ${a})`
        ctx.textAlign = 'center'
        ctx.fillText(np.label, nx, ny)
        if (hovered) {
          ctx.fillStyle = `rgba(200, 190, 220, ${0.08 * vividness})`
          ctx.beginPath()
          ctx.arc(nx, ny + 6, 3, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
  }

  return {
    name: 'midnight',
    label: 'the midnight',
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

      // Click handler (portals + illuminate)
      canvas.addEventListener('click', handleClick)

      canvas.addEventListener('mousemove', (e) => {
        if (!deps?.switchTo || !canvas) return
        hoveredNav = -1
        for (let i = 0; i < navPoints.length; i++) {
          const nx = canvas.width * navPoints[i].xFrac
          const ny = canvas.height * navPoints[i].yFrac
          const dx = e.clientX - nx
          const dy = e.clientY - ny
          if (dx * dx + dy * dy < 600) {
            hoveredNav = i
            break
          }
        }
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

    async activate() {
      active = true
      await initAudio()
      scheduleBark()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      stopAudio()
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      destroyAudio()
      overlay?.remove()
    },
  }
}
