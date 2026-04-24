import { useEffect, useState, useRef } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import { useAuth } from './hooks/useAuth'
import { useLang } from './contexts/LangContext'
import { supabase } from './supabaseClient'
import { nowAR } from './utils/dateAR'

function SupportApp() {
  const { user, loading: authLoading } = useAuth()
  const { lang } = useLang()
  const [tickets, setTickets] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [creating, setCreating] = useState(false)
  const [sending, setSending] = useState(false)
  const [loadingTickets, setLoadingTickets] = useState(true)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (authLoading || !user) return
    fetchTickets()
  }, [user, authLoading])

  useEffect(() => {
    if (selectedTicket) fetchMessages(selectedTicket.id_ticket)
  }, [selectedTicket])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchTickets = async () => {
    setLoadingTickets(true)
    const { data } = await supabase
      .from('tickets')
      .select('*')
      .eq('id_usuario', user.id)
      .order('updated_at', { ascending: false })
    setTickets(data || [])
    setLoadingTickets(false)
  }

  const fetchMessages = async (id_ticket) => {
    const { data } = await supabase
      .from('ticket_mensajes')
      .select('*, usuarios(nombre, nombre_display, avatar_url)')
      .eq('id_ticket', id_ticket)
      .order('created_at', { ascending: true })
    setMessages(data || [])
  }

  const createTicket = async (e) => {
    e.preventDefault()
    if (!newSubject.trim() || !newMessage.trim()) return
    setCreating(true)
    try {
      const { data: ticket, error } = await supabase
        .from('tickets')
        .insert([{ id_usuario: user.id, asunto: newSubject }])
        .select()
        .single()
      if (error) throw error

      await supabase.from('ticket_mensajes').insert([{
        id_ticket: ticket.id_ticket,
        id_usuario: user.id,
        mensaje: newMessage,
        es_admin: false,
      }])

      setNewSubject('')
      setNewMessage('')
      await fetchTickets()
      setSelectedTicket(ticket)
    } catch (err) {
      alert(err.message)
    } finally {
      setCreating(false)
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedTicket) return
    setSending(true)
    try {
      await supabase.from('ticket_mensajes').insert([{
        id_ticket: selectedTicket.id_ticket,
        id_usuario: user.id,
        mensaje: newMessage,
        es_admin: false,
      }])
      await supabase.from('tickets').update({ updated_at: nowAR() }).eq('id_ticket', selectedTicket.id_ticket)
      setNewMessage('')
      fetchMessages(selectedTicket.id_ticket)
    } catch (err) {
      alert(err.message)
    } finally {
      setSending(false)
    }
  }

  const statusColor = (s) => s === 'open' ? 'bg-emerald-100 text-emerald-700' : s === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
  const statusLabel = (s) => {
    if (s === 'open') return lang === 'en' ? 'Open' : 'Abierto'
    if (s === 'in_progress') return lang === 'en' ? 'In progress' : 'En progreso'
    return lang === 'en' ? 'Closed' : 'Cerrado'
  }

  if (authLoading) return <div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" /></div>

  if (!user) return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex flex-1 items-center justify-center">
        <p className="text-slate-500">{lang === 'en' ? 'Sign in to access support.' : 'Iniciá sesión para acceder al soporte.'}</p>
      </main>
      <Footer />
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{lang === 'en' ? 'Support' : 'Soporte'}</h1>
          <p className="text-sm text-slate-500 mt-1">{lang === 'en' ? 'Open a ticket and we\'ll get back to you.' : 'Abrí un ticket y te respondemos.'}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Ticket list */}
          <aside className="space-y-3">
            <button
              onClick={() => setSelectedTicket(null)}
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition"
            >
              + {lang === 'en' ? 'New ticket' : 'Nuevo ticket'}
            </button>

            {loadingTickets ? (
              <div className="py-8 text-center text-sm text-slate-400">Loading...</div>
            ) : tickets.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                {lang === 'en' ? 'No tickets yet' : 'Sin tickets todavía'}
              </div>
            ) : (
              <div className="space-y-2">
                {tickets.map(t => (
                  <button key={t.id_ticket} onClick={() => setSelectedTicket(t)}
                    className={`w-full text-left rounded-xl border p-3 transition ${
                      selectedTicket?.id_ticket === t.id_ticket
                        ? 'border-indigo-300 bg-indigo-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(t.estado)}`}>
                        {statusLabel(t.estado)}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(t.updated_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-700 truncate">{t.asunto}</p>
                  </button>
                ))}
              </div>
            )}
          </aside>

          {/* Main panel */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col" style={{ minHeight: 480 }}>
            {!selectedTicket ? (
              /* New ticket form */
              <div className="flex-1 p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">
                  {lang === 'en' ? 'Open a new ticket' : 'Abrir nuevo ticket'}
                </h2>
                <form onSubmit={createTicket} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {lang === 'en' ? 'Subject' : 'Asunto'}
                    </label>
                    <input type="text" value={newSubject} onChange={e => setNewSubject(e.target.value)}
                      placeholder={lang === 'en' ? 'Brief description of your issue' : 'Descripción breve del problema'}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-400"
                      required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {lang === 'en' ? 'Message' : 'Mensaje'}
                    </label>
                    <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} rows={5}
                      placeholder={lang === 'en' ? 'Describe your issue in detail...' : 'Describí tu problema en detalle...'}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-slate-400 resize-none"
                      required />
                  </div>
                  <button type="submit" disabled={creating}
                    className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition disabled:opacity-50">
                    {creating ? '...' : (lang === 'en' ? 'Send ticket' : 'Enviar ticket')}
                  </button>
                </form>
              </div>
            ) : (
              /* Chat view */
              <>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div>
                    <p className="font-semibold text-slate-800">{selectedTicket.asunto}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(selectedTicket.estado)}`}>
                      {statusLabel(selectedTicket.estado)}
                    </span>
                  </div>
                  <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-slate-700 text-sm">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ maxHeight: 360 }}>
                  {messages.map((m, i) => {
                    const isAdmin = m.es_admin
                    return (
                      <div key={i} className={`flex gap-3 ${isAdmin ? '' : 'flex-row-reverse'}`}>
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {isAdmin ? 'A' : (m.usuarios?.nombre || 'U').substring(0, 1).toUpperCase()}
                        </div>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                          isAdmin
                            ? 'bg-purple-50 border border-purple-100 text-slate-700'
                            : 'bg-slate-900 text-white'
                        }`}>
                          <p>{m.mensaje}</p>
                          <p className={`text-xs mt-1 ${isAdmin ? 'text-slate-400' : 'text-slate-400'}`}>
                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {selectedTicket.estado !== 'closed' && (
                  <form onSubmit={sendMessage} className="border-t border-slate-100 p-4 flex gap-3">
                    <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)}
                      placeholder={lang === 'en' ? 'Type a message...' : 'Escribí un mensaje...'}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-slate-400"
                      required />
                    <button type="submit" disabled={sending}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition disabled:opacity-50">
                      {sending ? '...' : (lang === 'en' ? 'Send' : 'Enviar')}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default SupportApp
