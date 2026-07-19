---
name: canvas-orchestration
description: High-level architectural patterns for managing HTML/WebGL stacking, viewport sizing, global synchronization, page layout, and asset loaders.
version: "1.0.0"
---

# Canvas Orchestration & Hybrid Layout Architecture

## When to Use This Skill
Apply when managing the global root layouts containing interactive graphics layers, positioning HTML cards directly over WebGL layouts, managing progressive site loading interfaces, or tying scrolling libraries (like GSAP or Lenis) to the core 3D viewport canvas.

**Related skills:** For raw Three.js scene setup use **three-core**; for shader-specific material patterns use **r3f-shaders**; for scroll animation orchestration use **gsap-scrolltrigger**; for React animation lifecycle use **motion-react-core**.

## 1. Composition Layering Strategy
- **Z-Index Layer Management**: Keep your global `<Canvas>` element isolated to a background positioning envelope or layout context. Use standard utility structures (`pointer-events-none fixed inset-0 z-0`) so it doesn't interrupt mouse interactions for administrative text layout nodes.
  ```tsx
  {/* Background 3D layer */}
  <div className="fixed inset-0 z-0 pointer-events-none">
    <Canvas>
      <Scene />
    </Canvas>
  </div>

  {/* Foreground HTML content */}
  <main className="relative z-10">
    <HeroSection />
    <FeaturesSection />
  </main>
  ```
- **Interactive Toggles**: If elements inside the WebGL world require active click or hover tracking, use `pointer-events-auto` on the Canvas node, but wrap target HTML text containers in specialized container elements to handle visual overlap states cleanly.
- **Depth Ordering Convention**: Establish a consistent z-index scale for hybrid layouts:
  - `z-0` — 3D canvas background
  - `z-10` — Primary HTML content
  - `z-20` — Overlays, modals, navigation
  - `z-30` — Tooltips, toasts, notifications

## 2. Hydration & Server Environment Rules
- **Enforce Client-Only Injection**: Three.js APIs require hardware-level window elements immediately upon generation. Ensure all component branches holding canvas nodes use explicit conditional safety wrappers or framework-level client imports (`{ ssr: false }`) or `"use client"` directives in Next.js.
  ```tsx
  // Next.js dynamic import pattern
  import dynamic from "next/dynamic";
  const Scene3D = dynamic(() => import("./Scene3D"), { ssr: false });
  ```
- **Progressive Loader Handlers**: Always stack an immediate visual asset manager fallback using Suspense layers or Drei's `<Loader />` wrappers to cover loading cycles for heavy configurations.
  ```tsx
  import { Loader } from "@react-three/drei";

  <Suspense fallback={null}>
    <Canvas>
      <Scene />
    </Canvas>
  </Suspense>
  <Loader />
  ```
- **Hydration Mismatch Prevention**: Never render Canvas server-side. Wrap in `useEffect`-gated mounting or framework-specific client-only boundaries to prevent SSR/CSR mismatch errors.

## 3. Scrolling Ecosystem Sync (GSAP, Lenis, R3F)
- **Unified Tick Sequence**: To prevent visual stutter or jitter between scrolling elements and 3D scenes, synchronize smooth scrolling frameworks directly to R3F's rendering process.
- **Manual Render Loops**: When syncing with an external layout library like Lenis, deactivate R3F's automatic rendering framework and advance the scene ticks inside the custom layout pipeline:
  ```tsx
  <Canvas frameloop="never">
    {/* Advance the frame manually using your external timeline or loop hook */}
  </Canvas>
  ```
  ```tsx
  // Inside a sync component
  useFrame(({ gl, scene, camera }) => {
    gl.render(scene, camera);
  });
  ```
- **ScrollTrigger Hookup**: Map ScrollTrigger interpolation variables directly to uniform references or mesh transform nodes through targeted updates inside your effect boundaries.
  ```tsx
  useEffect(() => {
    const trigger = ScrollTrigger.create({
      trigger: sectionRef.current,
      start: "top bottom",
      end: "bottom top",
      onUpdate: (self) => {
        if (meshRef.current) {
          meshRef.current.rotation.y = self.progress * Math.PI * 2;
        }
        if (materialRef.current) {
          materialRef.current.uProgress = self.progress;
        }
      },
    });
    return () => trigger.kill();
  }, []);
  ```
- **Lenis + R3F Pattern**: When using Lenis for smooth scrolling with R3F, connect via a shared RAF loop:
  ```tsx
  useEffect(() => {
    const lenis = new Lenis();
    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);
  ```

## 4. Canvas Sizing & Responsiveness

- **Full-Viewport Canvas**: For immersive backgrounds, use `position: fixed; inset: 0;` on the canvas container. R3F's `<Canvas>` automatically fills its parent container.
- **Contained Canvas**: For inline 3D elements, set explicit dimensions on the parent container. Use `aspect-ratio` CSS property for consistent proportions:
  ```css
  .canvas-container {
    width: 100%;
    aspect-ratio: 16 / 9;
    position: relative;
  }
  ```
- **Responsive DPR**: Use R3F's `dpr` prop to control device pixel ratio responsively:
  ```tsx
  <Canvas dpr={[1, 2]}>
    {/* R3F will clamp between min and max based on device */}
  </Canvas>
  ```
- **Performance Scaling**: Use Drei's `<PerformanceMonitor>` to dynamically adjust DPR based on real-time frame rates:
  ```tsx
  import { PerformanceMonitor } from "@react-three/drei";

  <Canvas dpr={[1, 2]}>
    <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(2)}>
      <Scene />
    </PerformanceMonitor>
  </Canvas>
  ```

## 5. Accessibility Guidelines (Immersive Fallbacks)

- **Aria Representation Layers**: WebGL environments are completely invisible to assistive text architectures. If a 3D interface holds narrative functional routes or interactive paths, build mirror layout representations hidden cleanly via screen-reader-only utility classes (`sr-only`) to retain full keyboard control parity.
  ```tsx
  {/* Visual 3D element */}
  <Canvas>
    <InteractiveModel onClick={handleAction} />
  </Canvas>

  {/* Accessible mirror */}
  <div className="sr-only" role="region" aria-label="3D Interactive Scene">
    <button onClick={handleAction}>
      Interact with 3D model
    </button>
  </div>
  ```
- **Reduced Motion States**: Always check for active `prefers-reduced-motion` browser configuration parameters. Fall back immediately to clean static compositions or step animations to avoid triggering vestibular disorders.
  ```tsx
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  <Canvas frameloop={prefersReducedMotion ? "never" : "always"}>
    <Scene animated={!prefersReducedMotion} />
  </Canvas>
  ```
- **Focus Management**: Ensure that interactive 3D elements have keyboard-accessible alternatives. Canvas elements cannot receive focus natively — provide focusable HTML counterparts.
- **Alt Text for Static 3D**: When a 3D scene serves a decorative or illustrative purpose, add an `aria-hidden="true"` to the canvas container and provide a descriptive `<p className="sr-only">` for context.

## 6. Route Transitions & Cleanup

- **Unmount Discipline**: When using client-side routing (Next.js, React Router), ensure Canvas components properly unmount when navigating away. Do not let un-optimized multi-page routes retain running Canvas logic in background memory.
- **Transition Patterns**: Use `<AnimatePresence>` (Framer Motion) or GSAP timelines to orchestrate smooth transitions between routes that contain 3D scenes:
  ```tsx
  <AnimatePresence mode="wait">
    <motion.div key={pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Canvas>
        <Scene />
      </Canvas>
    </motion.div>
  </AnimatePresence>
  ```

## Do Not

- ❌ Do not let un-optimized multi-page routes retain running Canvas logic in background memory fields.
- ❌ Do not wrap individual HTML layouts inside deep 3D Canvas matrix paths unless using structural positional containers like Drei's `<Html>` wrapper explicitly designed for spatial rendering.
- ❌ Do not render `<Canvas>` server-side — always use client-only boundaries.
- ❌ Do not forget to provide accessible alternatives for interactive 3D content.
- ❌ Do not ignore `prefers-reduced-motion` — always provide a static fallback.
- ❌ Do not use inline styles for canvas container sizing — use CSS classes for consistency and responsive control.
