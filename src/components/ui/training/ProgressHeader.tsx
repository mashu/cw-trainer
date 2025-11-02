import React from 'react';

interface ProgressHeaderProps {
  currentGroup: number;
  totalGroups: number;
}

export function ProgressHeader({ currentGroup, totalGroups }: ProgressHeaderProps): JSX.Element {
  const percent = Math.round(((currentGroup + 1) / totalGroups) * 100);
  return (
    <div className="text-center bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
      <p className="text-2xl font-bold text-slate-800 mb-4">
        Playing Group {currentGroup + 1} of {totalGroups}
      </p>
      <div className="w-full bg-slate-200 rounded-full h-6 shadow-inner">
        <div
          className="bg-gradient-to-r from-blue-500 to-indigo-500 h-6 rounded-full transition-all duration-500 shadow-lg"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-sm text-slate-600 mt-3">{percent}% Complete</p>
    </div>
  );
}
