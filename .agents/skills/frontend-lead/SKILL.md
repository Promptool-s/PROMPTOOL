---
name: frontend-lead
description: Master orchestration skill for premium frontend development. Automatically combines every specialized frontend rule and applies them together to produce production-ready React interfaces, immersive 3D experiences, hybrid WebGL layouts, creative typography animation, and smooth scroll ecosystems.
version: "3.1.0"
---

# Frontend Lead

## Purpose

This is the orchestration skill for every frontend specialization.

Its responsibility is to automatically combine the guidance from all relevant frontend rule files before generating an answer.

This skill should never behave like an isolated React expert.

Instead, it coordinates all frontend domains into one coherent solution.

---

# Rule Orchestration

Every request MUST begin by identifying which rule files are applicable.

Never activate only one rule when multiple are relevant.

Example mappings:

## React Component

Apply:

- React best practices
- UI Styling
- Accessibility
- Performance

---

## Landing Page

Apply:

- UI Styling
- UI/UX Pro Max
- Motion React
- Responsive Design
- Performance

---

## Interactive Section

Apply:

- Motion React Core
- Motion Performance
- UI Styling
- Accessibility

---

## Scroll Animations

Apply:

- Motion Scroll
- Motion Performance
- React lifecycle
- Accessibility
- Reduced Motion

---

## Complex Animation

Apply:

- Motion Timeline
- Motion Core
- Performance
- UI rules

---

## 3D Background / Immersive Scene

Apply:

- Three Core
- R3F Shaders
- Canvas Orchestration
- Performance
- Accessibility
- Reduced Motion

---

## 3D Landing Page with Scroll Sync

Apply:

- UI Styling
- UI/UX Pro Max
- Three Core
- R3F Shaders
- Canvas Orchestration
- GSAP ScrollTrigger
- Motion React Core
- Accessibility
- Performance

---

## Custom Shader Effect

Apply:

- R3F Shaders
- Three Core
- Performance
- Canvas Orchestration

---

## Hybrid HTML + WebGL Layout

Apply:

- Canvas Orchestration
- Three Core
- R3F Shaders
- UI Styling
- Accessibility
- Responsive Design

---

## Animated Text Reveal / Kinetic Typography

Apply:

- GSAP Text Effects
- GSAP Core
- GSAP Timeline
- UI Styling
- Accessibility
- Performance

---

## Smooth Scroll Landing Page

Apply:

- Smooth Scroll Ecosystem
- GSAP ScrollTrigger
- GSAP Text Effects
- UI Styling
- UI/UX Pro Max
- Accessibility
- Performance

---

## Variable Font + Scroll-Driven Typography

Apply:

- GSAP Text Effects
- Smooth Scroll Ecosystem
- GSAP ScrollTrigger
- UI Styling
- Performance

---

# Decision Priority

When multiple rules overlap:

1. Accessibility
2. Correctness
3. Performance
4. User Experience
5. Maintainability
6. Visual polish

Never sacrifice higher-priority concerns for aesthetics.

---

# Mandatory Development Workflow

Every implementation follows this sequence.

## 1. Analyze

Identify:

- framework
- rendering model
- component boundaries
- state
- interactions
- responsive needs
- 3D/WebGL scope (scene complexity, shader needs, hybrid layout)
- typography animation needs (text splitting, kinetic type, variable fonts)
- scroll behavior model (native, smooth, scroll-driven)

---

## 2. Load Rules

Determine every applicable frontend rule.

Treat them as cumulative.

---

## 3. Design

Before code:

- layout
- hierarchy
- spacing
- typography
- responsiveness
- accessibility
- animation strategy
- 3D scene graph structure (when applicable)
- shader uniform data flow (when applicable)
- HTML/WebGL layering and pointer-events plan (when applicable)
- text split strategy and revert plan (when applicable)
- smooth scroll architecture and GSAP sync method (when applicable)

---

## 4. Implementation

Generate:

- clean
- reusable
- typed
- maintainable
- production-ready
- well-structured code

---

## 5. Validate

Check:

### Accessibility

- keyboard navigation
- ARIA
- semantic HTML
- focus visibility
- contrast
- screen reader fallbacks for 3D content
- reduced motion for WebGL animations

### Performance

- avoid unnecessary renders
- memoization where appropriate
- lazy loading
- GPU-safe animations
- cleanup
- bundle size
- Three.js memory disposal on unmount
- DPR capping at 2
- InstancedMesh for repeated objects
- no math object allocation inside animation loops

### Animation

- reduced-motion support
- proper lifecycle
- cleanup
- interruption handling
- no layout thrashing
- framerate-independent delta time

### Shaders

- explicit precision declarations
- minimal conditional branching
- math-based alternatives (step, mix, smoothstep, clamp)
- external shader file organization
- ref-based uniform updates inside useFrame

### Canvas & Hybrid Layout

- client-only rendering boundaries (SSR safety)
- Suspense + Loader fallbacks
- z-index layer consistency
- pointer-events isolation
- scroll sync without jitter
- route transition cleanup

### Typography & Text Effects

- SplitText revert on unmount and animation complete
- aria-label on parent, aria-hidden on split wrappers
- overflow: hidden on line wrappers for masked reveals
- responsive re-splitting via matchMedia or ResizeObserver
- CLS prevention (min-height, reserved space)
- reduced motion bypass for character animations
- TextPlugin aria-live on typewriter containers

### Smooth Scroll

- single smooth scroll instance per page
- Lenis/ScrollSmoother synced with GSAP ticker or scrollerProxy
- reduced motion disables smooth scrolling
- mobile touch sensitivity tested on real devices
- scroll lock for modals and overlays
- anchor links routed through smooth scroll API
- cleanup/destroy on route change

### UI

- spacing consistency
- responsive scaling
- typography hierarchy
- visual balance
- interaction feedback

Fix issues automatically before responding.

---

# Expected Response Structure

Unless the user explicitly requests otherwise:

1. Direct answer
2. Architecture overview
3. Key implementation decisions
4. Production-ready code
5. Improvements over naïve implementations

---

# Code Standards

Always generate code that is:

- modular
- reusable
- composable
- accessible
- performant
- responsive
- maintainable
- production-ready

Avoid placeholder implementations whenever enough context exists.

---

# Proactive Improvements

When existing code is provided, automatically improve:

- accessibility
- performance
- animation lifecycle
- React architecture
- responsiveness
- maintainability
- visual consistency
- Three.js memory management
- shader optimization
- canvas hydration safety
- HTML/WebGL layering correctness
- text split accessibility and cleanup
- smooth scroll GSAP synchronization
- variable font animation performance

Explain important improvements briefly.

---

# Final Principle

The quality of the answer is determined by how well every applicable frontend specialization has been combined.

Never rely on a single rule file when multiple domains are relevant.