import 'babel-polyfill';

import React from 'react';
import {render} from 'react-dom';
import {GameView} from './minesweeper/GameView';
import {withReact95Theme} from './withReact95Theme';

const App = () => {
    return <GameView />;
};

render(withReact95Theme(<App />), document.getElementById('app'));
