import React, {useEffect, useMemo} from 'react';
import {useGridScroll} from './useGridScroll';
import './styles.css';

type Item<T, P> = {
    itemData: T;
    sharedItemData: P;
    width: number;
    height: number;
    cellSize: number;
};

type VirtualGridProps<T extends {index: number}, P> = {
    updateGrid: (startNodeX: number, startNodeY: number) => void;
    data: Array<T>;
    width: number;
    height: number;
    cellSize: number;
    Item: React.ComponentType<Item<T, P>>;
    cellsInViewportHeight: number;
    cellsInViewportWidth: number;
    sharedItemData: P;
};

export interface Styles extends React.CSSProperties {
    '--grid-cell': string;
}

export function VirtualGrid<T extends {index: number}, P>({
    updateGrid,
    data,
    width,
    height,
    cellSize,
    Item,
    cellsInViewportHeight,
    cellsInViewportWidth,
    sharedItemData,
}: VirtualGridProps<T, P>) {
    const [scrollTop, scrollLeft, ref] = useGridScroll();
    const viewportWidth = cellsInViewportWidth * cellSize;
    const viewportHeight = cellsInViewportHeight * cellSize;
    const startCellY = Math.max(0, Math.floor(scrollTop / cellSize));
    const startCellX = Math.max(0, Math.floor(scrollLeft / cellSize));
    const totalHeight = `${height * cellSize}px`;
    const totalWidth = `${width * cellSize}px`;

    useEffect(
        () => updateGrid(startCellX, startCellY),
        [startCellY, startCellX, updateGrid]
    );

    const child = useMemo(
        () =>
            data.map((itemData: T) => (
                <Item
                    key={itemData.index}
                    itemData={itemData}
                    sharedItemData={sharedItemData}
                    width={width}
                    height={height}
                    cellSize={cellSize}
                />
            )),
        [data, width, height, cellSize, sharedItemData, Item]
    );

    const styles: Styles = {
        height: viewportHeight,
        width: viewportWidth,
        '--grid-cell': `${cellSize}px`,
    };

    return (
        <div className="virtual-grid" style={styles} ref={ref}>
            <div
                className="virtual-grid__viewport"
                style={{height: totalHeight, width: totalWidth}}
            >
                <div
                    className="virtual-grid__content"
                    style={{
                        transform: `translate(${scrollLeft}px, ${scrollTop}px)`,
                        width: `${cellSize * cellsInViewportWidth}px`,
                        height: `${cellSize * cellsInViewportHeight}px`,
                    }}
                >
                    {child}
                </div>
            </div>
        </div>
    );
}
