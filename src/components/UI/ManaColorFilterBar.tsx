import React from 'react';

export type ManaFilterColor = 'ALL' | 'W' | 'U' | 'B' | 'R' | 'G' | 'COLORLESS' | 'GOLD' | 'LANDS';

interface ManaColorFilterBarProps {
  selectedColor: string;
  onSelectColor: (color: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showAllButton?: boolean;
}

export const ManaColorFilterBar: React.FC<ManaColorFilterBarProps> = ({
  selectedColor,
  onSelectColor,
  className = '',
  size = 'md',
  showAllButton = true,
}) => {
  const handleClick = (colorId: string) => {
    if (selectedColor === colorId || (colorId === 'GOLD' && selectedColor === 'MULTI')) {
      onSelectColor('ALL');
    } else {
      onSelectColor(colorId);
    }
  };

  const buttonSize = size === 'sm' ? 'w-6 h-6 sm:w-7 sm:h-7' : size === 'lg' ? 'w-9 h-9 sm:w-10 sm:h-10' : 'w-7 h-7 sm:w-8 sm:h-8';
  const iconSize = size === 'sm' ? 'w-5 h-5 sm:w-6 sm:h-6' : size === 'lg' ? 'w-8 h-8 sm:w-9 sm:h-9' : 'w-6 h-6 sm:w-7 sm:h-7';

  const COLOR_BUTTONS = [
    {
      id: 'W',
      label: 'White',
      symbolUrl: 'https://svgs.scryfall.io/card-symbols/W.svg',
    },
    {
      id: 'U',
      label: 'Blue',
      symbolUrl: 'https://svgs.scryfall.io/card-symbols/U.svg',
    },
    {
      id: 'B',
      label: 'Black',
      symbolUrl: 'https://svgs.scryfall.io/card-symbols/B.svg',
    },
    {
      id: 'R',
      label: 'Red',
      symbolUrl: 'https://svgs.scryfall.io/card-symbols/R.svg',
    },
    {
      id: 'G',
      label: 'Green',
      symbolUrl: 'https://svgs.scryfall.io/card-symbols/G.svg',
    },
    {
      id: 'COLORLESS',
      label: 'Colorless',
      symbolUrl: 'https://svgs.scryfall.io/card-symbols/C.svg',
    },
    {
      id: 'GOLD',
      label: 'Gold / Multicolor',
      isGold: true,
    },
    {
      id: 'LANDS',
      label: 'Lands',
      isLand: true,
    },
  ];

  return (
    <div className={`flex items-center gap-1.5 sm:gap-2 p-1 rounded-2xl bg-slate-100/90 dark:bg-[#060a1d] border border-slate-200/90 dark:border-slate-800/80 shadow-xs shrink-0 ${className}`}>
      {showAllButton && (
        <button
          type="button"
          onClick={() => onSelectColor('ALL')}
          className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
            selectedColor === 'ALL'
              ? 'bg-violet-600 text-white shadow-xs font-black'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
          }`}
          title="Show all colors"
        >
          ALL
        </button>
      )}

      <div className="flex items-center gap-1.5 sm:gap-2">
        {COLOR_BUTTONS.map((item) => {
          const isSelected = selectedColor === item.id || (item.id === 'GOLD' && selectedColor === 'MULTI');
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleClick(item.id)}
              className={`${buttonSize} rounded-full flex items-center justify-center transition-all cursor-pointer relative select-none ${
                isSelected
                  ? 'ring-2 ring-amber-400 dark:ring-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.85)] scale-110 z-10 opacity-100'
                  : 'opacity-50 hover:opacity-90 hover:scale-105 grayscale-[20%] hover:grayscale-0'
              }`}
              title={`Filter by ${item.label}`}
              aria-label={item.label}
              aria-pressed={isSelected}
            >
              {item.isGold ? (
                <div className={`${iconSize} rounded-full overflow-hidden flex items-center justify-center drop-shadow-md`}>
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <defs>
                      <radialGradient id="goldOuter" cx="50%" cy="50%" r="50%">
                        <stop offset="60%" stopColor="#cca03b" />
                        <stop offset="85%" stopColor="#f3d878" />
                        <stop offset="100%" stopColor="#875e18" />
                      </radialGradient>
                      <radialGradient id="goldInner" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#1a1409" />
                        <stop offset="70%" stopColor="#3d2c0e" />
                        <stop offset="100%" stopColor="#cca03b" />
                      </radialGradient>
                    </defs>
                    <circle cx="50" cy="50" r="46" fill="url(#goldOuter)" stroke="#422906" strokeWidth="4" />
                    <circle cx="50" cy="50" r="26" fill="url(#goldInner)" stroke="#f3d878" strokeWidth="3" />
                  </svg>
                </div>
              ) : item.isLand ? (
                <div className={`${iconSize} rounded-full overflow-hidden flex items-center justify-center drop-shadow-md`}>
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <defs>
                      <radialGradient id="landOuter" cx="50%" cy="50%" r="50%">
                        <stop offset="60%" stopColor="#8d949c" />
                        <stop offset="85%" stopColor="#b4bcc6" />
                        <stop offset="100%" stopColor="#4b525a" />
                      </radialGradient>
                    </defs>
                    <circle cx="50" cy="50" r="46" fill="url(#landOuter)" stroke="#272b30" strokeWidth="4" />
                    <path
                      d="M 16,70 C 22,68 30,52 38,38 C 42,30 46,38 52,50 C 56,42 62,26 68,26 C 74,26 80,55 84,70 Z"
                      fill="#0d1013"
                    />
                  </svg>
                </div>
              ) : (
                <img
                  src={item.symbolUrl}
                  alt={item.label}
                  className={`${iconSize} object-contain select-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]`}
                  loading="lazy"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
