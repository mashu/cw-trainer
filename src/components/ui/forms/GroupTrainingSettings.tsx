'use client';

import React from 'react';

export interface GroupTrainingSettings {
  sessionDuration: number;
  charsPerGroup: number;
  numGroups: number;
  groupTimeout: number;
  minGroupSize: number;
  maxGroupSize: number;
  interactiveMode: boolean;
  extraWordSpaceMultiplier: number | undefined;
  autoAdjustKoch: boolean | undefined;
  autoAdjustThreshold: number | undefined;
}

interface GroupTrainingSettingsProps {
  settings: GroupTrainingSettings;
  setSettings: (
    settings: GroupTrainingSettings | ((prev: GroupTrainingSettings) => GroupTrainingSettings),
  ) => void;
}

export function GroupTrainingSettings({
  settings,
  setSettings,
}: GroupTrainingSettingsProps): JSX.Element {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-800">Group Training Settings</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Session Duration (minutes)
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={settings.sessionDuration}
            onChange={(event) => {
              const numValue = parseInt(event.target.value || '5', 10);
              if (!isNaN(numValue) && numValue > 0) {
                setSettings({
                  ...settings,
                  sessionDuration: numValue,
                });
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Characters per Group
          </label>
          <input
            type="number"
            min={1}
            max={10}
            step={1}
            value={settings.charsPerGroup}
            onChange={(event) => {
              const numValue = parseInt(event.target.value || '5', 10);
              if (!isNaN(numValue) && numValue >= 1 && numValue <= 10) {
                setSettings({
                  ...settings,
                  charsPerGroup: numValue,
                });
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Number of Groups
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={settings.numGroups}
            onChange={(event) => {
              const numValue = parseInt(event.target.value || '5', 10);
              if (!isNaN(numValue) && numValue > 0) {
                setSettings({
                  ...settings,
                  numGroups: numValue,
                });
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Group Timeout (seconds)
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={settings.groupTimeout}
            onChange={(event) => {
              const numValue = parseInt(event.target.value || '10', 10);
              if (!isNaN(numValue) && numValue >= 0) {
                setSettings({
                  ...settings,
                  groupTimeout: numValue,
                });
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Min Group Size
          </label>
          <input
            type="number"
            min={1}
            max={10}
            step={1}
            value={settings.minGroupSize}
            onChange={(event) => {
              const numValue = parseInt(event.target.value || '2', 10);
              if (!isNaN(numValue) && numValue >= 1 && numValue <= 10) {
                setSettings({
                  ...settings,
                  minGroupSize: numValue,
                  maxGroupSize: Math.max(numValue, settings.maxGroupSize),
                });
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Group Size
          </label>
          <input
            type="number"
            min={1}
            max={10}
            step={1}
            value={settings.maxGroupSize}
            onChange={(event) => {
              const numValue = parseInt(event.target.value || '3', 10);
              if (!isNaN(numValue) && numValue >= 1 && numValue <= 10) {
                setSettings({
                  ...settings,
                  maxGroupSize: numValue,
                  minGroupSize: Math.min(numValue, settings.minGroupSize),
                });
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Extra Word Space Multiplier
          </label>
          <input
            type="number"
            min={1}
            step={0.1}
            value={settings.extraWordSpaceMultiplier ?? 1}
            onChange={(event) => {
              const numValue = parseFloat(event.target.value || '1');
              if (!isNaN(numValue) && numValue >= 1) {
                setSettings({
                  ...settings,
                  extraWordSpaceMultiplier: numValue,
                });
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.interactiveMode}
              onChange={(event) => {
                setSettings({
                  ...settings,
                  interactiveMode: event.target.checked,
                });
              }}
              className="rounded"
            />
            Interactive Mode
          </label>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.autoAdjustKoch ?? false}
              onChange={(event) => {
                setSettings({
                  ...settings,
                  autoAdjustKoch: event.target.checked,
                });
              }}
              className="rounded"
            />
            Auto Adjust Koch Level
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Auto Adjust Threshold (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={settings.autoAdjustThreshold ?? 90}
            onChange={(event) => {
              const numValue = parseInt(event.target.value || '90', 10);
              if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
                setSettings({
                  ...settings,
                  autoAdjustThreshold: numValue,
                });
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>
      </div>
    </div>
  );
}

