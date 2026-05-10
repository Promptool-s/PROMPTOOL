import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const EnterpriseGuideContent = ({ guide, accent, ui, lang, user }) => {
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(false)

  // Load progress for this guide
  useEffect(() => {
    if (!guide?.id || !user?.id) return
    
    const loadProgress = async () => {
      try {
        const { data, error } = await supabase
          .from('guide_progress')
          .select('section_id, completed, data')
          .eq('guide_id', guide.id)
          .eq('user_id', user.id)
        
        if (error) throw error
        
        const progressMap = {}
        ;(data || []).forEach(item => {
          progressMap[item.section_id] = {
            completed: item.completed,
            data: item.data || {}
          }
        })
        setProgress(progressMap)
      } catch (error) {
        console.error('Error loading progress:', error)
      }
    }
    
    loadProgress()
  }, [guide?.id, user?.id])

  // Update progress
  const updateProgress = async (sectionId, completed = true, data = {}) => {
    if (!guide?.id || !user?.id) return
    
    setLoading(true)
    try {
      const { error } = await supabase.rpc('update_guide_progress', {
        guide_id: guide.id,
        section_id: sectionId,
        completed,
        data
      })
      
      if (error) throw error
      
      setProgress(prev => ({
        ...prev,
        [sectionId]: { completed, data }
      }))
    } catch (error) {
      console.error('Error updating progress:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!guide?.content) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="rounded-full bg-slate-100 p-3 mb-3 inline-block">
            <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-900 mb-1">
            {lang === 'en' ? 'No content available' : 'Sin contenido disponible'}
          </p>
          <p className="text-xs text-slate-500">
            {lang === 'en' ? 'This guide is still being prepared.' : 'Esta guía aún se está preparando.'}
          </p>
        </div>
      </div>
    )
  }

  const content = guide.content
  const hasLesson = content.lesson?.blocks?.length > 0
  const hasSteps = content.steps?.length > 0
  const hasCheckpoints = content.checkpoints?.length > 0
  const hasQuiz = content.quiz

  return (
    <div className="space-y-4">
      {/* Lesson content */}
      {hasLesson && (
        <div className={`rounded-[1.25rem] border bg-white p-4 ${accent.border}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${accent.text}`}>{ui.lesson}</p>
              <h4 className="mt-1 text-lg font-semibold text-slate-900">{content.lesson.title}</h4>
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white">
              <input
                type="checkbox"
                checked={progress.lesson?.completed || false}
                onChange={(e) => updateProgress('lesson', e.target.checked)}
                disabled={loading}
                className="h-4 w-4 accent-slate-900"
              />
              {ui.readLesson}
            </label>
          </div>

          <div className="mt-4 space-y-3">
            {content.lesson.blocks.map((block, idx) => (
              <div key={idx} className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-4">
                <h5 className="text-sm font-semibold text-slate-900 mb-2">{block.heading}</h5>
                {block.body && (
                  <p className="text-sm leading-relaxed text-slate-700 mb-3">{block.body}</p>
                )}
                {block.bullets?.length > 0 && (
                  <ul className="space-y-2">
                    {block.bullets.map((bullet, bulletIdx) => (
                      <li key={bulletIdx} className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm text-slate-700">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {content.lesson.takeaway && (
            <div className="mt-3 rounded-[1.1rem] border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{ui.keyIdea}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{content.lesson.takeaway}</p>
            </div>
          )}
        </div>
      )}

      {/* Quiz */}
      {hasQuiz && (
        <div className={`rounded-[1.25rem] border bg-white p-4 ${accent.border}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${accent.text}`}>{ui.quickCheck}</p>
              <h4 className="mt-1 text-lg font-semibold text-slate-900">{content.quiz.question}</h4>
            </div>
            {progress.quiz?.completed && (
              <div className="rounded-full px-3 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800">
                {ui.completed}
              </div>
            )}
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {content.quiz.options.map((option, idx) => {
              const isSelected = progress.quiz?.data?.selectedIndex === idx
              const isCorrect = content.quiz.correctIndex === idx
              const hasAnswered = progress.quiz?.completed
              
              let buttonClass = 'rounded-[1rem] border px-3 py-3 text-left text-sm font-semibold text-slate-800 transition '
              
              if (!hasAnswered) {
                buttonClass += 'border-slate-200 bg-slate-50 hover:bg-white cursor-pointer'
              } else if (isSelected && isCorrect) {
                buttonClass += 'border-emerald-200 bg-emerald-50 text-emerald-800'
              } else if (isSelected && !isCorrect) {
                buttonClass += 'border-rose-200 bg-rose-50 text-rose-800'
              } else if (isCorrect) {
                buttonClass += 'border-emerald-200 bg-white text-emerald-800'
              } else {
                buttonClass += 'border-slate-200 bg-white/60 text-slate-600'
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (!hasAnswered) {
                      updateProgress('quiz', true, { selectedIndex: idx })
                    }
                  }}
                  disabled={hasAnswered || loading}
                  className={buttonClass}
                >
                  {option}
                </button>
              )
            })}
          </div>

          {progress.quiz?.completed && content.quiz.explanation && (
            <div className="mt-3 rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{ui.why}</p>
              <p className="mt-1 text-sm text-slate-700">{content.quiz.explanation}</p>
            </div>
          )}
        </div>
      )}

      {/* Steps and Checkpoints */}
      <div className="grid gap-3 lg:grid-cols-2">
        {hasSteps && (
          <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{ui.steps}</p>
            <ol className="mt-3 space-y-2">
              {content.steps.map((step, idx) => (
                <li key={idx} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        {hasCheckpoints && (
          <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{ui.checkpoints}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {content.checkpoints.map((checkpoint, idx) => {
                const checkpointId = `checkpoint-${idx}`
                const isCompleted = progress[checkpointId]?.completed || false
                
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => updateProgress(checkpointId, !isCompleted)}
                    disabled={loading}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold transition-all duration-300 ${
                      isCompleted
                        ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                        : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {checkpoint}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default EnterpriseGuideContent