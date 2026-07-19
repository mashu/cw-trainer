import React from 'react';

/** Morse insignia pips: '·' renders as a dot, '−' as a short dash bar. */
export function MorseInsignia({
  pattern,
  className = 'bg-amber-500',
}: {
  readonly pattern: string;
  readonly className?: string;
}): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      {Array.from(pattern).map((symbol, i) =>
        symbol === '−' ? (
          <span key={i} className={`inline-block h-1.5 w-4 rounded-full ${className}`} />
        ) : (
          <span key={i} className={`inline-block h-1.5 w-1.5 rounded-full ${className}`} />
        ),
      )}
    </span>
  );
}
