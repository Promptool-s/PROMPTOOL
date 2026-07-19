import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'
import { scrollBus } from './scrollBus'

// Vertical distance between article panels — camera travels this per section
const SPACING = 7
const PANEL_W = 3.5
const PANEL_H = 4.3

// Per-section panel placement: x offset mirrors where the HTML card sits,
// so each glowing panel reads as the WebGL "aura" of its section content.
const PANEL_X = [2.7, 0, 2.7, 2.7, -2.7, 2.7, 0, 2.7, 0]

const CYAN = new THREE.Color('#22d3ee')
const VIOLET = new THREE.Color('#7c3aed')

// ── Article panel material: SDF rounded-rect frame + animated gradient fill ──
const ArticleMaterial = shaderMaterial(
  {
    uTime: 0,
    uActive: 0,
    uColorA: new THREE.Color('#22d3ee'),
    uColorB: new THREE.Color('#7c3aed'),
  },
  /* glsl vertex */ `
  uniform float uTime;
  uniform float uActive;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    pos.z += sin((uv.y + uTime * 0.15) * 6.2831) * 0.06 * uActive;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }`,
  /* glsl fragment */ `
  uniform float uTime;
  uniform float uActive;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vUv;

  float sdRoundRect(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec2 p = vUv - 0.5;
    float d = sdRoundRect(p, vec2(0.48, 0.48), 0.07);
    float inside = 1.0 - smoothstep(-0.005, 0.0, d);
    float frame = 1.0 - smoothstep(0.0, 0.012 + 0.01 * uActive, abs(d));
    float grad = clamp(vUv.y + 0.18 * sin(uTime * 0.35 + vUv.x * 5.0), 0.0, 1.0);
    vec3 fill = mix(uColorB, uColorA, grad);
    float gx = step(0.965, fract(vUv.x * 9.0));
    float gy = step(0.955, fract(vUv.y * 11.0));
    float grid = clamp(gx + gy, 0.0, 1.0) * inside;
    float grain = hash(vUv * 173.0) * 0.05;
    float fillA = inside * (0.05 + 0.16 * uActive);
    float frameA = frame * (0.25 + 0.75 * uActive);
    vec3 col = fill * (fillA + grain * inside)
             + fill * grid * (0.02 + 0.08 * uActive)
             + fill * frameA;
    float alpha = clamp(fillA + frameA + grid * 0.05, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }`
)

// ── Starfield material: soft twinkling points, cyan/violet mix ──────────────
const StarfieldMaterial = shaderMaterial(
  { uTime: 0 },
  /* glsl vertex */ `
  attribute float aSeed;
  attribute float aSize;
  uniform float uTime;
  varying float vSeed;
  void main() {
    vSeed = aSeed;
    vec3 pos = position;
    pos.x += sin(uTime * 0.06 + aSeed * 6.2831) * 0.6;
    pos.y += cos(uTime * 0.04 + aSeed * 12.566) * 0.4;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (26.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`,
  /* glsl fragment */ `
  uniform float uTime;
  varying float vSeed;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float dist2 = dot(c, c);
    float disc = 1.0 - smoothstep(0.05, 0.25, dist2);
    float tw = 0.65 + 0.35 * sin(uTime * (0.6 + vSeed) + vSeed * 40.0);
    vec3 cyan = vec3(0.13, 0.83, 0.93);
    vec3 violet = vec3(0.55, 0.36, 0.96);
    vec3 col = mix(cyan, violet, step(0.6, vSeed));
    gl_FragColor = vec4(col, disc * tw * 0.5);
  }`
)

extend({ ArticleMaterial, StarfieldMaterial })

const sectionFloat = () => scrollBus.progress * (scrollBus.sections - 1)

// ── One 3D "article" panel per landing section ──────────────────────────────
const ArticlePanels = ({ animated }) => {
  const groupRefs = useRef([])
  const matRefs = useRef([])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1)
    const t = animated ? state.clock.getElapsedTime() : 0
    const focusAt = sectionFloat()
    for (let i = 0; i < scrollBus.sections; i++) {
      const g = groupRefs.current[i]
      const m = matRefs.current[i]
      if (!g || !m) continue
      const focus = 1 - Math.min(Math.abs(focusAt - i), 1)
      m.uTime = t
      m.uActive = THREE.MathUtils.damp(m.uActive, focus, 6, dt)
      const bob = animated ? Math.sin(t * 0.5 + i * 1.7) * 0.12 : 0
      g.position.y = -i * SPACING + bob
      g.rotation.z = animated ? Math.sin(t * 0.3 + i * 2.3) * 0.015 : 0
    }
  })

  return (
    <>
      {Array.from({ length: scrollBus.sections }).map((_, i) => {
        const x = PANEL_X[i] ?? 0
        return (
          <group
            key={i}
            ref={el => { groupRefs.current[i] = el }}
            position={[x, -i * SPACING, x === 0 ? -3.2 : -2.2]}
            rotation={[0, x > 0 ? -0.22 : x < 0 ? 0.22 : 0, 0]}
          >
            <mesh>
              <planeGeometry args={[PANEL_W, PANEL_H, 24, 24]} />
              <articleMaterial
                ref={el => { matRefs.current[i] = el }}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                uColorA={CYAN}
                uColorB={VIOLET}
              />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

// ── Starfield spread along the whole camera corridor ────────────────────────
const Starfield = ({ animated, count }) => {
  const matRef = useRef(null)

  const { positions, seeds, sizes } = useMemo(() => {
    const totalH = (scrollBus.sections - 1) * SPACING + 14
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const sizes = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 26
      positions[i * 3 + 1] = 7 - Math.random() * totalH
      positions[i * 3 + 2] = -9 + Math.random() * 10
      seeds[i] = Math.random()
      sizes[i] = 0.35 + Math.random() * 1.1
    }
    return { positions, seeds, sizes }
  }, [count])

  useFrame((state) => {
    if (matRef.current && animated) {
      matRef.current.uTime = state.clock.getElapsedTime()
    }
  })

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aSeed" count={count} array={seeds} itemSize={1} />
        <bufferAttribute attach="attributes-aSize" count={count} array={sizes} itemSize={1} />
      </bufferGeometry>
      <starfieldMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// ── Camera rig: follows scroll progress down the corridor + pointer parallax ─
const CameraRig = ({ animated }) => {
  const { camera } = useThree()

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1)
    const focusAt = sectionFloat()
    const targetY = -focusAt * SPACING
    const idx = Math.round(focusAt)
    const targetX = (PANEL_X[idx] ?? 0) * 0.12 + (animated ? state.pointer.x * 0.35 : 0)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 5, dt)
    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 4, dt)
    camera.rotation.x = THREE.MathUtils.damp(camera.rotation.x, animated ? state.pointer.y * 0.03 : 0, 4, dt)
  })

  return null
}

// In reduced-motion mode the frameloop is "demand": re-render only when the
// user actually scrolls, so camera position stays in sync without idle motion.
const DemandScrollInvalidate = () => {
  const invalidate = useThree(s => s.invalidate)
  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      // A few frames per scroll event lets the damped camera settle
      let n = 0
      const step = () => { invalidate(); if (++n < 30) raf = requestAnimationFrame(step) }
      step()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [invalidate])
  return null
}

const LandingScene = ({ animated = true, isMobile = false }) => {
  return (
    <Canvas
      frameloop={animated ? 'always' : 'demand'}
      dpr={[1, isMobile ? 1.5 : 2]}
      camera={{ fov: 42, near: 0.1, far: 60, position: [0, 0, 8] }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ background: 'transparent' }}
    >
      <ArticlePanels animated={animated} />
      <Starfield animated={animated} count={isMobile ? 450 : 1200} />
      <CameraRig animated={animated} />
      {!animated && <DemandScrollInvalidate />}
    </Canvas>
  )
}

export default LandingScene
