'use client';

import React from 'react';

import { GroupItem } from './GroupItem';

interface GroupsListProps {
  sentGroups: string[];
  userInput: string[];
  confirmedGroups: Record<number, boolean>;
  currentFocusedGroup: number;
  currentActiveGroup?: number;
  isTraining?: boolean;
  interactiveMode?: boolean;
  onChange: (index: number, value: string) => void;
  onConfirm: (index: number) => void;
  onFocus: (index: number) => void;
  inputRef: (index: number, el: HTMLInputElement | null) => void;
}

export function GroupsList({
  sentGroups,
  userInput,
  confirmedGroups,
  currentFocusedGroup,
  currentActiveGroup,
  isTraining = false,
  interactiveMode = false,
  onChange,
  onConfirm,
  onFocus,
  inputRef,
}: GroupsListProps): JSX.Element {
  return (
    <div className="max-h-[50vh] sm:max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
      <div className="space-y-2 sm:space-y-3 px-1 py-1">
        {sentGroups.map((group, idx) => {
          // During training, only allow input on the current active group or already confirmed groups
          // In interactive mode, allow typing in any group
          const isActiveGroup = currentActiveGroup !== undefined && idx === currentActiveGroup;
          // Disable only if: training is active, not interactive mode, not the active group, and not confirmed
          const isDisabled = isTraining && !interactiveMode && !isActiveGroup && !confirmedGroups[idx];
          return (
            <GroupItem
              key={idx}
              index={idx}
              groupText={group}
              value={userInput[idx] || ''}
              confirmed={!!confirmedGroups[idx]}
              isFocused={currentFocusedGroup === idx}
              disabled={isDisabled}
              onChange={(v) => onChange(idx, v)}
              onConfirm={() => onConfirm(idx)}
              onFocus={() => onFocus(idx)}
              inputRef={(el) => inputRef(idx, el)}
            />
          );
        })}
      </div>
    </div>
  );
}
