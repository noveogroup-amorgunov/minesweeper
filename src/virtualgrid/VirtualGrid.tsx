import React, {useEffect, useMemo} from 'react';
import {useGridScroll} from './useGridScroll';
import './styles.css';

type Item<D> = {
    itemData: D;
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
    Item: React.ComponentType<Item<T & P>>;
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
    const startCellY = Math.max(
        0,
        Math.floor((scrollTop as number) / cellSize)
    );
    const startCellX = Math.max(
        0,
        Math.floor((scrollLeft as number) / cellSize)
    );

    useEffect(
        () => updateGrid(startCellX, startCellY),
        [startCellY, startCellX]
    );

    const totalHeight = `${height * cellSize}px`;
    const totalWidth = `${width * cellSize}px`;

    const child = useMemo(
        () =>
            data.map((itemData: T & P) => (
                <Item
                    key={itemData.index}
                    itemData={{...itemData, ...sharedItemData}}
                    width={width}
                    height={height}
                    cellSize={cellSize}
                />
            )),
        [data, width, height, cellSize]
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
