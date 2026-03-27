import React from 'react';

interface AppHeaderProps {
  readonly onOpenSidebar: () => void;
}

export function AppHeader({ onOpenSidebar }: AppHeaderProps): JSX.Element {
  return (
    <div className="flex justify-between items-center mb-8">
      <div>
        <h1 className="text-3xl sm:text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Morse Code Trainer
        </h1>
        <p className="text-slate-600 mt-2">
          Train Morse. Fast. Focused. Fun.
        </p>
      </div>
      <button
        onClick={onOpenSidebar}
        className="p-3 bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
      >
        <svg
          className="w-6 h-6 text-slate-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>
    </div>
  );
}
