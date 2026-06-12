import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";

type VirtualListOptions = {
  itemCount: number;
  itemHeight: number;
  overscan?: number;
};

export function useVirtualList(
  scrollRef: RefObject<HTMLElement | null>,
  { itemCount, itemHeight, overscan = 8 }: VirtualListOptions
) {
  const [range, setRange] = useState(() => ({
    start: 0,
    end: Math.min(itemCount, 24),
  }));

  const updateRange = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const scrollTop = el.scrollTop;
    const viewport = el.clientHeight;
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(viewport / itemHeight) + overscan * 2;
    const end = Math.min(itemCount, start + visibleCount);

    setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, [scrollRef, itemCount, itemHeight, overscan]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateRange();
    el.addEventListener("scroll", updateRange, { passive: true });

    const resizeObserver = new ResizeObserver(updateRange);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", updateRange);
      resizeObserver.disconnect();
    };
  }, [updateRange]);

  useEffect(() => {
    updateRange();
  }, [itemCount, updateRange]);

  const padding = useMemo(
    () => ({
      top: range.start * itemHeight,
      bottom: Math.max(0, (itemCount - range.end) * itemHeight),
    }),
    [range.end, range.start, itemCount, itemHeight]
  );

  return { ...range, padding };
}