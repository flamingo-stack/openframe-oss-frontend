'use client';

import { QuickActionChipButton } from '@flamingo-stack/openframe-frontend-core/components/chat';
import {
  CheckCircleIcon,
  Chevron02DownIcon,
  Chevron02UpIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useState } from 'react';
import type { TourAction, TourStep, TourStepId } from './tour-steps';

export interface GettingStartedBlockProps {
  steps: readonly TourStep[];
  doneStepIds: ReadonlySet<TourStepId>;
  /** A "try asking" chip: send its prompt and open its section. */
  onAction: (step: TourStep, action: TourAction) => void;
  /** "Finish tour", offered on the last step. */
  onFinish: () => void;
}

/**
 * The Getting Started tour, pinned above the Mingo composer in the tour's
 * conversation. Two shapes:
 *
 * - the list: one row per step, opening into its description and "try asking"
 *   chips (one open at a time). This is where the tour starts.
 * - the grid: two columns of step chips, what the block folds into once a chip
 *   has been used so the conversation gets the room. The chevron in the title
 *   row unfolds it; a step chip unfolds it on that step.
 *
 * A step is done once any of its chips has been used; the title row counts
 * them. Which steps are done is the host's (it merges the server's record with
 * this device's); the shape and the open step are the block's own.
 */
export function GettingStartedBlock({ steps, doneStepIds, onAction, onFinish }: GettingStartedBlockProps) {
  const [folded, setFolded] = useState(false);
  const [openId, setOpenId] = useState<TourStepId | null>(null);

  const total = steps.length;
  const done = steps.filter(step => doneStepIds.has(step.id)).length;

  const openStep = (id: TourStepId) => {
    setFolded(false);
    setOpenId(id);
  };

  const handleAction = (step: TourStep, action: TourAction) => {
    onAction(step, action);
    setOpenId(null);
    setFolded(true);
  };

  return (
    <section
      aria-label="Getting started"
      className="flex max-h-[60vh] min-h-0 flex-col overflow-hidden rounded-md border border-ods-border bg-ods-card"
    >
      <header className="flex shrink-0 items-center gap-[var(--spacing-system-xs)] border-b border-ods-border px-[var(--spacing-system-sf)] py-[var(--spacing-system-xsf)]">
        <h2 className="text-ods-text-primary text-h5">Getting started</h2>
        <p className="text-ods-text-secondary text-h6">
          <span className="font-bold text-ods-text-primary">{done}</span> of {total} steps
        </p>
        {folded && (
          <button
            type="button"
            aria-label="Show the steps"
            onClick={() => setFolded(false)}
            className="ml-auto flex size-6 items-center justify-center rounded-md text-ods-text-primary hover:text-ods-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
          >
            <Chevron02UpIcon size={24} />
          </button>
        )}
      </header>

      {folded ? (
        <ul className="grid grid-cols-2 gap-[var(--spacing-system-sf)] p-[var(--spacing-system-sf)]">
          {steps.map((step, index) => {
            const isDone = doneStepIds.has(step.id);
            // An odd count leaves the last chip alone on its row: it spans both columns.
            const spans = index === total - 1 && total % 2 === 1;
            return (
              <li key={step.id} className={cn('min-w-0', spans && 'col-span-2')}>
                <button
                  type="button"
                  onClick={() => openStep(step.id)}
                  className="flex h-12 w-full items-center gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-bg px-[var(--spacing-system-sf)] text-left hover:border-ods-border-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
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
                  onClick={() => setOpenId(isOpen ? null : step.id)}
                  className="flex w-full items-center gap-[var(--spacing-system-sf)] p-[var(--spacing-system-sf)] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-accent"
                >
                  <span
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-md border bg-ods-card',
                      isDone ? 'border-ods-success text-ods-success' : 'border-ods-border text-ods-text-primary',
                    )}
                  >
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
                    <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
                      <p className="text-ods-text-secondary text-h5">Try asking:</p>
                      <ul className="flex flex-col items-start gap-[var(--spacing-system-xxs)]">
                        {step.actions.map(action => (
                          <li key={action.id} className="max-w-full">
                            <QuickActionChipButton
                              label={action.label}
                              icon={<action.Icon size={16} className="text-ods-flamingo-cyan" />}
                              onSelect={() => handleAction(step, action)}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
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
