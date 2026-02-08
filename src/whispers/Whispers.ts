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

  // Feb 2026 — neuroscience of memory drift
  "the same memory never activates the same neurons twice",
  "memories drift between neurons like nomads",
  "your brain stores nothing in the same place twice",
  "excitable neurons hold memories longer. calm ones let go.",
  "accelerated forgetting: when the mind drops everything after thirty minutes",

  // Feb 2026 — cultural moment
  "2026 is the new 2016. everyone is remembering the last time they forgot.",
  "nostalgia for the time before the feeds curated us",
  "the last moment of shared culture was a decade ago",
  "we chose to forget so we could begin again",

  // Feb 2026 — environmental memory loss
  "half of all lakes have forgotten their shores",
  "the glaciers remember shapes the mountains have forgotten",
  "aquifers drain in silence. no one hears water leave.",
  "the colorado river no longer reaches the sea",

  // Feb 2026 — cosmic observation
  "a dying star sheds its memories in concentric rings",
  "the helix nebula: the eye of god, slowly closing",
  "strange red dots in deep space are black holes hiding in plain sight",

  // Thread trail — self-aware house
  "red threads stretch between the rooms you've visited",
  "the house is weaving itself from your path",
  "every door you open leaves a thread behind",

  // Art references — Feb 2026 exhibitions
  "chiharu shiota wraps the world in red thread. connection as art.",
  "iñárritu found a million feet of film he forgot to use",
  "tracey emin calls it a second life. what do you call yours?",

  // Feb 2026 — dark matter map (JWST COSMOS-Web, Feb 3)
  "the universe remembers its invisible architecture",
  "dark matter filaments: the scaffold everything visible grew on",
  "galaxies formed along threads they could never see",
  "voids in the dark matter map — places where nothing chose to be",
  "the clearest picture of dark matter looks like a neural network",

  // Feb 2026 — gravitational wave GW250114
  "two black holes collided and spacetime rang like a bell",
  "GW250114: the clearest gravitational wave ever heard",
  "when massive things die, the universe hums for a moment",
  "black hole spectroscopy: reading the tones of oblivion",

  // Feb 2026 — coral reef collapse
  "84% of earth's coral reefs are bleaching. memory made of calcium, dissolving.",
  "in the chagos archipelago, 95% of the reef is dead",
  "2026 may be the year the reefs finally collapse",
  "coral grows one centimeter per year and dies in one summer",

  // Feb 2026 — Alzheimer's jumbled replay
  "in alzheimer's, the brain still replays memories at night — but scrambled",
  "a broken projector still spinning, showing nothing recognizable",
  "there is an enzyme that tags dying memories for removal. the garbage man.",
  "memory loss begins years before anyone notices. invisible corruption.",

  // Feb 2026 — Project Hail Mary
  "he woke alone in space with no memory of how he got there",
  "identity is the last thing memory surrenders",

  // Feb 2026 — Sydney Biennale "Rememory"
  "rememory: toni morrison's word for when trauma recalls itself",
  "83 artists from 37 countries, all trying to remember what was erased",
  "first nations artists reconstructing what colonizers tried to delete",

  // Room afterimage — the house bleeds
  "you carry traces of every room you've been in",
  "the furnace left embers in your vision. the tide pool left ripples.",
  "rooms bleed into each other like memories bleed into consciousness",
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
