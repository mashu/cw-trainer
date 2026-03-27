'use client';

import React from 'react';

import { GroupsList } from '@/components/ui/training/GroupsList';
import { ProgressHeader } from '@/components/ui/training/ProgressHeader';
import { TrainingControls } from '@/components/ui/training/TrainingControls';

export interface ActiveTrainingViewProps {
  readonly currentGroup: number;
  readonly numGroups: number;
  readonly sentGroups: string[];
  readonly userInput: string[];
  readonly confirmedGroups: Record<number, boolean>;
  readonly currentFocusedGroup: number;
  readonly isTraining: boolean;
  readonly inputRefs: React.MutableRefObject<Array<HTMLInputElement | null>>;
  readonly inputRefCallback: (
    idx: number,
    el: HTMLInputElement | null,
  ) => void;
  readonly onChange: (index: number, value: string) => void;
  readonly onConfirm: (index: number, overrideValue?: string) => void;
  readonly onFocus: (index: number) => void;
  readonly onSubmit: () => void;
  readonly onStop: () => void;
}

export function ActiveTrainingView({
  currentGroup,
  numGroups,
  sentGroups,
  userInput,
  confirmedGroups,
  currentFocusedGroup,
  isTraining,
  inputRefs,
  inputRefCallback,
  onChange,
  onConfirm,
  onFocus,
  onSubmit,
  onStop,
}: ActiveTrainingViewProps): JSX.Element {
  return (
    <div className="space-y-6">
      <ProgressHeader currentGroup={currentGroup} totalGroups={numGroups} />

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <label className="block text-sm font-medium text-gray-700">
            Enter answers per group (auto-advances when complete):
          </label>

          {/* Group Navigation for Mobile - disabled during training */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm text-gray-600 whitespace-nowrap">
              Jump to:
            </span>
            <select
              value={currentFocusedGroup}
              onChange={(e) => {
                if (!isTraining) {
                  const groupIndex = parseInt(e.target.value);
                  onFocus(groupIndex);
                  inputRefs.current[groupIndex]?.focus();
                }
              }}
              disabled={isTraining}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
            >
              {sentGroups.map((_, idx) => (
                <option key={idx} value={idx}>
                  Group {idx + 1}
                </option>
              ))}
            </select>
          </div>
        </div>

        <GroupsList
          sentGroups={sentGroups}
          userInput={userInput}
          confirmedGroups={confirmedGroups}
          currentFocusedGroup={currentFocusedGroup}
          currentActiveGroup={currentGroup}
          isTraining={isTraining}
          onChange={onChange}
          onConfirm={onConfirm}
          onFocus={onFocus}
          inputRef={inputRefCallback}
        />
        <p className="text-xs text-slate-500 mt-2">
          💡 Auto-advances when group is complete • Use Enter to confirm •
          Scroll to review past groups
        </p>
      </div>

      <TrainingControls onSubmit={onSubmit} onStop={onStop} />
    </div>
  );
}
