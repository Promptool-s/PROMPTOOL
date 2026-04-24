import { useEffect, useState, useRef } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import { useAuth } from './hooks/useAuth'
import { supabase } from './supabaseClient'
import { nowAR } from './utils/dateAR'
import { proxyImg } from './utils/imgProxy'

async function checkIsAdmin(userId) {
  if (!userId) return false
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.user_metadata?.adminstate === true) return true
    if (user?.user_metadata?.devstate === true) return true
    const { data } = await supabase.from('usuarios').select('adminstate, devstate').eq('id_usuario', userId).maybeSingle()
    return data?.adminstate === true || data?.devstate === true
  } catch { return false }
}

const TABLE_PKS  = { usuarios: 'id_usuario', imagenes_ia: 'id_imagen', intentos: 'id_intento' }
const TABLE_SORT = { usuarios: 'fecha_registro', imagenes_ia: 'fecha', intentos: 'fecha_hora' }
const TABLES     = ['usuarios', 'imagenes_ia', 'intentos']

// Default empty row per table for the "Add" form
const DEFAULT_ROW = {
  usuarios:    { nombre: '', email: '', idioma_preferido: 'es', adminstate: false },
  imagenes_ia: { url_image: '', prompt_original: '', image_diff: 'Medium', image_theme: '' },
  intentos:    { id_usuario: '', id_imagen: '', prompt_usuario: '', puntaje_similitud: 0, modo: 'random' },
}

function AdminApp() {
  const { user, loading: authLoading } = useAuth()
  const [adminChecked, setAdminChecked] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const [selectedTable, setSelectedTable] = useState('usuarios')
  const [tableData, setTableData] = useState([])
  const [columns, setColumns] = useState([])
  const [loading, setLoading] = useState(false)

  const [editingRow, setEditingRow] = useState(null)
  const [editValues, setEditValues] = useState({})

  const [addingRow, setAddingRow] = useState(false)
  const [addValues, setAddValues] = useState({})

  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)

  // SQL runner
  const [sqlQuery, setSqlQuery] = useState('')
  const [sqlResult, setSqlResult] = useState(null)
  const [sqlError, setSqlError] = useState('')
  const [sqlLoading, setSqlLoading] = useState(false)
  const [showSql, setShowSql] = useState(false)

  // Tickets
  const [activeTab, setActiveTab] = useState('tables') // 'tables' | 'tickets'
  const [tickets, setTickets] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [ticketMessages, setTicketMessages] = useState([])
  const [ticketReply, setTicketReply] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const ticketEndRef = useRef(null)

  const [toast, setToast] = useState(null)
  const hasRedirected = useRef(false)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── TICKETS ──
  const fetchTickets = async () => {
    const { data } = await supabase
      .from('tickets')
      .select('*, usuarios(nombre, nombre_display, email, avatar_url)')
      .order('updated_at', { ascending: false })
    setTickets(data || [])
  }

  const fetchTicketMessages = async (id_ticket) => {
    const { data } = await supabase
      .from('ticket_mensajes')
      .select('*, usuarios(nombre, nombre_display, avatar_url)')
      .eq('id_ticket', id_ticket)
      .order('created_at', { ascending: true })
    setTicketMessages(data || [])
    setTimeout(() => ticketEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const selectTicket = (t) => {
    setSelectedTicket(t)
    fetchTicketMessages(t.id_ticket)
  }

  const sendReply = async (e) => {
    e.preventDefault()
    if (!ticketReply.trim() || !selectedTicket) return
    setSendingReply(true)
    try {
      await supabase.from('ticket_mensajes').insert([{
        id_ticket: selectedTicket.id_ticket,
        id_usuario: user.id,
        mensaje: ticketReply,
        es_admin: true,
      }])
      await supabase.from('tickets').update({
        estado: 'in_progress',
        updated_at: new Date().toISOString(),
      }).eq('id_ticket', selectedTicket.id_ticket)
      setTicketReply('')
      fetchTicketMessages(selectedTicket.id_ticket)
      fetchTickets()
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    } finally {
      setSendingReply(false)
    }
  }

  const closeTicket = async (id_ticket) => {
    await supabase.from('tickets').update({ estado: 'closed' }).eq('id_ticket', id_ticket)
    fetchTickets()
    if (selectedTicket?.id_ticket === id_ticket) setSelectedTicket(t => ({ ...t, estado: 'closed' }))
    showToast('Ticket closed')
  }

  useEffect(() => {
    if (activeTab === 'tickets' && adminChecked && isAdmin) fetchTickets()
  }, [activeTab, adminChecked, isAdmin])

  useEffect(() => {
    if (authLoading) return
    if (!user) { if (!hasRedirected.current) { hasRedirected.current = true; window.location.href = '/' } return }
    checkIsAdmin(user.id).then(result => {
      setIsAdmin(result)
      setAdminChecked(true)
      if (!result && !hasRedirected.current) { hasRedirected.current = true; window.location.href = '/' }
    })
  }, [user, authLoading])

  useEffect(() => {
    if (adminChecked && isAdmin) fetchTableData()
  }, [selectedTable, adminChecked, isAdmin])

  const fetchTableData = async () => {
    setLoading(true)
    setEditingRow(null)
    setAddingRow(false)
    setSelectedUser(null)
    try {
      const { data, error } = await supabase
        .from(selectedTable)
        .select('*')
        .order(TABLE_SORT[selectedTable], { ascending: false })
        .limit(300)
      if (error) throw error
      setTableData(data || [])
      setColumns(data?.length ? Object.keys(data[0]) : Object.keys(DEFAULT_ROW[selectedTable] || {}))
    } catch (err) {
      showToast('Error loading: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // ── EDIT ──
  const startEdit = (row) => {
    setAddingRow(false)
    setEditingRow(row)
    setEditValues({ ...row })
  }

  const saveEdit = async () => {
    try {
      const pk = TABLE_PKS[selectedTable]
      const { error } = await supabase.from(selectedTable).update(editValues).eq(pk, editingRow[pk])
      if (error) throw error
      showToast('Record updated')
      setEditingRow(null)
      fetchTableData()
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    }
  }

  // ── ADD ──
  const startAdd = () => {
    setEditingRow(null)
    setAddValues({ ...(DEFAULT_ROW[selectedTable] || {}) })
    setAddingRow(true)
  }

  const saveAdd = async () => {
    try {
      const { error } = await supabase.from(selectedTable).insert([addValues])
      if (error) throw error
      showToast('Record added')
      setAddingRow(false)
      fetchTableData()
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    }
  }

  // ── DELETE ──
  const handleDelete = async (row) => {
    if (!confirm('Delete this record?')) return
    try {
      const pk = TABLE_PKS[selectedTable]
      const { error } = await supabase.from(selectedTable).delete().eq(pk, row[pk])
      if (error) throw error
      showToast('Record deleted')
      if (selectedUser?.[pk] === row[pk]) setSelectedUser(null)
      fetchTableData()
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    }
  }

  // ── TOGGLE ADMIN ──
  const toggleAdmin = async (row) => {
    const newVal = !row.adminstate
    try {
      const { error } = await supabase.from('usuarios').update({ adminstate: newVal }).eq('id_usuario', row.id_usuario)
      if (error) throw error
      showToast(newVal ? 'Admin granted' : 'Admin removed')
      if (selectedUser?.id_usuario === row.id_usuario) setSelectedUser({ ...selectedUser, adminstate: newVal })
      fetchTableData()
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    }
  }

  // ── TOGGLE VERIFIED (empresas) ──
  const toggleVerified = async (row) => {
    const newVal = !row.verified
    try {
      const { error } = await supabase.from('usuarios').update({ verified: newVal }).eq('id_usuario', row.id_usuario)
      if (error) throw error
      showToast(newVal ? '✓ Empresa verificada' : 'Verificación removida')
      if (selectedUser?.id_usuario === row.id_usuario) setSelectedUser({ ...selectedUser, verified: newVal })
      fetchTableData()
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    }
  }

  // ── SQL RUNNER ──
  const runSql = async () => {
    if (!sqlQuery.trim()) return
    setSqlLoading(true)
    setSqlResult(null)
    setSqlError('')
    try {
      const { data, error } = await supabase.rpc('exec_sql', { query: sqlQuery })
      if (error) throw error
      setSqlResult(data)
      showToast('Query executed')
    } catch (err) {
      setSqlError(err.message)
    } finally {
      setSqlLoading(false)
    }
  }

  // ── RENDER CELL ──
  const renderCell = (value, col, isEditMode, values, setValues) => {
    if (isEditMode) {
      if (typeof value === 'boolean' || col === 'adminstate') {
        return (
          <select value={String(values[col])} onChange={e => setValues({ ...values, [col]: e.target.value === 'true' })}
            className="rounded border border-slate-300 px-2 py-1 text-xs w-full">
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        )
      }
      return (
        <input type="text" value={values[col] ?? ''} onChange={e => setValues({ ...values, [col]: e.target.value })}
          className="w-full min-w-[80px] rounded border border-slate-300 px-2 py-1 text-xs" />
      )
    }
    if (value === null || value === undefined) return <span className="text-slate-300 text-xs italic">—</span>
    if (typeof value === 'boolean') return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${value ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
        {value ? 'true' : 'false'}
      </span>
    )
    if (typeof value === 'object') return <span className="text-xs text-slate-400">{JSON.stringify(value).substring(0, 40)}…</span>
    const str = String(value)
    return <span className="text-xs">{str.length > 55 ? str.substring(0, 55) + '…' : str}</span>
  }

  const filteredData = search.trim()
    ? tableData.filter(row => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(search.toLowerCase())))
    : tableData

  if (authLoading || !adminChecked) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" /></div>
  }
  if (!isAdmin) return null

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Header />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[999] rounded-xl px-4 py-3 text-sm font-semibold shadow-lg transition ${
          toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
            <p className="text-sm text-slate-500 mt-0.5">Full database management</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSql(s => !s)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition border ${showSql ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              SQL Runner
            </button>
            <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700 uppercase tracking-wide">Admin</span>
          </div>
        </div>

        {/* Main tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-0">
          {['tables', 'tickets'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition -mb-px ${
                activeTab === tab ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {tab === 'tables' ? 'Tables' : `Tickets ${tickets.filter(t => t.estado === 'open').length > 0 ? `(${tickets.filter(t => t.estado === 'open').length})` : ''}`}
            </button>
          ))}
        </div>

        {/* SQL Runner */}
        {showSql && activeTab === 'tables' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <p className="text-sm font-semibold text-slate-700">SQL Query Runner</p>
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
              ⚠ Requires a <code className="font-mono">exec_sql</code> RPC function in Supabase. Use with caution — this executes raw SQL.
            </p>
            <textarea
              value={sqlQuery}
              onChange={e => setSqlQuery(e.target.value)}
              rows={4}
              placeholder="SELECT * FROM usuarios LIMIT 10;"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-mono outline-none focus:border-slate-400 resize-none"
            />
            <div className="flex gap-2">
              <button onClick={runSql} disabled={sqlLoading || !sqlQuery.trim()}
                className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition">
                {sqlLoading ? 'Running...' : 'Run Query'}
              </button>
              <button onClick={() => { setSqlQuery(''); setSqlResult(null); setSqlError('') }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
                Clear
              </button>
            </div>
            {sqlError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 font-mono">{sqlError}</div>
            )}
            {sqlResult !== null && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                <p className="text-xs font-semibold text-emerald-700 mb-2">Result:</p>
                <pre className="text-xs text-emerald-800 overflow-auto max-h-48">{JSON.stringify(sqlResult, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        {/* Table tabs */}
        {activeTab === 'tables' && (<>
        <div className="flex gap-2 flex-wrap">
          {TABLES.map(t => (
            <button key={t} onClick={() => setSelectedTable(t)}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                selectedTable === t ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* User detail panel */}
        {selectedUser && selectedTable === 'usuarios' && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 overflow-hidden rounded-full border-2 border-indigo-200 bg-white flex items-center justify-center">
                  {selectedUser.avatar_url
                    ? <img src={proxyImg(selectedUser.avatar_url)} alt="" className="h-full w-full object-cover" />
                    : <span className="text-lg font-bold text-indigo-400">{(selectedUser.nombre_display || selectedUser.nombre || 'U').substring(0,2).toUpperCase()}</span>
                  }
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{selectedUser.nombre_display || selectedUser.nombre || '—'}</p>
                  <p className="text-sm text-slate-500">{selectedUser.email}</p>
                  {selectedUser.username && <p className="text-xs text-slate-400">@{selectedUser.username}</p>}
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${selectedUser.adminstate ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                    {selectedUser.adminstate ? 'Admin' : 'User'}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Attempts', val: selectedUser.total_intentos ?? 0 },
                { label: 'Avg score', val: `${selectedUser.promedio_score ?? 0}%` },
                { label: 'Best score', val: `${selectedUser.mejor_score ?? 0}%` },
                { label: 'Streak', val: selectedUser.racha_actual ?? 0 },
              ].map(({ label, val }) => (
                <div key={label} className="rounded-xl bg-white border border-indigo-100 p-3 text-center">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-xl font-bold text-slate-800 mt-0.5">{val}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <a href={selectedUser.username ? `/user/${selectedUser.username}` : `/usuario.html?id=${selectedUser.id_usuario}`}
                target="_blank" rel="noopener noreferrer"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
                View profile ↗
              </a>
              <button onClick={() => toggleAdmin(selectedUser)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  selectedUser.adminstate ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                }`}>
                {selectedUser.adminstate ? 'Remove admin' : 'Grant admin'}
              </button>
              {selectedUser.user_type === 'enterprise' && (
                <button onClick={() => toggleVerified(selectedUser)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    selectedUser.verified
                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  }`}>
                  {selectedUser.verified ? '✓ Verified — click to remove' : 'Verify company'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Add row form */}
        {addingRow && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-emerald-800">Add new record to <span className="font-mono">{selectedTable}</span></p>
              <button onClick={() => setAddingRow(false)} className="text-emerald-600 hover:text-emerald-900 text-sm">✕</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.keys(addValues).map(col => (
                <div key={col}>
                  <label className="block text-xs font-semibold text-emerald-700 mb-1">{col}</label>
                  {typeof addValues[col] === 'boolean' || col === 'adminstate' ? (
                    <select value={String(addValues[col])} onChange={e => setAddValues({ ...addValues, [col]: e.target.value === 'true' })}
                      className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm outline-none">
                      <option value="false">false</option>
                      <option value="true">true</option>
                    </select>
                  ) : (
                    <input type="text" value={addValues[col] ?? ''} onChange={e => setAddValues({ ...addValues, [col]: e.target.value })}
                      className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400" />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={saveAdd}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition">
                Add record
              </button>
              <button onClick={() => setAddingRow(false)}
                className="rounded-xl border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Main table */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-slate-800">{selectedTable}</h2>
              <span className="text-xs text-slate-400">{filteredData.length} / {tableData.length} records</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search all columns..."
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-slate-400 w-48" />
              <button onClick={startAdd}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 transition">
                + Add
              </button>
              <button onClick={fetchTableData}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition">
                Reload
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
            </div>
          ) : filteredData.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">No records found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {columns.map(col => (
                      <th key={col} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 sticky right-0 bg-slate-50">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row, idx) => {
                    const pk = TABLE_PKS[selectedTable]
                    const isEditing = editingRow && editingRow[pk] === row[pk]
                    const isSelected = selectedUser?.id_usuario === row.id_usuario
                    return (
                      <tr key={idx}
                        className={`border-b border-slate-50 transition ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                        onClick={() => selectedTable === 'usuarios' && !isEditing ? setSelectedUser(row) : null}
                        style={{ cursor: selectedTable === 'usuarios' && !isEditing ? 'pointer' : 'default' }}
                      >
                        {columns.map(col => (
                          <td key={col} className="px-4 py-2.5 text-slate-600 max-w-[180px]"
                            onClick={e => isEditing && e.stopPropagation()}>
                            {renderCell(row[col], col, isEditing, editValues, setEditValues)}
                          </td>
                        ))}
                        <td className="px-4 py-2.5 sticky right-0 bg-white dark:bg-[rgb(22_27_34)]" onClick={e => e.stopPropagation()}>
                          {isEditing ? (
                            <div className="flex gap-1.5">
                              <button onClick={saveEdit}
                                className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                                Save
                              </button>
                              <button onClick={() => setEditingRow(null)}
                                className="rounded bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-300">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-1.5">
                              {selectedTable === 'usuarios' && (
                                <>
                                  <button onClick={() => toggleAdmin(row)}
                                    className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                                      row.adminstate ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                    }`}>
                                    {row.adminstate ? '−Admin' : '+Admin'}
                                  </button>
                                  {row.user_type === 'enterprise' && (
                                    <button onClick={() => toggleVerified(row)}
                                      className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                                        row.verified ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                      }`}>
                                      {row.verified ? '✓ Verified' : 'Verify'}
                                    </button>
                                  )}
                                </>
                              )}
                              <button onClick={() => startEdit(row)}
                                className="rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                                Edit
                              </button>
                              <button onClick={() => handleDelete(row)}
                                className="rounded bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100">
                                Del
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>)}

        {/* ── TICKETS TAB ── */}
        {activeTab === 'tickets' && (
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            {/* Ticket list */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">All tickets</p>
                <button onClick={fetchTickets} className="text-xs text-slate-400 hover:text-slate-700">Reload</button>
              </div>
              <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
                {tickets.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">No tickets</p>
                ) : tickets.map(t => {
                  const u = t.usuarios
                  const statusColor = t.estado === 'open' ? 'bg-emerald-100 text-emerald-700' : t.estado === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                  return (
                    <button key={t.id_ticket} onClick={() => selectTicket(t)}
                      className={`w-full text-left px-4 py-3 transition ${selectedTicket?.id_ticket === t.id_ticket ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor}`}>{t.estado}</span>
                        <span className="text-xs text-slate-400">{new Date(t.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-700 truncate">{t.asunto}</p>
                      {u && <p className="text-xs text-slate-400 mt-0.5">{u.nombre_display || u.nombre || u.email}</p>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Chat panel */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col" style={{ minHeight: 480 }}>
              {!selectedTicket ? (
                <div className="flex flex-1 items-center justify-center text-slate-400 text-sm">
                  Select a ticket to view the conversation
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div>
                      <p className="font-semibold text-slate-800">{selectedTicket.asunto}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {selectedTicket.usuarios?.email || selectedTicket.id_usuario}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {selectedTicket.estado !== 'closed' && (
                        <button onClick={() => closeTicket(selectedTicket.id_ticket)}
                          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition">
                          Close ticket
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ maxHeight: 380 }}>
                    {ticketMessages.map((m, i) => {
                      const isAdminMsg = m.es_admin
                      return (
                        <div key={i} className={`flex gap-3 ${isAdminMsg ? 'flex-row-reverse' : ''}`}>
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            isAdminMsg ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {isAdminMsg ? 'A' : (m.usuarios?.nombre || 'U').substring(0, 1).toUpperCase()}
                          </div>
                          <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                            isAdminMsg ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-800'
                          }`}>
                            <p>{m.mensaje}</p>
                            <p className="text-xs mt-1 opacity-60">
                              {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={ticketEndRef} />
                  </div>

                  {selectedTicket.estado !== 'closed' && (
                    <form onSubmit={sendReply} className="border-t border-slate-100 p-4 flex gap-3">
                      <input type="text" value={ticketReply} onChange={e => setTicketReply(e.target.value)}
                        placeholder="Reply as admin..."
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-slate-400"
                        required />
                      <button type="submit" disabled={sendingReply}
                        className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 transition disabled:opacity-50">
                        {sendingReply ? '...' : 'Reply'}
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        )}

      </main>

      <Footer />
    </div>
  )
}

export default AdminApp
