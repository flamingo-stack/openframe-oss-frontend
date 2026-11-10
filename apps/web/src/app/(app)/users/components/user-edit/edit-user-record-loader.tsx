'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useLayoutEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { editUserRecordLoaderQuery as EditUserRecordLoaderQueryType } from '@/__generated__/editUserRecordLoaderQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { type EditUserRecord, readEditUserRecord } from './edit-user-form';

/** Carries `details` and the name parts, a live provider read: fine on a single-record page, never in a list. */
const editUserRecordLoaderQuery = graphql`
  query editUserRecordLoaderQuery($id: ID!) {
    directoryUser(id: $id) {
      ...editUserForm_person
    }
  }
`;

export type EditUserRecordState =
  { status: 'loading' } | { status: 'missing' } | { status: 'ready'; record: EditUserRecord };

interface EditUserRecordLoaderProps {
  id: string;
  onResolved: (state: EditUserRecordState) => void;
}

/**
 * The page's data island, with its own boundary: it draws nothing and hands the record up, where the owner of `useForm`
 * seeds the form (`useSeedForm`: the write cannot happen here).
 */
export function EditUserRecordLoader(props: EditUserRecordLoaderProps) {
  return (
    <LoadingSuspense label="Loading user">
      <EditUserRecordReader {...props} />
    </LoadingSuspense>
  );
}

function EditUserRecordReader(props: EditUserRecordLoaderProps) {
  // In a loading scope (its boundary's fallback, or the module's flag window) nothing is read or handed up.
  if (useLoadingScope()) return null;
  return <EditUserRecordQuery {...props} />;
}

function EditUserRecordQuery({ id, onResolved }: EditUserRecordLoaderProps) {
  const retryKey = useRetryKey();
  const { directoryUser } = useLazyLoadQuery<EditUserRecordLoaderQueryType>(
    editUserRecordLoaderQuery,
    { id },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  // Identity matters: `useSeedForm` seeds once per record object, so a new one is built only for a new answer.
  const state = useMemo<EditUserRecordState>(() => {
    if (!directoryUser) return { status: 'missing' };
    const record = readEditUserRecord(directoryUser);
    return record ? { status: 'ready', record } : { status: 'missing' };
  }, [directoryUser]);

  // Layout effect: the page seeds and unlocks the fields before the paint when the record is cached.
  useLayoutEffect(() => {
    onResolved(state);
  }, [state, onResolved]);

  return null;
}
