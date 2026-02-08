/**
 * THREAD TRAIL — navigation memory as red threads
 *
 * Inspired by Chiharu Shiota's "Threads of Life" (Hayward Gallery, Feb 2026)
 * — massive webs of red thread connecting objects to memories, wrapping
 * shoes, keys, beds in cocoons of connection.
 *
 * Every time you navigate between rooms, a thread is recorded.
 * Frequently-traversed paths become thicker, more vivid threads.
 * The Cartographer renders these as a web overlaying the room map.
 *
 * The threads are YOUR path through the house — your personal
 * web of connections, visible only when you step back to look.
 */

interface ThreadEdge {
  from: string
  to: string
  count: number
  lastTime: number
}

const STORAGE_KEY = 'oubli-thread-trail'

class ThreadTrail {
  private edges = new Map<string, ThreadEdge>()

  constructor() {
    this.load()
  }

  private edgeKey(a: string, b: string): string {
    return [a, b].sort().join('\u2194')
  }

  record(from: string, to: string) {
    const key = this.edgeKey(from, to)
    const existing = this.edges.get(key)
    if (existing) {
      existing.count++
      existing.lastTime = Date.now()
    } else {
      this.edges.set(key, { from, to, count: 1, lastTime: Date.now() })
    }
    this.save()
  }

  getEdges(): ThreadEdge[] {
    return [...this.edges.values()]
  }

  getTraversalCount(a: string, b: string): number {
    return this.edges.get(this.edgeKey(a, b))?.count || 0
  }

  getTotalTraversals(): number {
    let total = 0
    for (const edge of this.edges.values()) total += edge.count
    return total
  }

  getUniqueEdgeCount(): number {
    return this.edges.size
  }

  private load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) {
        const parsed = JSON.parse(data) as ThreadEdge[]
        for (const edge of parsed) {
          this.edges.set(this.edgeKey(edge.from, edge.to), edge)
        }
      }
    } catch (_) { /* silent */ }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.edges.values()]))
    } catch (_) { /* silent */ }
  }
}

export const threadTrail = new ThreadTrail()
