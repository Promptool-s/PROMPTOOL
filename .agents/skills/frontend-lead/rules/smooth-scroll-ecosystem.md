---
name: smooth-scroll-ecosystem
description: Rules for implementing global smooth scrolling with Lenis or GSAP ScrollSmoother, synchronizing with GSAP ScrollTrigger and R3F render loops, and handling edge cases around accessibility, mobile, and hybrid layouts.
version: "1.0.0"
---

# Smooth Scrolling Ecosystem

## When to Use This Skill
Apply when implementing a global smooth-scroll layer using Lenis (Studio Freight) or GSAP ScrollSmoother, integrating smooth scroll with GSAP ScrollTrigger, synchronizing smooth scroll with R3F render loops, or debugging scroll jitter/jank on trackpads and mice.

**Related skills:** For ScrollTrigger configuration use **gsap-scrolltrigger** (especially `scrollerProxy`); for 3D scroll sync use **canvas-orchestration**; for React lifecycle cleanup use **gsap-react**; for performance use **gsap-performance**.

## 1. Why Smooth Scrolling Matters

Native browser scroll is immediate and frame-locked. On premium sites, this creates jarring transitions between scroll-driven animations. A smooth scroll layer interpolates the scroll position, creating fluid, buttery movement that:

- Eliminates trackpad/mouse jitter in scroll-linked animations
- Enables consistent scroll velocity across input devices (trackpad, mouse wheel, touch)
- Provides a unified scroll position that GSAP, R3F, and CSS can reference

**Important:** Smooth scrolling is an enhancement, not a requirement. Always provide a fallback for users who prefer reduced motion or rely on assistive technology.

## 2. Lenis (Recommended Open-Source Solution)

### Installation & Initialization

```bash
npm install lenis
```

### Global Setup Pattern

```typescript
import Lenis from "lenis";
import "lenis/dist/lenis.css"; // required default styles

const lenis = new Lenis({
  duration: 1.2,           // interpolation duration (seconds)
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // exponential ease-out
  orientation: "vertical", // "vertical" | "horizontal"
  gestureOrientation: "vertical",
  smoothWheel: true,       // smooth mouse wheel
  touchMultiplier: 2,      // touch scroll sensitivity
  infinite: false,         // infinite scroll mode
});

function raf(time: number) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);
```

### Cleanup on Unmount
Always destroy Lenis when the component or page unmounts:

```typescript
// Vanilla
lenis.destroy();

// React
useEffect(() => {
  const lenis = new Lenis({ duration: 1.2 });
  function raf(time: number) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  const id = requestAnimationFrame(raf);
  return () => {
    cancelAnimationFrame(id);
    lenis.destroy();
  };
}, []);
```

### React Context Pattern (Recommended for Multi-Component Access)
Expose the Lenis instance via React Context so any component can access scroll state:

```tsx
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Lenis from "lenis";

const LenisContext = createContext<Lenis | null>(null);
export const useLenis = () => useContext(LenisContext);

export function LenisProvider({ children }: { children: React.ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const rafId = useRef<number>(0);

  useEffect(() => {
    const instance = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
    setLenis(instance);

    function raf(time: number) {
      instance.raf(time);
      rafId.current = requestAnimationFrame(raf);
    }
    rafId.current = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId.current);
      instance.destroy();
    };
  }, []);

  return (
    <LenisContext.Provider value={lenis}>
      {children}
    </LenisContext.Provider>
  );
}
```

## 3. Lenis + GSAP ScrollTrigger Integration (CRITICAL)

Lenis intercepts the native scroll and applies interpolation. GSAP ScrollTrigger must be told to use Lenis's scroll position, not the browser's native one. Without this hookup, ScrollTrigger animations will be out of sync — the #1 source of "jittery scroll animations" bugs.

### Method A: GSAP Ticker Sync (Recommended)

Connect Lenis to GSAP's ticker so both systems share the same RAF loop:

```typescript
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const lenis = new Lenis();

// Sync Lenis with GSAP ticker (single RAF loop)
lenis.on("scroll", ScrollTrigger.update);

gsap.ticker.add((time) => {
  lenis.raf(time * 1000); // GSAP ticker uses seconds, Lenis expects ms
});

// Disable Lenis's internal RAF since GSAP's ticker drives it
gsap.ticker.lagSmoothing(0);
```

### Method B: ScrollerProxy (Alternative for Custom Scrollers)

Use `ScrollTrigger.scrollerProxy()` when Lenis wraps a specific container instead of the whole page:

```typescript
ScrollTrigger.scrollerProxy(".scroll-container", {
  scrollTop(value) {
    if (arguments.length) {
      lenis.scrollTo(value, { immediate: true });
    }
    return lenis.scroll;
  },
  getBoundingClientRect() {
    return {
      top: 0,
      left: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  },
  pinType: document.querySelector(".scroll-container")?.style.transform
    ? "transform"
    : "fixed",
});

lenis.on("scroll", ScrollTrigger.update);
```

### React Integration with useGSAP

```tsx
import { useGSAP } from "@gsap/react";

function ScrollSection() {
  const containerRef = useRef<HTMLElement>(null);
  const lenis = useLenis(); // from context

  useGSAP(() => {
    if (!lenis) return;

    // Sync Lenis → ScrollTrigger
    lenis.on("scroll", ScrollTrigger.update);

    gsap.to(".parallax-bg", {
      yPercent: -30,
      ease: "none",
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top bottom",
        end: "bottom top",
        scrub: 1,
      },
    });
  }, { scope: containerRef, dependencies: [lenis] });

  return <section ref={containerRef}>{/* ... */}</section>;
}
```

## 4. GSAP ScrollSmoother (GSAP Premium)

ScrollSmoother is GSAP's built-in smooth scroll solution. It wraps the page content and applies velocity-based smoothing. It requires a **GSAP Business** or higher license.

### Setup

```javascript
gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

const smoother = ScrollSmoother.create({
  wrapper: "#smooth-wrapper",
  content: "#smooth-content",
  smooth: 1.5,            // interpolation time (seconds)
  effects: true,          // enable data-speed/data-lag attributes
  smoothTouch: 0.1,       // optional: smooth touch scrolling (0 = off)
});
```

### Required HTML Structure

```html
<div id="smooth-wrapper">
  <div id="smooth-content">
    <!-- All page content here -->
  </div>
</div>
```

### Declarative Parallax with ScrollSmoother

```html
<img data-speed="0.5" src="bg.jpg" />     <!-- moves at half speed -->
<div data-speed="1.5">Fast content</div>  <!-- moves at 1.5x speed -->
<div data-lag="0.5">Lagging element</div> <!-- follows with 0.5s delay -->
```

### ScrollSmoother + ScrollTrigger
ScrollSmoother automatically integrates with ScrollTrigger — no `scrollerProxy` needed. All ScrollTrigger instances created after `ScrollSmoother.create()` will automatically use the smooth scroll position.

## 5. Smooth Scroll + R3F Synchronization

When combining smooth scrolling with React Three Fiber, the 3D scene must reference the smooth-interpolated scroll position, not the native one.

### Pattern: Lenis → R3F useFrame

```tsx
import { useFrame } from "@react-three/fiber";

function ScrollLinkedScene() {
  const lenis = useLenis();
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!lenis || !meshRef.current) return;
    const progress = lenis.progress; // 0 → 1 normalized
    meshRef.current.rotation.y = progress * Math.PI * 2;
    meshRef.current.position.y = -progress * 5;
  });

  return (
    <mesh ref={meshRef}>
      <torusKnotGeometry args={[1, 0.3, 128, 16]} />
      <meshStandardMaterial color="#4488ff" />
    </mesh>
  );
}
```

### Pattern: Manual R3F Frame Loop with Lenis

For tighter synchronization, disable R3F's automatic rendering and advance frames from the same loop as Lenis:

```tsx
<Canvas frameloop="never">
  <LenisSyncedScene />
</Canvas>
```

```tsx
function LenisSyncedScene() {
  const { gl, scene, camera, advance } = useThree();
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;
    const onScroll = () => {
      advance(); // manually advance R3F frame
    };
    lenis.on("scroll", onScroll);
    return () => lenis.off("scroll", onScroll);
  }, [lenis, advance]);

  return <Scene />;
}
```

## 6. Accessibility & Edge Cases

### Respect `prefers-reduced-motion`
When reduced motion is preferred, disable smooth scrolling entirely. Smooth scroll itself can trigger vestibular discomfort:

```typescript
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const lenis = new Lenis({
  duration: prefersReducedMotion ? 0 : 1.2, // instant scroll = native behavior
  smoothWheel: !prefersReducedMotion,
});
```

### Keyboard & Focus Scroll
Smooth scroll libraries can interfere with keyboard navigation (`Tab`, `Space`, `Page Down`). Verify that:
- Focus scrolling (tabbing to off-screen elements) still works correctly
- `lenis.scrollTo(target)` or `smoother.scrollTo(target)` can be used to programmatically scroll to focused elements
- Anchor links (`#section`) work via `lenis.scrollTo("#section")`

```typescript
// Handle anchor links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (e) => {
    e.preventDefault();
    const target = anchor.getAttribute("href");
    if (target) lenis.scrollTo(target);
  });
});
```

### Mobile Touch Behavior
- **Lenis**: Set `touchMultiplier` to tune touch scroll sensitivity. Test on real devices — over-smoothed touch scrolling feels unresponsive.
- **ScrollSmoother**: Use `smoothTouch: false` (default) unless specifically needed. Mobile users expect native touch scrolling behavior. Overriding it can break pull-to-refresh, address bar auto-hide, and rubber-banding.

### Scroll Lock (Modals, Overlays)
When opening modals or overlays, stop the smooth scroll to prevent background scrolling:

```typescript
// Lenis
lenis.stop();  // pause
lenis.start(); // resume

// ScrollSmoother
smoother.paused(true);  // pause
smoother.paused(false); // resume
```

## 7. Common Integration Issues & Fixes

| Problem | Cause | Fix |
|---------|-------|-----|
| ScrollTrigger animations jitter | Lenis and ScrollTrigger use different scroll positions | Sync via `lenis.on("scroll", ScrollTrigger.update)` + GSAP ticker |
| Pinned elements jump on scroll | `pinType` mismatch with smooth scroll transform | Set `pinType: "transform"` in ScrollTrigger config |
| Anchor links don't smooth-scroll | Native `#hash` navigation bypasses Lenis | Intercept click events and use `lenis.scrollTo("#id")` |
| Mobile feels sluggish | Over-smoothed touch scrolling | Set `smoothTouch: false` or reduce `touchMultiplier` |
| Content flashes on page load | Smooth scroll starts before layout is computed | Initialize Lenis after `DOMContentLoaded` or in `useEffect` |
| `ScrollTrigger.refresh()` misses positions | Lenis scroll position not synced during refresh | Call `lenis.raf(performance.now())` before `ScrollTrigger.refresh()` |

## Best Practices

- ✅ Use a single smooth scroll instance per page — never create multiple Lenis/ScrollSmoother instances.
- ✅ Sync Lenis with GSAP via the ticker method for the most reliable integration.
- ✅ Destroy/clean up smooth scroll on component unmount or route change.
- ✅ Disable smooth scrolling when `prefers-reduced-motion` is active.
- ✅ Test on real mobile devices — smooth touch scrolling can degrade UX.
- ✅ Lock scroll (`.stop()` / `.paused(true)`) when modals or overlays are open.
- ✅ Initialize after DOM is ready to prevent layout computation race conditions.

## Do Not

- ❌ Use both Lenis and ScrollSmoother on the same page — pick one.
- ❌ Forget to sync the smooth scroll library with ScrollTrigger — this is the #1 cause of scroll animation jitter.
- ❌ Enable `smoothTouch` on mobile without thorough real-device testing.
- ❌ Create a new Lenis instance per component — use a shared context/singleton.
- ❌ Set very high `duration` values (>2s) — scroll feels unresponsive and disorienting.
- ❌ Ignore anchor link and keyboard focus scrolling — intercept and route through the smooth scroll API.
- ❌ Leave smooth scroll running on background routes in SPAs — destroy on route change.
