import { useState } from 'react'
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
  companyIndustry = 'marketing'
}) => {
  const [creationMode, setCreationMode] = useState('manual') // 'manual' | 'ai'
  const [aiPrompt, setAiPrompt] = useState('')
  const [generatingWithAI, setGeneratingWithAI] = useState(false)
  const [aiError, setAiError] = useState(null)

  if (!open) return null

  const handleImageChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setChallengeImageFile(file)
    setChallengeImagePreview(URL.createObjectURL(file))
  }

  const handleGenerateWithAI = async () => {
    if (!challengeImageFile || !aiPrompt.trim()) {
      setAiError(lang === 'en' ? 'Upload an image and describe the challenge' : 'Sube una imagen y describe el desafío')
      return
    }

    setGeneratingWithAI(true)
    setAiError(null)

    try {
      const config = await generateChallengeConfig({
        userPrompt: aiPrompt,
        imageFile: challengeImageFile,
        companyIndustry
      })

      // Aplicar configuración generada
      setChallengeForm(prev => ({
        ...prev,
        ...config
      }))

      // Cambiar a modo manual para que puedan ajustar
      setCreationMode('manual')
      setAiError(null)
    } catch (error) {
      setAiError(error.message || (lang === 'en' ? 'Could not generate configuration' : 'No se pudo generar la configuración'))
    } finally {
      setGeneratingWithAI(false)
    }
  }

  const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white"
  const labelClass = "block text-sm font-semibold text-slate-700 mb-2"

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {lang === 'en' ? 'Create Challenge' : 'Crear Desafío'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {lang === 'en' ? 'Manual or AI-assisted' : 'Manual o asistido por IA'}
            </p>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Mode selector */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setCreationMode('manual')}
              className={`flex-1 rounded-xl border-2 px-4 py-3 text-left transition ${
                creationMode === 'manual'
                  ? 'border-violet-500 bg-violet-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <p className="font-semibold text-slate-900">✍️ {lang === 'en' ? 'Manual' : 'Manual'}</p>
              <p className="text-xs text-slate-500 mt-1">
                {lang === 'en' ? 'Configure everything yourself' : 'Configura todo manualmente'}
              </p>
            </button>
            <button
              type="button"
              onClick={() => setCreationMode('ai')}
              className={`flex-1 rounded-xl border-2 px-4 py-3 text-left transition ${
                creationMode === 'ai'
                  ? 'border-violet-500 bg-violet-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <p className="font-semibold text-slate-900">✨ {lang === 'en' ? 'AI Assistant' : 'Asistente IA'}</p>
              <p className="text-xs text-slate-500 mt-1">
                {lang === 'en' ? 'Let AI configure it for you' : 'Deja que la IA lo configure'}
              </p>
            </button>
          </div>

          {/* AI Mode */}
          {creationMode === 'ai' && (
            <div className="space-y-4 rounded-xl border-2 border-violet-200 bg-violet-50/50 p-6">
              <div>
                <label className={labelClass}>
                  {lang === 'en' ? '1. Upload Image' : '1. Subir Imagen'}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full text-sm"
                />
                {challengeImagePreview && (
                  <img src={challengeImagePreview} alt="Preview" className="mt-3 h-32 w-auto rounded-lg object-cover border border-slate-200" />
                )}
              </div>

              <div>
                <label className={labelClass}>
                  {lang === 'en' ? '2. Describe the Challenge' : '2. Describe el Desafío'}
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder={lang === 'en' 
                    ? 'Example: "Create a medium difficulty challenge about product photography for marketing teams. Focus on lighting and composition."'
                    : 'Ejemplo: "Crea un desafío de dificultad media sobre fotografía de productos para equipos de marketing. Enfócate en iluminación y composición."'}
                  className={`${inputClass} min-h-[100px] resize-none`}
                  rows={4}
                />
              </div>

              {aiError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
                  {aiError}
                </div>
              )}

              <button
                type="button"
                onClick={handleGenerateWithAI}
                disabled={generatingWithAI || !challengeImageFile || !aiPrompt.trim()}
                className="w-full rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingWithAI 
                  ? (lang === 'en' ? '✨ Generating...' : '✨ Generando...')
                  : (lang === 'en' ? '✨ Generate with AI' : '✨ Generar con IA')}
              </button>

              <p className="text-xs text-slate-500 text-center">
                {lang === 'en' 
                  ? 'AI will analyze the image and generate optimal settings. You can adjust them after.'
                  : 'La IA analizará la imagen y generará configuraciones óptimas. Podrás ajustarlas después.'}
              </p>
            </div>
          )}

          {/* Manual Mode */}
          {creationMode === 'manual' && (
            <form onSubmit={onSubmit} className="space-y-6">
              {/* Image Upload */}
              <div>
                <label className={labelClass}>
                  {lang === 'en' ? 'Image' : 'Imagen'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full text-sm"
                  required
                />
                {challengeImagePreview && (
                  <img src={challengeImagePreview} alt="Preview" className="mt-3 h-40 w-auto rounded-lg object-cover border border-slate-200" />
                )}
              </div>

              {/* Grid de campos principales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    {lang === 'en' ? 'Prompt' : 'Prompt'} <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={challengeForm.prompt}
                    onChange={e => setChallengeForm(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder={lang === 'en' ? 'The exact prompt that generates this image' : 'El prompt exacto que genera esta imagen'}
                    className={`${inputClass} min-h-[100px] resize-none`}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    {lang === 'en' ? 'Theme' : 'Temática'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={challengeForm.theme}
                    onChange={e => setChallengeForm(prev => ({ ...prev, theme: e.target.value }))}
                    placeholder={lang === 'en' ? 'e.g. Product Photography' : 'ej. Fotografía de Producto'}
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={labelClass}>
                  {lang === 'en' ? 'Description' : 'Descripción'}
                </label>
                <textarea
                  value={challengeForm.description}
                  onChange={e => setChallengeForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={lang === 'en' ? 'Brief description for participants' : 'Descripción breve para los participantes'}
                  className={`${inputClass} min-h-[80px] resize-none`}
                  rows={3}
                />
              </div>

              {/* Grid de configuración */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className={labelClass}>{lang === 'en' ? 'Difficulty' : 'Dificultad'}</label>
                  <select
                    value={challengeForm.difficulty}
                    onChange={e => setChallengeForm(prev => ({ ...prev, difficulty: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>{lang === 'en' ? 'Time (sec)' : 'Tiempo (seg)'}</label>
                  <input
                    type="number"
                    value={challengeForm.timeLimit}
                    onChange={e => setChallengeForm(prev => ({ ...prev, timeLimit: parseInt(e.target.value) || 180 }))}
                    min="30"
                    max="600"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>{lang === 'en' ? 'Max Attempts' : 'Intentos Máx'}</label>
                  <input
                    type="number"
                    value={challengeForm.maxAttempts}
                    onChange={e => setChallengeForm(prev => ({ ...prev, maxAttempts: parseInt(e.target.value) || 0 }))}
                    min="0"
                    max="10"
                    className={inputClass}
                  />
                  <p className="text-xs text-slate-400 mt-1">0 = {lang === 'en' ? 'unlimited' : 'ilimitado'}</p>
                </div>

                <div>
                  <label className={labelClass}>{lang === 'en' ? 'Min Words' : 'Palabras Mín'}</label>
                  <input
                    type="number"
                    value={challengeForm.minWords}
                    onChange={e => setChallengeForm(prev => ({ ...prev, minWords: parseInt(e.target.value) || 10 }))}
                    min="5"
                    max="50"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Grid de configuración avanzada */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>{lang === 'en' ? 'Points' : 'Puntos'}</label>
                  <input
                    type="number"
                    value={challengeForm.points}
                    onChange={e => setChallengeForm(prev => ({ ...prev, points: parseInt(e.target.value) || 100 }))}
                    min="0"
                    max="1000"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>{lang === 'en' ? 'Visibility' : 'Visibilidad'}</label>
                  <select
                    value={challengeForm.visibility}
                    onChange={e => setChallengeForm(prev => ({ ...prev, visibility: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="private">{lang === 'en' ? 'Private' : 'Privado'}</option>
                    <option value="public">{lang === 'en' ? 'Public' : 'Público'}</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>{lang === 'en' ? 'Evaluation' : 'Evaluación'}</label>
                  <select
                    value={challengeForm.evaluationMode}
                    onChange={e => setChallengeForm(prev => ({ ...prev, evaluationMode: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="standard">Standard</option>
                    <option value="strict">{lang === 'en' ? 'Strict' : 'Estricto'}</option>
                    <option value="flexible">{lang === 'en' ? 'Flexible' : 'Flexible'}</option>
                  </select>
                </div>
              </div>

              {/* Hints */}
              <div>
                <label className={labelClass}>{lang === 'en' ? 'Hints (optional)' : 'Pistas (opcional)'}</label>
                <div className="space-y-2">
                  {challengeForm.hints.map((hint, i) => (
                    <input
                      key={i}
                      type="text"
                      value={hint}
                      onChange={e => {
                        const newHints = [...challengeForm.hints]
                        newHints[i] = e.target.value
                        setChallengeForm(prev => ({ ...prev, hints: newHints }))
                      }}
                      placeholder={`${lang === 'en' ? 'Hint' : 'Pista'} ${i + 1}`}
                      className={inputClass}
                    />
                  ))}
                </div>
              </div>

              {challengeStatus && (
                <div className={`rounded-lg px-4 py-3 text-sm ${
                  challengeStatus.includes('successfully') || challengeStatus.includes('correctamente')
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-rose-50 border border-rose-200 text-rose-700'
                }`}>
                  {challengeStatus}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-slate-200 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {lang === 'en' ? 'Cancel' : 'Cancelar'}
                </button>
                <button
                  type="submit"
                  disabled={creatingChallenge}
                  className="flex-1 rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
                >
                  {creatingChallenge 
                    ? (lang === 'en' ? 'Creating...' : 'Creando...')
                    : (lang === 'en' ? 'Create Challenge' : 'Crear Desafío')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChallengeCreatorModal
