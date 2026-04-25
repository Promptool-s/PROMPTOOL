import { useEffect, useState } from 'react'

const ImageCard = ({ mode, data, imageStatus, onPreviewChange }) => {
  const [aspectRatio, setAspectRatio] = useState('4 / 3')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  const openPreview = () => { setPreviewOpen(true); onPreviewChange?.(true) }
  const closePreview = () => { 
    setPreviewOpen(false)
    onPreviewChange?.(false)
    // Forzar recarga de la imagen principal al cerrar el modal
    setImgLoaded(false)
    setTimeout(() => setImgLoaded(true), 50)
  }
  const imageUrl = data?.url_image || ''

  // Detectar aspect ratio cuando la imagen ya cargó en el <img> — sin doble request
  const handleLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target
    if (naturalWidth && naturalHeight) setAspectRatio(`${naturalWidth} / ${naturalHeight}`)
    setImgLoaded(true)
  }

  useEffect(() => {
    if (!imageUrl) return
    setImgLoaded(false)
    // Pequeño delay para asegurar que la imagen se recarga
    const timer = setTimeout(() => setImgLoaded(true), 10)
    return () => clearTimeout(timer)
  }, [imageUrl])

  useEffect(() => {
    if (!previewOpen) return
    const onKeyDown = (e) => e.key === 'Escape' && closePreview()
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [previewOpen])

  const renderContent = () => {
    if (imageStatus === 'loading') {
      // Si hay imagen anterior, mostrarla con shimmer encima mientras carga la nueva
      if (imageUrl) {
        return (
          <div className="group/img relative h-full w-full select-none">
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover pointer-events-none opacity-40"
              draggable={false}
            />
            <div className="absolute inset-0 animate-pulse bg-slate-200/20" />
          </div>
        )
      }
      return (
        <div className="h-full min-h-[240px] w-full animate-pulse bg-slate-200" />
      )
    }

    if (imageStatus === 'empty') {
      return (
        <div className="flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-3 p-6 text-center">
          <svg className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          <p className="text-sm font-semibold text-slate-700">No hay imágenes disponibles</p>
          <p className="text-xs text-slate-500">Intenta cambiar la dificultad en Configurar</p>
        </div>
      )
    }

    if (imageStatus === 'error') {
      return (
        <div className="flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-3 p-6 text-center">
          <svg className="h-12 w-12 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm font-semibold text-slate-700">Error de conexión</p>
          <p className="text-xs text-slate-500">Verifica tu conexión a Supabase</p>
        </div>
      )
    }

    // imageStatus === 'ok'
    return (
      <div className="group/img relative h-full w-full select-none">
        <img
          key={imageUrl} // Force re-render when URL changes
          src={imageUrl}
          alt="Imagen de referencia"
          className={`h-full w-full object-cover pointer-events-none transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          draggable={false}
          loading="eager"
          fetchpriority="high"
          decoding="async"
          onLoad={handleLoad}
          onError={() => setImgLoaded(false)}
        />
        {/* Overlay hover — cubre toda la imagen */}
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-200 group-hover/img:bg-black/30 cursor-zoom-in"
          onClick={() => openPreview()}
          onContextMenu={e => e.preventDefault()}
        >
          <div className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-200 scale-95 group-hover/img:opacity-100 group-hover/img:scale-100">
            <svg className="h-4 w-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
            <span className="text-sm font-medium text-slate-700">Ver imagen</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex w-full flex-col gap-6 text-left h-full">
        <div
          className="group relative w-full h-full overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/60"
        >
          {renderContent()}
        </div>
      </div>

      {previewOpen && imageStatus === 'ok' && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-[2px]"
          onClick={() => closePreview()}
          role="dialog"
          aria-modal="true"
          aria-label="Vista ampliada de la imagen"
        >
          <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
            <img
              src={imageUrl}
              alt="Imagen de referencia ampliada"
              className="max-h-[90vh] max-w-[92vw] rounded-xl object-contain select-none pointer-events-none"
              draggable={false}
            />
            {/* Capa de protección sobre el modal */}
            <div
              className="absolute inset-0 rounded-xl"
              onContextMenu={e => e.preventDefault()}
            />
            <button
              type="button"
              onClick={() => closePreview()}
              className="absolute right-3 top-3 z-10 text-3xl font-semibold leading-none text-white/95 transition hover:text-white"
              aria-label="Cerrar vista ampliada"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default ImageCard
