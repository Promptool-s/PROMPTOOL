import React from 'react'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes nf-in {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes glitch {
          0%,89%,100% { text-shadow: none; transform: none; }
          90% { text-shadow: -4px 0 #06b6d4, 4px 0 #818cf8; transform: skewX(-2deg); }
          92% { text-shadow:  4px 0 #06b6d4,-4px 0 #818cf8; transform: skewX( 2deg); }
          94% { text-shadow: none; transform: none; }
          96% { text-shadow: -2px 0 #38bdf8; transform: skewX(-1deg); }
        }
        @keyframes pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(6,182,212,0.4); }
          50%      { box-shadow: 0 0 0 14px rgba(6,182,212,0); }
        }
        @keyframes float {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-10px); }
        }

        .nf-in    { animation: nf-in 0.7s cubic-bezier(0.4,0,0.2,1) both; }
        .glitch   { animation: glitch 8s infinite; }
        .pulse    { animation: pulse 2.5s ease-in-out infinite; }
        .float    { animation: float 4s ease-in-out infinite; }

        .nf-btn-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          background: linear-gradient(135deg, #06b6d4, #4f46e5);
          color: #fff; font-weight: 700; font-size: 15px;
          padding: 13px 28px; border-radius: 12px; text-decoration: none;
          border: none; cursor: pointer;
          transition: opacity 0.15s, transform 0.15s;
          box-shadow: 0 4px 14px rgba(6,182,212,0.35);
        }
        .nf-btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .nf-btn-primary:active { transform: translateY(0); }

        .nf-btn-secondary {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          background: #fff; color: #334155; font-weight: 600; font-size: 15px;
          padding: 13px 28px; border-radius: 12px; text-decoration: none;
          border: 1.5px solid #e2e8f0; cursor: pointer;
          transition: background 0.15s, transform 0.15s, border-color 0.15s;
        }
        .nf-btn-secondary:hover { background: #f8fafc; border-color: #cbd5e1; transform: translateY(-1px); }

        .nf-link {
          color: #94a3b8; font-size: 13px; text-decoration: none;
          transition: color 0.15s;
        }
        .nf-link:hover { color: #475569; text-decoration: underline; }
      `}</style>

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(226,232,240,0.9)',
        padding: '12px 24px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <a href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px', color: '#0f172a' }}>
              Promp<span style={{ color: '#06b6d4' }}>Tool</span>
            </span>
          </a>
        </div>
      </header>

      {/* Main */}
      <main style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '60px 24px',
        background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(6,182,212,0.07) 0%, transparent 70%)',
      }}>
        <div className="nf-in" style={{ textAlign: 'center', maxWidth: 520, width: '100%' }}>

          {/* Isotipo */}
          <div className="float" style={{ marginBottom: 32, display: 'inline-block' }}>
            <div className="pulse" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 96, height: 96,
              background: '#fff',
              borderRadius: 24,
              border: '1.5px solid #e2e8f0',
              boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
            }}>
              <img
                src="/favicon.png"
                alt="PrompTool"
                style={{ width: 64, height: 64, objectFit: 'contain' }}
              />
            </div>
          </div>

          {/* 404 */}
          <h1
            className="glitch"
            style={{
              fontSize: 'clamp(80px, 18vw, 140px)',
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: '-4px',
              color: '#0f172a',
              userSelect: 'none',
              marginBottom: 16,
            }}
          >
            4<span style={{ color: '#06b6d4' }}>0</span>4
          </h1>

          {/* Texto */}
          <p style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>
            Página no encontrada
          </p>
          <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.7, marginBottom: 40, maxWidth: 380, margin: '0 auto 40px' }}>
            La página que buscás no existe o fue movida.
          </p>

          {/* Botones */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 40 }}>
            <a href="/" className="nf-btn-primary">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Volver al inicio
            </a>
            <a href="/guides" className="nf-btn-secondary">
              Ver guías
            </a>
          </div>

          {/* Separador */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, maxWidth: 320, margin: '0 auto 24px' }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, #e2e8f0)' }} />
            <div style={{ display: 'flex', gap: 5 }}>
              {['#06b6d4','#38bdf8','#818cf8'].map((c, i) => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: c, opacity: 0.6 }} />
              ))}
            </div>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #e2e8f0, transparent)' }} />
          </div>

          {/* Links rápidos */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 20px' }}>
            {[
              { href: '/',            label: 'Jugar'    },
              { href: '/leaderboard', label: 'Ranking'  },
              { href: '/guides',      label: 'Guías'    },
              { href: '/support',     label: 'Soporte'  },
            ].map(({ href, label }) => (
              <a key={href} href={href} className="nf-link">{label}</a>
            ))}
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid #e2e8f0',
        background: 'rgba(255,255,255,0.7)',
        padding: '16px 24px',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: 12, color: '#94a3b8' }}>
          © 2026 PrompTool Team. All rights reserved.
        </p>
      </footer>

    </div>
  )
}
