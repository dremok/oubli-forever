/**
 * MEMORY CONSTELLATIONS — your words become stars
 *
 * Each memory saved in the journal becomes a glowing node in the 3D void.
 * The text floats near its star, degrading over time just like the journal.
 * Bright new memories shine intensely; old ones are faint whispers.
 *
 * This is the spatial memory palace. Your words aren't just stored —
 * they're placed in a cosmos you can drift through. The camera's slow
 * orbit brings different memories into view, like constellations
 * rising and setting.
 *
 * The text labels are rendered on a Canvas 2D overlay, projected from
 * 3D world coordinates using the camera's matrices. The star nodes
 * themselves live in the Three.js scene, benefiting from bloom.
 *
 * Inspired by: Memory palaces, star charts, the Library of Babel,
 * neural constellation maps of the hippocampus
 */

import * as THREE from 'three'
import type { StoredMemory } from './MemoryJournal'

interface ConstellationNode {
  memory: StoredMemory
  mesh: THREE.Sprite
  birthTime: number
  scale: number
  wordSet: Set<string>  // cached for connection computation
}

export class MemoryConstellations {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private nodes: ConstellationNode[] = []
  private scene: THREE.Scene | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private width = 0
  private height = 0
  private animating = false
  private frameId = 0
  private time = 0
  private connectionCache: { i: number; j: number; shared: number }[] = []
  private connectionsDirty = true

  constructor() {
    // Canvas overlay for text labels
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 100; pointer-events: none;
    `
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio, 2)
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = this.width * dpr
    this.canvas.height = this.height * dpr
    this.canvas.style.width = this.width + 'px'
    this.canvas.style.height = this.height + 'px'
    this.ctx.scale(dpr, dpr)
  }

  /** Connect to the Three.js scene and camera */
  connect(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene
    this.camera = camera
  }

  /** Add existing memories from the journal on startup */
  loadMemories(memories: StoredMemory[]) {
    for (const memory of memories) {
      this.addNode(memory, false)
    }
    if (this.nodes.length > 0 && !this.animating) {
      this.startAnimation()
    }
  }

  /** Add a single new memory with entrance animation */
  addMemory(memory: StoredMemory) {
    this.addNode(memory, true)
    if (!this.animating) {
      this.startAnimation()
    }
  }

  private addNode(memory: StoredMemory, animate: boolean) {
    if (!this.scene) return

    // Create a glowing sprite for the memory star
    const spriteMaterial = new THREE.SpriteMaterial({
      map: this.createStarTexture(memory.hue),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    const sprite = new THREE.Sprite(spriteMaterial)
    sprite.position.set(memory.position.x, memory.position.y, memory.position.z)

    const baseScale = animate ? 0.01 : this.getScaleForMemory(memory)
    sprite.scale.set(baseScale, baseScale, 1)

    this.scene.add(sprite)

    const wordSet = new Set(
      memory.currentText.toLowerCase().split(/\W+/).filter(w => w.length > 2)
    )

    this.nodes.push({
      memory,
      mesh: sprite,
      birthTime: animate ? this.time : 0,
      scale: baseScale,
      wordSet,
    })

    this.connectionsDirty = true
  }

  private getScaleForMemory(memory: StoredMemory): number {
    // Newer memories are brighter/larger, degraded ones are smaller
    const freshness = 1 - memory.degradation
    return 8 + freshness * 12
  }

  private createStarTexture(hue: number): THREE.Texture {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    // Radial gradient — bright center, soft glow
    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2
    )

    // Convert hue (0-1) to degrees
    const hueDeg = Math.floor(hue * 360)

    gradient.addColorStop(0, `hsla(${hueDeg}, 80%, 90%, 1)`)
    gradient.addColorStop(0.1, `hsla(${hueDeg}, 80%, 70%, 0.8)`)
    gradient.addColorStop(0.3, `hsla(${hueDeg}, 70%, 50%, 0.3)`)
    gradient.addColorStop(0.6, `hsla(${hueDeg}, 60%, 40%, 0.08)`)
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    return texture
  }

  private startAnimation() {
    if (this.animating) return
    this.animating = true

    const animate = () => {
      this.frameId = requestAnimationFrame(animate)
      this.time++
      this.render()
    }
    animate()
  }

  private render() {
    if (!this.camera) return

    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    const projScreenMatrix = new THREE.Matrix4()
    projScreenMatrix.multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse
    )

    // Draw connection lines between memories that share words
    this.renderConnections(ctx, projScreenMatrix)

    for (const node of this.nodes) {
      // Animate new memories growing in
      if (node.birthTime > 0) {
        const age = this.time - node.birthTime
        const targetScale = this.getScaleForMemory(node.memory)
        if (age < 120) {
          // Elastic entrance — overshoots then settles
          const t = age / 120
          const elastic = 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 2)
          node.scale = targetScale * Math.min(elastic, 1.3)
        } else {
          node.scale = targetScale
          node.birthTime = 0 // animation complete
        }
      }

      // Gentle breathing
      const breathe = 1 + Math.sin(this.time * 0.02 + node.memory.position.x) * 0.05
      const finalScale = node.scale * breathe
      node.mesh.scale.set(finalScale, finalScale, 1)

      // Project 3D position to 2D screen coordinates
      const pos3 = node.mesh.position.clone()
      pos3.project(this.camera)

      // Skip if behind camera
      if (pos3.z > 1) continue

      const screenX = (pos3.x * 0.5 + 0.5) * this.width
      const screenY = (-pos3.y * 0.5 + 0.5) * this.height

      // Skip if off screen
      if (screenX < -100 || screenX > this.width + 100 ||
          screenY < -100 || screenY > this.height + 100) continue

      // Distance from camera affects text visibility
      const worldPos = node.mesh.position
      const camPos = this.camera.position
      const dist = worldPos.distanceTo(camPos)

      // Only show text for memories within a reasonable distance
      if (dist > 600) continue

      // Closer = more visible text
      const proximity = 1 - Math.min(dist / 500, 1)
      const textAlpha = proximity * proximity * 0.7

      if (textAlpha < 0.03) continue

      // Render the degraded memory text
      const text = node.memory.currentText
      const fontSize = Math.max(10, 14 * proximity)
      const hueDeg = Math.floor(node.memory.hue * 360)

      ctx.font = `300 ${fontSize}px 'Cormorant Garamond', serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'

      // Text positioned below the star
      const textY = screenY + finalScale * 0.5 + 8

      // Glow behind text
      ctx.shadowColor = `hsla(${hueDeg}, 60%, 50%, ${textAlpha * 0.5})`
      ctx.shadowBlur = 8

      ctx.fillStyle = `hsla(${hueDeg}, 70%, 75%, ${textAlpha})`

      // Word wrap for long memories
      const maxWidth = 200
      const words = text.split(' ')
      let line = ''
      let lineY = textY

      for (const word of words) {
        const testLine = line + (line ? ' ' : '') + word
        if (ctx.measureText(testLine).width > maxWidth && line) {
          ctx.fillText(line, screenX, lineY)
          line = word
          lineY += fontSize * 1.3
        } else {
          line = testLine
        }
      }
      if (line) {
        ctx.fillText(line, screenX, lineY)
      }

      // Reset shadow
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0

      // Age indicator — tiny text showing degradation
      if (node.memory.degradation > 0.01) {
        const degradePercent = Math.floor(node.memory.degradation * 100)
        ctx.font = `300 ${Math.max(8, 9 * proximity)}px 'Cormorant Garamond', serif`
        ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha * 0.3})`
        ctx.fillText(`${degradePercent}% forgotten`, screenX, lineY + fontSize * 1.4)
      }
    }
  }

  private recomputeConnections() {
    this.connectionCache = []
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        let shared = 0
        for (const word of this.nodes[i].wordSet) {
          if (this.nodes[j].wordSet.has(word)) shared++
        }
        if (shared > 0) {
          this.connectionCache.push({ i, j, shared })
        }
      }
    }
    this.connectionsDirty = false
  }

  /** Draw faint connection lines between memories that share words */
  private renderConnections(ctx: CanvasRenderingContext2D, _projScreenMatrix: THREE.Matrix4) {
    if (this.nodes.length < 2 || !this.camera) return

    if (this.connectionsDirty) {
      this.recomputeConnections()
    }

    // Build screen positions for visible nodes
    const screenPositions: (null | { x: number; y: number })[] = new Array(this.nodes.length).fill(null)

    for (let idx = 0; idx < this.nodes.length; idx++) {
      const node = this.nodes[idx]
      const pos3 = node.mesh.position.clone()
      pos3.project(this.camera)
      if (pos3.z > 1) continue

      const screenX = (pos3.x * 0.5 + 0.5) * this.width
      const screenY = (-pos3.y * 0.5 + 0.5) * this.height
      if (screenX < -100 || screenX > this.width + 100 ||
          screenY < -100 || screenY > this.height + 100) continue

      const dist = node.mesh.position.distanceTo(this.camera.position)
      if (dist > 500) continue

      screenPositions[idx] = { x: screenX, y: screenY }
    }

    // Draw cached connections
    for (const conn of this.connectionCache) {
      const a = screenPositions[conn.i]
      const b = screenPositions[conn.j]
      if (!a || !b) continue

      const lineAlpha = Math.min(conn.shared * 0.06, 0.15)

      ctx.beginPath()
      ctx.moveTo(a.x, a.y)

      const midX = (a.x + b.x) / 2
      const midY = (a.y + b.y) / 2
      const offset = Math.sin(this.time * 0.005 + conn.i + conn.j) * 20
      ctx.quadraticCurveTo(midX + offset, midY + offset, b.x, b.y)

      const hue = (this.nodes[conn.i].memory.hue + this.nodes[conn.j].memory.hue) * 0.5 * 360
      ctx.strokeStyle = `hsla(${hue}, 50%, 60%, ${lineAlpha})`
      ctx.lineWidth = 0.5
      ctx.stroke()
    }
  }

  /** Update a memory's degraded state */
  updateMemory(memory: StoredMemory) {
    const node = this.nodes.find(n => n.memory.id === memory.id)
    if (node) {
      node.memory = memory
      node.scale = this.getScaleForMemory(memory)
    }
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
    for (const node of this.nodes) {
      node.mesh.material.dispose()
      this.scene?.remove(node.mesh)
    }
    this.canvas.remove()
  }
}
