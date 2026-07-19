---
name: ui-ux-pro-max
description: "UI/UX design intelligence for modern premium web interfaces. Includes 50+ styles, 161 color palettes, 57 font pairings, 161 product types, 99 UX guidelines, and 25 chart types across core web stacks (React, Next.js, Vue, Svelte, Tailwind CSS, and HTML/CSS). Actions: plan, build, create, design, implement, review, fix, improve, optimize, enhance, refactor, and check UI/UX code. Projects: website, landing page, dashboard, admin panel, e-commerce, SaaS, portfolio, and blog. Elements: button, modal, navbar, sidebar, card, table, form, and chart. Styles: glassmorphism, claymorphism, minimalism, brutalism, neumorphism, bento grid, dark mode, responsive, and flat design. Topics: color systems, accessibility, animation, layout, typography, spacing, interaction states, and Core Web Vitals (LCP, FID, CLS)."
---

# UI/UX Pro Max - Web Design Intelligence

Comprehensive design guide for modern, responsive, and premium web applications. Contains 50+ styles, 161 color palettes, 57 font pairings, 161 product types with reasoning rules, 99 UX guidelines, and 25 chart types across web technology stacks.

## When to Apply

This Skill should be used when the task involves **web UI structure, visual design decisions, interaction patterns, or user experience quality control**.

### Must Use

This Skill must be invoked in the following situations:

- Designing new web pages (Landing Pages, Dashboards, Admin Panels, SaaS apps, Portfolios)
- Creating or refactoring web UI components (buttons, modals, forms, tables, charts, etc.)
- Choosing color schemes, typography systems, spacing standards, or layout systems for the web
- Reviewing web code for user experience, accessibility (WCAG), or visual consistency
- Implementing navigation structures, animations, or responsive behavior (desktop, tablet, mobile)
- Making product-level web design decisions (style, information hierarchy, brand expression)
- Improving perceived quality, clarity, or usability of web interfaces

### Skip

This Skill is not needed in the following situations:

- Pure backend logic development (database design, API endpoints)
- Infrastructure or DevOps work
- Non-visual scripts or automation tasks

**Decision criteria**: If the task will change how a web feature **looks, feels, moves, or is interacted with**, this Skill should be used.

## Rule Categories by Priority

*For reference: follow priority 1→10 to decide which rule category to focus on first. Key checks and anti-patterns focus entirely on Web interfaces.*

| Priority | Category | Impact | Domain | Key Checks (Must Have) | Anti-Patterns (Avoid) |
|----------|----------|--------|--------|------------------------|------------------------|
| 1 | Accessibility | CRITICAL | `ux` | Contrast 4.5:1, Alt text, Keyboard nav, ARIA labels | Removing focus outline/rings, Icon-only buttons without labels |
| 2 | Touch & Interaction | CRITICAL | `ux` | Min touch target 44×44px, 8px+ spacing, Hover & Active states | Hover-only interactions without mobile fallback, instant state snaps (0ms) |
| 3 | Performance & CLS | HIGH | `ux` | Next-gen image formats (AVIF/WebP), aspect-ratio to prevent CLS (<0.1) | Layout thrashing, Cumulative Layout Shift from dynamic fonts/images |
| 4 | Style Selection | HIGH | `style`, `product` | Match product type, Consistency, SVG icons (no emoji) | Mixing flat & skeuomorphic randomly, Emoji as structural icons |
| 5 | Layout & Responsive | HIGH | `ux` | Mobile-first breakpoints, Viewport meta, No horizontal scroll | Forced horizontal scroll on standard pages, fixed-width px containers |
| 6 | Typography & Color | MEDIUM | `typography`, `color` | Base 16px, Line-height 1.5-1.75, Semantic color variables | Text < 12px for body, Gray-on-gray, Hardcoded hex in components |
| 7 | Animation | MEDIUM | `ux` | Duration 150–300ms, Motion conveys meaning, Reduced motion fallback | Purely decorative-only animation, Animating layout properties (width/height) |
| 8 | Forms & Feedback | MEDIUM | `ux` | Visible labels (not placeholder-only), Error near field, Autocomplete | Hidden labels, Errors only at top of page, No inline validation |
| 9 | Navigation Patterns | HIGH | `ux` | Skip links, Keyboard-accessible menus, Clear active state indicator | Overloaded nav menus, Broken back button state preservation, No breadcrumbs |
| 10 | Charts & Data | LOW | `chart` | Legends, Interactive tooltips, Accessible colors | Relying on color alone to convey data values |

## Quick Reference

### 1. Accessibility (CRITICAL)

- `color-contrast` - Minimum 4.5:1 ratio for normal text (large text 3:1); WCAG AA compliance.
- `focus-states` - Visible focus outline/rings on interactive elements (2–4px offset) for keyboard navigation.
- `alt-text` - Descriptive alt text for meaningful images; empty `alt=""` for decorative ones.
- `aria-labels` - Explicit `aria-label` for icon-only buttons.
- `keyboard-nav` - Tab order matches visual order; full keyboard support (escape keys for modals, arrow keys for tabs).
- `form-labels` - Use `<label>` with a matching `for` (or `htmlFor` in React) attribute.
- `skip-links` - Implement a visually hidden "Skip to main content" link that appears on first tab key.
- `heading-hierarchy` - Sequential `<h1>` through `<h6>`, no level skip (e.g., `<h1>` directly to `<h3>`).
- `color-not-only` - Don't convey info by color alone (always add icons, labels, or patterns).
- `reduced-motion` - Respect `prefers-reduced-motion` media query; reduce/disable transitions when requested.
- `voiceover-sr` - Semantic HTML5 elements (`<nav>`, `<main>`, `<aside>`, `<header>`, `<footer>`) to construct screen reader landmarks.

### 2. Touch & Interaction (CRITICAL)

- `touch-target-size` - Minimum 44×44px interactive area for all clickable items on mobile viewports.
- `touch-spacing` - Minimum 8px gap between touch targets to prevent accidental taps.
- `hover-vs-tap` - Use hover for progressive disclosure/feedback, but guarantee that tap actions trigger the same behavior on mobile/touch interfaces.
- `loading-buttons` - Disable buttons during async operations; show custom spinner or loading state.
- `error-feedback` - Clear error messages positioned near the relevant field.
- `cursor-pointer` - Ensure interactive elements have `cursor: pointer` via CSS.
- `press-feedback` - Visual state feedback on click/active (`:active` styles or active tokens).
- `no-precision-required` - Avoid requiring pixel-perfect clicks on tiny close icons or narrow borders.

### 3. Performance & CLS (HIGH)

- `image-optimization` - Use next-gen formats (WebP/AVIF), responsive images (`srcset`/`sizes`), and native `loading="lazy"` for below-the-fold assets.
- `image-dimension` - Always declare width/height or use CSS `aspect-ratio` to reserve space and prevent Cumulative Layout Shift (CLS limit < 0.1).
- `font-loading` - Use `font-display: swap` or `font-display: optional` to avoid invisible text (FOIT); reserve space to reduce layout shift.
- `font-preload` - Preload only critical font files; avoid overusing preload on non-critical variants.
- `lazy-loading` - Lazy load heavy components via dynamic imports or route-level code splitting.
- `bundle-splitting` - Split code by route/feature (React Suspense / Next.js dynamic) to reduce initial bundle sizes.
- `reduce-reflows` - Avoid layout thrashing. Batch DOM reads then writes.
- `content-jumping` - Reserve space for async/dynamically loaded content (skeletons, aspect-ratio placeholders) to prevent layout jumps.
- `virtualize-lists` - Use virtualized lists for 100+ items to preserve scroll performance.
- `debounce-throttle` - Use debounce/throttle for high-frequency events (scroll, resize, mousemove).

### 4. Style Selection (HIGH)

- `style-match` - Match style to product type (e.g., Glassmorphism/Neumorphism for SaaS/fintech, Minimalist for portfolio/blog).
- `consistency` - Maintain a unified style across all pages and layouts.
- `no-emoji-icons` - Use SVG icons (Lucide, Heroicons, etc.) instead of emojis for structural controls.
- `state-clarity` - Make hover, active, focused, and disabled states visually distinct while matching the aesthetic.
- `elevation-consistent` - Use a consistent box-shadow scale (e.g., sm, md, lg, xl) instead of arbitrary values.
- `dark-mode-pairing` - Design light/dark variants together to keep contrast, brand identity, and readability intact.
- `icon-style-consistent` - Use a single icon set/visual language (consistent stroke width and corner radius).

### 5. Layout & Responsive (HIGH)

- `viewport-meta` - Enforce `<meta name="viewport" content="width=device-width, initial-scale=1">` (never disable zoom).
- `mobile-first` - Design mobile-first, scaling up to tablet and desktop viewports via media queries.
- `breakpoint-consistency` - Use systematic breakpoints (e.g., SM: 640px, MD: 768px, LG: 1024px, XL: 1280px).
- `readable-font-size` - Minimum 16px body text on mobile to avoid iOS browser auto-zoom behavior on input focus.
- `line-length-control` - Limit long-form paragraphs to 60–75 characters for comfortable reading.
- `horizontal-scroll` - Prevent accidental horizontal scrollbars; set `max-width: 100%` and `overflow-x: hidden` on page wrappers.
- `spacing-scale` - Use a consistent 4px/8px grid system for margins, padding, and layout gaps.
- `container-width` - Consistent max-width on desktop layouts (e.g., `max-w-6xl` or `max-w-7xl` in Tailwind).
- `z-index-management` - Define a layered z-index scale (e.g., bg: -10, base: 0, dropdown: 10, sticky: 20, modal: 50, toast: 100).
- `viewport-units` - Prefer dynamic viewport units (`dvh`, `dvw`) over standard `vh`/`vw` on mobile browsers to prevent layout issues with mobile address bars.

### 6. Typography & Color (MEDIUM)

- `line-height` - Use 1.5 to 1.75 for body paragraphs; 1.2 to 1.3 for headings.
- `font-pairing` - Pair a highly legible sans-serif for body with a distinct font (serif, slab, display) for headings.
- `font-scale` - Follow a standard typographic scale (e.g., 12px, 14px, 16px, 18px, 20px, 24px, 30px, 36px, 48px).
- `contrast-readability` - Ensure dark text on light background or vice-versa (e.g., `#0f172a` body on `#ffffff`).
- `color-semantic` - Define semantic colors (primary, secondary, success, warning, error, background, foreground) via CSS variables or Tailwind tokens.
- `color-dark-mode` - Use desaturated colors for dark mode; test contrast separately to satisfy 4.5:1 minimums.
- `number-tabular` - Use tabular/monospaced numbers (`font-variant-numeric: tabular-nums`) for data tables, price columns, and timers to prevent digit jitter.

### 7. Animation (MEDIUM)

- `duration-timing` - Use 150–300ms for hover states and button animations; 300-400ms for large page/modal entries.
- `transform-performance` - Animate only `transform` (translate, scale, rotate) and `opacity` to keep operations on the compositor thread.
- `easing` - Use `ease-out` for entering transitions, `ease-in` for exiting transitions; avoid linear curves on UI components.
- `stagger-sequence` - Stagger list animations by 30-50ms per item to guide the user's eye without feeling sluggish.
- `scale-feedback` - Apply a subtle scale shift (e.g., `scale(0.98)` or `scale(1.02)`) on click/hover for interactive cards.

### 8. Forms & Feedback (MEDIUM)

- `input-labels` - Every form input must have a visible label (never rely on placeholders alone for context).
- `error-placement` - Position error messages directly below the corresponding input.
- `disabled-states` - Disabled elements must use reduced opacity (0.4-0.5), `pointer-events: none`, and `cursor: not-allowed`.
- `inline-validation` - Validate inputs on blur or debounced keystrokes rather than instant error generation on focus.
- `autofill-support` - Provide autocomplete attributes (`email`, `username`, `current-password`) to enable browser autofill.
- `aria-live-errors` - Use `role="alert"` or `aria-live="polite"` on error display blocks so screen readers announce form failures immediately.

### 9. Navigation Patterns (HIGH)

- `keyboard-accessible-menus` - Dropdown/flyout menus must open and navigate using Tab, Arrow keys, and Escape.
- `nav-state-active` - Highlight the active link using clear contrast, indicators, or visual weights.
- `modal-escape` - Modals must close on pressing the Escape key and by clicking outside the modal wrapper.
- `breadcrumb-web` - Use breadcrumb trails for deep site structures to maintain orientation.
- `focus-on-route-change` - Move focus to the main content container on client-side route transitions for screen readers.

### 10. Charts & Data (LOW)

- `data-table` - Provide a screen-reader-friendly data table fallback for complex charts.
- `tooltip-keyboard` - Ensure chart tooltips can be triggered via keyboard focus, not just mouse hover.
- `screen-reader-summary` - Provide an `aria-label` or description detailing the chart's trend/insight.
- `gridline-subtle` - Keep gridlines low-contrast (e.g., gray-100 or gray-800 in dark mode) to avoid competing with data visualization.

---

## How to Use This Skill

Follow this workflow for web interface implementation:

### Step 1: Analyze User Requirements

Extract key layout dimensions:
- **Product type**: SaaS Dashboard, E-commerce, Portfolio, Marketing Landing Page.
- **Target audience**: Desktop professionals, general consumers, mobile-first users.
- **Style keywords**: glassmorphism, minimalism, dark mode, content-first.
- **Stack**: React, Next.js, Tailwind CSS (or other core web stacks).

### Step 2: Establish the Spacing and Color Tokens (CSS Variables)

Define a consistent design system inside `index.css` using HSL or OKLCH values for dark/light themes. 

### Step 3: Implement Responsive Grid and Layout Structure

Structure the page using CSS Grid or Flexbox, adhering to mobile-first constraints and container max-widths.

### Step 4: Apply Polish and Validate against Web Guidelines

Before completing the task, run through the pre-delivery checklist to ensure accessibility, layout stability, and responsiveness.

---

## Common Rules for Professional Web UI

These are frequently overlooked issues that make web interfaces look unprofessional.

### Visual Elements & Affordances

| Rule | Standard | Avoid | Why It Matters |
|------|----------|--------|----------------|
| **No Emoji as Icons** | Use SVG-based icon sets (Lucide, Heroicons) that scale cleanly and inherit CSS styles. | Using emojis (🎨 🚀 ⚙️) for buttons, nav links, or headers. | Emojis look different on every browser/OS, cannot be colored dynamically, and are bad for screen readers. |
| **Vector Assets** | Use inline SVGs or custom icon fonts. | Raster PNG icons that pixelate on high-density Retina screens. | SVGs are crisp, lightweight, and adapt automatically to light/dark themes. |
| **No Layout-Shifting States** | Interaction states (hover, active, focus) must use opacity, background, transform, or box-shadow. | Modifying padding, border-width, or margin on hover which causes surrounding elements to jump. | Prevents page jitter and layout instability during interaction. |
| **Touch Target Minimum** | Minimum 44×44px interactive area for all clickable links and buttons. | Tiny text links or icon-only buttons clustered together. | Prevents mis-clicks and satisfies mobile touch accessibility standards. |
| **Image Aspect Ratios** | Reserve vertical space using aspect-ratio or wrappers while lazy-loading. | Loading images without dimensions, causing content to jump down once loaded. | Directly affects LCP and Cumulative Layout Shift (CLS) scores. |
| **Visible Focus Indicator** | Maintain clear outline rings on focus. | `outline: none` without a custom focus indicator replacement. | Vital for keyboard navigators who cannot see where their cursor is. |
| **Tabular Numbers** | Use monospaced numbers for tabular data and counters. | Standard proportional digits for numbers that change. | Prevents layout jitter in tables/timers as numbers update. |
| **Hover Fallback** | Ensure hover states are not required to complete tasks. | Critical navigation or options that are only revealed on hover. | Mobile users cannot hover; actions must be accessible via click/tap. |

---

## Pre-Delivery Checklist

Verify these items before finalizing any web interface code:

### Visual Quality & Layout
- [ ] No emojis used as structural UI icons.
- [ ] All icons come from a consistent icon family and stroke weight.
- [ ] Interaction states (hover, active, focus) do not cause layout reflow or shift surrounding content.
- [ ] Safe viewport boundaries are maintained; no layout elements trigger unwanted horizontal scrollbars.
- [ ] Aspect-ratio or dimension values are defined on all images to prevent layout shift.
- [ ] Tabular numbers (`tabular-nums`) are applied to dynamic data columns, prices, and timers.

### Interaction & Accessibility
- [ ] Touch targets are at least 44×44px on mobile breakpoints.
- [ ] Interactive elements provide hover/active visual feedback (150–300ms transition).
- [ ] Keyboard focus states are highly visible on all interactive elements.
- [ ] Modals, drawers, and dropdowns can be navigated and closed using a keyboard (`Tab`/`Esc`).
- [ ] Interactive icon-only elements have an explicit `aria-label`.
- [ ] long-form text column measure stays under 75 characters.
- [ ] The viewport meta tag permits zooming.

### Light/Dark Mode
- [ ] Text contrast meets WCAG AA standards (4.5:1 minimum) in both modes.
- [ ] Borders, dividers, and focus rings are distinct and visible in both themes.
- [ ] Modals use a distinct scrim overlay (typically 40-60% black) to separate content from the background.
- [ ] Colors are implemented using theme-aware design tokens/variables, not hardcoded hex strings.