import { useState } from 'react'

const SLIDES = [
  {
    emoji: '🖼️',
    title: '¿Qué es PrompTool?',
    body: 'Te mostramos una imagen generada por IA. Tu desafío es escribir el prompt que crees que la creó. Cuanto más parecido al original, más puntos.',
    highlight: 'Entrená tu ojo para leer imágenes de IA.',
  },
  {
    emoji: '⚡',
    title: '¿Cómo se puntúa?',
    body: 'Analizamos tu prompt con IA y lo comparamos con el original. Medimos palabras clave, estilo, iluminación y técnica. El resultado va del 0% al 100%.',
    highlight: 'Más del 93% = imagen "vencida", no vuelve a aparecer.',
  },
  {
    emoji: '🎮',
    title: 'Los modos de juego',
    body: 'Modo Diario para mantener la racha, Competitivo para subir en el ranking global, y si sos parte de una empresa, challenges personalizados de tu equipo.',
    highlight: 'Empezá en Easy y subí a Hard cuando te sientas listo.',
  },
]

const UserOnboarding = ({ onDone }) => {
  const [slide, setSlide] = useState(0)
  const isLast = slide === SLIDES.length - 1
  const current = SLIDES[slide]

  const finish = () => {
    onDone()
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden">
        {/* Top accent */}
        <div className="h-1 bg-gradient-to-r from-cyan-400 to-violet-500" />

        <div className="p-7 space-y-5">
          {/* Emoji */}
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-3xl">
            {current.emoji}
          </div>

          {/* Content */}
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900">{current.title}</h2>
            <p className="text-sm text-slate-500 leading-relaxed">{current.body}</p>
          </div>

          {/* Highlight pill */}
          <div className="rounded-xl bg-cyan-50 border border-cyan-100 px-4 py-2.5">
            <p className="text-xs font-semibold text-cyan-700">{current.highlight}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {!isLast ? (
              <>
                <button
                  onClick={finish}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm text-slate-500 hover:bg-slate-50 transition"
                >
                  Saltar
                </button>
                <button
                  onClick={() => setSlide(s => s + 1)}
                  className="flex-[2] rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition"
                >
                  Siguiente →
                </button>
              </>
            ) : (
              <button
                onClick={finish}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 py-3 text-sm font-semibold text-white hover:opacity-90 transition"
              >
                ¡Empezar a jugar!
              </button>
            )}
          </div>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-1.5 pb-5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-5 bg-slate-800' : 'w-1.5 bg-slate-200'}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default UserOnboarding
