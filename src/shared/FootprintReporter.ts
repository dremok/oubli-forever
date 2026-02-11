/**
 * FOOTPRINT REPORTER — tracks collective room visits across ALL visitors
 *
 * Every time you enter a room, your footprint is recorded server-side.
 * The Cartographer (and any other room) can fetch the collective data
 * to show which rooms are popular, which paths are worn, and how many
 * visitors are currently in the house.
 *
 * Inspired by:
 * - Desire paths in parks (worn grass shows where people actually walk)
 * - Heat maps in architecture (how bodies move through space)
 * - Chiharu Shiota's threads (connections become the artwork)
 * - Ocean thermal mass (2025): every visitor's heat is absorbed, accumulated
 */

const API_BASE = '' // same origin

// Persistent anonymous visitor ID
function getVisitorId(): string {
  const KEY = 'oubli_visitor_id'
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
  }
  return id
}

export interface CollectiveFootprints {
  rooms: Record<string, { visits: number; uniqueVisitors: number; lastVisit: number }>
  edges: Record<string, { traversals: number; uniqueVisitors: number }>
  activeVisitors: number
  activeRoomCounts: Record<string, number>
}

let _prevRoom = ''

/** Report a room visit to the server (fire-and-forget) */
export function reportFootprint(room: string) {
  const from = _prevRoom
  _prevRoom = room

  const visitorId = getVisitorId()
  fetch(`${API_BASE}/api/footprints`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Visitor-Id': visitorId,
    },
    body: JSON.stringify({ room, from: from || undefined }),
  }).catch(() => { /* silent — server may not be running in dev */ })
}

/** Fetch collective footprint data */
export async function fetchFootprints(): Promise<CollectiveFootprints | null> {
  try {
    const visitorId = getVisitorId()
    const res = await fetch(`${API_BASE}/api/footprints`, {
      headers: { 'X-Visitor-Id': visitorId },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/** Drop words into the shared well */
export function dropWellEcho(text: string) {
  const visitorId = getVisitorId()
  fetch(`${API_BASE}/api/well/echoes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Visitor-Id': visitorId,
    },
    body: JSON.stringify({ text: text.slice(0, 500) }),
  }).catch(() => { /* silent */ })
}

/** Fetch echoes from other visitors in the well */
export async function fetchWellEchoes(): Promise<{ echoes: { text: string; age: number }[]; totalEchoes: number } | null> {
  try {
    const visitorId = getVisitorId()
    const res = await fetch(`${API_BASE}/api/well/echoes`, {
      headers: { 'X-Visitor-Id': visitorId },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/** Share played instrument notes with other visitors */
export function shareInstrumentNotes(notes: Array<{ semitone: number; velocity: number }>) {
  const visitorId = getVisitorId()
  fetch(`${API_BASE}/api/instrument/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Visitor-Id': visitorId,
    },
    body: JSON.stringify({ notes }),
  }).catch(() => { /* silent */ })
}

/** Fetch ghost note phrases from other visitors */
export async function fetchGhostNotes(): Promise<{ phrases: Array<Array<{ semitone: number; velocity: number }>>; totalNotes: number } | null> {
  try {
    const visitorId = getVisitorId()
    const res = await fetch(`${API_BASE}/api/instrument/notes`, {
      headers: { 'X-Visitor-Id': visitorId },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/** Share a plant/memory in the garden */
export function shareGardenPlant(text: string) {
  const visitorId = getVisitorId()
  fetch(`${API_BASE}/api/garden/plants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Visitor-Id': visitorId,
    },
    body: JSON.stringify({ text: text.slice(0, 500) }),
  }).catch(() => { /* silent */ })
}

export interface SharedPlant {
  text: string
  age: number
  degradation: number
}

/** Fetch shared plants from other visitors' gardens */
export async function fetchGardenPlants(): Promise<{ plants: SharedPlant[]; totalPlants: number } | null> {
  try {
    const visitorId = getVisitorId()
    const res = await fetch(`${API_BASE}/api/garden/plants`, {
      headers: { 'X-Visitor-Id': visitorId },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
