import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@xyflow/react/dist/style.css'
import './styles.css'
import { App } from './App'
import { installRendererDiagnostics } from './diagnostics'
import { DiagnosticsSurface } from './DiagnosticsSurface'
import { DiagnosticErrorBoundary } from './DiagnosticErrorBoundary'
import { initializeLanguage } from './language'

const disposeDiagnostics = installRendererDiagnostics()
if (import.meta.hot) import.meta.hot.dispose(disposeDiagnostics)

void initializeLanguage().then((disposeLanguage) => {
  if (import.meta.hot) import.meta.hot.dispose(disposeLanguage)
  createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DiagnosticErrorBoundary>{window.location.hash === '#diagnostics' ? <DiagnosticsSurface /> : <App />}</DiagnosticErrorBoundary>
  </StrictMode>
)
})
