import { useEffect, useState } from 'react'
import { loadVisualMode } from './ConfigModal'

// Petal config — varied sizes, positions, speeds, drifts
const PETALS = [
  { size: 28, left:  3, delay: 0.0, dur: 6.2, drift:  18, rotate: 200 },
  { size: 18, left: 10, delay: 0.7, dur: 5.0, drift: -12, rotate: 280 },
  { size: 34, left: 18, delay: 1.4, dur: 7.1, drift:  25, rotate: 150 },
  { size: 22, left: 26, delay: 0.3, dur: 5.8, drift: -20, rotate: 320 },
  { size: 16, left: 34, delay: 2.1, dur: 4.9, drift:  15, rotate: 180 },
  { size: 30, left: 42, delay: 0.9, dur: 6.5, drift: -28, rotate: 240 },
  { size: 20, left: 50, delay: 1.8, dur: 5.3, drift:  22, rotate: 300 },
  { size: 26, left: 58, delay: 0.5, dur: 6.8, drift: -16, rotate: 130 },
  { size: 14, left: 66, delay: 2.5, dur: 4.7, drift:  30, rotate: 260 },
  { size: 32, left: 74, delay: 1.1, dur: 7.3, drift: -24, rotate: 190 },
  { size: 18, left: 82, delay: 0.2, dur: 5.6, drift:  20, rotate: 340 },
  { size: 24, left: 90, delay: 1.6, dur: 6.1, drift: -18, rotate: 210 },
  { size: 20, left:  7, delay: 3.0, dur: 5.4, drift:  14, rotate: 270 },
  { size: 28, left: 22, delay: 2.8, dur: 6.9, drift: -22, rotate: 160 },
  { size: 16, left: 47, delay: 3.5, dur: 5.1, drift:  26, rotate: 310 },
  { size: 22, left: 63, delay: 2.2, dur: 6.4, drift: -14, rotate: 230 },
  { size: 30, left: 78, delay: 3.8, dur: 7.0, drift:  19, rotate: 170 },
  { size: 18, left: 95, delay: 1.3, dur: 5.7, drift: -26, rotate: 290 },
]

const SakuraOverlay = () => {
  const [active, setActive] = useState(() => loadVisualMode() === 'sakura')
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const handler = () => {
      setActive(document.documentElement.classList.contains('mode-sakura'))
      setIsDark(document.documentElement.classList.contains('dark'))
    }
    const obs = new MutationObserver(handler)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  if (!active) return null

  // In dark mode: lighter, more translucent petals that blend with dark backgrounds
  const petalGradient = isDark
    ? 'linear-gradient(135deg, rgba(255,183,197,0.55) 0%, rgba(255,143,171,0.45) 50%, rgba(255,107,157,0.35) 100%)'
    : 'linear-gradient(135deg, rgba(255,183,197,0.85) 0%, rgba(255,143,171,0.75) 50%, rgba(255,107,157,0.65) 100%)'

  const petalShadow = isDark
    ? 'inset -1px -1px 3px rgba(255,100,140,0.15)'
    : 'inset -2px -2px 4px rgba(255,100,140,0.25), 0 1px 3px rgba(255,100,140,0.15)'

  // Max opacity during fall: lower in dark mode
  const maxOpacity = isDark ? 0.45 : 0.7

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9990] overflow-hidden"
    >
      <style>{`
        @keyframes sakura-fall {
          0%   { transform: translateY(-80px) translateX(0px) rotate(0deg); opacity: 0; }
          8%   { opacity: var(--max-opacity); }
          92%  { opacity: calc(var(--max-opacity) * 0.7); }
          100% { transform: translateY(105vh) translateX(var(--drift)) rotate(var(--rotate)); opacity: 0; }
        }
        .sakura-petal {
          position: absolute;
          border-radius: 150% 0 150% 0;
          animation: sakura-fall var(--dur) ease-in var(--delay) infinite;
          will-change: transform, opacity;
        }
      `}</style>

      {PETALS.map((p, i) => (
        <div
          key={i}
          className="sakura-petal"
          style={{
            width:  `${p.size}px`,
            height: `${p.size * 0.85}px`,
            left:   `${p.left}%`,
            top:    `-${p.size + 20}px`,
            background: petalGradient,
            boxShadow: petalShadow,
            '--dur':         `${p.dur}s`,
            '--delay':       `${p.delay}s`,
            '--drift':       `${p.drift}px`,
            '--rotate':      `${p.rotate}deg`,
            '--max-opacity': maxOpacity,
            opacity: 0,
          }}
        />
      ))}
    </div>
  )
}

export default SakuraOverlay
