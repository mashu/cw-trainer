'use client';

import React from 'react';

import { GroupItem } from './GroupItem';

interface GroupsListProps {
  sentGroups: string[];
  userInput: string[];
  confirmedGroups: Record<number, boolean>;
  currentFocusedGroup: number;
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
  onChange,
  onConfirm,
  onFocus,
  inputRef,
}: GroupsListProps): JSX.Element {
  return (
    <div className="max-h-[50vh] sm:max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
      <div className="space-y-2 sm:space-y-3 px-1 py-1">
        {sentGroups.map((group, idx) => (
          <GroupItem
            key={idx}
            index={idx}
            groupText={group}
            value={userInput[idx] || ''}
            confirmed={!!confirmedGroups[idx]}
            isFocused={currentFocusedGroup === idx}
            onChange={(v) => onChange(idx, v)}
            onConfirm={() => onConfirm(idx)}
            onFocus={() => onFocus(idx)}
            inputRef={(el) => inputRef(idx, el)}
          />
        ))}
      </div>
    </div>
  );
}
