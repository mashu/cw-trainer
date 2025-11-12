'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';

import { getPresetById, SEQUENCE_PRESETS, type SequencePreset } from '@/lib/sequencePresets';
import { MORSE_CODE } from '@/lib/morseConstants';
import { getDisplayText, isProsign } from '@/lib/prosignUtils';

interface SequenceEditorProps {
  sequence: string[];
  onChange: (sequence: string[]) => void;
  maxLevel?: number;
  onLevelChange?: (level: number) => void;
}

interface DraggedItem {
  char: string;
  index: number;
}

export function SequenceEditor({
  sequence,
  onChange,
  maxLevel,
  onLevelChange,
}: SequenceEditorProps): JSX.Element {
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('koch');
  const [isCustom, setIsCustom] = useState(false);

  const allChars = useMemo(() => Object.keys(MORSE_CODE), []);

  // Detect if current sequence matches a preset
  useEffect(() => {
    const sequenceStr = sequence.join(',');
    const matchingPreset = SEQUENCE_PRESETS.find(
      (preset) => preset.sequence.join(',') === sequenceStr
    );
    if (matchingPreset) {
      setSelectedPreset(matchingPreset.id);
      setIsCustom(false);
    } else if (sequence.length > 0) {
      setIsCustom(true);
    }
  }, [sequence]);

  const currentSequence = useMemo(() => {
    if (maxLevel && maxLevel > 0) {
      return sequence.slice(0, maxLevel);
    }
    return sequence;
  }, [sequence, maxLevel]);

  const handleDragStart = useCallback((char: string, index: number) => {
    setDraggedItem({ char, index });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem) return;
    
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedItem.index !== index) {
      setDragOverIndex(index);
    } else {
      setDragOverIndex(null);
    }
  }, [draggedItem]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if we're actually leaving the element (not just moving to a child)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverIndex(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedItem) {
      setDragOverIndex(null);
      return;
    }
    
    const sourceIndex = draggedItem.index;
    if (sourceIndex === dropIndex) {
      setDraggedItem(null);
      setDragOverIndex(null);
      return;
    }

    // Work with the full sequence, not the currentSequence slice
    const newSequence = [...sequence];
    
    // Remove the dragged item from its original position
    const [removed] = newSequence.splice(sourceIndex, 1);
    
    // Calculate the correct insertion index
    // If dragging to the right, we need to account for the removed item shifting indices
    // If dragging to the left, the target index is correct
    let insertIndex = dropIndex;
    if (sourceIndex < dropIndex) {
      // Dragging right: after removal, all items shift left by 1
      insertIndex = dropIndex - 1;
    }
    
    // Insert at the new position
    newSequence.splice(insertIndex, 0, removed);
    
    // Update the sequence
    onChange(newSequence);
    setIsCustom(true);
    
    // Clean up
    setDraggedItem(null);
    setDragOverIndex(null);
  }, [draggedItem, sequence, onChange]);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverIndex(null);
  }, []);

  const handlePresetSelect = useCallback((presetId: string) => {
    const preset = getPresetById(presetId);
    if (preset) {
      onChange([...preset.sequence]);
      setSelectedPreset(presetId);
      setIsCustom(false);
    }
  }, [onChange]);

  const handleAddChar = useCallback((char: string) => {
    if (!sequence.includes(char)) {
      onChange([...sequence, char]);
      setIsCustom(true);
    }
  }, [sequence, onChange]);

  const handleRemoveChar = useCallback((index: number) => {
    const newSequence = sequence.filter((_, i) => i !== index);
    onChange(newSequence);
    setIsCustom(true);
  }, [sequence, onChange]);

  const handleShuffle = useCallback(() => {
    const shuffled = [...sequence].sort(() => Math.random() - 0.5);
    onChange(shuffled);
    setIsCustom(true);
  }, [sequence, onChange]);

  const handleReset = useCallback(() => {
    const preset = getPresetById(selectedPreset);
    if (preset) {
      onChange([...preset.sequence]);
      setIsCustom(false);
    }
  }, [selectedPreset, onChange]);

  const availableChars = useMemo(() => {
    return allChars.filter((char) => !sequence.includes(char));
  }, [allChars, sequence]);

  return (
    <div className="space-y-4">
      {/* Preset Selector - Fancy Dropdown */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Preset Sequence
        </label>
        <div className="relative">
          <select
            value={isCustom ? 'custom' : selectedPreset}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                // Keep current custom sequence
                return;
              }
              handlePresetSelect(e.target.value);
            }}
            className="w-full px-4 py-2.5 pr-10 text-sm font-medium bg-white border-2 border-gray-300 rounded-lg shadow-sm hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
          >
            {SEQUENCE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name} - {preset.description}
              </option>
            ))}
            {isCustom && <option value="custom">✨ Custom (Modified)</option>}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
        {isCustom && (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 text-xs rounded-lg border bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-700 transition-all"
            >
              ↺ Reset to {getPresetById(selectedPreset)?.name || 'Preset'}
            </button>
            <span className="text-xs text-amber-600">
              ✨ Custom sequence active
            </span>
          </div>
        )}
      </div>

      {/* Level Slider (if maxLevel is provided) */}
      {maxLevel && onLevelChange && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Level: {maxLevel} / {sequence.length}
          </label>
          <input
            type="range"
            min={1}
            max={sequence.length}
            step={1}
            value={maxLevel}
            onChange={(e) => onLevelChange(parseInt(e.target.value, 10))}
            className="w-full"
          />
        </div>
      )}

      {/* Sequence Display - Drag and Drop */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Character Sequence ({currentSequence.length} characters)
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleShuffle}
              className="px-2 py-1 text-xs rounded border border-gray-300 bg-white hover:bg-gray-50 text-slate-700"
              title="Randomize order"
            >
              🔀 Shuffle
            </button>
          </div>
        </div>
        <div className="min-h-[120px] p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200">
          <div 
            className="flex flex-wrap gap-2"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // If dropped on container (not on an item), reset
              if (draggedItem) {
                setDraggedItem(null);
                setDragOverIndex(null);
              }
            }}
          >
            {currentSequence.map((char, index) => {
              const isDragging = draggedItem?.index === index;
              const isDragOver = dragOverIndex === index;
              const displayChar = getDisplayText(char);
              const isProsignChar = isProsign(char);
              const morse = MORSE_CODE[char] || MORSE_CODE[displayChar] || '';

              return (
                <div
                  key={`${char}-${index}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    handleDragStart(char, index);
                  }}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`
                    group relative flex items-center justify-center
                    ${isProsignChar ? 'w-14' : 'w-12'} h-12 rounded-lg border-2 font-semibold text-sm
                    cursor-move transition-all duration-200
                    ${isDragging
                      ? 'opacity-50 scale-95 bg-slate-300 border-slate-400 shadow-lg z-50'
                      : isDragOver
                      ? 'scale-110 bg-indigo-100 border-indigo-400 shadow-md ring-2 ring-indigo-300'
                      : isProsignChar
                      ? 'bg-purple-100 hover:bg-purple-200 border-purple-400 hover:border-purple-500 hover:shadow-md'
                      : 'bg-white hover:bg-indigo-50 border-slate-300 hover:border-indigo-400 hover:shadow-md'
                    }
                  `}
                  title={`${displayChar}${isProsignChar ? ' (Prosign)' : ''} (${morse})`}
                >
                  <span className={`text-slate-800 ${isProsignChar ? 'font-bold' : ''}`}>
                    {displayChar}
                  </span>
                  {!isDragging && (
                    <button
                      type="button"
                      onClick={() => handleRemoveChar(index)}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                      title="Remove character"
                    >
                      ×
                    </button>
                  )}
                  {isDragOver && (
                    <div className="absolute inset-0 border-2 border-dashed border-indigo-500 rounded-lg" />
                  )}
                </div>
              );
            })}
          </div>
          {currentSequence.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              No characters in sequence. Add characters below.
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          💡 Drag characters to reorder • Click × to remove
        </p>
      </div>

      {/* Available Characters to Add */}
      {availableChars.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Add Characters ({availableChars.length} available)
          </label>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex flex-wrap gap-1.5">
              {availableChars.map((char) => {
                const displayChar = getDisplayText(char);
                const isProsignChar = isProsign(char);
                const morse = MORSE_CODE[char] || MORSE_CODE[displayChar] || '';
                return (
                  <button
                    key={char}
                    type="button"
                    onClick={() => handleAddChar(char)}
                    className={`${isProsignChar ? 'w-12' : 'w-10'} h-10 rounded border border-gray-300 bg-white hover:bg-indigo-50 hover:border-indigo-400 text-slate-700 text-sm font-medium transition-all hover:shadow-sm ${isProsignChar ? 'font-bold bg-purple-50 hover:bg-purple-100 border-purple-300' : ''}`}
                    title={`${displayChar}${isProsignChar ? ' (Prosign)' : ''} (${morse})`}
                  >
                    {displayChar}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Sequence Preview */}
      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-xs font-medium text-slate-700 mb-1">Preview:</p>
        <p className="text-xs text-slate-600 break-words font-mono">
          {currentSequence.length > 0 ? currentSequence.join(' ') : '—'}
        </p>
      </div>
    </div>
  );
}

