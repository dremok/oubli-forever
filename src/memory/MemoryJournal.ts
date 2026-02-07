/**
 * MEMORY JOURNAL — persistence in a system of forgetting
 *
 * The paradox at the heart of Oubli: a system about forgetting
 * that also remembers. Every memory typed into the Forgetting Machine
 * is saved here — but not faithfully. Each time the journal is read,
 * the memories have degraded slightly. Characters lost. Words blurred.
 * Over days and weeks, your memories dissolve into fragments.
 *
 * But they're THERE. Ghosts of what you typed. The shape of what
 * you gave to Oubli. You can see them as constellations in the void.
 *
 * This is functional: it's a journal. It's also art: the journal
 * forgets what you wrote, just like your brain does.
 *
 * Storage: localStorage (persists across sessions)
 * Degradation: Each memory loses ~5% of characters per day
 */

export interface StoredMemory {
  id: string
  originalText: string
  currentText: string
  timestamp: number
  degradation: number // 0-1, how much has been lost
  position: { x: number; y: number; z: number } // position in the void
  hue: number
  sealedUntil?: number // timestamp — if set, text hidden until this time
}

const STORAGE_KEY = 'oubli-memories'
const DEGRADATION_RATE = 0.05 // 5% per day

export class MemoryJournal {
  private memories: StoredMemory[] = []
  private onMemoryAdded: ((memory: StoredMemory) => void) | null = null

  constructor() {
    this.load()
    this.degrade()
  }

  private load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        this.memories = JSON.parse(stored)
      }
    } catch {
      this.memories = []
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.memories))
    } catch {
      // localStorage full or unavailable — ironic, the system can't remember
    }
  }

  /** Degrade all memories based on time elapsed since creation */
  private degrade() {
    const now = Date.now()

    for (const memory of this.memories) {
      // Sealed memories don't degrade — they're frozen in time
      if (memory.sealedUntil) {
        if (now < memory.sealedUntil) {
          // Still sealed — hide text
          memory.currentText = '▓'.repeat(memory.originalText.length)
          memory.degradation = 0
          continue
        } else {
          // Unsealed! Start degradation from unlock time
          delete memory.sealedUntil
        }
      }

      const daysSinceCreation = (now - memory.timestamp) / (1000 * 60 * 60 * 24)
      const targetDegradation = Math.min(daysSinceCreation * DEGRADATION_RATE, 0.95)

      if (targetDegradation > memory.degradation) {
        memory.degradation = targetDegradation
        memory.currentText = this.degradeText(memory.originalText, targetDegradation)
      }
    }

    this.save()
  }

  /** Degrade text by removing characters based on degradation level */
  private degradeText(original: string, degradation: number): string {
    if (degradation <= 0) return original

    const chars = original.split('')
    const toRemove = Math.floor(chars.length * degradation)

    // Use a seeded approach so the same characters always disappear
    // (deterministic degradation — the same letters are always forgotten)
    const indices: number[] = []
    for (let i = 0; i < chars.length; i++) {
      // Vowels and middle-of-word characters degrade first
      const isVowel = 'aeiouAEIOU'.includes(chars[i])
      const isSpace = chars[i] === ' '
      const isFirst = i === 0 || original[i - 1] === ' '

      let priority = 0.5
      if (isVowel) priority = 0.8
      if (isSpace) priority = 0.1
      if (isFirst) priority = 0.2

      indices.push(priority)
    }

    // Sort by priority (highest first = removed first)
    const sortedIndices = indices
      .map((p, i) => ({ priority: p, index: i }))
      .sort((a, b) => b.priority - a.priority)

    const removeSet = new Set(
      sortedIndices.slice(0, toRemove).map(x => x.index)
    )

    return chars.map((c, i) => removeSet.has(i) ? (c === ' ' ? ' ' : '_') : c).join('')
  }

  /** Add a new memory from the forgetting machine */
  addMemory(text: string) {
    const memory: StoredMemory = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      originalText: text,
      currentText: text,
      timestamp: Date.now(),
      degradation: 0,
      position: {
        x: (Math.random() - 0.5) * 300,
        y: (Math.random() - 0.5) * 300,
        z: (Math.random() - 0.5) * 300,
      },
      hue: 0.11 + Math.random() * 0.05, // gold family — personal memories are golden
    }

    this.memories.push(memory)
    this.save()
    this.onMemoryAdded?.(memory)

    return memory
  }

  /** Add a time capsule — sealed memory that reveals itself on a future date */
  addTimeCapsule(text: string, unlockDate: Date): StoredMemory {
    const memory: StoredMemory = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      originalText: text,
      currentText: '▓'.repeat(text.length),
      timestamp: Date.now(),
      degradation: 0,
      position: {
        x: (Math.random() - 0.5) * 300,
        y: (Math.random() - 0.5) * 300,
        z: (Math.random() - 0.5) * 300,
      },
      hue: 0.55 + Math.random() * 0.05, // cyan/teal — sealed capsules
      sealedUntil: unlockDate.getTime(),
    }

    this.memories.push(memory)
    this.save()
    this.onMemoryAdded?.(memory)
    return memory
  }

  /** Check if a memory is currently sealed */
  isSealed(memory: StoredMemory): boolean {
    return !!memory.sealedUntil && Date.now() < memory.sealedUntil
  }

  /** Get all memories */
  getMemories(): StoredMemory[] {
    return this.memories
  }

  /** Get count of memories */
  getCount(): number {
    return this.memories.length
  }

  /** Register callback for new memories */
  onAdd(callback: (memory: StoredMemory) => void) {
    this.onMemoryAdded = callback
  }

  /** Get a formatted view of all memories for display */
  getFormattedView(): string {
    if (this.memories.length === 0) {
      return 'no memories yet. type something and press enter.'
    }

    return this.memories
      .map(m => {
        const date = new Date(m.timestamp)
        const age = Math.floor((Date.now() - m.timestamp) / (1000 * 60 * 60 * 24))
        const degradePercent = Math.floor(m.degradation * 100)
        return `[${date.toLocaleDateString()}] ${m.currentText} (${degradePercent}% forgotten, ${age}d old)`
      })
      .join('\n')
  }
}
