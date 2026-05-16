import { useEffect, useMemo, useRef, useState } from 'react'
import GUIDE_LIBRARY from '../data/guides'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../supabaseClient'
import EnterpriseGuideContent from './EnterpriseGuideContent'

const ACCENTS = {
  indigo: { soft: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', pill: 'bg-indigo-100 text-indigo-800' },
  cyan: { soft: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', pill: 'bg-cyan-100 text-cyan-800' },
  violet: { soft: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', pill: 'bg-violet-100 text-violet-800' },
  amber: { soft: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', pill: 'bg-amber-100 text-amber-800' },
  rose: { soft: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', pill: 'bg-rose-100 text-rose-800' },
  emerald: { soft: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', pill: 'bg-emerald-100 text-emerald-800' },
  slate: { soft: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', pill: 'bg-slate-200 text-slate-800' },
  fuchsia: { soft: 'bg-fuchsia-50', border: 'border-fuchsia-200', text: 'text-fuchsia-700', pill: 'bg-fuchsia-100 text-fuchsia-800' },
  orange: { soft: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', pill: 'bg-orange-100 text-orange-800' },
  red: { soft: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', pill: 'bg-red-100 text-red-800' },
  teal: { soft: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', pill: 'bg-teal-100 text-teal-800' },
  blue: { soft: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', pill: 'bg-blue-100 text-blue-800' },
  lime: { soft: 'bg-lime-50', border: 'border-lime-200', text: 'text-lime-700', pill: 'bg-lime-100 text-lime-800' },
}

const shuffle = (arr) => {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const OrderDnD = ({ guideId, activity, accent = 'slate', onSolved, lang = 'es' }) => {
  const [pool, setPool] = useState(() => shuffle(activity.items))
  const [slots, setSlots] = useState(() => activity.solution.map(() => null))
  const [dragging, setDragging] = useState(null)
  const a = ACCENTS[accent] || ACCENTS.slate

  useEffect(() => {
    setPool(shuffle(activity.items))
    setSlots(activity.solution.map(() => null))
    setDragging(null)
  }, [guideId, activity.items, activity.solution])

  const isSolved = useMemo(() => slots.every((v, idx) => v === activity.solution[idx]), [slots, activity.solution])

  useEffect(() => {
    if (isSolved) onSolved?.()
  }, [isSolved, onSolved])

  const takeFromPool = (value) => setPool((prev) => prev.filter((v) => v !== value))
  const putBackToPool = (value) => setPool((prev) => [...prev, value])

  const onDragStart = (value, from) => {
    setDragging({ value, from })
  }

  const onDropSlot = (slotIndex) => {
    if (!dragging) return
    setSlots((prev) => {
      const next = [...prev]
      const existing = next[slotIndex]
      if (existing) {
        putBackToPool(existing)
      }
      next[slotIndex] = dragging.value
      return next
    })
    if (dragging.from === 'pool') takeFromPool(dragging.value)
    if (dragging.from?.startsWith('slot:')) {
      const fromIdx = Number(dragging.from.split(':')[1])
      setSlots((prev) => {
        const next = [...prev]
        if (fromIdx !== slotIndex) next[fromIdx] = null
        return next
      })
    }
    setDragging(null)
  }

  const onDropPool = () => {
    if (!dragging) return
    if (dragging.from?.startsWith('slot:')) {
      const fromIdx = Number(dragging.from.split(':')[1])
      setSlots((prev) => {
        const next = [...prev]
        const value = next[fromIdx]
        next[fromIdx] = null
        if (value) putBackToPool(value)
        return next
      })
    }
    setDragging(null)
  }

  return (
    <div className={`rounded-[1.25rem] border bg-white p-4 ${a.border}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${a.text}`}>{lang === 'en' ? 'Activity' : 'Actividad'}</p>
          <h4 className="mt-1 text-lg font-semibold text-slate-900">{activity.title}</h4>
          <p className="mt-1 text-sm text-slate-600">{activity.prompt}</p>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${isSolved ? 'bg-emerald-100 text-emerald-800' : a.pill}`}>
          {isSolved ? (lang === 'en' ? 'Completed' : 'Completado') : (lang === 'en' ? 'Drag & drop' : 'Arrastrá y soltá')}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className={`rounded-xl border p-3 ${a.border} ${a.soft}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 dark:text-slate-400">{lang === 'en' ? 'Order' : 'Orden'}</p>
          <div className="mt-2 space-y-2">
            {slots.map((value, idx) => {
              const correct = value ? value === activity.solution[idx] : null
              return (
                <div
                  key={`${guideId}-slot-${idx}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDropSlot(idx)}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 transition ${
                    value
                      ? correct
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50 dark:bg-[rgb(33_38_45)] dark:border-[rgb(48_54_61)]'
                      : 'border-dashed border-slate-200 bg-slate-50/60 dark:bg-[rgb(22_27_34)] dark:border-[rgb(48_54_61)]'
                  }`}
                >
                  <span className="text-xs font-semibold tabular-nums text-slate-400">{String(idx + 1).padStart(2, '0')}</span>
                  <div className="flex-1">
                    {value ? (
                      <div
                        draggable
                        onDragStart={() => onDragStart(value, `slot:${idx}`)}
                        className="cursor-grab rounded-lg bg-slate-800 dark:bg-slate-700 px-3 py-2 text-sm font-semibold text-white active:cursor-grabbing"
                      >
                        {value}
                      </div>
                    ) : (
                      <div className="rounded-lg px-3 py-2 text-sm text-slate-400">{lang === 'en' ? 'Drop here' : 'Soltá acá'}</div>
                    )}
                  </div>
                  {value && correct && <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">OK</span>}
                </div>
              )
            })}
          </div>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDropPool}
          className="rounded-xl border border-slate-200 dark:border-[rgb(48_54_61)] bg-slate-50 dark:bg-[rgb(22_27_34)] p-3"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 dark:text-slate-400">{lang === 'en' ? 'Pieces' : 'Piezas'}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pool.map((item) => (
              <div
                key={`${guideId}-pool-${item}`}
                draggable
                onDragStart={() => onDragStart(item, 'pool')}
                className="cursor-grab rounded-full border border-slate-200 dark:border-[rgb(61_68_77)] bg-white dark:bg-[rgb(33_38_45)] px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-200 shadow-sm transition hover:-translate-y-px active:cursor-grabbing"
              >
                {item}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">{lang === 'en' ? 'Tip: drag a piece back here to remove it from the order.' : 'Tip: arrastrá una pieza de vuelta acá para sacarla del orden.'}</p>
        </div>
      </div>
    </div>
  )
}

const safeJsonParse = (value, fallback) => {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

const useLocalStorageState = (key, initialValue) => {
  const [state, setState] = useState(() => {
    const raw = window.localStorage.getItem(key)
    return raw == null ? initialValue : safeJsonParse(raw, initialValue)
  })

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(state))
  }, [key, state])

  return [state, setState]
}

const MiniQuiz = ({ quiz, accent = 'slate', storageKey, onCorrect, lang = 'es' }) => {
  const a = ACCENTS[accent] || ACCENTS.slate
  const [picked, setPicked] = useLocalStorageState(storageKey, null)
  const isCorrect = picked != null ? picked === quiz.correctIndex : null

  useEffect(() => {
    if (isCorrect) onCorrect?.()
  }, [isCorrect, onCorrect])

  return (
    <div className={`rounded-[1.25rem] border bg-white p-4 ${a.border}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${a.text}`}>{lang === 'en' ? 'Quick check' : 'Chequeo rápido'}</p>
          <h4 className="mt-1 text-lg font-semibold text-slate-900">{quiz.question}</h4>
        </div>
        {isCorrect != null && (
          <div className={`rounded-full px-3 py-1 text-xs font-semibold ${isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
            {isCorrect ? (lang === 'en' ? 'Correct' : 'Correcto') : (lang === 'en' ? 'Almost' : 'Casi')}
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {quiz.options.map((opt, idx) => {
          const chosen = picked === idx
          const correct = quiz.correctIndex === idx
          const stateClass =
            picked == null
              ? 'border-slate-200 bg-slate-50 hover:bg-white'
              : chosen && correct
                ? 'border-emerald-200 bg-emerald-50'
                : chosen && !correct
                  ? 'border-rose-200 bg-rose-50'
                  : correct
                    ? 'border-emerald-200 bg-white'
                    : 'border-slate-200 bg-white/60'

          return (
            <button
              key={opt}
              type="button"
              onClick={() => setPicked(idx)}
              className={`rounded-[1rem] border px-3 py-3 text-left text-sm font-semibold text-slate-800 transition ${stateClass}`}
            >
              {opt}
            </button>
          )
        })}
      </div>

      {picked != null && quiz.explanation && (
        <div className="mt-3 rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{lang === 'en' ? 'Why' : 'Por qué'}</p>
          <p className="mt-1 text-sm text-slate-700">{quiz.explanation}</p>
        </div>
      )}
    </div>
  )
}

const getCompletionKey = (guideId, part) => `__${guideId}__::${part}`

const ParteBuilder = ({ accent = 'slate', lang = 'es' }) => {
  const a = ACCENTS[accent] || ACCENTS.slate
  const [persona, setPersona] = useState('Actua como director/a de fotografia')
  const [aim, setAim] = useState('Generar un prompt para una escena clara y realista')
  const [receptores, setReceptores] = useState('Para una imagen estilo editorial')
  const [tono, setTono] = useState('Sobrio y tecnico, con vocabulario visual')
  const [estructura, setEstructura] = useState('Devolve 1 prompt final y una lista breve de negativos')
  const [copied, setCopied] = useState(false)

  const built = `${persona}.\n\nObjetivo: ${aim}.\nReceptores: ${receptores}.\nTono: ${tono}.\nEstructura: ${estructura}.`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(built)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 900)
    } catch {
      // ignore
    }
  }

  return (
    <div className={`rounded-[1.25rem] border bg-white p-4 ${a.border}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${a.text}`}>{lang === 'en' ? 'Builder' : 'Constructor'}</p>
          <h4 className="mt-1 text-lg font-semibold text-slate-900">{lang === 'en' ? 'Build PARTE in 30 seconds' : 'Armá PARTE en 30 segundos'}</h4>
          <p className="mt-1 text-sm text-slate-600">{lang === 'en' ? 'Fill in short fields and get a usable prompt.' : 'Completá campos cortos y te devuelve una versión usable.'}</p>
        </div>
        <button
          type="button"
          onClick={copy}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${copied ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
        >
          {copied ? (lang === 'en' ? 'Copied' : 'Copiado') : (lang === 'en' ? 'Copy' : 'Copiar')}
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <label className="block">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Persona</p>
          <input value={persona} onChange={(e) => setPersona(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400" />
        </label>
        <label className="block">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Aim</p>
          <input value={aim} onChange={(e) => setAim(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400" />
        </label>
        <label className="block">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Receptores</p>
          <input value={receptores} onChange={(e) => setReceptores(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400" />
        </label>
        <label className="block">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tono</p>
          <input value={tono} onChange={(e) => setTono(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400" />
        </label>
        <label className="block lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Estructura</p>
          <input value={estructura} onChange={(e) => setEstructura(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400" />
        </label>
      </div>

      <div className="mt-3 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Salida</p>
        <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-white px-3 py-3 text-sm text-slate-800">{built}</pre>
      </div>
    </div>
  )
}

const GuidesSection = ({ recommendedGuideIds = [], companyAssignments = [] }) => {
  const { lang } = useLang()
  const { user } = useAuth()
  const recommendedSet = new Set(recommendedGuideIds)
  // IDs de guías del catálogo asignadas por la empresa
  const companyAssignedIds = new Set(
    companyAssignments.filter(a => a.guide_id && a.guide_id !== 'custom').map(a => a.guide_id)
  )
  // Guías personalizadas de la empresa (convertidas a objetos compatibles con el renderizador)
  const customCompanyGuides = companyAssignments
    .filter(a => a.guide_id === 'custom')
    .map(a => {
      const d = a.custom_guide_data || {}
      return {
        id: `custom-${a.id}`,
        title: d.title || a.custom_title || (lang === 'en' ? 'Company guide' : 'Guía de empresa'),
        summary: d.summary || a.custom_body || '',
        accent: d.accent || 'violet',
        _isCustom: true,
        _customUrl: d.custom_url || a.custom_url || null,
        _note: a.note || null,
        _dueDate: a.due_date || null,
        // Estructura completa de guía
        lesson: d.lesson || null,
        steps: d.steps || [],
        drills: d.drills || [],
        checkpoints: d.checkpoints || [],
      }
    })

  // UI strings
  const ui = {
    library:        lang === 'en' ? 'Library'          : 'Biblioteca',
    guides:         lang === 'en' ? 'Guides'           : 'Guías',
    selected:       lang === 'en' ? 'Selected guide'   : 'Guía seleccionada',
    progress:       lang === 'en' ? 'Progress'         : 'Progreso',
    lesson:         lang === 'en' ? 'Lesson'           : 'Lección',
    readLesson:     lang === 'en' ? 'I read the lesson': 'Leí la lección',
    card:           lang === 'en' ? 'Card'             : 'Tarjeta',
    of:             lang === 'en' ? 'of'               : 'de',
    open:           lang === 'en' ? 'Open'             : 'Abrir',
    close:          lang === 'en' ? 'Close'            : 'Cerrar',
    keyIdea:        lang === 'en' ? 'Key idea'         : 'Idea clave',
    activity:       lang === 'en' ? 'Activity'         : 'Actividad',
    completed:      lang === 'en' ? 'Completed'        : 'Completado',
    dragDrop:       lang === 'en' ? 'Drag & drop'      : 'Arrastra y suelta',
    order:          lang === 'en' ? 'Order'            : 'Orden',
    pieces:         lang === 'en' ? 'Pieces'           : 'Piezas',
    dropHere:       lang === 'en' ? 'Drop here'        : 'Suelta acá',
    dragTip:        lang === 'en' ? 'Tip: drag a piece back here to remove it from the order.' : 'Tip: arrastrá una pieza de vuelta acá para sacarla del orden.',
    quickCheck:     lang === 'en' ? 'Quick check'      : 'Chequeo rápido',
    correct:        lang === 'en' ? 'Correct'          : 'Correcto',
    almost:         lang === 'en' ? 'Almost'           : 'Casi',
    why:            lang === 'en' ? 'Why'              : 'Por qué',
    builder:        lang === 'en' ? 'Builder'          : 'Constructor',
    builderTitle:   lang === 'en' ? 'Build PARTE in 30 seconds' : 'Armá PARTE en 30 segundos',
    builderDesc:    lang === 'en' ? 'Fill in short fields and get a usable prompt.' : 'Completá campos cortos y te devuelve una versión usable.',
    copy:           lang === 'en' ? 'Copy'             : 'Copiar',
    copied:         lang === 'en' ? 'Copied'           : 'Copiado',
    output:         lang === 'en' ? 'Output'           : 'Salida',
    steps:          lang === 'en' ? 'Steps'            : 'Pasos',
    drills:         lang === 'en' ? 'Drills'           : 'Ejercicios',
    checkpoints:    lang === 'en' ? 'Checklist'        : 'Completar',
    recommended:    lang === 'en' ? 'Recommended'      : 'Recomendada',
    locked:         lang === 'en' ? 'Activity locked'  : 'Actividad bloqueada',
    lockedDesc:     lang === 'en' ? 'Mark "I read the lesson" above first. The idea: understand before practicing.' : 'Marcá "Leí la lección" arriba primero. La idea: entender antes de practicar.',
  }
  const [selectedId, setSelectedId] = useState(GUIDE_LIBRARY[0]?.id)
  const [doneMap, setDoneMap] = useLocalStorageState('promptool_guides_done', {})
  const [lessonAckMap, setLessonAckMap] = useLocalStorageState('promptool_guides_lesson_ack', {})
  const [openLessonBlock, setOpenLessonBlock] = useState(null)
  const contentRef = useRef(null)
  const internalHashUpdateRef = useRef(false)
  
  // Enterprise guides state
  const [enterpriseGuides, setEnterpriseGuides] = useState([])
  const [loadingEnterpriseGuides, setLoadingEnterpriseGuides] = useState(false)
  const [activeSection, setActiveSection] = useState('library') // 'library' | 'enterprise'
  const sidebarRef = useRef(null)
  const rightHeaderRef = useRef(null)
  const [panelMaxHeight, setPanelMaxHeight] = useState(null)

  // Fetch assigned enterprise guides
  const fetchAssignedEnterpriseGuides = async (userId) => {
    if (!userId) return
    setLoadingEnterpriseGuides(true)
    try {
      const { data, error } = await supabase
        .from('guide_assignments')
        .select(`
          *,
          enterprise_guides (
            id,
            title,
            summary,
            content,
            accent,
            keywords,
            status,
            created_at
          )
        `)
        .eq('assigned_to', userId)
        .eq('status', 'assigned')
      
      if (error) throw error
      
      // Transform the data to match the expected format
      const guides = (data || []).map(assignment => ({
        ...assignment.enterprise_guides,
        assignment_id: assignment.id,
        assigned_by: assignment.assigned_by,
        due_date: assignment.due_date,
        notes: assignment.notes,
        assignment_status: assignment.status
      }))
      
      setEnterpriseGuides(guides)
    } catch (error) {
      console.error('Error fetching enterprise guides:', error)
      setEnterpriseGuides([])
    } finally {
      setLoadingEnterpriseGuides(false)
    }
  }

  // Handle enterprise guide URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const enterpriseGuideId = urlParams.get('enterprise_guide')
    
    if (enterpriseGuideId && enterpriseGuides.length > 0) {
      const guide = enterpriseGuides.find(g => g.id === enterpriseGuideId)
      if (guide) {
        setSelectedId(guide.id)
        setActiveSection('enterprise')
        // Mark notification as read if it exists
        markNotificationAsRead(enterpriseGuideId)
      }
    }
  }, [enterpriseGuides])

  // Fetch assigned guides when user logs in
  useEffect(() => {
    if (user?.id) {
      fetchAssignedEnterpriseGuides(user.id)
      // Also check for new notifications
      checkForNewGuideNotifications(user.id)
    }
  }, [user?.id])

  // Mark notification as read
  const markNotificationAsRead = async (guideId) => {
    if (!user?.id) return
    
    try {
      await supabase
        .from('guide_suggestions')
        .update({ read_at: new Date().toISOString() })
        .eq('target_user_id', user.id)
        .like('guide_url', `%${guideId}%`)
        .is('read_at', null)
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  // Check for new guide notifications
  const checkForNewGuideNotifications = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('guide_suggestions')
        .select('*')
        .eq('target_user_id', userId)
        .is('read_at', null)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      // If there are unread notifications, you could show a toast or update UI
      if (data && data.length > 0) {
        console.log(`${data.length} new guide notifications`)
        // You could add a toast notification here
      }
    } catch (error) {
      console.error('Error checking notifications:', error)
    }
  }

  const selectFromHash = () => {
    const raw = window.location.hash || ''
    const match = raw.match(/^#guia-(.+)$/)
    const id = match?.[1]
    if (!id) return false

    // Check if it's a library guide
    if (GUIDE_LIBRARY.some((g) => g.id === id)) {
      setSelectedId(id)
      setActiveSection('library')
      return true
    }
    
    // Check if it's an enterprise guide
    if (enterpriseGuides.some((g) => g.id === id)) {
      setSelectedId(id)
      setActiveSection('enterprise')
      return true
    }
    
    return false
  }

  // Catálogo completo: guías del catálogo + guías custom de empresa
  const allGuides = [...GUIDE_LIBRARY, ...customCompanyGuides]

  const selectGuide = (id) => {
    // Check if it's a library guide
    if (GUIDE_LIBRARY.some((g) => g.id === id)) {
      setSelectedId((prev) => {
        if (prev === id) return prev
        return id
      })
      setActiveSection('library')
      const desired = `#guia-${id}`
      if (window.location.hash !== desired) {
        internalHashUpdateRef.current = true
        window.history.replaceState(null, '', desired)
      }
      return
    }

    // Check if it's an enterprise guide
    if (enterpriseGuides.some((g) => g.id === id)) {
      setSelectedId((prev) => {
        if (prev === id) return prev
        return id
      })
      setActiveSection('enterprise')
      const desired = `#guia-${id}`
      if (window.location.hash !== desired) {
        internalHashUpdateRef.current = true
        window.history.replaceState(null, '', desired)
      }
      return
    }
  }

  useEffect(() => {
    const preferred = recommendedGuideIds?.[0]
    if (selectFromHash()) return
    
    // If there are enterprise guides and no hash, show the first enterprise guide
    if (enterpriseGuides.length > 0 && !preferred) {
      setSelectedId(enterpriseGuides[0].id)
      setActiveSection('enterprise')
      return
    }
    
    // Otherwise, show preferred library guide or first library guide
    if (preferred) selectGuide(preferred)
    else if (GUIDE_LIBRARY.length > 0) {
      setSelectedId(GUIDE_LIBRARY[0].id)
      setActiveSection('library')
    }
  }, [recommendedGuideIds, enterpriseGuides])

  useEffect(() => {
    const onHashChange = () => {
      if (internalHashUpdateRef.current) {
        internalHashUpdateRef.current = false
        return
      }
      selectFromHash()
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setOpenLessonBlock(null)
  }, [selectedId])

  useEffect(() => {
    if (!sidebarRef.current) return

    const update = () => {
      const rect = sidebarRef.current?.getBoundingClientRect?.()
      if (!rect?.height) return
      const headerRect = rightHeaderRef.current?.getBoundingClientRect?.()
      const headerHeight = headerRect?.height ? Math.floor(headerRect.height) : 0
      const paddingAndGap = 16 /* mt-4 */ + 12 /* inner padding tolerance */
      const available = Math.max(240, Math.floor(rect.height) - headerHeight - paddingAndGap)
      setPanelMaxHeight(available)
    }

    update()

    const ro = new ResizeObserver(() => update())
    ro.observe(sidebarRef.current)
    if (rightHeaderRef.current) ro.observe(rightHeaderRef.current)
    window.addEventListener('resize', update)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  const toggleCheckpoint = (guideId, checkpoint) => {
    const key = `${guideId}::${checkpoint}`
    setDoneMap((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const markDone = (guideId, part) => {
    const key = getCompletionKey(guideId, part)
    setDoneMap((prev) => ({ ...prev, [key]: true }))
  }

  const guideProgress = useMemo(
    () => {
      const progress = {}
      
      // Calculate progress for library guides
      GUIDE_LIBRARY.forEach(guide => {
        const checkpointTotal = guide.checkpoints?.length || 0
        const checkpointDone = (guide.checkpoints || []).filter((item) => doneMap[`${guide.id}::${item}`]).length

        const lessonTotal = guide.lesson?.blocks?.length ? 1 : 0
        const lessonDone = lessonAckMap?.[guide.id] ? 1 : 0

        const activityTotal = guide.activity ? 1 : 0
        const activityDone = doneMap[getCompletionKey(guide.id, 'activity')] ? 1 : 0

        const quizTotal = guide.lesson?.quiz ? 1 : 0
        const quizDone = doneMap[getCompletionKey(guide.id, 'quiz')] ? 1 : 0

        const total = checkpointTotal + lessonTotal + activityTotal + quizTotal
        const done = checkpointDone + lessonDone + activityDone + quizDone

        progress[guide.id] = total ? Math.round((done / total) * 100) : 0
      })
      
      // For enterprise guides, we'll calculate progress differently
      // This is a placeholder - in a real implementation, you'd fetch progress from the database
      enterpriseGuides.forEach(guide => {
        progress[guide.id] = 0 // Placeholder - would be calculated from guide_progress table
      })
      
      return progress
    },
    [doneMap, lessonAckMap, enterpriseGuides],
  )

  const selectedGuide = activeSection === 'library'
    ? (GUIDE_LIBRARY.find((g) => g.id === selectedId) || GUIDE_LIBRARY[0])
    : enterpriseGuides.find((g) => g.id === selectedId) || (enterpriseGuides.length > 0 ? enterpriseGuides[0] : GUIDE_LIBRARY[0])
  const accent = ACCENTS[selectedGuide?.accent] || ACCENTS.slate
  const selectedProgress = guideProgress[selectedGuide?.id] ?? 0
  const hasLesson = Boolean(selectedGuide?.lesson?.blocks?.length || selectedGuide?.content?.lesson?.blocks?.length)
  const lessonAcknowledged = Boolean(lessonAckMap[selectedGuide?.id])
  const activityLocked = hasLesson && !lessonAcknowledged && activeSection === 'library'

  return (
    <section id="guias" className="mx-auto mt-2 w-full max-w-none px-6 pb-8">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside ref={sidebarRef} className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{ui.library}</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">{ui.guides}</h2>
            </div>
            <div className="hidden sm:block text-xs font-semibold text-slate-500">
              {activeSection === 'library' ? GUIDE_LIBRARY.length : enterpriseGuides.length}
            </div>
          </div>

          {/* Tab switcher */}
          <div className="mt-4 flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={() => setActiveSection('library')}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                activeSection === 'library'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {lang === 'en' ? 'Library' : 'Biblioteca'}
            </button>
            <button
              onClick={() => setActiveSection('enterprise')}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                activeSection === 'enterprise'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {lang === 'en' ? 'Assigned' : 'Asignadas'}
              {enterpriseGuides.length > 0 && (
                <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-800">
                  {enterpriseGuides.length}
                </span>
              )}
            </button>
          </div>

          {/* Guías asignadas por la empresa */}
          {(companyAssignedIds.size > 0 || customCompanyGuides.length > 0) && (
            <div className="mt-4 rounded-[1.5rem] border border-violet-200 bg-violet-50 p-2">
              <p className="px-2 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-500 flex items-center gap-1.5">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {lang === 'en' ? 'Assigned by your company' : 'Asignadas por tu empresa'}
              </p>
              <nav className="space-y-1">
                {/* Guías del catálogo asignadas */}
                {GUIDE_LIBRARY.filter(g => companyAssignedIds.has(g.id)).map((guide) => {
                  const isActive = guide.id === selectedGuide?.id
                  const a = ACCENTS[guide.accent] || ACCENTS.slate
                  const assignment = companyAssignments.find(a => a.guide_id === guide.id)
                  return (
                    <button
                      key={`company-${guide.id}`}
                      type="button"
                      onClick={() => selectGuide(guide.id)}
                      className={`guide-nav group relative flex w-full items-start gap-3 rounded-[1.25rem] border px-3 py-3 text-left transition-all duration-300 ${
                        isActive ? `bg-white ${a.border} shadow-sm` : 'border-transparent hover:bg-white/70'
                      }`}
                    >
                      <span className={`mt-0.5 h-3 w-3 flex-shrink-0 rounded-full ring-1 ring-violet-200 ${a.pill}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{guide.title}</span>
                        {assignment?.note && (
                          <span className="mt-0.5 block truncate text-xs text-violet-600 italic">"{assignment.note}"</span>
                        )}
                        <span className="mt-1.5 flex items-center gap-2">
                          <span className="rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]">
                            {lang === 'en' ? 'Company' : 'Empresa'}
                          </span>
                          {assignment?.due_date && (
                            <span className="text-[10px] text-slate-400">
                              {lang === 'en' ? 'Due' : 'Vence'} {new Date(assignment.due_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            {guideProgress[guide.id] ?? 0}%
                          </span>
                        </span>
                      </span>
                    </button>
                  )
                })}
                {/* Guías personalizadas de la empresa */}
                {customCompanyGuides.map((g) => (
                  <button
                    key={`custom-${g.id}`}
                    type="button"
                    onClick={() => selectGuide(g.id)}
                    className={`guide-nav group relative flex w-full items-start gap-3 rounded-[1.25rem] border px-3 py-3 text-left transition-all duration-300 ${
                      selectedId === g.id
                        ? 'bg-white border-violet-300 shadow-sm'
                        : 'border-transparent hover:bg-white/70'
                    }`}
                  >
                    <span className="mt-0.5 h-3 w-3 flex-shrink-0 rounded-full ring-1 ring-violet-200 bg-violet-100 text-violet-800" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">{g.title}</span>
                      {g._note && <span className="mt-0.5 block truncate text-xs text-violet-600 italic">"{g._note}"</span>}
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]">
                          {lang === 'en' ? 'Custom' : 'Personalizada'}
                        </span>
                        {g._dueDate && (
                          <span className="text-[10px] text-slate-400">
                            {lang === 'en' ? 'Due' : 'Vence'} {new Date(g._dueDate).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          )}

          <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-2">
            {activeSection === 'library' ? (
              <nav className="space-y-1">
                {GUIDE_LIBRARY.map((guide) => {
                  const isActive = guide.id === selectedGuide?.id
                  const isRecommended = recommendedSet.has(guide.id)
                  const isCompanyAssigned = companyAssignedIds.has(guide.id)
                  const a = ACCENTS[guide.accent] || ACCENTS.slate
                  return (
                    <button
                      key={guide.id}
                      type="button"
                      onClick={() => selectGuide(guide.id)}
                      className={`guide-nav group relative flex w-full items-start gap-3 rounded-[1.25rem] border px-3 py-3 text-left transition-all duration-300 ${
                        isActive ? `bg-white ${a.border} shadow-sm` : 'border-transparent hover:bg-white/70'
                      }`}
                    >
                      <span
                        className={`mt-0.5 h-3 w-3 flex-shrink-0 rounded-full ring-1 ring-slate-200 ${a.pill}`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{guide.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">{guide.summary}</span>
                        <span className="mt-2 flex items-center gap-2">
                          {isRecommended && !isCompanyAssigned && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${a.pill}`}>
                              {ui.recommended}
                            </span>
                          )}
                          {isCompanyAssigned && (
                            <span className="rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]">
                              {lang === 'en' ? 'Company' : 'Empresa'}
                            </span>
                          )}
                          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            {guideProgress[guide.id] ?? 0}%
                          </span>
                        </span>
                      </span>
                      <span
                        className={`absolute inset-y-3 right-3 w-1 rounded-full transition-all duration-300 ${
                          isActive ? `${a.pill}` : 'bg-transparent'
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  )
                })}
              </nav>
            ) : (
              <div className="space-y-1">
                {loadingEnterpriseGuides ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-slate-500">
                      {lang === 'en' ? 'Loading assigned guides...' : 'Cargando guías asignadas...'}
                    </div>
                  </div>
                ) : enterpriseGuides.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="rounded-full bg-slate-100 p-3 mb-3">
                      <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-slate-900 mb-1">
                      {lang === 'en' ? 'No assigned guides' : 'Sin guías asignadas'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {lang === 'en' ? 'Your team leader will assign guides for you to complete.' : 'Tu líder de equipo te asignará guías para completar.'}
                    </p>
                  </div>
                ) : (
                  enterpriseGuides.map((guide) => {
                    const isActive = guide.id === selectedGuide?.id
                    const a = ACCENTS[guide.accent] || ACCENTS.slate
                    const dueDate = guide.due_date ? new Date(guide.due_date) : null
                    const isOverdue = dueDate && dueDate < new Date()
                    
                    return (
                      <button
                        key={guide.id}
                        type="button"
                        onClick={() => setSelectedId(guide.id)}
                        className={`guide-nav group relative flex w-full items-start gap-3 rounded-[1.25rem] border px-3 py-3 text-left transition-all duration-300 ${
                          isActive ? `bg-white ${a.border} shadow-sm` : 'border-transparent hover:bg-white/70'
                        }`}
                      >
                        <span
                          className={`mt-0.5 h-3 w-3 flex-shrink-0 rounded-full ring-1 ring-slate-200 ${a.pill}`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">{guide.title}</span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">{guide.summary}</span>
                          <span className="mt-2 flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${a.pill}`}>
                              {lang === 'en' ? 'Enterprise' : 'Empresa'}
                            </span>
                            {dueDate && (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                isOverdue 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {lang === 'en' ? 'Due' : 'Vence'} {dueDate.toLocaleDateString()}
                              </span>
                            )}
                            {guide.notes && (
                              <span className="text-[10px] text-slate-400" title={guide.notes}>
                                📝
                              </span>
                            )}
                          </span>
                        </span>
                        <span
                          className={`absolute inset-y-3 right-3 w-1 rounded-full transition-all duration-300 ${
                            isActive ? `${a.pill}` : 'bg-transparent'
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </aside>

        <section className="flex flex-col rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div ref={rightHeaderRef} className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${accent.text}`}>{ui.selected}</p>
              <h3 className="mt-1 text-2xl font-semibold text-slate-900">{selectedGuide.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{selectedGuide.summary}</p>
              {activeSection === 'enterprise' && selectedGuide.notes && (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-semibold text-amber-800 mb-1">
                    {lang === 'en' ? 'Assignment Notes:' : 'Notas de Asignación:'}
                  </p>
                  <p className="text-xs text-amber-700">{selectedGuide.notes}</p>
                </div>
              )}
            </div>
            <div className="min-w-[220px] rounded-[1.25rem] border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{ui.progress}</p>
                <p className="text-xs font-semibold text-slate-600">{selectedProgress}%</p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-900 transition-all duration-500 ease-out"
                  style={{ width: `${selectedProgress}%` }}
                />
              </div>
              {activeSection === 'enterprise' && selectedGuide.due_date && (
                <div className="mt-2 pt-2 border-t border-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-1">
                    {lang === 'en' ? 'Due Date' : 'Fecha Límite'}
                  </p>
                  <p className="text-xs text-slate-600">
                    {new Date(selectedGuide.due_date).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div
            ref={contentRef}
            style={panelMaxHeight ? { maxHeight: panelMaxHeight } : undefined}
            className="mt-4 flex-1 overflow-auto rounded-[1.5rem] bg-slate-50 p-3"
          >
            {/* ── Guía personalizada de empresa ── */}
            {selectedGuide._isCustom && (
              <div className="space-y-3">
                {/* Badge + meta */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 text-violet-700 px-3 py-1 text-xs font-semibold">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    {lang === 'en' ? 'Company guide' : 'Guía de empresa'}
                  </span>
                  {selectedGuide._dueDate && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      {lang === 'en' ? 'Due' : 'Vence'}: {new Date(selectedGuide._dueDate).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  )}
                </div>

                {/* Nota de la empresa */}
                {selectedGuide._note && (
                  <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-500 mb-1">{lang === 'en' ? 'Note from your company' : 'Nota de tu empresa'}</p>
                    <p className="text-sm text-slate-700 italic">"{selectedGuide._note}"</p>
                  </div>
                )}

                {/* Enlace externo */}
                {selectedGuide._customUrl && (
                  <a href={selectedGuide._customUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-100 transition">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    {selectedGuide._customUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                )}
              </div>
            )}

            {hasLesson && (
              <div className={`rounded-[1.25rem] border bg-white p-4 ${accent.border}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${accent.text}`}>{ui.lesson}</p>
                    <h4 className="mt-1 text-lg font-semibold text-slate-900">{selectedGuide.lesson.title}</h4>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white">
                    <input
                      type="checkbox"
                      checked={lessonAcknowledged}
                      onChange={(e) =>
                        setLessonAckMap((prev) => ({
                          ...prev,
                          [selectedGuide.id]: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-slate-900"
                    />
                    {ui.readLesson}
                  </label>
                </div>

                <div className="mt-4 grid gap-2">
                  {selectedGuide.lesson.blocks.map((block, idx) => {
                    const key = `${selectedGuide.id}::${block.heading}`
                    const isOpen = openLessonBlock === key
                    return (
                      <div key={block.heading} className="rounded-[1.1rem] border border-slate-200 bg-slate-50">
                        <button
                          type="button"
                          onClick={() => setOpenLessonBlock((prev) => (prev === key ? null : key))}
                          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{block.heading}</p>
                            <p className="mt-1 text-xs text-slate-500">{ui.card} {idx + 1} {ui.of} {selectedGuide.lesson.blocks.length}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isOpen ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>
                            {isOpen ? ui.close : ui.open}
                          </span>
                        </button>

                        {isOpen && (
                          <div className="px-4 pb-4">
                            {block.body && <p className="text-sm leading-relaxed text-slate-700">{block.body}</p>}
                            {block.bullets?.length ? (
                              <ul className="mt-3 space-y-2">
                                {block.bullets.map((b) => (
                                  <li key={b} className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm text-slate-700">
                                    {b}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {selectedGuide.lesson.takeaway && (
                  <div className="mt-3 rounded-[1.1rem] border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{ui.keyIdea}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{selectedGuide.lesson.takeaway}</p>
                  </div>
                )}
              </div>
            )}

            {selectedGuide.id === 'estructura-prompt' && (
              <div className="mt-4">
                <ParteBuilder accent={selectedGuide.accent} lang={lang} />
              </div>
            )}

            {selectedGuide.lesson?.quiz && (
              <div className="mt-4">
                <MiniQuiz
                  quiz={selectedGuide.lesson.quiz}
                  accent={selectedGuide.accent}
                  storageKey={`promptool_quiz_${selectedGuide.id}`}
                  onCorrect={() => markDone(selectedGuide.id, 'quiz')}
                  lang={lang}
                />
              </div>
            )}

            {selectedGuide.activity?.type === 'order' && (
              <div className="mt-4">
                {activityLocked ? (
                  <div className="relative overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white p-4">
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]" />
                    <div className="relative">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Actividad bloqueada</p>
                      <p className="mt-1 text-sm text-slate-700">
                        Para jugar, marcá <span className="font-semibold">“Lei la leccion”</span> arriba. La idea es: primero entender, después practicar.
                      </p>
                    </div>
                  </div>
                ) : (
                  <OrderDnD
                    guideId={selectedGuide.id}
                    activity={selectedGuide.activity}
                    accent={selectedGuide.accent}
                    lang={lang}
                    onSolved={() => {
                      markDone(selectedGuide.id, 'activity')
                    }}
                  />
                )}
              </div>
            )}

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{ui.steps}</p>
                <ol className="mt-3 space-y-2">
                  {(selectedGuide.steps || []).map((step) => (
                    <li key={step} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{ui.drills}</p>
                <ul className="mt-3 space-y-2">
                  {(selectedGuide.drills || []).map((drill) => (
                    <li key={drill} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                      {drill}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-3 rounded-[1.25rem] border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{ui.checkpoints}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(selectedGuide.checkpoints || []).map((checkpoint) => {
                  const key = `${selectedGuide.id}::${checkpoint}`
                  const isDone = !!doneMap[key]
                  return (
                    <button
                      type="button"
                      key={checkpoint}
                      onClick={() => toggleCheckpoint(selectedGuide.id, checkpoint)}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold transition-all duration-300 ${
                        isDone
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
          </div>
        </section>
      </div>
    </section>
  )
}

export default GuidesSection
