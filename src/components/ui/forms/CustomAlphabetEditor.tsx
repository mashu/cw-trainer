import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { MORSE_CODE } from '@/lib/morseConstants';

interface CustomAlphabetEditorProps {
  customSet: string[];
  onCustomSetChange: (newSet: string[]) => void;
  allChars: string[];
  letters: string[];
  digitsAsc: string[];
}

export function CustomAlphabetEditor({
  customSet,
  onCustomSetChange,
  allChars,
  letters,
  digitsAsc,
}: CustomAlphabetEditorProps): JSX.Element {
  const [draggedItem, setDraggedItem] = useState<{ char: string; index: number } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [originalSet, setOriginalSet] = useState<string[]>([]);

  // Store original set when component mounts or set changes significantly
  useEffect(() => {
    if (customSet.length > 0 && originalSet.length === 0) {
      setOriginalSet([...customSet]);
    }
  }, [customSet, originalSet]);

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

    const newSet = [...customSet];
    
    // Remove the dragged item
    const removed = newSet.splice(sourceIndex, 1)[0];
    if (removed === undefined) {
      setDraggedItem(null);
      setDragOverIndex(null);
      return;
    }
    
    // Calculate the correct insertion index
    // If dragging to the right, we need to account for the removed item
    const insertIndex = sourceIndex < dropIndex ? dropIndex - 1 : dropIndex;
    
    // Insert at the new position
    newSet.splice(insertIndex, 0, removed);
    
    // Update the set
    onCustomSetChange(newSet);
    
    // Clean up
    setDraggedItem(null);
    setDragOverIndex(null);
  }, [draggedItem, customSet, onCustomSetChange]);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverIndex(null);
  }, []);

  const handleToggleChar = useCallback((character: string) => {
    const set = new Set(customSet.map((entry) => entry.toUpperCase()));
    if (set.has(character)) {
      set.delete(character);
    } else {
      set.add(character);
    }
    onCustomSetChange(Array.from(set));
  }, [customSet, onCustomSetChange]);

  const availableChars = useMemo(() => {
    return allChars.filter((char) => !customSet.includes(char));
  }, [allChars, customSet]);

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <div className="flex gap-2 flex-wrap text-xs items-center">
        <button
          type="button"
          className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
          onClick={() => {
            onCustomSetChange(letters);
            setOriginalSet([...letters]);
          }}
        >
          Letters
        </button>
        <button
          type="button"
          className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
          onClick={() => {
            onCustomSetChange(digitsAsc);
            setOriginalSet([...digitsAsc]);
          }}
        >
          Digits
        </button>
        <button
          type="button"
          className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
          onClick={() => {
            onCustomSetChange(allChars);
            setOriginalSet([...allChars]);
          }}
        >
          All
        </button>
        <button
          type="button"
          className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
          onClick={() => {
            onCustomSetChange([]);
            setOriginalSet([]);
          }}
        >
          Clear
        </button>
        {originalSet.length > 0 && (
          <button
            type="button"
            className="px-2 py-1 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700"
            onClick={() => onCustomSetChange([...originalSet])}
            title="Reset to original order"
          >
            ↺ Reset
          </button>
        )}
      </div>

      {/* Enabled Characters - Draggable */}
      {customSet.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selected Characters ({customSet.length}) - Drag to reorder
          </label>
          <div className="min-h-[100px] p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200">
            <div 
              className="grid grid-cols-5 gap-2"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (draggedItem) {
                  setDraggedItem(null);
                  setDragOverIndex(null);
                }
              }}
            >
              {customSet.map((character, index) => {
                const isDragging = draggedItem?.index === index;
                const isDragOver = dragOverIndex === index;
                const displayChar = character || '';
                const morse = MORSE_CODE[character] || '';

                return (
                  <div
                    key={`${character}-${index}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      handleDragStart(character, index);
                    }}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`
                      group relative flex items-center justify-center
                      h-10 rounded-lg border-2 font-semibold text-xs
                      cursor-move transition-all duration-200
                      ${isDragging
                        ? 'opacity-50 scale-95 bg-slate-300 border-slate-400 shadow-lg z-50'
                        : isDragOver
                        ? 'scale-110 bg-indigo-100 border-indigo-400 shadow-md ring-2 ring-indigo-300'
                        : 'bg-white hover:bg-indigo-50 border-slate-300 hover:border-indigo-400 hover:shadow-md'
                      }
                    `}
                    title={`${displayChar} (${morse}) - Drag to reorder`}
                  >
                    <span className="text-slate-800">
                      {displayChar}
                    </span>
                    {!isDragging && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleChar(character);
                        }}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
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
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 Drag characters to reorder • Click × to remove
          </p>
        </div>
      )}

      {/* Available Characters to Add */}
      {availableChars.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Add Characters ({availableChars.length} available)
          </label>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-5 gap-2">
              {availableChars.map((character) => {
                const displayChar = character || '';
                const morse = MORSE_CODE[character] || '';
                
                return (
                  <button
                    key={character}
                    type="button"
                    onClick={() => handleToggleChar(character)}
                    className="h-10 rounded border border-gray-300 bg-white text-slate-700 hover:bg-indigo-50 hover:border-indigo-400 text-xs font-medium transition-all hover:shadow-sm flex items-center justify-center"
                    title={`${displayChar} (${morse})`}
                  >
                    {displayChar}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-xs font-medium text-slate-700 mb-1">Preview:</p>
        <p className="text-xs text-slate-600 break-words font-mono">
          {customSet.length > 0 ? customSet.join(' ') : '—'}
        </p>
      </div>
    </div>
  );
}
