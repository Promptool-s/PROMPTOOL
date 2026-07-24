import React from 'react'
import ReactDOM from 'react-dom/client'
import UsuarioApp from './UsuarioApp'
import { Providers } from './Providers'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Providers><UsuarioApp /></Providers>
  </React.StrictMode>,
)
