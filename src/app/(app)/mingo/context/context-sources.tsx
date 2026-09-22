'use client';

/**
 * Mingo entity-context types — the picker's first-level list (Figma 31:28708).
 * `type` is the backend discriminator (also stamped onto each `ChatContextItem.
 * type`); `icon` is the lead glyph. The DATA for each type is fetched by its
 * per-type component (`relay-items` / `rest-items` / `batch-items`), dispatched
 * by `renderMingoContextItems`.
 */

import type { ChatContextEntityType } from '@flamingo-stack/openframe-frontend-core/components/chat';
import {
  AlertTriangleIcon,
  BracketCurlyEllipsisVrIcon,
  BracketCurlyIcon,
  BracketSquareCheckIcon,
  FolderShieldIcon,
  IdCardIcon,
  MonitorIcon,
  Parcel02Icon,
  TagIcon,
  TimerIcon,
  UserIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { KB_ITEM_ICON } from '@/app/(app)/knowledge-base/components/knowledge-base-item-icon';
import { useFeatureFlag } from '@/app/hooks/use-feature-flag';
import { KnowledgeBaseItemType } from '@/generated/schema-enums';
import { CONTEXT_ENTITY_KIND, CONTEXT_ENTITY_MARKER, type ContextEntityKind } from './context-types';

const KbArticleIcon = KB_ITEM_ICON[KnowledgeBaseItemType.ARTICLE];

/**
 * Entity types in picker display order. `marker` is the backend mention short
 * form (from `CONTEXT_ENTITY_MARKER`) — the lib uses it to commit `@marker:id`
 * tokens that match the backend's `MentionParser`. Every kind offered here
 * resolves server-side.
 */
export const MINGO_CONTEXT_ENTITY_TYPES: ChatContextEntityType[] = [
  {
    type: CONTEXT_ENTITY_KIND.DEVICE,
    label: 'Device',
    marker: CONTEXT_ENTITY_MARKER.DEVICE,
    icon: <MonitorIcon size={24} />,
  },
  {
    type: CONTEXT_ENTITY_KIND.SCRIPT,
    label: 'Script',
    marker: CONTEXT_ENTITY_MARKER.SCRIPT,
    icon: <BracketCurlyIcon size={24} />,
  },
  {
    // Sits next to Script on purpose — a schedule is "when these scripts run",
    // so the two read as one pair in the picker.
    type: CONTEXT_ENTITY_KIND.SCHEDULED_SCRIPT,
    label: 'Script Schedule',
    marker: CONTEXT_ENTITY_MARKER.SCHEDULED_SCRIPT,
    icon: <TimerIcon size={24} />,
  },
  {
    type: CONTEXT_ENTITY_KIND.TICKET,
    label: 'Ticket',
    marker: CONTEXT_ENTITY_MARKER.TICKET,
    icon: <TagIcon size={24} />,
  },
  {
    type: CONTEXT_ENTITY_KIND.ORGANIZATION,
    label: 'Customer',
    marker: CONTEXT_ENTITY_MARKER.ORGANIZATION,
    icon: <IdCardIcon size={24} />,
  },
  { type: CONTEXT_ENTITY_KIND.USER, label: 'User', marker: CONTEXT_ENTITY_MARKER.USER, icon: <UserIcon size={24} /> },
  {
    type: CONTEXT_ENTITY_KIND.KB_ARTICLE,
    label: 'Knowledge Article',
    marker: CONTEXT_ENTITY_MARKER.KB_ARTICLE,
    icon: <KbArticleIcon size={24} />,
  },
  {
    type: CONTEXT_ENTITY_KIND.POLICY,
    label: 'Policy',
    marker: CONTEXT_ENTITY_MARKER.POLICY,
    icon: <FolderShieldIcon size={24} />,
  },
  {
    type: CONTEXT_ENTITY_KIND.QUERY,
    label: 'Query',
    marker: CONTEXT_ENTITY_MARKER.QUERY,
    icon: <BracketCurlyEllipsisVrIcon size={24} />,
  },
  {
    type: CONTEXT_ENTITY_KIND.INSIGHT,
    label: 'Incident',
    marker: CONTEXT_ENTITY_MARKER.INSIGHT,
    icon: <AlertTriangleIcon size={24} />,
  },
  {
    // The same glyph as the Software sidebar item and section tab.
    type: CONTEXT_ENTITY_KIND.SOFTWARE,
    label: 'Software',
    marker: CONTEXT_ENTITY_MARKER.SOFTWARE,
    icon: <Parcel02Icon size={24} />,
  },
  {
    // Next to Software on purpose — a CVE is "what is wrong with this title",
    // so the two read as one pair. The glyph is the Vulnerabilities tab's,
    // on the device page and the Software section alike.
    type: CONTEXT_ENTITY_KIND.VULNERABILITY,
    label: 'Vulnerability',
    marker: CONTEXT_ENTITY_MARKER.VULNERABILITY,
    icon: <BracketSquareCheckIcon size={24} />,
  },
];

/** The kinds the Software module brings — offered only while `software-management` is on. */
const SOFTWARE_KINDS: ReadonlySet<ContextEntityKind> = new Set([
  CONTEXT_ENTITY_KIND.SOFTWARE,
  CONTEXT_ENTITY_KIND.VULNERABILITY,
]);

const TYPES_WITHOUT_SOFTWARE = MINGO_CONTEXT_ENTITY_TYPES.filter(t => !SOFTWARE_KINDS.has(t.type as ContextEntityKind));

/**
 * The picker's list, shaped by the flags. Two constant arrays, so the picker
 * config that memoizes on the result stays put while the flag holds still.
 * Appearing late is fine here: an entry absent until the flag answers changes
 * nothing else, and a mention already in a chat renders as a chip regardless
 * (`renderMingoMention` dispatches by marker, not by this list).
 */
export function useMingoContextEntityTypes(): ChatContextEntityType[] {
  const softwareEnabled = useFeatureFlag('software-management');
  return softwareEnabled ? MINGO_CONTEXT_ENTITY_TYPES : TYPES_WITHOUT_SOFTWARE;
}
