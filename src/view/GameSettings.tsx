/* eslint-disable no-alert */

import { useState } from 'react'
import { Anchor, Button, GroupBox, NumberInput, Window, WindowContent } from 'react95'
import { useGameEngine } from '../react/context'
import { useGameState } from '../react/useGameState'
import css from './GameSettings.module.css'

interface Props {
  onClose: () => void
}

const MAX_WIDTH = 1e4 // 10^4
const MAX_HEIGHT = 1e4

export function GameSettings({ onClose }: Props) {
  const gameEngine = useGameEngine()
  const gameWidth = useGameState(state => state.width)
  const gameHeight = useGameState(state => state.height)
  const gameMinesNum = useGameState(state => state.minesNum)

  const [width, setWidth] = useState(gameWidth)
  const [height, setHeight] = useState(gameHeight)
  const [minesNum, setMinesNum] = useState(gameMinesNum)

  const onChangeWidth = (value: number) => {
    if (value > MAX_WIDTH) {
      alert('Width is too large')
    }

    setWidth(value)
  }
  const onChangeHeight = (value: number) => {
    if (value > MAX_HEIGHT) {
      alert('Height is too large')
    }

    setHeight(value)
  }
  const onChangeMinesNum = (value: number) => {
    if (value > width * height - 1) {
      alert('Mines is too large')
    }

    setMinesNum(value)
  }

  const onSubmit = () => {
    if (width > MAX_WIDTH) {
      alert('Width is too large, max is 10^4')
      return
    }
    if (height > MAX_HEIGHT) {
      alert('Height is too large, max is 10^4')
      return
    }
    if (minesNum > width * height - 1) {
      alert(`Mines is too large, max is ${width * height - 1}`)
      return
    }

    gameEngine.restart({ width, height, minesNum })
    onClose()
  }

  return (
    <Window className={css.root}>
      <WindowContent>
        <div>
          <GroupBox label="Settings:">
            <form onSubmit={onSubmit}>
              <div style={{ padding: '0.5em 0 0.5em 0' }}>
                Width (max: 10^4):
              </div>
              <NumberInput
                defaultValue={width}
                onChange={onChangeWidth}
                min={2}
                max={10000}
                width={130}
              />
              <div style={{ padding: '0.5em 0 0.5em 0' }}>
                Height (max: 10^4):
              </div>
              <NumberInput
                defaultValue={height}
                onChange={onChangeHeight}
                min={2}
                max={10000}
                width={130}
              />
              <div style={{ padding: '0.5em 0 0.5em 0' }}>
                Mines (max: 10^8 - 1):
              </div>
              <NumberInput
                defaultValue={minesNum}
                onChange={onChangeMinesNum}
                min={1}
                max={height * width - 1}
                width={130}
              />
              <div>
                Recommended:
                {' '}
                <Anchor
                  href="#"
                  onClick={() =>
                    onChangeMinesNum(
                      Math.round((height * width) / 4),
                    )}
                >
                  {Math.round((height * width) / 4)}
                </Anchor>
              </div>
              <div style={{ padding: '1em 0 0.5em 0' }}>
                <Button primary onClick={onSubmit}>
                  Apply and restart game
                </Button>
              </div>
              <div style={{ padding: '0em 0 0.5em 0' }}>
                <Button onClick={() => onClose()}>
                  Cancel
                </Button>
              </div>
            </form>
          </GroupBox>
        </div>
      </WindowContent>
    </Window>
  )
}
