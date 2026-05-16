import { useState } from 'react'

const SLIDES = [
  {
    illustration: (
      <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="80" rx="10" fill="#f1f5f9"/>
        <rect x="8" y="8" width="52" height="64" rx="6" fill="#e2e8f0"/>
        <rect x="12" y="12" width="44" height="36" rx="4" fill="#94a3b8"/>
        <rect x="12" y="54" width="28" height="4" rx="2" fill="#cbd5e1"/>
        <rect x="12" y="62" width="20" height="4" rx="2" fill="#e2e8f0"/>
        <rect x="66" y="8" width="46" height="64" rx="6" fill="#ede9fe"/>
        <rect x="70" y="12" width="38" height="8" rx="2" fill="#ddd6fe"/>
        <rect x="70" y="24" width="38" height="4" rx="2" fill="#ddd6fe"/>
        <rect x="70" y="32" width="30" height="4" rx="2" fill="#ddd6fe"/>
        <rect x="70" y="54" width="38" height="14" rx="4" fill="#7c3aed"/>
        <text x="89" y="64" fontSize="6" fill="white" textAnchor="middle" fontFamily="sans-serif" fontWeight="bold">Evaluar</text>
      </svg>
    ),
    title: '¿Cómo funciona?',
    body: 'Ves una imagen generada por IA. Tenés que escribir el prompt que creés que la generó. Cuanto más parecido al original, más puntos.',
  },
  {
    illustration: (
      <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="80" rx="10" fill="#f1f5f9"/>
        <rect x="10" y="50" width="16" height="22" rx="3" fill="#ddd6fe"/>
        <rect x="30" y="38" width="16" height="34" rx="3" fill="#a78bfa"/>
        <rect x="50" y="28" width="16" height="44" rx="3" fill="#7c3aed"/>
        <rect x="70" y="18" width="16" height="54" rx="3" fill="#6d28d9"/>
        <rect x="90" y="10" width="16" height="62" rx="3" fill="#4c1d95"/>
        <text x="18" y="78" fontSize="5" fill="#94a3b8" textAnchor="middle" fontFamily="sans-serif">800</text>
        <text x="38" y="78" fontSize="5" fill="#94a3b8" textAnchor="middle" fontFamily="sans-serif">950</text>
        <text x="58" y="78" fontSize="5" fill="#94a3b8" textAnchor="middle" fontFamily="sans-serif">1100</text>
        <text x="78" y="78" fontSize="5" fill="#94a3b8" textAnchor="middle" fontFamily="sans-serif">1250</text>
        <text x="98" y="78" fontSize="5" fill="#94a3b8" textAnchor="middle" fontFamily="sans-serif">1400</text>
        <text x="60" y="8" fontSize="7" fill="#7c3aed" textAnchor="middle" fontFamily="sans-serif" fontWeight="bold">Tu ELO sube con cada acierto</text>
      </svg>
    ),
    title: 'El sistema ELO',
    body: 'Como en el ajedrez, tu ELO sube cuando acertás y baja cuando fallás. Ganar contra imágenes difíciles suma más. Empezás en 1000.',
  },
  {
    illustration: (
      <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="120" height="80" rx="10" fill="#f1f5f9"/>
        <rect x="8" y="20" width="32" height="42" rx="6" fill="#e0f2fe"/>
        <rect x="12" y="26" width="24" height="4" rx="2" fill="#7dd3fc"/>
        <rect x="12" y="34" width="18" height="4" rx="2" fill="#bae6fd"/>
        <text x="24" y="52" fontSize="6" fill="#0284c7" textAnchor="middle" fontFamily="sans-serif" fontWeight="bold">Diario</text>
        <rect x="44" y="20" width="32" height="42" rx="6" fill="#ede9fe"/>
        <rect x="48" y="26" width="24" height="4" rx="2" fill="#a78bfa"/>
        <rect x="48" y="34" width="18" height="4" rx="2" fill="#ddd6fe"/>
        <text x="60" y="52" fontSize="6" fill="#7c3aed" textAnchor="middle" fontFamily="sans-serif" fontWeight="bold">Rankeado</text>
        <rect x="80" y="20" width="32" height="42" rx="6" fill="#ecfdf5"/>
        <rect x="84" y="26" width="24" height="4" rx="2" fill="#6ee7b7"/>
        <rect x="84" y="34" width="18" height="4" rx="2" fill="#d1fae5"/>
        <text x="96" y="52" fontSize="5.5" fill="#059669" textAnchor="middle" fontFamily="sans-serif" fontWeight="bold">Challenge</text>
      </svg>
    ),
    title: 'Tres modos de juego',
    body: 'Diario para mantener tu racha, Rankeado para subir en el leaderboard global, y Challenge si sos parte de un equipo empresa.',
  },
]

const UserOnboarding = ({ onDone }) => {
  const [slide, setSlide] = useState(0)
  const isLast = slide === SLIDES.length - 1
  const { illustration, title, body } = SLIDES[slide]

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">

        {/* X para saltar */}
        <button
          onClick={onDone}
          className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          aria-label="Cerrar"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Ilustración */}
        <div className="h-40 w-full px-6 pt-6">
          {illustration}
        </div>

        {/* Contenido */}
        <div className="px-6 pb-6 pt-4 space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
          </div>

          {/* Dots */}
          <div className="flex justify-center gap-1.5 py-1">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                className={`h-1.5 rounded-full transition-all duration-200 ${i === slide ? 'w-5 bg-violet-500' : 'w-1.5 bg-slate-200'}`}
              />
            ))}
          </div>

          {/* Botón */}
          {isLast ? (
            <button
              onClick={onDone}
              className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition"
            >
              Empezar a jugar
            </button>
          ) : (
            <button
              onClick={() => setSlide(s => s + 1)}
              className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition"
            >
              Siguiente
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default UserOnboarding
