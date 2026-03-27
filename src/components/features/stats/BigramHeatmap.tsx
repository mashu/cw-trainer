import React, { useState } from 'react';
import { createPortal } from 'react-dom';

/** Token representing "start of group" in the bigram matrix. */
export const START_TOKEN = '▸';

/**
 * Perceptually smooth green → amber → red colour ramp for the bigram heatmap.
 */
function bigramErrorColor(t: number): string {
  const v = Math.max(0, Math.min(1, t));
  const stops: Array<[number, number, number, number]> = [
    [0,    52, 211, 153],
    [0.15, 74, 222, 128],
    [0.5, 251, 191,  36],
    [1,   239,  68,  68],
  ];
  let i = 0;
  while (i < stops.length - 2 && v > (stops[i + 1]?.[0] ?? 0)) i++;
  const [t0, r0, g0, b0] = stops[i]!;
  const [t1, r1, g1, b1] = stops[i + 1]!;
  const s = t1 > t0 ? (v - t0) / (t1 - t0) : 0;
  const ss = s * s * (3 - 2 * s);
  return `rgb(${Math.round(r0 + (r1 - r0) * ss)},${Math.round(g0 + (g1 - g0) * ss)},${Math.round(b0 + (b1 - b0) * ss)})`;
}

function bigramBorderColor(intensity: number, total: number): string {
  if (total === 0) return 'transparent';
  const v = Math.max(0, Math.min(1, intensity));
  if (v > 0.65) return '#b91c1c';
  if (v > 0.35) return '#b45309';
  return '#059669';
}

export interface BigramCell {
  readonly row: string;
  readonly col: string;
  readonly rate: number;
  readonly total: number;
  readonly wrong: number;
}

export interface UnigramStat {
  readonly letter: string;
  readonly total: number;
  readonly wrong: number;
  readonly rate: number;
}

interface BigramHeatmapProps {
  readonly letters: readonly string[];
  readonly matrix: ReadonlyArray<ReadonlyArray<BigramCell>>;
  readonly maxRate: number;
  readonly unigramStats: readonly UnigramStat[];
  readonly rangeLabel: string;
}

export function BigramHeatmapView({
  letters,
  matrix,
  maxRate,
  unigramStats,
  rangeLabel,
}: BigramHeatmapProps): JSX.Element {
  const [selectedBigram, setSelectedBigram] = useState<{ row: string; col: string } | null>(null);
  const [hoveredBigram, setHoveredBigram] = useState<{ row: string; col: string; x: number; y: number } | null>(null);
  const [hoveredUnigram, setHoveredUnigram] = useState<{ letter: string; x: number; y: number } | null>(null);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div>
          <h3 className="text-base font-semibold text-slate-800">
            Bigram Error Heatmap
            <span className="ml-1.5 text-xs font-normal text-slate-400">{rangeLabel}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Row = preceding character, column = current character. <span className="font-medium">{START_TOKEN}</span> = start of group. Click any cell for details.
          </p>
        </div>
        {letters.length > 0 && (
          <div className="flex items-center gap-2 text-[11px] text-slate-500 shrink-0">
            <span>Accurate</span>
            <div className="h-3 w-28 rounded-full border border-slate-200" style={{
              background: 'linear-gradient(to right,' + [0, 0.15, 0.35, 0.5, 0.7, 0.85, 1].map((s) => bigramErrorColor(s)).join(',') + ')',
            }} />
            <span>Error-prone</span>
            <span className="mx-1 text-slate-300">|</span>
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'repeating-linear-gradient(135deg,#e2e8f0 0 2px,transparent 2px 5px)' }} />
            <span>No data</span>
          </div>
        )}
      </div>

      {letters.length === 0 ? (
        <p className="text-sm text-slate-500">No data yet.</p>
      ) : (
        <div className="space-y-4">
          <div className="overflow-auto rounded-xl border border-slate-200 bg-slate-50/60">
            <table className="min-w-max border-separate" style={{ borderSpacing: '2px' }}>
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 px-2.5 py-2 text-[10px] font-medium tracking-wider uppercase text-slate-400 bg-slate-50/90 backdrop-blur rounded-tl-lg">
                    <span className="hidden sm:inline">prev</span> \ <span className="hidden sm:inline">curr</span>
                  </th>
                  {letters.map((l) => (
                    <th key={l} className="px-0 py-1.5 text-center text-[11px] font-bold text-slate-600 font-mono bg-slate-50/90 backdrop-blur">{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {letters.map((rowL, rIdx) => {
                  const row = matrix[rIdx];
                  if (!row) return null;
                  return (
                    <tr key={rowL}>
                      <td className="sticky left-0 z-10 px-2.5 py-0 text-[11px] font-bold text-slate-600 font-mono bg-slate-50/90 backdrop-blur text-right">{rowL}</td>
                      {row.map((cell) => {
                        const isSelected = selectedBigram?.row === cell.row && selectedBigram?.col === cell.col;
                        const isHovered = hoveredBigram?.row === cell.row && hoveredBigram?.col === cell.col;
                        const normalizedRate = maxRate > 0 ? cell.rate / maxRate : 0;
                        const intensity = Math.min(1, normalizedRate);
                        const hasData = cell.total > 0;
                        const fill = hasData ? bigramErrorColor(intensity) : undefined;
                        const border = isSelected ? '#3b82f6' : isHovered ? '#60a5fa' : hasData ? bigramBorderColor(intensity, cell.total) : 'transparent';
                        return (
                          <td key={`${rowL}_${cell.col}`} className="p-0"
                            onMouseEnter={(e) => {
                              if (isSelected) { setHoveredBigram(null); return; }
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoveredBigram({ row: cell.row, col: cell.col, x: rect.left + rect.width / 2, y: rect.top - 10 });
                            }}
                            onMouseLeave={() => setHoveredBigram(null)}
                            onClick={() => { setSelectedBigram({ row: cell.row, col: cell.col }); setHoveredBigram(null); }}
                          >
                            <div className={`relative w-7 h-7 rounded-[5px] cursor-pointer transition-all duration-150 ease-out
                              ${isSelected ? 'ring-2 ring-blue-500/60 ring-offset-1 z-10 scale-[1.15]' : ''}
                              ${isHovered && !isSelected ? 'scale-110 z-10' : ''}
                              ${!isSelected && !isHovered ? 'hover:scale-105' : ''}`}
                              style={{
                                backgroundColor: fill,
                                borderWidth: hasData ? '1.5px' : '1px',
                                borderStyle: hasData ? 'solid' : 'dashed',
                                borderColor: border,
                                boxShadow: isSelected ? '0 0 0 3px rgba(59,130,246,.18), 0 2px 8px rgba(0,0,0,.1)' : isHovered ? '0 3px 10px rgba(0,0,0,.12)' : hasData ? '0 1px 2px rgba(0,0,0,.04)' : 'none',
                                ...(!hasData ? { background: 'repeating-linear-gradient(135deg,#e2e8f0 0 1.5px,transparent 1.5px 5px)' } : {}),
                              }}
                            >
                              {hasData && (
                                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold leading-none select-none"
                                  style={{
                                    color: intensity > 0.55 ? 'rgba(255,255,255,.95)' : intensity < 0.12 ? 'rgba(255,255,255,.92)' : 'rgba(30,41,59,.8)',
                                    textShadow: intensity > 0.55 || intensity < 0.12 ? '0 1px 2px rgba(0,0,0,.3)' : '0 0 2px rgba(255,255,255,.6)',
                                  }}
                                >
                                  {cell.total > 99 ? '99+' : cell.total}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Per-Character Error Strip */}
          {unigramStats.length > 0 && ((): JSX.Element => {
            const maxUniRate = Math.max(...unigramStats.map((u) => u.rate), 0.001);
            return (
              <div>
                <h4 className="text-xs font-semibold text-slate-600 mb-2">Per-Character Error Rate</h4>
                <div className="flex flex-wrap gap-[3px]">
                  {unigramStats.map((u) => {
                    const uIntensity = Math.min(1, u.rate / maxUniRate);
                    const uFill = bigramErrorColor(uIntensity);
                    const uBorder = bigramBorderColor(uIntensity, u.total);
                    const isUHovered = hoveredUnigram?.letter === u.letter;
                    return (
                      <div key={u.letter} className="relative flex flex-col items-center cursor-pointer"
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredUnigram({ letter: u.letter, x: rect.left + rect.width / 2, y: rect.top - 10 });
                        }}
                        onMouseLeave={() => setHoveredUnigram(null)}
                      >
                        <div className={`w-7 h-7 rounded-[5px] flex items-center justify-center transition-all duration-150 ${isUHovered ? 'scale-110 z-10' : 'hover:scale-105'}`}
                          style={{ backgroundColor: uFill, borderWidth: '1.5px', borderStyle: 'solid', borderColor: uBorder, boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}
                        >
                          <span className="text-[9px] font-semibold leading-none select-none"
                            style={{ color: uIntensity > 0.55 ? 'rgba(255,255,255,.95)' : uIntensity < 0.12 ? 'rgba(255,255,255,.92)' : 'rgba(30,41,59,.8)', textShadow: uIntensity > 0.55 || uIntensity < 0.12 ? '0 1px 2px rgba(0,0,0,.3)' : '0 0 2px rgba(255,255,255,.6)' }}
                          >
                            {u.total > 99 ? '99+' : u.total}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-500 mt-0.5 leading-none font-medium">{u.letter}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">Color shows error rate per character. Hover for details.</p>
              </div>
            );
          })()}

          {/* Hover tooltips for unigram and bigram */}
          {hoveredUnigram && typeof window !== 'undefined' && ((): JSX.Element | null => {
            const u = unigramStats.find((s) => s.letter === hoveredUnigram.letter);
            if (!u || u.total === 0) return null;
            const accuracy = ((u.total - u.wrong) / u.total) * 100;
            const errorRate = u.rate * 100;
            const tooltipWidth = 220;
            const tooltipHeight = 180;
            let tooltipLeft = hoveredUnigram.x - tooltipWidth / 2;
            let tooltipTop = hoveredUnigram.y - tooltipHeight - 12;
            if (tooltipTop < 8) tooltipTop = hoveredUnigram.y + 12;
            if (tooltipLeft < 8) tooltipLeft = 8;
            if (tooltipLeft + tooltipWidth > window.innerWidth - 8) tooltipLeft = window.innerWidth - tooltipWidth - 8;
            return createPortal(
              <div className="fixed z-[9999] pointer-events-none" style={{ left: `${tooltipLeft}px`, top: `${tooltipTop}px`, maxWidth: `${tooltipWidth}px` }}>
                <div className="bg-white border border-slate-300 rounded-lg shadow-xl p-3 min-w-[200px]">
                  <div className="text-sm font-semibold text-slate-800 mb-2 border-b border-slate-200 pb-1">
                    <span className="font-mono font-bold text-lg">{u.letter}</span>
                    <span className="text-xs font-normal text-slate-500 block">Per-character error rate</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <StatBar label="Total Occurrences" value={u.total} barPct={Math.min(100, (u.total / Math.max(u.total, 100)) * 100)} color="blue" />
                    <StatBar label="Errors" value={u.wrong} barPct={u.wrong > 0 ? Math.min(100, (u.wrong / Math.max(u.wrong, 20)) * 100) : 0} color="rose" />
                    <StatBar label="Accuracy" value={`${accuracy.toFixed(1)}%`} barPct={Math.min(100, accuracy)} color="emerald" />
                    <StatBar label="Error Rate" value={`${errorRate.toFixed(1)}%`} barPct={errorRate > 0 ? Math.min(100, (errorRate / Math.max(errorRate, 50)) * 100) : 0} color="amber" />
                  </div>
                </div>
              </div>,
              document.body
            );
          })()}

          {/* Bigram detail panel */}
          {selectedBigram && ((): JSX.Element | null => {
            const rowIdx = letters.indexOf(selectedBigram.row);
            if (rowIdx < 0) return null;
            const row = matrix[rowIdx];
            if (!row) return null;
            const cell = row.find((c) => c.col === selectedBigram.col);
            if (!cell || cell.total === 0) return null;
            const accuracy = ((cell.total - cell.wrong) / cell.total) * 100;
            return (
              <div className="mt-4 p-4 rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-lg">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-lg font-bold text-slate-800 font-mono mb-1">
                      {cell.row === START_TOKEN ? <span title="Start of group">▸</span> : cell.row} → {cell.col}
                    </h4>
                    <p className="text-xs text-slate-600">
                      {cell.row === START_TOKEN ? `Error rate when "${cell.col}" is the first character in a group` : 'Bigram transition statistics'}
                    </p>
                  </div>
                  <button onClick={() => setSelectedBigram(null)} className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Close details">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiBox label="Total Occurrences" value={cell.total} />
                  <KpiBox label="Errors" value={cell.wrong} color="rose" />
                  <KpiBox label="Accuracy" value={`${accuracy.toFixed(1)}%`} color="emerald" />
                  <KpiBox label="Error Rate" value={`${(cell.rate * 100).toFixed(1)}%`} color="amber" />
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <div className="flex-1">
                      <div className="flex justify-between mb-1"><span>Correct</span><span className="font-semibold">{cell.total - cell.wrong}</span></div>
                      <div className="w-full bg-slate-200 rounded-full h-2"><div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: `${accuracy}%` }} /></div>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1"><span>Errors</span><span className="font-semibold">{cell.wrong}</span></div>
                      <div className="w-full bg-slate-200 rounded-full h-2"><div className="bg-rose-500 h-2 rounded-full transition-all duration-300" style={{ width: `${cell.rate * 100}%` }} /></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Bigram hover tooltip */}
          {hoveredBigram && !selectedBigram && typeof window !== 'undefined' && ((): JSX.Element | null => {
            const rowIdx = letters.indexOf(hoveredBigram.row);
            if (rowIdx < 0) return null;
            const row = matrix[rowIdx];
            if (!row) return null;
            const cell = row.find((c) => c.col === hoveredBigram.col);
            if (!cell || cell.total === 0) return null;
            const accuracy = ((cell.total - cell.wrong) / cell.total) * 100;
            const errorRate = cell.rate * 100;
            const tooltipWidth = 220;
            const tooltipHeight = 180;
            let tooltipLeft = hoveredBigram.x - tooltipWidth / 2;
            let tooltipTop = hoveredBigram.y - tooltipHeight - 12;
            if (tooltipTop < 8) tooltipTop = hoveredBigram.y + 12;
            if (tooltipLeft < 8) tooltipLeft = 8;
            if (tooltipLeft + tooltipWidth > window.innerWidth - 8) tooltipLeft = window.innerWidth - tooltipWidth - 8;
            return createPortal(
              <div className="fixed z-[9999] pointer-events-none" style={{ left: `${tooltipLeft}px`, top: `${tooltipTop}px`, maxWidth: `${tooltipWidth}px` }}>
                <div className="bg-white border border-slate-300 rounded-lg shadow-xl p-3 min-w-[200px]">
                  <div className="text-sm font-semibold text-slate-800 mb-2 border-b border-slate-200 pb-1">
                    <span className="font-mono font-bold text-lg">{cell.row === START_TOKEN ? '▸' : cell.row} → {cell.col}</span>
                    {cell.row === START_TOKEN && <span className="text-xs font-normal text-slate-500 block">First character in group</span>}
                  </div>
                  <div className="space-y-2 text-xs">
                    <StatBar label="Total Occurrences" value={cell.total} barPct={Math.min(100, (cell.total / Math.max(cell.total, 100)) * 100)} color="blue" />
                    <StatBar label="Errors" value={cell.wrong} barPct={cell.wrong > 0 ? Math.min(100, (cell.wrong / Math.max(cell.wrong, 20)) * 100) : 0} color="rose" />
                    <StatBar label="Accuracy" value={`${accuracy.toFixed(1)}%`} barPct={Math.min(100, accuracy)} color="emerald" />
                    <StatBar label="Error Rate" value={`${errorRate.toFixed(1)}%`} barPct={errorRate > 0 ? Math.min(100, (errorRate / Math.max(errorRate, 50)) * 100) : 0} color="amber" />
                  </div>
                </div>
              </div>,
              document.body
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ── Small reusable sub-components ──

function StatBar({ label, value, barPct, color }: {
  label: string; value: number | string; barPct: number;
  color: 'blue' | 'rose' | 'emerald' | 'amber';
}): JSX.Element {
  const colors = { blue: 'bg-blue-500', rose: 'bg-rose-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500' };
  const textColors = { blue: 'text-slate-800', rose: 'text-rose-600', emerald: 'text-emerald-600', amber: 'text-amber-600' };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-slate-600">{label}</span>
        <span className={`font-semibold ${textColors[color]}`}>{value}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${colors[color]} rounded-full transition-all`} style={{ width: `${barPct}%` }} />
      </div>
    </div>
  );
}

function KpiBox({ label, value, color }: {
  label: string; value: number | string; color?: 'rose' | 'emerald' | 'amber';
}): JSX.Element {
  const textColor = color === 'rose' ? 'text-rose-600' : color === 'emerald' ? 'text-emerald-600' : color === 'amber' ? 'text-amber-600' : 'text-slate-800';
  return (
    <div className="p-3 rounded-lg bg-white border border-slate-200">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${textColor}`}>{value}</div>
    </div>
  );
}
