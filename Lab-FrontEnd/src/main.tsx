import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/roboto/latin-500.css'
import App from './App'
import { AppErrorBoundary } from './shared/errors/ErrorView'
import { I18nProvider } from './shared/i18n'
import './styles.css'
import './simulator/simulator.css'

const client = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 0, refetchOnWindowFocus: true } } })
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <QueryClientProvider client={client}>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </QueryClientProvider>
    </I18nProvider>
  </React.StrictMode>,
)
