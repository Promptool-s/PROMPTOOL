---
name: gsap-text-effects
description: Creative text effects and typography animation rules covering GSAP SplitText, TextPlugin, variable font manipulation, SVG text path animation, and accessible text splitting patterns. Use when animating headlines, hero text, character-by-character reveals, typewriter effects, or kinetic typography.
version: "1.0.0"
---

# Creative Text Effects & Typography Animation

## When to Use This Skill
Apply when implementing animated text reveals (character, word, or line splitting), typewriter effects, kinetic typography, variable font interpolation, SVG text path animation, or any creative text treatment that goes beyond simple fade/slide.

**Related skills:** For tween mechanics use **gsap-core**; for timeline sequencing use **gsap-timeline**; for scroll-driven text reveals use **gsap-scrolltrigger**; for React lifecycle cleanup use **gsap-react**; for performance concerns use **gsap-performance**.

## 1. SplitText (GSAP Plugin)

### Registration & Basic Usage
SplitText splits a text element's content into individually animatable `<div>` or `<span>` wrappers for characters, words, and/or lines. Register the plugin once:

```javascript
gsap.registerPlugin(SplitText);
```

Split an element by type:

```javascript
const split = new SplitText(".hero-heading", {
  type: "chars, words, lines", // any combination
  charsClass: "char",          // optional CSS class per char
  wordsClass: "word",          // optional CSS class per word
  linesClass: "line",          // optional CSS class per line
});

// Animate the resulting arrays
gsap.from(split.chars, {
  opacity: 0,
  y: 50,
  rotationX: -90,
  stagger: 0.03,
  duration: 0.6,
  ease: "back.out(1.7)",
});
```

### Responsive Re-splitting
Line splits depend on container width. When the viewport resizes, lines may reflow. Use `gsap.matchMedia()` or a `ResizeObserver` to revert and re-split:

```javascript
const mm = gsap.matchMedia();
mm.add("(min-width: 1px)", () => {
  const split = new SplitText(".hero-heading", { type: "lines" });
  gsap.from(split.lines, {
    opacity: 0,
    y: 30,
    stagger: 0.1,
  });
  // matchMedia auto-reverts on resize, then re-runs the handler
});
```

### Revert After Animation
Always call `split.revert()` when the animation completes or the component unmounts to restore the original DOM structure. Leaving split wrappers in the DOM permanently:
- Breaks text selection and copy-paste
- Creates problems for screen readers
- Causes layout shifts on resize

```javascript
const split = new SplitText(".text", { type: "chars" });
const tl = gsap.timeline({
  onComplete: () => split.revert(),
});
tl.from(split.chars, { opacity: 0, y: 20, stagger: 0.02 });
```

In React, use `useGSAP` cleanup:

```tsx
useGSAP(() => {
  const split = new SplitText(textRef.current, { type: "chars, words" });
  gsap.from(split.chars, { opacity: 0, y: 30, stagger: 0.02 });
  return () => split.revert(); // cleanup on unmount
}, { scope: containerRef });
```

## 2. Accessibility for Split Text (CRITICAL)

Splitting text inserts wrapper elements (`<div>`, `<span>`) around each character, word, or line. This can severely break assistive technology if not handled properly.

### Screen Reader Protection
- **`aria-label` on Container**: Set the full, unsplit text as an `aria-label` on the parent element so screen readers announce the complete sentence, not individual characters.
- **`aria-hidden` on Split Wrappers**: Mark the split wrapper children as `aria-hidden="true"` so screen readers skip the fragmented DOM.

```tsx
<h1 ref={headingRef} aria-label="Welcome to our platform">
  {/* SplitText will inject char/word/line wrappers here */}
  Welcome to our platform
</h1>
```

```javascript
// After splitting
const split = new SplitText(headingRef.current, { type: "chars" });
// SplitText's wrapper elements inherit aria-hidden if the plugin supports it,
// but verify: set aria-hidden on the direct child container if needed
headingRef.current.setAttribute("aria-label", headingRef.current.textContent);
split.chars.forEach((char) => char.setAttribute("aria-hidden", "true"));
```

### Layout Shift Prevention
- **Set `overflow: hidden`** on line wrappers when animating `y` or `rotationX` to prevent characters from visually overflowing during entrance.
- **Reserve space with `min-height`**: If the text block is above the fold, set a CSS `min-height` on the container matching the expected rendered height to prevent CLS (Cumulative Layout Shift).
- **Use `will-change: transform`** on split elements that will animate transforms.

```css
.line {
  overflow: hidden;
}
.char {
  display: inline-block;
  will-change: transform;
}
```

### Reduced Motion
When `prefers-reduced-motion` is active, skip character/word splitting entirely or use instant-set animations (`duration: 0`). Do not force users with vestibular disorders to watch rapid character-by-character reveals.

```javascript
const mm = gsap.matchMedia();
mm.add({
  normal: "(prefers-reduced-motion: no-preference)",
  reduced: "(prefers-reduced-motion: reduce)",
}, (context) => {
  const { reduced } = context.conditions;
  if (reduced) {
    // Simple fade, no splitting
    gsap.from(".hero-heading", { opacity: 0, duration: 0.3 });
  } else {
    const split = new SplitText(".hero-heading", { type: "chars" });
    gsap.from(split.chars, { opacity: 0, y: 40, stagger: 0.02, duration: 0.5 });
  }
});
```

## 3. TextPlugin (GSAP)

TextPlugin replaces text content progressively — useful for typewriter effects, counter labels, or dynamic text swaps.

```javascript
gsap.registerPlugin(TextPlugin);

gsap.to(".output", {
  text: {
    value: "Hello, welcome to the future.",
    delimiter: "",       // character-by-character (default)
    speed: 1,            // relative speed multiplier
    padSpace: true,      // pad with non-breaking spaces to prevent reflowing
  },
  duration: 2,
  ease: "none",
});
```

### Accessibility for Typewriter Effects
- Add `aria-live="polite"` on the container so screen readers announce the final text when it settles.
- Set `role="status"` if the text change represents a status update.
- Never use `aria-live="assertive"` for decorative typewriter effects — it interrupts the user.

```html
<p class="output" aria-live="polite" role="status"></p>
```

## 4. Variable Font Animation

Modern variable fonts expose axes (`wght`, `wdth`, `ital`, `slnt`, `opsz`, and custom axes) that can be animated smoothly via GSAP's CSS variable animation.

### Setup Pattern
Define CSS custom properties and animate them:

```css
.variable-text {
  font-family: "Inter Variable", sans-serif;
  font-variation-settings:
    "wght" var(--font-wght, 400),
    "wdth" var(--font-wdth, 100);
  transition: none; /* GSAP handles the animation */
}
```

```javascript
// Animate weight from 100 to 900
gsap.to(".variable-text", {
  "--font-wght": 900,
  duration: 1.2,
  ease: "power2.inOut",
});

// Stagger weight across characters (combine with SplitText)
const split = new SplitText(".variable-text", { type: "chars" });
gsap.to(split.chars, {
  "--font-wght": 900,
  stagger: { each: 0.05, from: "start" },
  duration: 0.8,
  ease: "power3.out",
});
```

### Scroll-Driven Variable Font
Map scroll progress to font weight for kinetic reading experiences:

```javascript
gsap.to(".dynamic-heading", {
  "--font-wght": 900,
  scrollTrigger: {
    trigger: ".dynamic-heading",
    start: "top 80%",
    end: "top 30%",
    scrub: 1,
  },
});
```

### Performance Note
Variable font rendering is handled by the text rasterizer, which runs on the CPU. Animating `font-variation-settings` on many elements simultaneously can cause jank. Limit concurrent variable font animations to ~10-20 elements, or stagger them so only a few are active at once.

## 5. SVG Text Path Animation

Animate text along an SVG path using GSAP + the `startOffset` attribute on `<textPath>`:

```html
<svg viewBox="0 0 800 200">
  <defs>
    <path id="curve" d="M 50 150 Q 400 20 750 150" fill="none" />
  </defs>
  <text>
    <textPath href="#curve" startOffset="0%">
      Text flowing along a curved path
    </textPath>
  </text>
</svg>
```

```javascript
gsap.to("textPath", {
  attr: { startOffset: "100%" },
  duration: 3,
  ease: "none",
  scrollTrigger: {
    trigger: "svg",
    start: "top center",
    end: "bottom center",
    scrub: 1,
  },
});
```

### Accessibility for SVG Text
- Add `role="img"` and `aria-label` on the `<svg>` element with the full text content.
- Add a `<title>` element inside the SVG for tooltip and accessible name.
- The `<textPath>` content is readable by screen readers natively, but ensure `font-size` is legible and the path doesn't make text visually illegible.

## 6. Common Text Animation Patterns

### Line-by-Line Reveal (Masked)
```javascript
const split = new SplitText(".paragraph", { type: "lines", linesClass: "line-wrap" });

// Wrap each line in an overflow container for mask effect
split.lines.forEach((line) => {
  const wrapper = document.createElement("div");
  wrapper.style.overflow = "hidden";
  line.parentNode.insertBefore(wrapper, line);
  wrapper.appendChild(line);
});

gsap.from(split.lines, {
  yPercent: 100,
  stagger: 0.12,
  duration: 0.8,
  ease: "power3.out",
});
```

### Scramble / Decode Effect
Use a character-swap approach with `onUpdate` callbacks:

```javascript
const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const originalText = element.textContent;

gsap.to({ progress: 0 }, {
  progress: 1,
  duration: 1.5,
  ease: "none",
  onUpdate: function () {
    const p = this.targets()[0].progress;
    const revealedCount = Math.floor(p * originalText.length);
    let result = "";
    for (let i = 0; i < originalText.length; i++) {
      if (i < revealedCount) {
        result += originalText[i];
      } else if (originalText[i] === " ") {
        result += " ";
      } else {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    element.textContent = result;
  },
});
```

## Best Practices

- ✅ Always `split.revert()` after animation completes or on component unmount.
- ✅ Set `aria-label` on the parent and `aria-hidden="true"` on split wrappers.
- ✅ Use `overflow: hidden` on line wrappers for masked reveal effects.
- ✅ Wrap SplitText in `gsap.matchMedia()` to handle responsive re-splitting.
- ✅ Use `will-change: transform` on split elements, remove after animation.
- ✅ Test text animations with a screen reader to verify announcement correctness.
- ✅ Reserve vertical space (`min-height`) for above-the-fold text to prevent CLS.

## Do Not

- ❌ Leave SplitText wrappers in the DOM permanently — always revert.
- ❌ Split text without providing `aria-label` on the container element.
- ❌ Force rapid character animations when `prefers-reduced-motion` is active.
- ❌ Animate `font-variation-settings` on more than ~20 elements simultaneously without staggering.
- ❌ Use TextPlugin typewriter effects without `aria-live` on the container.
- ❌ Forget that line-based splits depend on container width — handle resize/responsive scenarios.
- ❌ Use `innerHTML` to manually split text when SplitText or a tested utility handles it safely.
