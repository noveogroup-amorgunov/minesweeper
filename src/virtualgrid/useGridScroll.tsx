import {useEffect, useState, useRef} from 'react';

export const useGridScroll = () => {
    const [scrollTop, setScrollTop] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const ref = useRef<HTMLDivElement>(null);

    const onScroll = (e: Event) =>
        requestAnimationFrame(() => {
            setScrollTop((e as unknown as {target: Element}).target.scrollTop);
            setScrollLeft(
                (e as unknown as {target: Element}).target.scrollLeft
            );
        });

    useEffect(() => {
        const scrollContainer = ref.current;

        if (!scrollContainer) {
            return;
        }

        setScrollTop(scrollContainer.scrollTop);
        setScrollLeft(scrollContainer.scrollLeft);
        scrollContainer.addEventListener('scroll', onScroll);

        return () => scrollContainer.removeEventListener('scroll', onScroll);
    }, []);

    return [scrollTop, scrollLeft, ref] as const;
};
