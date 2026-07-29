import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyTheme, resolveInitialTheme } from './lib/theme'
import './styles.css'

// Set before the first paint so there's no flash of the wrong theme.
applyTheme(resolveInitialTheme())

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
