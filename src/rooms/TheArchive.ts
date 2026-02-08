/**
 * THE ARCHIVE — search through the world's library
 *
 * A room that connects to the Open Library Search API to find
 * books across the entirety of recorded human knowledge. You type
 * a subject, title, or author, and the system searches for matching
 * books with their covers, publication dates, and editions.
 *
 * Results are displayed as archival cards showing:
 * - The book cover image
 * - Title and author
 * - First publication year
 * - Edition count and subjects
 *
 * The aesthetic is a filing cabinet / card catalog in a dusty library.
 * Sepia tones, typewriter font for metadata, faded paper textures.
 *
 * Inspired by: Borges' Library of Babel, the archive as memory palace,
 * Open Library's mission to catalog every book ever published
 */

import type { Room } from './RoomManager'

interface BookResult {
  title: string
  author: string
  firstPublishYear: number | null
  coverId: number | null
  key: string
  editionCount: number
  pageCount: number | null
  subjects: string[]
}

interface ArchiveDeps {
  onDescend?: () => void
  switchTo?: (name: string) => void
}

export function createArchiveRoom(deps?: ArchiveDeps): Room {
  let overlay: HTMLElement | null = null
  let active = false
  let searching = false
  let searchCount = 0

  async function searchBooks(query: string): Promise<BookResult[]> {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=20`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)
      if (!response.ok) return []

      const json = await response.json()
      const docs: any[] = json.docs || []

      return docs.map((doc: any) => ({
        title: doc.title || 'Untitled',
        author: Array.isArray(doc.author_name) ? doc.author_name[0] || 'Unknown' : 'Unknown',
        firstPublishYear: typeof doc.first_publish_year === 'number' ? doc.first_publish_year : null,
        coverId: typeof doc.cover_i === 'number' ? doc.cover_i : null,
        key: doc.key || '',
        editionCount: typeof doc.edition_count === 'number' ? doc.edition_count : 0,
        pageCount: typeof doc.number_of_pages_median === 'number' ? doc.number_of_pages_median : null,
        subjects: Array.isArray(doc.subject) ? doc.subject.slice(0, 4) : [],
      }))
    } catch (err) {
      clearTimeout(timeoutId)
      throw err
    }
  }

  function renderResults(books: BookResult[], container: HTMLElement, statusEl: HTMLElement) {
    container.innerHTML = ''

    if (books.length === 0) {
      statusEl.textContent = 'nothing found in the archive. the shelves are bare.'
      return
    }

    statusEl.textContent = `${books.length} books unearthed`

    for (const book of books) {
      const card = document.createElement('div')
      card.style.cssText = `
        background: rgba(40, 30, 20, 0.3);
        border: 1px solid rgba(180, 160, 120, 0.08);
        padding: 14px 18px;
        margin-bottom: 8px;
        transition: border-color 0.3s ease, background 0.3s ease;
        cursor: pointer;
        display: flex;
        gap: 14px;
        align-items: flex-start;
      `
      card.addEventListener('mouseenter', () => {
        card.style.borderColor = 'rgba(180, 160, 120, 0.25)'
        card.style.background = 'rgba(40, 30, 20, 0.5)'
      })
      card.addEventListener('mouseleave', () => {
        card.style.borderColor = 'rgba(180, 160, 120, 0.08)'
        card.style.background = 'rgba(40, 30, 20, 0.3)'
      })

      // Cover image
      if (book.coverId) {
        const img = document.createElement('img')
        img.src = `https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg`
        img.alt = book.title
        img.style.cssText = `
          width: 50px;
          min-width: 50px;
          height: 72px;
          object-fit: cover;
          opacity: 0.7;
          filter: sepia(0.4);
          border: 1px solid rgba(180, 160, 120, 0.1);
        `
        img.addEventListener('error', () => { img.style.display = 'none' })
        card.appendChild(img)
      }

      // Text content
      const textCol = document.createElement('div')
      textCol.style.cssText = `flex: 1; min-width: 0;`

      // Title
      const titleEl = document.createElement('div')
      titleEl.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-size: 14px;
        color: rgba(180, 160, 120, 0.6);
        margin-bottom: 4px;
        line-height: 1.3;
      `
      titleEl.textContent = book.title
      textCol.appendChild(titleEl)

      // Author
      const authorEl = document.createElement('div')
      authorEl.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-size: 12px; font-style: italic;
        color: rgba(180, 160, 120, 0.35);
        margin-bottom: 4px;
      `
      authorEl.textContent = book.author
      textCol.appendChild(authorEl)

      // Meta line: year, editions, pages
      const meta = document.createElement('div')
      meta.style.cssText = `
        font-family: 'Courier New', monospace;
        font-size: 10px;
        color: rgba(180, 160, 120, 0.2);
        margin-bottom: 4px;
      `
      const parts: string[] = []
      if (book.firstPublishYear) parts.push(`first published ${book.firstPublishYear}`)
      if (book.editionCount > 0) parts.push(`${book.editionCount} edition${book.editionCount === 1 ? '' : 's'}`)
      if (book.pageCount) parts.push(`~${book.pageCount} pages`)
      meta.textContent = parts.join(' · ')
      textCol.appendChild(meta)

      // Subjects
      if (book.subjects.length > 0) {
        const subjectsEl = document.createElement('div')
        subjectsEl.style.cssText = `
          font-family: 'Cormorant Garamond', serif;
          font-size: 10px; font-style: italic;
          color: rgba(180, 160, 120, 0.15);
          line-height: 1.4;
        `
        subjectsEl.textContent = book.subjects.join(', ')
        textCol.appendChild(subjectsEl)
      }

      card.appendChild(textCol)

      // Click to open on Open Library
      card.addEventListener('click', () => {
        if (book.key) {
          window.open(`https://openlibrary.org${book.key}`, '_blank')
        }
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
      sub.textContent = 'search through the world\'s library \u2014 every book ever written'
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
      input.placeholder = 'a title, author, or subject...'
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
      searchBtn.textContent = 'search'
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
        'memory', 'forgetting', 'time', 'dreams',
        'loss', 'ruins', 'labyrinth', 'photographs',
      ]

      for (const term of curated) {
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
        chip.textContent = term
        chip.addEventListener('mouseenter', () => {
          chip.style.borderColor = 'rgba(180, 160, 120, 0.3)'
          chip.style.color = 'rgba(180, 160, 120, 0.5)'
        })
        chip.addEventListener('mouseleave', () => {
          chip.style.borderColor = 'rgba(180, 160, 120, 0.08)'
          chip.style.color = 'rgba(180, 160, 120, 0.25)'
        })
        chip.addEventListener('click', () => {
          input.value = term
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
      hint.textContent = 'every book is a memory someone refused to let die'
      overlay.appendChild(hint)

      // Passage links to connected rooms
      if (deps?.switchTo) {
        const passageRow = document.createElement('div')
        passageRow.style.cssText = `
          display: flex; gap: 16px; justify-content: center;
          width: 480px; max-width: 90vw; margin-bottom: 20px;
        `
        const passages = [
          { label: 'library', room: 'library' },
          { label: 'cartographer', room: 'cartographer' },
          { label: 'gallery', room: 'palimpsestgallery' },
          { label: 'date paintings', room: 'datepaintings' },
        ]
        for (const p of passages) {
          const link = document.createElement('span')
          link.style.cssText = `
            font-family: 'Cormorant Garamond', serif;
            font-size: 10px; font-style: italic;
            color: rgba(180, 160, 120, 0.1);
            cursor: pointer; transition: color 0.3s ease;
            letter-spacing: 1px;
          `
          link.textContent = p.label
          link.addEventListener('mouseenter', () => { link.style.color = 'rgba(180, 160, 120, 0.4)' })
          link.addEventListener('mouseleave', () => { link.style.color = 'rgba(180, 160, 120, 0.1)' })
          link.addEventListener('click', () => deps.switchTo!(p.room))
          passageRow.appendChild(link)
        }
        overlay.appendChild(passageRow)
      }

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
      descent.textContent = '\u25bc descend deeper'
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

        // Safety: prevent double searches
        if (searching) {
          console.warn('[archive] search already in progress, skipping')
          return
        }

        if (!query) {
          status.textContent = 'type a title, author, or subject first'
          status.style.color = 'rgba(180, 160, 120, 0.3)'
          input.style.borderBottomColor = 'rgba(255, 180, 100, 0.5)'
          setTimeout(() => {
            input.style.borderBottomColor = 'rgba(180, 160, 120, 0.15)'
          }, 1500)
          input.focus()
          return
        }

        searching = true
        searchBtn.textContent = '...'
        searchBtn.style.opacity = '0.5'
        status.textContent = `searching for "${query}"...`
        status.style.color = 'rgba(180, 160, 120, 0.4)'
        results.innerHTML = ''

        try {
          const data = await searchBooks(query)
          renderResults(data, results, status)
          searchCount++
          // Reveal descent link after 2 searches
          if (searchCount >= 2 && deps?.onDescend) {
            descent.style.color = 'rgba(180, 160, 120, 0.12)'
          }
        } catch (err) {
          const errMsg = err instanceof Error && err.name === 'AbortError'
            ? 'the library took too long to respond. try again.'
            : 'the archive is unreachable. try again.'
          status.textContent = errMsg
          status.style.color = 'rgba(180, 120, 80, 0.4)'
          console.warn('[archive] search failed:', err)
        } finally {
          searching = false
          searchBtn.textContent = 'search'
          searchBtn.style.opacity = '1'
        }
      }

      input.addEventListener('keydown', (e) => {
        e.stopPropagation()
        if (e.key === 'Enter') doSearch()
      })
      searchBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()
        doSearch()
      })
      searchBtn.addEventListener('mousedown', (e) => {
        e.stopPropagation()
      })

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
