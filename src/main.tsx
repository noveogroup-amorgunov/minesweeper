// @ts-expect-error dont have types for react-scan/all-environments
import { scan } from 'react-scan/all-environments'
/* eslint-disable-next-line perfectionist/sort-imports */
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './core/requestIdleCallback'

// TODO: move to react scan
const reactScanIsEnabled = window.location.search.includes('debug=1')

scan({ enabled: reactScanIsEnabled })

createRoot(document.getElementById('root') as HTMLElement).render(<App />)
