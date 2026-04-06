import { Button, Window, WindowContent, WindowHeader } from 'react95'
import css from './ErrorDialog.module.css'

interface ErrorDialogProps {
  message: string
  isOpen: boolean
  onClose: () => void
}

export function ErrorDialog({ message, isOpen, onClose }: ErrorDialogProps) {
  if (!isOpen) {
    return null
  }

  const messageStyle: React.CSSProperties = {
    padding: '16px',
    textAlign: 'center',
    minWidth: '300px',
  }

  const buttonContainerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    paddingBottom: '16px',
  }

  return (
    <Window className={css.root}>
      <WindowHeader>Error</WindowHeader>
      <WindowContent>
        <div style={messageStyle}>{message}</div>
        <div style={buttonContainerStyle}>
          <Button onClick={onClose}>OK</Button>
        </div>
      </WindowContent>
    </Window>
  )
}
