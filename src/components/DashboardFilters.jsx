import { useState } from 'react'
import { proxyImg } from '../utils/imgProxy'

const DashboardFilters = ({ onFilterChange, teamUsers, lang }) => {
  const [filters, setFilters] = useState({
    dateRange: '30', // '7' | '30' | '90' | 'all'
    members: [], // array de user IDs
    minScore: 0,
    maxScore: 100,
    difficulty: 'all', // 'all' | 'Easy' | 'Medium' | 'Hard'
    sortBy: 'elo', // 'elo' | 'attempts' | 'avg_score' | 'recent'
    showInactive: false, // mostrar miembros sin actividad
  })

  const [expanded, setExpanded] = useState(false)

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handleMemberToggle = (userId) => {
    const newMembers = filters.members.includes(userId)
      ? filters.members.filter(id => id !== userId)
      : [...filters.members, userId]
    handleFilterChange('members', newMembers)
  }

  const resetFilters = () => {
    const defaultFilters = {
      dateRange: '30',
      members: [],
      minScore: 0,
      maxScore: 100,
      difficulty: 'all',
      sortBy: 'elo',
      showInactive: false,
    }
    setFilters(defaultFilters)
    onFilterChange(defaultFilters)
  }

  const activeFiltersCount = 
    (filters.members.length > 0 ? 1 : 0) +
    (filters.minScore > 0 ? 1 : 0) +
    (filters.maxScore < 100 ? 1 : 0) +
    (filters.difficulty !== 'all' ? 1 : 0) +
    (filters.dateRange !== '30' ? 1 : 0) +
    (filters.showInactive ? 1 : 0)

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            {lang === 'en' ? 'Filters' : 'Filtros'}
          </h3>
          {activeFiltersCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-violet-500 text-xs font-bold text-white">
              {activeFiltersCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              onClick={resetFilters}
              className="text-xs font-medium text-violet-600 hover:text-violet-700 transition"
            >
              {lang === 'en' ? 'Reset' : 'Resetear'}
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <svg className={`h-5 w-5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Quick filters (always visible) */}
      <div className="flex flex-wrap gap-2 mb-3">
        {/* Date range */}
        <select
          value={filters.dateRange}
          onChange={e => handleFilterChange('dateRange', e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition hover:border-slate-300"
        >
          <option value="7">{lang === 'en' ? 'Last 7 days' : 'Últimos 7 días'}</option>
          <option value="30">{lang === 'en' ? 'Last 30 days' : 'Últimos 30 días'}</option>
          <option value="90">{lang === 'en' ? 'Last 90 days' : 'Últimos 90 días'}</option>
          <option value="all">{lang === 'en' ? 'All time' : 'Todo el tiempo'}</option>
        </select>

        {/* Sort by */}
        <select
          value={filters.sortBy}
          onChange={e => handleFilterChange('sortBy', e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition hover:border-slate-300"
        >
          <option value="elo">{lang === 'en' ? 'By ELO' : 'Por ELO'}</option>
          <option value="attempts">{lang === 'en' ? 'By Attempts' : 'Por Intentos'}</option>
          <option value="avg_score">{lang === 'en' ? 'By Avg Score' : 'Por Score Promedio'}</option>
          <option value="recent">{lang === 'en' ? 'Most Recent' : 'Más Recientes'}</option>
        </select>

        {/* Difficulty */}
        <select
          value={filters.difficulty}
          onChange={e => handleFilterChange('difficulty', e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition hover:border-slate-300"
        >
          <option value="all">{lang === 'en' ? 'All Difficulties' : 'Todas las Dificultades'}</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>
      </div>

      {/* Advanced filters (collapsible) */}
      {expanded && (
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          {/* Score range */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              {lang === 'en' ? 'Score Range' : 'Rango de Score'}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={filters.minScore}
                onChange={e => handleFilterChange('minScore', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                min="0"
                max="100"
                className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300"
                placeholder="Min"
              />
              <span className="text-xs text-slate-400">—</span>
              <input
                type="number"
                value={filters.maxScore}
                onChange={e => handleFilterChange('maxScore', Math.max(0, Math.min(100, parseInt(e.target.value) || 100)))}
                min="0"
                max="100"
                className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300"
                placeholder="Max"
              />
            </div>
          </div>

          {/* Member selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              {lang === 'en' ? 'Filter by Members' : 'Filtrar por Miembros'}
            </label>
            <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2">
              {teamUsers.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2">
                  {lang === 'en' ? 'No members yet' : 'Sin miembros aún'}
                </p>
              ) : (
                <>
                  <button
                    onClick={() => handleFilterChange('members', [])}
                    className={`w-full text-left rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                      filters.members.length === 0
                        ? 'bg-violet-500 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {lang === 'en' ? 'All Members' : 'Todos los Miembros'} ({teamUsers.length})
                  </button>
                  {teamUsers.map(member => (
                    <button
                      key={member.id_usuario}
                      onClick={() => handleMemberToggle(member.id_usuario)}
                      className={`w-full text-left rounded-lg px-2 py-1.5 text-xs transition flex items-center gap-2 ${
                        filters.members.includes(member.id_usuario)
                          ? 'bg-violet-500 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {member.avatar_url && (
                        <img src={proxyImg(member.avatar_url)} alt="" className="h-4 w-4 rounded-full object-cover" />
                      )}
                      <span className="truncate">{member.nombre_display || member.nombre || member.username || member.email}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Show inactive */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.showInactive}
              onChange={e => handleFilterChange('showInactive', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {lang === 'en' ? 'Show inactive members' : 'Mostrar miembros inactivos'}
            </span>
          </label>
        </div>
      )}
    </div>
  )
}

export default DashboardFilters
