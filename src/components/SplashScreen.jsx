import { useEffect, useRef, useState } from 'react'

const WORD = 'PrompTool'
const CYAN_START = 5 // 'Promp' negro, 'Tool' cyan

// Velocidad de escritura: ms por carácter
const CHAR_DELAY = 80

const SplashScreen = ({ onDone = () => {} }) => {
  const [visibleChars, setVisibleChars] = useState(0)
  const [fadeOut, setFadeOut] = useState(false)
  const rafRef = useRef(null)
  const startRef = useRef(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    // Esperar 200ms antes de empezar a escribir
    const startDelay = setTimeout(() => {
      startRef.current = performance.now()

      const tick = (now) => {
        const elapsed = now - startRef.current
        // Cuántos caracteres deberían estar visibles a este tiempo
        const chars = Math.min(
          Math.floor(elapsed / CHAR_DELAY) + 1,
          WORD.length
        )
        setVisibleChars(chars)

        if (chars < WORD.length) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          // Terminó de escribir → esperar 500ms → fade out
          setTimeout(() => {
            setFadeOut(true)
            // Llamar onDone después del fade out (600ms)
            setTimeout(() => onDoneRef.current(), 650)
          }, 500)
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }, 200)

    return () => {
      clearTimeout(startDelay)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const dark = '#0f172a'
  const cyan = '#06b6d4'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        opacity: fadeOut ? 0 : 1,
        transition: fadeOut ? 'opacity 0.6s ease-in' : 'opacity 0.3s ease-out',
        pointerEvents: fadeOut ? 'none' : 'all',
      }}
    >
      {/* Blobs de fondo */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {[
          { size: 320, top: '8%',  left: '10%',  color: '#06b6d4', dur: 3.2 },
          { size: 200, top: '65%', left: '78%',  color: '#7c3aed', dur: 4.1 },
          { size: 160, top: '80%', left: '18%',  color: '#06b6d4', dur: 3.6 },
          { size: 260, top: '15%', left: '82%',  color: '#7c3aed', dur: 4.8 },
          { size: 140, top: '50%', left: '50%',  color: '#06b6d4', dur: 3.0 },
        ].map((b, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: b.size, height: b.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${b.color}20, transparent 70%)`,
            top: b.top, left: b.left,
            transform: 'translate(-50%, -50%)',
            animation: `splashPulse ${b.dur}s ease-in-out infinite`,
            animationDelay: `${i * 0.3}s`,
          }} />
        ))}
      </div>

      {/* Contenido central */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>

        {/* Wordmark con escritura letra a letra */}
        <div style={{
          fontSize: 'clamp(2.8rem, 9vw, 4.5rem)',
          fontWeight: 900,
          letterSpacing: '-0.03em',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          lineHeight: 1,
          minWidth: '6ch', // evita layout shift
          display: 'flex',
          alignItems: 'baseline',
        }}>
          {WORD.split('').slice(0, visibleChars).map((char, i) => (
            <span
              key={i}
              style={{
                color: i >= CYAN_START ? cyan : dark,
                display: 'inline-block',
                animation: 'charPop 0.15s cubic-bezier(0.34,1.56,0.64,1) both',
              }}
            >
              {char}
            </span>
          ))}
          {/* Cursor parpadeante — solo mientras escribe */}
          {visibleChars < WORD.length && (
            <span style={{
              display: 'inline-block',
              width: '0.08em',
              height: '0.85em',
              background: cyan,
              marginLeft: 2,
              borderRadius: 2,
              animation: 'cursorBlink 0.7s step-end infinite',
              verticalAlign: 'middle',
            }} />
          )}
        </div>

        {/* Tagline — aparece cuando termina de escribir */}
        <p style={{
          fontSize: '0.65rem',
          fontWeight: 600,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#94a3b8',
          fontFamily: 'system-ui, sans-serif',
          opacity: visibleChars >= WORD.length ? 1 : 0,
          transform: visibleChars >= WORD.length ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
        }}>
          Descifra el prompt. Domina la IA.
        </p>

        {/* Barra de progreso — se llena mientras escribe */}
        <div style={{ width: 100, height: 2, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden', marginTop: 2 }}>
          <div style={{
            height: '100%',
            borderRadius: 99,
            background: `linear-gradient(90deg, ${cyan}, #7c3aed)`,
            width: `${(visibleChars / WORD.length) * 100}%`,
            transition: `width ${CHAR_DELAY}ms linear`,
          }} />
        </div>
      </div>

      <style>{`
        @keyframes splashPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.4; }
          50% { transform: translate(-50%, -50%) scale(1.18); opacity: 0.9; }
        }
        @keyframes charPop {
          from { opacity: 0; transform: translateY(4px) scale(0.9); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}

export default SplashScreen
