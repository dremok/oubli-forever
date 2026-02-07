/**
 * THE TERRARIUM — artificial life in a glass box
 *
 * A self-sustaining ecosystem of simple creatures. They eat, reproduce,
 * age, and die. Food grows from the bottom. Creatures evolve simple
 * behaviors through genetic variation.
 *
 * No memories. No text. Just life happening.
 *
 * Creatures have: position, velocity, energy, age, color (genes).
 * They seek food, avoid walls, and reproduce when energy is high.
 * Offspring inherit parents' color with slight mutations.
 *
 * Over time, the population finds an equilibrium — or crashes.
 * Each reset produces a different evolutionary trajectory.
 *
 * Inspired by: terrariums, closed ecosystems, Tierra (artificial life),
 * boids, genetic algorithms, the Game of Life's cousin that has
 * metabolism and death. How ecosystems are just physics with hunger.
 */

import type { Room } from './RoomManager'

interface Creature {
  x: number
  y: number
  vx: number
  vy: number
  energy: number
  age: number
  maxAge: number
  speed: number
  size: number
  senseRange: number
  hue: number
  generation: number
}

interface Food {
  x: number
  y: number
  energy: number
  size: number
  growth: number
}

export function createTerrariumRoom(): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0

  let creatures: Creature[] = []
  let food: Food[] = []
  let deathParticles: { x: number; y: number; vx: number; vy: number; life: number; hue: number }[] = []

  let totalBorn = 0
  let totalDied = 0
  let maxGeneration = 0

  function init() {
    if (!canvas) return
    creatures = []
    food = []
    deathParticles = []
    totalBorn = 0
    totalDied = 0
    maxGeneration = 0

    const w = canvas.width
    const h = canvas.height

    // Seed initial creatures
    for (let i = 0; i < 20; i++) {
      creatures.push(spawnCreature(
        w * 0.2 + Math.random() * w * 0.6,
        h * 0.2 + Math.random() * h * 0.6,
        0,
      ))
    }

    // Seed initial food
    for (let i = 0; i < 40; i++) {
      food.push(spawnFood(w, h))
    }
  }

  function spawnCreature(x: number, y: number, gen: number, parentHue?: number): Creature {
    const hue = parentHue !== undefined
      ? parentHue + (Math.random() - 0.5) * 30 // mutation
      : Math.random() * 360

    totalBorn++
    maxGeneration = Math.max(maxGeneration, gen)

    return {
      x, y,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      energy: 50 + Math.random() * 30,
      age: 0,
      maxAge: 800 + Math.random() * 400,
      speed: 0.8 + Math.random() * 0.8,
      size: 3 + Math.random() * 2,
      senseRange: 60 + Math.random() * 40,
      hue: ((hue % 360) + 360) % 360,
      generation: gen,
    }
  }

  function spawnFood(w: number, h: number): Food {
    return {
      x: Math.random() * w,
      y: h * 0.4 + Math.random() * h * 0.55, // food grows mostly in lower half
      energy: 20 + Math.random() * 15,
      size: 2 + Math.random() * 2,
      growth: 0,
    }
  }

  function update() {
    if (!canvas) return
    const w = canvas.width
    const h = canvas.height

    // Grow new food occasionally
    if (food.length < 60 && Math.random() < 0.05) {
      food.push(spawnFood(w, h))
    }

    // Food growth animation
    for (const f of food) {
      if (f.growth < 1) f.growth += 0.02
    }

    // Update creatures
    const newCreatures: Creature[] = []

    for (const c of creatures) {
      c.age++
      c.energy -= 0.1 + c.speed * 0.05 // metabolism cost

      // Find nearest food
      let nearestFood: Food | null = null
      let nearestDist = Infinity
      for (const f of food) {
        const dx = f.x - c.x
        const dy = f.y - c.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < nearestDist && dist < c.senseRange) {
          nearestFood = f
          nearestDist = dist
        }
      }

      // Steering
      if (nearestFood) {
        const dx = nearestFood.x - c.x
        const dy = nearestFood.y - c.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        c.vx += (dx / dist) * 0.15
        c.vy += (dy / dist) * 0.15

        // Eat
        if (dist < c.size + nearestFood.size) {
          c.energy += nearestFood.energy
          food.splice(food.indexOf(nearestFood), 1)
        }
      } else {
        // Wander
        c.vx += (Math.random() - 0.5) * 0.3
        c.vy += (Math.random() - 0.5) * 0.3
      }

      // Speed limit
      const speed = Math.sqrt(c.vx * c.vx + c.vy * c.vy)
      if (speed > c.speed) {
        c.vx = (c.vx / speed) * c.speed
        c.vy = (c.vy / speed) * c.speed
      }

      // Move
      c.x += c.vx
      c.y += c.vy

      // Bounce off walls (terrarium glass)
      const margin = 20
      if (c.x < margin) { c.x = margin; c.vx *= -0.5 }
      if (c.x > w - margin) { c.x = w - margin; c.vx *= -0.5 }
      if (c.y < margin) { c.y = margin; c.vy *= -0.5 }
      if (c.y > h - margin) { c.y = h - margin; c.vy *= -0.5 }

      // Reproduce when energy is high and population isn't too large
      if (c.energy > 100 && creatures.length + newCreatures.length < 80 && Math.random() < 0.02) {
        c.energy *= 0.5
        newCreatures.push(spawnCreature(
          c.x + (Math.random() - 0.5) * 20,
          c.y + (Math.random() - 0.5) * 20,
          c.generation + 1,
          c.hue,
        ))
      }
    }

    creatures.push(...newCreatures)

    // Death
    creatures = creatures.filter(c => {
      if (c.energy <= 0 || c.age > c.maxAge) {
        totalDied++
        // Death particles
        for (let i = 0; i < 5; i++) {
          deathParticles.push({
            x: c.x,
            y: c.y,
            vx: (Math.random() - 0.5) * 2,
            vy: -Math.random() * 2,
            life: 1,
            hue: c.hue,
          })
        }
        // Dead creatures become food
        food.push({
          x: c.x, y: c.y,
          energy: 10,
          size: 1.5,
          growth: 1,
        })
        return false
      }
      return true
    })

    // Update death particles
    deathParticles = deathParticles.filter(p => {
      p.x += p.vx
      p.y += p.vy
      p.vy -= 0.02
      p.life -= 0.02
      return p.life > 0
    })

    // Auto-reseed if population crashes
    if (creatures.length === 0 && food.length > 5) {
      for (let i = 0; i < 8; i++) {
        creatures.push(spawnCreature(
          w * 0.3 + Math.random() * w * 0.4,
          h * 0.3 + Math.random() * h * 0.4,
          0,
        ))
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

    // Background
    ctx.fillStyle = 'rgba(8, 12, 8, 1)'
    ctx.fillRect(0, 0, w, h)

    // Terrarium glass (border)
    ctx.strokeStyle = 'rgba(80, 100, 80, 0.08)'
    ctx.lineWidth = 2
    ctx.strokeRect(15, 15, w - 30, h - 30)

    // Inner glass reflection
    ctx.strokeStyle = 'rgba(120, 150, 120, 0.03)'
    ctx.lineWidth = 1
    ctx.strokeRect(18, 18, w - 36, h - 36)

    // Soil line
    ctx.fillStyle = 'rgba(40, 30, 20, 0.15)'
    ctx.fillRect(20, h * 0.85, w - 40, h * 0.15 - 15)

    // Draw food
    for (const f of food) {
      const alpha = 0.3 * f.growth
      const glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.size * 2)
      glow.addColorStop(0, `rgba(80, 200, 60, ${alpha})`)
      glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.size * 2, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = `rgba(80, 200, 60, ${alpha * 1.5})`
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.size * f.growth, 0, Math.PI * 2)
      ctx.fill()
    }

    // Draw creatures
    for (const c of creatures) {
      const energyRatio = c.energy / 120
      const ageRatio = c.age / c.maxAge
      const alpha = Math.min(0.8, 0.3 + energyRatio * 0.5)
      const sat = Math.max(20, 60 - ageRatio * 40)

      // Body
      ctx.fillStyle = `hsla(${c.hue}, ${sat}%, 55%, ${alpha})`
      ctx.beginPath()
      ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2)
      ctx.fill()

      // Direction indicator (eye)
      const angle = Math.atan2(c.vy, c.vx)
      const eyeX = c.x + Math.cos(angle) * c.size * 0.6
      const eyeY = c.y + Math.sin(angle) * c.size * 0.6
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.6})`
      ctx.beginPath()
      ctx.arc(eyeX, eyeY, 1, 0, Math.PI * 2)
      ctx.fill()

      // Sense range (very faint)
      if (c.energy < 30) {
        // Hungry — show sense range
        ctx.strokeStyle = `hsla(${c.hue}, 30%, 50%, 0.03)`
        ctx.beginPath()
        ctx.arc(c.x, c.y, c.senseRange, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Energy bar (tiny)
      const barW = c.size * 2
      const barH = 1.5
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
      ctx.fillRect(c.x - barW / 2, c.y - c.size - 4, barW, barH)
      ctx.fillStyle = energyRatio > 0.5
        ? `rgba(80, 200, 80, ${alpha * 0.5})`
        : `rgba(200, 80, 40, ${alpha * 0.5})`
      ctx.fillRect(c.x - barW / 2, c.y - c.size - 4, barW * Math.min(1, energyRatio), barH)
    }

    // Death particles
    for (const p of deathParticles) {
      ctx.fillStyle = `hsla(${p.hue}, 30%, 60%, ${p.life * 0.5})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }

    // Title
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(120, 160, 120, ${0.08 + Math.sin(time * 0.3) * 0.02})`
    ctx.textAlign = 'center'
    ctx.fillText('the terrarium', w / 2, 30)

    // Stats
    ctx.font = '9px monospace'
    ctx.fillStyle = 'rgba(120, 160, 120, 0.1)'
    ctx.textAlign = 'left'
    ctx.fillText(`population: ${creatures.length}`, 25, h - 35)
    ctx.fillText(`food: ${food.length}`, 25, h - 23)

    ctx.textAlign = 'center'
    ctx.fillText(`born: ${totalBorn} · died: ${totalDied}`, w / 2, h - 23)

    ctx.textAlign = 'right'
    ctx.fillText(`gen ${maxGeneration}`, w - 25, h - 35)
    ctx.fillText(`ratio: ${creatures.length > 0 ? (food.length / creatures.length).toFixed(1) : '∞'}`, w - 25, h - 23)

    // Hint
    ctx.font = '9px "Cormorant Garamond", serif'
    ctx.fillStyle = 'rgba(120, 160, 120, 0.04)'
    ctx.textAlign = 'center'
    ctx.fillText('click to add food · watch them live and die', w / 2, h - 8)
  }

  function handleClick(e: MouseEvent) {
    // Click to drop food
    food.push({
      x: e.clientX,
      y: e.clientY,
      energy: 25,
      size: 3,
      growth: 0,
    })
  }

  return {
    name: 'terrarium',
    label: 'the terrarium',

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
      canvas.style.cssText = 'width: 100%; height: 100%; cursor: pointer;'
      ctx = canvas.getContext('2d')

      canvas.addEventListener('click', handleClick)

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
      init()
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
