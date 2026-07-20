import { useEffect, useState, useRef } from 'react'

// ── Interactive Demo: auto-playing simulation of a real game round ─────────
const InteractiveDemo = ({ lang }) => {
  const [step, setStep] = useState(0)
  const [typedText, setTypedText] = useState('')
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0, visible: false })
  const [showComparison, setShowComparison] = useState(false)
  const [score, setScore] = useState(0)
  const [isClicking, setIsClicking] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const demoRef = useRef(null)

  // Imagen real opcional del desafío. Por defecto queda vacía → se muestra un
  // placeholder cósmico autocontenido (el valor anterior era un link a un
  // artículo, no una imagen, así que nunca se veía nada). Poné una URL real acá.
  const demoImage = ''
  const userPrompt = lang === 'es'
    ? 'Generame un gato naranja en el espacio agarrando la via lactea, que sea gigante'
    : 'Generate a giant orange cat in space grabbing the Milky Way'
  const targetScore = 73

  // Sugerencias de mejora
  const improvements = lang === 'en' ? [
    'Add more details about the cat\'s appearance (breed, fur color, expression)',
    'Specify the lighting style (cinematic, nebula glow, dramatic)',
    'Describe the scale and perspective (giant, cosmic, surreal)',
    'Mention the art style (photorealistic, digital art, illustration)'
  ] : [
    'Agrega más detalles sobre la apariencia del gato (raza, color del pelaje, expresión)',
    'Especifica el estilo de iluminación (cinematográfica, brillo de nebulosa, dramática)',
    'Describe la escala y perspectiva (gigante, cósmico, surrealista)',
    'Menciona el estilo artístico (fotorrealista, arte digital, ilustración)'
  ]

  // Intersection Observer para detectar cuando la demo es visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true)
        }
      },
      { threshold: 0.3 }
    )

    if (demoRef.current) {
      observer.observe(demoRef.current)
    }

    return () => observer.disconnect()
  }, [isVisible])

  // Reset y loop de animación
  useEffect(() => {
    if (!isVisible) return

    const resetTimer = setTimeout(() => {
      setStep(0)
      setTypedText('')
      setCursorPos({ x: 0, y: 0, visible: false })
      setShowComparison(false)
      setScore(0)
      setIsClicking(false)
    }, 18000)

    return () => clearTimeout(resetTimer)
  }, [step, isVisible])

  useEffect(() => {
    if (!isVisible) return

    if (step === 0) {
      const timer = setTimeout(() => setStep(1), 1000)
      return () => clearTimeout(timer)
    }

    if (step === 1) {
      if (typedText.length < userPrompt.length) {
        const timer = setTimeout(() => {
          setTypedText(userPrompt.slice(0, typedText.length + 1))
        }, 25)
        return () => clearTimeout(timer)
      } else {
        setTimeout(() => setStep(2), 400)
      }
    }

    if (step === 2) {
      setCursorPos({ x: 0, y: 0, visible: true })
      const timer = setTimeout(() => {
        setCursorPos({ x: 50, y: 100, visible: true })
        setTimeout(() => setStep(3), 600)
      }, 200)
      return () => clearTimeout(timer)
    }

    if (step === 3) {
      setIsClicking(true)
      setTimeout(() => {
        setIsClicking(false)
        setCursorPos({ x: 50, y: 100, visible: false })
        setTimeout(() => {
          setShowComparison(true)
          setStep(4)
        }, 100)
      }, 150)
    }

    if (step === 4) {
      if (score < targetScore) {
        const timer = setTimeout(() => {
          setScore(prev => Math.min(prev + 3, targetScore))
        }, 25)
        return () => clearTimeout(timer)
      }
    }
  }, [step, typedText, score, isVisible])

  return (
    <div ref={demoRef} className="rounded-2xl border border-slate-900/10 bg-white/70 p-6 shadow-sm shadow-slate-900/[0.03] backdrop-blur-md lg:p-8 relative overflow-hidden">
      <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">

        {/* Left: Image - altura fija para evitar estiramiento */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {lang === 'en' ? 'Today\'s Challenge' : 'Desafío de hoy'}
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-cyan-500/15 text-cyan-700 font-semibold">
              {lang === 'en' ? 'Daily' : 'Diario'}
            </span>
          </div>
          <div
            className="relative aspect-[3/4] rounded-xl overflow-hidden border border-slate-900/10 max-h-72 lg:max-h-80 mx-auto"
            style={{
              background:
                'radial-gradient(120% 80% at 28% 18%, rgba(251,146,60,0.45), transparent 55%),' +
                'radial-gradient(100% 90% at 78% 88%, rgba(124,58,237,0.5), transparent 60%),' +
                'linear-gradient(160deg, #0b1026, #1e1b4b 55%, #0b1026)',
            }}
          >
            {/* Campo de estrellas + banda de Vía Láctea — CSS puro, siempre renderiza */}
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'radial-gradient(1.5px 1.5px at 18% 24%, #fff, transparent),' +
                  'radial-gradient(1px 1px at 62% 38%, rgba(255,255,255,0.9), transparent),' +
                  'radial-gradient(1.5px 1.5px at 42% 72%, #fff, transparent),' +
                  'radial-gradient(1px 1px at 82% 62%, rgba(255,255,255,0.8), transparent),' +
                  'radial-gradient(1px 1px at 30% 54%, rgba(255,255,255,0.85), transparent),' +
                  'radial-gradient(1.5px 1.5px at 72% 20%, #fff, transparent),' +
                  'radial-gradient(1px 1px at 54% 88%, rgba(255,255,255,0.8), transparent)',
              }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{ background: 'linear-gradient(115deg, transparent 42%, rgba(199,210,254,0.18) 50%, transparent 58%)' }}
            />
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" aria-hidden="true" /> IA
            </span>
            {demoImage && (
              <img
                src={demoImage}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
                decoding="async"
                style={{ objectPosition: '50% 30%' }}
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
            )}
          </div>
        </div>

        {/* Right: Prompt input and comparison */}
        <div className="space-y-3" aria-live="polite">
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-500">
              {lang === 'en' ? 'Your prompt' : 'Tu prompt'}
            </span>
            <div className={`relative rounded-xl border border-slate-900/15 bg-white/90 p-2.5 ${showComparison ? 'min-h-[60px]' : 'min-h-[100px]'} transition-all duration-300`}>
              <p className="text-sm leading-relaxed text-slate-800">
                {typedText}
                {step === 1 && <span className="inline-block w-0.5 h-4 bg-cyan-600 animate-pulse ml-0.5" />}
              </p>
            </div>
          </div>

          {/* Submit button - solo visible antes del resultado */}
          {!showComparison && (
            <div className="relative">
              <button
                type="button"
                tabIndex={-1}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                  step >= 2
                    ? `bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30 ${isClicking ? 'scale-95 shadow-cyan-500/50' : 'scale-100'}`
                    : 'bg-slate-900/5 text-slate-400 cursor-not-allowed'
                }`}
                disabled={step < 2}
              >
                {lang === 'en' ? 'Submit prompt' : 'Enviar prompt'}
              </button>

              {/* Animated cursor */}
              {cursorPos.visible && (
                <div
                  className="absolute pointer-events-none transition-all duration-700 ease-out z-10"
                  style={{
                    left: `${cursorPos.x}%`,
                    top: `${cursorPos.y}%`,
                    transform: `translate(-25%, -25%) ${isClicking ? 'scale(0.9)' : 'scale(1)'}`
                  }}
                >
                  <svg className="w-6 h-6 drop-shadow-lg transition-transform" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5.5 3.5L18.5 12L11 13.5L8.5 20.5L5.5 3.5Z" fill="white" stroke="black" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M11 13.5L14.5 17" stroke="black" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* Comparison result */}
          {showComparison && (
            <div className="space-y-2.5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Score badge */}
              <div className={`rounded-xl border p-3 ${
                score >= 70
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-amber-500/30 bg-amber-500/10'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-semibold ${score >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {lang === 'en' ? 'Similarity Score' : 'Score de similitud'}
                  </span>
                  <span className={`text-2xl font-black tabular-nums ${score >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {score}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-900/10 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ease-out ${
                      score >= 70
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                        : 'bg-gradient-to-r from-amber-500 to-amber-400'
                    }`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>

              {/* Suggestions for improvement */}
              <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-3.5 h-3.5 text-cyan-600 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-xs font-semibold text-cyan-700">
                    {lang === 'en' ? 'How to improve' : 'Cómo mejorar'}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {improvements.map((improvement, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                      <span className="text-cyan-600 shrink-0 mt-0.5" aria-hidden="true">•</span>
                      <span className="text-slate-600">{improvement}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default InteractiveDemo
