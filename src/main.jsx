import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { Providers } from './Providers'
import './index.css'

// Validate environment variables at startup
import { validateEnv } from './config/env'
import { logger } from './utils/logger'

try {
  // Crash early if required environment variables are missing
  validateEnv()
  logger.info('Application starting', {
    env: import.meta.env.MODE,
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  })
} catch (error) {
  // Show user-friendly error page
  document.getElementById('root').innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0f172a; color: white; font-family: system-ui, sans-serif; padding: 2rem;">
      <div style="max-width: 600px; text-align: center;">
        <h1 style="font-size: 2rem; margin-bottom: 1rem; color: #ef4444;">⚠️ Error de configuración</h1>
        <p style="color: #cbd5e1; margin-bottom: 2rem;">La aplicación no puede iniciarse debido a variables de entorno faltantes.</p>
        <pre style="background: #1e293b; padding: 1rem; border-radius: 0.5rem; text-align: left; overflow-x: auto; color: #f87171;">${error.message}</pre>
        <p style="color: #94a3b8; margin-top: 2rem; font-size: 0.875rem;">Por favor, contacta al administrador del sistema.</p>
      </div>
    </div>
  `
  throw error
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Providers><App /></Providers>
  </React.StrictMode>,
)
