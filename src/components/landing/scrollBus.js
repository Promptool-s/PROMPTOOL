// Mutable scroll state shared between the DOM scroll world (Lenis / native)
// and the R3F frame loop. Written by scroll handlers, read inside useFrame —
// never routed through React state to avoid re-renders at scroll frequency.
export const scrollBus = {
  progress: 0, // 0..1 across the whole page
  velocity: 0, // Lenis velocity (0 with native scroll)
  section: 0, // active section index
  sections: 9,
}
