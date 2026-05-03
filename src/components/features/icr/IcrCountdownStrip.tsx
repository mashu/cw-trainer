/**
 * Compact countdown bar matching ICR session card styling (not a full-card overlay).
 */
export function IcrCountdownStrip({ value }: { readonly value: number }): JSX.Element {
  return (
    <div
      className="mb-4 flex items-center justify-between gap-3 overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 px-4 py-3 text-white shadow-md shadow-indigo-900/25 ring-1 ring-white/10"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-100/85">Starting in</span>
      <span className="min-w-[3ch] text-center text-5xl font-black tabular-nums leading-none tracking-tight drop-shadow-sm">
        {value}
      </span>
      <span className="text-[10px] font-medium text-indigo-100/75">sec</span>
    </div>
  );
}
