import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { scrollBus } from './scrollBus'

// ── WebGL aurora background ────────────────────────────────────────────────
// A single full-screen shader plane: soft flowing simplex-fbm noise blending
// brand cyan → violet over the light page. Sits behind the DOM prompt cards.
// Scroll-reactive via the shared scrollBus (read inside useFrame, no React
// re-renders). Lazy-loaded and only mounted when motion is allowed.

// Fullscreen quad: pass position straight to clip space (no camera coupling).
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uProgress;
  uniform float uVelocity;

  // Ashima simplex noise (branch-free variant)
  vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x){ return mod289(((x * 34.0) + 1.0) * x); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1.x = step(x0.y, x0.x);
    i1.y = 1.0 - i1.x;
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                            + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x  = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm(vec2 p){
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * snoise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main(){
    vec2 uv = vUv;
    float t = uTime * 0.06;
    vec2 q = uv * 2.4 + vec2(t, -t * 0.6);
    float n  = fbm(q + uProgress * 1.5);
    float n2 = fbm(uv * 3.2 - vec2(t * 0.8, t) + n * 0.4);

    float blend = smoothstep(-0.2, 0.8, n2 + (uv.y - 0.5) * 0.9);
    vec3 cyan   = vec3(0.133, 0.827, 0.933); // #22d3ee
    vec3 violet = vec3(0.486, 0.227, 0.929); // #7c3aed
    vec3 col = mix(cyan, violet, blend);

    float body = smoothstep(0.15, 0.85, n * 0.5 + 0.5);
    float vign = smoothstep(1.15, 0.25, distance(uv, vec2(0.5)));
    float alpha = body * vign * 0.25;
    alpha += clamp(abs(uVelocity) * 0.0004, 0.0, 0.06); // faint shimmer on fast scroll

    gl_FragColor = vec4(col, alpha);
  }
`

function AuroraPlane() {
  const matRef = useRef(null)
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uVelocity: { value: 0 },
  }), [])

  useFrame((_, delta) => {
    const mat = matRef.current
    if (!mat) return
    const u = mat.uniforms
    u.uTime.value += Math.min(delta, 0.05) // clamp: framerate-independent, tab-switch safe
    u.uProgress.value += (scrollBus.progress - u.uProgress.value) * 0.08
    u.uVelocity.value = scrollBus.velocity || 0
  })

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}

const AuroraCanvas = ({ isMobile = false }) => (
  <Canvas
    className="pointer-events-none"
    style={{ position: 'fixed', inset: 0 }}
    dpr={[1, isMobile ? 1.5 : 2]}
    gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}
    frameloop="always"
    aria-hidden="true"
  >
    <AuroraPlane />
  </Canvas>
)

export default AuroraCanvas
