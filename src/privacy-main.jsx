import React from 'react'
import ReactDOM from 'react-dom/client'
import PrivacyApp from './PrivacyApp'
import { Providers } from './Providers'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Providers><PrivacyApp /></Providers>
  </React.StrictMode>,
)
