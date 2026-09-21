// The two things both tenant forms (New, Edit) need and must not each spell
// out: the record → form mapping, and the invalid-submit feedback every form in
// this app gives (toast listing the messages, then scroll to the first field
// that failed — RHF's own focus cannot reach a core component).

import type { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import type { FieldErrors } from 'react-hook-form';
import { scrollToFirstInvalidField } from '@/lib/scroll-to-first-invalid-field';
import type { TenantConnection } from '../types/tenant-connection';
import type { TenantFormData } from '../types/tenant-form.types';

type Toast = ReturnType<typeof useToast>['toast'];

export function connectionToFormValues(connection: TenantConnection): TenantFormData {
  return {
    provider: connection.provider,
    domain: connection.domain,
    name: connection.name,
    organizationId: connection.organizationId,
  };
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
