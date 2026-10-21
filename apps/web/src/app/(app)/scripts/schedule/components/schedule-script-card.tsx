'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { Chevron02DownIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useContentMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { routes } from '@/lib/routes';
import { prewarmScriptEditor, ScriptEditor } from '../../shared/components/script-editor';
import {
  argsToParamRows,
  envPairsToParamRows,
  type ScriptParamRow,
  ScriptParamRows,
} from '../../shared/components/script-param-rows';
import { envVarsToPairs, shellToId } from '../../shared/utils/script-mappers';
import type { ScheduleScript } from '../types/schedule-detail.types';
import { effectiveScriptParams, type StoredScriptCustomParams } from '../utils/schedule-script-params';

interface ScheduleScriptCardProps {
  /** Absent while the schedule loads: the card draws itself with its values as bars. */
  script?: ScheduleScript;
  /**
   * This schedule's override for the script, when it has one. Absent means the
   * card shows the script's own defaults — which is what the schedule runs.
   */
  customParams?: StoredScriptCustomParams;
}

/** Design default when a script carries no timeout of its own. */
const DEFAULT_TIMEOUT_SECONDS = 90;

/** No parameters to list (the schedule is not read yet). */
const NO_ROWS: ScriptParamRow[] = [];

/** The source editor's height. */
const SOURCE_HEIGHT = '400px';

/**
 * One half of a script card's footer: a titled list of `key ——— value` lines.
 *
 * Deliberately not the core `InfoCard`: that draws its own bordered, rounded
 * card, while the design splits the script card itself into two flat panels
 * divided by a single rule. The lines are the shared {@link ScriptParamRows},
 * so they read identically to the script page's.
 */
function ScriptParamsPanel({
  title,
  rows,
  emptyText,
  footer,
  className,
  loading,
}: {
  title: string;
  rows: ScriptParamRow[];
  emptyText: string;
  /** The parameters are not read yet: the rows draw their own loading form. */
  loading: boolean;
  /** Rendered below the rows, in the panel's own 12px rhythm. */
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-sf)] p-[var(--spacing-system-m)]',
        // Desktop layers the panels over the card (1:49182); the phone (1:49002)
        // flattens the whole card to one tone and lets the rules do the dividing.
        'bg-ods-bg content-md:bg-ods-card',
        className,
      )}
    >
      <TruncateText>{title}</TruncateText>
      <ScriptParamRows rows={rows} emptyText={emptyText} loading={loading} />
      {footer}
    </div>
  );
}

/**
 * One script of the schedule. The chevron opens a different thing per
 * breakpoint, and that is the design's intent, not a shortcut:
 *
 * - **Desktop (1:49182)** — the argument / env-var panels are always visible
 *   (they are what tells two entries of the same script apart), and the chevron
 *   reveals the source above them.
 * - **Phone (1:49002 open / 1:49009 closed)** — the closed card is the header
 *   row alone; opening it gives the panels and a full-width way into the script.
 *   No source at any point: a 400px editor on a 390px-wide screen is a worse
 *   read than the script page it links to.
 */
export function ScheduleScriptCard({ script, customParams }: ScheduleScriptCardProps) {
  // While the schedule loads the card draws itself: the same frame and static copy, its read values as bars, its
  // buttons inert, and (desktop) the two panels each holding one row — the line every panel has either way. A phone
  // starts closed, so there the header alone is the collapsed card in both forms.
  const loading = useLoadingScope() || !script;
  const router = useRouter();
  const isMdUp = useContentMdUp();
  const [isExpanded, setIsExpanded] = useState(false);
  // The editor is kept once built, so re-opening a card is instant and a closed
  // one costs nothing beyond memory.
  const [hasExpanded, setHasExpanded] = useState(false);

  // Fetch the editor's CHUNK while the card is still shut — only the chunk.
  // Building the view is a few milliseconds and happens on the first open, under
  // the placeholder; what is not cheap is pulling the code over the network
  // inside the click that starts the card's one animation. `prewarmScriptEditor`
  // is idle-scheduled and idempotent, so every card on the page calling it costs
  // one background request. A phone never shows the source, so it fetches nothing.
  useEffect(() => {
    if (isMdUp) prewarmScriptEditor();
  }, [isMdUp]);

  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev);
    setHasExpanded(true);
  }, []);

  const scriptId = script?.id;
  const handleScriptDetails = useCallback(() => {
    if (scriptId) router.push(routes.scripts.details(scriptId));
  }, [router, scriptId]);

  // What this SCHEDULE runs the script with, which is not always what the script
  // itself defaults to: a per-script override replaces either half wholesale.
  // The card is the page that has to show the difference — it is where a user
  // checks what a scheduled run will actually pass.
  const effective = script ? effectiveScriptParams(script, customParams) : null;
  const argRows = effective ? argsToParamRows(effective.args) : NO_ROWS;
  const envRows = effective ? envPairsToParamRows(envVarsToPairs(effective.envVars)) : NO_ROWS;

  return (
    <div data-loading-item className="flex flex-col overflow-clip rounded-[8px] border border-ods-border bg-ods-card">
      {/* Desktop splits the header down the middle — Name owns one half, and the
          actions ride the end of the Timeout half. Mobile drops "Script Details"
          (it moves down into the Environment Vars panel), so the row is a flat
          Name | Timeout | chevron and the card sizes to its padding instead of a
          fixed 80px. */}
      <div
        className={cn(
          'flex items-center gap-[var(--spacing-system-s)] p-[var(--spacing-system-m)] content-md:h-[80px] content-md:gap-[var(--spacing-system-m)] content-md:py-0',
          // Tone follows the STATE, not the breakpoint. Closed, the header is
          // the card's own face and keeps its tone (1:49009). Open, it becomes
          // chrome over the source and drops to the darker background tone
          // (1:49002, 1:49182) — the same tone the editor below it paints, so
          // the two read as one block instead of two stacked cards.
          isExpanded && 'bg-ods-bg',
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          {script ? <TruncateText>{script.name}</TruncateText> : <TextLineSkeleton type="h4" className="w-44" />}
          <span className="truncate text-ods-text-secondary text-h6">Script</span>
        </div>

        {/* `contents` on mobile: the wrapper exists only to make the right half a
            single flex child on desktop. Dissolving it below `md` lets Timeout
            share the row's width with Name evenly, as the mobile mock has it. */}
        <div className="contents content-md:flex content-md:min-w-0 content-md:flex-1 content-md:items-center content-md:gap-[var(--spacing-system-m)]">
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            {script ? (
              <span className="truncate text-ods-text-primary text-h4">
                {script.defaultTimeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS} Seconds
              </span>
            ) : (
              <TextLineSkeleton type="h4" className="w-24" />
            )}
            <span className="truncate text-ods-text-secondary text-h6">Timeout</span>
          </div>

          <Button variant="outline" onClick={handleScriptDetails} disabled={loading} className="hidden content-md:flex">
            Script Details
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleToggle}
            disabled={loading}
            // Deliberately not "source": the same chevron opens the source on
            // desktop and the parameters on a phone.
            aria-label={isExpanded ? 'Collapse script details' : 'Expand script details'}
            aria-expanded={isExpanded}
            leftIcon={
              <span className={`inline-flex transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                <Chevron02DownIcon size={24} />
              </span>
            }
          />
        </div>
      </div>

      {/* The source: desktop only, and what the chevron opens there. Closed, the
          region is CLIPPED rather than unmounted, so an editor built on the
          first open survives every later close with its scroll position and
          undo history. `inert` because clipping alone still leaves it in the tab
          order. */}
      <div
        className="hidden transition-[grid-template-rows] duration-300 ease-in-out content-md:grid"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
        inert={!isExpanded}
      >
        <div className="min-h-0 overflow-hidden">
          {isMdUp && hasExpanded && script && (
            // The tone lives HERE rather than on either child: it is what the
            // editor's own theme paints, so the placeholder and the editor read
            // as one surface — no flash of the card's lighter background through
            // the swap.
            <div className="border-t border-ods-border bg-ods-bg">
              <ScriptEditor
                value={script.scriptBody}
                shell={shellToId(script.shell)}
                readOnly
                height={SOURCE_HEIGHT}
                // The card already draws the edges around this block.
                className="rounded-none border-0"
              />
            </div>
          )}
        </div>
      </div>

      {/* The panels: what the chevron opens on a phone, permanent furniture on
          desktop. One instance serving both — the `!` is what lets the desktop
          rule beat the inline row template. Rendering two copies behind
          `content-md:hidden` would duplicate the list for assistive tech instead. */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out content-md:!grid-rows-[1fr]"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
        // Only on a phone, where this region actually collapses. `isMdUp` is
        // `undefined` until the media query resolves; inerting for that first
        // frame is harmless, since the only focusable thing inside is the
        // `content-md:hidden` button, which desktop does not render anyway.
        inert={!isExpanded && !isMdUp}
      >
        <div className="min-h-0 overflow-hidden">
          {/* Two equal panels split by a single rule (horizontal once they
              stack). Both always render, so an empty half still holds its column
              instead of letting the other one span the card. */}
          <div className="flex flex-col items-stretch border-t border-ods-border content-md:flex-row">
            <ScriptParamsPanel
              title="Script Arguments"
              rows={argRows}
              emptyText="No script arguments"
              loading={loading}
              className="border-b border-ods-border content-md:border-b-0 content-md:border-r"
            />
            <ScriptParamsPanel
              title="Environment Vars"
              rows={envRows}
              emptyText="No environment variables"
              loading={loading}
              // Phone only (1:49002): the header has no room for "Script
              // Details", so the way into the script sits at the foot of the
              // last panel.
              footer={
                <Button
                  variant="outline"
                  onClick={handleScriptDetails}
                  disabled={loading}
                  className="w-full content-md:hidden"
                >
                  Show Script Details
                </Button>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
