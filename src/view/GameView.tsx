import { useState } from 'react'
import { Anchor, Button, Fieldset, GroupBox, List, ListItem, MenuList, MenuListItem, NumberField, NumberInput, Toolbar, Window, WindowContent, WindowHeader } from 'react95'
import { GameBoard } from './GameBoard'
import { GameSettings } from './GameSettings'
import { GameStats } from './GameStats'
import { GameStatusPanel } from './GameStatusPanel'
import css from './GameView.module.css'

export function GameView() {
  const [open, setOpen] = useState(false)
  const [openSettingModal, setOpenSettingModal] = useState(false)

  return (
    <div className={css.window__wrapper}>
      <Window className={css.window}>
        {openSettingModal && (<GameSettings onClose={() => setOpenSettingModal(false)} />)}
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
              style={{
                position: 'absolute',
                left: '0',
                top: '100%',
                zIndex: 5,
              }}
              onClick={() => {
                setOpen(false)
                setOpenSettingModal(true)
              }}
            >
              <MenuListItem size="sm">Settings</MenuListItem>
            </MenuList>
          )}
          <Button variant="menu" size="sm">
            About
          </Button>
        </Toolbar>
        <WindowContent>
          <GameStatusPanel />
          <GameBoard />
        </WindowContent>
        <WindowContent className={css.window__footer}>
          <GameStats />
        </WindowContent>
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
