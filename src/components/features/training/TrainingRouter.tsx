'use client';

import { useState } from 'react';

import { ChaseHomeView } from '@/components/features/chase/ChaseHomeView';
import { ChaseResultsView } from '@/components/features/chase/ChaseResultsView';
import { ChaseTrainingView } from '@/components/features/chase/ChaseTrainingView';
import type { FormTrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import { LazyBoundary } from '@/components/ui/layouts/LazyBoundary';
import { SwipeContainer } from '@/components/ui/navigation/SwipeContainer';
import { NextGoalCard } from '@/components/ui/training/NextGoalCard';
import { SessionXpCard } from '@/components/ui/training/SessionXpCard';
import { TodaysFocusCard } from '@/components/ui/training/TodaysFocusCard';
import type { UseChaseTrainingSessionReturn } from '@/hooks/useChaseTrainingSession';
import type { UseEchoTrainingSessionReturn } from '@/hooks/useEchoTrainingSession';
import type { UseTrainingSessionReturn } from '@/hooks/useTrainingSession';
import type { UnlockedAchievement } from '@/lib/achievements';
import { computeOperatorProgress } from '@/lib/progression';
import type { SharedAudioFromSettings } from '@/lib/settingsToSharedAudioProps';
import { lazyWithRetry } from '@/lib/utils/lazyWithRetry';
import type {
  HeatmapSession,
  IcrSettings,
  SessionResult,
  TrainingMode,
  TrainingSettings,
} from '@/types';

// Lazy-loaded heavy views — only downloaded when the user navigates to them
const ICRTrainer = lazyWithRetry(() =>
  import('@/components/features/icr/ICRTrainer').then((m) => ({ default: m.ICRTrainer })),
);
const GroupTrainingStats = lazyWithRetry(() =>
  import('@/components/features/stats/GroupTrainingStats').then((m) => ({
    default: m.GroupTrainingStats,
  })),
);
const TextPlayer = lazyWithRetry(() =>
  import('@/components/ui/training/TextPlayer').then((m) => ({ default: m.TextPlayer })),
);
const TextPlayerModal = lazyWithRetry(() =>
  import('@/components/ui/training/TextPlayerModal').then((m) => ({ default: m.TextPlayerModal })),
);

function LazyFallback(): JSX.Element {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="text-sm text-slate-500">Loading…</div>
    </div>
  );
}

import { ActiveTrainingView } from './ActiveTrainingView';
import { EchoDecoderPractice } from './EchoDecoderPractice';
import { EchoSessionResultsView } from './EchoSessionResultsView';
import { EchoTrainingView } from './EchoTrainingView';
import { SessionResultsView } from './SessionResultsView';
import { TeachingPlanPanel } from './TeachingPlanPanel';
import { TrainingHomeView } from './TrainingHomeView';

interface TrainingRouterProps {
  readonly activeMode: TrainingMode;
  readonly groupTab: 'train' | 'stats';
  readonly setGroupTab: (tab: 'train' | 'stats') => void;
  readonly setActiveMode: (mode: TrainingMode) => void;
  readonly training: UseTrainingSessionReturn;
  readonly echoTraining: UseEchoTrainingSessionReturn;
  readonly chaseTraining: UseChaseTrainingSessionReturn;
  readonly settings: TrainingSettings;
  readonly formSettings: FormTrainingSettings;
  readonly groupHeatmapSessions: readonly HeatmapSession[];
  readonly echoHeatmapSessions: readonly HeatmapSession[];
  readonly groupSessions: readonly SessionResult[];
  readonly echoSessions: readonly SessionResult[];
  readonly chaseSessions: readonly SessionResult[];
  readonly lastAccuracyPercent: number;
  readonly lastEchoAccuracyPercent: number;
  readonly lastChaseAccuracyPercent: number;
  readonly stopTrainingIfActive: () => void;
  readonly sharedAudio: SharedAudioFromSettings;
  readonly icrSettings: IcrSettings;
  readonly showToast: (t: { message: string; type: 'success' | 'error' | 'info' }) => void;
  readonly handleMoveMode: (delta: number) => void;
  readonly latestUnlockedAchievements?: readonly UnlockedAchievement[];
  readonly onClearLatestUnlockedAchievements?: () => void;
}

export function TrainingRouter({
  activeMode,
  groupTab,
  setGroupTab,
  setActiveMode,
  training,
  echoTraining,
  chaseTraining,
  settings,
  formSettings,
  groupHeatmapSessions,
  echoHeatmapSessions,
  groupSessions,
  echoSessions,
  chaseSessions,
  lastAccuracyPercent,
  lastEchoAccuracyPercent,
  lastChaseAccuracyPercent,
  stopTrainingIfActive,
  sharedAudio,
  icrSettings,
  showToast,
  handleMoveMode,
  latestUnlockedAchievements = [],
  onClearLatestUnlockedAchievements,
}: TrainingRouterProps): JSX.Element | null {
  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const clearLatestUnlockedAchievements =
    onClearLatestUnlockedAchievements ?? ((): void => undefined);
  // Lifetime XP counts every mode, so switching between Group / Echo / Chase
  // still moves the same rank ladder.
  const allSessions: readonly SessionResult[] = [
    ...groupSessions,
    ...echoSessions,
    ...chaseSessions,
  ];
  const latestGroupSession = groupSessions.reduce<SessionResult | null>(
    (latest, session) =>
      latest === null || session.timestamp > latest.timestamp ? session : latest,
    null,
  );
  const rankProgress = computeOperatorProgress(allSessions);

  // ── Group mode: results screen ──
  if (training.showResults && !training.isTraining && training.lastSessionResult) {
    return (
      <SessionResultsView
        result={training.lastSessionResult}
        unlockedAchievements={latestUnlockedAchievements}
        nextUpSlot={
          <div className="space-y-4">
            {latestGroupSession !== null && (
              <SessionXpCard allSessions={allSessions} latestSession={latestGroupSession} />
            )}
            <NextGoalCard
              sessions={groupSessions}
              settings={settings}
              lastScore={training.lastSessionResult.score}
            />
          </div>
        }
        onTrainAgain={() => {
          clearLatestUnlockedAchievements();
          training.dismissResults();
          void training.startTraining();
        }}
        onViewStats={() => {
          clearLatestUnlockedAchievements();
          training.dismissResults();
          setGroupTab('stats');
        }}
        onBack={() => {
          clearLatestUnlockedAchievements();
          training.dismissResults();
        }}
      />
    );
  }

  // ── Group mode: active training ──
  if (training.hasActiveSession || training.isCompletingSession) {
    const sessionUiLocked =
      (training.hasActiveSession || training.isCompletingSession) && !training.isPlaybackFrozen;
    return (
      <ActiveTrainingView
        currentGroup={training.currentGroup}
        numGroups={Math.max(settings.numGroups, training.sentGroups.length)}
        sentGroups={training.sentGroups}
        userInput={training.userInput}
        confirmedGroups={training.confirmedGroups}
        currentFocusedGroup={training.currentFocusedGroup}
        isTraining={sessionUiLocked}
        inputsFrozen={training.isPlaybackFrozen}
        currentGroupInputLocked={
          (settings.lockInputDuringGroupPlayback ?? true) &&
          training.runtimeStatus === 'playingGroup'
        }
        inputRefs={training.inputRefs}
        inputRefCallback={training.inputRefCallback}
        onChange={training.handleAnswerChange}
        onConfirm={training.confirmGroupAnswer}
        onFocus={(idx) => {
          if (!sessionUiLocked || idx === training.currentGroup) {
            training.setCurrentFocusedGroup(idx);
          }
        }}
        onSubmit={training.submitAnswer}
        onStop={training.stopTraining}
        {...(training.sessionIssueMessage !== undefined
          ? { statusMessage: training.sessionIssueMessage }
          : {})}
      />
    );
  }

  // ── Group mode: home screen ──
  if (
    !training.isTraining &&
    !training.isCompletingSession &&
    activeMode === 'group' &&
    groupTab === 'train'
  ) {
    return (
      <TrainingHomeView
        sessions={groupHeatmapSessions}
        settings={settings}
        lastAccuracyPercent={lastAccuracyPercent}
        sessionCount={groupSessions.length}
        autoAdjustProfile="group"
        rankProgress={rankProgress}
        onStartTraining={() => void training.startTraining()}
        onViewStats={() => {
          stopTrainingIfActive();
          setGroupTab('stats');
        }}
        beforeTipsSlot={
          <div className="space-y-3">
            <TodaysFocusCard sessions={groupSessions} settings={settings} />
            <TeachingPlanPanel sessions={groupSessions} settings={settings} />
          </div>
        }
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
  if (!echoTraining.isTraining && !echoTraining.isCompletingSession && activeMode === 'echo') {
    return (
      <TrainingHomeView
        sessions={echoHeatmapSessions}
        settings={settings}
        lastAccuracyPercent={lastEchoAccuracyPercent}
        sessionCount={echoSessions.length}
        autoAdjustProfile="echo"
        rankProgress={rankProgress}
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
        beforeTipsSlot={<EchoDecoderPractice settings={settings} enabled />}
      />
    );
  }

  // ── Chase mode: results screen ──
  if (
    chaseTraining.status === 'results' &&
    activeMode === 'chase' &&
    chaseTraining.lastSessionResult
  ) {
    return (
      <ChaseResultsView
        result={chaseTraining.lastSessionResult}
        onTrainAgain={() => {
          chaseTraining.dismissResults();
          void chaseTraining.startTraining();
        }}
        onBack={() => chaseTraining.dismissResults()}
      />
    );
  }

  // ── Chase mode: active training ──
  if (
    (chaseTraining.status === 'running' || chaseTraining.status === 'completing') &&
    activeMode === 'chase'
  ) {
    return (
      <ChaseTrainingView
        notes={chaseTraining.notes}
        recentLetters={chaseTraining.recentLetters}
        wpm={chaseTraining.wpm}
        wpmMin={settings.effectiveWpmMin}
        wpmMax={settings.effectiveWpmMax}
        calm={chaseTraining.calm}
        level={chaseTraining.level}
        score={chaseTraining.score}
        combo={chaseTraining.combo}
        bestCombo={chaseTraining.bestCombo}
        levelProgress={chaseTraining.levelProgress}
        lettersHeard={chaseTraining.lettersHeard}
        correctCount={chaseTraining.correctCount}
        wrongCount={chaseTraining.wrongCount}
        missedCount={chaseTraining.missedCount}
        onKeystroke={chaseTraining.handleKeystroke}
        onStop={chaseTraining.stopTraining}
      />
    );
  }

  // ── Chase mode: home screen ──
  if (activeMode === 'chase') {
    return (
      <SwipeContainer onSwipeLeft={() => handleMoveMode(1)} onSwipeRight={() => handleMoveMode(-1)}>
        <ChaseHomeView
          settings={settings}
          sessionCount={chaseSessions.length}
          lastAccuracyPercent={lastChaseAccuracyPercent}
          onStart={() => void chaseTraining.startTraining()}
        />
      </SwipeContainer>
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
        <LazyBoundary name="lazy:group-stats" fallback={<LazyFallback />}>
          <GroupTrainingStats embedded onBack={() => setGroupTab('train')} />
        </LazyBoundary>
      </div>
    );
  }

  // ── Echo mode: active training ──
  if ((echoTraining.isTraining || echoTraining.isCompletingSession) && activeMode === 'echo') {
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
      <SwipeContainer onSwipeLeft={() => handleMoveMode(1)} onSwipeRight={() => handleMoveMode(-1)}>
        <LazyBoundary name="lazy:icr" fallback={<LazyFallback />}>
          <ICRTrainer sharedAudio={sharedAudio} icrSettings={icrSettings} showToast={showToast} />
        </LazyBoundary>
      </SwipeContainer>
    );
  }

  // ── Player mode ──
  if (activeMode === 'player') {
    return (
      <SwipeContainer onSwipeRight={() => handleMoveMode(-1)}>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPlayerModalOpen(true)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Pop-out player
            </button>
          </div>
          <LazyBoundary name="lazy:text-player" fallback={<LazyFallback />}>
            <TextPlayer settings={formSettings} />
          </LazyBoundary>
          <LazyBoundary name="lazy:text-player-modal" fallback={null}>
            <TextPlayerModal
              open={playerModalOpen}
              onClose={() => setPlayerModalOpen(false)}
              settings={formSettings}
            />
          </LazyBoundary>
        </div>
      </SwipeContainer>
    );
  }

  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
      role="alert"
    >
      Unable to match a training view for the current mode and session state. Try switching mode
      with the carousel or reloading the page.
    </div>
  );
}
