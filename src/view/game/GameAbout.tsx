import { Anchor, Button, GroupBox, Window, WindowContent } from 'react95'
import css from './GameAbout.module.css'

interface Props {
  onClose: () => void
}

export function GameAbout({ onClose }: Props) {
  return (
    <Window className={css.root}>
      <WindowContent>
        <div>
          <GroupBox label="About:">
            Created by
            {' '}
            <Anchor href="https://amorgunov.com">Alexander Morgunov</Anchor>
            <br />
            <br />
            <Button onClick={onClose}>Close</Button>
          </GroupBox>
        </div>
      </WindowContent>
    </Window>
  )
}
