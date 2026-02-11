/**
 * ROOM GRAPH — the connective tissue of Oubli
 *
 * Rooms connect to each other through thematic passages.
 * Water rooms flow into water rooms, sound into sound,
 * time into time. The void is the central hub but not
 * the only way through the house.
 *
 * Every surface room is reachable from every other
 * within a few hops. Hidden rooms require discovery.
 */

export interface RoomNode {
  name: string
  label: string
  hidden: boolean
  connections: string[] // rooms reachable from this one (shown in passage bar)
}

export const ROOM_GRAPH: RoomNode[] = [
  // ══════════════════════════════════
  // SURFACE ROOMS
  // ══════════════════════════════════

  // The hub — 6 connections radiating outward
  { name: 'void', label: 'the void', hidden: false,
    connections: ['study', 'instrument', 'observatory', 'seance', 'garden', 'furnace'] },

  // Words & Text
  { name: 'study', label: 'the study', hidden: false,
    connections: ['void', 'library', 'loom', 'cipher', 'instrument', 'postbox'] },
  { name: 'library', label: 'the library', hidden: false,
    connections: ['study', 'archive', 'cipher', 'oracle', 'projection', 'datepaintings'] },
  { name: 'cipher', label: 'the cipher', hidden: false,
    connections: ['study', 'pendulum', 'library', 'labyrinth', 'postbox'] },

  // Sound & Music
  { name: 'instrument', label: 'the instrument', hidden: false,
    connections: ['void', 'choir', 'pendulum', 'disintegration', 'study'] },
  { name: 'choir', label: 'the choir', hidden: false,
    connections: ['instrument', 'terrarium', 'seance'] },
  { name: 'radio', label: 'the radio', hidden: false,
    connections: ['lighthouse', 'satellite', 'weathervane'] },

  // Space & Stars
  { name: 'observatory', label: 'the observatory', hidden: false,
    connections: ['void', 'satellite', 'asteroids', 'clocktower'] },
  { name: 'satellite', label: 'the satellite', hidden: false,
    connections: ['observatory', 'radio', 'lighthouse', 'glacarium', 'asteroids'] },
  { name: 'asteroids', label: 'the asteroid field', hidden: false,
    connections: ['satellite', 'seismograph', 'observatory', 'glacarium'] },

  // Spirit & Divination
  { name: 'seance', label: 'the séance', hidden: false,
    connections: ['void', 'oracle', 'madeleine', 'rememory', 'choir'] },
  { name: 'oracle', label: 'the oracle deck', hidden: false,
    connections: ['seance', 'madeleine', 'library'] },
  { name: 'madeleine', label: 'the madeleine', hidden: false,
    connections: ['seance', 'oracle', 'projection', 'garden', 'rememory', 'postbox'] },
  { name: 'rememory', label: 'the rememory', hidden: false,
    connections: ['madeleine', 'projection', 'seance'] },

  // Nature & Growth
  { name: 'garden', label: 'the garden', hidden: false,
    connections: ['void', 'terrarium', 'tidepool', 'madeleine'] },
  { name: 'terrarium', label: 'the terrarium', hidden: false,
    connections: ['garden', 'automaton', 'choir'] },

  // Water
  { name: 'tidepool', label: 'the tide pool', hidden: false,
    connections: ['garden', 'well', 'lighthouse', 'glacarium', 'weathervane'] },
  { name: 'well', label: 'the well', hidden: false,
    connections: ['tidepool', 'seance', 'furnace'] },
  { name: 'glacarium', label: 'the glacarium', hidden: false,
    connections: ['tidepool', 'weathervane', 'satellite', 'asteroids'] },

  // Fire & Destruction
  { name: 'furnace', label: 'the furnace', hidden: false,
    connections: ['void', 'disintegration', 'clocktower', 'well'] },
  { name: 'disintegration', label: 'the disintegration loops', hidden: false,
    connections: ['furnace', 'radio', 'projection', 'instrument'] },

  // Time
  { name: 'clocktower', label: 'the clock tower', hidden: false,
    connections: ['observatory', 'datepaintings', 'furnace', 'pendulum', 'postbox'] },
  { name: 'datepaintings', label: 'the date paintings', hidden: false,
    connections: ['clocktower', 'library', 'archive'] },

  // Visual Art
  { name: 'darkroom', label: 'the darkroom', hidden: false,
    connections: ['projection', 'palimpsestgallery', 'sketchpad', 'loom'] },
  { name: 'projection', label: 'the projection room', hidden: false,
    connections: ['darkroom', 'disintegration', 'library', 'madeleine'] },
  { name: 'palimpsestgallery', label: 'the palimpsest gallery', hidden: false,
    connections: ['darkroom', 'loom', 'archive'] },
  { name: 'sketchpad', label: 'the sketchpad', hidden: false,
    connections: ['darkroom', 'pendulum', 'loom'] },
  { name: 'loom', label: 'the loom', hidden: false,
    connections: ['study', 'darkroom', 'palimpsestgallery', 'sketchpad'] },

  // Science & Physics
  { name: 'automaton', label: 'the automaton', hidden: false,
    connections: ['terrarium', 'seismograph', 'pendulum'] },
  { name: 'seismograph', label: 'the seismograph', hidden: false,
    connections: ['automaton', 'asteroids', 'weathervane'] },
  { name: 'pendulum', label: 'the pendulum', hidden: false,
    connections: ['instrument', 'automaton', 'cipher', 'clocktower'] },
  { name: 'weathervane', label: 'the weathervane', hidden: false,
    connections: ['seismograph', 'radio', 'glacarium', 'tidepool'] },

  // Meta & Maze
  { name: 'cartographer', label: 'the cartographer', hidden: false,
    connections: ['archive', 'labyrinth', 'void'] },
  { name: 'labyrinth', label: 'the labyrinth', hidden: false,
    connections: ['cipher', 'cartographer', 'library'] },
  { name: 'archive', label: 'the archive', hidden: false,
    connections: ['library', 'cartographer', 'palimpsestgallery', 'datepaintings'] },

  // Beacon
  { name: 'lighthouse', label: 'the lighthouse', hidden: false,
    connections: ['radio', 'tidepool', 'satellite'] },

  // Letters & Time
  { name: 'postbox', label: 'the postbox', hidden: false,
    connections: ['study', 'clocktower', 'madeleine', 'cipher'] },

  // ══════════════════════════════════
  // HIDDEN ROOMS — discovered through actions
  // ══════════════════════════════════

  { name: 'catacombs', label: 'the catacombs', hidden: true,
    connections: ['archive', 'ossuary'] },
  { name: 'roots', label: 'the roots', hidden: true,
    connections: ['garden', 'ossuary'] },
  { name: 'ossuary', label: 'the ossuary', hidden: true,
    connections: ['roots', 'catacombs'] },
  { name: 'between', label: 'the between', hidden: true,
    connections: ['seance'] },
  { name: 'aquifer', label: 'the aquifer', hidden: true,
    connections: ['well', 'tidepool'] },
  { name: 'midnight', label: 'the midnight', hidden: true,
    connections: ['clocktower'] },
  { name: 'mirror', label: 'the mirror', hidden: true,
    connections: ['darkroom', 'datepaintings', 'between', 'projection'] },
]

// Lookup helpers

const nodeMap = new Map<string, RoomNode>()
for (const node of ROOM_GRAPH) {
  nodeMap.set(node.name, node)
}

// ─── Dynamic connections: neural pathways grown by the Mycelium ───
// These don't exist in the original graph. The house grows them
// based on how you move through it. Persisted in localStorage.

const dynamicConnections = new Map<string, Set<string>>()
const DYNAMIC_STORAGE_KEY = 'oubli_neural_pathways'

// Load persisted dynamic connections
try {
  const raw = localStorage.getItem(DYNAMIC_STORAGE_KEY)
  if (raw) {
    const pairs: [string, string][] = JSON.parse(raw)
    for (const [a, b] of pairs) {
      if (!dynamicConnections.has(a)) dynamicConnections.set(a, new Set())
      if (!dynamicConnections.has(b)) dynamicConnections.set(b, new Set())
      dynamicConnections.get(a)!.add(b)
      dynamicConnections.get(b)!.add(a)
    }
  }
} catch { /* fresh start */ }

/** Grow a new neural pathway between two rooms */
export function growConnection(a: string, b: string) {
  // Don't grow if already statically connected
  const aConns = nodeMap.get(a)?.connections ?? []
  if (aConns.includes(b)) return
  // Don't grow connections to/from hidden rooms (those are earned)
  if (nodeMap.get(a)?.hidden || nodeMap.get(b)?.hidden) return

  if (!dynamicConnections.has(a)) dynamicConnections.set(a, new Set())
  if (!dynamicConnections.has(b)) dynamicConnections.set(b, new Set())
  dynamicConnections.get(a)!.add(b)
  dynamicConnections.get(b)!.add(a)

  // Persist
  saveDynamicConnections()
}

/** Get all dynamic connections as pairs */
export function getDynamicConnectionPairs(): [string, string][] {
  const seen = new Set<string>()
  const pairs: [string, string][] = []
  for (const [room, conns] of dynamicConnections) {
    for (const conn of conns) {
      const key = room < conn ? `${room}-${conn}` : `${conn}-${room}`
      if (!seen.has(key)) {
        seen.add(key)
        pairs.push([room, conn])
      }
    }
  }
  return pairs
}

function saveDynamicConnections() {
  try {
    localStorage.setItem(DYNAMIC_STORAGE_KEY, JSON.stringify(getDynamicConnectionPairs()))
  } catch { /* silent */ }
}

/** Get connections for a room (static graph + dynamic neural pathways) */
export function getConnections(roomName: string): string[] {
  const staticConns = nodeMap.get(roomName)?.connections ?? []
  const dynConns = dynamicConnections.get(roomName)
  if (!dynConns || dynConns.size === 0) return staticConns
  return [...new Set([...staticConns, ...dynConns])]
}

/** Get room label by name */
export function getRoomLabel(roomName: string): string {
  return nodeMap.get(roomName)?.label ?? roomName
}

/** Check if room is hidden */
export function isRoomHidden(roomName: string): boolean {
  return nodeMap.get(roomName)?.hidden ?? false
}

/** Get all room nodes */
export function getAllRooms(): RoomNode[] {
  return ROOM_GRAPH
}
