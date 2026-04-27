import { useEffect, useRef, useState } from 'react'

/**
 * Aplica un watermark invisible al canvas con el userId.
 * Usa esteganografía básica: modifica el bit menos significativo
 * del canal alpha de píxeles específicos para codificar el ID.
 * Imperceptible a simple vista pero detectable si se analiza la imagen.
 */
const applyInvisibleWatermark = (canvas, userId) => {
  if (!canvas || !userId) return
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    // Codificar userId como bits en el canal alpha de píxeles distribuidos
    const idBytes = Array.from(userId.slice(0, 32)).map(c => c.charCodeAt(0))
    const marker = [0x57, 0x4D] // "WM" como marcador de inicio

    let bitIndex = 0
    const allBytes = [...marker, ...idBytes]

    for (let byteIdx = 0; byteIdx < allBytes.length; byteIdx++) {
      const byte = allBytes[byteIdx]
      for (let bit = 7; bit >= 0; bit--) {
        // Píxel en posición distribuida (cada 17 píxeles para no ser obvio)
        const pixelIndex = (bitIndex * 17) % (data.length / 4)
        const alphaIndex = pixelIndex * 4 + 3

        if (alphaIndex < data.length) {
          // Modificar solo el LSB del canal alpha
          const bitValue = (byte >> bit) & 1
          data[alphaIndex] = (data[alphaIndex] & 0xFE) | bitValue
        }
        bitIndex++
      }
    }

    ctx.putImageData(imageData, 0, 0)
  } catch {
    // fail silently — no interrumpir la experiencia
  }
}

const ImageCard = ({ mode, data, imageStatus, onPreviewChange, revealedPrompt = null, userId = null }) => {
  const [aspectRatio, setAspectRatio] = useState('4 / 3')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const canvasRef = useRef(null)
  const watermarkedRef = useRef(false)

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

    // Aplicar watermark invisible si hay userId
    if (userId && canvasRef.current && !watermarkedRef.current) {
      try {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        canvas.width = e.target.naturalWidth
        canvas.height = e.target.naturalHeight
        ctx.drawImage(e.target, 0, 0)
        applyInvisibleWatermark(canvas, userId)
        watermarkedRef.current = true
      } catch { /* fail silently */ }
    }
  }

  useEffect(() => {
    if (!imageUrl) return
    setImgLoaded(false)
    watermarkedRef.current = false
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
      return (
        <div className="flex h-full min-h-[400px] w-full flex-col items-center justify-center gap-3 p-6 bg-slate-50 dark:bg-slate-900">
          {/* Spinner simple y limpio */}
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-cyan-500" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Cargando imagen...</p>
        </div>
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
        {/* Skeleton loader simple mientras la imagen carga */}
        {!imgLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-cyan-500" />
          </div>
        )}
        
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
        
        {/* Prompt original revelado - overlay en la parte inferior */}
        {revealedPrompt && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950/95 via-slate-950/90 to-transparent pt-12 pb-4 px-4 animate-in slide-in-from-bottom duration-500">
            <div className="flex items-start gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">Prompt original</p>
                <p className="text-sm text-slate-100 leading-relaxed font-medium">
                  "{revealedPrompt}"
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Overlay hover — cubre toda la imagen */}
        {!revealedPrompt && imgLoaded && (
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
        )}
      </div>
    )
  }

  return (
    <>
      {/* Canvas oculto para watermarking — nunca visible */}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
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
