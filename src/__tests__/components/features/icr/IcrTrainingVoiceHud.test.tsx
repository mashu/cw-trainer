import { render, screen } from '@testing-library/react';
import { createRef } from 'react';

import { IcrTrainingVoiceHud } from '@/components/features/icr/IcrTrainingVoiceHud';

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
    const armedRef = createRef<boolean>();
    armedRef.current = false;

    const { container } = render(
      <IcrTrainingVoiceHud
        active={false}
        measureInputLevel={() => 0}
        armedRef={armedRef}
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
    const armedRef = createRef<boolean>();
    armedRef.current = true;

    render(
      <IcrTrainingVoiceHud
        active
        measureInputLevel={() => 0.5}
        armedRef={armedRef}
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
    const armedRef = createRef<boolean>();
    armedRef.current = true;

    render(
      <IcrTrainingVoiceHud
        active
        measureInputLevel={() => 0}
        armedRef={armedRef}
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
