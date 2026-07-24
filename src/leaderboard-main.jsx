import React from 'react'
import ReactDOM from 'react-dom/client'
import LeaderboardApp from './LeaderboardApp'
import { Providers } from './Providers'
import './index.css'

// Apply saved visual mode on load
import('./components/ConfigModal').then(({ loadVisualMode, applyVisualMode }) => {
  applyVisualMode(loadVisualMode())
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Providers><LeaderboardApp /></Providers>
  </React.StrictMode>,
)
