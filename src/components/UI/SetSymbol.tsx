import React, { useState } from 'react';
import { Layers } from 'lucide-react';

interface SetSymbolProps {
  setCode: string;
  iconSvgUri?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  alt?: string;
}

export const SetSymbol: React.FC<SetSymbolProps> = ({
  setCode,
  iconSvgUri,
  className = '',
  size = 'sm',
  alt,
}) => {
  const [hasError, setHasError] = useState<boolean>(false);
  const code = (setCode || '').toLowerCase().trim();
  
  // Default to provided URI or official Scryfall SVG set icon CDN
  const src = iconSvgUri || (code ? `https://svgs.scryfall.io/sets/${code}.svg` : '');

  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }[size];

  if (!src || hasError) {
    return <Layers className={`${sizeClasses} ${className} text-current opacity-70 shrink-0`} />;
  }

  return (
    <img
      src={src}
      alt={alt || `${setCode} set symbol`}
      onError={() => setHasError(true)}
      className={`${sizeClasses} ${className} object-contain dark:filter dark:invert opacity-90 hover:opacity-100 transition-opacity shrink-0 inline-block`}
      loading="lazy"
    />
  );
};

interface SetBadgeProps {
  setCode: string;
  iconSvgUri?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
  suffix?: string;
}

export const SetBadge: React.FC<SetBadgeProps> = ({
  setCode,
  iconSvgUri,
  className = '',
  size = 'sm',
  suffix,
}) => {
  const code = (setCode || '').toUpperCase();

  return (
    <span
      className={`font-mono text-xs font-bold text-violet-700 dark:text-cyan-300 bg-slate-100 dark:bg-[#050818] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-cyan-500/30 flex items-center gap-1.5 shadow-xs shrink-0 ${className}`}
      title={`${code} MTG Set`}
    >
      <SetSymbol setCode={code} iconSvgUri={iconSvgUri} size={size === 'md' ? 'md' : size === 'xs' ? 'xs' : 'sm'} />
      <span className="font-black">{code}</span>
      {suffix && <span className="text-slate-700 dark:text-slate-300 font-semibold">{suffix}</span>}
    </span>
  );
};
