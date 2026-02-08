/**
 * ROOM AFTERIMAGE — traces of a room persist briefly after you leave
 *
 * When you navigate away from a room, visual echoes of that room
 * drift across the new space for a few seconds before dissolving.
 * Each room has a unique visual signature: the furnace leaves embers,
 * the tide pool leaves wave ripples, the choir leaves sound waves.
 *
 * This makes the house feel alive and interconnected — rooms bleed
 * into each other like memories bleed into consciousness. You carry
 * traces of where you've been.
 *
 * Inspired by: retinal afterimages, Olafur Eliasson's color experiments,
 * the way a scent lingers after you leave a room, Proust's involuntary
 * memory — traces that persist beyond their source.
 */

interface AfterimageParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  maxAlpha: number
  fadeRate: number
  color: string
  shape: 'circle' | 'line' | 'ring' | 'spark' | 'snowflake' | 'wave' | 'grain'
  rotation: number
  rotationSpeed: number
  age: number
}

interface RoomSignature {
  colors: string[]
  shapes: AfterimageParticle['shape'][]
  count: number
  spawnPattern: 'scatter' | 'rise' | 'fall' | 'edges' | 'center' | 'sweep'
  maxAlpha: number
  sizeRange: [number, number]
  speedRange: [number, number]
  fadeRate: number
}

// Each room's unique visual afterimage
const ROOM_SIGNATURES: Record<string, RoomSignature> = {
  void: {
    colors: ['255,20,147', '255,215,0'],
    shapes: ['circle', 'spark'],
    count: 20,
    spawnPattern: 'scatter',
    maxAlpha: 0.08,
    sizeRange: [1, 3],
    speedRange: [0.1, 0.4],
    fadeRate: 0.003,
  },
  furnace: {
    colors: ['255,120,20', '255,80,0', '255,200,50'],
    shapes: ['spark', 'circle'],
    count: 30,
    spawnPattern: 'rise',
    maxAlpha: 0.12,
    sizeRange: [1, 4],
    speedRange: [0.3, 0.8],
    fadeRate: 0.004,
  },
  tidepool: {
    colors: ['80,180,220', '120,200,240', '60,140,200'],
    shapes: ['ring', 'wave'],
    count: 15,
    spawnPattern: 'edges',
    maxAlpha: 0.08,
    sizeRange: [8, 25],
    speedRange: [0.05, 0.2],
    fadeRate: 0.002,
  },
  choir: {
    colors: ['200,180,255', '160,140,220'],
    shapes: ['ring'],
    count: 12,
    spawnPattern: 'center',
    maxAlpha: 0.06,
    sizeRange: [15, 40],
    speedRange: [0.2, 0.5],
    fadeRate: 0.003,
  },
  garden: {
    colors: ['80,200,80', '120,220,100', '60,180,90'],
    shapes: ['circle'],
    count: 25,
    spawnPattern: 'scatter',
    maxAlpha: 0.09,
    sizeRange: [1, 3],
    speedRange: [0.1, 0.3],
    fadeRate: 0.003,
  },
  disintegration: {
    colors: ['140,100,60', '180,140,80', '100,80,50'],
    shapes: ['grain', 'line'],
    count: 35,
    spawnPattern: 'fall',
    maxAlpha: 0.1,
    sizeRange: [1, 2],
    speedRange: [0.2, 0.6],
    fadeRate: 0.004,
  },
  midnight: {
    colors: ['180,200,255', '140,160,220'],
    shapes: ['circle'],
    count: 10,
    spawnPattern: 'scatter',
    maxAlpha: 0.06,
    sizeRange: [2, 6],
    speedRange: [0.02, 0.08],
    fadeRate: 0.002,
  },
  glacarium: {
    colors: ['180,220,255', '200,240,255', '160,200,240'],
    shapes: ['snowflake'],
    count: 20,
    spawnPattern: 'fall',
    maxAlpha: 0.1,
    sizeRange: [2, 5],
    speedRange: [0.1, 0.3],
    fadeRate: 0.003,
  },
  radio: {
    colors: ['150,200,150', '120,180,120'],
    shapes: ['line'],
    count: 25,
    spawnPattern: 'scatter',
    maxAlpha: 0.07,
    sizeRange: [10, 30],
    speedRange: [0.5, 1.5],
    fadeRate: 0.005,
  },
  projection: {
    colors: ['255,230,200', '200,180,150'],
    shapes: ['grain', 'grain', 'line'],
    count: 40,
    spawnPattern: 'scatter',
    maxAlpha: 0.06,
    sizeRange: [1, 2],
    speedRange: [0.1, 0.3],
    fadeRate: 0.004,
  },
  lighthouse: {
    colors: ['255,240,200', '255,220,150'],
    shapes: ['spark'],
    count: 8,
    spawnPattern: 'sweep',
    maxAlpha: 0.1,
    sizeRange: [2, 5],
    speedRange: [0.5, 1.0],
    fadeRate: 0.003,
  },
  observatory: {
    colors: ['220,200,255', '180,160,240', '255,215,0'],
    shapes: ['circle', 'spark'],
    count: 18,
    spawnPattern: 'scatter',
    maxAlpha: 0.07,
    sizeRange: [1, 3],
    speedRange: [0.05, 0.15],
    fadeRate: 0.002,
  },
  well: {
    colors: ['80,120,180', '60,100,160'],
    shapes: ['ring'],
    count: 8,
    spawnPattern: 'center',
    maxAlpha: 0.07,
    sizeRange: [10, 30],
    speedRange: [0.3, 0.6],
    fadeRate: 0.003,
  },
  seance: {
    colors: ['180,140,255', '200,160,255'],
    shapes: ['circle', 'spark'],
    count: 12,
    spawnPattern: 'scatter',
    maxAlpha: 0.06,
    sizeRange: [2, 5],
    speedRange: [0.05, 0.15],
    fadeRate: 0.002,
  },
  instrument: {
    colors: ['255,180,100', '255,200,120'],
    shapes: ['wave'],
    count: 10,
    spawnPattern: 'center',
    maxAlpha: 0.06,
    sizeRange: [15, 35],
    speedRange: [0.1, 0.3],
    fadeRate: 0.003,
  },
  clocktower: {
    colors: ['255,215,0', '200,180,100'],
    shapes: ['circle', 'line'],
    count: 12,
    spawnPattern: 'center',
    maxAlpha: 0.06,
    sizeRange: [1, 3],
    speedRange: [0.2, 0.5],
    fadeRate: 0.003,
  },
  loom: {
    colors: ['200,100,100', '180,80,120', '160,120,140'],
    shapes: ['line'],
    count: 15,
    spawnPattern: 'scatter',
    maxAlpha: 0.07,
    sizeRange: [15, 40],
    speedRange: [0.02, 0.08],
    fadeRate: 0.002,
  },
  study: {
    colors: ['255,215,0', '200,180,130'],
    shapes: ['grain'],
    count: 15,
    spawnPattern: 'scatter',
    maxAlpha: 0.05,
    sizeRange: [1, 2],
    speedRange: [0.05, 0.15],
    fadeRate: 0.002,
  },
  labyrinth: {
    colors: ['100,100,120', '80,80,100'],
    shapes: ['line'],
    count: 12,
    spawnPattern: 'scatter',
    maxAlpha: 0.06,
    sizeRange: [20, 60],
    speedRange: [0, 0.02],
    fadeRate: 0.003,
  },
  catacombs: {
    colors: ['120,100,80', '100,80,60'],
    shapes: ['grain', 'circle'],
    count: 20,
    spawnPattern: 'fall',
    maxAlpha: 0.07,
    sizeRange: [1, 2],
    speedRange: [0.1, 0.3],
    fadeRate: 0.003,
  },
}

// Default signature for rooms without a specific one
const DEFAULT_SIGNATURE: RoomSignature = {
  colors: ['255,215,0', '255,20,147'],
  shapes: ['circle'],
  count: 12,
  spawnPattern: 'scatter',
  maxAlpha: 0.05,
  sizeRange: [1, 3],
  speedRange: [0.05, 0.2],
  fadeRate: 0.003,
}

export class RoomAfterimage {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private particles: AfterimageParticle[] = []
  private animating = false
  private frameId = 0
  private width = 0
  private height = 0
  private dpr = 1

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 55; pointer-events: none;
    `
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  private resize() {
    this.dpr = Math.min(window.devicePixelRatio, 2)
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = this.width * this.dpr
    this.canvas.height = this.height * this.dpr
    this.canvas.style.width = this.width + 'px'
    this.canvas.style.height = this.height + 'px'
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  /** Called when leaving a room — spawns that room's afterimage */
  trigger(roomName: string) {
    const sig = ROOM_SIGNATURES[roomName] || DEFAULT_SIGNATURE

    for (let i = 0; i < sig.count; i++) {
      const color = sig.colors[Math.floor(Math.random() * sig.colors.length)]
      const shape = sig.shapes[Math.floor(Math.random() * sig.shapes.length)]
      const size = sig.sizeRange[0] + Math.random() * (sig.sizeRange[1] - sig.sizeRange[0])
      const speed = sig.speedRange[0] + Math.random() * (sig.speedRange[1] - sig.speedRange[0])

      let x: number, y: number, vx: number, vy: number

      switch (sig.spawnPattern) {
        case 'rise':
          x = Math.random() * this.width
          y = this.height * (0.6 + Math.random() * 0.4)
          vx = (Math.random() - 0.5) * speed * 0.5
          vy = -speed
          break
        case 'fall':
          x = Math.random() * this.width
          y = Math.random() * this.height * 0.3
          vx = (Math.random() - 0.5) * speed * 0.3
          vy = speed
          break
        case 'edges':
          if (Math.random() < 0.5) {
            x = Math.random() < 0.5 ? -10 : this.width + 10
            y = Math.random() * this.height
          } else {
            x = Math.random() * this.width
            y = Math.random() < 0.5 ? -10 : this.height + 10
          }
          vx = (this.width / 2 - x) * speed * 0.003
          vy = (this.height / 2 - y) * speed * 0.003
          break
        case 'center':
          x = this.width / 2 + (Math.random() - 0.5) * 60
          y = this.height / 2 + (Math.random() - 0.5) * 60
          const angle = Math.random() * Math.PI * 2
          vx = Math.cos(angle) * speed
          vy = Math.sin(angle) * speed
          break
        case 'sweep': {
          const sweepAngle = (i / sig.count) * Math.PI * 2
          x = this.width / 2 + Math.cos(sweepAngle) * this.width * 0.4
          y = this.height / 2 + Math.sin(sweepAngle) * this.height * 0.4
          vx = Math.cos(sweepAngle) * speed
          vy = Math.sin(sweepAngle) * speed
          break
        }
        default: // scatter
          x = Math.random() * this.width
          y = Math.random() * this.height
          vx = (Math.random() - 0.5) * speed
          vy = (Math.random() - 0.5) * speed
          break
      }

      this.particles.push({
        x, y, vx, vy, size,
        alpha: 0,
        maxAlpha: sig.maxAlpha * (0.6 + Math.random() * 0.4),
        fadeRate: sig.fadeRate * (0.8 + Math.random() * 0.4),
        color,
        shape,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.02,
        age: 0,
      })
    }

    this.startAnimation()
  }

  private startAnimation() {
    if (this.animating) return
    this.animating = true

    const animate = () => {
      this.update()
      this.render()

      if (this.particles.length > 0) {
        this.frameId = requestAnimationFrame(animate)
      } else {
        this.animating = false
        this.ctx.clearRect(0, 0, this.width, this.height)
      }
    }
    this.frameId = requestAnimationFrame(animate)
  }

  private update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.age++

      // Fade in for first 30 frames, then fade out
      if (p.age < 30) {
        p.alpha = Math.min(p.alpha + p.maxAlpha / 30, p.maxAlpha)
      } else {
        p.alpha -= p.fadeRate
      }

      p.x += p.vx
      p.y += p.vy
      p.rotation += p.rotationSpeed

      // Slight deceleration
      p.vx *= 0.998
      p.vy *= 0.998

      // Remove dead particles
      if (p.alpha <= 0) {
        this.particles.splice(i, 1)
      }
    }
  }

  private render() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    for (const p of this.particles) {
      if (p.alpha < 0.005) continue

      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      ctx.globalAlpha = p.alpha

      switch (p.shape) {
        case 'circle':
          ctx.beginPath()
          ctx.arc(0, 0, p.size, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${p.color}, 1)`
          ctx.fill()
          break

        case 'spark': {
          ctx.fillStyle = `rgba(${p.color}, 1)`
          const len = p.size * 3
          ctx.fillRect(-0.5, -len / 2, 1, len)
          ctx.fillRect(-len / 2, -0.5, len, 1)
          break
        }

        case 'ring':
          ctx.beginPath()
          ctx.arc(0, 0, p.size, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(${p.color}, 1)`
          ctx.lineWidth = 0.8
          ctx.stroke()
          break

        case 'line': {
          ctx.strokeStyle = `rgba(${p.color}, 1)`
          ctx.lineWidth = 0.5
          ctx.beginPath()
          ctx.moveTo(-p.size / 2, 0)
          ctx.lineTo(p.size / 2, 0)
          ctx.stroke()
          break
        }

        case 'snowflake': {
          ctx.strokeStyle = `rgba(${p.color}, 1)`
          ctx.lineWidth = 0.6
          for (let a = 0; a < 6; a++) {
            const angle = (a / 6) * Math.PI * 2
            ctx.beginPath()
            ctx.moveTo(0, 0)
            ctx.lineTo(Math.cos(angle) * p.size, Math.sin(angle) * p.size)
            ctx.stroke()
          }
          break
        }

        case 'wave':
          ctx.strokeStyle = `rgba(${p.color}, 1)`
          ctx.lineWidth = 0.6
          ctx.beginPath()
          for (let w = 0; w < p.size; w++) {
            const wx = w - p.size / 2
            const wy = Math.sin(w * 0.3 + p.age * 0.05) * 3
            if (w === 0) ctx.moveTo(wx, wy)
            else ctx.lineTo(wx, wy)
          }
          ctx.stroke()
          break

        case 'grain':
          ctx.fillStyle = `rgba(${p.color}, 1)`
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
          break
      }

      ctx.restore()
    }
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
    this.canvas.remove()
  }
}
