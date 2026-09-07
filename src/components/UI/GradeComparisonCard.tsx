import React from 'react';
import { Card, GradeTier, SeventeenLandsCardRating, UserCardEvaluation } from '../../types/mtg';
import { GRADE_TIERS, gradeTierToIndex, winRateToGradeTier } from '../../services/seventeenLands';
import { getLsvRatingForCard } from '../../services/lsvRatings';
import { Scale, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, ShieldAlert, Sparkles, BarChart2, Award } from 'lucide-react';

interface GradeComparisonCardProps {
  card: Card;
  userEval?: UserCardEvaluation | null;
  landData?: SeventeenLandsCardRating | null;
  isBlindGrading?: boolean;
  showLsv?: boolean;
  show17L?: boolean;
  className?: string;
}

export const GradeComparisonCard: React.FC<GradeComparisonCardProps> = ({
  card,
  userEval,
  landData,
  isBlindGrading = false,
  showLsv = true,
  show17L = true,
  className = '',
}) => {
  const lsvRating = getLsvRatingForCard(card);
  const userGrade = userEval?.userGrade;
  const userIndex = userGrade ? gradeTierToIndex(userGrade) : -1;

  const actualGrade: GradeTier | null = landData
    ? ((landData.tier_grade as GradeTier) || winRateToGradeTier(landData.win_rate))
    : null;
  const actualIndex = actualGrade ? gradeTierToIndex(actualGrade) : -1;

  // Gap calculation (Me vs 17Lands)
  const tierDelta = (userIndex >= 0 && actualIndex >= 0) ? actualIndex - userIndex : 0;

  // Gap calculation (Me vs LSV)
  const lsvIndex = gradeTierToIndex(lsvRating.grade);
  const lsvDelta = userIndex >= 0 ? lsvIndex - userIndex : 0;

  const getDeltaBadge = () => {
    if (!userGrade) {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
          Pending Grade
        </span>
      );
    }

    if (isBlindGrading) {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 text-xs font-bold">
          Grading Mode (Hidden)
        </span>
      );
    }

    if (!landData) {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
          17L Data Syncing
        </span>
      );
    }

    if (tierDelta === 0) {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 text-xs font-bold flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>🎯 Exact Match (Me vs 17L)</span>
        </span>
      );
    }

    if (Math.abs(tierDelta) === 1) {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-xs font-bold flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>✓ {tierDelta > 0 ? '+1 Step Over' : '-1 Step Under'} (Correct)</span>
        </span>
      );
    }

    if (tierDelta === 2) {
      return (
        <span className="px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>+2 Over 17L (Minor Trap)</span>
        </span>
      );
    }

    if (tierDelta === -2) {
      return (
        <span className="px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-500/40">
          <TrendingDown className="w-3.5 h-3.5" />
          <span>-2 Under 17L (Minor Sleeper)</span>
        </span>
      );
    }

    if (tierDelta >= 3) {
      return (
        <span className="px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border bg-rose-100 dark:bg-rose-500/25 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/50">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>+{tierDelta} Over 17L (Major Trap 🔥)</span>
        </span>
      );
    }

    return (
      <span className="px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border bg-blue-100 dark:bg-blue-500/25 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-500/50">
        <TrendingDown className="w-3.5 h-3.5" />
        <span>{tierDelta} Under 17L (Major Sleeper 🧊)</span>
      </span>
    );
  };

  const visibleColumnsCount = 1 + (showLsv ? 1 : 0) + (show17L ? 1 : 0);

  return (
    <div className={`p-4 rounded-2xl bg-white dark:bg-[#050818] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5 ${className}`}>
      {/* Header & Delta Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-violet-600 dark:text-cyan-400 shrink-0" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 font-mono">
            Triangulated Evaluation: Me vs LSV vs 17L
          </h4>
        </div>
        <div className="flex items-center gap-1">
          {getDeltaBadge()}
        </div>
      </div>

      {/* Dynamic Multi-Column Triangulation Grid */}
      <div className={`grid gap-3 ${visibleColumnsCount === 3 ? 'grid-cols-1 sm:grid-cols-3' : visibleColumnsCount === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* 1. ME Column (Always Visible) */}
        <div className="p-3 rounded-xl bg-violet-50/60 dark:bg-violet-950/25 border-2 border-violet-300 dark:border-violet-500/40 space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-violet-800 dark:text-violet-300">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
              <span>Me</span>
            </div>
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200 border border-violet-300 dark:border-violet-700/60">
              YOU
            </span>
          </div>

          <div className="flex items-baseline gap-2 pt-0.5">
            {userGrade ? (
              <>
                <span className="text-xl font-black font-mono px-2 py-0.5 rounded-lg bg-violet-600 text-white border border-violet-400 shadow-xs">
                  {userGrade}
                </span>
                <span className="text-xs font-mono font-semibold text-violet-700 dark:text-violet-300">
                  ({userEval?.userScore?.toFixed(1)} / 5.0)
                </span>
              </>
            ) : (
              <span className="text-sm font-semibold text-violet-500/80 italic">Not rated</span>
            )}
          </div>
          {userEval?.pickPriority && (
            <div className="text-[10px] text-violet-700/80 dark:text-violet-300/80 pt-0.5 truncate">
              Priority: <strong className="text-slate-900 dark:text-white">{userEval.pickPriority}</strong>
            </div>
          )}
        </div>

        {/* 2. LSV Column (Togglable) */}
        {showLsv && (
          <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/25 border-2 border-amber-300 dark:border-amber-500/40 space-y-1 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <span>LSV</span>
              </div>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60">
                EXPERT
              </span>
            </div>

            <div className="flex items-baseline gap-2 pt-0.5">
              {!isBlindGrading ? (
                <>
                  <span className="text-xl font-black font-mono px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 border border-amber-400 shadow-xs">
                    {lsvRating.grade}
                  </span>
                  <span className="text-xs font-black font-mono text-amber-700 dark:text-amber-300">
                    {lsvRating.score.toFixed(1)} / 5.0
                  </span>
                </>
              ) : (
                <span className="text-sm font-semibold text-amber-500/80 italic">
                  ???
                </span>
              )}
            </div>

            <div className="text-[10px] text-amber-700/80 dark:text-amber-300/80 flex items-center justify-between pt-0.5">
              {!isBlindGrading ? (
                <>
                  <span>{lsvRating.verdict || 'Playable'}</span>
                  {userGrade && (
                    <span className="font-mono font-semibold">
                      Δ {lsvDelta > 0 ? `+${lsvDelta}` : lsvDelta < 0 ? `${lsvDelta}` : '0'}
                    </span>
                  )}
                </>
              ) : (
                <span className="italic text-amber-600/70 dark:text-amber-400/70">Hidden in grading mode</span>
              )}
            </div>
          </div>
        )}

        {/* 3. 17L Column (Togglable) */}
        {show17L && (
          <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/25 border-2 border-emerald-300 dark:border-emerald-500/40 space-y-1 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>17L</span>
              </div>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700/60">
                ARENA
              </span>
            </div>

            <div className="flex items-baseline gap-2 pt-0.5">
              {actualGrade && !isBlindGrading ? (
                <>
                  <span className="text-xl font-black font-mono px-2 py-0.5 rounded-lg bg-emerald-600 text-white border border-emerald-400 shadow-xs">
                    {actualGrade}
                  </span>
                  <span className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-300">
                    {((landData?.win_rate || 0) * 100).toFixed(1)}% WR
                  </span>
                </>
              ) : (
                <span className="text-sm font-semibold text-emerald-500/80 italic">
                  {isBlindGrading ? '???' : 'Syncing'}
                </span>
              )}
            </div>

            <div className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 flex items-center justify-between pt-0.5">
              {landData && !isBlindGrading ? (
                <>
                  <span>ALSA: <strong className="text-emerald-900 dark:text-white font-mono">{landData.avg_seen.toFixed(1)}</strong></span>
                  {typeof landData.iwd === 'number' && (
                    <span>IWD: <strong className="text-emerald-700 dark:text-emerald-300 font-mono">{(landData.iwd * 100).toFixed(1)}%</strong></span>
                  )}
                </>
              ) : (
                <span>17Lands Logs</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Visual Tier Calibration Track */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
          <span>Tier Spectrum Alignment</span>
          <span>A+ (Bomb) → F (Unplayable)</span>
        </div>

        <div className="grid grid-cols-11 gap-1 p-1 bg-slate-100 dark:bg-[#090e24] rounded-xl border border-slate-200 dark:border-slate-800 text-center">
          {GRADE_TIERS.map((tier, idx) => {
            const isUser = userIndex === idx;
            const isLsv = showLsv && lsvIndex === idx;
            const isActual = show17L && !isBlindGrading && actualIndex === idx;

            return (
              <div
                key={tier}
                className={`py-1 rounded-lg text-[10px] font-mono font-bold transition-all relative flex flex-col items-center justify-center ${
                  isUser
                    ? 'bg-violet-600 text-white font-black shadow-md ring-2 ring-violet-400'
                    : isActual
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/30 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-400'
                    : isLsv
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/30 dark:text-amber-200 border border-amber-300 dark:border-amber-400'
                    : 'bg-white dark:bg-[#050818] text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800/60'
                }`}
              >
                <span>{tier}</span>
                <div className="flex items-center gap-0.5 text-[7px] font-mono uppercase font-black">
                  {isUser && <span className="text-violet-100">Me</span>}
                  {isLsv && <span className="text-amber-800 dark:text-amber-300">LSV</span>}
                  {isActual && <span className="text-emerald-800 dark:text-emerald-300">17L</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GradeComparisonCard;
