import { createRoot } from 'react-dom/client'
import { App } from './App'
import './core/requestIdleCallback'

createRoot(document.getElementById('root') as HTMLElement).render(<App />)
