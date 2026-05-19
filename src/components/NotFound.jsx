import React from 'react'

// Partículas flotantes de fondo
const Particle = ({ style }) => (
  <div
    className="absolute rounded-full opacity-20 pointer-events-none"
    style={style}
  />
)

const PARTICLES = [
  { width: 6,  height: 6,  top: '12%', left: '8%',  background: '#2dd4bf', animationDelay: '0s',    animationDuration: '6s'  },
  { width: 4,  height: 4,  top: '25%', left: '88%', background: '#818cf8', animationDelay: '1.2s',  animationDuration: '8s'  },
  { width: 8,  height: 8,  top: '60%', left: '5%',  background: '#38bdf8', animationDelay: '0.5s',  animationDuration: '7s'  },
  { width: 5,  height: 5,  top: '75%', left: '92%', background: '#2dd4bf', animationDelay: '2s',    animationDuration: '9s'  },
  { width: 3,  height: 3,  top: '40%', left: '95%', background: '#818cf8', animationDelay: '0.8s',  animationDuration: '5s'  },
  { width: 7,  height: 7,  top: '85%', left: '20%', background: '#38bdf8', animationDelay: '1.8s',  animationDuration: '10s' },
  { width: 4,  height: 4,  top: '18%', left: '55%', background: '#2dd4bf', animationDelay: '3s',    animationDuration: '7s'  },
  { width: 5,  height: 5,  top: '50%', left: '75%', background: '#818cf8', animationDelay: '0.3s',  animationDuration: '6s'  },
]

export default function NotFound() {
  return (
    <div className="relative min-h-screen bg-[rgb(var(--color-canvas))] flex flex-col overflow-hidden">

      {/* Partículas de fondo */}
      <style>{`
        @keyframes float-up {
          0%   { transform: translateY(0px) scale(1);   opacity: 0.15; }
          50%  { transform: translateY(-18px) scale(1.2); opacity: 0.25; }
          100% { transform: translateY(0px) scale(1);   opacity: 0.15; }
        }
        @keyframes not-found-in {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes glitch-404 {
          0%, 90%, 100% { text-shadow: none; transform: none; }
          92% { text-shadow: -3px 0 #2dd4bf, 3px 0 #818cf8; transform: skewX(-2deg); }
          94% { text-shadow:  3px 0 #2dd4bf,-3px 0 #818cf8; transform: skewX( 2deg); }
          96% { text-shadow: none; transform: none; }
          98% { text-shadow: -1px 0 #38bdf8; transform: skewX(-0.5deg); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(6,182,212,0.35); }
          70%  { transform: scale(1);    box-shadow: 0 0 0 16px rgba(6,182,212,0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(6,182,212,0); }
        }
        .not-found-in  { animation: not-found-in 0.6s cubic-bezier(0.4,0,0.2,1) both; }
        .glitch-404    { animation: glitch-404 7s infinite; }
        .pulse-ring    { animation: pulse-ring 2.5s ease-out infinite; }
      `}</style>

      {PARTICLES.map((p, i) => (
        <Particle
          key={i}
          style={{
            width:             p.width,
            height:            p.height,
            top:               p.top,
            left:              p.left,
            background:        p.background,
            animation:         `float-up ${p.animationDuration} ease-in-out infinite`,
            animationDelay:    p.animationDelay,
          }}
        />
      ))}

      {/* Gradiente radial de fondo sutil */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(6,182,212,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Header — igual al del resto de la app */}
      <header className="relative z-10 sticky top-0 border-b border-slate-200/90 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
          <a href="/" className="shrink-0 flex items-center gap-2 transition-opacity hover:opacity-80">
            <span className="text-lg font-bold tracking-tight text-slate-900">Promp<span style={{ color: 'rgb(var(--color-accent))' }}>Tool</span></span>
          </a>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-20">
        <div
          className="not-found-in flex flex-col items-center text-center max-w-lg"
          style={{ animationDelay: '0.1s' }}
        >

          {/* Logo con pulse ring */}
          <div className="pulse-ring mb-8 rounded-2xl p-4 bg-white border border-slate-200/80 shadow-xl">
            <img src="/favicon.png" alt="PrompTool" className="w-14 h-14 object-contain" />
          </div>

          {/* 404 con efecto glitch */}
          <h1
            className="glitch-404 text-[7rem] font-black leading-none tracking-tighter text-slate-900 select-none"
            style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            4<span style={{ color: 'rgb(var(--color-accent))' }}>0</span>4
          </h1>

          {/* Mensaje */}
          <p className="mt-4 text-xl font-semibold text-slate-800">
            Página no encontrada
          </p>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-sm">
            La página que buscás no existe o fue movida.
          </p>

          {/* Separador decorativo */}
          <div className="my-8 flex items-center gap-3 w-full max-w-xs">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
            <div className="flex gap-1">
              {[0,1,2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: ['#2dd4bf','#38bdf8','#818cf8'][i],
                    opacity: 0.7,
                  }}
                />
              ))}
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          </div>

          {/* Acciones */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs">
            <a
              href="/"
              className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Volver al inicio
            </a>
            <a
              href="/guides"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:scale-[1.02] active:scale-[0.98]"
            >
              Ver guías
            </a>
          </div>

          {/* Links rápidos */}
          <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-400">
            {[
              { href: '/',            label: 'Jugar'       },
              { href: '/leaderboard', label: 'Ranking'     },
              { href: '/guides',      label: 'Guías'       },
              { href: '/support',     label: 'Soporte'     },
            ].map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="transition hover:text-slate-700 hover:underline underline-offset-2"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </main>

      {/* Footer mínimo */}
      <footer className="relative z-10 border-t border-slate-200/70 bg-white/60 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <p className="text-center text-xs text-slate-400">
            © 2026 PrompTool Team. All rights reserved.
          </p>
        </div>
      </footer>

    </div>
  )
}
