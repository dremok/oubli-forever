/**
 * THE VOID — the original room, where memories dissolve
 *
 * The Void is the default state. It has no overlay — just the
 * particle cosmos, the forgetting machine, and all the ambient
 * systems. When you enter The Void from another room, the overlay
 * clears and you're back in the open darkness.
 *
 * The Void is the central hub of the house. All other rooms
 * connect back to it, though not always through the same door.
 */

import type { Room } from './RoomManager'

export function createVoidRoom(): Room {
  let overlay: HTMLElement | null = null

  return {
    name: 'void',
    label: 'the void',

    create() {
      // The Void's overlay is transparent — the particle system IS the room
      overlay = document.createElement('div')
      overlay.style.cssText = `
        width: 100%; height: 100%;
        pointer-events: none;
      `
      return overlay
    },

    activate() {
      // The void is always active underneath — nothing special to do
    },

    deactivate() {
      // Nothing to clean up
    },

    destroy() {
      overlay?.remove()
    },
  }
}
