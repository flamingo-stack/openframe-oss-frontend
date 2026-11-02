'use client';

import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { noop } from '@/app/components/shared/no-next-page';
import { DirectoryProvider } from '@/generated/schema-enums';
import { ConsentLinkPanel, type ConsentMode, type ConsentPanelProps } from './consent-link-panel';
import { MicrosoftConsentPanel } from './microsoft-consent-panel';

export type { ConsentMode, ConsentPanelProps as ConsentBlockProps } from './consent-link-panel';

/** The block before the record is known: only the mode is, the provider is `null`. */
interface PendingConsentBlockProps {
  mode: ConsentMode;
  provider: null;
}

/**
 * The seam every page renders the consent step through. Dispatches on the
 * provider so the Microsoft implementation can diverge (see
 * `microsoft-consent-panel.tsx`) without the New, Reconnect or details page
 * learning about it. Before the record is known (`provider` null) the panel draws its own loading state.
 */
export function ConsentBlock(props: ConsentPanelProps | PendingConsentBlockProps) {
  if (props.provider === null) {
    return (
      <LoadingWhen loading>
        <ConsentLinkPanel
          mode={props.mode}
          provider=""
          consentUrl={null}
          checking={false}
          verdict={null}
          onCheck={noop}
        />
      </LoadingWhen>
    );
  }
  if (props.provider === DirectoryProvider.MICROSOFT_365) {
    return <MicrosoftConsentPanel {...props} />;
  }
  return <ConsentLinkPanel {...props} />;
}
