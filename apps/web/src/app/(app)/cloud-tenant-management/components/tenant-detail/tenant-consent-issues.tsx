'use client';

import { Copy02Icon, ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Tag,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { tenantConsentIssues_connection$key } from '@/__generated__/tenantConsentIssues_connection.graphql';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import { useIsDesktopShell } from '@/app/hooks/use-is-desktop-shell';
import { useSameWindowLinks } from '@/app/hooks/use-same-window-links';
import {
  consentIssueCode,
  consentIssueReport,
  consentIssueTag,
  formatConnectedAt,
  providerErrorLookupUrl,
} from '../../utils/tenant-presentation';

// No Figma frame: the shape follows the providers' own error pages. Entra and Google both lead with
// the sentence and what to do, and fold the code, correlation id and time under "More details" /
// "Request details", with one action that copies the lot for a support ticket.
const tenantConsentIssuesFragment = graphql`
  fragment tenantConsentIssues_connection on DirectoryConnection {
    provider
    domain
    lastConsentInfo {
      occurredAt
      issues {
        tier
        kind
        providerCode
        correlationId
        message
      }
    }
  }
`;

interface TroubleshootingDetailsProps {
  code: string | null;
  correlationId: string | null;
  occurredAt: string;
  /** The plain-text block "Copy Details" puts on the clipboard. */
  report: string;
}

function TroubleshootingDetails({ code, correlationId, occurredAt, report }: TroubleshootingDetailsProps) {
  const sameWindow = useSameWindowLinks();
  // An off-origin same-window navigation would strand the desktop app on Microsoft's page, while its
  // shell hands `target="_blank"` to the system browser (see `download-apps-view`).
  const newTab = useIsDesktopShell() || !sameWindow;
  const { copy: copyCorrelationId } = useCopyToClipboard({ successDescription: 'Correlation ID copied to clipboard' });
  const { copy: copyReport } = useCopyToClipboard({
    successDescription: 'Troubleshooting details copied to clipboard',
  });
  const lookupUrl = providerErrorLookupUrl(code);
  const at = formatConnectedAt(occurredAt);

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="details" className="border-none">
        <AccordionTrigger className="flex-none justify-start gap-[var(--spacing-system-xxs)] py-0 text-ods-text-secondary hover:text-ods-text-primary hover:no-underline">
          Troubleshooting details
        </AccordionTrigger>
        <AccordionContent className="pt-[var(--spacing-system-s)]">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-[var(--spacing-system-m)] gap-y-[var(--spacing-system-xs)]">
            {code && (
              <>
                <dt className="text-ods-text-secondary text-h6">Error code</dt>
                <dd className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
                  <span className="text-ods-text-primary text-code">{code}</span>
                  {lookupUrl && (
                    <Button
                      variant="transparent"
                      size="icon-sm"
                      href={lookupUrl}
                      openInNewTab={newTab}
                      aria-label={`Look up ${code} in Microsoft's error reference`}
                    >
                      <ExternalLinkIcon className="text-ods-text-secondary" />
                    </Button>
                  )}
                </dd>
              </>
            )}
            {correlationId && (
              <>
                <dt className="text-ods-text-secondary text-h6">Correlation ID</dt>
                <dd className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
                  <span className="min-w-0 break-all text-ods-text-primary text-code">{correlationId}</span>
                  <Button
                    variant="transparent"
                    size="icon-sm"
                    aria-label="Copy correlation ID"
                    onClick={() => copyCorrelationId(correlationId)}
                  >
                    <Copy02Icon className="text-ods-text-secondary" />
                  </Button>
                </dd>
              </>
            )}
            {at && (
              <>
                <dt className="text-ods-text-secondary text-h6">Time</dt>
                <dd className="text-ods-text-primary text-h6">
                  {at.date} <span className="text-ods-text-secondary">{at.time}</span>
                </dd>
              </>
            )}
          </dl>
          <Button
            variant="outline"
            className="mt-[var(--spacing-system-m)]"
            leftIcon={<Copy02Icon />}
            onClick={() => copyReport(report)}
          >
            Copy Details
          </Button>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

/**
 * What went wrong inside the last consent attempt, beyond its outcome: a provider error with its
 * code and correlation id, or a tier whose permissions are still settling. Nothing when there is none.
 */
export function TenantConsentIssues({ connection }: { connection: tenantConsentIssues_connection$key }) {
  const { provider, domain, lastConsentInfo } = useFragment(tenantConsentIssuesFragment, connection);
  if (!lastConsentInfo || lastConsentInfo.issues.length === 0) return null;
  const { occurredAt, issues } = lastConsentInfo;

  return (
    <section className="flex flex-col gap-[var(--spacing-system-xxs)]" aria-label="Consent issues">
      <p className="text-ods-text-secondary text-h5">Consent issues</p>
      <ul className="flex flex-col rounded-md border border-ods-border bg-ods-card">
        {issues.map(issue => {
          const code = consentIssueCode(issue.providerCode);
          const correlationId = issue.correlationId ?? null;
          return (
            <li
              key={`${issue.kind}:${issue.tier ?? ''}:${issue.message}`}
              className="flex flex-col gap-[var(--spacing-system-s)] p-[var(--spacing-system-m)] [&+&]:border-t [&+&]:border-ods-border"
            >
              <div className="flex flex-wrap items-center gap-[var(--spacing-system-xs)]">
                {issue.tier && <Tag label={issue.tier} variant="outline" />}
                <Tag {...consentIssueTag(issue.kind, provider)} />
              </div>
              <p className="text-ods-text-primary text-h4">{issue.message}</p>
              {(code || correlationId) && (
                <TroubleshootingDetails
                  code={code}
                  correlationId={correlationId}
                  occurredAt={occurredAt}
                  report={consentIssueReport({
                    provider,
                    domain: domain ?? null,
                    occurredAt,
                    tier: issue.tier ?? null,
                    code,
                    correlationId,
                    message: issue.message,
                  })}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
