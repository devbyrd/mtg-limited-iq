import React, { useState } from 'react';
import {
  Sparkles,
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Brain,
  Scale,
  Compass,
  Zap,
  TrendingUp,
  Flame,
  ShieldCheck,
  Eye,
  Sliders,
  HelpCircle,
  Play,
  RotateCcw,
} from 'lucide-react';
import { PlaneswalkerSymbol } from './PlaneswalkerSymbol';

interface WelcomeTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: 'evaluation' | 'quiz' | 'explorer') => void;
  onOpenSetSelector?: () => void;
}

interface TourStep {
  title: string;
  badge: string;
  tagline: string;
  description: string;
  targetTab?: 'evaluation' | 'quiz' | 'explorer';
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  bullets: {
    title: string;
    text: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
  quickAction?: {
    label: string;
    action: () => void;
  };
}

export const WelcomeTourModal: React.FC<WelcomeTourModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenSetSelector,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleDismiss = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem('mtg_has_seen_welcome_tour_v1', 'true');
      } catch (e) {
        console.warn('Could not save welcome tour preference:', e);
      }
    }
    onClose();
  };

  const handleFinishTour = (targetTab?: 'evaluation' | 'quiz' | 'explorer') => {
    handleDismiss();
    if (targetTab && onNavigateTab) {
      onNavigateTab(targetTab);
    }
  };

  const steps: TourStep[] = [
    {
      title: 'Welcome to MTG Limited IQ',
      badge: 'Getting Started Guide',
      tagline: 'Your workbench for card grading, 17Lands benchmarks, and draft practice.',
      description:
        'MTG Limited IQ is built to sharpen your card evaluations before and during any draft format. Test your intuition against live 17Lands win rates and pro grades.',
      icon: Sparkles,
      accentColor: 'from-violet-600 via-indigo-600 to-amber-500',
      bullets: [
        {
          title: 'Blind & Unbiased Grading',
          text: 'Assign letter grades (A+ through F) to full sets before data influences your evaluations.',
          icon: Scale,
        },
        {
          title: 'Direct 17Lands & LSV Benchmarks',
          text: 'Compare your picks against live premier draft game-in-hand win rates and CFB expert tiers.',
          icon: TrendingUp,
        },
        {
          title: 'Tactical Quiz Drills',
          text: 'Train combat tricks, instant-speed interaction, P1P1 picks, and format archetype engines.',
          icon: Brain,
        },
        {
          title: 'Historical Card Comps',
          text: 'Evaluate unprecedented or previewed cards using statistical predecessors from past premier sets.',
          icon: Compass,
        },
      ],
      quickAction: onOpenSetSelector
        ? {
            label: 'Pick Your Set',
            action: () => {
              handleDismiss();
              onOpenSetSelector();
            },
          }
        : undefined,
    },
    {
      title: '1. Card Grading Hub',
      badge: 'Grading Cards',
      tagline: 'Rate cards one-by-one or in bulk with live historical comps.',
      description:
        'Build your personal tier list for the active set. Grade cards blind to test your initial read, then compare against 17Lands win rates.',
      targetTab: 'evaluation',
      icon: Scale,
      accentColor: 'from-violet-600 to-cyan-500',
      bullets: [
        {
          title: 'Grading Mode Toggle',
          text: 'Keep stats hidden while you grade cards. Turn stats on anytime to view 17Lands GIH WR & LSV tiers.',
          icon: Eye,
        },
        {
          title: 'Historical Precedents & Average Grade',
          text: 'Stuck on a card? Click "Similar Cards" to see past statistical comps and adopt the consensus average grade.',
          icon: Compass,
        },
        {
          title: 'Calibration & Discrepancy Breakdown',
          text: 'Head to the Calibration subtab to view your accuracy curve, over-rated cards, under-rated gems, and archetype forecasts.',
          icon: Sliders,
        },
      ],
      quickAction: onNavigateTab
        ? {
            label: 'Jump into Grading',
            action: () => handleFinishTour('evaluation'),
          }
        : undefined,
    },
    {
      title: '2. Card Quiz & Tactical Mastery',
      badge: 'Quiz Drills',
      tagline: 'Level up your instincts with targeted flashcard drills.',
      description:
        'Reinforce format knowledge before your draft pod starts. Choose from 9 distinct question categories or practice cards you missed in previous sessions.',
      targetTab: 'quiz',
      icon: Brain,
      accentColor: 'from-amber-500 to-rose-500',
      bullets: [
        {
          title: 'Instant Speed & Combat Tricks',
          text: 'Memorize open-mana threats, removal spells, and combat blowouts so you never walk into a trap.',
          icon: Zap,
        },
        {
          title: 'P1P1 & Quadrant Theory',
          text: 'Practice first-pick evaluations and drill cards across opening, parity, winning, and losing game states.',
          icon: ShieldCheck,
        },
        {
          title: 'Streaks, XP & Missed Cards Vault',
          text: 'Earn XP, climb drafter levels, and run dedicated drills targeting only the specific cards you got wrong.',
          icon: Flame,
        },
      ],
      quickAction: onNavigateTab
        ? {
            label: 'Try a Quick Quiz',
            action: () => handleFinishTour('quiz'),
          }
        : undefined,
    },
    {
      title: '3. Cards Explorer & Set Visualizer',
      badge: 'Card Catalog',
      tagline: 'Browse, filter, and inspect the entire card catalog.',
      description:
        'Explore cards with rich Scryfall syntax searching (e.g. o:draw, mv<=3, c:wurg), mana color filters, and dual visual views.',
      targetTab: 'explorer',
      icon: Compass,
      accentColor: 'from-emerald-500 to-teal-500',
      bullets: [
        {
          title: 'Interactive Multi-Select Filters',
          text: 'Filter simultaneously by colors, rarities, and grading status to pinpoint archetypes or review unrated cards.',
          icon: Sliders,
        },
        {
          title: 'Grid & High-Density List Modes',
          text: 'Switch between visual card artwork grids and a compact table view with sortable win rates, ALSA, and user grades.',
          icon: CheckCircle2,
        },
        {
          title: 'Quick Set Switcher in Navbar',
          text: 'Switch between current Standard formats (HOB, SOS, BLB, OTJ, etc.) or explore historical booster draft sets.',
          icon: Sparkles,
        },
      ],
      quickAction: onNavigateTab
        ? {
            label: 'Explore Card Catalog',
            action: () => handleFinishTour('explorer'),
          }
        : undefined,
    },
  ];

  const currentStep = steps[currentStepIndex];
  const StepIcon = currentStep.icon;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleFinishTour(currentStep.targetTab);
    } else {
      setCurrentStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handlePrev = () => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 dark:bg-[#030612]/90 backdrop-blur-md animate-in fade-in duration-200"
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-tour-title"
    >
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-[#080d26] border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header with Gradient Bar */}
        <div className="relative px-5 sm:px-6 pt-5 pb-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-b from-slate-50/80 to-white dark:from-[#0a1133]/90 dark:to-[#080d26]">
          {/* Subtle Top Accent Glow */}
          <div
            className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${currentStep.accentColor}`}
          />

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br ${currentStep.accentColor} flex items-center justify-center text-white shadow-md shadow-violet-500/20 shrink-0 p-2 border border-white/25`}
              >
                {isFirstStep ? (
                  <PlaneswalkerSymbol className="w-full h-full text-white drop-shadow-xs" />
                ) : (
                  <StepIcon className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 dark:bg-violet-950/80 dark:text-cyan-300 border border-violet-200 dark:border-violet-700/50">
                    {currentStep.badge}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Step {currentStepIndex + 1} of {steps.length}
                  </span>
                </div>
                <h2
                  id="welcome-tour-title"
                  className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-heading tracking-tight mt-0.5"
                >
                  {currentStep.title}
                </h2>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={handleDismiss}
              className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0"
              title="Close tour (Esc)"
              aria-label="Close tour"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper Progress Dots / Tabs */}
          <div className="flex items-center gap-1.5 mt-4 pt-1">
            {steps.map((s, index) => (
              <button
                key={index}
                onClick={() => setCurrentStepIndex(index)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  index === currentStepIndex
                    ? 'w-8 bg-violet-600 dark:bg-cyan-400'
                    : index < currentStepIndex
                    ? 'w-3 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600'
                    : 'w-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700'
                }`}
                title={`Jump to ${s.title}`}
                aria-label={`Jump to step ${index + 1}: ${s.title}`}
              />
            ))}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          {/* Tagline Banner */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#050818] border border-slate-200/80 dark:border-slate-800/80">
            <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
              {currentStep.tagline}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {currentStep.description}
            </p>
          </div>

          {/* Bulleted Feature Highlights */}
          <div className="space-y-2.5">
            {currentStep.bullets.map((bullet, idx) => {
              const BulletIcon = bullet.icon;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-[#0a0f2e]/60 border border-slate-100 dark:border-slate-800/60 hover:border-violet-300 dark:hover:border-violet-700/50 transition-colors shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800/60 flex items-center justify-center text-violet-600 dark:text-cyan-400 shrink-0 mt-0.5">
                    <BulletIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {bullet.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {bullet.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Action Button within Step */}
          {currentStep.quickAction && (
            <div className="pt-2">
              <button
                type="button"
                onClick={currentStep.quickAction.action}
                className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-violet-500/20 flex items-center justify-center gap-2 cursor-pointer border border-white/10"
              >
                <span>{currentStep.quickAction.label}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-[#060a1f]/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Don't show again checkbox */}
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-400 select-none self-start sm:self-center">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded text-violet-600 dark:text-cyan-400 border-slate-300 dark:border-slate-700 focus:ring-violet-500 cursor-pointer"
            />
            <span>Don't show this tour on startup</span>
          </label>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {!isFirstStep && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 border border-slate-300 dark:border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            {isFirstStep ? (
              <button
                type="button"
                onClick={handleDismiss}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Skip Tour
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shadow-violet-500/20"
            >
              <span>{isLastStep ? 'Get Started' : 'Next Step'}</span>
              {isLastStep ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeTourModal;
