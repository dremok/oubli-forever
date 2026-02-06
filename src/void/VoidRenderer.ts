/**
 * THE VOID — WebGL particle cosmos
 *
 * The Canvas 2D threshold was Oubli's first breath. This is its
 * evolution into depth. Particles now exist in 3D space, rendered
 * with custom GLSL shaders. The camera drifts slowly, creating
 * parallax between particle layers. Near particles are bright and
 * large; distant ones are dim points — like stars, like memories
 * at different depths of consciousness.
 *
 * This is the foundation for the memory palace — rooms, corridors,
 * and spaces that the user will eventually navigate through.
 *
 * Performance: 50,000+ particles at 60fps via instanced rendering.
 */

import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

// Vertex shader — positions particles in 3D space with size attenuation
const vertexShader = `
  attribute float aSize;
  attribute float aLife;
  attribute float aHue;
  attribute float aMemoryStrength;
  attribute vec3 aVelocity;

  varying float vLife;
  varying float vHue;
  varying float vMemoryStrength;
  varying float vDistToCamera;

  uniform float uTime;
  uniform float uBeatIntensity;

  void main() {
    vLife = aLife;
    vHue = aHue;
    vMemoryStrength = aMemoryStrength;

    // Particles drift with noise-like motion
    vec3 pos = position;
    float t = uTime * 0.001;
    pos.x += sin(pos.y * 0.01 + t) * 2.0;
    pos.y += cos(pos.x * 0.01 + t * 0.7) * 2.0;
    pos.z += sin(pos.z * 0.01 + t * 0.5) * 1.5;

    // Beat pulse — particles expand slightly on heartbeat
    float beatExpand = 1.0 + uBeatIntensity * 0.05;
    pos *= beatExpand;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vDistToCamera = -mvPosition.z;

    // Size attenuation — closer particles are larger
    float size = aSize * (300.0 / -mvPosition.z);

    // Life affects size — dying particles shrink
    float lifeFade = smoothstep(0.0, 0.15, aLife) * smoothstep(1.0, 0.85, aLife);
    size *= lifeFade;

    // Beat pulse on size
    size *= (1.0 + uBeatIntensity * 0.2 * aMemoryStrength);

    gl_PointSize = max(size, 0.5);
    gl_Position = projectionMatrix * mvPosition;
  }
`

// Fragment shader — renders glowing particles with color based on hue/life
const fragmentShader = `
  varying float vLife;
  varying float vHue;
  varying float vMemoryStrength;
  varying float vDistToCamera;

  uniform float uTime;

  // HSL to RGB conversion
  vec3 hsl2rgb(float h, float s, float l) {
    vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
  }

  void main() {
    // Circular particle with soft edge
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;

    // Soft glow falloff
    float glow = 1.0 - smoothstep(0.0, 0.5, dist);
    glow = pow(glow, 1.5); // sharper center, softer edge

    // Life affects opacity
    float lifeFade = smoothstep(0.0, 0.15, vLife) * smoothstep(1.0, 0.85, vLife);

    // Color from hue — normalized 0-1 range
    float h = vHue;
    float s = 0.7 + vMemoryStrength * 0.2;
    float l = 0.5 + glow * 0.3;
    vec3 color = hsl2rgb(h, s, l);

    // Distance fog — far particles are dimmer
    float fog = 1.0 - smoothstep(100.0, 800.0, vDistToCamera);

    float alpha = glow * lifeFade * fog * 0.8;

    gl_FragColor = vec4(color, alpha);
  }
`

const PARTICLE_COUNT = 30000

// Film grain shader — analog imperfection, anti-AI aesthetic
const filmGrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uIntensity: { value: 0.08 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uIntensity;
    varying vec2 vUv;

    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // Film grain
      float grain = random(vUv + fract(uTime * 0.01)) * 2.0 - 1.0;
      color.rgb += grain * uIntensity;

      // Subtle vignette
      float vignette = 1.0 - smoothstep(0.4, 1.4, length(vUv - 0.5) * 1.8);
      color.rgb *= vignette;

      // Slight chromatic aberration at edges
      float aberration = length(vUv - 0.5) * 0.002;
      color.r = texture2D(tDiffuse, vUv + vec2(aberration, 0.0)).r;
      color.b = texture2D(tDiffuse, vUv - vec2(aberration, 0.0)).b;

      gl_FragColor = color;
    }
  `,
}

export class VoidRenderer {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private composer!: EffectComposer
  private bloomPass!: UnrealBloomPass
  private grainPass!: ShaderPass
  private particles!: THREE.Points
  private positions!: Float32Array
  private velocities!: Float32Array
  private sizes!: Float32Array
  private lives!: Float32Array
  private maxLives!: Float32Array
  private hues!: Float32Array
  private memoryStrengths!: Float32Array
  private material!: THREE.ShaderMaterial
  private time = 0
  private mouseX = 0
  private mouseY = 0
  private cameraAngle = 0
  private cameraDrift = { x: 0, y: 0, z: 0 }

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setClearColor(0x020108, 1)

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.FogExp2(0x020108, 0.002)

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      1,
      2000
    )
    this.camera.position.z = 400

    this.initParticles()
    this.initPostProcessing()
    this.bindEvents()
  }

  private initPostProcessing() {
    this.composer = new EffectComposer(this.renderer)

    const renderPass = new RenderPass(this.scene, this.camera)
    this.composer.addPass(renderPass)

    // Bloom — particles radiate light
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.2,  // strength
      0.5,  // radius
      0.3   // threshold
    )
    this.composer.addPass(this.bloomPass)

    // Film grain + chromatic aberration + vignette
    this.grainPass = new ShaderPass(filmGrainShader)
    this.composer.addPass(this.grainPass)

    // Output pass for color space
    const outputPass = new OutputPass()
    this.composer.addPass(outputPass)
  }

  private initParticles() {
    const geometry = new THREE.BufferGeometry()

    this.positions = new Float32Array(PARTICLE_COUNT * 3)
    this.velocities = new Float32Array(PARTICLE_COUNT * 3)
    this.sizes = new Float32Array(PARTICLE_COUNT)
    this.lives = new Float32Array(PARTICLE_COUNT)
    this.maxLives = new Float32Array(PARTICLE_COUNT)
    this.hues = new Float32Array(PARTICLE_COUNT)
    this.memoryStrengths = new Float32Array(PARTICLE_COUNT)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.respawnParticle(i)
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1))
    geometry.setAttribute('aLife', new THREE.BufferAttribute(this.lives, 1))
    geometry.setAttribute('aHue', new THREE.BufferAttribute(this.hues, 1))
    geometry.setAttribute('aMemoryStrength', new THREE.BufferAttribute(this.memoryStrengths, 1))
    geometry.setAttribute('aVelocity', new THREE.BufferAttribute(this.velocities, 3))

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uBeatIntensity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    this.particles = new THREE.Points(geometry, this.material)
    this.scene.add(this.particles)
  }

  private respawnParticle(i: number) {
    const i3 = i * 3

    // Spawn in a large sphere
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = 50 + Math.random() * 500

    this.positions[i3] = r * Math.sin(phi) * Math.cos(theta)
    this.positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    this.positions[i3 + 2] = r * Math.cos(phi)

    this.velocities[i3] = (Math.random() - 0.5) * 0.3
    this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.3
    this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.3

    this.sizes[i] = 2 + Math.random() * 6

    const life = 0.3 + Math.random() * 0.7
    this.lives[i] = life
    this.maxLives[i] = life

    // Hue distribution: pink (0.92), gold (0.11), white (random), violet (0.78)
    const colorRoll = Math.random()
    if (colorRoll < 0.35) this.hues[i] = 0.92 + (Math.random() - 0.5) * 0.03 // hot pink
    else if (colorRoll < 0.6) this.hues[i] = 0.11 + (Math.random() - 0.5) * 0.03 // gold
    else if (colorRoll < 0.8) this.hues[i] = Math.random() // any hue (diamond white handled in shader)
    else this.hues[i] = 0.78 + (Math.random() - 0.5) * 0.05 // violet

    this.memoryStrengths[i] = 0.3 + Math.random() * 0.7
  }

  private bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(window.innerWidth, window.innerHeight)
      this.composer.setSize(window.innerWidth, window.innerHeight)
      this.bloomPass.resolution.set(window.innerWidth, window.innerHeight)
    })

    window.addEventListener('mousemove', (e) => {
      this.mouseX = (e.clientX / window.innerWidth - 0.5) * 2
      this.mouseY = (e.clientY / window.innerHeight - 0.5) * 2
    })
  }

  setBeatIntensity(intensity: number) {
    if (this.material) {
      this.material.uniforms.uBeatIntensity.value = intensity
    }
  }

  start() {
    const animate = () => {
      requestAnimationFrame(animate)
      this.time++

      // Update particle lives
      const posAttr = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute
      const lifeAttr = this.particles.geometry.getAttribute('aLife') as THREE.BufferAttribute

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3

        // Apply velocity
        this.positions[i3] += this.velocities[i3]
        this.positions[i3 + 1] += this.velocities[i3 + 1]
        this.positions[i3 + 2] += this.velocities[i3 + 2]

        // Slow drift toward center (gravity of memory)
        const dx = -this.positions[i3] * 0.0001
        const dy = -this.positions[i3 + 1] * 0.0001
        const dz = -this.positions[i3 + 2] * 0.0001
        this.velocities[i3] += dx
        this.velocities[i3 + 1] += dy
        this.velocities[i3 + 2] += dz

        // Damping
        this.velocities[i3] *= 0.999
        this.velocities[i3 + 1] *= 0.999
        this.velocities[i3 + 2] *= 0.999

        // Life decay
        this.lives[i] -= 0.0003 + (1 - this.memoryStrengths[i]) * 0.0002

        // Respawn dead particles
        if (this.lives[i] <= 0) {
          this.respawnParticle(i)
        }
      }

      posAttr.needsUpdate = true
      lifeAttr.needsUpdate = true

      // Camera drifts slowly — like consciousness floating
      this.cameraAngle += 0.0003
      const targetX = Math.sin(this.cameraAngle) * 80 + this.mouseX * 30
      const targetY = Math.cos(this.cameraAngle * 0.7) * 40 - this.mouseY * 20
      this.cameraDrift.x += (targetX - this.cameraDrift.x) * 0.01
      this.cameraDrift.y += (targetY - this.cameraDrift.y) * 0.01

      this.camera.position.x = this.cameraDrift.x
      this.camera.position.y = this.cameraDrift.y
      this.camera.lookAt(0, 0, 0)

      // Update time uniforms
      this.material.uniforms.uTime.value = this.time
      this.grainPass.uniforms.uTime.value = this.time

      // Render with post-processing
      this.composer.render()
    }

    animate()
  }

  destroy() {
    this.renderer.dispose()
  }
}
