/**
 * DEVICE DRIFT — the void responds to your body
 *
 * On mobile devices with gyroscopes, the 3D camera follows
 * the physical tilt of your device. Tilt left and the void
 * shifts left. Tilt forward and you dive deeper. Hold the phone
 * up and the particles rise.
 *
 * This transforms the screen from a window you look at into
 * a portal you look through. You are holding a piece of the
 * void in your hands. Move your body to move through it.
 *
 * On desktop, this gracefully does nothing.
 *
 * Inspired by: Gyroscope art installations, AR experiences,
 * the way you tilt a snow globe, James Turrell's skyspaces
 */

type OrientationCallback = (tiltX: number, tiltY: number, heading: number) => void

export class DeviceDrift {
  private supported = false
  private permissionGranted = false
  private listeners: OrientationCallback[] = []
  private tiltX = 0  // left-right: -1 to 1
  private tiltY = 0  // forward-back: -1 to 1
  private heading = 0 // compass: 0-360
  private smoothTiltX = 0
  private smoothTiltY = 0
  private frameId = 0

  constructor() {
    this.supported = 'DeviceOrientationEvent' in window
    if (!this.supported) return

    this.requestPermission()
  }

  private async requestPermission() {
    // iOS 13+ requires explicit permission request
    const DeviceOrientationEventTyped = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>
    }

    if (typeof DeviceOrientationEventTyped.requestPermission === 'function') {
      // iOS — request on first user gesture
      const requestOnGesture = async () => {
        try {
          const permission = await DeviceOrientationEventTyped.requestPermission!()
          if (permission === 'granted') {
            this.permissionGranted = true
            this.startListening()
          }
        } catch { /* user denied */ }
        window.removeEventListener('touchstart', requestOnGesture)
        window.removeEventListener('click', requestOnGesture)
      }
      window.addEventListener('touchstart', requestOnGesture, { once: true })
      window.addEventListener('click', requestOnGesture, { once: true })
    } else {
      // Android / desktop — no permission needed
      this.permissionGranted = true
      this.startListening()
    }
  }

  private startListening() {
    window.addEventListener('deviceorientation', (e) => {
      if (e.beta === null || e.gamma === null) return

      // beta: front-back tilt (-180 to 180), ~0 when flat
      // gamma: left-right tilt (-90 to 90)
      // alpha: compass heading (0 to 360)

      // Normalize to -1..1 range, clamped
      this.tiltX = Math.max(-1, Math.min(1, (e.gamma ?? 0) / 45))
      this.tiltY = Math.max(-1, Math.min(1, ((e.beta ?? 0) - 45) / 45))
      // 45 offset because most people hold phones at ~45 degrees
      this.heading = e.alpha ?? 0
    })

    // Smooth the values in an animation loop
    const smooth = () => {
      this.frameId = requestAnimationFrame(smooth)
      this.smoothTiltX += (this.tiltX - this.smoothTiltX) * 0.08
      this.smoothTiltY += (this.tiltY - this.smoothTiltY) * 0.08

      for (const fn of this.listeners) {
        fn(this.smoothTiltX, this.smoothTiltY, this.heading)
      }
    }
    smooth()
  }

  /** Subscribe to orientation changes */
  onOrientation(fn: OrientationCallback) {
    this.listeners.push(fn)
  }

  isSupported(): boolean {
    return this.supported
  }

  destroy() {
    cancelAnimationFrame(this.frameId)
  }
}
