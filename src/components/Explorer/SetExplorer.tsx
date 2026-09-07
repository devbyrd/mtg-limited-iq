import React, { useState, useMemo, useEffect } from 'react';
import { Card, GradeTier, MTGColor, MTGRarity, SeventeenLandsSetData, UserCardEvaluation } from '../../types/mtg';
import { CardObfuscator } from '../CardObfuscator';
import { Search, Filter, Sparkles, ExternalLink, Zap, Swords, Shield, X, ShieldCheck, ChevronLeft, ChevronRight, CheckCircle2, FileText, Star, BarChart2, Trash2, Eye, EyeOff, BookOpen, Layers } from 'lucide-react';
import { ClearSetRatingsModal } from '../UI/ClearSetRatingsModal';
import { ManaCostRenderer, ManaSymbol } from '../UI/ManaSymbol';
import { parseAppUrlParams, updateAppUrlParams, findCardByUrlIdentifier } from '../../services/urlParams';
import { GRADE_TIERS, GRADE_SCORES, get17LandsSetUrl, get17LandsCardUrl, get17LandsArchetypeUrl, winRateToGradeTier } from '../../services/seventeenLands';
import { GradeComparisonCard } from '../UI/GradeComparisonCard';
import { PlaneswalkerSymbol } from '../UI/PlaneswalkerSymbol';
import { SetBadge, SetSymbol } from '../UI/SetSymbol';
import { ManaColorFilterBar } from '../UI/ManaColorFilterBar';
import { CardSearchBar } from '../Search/CardSearchBar';
import { cardMatchesQuery } from '../../services/cardSearchParser';
import { getWOTCArchetypesForSet, getSignpostsForArchetype, WOTCArchetype } from '../../services/wotcArchetypes';
import { getBlindGradingForSet, setBlindGradingForSet } from '../../services/storage';

interface SetExplorerProps {
  cards: Card[];
  currentSetCode: string;
  currentSetName: string;
  userEvaluations?: Record<string, UserCardEvaluation>;
  seventeenLandsData: SeventeenLandsSetData | null;
  isBlindGrading?: boolean;
  onToggleBlindGrading?: () => void;
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
  isBlindGrading: propIsBlindGrading,
  onToggleBlindGrading: propOnToggleBlindGrading,
  onSaveEvaluation,
  onClearEvaluationsForSet,
  onGradeCard,
  onPracticeCard,
}) => {
  const [activeExplorerTab, setActiveExplorerTab] = useState<'cards' | 'archetypes'>('cards');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('ALL');
  const [selectedRarity, setSelectedRarity] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [filterRatedStatus, setFilterRatedStatus] = useState<'ALL' | 'RATED' | 'UNRATED'>('ALL');
  const [sortBy, setSortBy] = useState<'number' | 'name' | 'cmc' | 'winrate'>('number');
  const [selectedCardForModal, setSelectedCardForModal] = useState<Card | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);

  // Blind grading state persisted per set in local storage (or controlled by parent)
  const [internalBlindGrading, setInternalBlindGrading] = useState<boolean>(() => {
    return getBlindGradingForSet(currentSetCode);
  });

  useEffect(() => {
    setInternalBlindGrading(getBlindGradingForSet(currentSetCode));
  }, [currentSetCode]);

  const effectiveIsBlind = propIsBlindGrading !== undefined ? propIsBlindGrading : internalBlindGrading;

  const handleToggleBlindGrading = () => {
    if (propOnToggleBlindGrading) {
      propOnToggleBlindGrading();
    } else {
      const next = !internalBlindGrading;
      setInternalBlindGrading(next);
      setBlindGradingForSet(currentSetCode, next);
    }
  };

  // Curated WOTC Supported Archetypes for this set
  const wotcArchetypes = useMemo(() => {
    return getWOTCArchetypesForSet(currentSetCode, cards);
  }, [currentSetCode, cards]);

  const ratedCountInSet = useMemo(() => {
    return cards.filter((c) => {
      const key = `${c.set?.toLowerCase() || ''}_${c.name?.toLowerCase() || ''}`;
      return Boolean(userEvaluations[key]);
    }).length;
  }, [cards, userEvaluations]);

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
        if (selectedColor.startsWith('GOLD_')) {
          const pairCode = selectedColor.replace('GOLD_', '');
          const c1 = pairCode[0] as MTGColor;
          const c2 = pairCode[1] as MTGColor;
          const colors = c.colors || [];
          if (colors.length < 2 || !colors.includes(c1) || !colors.includes(c2)) return false;
        } else if (selectedColor.length === 2 && !['ALL', 'GOLD', 'LANDS', 'MULTI', 'COLORLESS'].includes(selectedColor)) {
          const c1 = selectedColor[0] as MTGColor;
          const c2 = selectedColor[1] as MTGColor;
          const cardIdentity = c.color_identity && c.color_identity.length > 0 ? c.color_identity : (c.colors || []);
          const fitsIdentity = cardIdentity.every((col) => col === c1 || col === c2);
          if (!fitsIdentity) return false;
        } else if (selectedColor === 'MULTI' || selectedColor === 'GOLD') {
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
      {/* Header Banner with Sub-Tabs & Set Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 shadow-xs">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <SetBadge setCode={currentSetCode} />
            <span className="text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-violet-950/60 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-violet-500/30 font-mono font-semibold">
              {cards.length} Total Cards
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#050818] px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800 font-mono">
              {ratedCountInSet} Graded
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#050818] px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800 font-mono">
              {wotcArchetypes.length} Supported Archetypes
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-heading truncate">
            {currentSetName} ({currentSetCode.toUpperCase()})
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl">
            Browse the card pool, explore WOTC supported draft archetypes, and assign your personal card grades.
          </p>
        </div>

        {/* Sub-Tabs: Cards vs Supported Archetypes */}
        <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
          <nav className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100/90 dark:bg-[#060a1d] border border-slate-200/90 dark:border-slate-800/80 shadow-xs">
            <button
              onClick={() => setActiveExplorerTab('cards')}
              className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeExplorerTab === 'cards'
                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setActiveExplorerTab('archetypes')}
              className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeExplorerTab === 'archetypes'
                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              Supported Archetypes
            </button>
          </nav>
        </div>
      </div>

      {activeExplorerTab === 'cards' ? (
        <>
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

          {/* Active Archetype Filter Pill */}
          {(selectedColor.length === 2 || selectedColor.startsWith('GOLD_')) &&
            !['ALL', 'GOLD', 'LANDS', 'MULTI', 'COLORLESS'].includes(selectedColor) && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-violet-100 dark:bg-violet-950/70 border border-violet-300 dark:border-violet-700/60 text-violet-800 dark:text-violet-200 shadow-xs">
                <span>Archetype: {selectedColor.startsWith('GOLD_') ? `Gold ${selectedColor.replace('GOLD_', '')}` : selectedColor}</span>
                <button
                  type="button"
                  onClick={() => setSelectedColor('ALL')}
                  className="p-0.5 rounded-md hover:bg-violet-200 dark:hover:bg-violet-800 text-violet-600 dark:text-violet-300 cursor-pointer"
                  title="Clear Archetype Filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

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

          {/* Grading Mode / Compare Mode Toggle (mimics state of Grade tab) */}
          {seventeenLandsData ? (
            <button
              type="button"
              onClick={handleToggleBlindGrading}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center justify-center gap-1.5 cursor-pointer min-w-[112px] shrink-0 whitespace-nowrap ${
                effectiveIsBlind
                  ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60'
              }`}
              title={
                effectiveIsBlind
                  ? 'Grading Mode: Benchmarks hidden. Click to switch to Compare Mode'
                  : 'Compare Mode: 17Lands data visible. Click to switch to Grading Mode'
              }
            >
              {effectiveIsBlind ? (
                <EyeOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              ) : (
                <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
              <span>{effectiveIsBlind ? 'Grading Mode' : 'Compare Mode'}</span>
            </button>
          ) : (
            <div
              className="px-2.5 py-1 rounded-xl text-[11px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800/80 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60 shrink-0 flex items-center gap-1"
              title="17Lands benchmarks are available ~2 weeks after release"
            >
              <EyeOff className="w-3 h-3 text-amber-500 shrink-0" />
              <span>Grading Mode</span>
            </div>
          )}

          {/* Clear Grades Button (if rated cards exist in this set) */}
          {onClearEvaluationsForSet && ratedCountInSet > 0 && (
            <button
              type="button"
              onClick={() => setIsClearModalOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              title={`Clear all your grades for ${currentSetCode.toUpperCase()}`}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>Clear Grades ({ratedCountInSet})</span>
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
                {/* Top Bar above the card: Grade Badge(s) on the left & 17Lands external link icon on the right */}
                <div className="w-[185px] flex items-center justify-between mb-1.5 min-h-[22px]">
                  <div className="flex items-center gap-1 flex-wrap">
                    {(() => {
                      const actualTier: GradeTier | null = (landData && typeof landData.win_rate === 'number' && landData.win_rate > 0)
                        ? ((landData.tier_grade as GradeTier) || winRateToGradeTier(landData.win_rate))
                        : null;
                      const hasUserGrade = Boolean(evalData?.userGrade);

                      return (
                        <div className="flex items-center gap-1">
                          <div
                            className="px-1.5 py-0.5 rounded-md bg-violet-950/95 text-white border border-violet-400 shadow-xs flex items-center gap-1 font-mono"
                            title={hasUserGrade ? `Your assigned grade: ${evalData!.userGrade}` : 'Not graded yet'}
                          >
                            <span className="text-[8px] uppercase tracking-wider font-extrabold text-violet-300">YOU</span>
                            <span className="text-[11px] font-black">{hasUserGrade ? evalData!.userGrade : '—'}</span>
                          </div>
                          <div
                            className={`px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-1 font-mono ${
                              effectiveIsBlind || !hasUserGrade
                                ? 'bg-slate-900/90 text-slate-400 border border-slate-700/80'
                                : actualTier
                                ? 'bg-emerald-950/95 text-white border border-emerald-400'
                                : 'bg-slate-900/90 text-slate-400 border border-slate-700/80'
                            }`}
                            title={
                              effectiveIsBlind
                                ? '17Lands grade hidden in Grading Mode'
                                : !hasUserGrade
                                ? 'Rate the card to see how you compare'
                                : actualTier
                                ? `17Lands Grade: ${actualTier}`
                                : '17Lands data is available approximately 2 weeks after release'
                            }
                          >
                            <span
                              className={`text-[8px] uppercase tracking-wider font-extrabold ${
                                effectiveIsBlind || !hasUserGrade
                                  ? 'text-slate-500'
                                  : actualTier
                                  ? 'text-emerald-300'
                                  : 'text-slate-500'
                              }`}
                            >
                              17L
                            </span>
                            <span
                              className={`text-[11px] font-black ${
                                effectiveIsBlind || !hasUserGrade
                                  ? 'text-slate-400'
                                  : actualTier
                                  ? 'text-emerald-200'
                                  : 'text-amber-500/80'
                              }`}
                            >
                              {effectiveIsBlind || !hasUserGrade ? '—' : actualTier || 'TBD'}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <a
                    href={get17LandsCardUrl(card.set, card.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 -mr-1 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors shrink-0"
                    title="Open on 17Lands.com"
                    aria-label={`Open ${card.name} on 17Lands.com`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
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
                    {!effectiveIsBlind && evalData?.userGrade && landData ? (
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
        </>
      ) : (
        <div className="space-y-6">
          {/* Archetypes Subheader / Quick Metagame Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 shadow-xs">
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 text-violet-600 dark:text-cyan-400 shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  WOTC Supported Archetypes • {currentSetName} ({currentSetCode.toUpperCase()})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Official design themes, mechanics, and anchor signposts designed by Wizards of the Coast. Click any card to inspect.
                </p>
              </div>
            </div>
            <a
              href={get17LandsArchetypeUrl(currentSetCode)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-[#050818] text-slate-700 dark:text-slate-200 hover:text-violet-600 dark:hover:text-cyan-300 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-1.5 shrink-0 self-start sm:self-center transition-colors"
              title="Open 17Lands Deck Color Metagame"
            >
              <BarChart2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>17Lands Metagame</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>

          {/* Archetypes Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
            {wotcArchetypes.map((archetype) => {
              const signposts = getSignpostsForArchetype(archetype.code, cards);
              const [c1, c2] = archetype.colors;

              return (
                <div
                  key={archetype.code}
                  className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#090e24] border border-slate-200 dark:border-slate-800/80 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div className="space-y-4">
                    {/* Archetype Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/70 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shrink-0">
                          <ManaSymbol symbol={c1} size="md" />
                          <ManaSymbol symbol={c2} size="md" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-heading">
                              {archetype.name}
                            </h3>
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-800/50">
                              {archetype.code}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-violet-600 dark:text-cyan-400 mt-0.5">
                            {archetype.headline}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Official WOTC Description */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#060a1d] border border-slate-200/70 dark:border-slate-800/70 space-y-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        <BookOpen className="w-3.5 h-3.5 text-violet-500" />
                        <span>WOTC Design Strategy</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {archetype.description}
                      </p>
                      {archetype.mechanics && archetype.mechanics.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {archetype.mechanics.map((mech) => (
                            <span
                              key={mech}
                              className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs"
                            >
                              #{mech}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Signposts Uncommons / Key Cards */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>Signpost Uncommons & Key Cards ({signposts.length})</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">Click card to inspect</span>
                      </div>

                      {signposts.length === 0 ? (
                        <p className="text-xs text-slate-400 italic p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800">
                          No dedicated two-color signpost cards found in the loaded set pool.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {signposts.map((signpostCard) => {
                            const evalKey = `${signpostCard.set?.toLowerCase() || ''}_${signpostCard.name?.toLowerCase() || ''}`;
                            const signpostEval = userEvaluations[evalKey];
                            const signpostLand = seventeenLandsData?.cards ? seventeenLandsData.cards[signpostCard.name] : null;
                            const signpostActualTier: GradeTier | null =
                              signpostLand && typeof signpostLand.win_rate === 'number' && signpostLand.win_rate > 0
                                ? ((signpostLand.tier_grade as GradeTier) || winRateToGradeTier(signpostLand.win_rate))
                                : null;
                            const hasSignpostGrade = Boolean(signpostEval?.userGrade);

                            return (
                              <div
                                key={signpostCard.id}
                                onClick={() => handleSelectModalCard(signpostCard)}
                                className="group relative flex flex-col items-center p-2 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-[#060a1d] dark:hover:bg-[#0a0f2c] border border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-cyan-400/60 shadow-xs transition-all cursor-pointer text-center"
                                title={`Inspect & Grade ${signpostCard.name}`}
                              >
                                {/* Mini Top Bar: YOU & 17L Badges */}
                                <div className="w-full flex items-center justify-between gap-1 mb-1">
                                  <div className="flex items-center gap-1">
                                    <div
                                      className="px-1 py-0.2 rounded bg-violet-950/95 text-white border border-violet-400 text-[9px] font-mono font-black"
                                      title={hasSignpostGrade ? `Your Grade: ${signpostEval!.userGrade}` : 'Not graded'}
                                    >
                                      {hasSignpostGrade ? signpostEval!.userGrade : '—'}
                                    </div>
                                    <div
                                      className={`px-1 py-0.2 rounded text-[9px] font-mono font-black border ${
                                        effectiveIsBlind || !hasSignpostGrade
                                          ? 'bg-slate-900/90 text-slate-400 border-slate-700/80'
                                          : signpostActualTier
                                          ? 'bg-emerald-950/95 text-emerald-200 border-emerald-400'
                                          : 'bg-slate-900/90 text-slate-400 border-slate-700/80'
                                      }`}
                                      title={
                                        effectiveIsBlind
                                          ? '17Lands hidden in Grading Mode'
                                          : !hasSignpostGrade
                                          ? 'Rate to see how you compare'
                                          : signpostActualTier
                                          ? `17L Grade: ${signpostActualTier}`
                                          : 'TBD'
                                      }
                                    >
                                      {effectiveIsBlind || !hasSignpostGrade ? '—' : signpostActualTier || 'TBD'}
                                    </div>
                                  </div>
                                  {signpostCard.mana_cost && (
                                    <ManaCostRenderer manaCost={signpostCard.mana_cost} size="sm" />
                                  )}
                                </div>

                                {/* Thumbnail Artwork */}
                                <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 relative mb-1.5">
                                  <img
                                    src={
                                      signpostCard.image_uris?.art_crop ||
                                      signpostCard.image_uris?.normal ||
                                      'https://cards.scryfall.io/back.jpg'
                                    }
                                    alt={signpostCard.name}
                                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                  />
                                </div>

                                <div className="w-full text-left">
                                  <div className="text-[11px] font-bold text-slate-900 dark:text-white truncate group-hover:text-violet-600 dark:group-hover:text-cyan-300 transition-colors">
                                    {signpostCard.name}
                                  </div>
                                  <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 mt-0.5">
                                    <span className="capitalize">{signpostCard.rarity}</span>
                                    {!effectiveIsBlind && hasSignpostGrade && signpostLand && (
                                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                        {(signpostLand.win_rate * 100).toFixed(1)}% WR
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Archetype Card Actions */}
                  <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveExplorerTab('cards');
                        setSelectedColor(archetype.code.toUpperCase());
                        setSelectedRarity('ALL');
                        setSelectedRole('ALL');
                        setFilterRatedStatus('ALL');
                        setSearchQuery('');
                      }}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-violet-50 dark:bg-violet-950/50 hover:bg-violet-100 dark:hover:bg-violet-900/60 text-violet-700 dark:text-cyan-300 border border-violet-200 dark:border-violet-800/50 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Explore {archetype.code} Cards</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveExplorerTab('cards');
                        setSelectedColor('GOLD_' + archetype.code.toUpperCase());
                        setSelectedRarity('ALL');
                        setSelectedRole('ALL');
                        setFilterRatedStatus('ALL');
                        setSearchQuery('');
                      }}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                      title={`Filter to multi-color gold ${archetype.code} cards`}
                    >
                      Gold Only
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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
                <a
                  href={get17LandsCardUrl(selectedCardForModal.set, selectedCardForModal.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0"
                  title="Open on 17Lands.com"
                  aria-label="Open on 17Lands.com"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                {currentModalIndex !== -1 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono hidden md:inline shrink-0">
                    ({currentModalIndex + 1} of {filteredAndSortedCards.length})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
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
                <CardObfuscator
                  card={selectedCardForModal}
                  obfuscation={{ target: 'none', style: 'blur', isRevealed: true }}
                  size="lg"
                />

                {/* Under Card Pic: Set abbr / rarity / cost & Tactical Tags */}
                <div className="w-[305px] max-w-full mt-2.5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {selectedCardForModal.set.toUpperCase()} #{selectedCardForModal.collector_number} • <span className="capitalize font-normal text-slate-500 dark:text-slate-400">{selectedCardForModal.rarity}</span>
                    </span>
                    <span>CMC {selectedCardForModal.cmc}</span>
                  </div>

                  {/* Tactical Tags: Removal Spell, Combat Trick, Instant Speed */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {selectedCardForModal.is_combat_trick && (
                      <span className="text-[11px] px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 font-bold flex items-center gap-1">
                        <Swords className="w-3 h-3" />
                        Combat Trick
                      </span>
                    )}
                    {selectedCardForModal.is_removal && (
                      <span className="text-[11px] px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 font-bold flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        Removal Spell
                      </span>
                    )}
                    {selectedCardForModal.is_instant_speed && (
                      <span className="text-[11px] px-2 py-0.5 rounded-lg bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 border border-cyan-300 dark:border-cyan-500/40 font-bold">
                        ⚡ Instant Speed
                      </span>
                    )}
                    {selectedCardForModal.archetype_tag && (
                      <span className="text-[11px] px-2 py-0.5 rounded-lg bg-violet-100 text-violet-800 dark:bg-violet-950/60 border border-violet-300 dark:border-violet-500/40 font-bold">
                        🛡️ {selectedCardForModal.archetype_tag}
                      </span>
                    )}
                  </div>
                </div>
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
                        <span className="font-bold text-slate-700 dark:text-slate-300" title="Assign draft evaluation tier: A+=5.0, A=4.7, A-=4.3, B+=4.0, B=3.7, B-=3.3, C+=3.0, C=2.7, C-=2.3, D=1.5, F=0.5">
                          Grade Card:
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
                    isBlindGrading={effectiveIsBlind}
                  />

                  {/* Oracle Rules Text Box */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200 dark:border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Oracle Rules Text
                      </span>
                      {selectedCardForModal.scryfall_uri && (
                        <a
                          href={selectedCardForModal.scryfall_uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-600 dark:text-cyan-400 hover:underline"
                          title="View official Scryfall & Gatherer rulings"
                        >
                          <span>Rulings</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-sans leading-relaxed whitespace-pre-line">
                      {selectedCardForModal.oracle_text || 'No oracle rules text.'}
                    </p>
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
