// What the New and Edit forms share instead of each spelling it out: the record → form
// mapping, the customer picker's options, and the invalid-submit feedback every form here
// gives (toast, then scroll — the Controllers pass no `ref`, so RHF has nothing to focus).

import type { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import type { FieldErrors } from 'react-hook-form';
import { DirectoryProvider } from '@/generated/schema-enums';
import { knownValue } from '@/lib/exhaustive-map';
import { scrollToFirstInvalidField } from '@/lib/scroll-to-first-invalid-field';
import type { TenantConnectionRecord, TenantOrganization } from '../types/tenant-connection';
import type { TenantFormData } from '../types/tenant-form.types';

type Toast = ReturnType<typeof useToast>['toast'];

/** The record as form values; provider and domain are display-only on Edit, so a value this build cannot send stays harmless. */
export function connectionToFormValues(connection: TenantConnectionRecord): TenantFormData {
  return {
    provider: knownValue(DirectoryProvider, connection.provider) ?? DirectoryProvider.MICROSOFT_365,
    domain: connection.domain ?? '',
    name: connection.name,
    organizationId: connection.organizationId,
  };
}

/** The picker's options: the API lists only unbound customers, so the connection's own one is put back first. */
export function withBoundOrganization(
  organizations: TenantOrganization[],
  bound: TenantOrganization | null | undefined,
): TenantOrganization[] {
  if (!bound || organizations.some(organization => organization.id === bound.id)) return organizations;
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
