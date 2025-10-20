import React from 'react';

interface TrainingControlsProps {
  onSubmit: () => void;
  onStop: () => void;
}

const TrainingControls: React.FC<TrainingControlsProps> = ({ onSubmit, onStop }) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <button onClick={onSubmit} className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl">
        ✅ Submit Results
      </button>
      <button onClick={onStop} className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-slate-200 to-slate-300 text-slate-800 text-lg font-bold rounded-xl hover:from-slate-300 hover:to-slate-400 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl">
        ⏹️ Stop Session
      </button>
    </div>
  );
};

export default TrainingControls;


