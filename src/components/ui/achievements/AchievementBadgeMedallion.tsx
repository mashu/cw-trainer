import type { AchievementCategory, AchievementTier } from '@/lib/achievements';

const tierIconClasses: Record<AchievementTier, string> = {
  bronze: 'bg-amber-100 text-amber-700 ring-amber-200',
  silver: 'bg-slate-100 text-slate-700 ring-slate-200',
  gold: 'bg-yellow-100 text-yellow-700 ring-yellow-200',
  platinum: 'bg-indigo-100 text-indigo-700 ring-indigo-200',
  diamond: 'bg-cyan-100 text-cyan-700 ring-cyan-300 shadow-sm shadow-cyan-200/60',
};

const categoryInitial: Record<AchievementCategory, string> = {
  mastery: 'M',
  performance: 'P',
  consistency: 'C',
  score: 'S',
};

export function AchievementBadgeMedallion({
  tier,
  category,
  unlocked = true,
}: {
  readonly tier: AchievementTier;
  readonly category: AchievementCategory;
  readonly unlocked?: boolean;
}): JSX.Element {
  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 ${
        unlocked ? tierIconClasses[tier] : 'bg-slate-100 text-slate-400 ring-slate-200'
      }`}
      aria-hidden="true"
    >
      <svg className="h-7 w-7" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="13" r="8" stroke="currentColor" strokeWidth="2" />
        <path
          d="M11 20L8 29L16 25L24 29L21 20"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <text x="16" y="16" textAnchor="middle" className="fill-current text-[9px] font-bold">
          {categoryInitial[category]}
        </text>
      </svg>
    </div>
  );
}

export const achievementTierCardClasses: Record<AchievementTier, string> = {
  bronze: 'border-amber-200 bg-amber-50 text-amber-800',
  silver: 'border-slate-200 bg-slate-50 text-slate-800',
  gold: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  platinum: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  diamond:
    'border-cyan-300 bg-gradient-to-br from-cyan-50 via-sky-50 to-blue-100 text-cyan-950 shadow-sm shadow-cyan-100',
};
