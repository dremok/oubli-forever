/**
 * THE CATACOMBS — beneath the archive, bones of the old internet
 *
 * A hidden room accessible ONLY from The Archive. When you search for
 * certain URLs in the archive, a faint link appears: "descend deeper."
 * Clicking it takes you here.
 *
 * The Catacombs is a scrolling descent through layers of dead internet
 * history, rendered as carved stone inscriptions. Each layer goes deeper
 * in time — 2020s, 2010s, 2000s, 1990s — and the aesthetic degrades
 * with each era. The deepest layer is raw HTML source code from the
 * earliest web pages.
 *
 * The room auto-scrolls downward slowly. You can scroll faster. At the
 * bottom, there's nothing — just void. The descent is the experience.
 *
 * This room is NOT in the tab bar. It can only be reached through
 * The Archive, and you return to The Archive when you leave.
 *
 * Inspired by: Paris catacombs, geological strata, archaeological digs,
 * internet archaeology, the Deep Web metaphor, Dante's descent
 */

import type { Room } from './RoomManager'

interface CatacombLayer {
  era: string
  depth: string
  color: string
  bgColor: string
  entries: { text: string; style: 'inscription' | 'code' | 'url' | 'epitaph' }[]
}

const LAYERS: CatacombLayer[] = [
  {
    era: '2020s',
    depth: 'surface level',
    color: 'rgba(180, 160, 120, 0.5)',
    bgColor: 'rgba(20, 15, 10, 0.95)',
    entries: [
      { text: 'here lie the platforms that promised forever', style: 'epitaph' },
      { text: 'vine.co — 6-second loops, infinite replay, gone', style: 'inscription' },
      { text: 'Google Stadia — the future of gaming (2019-2023)', style: 'inscription' },
      { text: 'Clubhouse — every voice mattered, briefly', style: 'inscription' },
      { text: 'Quibi — $1.75 billion, 6 months', style: 'inscription' },
      { text: 'the social contract: we give you our data, you give us a place to exist', style: 'epitaph' },
    ],
  },
  {
    era: '2010s',
    depth: 'first descent',
    color: 'rgba(160, 140, 100, 0.4)',
    bgColor: 'rgba(18, 12, 8, 0.95)',
    entries: [
      { text: 'the age of aggregation. everything in one feed.', style: 'epitaph' },
      { text: 'reader.google.com — where we read before the algorithm decided for us', style: 'inscription' },
      { text: 'del.icio.us — social bookmarking, the original curation', style: 'inscription' },
      { text: 'StumbleUpon — serendipity as a service (2001-2018)', style: 'inscription' },
      { text: 'Posterous — blog anywhere, gone everywhere', style: 'inscription' },
      { text: 'Path — the intimate social network, 150 friends max', style: 'inscription' },
      { text: 'every shutdown email began the same way: "we have made the difficult decision"', style: 'epitaph' },
    ],
  },
  {
    era: '2000s',
    depth: 'the middle depths',
    color: 'rgba(140, 120, 80, 0.35)',
    bgColor: 'rgba(15, 10, 6, 0.95)',
    entries: [
      { text: 'the web was still weird. that was the point.', style: 'epitaph' },
      { text: 'GeoCities — 38 million user pages, deleted in one afternoon (2009)', style: 'inscription' },
      { text: 'Friendster — the first social network, outlived by its successor\'s successor', style: 'inscription' },
      { text: 'Digg — front page of the internet, before Reddit took the name', style: 'inscription' },
      { text: 'Bebo — bought for $850M, sold for $1M', style: 'inscription' },
      { text: '<blink>YOU ARE VISITOR NUMBER 000847</blink>', style: 'code' },
      { text: 'http://www.hamsterdance.com', style: 'url' },
      { text: 'they called it Web 2.0 as if version numbers could contain the chaos', style: 'epitaph' },
    ],
  },
  {
    era: '1990s',
    depth: 'the deep strata',
    color: 'rgba(120, 100, 60, 0.3)',
    bgColor: 'rgba(12, 8, 4, 0.95)',
    entries: [
      { text: 'before the corporations. before the feeds. before the metrics.', style: 'epitaph' },
      { text: 'TheGlobe.com — first social network IPO, rose 606% day one, dead by 2001', style: 'inscription' },
      { text: 'Xoom.com — free web hosting, free email, free everything, free to disappear', style: 'inscription' },
      { text: 'SixDegrees.com — the original social network (1997-2001)', style: 'inscription' },
      { text: '<html><body bgcolor="#000000"><font color="#00ff00">', style: 'code' },
      { text: '<marquee>WELCOME TO MY HOMEPAGE</marquee>', style: 'code' },
      { text: '<img src="under_construction.gif">', style: 'code' },
      { text: '<a href="mailto:webmaster@angelfire.com">email the webmaster</a>', style: 'code' },
      { text: 'the web was a gift. we built cathedrals in our bedrooms.', style: 'epitaph' },
    ],
  },
  {
    era: 'before',
    depth: 'bedrock',
    color: 'rgba(100, 80, 40, 0.2)',
    bgColor: 'rgba(8, 5, 2, 0.95)',
    entries: [
      { text: 'before the web there was the dream of the web', style: 'epitaph' },
      { text: 'Usenet, 1980 — the first social network was text-only', style: 'inscription' },
      { text: 'BBS — you called a phone number to enter a world', style: 'inscription' },
      { text: 'Gopher — the internet that almost was', style: 'inscription' },
      { text: 'ARPANET Message #1: "LO" (tried to type LOGIN, crashed after two letters)', style: 'inscription' },
      { text: '...', style: 'epitaph' },
      { text: '', style: 'epitaph' },
      { text: '', style: 'epitaph' },
      { text: 'there is nothing below this.', style: 'epitaph' },
      { text: '', style: 'epitaph' },
      { text: '', style: 'epitaph' },
      { text: 'or is there?', style: 'epitaph' },
    ],
  },
]

interface CatacombsDeps {
  onReturn: () => void
  onOssuary?: () => void
  switchTo?: (name: string) => void
}

export function createCatacombsRoom(deps: CatacombsDeps): Room {
  let overlay: HTMLElement | null = null
  let active = false
  let autoScrollId: number | null = null

  return {
    name: 'catacombs',
    label: 'the catacombs',
    hidden: true,

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        width: 100%; height: 100%;
        pointer-events: auto;
        overflow-y: auto;
        scrollbar-width: none;
        background: rgba(10, 7, 4, 1);
      `

      const style = document.createElement('style')
      style.textContent = `
        .catacombs-scroll::-webkit-scrollbar { display: none; }
        @keyframes catacombFlicker {
          0%, 90%, 100% { opacity: 1; }
          92% { opacity: 0.7; }
          95% { opacity: 0.9; }
        }
      `
      overlay.appendChild(style)
      overlay.classList.add('catacombs-scroll')

      // Entrance text
      const entrance = document.createElement('div')
      entrance.style.cssText = `
        text-align: center;
        padding: 80px 20px 60px;
      `

      const entranceTitle = document.createElement('div')
      entranceTitle.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 18px;
        color: rgba(180, 160, 120, 0.3);
        letter-spacing: 6px; text-transform: uppercase;
        margin-bottom: 16px;
      `
      entranceTitle.textContent = 'descending'
      entrance.appendChild(entranceTitle)

      const arrow = document.createElement('div')
      arrow.style.cssText = `
        font-size: 24px;
        color: rgba(180, 160, 120, 0.1);
        animation: catacombFlicker 4s ease-in-out infinite;
      `
      arrow.textContent = '▼'
      entrance.appendChild(arrow)

      overlay.appendChild(entrance)

      // Build layers
      for (const layer of LAYERS) {
        const section = document.createElement('div')
        section.style.cssText = `
          padding: 40px 20px;
          background: ${layer.bgColor};
          min-height: 60vh;
          display: flex; flex-direction: column;
          align-items: center;
          border-top: 1px solid rgba(180, 160, 120, 0.03);
        `

        // Era header
        const header = document.createElement('div')
        header.style.cssText = `
          text-align: center; margin-bottom: 40px;
        `

        const eraLabel = document.createElement('div')
        eraLabel.style.cssText = `
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300; font-size: 12px;
          color: ${layer.color};
          letter-spacing: 4px; text-transform: uppercase;
          margin-bottom: 4px;
        `
        eraLabel.textContent = layer.era
        header.appendChild(eraLabel)

        const depthLabel = document.createElement('div')
        depthLabel.style.cssText = `
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300; font-size: 10px; font-style: italic;
          color: rgba(180, 160, 120, 0.12);
          letter-spacing: 2px;
        `
        depthLabel.textContent = layer.depth
        header.appendChild(depthLabel)

        section.appendChild(header)

        // Entries
        for (const entry of layer.entries) {
          const el = document.createElement('div')
          el.style.cssText = `
            max-width: 500px;
            margin-bottom: 24px;
            text-align: center;
          `

          if (entry.style === 'inscription') {
            el.style.cssText += `
              font-family: 'Cormorant Garamond', serif;
              font-weight: 300; font-size: 14px;
              color: ${layer.color};
              letter-spacing: 0.5px;
              line-height: 1.6;
            `
          } else if (entry.style === 'code') {
            el.style.cssText += `
              font-family: 'Courier New', monospace;
              font-size: 11px;
              color: rgba(100, 180, 80, 0.25);
              letter-spacing: 0;
              opacity: 0.7;
            `
          } else if (entry.style === 'url') {
            el.style.cssText += `
              font-family: 'Courier New', monospace;
              font-size: 11px;
              color: rgba(100, 140, 200, 0.25);
              text-decoration: line-through;
            `
          } else if (entry.style === 'epitaph') {
            el.style.cssText += `
              font-family: 'Cormorant Garamond', serif;
              font-weight: 300; font-size: 13px; font-style: italic;
              color: rgba(180, 160, 120, ${parseFloat(layer.color.match(/[\d.]+(?=\))/)?.[0] || '0.3') * 0.5});
              letter-spacing: 1px;
              line-height: 1.8;
            `
          }

          el.textContent = entry.text
          section.appendChild(el)
        }

        overlay.appendChild(section)
      }

      // Bottom void
      const bottom = document.createElement('div')
      bottom.style.cssText = `
        height: 100vh;
        background: linear-gradient(rgba(8, 5, 2, 1), rgba(0, 0, 0, 1));
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 40px;
      `

      // Return link
      const returnLink = document.createElement('div')
      returnLink.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300; font-size: 12px;
        color: rgba(180, 160, 120, 0.15);
        letter-spacing: 3px; text-transform: uppercase;
        cursor: pointer;
        transition: color 0.5s ease;
      `
      returnLink.textContent = '▲ ascend to the archive'
      returnLink.addEventListener('mouseenter', () => {
        returnLink.style.color = 'rgba(180, 160, 120, 0.5)'
      })
      returnLink.addEventListener('mouseleave', () => {
        returnLink.style.color = 'rgba(180, 160, 120, 0.15)'
      })
      returnLink.addEventListener('click', deps.onReturn)
      bottom.appendChild(returnLink)

      // Ossuary link
      if (deps.onOssuary) {
        const ossuaryLink = document.createElement('div')
        ossuaryLink.style.cssText = `
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300; font-size: 11px;
          color: rgba(220, 210, 190, 0.08);
          letter-spacing: 2px;
          cursor: pointer;
          transition: color 0.5s ease;
        `
        ossuaryLink.textContent = '→ the ossuary'
        ossuaryLink.addEventListener('mouseenter', () => {
          ossuaryLink.style.color = 'rgba(220, 210, 190, 0.3)'
        })
        ossuaryLink.addEventListener('mouseleave', () => {
          ossuaryLink.style.color = 'rgba(220, 210, 190, 0.08)'
        })
        ossuaryLink.addEventListener('click', deps.onOssuary)
        bottom.appendChild(ossuaryLink)
      }

      // Navigation portals — carved stone inscriptions to connected rooms
      if (deps.switchTo) {
        const portalData = [
          { label: '↑ the archive', room: 'archive' },
          { label: '→ the ossuary', room: 'ossuary' },
        ]
        const portalRow = document.createElement('div')
        portalRow.style.cssText = `
          display: flex; gap: 40px; margin-top: 30px;
        `
        for (const portal of portalData) {
          const el = document.createElement('div')
          el.style.cssText = `
            font-family: 'Cormorant Garamond', serif;
            font-weight: 300; font-size: 10px;
            color: rgba(180, 160, 120, 0.06);
            letter-spacing: 2px;
            cursor: pointer;
            transition: color 0.5s ease;
          `
          el.textContent = portal.label
          el.addEventListener('mouseenter', () => {
            el.style.color = 'rgba(180, 160, 120, 0.35)'
          })
          el.addEventListener('mouseleave', () => {
            el.style.color = 'rgba(180, 160, 120, 0.06)'
          })
          el.addEventListener('click', () => deps.switchTo!(portal.room))
          portalRow.appendChild(el)
        }
        bottom.appendChild(portalRow)
      }

      overlay.appendChild(bottom)

      return overlay
    },

    activate() {
      active = true
      // Slow auto-scroll
      if (overlay) {
        autoScrollId = window.setInterval(() => {
          if (overlay && active) {
            overlay.scrollTop += 0.5
          }
        }, 16)
      }
    },

    deactivate() {
      active = false
      if (autoScrollId) clearInterval(autoScrollId)
    },

    destroy() {
      active = false
      if (autoScrollId) clearInterval(autoScrollId)
      overlay?.remove()
    },
  }
}
