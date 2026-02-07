/**
 * THE OBSERVATORY — where memories become navigable stars
 *
 * A room for exploring the memory constellation in 3D space.
 * The camera is freed from its drift — orbit controls let you
 * fly through the cosmos of your stored memories. Click on any
 * star to read its text, see its connections, hear its tone.
 *
 * This is the memory palace made visible. Not a list, not an
 * archive, but a spatial experience — memories exist in locations,
 * and the journey between them is part of the remembering.
 *
 * Spatial audio via PannerNode: each memory star hums from its
 * position in 3D space. As you orbit, sounds shift around you.
 *
 * Inspired by: Planetariums, star charts, memory palaces,
 * Refik Anadol's Infinity Room, hippocampal place cells,
 * the 2026 finding that hippocampus reorganizes memories spatially
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Room } from './RoomManager'
import type { StoredMemory } from '../memory/MemoryJournal'
import { getAudioContext, getAudioDestination } from '../sound/AudioBus'

interface ObservatoryDeps {
  getMemories: () => StoredMemory[]
  getConstellationSprites: () => THREE.Sprite[]
  getMemoryById: (id: string) => StoredMemory | null
  getCamera: () => THREE.PerspectiveCamera
  getCanvas: () => HTMLCanvasElement
  pauseCamera: () => void
  resumeCamera: () => void
  switchTo?: (name: string) => void
}

export function createObservatoryRoom(deps: ObservatoryDeps): Room {
  let overlay: HTMLElement | null = null
  let controls: OrbitControls | null = null
  let focusPanel: HTMLElement | null = null
  let focusedId: string | null = null
  let controlsRAF = 0

  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()

  // Event handler references for cleanup
  let clickHandler: ((e: MouseEvent) => void) | null = null
  let moveHandler: ((e: MouseEvent) => void) | null = null
  let escHandler: ((e: KeyboardEvent) => void) | null = null

  function createFocusPanel(): HTMLElement {
    const panel = document.createElement('div')
    panel.style.cssText = `
      position: fixed;
      right: -340px;
      top: 50%;
      transform: translateY(-50%);
      width: 300px;
      max-height: 60vh;
      background: rgba(2, 1, 8, 0.92);
      border: 1px solid rgba(255, 20, 147, 0.15);
      border-right: none;
      border-radius: 4px 0 0 4px;
      padding: 24px;
      font-family: 'Cormorant Garamond', serif;
      font-weight: 300;
      transition: right 0.6s cubic-bezier(0.23, 1, 0.32, 1);
      z-index: 500;
      overflow-y: auto;
      pointer-events: auto;
    `
    return panel
  }

  function showFocusPanel(memory: StoredMemory) {
    if (!focusPanel) return

    const degradePercent = Math.floor(memory.degradation * 100)
    const hueDeg = Math.floor(memory.hue * 360)
    const age = Date.now() - memory.timestamp
    const days = Math.floor(age / (1000 * 60 * 60 * 24))
    const hours = Math.floor(age / (1000 * 60 * 60)) % 24

    let timeStr = ''
    if (days > 0) timeStr = `${days} day${days > 1 ? 's' : ''} ago`
    else if (hours > 0) timeStr = `${hours} hour${hours > 1 ? 's' : ''} ago`
    else timeStr = 'moments ago'

    // Count connections (shared words with other memories)
    const memories = deps.getMemories()
    const words = new Set(
      memory.currentText.toLowerCase().split(/\W+/).filter(w => w.length > 2)
    )
    let connections = 0
    for (const m of memories) {
      if (m.id === memory.id) continue
      const mWords = m.currentText.toLowerCase().split(/\W+/).filter(w => w.length > 2)
      if (mWords.some(w => words.has(w))) connections++
    }

    focusPanel.innerHTML = `
      <div style="
        color: hsla(${hueDeg}, 70%, 75%, 0.9);
        font-size: 20px;
        line-height: 1.6;
        margin-bottom: 16px;
      ">${memory.currentText}</div>
      <div style="
        color: rgba(255, 215, 0, 0.25);
        font-size: 11px;
        letter-spacing: 2px;
        line-height: 2;
      ">
        ${degradePercent > 0 ? `<div>${degradePercent}% forgotten</div>` : '<div>pristine</div>'}
        <div>${timeStr}</div>
        <div>${connections} connection${connections !== 1 ? 's' : ''}</div>
        <div style="margin-top: 8px; color: rgba(255, 20, 147, 0.15);">
          ${memory.position.x.toFixed(0)}, ${memory.position.y.toFixed(0)}, ${memory.position.z.toFixed(0)}
        </div>
      </div>
    `

    focusPanel.style.right = '0px'
    focusedId = memory.id
  }

  function hideFocusPanel() {
    if (focusPanel) focusPanel.style.right = '-340px'
    focusedId = null
  }

  async function playMemoryTone(memory: StoredMemory, position: THREE.Vector3) {
    try {
      const ctx = await getAudioContext()
      const dest = getAudioDestination()

      // Spatial panner — memory hums from its position
      const panner = ctx.createPanner()
      panner.panningModel = 'HRTF'
      panner.distanceModel = 'inverse'
      panner.refDistance = 1
      panner.maxDistance = 10
      panner.rolloffFactor = 1

      // Scale Three.js coords to audio space
      const s = 0.01
      panner.positionX.setValueAtTime(position.x * s, ctx.currentTime)
      panner.positionY.setValueAtTime(position.y * s, ctx.currentTime)
      panner.positionZ.setValueAtTime(position.z * s, ctx.currentTime)

      // Update listener to camera
      const camera = deps.getCamera()
      ctx.listener.positionX.setValueAtTime(camera.position.x * s, ctx.currentTime)
      ctx.listener.positionY.setValueAtTime(camera.position.y * s, ctx.currentTime)
      ctx.listener.positionZ.setValueAtTime(camera.position.z * s, ctx.currentTime)

      // Bell tone — frequency from memory hue
      const baseFreq = 220 + memory.hue * 440

      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime)

      // Detuned harmonic for richness
      const osc2 = ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(baseFreq * 2.01, ctx.currentTime)

      // Envelopes
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3)

      const gain2 = ctx.createGain()
      gain2.gain.setValueAtTime(0, ctx.currentTime)
      gain2.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.02)
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2)

      osc.connect(gain)
      osc2.connect(gain2)
      gain.connect(panner)
      gain2.connect(panner)
      panner.connect(dest)

      osc.start(ctx.currentTime)
      osc2.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 3)
      osc2.stop(ctx.currentTime + 2)
    } catch {
      // Audio might not be initialized yet
    }
  }

  return {
    name: 'observatory',
    label: 'the observatory',

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        display: flex; flex-direction: column;
        align-items: center; justify-content: flex-start;
        height: 100%;
        pointer-events: none;
        background: rgba(2, 1, 8, 0.15);
      `

      // Instruction hint
      const hint = document.createElement('div')
      hint.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300;
        font-size: 12px;
        color: rgba(255, 215, 0, 0.2);
        letter-spacing: 2px;
        margin-top: 24px;
        text-align: center;
        transition: opacity 3s ease;
      `
      hint.textContent = 'drag to orbit \u00b7 scroll to zoom \u00b7 click a star'
      overlay.appendChild(hint)

      // Fade hint after 8 seconds
      setTimeout(() => { hint.style.opacity = '0' }, 8000)

      // Memory count
      const countEl = document.createElement('div')
      countEl.style.cssText = `
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.1);
        letter-spacing: 2px;
        margin-top: 8px;
        pointer-events: none;
      `
      const memories = deps.getMemories()
      countEl.textContent = memories.length > 0
        ? `${memories.length} memor${memories.length === 1 ? 'y' : 'ies'} in the constellation`
        : 'no memories yet \u2014 type in the void to create stars'
      overlay.appendChild(countEl)

      // Focus panel
      focusPanel = createFocusPanel()
      document.body.appendChild(focusPanel)

      // In-room navigation portals at corners
      if (deps.switchTo) {
        const portalData = [
          { name: 'satellite', symbol: '\uD83D\uDEF0\uFE0F', hint: 'the satellite', color: '100, 200, 255', pos: 'top: 24px; right: 24px;' },
          { name: 'asteroids', symbol: '\u2604', hint: 'the asteroid field', color: '200, 150, 100', pos: 'bottom: 60px; left: 24px;' },
          { name: 'clocktower', symbol: '\u231A', hint: 'the clock tower', color: '200, 180, 140', pos: 'bottom: 60px; right: 24px;' },
          { name: 'void', symbol: '\u25C6', hint: 'the void', color: '255, 20, 147', pos: 'top: 24px; left: 24px;' },
        ]
        for (const p of portalData) {
          const el = document.createElement('div')
          el.style.cssText = `
            position: absolute; ${p.pos}
            pointer-events: auto; cursor: pointer;
            font-family: 'Cormorant Garamond', serif;
            font-weight: 300; font-size: 10px;
            letter-spacing: 2px; text-transform: lowercase;
            color: rgba(${p.color}, 0.06);
            transition: color 0.5s ease, text-shadow 0.5s ease;
            text-shadow: none;
            padding: 8px; z-index: 10;
          `
          el.innerHTML = `<span style="font-size:14px; display:block; margin-bottom:2px;">${p.symbol}</span><span style="font-style:italic;">${p.hint}</span>`
          el.addEventListener('mouseenter', () => {
            el.style.color = `rgba(${p.color}, 0.5)`
            el.style.textShadow = `0 0 15px rgba(${p.color}, 0.2)`
          })
          el.addEventListener('mouseleave', () => {
            el.style.color = `rgba(${p.color}, 0.06)`
            el.style.textShadow = 'none'
          })
          el.addEventListener('click', (e) => {
            e.stopPropagation()
            deps.switchTo!(p.name)
          })
          overlay.appendChild(el)
        }
      }

      return overlay
    },

    activate() {
      const camera = deps.getCamera()
      const canvas = deps.getCanvas()

      // Take over camera
      deps.pauseCamera()

      // Orbit controls
      controls = new OrbitControls(camera, canvas)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.rotateSpeed = 0.5
      controls.zoomSpeed = 0.8
      controls.minDistance = 50
      controls.maxDistance = 800
      controls.target.set(0, 0, 0)
      controls.enablePan = true
      controls.panSpeed = 0.5

      // Update controls each frame (needed for damping)
      const updateLoop = () => {
        if (!controls) return
        controls.update()
        controlsRAF = requestAnimationFrame(updateLoop)
      }
      controlsRAF = requestAnimationFrame(updateLoop)

      // Click → raycast against constellation sprites
      clickHandler = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect()
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(mouse, camera)

        const sprites = deps.getConstellationSprites()
        const intersects = raycaster.intersectObjects(sprites)

        if (intersects.length > 0) {
          const sprite = intersects[0].object as THREE.Sprite
          const memoryId = sprite.userData.memoryId
          if (memoryId) {
            const memory = deps.getMemoryById(memoryId)
            if (memory) {
              showFocusPanel(memory)
              playMemoryTone(memory, sprite.position)
            }
          }
        } else {
          hideFocusPanel()
        }
      }
      canvas.addEventListener('click', clickHandler)

      // Hover cursor
      moveHandler = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect()
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(mouse, camera)
        const sprites = deps.getConstellationSprites()
        const intersects = raycaster.intersectObjects(sprites)
        canvas.style.cursor = intersects.length > 0 ? 'pointer' : 'grab'
      }
      canvas.addEventListener('mousemove', moveHandler)

      // Escape unfocuses
      escHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') hideFocusPanel()
      }
      window.addEventListener('keydown', escHandler)
    },

    deactivate() {
      const canvas = deps.getCanvas()

      // Cleanup controls
      if (controls) {
        controls.dispose()
        controls = null
      }
      cancelAnimationFrame(controlsRAF)

      // Resume void camera
      deps.resumeCamera()

      // Remove listeners
      if (clickHandler) {
        canvas.removeEventListener('click', clickHandler)
        clickHandler = null
      }
      if (moveHandler) {
        canvas.removeEventListener('mousemove', moveHandler)
        moveHandler = null
      }
      if (escHandler) {
        window.removeEventListener('keydown', escHandler)
        escHandler = null
      }

      hideFocusPanel()
      canvas.style.cursor = ''
    },

    destroy() {
      if (controls) {
        controls.dispose()
        controls = null
      }
      cancelAnimationFrame(controlsRAF)
      focusPanel?.remove()
      overlay?.remove()
    },
  }
}
