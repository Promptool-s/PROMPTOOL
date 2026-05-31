import GUIDE_LIBRARY from '../data/guides'
import { useLang } from '../contexts/LangContext'
import { guideArticlePath } from '../utils/guideRoutes'

const ACCENT_RING = {
  indigo: 'ring-indigo-200 bg-indigo-50',
  cyan: 'ring-cyan-200 bg-cyan-50',
  violet: 'ring-violet-200 bg-violet-50',
  amber: 'ring-amber-200 bg-amber-50',
  rose: 'ring-rose-200 bg-rose-50',
  emerald: 'ring-emerald-200 bg-emerald-50',
  slate: 'ring-slate-200 bg-slate-50',
  fuchsia: 'ring-fuchsia-200 bg-fuchsia-50',
  orange: 'ring-orange-200 bg-orange-50',
  red: 'ring-red-200 bg-red-50',
  teal: 'ring-teal-200 bg-teal-50',
  blue: 'ring-blue-200 bg-blue-50',
  lime: 'ring-lime-200 bg-lime-50',
}

const GuideCatalog = () => {
  const { lang } = useLang()

  return (
    <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 mb-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">
        {lang === 'en' ? 'Guide library' : 'Biblioteca de guías'}
      </h2>
      <p className="text-sm text-slate-500 mb-4 max-w-2xl">
        {lang === 'en'
          ? 'Each guide has its own page with the full lesson. Open any topic below.'
          : 'Cada guía tiene su propia página con la lección completa. Abrí cualquier tema.'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GUIDE_LIBRARY.map((guide) => {
          const accent = ACCENT_RING[guide.accent] || ACCENT_RING.slate
          const title = (lang === 'en' && guide.en?.title) ? guide.en.title : guide.title
          const summary = (lang === 'en' && guide.en?.summary) ? guide.en.summary : guide.summary
          return (
            <a
              key={guide.id}
              href={guideArticlePath(guide.id)}
              className={`block rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 transition hover:border-slate-300 hover:shadow-md ${accent} ring-1 ring-inset`}
            >
              <h3 className="text-sm font-bold text-slate-900 leading-snug">{title}</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                {summary}
              </p>
              <span className="mt-3 inline-flex text-xs font-semibold text-violet-600">
                {lang === 'en' ? 'Read guide →' : 'Leer guía →'}
              </span>
            </a>
          )
        })}
      </div>
    </section>
  )
}

export default GuideCatalog
