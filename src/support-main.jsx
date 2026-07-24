import React from 'react'
import ReactDOM from 'react-dom/client'
import SupportApp from './SupportApp'
import { Providers } from './Providers'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Providers><SupportApp /></Providers>
  </React.StrictMode>,
)
