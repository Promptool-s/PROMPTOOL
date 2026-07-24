import React from 'react'
import ReactDOM from 'react-dom/client'
import TermsApp from './TermsApp'
import { Providers } from './Providers'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Providers><TermsApp /></Providers>
  </React.StrictMode>,
)
