/**
 * THE CATACOMBS — beneath the archive, bones of the old internet
 *
 * A hidden room accessible ONLY from The Archive. When you search for
 * certain URLs in the archive, a faint link appears: "descend deeper."
 * Clicking it takes you here.
 *
 * The Catacombs is a scrolling descent through layers of dead internet
 * history, rendered as carved stone inscriptions. Each layer goes deeper
 * in time — 2020s, 2010s, 2000s, 1990s — and the aesthetic degrades
 * with each era. The deepest layer is raw HTML source code from the
 * earliest web pages.
 *
 * The room auto-scrolls downward slowly. You can scroll faster. At the
 * bottom, there's nothing — just void. The descent is the experience.
 *
 * This room is NOT in the tab bar. It can only be reached through
 * The Archive, and you return to The Archive when you leave.
 *
 * Inspired by: Paris catacombs, geological strata, archaeological digs,
 * internet archaeology, the Deep Web metaphor, Dante's descent,
 * Western US snow drought of Feb 2026 — vanishing water memory
 */

import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface CatacombEntry {
  text: string
  style: 'inscription' | 'code' | 'url' | 'epitaph' | 'environmental'
  detail?: string // expanded detail text for clickable inscriptions
}

interface CatacombLayer {
  era: string
  depth: string
  color: string
  bgColor: string
  entries: CatacombEntry[]
}

const LAYERS: CatacombLayer[] = [
  {
    era: '2020s',
    depth: 'surface level',
    color: 'rgba(180, 160, 120, 0.5)',
    bgColor: 'rgba(20, 15, 10, 0.95)',
    entries: [
      { text: 'here lie the platforms that promised forever', style: 'epitaph' },
      {
        text: 'vine.co — 6-second loops, infinite replay, gone',
        style: 'inscription',
        detail: 'Vine hosted 200 million monthly users creating micro-art. Twitter bought it for $30M in 2012, killed it in 2017. The loops stopped but the echoes are everywhere — TikTok is Vine\'s ghost wearing new clothes.',
      },
      {
        text: 'Google Stadia — the future of gaming (2019-2023)',
        style: 'inscription',
        detail: 'Google promised the end of hardware. Play AAA games in a browser tab. The latency was real, the library was thin, the commitment was thinner. Shut down Jan 2023. All purchases refunded. The saves were not.',
      },
      {
        text: 'Clubhouse — every voice mattered, briefly',
        style: 'inscription',
        detail: 'In the pandemic\'s isolation, millions crowded into audio rooms to hear strangers speak. By the time they opened to everyone, everyone had left. Peak: 10M weekly users. Now: a whisper.',
      },
      {
        text: 'Quibi — $1.75 billion, 6 months',
        style: 'inscription',
        detail: 'Jeffrey Katzenberg and Meg Whitman raised $1.75 billion for "quick bites" — premium 10-minute shows for phones. Launched April 2020. Dead by December. The content was fine. The idea was wrong.',
      },
      { text: 'the social contract: we give you our data, you give us a place to exist', style: 'epitaph' },
      // Environmental inscriptions — water drought 2026
      {
        text: 'the Colorado River no longer reaches the sea',
        style: 'environmental',
        detail: 'For millennia the Colorado carved the Grand Canyon and fed the Sea of Cortez. Now it evaporates in the desert 90 miles from the ocean. The delta is dust. The river forgets its own mouth.',
      },
    ],
  },
  {
    era: '2010s',
    depth: 'first descent',
    color: 'rgba(160, 140, 100, 0.4)',
    bgColor: 'rgba(18, 12, 8, 0.95)',
    entries: [
      { text: 'the age of aggregation. everything in one feed.', style: 'epitaph' },
      {
        text: 'reader.google.com — where we read before the algorithm decided for us',
        style: 'inscription',
        detail: 'Google Reader was the quiet center of the internet. RSS feeds, chronological, no algorithm. Google killed it in 2013 claiming declining usage. What declined was their interest in a product that didn\'t serve ads.',
      },
      {
        text: 'del.icio.us — social bookmarking, the original curation',
        style: 'inscription',
        detail: 'Before Pinterest, before pocket, before read-later apps — del.icio.us let you tag and share bookmarks. Acquired by Yahoo in 2005 for $15-30M. Yahoo did what Yahoo does: neglected it into oblivion.',
      },
      {
        text: 'StumbleUpon — serendipity as a service (2001-2018)',
        style: 'inscription',
        detail: 'A button that took you somewhere random and wonderful on the internet. 75 million users discovered things they never would have searched for. The algorithm killed serendipity. Pivoted to Mix. Mix died too.',
      },
      { text: 'Posterous — blog anywhere, gone everywhere', style: 'inscription' },
      { text: 'Path — the intimate social network, 150 friends max', style: 'inscription' },
      { text: 'every shutdown email began the same way: "we have made the difficult decision"', style: 'epitaph' },
      {
        text: 'Sierra Nevada snowpack: 30% of normal — the mountains forget how to hold water',
        style: 'environmental',
        detail: 'Feb 2026: the western US snowpack sits at record lows. Snow surveys measure what the mountains remember of winter. This year they remember almost nothing. The aquifers beneath draw down in silence.',
      },
    ],
  },
  {
    era: '2000s',
    depth: 'the middle depths',
    color: 'rgba(140, 120, 80, 0.35)',
    bgColor: 'rgba(15, 10, 6, 0.95)',
    entries: [
      { text: 'the web was still weird. that was the point.', style: 'epitaph' },
      {
        text: 'GeoCities — 38 million user pages, deleted in one afternoon (2009)',
        style: 'inscription',
        detail: 'GeoCities was the web\'s first neighborhood — Hollywood, Area51, Heartland. Yahoo bought it for $3.57 billion in 1999. Ten years later they deleted it. 38 million pages of human expression, gone. The Archive Team saved what they could. Most is still lost.',
      },
      {
        text: 'Friendster — the first social network, outlived by its successor\'s successor',
        style: 'inscription',
        detail: 'Friendster had 3 million users in its first three months (2003). Google offered $30M. They declined. MySpace ate their lunch. Facebook ate MySpace. Friendster pivoted to gaming in SE Asia. Shut down 2015.',
      },
      {
        text: 'Digg — front page of the internet, before Reddit took the name',
        style: 'inscription',
        detail: 'Digg v4 in 2010 destroyed everything users loved about the site in a single redesign. A third of traffic vanished in a month. The entire front page was once filled with links to Reddit as a protest. Bought for $500K in 2012. Was worth $200M in 2008.',
      },
      { text: 'Bebo — bought for $850M, sold for $1M', style: 'inscription' },
      { text: '<blink>YOU ARE VISITOR NUMBER 000847</blink>', style: 'code' },
      { text: 'http://www.hamsterdance.com', style: 'url' },
      { text: 'they called it Web 2.0 as if version numbers could contain the chaos', style: 'epitaph' },
      {
        text: 'Lake Mead\'s bathtub ring — 170 feet of memory bleached into limestone',
        style: 'environmental',
        detail: 'The white band around Lake Mead marks where water used to be. Each foot is a year of drought the stone remembers. Bodies, boats, and a World War II landing craft have surfaced as the water retreats. The lake is forgetting it was ever full.',
      },
    ],
  },
  {
    era: '1990s',
    depth: 'the deep strata',
    color: 'rgba(120, 100, 60, 0.3)',
    bgColor: 'rgba(12, 8, 4, 0.95)',
    entries: [
      { text: 'before the corporations. before the feeds. before the metrics.', style: 'epitaph' },
      {
        text: 'TheGlobe.com — first social network IPO, rose 606% day one, dead by 2001',
        style: 'inscription',
        detail: 'Two Cornell students built a homepage community. IPO\'d November 13, 1998. Shares jumped from $9 to $97 in hours — the largest first-day gain in history at the time. By 2001 it was delisted. The bubble taught us nothing.',
      },
      { text: 'Xoom.com — free web hosting, free email, free everything, free to disappear', style: 'inscription' },
      {
        text: 'SixDegrees.com — the original social network (1997-2001)',
        style: 'inscription',
        detail: 'Andrew Weinreich built the first site that let you list friends and see your network. Bought for $125M in 1999, shut down in 2001. He was 10 years too early. The idea was right. The bandwidth wasn\'t.',
      },
      { text: '<html><body bgcolor="#000000"><font color="#00ff00">', style: 'code' },
      { text: '<marquee>WELCOME TO MY HOMEPAGE</marquee>', style: 'code' },
      { text: '<img src="under_construction.gif">', style: 'code' },
      { text: '<a href="mailto:webmaster@angelfire.com">email the webmaster</a>', style: 'code' },
      { text: 'the web was a gift. we built cathedrals in our bedrooms.', style: 'epitaph' },
      {
        text: 'glaciers forgetting their shape — retreating into forms they haven\'t worn in 10,000 years',
        style: 'environmental',
        detail: 'The glaciers of the Cascades and Sierra Nevada are losing mass faster than at any point in recorded history. Some have already disappeared. The ice holds air from centuries past — when it melts, those atmospheres are released and lost forever.',
      },
    ],
  },
  {
    era: 'before',
    depth: 'bedrock',
    color: 'rgba(100, 80, 40, 0.2)',
    bgColor: 'rgba(8, 5, 2, 0.95)',
    entries: [
      { text: 'before the web there was the dream of the web', style: 'epitaph' },
      {
        text: 'Usenet, 1980 — the first social network was text-only',
        style: 'inscription',
        detail: 'Before the web, before graphics, there were newsgroups. Text flowing between university servers. alt.folklore.urban, rec.arts.sf, comp.lang.c. The conversations are still archived. The people who wrote them have mostly forgotten they did.',
      },
      { text: 'BBS — you called a phone number to enter a world', style: 'inscription' },
      { text: 'Gopher — the internet that almost was', style: 'inscription' },
      {
        text: 'ARPANET Message #1: "LO" (tried to type LOGIN, crashed after two letters)',
        style: 'inscription',
        detail: 'October 29, 1969. UCLA to Stanford. Charley Kline typed "L", then "O" — and the system crashed. The first message sent across the internet was an accident: LO. As in "lo and behold." The network remembered everything after that. Until it started forgetting.',
      },
      { text: '...', style: 'epitaph' },
      { text: '', style: 'epitaph' },
      { text: '', style: 'epitaph' },
      { text: 'there is nothing below this.', style: 'epitaph' },
      { text: '', style: 'epitaph' },
      { text: '', style: 'epitaph' },
      { text: 'or is there?', style: 'epitaph' },
      { text: '', style: 'epitaph' },
      // Nihilist penguin — Feb 2026's defining meme
      {
        text: '🐧 ← he walked toward the mountain. he never came back.',
        style: 'environmental',
        detail: 'Feb 2026: a clip from Werner Herzog\'s 2007 documentary — a penguin leaving its colony, walking alone toward certain death — became the year\'s defining meme. Paired with pipe organ music, it became a symbol of burnout, of the quiet dignity of walking away. BMW and Lidl adopted it. Millions shared it. The internet watched a penguin choose oblivion and saw itself.',
      },
      // See Memory documentary
      {
        text: '30,000 hand-painted frames of how memory forms and breaks',
        style: 'inscription',
        detail: 'Viviane Silvera\'s documentary "See Memory" (Feb 2026): 30,000 individually hand-painted frames visualizing how memory forms, fragments, and reshapes. Features Nobel laureate Eric Kandel and neuroscientist Daniela Schiller. Inspired by Oliver Sacks. It bridges neuroscience, trauma research, and visual art — literally painting the process of remembering.',
      },
      // Florence ad ban
      {
        text: 'florence cleared its renaissance walls of petrochemical advertising. 18 votes to 3.',
        style: 'environmental',
        detail: 'Feb 2026: Florence became the first Italian city to ban fossil fuel advertising. A collision of 500-year-old aesthetics and 21st-century climate politics. When you remove the noise of the present, older layers become visible.',
      },
    ],
  },
]

interface CatacombsDeps {
  onReturn: () => void
  onOssuary?: () => void
  switchTo?: (name: string) => void
  getMemories?: () => StoredMemory[]
}

// --- Dust particle type ---
interface DustMote {
  el: HTMLElement
  x: number
  y: number
  vx: number
  vy: number
  opacity: number
  life: number
  maxLife: number
}

export function createCatacombsRoom(deps: CatacombsDeps): Room {
  let overlay: HTMLElement | null = null
  let active = false
  let autoScrollId: number | null = null

  // --- Audio state ---
  let audioCtxRef: AudioContext | null = null
  let audioMaster: GainNode | null = null
  let droneOsc: OscillatorNode | null = null
  let droneGain: GainNode | null = null
  let droneFilter: BiquadFilterNode | null = null
  let dripTimeout: ReturnType<typeof setTimeout> | null = null
  let dripGain: GainNode | null = null
  let audioInitialized = false

  // --- Visual state ---
  let dustMotes: DustMote[] = []
  let dustContainer: HTMLElement | null = null
  let depthIndicator: HTMLElement | null = null
  let depthFill: HTMLElement | null = null
  let dustFrameId: number | null = null
  let torchElements: HTMLElement[] = []
  let layerSections: HTMLElement[] = []

  // --- Torch/light state ---
  let torchOverlay: HTMLElement | null = null
  let mouseX = 0
  let mouseY = 0
  let mouseMoveHandler: ((e: MouseEvent) => void) | null = null

  // --- Parallax state ---
  let parallaxLayers: HTMLElement[] = []

  // --- Memory integration state ---
  let memoryIntervalId: ReturnType<typeof setInterval> | null = null
  let injectedMemoryEls: HTMLElement[] = []

  // --- Clickable inscription state ---
  let expandedInscription: HTMLElement | null = null

  // --- Scroll tracking ---
  let lastScrollTop = 0
  let scrollSpeed = 0
  let lastLayerIndex = -1
  let scrollHandler: (() => void) | null = null

  // --- Audio helpers ---

  function getScrollFraction(): number {
    if (!overlay) return 0
    const max = overlay.scrollHeight - overlay.clientHeight
    if (max <= 0) return 0
    return Math.min(1, Math.max(0, overlay.scrollTop / max))
  }

  async function initAudio() {
    if (audioInitialized) return
    try {
      const ac = await getAudioContext()
      const dest = getAudioDestination()
      audioCtxRef = ac

      audioMaster = ac.createGain()
      audioMaster.gain.value = 0
      audioMaster.connect(dest)

      // Deep stone drone: sine oscillator through lowpass filter
      droneOsc = ac.createOscillator()
      droneOsc.type = 'sine'
      droneOsc.frequency.value = 55 // start ~middle of 40-60Hz range

      droneFilter = ac.createBiquadFilter()
      droneFilter.type = 'lowpass'
      droneFilter.frequency.value = 80
      droneFilter.Q.value = 1

      droneGain = ac.createGain()
      droneGain.gain.value = 0.02

      droneOsc.connect(droneFilter)
      droneFilter.connect(droneGain)
      droneGain.connect(audioMaster)
      droneOsc.start()

      // Drip gain node (shared by all drip sounds)
      dripGain = ac.createGain()
      dripGain.gain.value = 0.015 // base drip volume
      dripGain.connect(audioMaster)

      audioInitialized = true
      scheduleDrip()
    } catch { /* audio not available */ }
  }

  function scheduleDrip() {
    if (!active || !audioCtxRef || !audioMaster || !dripGain) return
    // 3-8 seconds between drips
    const delay = 3000 + Math.random() * 5000
    dripTimeout = setTimeout(() => {
      if (!active || !audioCtxRef || !audioMaster || !dripGain) return
      try {
        playDrip()
      } catch { /* ignore */ }
      scheduleDrip()
    }, delay)
  }

  function playDrip() {
    if (!audioCtxRef || !dripGain) return
    const ac = audioCtxRef
    // Short noise burst (2-5ms) through highpass at 2000Hz
    const dripLen = 0.002 + Math.random() * 0.003
    const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dripLen), ac.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      // Decaying noise burst
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    }
    const src = ac.createBufferSource()
    src.buffer = buf

    const hp = ac.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 2000 + Math.random() * 1000
    hp.Q.value = 2

    // Volume scales with scroll speed (0.01-0.03 base, up to 0.05 when scrolling fast)
    const speedBoost = Math.min(0.02, scrollSpeed * 0.002)
    const g = ac.createGain()
    g.gain.value = 0.01 + Math.random() * 0.02 + speedBoost

    src.connect(hp)
    hp.connect(g)
    g.connect(dripGain)
    src.start()
    src.onended = () => {
      src.disconnect()
      hp.disconnect()
      g.disconnect()
    }
  }

  function playLayerTransition() {
    if (!audioCtxRef || !audioMaster) return
    try {
      const ac = audioCtxRef
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = 75 + Math.random() * 10 // ~80Hz
      const g = ac.createGain()
      g.gain.value = 0.03
      // Quick fade over ~100ms
      g.gain.setTargetAtTime(0, ac.currentTime + 0.05, 0.03)
      osc.connect(g)
      g.connect(audioMaster)
      osc.start()
      osc.stop(ac.currentTime + 0.15)
      osc.onended = () => {
        osc.disconnect()
        g.disconnect()
      }
    } catch { /* ignore */ }
  }

  function updateDroneFrequency() {
    if (!droneOsc || !audioCtxRef) return
    // 60Hz at top -> 30Hz at bottom
    const frac = getScrollFraction()
    const freq = 60 - frac * 30
    droneOsc.frequency.setTargetAtTime(freq, audioCtxRef.currentTime, 0.3)
  }

  function fadeAudioIn() {
    if (audioMaster && audioCtxRef) {
      audioMaster.gain.setTargetAtTime(1, audioCtxRef.currentTime, 0.5)
    }
  }

  function fadeAudioOut() {
    if (audioMaster && audioCtxRef) {
      audioMaster.gain.setTargetAtTime(0, audioCtxRef.currentTime, 0.3)
    }
  }

  function cleanupAudio() {
    if (dripTimeout !== null) {
      clearTimeout(dripTimeout)
      dripTimeout = null
    }
    try { droneOsc?.stop() } catch { /* already stopped */ }
    droneOsc?.disconnect()
    droneFilter?.disconnect()
    droneGain?.disconnect()
    dripGain?.disconnect()
    audioMaster?.disconnect()
    droneOsc = null
    droneFilter = null
    droneGain = null
    dripGain = null
    audioMaster = null
    audioInitialized = false
    audioCtxRef = null
  }

  // --- Scroll handler ---

  function detectCurrentLayer(): number {
    if (!overlay || layerSections.length === 0) return -1
    const scrollMid = overlay.scrollTop + overlay.clientHeight / 2
    for (let i = layerSections.length - 1; i >= 0; i--) {
      if (layerSections[i].offsetTop <= scrollMid) return i
    }
    return 0
  }

  function onScroll() {
    if (!overlay || !active) return
    // Track scroll speed
    const currentTop = overlay.scrollTop
    scrollSpeed = Math.abs(currentTop - lastScrollTop)
    lastScrollTop = currentTop

    // Update drone frequency based on depth
    updateDroneFrequency()

    // Detect layer transitions
    const currentLayer = detectCurrentLayer()
    if (currentLayer !== lastLayerIndex && lastLayerIndex !== -1 && currentLayer >= 0) {
      playLayerTransition()
    }
    lastLayerIndex = currentLayer

    // Update depth indicator
    updateDepthIndicator()

    // Update parallax layers
    updateParallax()
  }

  // --- Visual helpers ---

  function updateDepthIndicator() {
    if (!depthFill || !overlay) return
    const frac = getScrollFraction()
    depthFill.style.height = `${frac * 100}%`
  }

  // --- Torch light mechanic ---

  function updateTorchPosition() {
    if (!torchOverlay || !overlay) return
    // The torch overlay is fixed-position; mouseX/mouseY are relative to viewport
    torchOverlay.style.background = `radial-gradient(circle 180px at ${mouseX}px ${mouseY}px, transparent 0%, rgba(0,0,0,0.75) 40%, rgba(0,0,0,0.93) 100%)`
  }

  // --- Parallax stone textures ---

  function createParallaxLayers() {
    if (!overlay) return
    parallaxLayers = []

    // 3 layers of procedural stone texture at different depths
    const layerConfigs = [
      { speed: 0.15, alpha: 0.025, lineCount: 40 },  // deepest — slowest
      { speed: 0.4, alpha: 0.03, lineCount: 25 },    // middle
      { speed: 0.7, alpha: 0.04, lineCount: 15 },    // nearest — fastest
    ]

    for (const cfg of layerConfigs) {
      const layer = document.createElement('div')
      layer.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        pointer-events: none;
        z-index: 1;
        overflow: hidden;
      `

      // Generate procedural stone lines/cracks
      for (let i = 0; i < cfg.lineCount; i++) {
        const line = document.createElement('div')
        const isHorizontal = Math.random() > 0.3
        const thickness = 1 + Math.random() * 2
        const length = 30 + Math.random() * 200

        if (isHorizontal) {
          line.style.cssText = `
            position: absolute;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            width: ${length}px;
            height: ${thickness}px;
            background: rgba(140, 120, 80, ${cfg.alpha});
            transform: rotate(${(Math.random() - 0.5) * 8}deg);
          `
        } else {
          line.style.cssText = `
            position: absolute;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            width: ${thickness}px;
            height: ${length}px;
            background: rgba(120, 100, 70, ${cfg.alpha});
            transform: rotate(${(Math.random() - 0.5) * 5}deg);
          `
        }
        layer.appendChild(line)
      }

      // Add some rectangular "stone blocks" to the deeper layers
      if (cfg.speed < 0.5) {
        for (let i = 0; i < 8; i++) {
          const block = document.createElement('div')
          const w = 60 + Math.random() * 150
          const h = 20 + Math.random() * 60
          block.style.cssText = `
            position: absolute;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            width: ${w}px;
            height: ${h}px;
            border: 1px solid rgba(100, 80, 50, ${cfg.alpha * 0.8});
            background: transparent;
          `
          layer.appendChild(block)
        }
      }

      layer.dataset.parallaxSpeed = String(cfg.speed)
      overlay.appendChild(layer)
      parallaxLayers.push(layer)
    }
  }

  function updateParallax() {
    if (!overlay) return
    const scrollTop = overlay.scrollTop
    for (const layer of parallaxLayers) {
      const speed = parseFloat(layer.dataset.parallaxSpeed || '0')
      const offset = scrollTop * speed
      layer.style.transform = `translateY(${-offset}px)`
    }
  }

  // --- Dust motes (now torch-aware) ---

  function createDustMote(): DustMote | null {
    if (!dustContainer || !overlay) return null
    const el = document.createElement('div')
    const size = 1 + Math.random()
    el.style.cssText = `
      position: absolute;
      width: ${size}px; height: ${size}px;
      border-radius: 50%;
      background: rgba(200, 180, 140, 1);
      pointer-events: none;
    `
    // Spawn near the cursor area for torch-visible dust
    const spawnNearCursor = Math.random() > 0.3
    let x: number, y: number
    if (spawnNearCursor) {
      // Convert mouse viewport coords to scroll-relative coords
      const rect = overlay.getBoundingClientRect()
      x = mouseX - rect.left + (Math.random() - 0.5) * 300
      y = overlay.scrollTop + (mouseY - rect.top) + (Math.random() - 0.5) * 300
    } else {
      x = Math.random() * (overlay.clientWidth - 20) + 10
      y = overlay.scrollTop + Math.random() * overlay.clientHeight * 0.3
    }
    el.style.left = `${x}px`
    el.style.top = `${y}px`

    const opacity = 0.15 + Math.random() * 0.2
    el.style.opacity = '0'

    dustContainer.appendChild(el)

    const maxLife = 300 + Math.random() * 400 // frames
    return {
      el,
      x,
      y,
      vx: (Math.random() - 0.5) * 0.15,
      vy: 0.1 + Math.random() * 0.25,
      opacity,
      life: 0,
      maxLife,
    }
  }

  function updateDustMotes() {
    if (!active || !dustContainer || !overlay) return

    // Spawn new motes — more when scrolling fast
    const spawnChance = 0.1 + Math.min(0.15, scrollSpeed * 0.01)
    if (dustMotes.length < 30 && Math.random() < spawnChance) {
      const mote = createDustMote()
      if (mote) dustMotes.push(mote)
    }

    const rect = overlay.getBoundingClientRect()
    // Mouse position in scroll-document coordinates
    const cursorDocX = mouseX - rect.left
    const cursorDocY = overlay.scrollTop + (mouseY - rect.top)

    // Update existing
    for (let i = dustMotes.length - 1; i >= 0; i--) {
      const m = dustMotes[i]
      m.life++
      m.x += m.vx
      m.y += m.vy

      // Distance from torch/cursor
      const dx = m.x - cursorDocX
      const dy = m.y - cursorDocY
      const dist = Math.sqrt(dx * dx + dy * dy)

      // Only visible within ~200px of cursor (torch radius)
      const torchFalloff = Math.max(0, 1 - dist / 200)

      // Fade in for first 30 frames, fade out for last 60 frames
      let lifeAlpha = 1
      if (m.life < 30) {
        lifeAlpha = m.life / 30
      } else if (m.life > m.maxLife - 60) {
        lifeAlpha = (m.maxLife - m.life) / 60
      }

      const alpha = m.opacity * lifeAlpha * torchFalloff

      m.el.style.left = `${m.x}px`
      m.el.style.top = `${m.y}px`
      m.el.style.opacity = String(Math.max(0, alpha))

      // Remove dead motes
      if (m.life >= m.maxLife) {
        m.el.remove()
        dustMotes.splice(i, 1)
      }
    }

    dustFrameId = requestAnimationFrame(updateDustMotes)
  }

  function createTorch(section: HTMLElement, layerIndex: number) {
    // Only add torches to some layers (not the deepest — too far underground)
    if (layerIndex >= LAYERS.length - 1) return

    const torch = document.createElement('div')
    // Alternate left/right
    const side = layerIndex % 2 === 0 ? 'left' : 'right'
    const warmth = Math.max(0.02, 0.06 - layerIndex * 0.01)
    torch.style.cssText = `
      position: absolute;
      ${side}: 8px;
      top: 30%;
      width: 40px; height: 60px;
      background: radial-gradient(ellipse at center, rgba(200, 140, 50, ${warmth}) 0%, transparent 70%);
      pointer-events: none;
      animation: catacombTorchFlicker${layerIndex} ${3 + layerIndex * 0.5}s ease-in-out infinite alternate;
    `
    // Each torch needs its own keyframes for variety
    const style = document.createElement('style')
    style.textContent = `
      @keyframes catacombTorchFlicker${layerIndex} {
        0% { opacity: 0.6; transform: scale(1); }
        25% { opacity: 0.9; transform: scale(1.05); }
        50% { opacity: 0.5; transform: scale(0.95); }
        75% { opacity: 1.0; transform: scale(1.02); }
        100% { opacity: 0.7; transform: scale(0.98); }
      }
    `
    torch.appendChild(style)

    // Section needs relative positioning for absolute torch
    section.style.position = 'relative'
    section.appendChild(torch)
    torchElements.push(torch)
  }

  // --- Clickable inscription logic ---

  function makeClickable(el: HTMLElement, detail: string) {
    el.style.cursor = 'pointer'
    el.style.transition = 'color 0.3s ease'

    const detailEl = document.createElement('div')
    detailEl.style.cssText = `
      max-height: 0;
      overflow: hidden;
      opacity: 0;
      transition: max-height 0.6s ease, opacity 0.5s ease, margin 0.4s ease;
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300;
      font-size: 12px;
      font-style: italic;
      color: rgba(180, 160, 120, 0.35);
      line-height: 1.7;
      letter-spacing: 0.3px;
      margin-top: 0;
      padding: 0 10px;
      text-align: left;
    `
    detailEl.textContent = detail

    // Insert detail right after the inscription element
    el.parentElement?.insertBefore(detailEl, el.nextSibling)

    el.addEventListener('click', (e) => {
      e.stopPropagation()

      // If another inscription is expanded, collapse it first
      if (expandedInscription && expandedInscription !== detailEl) {
        expandedInscription.style.maxHeight = '0'
        expandedInscription.style.opacity = '0'
        expandedInscription.style.marginTop = '0'
      }

      if (detailEl.style.maxHeight === '0px' || detailEl.style.maxHeight === '0') {
        // Expand
        detailEl.style.maxHeight = '200px'
        detailEl.style.opacity = '1'
        detailEl.style.marginTop = '8px'
        expandedInscription = detailEl
      } else {
        // Collapse
        detailEl.style.maxHeight = '0'
        detailEl.style.opacity = '0'
        detailEl.style.marginTop = '0'
        expandedInscription = null
      }
    })
  }

  // --- Memory integration ---

  function injectMemoryFragment() {
    if (!deps.getMemories || !overlay || !active) return
    const memories = deps.getMemories()
    if (memories.length === 0) return

    // Pick a random memory
    const mem = memories[Math.floor(Math.random() * memories.length)]
    const text = mem.currentText
    if (!text || text.length < 3) return

    // Find a random layer section to inject into
    if (layerSections.length === 0) return
    const sectionIdx = Math.floor(Math.random() * layerSections.length)
    const section = layerSections[sectionIdx]

    const el = document.createElement('div')
    el.style.cssText = `
      max-width: 400px;
      margin: 16px auto;
      text-align: center;
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300;
      font-size: 12px;
      font-style: italic;
      color: rgba(200, 170, 100, 0);
      letter-spacing: 1.5px;
      line-height: 1.6;
      transition: color 1.5s ease;
      position: relative;
    `

    // Scratched-into-wall aesthetic — add a subtle "carved" look
    el.innerHTML = `<span style="
      text-decoration: none;
      border-bottom: 1px solid rgba(200, 170, 100, 0.08);
      padding-bottom: 2px;
    ">${escapeHtml(text)}</span>`

    // Add a small label
    const label = document.createElement('div')
    label.style.cssText = `
      font-size: 9px;
      color: rgba(200, 170, 100, 0);
      letter-spacing: 3px;
      text-transform: uppercase;
      margin-top: 4px;
      transition: color 1.5s ease;
    `
    label.textContent = '(scratched into the wall)'
    el.appendChild(label)

    // Insert before the last child of the section (before torch elements etc.)
    const children = Array.from(section.children)
    const insertBefore = children.length > 2 ? children[children.length - 1] : null
    if (insertBefore) {
      section.insertBefore(el, insertBefore)
    } else {
      section.appendChild(el)
    }

    injectedMemoryEls.push(el)

    // Fade in after a moment
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.color = 'rgba(200, 170, 100, 0.25)'
        label.style.color = 'rgba(200, 170, 100, 0.1)'
      })
    })

    // Fade out after 15s and remove
    setTimeout(() => {
      el.style.color = 'rgba(200, 170, 100, 0)'
      label.style.color = 'rgba(200, 170, 100, 0)'
      setTimeout(() => {
        el.remove()
        const idx = injectedMemoryEls.indexOf(el)
        if (idx >= 0) injectedMemoryEls.splice(idx, 1)
      }, 2000)
    }, 15000)
  }

  function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  // --- Entry rendering ---

  function renderEntry(entry: CatacombEntry, layer: CatacombLayer, section: HTMLElement) {
    const el = document.createElement('div')
    el.style.cssText = `
      max-width: 500px;
      margin-bottom: 24px;
      text-align: center;
    `

    if (entry.style === 'inscription') {
      el.style.cssText += `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 14px;
        color: ${layer.color};
        letter-spacing: 0.5px;
        line-height: 1.6;
      `
    } else if (entry.style === 'code') {
      el.style.cssText += `
        font-family: 'Courier New', monospace;
        font-size: 13px;
        color: rgba(100, 180, 80, 0.25);
        letter-spacing: 0;
        opacity: 0.7;
      `
    } else if (entry.style === 'url') {
      el.style.cssText += `
        font-family: 'Courier New', monospace;
        font-size: 13px;
        color: rgba(100, 140, 200, 0.25);
        text-decoration: line-through;
      `
    } else if (entry.style === 'epitaph') {
      el.style.cssText += `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 13px; font-style: italic;
        color: rgba(180, 160, 120, ${parseFloat(layer.color.match(/[\d.]+(?=\))/)?.[0] || '0.3') * 0.5});
        letter-spacing: 1px;
        line-height: 1.8;
      `
    } else if (entry.style === 'environmental') {
      // Distinct style: cooler tone, different font treatment
      el.style.cssText += `
        font-family: 'Courier New', monospace;
        font-weight: 400; font-size: 11px;
        color: rgba(100, 140, 170, 0.35);
        letter-spacing: 2px;
        line-height: 1.8;
        text-transform: uppercase;
        border-left: 2px solid rgba(80, 120, 160, 0.08);
        padding-left: 12px;
        text-align: left;
        margin-top: 30px;
        margin-bottom: 30px;
      `
    }

    el.textContent = entry.text
    section.appendChild(el)

    // Make clickable if it has detail text
    if (entry.detail) {
      makeClickable(el, entry.detail)
    }
  }

  return {
    name: 'catacombs',
    label: 'the catacombs',
    hidden: true,

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        width: 100%; height: 100%;
        pointer-events: auto;
        overflow-y: auto;
        scrollbar-width: none;
        background: rgba(10, 7, 4, 1);
        position: relative;
      `

      const style = document.createElement('style')
      style.textContent = `
        .catacombs-scroll::-webkit-scrollbar { display: none; }
        @keyframes catacombFlicker {
          0%, 90%, 100% { opacity: 1; }
          92% { opacity: 0.7; }
          95% { opacity: 0.9; }
        }
      `
      overlay.appendChild(style)
      overlay.classList.add('catacombs-scroll')

      // --- Torch light overlay (dark layer with radial cutout following cursor) ---
      torchOverlay = document.createElement('div')
      torchOverlay.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        pointer-events: none;
        z-index: 8;
        background: rgba(0, 0, 0, 0.93);
        transition: background 0.05s ease;
      `
      overlay.appendChild(torchOverlay)

      // --- Depth indicator (left edge) ---
      depthIndicator = document.createElement('div')
      depthIndicator.style.cssText = `
        position: fixed;
        left: 4px; top: 10%;
        width: 1px; height: 80%;
        background: rgba(180, 160, 120, 0.04);
        pointer-events: none;
        z-index: 10;
      `
      depthFill = document.createElement('div')
      depthFill.style.cssText = `
        width: 100%; height: 0%;
        background: rgba(180, 160, 120, 0.1);
        transition: height 0.3s ease;
      `
      depthIndicator.appendChild(depthFill)
      overlay.appendChild(depthIndicator)

      // --- Parallax stone texture layers ---
      createParallaxLayers()

      // --- Dust container (absolute positioned within scrollable area) ---
      dustContainer = document.createElement('div')
      dustContainer.style.cssText = `
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
        pointer-events: none;
        z-index: 5;
      `
      overlay.appendChild(dustContainer)

      // Entrance text
      const entrance = document.createElement('div')
      entrance.style.cssText = `
        text-align: center;
        padding: 80px 20px 60px;
        position: relative;
        z-index: 2;
      `

      const entranceTitle = document.createElement('div')
      entranceTitle.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 18px;
        color: rgba(180, 160, 120, 0.3);
        letter-spacing: 6px; text-transform: uppercase;
        margin-bottom: 16px;
      `
      entranceTitle.textContent = 'descending'
      entrance.appendChild(entranceTitle)

      const arrow = document.createElement('div')
      arrow.style.cssText = `
        font-size: 24px;
        color: rgba(180, 160, 120, 0.1);
        animation: catacombFlicker 4s ease-in-out infinite;
      `
      arrow.textContent = '\u25BC'
      entrance.appendChild(arrow)

      overlay.appendChild(entrance)

      // Build layers
      layerSections = []
      for (let li = 0; li < LAYERS.length; li++) {
        const layer = LAYERS[li]
        const section = document.createElement('div')
        section.style.cssText = `
          padding: 40px 20px;
          background: ${layer.bgColor};
          min-height: 60vh;
          display: flex; flex-direction: column;
          align-items: center;
          border-top: 1px solid rgba(180, 160, 120, 0.03);
          position: relative;
          z-index: 2;
        `

        // Era header
        const header = document.createElement('div')
        header.style.cssText = `
          text-align: center; margin-bottom: 40px;
        `

        const eraLabel = document.createElement('div')
        eraLabel.style.cssText = `
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300; font-size: 12px;
          color: ${layer.color};
          letter-spacing: 4px; text-transform: uppercase;
          margin-bottom: 4px;
        `
        eraLabel.textContent = layer.era
        header.appendChild(eraLabel)

        const depthLabel = document.createElement('div')
        depthLabel.style.cssText = `
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300; font-size: 12px; font-style: italic;
          color: rgba(180, 160, 120, 0.12);
          letter-spacing: 2px;
        `
        depthLabel.textContent = layer.depth
        header.appendChild(depthLabel)

        section.appendChild(header)

        // Entries — use the new renderEntry function
        for (const entry of layer.entries) {
          renderEntry(entry, layer, section)
        }

        // Add torch flicker to this layer section
        createTorch(section, li)

        overlay.appendChild(section)
        layerSections.push(section)
      }

      // Bottom void
      const bottom = document.createElement('div')
      bottom.style.cssText = `
        height: 100vh;
        background: linear-gradient(rgba(8, 5, 2, 1), rgba(0, 0, 0, 1));
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 40px;
        position: relative;
        z-index: 2;
      `

      // Return link
      const returnLink = document.createElement('div')
      returnLink.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 12px;
        color: rgba(180, 160, 120, 0.15);
        letter-spacing: 3px; text-transform: uppercase;
        cursor: pointer;
        transition: color 0.5s ease;
      `
      returnLink.textContent = '\u25B2 ascend to the archive'
      returnLink.addEventListener('mouseenter', () => {
        returnLink.style.color = 'rgba(180, 160, 120, 0.5)'
      })
      returnLink.addEventListener('mouseleave', () => {
        returnLink.style.color = 'rgba(180, 160, 120, 0.15)'
      })
      returnLink.addEventListener('click', deps.onReturn)
      bottom.appendChild(returnLink)

      // Ossuary link
      if (deps.onOssuary) {
        const ossuaryLink = document.createElement('div')
        ossuaryLink.style.cssText = `
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300; font-size: 13px;
          color: rgba(220, 210, 190, 0.08);
          letter-spacing: 2px;
          cursor: pointer;
          transition: color 0.5s ease;
        `
        ossuaryLink.textContent = '\u2192 the ossuary'
        ossuaryLink.addEventListener('mouseenter', () => {
          ossuaryLink.style.color = 'rgba(220, 210, 190, 0.3)'
        })
        ossuaryLink.addEventListener('mouseleave', () => {
          ossuaryLink.style.color = 'rgba(220, 210, 190, 0.08)'
        })
        ossuaryLink.addEventListener('click', deps.onOssuary)
        bottom.appendChild(ossuaryLink)
      }

      // Navigation portals — carved stone inscriptions to connected rooms
      if (deps.switchTo) {
        const portalData = [
          { label: '\u2191 the archive', room: 'archive' },
          { label: '\u2192 the ossuary', room: 'ossuary' },
        ]
        const portalRow = document.createElement('div')
        portalRow.style.cssText = `
          display: flex; gap: 40px; margin-top: 30px;
        `
        for (const portal of portalData) {
          const el = document.createElement('div')
          el.style.cssText = `
            font-family: 'Cormorant Garamond', serif;
            font-weight: 300; font-size: 12px;
            color: rgba(180, 160, 120, 0.06);
            letter-spacing: 2px;
            cursor: pointer;
            transition: color 0.5s ease;
          `
          el.textContent = portal.label
          el.addEventListener('mouseenter', () => {
            el.style.color = 'rgba(180, 160, 120, 0.35)'
          })
          el.addEventListener('mouseleave', () => {
            el.style.color = 'rgba(180, 160, 120, 0.06)'
          })
          el.addEventListener('click', () => deps.switchTo!(portal.room))
          portalRow.appendChild(el)
        }
        bottom.appendChild(portalRow)
      }

      overlay.appendChild(bottom)

      return overlay
    },

    activate() {
      active = true
      lastScrollTop = overlay?.scrollTop ?? 0
      scrollSpeed = 0
      lastLayerIndex = -1

      // Scroll listener
      scrollHandler = onScroll
      overlay?.addEventListener('scroll', scrollHandler, { passive: true })

      // Mouse move for torch light
      mouseMoveHandler = (e: MouseEvent) => {
        mouseX = e.clientX
        mouseY = e.clientY
        updateTorchPosition()
      }
      overlay?.addEventListener('mousemove', mouseMoveHandler)

      // Initialize torch position to center of screen
      mouseX = window.innerWidth / 2
      mouseY = window.innerHeight / 2
      updateTorchPosition()

      // Auto-scroll that slows as you descend
      if (overlay) {
        autoScrollId = window.setInterval(() => {
          if (overlay && active) {
            // Slow down with depth: 0.5 px at top -> 0.2 px at bottom
            const frac = getScrollFraction()
            const speed = 0.5 - frac * 0.3
            overlay.scrollTop += speed
          }
        }, 16)
      }

      // Init audio
      initAudio().then(() => fadeAudioIn())

      // Start dust particle loop
      dustFrameId = requestAnimationFrame(updateDustMotes)

      // Initial depth indicator update
      updateDepthIndicator()

      // Initial parallax update
      updateParallax()

      // Memory injection interval (~30s)
      if (deps.getMemories) {
        // First injection after 10s, then every 30s
        const firstTimeout = setTimeout(() => {
          injectMemoryFragment()
          memoryIntervalId = setInterval(injectMemoryFragment, 30000)
        }, 10000)
        // Store the first timeout so we can clear it
        memoryIntervalId = firstTimeout as unknown as ReturnType<typeof setInterval>
      }
    },

    deactivate() {
      active = false
      if (autoScrollId) clearInterval(autoScrollId)
      autoScrollId = null

      // Remove scroll listener
      if (scrollHandler && overlay) {
        overlay.removeEventListener('scroll', scrollHandler)
        scrollHandler = null
      }

      // Remove mouse move listener
      if (mouseMoveHandler && overlay) {
        overlay.removeEventListener('mousemove', mouseMoveHandler)
        mouseMoveHandler = null
      }

      // Fade audio out
      fadeAudioOut()
      if (dripTimeout !== null) {
        clearTimeout(dripTimeout)
        dripTimeout = null
      }

      // Stop dust animation
      if (dustFrameId !== null) {
        cancelAnimationFrame(dustFrameId)
        dustFrameId = null
      }

      // Stop memory injection
      if (memoryIntervalId !== null) {
        clearInterval(memoryIntervalId)
        memoryIntervalId = null
      }
    },

    destroy() {
      active = false
      if (autoScrollId) clearInterval(autoScrollId)
      autoScrollId = null

      // Remove scroll listener
      if (scrollHandler && overlay) {
        overlay.removeEventListener('scroll', scrollHandler)
        scrollHandler = null
      }

      // Remove mouse move listener
      if (mouseMoveHandler && overlay) {
        overlay.removeEventListener('mousemove', mouseMoveHandler)
        mouseMoveHandler = null
      }

      // Full audio cleanup
      cleanupAudio()

      // Stop dust animation and remove motes
      if (dustFrameId !== null) {
        cancelAnimationFrame(dustFrameId)
        dustFrameId = null
      }
      for (const m of dustMotes) {
        m.el.remove()
      }
      dustMotes = []
      dustContainer = null
      depthIndicator = null
      depthFill = null
      torchOverlay = null
      torchElements = []
      layerSections = []
      parallaxLayers = []
      expandedInscription = null

      // Stop memory injection and clean up injected elements
      if (memoryIntervalId !== null) {
        clearInterval(memoryIntervalId)
        memoryIntervalId = null
      }
      for (const el of injectedMemoryEls) {
        el.remove()
      }
      injectedMemoryEls = []

      overlay?.remove()
    },
  }
}
