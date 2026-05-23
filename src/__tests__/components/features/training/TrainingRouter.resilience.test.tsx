import { render, screen } from '@testing-library/react';
import React from 'react';

import { TrainingRouter } from '@/components/features/training/TrainingRouter';
import type { FormTrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import type { UseChaseTrainingSessionReturn } from '@/hooks/useChaseTrainingSession';
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

const chaseTraining = {
  status: 'idle',
  isTraining: false,
  target: null,
  lastResolvedTarget: null,
  userInput: '',
  lives: 3,
  level: 1,
  score: 0,
  streak: 0,
  bestStreak: 0,
  correctInLevel: 0,
  levelProgress: 0,
  groupsCompleted: 0,
  lastSessionResult: null,
  startTraining: jest.fn(),
  stopTraining: jest.fn(),
  dismissResults: jest.fn(),
  handleInputChange: jest.fn(),
  submitAnswer: jest.fn(),
} as UseChaseTrainingSessionReturn;

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
        chaseTraining={chaseTraining}
        settings={DEFAULT_TRAINING_SETTINGS}
        formSettings={formSettings}
        groupHeatmapSessions={[]}
        echoHeatmapSessions={[]}
        groupSessions={[]}
        echoSessions={[]}
        chaseSessions={[]}
        lastAccuracyPercent={0}
        lastEchoAccuracyPercent={0}
        lastChaseAccuracyPercent={0}
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
        chaseTraining={chaseTraining}
        settings={DEFAULT_TRAINING_SETTINGS}
        formSettings={formSettings}
        groupHeatmapSessions={[]}
        echoHeatmapSessions={[]}
        groupSessions={[]}
        echoSessions={[]}
        chaseSessions={[]}
        lastAccuracyPercent={0}
        lastEchoAccuracyPercent={0}
        lastChaseAccuracyPercent={0}
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

  it('renders Chase mode as a separate training surface', () => {
    render(
      <TrainingRouter
        activeMode="chase"
        groupTab="train"
        setGroupTab={jest.fn()}
        setActiveMode={jest.fn()}
        training={buildTraining({
          isTraining: false,
          hasActiveSession: false,
          isCompletingSession: false,
        })}
        echoTraining={echoTraining}
        chaseTraining={chaseTraining}
        settings={DEFAULT_TRAINING_SETTINGS}
        formSettings={formSettings}
        groupHeatmapSessions={[]}
        echoHeatmapSessions={[]}
        groupSessions={[]}
        echoSessions={[]}
        chaseSessions={[]}
        lastAccuracyPercent={0}
        lastEchoAccuracyPercent={0}
        lastChaseAccuracyPercent={0}
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

    expect(screen.getByText(/Chase Mode/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Chase/i })).toBeInTheDocument();
  });
});
