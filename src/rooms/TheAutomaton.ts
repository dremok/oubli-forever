/**
 * THE AUTOMATON — cellular life emerges from rules
 *
 * No memories. No text. Just Conway's Game of Life running on a grid.
 * Click to seed living cells. Watch patterns emerge, oscillate, and die.
 * The universe follows four simple rules and produces infinite complexity.
 *
 * The Oubli twist: cells have a "generation" counter that affects their
 * color. New cells are bright pink. Old cells fade to gold, then gray.
 * Cells that have died and been reborn glow violet — resurrection cells.
 *
 * The grid wraps at edges (toroidal topology). An age counter shows
 * how many generations have passed. Speed can be adjusted by scrolling.
 *
 * This room is purely mathematical — a meditation on emergence,
 * how simple rules create complexity, how life and death are the same
 * process viewed from different angles.
 *
 * Inspired by: Conway's Game of Life, cellular automata, emergence
 * theory, artificial life, Wolfram's Rule 110, the heat death of
 * the universe, how neurons are just cells following rules
 */

import type { Room } from './RoomManager'

interface AutomatonDeps {
  switchTo?: (name: string) => void
}

const PATTERNS = {
  glider: [[0,1],[1,2],[2,0],[2,1],[2,2]],
  blinker: [[1,0],[1,1],[1,2]],
  block: [[0,0],[0,1],[1,0],[1,1]],
  beacon: [[0,0],[0,1],[1,0],[2,3],[3,2],[3,3]],
  pulsar: [
    [2,0],[3,0],[4,0],[8,0],[9,0],[10,0],
    [0,2],[5,2],[7,2],[12,2],
    [0,3],[5,3],[7,3],[12,3],
    [0,4],[5,4],[7,4],[12,4],
    [2,5],[3,5],[4,5],[8,5],[9,5],[10,5],
    [2,7],[3,7],[4,7],[8,7],[9,7],[10,7],
    [0,8],[5,8],[7,8],[12,8],
    [0,9],[5,9],[7,9],[12,9],
    [0,10],[5,10],[7,10],[12,10],
    [2,12],[3,12],[4,12],[8,12],[9,12],[10,12],
  ],
}

export function createAutomatonRoom(deps?: AutomatonDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let generation = 0
  let speed = 8 // frames between updates (lower = faster)
  let frameCount = 0
  let paused = false
  let hoveredNav = -1

  const navPoints = [
    { label: '\u2699 terrarium', room: 'terrarium', xFrac: 0.07, yFrac: 0.06 },
    { label: '\u2699 seismograph', room: 'seismograph', xFrac: 0.93, yFrac: 0.06 },
    { label: '\u2699 pendulum', room: 'pendulum', xFrac: 0.07, yFrac: 0.94 },
  ]

  let cols = 0
  let rows = 0
  const cellSize = 6
  let grid: number[][] = []  // 0 = dead, >0 = age (generation when born)
  let deathCount: number[][] = [] // how many times this cell has died

  function initGrid() {
    cols = Math.ceil(window.innerWidth / cellSize)
    rows = Math.ceil(window.innerHeight / cellSize)
    grid = Array.from({ length: rows }, () => Array(cols).fill(0))
    deathCount = Array.from({ length: rows }, () => Array(cols).fill(0))
    generation = 0

    // Seed with a few random patterns
    seedRandom(0.08)
  }

  function seedRandom(density: number) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < density) {
          grid[r][c] = generation + 1
        }
      }
    }
  }

  function placePattern(name: keyof typeof PATTERNS, startRow: number, startCol: number) {
    const pattern = PATTERNS[name]
    for (const [dr, dc] of pattern) {
      const r = (startRow + dr) % rows
      const c = (startCol + dc) % cols
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        grid[r][c] = generation + 1
      }
    }
  }

  function countNeighbors(r: number, c: number): number {
    let count = 0
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        const nr = (r + dr + rows) % rows
        const nc = (c + dc + cols) % cols
        if (grid[nr][nc] > 0) count++
      }
    }
    return count
  }

  function step() {
    const next: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0))

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const neighbors = countNeighbors(r, c)
        const alive = grid[r][c] > 0

        if (alive) {
          if (neighbors === 2 || neighbors === 3) {
            next[r][c] = grid[r][c] // survive, keep birth generation
          } else {
            next[r][c] = 0 // die
            deathCount[r][c]++
          }
        } else {
          if (neighbors === 3) {
            next[r][c] = generation + 1 // born
          }
        }
      }
    }

    grid = next
    generation++
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016
    frameCount++

    // Step the simulation
    if (!paused && frameCount % speed === 0) {
      step()
    }

    const w = canvas.width
    const h = canvas.height

    // Clear with very slight trail (creates afterglow)
    ctx.fillStyle = 'rgba(3, 2, 5, 0.85)'
    ctx.fillRect(0, 0, w, h)

    // Draw cells
    let liveCells = 0
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] > 0) {
          liveCells++
          const age = generation - grid[r][c]
          const deaths = deathCount[r][c]

          // Color based on age and resurrection count
          let hue: number, sat: number, light: number, alpha: number
          if (deaths > 0) {
            // Resurrection cells — violet
            hue = 280 + deaths * 10
            sat = 40 + Math.min(deaths * 5, 30)
            light = 40 + Math.min(age, 50)
            alpha = 0.6 + Math.sin(time * 2 + r + c) * 0.1
          } else if (age < 5) {
            // New cells — bright pink
            hue = 330
            sat = 80
            light = 60 - age * 3
            alpha = 0.8
          } else if (age < 30) {
            // Maturing cells — gold
            hue = 40 + age
            sat = 60 - age
            light = 50 - age * 0.5
            alpha = 0.6
          } else {
            // Old cells — fading gray
            hue = 0
            sat = 5
            light = Math.max(15, 40 - age * 0.3)
            alpha = Math.max(0.2, 0.5 - age * 0.005)
          }

          ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`
          ctx.fillRect(c * cellSize, r * cellSize, cellSize - 1, cellSize - 1)
        }
      }
    }

    // UI overlay
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(180, 160, 200, ${0.08 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the automaton', w / 2, 25)

    // Stats
    ctx.font = '9px monospace'
    ctx.fillStyle = 'rgba(180, 160, 200, 0.08)'
    ctx.textAlign = 'left'
    ctx.fillText(`gen ${generation}`, 12, h - 30)
    ctx.fillText(`${liveCells} alive`, 12, h - 18)

    ctx.textAlign = 'right'
    ctx.fillText(`speed: ${11 - speed}`, w - 12, h - 30)
    ctx.fillText(paused ? 'paused' : 'running', w - 12, h - 18)

    // Hints
    ctx.font = '9px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(180, 160, 200, 0.05)'
    ctx.textAlign = 'center'
    ctx.fillText('click to seed life · scroll to change speed · space to pause · r to reset', w / 2, h - 8)

    // Navigation portals — gear/cog labels
    if (deps?.switchTo) {
      for (let i = 0; i < navPoints.length; i++) {
        const np = navPoints[i]
        const nx = w * np.xFrac
        const ny = h * np.yFrac
        const hovered = hoveredNav === i
        const a = hovered ? 0.35 : 0.06
        ctx.font = '9px monospace'
        ctx.fillStyle = `rgba(180, 160, 200, ${a})`
        ctx.textAlign = np.xFrac < 0.5 ? 'left' : 'right'
        ctx.fillText(np.label, nx, ny)
        if (hovered) {
          ctx.fillStyle = 'rgba(180, 160, 200, 0.15)'
          ctx.beginPath()
          ctx.arc(nx + (np.xFrac < 0.5 ? -8 : 8), ny - 3, 4, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    // Auto-reseed if everything dies
    if (liveCells === 0 && !paused) {
      seedRandom(0.05)
    }
  }

  return {
    name: 'automaton',
    label: 'the automaton',

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
      canvas.style.cssText = 'width: 100%; height: 100%; cursor: crosshair;'
      ctx = canvas.getContext('2d')

      // Click to seed cells
      canvas.addEventListener('click', (e) => {
        const c = Math.floor(e.clientX / cellSize)
        const r = Math.floor(e.clientY / cellSize)
        // Place a random pattern or just toggle cells
        if (Math.random() < 0.3) {
          const patternNames = Object.keys(PATTERNS) as (keyof typeof PATTERNS)[]
          const name = patternNames[Math.floor(Math.random() * patternNames.length)]
          placePattern(name, r, c)
        } else {
          // Draw a small cluster
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              if (Math.random() < 0.5) {
                const nr = (r + dr + rows) % rows
                const nc = (c + dc + cols) % cols
                grid[nr][nc] = generation + 1
              }
            }
          }
        }
      })

      // Drag to paint
      let painting = false
      canvas.addEventListener('mousedown', () => { painting = true })
      canvas.addEventListener('mouseup', () => { painting = false })
      canvas.addEventListener('mouseleave', () => { painting = false })
      canvas.addEventListener('mousemove', (e) => {
        if (!painting) return
        const c = Math.floor(e.clientX / cellSize)
        const r = Math.floor(e.clientY / cellSize)
        if (r >= 0 && r < rows && c >= 0 && c < cols) {
          grid[r][c] = generation + 1
        }
      })

      // Scroll to change speed
      canvas.addEventListener('wheel', (e) => {
        speed = Math.max(1, Math.min(10, speed + (e.deltaY > 0 ? 1 : -1)))
        e.preventDefault()
      }, { passive: false })

      // Keyboard: space to pause, r to reset
      const onKey = (e: KeyboardEvent) => {
        if (e.key === ' ') {
          paused = !paused
          e.preventDefault()
        }
        if (e.key === 'r' || e.key === 'R') {
          initGrid()
        }
      }
      window.addEventListener('keydown', onKey)

      // Navigation portal click + hover
      canvas.addEventListener('click', (e) => {
        if (!deps?.switchTo || !canvas) return
        for (let i = 0; i < navPoints.length; i++) {
          const nx = canvas.width * navPoints[i].xFrac
          const ny = canvas.height * navPoints[i].yFrac
          const dx = e.clientX - nx
          const dy = e.clientY - ny
          if (dx * dx + dy * dy < 600) {
            deps.switchTo(navPoints[i].room)
            return
          }
        }
      })
      canvas.addEventListener('mousemove', (e) => {
        if (!deps?.switchTo || !canvas) return
        hoveredNav = -1
        for (let i = 0; i < navPoints.length; i++) {
          const nx = canvas.width * navPoints[i].xFrac
          const ny = canvas.height * navPoints[i].yFrac
          const dx = e.clientX - nx
          const dy = e.clientY - ny
          if (dx * dx + dy * dy < 600) {
            hoveredNav = i
            break
          }
        }
      })

      overlay.appendChild(canvas)

      const onResize = () => {
        if (canvas) {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
          initGrid()
        }
      }
      window.addEventListener('resize', onResize)

      return overlay
    },

    activate() {
      active = true
      initGrid()
      render()
    },

    deactivate() {
      active = false
      cancelAnimationFrame(frameId)
    },

    destroy() {
      active = false
      cancelAnimationFrame(frameId)
      overlay?.remove()
    },
  }
}
