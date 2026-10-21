'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { CheckCircleIcon, Chevron02DownIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, Tag, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import React from 'react';

/**
 * Visual status of an onboarding step.
 * - `active`    — interactive step, can be expanded/collapsed (uses its own icon)
 * - `completed` — finished step, shows a green check + "Complete" tag, still expandable
 * - `disabled`  — locked step: not interactive, no chevron, shows a requirement
 *                 hint instead. Colours are the SAME as an active row — see the
 *                 title block below for why the row is not dimmed.
 */
export type OnboardingStepStatus = 'active' | 'completed' | 'disabled';

export interface OnboardingAccordionItemProps {
  /** Leading icon, expected at 24x24 (e.g. <IdCardIcon size={24} />). Overridden by a green check when completed. */
  icon: React.ReactNode;
  title: string;
  description: string;
  /** @default 'active' */
  status?: OnboardingStepStatus;
  /** The first step still to do: a "Next" tag beside the chevron, since nothing
   *  opens on its own. Ignored for `completed` and `disabled`. */
  next?: boolean;
  /** Right-aligned hint shown for `disabled` steps (e.g. "Added Customer required"). */
  requirementHint?: string;
  /** Whether the step starts expanded. Ignored for `disabled`. @default false */
  defaultExpanded?: boolean;
  /**
   * Controlled expansion. When set, the row follows this value and reports chevron
   * toggles via `onExpandedChange` instead of keeping internal state (used by the
   * auto-advance flow — see `useOnboardingAccordion`). Ignored for `disabled`.
   */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Ref to the row's root element — the scroll anchor for the auto-advance flow. */
  ref?: React.Ref<HTMLDivElement>;
  /**
   * DOM id for the row's root element — the URL-hash anchor target
   * (`/onboarding#step-…`, see `onboardingStepAnchorId`). Optional: surfaces
   * without hash deep-linking (the dashboard card) omit it.
   */
  id?: string;
  /**
   * Loading state: renders the row frame with its real (static) icon, title, description and chevron (inert); the
   * status pill the caller's `status`/`next` names draws its own skeleton, and a requirement hint is a bar of its
   * width. A collapsed body is not mounted; an expanded one is, and draws its
   * own loading form. Inside a loading scope the row switches to it by itself. @default false
   */
  loading?: boolean;
  /** Expanded body. Not implemented yet — the step body is wired up later. */
  children?: React.ReactNode;
}

/** The trailing status tag + chevron group, loaded and loading. */
const TRAILING_CLASS = 'flex shrink-0 items-center gap-[var(--spacing-system-s)]';
/** The bordered frame of a list of steps (the Get Started groups, the dashboard's Initial Setup card). */
export const ONBOARDING_STEP_LIST_CLASS =
  'flex w-full flex-col overflow-hidden rounded-md border border-ods-border [&>*:last-child]:border-b-0';

/** A step's status pill: its read state, so a bar of the pill's own frame while it loads. */
const STEP_PILL = {
  complete: { label: 'Complete', className: 'bg-ods-success-secondary text-ods-success' },
  next: { label: 'Next', className: 'bg-ods-accent-secondary text-ods-accent' },
} as const;

/** The trailing status pill ("Complete", "Next"), one component loaded and loading: in a loading scope (or with
 *  `loading`) it is the lib's tag skeleton, the pill's 32px frame. */
function StepStatusPill({ kind, loading: loadingProp }: { kind: keyof typeof STEP_PILL; loading: boolean }) {
  const loading = useLoadingScope() || loadingProp;
  if (loading) return <Tag label="" loading />;
  const pill = STEP_PILL[kind];
  return (
    <span
      className={cn(
        'flex h-8 items-center justify-center rounded-md px-[var(--spacing-system-xsf)] text-h5',
        pill.className,
      )}
    >
      {pill.label}
    </span>
  );
}

/** The requirement hint of a locked step, loaded and loading. */
const HINT_CLASS = 'shrink-0 whitespace-nowrap text-right text-ods-text-secondary text-h6';

/**
 * A single onboarding accordion row. Renders the header (icon, title, description and
 * trailing control) and, when expanded, the step body. The inner body content is
 * intentionally left to the caller — it is wired up in a later iteration.
 *
 * Spacing uses the `--spacing-system-*` design tokens; expand/collapse animates via a
 * `grid-rows` 0fr→1fr transition so it works for content of any height.
 */
export function OnboardingAccordionItem({
  icon,
  title,
  description,
  status = 'active',
  next = false,
  requirementHint,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  loading: loadingProp = false,
  children,
  ref,
  id,
}: OnboardingAccordionItemProps) {
  const loading = useLoadingScope() || loadingProp;
  const isDisabled = !loading && status === 'disabled';
  const isCompleted = !loading && status === 'completed';
  const [internalExpanded, setInternalExpanded] = React.useState(!isDisabled && defaultExpanded);
  const expanded = !isDisabled && (controlledExpanded ?? internalExpanded);
  const pillKind = status === 'completed' ? 'complete' : status === 'active' && next ? 'next' : null;

  const toggle = React.useCallback(() => {
    if (isDisabled) return;
    const value = !expanded;
    setInternalExpanded(value);
    onExpandedChange?.(value);
  }, [isDisabled, expanded, onExpandedChange]);

  return (
    <div
      ref={ref}
      id={id}
      className={cn(
        // Top offset for the auto-advance anchor lives in the hook (`scrollElementIntoView`
        // headerOffset), not in a scroll-mt here — the helper ignores scroll-margin-top.
        'w-full border-b border-ods-border transition-colors duration-200 ease-out motion-reduce:transition-none',
        expanded && !loading ? 'bg-ods-bg' : 'bg-ods-card',
      )}
    >
      {/* Header is not interactive — only the chevron button toggles the step. */}
      <div className="flex w-full items-center gap-[var(--spacing-system-s)] p-[var(--spacing-system-m)] text-left">
        {/* Icon box — matches the chevron Button's `size="icon"` footprint (44px → 48px). */}
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-ods-border content-md:h-12 content-md:w-12',
            '[&_svg]:size-4 content-md:[&_svg]:size-6',
            // One fill in every state, locked included — the design draws the
            // four rows in identical colours and lets the trailing control say
            // which is which.
            'bg-ods-bg',
            // The leading step icon stays grey in every state (active/closed/open/disabled);
            // only the completed state swaps it for the green success check.
            isCompleted ? 'text-ods-success' : 'text-ods-text-secondary',
          )}
        >
          {isCompleted ? <CheckCircleIcon /> : icon}
        </div>

        {/* Title + description — static copy, drawn for real in every state. */}
        {/* Full-strength type in every state. A locked step used to dim both
            lines to the border grey, which read as "this step is broken"
            rather than "not yet" — and it made the one row the visitor most
            needs to READ (it explains what to do first) the hardest one to.
            What marks it locked is the trailing hint and the missing chevron,
            which is exactly how the design draws it. */}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="text-ods-text-primary text-h3">{title}</p>
          <p className="text-ods-text-secondary text-h6">{description}</p>
        </div>

        {/* Trailing: requirement hint (disabled) / status tag + chevron / chevron. While loading, the same box with
            the read parts as skeletons. */}
        {status === 'disabled' ? (
          requirementHint ? (
            loading ? (
              <TextLineSkeleton type="h6" width={`${requirementHint.length}ch`} className={HINT_CLASS} />
            ) : (
              <p className={HINT_CLASS}>{requirementHint}</p>
            )
          ) : null
        ) : (
          <div className={TRAILING_CLASS}>
            {pillKind && <StepStatusPill kind={pillKind} loading={loading} />}
            {/* The chevron is static: drawn for real, inert while the row loads. */}
            <Button
              variant="outline"
              size="icon"
              type="button"
              onClick={toggle}
              disabled={loading}
              aria-expanded={expanded}
              aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
            >
              <Chevron02DownIcon
                className={cn(
                  'transition-transform duration-300 ease-out motion-reduce:transition-none',
                  expanded && 'rotate-180',
                )}
              />
            </Button>
          </div>
        )}
      </div>

      {/* Step body, animated via grid-rows 0fr→1fr. Not mounted for disabled steps, so a
          locked step never runs its form's data hooks — nor while a collapsed row loads. An
          expanded row's body is drawn while loading: in the scope it draws its own loading form. */}
      {!isDisabled && (!loading || expanded) && (
        <div
          // The auto-advance click anchor measures this wrapper (its height is the
          // row's visible body) to pre-subtract a collapsing row above the clicked
          // one — see STEP_BODY_SELECTOR in `useOnboardingAccordion`.
          data-onboarding-step-body
          className={cn(
            'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
            expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            <div className="px-[var(--spacing-system-m)] pb-[var(--spacing-system-xl)]">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export interface OnboardingAccordionGroupProps {
  /** Optional uppercase section label rendered above the group. */
  label?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Groups one or more {@link OnboardingAccordionItem}s inside a bordered, rounded
 * container with dividers between rows. Use `label` for a section heading.
 */
export function OnboardingAccordionGroup({ label, children, className }: OnboardingAccordionGroupProps) {
  return (
    <div className={cn('flex w-full flex-col gap-[var(--spacing-system-xxs)]', className)}>
      {label ? <p className="text-ods-text-secondary text-h5">{label}</p> : null}
      <div className={ONBOARDING_STEP_LIST_CLASS}>{children}</div>
    </div>
  );
}
