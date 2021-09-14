import React, {useEffect, useState, useCallback, useRef} from 'react';
import {
    NumberField,
    Window,
    WindowContent,
    WindowHeader,
    Button,
    Toolbar,
    Anchor,
    List,
    ListItem,
    Fieldset,
} from 'react95';

export const useEnhance = () => {
    const [width, setWidth] = useState(10);
    const [height, setHeight] = useState(10);
    const [minesNum, setMinesNum] = useState(25);
    const [open, setOpen] = useState(false);
    const [openSettingModal, setOpenSettingModal] = useState(false);
    const startGameButtonRef = useRef<HTMLButtonElement>();

    useEffect(() => {
        if (minesNum > width * height - 1) {
            setMinesNum(width * height - 1);
        }
    }, [width, height]);

    const onChangeWidth = useCallback(
        (raw: number) => setWidth(Math.min(Math.max(Number(raw), 2), 10 ** 4)),
        [setWidth]
    );

    const onChangeHeight = useCallback(
        (raw: number) => setHeight(Math.min(Math.max(Number(raw), 2), 10 ** 4)),
        [height]
    );

    const onChangeMinesNum = useCallback(
        (raw: number) =>
            setMinesNum(Math.min(Math.max(Number(raw), 1), 10 ** 8 - 1)),
        [minesNum]
    );

    const onClick = useCallback(() => {
        setOpenSettingModal(false);
        if (startGameButtonRef && startGameButtonRef.current) {
            startGameButtonRef.current.click();
        }
    }, [setOpenSettingModal]);

    return {
        width,
        onChangeWidth,
        height,
        onChangeHeight,
        minesNum,
        onChangeMinesNum,
        open,
        setOpen,
        openSettingModal,
        setOpenSettingModal,
        onClick,
        startGameButtonRef,
    };
};

function GameWindowView({Component}: {Component: React.ComponentType<any>}) {
    const {
        width,
        onChangeWidth,
        height,
        onChangeHeight,
        minesNum,
        onChangeMinesNum,
        open,
        setOpen,
        openSettingModal,
        setOpenSettingModal,
        onClick,
        startGameButtonRef,
    } = useEnhance();

    return (
        <div className="window__wrapper">
            {openSettingModal && (
                <Window className="window__settings">
                    <WindowContent>
                        <div>
                            <Fieldset label="Settings:">
                                <div style={{padding: '0.5em 0 0.5em 0'}}>
                                    Width (max: 10^4):
                                </div>
                                <NumberField
                                    name="Width"
                                    defaultValue={width}
                                    onChange={onChangeWidth}
                                    min={2}
                                    max={10000}
                                    width={130}
                                />
                                <div style={{padding: '0.5em 0 0.5em 0'}}>
                                    Height (max: 10^4):
                                </div>
                                <NumberField
                                    name="Height"
                                    defaultValue={height}
                                    onChange={onChangeHeight}
                                    min={2}
                                    max={10000}
                                    width={130}
                                />
                                <div style={{padding: '0.5em 0 0.5em 0'}}>
                                    Mines (max: 10^8 - 1):
                                </div>
                                <NumberField
                                    name="Mines"
                                    defaultValue={minesNum}
                                    onChange={onChangeMinesNum}
                                    min={1}
                                    max={height * width - 1}
                                    width={130}
                                />
                                <div>
                                    Recommended:{' '}
                                    <Anchor
                                        href="#"
                                        onClick={() =>
                                            onChangeMinesNum(
                                                Math.round((height * width) / 4)
                                            )
                                        }
                                    >
                                        {Math.round((height * width) / 4)}
                                    </Anchor>
                                </div>
                                <div style={{padding: '1em 0 0.5em 0'}}>
                                    <Button primary onClick={onClick}>
                                        Apply and restart game
                                    </Button>
                                </div>
                                <div style={{padding: '0em 0 0.5em 0'}}>
                                    <Button
                                        onClick={() =>
                                            setOpenSettingModal(false)
                                        }
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </Fieldset>
                        </div>
                    </WindowContent>
                </Window>
            )}
            <Window className="window">
                <WindowHeader className="window__header">
                    <span>minesweeper.exe</span>
                    <Button>
                        <span className="close-icon" />
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
                        <List
                            style={{
                                position: 'absolute',
                                left: '0',
                                top: '100%',
                                zIndex: 5,
                            }}
                            onClick={() => {
                                setOpen(false);
                                setOpenSettingModal(true);
                            }}
                        >
                            <ListItem size="sm">Settings</ListItem>
                        </List>
                    )}
                    <Button variant="menu" size="sm">
                        About
                    </Button>
                </Toolbar>
                <WindowContent>
                    <Component
                        ref={startGameButtonRef}
                        width={width}
                        height={height}
                        minesNum={minesNum}
                    />
                </WindowContent>
            </Window>
            <div>
                Yet one minesweeper{' '}
                <Anchor
                    href="https://github.com/noveogroup-amorgunov/minesweeper"
                    target="_blank"
                >
                    noveogroup-amorgunov/minesweeper
                </Anchor>
            </div>
        </div>
    );
}

export const withGameWindow = (Component: React.ComponentType<any>) => {
    return function GameWindowViewHoc() {
        return <GameWindowView Component={Component} />;
    };
};
