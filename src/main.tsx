/* eslint-disable perfectionist/sort-imports */
// WARNING: initReactScan must be imported first
import { initReactScan } from './view/reactScan'
import { App } from './App'
import { createRoot } from 'react-dom/client'
import './core/requestIdleCallback'

initReactScan()

createRoot(document.getElementById('root') as HTMLElement).render(<App />)
