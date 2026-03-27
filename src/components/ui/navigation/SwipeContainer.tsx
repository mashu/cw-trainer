import React, { useRef } from 'react';

const SWIPE_THRESHOLD = 60;

interface SwipeContainerProps {
  readonly onSwipeLeft?: () => void;
  readonly onSwipeRight?: () => void;
  readonly children: React.ReactNode;
}

export function SwipeContainer({
  onSwipeLeft,
  onSwipeRight,
  children,
}: SwipeContainerProps): JSX.Element {
  const startXRef = useRef<number | null>(null);
  return (
    <div
      onTouchStart={(e) => {
        startXRef.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const endX = e.changedTouches[0]?.clientX ?? null;
        if (startXRef.current != null && endX != null) {
          const dx = endX - startXRef.current;
          if (Math.abs(dx) > SWIPE_THRESHOLD) {
            if (dx > 0) onSwipeRight?.();
            else onSwipeLeft?.();
          }
        }
        startXRef.current = null;
      }}
    >
      {children}
    </div>
  );
}
