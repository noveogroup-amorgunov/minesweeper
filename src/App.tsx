import { styleReset } from 'react95'
import ms_sans_serif from 'react95/dist/fonts/ms_sans_serif.woff2'
import ms_sans_serif_bold from 'react95/dist/fonts/ms_sans_serif_bold.woff2'
import original from 'react95/dist/themes/original'

import { createGlobalStyle, ThemeProvider } from 'styled-components'

import { GameEngine } from './engine/GameEngine'
import { GameEngineProvider } from './view/gameContext'
import { GameView } from './view/game/GameView'

const GlobalStyles = createGlobalStyle`
  ${styleReset}
  @font-face {
    font-family: 'ms_sans_serif';
    src: url('${ms_sans_serif}') format('woff2');
    font-weight: 400;
    font-style: normal
  }
  @font-face {
    font-family: 'ms_sans_serif';
    src: url('${ms_sans_serif_bold}') format('woff2');
    font-weight: bold;
    font-style: normal
  }
  body, input, select, textarea {
    font-family: 'ms_sans_serif';
  }

  :root {
    color-scheme: light;
    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
`

const gameEngine = new GameEngine()

export function App() {
  return (
    <ThemeProvider theme={original}>
      <GlobalStyles />
      <GameEngineProvider gameEngine={gameEngine}>
        <GameView />
      </GameEngineProvider>
    </ThemeProvider>
  )
}
