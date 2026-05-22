import { ACHIEVEMENT_BADGE_BY_ID } from '@/lib/achievements';
import type { UnlockedAchievement } from '@/lib/achievements';

const tierClasses = {
  bronze: 'border-amber-200 bg-amber-50 text-amber-800',
  silver: 'border-slate-200 bg-slate-50 text-slate-800',
  gold: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  platinum: 'border-indigo-200 bg-indigo-50 text-indigo-800',
} as const;

const tierIconClasses = {
  bronze: 'bg-amber-100 text-amber-700 ring-amber-200',
  silver: 'bg-slate-100 text-slate-700 ring-slate-200',
  gold: 'bg-yellow-100 text-yellow-700 ring-yellow-200',
  platinum: 'bg-indigo-100 text-indigo-700 ring-indigo-200',
} as const;

const categoryInitial = {
  mastery: 'M',
  performance: 'P',
  consistency: 'C',
  score: 'S',
} as const;

function BadgeIcon({
  tier,
  category,
}: {
  readonly tier: keyof typeof tierIconClasses;
  readonly category: keyof typeof categoryInitial;
}): JSX.Element {
  return (
    <span
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ${tierIconClasses[tier]}`}
      aria-hidden="true"
    >
      <svg className="h-5 w-5" viewBox="0 0 32 32" fill="none">
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
    </span>
  );
}

export function AchievementUnlockBanner({
  achievements,
}: {
  readonly achievements: readonly UnlockedAchievement[];
}): JSX.Element | null {
  if (achievements.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
            New trophy unlocked
          </p>
          <h3 className="mt-1 text-lg font-bold text-slate-900">
            {achievements.length === 1
              ? ACHIEVEMENT_BADGE_BY_ID[achievements[0]?.id ?? 'first-session'].title
              : `${achievements.length} new trophies`}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Your trophy case has been updated. Share your profile to show this progress.
          </p>
        </div>
        <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-indigo-700 shadow-sm">
          Earned locally
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {achievements.map((achievement) => {
          const badge = ACHIEVEMENT_BADGE_BY_ID[achievement.id];
          return (
            <div
              key={achievement.id}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                tierClasses[badge.tier]
              }`}
            >
              <span className="flex items-center gap-2">
                <BadgeIcon tier={badge.tier} category={badge.category} />
                <span>
                  {badge.title}
                  <span className="ml-2 text-xs font-normal opacity-80">{badge.criteria}</span>
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
