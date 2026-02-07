/**
 * ROOM MANAGER — tab-based navigation between rooms
 *
 * Simple bottom tab bar: the void · the study · the instrument
 * Active room highlighted in pink, others in faint gold.
 * Low opacity by default, brightens on hover.
 *
 * A faint room name whispers itself when you arrive.
 * A tiny persistent indicator sits top-right.
 */

export interface Room {
  name: string
  label: string
  hidden?: boolean // hidden rooms don't appear in tab bar
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
  private tabBar: HTMLDivElement
  private tabButtons = new Map<string, HTMLElement>()
  private roomIndicator: HTMLDivElement
  private changeListeners: RoomChangeListener[] = []

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

    // Tab bar — bottom of screen
    this.tabBar = document.createElement('div')
    this.tabBar.setAttribute('data-no-resonance', 'true')
    this.tabBar.style.cssText = `
      position: fixed; bottom: 0; left: 0; width: 100%;
      z-index: 700; pointer-events: none;
      display: flex; justify-content: center; align-items: center;
      gap: 0; padding: 14px 0 18px 0;
      opacity: 0.2;
      transition: opacity 0.6s ease;
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300; font-size: 13px;
      letter-spacing: 3px; text-transform: lowercase;
    `
    this.tabBar.addEventListener('mouseenter', () => {
      this.tabBar.style.opacity = '0.7'
    })
    this.tabBar.addEventListener('mouseleave', () => {
      this.tabBar.style.opacity = '0.2'
    })
    document.body.appendChild(this.tabBar)

    // Persistent room indicator — top-right
    this.roomIndicator = document.createElement('div')
    this.roomIndicator.style.cssText = `
      position: fixed; top: 12px; right: 16px;
      z-index: 700; pointer-events: none;
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300; font-size: 10px;
      letter-spacing: 2px; text-transform: lowercase;
      color: rgba(255, 215, 0, 0.12);
    `
    this.roomIndicator.textContent = 'the void'
    document.body.appendChild(this.roomIndicator)
  }

  /** Register a room */
  addRoom(room: Room) {
    this.rooms.set(room.name, room)
  }

  /** Initialize tab bar (called once after animation settles) */
  init() {
    this.buildTabBar()
  }

  /** Subscribe to room changes */
  onRoomChange(fn: RoomChangeListener) {
    this.changeListeners.push(fn)
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

    // Update tab highlights
    this.updateTabs()

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

  private buildTabBar() {
    this.tabBar.innerHTML = ''
    this.tabButtons.clear()

    // Dynamically show visible rooms in registration order (hidden rooms excluded)
    const roomEntries = [...this.rooms.entries()].filter(([, r]) => !r.hidden)
    let first = true

    for (const [name, room] of roomEntries) {
      // Separator dot
      if (!first) {
        const sep = document.createElement('span')
        sep.style.cssText = `
          color: rgba(255, 215, 0, 0.15);
          margin: 0 12px;
          pointer-events: none;
        `
        sep.textContent = '·'
        this.tabBar.appendChild(sep)
      }
      first = false

      const btn = document.createElement('span')
      btn.style.cssText = `
        cursor: pointer;
        pointer-events: auto;
        padding: 6px 4px;
        transition: color 0.4s ease;
        color: rgba(255, 215, 0, 0.3);
      `
      btn.textContent = room.label

      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.switchTo(name)
      })

      btn.addEventListener('mouseenter', () => {
        if (name !== this.activeRoom) {
          btn.style.color = 'rgba(255, 20, 147, 0.5)'
        }
      })
      btn.addEventListener('mouseleave', () => {
        this.updateTabs()
      })

      this.tabBar.appendChild(btn)
      this.tabButtons.set(name, btn)
    }

    this.updateTabs()
  }

  private updateTabs() {
    for (const [name, btn] of this.tabButtons) {
      if (name === this.activeRoom) {
        btn.style.color = 'rgba(255, 20, 147, 0.6)'
      } else {
        btn.style.color = 'rgba(255, 215, 0, 0.3)'
      }
    }
  }

  destroy() {
    if (this.arrivalTimeout) clearTimeout(this.arrivalTimeout)
    for (const room of this.rooms.values()) {
      room.destroy()
    }
    this.tabBar.remove()
    this.roomContainer.remove()
    this.arrivalWhisper.remove()
    this.roomIndicator.remove()
  }
}
