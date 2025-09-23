import { useRef, useState } from 'react'
import { Anchor, Button, Frame, MenuList, MenuListItem, Toolbar, Window, WindowContent, WindowHeader } from 'react95'
import { useGameEngine } from '../gameContext'
import { reactScanIsEnabled, toggleReactScan } from '../reactScan'
import { useOnClickOutside } from '../useClickOutside'
import { useGameState } from '../useGameState'
import { GameAbout } from './GameAbout'
import { GameBoard } from './GameBoard'
import { GameSettings } from './GameSettings'
import { GameStats } from './GameStats'
import { GameStatusPanel } from './GameStatusPanel'
import css from './GameView.module.css'
import { ResourceLoader } from './ResourceLoader'

export function GameView() {
  const gameEngine = useGameEngine()
  const gameStatus = useGameState(state => state.gameStatus)

  const [open, setOpen] = useState(false)
  const [openSettingModal, setOpenSettingModal] = useState(false)
  const [showDebugInfo, setShowDebugInfo] = useState(false)
  const [openAboutModal, setOpenAboutModal] = useState(false)
  const settingsMenuRef = useRef<HTMLElement>(null)

  const handleOutsideSettingsMenuClick = () => {
    setOpen(false)
  }

  useOnClickOutside(settingsMenuRef, handleOutsideSettingsMenuClick)

  return (
    <div className={css.window__wrapper}>
      <ResourceLoader />
      <Window className={css.window}>
        {openSettingModal && (<GameSettings onClose={() => setOpenSettingModal(false)} />)}
        {openAboutModal && (<GameAbout onClose={() => setOpenAboutModal(false)} />)}
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
