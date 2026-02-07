/**
 * THE LABYRINTH — you are inside
 *
 * First-person maze exploration via simple raycasting.
 * WASD to move, mouse to look. The maze is procedurally generated
 * each visit. Walls are dark, distant walls fade to nothing.
 *
 * No minimap. No compass. No breadcrumbs. Just you and the corridors.
 * The exit leads back to the void.
 *
 * No memory dependency. Pure spatial exploration.
 *
 * Inspired by: Wolfenstein 3D raycasting, hedge mazes, Borges'
 * "Garden of Forking Paths", the Minotaur's labyrinth,
 * how getting lost is a form of finding yourself
 */

import type { Room } from './RoomManager'

interface LabyrinthDeps {
  onExit?: () => void
}

export function createLabyrinthRoom(deps: LabyrinthDeps = {}): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  // Player state
  let px = 1.5
  let py = 1.5
  let pa = 0 // angle in radians
  const moveSpeed = 0.03
  const turnSpeed = 0.04

  // Maze
  let maze: number[][] = []
  let mazeW = 0
  let mazeH = 0
  let exitX = 0
  let exitY = 0

  // Input
  const keys = new Set<string>()

  function generateMaze(width: number, height: number): number[][] {
    // Ensure odd dimensions for proper maze generation
    const w = width | 1
    const h = height | 1
    mazeW = w
    mazeH = h

    // Fill with walls
    const grid: number[][] = Array.from({ length: h }, () => Array(w).fill(1))

    // Recursive backtracker
    function carve(x: number, y: number) {
      grid[y][x] = 0
      const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]]
      // Shuffle directions
      for (let i = dirs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[dirs[i], dirs[j]] = [dirs[j], dirs[i]]
      }
      for (const [dx, dy] of dirs) {
        const nx = x + dx
        const ny = y + dy
        if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1 && grid[ny][nx] === 1) {
          grid[y + dy / 2][x + dx / 2] = 0 // carve wall between
          carve(nx, ny)
        }
      }
    }

    carve(1, 1)

    // Place exit far from start
    exitX = w - 2
    exitY = h - 2
    grid[exitY][exitX] = 2 // exit marker

    return grid
  }

  function castRay(ox: number, oy: number, angle: number): { dist: number; side: number; cell: number } {
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)

    let t = 0
    const step = 0.02

    while (t < 20) {
      const x = ox + dx * t
      const y = oy + dy * t
      const mx = Math.floor(x)
      const my = Math.floor(y)

      if (mx < 0 || mx >= mazeW || my < 0 || my >= mazeH) {
        return { dist: t, side: 0, cell: 1 }
      }

      if (maze[my][mx] >= 1) {
        // Determine which side was hit (for shading)
        const prevX = Math.floor(ox + dx * (t - step))
        const prevY = Math.floor(oy + dy * (t - step))
        const side = (prevX !== mx) ? 0 : 1
        return { dist: t, side, cell: maze[my][mx] }
      }

      t += step
    }

    return { dist: 20, side: 0, cell: 0 }
  }

  function update() {
    // Movement
    let moveX = 0
    let moveY = 0

    if (keys.has('w') || keys.has('arrowup')) {
      moveX += Math.cos(pa) * moveSpeed
      moveY += Math.sin(pa) * moveSpeed
    }
    if (keys.has('s') || keys.has('arrowdown')) {
      moveX -= Math.cos(pa) * moveSpeed
      moveY -= Math.sin(pa) * moveSpeed
    }
    if (keys.has('a') || keys.has('arrowleft')) {
      pa -= turnSpeed
    }
    if (keys.has('d') || keys.has('arrowright')) {
      pa += turnSpeed
    }

    // Collision detection
    const newX = px + moveX
    const newY = py + moveY
    const margin = 0.2

    if (maze[Math.floor(py)][Math.floor(newX + margin * Math.sign(moveX))] === 0 ||
        maze[Math.floor(py)][Math.floor(newX + margin * Math.sign(moveX))] === 2) {
      px = newX
    }
    if (maze[Math.floor(newY + margin * Math.sign(moveY))][Math.floor(px)] === 0 ||
        maze[Math.floor(newY + margin * Math.sign(moveY))][Math.floor(px)] === 2) {
      py = newY
    }

    // Check if at exit
    if (Math.floor(px) === exitX && Math.floor(py) === exitY) {
      if (deps.onExit) {
        deps.onExit()
      } else {
        // Generate new maze
        maze = generateMaze(21, 21)
        px = 1.5
        py = 1.5
      }
    }
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    update()

    const w = canvas.width
    const h = canvas.height
    const numRays = Math.min(w, 400)
    const fov = Math.PI / 3 // 60 degrees

    // Clear
    ctx.fillStyle = 'rgba(3, 2, 6, 1)'
    ctx.fillRect(0, 0, w, h)

    // Ceiling gradient
    const ceilGrad = ctx.createLinearGradient(0, 0, 0, h / 2)
    ceilGrad.addColorStop(0, 'rgba(5, 3, 10, 1)')
    ceilGrad.addColorStop(1, 'rgba(10, 8, 18, 1)')
    ctx.fillStyle = ceilGrad
    ctx.fillRect(0, 0, w, h / 2)

    // Floor gradient
    const floorGrad = ctx.createLinearGradient(0, h / 2, 0, h)
    floorGrad.addColorStop(0, 'rgba(8, 6, 12, 1)')
    floorGrad.addColorStop(1, 'rgba(3, 2, 6, 1)')
    ctx.fillStyle = floorGrad
    ctx.fillRect(0, h / 2, w, h / 2)

    // Raycasting
    const stripW = w / numRays

    for (let i = 0; i < numRays; i++) {
      const rayAngle = pa - fov / 2 + (i / numRays) * fov
      const hit = castRay(px, py, rayAngle)

      // Fix fisheye
      const correctedDist = hit.dist * Math.cos(rayAngle - pa)
      const wallHeight = Math.min(h * 2, h / correctedDist)

      const wallTop = (h - wallHeight) / 2
      const brightness = Math.max(0, 1 - correctedDist / 10)

      let r: number, g: number, b: number

      if (hit.cell === 2) {
        // Exit — golden glow
        r = 255 * brightness
        g = 215 * brightness
        b = 0
      } else {
        // Normal wall
        const sideDim = hit.side ? 0.7 : 1.0
        r = 40 * brightness * sideDim
        g = 30 * brightness * sideDim
        b = 60 * brightness * sideDim
      }

      ctx.fillStyle = `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`
      ctx.fillRect(i * stripW, wallTop, stripW + 1, wallHeight)
    }

    // FOV indicator (subtle crosshair)
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.05)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(w / 2 - 8, h / 2)
    ctx.lineTo(w / 2 + 8, h / 2)
    ctx.moveTo(w / 2, h / 2 - 8)
    ctx.lineTo(w / 2, h / 2 + 8)
    ctx.stroke()

    // Title
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(140, 120, 160, ${0.06 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the labyrinth', w / 2, 25)

    // Hint
    ctx.font = '9px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(140, 120, 160, 0.04)'
    ctx.textAlign = 'center'
    ctx.fillText('WASD or arrow keys to move · find the golden exit', w / 2, h - 8)

    // Minimap position hint (very vague — just shows grid coordinates)
    ctx.font = '8px monospace'
    ctx.fillStyle = 'rgba(140, 120, 160, 0.04)'
    ctx.textAlign = 'left'
    ctx.fillText(`${Math.floor(px)},${Math.floor(py)}`, 12, h - 18)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!active) return
    const key = e.key.toLowerCase()
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      keys.add(key)
      e.preventDefault()
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    keys.delete(e.key.toLowerCase())
  }

  return {
    name: 'labyrinth',
    label: 'the labyrinth',

    create() {
      overlay = document.createElement('div')
      overlay.style.cssText = `
        width: 100%; height: 100%;
        pointer-events: auto;
        background: #000;
      `

      canvas = document.createElement('canvas')
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      canvas.style.cssText = 'width: 100%; height: 100%;'
      ctx = canvas.getContext('2d')

      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        }
      }
      window.addEventListener('resize', onResize)

      overlay.appendChild(canvas)
      return overlay
    },

    activate() {
      active = true
      maze = generateMaze(21, 21)
      px = 1.5
      py = 1.5
      pa = 0
      keys.clear()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
      keys.clear()
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      overlay?.remove()
    },
  }
}
