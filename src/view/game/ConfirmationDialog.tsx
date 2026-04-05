import { Button, Window, WindowContent, WindowHeader } from 'react95'
import css from './ConfirmationDialog.module.css'

interface ConfirmationDialogProps {
  title: string
  message: string
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
}

export function ConfirmationDialog({
  title,
  message,
  isOpen,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
}: ConfirmationDialogProps) {
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
    gap: '16px',
    paddingBottom: '16px',
  }

  return (
    <Window className={css.root}>
      <WindowHeader>{title}</WindowHeader>
      <WindowContent>
        <div style={messageStyle}>{message}</div>
        <div style={buttonContainerStyle}>
          <Button onClick={onCancel}>{cancelText}</Button>
          <Button primary onClick={onConfirm}>{confirmText}</Button>
        </div>
      </WindowContent>
    </Window>
  )
}
