import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';

import { SwipeContainer } from '@/components/ui/navigation/SwipeContainer';

describe('SwipeContainer', () => {
  it('calls onSwipeRight when touch moves right beyond threshold', () => {
    const onSwipeRight = jest.fn();
    const onSwipeLeft = jest.fn();

    render(
      <SwipeContainer onSwipeRight={onSwipeRight} onSwipeLeft={onSwipeLeft}>
        <span>Swipe me</span>
      </SwipeContainer>,
    );

    const target = screen.getByText('Swipe me').parentElement!;

    fireEvent.touchStart(target, { touches: [{ clientX: 10 }] });
    fireEvent.touchEnd(target, { changedTouches: [{ clientX: 100 }] });

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('calls onSwipeLeft when touch moves left beyond threshold', () => {
    const onSwipeLeft = jest.fn();

    render(
      <SwipeContainer onSwipeLeft={onSwipeLeft}>
        <span>Panel</span>
      </SwipeContainer>,
    );

    const target = screen.getByText('Panel').parentElement!;

    fireEvent.touchStart(target, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(target, { changedTouches: [{ clientX: 100 }] });

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it('ignores small movements below threshold', () => {
    const onSwipeRight = jest.fn();

    render(
      <SwipeContainer onSwipeRight={onSwipeRight}>
        <span>Still</span>
      </SwipeContainer>,
    );

    const target = screen.getByText('Still').parentElement!;
    fireEvent.touchStart(target, { touches: [{ clientX: 50 }] });
    fireEvent.touchEnd(target, { changedTouches: [{ clientX: 80 }] });

    expect(onSwipeRight).not.toHaveBeenCalled();
  });
});
