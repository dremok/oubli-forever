/**
 * OUBLI SERVER — the nervous system's shared memory
 *
 * A minimal Node.js server that:
 * 1. Serves the static Vite build from dist/
 * 2. Provides API routes for shared state between all visitors
 *
 * Shared state is in-memory — it resets on deploy, which is poetic.
 * The collective memory also forgets. Each deployment is a new season.
 *
 * API Routes:
 * - POST /api/seeds     — plant a seed (shared across all visitors)
 * - GET  /api/seeds     — harvest seeds for a room
 * - GET  /api/pulse     — get the collective pulse (visitor count, system state)
 * - POST /api/pulse     — contribute to the collective pulse
 */

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'

const PORT = process.env.PORT || 3000
const DIST_DIR = join(import.meta.dirname, 'dist')

// --- Shared State (resets on deploy — each deploy is a new season) ---

/** @type {{ room: string, text: string, plantedAt: number, plantedBy: string }[]} */
const sharedSeeds = []

/** @type {{ totalVisits: number, activeRooms: Map<string, number>, lastActivity: number }} */
const collectivePulse = {
  totalVisits: 0,
  activeRooms: new Map(),
  lastActivity: Date.now(),
}

// --- Collective Footprints (room visits + traversals across ALL visitors) ---

/** @type {Map<string, { visits: number, uniqueVisitors: Set<string>, lastVisit: number }>} */
const roomFootprints = new Map()

/** @type {Map<string, { traversals: number, uniqueVisitors: Set<string> }>} */
const edgeFootprints = new Map()

/** @type {Map<string, { room: string, lastSeen: number }>} */
const activeVisitors = new Map()

/** @type {{ text: string, droppedBy: string, droppedAt: number }[]} */
const wellEchoes = []

/** @type {{ semitone: number, velocity: number, playedBy: string, playedAt: number }[]} */
const instrumentNotes = []

/** @type {{ text: string, plantedBy: string, plantedAt: number, degradation: number }[]} */
const gardenPlants = []

// Prune old room activity every 30s
setInterval(() => {
  const cutoff = Date.now() - 60000 // 1 minute
  for (const [room, ts] of collectivePulse.activeRooms) {
    if (ts < cutoff) collectivePulse.activeRooms.delete(room)
  }
  // Prune inactive visitors (no heartbeat for 2 minutes)
  const visitorCutoff = Date.now() - 120000
  for (const [vid, info] of activeVisitors) {
    if (info.lastSeen < visitorCutoff) activeVisitors.delete(vid)
  }
}, 30000)

// --- MIME types ---

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.map': 'application/json',
}

// --- API handlers ---

async function handleAPI(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Visitor-Id')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return true
  }

  // POST /api/seeds — plant a shared seed
  if (url.pathname === '/api/seeds' && req.method === 'POST') {
    const body = await readBody(req)
    try {
      const { room, text } = JSON.parse(body)
      if (!room || !text) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'room and text required' }))
        return true
      }

      // Generate a visitor fingerprint (anonymous)
      const visitor = req.headers['x-visitor-id'] || 'anonymous'

      sharedSeeds.push({
        room,
        text,
        plantedAt: Date.now(),
        plantedBy: visitor,
      })

      // Keep max 500 seeds (oldest fall away)
      if (sharedSeeds.length > 500) sharedSeeds.shift()

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, totalSeeds: sharedSeeds.length }))
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'invalid JSON' }))
    }
    return true
  }

  // GET /api/seeds?room=X — harvest seeds for a room
  if (url.pathname === '/api/seeds' && req.method === 'GET') {
    const room = url.searchParams.get('room')
    const visitor = req.headers['x-visitor-id'] || 'anonymous'

    const seeds = room
      ? sharedSeeds.filter(s => s.room === room && s.plantedBy !== visitor)
      : sharedSeeds.filter(s => s.plantedBy !== visitor)

    // Return max 5 seeds per request (don't overwhelm)
    const result = seeds.slice(-5).map(s => ({
      room: s.room,
      text: s.text,
      plantedAt: s.plantedAt,
      isOther: true,
    }))

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
    return true
  }

  // POST /api/pulse — contribute to collective pulse
  if (url.pathname === '/api/pulse' && req.method === 'POST') {
    const body = await readBody(req)
    try {
      const { room } = JSON.parse(body)
      collectivePulse.totalVisits++
      if (room) collectivePulse.activeRooms.set(room, Date.now())
      collectivePulse.lastActivity = Date.now()

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'invalid JSON' }))
    }
    return true
  }

  // GET /api/pulse — get collective pulse
  if (url.pathname === '/api/pulse' && req.method === 'GET') {
    const activeRoomList = Object.fromEntries(collectivePulse.activeRooms)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      totalVisits: collectivePulse.totalVisits,
      activeRooms: activeRoomList,
      seedCount: sharedSeeds.length,
      lastActivity: collectivePulse.lastActivity,
    }))
    return true
  }

  // POST /api/footprints — record a room visit + traversal
  if (url.pathname === '/api/footprints' && req.method === 'POST') {
    const body = await readBody(req)
    try {
      const { room, from } = JSON.parse(body)
      const visitor = req.headers['x-visitor-id'] || 'anonymous'
      if (!room) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'room required' }))
        return true
      }

      // Record room visit
      if (!roomFootprints.has(room)) {
        roomFootprints.set(room, { visits: 0, uniqueVisitors: new Set(), lastVisit: 0 })
      }
      const rf = roomFootprints.get(room)
      rf.visits++
      rf.uniqueVisitors.add(visitor)
      rf.lastVisit = Date.now()

      // Record edge traversal
      if (from && from !== room) {
        const edgeKey = [from, room].sort().join('--')
        if (!edgeFootprints.has(edgeKey)) {
          edgeFootprints.set(edgeKey, { traversals: 0, uniqueVisitors: new Set() })
        }
        const ef = edgeFootprints.get(edgeKey)
        ef.traversals++
        ef.uniqueVisitors.add(visitor)
      }

      // Update active visitors
      activeVisitors.set(visitor, { room, lastSeen: Date.now() })

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'invalid JSON' }))
    }
    return true
  }

  // GET /api/footprints — get collective footprint data
  if (url.pathname === '/api/footprints' && req.method === 'GET') {
    const rooms = {}
    for (const [name, data] of roomFootprints) {
      rooms[name] = {
        visits: data.visits,
        uniqueVisitors: data.uniqueVisitors.size,
        lastVisit: data.lastVisit,
      }
    }
    const edges = {}
    for (const [key, data] of edgeFootprints) {
      edges[key] = {
        traversals: data.traversals,
        uniqueVisitors: data.uniqueVisitors.size,
      }
    }
    // Active visitors: just room distribution (no identifying info)
    const activeRoomCounts = {}
    for (const [, info] of activeVisitors) {
      activeRoomCounts[info.room] = (activeRoomCounts[info.room] || 0) + 1
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      rooms,
      edges,
      activeVisitors: activeVisitors.size,
      activeRoomCounts,
    }))
    return true
  }

  // POST /api/well/echoes — drop words into the shared well
  if (url.pathname === '/api/well/echoes' && req.method === 'POST') {
    const body = await readBody(req)
    try {
      const { text } = JSON.parse(body)
      const visitor = req.headers['x-visitor-id'] || 'anonymous'
      if (!text || text.length > 500) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'text required (max 500 chars)' }))
        return true
      }
      wellEchoes.push({ text, droppedBy: visitor, droppedAt: Date.now() })
      // Keep max 200 echoes
      if (wellEchoes.length > 200) wellEchoes.shift()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, totalEchoes: wellEchoes.length }))
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'invalid JSON' }))
    }
    return true
  }

  // GET /api/well/echoes — hear echoes from other visitors
  if (url.pathname === '/api/well/echoes' && req.method === 'GET') {
    const visitor = req.headers['x-visitor-id'] || 'anonymous'
    // Return up to 5 echoes from OTHER visitors, weighted toward recent
    const otherEchoes = wellEchoes.filter(e => e.droppedBy !== visitor)
    // Shuffle and pick 5
    const shuffled = otherEchoes.sort(() => Math.random() - 0.5).slice(0, 5)
    const result = shuffled.map(e => ({
      text: e.text,
      age: Date.now() - e.droppedAt,
    }))
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ echoes: result, totalEchoes: wellEchoes.length }))
    return true
  }

  // POST /api/instrument/notes — share played notes
  if (url.pathname === '/api/instrument/notes' && req.method === 'POST') {
    const body = await readBody(req)
    try {
      const { notes } = JSON.parse(body) // array of { semitone, velocity }
      const visitor = req.headers['x-visitor-id'] || 'anonymous'
      if (!Array.isArray(notes) || notes.length === 0 || notes.length > 20) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'notes array required (1-20)' }))
        return true
      }
      for (const n of notes) {
        instrumentNotes.push({
          semitone: n.semitone,
          velocity: n.velocity || 0.8,
          playedBy: visitor,
          playedAt: Date.now(),
        })
      }
      // Keep max 500 notes
      while (instrumentNotes.length > 500) instrumentNotes.shift()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, totalNotes: instrumentNotes.length }))
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'invalid JSON' }))
    }
    return true
  }

  // GET /api/instrument/notes — fetch ghost notes from other visitors
  if (url.pathname === '/api/instrument/notes' && req.method === 'GET') {
    const visitor = req.headers['x-visitor-id'] || 'anonymous'
    // Return up to 3 phrases (each 3-8 notes) from other visitors
    const otherNotes = instrumentNotes.filter(n => n.playedBy !== visitor)
    // Group consecutive notes by visitor into phrases
    const phrases = []
    let currentPhrase = []
    let currentVisitor = ''
    for (const n of otherNotes) {
      if (n.playedBy !== currentVisitor && currentPhrase.length > 0) {
        phrases.push([...currentPhrase])
        currentPhrase = []
      }
      currentVisitor = n.playedBy
      currentPhrase.push({ semitone: n.semitone, velocity: n.velocity })
      if (currentPhrase.length >= 8) {
        phrases.push([...currentPhrase])
        currentPhrase = []
      }
    }
    if (currentPhrase.length >= 3) phrases.push(currentPhrase)
    // Return random 3 phrases
    const shuffled = phrases.sort(() => Math.random() - 0.5).slice(0, 3)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ phrases: shuffled, totalNotes: instrumentNotes.length }))
    return true
  }

  // POST /api/garden/plants — share a planted memory
  if (url.pathname === '/api/garden/plants' && req.method === 'POST') {
    const body = await readBody(req)
    try {
      const { text } = JSON.parse(body)
      const visitor = req.headers['x-visitor-id'] || 'anonymous'
      if (!text || text.length > 500) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'text required (max 500 chars)' }))
        return true
      }
      gardenPlants.push({
        text,
        plantedBy: visitor,
        plantedAt: Date.now(),
        degradation: 0,
      })
      // Keep max 100 plants
      while (gardenPlants.length > 100) gardenPlants.shift()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, totalPlants: gardenPlants.length }))
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'invalid JSON' }))
    }
    return true
  }

  // GET /api/garden/plants — fetch shared plants from other visitors
  if (url.pathname === '/api/garden/plants' && req.method === 'GET') {
    const visitor = req.headers['x-visitor-id'] || 'anonymous'
    const otherPlants = gardenPlants.filter(p => p.plantedBy !== visitor)
    // Return up to 8 plants, weighted toward recent
    const result = otherPlants.slice(-8).map(p => ({
      text: p.text,
      age: Date.now() - p.plantedAt,
      degradation: Math.min(0.9, (Date.now() - p.plantedAt) / (24 * 60 * 60 * 1000)), // degrade over 24h
    }))
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ plants: result, totalPlants: gardenPlants.length }))
    return true
  }

  return false // not an API route
}

// --- Static file serving ---

async function serveStatic(req, res) {
  let url = new URL(req.url, `http://localhost:${PORT}`)
  let filePath = join(DIST_DIR, url.pathname === '/' ? 'index.html' : url.pathname)

  try {
    const fileStat = await stat(filePath)
    if (fileStat.isDirectory()) {
      filePath = join(filePath, 'index.html')
    }

    const data = await readFile(filePath)
    const ext = extname(filePath)
    const mime = MIME[ext] || 'application/octet-stream'

    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
    })
    res.end(data)
  } catch {
    // SPA fallback — serve index.html for any unmatched route
    try {
      const data = await readFile(join(DIST_DIR, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' })
      res.end(data)
    } catch {
      res.writeHead(404)
      res.end('not found')
    }
  }
}

// --- Helpers ---

function readBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => resolve(body))
  })
}

// --- Server ---

const server = createServer(async (req, res) => {
  // Try API routes first
  const handled = await handleAPI(req, res)
  if (handled) return

  // Serve static files
  await serveStatic(req, res)
})

server.listen(PORT, () => {
  console.log(`🍊 Oubli server listening on port ${PORT}`)
  console.log(`   Shared state: in-memory (resets on deploy — each season forgets)`)
})
