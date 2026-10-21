'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { SquareAvatar, TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { employeeDetailHref } from '@/app/(app)/settings/employees/routes';
import { DeletedUserAvatar, isDeletedUserStatus } from '@/app/components/shared/deleted-user';
import { getFullImageUrl } from '@/lib/image-url';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { decodeGlobalId } from '@/lib/relay-id';
import { initiatorInitials, initiatorName } from '../utils/execution-helpers';

/** The person who dispatched an execution or a run, as the "Executed by" cell draws them. */
export interface Initiator {
  /** The User global id ('' when unknown). */
  id: string;
  name: string;
  initials: string;
  image?: string;
  /** The account is DELETED / SELF_DELETED: the avatar is the red placeholder and the name reads as an error. */
  deleted: boolean;
}

/** An initiator as the execution and run queries select it. */
interface InitiatorNode {
  id?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  status?: string | null;
  image?: { imageUrl?: string | null; hash?: string | null } | null;
}

/** The initiator of a query's node (`null` when it has none, or has not answered). */
export function toInitiator(node: InitiatorNode | null | undefined): Initiator {
  return {
    id: node?.id ?? '',
    name: initiatorName(node),
    initials: initiatorInitials(node),
    image: getFullImageUrl(node?.image?.imageUrl, node?.image?.hash),
    deleted: isDeletedUserStatus(node?.status),
  };
}

/** A table row's flattened initiator fields (the executions and the runs rows carry the same ones). */
export function rowInitiator(row: {
  initiatorId: string;
  initiatorName: string;
  initiatorInitials: string;
  initiatorImage?: string;
  initiatorDeleted: boolean;
}): Initiator {
  return {
    id: row.initiatorId,
    name: row.initiatorName,
    initials: row.initiatorInitials,
    image: row.initiatorImage,
    deleted: row.initiatorDeleted,
  };
}

/** The employee page of the initiator: its global id decoded to the raw id the REST-backed page expects. */
function initiatorHref(initiator: Initiator): string | null {
  if (!initiator.id) return null;
  return employeeDetailHref(decodeGlobalId(initiator.id)?.rawId ?? initiator.id);
}

/** The initiator's avatar. In a loading scope it draws its own skeleton. */
export function InitiatorAvatar({ initiator, size }: { initiator: Initiator; size: 'sm' | 'md' }) {
  if (initiator.deleted) return <DeletedUserAvatar size={size} />;
  return (
    <SquareAvatar
      variant="round"
      size={size}
      src={initiator.image}
      fallback={initiator.initials}
      alt={initiator.name}
      initialsClassName="text-ods-text-secondary"
    />
  );
}

interface InitiatorNameProps {
  initiator: Initiator;
  /**
   * In a table row the name is a button that opens the person's page in a new tab and opts out of the row's own link
   * (`<a>` cannot sit inside the row's `<a>`); on a page it is a link.
   */
  inRow?: boolean;
  /** The name is not here yet: a bar on its `text-h4` line. A loading scope does the same. */
  loading?: boolean;
}

/** The initiator's name, linked to their employee page when there is one. */
export function InitiatorName({ initiator, inRow = false, loading: loadingProp }: InitiatorNameProps) {
  const loading = useLoadingScope() || !!loadingProp;
  if (loading) return <TextLineSkeleton type="h4" className="w-28 max-w-full" />;

  const href = initiatorHref(initiator);
  if (!href) {
    return <TruncateText className={initiator.deleted ? 'text-ods-error' : undefined}>{initiator.name}</TruncateText>;
  }

  const name = (
    <TruncateText className={cn('underline', initiator.deleted ? 'text-ods-error' : 'text-ods-accent')}>
      {initiator.name}
    </TruncateText>
  );

  return inRow ? (
    <button
      data-no-row-click
      type="button"
      onClick={openInNewTab(href)}
      className="pointer-events-auto min-w-0 text-left"
    >
      {name}
    </button>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className="min-w-0">
      {name}
    </a>
  );
}

/**
 * "Executed by": the avatar and the name, the one cell the execution and run pages and tables share. It switches
 * itself: in a loading scope (or with `loading`) the avatar draws its skeleton and the name a bar.
 */
export function InitiatorIdentity({ initiator, size, inRow, loading }: InitiatorNameProps & { size: 'sm' | 'md' }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xsf)]">
      <InitiatorAvatar initiator={initiator} size={size} />
      <div className="flex min-w-0 flex-1">
        <InitiatorName initiator={initiator} inRow={inRow} loading={loading} />
      </div>
    </div>
  );
}
