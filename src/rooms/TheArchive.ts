/**
 * THE ARCHIVE — search through the ruins of the internet
 *
 * A room that connects to the real Wayback Machine CDX API to find
 * actual dead pages from the internet's history. You type a URL or
 * keyword, and the system searches the Wayback Machine for captures
 * of pages that no longer exist.
 *
 * Results are displayed as ghostly cards showing:
 * - The original URL
 * - When it was last seen alive
 * - When it died (last capture date)
 * - A snippet of the archived content (if fetchable)
 *
 * The aesthetic is a filing cabinet / card catalog in a dusty library.
 * Sepia tones, typewriter font for URLs, faded paper textures.
 *
 * This makes the Digital Decay feature concrete — instead of curated
 * dead URLs, you can actually dig through the internet's graveyard.
 *
 * Inspired by: The Wayback Machine, digital archaeology, link rot
 * research (2026: ~38% of pages from 2013 are gone), library of
 * Alexandria, Jorge Luis Borges' Library of Babel
 */

import type { Room } from './RoomManager'

interface ArchiveResult {
  url: string
  timestamp: string // YYYYMMDDHHMMSS format
  statusCode: string
  mimeType: string
  dateFormatted: string
}

// CDX API returns CSV-like format
function parseCdxLine(line: string): ArchiveResult | null {
  const parts = line.split(' ')
  if (parts.length < 6) return null
  return {
    url: parts[2] || '',
    timestamp: parts[1] || '',
    statusCode: parts[4] || '',
    mimeType: parts[3] || '',
    dateFormatted: formatTimestamp(parts[1] || ''),
  }
}

function formatTimestamp(ts: string): string {
  if (ts.length < 8) return ts
  const y = ts.slice(0, 4)
  const m = ts.slice(4, 6)
  const d = ts.slice(6, 8)
  return `${y}-${m}-${d}`
}

interface ArchiveDeps {
  onDescend?: () => void
}

export function createArchiveRoom(deps?: ArchiveDeps): Room {
  let overlay: HTMLElement | null = null
  let active = false
  let searching = false
  let searchCount = 0

  async function searchWayback(query: string): Promise<ArchiveResult[]> {
    // The CDX API lets us search for URLs matching a pattern
    // Use wildcard prefix search for domains
    const searchUrl = query.includes('.')
      ? query // treat as URL/domain
      : `*.${query}.*` // treat as keyword in URL

    const url = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(searchUrl)}&output=text&limit=20&fl=urlkey,timestamp,original,mimetype,statuscode,length&filter=mimetype:text/html&collapse=urlkey`

    const response = await fetch(url)
    if (!response.ok) return []

    const text = await response.text()
    const lines = text.trim().split('\n').filter(l => l.trim())

    return lines
      .map(parseCdxLine)
      .filter((r): r is ArchiveResult => r !== null)
  }

  function renderResults(results: ArchiveResult[], container: HTMLElement, statusEl: HTMLElement) {
    container.innerHTML = ''

    if (results.length === 0) {
      statusEl.textContent = 'nothing found in the archive. the void is absolute.'
      return
    }

    statusEl.textContent = `${results.length} ghosts found`

    for (const result of results) {
      const card = document.createElement('div')
      card.style.cssText = `
        background: rgba(40, 30, 20, 0.3);
        border: 1px solid rgba(180, 160, 120, 0.08);
        padding: 14px 18px;
        margin-bottom: 8px;
        transition: border-color 0.3s ease, background 0.3s ease;
        cursor: pointer;
      `
      card.addEventListener('mouseenter', () => {
        card.style.borderColor = 'rgba(180, 160, 120, 0.25)'
        card.style.background = 'rgba(40, 30, 20, 0.5)'
      })
      card.addEventListener('mouseleave', () => {
        card.style.borderColor = 'rgba(180, 160, 120, 0.08)'
        card.style.background = 'rgba(40, 30, 20, 0.3)'
      })

      // URL
      const urlEl = document.createElement('div')
      urlEl.style.cssText = `
        font-family: 'Courier New', monospace;
        font-size: 12px;
        color: rgba(180, 160, 120, 0.5);
        word-break: break-all;
        margin-bottom: 6px;
      `
      urlEl.textContent = result.url
      card.appendChild(urlEl)

      // Date and status
      const meta = document.createElement('div')
      meta.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-size: 11px; font-style: italic;
        color: rgba(180, 160, 120, 0.25);
      `
      const status = result.statusCode === '200' ? 'captured' : `status ${result.statusCode}`
      meta.textContent = `last seen: ${result.dateFormatted} · ${status}`
      card.appendChild(meta)

      // Click to open in Wayback Machine
      card.addEventListener('click', () => {
        window.open(
          `https://web.archive.org/web/${result.timestamp}/${result.url}`,
          '_blank'
        )
      })

      container.appendChild(card)
    }
  }

  return {
    name: 'archive',
    label: 'the archive',

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        display: flex; flex-direction: column;
        align-items: center;
        height: 100%;
        pointer-events: auto;
        background: rgba(15, 12, 8, 0.95);
        overflow-y: auto;
        scrollbar-width: none;
      `

      const style = document.createElement('style')
      style.textContent = `
        .archive-scroll::-webkit-scrollbar { display: none; }
      `
      overlay.appendChild(style)
      overlay.classList.add('archive-scroll')

      // Title
      const title = document.createElement('div')
      title.style.cssText = `
        margin-top: 40px;
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 14px;
        color: rgba(180, 160, 120, 0.4);
        letter-spacing: 4px; text-transform: uppercase;
      `
      title.textContent = 'the archive'
      overlay.appendChild(title)

      const sub = document.createElement('div')
      sub.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 12px; font-style: italic;
        color: rgba(180, 160, 120, 0.2);
        margin-top: 6px; margin-bottom: 24px;
        text-align: center; max-width: 400px;
      `
      sub.textContent = 'search the wayback machine for ghosts of the internet'
      overlay.appendChild(sub)

      // Search input
      const searchArea = document.createElement('div')
      searchArea.style.cssText = `
        display: flex; gap: 10px; align-items: center;
        width: 480px; max-width: 90vw;
        margin-bottom: 16px;
      `

      const input = document.createElement('input')
      input.type = 'text'
      input.placeholder = 'enter a URL or domain (e.g. geocities.com)...'
      input.style.cssText = `
        flex: 1;
        background: transparent;
        border: none;
        border-bottom: 1px solid rgba(180, 160, 120, 0.15);
        color: rgba(180, 160, 120, 0.6);
        font-family: 'Courier New', monospace;
        font-size: 13px;
        padding: 10px 0;
        outline: none;
        caret-color: rgba(180, 160, 120, 0.5);
      `

      const searchBtn = document.createElement('button')
      searchBtn.textContent = 'dig'
      searchBtn.style.cssText = `
        background: transparent;
        border: 1px solid rgba(180, 160, 120, 0.2);
        color: rgba(180, 160, 120, 0.4);
        font-family: 'Cormorant Garamond', serif;
        font-size: 13px; padding: 6px 20px;
        cursor: pointer; border-radius: 2px;
        letter-spacing: 2px; text-transform: uppercase;
        transition: all 0.3s ease;
      `
      searchBtn.addEventListener('mouseenter', () => {
        searchBtn.style.borderColor = 'rgba(180, 160, 120, 0.5)'
        searchBtn.style.color = 'rgba(180, 160, 120, 0.8)'
      })
      searchBtn.addEventListener('mouseleave', () => {
        searchBtn.style.borderColor = 'rgba(180, 160, 120, 0.2)'
        searchBtn.style.color = 'rgba(180, 160, 120, 0.4)'
      })

      searchArea.appendChild(input)
      searchArea.appendChild(searchBtn)
      overlay.appendChild(searchArea)

      // Status
      const status = document.createElement('div')
      status.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 12px; font-style: italic;
        color: rgba(180, 160, 120, 0.2);
        margin-bottom: 16px;
        min-height: 18px;
      `
      overlay.appendChild(status)

      // Results container
      const results = document.createElement('div')
      results.style.cssText = `
        width: 480px; max-width: 90vw;
        margin-bottom: 40px;
      `
      overlay.appendChild(results)

      // Curated suggestions
      const suggestions = document.createElement('div')
      suggestions.style.cssText = `
        display: flex; flex-wrap: wrap; gap: 8px;
        justify-content: center;
        width: 480px; max-width: 90vw;
        margin-bottom: 24px;
      `

      const curated = [
        'geocities.com', 'vine.co', 'myspace.com',
        'stumbleupon.com', 'reader.google.com', 'del.icio.us',
        'friendster.com', 'digg.com',
      ]

      for (const url of curated) {
        const chip = document.createElement('span')
        chip.style.cssText = `
          font-family: 'Courier New', monospace;
          font-size: 10px;
          color: rgba(180, 160, 120, 0.25);
          border: 1px solid rgba(180, 160, 120, 0.08);
          padding: 4px 10px;
          cursor: pointer;
          transition: all 0.3s ease;
        `
        chip.textContent = url
        chip.addEventListener('mouseenter', () => {
          chip.style.borderColor = 'rgba(180, 160, 120, 0.3)'
          chip.style.color = 'rgba(180, 160, 120, 0.5)'
        })
        chip.addEventListener('mouseleave', () => {
          chip.style.borderColor = 'rgba(180, 160, 120, 0.08)'
          chip.style.color = 'rgba(180, 160, 120, 0.25)'
        })
        chip.addEventListener('click', () => {
          input.value = url
          doSearch()
        })
        suggestions.appendChild(chip)
      }
      overlay.appendChild(suggestions)

      // Hint
      const hint = document.createElement('div')
      hint.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 10px; font-style: italic;
        color: rgba(180, 160, 120, 0.1);
        margin-bottom: 40px;
        text-align: center;
      `
      hint.textContent = '~38% of web pages from 2013 no longer exist. what did they hold?'
      overlay.appendChild(hint)

      // Hidden descent link — appears after 2+ searches
      const descent = document.createElement('div')
      descent.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 11px; font-style: italic;
        color: rgba(180, 160, 120, 0);
        letter-spacing: 2px;
        cursor: pointer;
        transition: color 1s ease;
        margin-bottom: 40px;
        text-align: center;
      `
      descent.textContent = '▼ descend deeper'
      descent.addEventListener('mouseenter', () => {
        if (searchCount >= 2) descent.style.color = 'rgba(180, 160, 120, 0.4)'
      })
      descent.addEventListener('mouseleave', () => {
        if (searchCount >= 2) descent.style.color = 'rgba(180, 160, 120, 0.12)'
      })
      descent.addEventListener('click', () => {
        if (searchCount >= 2 && deps?.onDescend) deps.onDescend()
      })
      overlay.appendChild(descent)

      async function doSearch() {
        const query = input.value.trim()
        if (!query || searching) return

        searching = true
        status.textContent = 'searching the archive...'
        status.style.color = 'rgba(180, 160, 120, 0.4)'
        results.innerHTML = ''

        try {
          const data = await searchWayback(query)
          renderResults(data, results, status)
          searchCount++
          // Reveal descent link after 2 searches
          if (searchCount >= 2 && deps?.onDescend) {
            descent.style.color = 'rgba(180, 160, 120, 0.12)'
          }
        } catch {
          status.textContent = 'the archive is unreachable. try again.'
        } finally {
          searching = false
        }
      }

      input.addEventListener('keydown', (e) => {
        e.stopPropagation()
        if (e.key === 'Enter') doSearch()
      })
      searchBtn.addEventListener('click', doSearch)

      return overlay
    },

    activate() {
      active = true
    },

    deactivate() {
      active = false
    },

    destroy() {
      overlay?.remove()
    },
  }
}
