/**
 * CIRCADIAN VOID — the void breathes with the Earth
 *
 * The particle cosmos responds to your local time of day and the
 * current moon phase. At 3am the void is deep indigo, slow, heavy.
 * At golden hour the particles warm and drift lazily. At noon they're
 * brightest, most active. The moon phase modulates the overall energy
 * — full moon means restless particles, new moon means stillness.
 *
 * This means the void feels different every time you visit. 2am Oubli
 * is not the same as 2pm Oubli. Tuesday's Oubli during a waning
 * crescent is not Wednesday's during a waxing gibbous.
 *
 * The system displays a tiny indicator: current time + moon phase
 * symbol, very faint, in the top-left corner. The symbol itself
 * slowly drifts as if affected by the same forces as the particles.
 *
 * Inspired by: Circadian rhythms, tidal forces, James Turrell's
 * skyspaces, the way cities change personality at different hours
 */

interface CircadianState {
  hour: number          // 0-23
  sunPosition: number   // 0-1, 0 = midnight, 0.5 = noon
  moonPhase: number     // 0-1, 0 = new moon, 0.5 = full moon
  moonSymbol: string
  warmth: number        // color temperature shift
  energy: number        // particle activity multiplier
  bloomStrength: number // post-processing bloom
  fogDensity: number    // depth fog
}

// Moon phase symbols
const MOON_SYMBOLS = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘']

export class CircadianVoid {
  private state: CircadianState
  private indicator: HTMLDivElement
  private updateInterval: number

  constructor() {
    this.state = this.computeState()

    // Create tiny indicator in top-left
    this.indicator = document.createElement('div')
    this.indicator.style.cssText = `
      position: fixed; top: 16px; left: 16px;
      z-index: 90; pointer-events: none;
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300; font-size: 13px;
      letter-spacing: 1px;
      transition: color 30s ease, opacity 30s ease;
    `
    document.body.appendChild(this.indicator)

    this.renderIndicator()

    // Update every 60 seconds
    this.updateInterval = window.setInterval(() => {
      this.state = this.computeState()
      this.renderIndicator()
    }, 60000)
  }

  private computeState(): CircadianState {
    const now = new Date()
    const hour = now.getHours()
    const minute = now.getMinutes()
    const hourFrac = hour + minute / 60

    // Sun position: 0 at midnight, peaks at 0.5 (noon)
    // Uses cosine for smooth day/night cycle
    const sunPosition = 0.5 - 0.5 * Math.cos((hourFrac / 24) * Math.PI * 2)

    // Moon phase calculation (Metonic cycle approximation)
    const moonPhase = this.calculateMoonPhase(now)

    // Moon symbol (8 phases)
    const moonIndex = Math.floor(moonPhase * 8) % 8
    const moonSymbol = MOON_SYMBOLS[moonIndex]

    // Color warmth: cool at night, warm at golden hours, neutral at noon
    let warmth: number
    if (hourFrac >= 5 && hourFrac <= 8) {
      // Dawn — warm gold
      warmth = 0.7 + (hourFrac - 5) / 3 * 0.3
    } else if (hourFrac >= 16 && hourFrac <= 20) {
      // Dusk — warm pink/orange
      warmth = 1.0 - (hourFrac - 16) / 4 * 0.7
    } else if (hourFrac >= 8 && hourFrac <= 16) {
      // Day — bright, slightly warm
      warmth = 0.5
    } else {
      // Night — cool blues
      warmth = 0.1 + Math.sin((hourFrac > 20 ? hourFrac - 24 : hourFrac) / 5 * Math.PI) * 0.1
    }

    // Energy: calm at night, active during day, modulated by moon
    const baseEnergy = 0.3 + sunPosition * 0.7
    const moonInfluence = 0.15 * (0.5 - Math.abs(moonPhase - 0.5)) * 2 // peaks at full moon
    const energy = Math.min(1, baseEnergy + moonInfluence)

    // Bloom: stronger at night (stars glow more in darkness)
    const bloomStrength = 0.8 + (1 - sunPosition) * 0.8

    // Fog: denser at night, lighter during day
    const fogDensity = 0.002 + (1 - sunPosition) * 0.001

    return {
      hour,
      sunPosition,
      moonPhase,
      moonSymbol,
      warmth,
      energy,
      bloomStrength,
      fogDensity,
    }
  }

  /**
   * Calculate moon phase using a simplified algorithm.
   * Returns 0-1 where 0 = new moon, 0.5 = full moon.
   */
  private calculateMoonPhase(date: Date): number {
    // Known new moon: January 6, 2000 18:14 UTC
    const knownNewMoon = new Date(Date.UTC(2000, 0, 6, 18, 14, 0))
    const lunarCycle = 29.53058867 // days

    const daysSinceKnown = (date.getTime() - knownNewMoon.getTime()) / (1000 * 60 * 60 * 24)
    const cyclePosition = (daysSinceKnown % lunarCycle) / lunarCycle

    // Normalize to 0-1
    return cyclePosition < 0 ? cyclePosition + 1 : cyclePosition
  }

  private renderIndicator() {
    const s = this.state
    const now = new Date()
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    // Color based on time of day
    const alpha = 0.15 + s.sunPosition * 0.1
    const hue = s.warmth > 0.5 ? 40 : 220  // gold for warm, blue for cool
    const sat = 40 + Math.abs(s.warmth - 0.5) * 80

    this.indicator.style.color = `hsla(${hue}, ${sat}%, 65%, ${alpha})`
    this.indicator.innerHTML = `
      <span style="font-size: 13px; vertical-align: middle;">${s.moonSymbol}</span>
      <span style="margin-left: 4px; opacity: 0.7;">${timeStr}</span>
    `
  }

  /** Get current circadian parameters for other systems to use */
  getState(): CircadianState {
    return { ...this.state }
  }

  /** Get warmth value (0=cold night, 1=warm golden hour) */
  getWarmth(): number {
    return this.state.warmth
  }

  /** Get energy multiplier (0.3=deep night, 1.0=active day+full moon) */
  getEnergy(): number {
    return this.state.energy
  }

  /** Get recommended bloom strength */
  getBloomStrength(): number {
    return this.state.bloomStrength
  }

  /** Get recommended fog density */
  getFogDensity(): number {
    return this.state.fogDensity
  }

  destroy() {
    clearInterval(this.updateInterval)
    this.indicator.remove()
  }
}
