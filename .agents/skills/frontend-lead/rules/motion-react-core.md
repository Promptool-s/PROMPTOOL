---
name: motion-react-core
description: Official Motion for React skill covering the core API — motion components, animate, initial, exit, transition, gestures, layout animations, scroll animations, AnimatePresence, and SVG animation. Use when the user asks about React animations, Motion (formerly Framer Motion), UI animation in React, Next.js animations, gestures, layout transitions, or production-grade React animation.
license: MIT
---

# Motion for React Core

## When to Use This Skill

Apply when writing or reviewing animations built with **Motion for React** (formerly Framer Motion). Use this skill whenever the user wants to animate React components using Motion's declarative API, whether for simple UI transitions or advanced interactions.

Use Motion when building:

- component animations
- interactive UI
- hover and tap interactions
- page transitions
- layout animations
- scroll animations
- SVG animations
- production-ready React interfaces

Motion is specifically designed for React and integrates naturally with React components, props, and state.

---

## When to Use Motion

**Risk level: LOW** — Motion is a UI animation library with a minimal security surface.

Use Motion when an application requires:

- ✅ production-grade React animations
- ✅ declarative component animations
- ✅ interactive UI
- ✅ gesture-based interactions
- ✅ layout transitions
- ✅ scroll-triggered animation
- ✅ scroll-linked animation
- ✅ SVG animation

Motion scales from simple prop-based animations to complex layout and gesture-driven interfaces.

---

## Why Motion

Motion is designed specifically for React.

Key advantages include:

- Built specifically for React.
- Declarative API that works naturally with state and props.
- Hardware-accelerated animations.
- Hybrid animation engine using the Web Animations API and ScrollTimeline where possible.
- Automatic JavaScript fallback for features browsers cannot provide.
- Spring physics.
- Interruptible animations.
- Cross-device gesture support.
- Tree-shakable architecture.
- Built with TypeScript.

---

## When CSS Is a Better Choice

CSS transitions are appropriate for simple, self-contained interactions such as:

- color changes
- simple hover effects
- basic transitions

Prefer Motion when animations involve:

- state changes
- gestures
- layout changes
- scrolling
- sequencing
- complex UI interactions

Motion can handle simple animations while scaling naturally to much more advanced interactions.

---

## Installation

Install Motion using npm:

```bash
npm install motion
```

Import Motion components from:

```javascript
import { motion } from "motion/react"
```

---

## motion Components

The `<motion />` component is the foundation of Motion.

Any HTML or SVG element can become animated by prefixing it with `motion`.

Example:

```jsx
<motion.button animate={{ opacity: 1 }} />
```

Motion components support animation props including:

- `animate`
- `initial`
- `exit`
- `whileHover`
- `whileTap`

Whenever values inside `animate` change, Motion automatically animates between states.

---

## Transitions

Physical properties such as:

- x
- y
- scale

use spring physics by default.

Visual properties such as:

- opacity

use tween easing by default.

Customize animation behavior using the `transition` prop.

Example:

```jsx
<motion.div
    animate={{
        scale: 2,
        transition: {
            duration: 2
        }
    }}
/>
```

---

## Enter Animations

Components animate toward the values defined in `animate`.

Use `initial` to define the starting state.

```jsx
<motion.button
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
/>
```

To disable the initial animation entirely:

```jsx
<motion.button
    initial={false}
    animate={{ scale: 1 }}
/>
```

---

## Gesture Animations

Motion extends React with built-in gesture animations.

Supported gestures include:

- hover
- tap
- focus
- drag

Example:

```jsx
<motion.button
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.95 }}
/>
```

Motion's gesture system is designed to work consistently across devices and provides a better experience than relying on CSS pseudo-classes or browser events alone.

---

## Scroll Animations

Motion supports two kinds of scroll animation.

### Scroll-triggered

Use `whileInView` to animate when an element enters or leaves the viewport.

```jsx
<motion.div
    initial={{ opacity: 0 }}
    whileInView={{ opacity: 1 }}
/>
```

---

### Scroll-linked

Use `useScroll()` to directly map animation values to scroll position.

Example:

```jsx
const { scrollYProgress } = useScroll()

return (
    <motion.div
        style={{
            scaleX: scrollYProgress
        }}
    />
)
```

---

## Layout Animations

Motion automatically detects layout changes including:

- position
- size
- reordering

Enable layout animation by adding the `layout` prop.

```jsx
<motion.div layout />
```

To animate between completely different elements, use `layoutId`.

```jsx
<motion.div layoutId="underline" />
```

---

## Exit Animations

Exit animations require wrapping components with `AnimatePresence`.

Example:

```jsx
<AnimatePresence>
    {show && (
        <motion.div
            key="box"
            exit={{ opacity: 0 }}
        />
    )}
</AnimatePresence>
```

This allows components to animate as they leave the React tree.

---

## SVG Animations

Motion provides full SVG animation support.

It can animate:

- SVG elements
- `viewBox`
- `pathLength`

Example:

```jsx
<motion.circle
    animate={{
        pathLength: 1
    }}
/>
```

This makes Motion suitable for both HTML and SVG animation using a consistent API.

---

## Official Motion Best Practices

- ✅ Use Motion components instead of manually manipulating the DOM.
- ✅ Use `animate` for the target animation state.
- ✅ Use `initial` to define entry states.
- ✅ Use `transition` to customize timing and easing.
- ✅ Use `whileHover`, `whileTap`, `whileInView`, and other built-in animation props instead of custom event handlers whenever possible.
- ✅ Use `layout` for automatic layout transitions.
- ✅ Use `layoutId` for shared layout animations.
- ✅ Wrap exiting components with `AnimatePresence`.
- ✅ Use `useScroll()` for scroll-linked animations.
- ✅ Use Motion for both HTML and SVG animations.

---

## Do Not

- ❌ Use Motion for simple CSS-only interactions when a standard CSS transition is sufficient.
- ❌ Reimplement hover, tap, or drag interactions manually when Motion provides dedicated props.
- ❌ Forget to wrap exiting components with `AnimatePresence` if exit animations are required.
- ❌ Manually interpolate animation values that can be handled declaratively through Motion props.
- ❌ Use imperative animation code when Motion's declarative API already provides the required behavior.