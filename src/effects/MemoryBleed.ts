/**
 * MEMORY BLEED — your own memories bleed through the walls
 *
 * Occasionally, in any room, a fragment of one of your own memories
 * drifts across the screen like a half-heard whisper from another room.
 * These are YOUR words, not system text — the house is haunted by
 * what you've given it.
 *
 * The effect is rare (every 45-90 seconds) and very subtle. The text
 * is translucent, drifts slowly, and dissolves. It appears in a
 * different style than room content — ghostly serif, muted gold,
 * as if seen through frosted glass.
 *
 * Memories that are more degraded bleed more easily — they're
 * slipping loose from their original context, drifting between rooms
 * like untethered ghosts.
 *
 * Inspired by: overhearing conversations through walls, palimpsests
 * (text showing through from underneath), Jung's collective unconscious,
 * the Alzheimer's research showing jumbled memory replay during sleep
 */

import type { StoredMemory } from '../memory/MemoryJournal'

export class MemoryBleed {
  private container: HTMLElement
  private getMemories: () => StoredMemory[]
  private getRoom: () => string
  private intervalId: number | null = null
  private activeBleed: HTMLElement | null = null

  constructor(deps: {
    getMemories: () => StoredMemory[]
    getRoom: () => string
  }) {
    this.getMemories = deps.getMemories
    this.getRoom = deps.getRoom

    this.container = document.createElement('div')
    this.container.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 52; pointer-events: none; overflow: hidden;
    `
    document.body.appendChild(this.container)
  }

  start() {
    // First bleed after 30-60 seconds
    const firstDelay = (30 + Math.random() * 30) * 1000
    setTimeout(() => {
      this.showBleed()
      // Then every 45-90 seconds
      this.intervalId = window.setInterval(
        () => this.showBleed(),
        (45 + Math.random() * 45) * 1000
      )
    }, firstDelay)
  }

  private showBleed() {
    const memories = this.getMemories()
    if (memories.length === 0) return

    // Don't overlap with existing bleed
    if (this.activeBleed) return

    // Prefer degraded memories — they bleed more easily
    // Weight selection toward higher degradation
    const weighted = memories.map(m => ({
      mem: m,
      weight: 0.2 + m.degradation * 0.8,
    }))
    const totalWeight = weighted.reduce((s, w) => s + w.weight, 0)
    let rand = Math.random() * totalWeight
    let selected = weighted[0].mem
    for (const w of weighted) {
      rand -= w.weight
      if (rand <= 0) {
        selected = w.mem
        break
      }
    }

    // Extract a fragment (not the full text — just a phrase)
    const text = selected.currentText
    const words = text.split(/\s+/)
    let fragment: string
    if (words.length <= 4) {
      fragment = text
    } else {
      const start = Math.floor(Math.random() * Math.max(1, words.length - 4))
      const len = 3 + Math.floor(Math.random() * 3)
      fragment = words.slice(start, start + len).join(' ')
    }

    // Add ellipsis to suggest incompleteness
    if (words.length > 4) {
      if (Math.random() < 0.5) fragment = '...' + fragment
      if (Math.random() < 0.5) fragment = fragment + '...'
    }

    // Random position — biased toward edges (memories seep through walls)
    let x: number, y: number
    if (Math.random() < 0.6) {
      // Edge spawn
      const side = Math.floor(Math.random() * 4)
      switch (side) {
        case 0: x = 5 + Math.random() * 15; y = 20 + Math.random() * 60; break
        case 1: x = 80 + Math.random() * 15; y = 20 + Math.random() * 60; break
        case 2: x = 15 + Math.random() * 70; y = 5 + Math.random() * 15; break
        default: x = 15 + Math.random() * 70; y = 75 + Math.random() * 15; break
      }
    } else {
      // Scattered
      x = 10 + Math.random() * 80
      y = 15 + Math.random() * 70
    }

    // Drift direction — slow, ghostly
    const driftX = (Math.random() - 0.5) * 20 // px over full lifetime
    const driftY = -5 - Math.random() * 15 // mostly upward, like rising

    // Golden fruit: highly degraded memories ripen into oubli fruit
    const isGolden = selected.degradation > 0.7 && Math.random() < 0.3

    // Hue from memory (or golden amber for ripened memories)
    const hue = isGolden ? 42 : Math.floor(selected.hue * 360)
    const sat = isGolden ? 80 : 30
    const light = isGolden ? 65 : 70
    const alpha = isGolden
      ? 0.12 + selected.degradation * 0.05
      : 0.08 + selected.degradation * 0.07

    const el = document.createElement('div')
    el.style.cssText = `
      position: absolute;
      left: ${x}%;
      top: ${y}%;
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300;
      font-style: italic;
      font-size: ${14 + Math.random() * 4}px;
      letter-spacing: 1.5px;
      color: hsla(${hue}, ${sat}%, ${light}%, 0);
      max-width: 300px;
      white-space: nowrap;
      pointer-events: none;
      transition: color 3s ease, transform 12s linear;
      transform: translate(0, 0);
      text-shadow: 0 0 ${isGolden ? 14 : 8}px hsla(${hue}, ${sat}%, ${light}%, ${alpha * 0.5});
    `
    el.textContent = fragment

    this.container.appendChild(el)
    this.activeBleed = el

    // Fade in
    requestAnimationFrame(() => {
      el.style.color = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`
      el.style.transform = `translate(${driftX}px, ${driftY}px)`
    })

    // Fade out after 8 seconds
    setTimeout(() => {
      el.style.transition = 'color 4s ease, transform 12s linear'
      el.style.color = `hsla(${hue}, ${sat}%, ${light}%, 0)`
    }, 8000)

    // Remove after fade completes
    setTimeout(() => {
      el.remove()
      if (this.activeBleed === el) {
        this.activeBleed = null
      }
    }, 12000)
  }

  destroy() {
    if (this.intervalId) clearInterval(this.intervalId)
    this.container.remove()
  }
}
