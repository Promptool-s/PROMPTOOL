import { useEffect, useState, useRef } from 'react'
import { api } from '../../lib/apiClient'
import { proxyImg } from '../../utils/imgProxy'
import { copy } from './landingCopy'

const Slide = ({ item, visible, isFirst }) => (
  <div className={`absolute inset-0 flex flex-col transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
    <div className="relative flex-1 overflow-hidden rounded-2xl select-none" onContextMenu={e => e.preventDefault()} onDragStart={e => e.preventDefault()}>
      <img
        src={proxyImg(item.url_image)}
        alt=""
        className="h-full w-full object-cover pointer-events-none"
        draggable={false}
        loading={isFirst ? 'eager' : 'lazy'}
        fetchpriority={isFirst ? 'high' : 'auto'}
      />
      <div className="absolute inset-0" onContextMenu={e => e.preventDefault()} />
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 to-transparent" />
    </div>
    <div className="mt-3 space-y-2 px-1 select-none" onCopy={e => e.preventDefault()}>
      <div className="flex items-center gap-2.5">
        {item.avatar_url
          ? <img src={proxyImg(item.avatar_url)} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-slate-900/10 pointer-events-none" draggable={false} />
          : <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-700">{(item.username || '?')[0].toUpperCase()}</div>
        }
        <span className="text-xs font-medium text-slate-600">{item.username || 'Anonymous'}</span>
        {item.is_dev && (
          <span className="rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 uppercase tracking-wide">DEV</span>
        )}
        {item.score != null && <span className="ml-auto rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs font-semibold text-cyan-700">{item.score}%</span>}
      </div>
      <p className="line-clamp-2 text-xs leading-5 text-slate-600 italic">"{item.prompt_usuario}"</p>
    </div>
  </div>
)

const Dots = ({ total, current, onSelect }) => (
  <div className="flex items-center justify-center gap-1.5 pt-1">
    {Array.from({ length: total }).map((_, i) => (
      <button key={i} onClick={() => onSelect(i)} aria-label={`Slide ${i + 1}`} aria-current={i === current}
        className={`rounded-full transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 focus-visible:outline-offset-2 ${i === current ? 'h-1.5 w-5 bg-cyan-600' : 'h-1.5 w-1.5 bg-slate-300 hover:bg-slate-400'}`} />
    ))}
  </div>
)

const CommunitySlideshow = ({ lang }) => {
  const [slides, setSlides] = useState([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef(null)
  const c = copy[lang]

  useEffect(() => {
    const fetch = async () => {
      try {
        // Selección (mejor por usuario, filtro de contenido, shuffle) server-side.
        const selectedSlides = await api.get('/intentos/comunidad', { auth: false })
        if (!Array.isArray(selectedSlides)) return

        setSlides(selectedSlides)

        // Preload first 3 images for faster display
        selectedSlides.slice(0, 3).forEach(slide => {
          const img = new Image()
          img.src = proxyImg(slide.url_image)
        })
      } catch (_) {}
      finally { setLoading(false) }
    }
    fetch()
  }, [])

  useEffect(() => {
    if (slides.length < 2) return
    timerRef.current = setInterval(() => setCurrent(p => (p + 1) % slides.length), 4500)
    return () => clearInterval(timerRef.current)
  }, [slides.length])

  const goTo = (i) => {
    clearInterval(timerRef.current)
    setCurrent(i)
    timerRef.current = setInterval(() => setCurrent(p => (p + 1) % slides.length), 4500)
  }

  if (loading) return <div className="flex h-full items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" /></div>
  if (!slides.length) return <div className="flex h-full items-center justify-center text-sm text-slate-500">{c.noSlides}</div>

  return (
    <div className="flex h-full flex-col" role="region" aria-roledescription="carousel" aria-label={c.community}>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{c.community}</p>
      <div className="relative flex-1">{slides.map((item, i) => <Slide key={i} item={item} visible={i === current} isFirst={i === 0} />)}</div>
      {slides.length > 1 && <Dots total={slides.length} current={current} onSelect={goTo} />}
    </div>
  )
}

export default CommunitySlideshow
