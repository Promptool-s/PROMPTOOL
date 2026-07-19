# Frontend Lead Agent Workspace

Este directorio contiene las reglas de automatización, metadatos y skills para el agente de desarrollo Front-End e interfaces interactivas.

## Uso

El agente se activará automáticamente al editar o consultar sobre archivos del ecosistema de React, Tailwind CSS, animaciones interactivas con GSAP, escenas 3D con Three.js/React Three Fiber, custom shaders GLSL, layouts híbridos HTML/WebGL, efectos tipográficos creativos (SplitText, variable fonts), o ecosistemas de smooth scroll (Lenis, ScrollSmoother).

## Estructura

```
frontend-lead/
├── AGENTS.md                  # Rol y workflow del agente orquestador
├── SKILL.md                   # Skill de orquestación principal
├── metadata.json              # Triggers, keywords y dependencias
├── README.md                  # Este archivo
└── rules/
    ├── gsap-core.md               # GSAP Core API
    ├── gsap-performance.md        # GSAP Performance
    ├── gsap-react.md              # GSAP + React integration
    ├── gsap-scrolltrigger.md      # GSAP ScrollTrigger
    ├── gsap-text-effects.md       # Creative Text Effects & Typography
    ├── gsap-timeline.md           # GSAP Timeline
    ├── motion-react-core.md       # Motion for React
    ├── smooth-scroll-ecosystem.md # Smooth Scroll (Lenis, ScrollSmoother)
    ├── ui-styling.md              # UI Styling & Design Systems
    ├── ui-ux-promax.md            # UI/UX Pro Max
    ├── three-core.md              # Three.js Core Architecture
    ├── r3f-shaders.md             # React Three Fiber & GLSL Shaders
    └── canvas-orchestration.md    # Canvas & Hybrid Layout Architecture
```

## Dominios

| Dominio | Reglas |
|---------|--------|
| React & UI | `ui-styling`, `ui-ux-promax` |
| Animaciones GSAP | `gsap-core`, `gsap-react`, `gsap-timeline`, `gsap-scrolltrigger`, `gsap-performance` |
| Efectos de Texto | `gsap-text-effects` |
| Smooth Scroll | `smooth-scroll-ecosystem` |
| Motion for React | `motion-react-core` |
| Three.js & 3D | `three-core`, `r3f-shaders`, `canvas-orchestration` |