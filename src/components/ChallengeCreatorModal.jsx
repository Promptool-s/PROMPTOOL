import { useState, useRef, useCallback } from 'react'
import { generateChallengeConfig } from '../services/aiChallengeService'

// ── File type helpers ────────────────────────────────────────────────────────

const CODE_EXTS = new Set(['js','jsx','ts','tsx','py','cs','java','cpp','c','cc','h','hpp','css','scss','html','xml','json','sql','sh','bash','rb','go','rs','php','swift','kt','vue','yaml','yml','toml','r','lua','dart','scala'])
const DOC_EXTS  = new Set(['txt','md','csv','log'])

function getExt(name = '') { return name.split('.').pop()?.toLowerCase() || '' }
function fileCategory(name) {
  const ext = getExt(name)
  if (CODE_EXTS.has(ext)) return 'code'
  if (DOC_EXTS.has(ext))  return 'document'
  return 'image'
}
const LANG_MAP = {
  js:'JavaScript', jsx:'JavaScript', ts:'TypeScript', tsx:'TypeScript',
  py:'Python', cs:'C#', java:'Java', cpp:'C++', c:'C', h:'C', hpp:'C++',
  css:'CSS', scss:'SCSS', html:'HTML', xml:'XML', json:'JSON', sql:'SQL',
  sh:'Shell', bash:'Shell', rb:'Ruby', go:'Go', rs:'Rust', php:'PHP',
  swift:'Swift', kt:'Kotlin', vue:'Vue', yaml:'YAML', yml:'YAML', toml:'TOML',
  r:'R', lua:'Lua', dart:'Dart', scala:'Scala',
}

// ── Very simple syntax highlighter (no external deps) ───────────────────────

const KEYWORDS = new Set([
  'abstract','as','async','await','base','bool','break','byte','case','catch',
  'char','checked','class','const','continue','decimal','default','delegate',
  'do','double','else','enum','event','explicit','extern','false','finally',
  'fixed','float','for','foreach','goto','if','implicit','import','in','int',
  'interface','internal','is','lock','long','namespace','new','null','object',
  'operator','out','override','params','private','protected','public','readonly',
  'ref','return','sbyte','sealed','short','sizeof','stackalloc','static','string',
  'struct','switch','this','throw','true','try','typeof','uint','ulong',
  'unchecked','unsafe','ushort','using','virtual','void','volatile','while',
  'def','from','lambda','nonlocal','pass','raise','with','yield','elif','except',
  'and','or','not','None','True','False','self','super',
  'let','var','function','const','export','default','typeof','instanceof','of',
  'extends','implements','interface','type','enum','namespace','module','declare',
  'fun','val','when','object','companion','data','sealed','open','override',
  'func','guard','struct','protocol','extension','where','typealias','inout',
  'package','import','extends','implements','throws','final','abstract','native',
])

function tokenizeLine(line) {
  const tokens = []
  let i = 0
  while (i < line.length) {
    // Line comment //
    if (line[i] === '/' && line[i+1] === '/') {
      tokens.push({ type: 'comment', val: line.slice(i) })
      break
    }
    // Hash comment #
    if (line[i] === '#') {
      tokens.push({ type: 'comment', val: line.slice(i) })
      break
    }
    // String " or '
    if (line[i] === '"' || line[i] === "'") {
      const q = line[i]
      let j = i + 1
      while (j < line.length && !(line[j] === q && line[j-1] !== '\\')) j++
      tokens.push({ type: 'string', val: line.slice(i, j + 1) })
      i = j + 1
      continue
    }
    // Number
    if (/\d/.test(line[i]) && (i === 0 || /\W/.test(line[i-1]))) {
      let j = i
      while (j < line.length && /[\d._]/.test(line[j])) j++
      tokens.push({ type: 'number', val: line.slice(i, j) })
      i = j
      continue
    }
    // Word / keyword
    if (/[a-zA-Z_$]/.test(line[i])) {
      let j = i
      while (j < line.length && /[\w$]/.test(line[j])) j++
      const word = line.slice(i, j)
      tokens.push({ type: KEYWORDS.has(word) ? 'keyword' : 'ident', val: word })
      i = j
      continue
    }
    // Punctuation / operator
    if (/[{}[\]().,;:=<>+\-*/%!&|^~?@]/.test(line[i])) {
      tokens.push({ type: 'punct', val: line[i] })
      i++
      continue
    }
    tokens.push({ type: 'plain', val: line[i] })
    i++
  }
  return tokens
}

const TOKEN_COLORS = {
  keyword: 'text-violet-300',
  string:  'text-emerald-300',
  comment: 'text-slate-500 italic',
  number:  'text-amber-300',
  punct:   'text-slate-400',
  ident:   'text-slate-100',
  plain:   'text-slate-300',
}

const CodeViewer = ({ code, language }) => {
  const lines = code.split('\n')
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-slate-900 font-mono text-xs leading-relaxed">
      {/* Lang badge */}
      <div className="absolute right-3 top-3 rounded-md bg-slate-700/80 px-2 py-0.5 text-[10px] font-semibold text-slate-300 backdrop-blur-sm z-10">
        {language || 'Code'}
      </div>
      <div className="h-full overflow-auto p-4">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="group hover:bg-white/5">
                <td className="select-none pr-4 text-right text-slate-600 group-hover:text-slate-500 w-[2.5rem] shrink-0 align-top">
                  {idx + 1}
                </td>
                <td className="whitespace-pre-wrap break-all align-top">
                  {tokenizeLine(line).map((tok, ti) => (
                    <span key={ti} className={TOKEN_COLORS[tok.type] || 'text-slate-100'}>
                      {tok.val}
                    </span>
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

// ── Content type cards ───────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  {
    id: 'image',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    label: { es: 'Imagen', en: 'Image' },
    desc: { es: 'Los participantes ven una imagen y deben adivinar el prompt que la generó.', en: 'Participants see an image and must guess the prompt that created it.' },
    accept: 'image/*',
    hint: { es: 'JPG, PNG, GIF, WebP', en: 'JPG, PNG, GIF, WebP' },
    bg: 'bg-violet-50', border: 'border-violet-300', icon_bg: 'bg-violet-100', icon_text: 'text-violet-600',
    active_border: 'border-violet-500', active_bg: 'bg-violet-50',
  },
  {
    id: 'code',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    label: { es: 'Código', en: 'Code' },
    desc: { es: 'Subí un archivo de código. Los participantes lo leen y describen qué hace.', en: 'Upload a code file. Participants read it and describe what it does.' },
    accept: '.js,.jsx,.ts,.tsx,.py,.cs,.java,.cpp,.c,.h,.css,.html,.xml,.json,.sql,.sh,.rb,.go,.rs,.php,.swift,.kt,.vue,.yaml,.yml,.toml,.r,.lua,.dart,.scala',
    hint: { es: '.cs, .py, .js, .ts, .java, .go y más', en: '.cs, .py, .js, .ts, .java, .go and more' },
    bg: 'bg-cyan-50', border: 'border-cyan-300', icon_bg: 'bg-cyan-100', icon_text: 'text-cyan-600',
    active_border: 'border-cyan-500', active_bg: 'bg-cyan-50',
  },
  {
    id: 'document',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    label: { es: 'Documento', en: 'Document' },
    desc: { es: 'Subí un texto. Los participantes lo leen y responden con un prompt de análisis.', en: 'Upload a text file. Participants read it and respond with an analysis prompt.' },
    accept: '.txt,.md,.csv,.log',
    hint: { es: '.txt, .md, .csv', en: '.txt, .md, .csv' },
    bg: 'bg-amber-50', border: 'border-amber-300', icon_bg: 'bg-amber-100', icon_text: 'text-amber-600',
    active_border: 'border-amber-500', active_bg: 'bg-amber-50',
  },
]

// ── Main component ────────────────────────────────────────────────────────────

const ChallengeCreatorModal = ({
  open,
  onClose,
  challengeForm,
  setChallengeForm,
  challengeImageFile,
  setChallengeImageFile,
  challengeImagePreview,
  setChallengeImagePreview,
  onSubmit,
  creatingChallenge,
  challengeStatus,
  lang,
  companyIndustry = 'marketing',
  isEditing = false,
}) => {
  const [aiPrompt, setAiPrompt] = useState('')
  const [generatingWithAI, setGeneratingWithAI] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [aiSuccess, setAiSuccess] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [codeContent, setCodeContent] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hintsOpen, setHintsOpen] = useState(false)
  const fileInputRef = useRef(null)

  const contentType = challengeForm.contentType || 'image'
  const selectedType = TYPE_OPTIONS.find(t => t.id === contentType) || TYPE_OPTIONS[0]

  if (!open) return null

  const set = (key, val) => setChallengeForm(prev => ({ ...prev, [key]: val }))
  const setHint = (i, val) => { const h = [...challengeForm.hints]; h[i] = val; set('hints', h) }

  const handleFile = (file) => {
    if (!file) return
    const cat = fileCategory(file.name)
    const ext = getExt(file.name)

    // If the file type doesn't match selected content type, auto-switch
    if (cat !== contentType) {
      set('contentType', cat)
    }

    setChallengeImageFile(file)

    if (cat === 'image') {
      setChallengeImagePreview(URL.createObjectURL(file))
      setCodeContent('')
    } else {
      // Read text content for code/doc files
      setChallengeImagePreview(null)
      const reader = new FileReader()
      reader.onload = (e) => setCodeContent(e.target.result || '')
      reader.readAsText(file)
    }
  }

  const handleGenerateWithAI = async () => {
    if (!aiPrompt.trim()) {
      setAiError(lang === 'en' ? 'Describe the challenge first.' : 'Describí el objetivo del desafío primero.')
      return
    }
    setGeneratingWithAI(true)
    setAiError(null)
    setAiSuccess(false)
    try {
      const config = await generateChallengeConfig({
        userPrompt: aiPrompt,
        companyIndustry,
      })
      setChallengeForm(prev => ({ ...prev, ...config }))
      setAiSuccess(true)
    } catch (err) {
      setAiError(err.message || (lang === 'en' ? 'Could not generate config.' : 'No se pudo generar la configuración.'))
    } finally {
      setGeneratingWithAI(false)
    }
  }

  const clearFile = (e) => {
    e.stopPropagation()
    setChallengeImageFile(null)
    setChallengeImagePreview(null)
    setCodeContent('')
  }

  const hasFile = !!challengeImageFile
  const isCode = contentType === 'code'
  const isDoc  = contentType === 'document'

  const inp = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white'
  const label = 'block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5'
  const diffColor = {
    Easy:   'text-emerald-600 bg-emerald-50 border-emerald-200',
    Medium: 'text-amber-600   bg-amber-50   border-amber-200',
    Hard:   'text-rose-600    bg-rose-50    border-rose-200',
  }

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[94vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isEditing
                ? (lang === 'en' ? 'Edit Challenge' : 'Editar Desafío')
                : (lang === 'en' ? 'Create Challenge' : 'Crear Desafío')}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {lang === 'en'
                ? '3 steps: choose type → upload content → configure'
                : '3 pasos: elegí tipo → subí contenido → configurá'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-6">

          {/* ── Step 1: Content type ── */}
          {!isEditing && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">1</span>
                <p className={label + ' mb-0'}>{lang === 'en' ? 'What type of challenge?' : '¿Qué tipo de desafío?'}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {TYPE_OPTIONS.map(opt => {
                  const isActive = contentType === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        set('contentType', opt.id)
                        setChallengeImageFile(null)
                        setChallengeImagePreview(null)
                        setCodeContent('')
                      }}
                      className={`flex flex-col items-start gap-2 rounded-2xl border-2 p-3.5 text-left transition ${
                        isActive
                          ? `${opt.active_border} ${opt.active_bg} shadow-sm`
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isActive ? opt.icon_bg : 'bg-slate-100'} ${isActive ? opt.icon_text : 'text-slate-500'} transition`}>
                        {opt.icon}
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
                          {opt.label[lang] || opt.label.es}
                        </p>
                        <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                          {opt.desc[lang] || opt.desc.es}
                        </p>
                      </div>
                      <p className={`text-[10px] font-medium ${isActive ? opt.icon_text : 'text-slate-400'}`}>
                        {opt.hint[lang] || opt.hint.es}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Step 2: File upload ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">2</span>
              <p className={label + ' mb-0'}>
                {isCode
                  ? (lang === 'en' ? 'Upload code file' : 'Subí el archivo de código')
                  : isDoc
                    ? (lang === 'en' ? 'Upload text file' : 'Subí el archivo de texto')
                    : (lang === 'en' ? 'Upload image' : 'Subí la imagen')}
                {' '}<span className="text-rose-400 normal-case font-normal">*</span>
              </p>
            </div>

            <div
              className={`relative rounded-2xl border-2 border-dashed transition cursor-pointer ${
                dragging ? 'border-violet-400 bg-violet-50' :
                hasFile ? 'border-slate-200 bg-slate-50' :
                'border-slate-200 hover:border-violet-300 hover:bg-slate-50'
              }`}
              style={{ minHeight: hasFile ? 0 : 140 }}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
              onClick={() => !hasFile && fileInputRef.current?.click()}
            >
              {hasFile ? (
                <div className="relative w-full">
                  {/* Image preview */}
                  {contentType === 'image' && challengeImagePreview && (
                    <img src={challengeImagePreview} alt="Preview" className="w-full max-h-56 rounded-2xl object-cover" />
                  )}
                  {/* Code preview */}
                  {(isCode || isDoc) && codeContent && (
                    <div style={{ height: 240 }}>
                      {isCode ? (
                        <CodeViewer
                          code={codeContent}
                          language={LANG_MAP[getExt(challengeImageFile?.name)] || 'Code'}
                        />
                      ) : (
                        <pre className="h-full w-full overflow-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-700 leading-relaxed font-mono border border-slate-200 whitespace-pre-wrap">
                          {codeContent}
                        </pre>
                      )}
                    </div>
                  )}
                  {/* File info bar */}
                  <div className={`flex items-center justify-between gap-3 px-3 py-2 ${(isCode || isDoc) ? 'rounded-b-2xl bg-slate-100 border-t border-slate-200' : 'absolute bottom-2 left-2 right-2 rounded-xl bg-black/50 backdrop-blur-sm'}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-lg shrink-0 ${isCode ? 'bg-cyan-100' : isDoc ? 'bg-amber-100' : 'bg-white/20'}`}>
                        {selectedType.icon && (
                          <span className={`${isCode ? 'text-cyan-600' : isDoc ? 'text-amber-600' : 'text-white'}`} style={{ transform: 'scale(0.6)' }}>
                            {selectedType.icon}
                          </span>
                        )}
                      </div>
                      <span className={`text-xs font-medium truncate ${(isCode || isDoc) ? 'text-slate-700' : 'text-white'}`}>
                        {challengeImageFile?.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${(isCode || isDoc) ? 'text-slate-600 hover:bg-slate-200' : 'text-white/90 hover:bg-white/20'}`}
                      >
                        {lang === 'en' ? 'Change' : 'Cambiar'}
                      </button>
                      <button type="button" onClick={clearFile}
                        className={`flex h-6 w-6 items-center justify-center rounded-full transition ${(isCode || isDoc) ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' : 'bg-black/50 text-white hover:bg-black/70'}`}
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${selectedType.icon_bg} ${selectedType.icon_text}`}>
                    {selectedType.icon}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-600">
                      {lang === 'en' ? 'Drop file or click to browse' : 'Arrastrá o hacé clic para elegir'}
                    </p>
                    <p className="text-xs mt-1">{selectedType.hint[lang] || selectedType.hint.es}</p>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={selectedType.accept}
                onChange={e => handleFile(e.target.files?.[0])}
                className="hidden"
              />
            </div>
          </div>

          {/* ── AI assistant ── */}
          <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white text-xs font-bold">✦</span>
              <p className="text-sm font-semibold text-violet-900">
                {lang === 'en' ? 'Auto-fill the form with AI' : 'Autocompletar el formulario con IA'}
              </p>
              <span className="ml-auto text-xs text-violet-500">{lang === 'en' ? 'Optional' : 'Opcional'}</span>
            </div>
            <p className="text-xs text-violet-700 leading-relaxed">
              {lang === 'en'
                ? 'Describe the challenge in your own words and the AI will suggest values for the fields below (difficulty, time limit, points, hints, evaluation, etc.). It only fills the form — you can edit everything before saving. Nothing is submitted yet.'
                : 'Describí el desafío con tus palabras y la IA sugiere valores para los campos de abajo (dificultad, tiempo, puntos, pistas, evaluación, etc.). Solo completa el formulario — podés editar todo antes de guardar. No se crea nada todavía.'}
            </p>
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder={lang === 'en'
                ? 'Describe the challenge goal. e.g. "Hard challenge — employees must identify the exact function parameters and return type, not just what the code does visually."'
                : 'Describí el objetivo del desafío. Ej: "Desafío difícil — los empleados deben identificar los parámetros exactos de la función y el tipo de retorno, no solo qué hace visualmente."'}
              className="w-full resize-none rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-400 placeholder:text-slate-400"
              rows={3}
            />
            {aiError && <p className="text-xs text-rose-600">{aiError}</p>}
            {aiSuccess && <p className="text-xs text-emerald-600 font-medium">{lang === 'en' ? 'Form filled — review the fields below.' : 'Formulario completado — revisá los campos de abajo.'}</p>}
            <button
              type="button"
              onClick={handleGenerateWithAI}
              disabled={generatingWithAI || !aiPrompt.trim()}
              className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-40 transition"
            >
              {generatingWithAI
                ? (lang === 'en' ? 'Generating...' : 'Generando...')
                : (lang === 'en' ? 'Auto-fill with AI →' : 'Autocompletar con IA →')}
            </button>
          </div>

          {/* ── Step 3: Challenge details ── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">3</span>
              <p className={label + ' mb-0'}>{lang === 'en' ? 'Challenge details' : 'Detalles del desafío'}</p>
            </div>

            <div className="space-y-4">
              {/* Answer key / prompt */}
              <div>
                <label className={label}>
                  {isCode
                    ? (lang === 'en' ? 'Answer key (what participants should write)' : 'Respuesta esperada (qué deben escribir)')
                    : isDoc
                      ? (lang === 'en' ? 'Answer key (ideal prompt about this document)' : 'Respuesta esperada (prompt ideal sobre el documento)')
                      : (lang === 'en' ? 'Original prompt (exact)' : 'Prompt original (exacto)')}
                  {' '}<span className="text-rose-400 normal-case font-normal">*</span>
                </label>
                <textarea
                  value={challengeForm.prompt}
                  onChange={e => set('prompt', e.target.value)}
                  placeholder={
                    isCode
                      ? (lang === 'en'
                          ? 'e.g. "A function that takes a user ID and returns the user object with their email and role. It handles null inputs by throwing InvalidArgumentException."'
                          : 'Ej: "Una función que recibe un ID de usuario y devuelve el objeto con email y rol. Lanza InvalidArgumentException si el input es nulo."')
                      : isDoc
                        ? (lang === 'en'
                            ? 'e.g. "Summarize this document in 3 bullet points focusing on the main risk factors and recommended mitigation strategies."'
                            : 'Ej: "Resumí este documento en 3 puntos clave enfocándote en los factores de riesgo principales y las estrategias de mitigación recomendadas."')
                        : (lang === 'en'
                            ? 'The exact prompt used to generate this image — participants try to recreate it.'
                            : 'El prompt exacto que generó esta imagen — los participantes intentan recrearlo.')}
                  className={`${inp} min-h-[80px] resize-none`}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={label}>{lang === 'en' ? 'Theme / topic' : 'Temática'} <span className="text-rose-400 normal-case font-normal">*</span></label>
                  <input
                    type="text"
                    value={challengeForm.theme}
                    onChange={e => set('theme', e.target.value)}
                    placeholder={
                      isCode ? (lang === 'en' ? 'e.g. C# LINQ, Python Django' : 'Ej: C# LINQ, Python Django') :
                      isDoc  ? (lang === 'en' ? 'e.g. Risk analysis, Sales report' : 'Ej: Análisis de riesgo, Informe de ventas') :
                               (lang === 'en' ? 'e.g. Product photo, UI design' : 'Ej: Foto de producto, Diseño UI')
                    }
                    className={inp}
                    required
                  />
                </div>
                <div>
                  <label className={label}>{lang === 'en' ? 'Difficulty' : 'Dificultad'}</label>
                  <div className="flex gap-2">
                    {['Easy', 'Medium', 'Hard'].map(d => (
                      <button key={d} type="button" onClick={() => set('difficulty', d)}
                        className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition ${
                          challengeForm.difficulty === d ? diffColor[d] : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        {lang === 'en' ? d : d === 'Easy' ? 'Fácil' : d === 'Hard' ? 'Difícil' : 'Medio'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className={label}>{lang === 'en' ? 'Instructions for participants' : 'Instrucciones para participantes'}</label>
                <textarea
                  value={challengeForm.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder={
                    isCode ? (lang === 'en'
                      ? 'What should they focus on? e.g. "Identify the function signature, its parameters and what exception it throws."'
                      : '¿En qué deben enfocarse? Ej: "Identificá la firma de la función, sus parámetros y qué excepción lanza."')
                    : isDoc ? (lang === 'en'
                      ? 'What should they focus on? e.g. "Summarize the main conclusions of this report in a prompt for GPT."'
                      : '¿En qué deben enfocarse? Ej: "Resumí las principales conclusiones de este informe en un prompt para GPT."')
                    : (lang === 'en'
                      ? 'What should participants focus on? e.g. "Pay attention to the lighting, style and foreground details."'
                      : '¿En qué deben enfocarse? Ej: "Prestá atención a la iluminación, el estilo y los detalles del primer plano."')
                  }
                  className={`${inp} min-h-[60px] resize-none`}
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* ── Custom AI evaluation ── */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-2">
            <div className="flex items-start gap-2">
              <svg className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3.5 3.5 0 01-4.95 0l-.346-.346z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900">{lang === 'en' ? 'Custom AI evaluation' : 'Evaluación personalizada'}</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {lang === 'en'
                    ? 'Tell the AI exactly what to look for. Leave empty for standard criteria.'
                    : 'Indicale a la IA exactamente qué evaluar. Dejalo vacío para criterios estándar.'}
                </p>
              </div>
            </div>
            <textarea
              value={challengeForm.evalInstructions}
              onChange={e => set('evalInstructions', e.target.value)}
              placeholder={
                isCode ? (lang === 'en'
                  ? 'e.g. "Award points only if the participant correctly identifies: (1) the return type, (2) all parameters, (3) the exception type. Partial credit for 2 out of 3."'
                  : 'Ej: "Puntuar solo si identifica correctamente: (1) el tipo de retorno, (2) todos los parámetros, (3) el tipo de excepción. Crédito parcial por 2 de 3."')
                : (lang === 'en'
                  ? 'e.g. "Reward technical specificity. Penalize generic descriptions that don\'t mention key visual elements."'
                  : 'Ej: "Premiá la especificidad técnica. Penalizá descripciones genéricas que no mencionan los elementos visuales clave."')
              }
              className="w-full resize-none rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 placeholder:text-slate-400"
              rows={3}
            />
          </div>

          {/* ── Settings (collapsed) ── */}
          <div className="rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setSettingsOpen(o => !o)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-2xl transition"
            >
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                {lang === 'en' ? 'Advanced settings' : 'Configuración avanzada'}
              </div>
              <svg className={`h-4 w-4 text-slate-400 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {settingsOpen && (
              <div className="border-t border-slate-200 p-4 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{lang === 'en' ? 'Time limit (sec)' : 'Tiempo límite (seg)'}</label>
                    <input type="number" value={challengeForm.timeLimit} min={30} max={600}
                      onChange={e => set('timeLimit', parseInt(e.target.value) || 180)} className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{lang === 'en' ? 'Max attempts' : 'Intentos máx'}</label>
                    <input type="number" value={challengeForm.maxAttempts} min={0} max={10}
                      onChange={e => set('maxAttempts', parseInt(e.target.value) || 0)} className={inp} />
                    <p className="text-[11px] text-slate-400 mt-1">0 = {lang === 'en' ? 'unlimited' : 'ilimitado'}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{lang === 'en' ? 'Min words' : 'Palabras mín'}</label>
                    <input type="number" value={challengeForm.minWords} min={5} max={50}
                      onChange={e => set('minWords', parseInt(e.target.value) || 10)} className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{lang === 'en' ? 'Points' : 'Puntos'}</label>
                    <input type="number" value={challengeForm.points} min={0} max={1000}
                      onChange={e => set('points', parseInt(e.target.value) || 100)} className={inp} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{lang === 'en' ? 'Visibility' : 'Visibilidad'}</label>
                    <select value={challengeForm.visibility} onChange={e => set('visibility', e.target.value)} className={inp}>
                      <option value="private">{lang === 'en' ? 'Private (team only)' : 'Privado (solo equipo)'}</option>
                      <option value="public">{lang === 'en' ? 'Public' : 'Público'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{lang === 'en' ? 'Evaluation mode' : 'Modo de evaluación'}</label>
                    <select value={challengeForm.evaluationMode} onChange={e => set('evaluationMode', e.target.value)} className={inp}>
                      <option value="standard">{lang === 'en' ? 'Standard' : 'Estándar'}</option>
                      <option value="strict">{lang === 'en' ? 'Strict (exact match)' : 'Estricto (coincidencia exacta)'}</option>
                      <option value="flexible">{lang === 'en' ? 'Flexible (partial credit)' : 'Flexible (crédito parcial)'}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Hints (collapsed) ── */}
          <div className="rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setHintsOpen(o => !o)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-2xl transition"
            >
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3.5 3.5 0 01-4.95 0l-.346-.346z" />
                </svg>
                {lang === 'en' ? 'Hints' : 'Pistas'}
                <span className="text-xs text-slate-400 font-normal">{lang === 'en' ? '(optional — unlocked progressively)' : '(opcional — se desbloquean progresivamente)'}</span>
              </div>
              <svg className={`h-4 w-4 text-slate-400 transition-transform ${hintsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {hintsOpen && (
              <div className="border-t border-slate-200 p-4 space-y-2">
                {challengeForm.hints.map((h, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">{i + 1}</span>
                    <input
                      type="text"
                      value={h}
                      onChange={e => setHint(i, e.target.value)}
                      placeholder={lang === 'en'
                        ? `Hint ${i + 1} (from vague to specific)`
                        : `Pista ${i + 1} (de vaga a específica)`}
                      className={inp}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Status ── */}
          {challengeStatus && (
            <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
              challengeStatus.includes('successfully') || challengeStatus.includes('correctamente')
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : challengeStatus.includes('...') || challengeStatus.includes('ando')
                  ? 'bg-blue-50 border border-blue-200 text-blue-700'
                  : 'bg-rose-50 border border-rose-200 text-rose-700'
            }`}>
              {challengeStatus}
            </div>
          )}

          {/* ── Actions ── */}
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
              {lang === 'en' ? 'Cancel' : 'Cancelar'}
            </button>
            <button type="submit" disabled={creatingChallenge}
              className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition">
              {creatingChallenge
                ? (lang === 'en' ? 'Saving...' : 'Guardando...')
                : isEditing
                  ? (lang === 'en' ? 'Save changes' : 'Guardar cambios')
                  : (lang === 'en' ? 'Create challenge' : 'Crear desafío')}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}

export default ChallengeCreatorModal
