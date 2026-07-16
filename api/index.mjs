// Función catch-all de Vercel: todo /api/* (rewrite en vercel.json) se
// atiende con la app Express completa del backend (server/src/app.js).
// server/src/server.js queda solo para desarrollo local.
import app from '../server/src/app.js'

export default app
