'use client';

import React from 'react';

interface TrainingControlsProps {
  onSubmit: () => void;
  onStop: () => void;
  submitDisabled?: boolean;
}

export function TrainingControls({
  onSubmit,
  onStop,
  submitDisabled = false,
}: TrainingControlsProps): JSX.Element {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <button
        onClick={onSubmit}
        disabled={submitDisabled}
        className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none disabled:hover:from-blue-600 disabled:hover:to-indigo-600"
      >
        ✅ Submit Results
      </button>
      <button
        onClick={onStop}
        className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-slate-200 to-slate-300 text-slate-800 text-lg font-bold rounded-xl hover:from-slate-300 hover:to-slate-400 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
      >
        ⏹️ Stop Session
      </button>
    </div>
  );
}
