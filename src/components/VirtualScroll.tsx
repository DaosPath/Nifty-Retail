import { useRef, type ReactNode } from "react";
import { useVirtualList } from "../hooks/useVirtualList";

interface VirtualScrollProps<T> {
  items: T[];
  itemHeight: number;
  className?: string;
  overscan?: number;
  renderItem: (item: T, index: number) => ReactNode;
  getKey: (item: T, index: number) => string;
}

export function VirtualScroll<T>({
  items,
  itemHeight,
  className,
  overscan = 8,
  renderItem,
  getKey,
}: VirtualScrollProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtual = useVirtualList(scrollRef, {
    itemCount: items.length,
    itemHeight,
    overscan,
  });

  const visibleItems = items.slice(virtual.start, virtual.end);

  return (
    <div ref={scrollRef} className={["nifty-scroll", className].filter(Boolean).join(" ")}>
      {virtual.padding.top > 0 && (
        <div className="virtual-scroll-spacer" style={{ height: virtual.padding.top }} aria-hidden="true" />
      )}
      {visibleItems.map((item, index) => (
        <div key={getKey(item, virtual.start + index)} className="virtual-scroll-item">
          {renderItem(item, virtual.start + index)}
        </div>
      ))}
      {virtual.padding.bottom > 0 && (
        <div className="virtual-scroll-spacer" style={{ height: virtual.padding.bottom }} aria-hidden="true" />
      )}
    </div>
  );
}