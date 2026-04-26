import { ThemeProvider } from './contexts/ThemeContext'
import { LangProvider } from './contexts/LangContext'
import ErrorBoundary from './components/ErrorBoundary'

export const Providers = ({ children }) => (
  <ErrorBoundary>
    <ThemeProvider>
      <LangProvider>
        {children}
      </LangProvider>
    </ThemeProvider>
  </ErrorBoundary>
)
