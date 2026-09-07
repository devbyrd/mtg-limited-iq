import React, { useState, useMemo, useEffect } from 'react';
import { Card, GradeTier, MTGColor, MTGRarity, SeventeenLandsSetData, UserCardEvaluation } from '../../types/mtg';
import { CardObfuscator } from '../CardObfuscator';
import { Search, Filter, Sparkles, ExternalLink, Zap, Swords, Shield, X, ShieldCheck, ChevronLeft, ChevronRight, Trophy, Award, CheckCircle2, FileText, Star, BarChart2, Trash2 } from 'lucide-react';
import { ClearSetRatingsModal } from '../UI/ClearSetRatingsModal';
import { ManaCostRenderer } from '../UI/ManaSymbol';
import { parseAppUrlParams, updateAppUrlParams, findCardByUrlIdentifier } from '../../services/urlParams';
import { GRADE_TIERS, GRADE_SCORES, get17LandsSetUrl, get17LandsCardUrl, winRateToGradeTier } from '../../services/seventeenLands';
import { GradeComparisonCard } from '../UI/GradeComparisonCard';
import { PlaneswalkerSymbol } from '../UI/PlaneswalkerSymbol';
import { SetBadge, SetSymbol } from '../UI/SetSymbol';
import { ManaColorFilterBar } from '../UI/ManaColorFilterBar';
import { CardSearchBar } from '../Search/CardSearchBar';
import { cardMatchesQuery } from '../../services/cardSearchParser';

interface SetExplorerProps {
  cards: Card[];
  currentSetCode: string;
  currentSetName: string;
  userEvaluations?: Record<string, UserCardEvaluation>;
  seventeenLandsData: SeventeenLandsSetData | null;
  onSaveEvaluation?: (evaluation: UserCardEvaluation) => void;
  onClearEvaluationsForSet?: (setCode: string) => void;
  onGradeCard?: (card: Card) => void;
  onPracticeCard?: (card: Card) => void;
}

export const SetExplorer: React.FC<SetExplorerProps> = ({
  cards,
  currentSetCode,
  currentSetName,
  userEvaluations = {},
  seventeenLandsData,
  onSaveEvaluation,
  onClearEvaluationsForSet,
  onGradeCard,
  onPracticeCard,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('ALL');
  const [selectedRarity, setSelectedRarity] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [filterRatedStatus, setFilterRatedStatus] = useState<'ALL' | 'RATED' | 'UNRATED'>('ALL');
  const [sortBy, setSortBy] = useState<'number' | 'name' | 'cmc' | 'winrate'>('number');
  const [selectedCardForModal, setSelectedCardForModal] = useState<Card | null>(null);
  const [gradeDisplayMode, setGradeDisplayMode] = useState<'my_grade' | '17lands' | 'side_by_side'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mtg_grade_display_mode');
      if (saved === 'my_grade' || saved === '17lands' || saved === 'side_by_side') {
        return saved;
      }
    }
    return 'side_by_side';
  });
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);

  const ratedCountInSet = useMemo(() => {
    return cards.filter((c) => {
      const key = `${c.set?.toLowerCase() || ''}_${c.name?.toLowerCase() || ''}`;
      return Boolean(userEvaluations[key]);
    }).length;
  }, [cards, userEvaluations]);

  const handleSetGradeDisplayMode = (mode: 'my_grade' | '17lands' | 'side_by_side') => {
    setGradeDisplayMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mtg_grade_display_mode', mode);
    }
  };

  // Auto-open card from URL parameter for troubleshooting / deep linking
  useEffect(() => {
    if (cards.length === 0) return;
    const params = parseAppUrlParams();
    if (params.card && !selectedCardForModal) {
      const matched = findCardByUrlIdentifier(cards, params.card);
      if (matched) {
        setSelectedCardForModal(matched);
      }
    }
  }, [cards]);

  const handleSelectModalCard = (card: Card | null) => {
    setSelectedCardForModal(card);
    updateAppUrlParams({
      card: card ? card.collector_number || card.name : undefined,
    });
  };

  const handleQuickGradeInModal = (card: Card, grade: GradeTier) => {
    if (!onSaveEvaluation) return;
    const score = GRADE_SCORES[grade];
    const key = `${card.set.toLowerCase()}_${card.name.toLowerCase()}`;
    const existing = userEvaluations[key];

    const updated: UserCardEvaluation = {
      cardId: card.id,
      cardName: card.name,
      setCode: card.set.toUpperCase(),
      userGrade: grade,
      userScore: score,
      pickPriority: existing?.pickPriority || 'Solid Playable',
      notes: existing?.notes || '',
      updatedAt: new Date().toISOString(),
    };

    onSaveEvaluation(updated);
  };

  const filteredAndSortedCards = useMemo(() => {
    let result = cards.filter((c) => {
      const evalKey = `${c.set?.toLowerCase() || ''}_${c.name?.toLowerCase() || ''}`;
      const hasEval = Boolean(userEvaluations[evalKey]);

      if (filterRatedStatus === 'RATED' && !hasEval) return false;
      if (filterRatedStatus === 'UNRATED' && hasEval) return false;

      if (searchQuery) {
        if (!cardMatchesQuery(c, searchQuery, currentSetCode)) return false;
      }

      if (selectedColor !== 'ALL') {
        if (selectedColor === 'MULTI' || selectedColor === 'GOLD') {
          if (c.colors.length <= 1) return false;
        } else if (selectedColor === 'COLORLESS') {
          if (c.colors.length > 0 || c.type_line?.toLowerCase().includes('land')) return false;
        } else if (selectedColor === 'LANDS') {
          if (!c.type_line?.toLowerCase().includes('land')) return false;
        } else {
          if (c.colors.length !== 1 || !c.colors.includes(selectedColor as MTGColor)) return false;
        }
      }

      if (selectedRarity !== 'ALL' && c.rarity !== selectedRarity) {
        return false;
      }

      if (selectedRole !== 'ALL') {
        const typeLine = (c.type_line || '').toLowerCase();
        const oracleText = (c.oracle_text || '').toLowerCase();
        if (selectedRole === 'CREATURE' && !typeLine.includes('creature') && !c.is_creature) return false;
        if (selectedRole === 'INSTANT' && !typeLine.includes('instant') && !oracleText.includes('flash') && !c.is_instant_speed) return false;
        if (selectedRole === 'TRICK' && !typeLine.includes('instant') && !oracleText.includes('flash') && !c.is_combat_trick) return false;
        if (selectedRole === 'REMOVAL' && !c.is_removal && !oracleText.includes('destroy') && !oracleText.includes('exile') && !oracleText.includes('deal') && !oracleText.includes('damage') && !oracleText.includes('-x/-x') && !oracleText.includes('counter target')) return false;
        if (selectedRole === 'ENCHANTMENT' && !typeLine.includes('enchantment')) return false;
        if (selectedRole === 'ARTIFACT' && !typeLine.includes('artifact')) return false;
        if (selectedRole === 'LAND' && !typeLine.includes('land')) return false;
      }

      return true;
    });

    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'cmc') return a.cmc - b.cmc;
      if (sortBy === 'winrate') {
        const wrA = seventeenLandsData?.cards[a.name]?.win_rate || 0.5;
        const wrB = seventeenLandsData?.cards[b.name]?.win_rate || 0.5;
        return wrB - wrA;
      }
      return parseInt(a.collector_number || '0') - parseInt(b.collector_number || '0');
    });

    return result;
  }, [cards, searchQuery, selectedColor, selectedRarity, selectedRole, filterRatedStatus, sortBy, seventeenLandsData, userEvaluations]);

  const currentModalIndex = useMemo(() => {
    if (!selectedCardForModal) return -1;
    return filteredAndSortedCards.findIndex((c) => c.id === selectedCardForModal.id);
  }, [selectedCardForModal, filteredAndSortedCards]);

  const handlePrevCard = () => {
    if (currentModalIndex > 0) {
      handleSelectModalCard(filteredAndSortedCards[currentModalIndex - 1]);
    }
  };

  const handleNextCard = () => {
    if (currentModalIndex < filteredAndSortedCards.length - 1) {
      handleSelectModalCard(filteredAndSortedCards[currentModalIndex + 1]);
    }
  };

  useEffect(() => {
    if (!selectedCardForModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevCard();
      } else if (e.key === 'ArrowRight') {
        handleNextCard();
      } else if (e.key === 'Escape') {
        handleSelectModalCard(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCardForModal, currentModalIndex, filteredAndSortedCards]);

  const activeCardEval = selectedCardForModal
    ? userEvaluations[`${selectedCardForModal.set.toLowerCase()}_${selectedCardForModal.name.toLowerCase()}`]
    : undefined;

  const getTierBadgeStyle = (tier: GradeTier) => {
    if (tier.startsWith('A')) return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40 hover:bg-amber-200 dark:hover:bg-amber-500/30 font-bold';
    if (tier.startsWith('B')) return 'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40 hover:bg-cyan-200 dark:hover:bg-cyan-500/30 font-bold';
    if (tier.startsWith('C')) return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold';
    if (tier === 'D') return 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/40 hover:bg-orange-200 dark:hover:bg-orange-500/30 font-bold';
    return 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40 hover:bg-rose-200 dark:hover:bg-rose-500/30 font-bold';
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 space-y-6 animate-in fade-in duration-200">
      {/* Header Banner with Direct 17Lands Set Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 shadow-xs">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <SetBadge setCode={currentSetCode} suffix="Card List" />
            <span className="text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-violet-950/60 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-violet-500/30 font-mono">
              Showing {filteredAndSortedCards.length} of {cards.length} cards
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white font-heading">
            {currentSetName} Card List
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl">
            Inspect card artwork, check oracle rulings, filter combat tricks and removal, and assign your draft evaluations directly.
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3 sm:p-3.5 bg-white dark:bg-[#090e24] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-2.5">
        <div className="flex flex-col md:flex-row md:items-center gap-2.5">
          {/* Card Search Bar (Scryfall & Arena-style) */}
          <div className="flex-1">
            <CardSearchBar
              query={searchQuery}
              onChangeQuery={setSearchQuery}
              currentSetCode={currentSetCode}
              currentSetName={currentSetName}
              matchCount={filteredAndSortedCards.length}
              totalCount={cards.length}
            />
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              Sort:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-violet-500 dark:focus:border-cyan-400 font-mono cursor-pointer"
            >
              <option value="number">Collector # (001 → 300)</option>
              <option value="name">Card Name (A → Z)</option>
              <option value="cmc">Mana Value (0 → 10+)</option>
              {seventeenLandsData && <option value="winrate">17Lands Win Rate (High → Low)</option>}
            </select>
          </div>
        </div>

        {/* Filters: Colors, Rarities, Status & Roles */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Mana Color Filter Bar with Official Arena Glow */}
          <ManaColorFilterBar selectedColor={selectedColor} onSelectColor={setSelectedColor} />

          {/* Rarity Pills */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#050818] p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
            {['ALL', 'common', 'uncommon', 'rare', 'mythic'].map((rarity) => (
              <button
                key={rarity}
                onClick={() => setSelectedRarity(rarity)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                  selectedRarity === rarity
                    ? 'bg-violet-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                {rarity === 'ALL' ? 'All' : rarity}
              </button>
            ))}
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#050818] p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'UNRATED', label: 'Ungraded' },
              { id: 'RATED', label: 'Graded' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setFilterRatedStatus(st.id as any)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  filterRatedStatus === st.id
                    ? 'bg-violet-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Card Grade Display Mode: My Grade / 17Lands / Side-by-Side */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#050818] p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 px-1 hidden xl:inline">
              Card Grade:
            </span>
            <button
              type="button"
              onClick={() => handleSetGradeDisplayMode('my_grade')}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                gradeDisplayMode === 'my_grade'
                  ? 'bg-violet-600 text-white shadow-xs font-bold border border-violet-400/40'
                  : 'text-slate-600 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
              title="Show only your personal evaluation grade on each card"
            >
              My Grade
            </button>

            <button
              type="button"
              onClick={() => handleSetGradeDisplayMode('17lands')}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                gradeDisplayMode === '17lands'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold border border-emerald-400/40'
                  : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
              title="Show only 17Lands empirical win rate grade on each card"
            >
              17Lands
            </button>

            <button
              type="button"
              onClick={() => handleSetGradeDisplayMode('side_by_side')}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                gradeDisplayMode === 'side_by_side'
                  ? 'bg-gradient-to-r from-violet-600 to-emerald-600 text-white shadow-xs font-bold border border-slate-400/40'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
              title="Show both your personal grade and 17Lands grade stacked one on top of the other"
            >
              Side-by-Side
            </button>
          </div>

          {/* Clear Ratings Button (if rated cards exist in this set) */}
          {onClearEvaluationsForSet && ratedCountInSet > 0 && (
            <button
              type="button"
              onClick={() => setIsClearModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              title={`Clear all your ratings for ${currentSetCode.toUpperCase()}`}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>Clear Ratings ({ratedCountInSet})</span>
            </button>
          )}

          {/* Tactical Role Filters */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#050818] p-1 rounded-2xl border border-slate-200 dark:border-slate-800 flex-wrap">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'CREATURE', label: 'Creatures' },
              { id: 'INSTANT', label: 'Instants' },
              { id: 'TRICK', label: 'Tricks' },
              { id: 'REMOVAL', label: 'Removal' },
            ].map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  selectedRole === role.id
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
        </div>

        {/* Persistent Filter Display Counter */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-xs font-mono">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-slate-800 dark:text-slate-200">
              Displaying <strong className="text-violet-700 dark:text-cyan-300 font-black">{filteredAndSortedCards.length}</strong> of <strong>{cards.length}</strong> cards
            </span>
            {(selectedColor !== 'ALL' || selectedRarity !== 'ALL' || selectedRole !== 'ALL' || filterRatedStatus !== 'ALL' || searchQuery.trim() !== '') && (
              <span className="text-violet-600 dark:text-cyan-400 font-semibold">
                (filtered)
              </span>
            )}
          </div>

          {(selectedColor !== 'ALL' || selectedRarity !== 'ALL' || selectedRole !== 'ALL' || filterRatedStatus !== 'ALL' || searchQuery.trim() !== '') && (
            <button
              type="button"
              onClick={() => {
                setSelectedColor('ALL');
                setSelectedRarity('ALL');
                setSelectedRole('ALL');
                setFilterRatedStatus('ALL');
                setSearchQuery('');
              }}
              className="text-[11px] font-mono text-violet-700 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer font-bold"
            >
              <X className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Cards Visual Grid */}
      {filteredAndSortedCards.length === 0 ? (
        <div className="py-16 text-center text-slate-500 bg-slate-50 dark:bg-[#090e28]/50 rounded-3xl border border-slate-200 dark:border-violet-900/30">
          <p className="text-sm">No cards match the active filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredAndSortedCards.map((card) => {
            const landData = seventeenLandsData?.cards[card.name];
            const evalData = userEvaluations[`${card.set.toLowerCase()}_${card.name.toLowerCase()}`];

            return (
              <div
                key={card.id}
                onClick={() => handleSelectModalCard(card)}
                className="group p-2.5 rounded-3xl bg-white dark:bg-[#090e28] border border-slate-200 dark:border-slate-800/80 hover:border-violet-500/80 dark:hover:border-cyan-400/80 hover:shadow-md transition-all cursor-pointer flex flex-col items-center select-none relative"
              >
                {/* Top-left Grade Badge(s) ABOVE the card (stacked left/right) */}
                <div className="w-[185px] flex items-center justify-start mb-1.5 min-h-[22px]">
                  <div className="flex items-center gap-1 flex-wrap">
                    {(() => {
                      const actualTier: GradeTier | null = (landData && typeof landData.win_rate === 'number' && landData.win_rate > 0)
                        ? ((landData.tier_grade as GradeTier) || winRateToGradeTier(landData.win_rate))
                        : null;
                      const hasUserGrade = Boolean(evalData?.userGrade);

                      if (gradeDisplayMode === 'my_grade') {
                        return (
                          <div className="px-1.5 py-0.5 rounded-md bg-violet-950/95 text-white border border-violet-400 shadow-xs flex items-center gap-1 font-mono" title="Your assigned grade">
                            <span className="text-[8px] uppercase tracking-wider font-extrabold text-violet-300">YOU</span>
                            <span className="text-[11px] font-black">{hasUserGrade ? evalData!.userGrade : '—'}</span>
                          </div>
                        );
                      }

                      if (gradeDisplayMode === '17lands') {
                        return (
                          <div
                            className={`px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-1 font-mono ${
                              actualTier
                                ? 'bg-emerald-950/95 text-white border border-emerald-400'
                                : 'bg-slate-900/90 text-slate-400 border border-slate-700/80'
                            }`}
                            title={actualTier ? `17Lands Grade: ${actualTier}` : '17Lands data is available approximately 2 weeks after release'}
                          >
                            <span className={`text-[8px] uppercase tracking-wider font-extrabold ${actualTier ? 'text-emerald-300' : 'text-slate-500'}`}>17L</span>
                            <span className={`text-[11px] font-black ${actualTier ? 'text-emerald-200' : 'text-amber-500/80'}`}>
                              {actualTier || 'TBD'}
                            </span>
                          </div>
                        );
                      }

                      // Side-by-Side: stacked left/right (horizontal) and smaller!
                      return (
                        <div className="flex items-center gap-1">
                          <div className="px-1.5 py-0.5 rounded-md bg-violet-950/95 text-white border border-violet-400 shadow-xs flex items-center gap-1 font-mono" title="Your assigned grade">
                            <span className="text-[8px] uppercase tracking-wider font-extrabold text-violet-300">YOU</span>
                            <span className="text-[11px] font-black">{hasUserGrade ? evalData!.userGrade : '—'}</span>
                          </div>
                          <div
                            className={`px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-1 font-mono ${
                              actualTier
                                ? 'bg-emerald-950/95 text-white border border-emerald-400'
                                : 'bg-slate-900/90 text-slate-400 border border-slate-700/80'
                            }`}
                            title={actualTier ? `17Lands Grade: ${actualTier}` : '17Lands data is available approximately 2 weeks after release'}
                          >
                            <span className={`text-[8px] uppercase tracking-wider font-extrabold ${actualTier ? 'text-emerald-300' : 'text-slate-500'}`}>17L</span>
                            <span className={`text-[11px] font-black ${actualTier ? 'text-emerald-200' : 'text-amber-500/80'}`}>
                              {actualTier || 'TBD'}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="w-full flex justify-center transform group-hover:scale-[1.02] transition-transform duration-300">
                  <CardObfuscator
                    card={card}
                    obfuscation={{ target: 'none', style: 'blur', isRevealed: true }}
                    size="sm"
                  />
                </div>

                <div className="w-full mt-2.5 px-1 text-left">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-violet-600 dark:group-hover:text-cyan-300 transition-colors">
                      {card.name}
                    </h3>
                  </div>

                  {/* Badges / Metrics */}
                  <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    <span>#{card.collector_number}</span>
                    {landData ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold" title="17Lands Premier Draft GIH Win Rate">
                        {(landData.win_rate * 100).toFixed(1)}% WR
                      </span>
                    ) : (
                      <span className="capitalize text-slate-500 dark:text-slate-400">{card.rarity}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Card Detail Modal (Large, Immersive Card Inspection with Direct Top Grade Action & 17Lands Comparison) */}
      {selectedCardForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 dark:bg-[#040711]/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-[96vw] max-w-5xl h-[88vh] min-h-[580px] max-h-[860px] bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header (With Option to Grade Card Up Top) */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060a1d] shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <span className="font-mono text-xs font-bold text-violet-700 dark:text-cyan-300 bg-slate-100 dark:bg-[#050818] px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800 shrink-0">
                  {selectedCardForModal.set} #{selectedCardForModal.collector_number}
                </span>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-heading truncate">
                  {selectedCardForModal.name}
                </h2>
                {currentModalIndex !== -1 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono hidden md:inline shrink-0">
                    ({currentModalIndex + 1} of {filteredAndSortedCards.length})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* 🌟 TOP GRADE BUTTON: Grade Card in Hub */}
                {onGradeCard && (
                  <button
                    type="button"
                    onClick={() => {
                      onGradeCard(selectedCardForModal);
                      handleSelectModalCard(null);
                    }}
                    className="px-3 sm:px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer border border-violet-400/50 shrink-0 whitespace-nowrap"
                    title="Open this card in the Card Grading Hub"
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-300" />
                    <span>
                      {activeCardEval ? `Grade: ${activeCardEval.userGrade}` : '⭐ Grade in Hub'}
                    </span>
                  </button>
                )}

                <button
                  onClick={handlePrevCard}
                  disabled={currentModalIndex <= 0}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-all"
                  title="Previous Card (← Arrow)"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Prev</span>
                </button>

                <button
                  onClick={handleNextCard}
                  disabled={currentModalIndex >= filteredAndSortedCards.length - 1}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-all"
                  title="Next Card (→ Arrow)"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

                <button
                  onClick={() => handleSelectModalCard(null)}
                  className="p-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filtered Subset Notice Banner */}
            {filteredAndSortedCards.length < cards.length && (
              <div className="px-5 sm:px-6 py-2 bg-amber-500/10 dark:bg-amber-500/15 border-b border-amber-500/25 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 shrink-0 flex-wrap">
                <div className="flex items-center gap-2 font-medium">
                  <Filter className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    Browsing filtered subset: <strong>Card {currentModalIndex + 1} of {filteredAndSortedCards.length}</strong>{' '}
                    <span className="text-amber-700/80 dark:text-amber-300/80">
                      ({searchQuery ? `Search: "${searchQuery}"` : 'Filters active'} • {cards.length} total in set)
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedColor('ALL');
                    setSelectedRarity('ALL');
                    setSelectedRole('ALL');
                    setFilterRatedStatus('ALL');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-950 dark:text-amber-100 font-bold text-[11px] transition-colors cursor-pointer border border-amber-500/30 shrink-0"
                >
                  Clear Filter to Browse Entire Set
                </button>
              </div>
            )}

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Left Column: Large Visual Card Artwork */}
              <div className="md:col-span-5 flex flex-col items-center justify-center shrink-0">
                {/* Top Bar above card: Grade badge(s) on the top left (stacked left/right), rarity and CMC on the right */}
                <div className="w-[305px] max-w-full flex items-center justify-between gap-2 mb-1.5 min-h-[22px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(() => {
                      const modalLand = seventeenLandsData?.cards ? seventeenLandsData.cards[selectedCardForModal.name] : null;
                      const actualTier: GradeTier | null = (modalLand && typeof modalLand.win_rate === 'number' && modalLand.win_rate > 0)
                        ? ((modalLand.tier_grade as GradeTier) || winRateToGradeTier(modalLand.win_rate))
                        : null;
                      const hasUserGrade = Boolean(activeCardEval?.userGrade);

                      if (gradeDisplayMode === 'my_grade') {
                        return (
                          <div className="px-1.5 py-0.5 rounded-md bg-violet-950/95 text-white border border-violet-400 shadow-xs flex items-center gap-1 font-mono" title="Your assigned grade">
                            <span className="text-[8px] uppercase tracking-wider font-extrabold text-violet-300">YOU</span>
                            <span className="text-[11px] font-black">{hasUserGrade ? activeCardEval!.userGrade : '—'}</span>
                          </div>
                        );
                      }

                      if (gradeDisplayMode === '17lands') {
                        return (
                          <div
                            className={`px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-1 font-mono ${
                              actualTier
                                ? 'bg-emerald-950/95 text-white border border-emerald-400'
                                : 'bg-slate-900/90 text-slate-400 border border-slate-700/80'
                            }`}
                            title={actualTier ? `17Lands Grade: ${actualTier}` : '17Lands data is available approximately 2 weeks after release'}
                          >
                            <span className={`text-[8px] uppercase tracking-wider font-extrabold ${actualTier ? 'text-emerald-300' : 'text-slate-500'}`}>17L</span>
                            <span className={`text-[11px] font-black ${actualTier ? 'text-emerald-200' : 'text-amber-500/80'}`}>
                              {actualTier || 'TBD'}
                            </span>
                          </div>
                        );
                      }

                      // Side-by-Side: stacked left/right (horizontal) and smaller!
                      return (
                        <div className="flex items-center gap-1.5">
                          <div className="px-1.5 py-0.5 rounded-md bg-violet-950/95 text-white border border-violet-400 shadow-xs flex items-center gap-1 font-mono" title="Your assigned grade">
                            <span className="text-[8px] uppercase tracking-wider font-extrabold text-violet-300">YOU</span>
                            <span className="text-[11px] font-black">{hasUserGrade ? activeCardEval!.userGrade : '—'}</span>
                          </div>
                          <div
                            className={`px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-1 font-mono ${
                              actualTier
                                ? 'bg-emerald-950/95 text-white border border-emerald-400'
                                : 'bg-slate-900/90 text-slate-400 border border-slate-700/80'
                            }`}
                            title={actualTier ? `17Lands Grade: ${actualTier}` : '17Lands data is available approximately 2 weeks after release'}
                          >
                            <span className={`text-[8px] uppercase tracking-wider font-extrabold ${actualTier ? 'text-emerald-300' : 'text-slate-500'}`}>17L</span>
                            <span className={`text-[11px] font-black ${actualTier ? 'text-emerald-200' : 'text-amber-500/80'}`}>
                              {actualTier || 'TBD'}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 shrink-0">
                    <span className="capitalize">{selectedCardForModal.rarity}</span>
                    <span>•</span>
                    <span>CMC {selectedCardForModal.cmc}</span>
                  </div>
                </div>

                <CardObfuscator
                  card={selectedCardForModal}
                  obfuscation={{ target: 'none', style: 'blur', isRevealed: true }}
                  size="lg"
                />
              </div>

              {/* Right Column: Full Details, Interactive Grading, 17Lands Comparison & Rules */}
              <div className="md:col-span-7 flex flex-col justify-between h-full space-y-3.5 overflow-y-auto pr-1">
                <div className="space-y-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-heading">
                        {selectedCardForModal.name}
                      </h3>
                      {selectedCardForModal.mana_cost && (
                        <ManaCostRenderer manaCost={selectedCardForModal.mana_cost} size="md" />
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-violet-700 dark:text-cyan-300 font-mono mt-0.5">
                      {selectedCardForModal.type_line} {selectedCardForModal.power && `• ${selectedCardForModal.power}/${selectedCardForModal.toughness}`}
                    </p>
                  </div>

                  {/* 🌟 DIRECT INLINE GRADING BAR (Click to rate immediately!) */}
                  {onSaveEvaluation && (
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5" title="Assign draft evaluation tier: A+=5.0, A=4.7, A-=4.3, B+=4.0, B=3.7, B-=3.3, C+=3.0, C=2.7, C-=2.3, D=1.5, F=0.5">
                          <Award className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                          <span>Assign Card Grade:</span>
                        </span>
                        {activeCardEval ? (
                          <span className="font-mono text-xs font-bold text-violet-700 dark:text-cyan-300">
                            Current Rating: <strong className="text-white px-1.5 py-0.5 bg-violet-600 rounded border border-violet-400">{activeCardEval.userGrade}</strong>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Not graded yet</span>
                        )}
                      </div>

                      <div
                        className="grid grid-cols-11 gap-1"
                        title="Assign draft evaluation tier: A+=5.0, A=4.7, A-=4.3, B+=4.0, B=3.7, B-=3.3, C+=3.0, C=2.7, C-=2.3, D=1.5, F=0.5"
                      >
                        {GRADE_TIERS.map((tier) => {
                          const isSelected = activeCardEval?.userGrade === tier;
                          const color = getTierBadgeStyle(tier);
                          return (
                            <button
                              key={tier}
                              type="button"
                              onClick={() => handleQuickGradeInModal(selectedCardForModal, tier)}
                              className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all border cursor-pointer ${
                                isSelected
                                  ? 'bg-violet-600 text-white border-violet-300 font-black shadow-md ring-2 ring-violet-400/60'
                                  : color
                              }`}
                            >
                              {tier}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 🌟 DEDICATED GRADE VS 17LANDS COMPARISON & DELTA CARD */}
                  <GradeComparisonCard
                    card={selectedCardForModal}
                    userEval={activeCardEval}
                    landData={seventeenLandsData?.cards?.[selectedCardForModal.name]}
                  />

                  {/* Oracle Rules Text Box */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800/80 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Oracle Rules Text
                    </span>
                    <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-sans leading-relaxed whitespace-pre-line">
                      {selectedCardForModal.oracle_text || 'No oracle rules text.'}
                    </p>
                  </div>

                  {/* Tactical Tags */}
                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                    {selectedCardForModal.is_combat_trick && (
                      <span className="text-xs px-2.5 py-0.5 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 font-bold flex items-center gap-1">
                        <Swords className="w-3.5 h-3.5" />
                        Combat Trick
                      </span>
                    )}
                    {selectedCardForModal.is_removal && (
                      <span className="text-xs px-2.5 py-0.5 rounded-xl bg-rose-100 text-rose-800 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 font-bold flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5" />
                        Removal Spell
                      </span>
                    )}
                    {selectedCardForModal.is_instant_speed && (
                      <span className="text-xs px-2.5 py-0.5 rounded-xl bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 border border-cyan-300 dark:border-cyan-500/40 font-bold">
                        ⚡ Instant Speed
                      </span>
                    )}
                    {selectedCardForModal.archetype_tag && (
                      <span className="text-xs px-2.5 py-0.5 rounded-xl bg-violet-100 text-violet-800 dark:bg-violet-950/60 border border-violet-300 dark:border-violet-500/40 font-bold">
                        🛡️ {selectedCardForModal.archetype_tag}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Bar: Scryfall, 17Lands & Practice Action */}
                <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <a
                      href={selectedCardForModal.scryfall_uri || `https://scryfall.com/search?q=!%22${encodeURIComponent(selectedCardForModal.name)}%22`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-violet-600 dark:text-cyan-400 hover:text-violet-800 dark:hover:text-cyan-300 flex items-center gap-1 underline transition-colors"
                    >
                      <span>View on Scryfall</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <span className="text-slate-400 dark:text-slate-600">•</span>

                    <a
                      href={get17LandsCardUrl(selectedCardForModal.set, selectedCardForModal.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-violet-600 dark:text-cyan-400 hover:text-violet-800 dark:hover:text-cyan-300 flex items-center gap-1 underline transition-colors"
                    >
                      <span>View on 17lands.com</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {onPracticeCard && (
                    <button
                      onClick={() => {
                        onPracticeCard(selectedCardForModal);
                        handleSelectModalCard(null);
                      }}
                      className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                      <span>Practice Card</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear Set Ratings Modal with Multi-Step Confirmation */}
      {isClearModalOpen && onClearEvaluationsForSet && (
        <ClearSetRatingsModal
          isOpen={isClearModalOpen}
          onClose={() => setIsClearModalOpen(false)}
          setCode={currentSetCode}
          setName={currentSetName}
          ratedCount={ratedCountInSet}
          onConfirmClear={(code) => {
            onClearEvaluationsForSet(code);
          }}
        />
      )}
    </div>
  );
};

export default SetExplorer;
