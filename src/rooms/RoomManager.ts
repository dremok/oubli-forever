/**
 * ROOM MANAGER — a house with rooms connected by passages
 *
 * Rooms are not listed in a menu. They are connected spatially,
 * like rooms in a real house. Each room has doorways — faint text
 * at the edges of the screen that hint at what lies beyond. Click
 * a doorway to pass through. Some doorways are obvious. Some are
 * hidden until you perform a certain action (type a word, play a
 * note, wait in silence). The house map is convoluted — you might
 * enter The Study from the left wall of The Void, but The Study's
 * exit back is through the ceiling.
 *
 * The connections form a graph, not a line. You discover the house
 * by exploring. A faint room name whispers itself when you arrive.
 *
 * Inspired by: House of Leaves, the Winchester Mystery House,
 * MUD text adventure navigation, Borges's Library of Babel
 */

export interface Room {
  name: string
  label: string
  create: () => HTMLElement
  activate: () => void
  deactivate: () => void
  destroy: () => void
}

export interface Passage {
  from: string
  to: string
  position: 'left' | 'right' | 'top' | 'bottom'
  hint: string           // poetic text shown at the doorway
  condition?: () => boolean  // if present, passage is hidden until condition is true
  discovered?: boolean   // once found, stays visible on future visits
}

export class RoomManager {
  private rooms = new Map<string, Room>()
  private passages: Passage[] = []
  private activeRoom: string = 'void'
  private roomContainer: HTMLDivElement
  private activeOverlay: HTMLElement | null = null
  private doorways: HTMLElement[] = []
  private doorwayContainer: HTMLDivElement
  private arrivalWhisper: HTMLDivElement
  private arrivalTimeout: number | null = null
  private discoveredPassages = new Set<string>()

  constructor() {
    // Load discovered passages from localStorage
    this.loadDiscovered()

    // Room container — holds the active room's UI
    this.roomContainer = document.createElement('div')
    this.roomContainer.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 300; pointer-events: none;
    `
    document.body.appendChild(this.roomContainer)

    // Doorway container — passages rendered on top of everything
    this.doorwayContainer = document.createElement('div')
    this.doorwayContainer.setAttribute('data-no-resonance', 'true')
    this.doorwayContainer.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 700; pointer-events: none;
    `
    document.body.appendChild(this.doorwayContainer)

    // Arrival whisper — room name fades in when you enter
    this.arrivalWhisper = document.createElement('div')
    this.arrivalWhisper.style.cssText = `
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 710; pointer-events: none;
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300; font-size: 28px;
      font-style: italic;
      letter-spacing: 6px;
      color: rgba(255, 215, 0, 0);
      transition: color 2s ease;
      text-transform: lowercase;
    `
    document.body.appendChild(this.arrivalWhisper)
  }

  /** Register a room */
  addRoom(room: Room) {
    this.rooms.set(room.name, room)
  }

  /** Define a passage between rooms */
  addPassage(passage: Passage) {
    const key = `${passage.from}→${passage.to}`
    passage.discovered = this.discoveredPassages.has(key)
    this.passages.push(passage)
  }

  /** Initialize doorways for the starting room (called once after animation settles) */
  init() {
    this.buildDoorways()
  }

  /** Switch to a room */
  switchTo(name: string) {
    if (name === this.activeRoom) return
    const room = this.rooms.get(name)
    if (!room) return

    // Deactivate current room
    const currentRoom = this.rooms.get(this.activeRoom)
    if (currentRoom) {
      currentRoom.deactivate()
    }

    // Fade out current overlay
    if (this.activeOverlay) {
      const old = this.activeOverlay
      old.style.transition = 'opacity 1.5s ease'
      old.style.opacity = '0'
      old.style.pointerEvents = 'none'
      setTimeout(() => old.remove(), 1500)
    }

    // Clear current doorways
    this.clearDoorways()

    // Create and show new room overlay
    const overlay = room.create()
    overlay.style.cssText += `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      opacity: 0;
      transition: opacity 1.5s ease;
    `
    this.roomContainer.appendChild(overlay)

    // Force reflow then fade in
    void overlay.offsetWidth
    overlay.style.opacity = '1'

    this.activeOverlay = overlay
    this.activeRoom = name
    room.activate()

    // Show arrival whisper
    this.showArrival(room.label)

    // Build doorways after transition settles
    setTimeout(() => this.buildDoorways(), 2000)
  }

  /** Mark a passage as discovered (for hidden passages) */
  discoverPassage(from: string, to: string) {
    const key = `${from}→${to}`
    this.discoveredPassages.add(key)
    this.saveDiscovered()

    // Update passage state
    const passage = this.passages.find(p => p.from === from && p.to === to)
    if (passage) passage.discovered = true

    // Rebuild doorways to show newly discovered passage
    if (from === this.activeRoom) {
      this.clearDoorways()
      this.buildDoorways()
    }
  }

  private showArrival(label: string) {
    if (this.arrivalTimeout) clearTimeout(this.arrivalTimeout)

    this.arrivalWhisper.textContent = label
    this.arrivalWhisper.style.color = 'rgba(255, 215, 0, 0)'

    // Fade in
    requestAnimationFrame(() => {
      this.arrivalWhisper.style.color = 'rgba(255, 215, 0, 0.4)'
    })

    // Fade out after 3 seconds
    this.arrivalTimeout = window.setTimeout(() => {
      this.arrivalWhisper.style.color = 'rgba(255, 215, 0, 0)'
    }, 3000)
  }

  private buildDoorways() {
    const activePassages = this.passages.filter(p => {
      if (p.from !== this.activeRoom) return false
      // Hidden passages need to be discovered or have condition met
      if (p.condition) {
        return p.discovered || p.condition()
      }
      return true
    })

    for (const passage of activePassages) {
      this.createDoorway(passage)
    }
  }

  private createDoorway(passage: Passage) {
    const door = document.createElement('div')
    door.setAttribute('data-no-resonance', 'true')
    door.style.cssText = `
      position: absolute;
      pointer-events: auto;
      cursor: pointer;
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300;
      font-style: italic;
      transition: opacity 0.8s ease, color 0.5s ease;
      opacity: 0;
      display: flex; align-items: center; justify-content: center;
    `

    // Position based on direction
    switch (passage.position) {
      case 'left':
        door.style.cssText += `
          left: 0; top: 50%; transform: translateY(-50%) rotate(-90deg);
          width: 200px; height: 40px;
          font-size: 12px; letter-spacing: 3px;
          color: rgba(255, 215, 0, 0.15);
          transform-origin: center center;
          padding-left: 16px;
        `
        // Reposition: rotated text along left edge
        door.style.left = '-80px'
        break

      case 'right':
        door.style.cssText += `
          right: 0; top: 50%; transform: translateY(-50%) rotate(90deg);
          width: 200px; height: 40px;
          font-size: 12px; letter-spacing: 3px;
          color: rgba(255, 215, 0, 0.15);
          transform-origin: center center;
          padding-right: 16px;
        `
        door.style.right = '-80px'
        break

      case 'top':
        door.style.cssText += `
          top: 12px; left: 50%; transform: translateX(-50%);
          width: 300px; height: 40px;
          font-size: 12px; letter-spacing: 3px;
          color: rgba(255, 215, 0, 0.15);
          text-align: center;
        `
        break

      case 'bottom':
        door.style.cssText += `
          bottom: 50px; left: 50%; transform: translateX(-50%);
          width: 300px; height: 40px;
          font-size: 12px; letter-spacing: 3px;
          color: rgba(255, 215, 0, 0.15);
          text-align: center;
        `
        break
    }

    door.textContent = passage.hint

    // Hover — the doorway brightens
    door.addEventListener('mouseenter', () => {
      door.style.color = 'rgba(255, 20, 147, 0.6)'
      door.style.opacity = '1'
    })
    door.addEventListener('mouseleave', () => {
      door.style.color = 'rgba(255, 215, 0, 0.15)'
      door.style.opacity = '0.6'
    })

    // Click — pass through the doorway
    door.addEventListener('click', (e) => {
      e.stopPropagation()
      // Mark as discovered
      const key = `${passage.from}→${passage.to}`
      this.discoveredPassages.add(key)
      this.saveDiscovered()
      this.switchTo(passage.to)
    })

    this.doorwayContainer.appendChild(door)
    this.doorways.push(door)

    // Fade in after a moment
    setTimeout(() => {
      door.style.opacity = '0.6'
    }, 500)
  }

  private clearDoorways() {
    for (const door of this.doorways) {
      door.remove()
    }
    this.doorways = []
  }

  private loadDiscovered() {
    try {
      const stored = localStorage.getItem('oubli-passages')
      if (stored) {
        const arr = JSON.parse(stored) as string[]
        arr.forEach(k => this.discoveredPassages.add(k))
      }
    } catch { /* */ }
  }

  private saveDiscovered() {
    try {
      localStorage.setItem('oubli-passages', JSON.stringify([...this.discoveredPassages]))
    } catch { /* */ }
  }

  getActiveRoom(): string {
    return this.activeRoom
  }

  destroy() {
    if (this.arrivalTimeout) clearTimeout(this.arrivalTimeout)
    for (const room of this.rooms.values()) {
      room.destroy()
    }
    this.clearDoorways()
    this.doorwayContainer.remove()
    this.roomContainer.remove()
    this.arrivalWhisper.remove()
  }
}
