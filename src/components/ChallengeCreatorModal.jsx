import { useState, useRef } from 'react'
import { generateChallengeConfig } from '../services/aiChallengeService'

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
  const fileInputRef = useRef(null)

  if (!open) return null

  const set = (key, val) => setChallengeForm(prev => ({ ...prev, [key]: val }))
  const setHint = (i, val) => {
    const h = [...challengeForm.hints]
    h[i] = val
    set('hints', h)
  }

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setChallengeImageFile(file)
    setChallengeImagePreview(URL.createObjectURL(file))
  }

  const handleGenerateWithAI = async () => {
    if (!challengeImageFile || !aiPrompt.trim()) {
      setAiError(lang === 'en' ? 'Upload an image and describe the challenge first.' : 'Primero subí una imagen y describí el desafío.')
      return
    }
    setGeneratingWithAI(true)
    setAiError(null)
    setAiSuccess(false)
    try {
      const config = await generateChallengeConfig({ userPrompt: aiPrompt, imageFile: challengeImageFile, companyIndustry })
      setChallengeForm(prev => ({ ...prev, ...config }))
      setAiSuccess(true)
    } catch (err) {
      setAiError(err.message || (lang === 'en' ? 'Could not generate config.' : 'No se pudo generar la configuración.'))
    } finally {
      setGeneratingWithAI(false)
    }
  }

  const diffColor = { Easy: 'text-emerald-600 bg-emerald-50 border-emerald-200', Medium: 'text-amber-600 bg-amber-50 border-amber-200', Hard: 'text-rose-600 bg-rose-50 border-rose-200' }
  const inp = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white'
  const label = 'block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5'

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isEditing
                ? (lang === 'en' ? 'Edit Challenge' : 'Editar Desafío')
                : (lang === 'en' ? 'New Challenge' : 'Nuevo Desafío')}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {lang === 'en' ? 'Upload an image and configure how it gets evaluated' : 'Subí una imagen y configurá cómo se evalúa'}
            </p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-6">

          {/* ── Image upload ── */}
          <div>
            <p className={label}>{lang === 'en' ? 'Image' : 'Imagen'} <span className="text-rose-400 normal-case font-normal">*</span></p>
            <div
              className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition cursor-pointer
                ${dragging ? 'border-violet-400 bg-violet-50' : challengeImagePreview ? 'border-slate-200 bg-slate-50' : 'border-slate-200 hover:border-violet-300 hover:bg-slate-50'}`}
              style={{ minHeight: challengeImagePreview ? 0 : 140 }}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
              onClick={() => fileInputRef.current?.click()}
            >
              {challengeImagePreview ? (
                <div className="relative w-full">
                  <img src={challengeImagePreview} alt="Preview" className="w-full max-h-56 rounded-2xl object-cover" />
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setChallengeImageFile(null); setChallengeImagePreview(null) }}
                    className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <div className="absolute bottom-2 left-2 rounded-lg bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    {lang === 'en' ? 'Click to change' : 'Clic para cambiar'}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm font-medium">{lang === 'en' ? 'Drop image or click to upload' : 'Arrastrá o hacé clic para subir'}</p>
                  <p className="text-xs">{lang === 'en' ? 'JPG, PNG, GIF, WebP' : 'JPG, PNG, GIF, WebP'}</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={e => handleFile(e.target.files?.[0])} className="hidden" />
            </div>
          </div>

          {/* ── AI assistant ── */}
          {challengeImagePreview && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white text-xs">✦</span>
                <p className="text-sm font-semibold text-violet-900">
                  {lang === 'en' ? 'Fill with AI' : 'Completar con IA'}
                </p>
                <span className="ml-auto text-xs text-violet-500">{lang === 'en' ? 'Optional — fills the form below' : 'Opcional — completa el formulario'}</span>
              </div>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder={lang === 'en'
                  ? 'Describe the challenge goal. e.g. "Hard challenge about Processing code — employees must identify the exact code parameters, not just the visual style."'
                  : 'Describí el objetivo del desafío. Ej: "Desafío difícil sobre código Processing — los empleados deben identificar los parámetros exactos del código, no solo el estilo visual."'}
                className="w-full resize-none rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-400 placeholder:text-slate-400"
                rows={3}
              />
              {aiError && <p className="text-xs text-rose-600">{aiError}</p>}
              {aiSuccess && <p className="text-xs text-emerald-600 font-medium">{lang === 'en' ? 'Form filled — review and adjust below.' : 'Formulario completado — revisá y ajustá abajo.'}</p>}
              <button
                type="button"
                onClick={handleGenerateWithAI}
                disabled={generatingWithAI || !aiPrompt.trim()}
                className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-40 transition"
              >
                {generatingWithAI
                  ? (lang === 'en' ? 'Generating...' : 'Generando...')
                  : (lang === 'en' ? 'Generate with AI' : 'Generar con IA')}
              </button>
            </div>
          )}

          {/* ── Core fields ── */}
          <div className="space-y-4">
            <div>
              <label className={label}>{lang === 'en' ? 'Prompt (exact reference)' : 'Prompt (referencia exacta)'} <span className="text-rose-400 normal-case font-normal">*</span></label>
              <textarea
                value={challengeForm.prompt}
                onChange={e => set('prompt', e.target.value)}
                placeholder={lang === 'en'
                  ? 'The exact prompt that generates this image — or for code challenges, the code itself'
                  : 'El prompt exacto que genera esta imagen — o en desafíos de código, el código completo'}
                className={`${inp} min-h-[90px] resize-none`}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>{lang === 'en' ? 'Theme' : 'Temática'} <span className="text-rose-400 normal-case font-normal">*</span></label>
                <input type="text" value={challengeForm.theme} onChange={e => set('theme', e.target.value)}
                  placeholder={lang === 'en' ? 'e.g. Processing code, Product photo' : 'Ej: Código Processing, Foto de producto'}
                  className={inp} required />
              </div>
              <div>
                <label className={label}>{lang === 'en' ? 'Difficulty' : 'Dificultad'}</label>
                <div className="flex gap-2">
                  {['Easy', 'Medium', 'Hard'].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => set('difficulty', d)}
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
              <label className={label}>{lang === 'en' ? 'Description for participants' : 'Descripción para participantes'}</label>
              <textarea
                value={challengeForm.description}
                onChange={e => set('description', e.target.value)}
                placeholder={lang === 'en'
                  ? 'What should participants focus on? What type of knowledge is being tested?'
                  : '¿En qué deben enfocarse los participantes? ¿Qué tipo de conocimiento se está evaluando?'}
                className={`${inp} min-h-[70px] resize-none`}
                rows={2}
              />
            </div>
          </div>

          {/* ── Custom eval instructions ── */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-2">
            <div className="flex items-start gap-2">
              <svg className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3.5 3.5 0 01-4.95 0l-.346-.346z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900">{lang === 'en' ? 'Custom AI evaluation criteria' : 'Criterios de evaluación personalizados'}</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {lang === 'en'
                    ? 'Tell the AI what to look for when scoring. Leave empty to use standard criteria.'
                    : 'Indicale a la IA qué evaluar al puntuar. Dejalo vacío para usar los criterios estándar.'}
                </p>
              </div>
            </div>
            <textarea
              value={challengeForm.evalInstructions}
              onChange={e => set('evalInstructions', e.target.value)}
              placeholder={lang === 'en'
                ? 'e.g. "Score based on whether the participant correctly identifies the Processing sketch parameters: background color, circle size, strokeWeight, and noiseScale. Do not reward generic descriptions of the visual output — reward technical code knowledge only."'
                : 'Ej: "Evaluá si el participante identifica correctamente los parámetros del sketch de Processing: color de fondo, tamaño del círculo, strokeWeight y noiseScale. No premiés descripciones visuales genéricas — solo conocimiento técnico del código."'}
              className="w-full resize-none rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 placeholder:text-slate-400"
              rows={4}
            />
          </div>

          {/* ── Settings grid ── */}
          <div>
            <p className={label}>{lang === 'en' ? 'Settings' : 'Configuración'}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">{lang === 'en' ? 'Time (sec)' : 'Tiempo (seg)'}</label>
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
                <option value="standard">Standard</option>
                <option value="strict">{lang === 'en' ? 'Strict' : 'Estricto'}</option>
                <option value="flexible">{lang === 'en' ? 'Flexible' : 'Flexible'}</option>
              </select>
            </div>
          </div>

          {/* ── Hints ── */}
          <div>
            <p className={label}>{lang === 'en' ? 'Hints (optional)' : 'Pistas (opcional)'}</p>
            <div className="space-y-2">
              {challengeForm.hints.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">{i + 1}</span>
                  <input
                    type="text"
                    value={h}
                    onChange={e => setHint(i, e.target.value)}
                    placeholder={lang === 'en' ? `Hint ${i + 1} (progressively more specific)` : `Pista ${i + 1} (progresivamente más específica)`}
                    className={inp}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── Status ── */}
          {challengeStatus && (
            <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
              challengeStatus.includes('successfully') || challengeStatus.includes('correctamente')
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
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
