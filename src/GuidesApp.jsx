import Header from './components/Header'
import Footer from './components/Footer'
import GuidesSection from './components/GuidesSection'
import GuideArticle from './components/GuideArticle'
import GuideNotFound from './components/GuideNotFound'
import { useLang } from './contexts/LangContext'
import { useAuth } from './hooks/useAuth'
import AuthModal from './components/AuthModal'
import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { getGuideById } from './data/guides'
import { getGuideSlugFromPath } from './utils/guideRoutes'

const GuidesApp = () => {
  const { lang } = useLang()
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const [companyAssignments, setCompanyAssignments] = useState([])
  const [slug, setSlug] = useState(() => getGuideSlugFromPath())

  useEffect(() => {
    const onPop = () => setSlug(getGuideSlugFromPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    if (!user) return
    const fetchAssignments = async () => {
      try {
        const { data: profile } = await supabase
          .from('usuarios')
          .select('company_id')
          .eq('id_usuario', user.id)
          .maybeSingle()

        if (!profile?.company_id) return

        const { data: company } = await supabase
          .from('usuarios')
          .select('training_config')
          .eq('id_usuario', profile.company_id)
          .maybeSingle()

        const all = company?.training_config?.guide_assignments || []
        const mine = all.filter((a) => !a.target_user_id || a.target_user_id === user.id)
        setCompanyAssignments(mine)
      } catch {
        // silent
      }
    }
    fetchAssignments()
  }, [user?.id])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
      </div>
    )
  }

  if (slug) {
    const guide = getGuideById(slug)
    if (!guide) return <GuideNotFound />
    return <GuideArticle guide={guide} />
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Header />
      <main className="flex-1 py-6">
        <section className="mx-auto w-full max-w-none px-4 sm:px-6 mb-4">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white px-5 sm:px-6 py-4 sm:py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">PrompTool</p>
                <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-slate-900">
                  {lang === 'en' ? 'Prompt engineering guides' : 'Guías de prompt engineering'}
                </h1>
                <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
                  {lang === 'en'
                    ? 'Free, in-depth lessons on zero-shot, few-shot, visual description, and image-generation best practices.'
                    : 'Lecciones gratuitas sobre zero-shot, few-shot, descripción visual y buenas prácticas para imágenes con IA.'}
                </p>
              </div>
              {!user && (
                <button
                  type="button"
                  onClick={() => setAuthOpen(true)}
                  className="shrink-0 self-start rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition"
                  style={{ backgroundColor: 'rgb(var(--color-accent))' }}
                >
                  {lang === 'en' ? 'Sign in to save progress' : 'Iniciar sesión para guardar progreso'}
                </button>
              )}
            </div>
          </div>
        </section>
        <GuidesSection companyAssignments={user ? companyAssignments : []} />
      </main>
      <Footer />
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSignInWithGoogle={signInWithGoogle}
        onSignInWithEmail={signInWithEmail}
        onSignUpWithEmail={signUpWithEmail}
      />
    </div>
  )
}

export default GuidesApp
