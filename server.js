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

// Prune old room activity every 30s
setInterval(() => {
  const cutoff = Date.now() - 60000 // 1 minute
  for (const [room, ts] of collectivePulse.activeRooms) {
    if (ts < cutoff) collectivePulse.activeRooms.delete(room)
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
