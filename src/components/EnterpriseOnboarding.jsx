import { useState } from 'react'
import { supabase } from '../supabaseClient'

const INDUSTRIES = [
  { id: 'marketing', label: 'Marketing' },
  { id: 'tech', label: 'Tecnología' },
  { id: 'design', label: 'Diseño' },
  { id: 'data', label: 'Data / BI' },
  { id: 'sales', label: 'Ventas' },
  { id: 'education', label: 'Educación' },
  { id: 'finance', label: 'Finanzas' },
  { id: 'other', label: 'Otro' },
]

const USE_CASES = [
  { id: 'content', label: 'Generar contenido' },
  { id: 'images', label: 'Crear imágenes con IA' },
  { id: 'writing', label: 'Redacción y copywriting' },
  { id: 'marketing', label: 'Campañas de marketing' },
  { id: 'code', label: 'Asistencia en código' },
  { id: 'analysis', label: 'Análisis de datos' },
  { id: 'automation', label: 'Automatización de tareas' },
  { id: 'presentations', label: 'Presentaciones' },
  { id: 'support', label: 'Soporte al cliente' },
  { id: 'research', label: 'Investigación' },
  { id: 'training', label: 'Capacitación de equipos' },
  { id: 'other', label: 'Otros' },
]

const TEAM_SIZES = ['1-5', '6-15', '16-50', '50+']

const EnterpriseOnboarding = ({ user, onDone }) => {
  const [step, setStep] = useState(0)
  const [industry, setIndustry] = useState('')
  const [teamSize, setTeamSize] = useState('')
  const [useCases, setUseCases] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteSent, setInviteSent] = useState(false)
  const [saving, setSaving] = useState(false)

  const STEPS = 4

  const toggleUseCase = (id) => {
    setUseCases(prev => prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id])
  }

  const saveAndNext = async () => {
    if (step === 1) {
      setSaving(true)
      await supabase.from('usuarios').update({ industry_type: industry }).eq('id_usuario', user.id)
      setSaving(false)
    }
    setStep(s => s + 1)
  }

  const sendInvite = async () => {
    if (!inviteEmail.trim()) { setStep(s => s + 1); return }
    setSaving(true)
    const email = inviteEmail.trim()

    const { data: existingUser } = await supabase
      .from('usuarios')
      .select('id_usuario')
      .eq('email', email)
      .maybeSingle()

    await supabase.from('team_invitations').insert([{
      company_id: user.id,
      user_email: email,
      status: 'pending',
    }])

    const companyName = user.user_metadata?.nombre_display || user.user_metadata?.nombre || user.email
    const joinUrl = existingUser?.id_usuario
      ? `https://promptool.app/?join=${user.id}`
      : `https://promptool.app/?invite=${user.id}&email=${encodeURIComponent(email)}`

    try {
      const inviteRes = await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: email,
          companyName,
          inviterName: companyName,
          joinUrl,
          isExistingUser: !!existingUser?.id_usuario,
        }),
      })
      if (!inviteRes.ok) {
        console.error('[send-invite] HTTP error:', inviteRes.status)
      }
    } catch (_) {}

    setSaving(false)
    setInviteSent(true)
    setTimeout(() => setStep(s => s + 1), 1000)
  }

  const finish = async () => {
    try {
      await supabase
        .from('usuarios')
        .update({ enterprise_onboarded: true })
        .eq('id_usuario', user.id)
    } catch (_) {}
    onDone()
  }

  const progress = (step / (STEPS - 1)) * 100

  const Check = () => (
    <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 12 12">
      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden">
        <div className="h-1 bg-slate-100">
          <div className="h-full bg-violet-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="p-8">

          {/* Step 0: Bienvenida */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">Bienvenido a PrompTool Enterprise</h2>
                <p className="text-slate-500 text-sm leading-relaxed">
                  En 3 pasos configuramos tu espacio para que tu equipo empiece a entrenar con IA desde hoy.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center text-xs text-slate-500">
                {['Tu industria', 'Tus objetivos', 'Tu primer miembro'].map((label, i) => (
                  <div key={i} className="rounded-xl bg-slate-50 p-3 space-y-1">
                    <div className="font-semibold text-slate-700">{i + 1}</div>
                    <div>{label}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep(1)}
                className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-700 transition"
              >
                Empezar configuración
              </button>
            </div>
          )}

          {/* Step 1: Industria y tamaño */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">¿En qué industria trabajan?</h2>
                <p className="text-sm text-slate-500 mt-1">Esto nos ayuda a mostrarte los challenges más relevantes.</p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {INDUSTRIES.map(ind => (
                  <button
                    key={ind.id}
                    onClick={() => setIndustry(ind.id)}
                    className={`rounded-xl border-2 p-2.5 text-xs font-medium transition ${
                      industry === ind.id
                        ? 'border-violet-500 bg-violet-50 text-violet-700'
                        : 'border-slate-200 text-slate-600 hover:border-violet-300'
                    }`}
                  >
                    {ind.label}
                  </button>
                ))}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Tamaño del equipo</p>
                <div className="flex gap-2">
                  {TEAM_SIZES.map(size => (
                    <button
                      key={size}
                      onClick={() => setTeamSize(size)}
                      className={`flex-1 rounded-lg border-2 py-2 text-xs font-medium transition ${
                        teamSize === size
                          ? 'border-violet-500 bg-violet-50 text-violet-700'
                          : 'border-slate-200 text-slate-600 hover:border-violet-300'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={saveAndNext}
                disabled={!industry || !teamSize || saving}
                className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-700 transition disabled:opacity-40"
              >
                {saving ? 'Guardando...' : 'Continuar'}
              </button>
            </div>
          )}

          {/* Step 2: Casos de uso */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">¿Para qué usa tu equipo la IA?</h2>
                <p className="text-sm text-slate-500 mt-1">Seleccioná todos los que apliquen.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {USE_CASES.map(uc => (
                  <button
                    key={uc.id}
                    onClick={() => toggleUseCase(uc.id)}
                    className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-medium text-left transition ${
                      useCases.includes(uc.id)
                        ? 'border-violet-500 bg-violet-50 text-violet-700'
                        : 'border-slate-200 text-slate-600 hover:border-violet-300'
                    }`}
                  >
                    <span className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 ${
                      useCases.includes(uc.id) ? 'border-violet-500 bg-violet-500' : 'border-slate-300'
                    }`}>
                      {useCases.includes(uc.id) && <Check />}
                    </span>
                    {uc.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep(3)}
                disabled={useCases.length === 0}
                className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-700 transition disabled:opacity-40"
              >
                Continuar
              </button>
              <button onClick={() => setStep(3)} className="w-full text-xs text-slate-400 hover:text-slate-600">
                Saltar este paso
              </button>
            </div>
          )}

          {/* Step 3: Invitar miembro */}
          {step === 3 && (
            <div className="space-y-5">
              {inviteSent ? (
                <div className="text-center space-y-3 py-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                    <svg className="h-7 w-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="font-semibold text-slate-900">Invitación enviada</p>
                  <p className="text-sm text-slate-500">Pasando al último paso...</p>
                </div>
              ) : (
                <>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Invitá a tu primer miembro</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      Podés invitar a todo el equipo desde el panel. Esto es opcional.
                    </p>
                  </div>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="email@tuempresa.com"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                  <button
                    onClick={sendInvite}
                    disabled={saving}
                    className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-700 transition disabled:opacity-40"
                  >
                    {saving ? 'Enviando...' : 'Enviar invitación'}
                  </button>
                  <button onClick={() => setStep(s => s + 1)} className="w-full text-xs text-slate-400 hover:text-slate-600">
                    Invitar después desde el panel
                  </button>
                </>
              )}
            </div>
          )}

          {/* Step 4: Listo */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">Todo listo</h2>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Tu espacio de empresa está configurado. Desde el panel podés crear challenges,
                  invitar miembros y ver el progreso de tu equipo.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                {[
                  { label: 'Crear challenges' },
                  { label: 'Invitar equipo' },
                  { label: 'Ver analytics' },
                ].map(({ label }) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-3">
                    <div className="text-slate-600 font-medium">{label}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={finish}
                className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-700 transition"
              >
                Ir al panel de empresa
              </button>
            </div>
          )}
        </div>

        {step < 4 && (
          <div className="flex justify-center gap-1.5 pb-5">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-violet-500' : 'w-1.5 bg-slate-200'}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default EnterpriseOnboarding
