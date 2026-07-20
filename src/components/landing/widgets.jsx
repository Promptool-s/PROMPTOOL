import { useEffect, useState, useRef } from 'react'
import gsap from 'gsap'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// Shared glass-card class for the light hybrid theme
export const GLASS = 'border border-slate-900/10 bg-white/70 backdrop-blur-md shadow-sm shadow-slate-900/[0.03]'
export const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 focus-visible:outline-offset-2'

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const pointerFine = () =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches

// ── CountUp ────────────────────────────────────────────────────────────────
// Animates a numeric value up from 0 while preserving its prefix/suffix
// (e.g. '74%', '#38', '+48', '1420'). Drives textContent via a ref so React
// never re-renders per frame. Starts at 0, counts up once `active` is true.
const parseValue = (raw) => {
  const m = String(raw).match(/^(\D*?)(-?[\d.]+)(\D*)$/)
  if (!m) return null
  return { prefix: m[1], num: parseFloat(m[2]), suffix: m[3], decimals: (m[2].split('.')[1] || '').length }
}

export const CountUp = ({ value, active, duration = 1.3, className }) => {
  const ref = useRef(null)
  const [selfActive, setSelfActive] = useState(false)
  const controlled = active !== undefined
  const parsed = parseValue(value)
  const reduce = prefersReduced()
  const initial = !parsed || reduce ? value : parsed.prefix + '0' + parsed.suffix

  // Self-trigger on viewport enter when `active` isn't supplied by the parent.
  useEffect(() => {
    if (controlled || reduce || !parsed) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSelfActive(true); io.disconnect() }
    }, { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [controlled, reduce]) // eslint-disable-line react-hooks/exhaustive-deps

  const isActive = controlled ? active : selfActive

  useEffect(() => {
    const el = ref.current
    if (!el || !parsed || reduce) return
    const { prefix, num, suffix, decimals } = parsed
    const render = (n) => { el.textContent = prefix + (decimals ? n.toFixed(decimals) : Math.round(n)) + suffix }
    if (!isActive) { render(0); return }
    const obj = { n: 0 }
    const tween = gsap.to(obj, { n: num, duration, ease: 'power2.out', onUpdate: () => render(obj.n) })
    return () => tween.kill()
  }, [value, isActive, duration]) // eslint-disable-line react-hooks/exhaustive-deps

  return <span ref={ref} className={className}>{initial}</span>
}

// ── useTilt ──────────────────────────────────────────────────────────────
// Subtle pointer-reactive 3D tilt for showcase cards. quickTo caches the
// tweens so there is zero per-frame allocation. Pointer-fine + motion only.
export const useTilt = ({ max = 6, enabled = true } = {}) => {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled || !pointerFine() || prefersReduced()) return
    gsap.set(el, { transformPerspective: 900, transformStyle: 'preserve-3d', willChange: 'transform' })
    const rotX = gsap.quickTo(el, 'rotationX', { duration: 0.5, ease: 'power2.out' })
    const rotY = gsap.quickTo(el, 'rotationY', { duration: 0.5, ease: 'power2.out' })
    const onMove = (e) => {
      const r = el.getBoundingClientRect()
      rotY(((e.clientX - r.left) / r.width - 0.5) * max)
      rotX(-((e.clientY - r.top) / r.height - 0.5) * max)
    }
    const onLeave = () => { rotX(0); rotY(0) }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      gsap.set(el, { clearProps: 'transform,transformPerspective,transformStyle,willChange' })
    }
  }, [max, enabled])
  return ref
}

// ── useMagnetic + MagneticButton ─────────────────────────────────────────
// Element eases toward the cursor and springs back on leave. Applied to a
// wrapper span so the button keeps its own hover/active transforms.
export const useMagnetic = ({ strength = 0.3, max = 14, enabled = true } = {}) => {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled || !pointerFine() || prefersReduced()) return
    const xTo = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3.out' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' })
    const clamp = (v) => Math.max(-max, Math.min(max, v))
    const onMove = (e) => {
      const r = el.getBoundingClientRect()
      xTo(clamp((e.clientX - (r.left + r.width / 2)) * strength))
      yTo(clamp((e.clientY - (r.top + r.height / 2)) * strength))
    }
    const onLeave = () => { xTo(0); yTo(0) }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      gsap.set(el, { clearProps: 'transform' })
    }
  }, [strength, max, enabled])
  return ref
}

export const MagneticButton = ({ children, className, enabled = true, ...props }) => {
  const ref = useMagnetic({ enabled })
  return (
    <span ref={ref} className="inline-flex will-change-transform">
      <button className={className} {...props}>{children}</button>
    </span>
  )
}

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
    <div ref={statsRef} className="grid grid-cols-2 gap-3">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`rounded-xl border border-slate-900/[0.06] bg-white/70 p-4 ${
            isVisible ? 'animate-in fade-in slide-in-from-bottom-4' : 'opacity-0'
          }`}
          style={{ animationDelay: `${i * 100}ms`, animationDuration: '600ms', animationFillMode: 'both' }}
        >
          <p className={`text-2xl font-black tabular-nums ${stat.color}`}><CountUp value={stat.value} active={isVisible} /></p>
          <p className="mt-1 text-xs font-medium text-slate-500">{stat.label}</p>
          <span className="sr-only">{stat.desc}</span>
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
              <stop offset="5%" stopColor="#0891b2" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[0, 100]} />
          <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 8, fontSize: 11, color: '#0f172a' }} formatter={v => [`${v}%`, 'Score']} />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#0891b2"
            strokeWidth={2}
            fill="url(#sg)"
            dot={{ r: 3, fill: '#0891b2', strokeWidth: 0 }}
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
    <svg className="h-5 w-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      {paths[type].split('M').filter(Boolean).map((d, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" d={`M${d}`} />
      ))}
    </svg>
  )
}
