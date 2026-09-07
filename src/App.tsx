import React, { useState, useEffect, useCallback } from 'react';
import { Card, QuestionCategory, QuizOption, QuizQuestion, QuizResult, QuizSettings, SetInfo, SeventeenLandsSetData, UserCardEvaluation, UserProfileStats, UserAccount } from './types/mtg';
import { fetchCardsForSet, fetchAllSets, POPULAR_LIMITED_SETS } from './services/scryfall';
import { fetch17LandsSetData } from './services/seventeenLands';
import { loadUserStats, loadUserEvaluations, saveUserEvaluation, clearUserEvaluationsForSet, recordQuizCompletion, defaultStats, getLastSelectedSetCode, saveLastSelectedSetCode, getActiveUser } from './services/storage';
import { generateQuiz } from './services/quizGenerator';
import { supabase, isSupabaseConfigured } from './services/supabase';
import { supabaseUserToUserAccount } from './services/auth';
import { pullRemoteUserData } from './services/cloudSync';

// Components
import { Navbar, ActiveTab } from './components/Navbar';
import { SetSelectorModal } from './components/SetSelectorModal';
import { AuthModal } from './components/Auth/AuthModal';
import { QuizSetup } from './components/Quiz/QuizSetup';
import { QuizActive } from './components/Quiz/QuizActive';
import { QuizSummary } from './components/Quiz/QuizSummary';
import { EvaluationHub } from './components/Evaluation/EvaluationHub';
import { StatsDashboard } from './components/Stats/StatsDashboard';
import { SetExplorer } from './components/Explorer/SetExplorer';
import { parseAppUrlParams, updateAppUrlParams } from './services/urlParams';
import { Brain, Zap, BarChart3 } from 'lucide-react';
import { PlaneswalkerSymbol } from './components/UI/PlaneswalkerSymbol';
import { SetBadge, SetSymbol } from './components/UI/SetSymbol';

export const App: React.FC = () => {
  // Navigation & Modal State (Parsed from URL query parameters)
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const params = parseAppUrlParams();
    return params.tab || 'quiz';
  });
  const [quizSubTab, setQuizSubTab] = useState<'take' | 'stats'>(() => {
    const params = parseAppUrlParams();
    return params.quiz_subtab || 'take';
  });
  const [isSetSelectorOpen, setIsSetSelectorOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // User Accounts State
  const [currentUser, setCurrentUser] = useState<UserAccount>(() => getActiveUser());

  // Set & Cards State: Default to URL set param, last selected set, or latest set (POPULAR_LIMITED_SETS[0])
  const [allSets, setAllSets] = useState<SetInfo[]>(POPULAR_LIMITED_SETS);
  const [currentSet, setCurrentSet] = useState<SetInfo>(() => {
    const params = parseAppUrlParams();
    if (params.set) {
      const match = POPULAR_LIMITED_SETS.find((p) => p.code.toUpperCase() === params.set?.toUpperCase());
      if (match) return match;
      return {
        code: params.set.toUpperCase(),
        name: `Set (${params.set.toUpperCase()})`,
        card_count: 270,
        set_type: 'expansion',
      };
    }
    const savedCode = getLastSelectedSetCode();
    if (savedCode) {
      const match = POPULAR_LIMITED_SETS.find((p) => p.code.toUpperCase() === savedCode.toUpperCase());
      if (match) return match;
      return {
        code: savedCode.toUpperCase(),
        name: `Set (${savedCode.toUpperCase()})`,
        card_count: 270,
        set_type: 'expansion',
      };
    }
    return POPULAR_LIMITED_SETS[0];
  });

  const [cards, setCards] = useState<Card[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState<boolean>(true);
  const [downloadProgress, setDownloadProgress] = useState<{ loaded: number; total: number } | null>(null);

  // 17Lands Data State
  const [seventeenLandsData, setSeventeenLandsData] = useState<SeventeenLandsSetData | null>(null);

  // User Stats & Evaluations State (Scoped to currentUser)
  const [userStats, setUserStats] = useState<UserProfileStats>(() => loadUserStats(currentUser.id));
  const [userEvaluations, setUserEvaluations] = useState<Record<string, UserCardEvaluation>>(() => loadUserEvaluations(currentUser.id));

  // Quiz Workflow State
  const [quizState, setQuizState] = useState<'setup' | 'active' | 'summary'>('setup');
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>([]);
  const [activeSettings, setActiveSettings] = useState<QuizSettings | null>(null);
  const [lastResult, setLastResult] = useState<QuizResult | null>(null);

  // Supabase Auth Listener on Startup
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const cloudUser = supabaseUserToUserAccount(session.user);
        setCurrentUser(cloudUser);
        pullRemoteUserData(cloudUser.id).then(({ stats, evaluations }) => {
          if (stats) setUserStats(stats);
          if (evaluations && Object.keys(evaluations).length > 0) setUserEvaluations(evaluations);
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const cloudUser = supabaseUserToUserAccount(session.user);
        setCurrentUser(cloudUser);
        const { stats, evaluations } = await pullRemoteUserData(cloudUser.id);
        if (stats) setUserStats(stats);
        if (evaluations && Object.keys(evaluations).length > 0) setUserEvaluations(evaluations);
      } else if (event === 'SIGNED_OUT') {
        const guestUser = getActiveUser();
        setCurrentUser(guestUser);
        setUserStats(loadUserStats(guestUser.id));
        setUserEvaluations(loadUserEvaluations(guestUser.id));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Initial Data Load (Stats, Evaluations, Sets)
  useEffect(() => {
    const loadedStats = loadUserStats(currentUser.id);
    setUserStats(loadedStats);

    const loadedEvals = loadUserEvaluations(currentUser.id);
    setUserEvaluations(loadedEvals);

    fetchAllSets()
      .then((sets) => {
        if (sets && sets.length > 0) {
          const sorted = [...sets].sort((a, b) => (b.released_at || '').localeCompare(a.released_at || ''));
          setAllSets(sorted);

          const savedCode = getLastSelectedSetCode(currentUser.id);
          if (savedCode) {
            const match = sorted.find(s => s.code.toUpperCase() === savedCode.toUpperCase());
            if (match) {
              setCurrentSet(match);
            }
          }
        }
      })
      .catch((err) => console.warn('Could not load all sets list:', err));
  }, [currentUser.id]);

  // Handle User Switch
  const handleUserChanged = (newUser: UserAccount) => {
    setCurrentUser(newUser);
    setUserStats(loadUserStats(newUser.id));
    setUserEvaluations(loadUserEvaluations(newUser.id));
  };

  // Fetch cards and 17lands data whenever currentSet changes
  const loadSetData = useCallback(async (set: SetInfo) => {
    setIsLoadingCards(true);
    setDownloadProgress(null);
    setSeventeenLandsData(null); // Reset immediately so previous set's data never leaks

    try {
      // 1. Fetch Cards strictly for set
      const fetchedCards = await fetchCardsForSet(set.code, (loaded, total) => {
        setDownloadProgress({ loaded, total });
      });
      setCards(fetchedCards);

      // 2. Fetch 17Lands Data (Only use real empirical data; do not fabricate fake ratings)
      const landsData = await fetch17LandsSetData(set.code);
      if (
        landsData &&
        landsData.setCode?.toUpperCase() === set.code.toUpperCase() &&
        landsData.sampleSize > 500 &&
        Object.keys(landsData.cards || {}).length >= 5
      ) {
        setSeventeenLandsData(landsData);
      } else {
        setSeventeenLandsData(null);
      }
    } catch (err) {
      console.error(`Error loading data for set ${set.code}:`, err);
      setSeventeenLandsData(null);
    } finally {
      setIsLoadingCards(false);
    }
  }, []);

  useEffect(() => {
    loadSetData(currentSet);
  }, [currentSet, loadSetData]);

  // Sync URL query params whenever activeTab or currentSet changes
  useEffect(() => {
    updateAppUrlParams({
      tab: activeTab,
      set: currentSet.code,
    });
  }, [activeTab, currentSet.code]);

  // Handle browser back/forward history navigation
  useEffect(() => {
    const handlePopState = () => {
      const params = parseAppUrlParams();
      if (params.tab && params.tab !== activeTab) {
        setActiveTab(params.tab);
      }
      if (params.set && params.set.toUpperCase() !== currentSet.code.toUpperCase()) {
        const found = allSets.find(s => s.code.toUpperCase() === params.set?.toUpperCase());
        if (found) setCurrentSet(found);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, currentSet.code, allSets]);

  // Handle Set Change
  const handleSelectSet = (set: SetInfo) => {
    saveLastSelectedSetCode(set.code, currentUser.id);
    setCurrentSet(set);
    setIsSetSelectorOpen(false);
    setQuizState('setup');
  };

  // Quiz Handlers
  const handleStartQuiz = (settings: QuizSettings) => {
    if (cards.length === 0) return;

    const missedKeys = new Set(Object.keys(userStats.missedCards || {}));
    const generatedQuestions = generateQuiz(cards, settings, seventeenLandsData, missedKeys);

    if (generatedQuestions.length === 0) {
      alert('Not enough cards in this set matching your selected filters. Please adjust question categories or rarities.');
      return;
    }

    setActiveSettings(settings);
    setActiveQuestions(generatedQuestions);
    setQuizState('active');
  };

  const handleFinishQuiz = (result: QuizResult) => {
    const updatedStats = recordQuizCompletion(result, currentUser.id);
    setUserStats(updatedStats);
    setLastResult(result);
    setQuizState('summary');
  };

  const handleRetakeQuiz = () => {
    if (activeSettings) {
      handleStartQuiz(activeSettings);
    } else {
      setQuizState('setup');
    }
  };

  const handlePracticeMissedCards = () => {
    if (cards.length === 0) return;
    const settings: QuizSettings = {
      setCode: currentSet.code,
      setName: currentSet.name,
      questionCount: 10,
      categories: ['p1p1_pick', 'trap_or_sleeper', 'quadrant_role', 'combat_tricks', 'instant_speed', 'mana_cost_and_splash', 'power_toughness', 'archetype_engine', 'card_evaluation'],
      rarities: ['common', 'uncommon', 'rare', 'mythic'],
      timerSeconds: 0,
      mode: 'quiz',
      onlyMissedCards: true,
    };
    setQuizSubTab('take');
    handleStartQuiz(settings);
  };

  // Evaluation Handlers
  const handleSaveEvaluation = (evaluation: UserCardEvaluation) => {
    saveUserEvaluation(evaluation, currentUser.id);
    setUserEvaluations((prev) => ({
      ...prev,
      [`${evaluation.setCode.toLowerCase()}_${evaluation.cardName.toLowerCase()}`]: evaluation,
    }));
  };

  const handleClearEvaluationsForSet = (setCode: string) => {
    const updated = clearUserEvaluationsForSet(setCode, currentUser.id);
    setUserEvaluations(updated);
  };

  const missedCountForCurrentSet = Object.values(userStats.missedCards || {}).filter(
    (m) => m.setCode.toUpperCase() === currentSet.code.toUpperCase()
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-[#030614] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === 'quiz') {
            setQuizState('setup');
          }
        }}
        currentSet={currentSet}
        onOpenSetSelector={() => setIsSetSelectorOpen(true)}
        userStats={userStats}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'quiz' && (
          <>
            {quizState === 'active' && activeQuestions.length > 0 ? (
              <QuizActive
                questions={activeQuestions}
                setCode={currentSet.code}
                setName={currentSet.name}
                timerSeconds={activeSettings?.timerSeconds || 0}
                onFinishQuiz={handleFinishQuiz}
                onExitQuiz={() => setQuizState('setup')}
              />
            ) : (
              <div className="space-y-4">
                {/* Quiz Subtab Navigation Header */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b border-slate-200 dark:border-slate-800/80">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-amber-500 dark:from-violet-500 dark:via-indigo-500 dark:to-cyan-400 flex items-center justify-center text-white shadow-md shadow-violet-500/20 shrink-0 p-1.5 border border-white/20">
                        <PlaneswalkerSymbol className="w-full h-full text-white drop-shadow-xs" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-heading">
                            Card Quiz & Tactical Mastery
                          </h1>
                          <SetBadge setCode={currentSet.code} iconSvgUri={currentSet.icon_svg_uri} size="xs" className="px-2 py-0.5 text-[11px]" />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Drill {currentSet.name} heuristics, analyze category proficiency, and master missed cards.
                        </p>
                      </div>
                    </div>

                    {/* Subtabs Pill Switcher */}
                    <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100/90 dark:bg-[#060a1d] border border-slate-200/90 dark:border-slate-800/80 shadow-xs">
                      <button
                        onClick={() => {
                          setQuizSubTab('take');
                          updateAppUrlParams({ tab: 'quiz', subtab: undefined });
                        }}
                        className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                          quizSubTab === 'take'
                            ? 'bg-violet-600 text-white shadow-xs font-bold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>Take Quiz</span>
                      </button>

                      <button
                        onClick={() => {
                          setQuizSubTab('stats');
                          updateAppUrlParams({ tab: 'quiz', subtab: 'stats' });
                        }}
                        className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                          quizSubTab === 'stats'
                            ? 'bg-violet-600 text-white shadow-xs font-bold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>Quiz Mastery Stats</span>
                      </button>
                    </div>
                  </div>
                </div>

                {quizSubTab === 'take' && (
                  <>
                    {quizState === 'setup' && (
                      <QuizSetup
                        currentSet={currentSet}
                        onStartQuiz={handleStartQuiz}
                        onOpenSetSelector={() => setIsSetSelectorOpen(true)}
                        availableCardsCount={cards.length}
                        missedCardsCount={missedCountForCurrentSet}
                      />
                    )}

                    {quizState === 'summary' && lastResult && (
                      <QuizSummary
                        result={lastResult}
                        onRetakeQuiz={handleRetakeQuiz}
                        onPracticeMissed={handlePracticeMissedCards}
                        onGoToEvaluation={() => setActiveTab('evaluation')}
                        onGoToStats={() => {
                          setQuizSubTab('stats');
                          updateAppUrlParams({ tab: 'quiz', subtab: 'stats' });
                        }}
                      />
                    )}
                  </>
                )}

                {quizSubTab === 'stats' && (
                  <StatsDashboard
                    userStats={userStats}
                    onDrillMissedCards={handlePracticeMissedCards}
                    onRefreshStats={() => {
                      setUserStats(loadUserStats(currentUser.id));
                      setUserEvaluations(loadUserEvaluations(currentUser.id));
                    }}
                    onTakeQuiz={() => {
                      setQuizSubTab('take');
                      setQuizState('setup');
                      updateAppUrlParams({ tab: 'quiz', subtab: undefined });
                    }}
                    onSelectCardName={(cardName) => {
                      const matched = cards.find(
                        (c) => c.name.toLowerCase() === cardName.toLowerCase()
                      );
                      if (matched) {
                        setActiveTab('evaluation');
                        updateAppUrlParams({
                          tab: 'evaluation',
                          card: matched.collector_number || matched.name,
                        });
                      }
                    }}
                  />
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'evaluation' && (
          <EvaluationHub
            cards={cards}
            currentSetCode={currentSet.code}
            currentSetName={currentSet.name}
            userEvaluations={userEvaluations}
            seventeenLandsData={seventeenLandsData}
            onSaveEvaluation={handleSaveEvaluation}
            onClearEvaluationsForSet={handleClearEvaluationsForSet}
            onOpenSetSelector={() => setIsSetSelectorOpen(true)}
          />
        )}

        {activeTab === 'explorer' && (
          <SetExplorer
            cards={cards}
            currentSetCode={currentSet.code}
            currentSetName={currentSet.name}
            userEvaluations={userEvaluations}
            seventeenLandsData={seventeenLandsData}
            onSaveEvaluation={handleSaveEvaluation}
            onClearEvaluationsForSet={handleClearEvaluationsForSet}
            onGradeCard={(card) => {
              setActiveTab('evaluation');
              updateAppUrlParams({
                tab: 'evaluation',
                subtab: 'grade',
                card: card.collector_number || card.name,
              });
            }}
          />
        )}
      </main>

      {/* Set Selector Modal */}
      <SetSelectorModal
        isOpen={isSetSelectorOpen}
        onClose={() => setIsSetSelectorOpen(false)}
        allSets={allSets}
        currentSetCode={currentSet.code}
        onSelectSet={handleSelectSet}
        isLoadingCards={isLoadingCards}
        downloadProgress={downloadProgress}
      />

      {/* User Auth & Profile Switcher Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onUserChange={handleUserChanged}
        onRefreshStats={() => {
          setUserStats(loadUserStats(currentUser.id));
          setUserEvaluations(loadUserEvaluations(currentUser.id));
        }}
      />
    </div>
  );
};

export default App;
