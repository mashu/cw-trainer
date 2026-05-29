import { render, screen } from '@testing-library/react';
import type { MutableRefObject } from 'react';

import { IcrTrainingVoiceHud } from '@/components/features/icr/IcrTrainingVoiceHud';

const armedRef = (value: boolean): MutableRefObject<boolean> => ({ current: value });

describe('IcrTrainingVoiceHud', () => {
  let rafCount = 0;

  beforeEach(() => {
    rafCount = 0;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      if (rafCount < 2) {
        rafCount += 1;
        cb(0);
      }
      return rafCount;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns null when inactive', () => {
    const { container } = render(
      <IcrTrainingVoiceHud
        active={false}
        measureInputLevel={() => 0}
        armedRef={armedRef(false)}
        vadThreshold={0.1}
        vadHoldMs={60}
        listeningPaused={false}
        reactionLocked={false}
        lockedReactionMs={null}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('shows locked reaction time after voice stop', () => {
    render(
      <IcrTrainingVoiceHud
        active
        measureInputLevel={() => 0.5}
        armedRef={armedRef(true)}
        vadThreshold={0.1}
        vadHoldMs={60}
        listeningPaused={false}
        reactionLocked
        lockedReactionMs={412}
      />,
    );

    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('412')).toBeInTheDocument();
    expect(screen.getByText(/type the letter below/i)).toBeInTheDocument();
  });

  it('shows ready status when listening is paused', () => {
    render(
      <IcrTrainingVoiceHud
        active
        measureInputLevel={() => 0}
        armedRef={armedRef(true)}
        vadThreshold={0.1}
        vadHoldMs={60}
        listeningPaused
        reactionLocked={false}
        lockedReactionMs={null}
      />,
    );

    expect(screen.getByText('Ready')).toBeInTheDocument();
  });
});
