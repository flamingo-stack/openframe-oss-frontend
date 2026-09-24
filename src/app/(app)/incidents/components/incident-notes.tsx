'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Suspense } from 'react';
import { useLazyLoadQuery, useMutation, usePaginationFragment } from 'react-relay';
import type { addInsightNoteMutation as AddInsightNoteMutationType } from '@/__generated__/addInsightNoteMutation.graphql';
import type { deleteInsightNoteMutation as DeleteInsightNoteMutationType } from '@/__generated__/deleteInsightNoteMutation.graphql';
import type { incidentNotesRelay_query$key as NotesFragmentKey } from '@/__generated__/incidentNotesRelay_query.graphql';
import type { incidentNotesRelayPaginationQuery as NotesPaginationQueryType } from '@/__generated__/incidentNotesRelayPaginationQuery.graphql';
import type { incidentNotesRelayQuery as NotesQueryType } from '@/__generated__/incidentNotesRelayQuery.graphql';
import type { updateInsightNoteMutation as UpdateInsightNoteMutationType } from '@/__generated__/updateInsightNoteMutation.graphql';
import {
  ContentErrorBoundary,
  type NoteItem,
  NotesSection,
  NotesSectionSkeleton,
  useRetryKey,
} from '@/app/components/shared';
import { addInsightNoteMutation } from '@/graphql/insights/add-insight-note-mutation';
import { deleteInsightNoteMutation } from '@/graphql/insights/delete-insight-note-mutation';
import { incidentNotesRelayFragment, incidentNotesRelayQuery } from '@/graphql/insights/incident-notes-relay';
import { updateInsightNoteMutation } from '@/graphql/insights/update-insight-note-mutation';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { useAuthStore } from '@/stores';
import { toIncidentUser } from '../utils/incident-transform';

const NOTES_PAGE_SIZE = 50;

interface IncidentNotesProps {
  incidentId: string;
}

function IncidentNotesContent({ incidentId }: IncidentNotesProps) {
  const { toast } = useToast();
  const currentUserId = useAuthStore(state => state.user?.id);

  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<NotesQueryType>(
    incidentNotesRelayQuery,
    { insightId: incidentId, first: NOTES_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<NotesPaginationQueryType, NotesFragmentKey>(
    incidentNotesRelayFragment,
    queryData,
  );
  // Handed to add/delete's declarative directives so the new/removed edge lands
  // in (leaves) THIS connection without a hand-written updater.
  const connectionId = data.insightNotes?.__id;
  const connections = connectionId ? [connectionId] : [];

  const notes: NoteItem[] = (data.insightNotes?.edges ?? []).flatMap(edge => {
    const node = edge?.node;
    if (!node) return [];
    const author = toIncidentUser(node.authorId, node.author);
    return [
      {
        id: node.id,
        text: node.content,
        authorName: author.name,
        authorAvatar: author.avatarUrl,
        createdAt: node.createdAt,
        // `authorId` is the raw `User.id`, the same id the auth store carries.
        isOwn: node.authorId === currentUserId,
      },
    ];
  });

  const [commitAdd, isAdding] = useMutation<AddInsightNoteMutationType>(addInsightNoteMutation);
  const [commitUpdate] = useMutation<UpdateInsightNoteMutationType>(updateInsightNoteMutation);
  const [commitDelete] = useMutation<DeleteInsightNoteMutationType>(deleteInsightNoteMutation);

  const onError = (fallback: string) => (error: Error) => {
    toast({ title: 'Error', description: getRelayErrorMessage(error, fallback), variant: 'destructive' });
  };

  const handleAdd = (content: string) =>
    commitAdd({
      variables: { input: { insightId: incidentId, content }, connections },
      onCompleted: () => {
        toast({ title: 'Note added', variant: 'success' });
      },
      onError: onError('Failed to add the note'),
    });

  const handleEdit = (id: string, content: string) =>
    commitUpdate({
      variables: { input: { id, content } },
      optimisticResponse: { updateInsightNote: { id, content, updatedAt: new Date().toISOString() } },
      onCompleted: () => {
        toast({ title: 'Note updated', variant: 'success' });
      },
      onError: onError('Failed to update the note'),
    });

  const handleDelete = (id: string) =>
    commitDelete({
      variables: { input: { id }, connections },
      onCompleted: () => {
        toast({ title: 'Note deleted', variant: 'success' });
      },
      onError: onError('Failed to delete the note'),
    });

  return (
    <>
      <NotesSection
        notes={notes}
        isAddingNote={isAdding}
        onAddNote={handleAdd}
        onEditNote={handleEdit}
        onDeleteNote={handleDelete}
      />
      {hasNext && (
        <Button
          variant="outline"
          size="small"
          className="w-fit"
          loading={isLoadingNext}
          onClick={() => loadNext(NOTES_PAGE_SIZE)}
        >
          Load older notes
        </Button>
      )}
    </>
  );
}

/**
 * The incident's notes: its own island, since notes are their own root query
 * on the backend (a list of insights must not pull notes per row). Its own
 * boundary too, so a notes failure degrades this section rather than
 * replacing an already-loaded incident with the page's error.
 */
export function IncidentNotes({ incidentId }: IncidentNotesProps) {
  return (
    <ContentErrorBoundary title="Notes" message="Couldn't load notes.">
      <Suspense fallback={<NotesSectionSkeleton />}>
        <IncidentNotesContent incidentId={incidentId} />
      </Suspense>
    </ContentErrorBoundary>
  );
}
