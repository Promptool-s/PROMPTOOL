import { useEffect, useRef, useState } from 'react'

// ── File type detection ──────────────────────────────────────────────────────
const CODE_EXTS = new Set(['js','jsx','ts','tsx','py','cs','java','cpp','c','h','hpp','css','scss','html','xml','json','sql','sh','bash','rb','go','rs','php','swift','kt','vue','yaml','yml','toml','r','lua','dart','scala'])
const DOC_EXTS  = new Set(['txt','md','csv','log'])
const IMG_EXTS  = new Set(['jpg','jpeg','png','gif','webp','svg','bmp','ico','avif'])

const LANG_MAP = {
  js:'JavaScript', jsx:'JavaScript', ts:'TypeScript', tsx:'TypeScript',
  py:'Python', cs:'C#', java:'Java', cpp:'C++', c:'C', h:'C', hpp:'C++',
  css:'CSS', scss:'SCSS', html:'HTML', xml:'XML', json:'JSON', sql:'SQL',
  sh:'Shell', bash:'Shell', rb:'Ruby', go:'Go', rs:'Rust', php:'PHP',
  swift:'Swift', kt:'Kotlin', vue:'Vue', yaml:'YAML', yml:'YAML', toml:'TOML',
  r:'R', lua:'Lua', dart:'Dart', scala:'Scala',
}
const KEYWORDS = new Set(['abstract','as','async','await','base','bool','break','byte','case','catch','char','class','const','continue','decimal','default','do','double','else','enum','event','explicit','extern','false','finally','fixed','float','for','foreach','goto','if','implicit','import','in','int','interface','internal','is','lock','long','namespace','new','null','object','operator','out','override','params','private','protected','public','readonly','ref','return','sbyte','sealed','short','sizeof','static','string','struct','switch','this','throw','true','try','typeof','uint','ulong','unchecked','unsafe','ushort','using','virtual','void','volatile','while','def','from','lambda','nonlocal','pass','raise','with','yield','elif','except','and','or','not','None','True','False','self','super','let','var','function','export','default','typeof','instanceof','of','extends','implements','type','module','declare','fun','val','when','companion','data','sealed','open','func','guard','protocol','extension','typealias','inout','package','throws','final','abstract','native'])

function getExt(url = '') { return url.split('.').pop()?.toLowerCase().split('?')[0] || '' }
function getUrlCategory(url) {
  if (!url) return 'image'
  const ext = getExt(url)
  if (CODE_EXTS.has(ext)) return 'code'
  if (DOC_EXTS.has(ext))  return 'document'
  return 'image'
}

function tokenizeLine(line) {
  const tokens = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '/' && line[i+1] === '/') { tokens.push({ t:'comment', v: line.slice(i) }); break }
    if (line[i] === '#') { tokens.push({ t:'comment', v: line.slice(i) }); break }
    if (line[i] === '"' || line[i] === "'") {
      const q = line[i]; let j = i+1
      while (j < line.length && !(line[j] === q && line[j-1] !== '\\')) j++
      tokens.push({ t:'string', v: line.slice(i, j+1) }); i = j+1; continue
    }
    if (/\d/.test(line[i]) && (i === 0 || /\W/.test(line[i-1]))) {
      let j = i; while (j < line.length && /[\d._]/.test(line[j])) j++
      tokens.push({ t:'number', v: line.slice(i, j) }); i = j; continue
    }
    if (/[a-zA-Z_$]/.test(line[i])) {
      let j = i; while (j < line.length && /[\w$]/.test(line[j])) j++
      const w = line.slice(i, j)
      tokens.push({ t: KEYWORDS.has(w) ? 'keyword' : 'ident', v: w }); i = j; continue
    }
    if (/[{}[\]().,;:=<>+\-*/%!&|^~?@]/.test(line[i])) { tokens.push({ t:'punct', v: line[i] }); i++; continue }
    tokens.push({ t:'plain', v: line[i] }); i++
  }
  return tokens
}
const TC = { keyword:'#a78bfa', string:'#6ee7b7', comment:'#64748b', number:'#fcd34d', punct:'#94a3b8', ident:'#e2e8f0', plain:'#cbd5e1' }

const CodeView = ({ code, language }) => {
  const lines = code.split('\n')
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-slate-900 font-mono text-xs leading-relaxed">
      <div className="absolute right-3 top-3 rounded-md bg-slate-700/80 px-2 py-0.5 text-[10px] font-semibold text-slate-300 z-10 backdrop-blur-sm">
        {language || 'Code'}
      </div>
      <div className="h-full overflow-auto p-4">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-white/5 group">
                <td className="select-none pr-4 text-right text-slate-600 group-hover:text-slate-500 w-10 shrink-0 align-top">{idx+1}</td>
                <td className="whitespace-pre-wrap break-all align-top">
                  {tokenizeLine(line).map((tok, ti) => (
                    <span key={ti} style={{ color: TC[tok.t] }}>{tok.v}</span>
                  ))}
                  {line === '' && <span className="opacity-0">_</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const DocView = ({ content }) => (
  <div className="h-full overflow-auto rounded-xl bg-white border border-slate-200 p-5">
    <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-sans">{content}</pre>
  </div>
)

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

const ZOOM_HINT_KEY = 'pt_zoom_hint_seen'

const ImageCard = ({ mode, data, imageStatus, onPreviewChange, revealedPrompt = null, userId = null }) => {
  const [aspectRatio, setAspectRatio] = useState('4 / 3')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [zoomHintSeen, setZoomHintSeen] = useState(() => {
    try { return !!localStorage.getItem(ZOOM_HINT_KEY) } catch { return false }
  })
  const canvasRef = useRef(null)
  const watermarkedRef = useRef(false)
  const [fileContent, setFileContent] = useState('')
  const [fileLoading, setFileLoading] = useState(false)

  const urlCategory = getUrlCategory(data?.url_image)
  const isCodeFile = urlCategory === 'code'
  const isDocFile  = urlCategory === 'document'
  const isNonImage = isCodeFile || isDocFile

  // Fetch text content for code/doc challenges
  useEffect(() => {
    if (!isNonImage || !data?.url_image) { setFileContent(''); return }
    setFileLoading(true)
    fetch(data.url_image)
      .then(r => r.text())
      .then(text => setFileContent(text))
      .catch(() => setFileContent('// Could not load file content'))
      .finally(() => setFileLoading(false))
  }, [data?.url_image, isNonImage])

  const handleFirstHover = () => {
    if (zoomHintSeen) return
    setZoomHintSeen(true)
    try { localStorage.setItem(ZOOM_HINT_KEY, '1') } catch { /* silencioso */ }
  }

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
    // Code / document challenge
    if (imageStatus === 'ok' && isNonImage) {
      if (fileLoading) {
        return (
          <div className="flex h-full min-h-[300px] w-full items-center justify-center bg-slate-900 rounded-xl">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-cyan-400" />
          </div>
        )
      }
      const ext = getExt(data?.url_image)
      const language = LANG_MAP[ext] || 'Code'
      return (
        <div className="h-full min-h-[300px] w-full">
          {isCodeFile ? (
            <CodeView code={fileContent} language={language} />
          ) : (
            <DocView content={fileContent} />
          )}
          {revealedPrompt && (
            <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-1">Respuesta esperada</p>
              <p className="text-sm text-emerald-900 leading-relaxed select-none" onCopy={e => e.preventDefault()}>
                {revealedPrompt}
              </p>
            </div>
          )}
        </div>
      )
    }

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
                {/* Texto partido en spans individuales — imposible copiar como string continuo */}
                <p
                  className="text-sm text-slate-100 leading-relaxed font-medium select-none"
                  onCopy={e => e.preventDefault()}
                  onContextMenu={e => e.preventDefault()}
                  aria-label="Prompt original"
                >
                  "
                  {revealedPrompt.split('').map((char, i) => (
                    <span
                      key={i}
                      data-c=""
                      style={{ unicodeBidi: 'plaintext' }}
                    >{char}</span>
                  ))}
                  "
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Zoom hint — visible ring before first hover, hidden after */}
        {!revealedPrompt && imgLoaded && !zoomHintSeen && (
          <div className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-cyan-400/70 animate-pulse" />
        )}
        {!revealedPrompt && imgLoaded && !zoomHintSeen && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <div className="animate-bounce flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3.5 py-2 shadow-lg backdrop-blur-sm">
              <svg className="h-3.5 w-3.5 text-cyan-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
              <span className="text-[11px] font-semibold text-white">Tocá para ampliar</span>
            </div>
          </div>
        )}

        {/* Overlay hover — cubre toda la imagen */}
        {!revealedPrompt && imgLoaded && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-200 group-hover/img:bg-black/30 cursor-zoom-in"
            onClick={() => openPreview()}
            onMouseEnter={handleFirstHover}
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
