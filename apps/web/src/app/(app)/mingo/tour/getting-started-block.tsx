'use client';

import { QuickActionChipButton } from '@flamingo-stack/openframe-frontend-core/components/chat';
import {
  CheckCircleIcon,
  Chevron02DownIcon,
  Chevron02UpIcon,
  ExternalLinkIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useState } from 'react';
import { useGettingStartedView } from './getting-started-view';
import type { TourAction, TourStep, TourStepId } from './tour-steps';

/**
 * A chip under a disabled fieldset: the lib's disabled `Tag` look. The chip
 * button takes no `disabled` of its own, so it is drawn from the fieldset.
 */
const DISABLED_CHIP =
  'group-disabled:cursor-not-allowed group-disabled:[&>*]:border-transparent group-disabled:[&>*]:bg-ods-bg-surface group-disabled:[&>*]:text-ods-text-secondary group-disabled:[&_svg]:text-ods-text-secondary';

export interface GettingStartedBlockProps {
  steps: readonly TourStep[];
  doneStepIds: ReadonlySet<TourStepId>;
  /**
   * A "try asking" chip: send its prompt and open its section. False when
   * the chip was refused (the chat is busy): the step stays open.
   */
  onAction: (step: TourStep, action: TourAction) => boolean;
  /** "Finish tour", offered on the last step. */
  onFinish: () => void;
  /**
   * "Open Fae - your client assistant", offered on the steps that open it (`TourStep.opensFae`).
   * Absent where Fae cannot run (a phone): the chip is not shown.
   */
  onOpenFae?: () => void;
  /**
   * Mingo is answering in this conversation: the "try asking" chips are
   * disabled until it is done, since the chat takes one prompt at a time.
   */
  busy?: boolean;
}

/**
 * The Getting Started tour, pinned above the Mingo composer in the tour's
 * conversation. Two shapes:
 *
 * - the list: one row per step, opening into its description and "try asking"
 *   chips (one open at a time). This is where the tour starts. Until the user
 *   opens or closes a row, the first step not done yet is the open one, so the
 *   list never shows as a wall of closed rows.
 * - the grid: two columns of step chips, whatever the width the composer has (a
 *   docked page composer is wide enough for four), what the block folds into once
 *   a chip has been used so the conversation gets the room. The chevron in the
 *   title row unfolds it and folds it back; a step
 *   chip unfolds it on that step.
 *
 * The shape is the user's, remembered across pages and tabs
 * (`getting-started-view.ts`): folding or unfolding it, and a chip folding it,
 * write it there. With nothing remembered (a tour started on another device) it
 * opens as the grid once any step is done, as the list before the first one. A
 * step is done once any of its chips has been used; the title row counts them.
 * Which steps are done is the host's (it merges the server's record with this
 * device's); the open step is the block's own.
 */
export function GettingStartedBlock({
  steps,
  doneStepIds,
  onAction,
  onFinish,
  onOpenFae,
  busy = false,
}: GettingStartedBlockProps) {
  // null until the user folds or unfolds it: the progress decides, and it may land
  // after the block has mounted.
  const [view, setView] = useGettingStartedView();
  // undefined until the user picks a row: the next step to do is open meanwhile.
  const [pickedId, setPickedId] = useState<TourStepId | null | undefined>(undefined);

  const total = steps.length;
  const done = steps.filter(step => doneStepIds.has(step.id)).length;
  const folded = view ? view === 'collapsed' : done > 0;
  const openId = pickedId === undefined ? (steps.find(step => !doneStepIds.has(step.id))?.id ?? null) : pickedId;
  const setFolded = (next: boolean) => setView(next ? 'collapsed' : 'default');

  const openStep = (id: TourStepId) => {
    setFolded(false);
    setPickedId(id);
  };

  const handleAction = (step: TourStep, action: TourAction) => {
    if (busy || !onAction(step, action)) return;
    setPickedId(undefined);
    setFolded(true);
  };

  return (
    <section
      aria-label="Getting started"
      className="flex max-h-[60vh] min-h-0 flex-col overflow-hidden rounded-md border border-ods-border bg-ods-card"
    >
      <header className="flex shrink-0 items-center gap-[var(--spacing-system-sf)] border-b border-ods-border p-[var(--spacing-system-xsf)]">
        <h2 className="text-ods-text-secondary text-h5">Getting started</h2>
        <p className="text-ods-text-secondary text-h6">
          <span className="font-bold text-ods-text-primary">{done}</span> of {total} steps
        </p>
        {/* Unfolds the grid into the list, and folds the list back into the grid. */}
        <button
          type="button"
          aria-label={folded ? 'Show the steps' : 'Hide the steps'}
          aria-expanded={!folded}
          onClick={() => {
            if (!folded) setPickedId(undefined);
            setFolded(!folded);
          }}
          className="ml-auto flex size-6 items-center justify-center rounded-md text-ods-text-primary hover:text-ods-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
        >
          {folded ? <Chevron02UpIcon size={24} /> : <Chevron02DownIcon size={24} />}
        </button>
      </header>

      {folded ? (
        <ul
          data-testid="getting-started-grid"
          // Scrolls in a short panel, where the block gives the thread its room.
          className="grid min-h-0 grid-cols-2 gap-[var(--spacing-system-xsf)] overflow-y-auto p-[var(--spacing-system-sf)]"
        >
          {steps.map(step => {
            const isDone = doneStepIds.has(step.id);
            // Two to a row; an odd last one takes the whole row.
            return (
              <li key={step.id} className="min-w-0 last:odd:col-span-2">
                <button
                  type="button"
                  onClick={() => openStep(step.id)}
                  className="flex h-12 w-full items-center gap-[var(--spacing-system-sf)] rounded-md border border-ods-border bg-ods-card px-[var(--spacing-system-sf)] text-left hover:border-ods-border-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
                >
                  <StepGlyph step={step} done={isDone} size={24} />
                  <span className="truncate text-ods-text-primary text-h4">{step.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {steps.map((step, index) => {
            const isOpen = openId === step.id;
            const isDone = doneStepIds.has(step.id);
            const isLast = index === total - 1;
            const panelId = `getting-started-${step.id}`;
            return (
              <li key={step.id} className={cn('border-b border-ods-border last:border-b-0', isOpen && 'bg-ods-bg')}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setPickedId(isOpen ? null : step.id)}
                  className="flex w-full items-center gap-[var(--spacing-system-sf)] p-[var(--spacing-system-sf)] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-accent"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-ods-border bg-ods-bg text-ods-text-primary">
                    <StepGlyph step={step} done={isDone} size={24} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-ods-text-primary text-h4">{step.title}</span>
                    <span className="truncate text-ods-text-secondary text-h6">{step.subtitle}</span>
                  </span>
                  {isOpen ? (
                    <Chevron02UpIcon size={24} className="shrink-0 text-ods-text-primary" />
                  ) : (
                    <Chevron02DownIcon size={24} className="shrink-0 text-ods-text-primary" />
                  )}
                </button>
                {isOpen && (
                  <div
                    id={panelId}
                    className="flex flex-col gap-[var(--spacing-system-m)] px-[var(--spacing-system-sf)] pb-[var(--spacing-system-sf)]"
                  >
                    <p className="text-ods-text-primary text-h4">{step.description}</p>
                    {/* A disabled fieldset disables every chip button inside it. */}
                    <fieldset
                      disabled={busy}
                      className="group m-0 flex min-w-0 flex-col gap-[var(--spacing-system-xxs)] border-0 p-0"
                    >
                      <p className="text-ods-text-secondary text-h5">Try asking:</p>
                      {busy && (
                        <p role="status" className="text-ods-text-secondary text-h6">
                          Mingo is answering…
                        </p>
                      )}
                      <ul className="flex flex-col items-start gap-[var(--spacing-system-xxs)]">
                        {step.actions.map(action => (
                          <li key={action.id} className="max-w-full">
                            <QuickActionChipButton
                              label={action.label}
                              icon={<action.Icon size={16} className="text-ods-flamingo-cyan" />}
                              onSelect={() => handleAction(step, action)}
                              className={DISABLED_CHIP}
                            />
                          </li>
                        ))}
                      </ul>
                    </fieldset>
                    {/* Not a prompt, so it stays live while Mingo answers. */}
                    {step.opensFae && onOpenFae && (
                      <div className="flex">
                        <QuickActionChipButton
                          label="Open Fae - your client assistant"
                          icon={<ExternalLinkIcon size={16} className="text-ods-flamingo-cyan" />}
                          onSelect={onOpenFae}
                        />
                      </div>
                    )}
                    {isLast && (
                      <div className="flex">
                        <QuickActionChipButton label="Finish tour" variant="primary" onSelect={onFinish} />
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** The step's icon, or the done mark once any of its chips has been used. */
function StepGlyph({ step, done, size }: { step: TourStep; done: boolean; size: number }) {
  if (done) return <CheckCircleIcon size={size} className="shrink-0 text-ods-success" />;
  return <step.Icon size={size} className="shrink-0" />;
}
