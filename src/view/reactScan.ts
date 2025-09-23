// @ts-expect-error dont have types for react-scan/all-environments
import { scan } from 'react-scan/all-environments'

export const reactScanIsEnabled = window.location.search.includes('debug=1')

export function initReactScan() {
  scan({ enabled: reactScanIsEnabled })
}

export function toggleReactScan() {
  if (reactScanIsEnabled) {
    window.location.href = window.location.href.replace('?debug=1', '')
  }
  else {
    window.location.href = `${window.location.href}?debug=1`
  }
}
