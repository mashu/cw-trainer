import React, { Suspense } from 'react';

import type { TrainingSettings as FormTrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import { SwipeContainer } from '@/components/ui/navigation/SwipeContainer';
import type { UseEchoTrainingSessionReturn } from '@/hooks/useEchoTrainingSession';
import type { UseTrainingSessionReturn } from '@/hooks/useTrainingSession';
import type { SharedAudioFromSettings } from '@/lib/settingsToSharedAudioProps';
import type { IcrSettings, TrainingMode, TrainingSettings, SessionResult } from '@/types';

// Lazy-loaded heavy views — only downloaded when the user navigates to them
const ICRTrainer = React.lazy(() => import('@/components/features/icr/ICRTrainer').then(m => ({ default: m.ICRTrainer })));
const GroupTrainingStats = React.lazy(() => import('@/components/features/stats/GroupTrainingStats').then(m => ({ default: m.GroupTrainingStats })));
const TextPlayer = React.lazy(() => import('@/components/ui/training/TextPlayer').then(m => ({ default: m.TextPlayer })));

function LazyFallback(): JSX.Element {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="text-sm text-slate-500">Loading…</div>
    </div>
  );
}

import { ActiveTrainingView } from './ActiveTrainingView';
import { EchoSessionResultsView } from './EchoSessionResultsView';
import { EchoTrainingView } from './EchoTrainingView';
import { SessionResultsView } from './SessionResultsView';
import { TrainingHomeView } from './TrainingHomeView';

export interface HeatmapSession {
  readonly date: string;
  readonly timestamp: number;
  readonly count: number;
  readonly durationMs?: number;
  readonly groupCount?: number;
  readonly accuracy?: number;
}

interface TrainingRouterProps {
  readonly activeMode: TrainingMode;
  readonly groupTab: 'train' | 'stats';
  readonly setGroupTab: (tab: 'train' | 'stats') => void;
  readonly setActiveMode: (mode: TrainingMode) => void;
  readonly training: UseTrainingSessionReturn;
  readonly echoTraining: UseEchoTrainingSessionReturn;
  readonly settings: TrainingSettings;
  readonly formSettings: FormTrainingSettings;
  readonly groupHeatmapSessions: HeatmapSession[];
  readonly echoHeatmapSessions: HeatmapSession[];
  readonly groupSessions: readonly SessionResult[];
  readonly echoSessions: readonly SessionResult[];
  readonly lastAccuracyPercent: number;
  readonly lastEchoAccuracyPercent: number;
  readonly stopTrainingIfActive: () => void;
  readonly sharedAudio: SharedAudioFromSettings;
  readonly icrSettings: IcrSettings;
  readonly showToast: (t: { message: string; type: 'success' | 'error' | 'info' }) => void;
  readonly handleMoveMode: (delta: number) => void;
}

export function TrainingRouter({
  activeMode,
  groupTab,
  setGroupTab,
  setActiveMode,
  training,
  echoTraining,
  settings,
  formSettings,
  groupHeatmapSessions,
  echoHeatmapSessions,
  groupSessions,
  echoSessions,
  lastAccuracyPercent,
  lastEchoAccuracyPercent,
  stopTrainingIfActive,
  sharedAudio,
  icrSettings,
  showToast,
  handleMoveMode,
}: TrainingRouterProps): JSX.Element | null {
  // ── Group mode: results screen ──
  if (
    training.showResults &&
    !training.isTraining &&
    activeMode === 'group' &&
    training.lastSessionResult
  ) {
    return (
      <SessionResultsView
        result={training.lastSessionResult}
        onTrainAgain={() => {
          training.dismissResults();
          void training.startTraining();
        }}
        onViewStats={() => {
          training.dismissResults();
          setGroupTab('stats');
        }}
        onBack={() => training.dismissResults()}
      />
    );
  }

  // ── Group mode: home screen ──
  if (!training.isTraining && activeMode === 'group' && groupTab === 'train') {
    return (
      <TrainingHomeView
        sessions={groupHeatmapSessions}
        settings={settings}
        lastAccuracyPercent={lastAccuracyPercent}
        sessionCount={groupSessions.length}
        onStartTraining={() => void training.startTraining()}
        onViewStats={() => {
          stopTrainingIfActive();
          setGroupTab('stats');
        }}
      />
    );
  }

  // ── Echo mode: results screen ──
  if (
    echoTraining.showResults &&
    !echoTraining.isTraining &&
    activeMode === 'echo' &&
    echoTraining.lastSessionResult
  ) {
    return (
      <EchoSessionResultsView
        result={echoTraining.lastSessionResult}
        onTrainAgain={() => {
          echoTraining.dismissResults();
          void echoTraining.startTraining();
        }}
        onViewStats={() => {
          echoTraining.dismissResults();
          setGroupTab('stats');
          setActiveMode('group');
        }}
        onBack={() => echoTraining.dismissResults()}
      />
    );
  }

  // ── Echo mode: home screen ──
  if (!echoTraining.isTraining && activeMode === 'echo') {
    return (
      <TrainingHomeView
        sessions={echoHeatmapSessions}
        settings={settings}
        lastAccuracyPercent={lastEchoAccuracyPercent}
        sessionCount={echoSessions.length}
        title="Echo Sending"
        description="Hear each character, then send it back with your paddle. The groups come from the same character set and group settings as normal training."
        startLabel="🎯 Start Echo Mode"
        viewStatsLabel="📊 View All Stats"
        listeningPrompt="Need a quick listening refresher?"
        tips={[
          'Listen to the full rhythm before keying so you send one clean character.',
          'Use [ for dot and ] for dash if your paddle emulates keyboard input.',
          'A wrong symbol ends the current character immediately, so smooth timing matters.',
        ]}
        onStartTraining={() => void echoTraining.startTraining()}
        onViewStats={() => {
          stopTrainingIfActive();
          setGroupTab('stats');
          setActiveMode('group');
        }}
      />
    );
  }

  // ── Group mode: stats tab ──
  if (!training.isTraining && activeMode === 'group' && groupTab === 'stats') {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <button
            onClick={() => setGroupTab('train')}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            Back to Training
          </button>
        </div>
        <Suspense fallback={<LazyFallback />}>
          <GroupTrainingStats embedded onBack={() => setGroupTab('train')} />
        </Suspense>
      </div>
    );
  }

  // ── Group mode: active training ──
  if (training.isTraining && activeMode === 'group') {
    return (
      <ActiveTrainingView
        currentGroup={training.currentGroup}
        numGroups={settings.numGroups}
        sentGroups={training.sentGroups}
        userInput={training.userInput}
        confirmedGroups={training.confirmedGroups}
        currentFocusedGroup={training.currentFocusedGroup}
        isTraining={training.isTraining}
        inputRefs={training.inputRefs}
        inputRefCallback={training.inputRefCallback}
        onChange={training.handleAnswerChange}
        onConfirm={training.confirmGroupAnswer}
        onFocus={(idx) => {
          if (!training.isTraining || idx === training.currentGroup) {
            training.setCurrentFocusedGroup(idx);
          }
        }}
        onSubmit={training.submitAnswer}
        onStop={training.stopTraining}
      />
    );
  }

  // ── Echo mode: active training ──
  if (echoTraining.isTraining && activeMode === 'echo') {
    return (
      <EchoTrainingView
        currentGroup={echoTraining.currentGroup}
        sentGroups={echoTraining.sentGroups}
        currentCharacterIndex={echoTraining.currentCharacterIndex}
        currentCharacterState={echoTraining.currentCharacterState}
        currentSymbols={echoTraining.currentSymbols}
        revealedCharacter={echoTraining.revealedCharacter}
        currentGroupProgress={echoTraining.currentGroupProgress}
        correctCharacters={echoTraining.correctCharacters}
        incorrectCharacters={echoTraining.incorrectCharacters}
        onStop={echoTraining.stopTraining}
      />
    );
  }

  // ── ICR mode ──
  if (activeMode === 'icr') {
    return (
      <SwipeContainer
        onSwipeLeft={() => handleMoveMode(1)}
        onSwipeRight={() => handleMoveMode(-1)}
      >
        <Suspense fallback={<LazyFallback />}>
          <ICRTrainer
            sharedAudio={sharedAudio}
            icrSettings={icrSettings}
            showToast={showToast}
          />
        </Suspense>
      </SwipeContainer>
    );
  }

  // ── Player mode ──
  if (activeMode === 'player') {
    return (
      <SwipeContainer onSwipeRight={() => handleMoveMode(-1)}>
        <div className="space-y-6">
          <Suspense fallback={<LazyFallback />}>
            <TextPlayer settings={formSettings} />
          </Suspense>
        </div>
      </SwipeContainer>
    );
  }

  return null;
}
