/**
 * DRIFT ENGINE — consciousness moves between states
 *
 * Oubli doesn't have rooms with walls. It has drifts — states of
 * consciousness that the void shifts between organically. Like
 * falling asleep, or how a dream changes scenes without you noticing.
 *
 * Each drift reconfigures the same systems (particles, sound, color,
 * text) with different parameters. Transitions are slow interpolations
 * — you might not notice you've drifted until you're already there.
 *
 * Drifts can be triggered by:
 *   - Number keys (1-5) for explicit exploration
 *   - Long idle periods (the void drifts you somewhere)
 *   - Time of day (night drifts toward The Deep)
 *   - Emotional tone of words (tracked by ColorMemory)
 *
 * Inspired by: Hypnagogia, lucid dreaming, the way consciousness
 * shifts between waking states, deep meditation, ocean currents
 */

export interface DriftState {
  name: string
  label: string        // poetic name shown during transition
  // Particle parameters
  speedMultiplier: number
  sizeMultiplier: number
  gravityMultiplier: number
  hueShift: number     // rotate particle hue palette (0-1)
  saturation: number   // 0-1
  // Visual parameters
  bgColor: [number, number, number] // RGB 0-255
  bloomStrength: number
  fogDensity: number
  grainIntensity: number
  // Sound parameters
  droneFreqMultiplier: number
  droneFilterCutoff: number // Hz
  droneVolume: number
  // Atmosphere
  whisperSet: string   // which whisper theme to emphasize
}

const DRIFT_STATES: Record<string, DriftState> = {
  void: {
    name: 'void',
    label: 'the void',
    speedMultiplier: 1.0,
    sizeMultiplier: 1.0,
    gravityMultiplier: 1.0,
    hueShift: 0,
    saturation: 0.7,
    bgColor: [2, 1, 8],
    bloomStrength: 1.2,
    fogDensity: 0.002,
    grainIntensity: 0.08,
    droneFreqMultiplier: 1.0,
    droneFilterCutoff: 2000,
    droneVolume: 1.0,
    whisperSet: 'default',
  },

  deep: {
    name: 'deep',
    label: 'the deep',
    speedMultiplier: 0.3,
    sizeMultiplier: 2.0,
    gravityMultiplier: 0.4,
    hueShift: 0.55,    // shift toward blues/teals
    saturation: 0.5,
    bgColor: [1, 3, 18],
    bloomStrength: 0.6,
    fogDensity: 0.004,
    grainIntensity: 0.04,
    droneFreqMultiplier: 0.5,
    droneFilterCutoff: 800,
    droneVolume: 0.7,
    whisperSet: 'deep',
  },

  burn: {
    name: 'burn',
    label: 'the burn',
    speedMultiplier: 2.5,
    sizeMultiplier: 0.6,
    gravityMultiplier: 0.1,
    hueShift: 0.08,     // shift toward reds/oranges
    saturation: 0.9,
    bgColor: [12, 2, 1],
    bloomStrength: 2.0,
    fogDensity: 0.001,
    grainIntensity: 0.15,
    droneFreqMultiplier: 1.5,
    droneFilterCutoff: 4000,
    droneVolume: 1.3,
    whisperSet: 'burn',
  },

  garden: {
    name: 'garden',
    label: 'the garden',
    speedMultiplier: 0.7,
    sizeMultiplier: 1.3,
    gravityMultiplier: 2.0,
    hueShift: 0.3,      // shift toward greens/golds
    saturation: 0.6,
    bgColor: [2, 6, 3],
    bloomStrength: 1.0,
    fogDensity: 0.0015,
    grainIntensity: 0.05,
    droneFreqMultiplier: 1.2,
    droneFilterCutoff: 3000,
    droneVolume: 0.8,
    whisperSet: 'garden',
  },

  archive: {
    name: 'archive',
    label: 'the archive',
    speedMultiplier: 0.05,
    sizeMultiplier: 0.8,
    gravityMultiplier: 0.0,
    hueShift: 0,
    saturation: 0.1,
    bgColor: [3, 3, 5],
    bloomStrength: 0.3,
    fogDensity: 0.0005,
    grainIntensity: 0.02,
    droneFreqMultiplier: 0.25,
    droneFilterCutoff: 400,
    droneVolume: 0.3,
    whisperSet: 'archive',
  },
}

type DriftListener = (current: DriftState, progress: number) => void

// Edge zone size for click navigation
const EDGE_ZONE = 60

// Map screen edges to drifts
const EDGE_DRIFTS: { region: string; drift: string; label: string }[] = [
  { region: 'top', drift: 'burn', label: 'the burn' },
  { region: 'bottom', drift: 'deep', label: 'the deep' },
  { region: 'left', drift: 'garden', label: 'the garden' },
  { region: 'right', drift: 'archive', label: 'the archive' },
]

export class DriftEngine {
  private current: DriftState
  private target: DriftState
  private interpolated: DriftState
  private progress = 1.0 // 1 = fully arrived at target
  private transitionSpeed = 0.003 // very slow transitions
  private listeners: DriftListener[] = []
  private labelEl: HTMLDivElement
  private labelTimeout: number | null = null
  private frameId = 0
  private animating = false
  private typingCheck: (() => boolean) | null = null
  private edgeHints: HTMLDivElement[] = []
  private mouseX = 0
  private mouseY = 0

  constructor() {
    this.current = { ...DRIFT_STATES.void }
    this.target = { ...DRIFT_STATES.void }
    this.interpolated = { ...DRIFT_STATES.void }

    // Transition label — shows drift name during transitions
    this.labelEl = document.createElement('div')
    this.labelEl.style.cssText = `
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 500; pointer-events: none;
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300; font-size: 28px;
      letter-spacing: 6px; text-transform: lowercase;
      opacity: 0;
      transition: opacity 3s ease;
      text-shadow: 0 0 30px currentColor;
    `
    document.body.appendChild(this.labelEl)

    this.createEdgeHints()
    this.bindEvents()
    this.startLoop()
  }

  /** Set a function that returns true when the user is actively typing */
  setTypingCheck(check: () => boolean) {
    this.typingCheck = check
  }

  private createEdgeHints() {
    const positions: Record<string, string> = {
      top: 'top: 8px; left: 50%; transform: translateX(-50%);',
      bottom: 'bottom: 8px; left: 50%; transform: translateX(-50%);',
      left: 'left: 8px; top: 50%; transform: translateY(-50%);',
      right: 'right: 8px; top: 50%; transform: translateY(-50%);',
    }

    for (const edge of EDGE_DRIFTS) {
      const hint = document.createElement('div')
      hint.style.cssText = `
        position: fixed; ${positions[edge.region]}
        z-index: 80; pointer-events: none;
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 10px;
        letter-spacing: 2px; text-transform: lowercase;
        color: rgba(255, 20, 147, 0.0);
        transition: color 1.5s ease;
      `
      hint.textContent = edge.label
      document.body.appendChild(hint)
      this.edgeHints.push(hint)
    }
  }

  private bindEvents() {
    // Keyboard shortcuts (only when not typing)
    window.addEventListener('keydown', (e) => {
      if (document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA') return
      if (this.typingCheck?.()) return

      switch (e.key) {
        case '1': this.driftTo('void'); break
        case '2': this.driftTo('deep'); break
        case '3': this.driftTo('burn'); break
        case '4': this.driftTo('garden'); break
        case '5': this.driftTo('archive'); break
      }
    })

    // Track mouse for edge hints
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX
      this.mouseY = e.clientY
      this.updateEdgeHints()
    })

    // Click near edges to drift
    window.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' ||
          target.tagName === 'A' || target.closest('[data-no-resonance]')) return

      const w = window.innerWidth
      const h = window.innerHeight
      const x = e.clientX
      const y = e.clientY

      // Check if click is in an edge zone
      if (y < EDGE_ZONE) {
        this.driftTo('burn')
      } else if (y > h - EDGE_ZONE) {
        this.driftTo('deep')
      } else if (x < EDGE_ZONE) {
        this.driftTo('garden')
      } else if (x > w - EDGE_ZONE) {
        this.driftTo('archive')
      }
      // Clicking center doesn't change drift — that's for the resonance map
    })

    // Double-click center to return to void
    window.addEventListener('dblclick', (e) => {
      const w = window.innerWidth
      const h = window.innerHeight
      const x = e.clientX
      const y = e.clientY

      // Only if not in an edge zone
      if (x > EDGE_ZONE && x < w - EDGE_ZONE &&
          y > EDGE_ZONE && y < h - EDGE_ZONE) {
        this.driftTo('void')
      }
    })
  }

  private updateEdgeHints() {
    const w = window.innerWidth
    const h = window.innerHeight

    for (let i = 0; i < EDGE_DRIFTS.length; i++) {
      const edge = EDGE_DRIFTS[i]
      const hint = this.edgeHints[i]
      let nearEdge = false

      switch (edge.region) {
        case 'top': nearEdge = this.mouseY < EDGE_ZONE * 1.5; break
        case 'bottom': nearEdge = this.mouseY > h - EDGE_ZONE * 1.5; break
        case 'left': nearEdge = this.mouseX < EDGE_ZONE * 1.5; break
        case 'right': nearEdge = this.mouseX > w - EDGE_ZONE * 1.5; break
      }

      // Don't show hint for current drift
      const isCurrent = this.target.name === edge.drift
      const alpha = nearEdge && !isCurrent ? 0.2 : 0.0

      hint.style.color = `rgba(255, 20, 147, ${alpha})`
    }
  }

  /** Initiate a drift to a named state */
  driftTo(name: string) {
    const state = DRIFT_STATES[name]
    if (!state) return
    if (this.target.name === name && this.progress > 0.9) return // already there

    this.current = { ...this.interpolated }
    this.target = { ...state }
    this.progress = 0

    // Show label
    this.showLabel(state.label, state)
  }

  private showLabel(text: string, state: DriftState) {
    const [r, g, b] = state.bgColor
    // Use a contrasting color
    const brightness = (r + g + b) / 3
    const color = brightness > 10
      ? 'rgba(255, 215, 0, 0.4)'
      : 'rgba(255, 20, 147, 0.3)'

    this.labelEl.style.color = color
    this.labelEl.textContent = text
    this.labelEl.style.opacity = '1'

    if (this.labelTimeout) clearTimeout(this.labelTimeout)
    this.labelTimeout = window.setTimeout(() => {
      this.labelEl.style.opacity = '0'
    }, 4000)
  }

  private startLoop() {
    if (this.animating) return
    this.animating = true

    const animate = () => {
      this.frameId = requestAnimationFrame(animate)
      this.update()
    }
    animate()
  }

  private update() {
    if (this.progress >= 1) return

    this.progress = Math.min(1, this.progress + this.transitionSpeed)

    // Ease function — slow start and end
    const t = this.progress < 0.5
      ? 2 * this.progress * this.progress
      : 1 - Math.pow(-2 * this.progress + 2, 2) / 2

    // Interpolate all numeric parameters
    this.interpolated = {
      name: t > 0.5 ? this.target.name : this.current.name,
      label: this.target.label,
      speedMultiplier: this.lerp(this.current.speedMultiplier, this.target.speedMultiplier, t),
      sizeMultiplier: this.lerp(this.current.sizeMultiplier, this.target.sizeMultiplier, t),
      gravityMultiplier: this.lerp(this.current.gravityMultiplier, this.target.gravityMultiplier, t),
      hueShift: this.lerp(this.current.hueShift, this.target.hueShift, t),
      saturation: this.lerp(this.current.saturation, this.target.saturation, t),
      bgColor: [
        Math.round(this.lerp(this.current.bgColor[0], this.target.bgColor[0], t)),
        Math.round(this.lerp(this.current.bgColor[1], this.target.bgColor[1], t)),
        Math.round(this.lerp(this.current.bgColor[2], this.target.bgColor[2], t)),
      ],
      bloomStrength: this.lerp(this.current.bloomStrength, this.target.bloomStrength, t),
      fogDensity: this.lerp(this.current.fogDensity, this.target.fogDensity, t),
      grainIntensity: this.lerp(this.current.grainIntensity, this.target.grainIntensity, t),
      droneFreqMultiplier: this.lerp(this.current.droneFreqMultiplier, this.target.droneFreqMultiplier, t),
      droneFilterCutoff: this.lerp(this.current.droneFilterCutoff, this.target.droneFilterCutoff, t),
      droneVolume: this.lerp(this.current.droneVolume, this.target.droneVolume, t),
      whisperSet: this.target.whisperSet,
    }

    // Notify listeners
    for (const fn of this.listeners) {
      fn(this.interpolated, this.progress)
    }
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
  }

  /** Subscribe to drift changes */
  onChange(fn: DriftListener) {
    this.listeners.push(fn)
  }

  /** Get the current interpolated state */
  getState(): DriftState {
    return { ...this.interpolated }
  }

  /** Get the name of the current target drift */
  getCurrentDrift(): string {
    return this.target.name
  }

  /** Check if a transition is in progress */
  isTransitioning(): boolean {
    return this.progress < 1
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
    this.labelEl.remove()
    if (this.labelTimeout) clearTimeout(this.labelTimeout)
  }
}
