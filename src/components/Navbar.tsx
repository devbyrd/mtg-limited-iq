import React, { useState, useEffect } from 'react';
import { Flame, BarChart3, Layers, BookOpen, ChevronDown, Trophy, Check, Link2, Sun, Moon, RefreshCw, Zap } from 'lucide-react';
import { SetInfo, UserProfileStats, UserAccount } from '../types/mtg';
import { getSyncStatus, subscribeSyncStatus, SyncStatus } from '../services/cloudSync';
import { getStoredTheme, toggleTheme, ThemeMode } from '../services/theme';
import { PlaneswalkerSymbol } from './UI/PlaneswalkerSymbol';
import { SetSymbol } from './UI/SetSymbol';

export type ActiveTab = 'quiz' | 'evaluation' | 'stats' | 'explorer';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  currentSet: SetInfo;
  onOpenSetSelector: () => void;
  userStats: UserProfileStats;
  currentUser: UserAccount;
  onOpenAuthModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  currentSet,
  onOpenSetSelector,
  userStats,
  currentUser,
  onOpenAuthModal,
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(getStoredTheme());

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((s) => setSyncStatus(s));
    
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: ThemeMode }>;
      if (customEvent.detail?.theme) {
        setCurrentTheme(customEvent.detail.theme);
      }
    };
    window.addEventListener('mtg-theme-change', handleThemeChange);

    return () => {
      unsubscribe();
      window.removeEventListener('mtg-theme-change', handleThemeChange);
    };
  }, []);

  const handleToggleTheme = () => {
    const next = toggleTheme();
    setCurrentTheme(next);
  };

  const handleCopyTroubleshootLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      console.warn('Clipboard copy failed:', e);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-[#060919]/95 backdrop-blur-md shadow-xs transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          {/* Brand Logo & Name: Official WOTC MTG Planeswalker Spark + MTG Limited IQ */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-amber-500 dark:from-violet-500 dark:via-indigo-500 dark:to-cyan-400 flex items-center justify-center text-white shadow-md shadow-violet-500/20 shrink-0 p-1.5 border border-white/20">
              <PlaneswalkerSymbol className="w-full h-full text-white drop-shadow-xs" />
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="font-heading font-black text-sm sm:text-base tracking-wider text-slate-900 dark:text-white">
                MTG LIMITED
              </span>
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 dark:bg-violet-950/80 dark:text-violet-300 border border-violet-200 dark:border-violet-700/50">
                IQ
              </span>
            </div>
          </div>

          {/* Navigation Tabs in Unified Pill Aesthetic */}
          <nav className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100/90 dark:bg-[#060a1d] border border-slate-200/90 dark:border-slate-800/80 shadow-xs overflow-x-auto no-scrollbar shrink-0">
            <button
              onClick={() => onTabChange('quiz')}
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'quiz'
                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Card Quiz</span>
            </button>

            <button
              onClick={() => onTabChange('evaluation')}
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'evaluation'
                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Card Grading Hub</span>
            </button>

            <button
              onClick={() => onTabChange('explorer')}
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'explorer'
                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Card List</span>
            </button>
          </nav>

          {/* Right Side: Theme Toggle, Set Switcher, Streak & User Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Dark / Light Mode Toggle Button */}
            <button
              onClick={handleToggleTheme}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shrink-0 shadow-xs text-xs font-bold"
              title={`Switch to ${currentTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
              aria-label="Toggle Theme"
            >
              {currentTheme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                  <span className="hidden sm:inline">Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-violet-700 fill-violet-700/20" />
                  <span className="hidden sm:inline">Dark Mode</span>
                </>
              )}
            </button>

            {/* Streak & Level (Large screens) */}
            <div className="hidden xl:flex items-center gap-1.5 shrink-0">
              <div
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-amber-600 dark:text-amber-400 text-xs font-semibold whitespace-nowrap"
                title={`Current Streak: ${userStats.currentStreak}`}
              >
                <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>{userStats.currentStreak} Streak</span>
              </div>

              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium whitespace-nowrap"
                title={`Level ${userStats.level} (${userStats.xp} Total XP) • Gain XP by grading cards and answering quiz flashcards`}
              >
                <span className="font-mono font-bold text-violet-600 dark:text-violet-400">Lv.{userStats.level}</span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">({userStats.xp} XP)</span>
              </div>
            </div>

            {/* Share / Troubleshoot Link Button */}
            <button
              onClick={handleCopyTroubleshootLink}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl transition-all shadow-xs cursor-pointer shrink-0 text-xs font-semibold text-slate-700 dark:text-slate-300"
              title="Copy current shareable troubleshooting URL to clipboard"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs hidden sm:inline">Copied!</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span className="text-xs hidden md:inline">Share Link</span>
                </>
              )}
            </button>

            {/* Set Switcher Trigger */}
            <button
              onClick={onOpenSetSelector}
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl transition-all shadow-xs group cursor-pointer shrink-0 whitespace-nowrap"
              title="Switch Active MTG Set"
            >
              <SetSymbol setCode={currentSet.code} iconSvgUri={currentSet.icon_svg_uri} size="sm" />
              <div className="text-left flex items-center gap-1.5">
                <span className="font-mono text-xs font-bold text-violet-600 dark:text-cyan-300">{currentSet.code}</span>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate max-w-[80px] sm:max-w-[110px] hidden md:inline">
                  {currentSet.name}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors shrink-0" />
            </button>

            {/* User Profile / Auth Button with Live Cloud Sync Indicator */}
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 sm:gap-2 pl-1 pr-2 sm:pr-2.5 py-1 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl transition-all shadow-xs cursor-pointer group shrink-0 whitespace-nowrap"
              title={`Active Profile: ${currentUser.name} • Sync: ${syncStatus}`}
            >
              <div className="relative shrink-0">
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    className="w-6 h-6 rounded-lg object-cover border border-slate-300 dark:border-slate-700 shrink-0"
                  />
                ) : (
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs text-white shadow-xs font-heading shrink-0"
                    style={{ backgroundColor: currentUser.avatarColor || '#8b5cf6' }}
                  >
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Live Sync Status Indicator Dot */}
                {syncStatus === 'synced' && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#060919]" />
                )}
                {syncStatus === 'syncing' && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-500 ring-2 ring-white dark:ring-[#060919] animate-pulse" />
                )}
                {syncStatus === 'offline' && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#060919]" />
                )}
              </div>

              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white max-w-[70px] sm:max-w-[95px] truncate">
                {currentUser.name}
              </span>

              {/* Sync Icon Feedback */}
              {syncStatus === 'syncing' ? (
                <RefreshCw className="w-3 h-3 text-cyan-500 animate-spin shrink-0" />
              ) : syncStatus === 'synced' ? (
                <Check className="w-3 h-3 text-emerald-500 shrink-0 opacity-80" />
              ) : null}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
