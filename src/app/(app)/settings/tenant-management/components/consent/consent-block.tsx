'use client';

import { DirectoryProvider } from '@/generated/schema-enums';
import { ConsentLinkPanel, type ConsentPanelProps } from './consent-link-panel';
import { MicrosoftConsentPanel } from './microsoft-consent-panel';

export type { ConsentMode, ConsentPanelProps as ConsentBlockProps } from './consent-link-panel';

/**
 * The seam every page renders the consent step through. Dispatches on the
 * provider so the Microsoft implementation can diverge (see
 * `microsoft-consent-panel.tsx`) without the New, Reconnect or details page
 * learning about it.
 */
export function ConsentBlock(props: ConsentPanelProps) {
  if (props.provider === DirectoryProvider.MICROSOFT_365) {
    return <MicrosoftConsentPanel {...props} />;
  }
  return <ConsentLinkPanel {...props} />;
}
