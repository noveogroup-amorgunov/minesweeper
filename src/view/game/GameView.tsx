import { useEffect, useRef, useState } from 'react'
import { Anchor, Button, Frame, MenuList, MenuListItem, Separator, Toolbar, Window, WindowContent, WindowHeader } from 'react95'
import { SaveFileCorruptedError, SaveValidationError, SaveVersionError } from '../../engine/errors'
import { useGameEngine } from '../gameContext'
import { reactScanIsEnabled, toggleReactScan } from '../reactScan'
import { useOnClickOutside } from '../useClickOutside'
import { useGameState } from '../useGameState'
import { ConfirmationDialog } from './ConfirmationDialog'
import { ErrorDialog } from './ErrorDialog'
import { GameAbout } from './GameAbout'
import { GameBoard } from './GameBoard'
import { GameSettings } from './GameSettings'
import { GameStats } from './GameStats'
import { GameStatusPanel } from './GameStatusPanel'
import css from './GameView.module.css'
import { ResourceLoader } from './ResourceLoader'

function getErrorMessage(error: unknown): string {
  if (error instanceof SaveFileCorruptedError) {
    return 'Save file is corrupted or invalid.'
  }
  if (error instanceof SaveVersionError) {
    return 'Save file version is not supported. Please update the game.'
  }
  if (error instanceof SaveValidationError) {
    return 'Save file data is invalid.'
  }
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return 'Not enough storage space to save the game.'
  }
  if (error instanceof DOMException && error.name === 'SecurityError') {
    return 'Browser storage access denied.'
  }
  return 'Failed to save/load game. Please try again.'
}

export function GameView() {
  const gameEngine = useGameEngine()
  const gameStatus = useGameState(state => state.gameStatus)

  const [open, setOpen] = useState(false)
  const [openSettingModal, setOpenSettingModal] = useState(false)
  const [showDebugInfo, setShowDebugInfo] = useState(false)
  const [openAboutModal, setOpenAboutModal] = useState(false)

  // Save/Load states
  const [hasSaveFile, setHasSaveFile] = useState(false)
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false)
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const settingsMenuRef = useRef<HTMLElement>(null)

  // Check for save on mount
  useEffect(() => {
    gameEngine.hasSave().then(setHasSaveFile)
  }, [gameEngine])

  const handleOutsideSettingsMenuClick = () => {
    setOpen(false)
  }

  useOnClickOutside(settingsMenuRef, handleOutsideSettingsMenuClick)

  const canSave = gameStatus === 'PLAYING' || gameStatus === 'DEAD' || gameStatus === 'WIN'

  // Save game handler
  const performSave = async () => {
    try {
      await gameEngine.save()
      setHasSaveFile(true)
      setOpen(false)
      setShowOverwriteDialog(false)
    }
    catch (error) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  const handleSaveGame = async () => {
    const hasExisting = await gameEngine.hasSave()
    if (hasExisting) {
      setShowOverwriteDialog(true)
      return
    }
    await performSave()
  }

  // Load game handler
  const performLoad = async () => {
    try {
      const loaded = await gameEngine.load()
      if (loaded) {
        setOpen(false)
        setShowLoadDialog(false)
      }
      else {
        setErrorMessage('No saved game found')
      }
    }
    catch (error) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  const handleLoadGame = () => {
    if (gameStatus === 'PLAYING') {
      setShowLoadDialog(true)
    }
    else {
      performLoad()
    }
  }

  return (
    <div className={css.window__wrapper}>
      <ResourceLoader />
      <Window className={css.window}>
        {openSettingModal && (<GameSettings onClose={() => setOpenSettingModal(false)} />)}
        {openAboutModal && (<GameAbout onClose={() => setOpenAboutModal(false)} />)}

        {/* Confirmation Dialogs */}
        <ConfirmationDialog
          title="Overwrite Save"
          message="Overwrite saved game? Existing save will be replaced."
          isOpen={showOverwriteDialog}
          onConfirm={performSave}
          onCancel={() => setShowOverwriteDialog(false)}
          confirmText="Save"
          cancelText="Cancel"
        />
        <ConfirmationDialog
          title="Load Game"
          message="Load saved game? Current game progress will be lost."
          isOpen={showLoadDialog}
          onConfirm={performLoad}
          onCancel={() => setShowLoadDialog(false)}
          confirmText="Load"
          cancelText="Cancel"
        />

        {/* Error Dialog */}
        <ErrorDialog
          message={errorMessage ?? ''}
          isOpen={errorMessage !== null}
          onClose={() => setErrorMessage(null)}
        />

        <WindowHeader className={css.window__header}>
          <span>minesweeper.exe</span>
          <Button>
            <span className={css.close_icon} />
          </Button>
        </WindowHeader>
        <Toolbar>
          <Button
            onClick={() => setOpen(!open)}
            active={open}
            variant="menu"
            size="sm"
          >
            File
          </Button>
          {open && (
            <MenuList
              ref={settingsMenuRef}
              style={{
                position: 'absolute',
                left: '0',
                top: '100%',
                zIndex: 5,
              }}
            >
              <MenuListItem
                disabled={gameStatus === 'PENDING'}
                size="sm"
                onClick={() => {
                  setOpen(false)
                  gameEngine.restart()
                }}
              >
                New game
              </MenuListItem>
              <MenuListItem
                disabled={!canSave}
                size="sm"
                onClick={() => {
                  handleSaveGame()
                }}
              >
                Save game
              </MenuListItem>
              <MenuListItem
                disabled={!hasSaveFile}
                size="sm"
                onClick={() => {
                  handleLoadGame()
                }}
              >
                Load game
              </MenuListItem>
              <Separator />
              <MenuListItem
                size="sm"
                onClick={() => {
                  setOpen(false)
                  setOpenSettingModal(true)
                }}
              >
                Settings
              </MenuListItem>
              <MenuListItem
                size="sm"
                onClick={() => {
                  setOpen(false)
                  setShowDebugInfo(!showDebugInfo)
                }}
              >
                Toggle debug info
              </MenuListItem>
              <MenuListItem size="sm" onClick={() => toggleReactScan()}>
                Turn
                {' '}
                {reactScanIsEnabled ? 'off' : 'on'}
                {' '}
                react-scan (need reload)
              </MenuListItem>
            </MenuList>
          )}
          <Button
            variant="menu"
            size="sm"
            onClick={() => setOpenAboutModal(true)}
          >
            About
          </Button>
        </Toolbar>
        <WindowContent>
          <GameStatusPanel />
          <GameBoard />
        </WindowContent>
        {showDebugInfo && (
          <Frame variant="well" className="footer" style={{ width: '100%' }}>
            <GameStats />
          </Frame>
        )}
      </Window>
      <div>
        Yet one minesweeper
        {' '}
        <Anchor
          href="https://github.com/noveogroup-amorgunov/minesweeper"
          target="_blank"
        >
          noveogroup-amorgunov/minesweeper
        </Anchor>
      </div>
    </div>
  )
}
