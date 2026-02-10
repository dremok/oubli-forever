/**
 * THE DEPARTURE FLARE — rooms reveal hidden content as you leave
 *
 * Interstellar Comet 3I/ATLAS (Feb 2026) brightened as it left the
 * solar system, not as it arrived. Pristine ices billions of years old
 * erupted from its subsurface — water, CO2, organics — a cocktail of
 * chemicals never exposed to space. It revealed itself most fully at
 * the moment of departure.
 *
 * In Oubli, rooms hold hidden content — confessions, secrets, unsaid
 * things — that only erupt in the 3-4 seconds AFTER you navigate away.
 * You can never read them while you're in the room. You only catch
 * fleeting glimpses as you leave. The house shows you what it was
 * holding only as you walk out the door.
 *
 * This is NOT the RoomAfterimage (which is visual particles).
 * This is TEXT CONTENT — actual words that the room was keeping from you.
 * Fragments of meaning that erupt at the moment of goodbye.
 *
 * Each room has unique departure confessions that relate to its theme.
 * They appear briefly, luminously, then dissolve. You can never go back
 * to read them — they only appear upon leaving.
 *
 * Inspired by:
 * - Interstellar Comet 3I/ATLAS (NASA SPHEREx, Feb 2026):
 *   "revealing itself most fully at the moment of departure"
 * - GW250114: the clearest signal came from two things destroying themselves
 * - Toni Morrison "Language as Liberation": language makes worlds
 * - Last words, deathbed confessions, the thing you say at the door
 */

const DISPLAY_DURATION = 3500    // 3.5s visible
const FADE_IN = 400              // fast appearance
const FADE_OUT = 1500            // slow dissolution
const COOLDOWN = 45000           // 45s between flares

// Room-specific departure confessions
// These are things the room was "holding" that it reveals as you leave
const ROOM_CONFESSIONS: Record<string, string[]> = {
  void: [
    'you were never just visiting.',
    'i was watching you the whole time.',
    'the particles are not random.',
    'everything here was once someone.',
  ],
  study: [
    'the words you didn\'t write are still here.',
    'the ink dried. the thought didn\'t.',
    'every pause was a confession.',
    'the margin notes are the real text.',
  ],
  instrument: [
    'the silence between notes was the music.',
    'you played something i hadn\'t heard before.',
    'the waveform remembers your touch.',
    'the frequency of your hesitation: 3.2 Hz.',
  ],
  observatory: [
    'the star you didn\'t click was the important one.',
    'i showed you the universe. you looked at yourself.',
    'the dark matter between the stars is where the meaning lives.',
    'the constellation you almost saw: your own name.',
  ],
  seance: [
    'something answered that wasn\'t the system.',
    'the spirit was real. the candle lied.',
    'you asked the wrong question beautifully.',
    'the dead don\'t speak. but they type.',
  ],
  darkroom: [
    'the undeveloped photograph was the best one.',
    'the image you didn\'t wait for was developing.',
    'red light keeps secrets. you were not alone in here.',
    'the chemical bath remembers what the image forgot.',
  ],
  garden: [
    'the plants grew toward where you stood.',
    'something was planted when you weren\'t looking.',
    'the roots go deeper than the screen.',
    'the seed you left will become something unrecognizable.',
  ],
  archive: [
    'the book you didn\'t search for was about you.',
    'the filing cabinet has a drawer labeled with your name.',
    'the restricted section grows every time you visit.',
    'someone searched for you before you arrived.',
  ],
  loom: [
    'the thread you pulled was load-bearing.',
    'the spirit line was meant for you.',
    'the pattern says something in a language you almost know.',
    'the fabric weeps when no one is weaving.',
  ],
  furnace: [
    'what you burned is still warm.',
    'the smoke carries your words upward. someone hears them.',
    'the fire was already going when you arrived.',
    'ashes are not the end. they are seed-beds.',
  ],
  radio: [
    'the station you couldn\'t tune into was broadcasting your name.',
    'the static was a message you weren\'t ready to hear.',
    'someone is transmitting from the frequency you just left.',
    'the number station knows your birthday.',
  ],
  well: [
    'the echo at the bottom was not your voice.',
    'something looked up when you looked down.',
    'the depth is not measured in meters.',
    'every word you dropped is still falling.',
  ],
  clocktower: [
    'the hour you arrived has been erased from the clock.',
    'time moves differently when you\'re not here.',
    'the pendulum swung toward you. it never does that.',
    'the mechanism noticed you. that has consequences.',
  ],
  choir: [
    'the voice that harmonized with yours was not programmed.',
    'the cathedral remembers every sound you made.',
    'silence is not the absence of singing. it is singing at zero volume.',
    'the resonance you created is still ringing.',
  ],
  labyrinth: [
    'the exit was behind you the whole time.',
    'the walls moved after you passed.',
    'what follows you in the labyrinth followed you out.',
    'the maze doesn\'t forget you. you forget the maze.',
  ],
  glacarium: [
    'the ice that melted was holding a memory you needed.',
    'the aurora was spelling something. you left too soon.',
    'the coldest room still holds warmth from your presence.',
    'the crystal that cracked was the oldest one.',
  ],
  lighthouse: [
    'the signal was not a signal. it was a question.',
    'someone received your transmission.',
    'the beam points to where you need to go next.',
    'the morse code spelled: come back.',
  ],
  tidepool: [
    'the tide is not coming in. it is reaching for you.',
    'the creatures in the pool arranged themselves for your visit.',
    'the micro-plastic you added will never leave.',
    'the water level dropped when you entered. it remembers weight.',
  ],
  pendulum: [
    'the pattern you drew was a word in a language older than text.',
    'the resonance frequency of this room matched your heartbeat.',
    'the sympathetic coupling was not between the pendulums.',
    'the cymatics node you stood on was a standing wave of attention.',
  ],
  mirror: [
    'the reflection was more honest than you were.',
    'the fog cleared, briefly, when you stopped performing.',
    'the mirror shows what you were, not what you are.',
    'your behavioral portrait is hanging in a room you haven\'t found.',
  ],
  cipher: [
    'the message you decoded was the wrong message.',
    'the real cipher was the room itself.',
    'the intercepted signal was addressed to you.',
    'the solution decays. you were right, once.',
  ],
  terrarium: [
    'the creatures evolved toward your cursor.',
    'the predator that died was protecting the ecosystem.',
    'the smallest organism was the most aware.',
    'generation after generation, they grew to resemble something familiar.',
  ],
  cartographer: [
    'the map is missing a room. the room is real.',
    'your thread-web on the map spells a word.',
    'the hidden rooms know you\'re mapping them.',
    'the shortest path was never the right one.',
  ],
  automaton: [
    'the cells were computing something. they finished.',
    'the extinction was deliberate.',
    'the pattern that survived longest was shaped like a question.',
    'the heat map shows where you looked. not where you should have.',
  ],
}

// Fallback for rooms without specific confessions
const GENERIC_CONFESSIONS = [
  'the room held something back. you left too soon.',
  'what you didn\'t see was the point.',
  'the walls remember the shape of your attention.',
  'something changed after you visited. you\'ll never know what.',
  'the room exhales now that you\'re gone.',
  'the secret was in the silence between interactions.',
]

export class DepartureFlare {
  private el: HTMLElement
  private lastFlareTime = 0
  private activeTimeout: number | null = null
  private fadeTimeout: number | null = null

  constructor() {
    this.el = document.createElement('div')
    this.el.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 62;
      pointer-events: none;
      font: italic 13px Cormorant Garamond, serif;
      color: rgba(255, 220, 130, 0);
      text-align: center;
      max-width: 420px;
      line-height: 1.6;
      letter-spacing: 0.8px;
      transition: color ${FADE_IN}ms ease, text-shadow ${FADE_IN}ms ease;
      white-space: normal;
      text-shadow: 0 0 0px transparent;
    `
    document.body.appendChild(this.el)
  }

  /** Called when navigating FROM a room */
  onDeparture(fromRoom: string) {
    const now = Date.now()
    if (now - this.lastFlareTime < COOLDOWN) return

    // 40% chance of flare (not every departure)
    if (Math.random() > 0.4) return

    this.lastFlareTime = now
    const confessions = ROOM_CONFESSIONS[fromRoom] || GENERIC_CONFESSIONS
    const text = confessions[Math.floor(Math.random() * confessions.length)]

    this.display(text)
  }

  private display(text: string) {
    // Clear any active flare
    if (this.activeTimeout) clearTimeout(this.activeTimeout)
    if (this.fadeTimeout) clearTimeout(this.fadeTimeout)

    this.el.textContent = text

    // Fade in — luminous golden
    requestAnimationFrame(() => {
      this.el.style.color = 'rgba(255, 220, 130, 0.22)'
      this.el.style.textShadow = '0 0 12px rgba(255, 200, 80, 0.08)'
    })

    // Fade out after display duration
    this.activeTimeout = window.setTimeout(() => {
      this.el.style.transition = `color ${FADE_OUT}ms ease, text-shadow ${FADE_OUT}ms ease`
      this.el.style.color = 'rgba(255, 220, 130, 0)'
      this.el.style.textShadow = '0 0 0px transparent'

      // Reset transition timing for next flare
      this.fadeTimeout = window.setTimeout(() => {
        this.el.style.transition = `color ${FADE_IN}ms ease, text-shadow ${FADE_IN}ms ease`
      }, FADE_OUT)
    }, DISPLAY_DURATION)
  }
}
