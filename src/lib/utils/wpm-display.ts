export const averageWpm = (min: number, max: number): number => Math.round((min + max) / 2);

export const formatWpmRange = (min: number, max: number): string =>
  min === max ? String(min) : `${min}–${max}`;
