import React, { useState, useEffect } from 'react';
import { Card, GradeTier } from '../../types/mtg';
import { findSimilarCards, CardSimilarityResult, SimilarCardMatch } from '../../services/cardSimilarity';
import { GRADE_TIERS, get17LandsCardUrl } from '../../services/seventeenLands';
import { CardObfuscator } from '../CardObfuscator';
import { ManaCostRenderer } from '../UI/ManaSymbol';
import { SetSymbol } from '../UI/SetSymbol';
import { X, Scale, Check, PlayingCardsFan, HelpCircle, Loader2, ExternalLink, Info, GitCompare } from 'lucide-react';

export interface CardPerformanceMetrics {
  winRate?: number;
  alsa?: number;
  tierGrade?: GradeTier;
}

interface SimilarCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetCard: Card | null;
  currentGrade?: GradeTier;
  target17LandsData?: CardPerformanceMetrics;
  onAdoptGrade?: (card: Card, grade: GradeTier) => void;
}

export const SimilarCardsModal: React.FC<SimilarCardsModalProps> = ({
  isOpen,
  onClose,
  targetCard,
  currentGrade,
  target17LandsData,
  onAdoptGrade,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<CardSimilarityResult | null>(null);
  const [adoptedSourceId, setAdoptedSourceId] = useState<string | null>(null);
  const [inspectCardMatch, setInspectCardMatch] = useState<SimilarCardMatch | null>(null);

  // Load similar cards when targetCard changes or modal opens
  useEffect(() => {
    if (!isOpen || !targetCard) {
      setData(null);
      setAdoptedSourceId(null);
      setInspectCardMatch(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setAdoptedSourceId(null);
    setInspectCardMatch(null);

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
        if (inspectCardMatch) {
          setInspectCardMatch(null);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, inspectCardMatch, onClose]);

  if (!isOpen || !targetCard) return null;

  const handleAdopt = (grade: GradeTier, sourceId: string) => {
    if (onAdoptGrade && targetCard) {
      onAdoptGrade(targetCard, grade);
      setAdoptedSourceId(sourceId);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-[94vw] max-w-7xl max-h-[94vh] flex flex-col bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-slate-50/80 dark:bg-[#050818]/90">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 shrink-0">
              <PlayingCardsFan className="w-4 h-4 text-violet-600 dark:text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-heading tracking-tight">
                  Historical Comps & Similar Cards
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
                  Precedent Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Comparable cards across premier draft sets with 17Lands win rates.
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="w-9 h-9 text-violet-600 dark:text-cyan-400 animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Searching historical sets & fetching 17Lands data...
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Querying premier draft statistics across WOE, BLB, OTJ, MKM, LCI, DMU, and more
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
              {/* Compact Horizontal Consensus Bar: Maximizes vertical room */}
              <div className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600/10 via-amber-500/5 to-emerald-500/10 border border-violet-400/30 dark:border-cyan-400/30 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap min-w-0">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-violet-600 dark:text-cyan-400 shrink-0" />
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 shrink-0">
                      Consensus
                    </span>
                    <span className="text-base sm:text-lg font-black font-mono px-2 py-0.5 rounded-lg bg-violet-600 text-white shadow-2xs shrink-0">
                      Tier {data.consensus.projectedTier}
                    </span>
                  </div>

                  {data.consensus.averageWinRate !== undefined && (
                    <span className="text-xs sm:text-sm font-bold font-mono text-emerald-700 dark:text-emerald-300 shrink-0">
                      {(data.consensus.averageWinRate * 100).toFixed(1)}% Avg GIH WR
                    </span>
                  )}

                  {data.consensus.tierRangeMin && data.consensus.tierRangeMax && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                      Range: {data.consensus.tierRangeMin} to {data.consensus.tierRangeMax}
                    </span>
                  )}

                  <span className="text-xs text-slate-500 dark:text-slate-400 truncate hidden xl:inline">
                    • {data.consensus.summaryText}
                  </span>
                </div>

                {/* Quick Adopt Button */}
                {onAdoptGrade && (
                  <button
                    type="button"
                    onClick={() => handleAdopt(data.consensus.projectedTier, 'consensus')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 border ${
                      adoptedSourceId === 'consensus'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-2xs'
                        : 'bg-slate-900 dark:bg-slate-800 hover:bg-violet-700 dark:hover:bg-violet-600 text-white border-slate-700 dark:border-slate-600 shadow-2xs hover:border-violet-400'
                    }`}
                  >
                    <Check className={`w-3.5 h-3.5 ${adoptedSourceId === 'consensus' ? 'text-emerald-200' : 'opacity-60'}`} />
                    <span>{adoptedSourceId === 'consensus' ? `Used Grade (${data.consensus.projectedTier})` : `Use Grade (${data.consensus.projectedTier})`}</span>
                  </button>
                )}
              </div>

              {/* Target Card vs Similar Comps Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
                {/* Target Card Column (Desktop left side, 3 cols) */}
                <div className="lg:col-span-3 p-4 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-3 lg:sticky lg:top-0">
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
                    <select
                      value={currentGrade || ''}
                      onChange={(e) => {
                        const newGrade = e.target.value as GradeTier;
                        if (newGrade && onAdoptGrade) {
                          onAdoptGrade(targetCard, newGrade);
                        }
                      }}
                      className="px-2 py-0.5 rounded bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border border-violet-300 dark:border-violet-800 font-bold focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer text-center min-w-[70px]"
                    >
                      <option value="" disabled>Unrated</option>
                      {GRADE_TIERS.map((tier) => (
                        <option key={tier} value={tier}>
                          {tier}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Similar Cards Matches List (Desktop right side, 9 cols) - 2 Columns of spacious cards */}
                <div className="lg:col-span-9 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase font-mono font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                      Comparable Historical Cards ({data.matches.length})
                    </h4>
                    <span className="text-[11px] font-mono text-slate-400">
                      Click any card to inspect details
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.matches.map((match) => {
                      const comp = match.card;
                      const imageUri = comp.image_uris?.normal ||
                        comp.image_uris?.large ||
                        (comp.card_faces && comp.card_faces[0]?.image_uris?.normal) ||
                        'https://cards.scryfall.io/back.jpg';

                      return (
                        <div
                          key={`${comp.set}_${comp.id}`}
                          onClick={() => setInspectCardMatch(match)}
                          className="group p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#070b1e] border border-slate-200 dark:border-slate-800/90 shadow-xs hover:border-violet-400 dark:hover:border-cyan-400 transition-all flex flex-col justify-between gap-3 cursor-pointer hover:shadow-md"
                        >
                          <div className="flex items-start gap-3.5">
                            {/* Full Card Visual in small scale (aspect ratio 5:7, ~130-145px width) */}
                            <div className="relative shrink-0 w-[125px] sm:w-[145px] h-[174px] sm:h-[202px] rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 bg-[#050818] shadow-md group-hover:ring-2 group-hover:ring-violet-400 dark:group-hover:ring-cyan-400 transition-all">
                              <img
                                src={imageUri}
                                alt={comp.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <span className="text-[10px] font-mono font-bold text-white bg-black/60 px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
                                  <Info className="w-3 h-3 text-cyan-400" />
                                  Inspect
                                </span>
                              </div>
                            </div>

                            {/* Card Header, Badges & Details */}
                            <div className="flex-1 min-w-0 space-y-2 text-xs flex flex-col justify-between self-stretch">
                              <div className="space-y-1.5">
                                <div className="flex items-start justify-between gap-1">
                                  <div className="min-w-0">
                                    <h5 className="font-bold text-slate-900 dark:text-white truncate group-hover:text-violet-600 dark:group-hover:text-cyan-300 transition-colors text-sm" title={comp.name}>
                                      {comp.name}
                                    </h5>
                                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                      <SetSymbol setCode={comp.set} size="xs" />
                                      <span className="font-bold uppercase text-violet-700 dark:text-cyan-300">{comp.set}</span>
                                      <span>•</span>
                                      <span className="capitalize">{comp.rarity}</span>
                                      {comp.type_line && (
                                        <>
                                          <span>•</span>
                                          <span className="truncate max-w-[90px]">{comp.type_line.split('—')[0].trim()}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  {comp.mana_cost && <ManaCostRenderer manaCost={comp.mana_cost} size="xs" />}
                                </div>

                                {/* Match percentage & reasons */}
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className="px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-900 dark:bg-cyan-500/20 dark:text-cyan-300 font-mono text-[9px] font-bold border border-cyan-200 dark:border-cyan-500/40">
                                    {match.similarityScore}% Match
                                  </span>
                                  {match.matchReasons.map((r, i) => (
                                    <span key={i} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono text-[9px]">
                                      {r}
                                    </span>
                                  ))}
                                </div>

                                {/* Oracle Text snippet */}
                                <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed italic bg-slate-50 dark:bg-[#050818] p-2 rounded-xl border border-slate-100 dark:border-slate-800/60">
                                  "{comp.oracle_text || 'No oracle text.'}"
                                </p>
                              </div>

                              {/* 17Lands Performance & Use Grade Action Bar (Pinned to card bottom) */}
                              <div className="pt-2 flex items-center justify-between gap-2.5 border-t border-slate-100 dark:border-slate-800/60">
                                {/* Expanded 17L Rating Badge taking up majority of the space */}
                                <div className="flex-1 min-w-0 flex items-center justify-between px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 font-mono">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">17L</span>
                                    <span className="text-sm font-black text-emerald-900 dark:text-emerald-200 px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-900/50">
                                      {match.tierGrade || 'TBD'}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2.5 text-right">
                                    {match.winRate !== undefined && (
                                      <div>
                                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 block leading-tight">
                                          {(match.winRate * 100).toFixed(1)}%
                                        </span>
                                        <span className="text-[9px] uppercase tracking-wider text-emerald-600/75 dark:text-emerald-400/75 block">
                                          GIH WR
                                        </span>
                                      </div>
                                    )}
                                    {match.alsa !== undefined && (
                                      <div className="border-l border-emerald-300/40 dark:border-emerald-700/40 pl-2">
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block leading-tight">
                                          {match.alsa.toFixed(1)}
                                        </span>
                                        <span className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                                          ALSA
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Compact Mini Use Grade Button */}
                                {onAdoptGrade && match.tierGrade && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAdopt(match.tierGrade!, match.card.id);
                                    }}
                                    className={`py-1.5 px-2.5 rounded-xl text-[11px] font-bold font-mono transition-all flex items-center justify-center gap-1 cursor-pointer border shrink-0 ${
                                      adoptedSourceId === match.card.id
                                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-2xs'
                                        : 'bg-slate-900 dark:bg-slate-800 hover:bg-violet-700 dark:hover:bg-violet-600 text-white border-slate-700 dark:border-slate-600 shadow-2xs hover:border-violet-400'
                                    }`}
                                    title={`Adopt grade ${match.tierGrade} for target card`}
                                  >
                                    <Check className={`w-3 h-3 ${adoptedSourceId === match.card.id ? 'text-emerald-200' : 'opacity-60'}`} />
                                    <span>{adoptedSourceId === match.card.id ? `Used` : `Use`}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
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
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-[#050818]/90">
          <span className="font-mono text-[11px] hidden sm:inline">
            Searches Premier Draft Precedents across modern standard & booster sets
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

      {/* Nested Card Detail Inspector Modal on Comp Click */}
      {inspectCardMatch && targetCard && (
        <div 
          onClick={() => setInspectCardMatch(null)}
          className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl bg-white dark:bg-[#0b1029] border border-slate-200 dark:border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-[#070b1e]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800/60 flex items-center justify-center text-violet-600 dark:text-cyan-400 shrink-0">
                  <GitCompare className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-heading truncate">
                      {targetCard.name} vs. {inspectCardMatch.card.name}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 shrink-0">
                      {inspectCardMatch.similarityScore}% Match
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                    <span>Head-to-head comparison</span>
                    <span>•</span>
                    <span className="text-violet-700 dark:text-cyan-300 font-bold uppercase">{targetCard.set}</span>
                    <span>vs</span>
                    <span className="text-emerald-700 dark:text-emerald-300 font-bold uppercase">{inspectCardMatch.card.set}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectCardMatch(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body: 2-Column Side-by-Side Comparison */}
            <div className="p-4 sm:p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-6 items-start divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
              
              {/* Left Column: Reference Target Card */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
                  <span className="px-2.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-cyan-300 text-[11px] font-bold font-mono uppercase tracking-wide border border-violet-200 dark:border-violet-800/60">
                    Reference Card (Target)
                  </span>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                    <SetSymbol setCode={targetCard.set} size="xs" />
                    <span className="font-bold uppercase text-violet-700 dark:text-cyan-300">{targetCard.set}</span>
                    <span>•</span>
                    <span className="capitalize">{targetCard.rarity}</span>
                    <span>•</span>
                    <span>#{targetCard.collector_number}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
                  <div className="shrink-0 flex flex-col items-center">
                    <CardObfuscator
                      card={targetCard}
                      obfuscation={{ target: 'none', style: 'blur', isRevealed: true }}
                      size="lg"
                    />
                  </div>

                  <div className="flex-1 min-w-0 space-y-3.5 text-xs w-full">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{targetCard.name}</span>
                        {targetCard.mana_cost && <ManaCostRenderer manaCost={targetCard.mana_cost} size="sm" />}
                      </div>
                      <p className="font-mono text-violet-700 dark:text-cyan-300">
                        {targetCard.type_line} {targetCard.power && `• ${targetCard.power}/${targetCard.toughness}`}
                      </p>
                    </div>

                    {/* 17Lands Record Box */}
                    <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-2 font-mono">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                          17Lands Premier Draft Record
                        </span>
                        {target17LandsData?.tierGrade ? (
                          <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
                            Tier {target17LandsData.tierGrade}
                          </span>
                        ) : currentGrade ? (
                          <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-lg bg-violet-600 text-white shadow-2xs">
                            Tier {currentGrade}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                            Tier TBD
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Game in Hand Win Rate</span>
                          <span className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                            {target17LandsData?.winRate !== undefined
                              ? `${(target17LandsData.winRate * 100).toFixed(1)}%`
                              : 'TBD (Unreleased)'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Avg Last Seen At (ALSA)</span>
                          <span className="text-slate-700 dark:text-slate-200 font-bold text-sm">
                            {target17LandsData?.alsa !== undefined
                              ? target17LandsData.alsa.toFixed(2)
                              : 'Data Pending'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Oracle Rules Text */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                        Oracle Rules Text
                      </span>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#070b1e] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line text-xs min-h-[60px]">
                        {targetCard.oracle_text || 'No oracle rules text.'}
                      </div>
                    </div>

                    {/* Target Context */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                        Target Evaluation Specs
                      </span>
                      <div className="flex flex-wrap gap-1">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px] border border-slate-200 dark:border-slate-700">
                          Set: {targetCard.set.toUpperCase()}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px] border border-slate-200 dark:border-slate-700">
                          CMC: {targetCard.cmc ?? 0}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px] border border-slate-200 dark:border-slate-700 capitalize">
                          {targetCard.rarity}
                        </span>
                        <div className="flex items-center gap-1.5 ml-auto">
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Rating:</span>
                          <select
                            value={currentGrade || ''}
                            onChange={(e) => {
                              const newGrade = e.target.value as GradeTier;
                              if (newGrade && onAdoptGrade) {
                                onAdoptGrade(targetCard, newGrade);
                              }
                            }}
                            className="px-2 py-0.5 rounded bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border border-violet-300 dark:border-violet-800 font-bold font-mono text-[10px] focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer text-center"
                          >
                            <option value="" disabled>Unrated</option>
                            {GRADE_TIERS.map((tier) => (
                              <option key={tier} value={tier}>
                                {tier}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Links */}
                    <div className="flex items-center gap-3 pt-2">
                      {target17LandsData?.winRate !== undefined && (
                        <a
                          href={get17LandsCardUrl(targetCard.set, targetCard)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:underline font-mono text-xs font-semibold"
                        >
                          <span>View on 17Lands</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <a
                        href={targetCard.scryfall_uri || `https://scryfall.com/search?q=%21%22${encodeURIComponent(targetCard.name)}%22`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-violet-600 dark:text-cyan-400 hover:underline font-mono text-xs font-semibold"
                      >
                        <span>View on Scryfall</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Similar Precedent Card */}
              <div className="space-y-4 pt-6 lg:pt-0 lg:pl-6">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold font-mono uppercase tracking-wide border border-emerald-200 dark:border-emerald-800/60">
                    Similar Precedent ({inspectCardMatch.similarityScore}% Match)
                  </span>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                    <SetSymbol setCode={inspectCardMatch.card.set} size="xs" />
                    <span className="font-bold uppercase text-emerald-700 dark:text-emerald-300">{inspectCardMatch.card.set}</span>
                    <span>•</span>
                    <span className="capitalize">{inspectCardMatch.card.rarity}</span>
                    <span>•</span>
                    <span>#{inspectCardMatch.card.collector_number}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
                  <div className="shrink-0 flex flex-col items-center">
                    <CardObfuscator
                      card={inspectCardMatch.card}
                      obfuscation={{ target: 'none', style: 'blur', isRevealed: true }}
                      size="lg"
                    />
                  </div>

                  <div className="flex-1 min-w-0 space-y-3.5 text-xs w-full">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{inspectCardMatch.card.name}</span>
                        {inspectCardMatch.card.mana_cost && <ManaCostRenderer manaCost={inspectCardMatch.card.mana_cost} size="sm" />}
                      </div>
                      <p className="font-mono text-violet-700 dark:text-cyan-300">
                        {inspectCardMatch.card.type_line} {inspectCardMatch.card.power && `• ${inspectCardMatch.card.power}/${inspectCardMatch.card.toughness}`}
                      </p>
                    </div>

                    {/* 17Lands Metrics Card */}
                    <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-2 font-mono">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                          17Lands Premier Draft Record
                        </span>
                        {inspectCardMatch.tierGrade ? (
                          <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
                            Tier {inspectCardMatch.tierGrade}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                            Tier TBD
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Game in Hand Win Rate</span>
                          <span className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                            {inspectCardMatch.winRate !== undefined ? `${(inspectCardMatch.winRate * 100).toFixed(1)}%` : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Avg Last Seen At (ALSA)</span>
                          <span className="text-slate-700 dark:text-slate-200 font-bold text-sm">
                            {inspectCardMatch.alsa !== undefined ? inspectCardMatch.alsa.toFixed(2) : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Rules Text */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                        Oracle Rules Text
                      </span>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#070b1e] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line text-xs min-h-[60px]">
                        {inspectCardMatch.card.oracle_text || 'No oracle rules text.'}
                      </div>
                    </div>

                    {/* Match rationale */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                        Similarity Rationale ({inspectCardMatch.similarityScore}% match to {targetCard.name})
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {inspectCardMatch.matchReasons.map((r, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px] border border-slate-200 dark:border-slate-700">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Links */}
                    <div className="flex items-center gap-3 pt-2">
                      <a
                        href={get17LandsCardUrl(inspectCardMatch.card.set, inspectCardMatch.card)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:underline font-mono text-xs font-semibold"
                      >
                        <span>View on 17Lands</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <a
                        href={inspectCardMatch.card.scryfall_uri || `https://scryfall.com/search?q=%21%22${encodeURIComponent(inspectCardMatch.card.name)}%22`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-violet-600 dark:text-cyan-400 hover:underline font-mono text-xs font-semibold"
                      >
                        <span>View on Scryfall</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-[#070b1e]">
              <button
                type="button"
                onClick={() => setInspectCardMatch(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Back to Comps List
              </button>

              {onAdoptGrade && inspectCardMatch.tierGrade && (
                <button
                  type="button"
                  onClick={() => {
                    handleAdopt(inspectCardMatch.tierGrade!, inspectCardMatch.card.id);
                    setInspectCardMatch(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Adopt Grade {inspectCardMatch.tierGrade} for {targetCard.name}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
