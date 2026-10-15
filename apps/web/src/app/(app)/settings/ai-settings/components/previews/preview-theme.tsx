'use client';

import { MoonStarIcon, Sun01Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { TabSelector } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';

/**
 * The theme a preview is shown in. Not a setting: the client picks the theme in
 * the Fae app, so the admin only flips the preview to see the accent on both.
 */
export type PreviewTheme = 'dark' | 'light';

/**
 * The class pair that scopes a preview to its own theme — `.ai-preview-theme`
 * from `globals.css` plus the core library's `.theme-light` / `.theme-dark`
 * token flips. Stated once here rather than in every surface that renders a
 * preview, since the two halves come from different packages.
 */
export function previewThemeClass(theme: PreviewTheme): string {
  return cn('ai-preview-theme', theme === 'light' ? 'theme-light' : 'theme-dark');
}

interface PreviewThemeSwitchProps {
  value: PreviewTheme;
  onChange: (theme: PreviewTheme) => void;
  className?: string;
}

export function PreviewThemeSwitch({ value, onChange, className }: PreviewThemeSwitchProps) {
  return (
    <TabSelector
      variant="secondary"
      scrollable
      value={value}
      onValueChange={theme => onChange(theme as PreviewTheme)}
      items={[
        {
          id: 'dark',
          label: 'Dark',
          icon: <MoonStarIcon className="size-5" />,
        },
        {
          id: 'light',
          label: 'Light',
          icon: <Sun01Icon className="size-5" />,
        },
      ]}
      className={className}
    />
  );
}
