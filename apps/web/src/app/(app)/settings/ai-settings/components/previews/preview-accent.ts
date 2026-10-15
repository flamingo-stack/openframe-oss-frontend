import {
  deriveActiveColor,
  deriveHoverColor,
  getReadableTextColor,
  HEX_PATTERN,
} from '@flamingo-stack/openframe-frontend-core/utils';
import type { CSSProperties } from 'react';

/**
 * The accent variables the Fae window writes onto its document for a custom
 * accent (openframe-chat `useApplyAiAppearance({ chatV2: true })`), scoped here
 * to a preview's root instead, so the preview recolours exactly what the chat
 * does: accent buttons and their labels, the onboarding dots and tiles, the
 * selected chat row, the brand-tinted background and the corner glow.
 *
 * An accent that is not a 6-digit hex still recolours the base tokens; only the
 * derived shades and the label colour need the hex math.
 */
export function previewAccentStyle(accentColor: string | undefined): CSSProperties {
  if (!accentColor) return {};

  const isHex = HEX_PATTERN.test(accentColor);
  const hover = isHex ? deriveHoverColor(accentColor) : accentColor;
  const active = isHex ? deriveActiveColor(accentColor) : accentColor;

  return {
    '--ods-accent': accentColor,
    '--color-accent-primary': accentColor,
    '--color-accent-focus': accentColor,
    '--color-accent-hover': hover,
    '--color-accent-active': active,
    '--ods-flamingo-pink-base': accentColor,
    '--ods-flamingo-pink-hover': hover,
    '--ods-flamingo-pink-action': active,
    // Mixed toward the page background so it follows the previewed theme.
    '--color-accent-secondary': `color-mix(in srgb, ${accentColor} 50%, var(--color-bg))`,
    ...(isHex && { '--color-text-on-accent': getReadableTextColor(accentColor) }),
  } as CSSProperties;
}
