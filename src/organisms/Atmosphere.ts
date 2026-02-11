/**
 * ATMOSPHERE — room-specific visual textures
 *
 * Each room cluster has a unique AI-generated background texture
 * (created with FAL.ai SDXL) that provides subtle atmospheric
 * differentiation. Water rooms feel underwater. Fire rooms glow
 * with embers. Spirit rooms have ethereal mist.
 *
 * The textures are extremely subtle — low opacity, blended with
 * the dark background. They crossfade when navigating between
 * room clusters. The effect is subliminal: you feel the difference
 * before you see it.
 *
 * 6 texture clusters:
 * - void: cosmic dust, purple-gold particles
 * - water: bioluminescent deep ocean
 * - fire: cooling embers on obsidian
 * - nature: mycelium spores on forest floor
 * - spirit: séance smoke, violet mist
 * - time: oxidized clockwork brass dust
 *
 * Inspired by:
 * - James Turrell: light as material substance
 * - Dark matter cosmic web: invisible structure shaping experience
 * - Olafur Eliasson: atmospheric interventions
 */

const TEXTURES: Record<string, string> = {
  void:   '/assets/textures/void.jpg',
  water:  '/assets/textures/water.jpg',
  fire:   '/assets/textures/fire.jpg',
  nature: '/assets/textures/nature.jpg',
  spirit: '/assets/textures/spirit.jpg',
  time:   '/assets/textures/time.jpg',
}

// Map rooms to texture clusters
const ROOM_CLUSTERS: Record<string, string> = {
  void:           'void',
  study:          'spirit',
  library:        'spirit',
  cipher:         'time',
  instrument:     'void',
  choir:          'spirit',
  radio:          'time',
  observatory:    'void',
  satellite:      'void',
  asteroids:      'void',
  seance:         'spirit',
  oracle:         'spirit',
  madeleine:      'spirit',
  rememory:       'spirit',
  garden:         'nature',
  terrarium:      'nature',
  tidepool:       'water',
  well:           'water',
  glacarium:      'water',
  furnace:        'fire',
  disintegration: 'fire',
  clocktower:     'time',
  datepaintings:  'time',
  darkroom:       'spirit',
  projection:     'fire',
  palimpsestgallery: 'nature',
  sketchpad:      'nature',
  loom:           'nature',
  automaton:      'time',
  seismograph:    'time',
  pendulum:       'time',
  weathervane:    'water',
  cartographer:   'void',
  labyrinth:      'spirit',
  archive:        'time',
  lighthouse:     'water',
  // Hidden rooms
  catacombs:      'fire',
  roots:          'nature',
  ossuary:        'fire',
  between:        'spirit',
  aquifer:        'water',
  midnight:       'time',
  mirror:         'spirit',
}

const FADE_DURATION = 2000   // 2s crossfade
const BASE_OPACITY = 0.15   // subtle but visible

export class Atmosphere {
  private el: HTMLElement
  private currentCluster = ''
  private images = new Map<string, HTMLImageElement>()
  private loaded = new Set<string>()

  constructor() {
    this.el = document.createElement('div')
    this.el.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: 1;
      pointer-events: none;
      opacity: 0;
      transition: opacity ${FADE_DURATION}ms ease;
      background-size: cover;
      background-position: center;
      mix-blend-mode: screen;
    `
    document.body.appendChild(this.el)

    // Preload all textures
    this.preload()
  }

  private preload() {
    for (const [cluster, url] of Object.entries(TEXTURES)) {
      const img = new Image()
      img.onload = () => {
        this.loaded.add(cluster)
        this.images.set(cluster, img)
        // If this cluster is the pending one, show it now
        if (cluster === this.currentCluster) {
          this.el.style.backgroundImage = `url(${url})`
          requestAnimationFrame(() => {
            this.el.style.opacity = String(BASE_OPACITY)
          })
        }
      }
      img.src = url
    }
  }

  /** Call when room changes */
  onRoomChange(room: string) {
    const cluster = ROOM_CLUSTERS[room] || 'void'
    if (cluster === this.currentCluster) return

    this.currentCluster = cluster

    if (!this.loaded.has(cluster)) {
      // Not loaded yet — hide
      this.el.style.opacity = '0'
      return
    }

    // Crossfade: fade out, swap image, fade in
    this.el.style.opacity = '0'

    setTimeout(() => {
      const url = TEXTURES[cluster]
      if (url) {
        this.el.style.backgroundImage = `url(${url})`
        requestAnimationFrame(() => {
          this.el.style.opacity = String(BASE_OPACITY)
        })
      }
    }, FADE_DURATION * 0.5) // swap at halfway point of fade
  }

  /** Get current cluster name */
  getCurrentCluster(): string {
    return this.currentCluster
  }
}
