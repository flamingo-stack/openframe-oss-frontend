'use client';

import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useEffect, useState } from 'react';
import type { ApplicationTheme } from '../../types/ai-settings';

type ResolvedTheme = 'dark' | 'light';

/** Resolves ApplicationTheme to 'dark' | 'light'; `SYSTEM` follows `prefers-color-scheme`. */
function useResolvedTheme(theme: ApplicationTheme): ResolvedTheme {
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>('dark');

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;

    const media = window.matchMedia('(prefers-color-scheme: light)');
    const sync = () => setSystemTheme(media.matches ? 'light' : 'dark');

    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  if (theme === 'LIGHT') return 'light';
  if (theme === 'DARK') return 'dark';
  return systemTheme;
}

/**
 * The class pair that scopes a preview to its own theme — `.ai-preview-theme`
 * from `globals.css` plus the core library's `.theme-light` / `.theme-dark`
 * token flips. Stated once here rather than in every surface that renders a
 * preview, since the two halves come from different packages.
 */
export function usePreviewThemeClass(theme: ApplicationTheme): string {
  const resolved = useResolvedTheme(theme);
  return cn('ai-preview-theme', resolved === 'light' ? 'theme-light' : 'theme-dark');
}
