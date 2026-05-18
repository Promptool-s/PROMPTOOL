import { Suspense, lazy } from 'react'
import { ThemeProvider } from './contexts/ThemeContext'
import { LangProvider } from './contexts/LangContext'
import ErrorBoundary from './components/ErrorBoundary'
import { Analytics } from '@vercel/analytics/react'

const SakuraOverlay = lazy(() => import('./components/SakuraOverlay'))

export const Providers = ({ children }) => (
  <ErrorBoundary>
    <ThemeProvider>
      <LangProvider>
        {children}
        <Suspense fallback={null}>
          <SakuraOverlay />
        </Suspense>
        <Analytics />
      </LangProvider>
    </ThemeProvider>
  </ErrorBoundary>
)
