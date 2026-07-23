import { useEffect, useState, useRef } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import { useAuth } from './hooks/useAuth'
import { api } from './lib/apiClient'
import { proxyImg } from './utils/imgProxy'

// Verificación server-side: /usuarios/me trae adminstate/devstate desde la BD (no metadata).
async function checkIsAdmin(userId) {
  if (!userId) return false
  try {
    const me = await api.get('/usuarios/me')
    return me?.adminstate === true || me?.devstate === true
  } catch { return false }
}

// Columnas de stats que el backend permite sobrescribir (PATCH /admin/usuarios/:id/stats).
const STAT_COLS = ['total_intentos', 'promedio_score', 'mejor_score', 'peor_score', 'porcentaje_aprobacion', 'racha_actual']

function AdminApp() {
  const { user, loading: authLoading } = useAuth()
  const [adminChecked, setAdminChecked] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const [tableData, setTableData] = useState([])
  const [columns, setColumns] = useState([])
  const [loading, setLoading] = useState(false)

  const [editingRow, setEditingRow] = useState(null)
  const [editValues, setEditValues] = useState({})

  const [search, setSearch] = useState('')
  const [serverSearch, setServerSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)

  // Tickets
  const [activeTab, setActiveTab] = useState('tables') // 'tables' | 'tickets' | 'reports'
  const [tickets, setTickets] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [ticketMessages, setTicketMessages] = useState([])
  const [ticketReply, setTicketReply] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const ticketEndRef = useRef(null)

  // Reports
  const [reports, setReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [selectedReport, setSelectedReport] = useState(null)
  const [reportReply, setReportReply] = useState('')
  const [sendingReportReply, setSendingReportReply] = useState(false)

  const [toast, setToast] = useState(null)
  const hasRedirected = useRef(false)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── TICKETS ──
  const fetchTickets = async () => {
    try {
      const data = await api.get('/tickets/todos')
      setTickets(data || [])
    } catch { setTickets([]) }
  }

  const fetchTicketMessages = async (id_ticket) => {
    try {
      const data = await api.get(`/tickets/${id_ticket}/mensajes`)
      setTicketMessages(data || [])
    } catch { setTicketMessages([]) }
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
      await api.post(`/tickets/${selectedTicket.id_ticket}/mensajes`, { mensaje: ticketReply })
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
    try {
      await api.patch(`/tickets/${id_ticket}/cerrar`, {})
      fetchTickets()
      if (selectedTicket?.id_ticket === id_ticket) setSelectedTicket(t => ({ ...t, estado: 'closed' }))
      showToast('Ticket closed')
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    }
  }

  // ── REPORTS ──
  const fetchReports = async () => {
    setReportsLoading(true)
    try {
      const data = await api.get('/admin/reportes')
      setReports(data || [])
    } catch {
      setReports([])
    } finally {
      setReportsLoading(false)
    }
  }

  const deleteReport = async (id) => {
    if (!confirm('Delete this report?')) return
    try {
      await api.del(`/admin/reportes/${id}`)
      setReports(prev => prev.filter(r => r.id !== id))
      if (selectedReport?.id === id) setSelectedReport(null)
      showToast('Report deleted')
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    }
  }

  const updateReportStatus = async (id, status) => {
    try {
      await api.patch(`/admin/reportes/${id}`, { status })
      setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r))
      if (selectedReport?.id === id) setSelectedReport(r => ({ ...r, status }))
      showToast(`Marked as ${status}`)
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    }
  }

  const sendReportResponse = async (e) => {
    e.preventDefault()
    if (!reportReply.trim() || !selectedReport) return
    setSendingReportReply(true)
    try {
      await api.patch(`/admin/reportes/${selectedReport.id}`, {
        status: 'reviewed',
        reviewer_notes: reportReply,
      })
      setReports(prev => prev.map(r => r.id === selectedReport.id
        ? { ...r, status: 'reviewed', reviewer_notes: reportReply }
        : r))
      setSelectedReport(r => ({ ...r, status: 'reviewed', reviewer_notes: reportReply }))
      setReportReply('')
      showToast('Response sent')
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    } finally {
      setSendingReportReply(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'reports' && adminChecked && isAdmin) fetchReports()
  }, [activeTab, adminChecked, isAdmin])

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
    if (adminChecked && isAdmin && activeTab === 'tables') fetchTableData(serverSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminChecked, isAdmin, activeTab])

  // Solo gestión de usuarios: el backend expone GET /admin/usuarios (con search),
  // no CRUD arbitrario de tablas. La navegación libre de tablas + SQL fue removida
  // a propósito (era el agujero de seguridad que cierra la migración).
  const fetchTableData = async (searchTerm = serverSearch) => {
    setLoading(true)
    setEditingRow(null)
    setSelectedUser(null)
    try {
      const qs = searchTerm.trim() ? `?limit=200&search=${encodeURIComponent(searchTerm.trim())}` : '?limit=200'
      const data = await api.get(`/admin/usuarios${qs}`)
      const rows = Array.isArray(data) ? data : (data?.usuarios || [])
      setTableData(rows)
      setColumns(rows.length ? Object.keys(rows[0]) : [])
    } catch (err) {
      showToast('Error loading: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // ── EDIT (solo columnas de stats permitidas por el backend) ──
  const startEdit = (row) => {
    setEditingRow(row)
    setEditValues({ ...row })
  }

  const saveEdit = async () => {
    try {
      const stats = {}
      for (const col of STAT_COLS) {
        if (editValues[col] !== undefined && editValues[col] !== editingRow[col]) {
          const num = Number(editValues[col])
          stats[col] = Number.isNaN(num) ? editValues[col] : num
        }
      }
      if (Object.keys(stats).length === 0) { setEditingRow(null); return }
      await api.patch(`/admin/usuarios/${editingRow.id_usuario}/stats`, stats)
      showToast('Stats updated')
      setEditingRow(null)
      fetchTableData(serverSearch)
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    }
  }

  // ── TOGGLE FLAG (adminstate | verified | devstate) ──
  const toggleFlag = async (row, campo, labels) => {
    const newVal = !row[campo]
    try {
      await api.patch(`/admin/usuarios/${row.id_usuario}`, { campo, valor: newVal })
      showToast(newVal ? labels.on : labels.off)
      setTableData(prev => prev.map(r => r.id_usuario === row.id_usuario ? { ...r, [campo]: newVal } : r))
      if (selectedUser?.id_usuario === row.id_usuario) setSelectedUser({ ...selectedUser, [campo]: newVal })
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    }
  }

  const toggleAdmin = (row) => toggleFlag(row, 'adminstate', { on: 'Admin granted', off: 'Admin removed' })
  const toggleVerified = (row) => toggleFlag(row, 'verified', { on: 'Empresa verificada', off: 'Verificacion removida' })
  const toggleDev = (row) => toggleFlag(row, 'devstate', { on: 'Dev granted', off: 'Dev removed' })

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
            <p className="text-sm text-slate-500 mt-0.5">User management</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700 uppercase tracking-wide">Admin</span>
          </div>
        </div>

        {/* Main tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-0">
          {['tables', 'tickets', 'reports'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition -mb-px ${
                activeTab === tab ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {tab === 'tables' ? 'Users'
                : tab === 'tickets' ? `Tickets ${tickets.filter(t => t.estado === 'open').length > 0 ? `(${tickets.filter(t => t.estado === 'open').length})` : ''}`
                : `Reports ${reports.filter(r => r.status === 'pending').length > 0 ? `(${reports.filter(r => r.status === 'pending').length})` : ''}`}
            </button>
          ))}
        </div>

        {/* Users tab */}
        {activeTab === 'tables' && (<>

        {/* User detail panel */}
        {selectedUser && (
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
              <button onClick={() => toggleDev(selectedUser)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  selectedUser.devstate ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                }`}>
                {selectedUser.devstate ? 'Remove dev' : 'Grant dev'}
              </button>
              {selectedUser.user_type === 'enterprise' && (
                <button onClick={() => toggleVerified(selectedUser)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    selectedUser.verified
                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  }`}>
                  {selectedUser.verified ? 'Verified — click to remove' : 'Verify company'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Main table */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-slate-800">usuarios</h2>
              <span className="text-xs text-slate-400">{filteredData.length} / {tableData.length} records</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Client-side text search (rows already loaded) */}
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Filter visible rows..."
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-slate-400 w-40" />
              {/* Server-side search (nombre/username/email) */}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={serverSearch}
                  onChange={e => setServerSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchTableData(serverSearch)}
                  placeholder="Search all users..."
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-indigo-400 w-52"
                />
                <button
                  onClick={() => fetchTableData(serverSearch)}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 transition"
                >
                  Search
                </button>
                {serverSearch && (
                  <button
                    onClick={() => { setServerSearch(''); fetchTableData('') }}
                    className="rounded-lg bg-slate-200 px-2.5 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-300 transition"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button onClick={() => fetchTableData(serverSearch)}
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
                    const isEditing = editingRow && editingRow.id_usuario === row.id_usuario
                    const isSelected = selectedUser?.id_usuario === row.id_usuario
                    return (
                      <tr key={idx}
                        className={`border-b border-slate-50 transition ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                        onClick={() => !isEditing ? setSelectedUser(row) : null}
                        style={{ cursor: !isEditing ? 'pointer' : 'default' }}
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
                              <button onClick={() => toggleAdmin(row)}
                                className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                                  row.adminstate ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                }`}>
                                {row.adminstate ? '−Admin' : '+Admin'}
                              </button>
                              <button onClick={() => toggleDev(row)}
                                className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                                  row.devstate ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                                }`}>
                                {row.devstate ? '−Dev' : '+Dev'}
                              </button>
                              {row.user_type === 'enterprise' && (
                                <button onClick={() => toggleVerified(row)}
                                  className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                                    row.verified ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                  }`}>
                                  {row.verified ? 'Verified' : 'Verify'}
                                </button>
                              )}
                              <button onClick={() => startEdit(row)}
                                className="rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                                Edit stats
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

        {/* ── REPORTS TAB ── */}
        {activeTab === 'reports' && (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            {/* Report list */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">
                  User reports
                  {reports.filter(r => r.status === 'pending').length > 0 && (
                    <span className="ml-2 rounded-full bg-rose-100 text-rose-700 px-2 py-0.5 text-xs font-bold">
                      {reports.filter(r => r.status === 'pending').length} pending
                    </span>
                  )}
                </p>
                <button onClick={fetchReports} className="text-xs text-slate-400 hover:text-slate-700">Reload</button>
              </div>
              <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
                {reportsLoading ? (
                  <div className="py-8 flex justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
                  </div>
                ) : reports.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">No reports</p>
                ) : reports.map(r => {
                  const reporter = r.reporter
                  const statusColor = r.status === 'pending'
                    ? 'bg-rose-100 text-rose-700'
                    : r.status === 'reviewed'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                  return (
                    <button key={r.id} onClick={() => setSelectedReport(r)}
                      className={`w-full text-left px-4 py-3 transition ${selectedReport?.id === r.id ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor}`}>{r.status}</span>
                        <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-700 truncate">
                        <span className="text-slate-400">{r.target_type}</span> — {r.reason}
                      </p>
                      {reporter && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {reporter.nombre_display || reporter.nombre || reporter.username || 'Anonymous'}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Report detail */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col" style={{ minHeight: 480 }}>
              {!selectedReport ? (
                <div className="flex flex-1 items-center justify-center text-slate-400 text-sm">
                  Select a report to review it
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          selectedReport.status === 'pending' ? 'bg-rose-100 text-rose-700'
                          : selectedReport.status === 'reviewed' ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                        }`}>{selectedReport.status}</span>
                        <span className="text-xs text-slate-400">{new Date(selectedReport.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="font-semibold text-slate-800 capitalize">{selectedReport.target_type} report</p>
                      <p className="text-sm text-slate-500 mt-0.5">Reason: <span className="font-medium text-slate-700">{selectedReport.reason}</span></p>
                      {selectedReport.target_id && (
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">Target ID: {selectedReport.target_id}</p>
                      )}
                      {selectedReport.reporter && (
                        <p className="text-xs text-slate-500 mt-1">
                          Reported by: <span className="font-medium">{selectedReport.reporter.nombre_display || selectedReport.reporter.nombre || selectedReport.reporter.username || 'Anonymous'}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => updateReportStatus(selectedReport.id, 'dismissed')}
                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => deleteReport(selectedReport.id)}
                        className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Reviewer notes if already reviewed */}
                  {selectedReport.reviewer_notes && (
                    <div className="mx-5 mt-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                      <p className="text-xs font-semibold text-emerald-700 mb-1">Admin response sent:</p>
                      <p className="text-sm text-emerald-800">{selectedReport.reviewer_notes}</p>
                    </div>
                  )}

                  <div className="flex-1" />

                  {/* Reply form */}
                  <form onSubmit={sendReportResponse} className="border-t border-slate-100 p-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {selectedReport.reporter_id ? 'Reply to reporter (sends notification)' : 'Add reviewer notes (anonymous reporter)'}
                    </p>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={reportReply}
                        onChange={e => setReportReply(e.target.value)}
                        placeholder={selectedReport.reporter_id ? 'Write a response...' : 'Internal notes...'}
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-slate-400"
                        required
                      />
                      <button
                        type="submit"
                        disabled={sendingReportReply}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition disabled:opacity-50"
                      >
                        {sendingReportReply ? '...' : selectedReport.reporter_id ? 'Send' : 'Save'}
                      </button>
                    </div>
                  </form>
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
