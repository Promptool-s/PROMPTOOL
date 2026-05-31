import React from 'react'
import ReactDOM from 'react-dom/client'
import GuidesApp from './GuidesApp'
import { Providers } from './Providers'
import './index.css'

// Apply saved visual mode on load
import('./components/ConfigModal').then(({ loadVisualMode, applyVisualMode }) => {
  applyVisualMode(loadVisualMode())
})

if (import.meta.env.PROD) {
  const s = document.createElement('script')
  s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2595549931822625'
  s.async = true
  s.crossOrigin = 'anonymous'
  s.onerror = () => {}
  document.head.appendChild(s)
}
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Providers><GuidesApp /></Providers>
  </React.StrictMode>,
)
