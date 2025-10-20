import React from 'react';
import { KOCH_SEQUENCE } from '@/lib/morseConstants';

export interface TrainingSettings {
  kochLevel: number;
  sideTone: number;
  steepness: number;
  sessionDuration: number;
  charsPerGroup: number;
  numGroups: number;
  wpm: number;
  groupTimeout: number; // seconds to wait for input before auto-advance
  minGroupSize: number;
  maxGroupSize: number;
  interactiveMode: boolean;
}

interface TrainingSettingsFormProps {
  settings: TrainingSettings;
  setSettings: (s: TrainingSettings) => void;
}

const TrainingSettingsForm: React.FC<TrainingSettingsFormProps> = ({ settings, setSettings }) => {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Koch Level (1-{KOCH_SEQUENCE.length})</label>
          <input type="number" min="1" max={KOCH_SEQUENCE.length} value={settings.kochLevel} onChange={(e) => setSettings({ ...settings, kochLevel: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded" />
          <p className="text-xs text-gray-500 mt-1">Characters: {KOCH_SEQUENCE.slice(0, settings.kochLevel).join(' ')}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Side Tone (Hz)</label>
          <input type="number" value={settings.sideTone} onChange={(e) => setSettings({ ...settings, sideTone: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Steepness (ms)</label>
          <input type="number" value={settings.steepness} onChange={(e) => setSettings({ ...settings, steepness: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Speed (WPM)</label>
          <input type="number" value={settings.wpm} onChange={(e) => setSettings({ ...settings, wpm: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Number of Groups</label>
          <input type="number" value={settings.numGroups} onChange={(e) => setSettings({ ...settings, numGroups: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Group Timeout (seconds)</label>
          <input type="number" step="0.5" value={settings.groupTimeout} onChange={(e) => setSettings({ ...settings, groupTimeout: parseFloat(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Min Group Size</label>
          <input type="number" value={settings.minGroupSize} onChange={(e) => setSettings({ ...settings, minGroupSize: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Group Size</label>
          <input type="number" value={settings.maxGroupSize} onChange={(e) => setSettings({ ...settings, maxGroupSize: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded" />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <input type="checkbox" checked={settings.interactiveMode} onChange={(e) => setSettings({ ...settings, interactiveMode: e.target.checked })} className="w-4 h-4" />
        <label className="text-sm font-medium text-gray-700">Interactive Mode (submit after each group)</label>
      </div>
    </>
  );
};

export default TrainingSettingsForm;


