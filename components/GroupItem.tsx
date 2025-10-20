import React from 'react';

interface GroupItemProps {
  index: number;
  groupText: string;
  value: string;
  confirmed: boolean;
  onChange: (value: string) => void;
  onConfirm: () => void;
  inputRef?: (el: HTMLInputElement | null) => void;
}

const GroupItem: React.FC<GroupItemProps> = ({
  index,
  groupText,
  value,
  confirmed,
  onChange,
  onConfirm,
  inputRef
}) => {
  const maxLen = Math.max(groupText.length, value.length);
  const sentChars = groupText.split('');
  const recvChars = value.toUpperCase().split('');

  return (
    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500">Group {index + 1}</span>
        <span className={`text-xs px-2 py-0.5 rounded ${confirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
          {confirmed ? groupText : '••••'}
        </span>
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onConfirm();
          }
        }}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Type group answer and press Enter"
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
                  const s = sentChars[i] || '';
                  const r = recvChars[i] || '';
                  const ok = s === r && s !== '';
                  const cls = ok ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200';
                  return (
                    <span key={`r-${i}`} className={`px-1 border ${cls} rounded`}>{r || '·'}</span>
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


