import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { scrollBus } from './scrollBus'

// Decorative background: sample prompts typing themselves inside floating
// glass cards. Pure DOM (no WebGL) — text stays crisp at any DPR, costs no
// GPU memory, and reduced-motion degrades to static cards for free.
// Typing mutates textContent through refs so React never re-renders per char.
//
// Scroll-reactive: cards drift with depth-based parallax + a velocity lag,
// and every section change fades each card out and retypes a fresh prompt
// (staggered), so the background visibly changes as you scroll.

const PROMPTS = {
  es: [
    'Un astronauta flotando en un mar de nubes rosadas, luz dorada de atardecer, estilo cinematográfico',
    'Retrato de un zorro con anteojos leyendo bajo una lámpara, acuarela, tonos cálidos',
    'Ciudad futurista construida sobre tortugas gigantes, niebla matinal, arte digital detallado',
    'Un faro en medio de una tormenta eléctrica violeta, olas gigantes, fotorrealista, gran angular',
    'Bosque de cristal iluminado por bioluminiscencia azul, partículas flotando, render 3D suave',
    'Gato naranja gigante agarrando la Vía Láctea, fotografía espacial, nebulosas de fondo',
    'Biblioteca infinita en espiral vista desde arriba, estilo Escher, blanco y dorado',
    'Robot vintage regando girasoles al amanecer, estilo Pixar, profundidad de campo',
    'Ballena volando entre montañas nevadas, realismo mágico, luz volumétrica',
    'Samurái contemplando un eclipse doble, silueta minimalista, tinta japonesa',
    'Mercado nocturno bajo la lluvia, letreros de neón reflejados en el pavimento, estilo anime',
    'Invernadero abandonado reclamado por la selva, rayos de sol entre vidrios rotos, ultra detallado',
  ],
  en: [
    'An astronaut floating in a sea of pink clouds, golden sunset light, cinematic style',
    'Portrait of a fox with glasses reading under a lamp, watercolor, warm tones',
    'Futuristic city built on giant turtles, morning fog, detailed digital art',
    'A lighthouse in a violet thunderstorm, giant waves, photorealistic, wide angle',
    'Crystal forest lit by blue bioluminescence, floating particles, soft 3D render',
    'Giant orange cat grabbing the Milky Way, space photography, nebulas in the background',
    'Infinite spiral library seen from above, Escher style, white and gold',
    'Vintage robot watering sunflowers at dawn, Pixar style, depth of field',
    'A whale flying between snowy mountains, magical realism, volumetric light',
    'Samurai watching a double eclipse, minimal silhouette, japanese ink',
    'Night market in the rain, neon signs reflected on wet pavement, anime style',
    'Abandoned greenhouse reclaimed by jungle, sunbeams through broken glass, ultra detailed',
  ],
}

// Sparse slots hugging the viewport edges so the content column breathes.
// depth drives opacity + parallax speed (1 = near: more opaque, moves more).
const DESKTOP_SLOTS = [
  { left: '3%', top: '16%', depth: 0.9, w: 300, tilt: -1.6, dur: 9, delay: 0.2 },
  { right: '3%', top: '30%', depth: 0.6, w: 260, tilt: 1.3, dur: 10.5, delay: 1.2 },
  { left: '4%', top: '64%', depth: 0.75, w: 270, tilt: 0.8, dur: 9.5, delay: 2.0 },
  { right: '5%', top: '76%', depth: 0.5, w: 240, tilt: -1.0, dur: 11, delay: 0.8 },
]

const MOBILE_SLOTS = [
  { left: '-5%', top: '16%', depth: 0.75, w: 210, tilt: -1.2, dur: 9, delay: 0.4 },
  { right: '-7%', top: '70%', depth: 0.55, w: 200, tilt: 1.1, dur: 10, delay: 1.4 },
]

const KEYFRAMES = `
.pt-hide{opacity:0}
@keyframes ptFloat{0%,100%{transform:translateY(0) rotate(var(--pt-tilt,0deg))}50%{transform:translateY(-16px) rotate(var(--pt-tilt,0deg))}}
@keyframes ptCaret{0%,45%{opacity:1}55%,100%{opacity:0}}
`

const TypedCard = ({ slot, index, getNext, animate, swapSignal }) => {
  const cardRef = useRef(null)
  const textRef = useRef(null)
  const advanceRef = useRef(null)

  useEffect(() => {
    const card = cardRef.current
    const span = textRef.current
    if (!card || !span) return
    if (!animate) {
      span.textContent = getNext()
      return
    }
    let timer = 0
    let alive = true
    // One pending timeout at a time: type → hold → fade → next prompt
    const cycle = () => {
      if (!alive) return
      const full = getNext()
      let i = 0
      span.textContent = ''
      card.classList.remove('pt-hide')
      const type = () => {
        if (!alive) return
        i += 1
        span.textContent = full.slice(0, i)
        if (i < full.length) timer = setTimeout(type, 30 + Math.random() * 35)
        else timer = setTimeout(hide, 4000)
      }
      const hide = () => {
        if (!alive) return
        card.classList.add('pt-hide')
        timer = setTimeout(cycle, 750)
      }
      type()
    }
    // Section changes call this to fade out early and retype a fresh prompt
    advanceRef.current = () => {
      if (!alive) return
      clearTimeout(timer)
      card.classList.add('pt-hide')
      timer = setTimeout(cycle, 550)
    }
    timer = setTimeout(cycle, slot.delay * 1000)
    return () => { alive = false; advanceRef.current = null; clearTimeout(timer) }
  }, [animate, getNext, slot.delay])

  // Staggered swap when the active section changes while scrolling
  useEffect(() => {
    if (!swapSignal || !animate) return
    const t = setTimeout(() => advanceRef.current?.(), index * 160)
    return () => clearTimeout(t)
  }, [swapSignal, animate, index])

  return (
    <div
      ref={cardRef}
      className={`rounded-xl border border-slate-900/[0.07] bg-white/80 px-4 py-3 shadow-lg shadow-sky-900/[0.06] transition-opacity duration-500 ${animate ? 'pt-hide' : ''}`}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
        <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
        <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-widest text-cyan-700/70">prompt</span>
      </div>
      <p className="min-h-[4.5em] font-mono text-[11px] leading-relaxed text-slate-600">
        <span ref={textRef} />
        {animate && (
          <span
            className="ml-0.5 inline-block h-3 w-[2px] translate-y-[2px] bg-cyan-600"
            style={{ animation: 'ptCaret 1.1s steps(1) infinite' }}
          />
        )}
      </p>
    </div>
  )
}

const PromptTypingField = ({ lang, animate = true, isMobile = false }) => {
  const slots = isMobile ? MOBILE_SLOTS : DESKTOP_SLOTS
  const wrapRefs = useRef([])
  const counterRef = useRef(0)
  const lastSectionRef = useRef(scrollBus.section)
  const [swapSignal, setSwapSignal] = useState(0)
  const prompts = PROMPTS[lang] || PROMPTS.es

  // Shared counter so no two visible cards draw the same prompt
  const getNext = useCallback(() => {
    const p = prompts[counterRef.current % prompts.length]
    counterRef.current += 1
    return p
  }, [prompts])

  // Depth-based parallax + velocity lag, driven by scrollBus on the shared
  // GSAP ticker. Also watches the active section to trigger prompt swaps.
  useEffect(() => {
    if (!animate) return
    const tick = () => {
      if (scrollBus.section !== lastSectionRef.current) {
        lastSectionRef.current = scrollBus.section
        setSwapSignal(s => s + 1)
      }
      const p = scrollBus.progress
      const lag = Math.max(-40, Math.min(40, scrollBus.velocity * 0.6))
      for (let i = 0; i < wrapRefs.current.length; i++) {
        const el = wrapRefs.current[i]
        const s = slots[i]
        if (!el || !s) continue
        const y = -p * (140 + s.depth * 260) + lag * s.depth
        el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`
      }
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [animate, slots])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <style>{KEYFRAMES}</style>
      {slots.map((slot, i) => (
        <div
          key={`${isMobile ? 'm' : 'd'}-${i}`}
          ref={el => { wrapRefs.current[i] = el }}
          className="absolute will-change-transform"
          style={{ left: slot.left, right: slot.right, top: slot.top, width: slot.w, opacity: 0.4 + slot.depth * 0.45 }}
        >
          <div
            style={animate
              ? { '--pt-tilt': `${slot.tilt}deg`, animation: `ptFloat ${slot.dur}s ease-in-out ${slot.delay}s infinite` }
              : { transform: `rotate(${slot.tilt}deg)` }}
          >
            <TypedCard slot={slot} index={i} getNext={getNext} animate={animate} swapSignal={swapSignal} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default PromptTypingField
