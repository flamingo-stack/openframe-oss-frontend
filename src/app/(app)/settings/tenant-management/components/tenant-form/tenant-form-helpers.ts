// What the New and Edit forms share: the record → form mapping, the changed-fields diff, the customer
// picker's options and the invalid-submit feedback (toast, then scroll — Controllers pass no `ref`).

import type { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import type { FieldErrors } from 'react-hook-form';
import type { tenantRecordLoaderQuery$data } from '@/__generated__/tenantRecordLoaderQuery.graphql';
import { DirectoryProvider } from '@/generated/schema-enums';
import { knownValue } from '@/lib/exhaustive-map';
import { scrollToFirstInvalidField } from '@/lib/scroll-to-first-invalid-field';
import type { TenantFormData } from './tenant-form.types';

type Toast = ReturnType<typeof useToast>['toast'];

export type StoredConnectionFields = Pick<
  NonNullable<tenantRecordLoaderQuery$data['directoryConnection']>,
  'provider' | 'domain' | 'name' | 'organizationId'
>;

/** The record as form values; provider and domain are display-only on Edit, so a value this build cannot send stays harmless. */
export function connectionToFormValues(connection: StoredConnectionFields): TenantFormData {
  return {
    provider: knownValue(DirectoryProvider, connection.provider) ?? DirectoryProvider.MICROSOFT_365,
    domain: connection.domain ?? '',
    name: connection.name,
    organizationId: connection.organizationId,
  };
}

export type EditableField = 'name' | 'organizationId' | 'domain';

/** The fields whose value differs from what is stored — the only ones an update sends. */
export function changedFields(
  values: TenantFormData,
  stored: Readonly<Record<EditableField, string | null | undefined>>,
  fields: readonly EditableField[],
): Partial<Pick<TenantFormData, EditableField>> {
  const changes: Partial<Pick<TenantFormData, EditableField>> = {};
  for (const field of fields) {
    if (values[field] !== stored[field]) changes[field] = values[field];
  }
  return changes;
}

/** The picker's options: the API lists only unbound customers, so the connection's own one is put back first. */
export function withBoundOrganization<T extends { readonly organizationId: string }>(
  organizations: readonly T[],
  bound: T | null | undefined,
): readonly T[] {
  if (!bound || organizations.some(organization => organization.organizationId === bound.organizationId)) {
    return organizations;
  }
  return [bound, ...organizations];
}

/** The `handleSubmit` error branch: one destructive toast, then the page scrolls to the culprit. */
export function invalidSubmitHandler(toast: Toast, title: string) {
  return (errors: FieldErrors<TenantFormData>) => {
    const messages = Object.values(errors)
      .map(error => error?.message)
      .filter((message): message is string => Boolean(message));
    toast({
      title,
      description: messages.length > 0 ? messages.join(', ') : 'Please fill in all required fields.',
      variant: 'destructive',
    });
    scrollToFirstInvalidField();
  };
}
