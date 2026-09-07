import React, { useState, useEffect } from 'react';
import { Card, GradeTier } from '../../types/mtg';
import { findSimilarCards, CardSimilarityResult, SimilarCardMatch } from '../../services/cardSimilarity';
import { CardObfuscator } from '../CardObfuscator';
import { ManaCostRenderer } from '../UI/ManaSymbol';
import { SetSymbol } from '../UI/SetSymbol';
import { X, Sparkles, Scale, TrendingUp, Check, Award, ExternalLink, ArrowRight, Layers, HelpCircle, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface SimilarCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetCard: Card | null;
  currentGrade?: GradeTier;
  onAdoptGrade?: (card: Card, grade: GradeTier) => void;
}

export const SimilarCardsModal: React.FC<SimilarCardsModalProps> = ({
  isOpen,
  onClose,
  targetCard,
  currentGrade,
  onAdoptGrade,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<CardSimilarityResult | null>(null);
  const [adoptedGrade, setAdoptedGrade] = useState<GradeTier | null>(null);

  // Load similar cards when targetCard changes or modal opens
  useEffect(() => {
    if (!isOpen || !targetCard) {
      setData(null);
      setAdoptedGrade(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setAdoptedGrade(null);

    findSimilarCards(targetCard)
      .then((result) => {
        if (isMounted) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load similar cards:', err);
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, targetCard]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !targetCard) return null;

  const handleAdopt = (grade: GradeTier) => {
    if (onAdoptGrade && targetCard) {
      onAdoptGrade(targetCard, grade);
      setAdoptedGrade(grade);
      try {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch (e) {}
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-slate-50/70 dark:bg-[#050818]/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-violet-600 to-amber-500 flex items-center justify-center text-white shadow-md shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-heading tracking-tight">
                  Historical Comps & Similar Cards
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-100 text-violet-800 dark:bg-cyan-500/20 dark:text-cyan-300 font-bold border border-violet-200 dark:border-cyan-400/30">
                  Precedent Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Finding functionally comparable cards across modern premier draft sets to project benchmark performance.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="w-8 h-8 text-violet-600 dark:text-cyan-400 animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Analyzing card DNA & searching Scryfall...
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Matching mana cost, type line, keywords, and oracle text against past draft formats
                </p>
              </div>
            </div>
          ) : !data || data.matches.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <HelpCircle className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  No direct historical comps found
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  This card may have an unprecedented combination of mechanics, colors, or mana value in modern premier draft sets.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Top Consensus Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-violet-600/10 via-amber-500/10 to-emerald-500/10 border-2 border-violet-400/40 dark:border-cyan-400/40 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-violet-600 dark:text-cyan-400" />
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Historical Benchmark Consensus
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-2xl sm:text-3xl font-black font-mono px-2.5 py-0.5 rounded-xl bg-violet-600 text-white shadow-xs">
                        Tier {data.consensus.projectedTier}
                      </span>
                      {data.consensus.averageWinRate !== undefined && (
                        <span className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-300">
                          {(data.consensus.averageWinRate * 100).toFixed(1)}% Avg GIH WR
                        </span>
                      )}
                      {data.consensus.tierRangeMin && data.consensus.tierRangeMax && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          Range: {data.consensus.tierRangeMin} to {data.consensus.tierRangeMax}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Adopt Button */}
                  {onAdoptGrade && (
                    <button
                      type="button"
                      onClick={() => handleAdopt(data.consensus.projectedTier)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0 ${
                        adoptedGrade === data.consensus.projectedTier || currentGrade === data.consensus.projectedTier
                          ? 'bg-emerald-600 text-white border border-emerald-400'
                          : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border border-violet-400/40 hover:shadow-md'
                      }`}
                    >
                      {adoptedGrade === data.consensus.projectedTier || currentGrade === data.consensus.projectedTier ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Consensus Adopted ({data.consensus.projectedTier})</span>
                        </>
                      ) : (
                        <>
                          <Award className="w-4 h-4" />
                          <span>Adopt Consensus Grade ({data.consensus.projectedTier})</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                  {data.consensus.summaryText}
                </p>
              </div>

              {/* Target Card vs Similar Comps Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Target Card Column (Desktop left side, 4 cols) */}
                <div className="lg:col-span-4 p-4 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-3 lg:sticky lg:top-0">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-mono font-bold text-violet-700 dark:text-cyan-400 tracking-wider">
                      Target Card
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                      #{targetCard.collector_number}
                    </span>
                  </div>

                  <div className="flex flex-col items-center">
                    <CardObfuscator
                      card={targetCard}
                      obfuscation={{ target: 'none', style: 'blur', isRevealed: true }}
                      size="md"
                    />
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="font-bold text-slate-900 dark:text-white">{targetCard.name}</h4>
                      {targetCard.mana_cost && <ManaCostRenderer manaCost={targetCard.mana_cost} size="xs" />}
                    </div>
                    <p className="text-[11px] font-mono text-violet-700 dark:text-cyan-300">{targetCard.type_line}</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      {targetCard.oracle_text || 'No oracle text.'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-500 dark:text-slate-400">Current Rating:</span>
                    <span className="font-bold px-2 py-0.5 rounded bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border border-violet-300 dark:border-violet-800">
                      {currentGrade ? `Me: ${currentGrade}` : 'Unrated'}
                    </span>
                  </div>
                </div>

                {/* Similar Cards Matches List (Desktop right side, 8 cols) */}
                <div className="lg:col-span-8 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase font-mono font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                      Comparable Historical Cards ({data.matches.length})
                    </h4>
                    <span className="text-[11px] font-mono text-slate-400">
                      Sorted by functional similarity
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.matches.map((match) => {
                      const comp = match.card;
                      return (
                        <div
                          key={`${comp.set}_${comp.id}`}
                          className="p-3.5 rounded-2xl bg-white dark:bg-[#070b1e] border border-slate-200 dark:border-slate-800/90 shadow-xs hover:border-violet-400/50 dark:hover:border-cyan-400/50 transition-all flex flex-col justify-between gap-2.5"
                        >
                          <div className="flex items-start gap-2.5">
                            {/* Card Image Thumbnail */}
                            <div className="shrink-0 w-16 sm:w-20">
                              <CardObfuscator
                                card={comp}
                                obfuscation={{ target: 'none', style: 'blur', isRevealed: true }}
                                size="sm"
                              />
                            </div>

                            {/* Card Details & Ratings */}
                            <div className="flex-1 min-w-0 space-y-1.5 text-xs">
                              <div className="flex items-start justify-between gap-1">
                                <div className="min-w-0">
                                  <h5 className="font-bold text-slate-900 dark:text-white truncate" title={comp.name}>
                                    {comp.name}
                                  </h5>
                                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                    <SetSymbol setCode={comp.set} size="xs" />
                                    <span className="font-bold uppercase text-violet-700 dark:text-cyan-300">{comp.set}</span>
                                    <span>•</span>
                                    <span className="capitalize">{comp.rarity}</span>
                                  </div>
                                </div>
                                {comp.mana_cost && <ManaCostRenderer manaCost={comp.mana_cost} size="xs" />}
                              </div>

                              {/* Match percentage & reasons */}
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-900 dark:bg-cyan-500/20 dark:text-cyan-300 font-mono text-[9px] font-bold border border-cyan-200 dark:border-cyan-500/40">
                                  {match.similarityScore}% Match
                                </span>
                                {match.matchReasons.map((r, i) => (
                                  <span key={i} className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono text-[9px]">
                                    {r}
                                  </span>
                                ))}
                              </div>

                              {/* Historical Ratings (17L & LSV) */}
                              <div className="grid grid-cols-2 gap-1.5 pt-1 font-mono text-[10px]">
                                {/* 17L Rating */}
                                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-0.5">
                                  <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 font-bold">
                                    <span>17L</span>
                                    <span className="text-[11px] font-black">{match.tierGrade || 'TBD'}</span>
                                  </div>
                                  <div className="text-[9px] text-emerald-700/80 dark:text-emerald-400/80 truncate">
                                    {match.winRate !== undefined ? `${(match.winRate * 100).toFixed(1)}% WR` : 'No match log'}
                                  </div>
                                </div>

                                {/* LSV Rating */}
                                <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-0.5">
                                  <div className="flex items-center justify-between text-amber-800 dark:text-amber-300 font-bold">
                                    <span>LSV</span>
                                    <span className="text-[11px] font-black">{match.lsvGrade || '—'}</span>
                                  </div>
                                  <div className="text-[9px] text-amber-700/80 dark:text-amber-400/80 truncate">
                                    {match.lsvScore ? `${match.lsvScore.toFixed(1)} / 5.0` : 'Preview'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Oracle Text snippet */}
                          <p className="text-[10px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed italic bg-slate-50 dark:bg-[#050818] p-1.5 rounded-lg border border-slate-100 dark:border-slate-800/60">
                            "{comp.oracle_text || 'No oracle text.'}"
                          </p>

                          {/* Adopt This Card's Grade Button */}
                          {onAdoptGrade && (match.tierGrade || match.lsvGrade) && (
                            <button
                              type="button"
                              onClick={() => handleAdopt((match.tierGrade || match.lsvGrade)!)}
                              className="w-full py-1 px-2 rounded-lg text-[10px] font-bold font-mono transition-all bg-slate-100 dark:bg-slate-800/80 hover:bg-violet-100 dark:hover:bg-violet-950/60 text-slate-700 dark:text-slate-300 hover:text-violet-700 dark:hover:text-cyan-300 border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-cyan-400/40 flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <span>Rate target card as {match.tierGrade || match.lsvGrade}</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#050818]/80">
          <span className="font-mono text-[11px] hidden sm:inline">
            Searches Booster Sets: BLB, OTJ, MKM, LCI, WOE, MOM, ONE, BRO, DMU, NEO, STX, DSK, FDN
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors ml-auto cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
