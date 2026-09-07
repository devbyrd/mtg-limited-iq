export type ThemeMode = 'dark' | 'light';

const THEME_STORAGE_KEY = 'mtg_iq_theme';

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'dark' || saved === 'light') {
    return saved;
  }
  return 'dark'; // Default to dark mode
}

export function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  
  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
  
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (e) {
    // Storage access might be restricted
  }

  // Dispatch custom event so listeners can update reactively
  window.dispatchEvent(new CustomEvent('mtg-theme-change', { detail: { theme } }));
}

export function toggleTheme(): ThemeMode {
  const current = getStoredTheme();
  const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
