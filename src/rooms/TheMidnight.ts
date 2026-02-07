/**
 * THE MIDNIGHT — a room that exists most fully at midnight
 *
 * Hidden room accessible from The Clock Tower when the real-world
 * hour changes. A brief portal text appears, and clicking it takes
 * you here.
 *
 * The Midnight is a room that responds to the actual time of day.
 * At midnight (00:00), it's most vivid — colors bright, text clear,
 * the room fully materialized. During the day, it's a ghost: barely
 * visible, text faded, colors desaturated.
 *
 * The room contains a single poem that changes based on the hour.
 * 24 poems, one per hour. The poem degrades inversely to its hour —
 * the midnight poem is pristine, the noon poem is barely legible.
 *
 * Inspired by: Cinderella's midnight, the witching hour,
 * New Year's Eve, shift workers, insomnia, the hours before dawn,
 * how the world feels different at 3am vs 3pm
 */

import type { Room } from './RoomManager'

const HOURLY_POEMS: string[] = [
  // 00:00 — Midnight (most vivid)
  'this is the hour the world holds its breath.\neverything that was becomes what will be.\nthe clock strikes nothing, and that nothing\nis the most honest sound.',

  // 01:00
  'the last person still awake\ncarries the weight of the sleeping world.\ntheir thoughts are the only thoughts.\nfor one hour, they are everyone.',

  // 02:00
  'the house remembers itself at 2am.\nevery creak is a sentence.\nevery shadow, a paragraph.\nthe architecture of night is written in sounds.',

  // 03:00
  'the witching hour.\nnot because of magic\nbut because at 3am\nyou finally stop lying to yourself.',

  // 04:00
  'the birds begin before the light.\nthey sing into darkness\ntrusting that their song\nwill pull the sun upward.',

  // 05:00
  'dawn is forgetting the night.\nthe sky practices colors\nit hasn\'t used in hours.\npink is always a surprise.',

  // 06:00
  'the alarm is the cruelest invention.\nit tears you from a world\nwhere you could fly\nand returns you to one where you walk.',

  // 07:00
  'morning is a mask you put on.\nyou were someone else five minutes ago.\nnow you are the person\nwho gets out of bed.',

  // 08:00
  'the commute is a river\nof people who have all agreed\nto pretend they are going somewhere\nimportant.',

  // 09:00
  'nine o\'clock is when the world\nstarts taking itself seriously.\nthe coffee helps.\nthe seriousness does not.',

  // 10:00
  'mid-morning is a plateau.\nyou have been awake long enough\nto forget you were ever asleep.\nthe dream was someone else\'s.',

  // 11:00
  'the hour before lunch\nis the longest hour.\nhunger makes time thick.\nthe clock becomes a countdown.',

  // 12:00 — Noon (most faded)
  'noon is the death of shadow.\neverything is lit equally.\nnothing hides.\nthis is the hour of no mystery.',

  // 13:00
  'the afternoon is a slow descent\ninto the gravity of the day.\nwhat you started this morning\nnow starts to weigh something.',

  // 14:00
  'two o\'clock is the hour of doubt.\nwhat am i doing here.\nwas this the right choice.\nthe answer is always: keep going.',

  // 15:00
  'three pm sun is different.\nit comes in at an angle\nthat makes everything golden\nand nothing permanent.',

  // 16:00
  'the hour of lengthening shadows.\neach object grows a dark twin\nthat reaches toward the east\nas if trying to escape.',

  // 17:00
  'the end of something.\nnot the day, not yet.\nbut the pretense\nthat the day would last forever.',

  // 18:00
  'dusk is the most honest light.\nit doesn\'t illuminate or conceal.\nit simply says:\nthings are leaving now.',

  // 19:00
  'dinner is the ritual\nof pretending the day was worth it.\nyou eat the evidence.\ntomorrow, you\'ll do it again.',

  // 20:00
  'eight o\'clock is the hour\nwhen the world divides:\nthose going out\nand those staying in.\nboth are correct.',

  // 21:00
  'the night has settled in.\nit is no longer arriving.\nit lives here now.\nyou are a guest.',

  // 22:00
  'ten pm is the hour of almost.\nalmost asleep. almost honest.\nalmost ready to let go\nof who you were today.',

  // 23:00
  'eleven is midnight\'s shadow.\nthe anticipation of ending.\neverything winds down.\nthe clock begins to lean forward.',
]

interface MidnightDeps {
  switchTo?: (name: string) => void
}

export function createMidnightRoom(deps?: MidnightDeps): Room {
  let overlay: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let active = false
  let frameId = 0
  let time = 0
  let hoveredNav = -1

  // Navigation portal — faint moonlit passage back to the clock tower
  const navPoints = [
    { label: '☾ the clock tower', room: 'clocktower', xFrac: 0.5, yFrac: 0.95 },
  ]

  function getHourVividness(hour: number): number {
    // Midnight (0) = 1.0, Noon (12) = 0.1, scales sinusoidally
    return 0.1 + 0.9 * ((Math.cos(hour / 12 * Math.PI) + 1) / 2)
  }

  function render() {
    if (!canvas || !ctx || !active) return
    frameId = requestAnimationFrame(render)
    time += 0.016

    const w = canvas.width
    const h = canvas.height
    const now = new Date()
    const hour = now.getHours()
    const vividness = getHourVividness(hour)

    ctx.clearRect(0, 0, w, h)

    // Background — deeper at midnight, washed out at noon
    const bgDark = Math.floor(5 * vividness)
    const bgLight = Math.floor(3 + (1 - vividness) * 15)
    ctx.fillStyle = `rgb(${bgLight}, ${bgLight}, ${bgDark + bgLight})`
    ctx.fillRect(0, 0, w, h)

    // Stars (more visible at night)
    if (vividness > 0.3) {
      for (let i = 0; i < 60; i++) {
        const sx = (Math.sin(i * 83.7) * 0.5 + 0.5) * w
        const sy = (Math.sin(i * 47.3) * 0.5 + 0.5) * h
        const brightness = vividness * (0.02 + Math.sin(time * 0.5 + i) * 0.01)
        ctx.beginPath()
        ctx.arc(sx, sy, 0.5 + vividness, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200, 200, 240, ${brightness})`
        ctx.fill()
      }
    }

    // Moon (midnight = high and bright, noon = invisible)
    if (vividness > 0.2) {
      const moonX = w * 0.75
      const moonY = h * 0.15
      ctx.beginPath()
      ctx.arc(moonX, moonY, 20, 0, Math.PI * 2)
      const moonGrad = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 25)
      moonGrad.addColorStop(0, `rgba(220, 220, 240, ${vividness * 0.15})`)
      moonGrad.addColorStop(1, 'rgba(220, 220, 240, 0)')
      ctx.fillStyle = moonGrad
      ctx.fill()
    }

    // Hour display
    ctx.font = '48px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 190, 220, ${vividness * 0.3})`
    ctx.textAlign = 'center'
    const hourStr = String(hour).padStart(2, '0') + ':00'
    ctx.fillText(hourStr, w / 2, h * 0.2)

    // Poem
    const poem = HOURLY_POEMS[hour] || ''
    const lines = poem.split('\n')
    ctx.font = '16px "Cormorant Garamond", serif'
    ctx.textAlign = 'center'

    for (let i = 0; i < lines.length; i++) {
      const lineY = h * 0.35 + i * 30
      const line = lines[i]

      // Each character's visibility depends on vividness
      for (let j = 0; j < line.length; j++) {
        const charVividness = vividness * (0.6 + Math.sin(time * 0.3 + j * 0.2) * 0.4)
        if (charVividness < 0.15 && line[j] !== ' ') {
          // Too faded — show as underscore or nothing
          if (Math.random() < 0.3) continue
          ctx.fillStyle = `rgba(200, 190, 220, ${0.03})`
          ctx.fillText('_', w / 2 - (line.length * 4.5) + j * 9, lineY)
        } else {
          ctx.fillStyle = `rgba(200, 190, 220, ${charVividness * 0.5})`
          ctx.fillText(line[j], w / 2 - (line.length * 4.5) + j * 9, lineY)
        }
      }
    }

    // Vividness meter
    ctx.font = '9px monospace'
    ctx.fillStyle = `rgba(200, 190, 220, ${vividness * 0.1})`
    ctx.textAlign = 'center'
    const meterChars = '░▒▓█'
    const meterLen = 20
    let meter = ''
    for (let i = 0; i < meterLen; i++) {
      const threshold = i / meterLen
      if (vividness > threshold) {
        meter += meterChars[Math.min(3, Math.floor((vividness - threshold) * 8))]
      } else {
        meter += '·'
      }
    }
    ctx.fillText(`presence: ${meter}`, w / 2, h * 0.7)

    // Hint about vividness
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 190, 220, ${vividness * 0.06})`
    ctx.fillText(
      vividness > 0.7
        ? 'the midnight hour. the room is most itself.'
        : vividness > 0.4
        ? 'the room is dimming. come back when the sun sets.'
        : 'barely here. the daylight dissolves this place.',
      w / 2, h * 0.8
    )

    // Title
    ctx.font = '10px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 190, 220, ${vividness * 0.08})`
    ctx.textAlign = 'center'
    ctx.fillText('the midnight', w / 2, 30)

    // Hour context
    ctx.font = '9px "Cormorant Garamond", serif'
    ctx.fillStyle = `rgba(200, 190, 220, ${vividness * 0.05})`
    ctx.fillText(
      `this room is ${Math.floor(vividness * 100)}% materialized at ${hourStr}`,
      w / 2, h - 15
    )

    // Navigation portals — moonlit passage
    if (deps?.switchTo) {
      for (let i = 0; i < navPoints.length; i++) {
        const np = navPoints[i]
        const nx = w * np.xFrac
        const ny = h * np.yFrac
        const hovered = hoveredNav === i
        const a = hovered ? 0.3 * vividness + 0.1 : 0.05 * vividness + 0.02
        ctx.font = '9px "Cormorant Garamond", serif'
        ctx.fillStyle = `rgba(200, 190, 220, ${a})`
        ctx.textAlign = 'center'
        ctx.fillText(np.label, nx, ny)
        if (hovered) {
          ctx.fillStyle = `rgba(200, 190, 220, ${0.08 * vividness})`
          ctx.beginPath()
          ctx.arc(nx, ny + 6, 3, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
  }

  return {
    name: 'midnight',
    label: 'the midnight',
    hidden: true,

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

      // Portal navigation click + hover
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
        }
      }
      window.addEventListener('resize', onResize)

      return overlay
    },

    activate() {
      active = true
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
