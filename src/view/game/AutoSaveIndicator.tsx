import { useEffect } from 'react'
import { Frame } from 'react95'
import css from './AutoSaveIndicator.module.css'

interface AutoSaveIndicatorProps {
  visible: boolean
  onHide: () => void
}

export function AutoSaveIndicator({ visible, onHide }: AutoSaveIndicatorProps) {
  useEffect(() => {
    if (!visible) {
      return
    }

    const timer = setTimeout(() => {
      onHide()
    }, 2000)

    return () => clearTimeout(timer)
  }, [visible, onHide])

  if (!visible) {
    return null
  }

  return (
    <div className={css.root}>
      <Frame className={css.frame} variant="well">
        Game saved ✓
      </Frame>
    </div>
  )
}
