/**
 * THE MADELEINE — involuntary memory
 *
 * Marcel Proust dipped a madeleine in tea and seven volumes
 * of memory flooded back. Involuntary memory — the sudden,
 * unbidden return of the past triggered by a sensory detail.
 *
 * This room presents a stream of "triggers" — colors, shapes,
 * sounds, words — and when you click one that resonates,
 * a stored memory surfaces, chosen by word-association.
 * The trigger and the memory may seem unrelated, but the
 * connection is always there if you look.
 *
 * The twist: you can't choose which memory surfaces.
 * The association algorithm finds connections you didn't
 * know existed in your own words.
 *
 * Also inspired by: synesthesia research, the tip-of-the-tongue
 * phenomenon, Pavlovian conditioning, how smells bypass the
 * thalamus and hit the amygdala directly, Walter Benjamin's
 * "excavation" metaphor for memory, Sei Shōnagon's Pillow Book
 * (cataloguing sensory impressions), the Japanese concept of
 * "mono no aware" (pathos of things)
 *
 * USES MEMORIES. Literary. Associative.
 */

import type { Room } from './RoomManager'

interface Memory {
  id: string
  originalText: string
  currentText: string
  degradation: number
  timestamp: number
}

interface MadeleineDeps {
  getMemories: () => Memory[]
}

interface Trigger {
  text: string
  type: 'sense' | 'word' | 'color' | 'sound'
  x: number
  y: number
  alpha: number
  vx: number
  vy: number
  hue: number
  size: number
}

// Sensory triggers — Proustian prompts
const SENSE_TRIGGERS = [
  'the smell of rain on hot concrete',
  'a song heard through a wall',
  'cold metal on skin',
  'bread baking somewhere nearby',
  'the weight of a key in your pocket',
  'sunlight through closed eyelids',
  'a hand on your shoulder',
  'the sound of a door closing',
  'ink on paper',
  'salt on your lips',
  'static electricity',
  'the color of 4am',
  'dust in a beam of light',
  'a match being struck',
  'ice cracking underfoot',
  'the hum of fluorescent lights',
  'chlorine',
  'cinnamon',
  'old books',
  'petrichor',
  'lavender',
  'campfire smoke',
  'wet wool',
  'copper pennies',
  'fresh laundry',
  'gasoline',
  'a ticking clock',
  'wind chimes',
  'a phone ringing in another room',
  'footsteps on gravel',
  'the buzz of a bee',
  'paper tearing',
  'a cat purring',
  'waves pulling back',
  'a train in the distance',
]

const WORD_TRIGGERS = [
  'threshold', 'dissolve', 'return', 'absence', 'light',
  'beneath', 'drift', 'echo', 'margin', 'residue',
  'trace', 'passage', 'vessel', 'hollow', 'tide',
  'ember', 'frost', 'vapor', 'grain', 'thread',
  'signal', 'pulse', 'husk', 'silt', 'meridian',
]

export function createMadeleineRoom(deps: MadeleineDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let triggers: Trigger[] = []
  let surfacedMemory: { text: string; trigger: string; alpha: number; y: number } | null = null
  let ripples: { x: number; y: number; radius: number; alpha: number }[] = []
  let spawnTimer = 0

  function spawnTrigger() {
    if (!canvas) return
    const w = canvas.width
    const h = canvas.height

    const type = ['sense', 'word', 'color', 'sound'][Math.floor(Math.random() * 4)] as Trigger['type']
    let text = ''
    let hue = 0
    let size = 10

    switch (type) {
      case 'sense':
        text = SENSE_TRIGGERS[Math.floor(Math.random() * SENSE_TRIGGERS.length)]
        hue = 30 + Math.random() * 30 // warm amber
        size = 10
        break
      case 'word':
        text = WORD_TRIGGERS[Math.floor(Math.random() * WORD_TRIGGERS.length)]
        hue = 280 + Math.random() * 40 // violet
        size = 14
        break
      case 'color':
        hue = Math.floor(Math.random() * 360)
        text = '' // just a color blob
        size = 20
        break
      case 'sound':
        text = ['~', '♪', '···', ')))'][Math.floor(Math.random() * 4)]
        hue = 180 + Math.random() * 40 // teal
        size = 12
        break
    }

    triggers.push({
      text,
      type,
      x: Math.random() * w,
      y: -20,
      alpha: 0.3 + Math.random() * 0.2,
      vx: (Math.random() - 0.5) * 0.3,
      vy: 0.2 + Math.random() * 0.3,
      hue,
      size,
    })
  }

  function findAssociatedMemory(trigger: Trigger): Memory | null {
    const memories = deps.getMemories()
    if (memories.length === 0) return null

    if (trigger.type === 'color' || trigger.type === 'sound') {
      // Random memory for non-text triggers
      return memories[Math.floor(Math.random() * memories.length)]
    }

    // Word association — find memory sharing the most words with trigger
    const triggerWords = trigger.text.toLowerCase().split(/\s+/)

    let bestMatch: Memory | null = null
    let bestScore = -1

    for (const mem of memories) {
      const memWords = mem.currentText.toLowerCase().split(/\s+/)
      let score = 0

      for (const tw of triggerWords) {
        if (tw.length < 3) continue
        for (const mw of memWords) {
          if (mw.includes(tw) || tw.includes(mw)) {
            score += 3
          } else if (mw[0] === tw[0]) {
            score += 1 // same initial letter — loose association
          }
        }
      }

      // Bonus for memories with similar emotional valence
      if (trigger.text.includes('cold') || trigger.text.includes('ice') || trigger.text.includes('frost')) {
        if (mem.currentText.match(/cold|ice|winter|frozen|snow|alone|empty/i)) score += 2
      }
      if (trigger.text.includes('warm') || trigger.text.includes('sun') || trigger.text.includes('light')) {
        if (mem.currentText.match(/warm|sun|light|love|joy|bright|gold/i)) score += 2
      }

      // Small random factor — involuntary means unpredictable
      score += Math.random() * 2

      if (score > bestScore) {
        bestScore = score
        bestMatch = mem
      }
    }

    return bestMatch || memories[Math.floor(Math.random() * memories.length)]
  }

  function handleClick(e: MouseEvent) {
    if (!canvas || surfacedMemory) return

    // Find clicked trigger
    for (let i = triggers.length - 1; i >= 0; i--) {
      const t = triggers[i]
      const dx = e.clientX - t.x
      const dy = e.clientY - t.y
      const clickRadius = t.type === 'color' ? t.size * 2 : t.size * 3

      if (dx * dx + dy * dy < clickRadius * clickRadius) {
        // Found a trigger — surface a memory
        const memory = findAssociatedMemory(t)
        if (memory) {
          surfacedMemory = {
            text: memory.currentText,
            trigger: t.text || `color: hsl(${t.hue}, 50%, 50%)`,
            alpha: 0,
            y: canvas.height * 0.6,
          }

          // Ripple effect
          ripples.push({
            x: t.x,
            y: t.y,
            radius: 0,
            alpha: 0.3,
          })
        }

        // Remove the trigger
        triggers.splice(i, 1)
        break
      }
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const c = ctx
    const w = canvas.width
    const h = canvas.height

    // Warm dark background — tea-stained
    c.fillStyle = 'rgba(12, 9, 6, 1)'
    c.fillRect(0, 0, w, h)

    // Spawn triggers periodically
    spawnTimer += 0.016
    if (spawnTimer > 2.5 && triggers.length < 8) {
      spawnTrigger()
      spawnTimer = 0
    }

    // Update and draw triggers
    triggers = triggers.filter(t => {
      t.x += t.vx
      t.y += t.vy
      t.alpha -= 0.0005

      if (t.y > h + 30 || t.alpha <= 0) return false

      if (t.type === 'color') {
        // Color blob
        const grad = c.createRadialGradient(t.x, t.y, 0, t.x, t.y, t.size)
        grad.addColorStop(0, `hsla(${t.hue}, 50%, 50%, ${t.alpha * 0.3})`)
        grad.addColorStop(1, 'transparent')
        c.fillStyle = grad
        c.beginPath()
        c.arc(t.x, t.y, t.size, 0, Math.PI * 2)
        c.fill()
      } else {
        // Text trigger
        c.font = `${t.size}px "Cormorant Garamond", serif`
        c.fillStyle = `hsla(${t.hue}, 40%, 60%, ${t.alpha})`
        c.textAlign = 'center'
        c.fillText(t.text, t.x, t.y)
      }

      return true
    })

    // Draw ripples
    ripples = ripples.filter(r => {
      r.radius += 2
      r.alpha -= 0.008

      if (r.alpha <= 0) return false

      c.strokeStyle = `rgba(255, 215, 0, ${r.alpha})`
      c.lineWidth = 1
      c.beginPath()
      c.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
      c.stroke()

      return true
    })

    // Surfaced memory
    if (surfacedMemory) {
      if (surfacedMemory.alpha < 1) {
        surfacedMemory.alpha += 0.015
      } else {
        surfacedMemory.alpha -= 0.003
      }

      if (surfacedMemory.alpha <= 0) {
        surfacedMemory = null
      } else {
        const sm = surfacedMemory
        const alpha = Math.min(1, sm.alpha)

        // Trigger text (what caused the memory)
        c.font = '9px "Cormorant Garamond", serif'
        c.fillStyle = `rgba(200, 180, 140, ${alpha * 0.15})`
        c.textAlign = 'center'
        c.fillText(`triggered by: ${sm.trigger}`, w / 2, sm.y - 30)

        // Connection line
        c.strokeStyle = `rgba(255, 215, 0, ${alpha * 0.05})`
        c.lineWidth = 0.5
        c.setLineDash([2, 4])
        c.beginPath()
        c.moveTo(w / 2, sm.y - 25)
        c.lineTo(w / 2, sm.y - 8)
        c.stroke()
        c.setLineDash([])

        // Memory text — golden, centered
        c.font = '15px "Cormorant Garamond", serif'
        c.fillStyle = `rgba(255, 215, 0, ${alpha * 0.4})`
        c.textAlign = 'center'

        // Word wrap
        const words = sm.text.split(' ')
        const maxWidth = w * 0.5
        let line = ''
        let lineY = sm.y

        for (const word of words) {
          const test = line + (line ? ' ' : '') + word
          if (c.measureText(test).width > maxWidth && line) {
            c.fillText(line, w / 2, lineY)
            line = word
            lineY += 22
          } else {
            line = test
          }
        }
        if (line) c.fillText(line, w / 2, lineY)

        // Soft glow around memory text area
        const glow = c.createRadialGradient(w / 2, sm.y, 0, w / 2, sm.y, 150)
        glow.addColorStop(0, `rgba(255, 215, 0, ${alpha * 0.02})`)
        glow.addColorStop(1, 'transparent')
        c.fillStyle = glow
        c.beginPath()
        c.arc(w / 2, sm.y, 150, 0, Math.PI * 2)
        c.fill()
      }
    }

    // Title
    c.font = '10px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 180, 140, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    c.textAlign = 'center'
    c.fillText('the madeleine', w / 2, 25)

    // Hint
    if (!surfacedMemory && triggers.length > 0) {
      c.font = '9px "Cormorant Garamond", serif'
      c.fillStyle = `rgba(200, 180, 140, ${0.04 + Math.sin(time * 1.5) * 0.02})`
      c.textAlign = 'center'
      c.fillText('click a trigger to surface a memory', w / 2, h - 8)
    }

    // No memories hint
    if (deps.getMemories().length === 0) {
      c.font = '12px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(200, 180, 140, 0.1)'
      c.textAlign = 'center'
      c.fillText('no memories to surface', w / 2, h / 2)
      c.font = '10px "Cormorant Garamond", serif'
      c.fillStyle = 'rgba(200, 180, 140, 0.06)'
      c.fillText('the triggers drift past, finding nothing', w / 2, h / 2 + 20)
    }

    // Attribution
    c.font = '8px "Cormorant Garamond", serif'
    c.fillStyle = `rgba(200, 180, 140, ${0.03 + Math.sin(time * 0.2) * 0.01})`
    c.textAlign = 'center'
    c.fillText('after Proust — involuntary memory', w / 2, 40)

    // Stats
    c.font = '9px monospace'
    c.fillStyle = 'rgba(200, 180, 140, 0.06)'
    c.textAlign = 'left'
    c.fillText(`${triggers.length} triggers drifting`, 12, h - 18)
  }

  return {
    name: 'madeleine',
    label: 'the madeleine',

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

      canvas.addEventListener('click', handleClick)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)
      return overlay
    },

    activate() {
      active = true
      triggers = []
      surfacedMemory = null
      ripples = []
      spawnTimer = 0
      // Seed initial triggers
      for (let i = 0; i < 4; i++) {
        spawnTrigger()
        if (triggers.length > 0) {
          const last = triggers[triggers.length - 1]
          last.y = Math.random() * (canvas?.height || 600) * 0.7
        }
      }
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      overlay?.remove()
    },
  }
}
