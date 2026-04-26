import React from 'react'
import { logger } from '../utils/logger'

/**
 * Error Boundary Component
 * Catches React errors and displays fallback UI
 * Never leaves the user with a broken screen
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    // Log error to centralized logging system
    logger.error('React Error Boundary caught error', error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    })

    this.setState({
      error,
      errorInfo,
    })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
          <div className="max-w-md w-full text-center space-y-6">
            {/* Error Icon */}
            <div className="mx-auto w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            {/* Error Message */}
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Algo salió mal
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Ha ocurrido un error inesperado. Por favor, intenta recargar la página.
              </p>
            </div>

            {/* Error Details (only in development) */}
            {import.meta.env.DEV && this.state.error && (
              <details className="text-left">
                <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Detalles técnicos
                </summary>
                <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-4 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-auto max-h-48">
                  <p className="font-bold text-rose-600 dark:text-rose-400 mb-2">
                    {this.state.error.toString()}
                  </p>
                  <pre className="whitespace-pre-wrap text-slate-600 dark:text-slate-400">
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </div>
              </details>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 rounded-xl bg-cyan-600 hover:bg-cyan-700 px-4 py-3 text-sm font-semibold text-white transition"
              >
                Recargar página
              </button>
              <button
                onClick={() => window.history.back()}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Volver atrás
              </button>
            </div>

            {/* Support Link */}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Si el problema persiste, contacta a{' '}
              <a href="/support.html" className="text-cyan-600 dark:text-cyan-400 hover:underline">
                soporte técnico
              </a>
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
