/**
 * ROOM MANAGER — graph-based navigation between rooms
 *
 * No more flat tab bar. Each room shows passages to its
 * connected rooms — water flows to water, sound to sound,
 * time to time. The void is the central hub.
 *
 * Back arrow remembers where you came from.
 * Compass icon reaches the Cartographer from anywhere.
 * Hidden rooms are discovered through in-room actions.
 */

import { getConnections, getRoomLabel } from '../navigation/RoomGraph'

export interface Room {
  name: string
  label: string
  hidden?: boolean // hidden rooms don't appear in passage bar
  create: () => HTMLElement
  activate: () => void
  deactivate: () => void
  destroy: () => void
}

type RoomChangeListener = (room: string) => void

export class RoomManager {
  private rooms = new Map<string, Room>()
  private activeRoom: string = 'void'
  private roomContainer: HTMLDivElement
  private activeOverlay: HTMLElement | null = null
  private arrivalWhisper: HTMLDivElement
  private arrivalTimeout: number | null = null
  private passageBar: HTMLDivElement
  private roomIndicator: HTMLDivElement
  private changeListeners: RoomChangeListener[] = []
  private roomVisits = new Map<string, number>()
  private navigationHistory: string[] = ['void']

  constructor() {
    // Room container — holds the active room's UI
    this.roomContainer = document.createElement('div')
    this.roomContainer.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 300; pointer-events: none;
    `
    document.body.appendChild(this.roomContainer)

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

    // Passage bar — contextual navigation, replaces flat tab bar
    this.passageBar = document.createElement('div')
    this.passageBar.setAttribute('data-no-resonance', 'true')
    this.passageBar.style.cssText = `
      position: fixed; bottom: 0; left: 0; width: 100%;
      z-index: 700; pointer-events: auto;
      display: flex; flex-wrap: wrap; justify-content: center; align-items: center;
      gap: 2px 0; padding: 10px 20px 14px 20px;
      opacity: 0.18;
      transition: opacity 0.8s ease;
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300; font-size: 16px;
      letter-spacing: 2px; text-transform: lowercase;
    `
    this.passageBar.addEventListener('mouseenter', () => {
      this.passageBar.style.opacity = '0.85'
    })
    this.passageBar.addEventListener('mouseleave', () => {
      this.passageBar.style.opacity = '0.18'
    })
    document.body.appendChild(this.passageBar)

    // Persistent room indicator — top-right
    this.roomIndicator = document.createElement('div')
    this.roomIndicator.style.cssText = `
      position: fixed; top: 12px; right: 16px;
      z-index: 700; pointer-events: none;
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300; font-size: 15px;
      letter-spacing: 2px; text-transform: lowercase;
      color: rgba(255, 215, 0, 0.18);
    `
    this.roomIndicator.textContent = 'the void'
    document.body.appendChild(this.roomIndicator)
  }

  /** Register a room */
  addRoom(room: Room) {
    this.rooms.set(room.name, room)
  }

  /** Initialize passage bar (called once after animation settles) */
  init() {
    this.buildPassageBar()
  }

  /** Subscribe to room changes */
  onRoomChange(fn: RoomChangeListener) {
    this.changeListeners.push(fn)
  }

  /** Switch to a room */
  switchTo(name: string, options?: { skipHistory?: boolean }) {
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
    this.roomVisits.set(name, (this.roomVisits.get(name) || 0) + 1)

    // Track navigation history
    if (!options?.skipHistory) {
      if (this.navigationHistory[this.navigationHistory.length - 1] !== name) {
        this.navigationHistory.push(name)
        if (this.navigationHistory.length > 50) this.navigationHistory.shift()
      }
    }

    room.activate()

    // Update passage bar with new connections
    this.buildPassageBar()

    // Update indicator
    this.roomIndicator.textContent = room.label

    // Show arrival whisper
    this.showArrival(room.label)

    // Notify listeners
    for (const fn of this.changeListeners) {
      fn(name)
    }
  }

  getActiveRoom(): string {
    return this.activeRoom
  }

  getRoomVisits(): Map<string, number> {
    return new Map(this.roomVisits)
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

  private buildPassageBar() {
    this.passageBar.innerHTML = ''

    const connections = getConnections(this.activeRoom)

    // ← Back button (if we have somewhere to go back to)
    if (this.navigationHistory.length > 1) {
      const prevRoom = this.navigationHistory[this.navigationHistory.length - 2]
      const backBtn = document.createElement('span')
      backBtn.style.cssText = `
        cursor: pointer; pointer-events: auto;
        padding: 4px 6px 4px 4px;
        transition: color 0.4s ease;
        color: rgba(255, 215, 0, 0.35);
        font-size: 16px;
        white-space: nowrap;
      `
      backBtn.textContent = `\u2190 ${getRoomLabel(prevRoom)}`

      backBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.goBack()
      })
      backBtn.addEventListener('mouseenter', () => {
        backBtn.style.color = 'rgba(255, 20, 147, 0.7)'
      })
      backBtn.addEventListener('mouseleave', () => {
        backBtn.style.color = 'rgba(255, 215, 0, 0.35)'
      })
      this.passageBar.appendChild(backBtn)

      // Divider
      this.appendDivider()
    }

    // Passages to connected rooms
    let first = true
    for (const connName of connections) {
      const room = this.rooms.get(connName)
      if (!room) continue

      // Separator dot between passages
      if (!first) {
        const sep = document.createElement('span')
        sep.style.cssText = `
          color: rgba(255, 215, 0, 0.15);
          margin: 0 8px;
          pointer-events: none;
          font-size: 14px;
        `
        sep.textContent = '\u00B7'
        this.passageBar.appendChild(sep)
      }
      first = false

      const visited = (this.roomVisits.get(connName) || 0) > 0
      const btn = document.createElement('span')
      btn.style.cssText = `
        cursor: pointer; pointer-events: auto;
        padding: 4px 4px;
        transition: color 0.4s ease;
        color: rgba(255, 215, 0, ${visited ? '0.5' : '0.3'});
        white-space: nowrap;
      `
      btn.textContent = room.label

      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.switchTo(connName)
      })
      btn.addEventListener('mouseenter', () => {
        btn.style.color = 'rgba(255, 20, 147, 0.7)'
      })
      btn.addEventListener('mouseleave', () => {
        const v = (this.roomVisits.get(connName) || 0) > 0
        btn.style.color = `rgba(255, 215, 0, ${v ? '0.5' : '0.3'})`
      })

      this.passageBar.appendChild(btn)
    }

    // ◎ Compass icon — always offers the Cartographer
    if (this.activeRoom !== 'cartographer') {
      this.appendDivider()

      const compass = document.createElement('span')
      compass.style.cssText = `
        cursor: pointer; pointer-events: auto;
        padding: 4px 4px;
        transition: color 0.4s ease;
        color: rgba(255, 215, 0, 0.3);
        font-size: 16px;
        white-space: nowrap;
      `
      compass.textContent = '\u25CE map'
      compass.addEventListener('click', (e) => {
        e.stopPropagation()
        this.switchTo('cartographer')
      })
      compass.addEventListener('mouseenter', () => {
        compass.style.color = 'rgba(255, 20, 147, 0.7)'
      })
      compass.addEventListener('mouseleave', () => {
        compass.style.color = 'rgba(255, 215, 0, 0.3)'
      })
      this.passageBar.appendChild(compass)
    }
  }

  private appendDivider() {
    const div = document.createElement('span')
    div.style.cssText = `
      color: rgba(255, 215, 0, 0.12);
      margin: 0 6px;
      pointer-events: none;
      font-size: 15px;
    `
    div.textContent = '\u2502'
    this.passageBar.appendChild(div)
  }

  private goBack() {
    if (this.navigationHistory.length <= 1) return
    this.navigationHistory.pop() // remove current room
    const target = this.navigationHistory[this.navigationHistory.length - 1]
    this.switchTo(target, { skipHistory: true })
  }

  destroy() {
    if (this.arrivalTimeout) clearTimeout(this.arrivalTimeout)
    for (const room of this.rooms.values()) {
      room.destroy()
    }
    this.passageBar.remove()
    this.roomContainer.remove()
    this.arrivalWhisper.remove()
    this.roomIndicator.remove()
  }
}
