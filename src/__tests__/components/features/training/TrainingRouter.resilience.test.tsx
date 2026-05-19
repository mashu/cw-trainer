import { render, screen } from '@testing-library/react';
import React from 'react';

import { TrainingRouter } from '@/components/features/training/TrainingRouter';
import type { FormTrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import type { UseEchoTrainingSessionReturn } from '@/hooks/useEchoTrainingSession';
import type { UseTrainingSessionReturn } from '@/hooks/useTrainingSession';
import { settingsToSharedAudioProps } from '@/lib/settingsToSharedAudioProps';

const { customSet, customSequence, ...baseSettings } = DEFAULT_TRAINING_SETTINGS;
const formSettings: FormTrainingSettings = {
  ...baseSettings,
  customSet: [...customSet],
  ...(customSequence !== undefined ? { customSequence: [...customSequence] } : {}),
};

const buildTraining = (
  overrides: Partial<UseTrainingSessionReturn> = {},
): UseTrainingSessionReturn =>
  ({
    isTraining: true,
    isCompletingSession: false,
    hasActiveSession: true,
    runtimeStatus: 'waitingForAnswer',
    currentGroup: 0,
    sentGroups: ['KM'],
    userInput: [''],
    confirmedGroups: {},
    currentFocusedGroup: 0,
    showResults: false,
    lastSessionResult: null,
    startTraining: jest.fn(),
    submitAnswer: jest.fn(),
    stopTraining: jest.fn(),
    confirmGroupAnswer: jest.fn(),
    handleAnswerChange: jest.fn(),
    setCurrentFocusedGroup: jest.fn(),
    dismissResults: jest.fn(),
    inputRefs: { current: [] },
    inputRefCallback: jest.fn(),
    ...overrides,
  }) as UseTrainingSessionReturn;

const echoTraining = {
  isTraining: false,
  isCompletingSession: false,
  currentGroup: 0,
  sentGroups: [],
  currentCharacterIndex: 0,
  currentCharacterState: 'idle',
  currentSymbols: '',
  revealedCharacter: null,
  currentGroupProgress: [],
  correctCharacters: 0,
  incorrectCharacters: 0,
  sendingScore: 0,
  showResults: false,
  lastSessionResult: null,
  startTraining: jest.fn(),
  stopTraining: jest.fn(),
  dismissResults: jest.fn(),
} as UseEchoTrainingSessionReturn;

describe('TrainingRouter active session resilience', () => {
  it('renders session results when showResults is true', () => {
    render(
      <TrainingRouter
        activeMode="group"
        groupTab="train"
        setGroupTab={jest.fn()}
        setActiveMode={jest.fn()}
        training={buildTraining({
          isTraining: false,
          hasActiveSession: false,
          isCompletingSession: false,
          showResults: true,
          lastSessionResult: {
            accuracy: 0.8,
            avgResponseMs: 500,
            score: 80,
            groups: [{ sent: 'KM', received: 'KM', correct: true }],
          },
        })}
        echoTraining={echoTraining}
        settings={DEFAULT_TRAINING_SETTINGS}
        formSettings={formSettings}
        groupHeatmapSessions={[]}
        echoHeatmapSessions={[]}
        groupSessions={[]}
        echoSessions={[]}
        lastAccuracyPercent={0}
        lastEchoAccuracyPercent={0}
        stopTrainingIfActive={jest.fn()}
        sharedAudio={settingsToSharedAudioProps(DEFAULT_TRAINING_SETTINGS)}
        icrSettings={{
          trialsPerSession: 30,
          trialDelayMs: 700,
          vadEnabled: true,
          vadThreshold: 0.08,
          vadHoldMs: 60,
          bucketGreenMaxMs: 400,
          bucketYellowMaxMs: 600,
          bucketOrangeMaxMs: 800,
        }}
        showToast={jest.fn()}
        handleMoveMode={jest.fn()}
      />,
    );

    expect(screen.getByText(/Session Complete/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start Training/i })).not.toBeInTheDocument();
  });

  it('renders active group training even when mode and tab drift away from group train', () => {
    render(
      <TrainingRouter
        activeMode="player"
        groupTab="stats"
        setGroupTab={jest.fn()}
        setActiveMode={jest.fn()}
        training={buildTraining()}
        echoTraining={echoTraining}
        settings={DEFAULT_TRAINING_SETTINGS}
        formSettings={formSettings}
        groupHeatmapSessions={[]}
        echoHeatmapSessions={[]}
        groupSessions={[]}
        echoSessions={[]}
        lastAccuracyPercent={0}
        lastEchoAccuracyPercent={0}
        stopTrainingIfActive={jest.fn()}
        sharedAudio={settingsToSharedAudioProps(DEFAULT_TRAINING_SETTINGS)}
        icrSettings={{
          trialsPerSession: 30,
          trialDelayMs: 700,
          vadEnabled: true,
          vadThreshold: 0.08,
          vadHoldMs: 60,
          bucketGreenMaxMs: 400,
          bucketYellowMaxMs: 600,
          bucketOrangeMaxMs: 800,
        }}
        showToast={jest.fn()}
        handleMoveMode={jest.fn()}
      />,
    );

    expect(screen.getByText(/Enter answers per group/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start Training/i })).not.toBeInTheDocument();
  });
});
