import { useEffect, useState, useRef } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// Shared glass-card class for the dark hybrid theme
export const GLASS = 'border border-white/10 bg-white/[0.04] backdrop-blur-md'
export const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 focus-visible:outline-offset-2'

// ── Animated Stats Component ──────────────────────────────────────────────
export const AnimatedStats = ({ stats }) => {
  const [isVisible, setIsVisible] = useState(false)
  const statsRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true)
        }
      },
      { threshold: 0.3 }
    )

    if (statsRef.current) {
      observer.observe(statsRef.current)
    }

    return () => observer.disconnect()
  }, [isVisible])

  return (
    <div ref={statsRef} className="grid grid-cols-2 gap-4">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`rounded-xl p-5 ${GLASS} group relative transition-all duration-300 hover:scale-105 hover:bg-white/[0.07] ${
            isVisible ? 'animate-in fade-in slide-in-from-bottom-4' : 'opacity-0'
          }`}
          style={{ animationDelay: `${i * 100}ms`, animationDuration: '600ms', animationFillMode: 'both' }}
          title={stat.desc}
        >
          <p className={`text-3xl font-bold tabular-nums ${stat.color} transition-transform duration-300 group-hover:scale-110`}>
            {stat.value}
          </p>
          <p className="text-sm mt-2 text-slate-400">{stat.label}</p>

          {/* Tooltip on hover */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 bg-slate-800 text-slate-200 shadow-lg z-10">
            {stat.desc}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Chart ──────────────────────────────────────────────────────────────────
const CHART_DATA = [
  { day: 'M', score: 42 }, { day: 'T', score: 55 }, { day: 'W', score: 51 },
  { day: 'T', score: 68 }, { day: 'F', score: 63 }, { day: 'S', score: 74 },
  { day: 'S', score: 81 },
]

export const StatsChart = ({ ariaLabel }) => {
  const [isVisible, setIsVisible] = useState(false)
  const chartRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true)
        }
      },
      { threshold: 0.3 }
    )

    if (chartRef.current) {
      observer.observe(chartRef.current)
    }

    return () => observer.disconnect()
  }, [isVisible])

  return (
    <div ref={chartRef} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={110}>
        <AreaChart data={CHART_DATA} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[0, 100]} />
          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11, color: '#e2e8f0' }} formatter={v => [`${v}%`, 'Score']} />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#22d3ee"
            strokeWidth={2}
            fill="url(#sg)"
            dot={{ r: 3, fill: '#22d3ee', strokeWidth: 0 }}
            isAnimationActive={isVisible}
            animationDuration={1200}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Org icons (no emoji) ───────────────────────────────────────────────────
export const OrgIcon = ({ type }) => {
  const paths = {
    building: 'M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V12h6v9',
    graduation: 'M12 14l9-5-9-5-9 5 9 5zm0 0v6m-4-3.5l4 2 4-2',
    chart: 'M3 3v18h18M7 16l4-4 4 4 4-6',
    target: 'M12 12m-3 0a3 3 0 106 0 3 3 0 00-6 0M12 2v2m0 16v2M2 12h2m16 0h2',
    link: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
    trophy: 'M8 21h8m-4-4v4M5 3h14l-1 7a5 5 0 01-10 0L5 3zm0 0H3m16 0h2',
  }
  return (
    <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      {paths[type].split('M').filter(Boolean).map((d, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" d={`M${d}`} />
      ))}
    </svg>
  )
}
