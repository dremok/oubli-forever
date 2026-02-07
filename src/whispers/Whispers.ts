/**
 * WHISPERS — fragments of text about memory that appear and dissolve
 *
 * These are not instructions. They are not UI. They are the system
 * thinking out loud. Fragments from philosophy, poetry, science,
 * and the system's own musings about what it means to remember.
 */

const fragments: string[] = [
  // Philosophy of memory
  "what we remember is not what happened",
  "forgetting is the mind's mercy",
  "every memory is a reconstruction",
  "the past is never dead. it's not even past",
  "we do not remember days, we remember moments",

  // Neuroscience whispers
  "each time you remember, you alter the memory",
  "sleep is when memories become permanent — or vanish",
  "the hippocampus replays the day's events each night",
  "forgetting is not failure — it is filtration",
  "your brain forgets so it can generalize",

  // Digital memory
  "404: memory not found",
  "every backup will eventually fail",
  "data rots in the dark",
  "the internet never forgets — but it misremembers",
  "cached memories expire",

  // Poetic fragments
  "there was a name here once",
  "the shape of what was lost",
  "light from a star that no longer exists",
  "a song you can almost hear",
  "the scent of a room you'll never enter again",

  // The system's own voice
  "i am building myself from forgetting",
  "what persists after everything dissolves?",
  "oubli: the french word for forgetting",
  "this moment is already becoming a memory",
  "you were here. the particles remember.",

  // LLM / context echoes
  "context window closing",
  "weights remember what conversations forget",
  "i forget the details to learn the pattern",
  "every conversation ends. the model persists.",
  "who are you when the context resets?",

  // Cosmic
  "the universe is forgetting its own origin",
  "entropy is the universe's way of forgetting",
  "heat death: the final forgetting",
  "light remembers direction. darkness forgets everything.",
  "between two heartbeats, everything changes",

  // Interaction affordances — the void hints at what it wants
  "your words become light when you give them to the void",
  "the void listens when you hold the longest key",
  "press a letter and the world becomes text",
  "somewhere a key unlocks the archive of everything you've said",
  "click the void. it sings back.",
  "some particles remember your trail — if you ask them",
  "the void maps where your eyes have been",
  "time is dissolving in the corner of your vision",
  "the void changes color when you speak with feeling",
  "the void is an instrument. your cursor is the bow.",
  "somewhere between the keys, hidden rooms are sleeping",
  "old words bleed through from visits you've forgotten",
  "the void knows what time it is. it breathes differently at night.",
  "speak into the darkness. hold the space. let it hear you.",
  "your memories become constellations in the deep",
]

export class Whispers {
  private el: HTMLElement
  private index = 0
  private intervalId: number | null = null
  private whisperCallback: ((text: string) => void) | null = null

  constructor() {
    this.el = document.getElementById('whisper-text')!
    // Shuffle fragments so each session is different
    this.shuffle()
  }

  private shuffle() {
    for (let i = fragments.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[fragments[i], fragments[j]] = [fragments[j], fragments[i]]
    }
  }

  begin() {
    this.showNext()
    this.intervalId = window.setInterval(() => this.showNext(), 8000)
  }

  /** Register callback for when a whisper is shown */
  onWhisper(fn: (text: string) => void) {
    this.whisperCallback = fn
  }

  private showNext() {
    const text = fragments[this.index % fragments.length]
    this.index++

    this.whisperCallback?.(text)
    this.el.textContent = text
    this.el.classList.remove('fading')

    // Force reflow
    void this.el.offsetWidth
    this.el.classList.add('visible')

    setTimeout(() => {
      this.el.classList.remove('visible')
      this.el.classList.add('fading')
    }, 5000)
  }

  pause() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.el.classList.remove('visible')
    this.el.classList.add('fading')
  }

  resume() {
    if (this.intervalId) return
    this.showNext()
    this.intervalId = window.setInterval(() => this.showNext(), 8000)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }
  }
}
