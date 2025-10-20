import React from 'react';

interface GroupItemProps {
  index: number;
  groupText: string;
  value: string;
  confirmed: boolean;
  isFocused?: boolean;
  onChange: (value: string) => void;
  onConfirm: (value?: string) => void;
  onFocus?: () => void;
  inputRef?: (el: HTMLInputElement | null) => void;
}

const GroupItem: React.FC<GroupItemProps> = ({
  index,
  groupText,
  value,
  confirmed,
  isFocused = false,
  onChange,
  onConfirm,
  onFocus,
  inputRef
}) => {
  const maxLen = groupText.length; // Always use the sent group length as reference
  const sentChars = groupText.split('');
  const recvChars = value.trim().toUpperCase().split('');
  const normalizedValue = value.trim().toUpperCase();
  const groupCorrect = confirmed && normalizedValue.length === groupText.length && normalizedValue === groupText;

  return (
    <div className={`p-2 sm:p-3 lg:p-4 rounded-xl border-2 transition-colors duration-200 w-full ${
      isFocused 
        ? 'border-blue-400 bg-blue-50 shadow-md ring-2 ring-blue-200' 
        : confirmed 
          ? 'border-emerald-200 bg-emerald-50' 
          : 'border-slate-200 bg-slate-50'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 sm:mb-3 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs sm:text-sm font-bold px-2 py-1 rounded-full ${
            isFocused 
              ? 'bg-blue-100 text-blue-700' 
              : confirmed 
                ? 'bg-emerald-100 text-emerald-700' 
                : 'bg-slate-200 text-slate-600'
          }`}>
            Group {index + 1}
          </span>
          {isFocused && (
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full animate-pulse">
              Current
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs sm:text-sm font-mono px-2 sm:px-3 py-1 rounded-lg border ${
            confirmed
              ? (groupCorrect
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-rose-100 text-rose-700 border-rose-200')
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}>
            {confirmed ? groupText : '••••'}
          </span>
          {groupCorrect && (
            <span className="text-emerald-600 text-sm sm:text-lg">✓</span>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => onFocus?.()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onConfirm((e.target as HTMLInputElement).value);
          }
        }}
        className={`w-full px-2 sm:px-3 lg:px-4 py-2 sm:py-3 border-2 rounded-xl text-sm font-mono transition-all duration-200 ${
          isFocused
            ? 'border-blue-400 focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-blue-200 focus:border-blue-500'
            : 'border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400'
        }`}
        placeholder="Type group answer..."
      />
      {confirmed && (
        <div className="mt-2">
          <div className="overflow-x-auto">
            <div className="font-mono text-xs whitespace-nowrap">
              <div className="flex gap-1">
                {Array.from({ length: maxLen }).map((_, i) => (
                  <span key={`s-${i}`} className="px-1 text-slate-500">{sentChars[i] || '·'}</span>
                ))}
              </div>
              <div className="flex gap-1 mt-1">
                {Array.from({ length: maxLen }).map((_, i) => {
                  const s = sentChars[i];
                  const r = recvChars[i];
                  const ok = s === r;
                  const cls = ok ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200';
                  return (
                    <span key={`r-${i}`} className={`px-1 border ${cls} rounded`}>
                      {r || '·'}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupItem;


