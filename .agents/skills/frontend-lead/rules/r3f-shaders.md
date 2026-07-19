---
name: r3f-shaders
description: Specialized instructions for writing custom GLSL shaders (vertex/fragment) inside React Three Fiber, manipulating uniforms smoothly, and controlling materials.
version: "1.0.0"
---

# React Three Fiber & Custom GLSL Shaders

## When to Use This Skill
Apply when writing or reviewing custom `shaderMaterial` instances, editing raw GLSL (`vertexShader` and `fragmentShader`), managing dynamic animation uniforms (time, mouse, scrolling profiles), or optimizing complex fragment color equations.

**Related skills:** For baseline Three.js memory and math rules use **three-core**; for layout layering and scroll sync use **canvas-orchestration**; for scroll-driven uniform mapping use **gsap-scrolltrigger**.

## 1. React Three Fiber Fundamentals

### Scene Declaration
- **Declarative Scene Graph**: R3F maps Three.js objects to JSX elements. Every lowercase JSX tag corresponds to a `THREE` constructor:
  ```tsx
  <Canvas>
    <ambientLight intensity={0.5} />
    <pointLight position={[10, 10, 10]} />
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  </Canvas>
  ```
- **Attach Pattern**: Use the `attach` prop to bind non-child objects (e.g., `attach="material"`, `attach="geometry"`). R3F handles disposal automatically for attached objects.

### The Render Loop (`useFrame`)
- **Primary Animation Hook**: `useFrame((state, delta) => { ... })` fires every frame. Use `delta` for framerate-independent animation.
- **Never Use `useState` for Per-Frame Updates**: React state triggers re-renders. For high-frequency updates (positions, rotations, uniforms), mutate refs directly inside `useFrame`.
- **Render Priority**: Pass a second argument to `useFrame` to control execution order: `useFrame(callback, priority)`. Lower numbers run first.

### Refs & Imperative Access
- **Access Three.js Objects via Refs**: Use `useRef<THREE.Mesh>(null)` to get direct access to underlying Three.js instances for imperative mutations.
  ```tsx
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5;
    }
  });
  return <mesh ref={meshRef}><boxGeometry /><meshStandardMaterial /></mesh>;
  ```

## 2. Material Declaration
- **Prefer `shaderMaterial` from Drei**: Declare materials cleanly using Drei's helper function to automatically map values into reactive props on your React components.
  ```tsx
  import { shaderMaterial } from "@react-three/drei";
  import { extend } from "@react-three/fiber";

  const CustomWaveMaterial = shaderMaterial(
    { uTime: 0, uColor: new THREE.Color(0.1, 0.2, 0.3) },
    // Vertex Shader
    `varying vec2 vUv;
     void main() {
       vUv = uv;
       gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
     }`,
    // Fragment Shader
    `uniform float uTime;
     uniform vec3 uColor;
     varying vec2 vUv;
     void main() {
       gl_FragColor = vec4(uColor * sin(uTime + vUv.x), 1.0);
     }`
  );
  extend({ CustomWaveMaterial });
  ```
- **External Shader Files**: For complex shaders, store vertex (`.vert`) and fragment (`.frag`) code in dedicated files and import them as raw strings. This keeps components clean and enables syntax highlighting in GLSL editors.
  ```tsx
  import vertexShader from "./shaders/wave.vert?raw";
  import fragmentShader from "./shaders/wave.frag?raw";
  ```

## 3. Uniform Orchestration Loop

- **Direct Ref Updates Inside `useFrame`**: Modifying uniform states through reactive component props will throttle execution to typical React state limits (~30-60fps bottlenecks). You **MUST** query material refs directly inside the R3F loop to tap direct hardware updates.
  ```tsx
  const materialRef = useRef<any>(null);
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uTime = state.clock.getElapsedTime();
    }
  });
  ```
- **Mouse & Pointer Uniforms**: Map pointer coordinates to shader uniforms via `state.pointer` (normalized -1 to 1) inside `useFrame`, not through React event handlers.
  ```tsx
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uMouse = state.pointer;
    }
  });
  ```
- **Varying Pipeline**: Always use low or medium precision structures inside vertex pipelines where applicable, and pass normalized UV coordinates (`vUv`) via data varyings to calculate accurate custom texture lookups inside the fragment processor.

## 4. Shader Performance & Compatibility

- **Precision Declarations**: Always specify float precision explicitly at the baseline line of independent fragment scripts (`precision mediump float;`) to guarantee uniform representation across multi-generation mobile GPUs.
- **Conditional Branching Avoidance**: Avoid heavy usage of dynamic `if/else` logic structures within your main fragment algorithms. Branching splits mathematical processing blocks inside modern graphics pipelines; use math-based steps like `step()`, `clamp()`, `mix()`, or `smoothstep()` instead.
- **Texture Sampling Optimization**: Minimize redundant `texture2D()` calls. Store sampled values in local variables when reusing them across calculations.
- **Varying Count**: Keep the number of varyings minimal. Each varying consumes interpolation bandwidth across the rasterization stage.

## 5. Drei Utilities for R3F

- **`<OrbitControls>`**: Use for development and interactive exploration scenes. Disable in production scroll-driven layouts where camera control is predetermined.
- **`<Environment>`**: Use preset HDR environments for physically-based lighting without manual light setup:
  ```tsx
  <Environment preset="city" background blur={0.5} />
  ```
- **`<Float>`**, **`<MeshDistortMaterial>`**, **`<MeshWobbleMaterial>`**: Use Drei's built-in animated materials for quick visual effects before resorting to custom shaders.
- **`useTexture`**, **`useGLTF`**: Prefer Drei's hooks over raw `useLoader` for automatic caching, Suspense integration, and type safety.
  ```tsx
  const texture = useTexture("/textures/diffuse.jpg");
  const { nodes, materials } = useGLTF("/models/scene.glb");
  ```
- **`<Preload>`**: Add `<Preload all />` inside `<Canvas>` to eagerly load all `useLoader` assets and avoid runtime stalls.

## 6. Component Lifecycle & Cleanup

- **Automatic Disposal**: R3F automatically disposes of geometries, materials, and textures when components unmount. Do not manually call `.dispose()` on objects managed by R3F's scene graph.
- **Manual Resources**: For resources created outside the R3F scene graph (e.g., `WebGLRenderTarget`, manually instantiated textures), dispose of them in a `useEffect` cleanup function.
  ```tsx
  useEffect(() => {
    const renderTarget = new THREE.WebGLRenderTarget(512, 512);
    // ... use renderTarget
    return () => renderTarget.dispose();
  }, []);
  ```

## Do Not

- ❌ Do not create new raw GLSL material instances inside the component wrapper on active renders; it restarts the compiler pipeline every single pass.
- ❌ Do not use reactive state engines (`useState`, `useReducer`) to update high-frequency uniforms like coordinates or clock timers.
- ❌ Do not use heavy `if/else` branching inside fragment shaders; use `step()`, `mix()`, `smoothstep()`, and `clamp()` instead.
- ❌ Do not forget to `extend()` custom shader materials before using them as JSX elements.
- ❌ Do not nest `<Canvas>` components — only one Canvas per viewport region.
