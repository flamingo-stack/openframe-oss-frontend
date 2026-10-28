'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { formatDate } from '@/lib/format-date';
import { PACKAGE_CANCELLATION_TERMS, PAYG_CANCELLED_TERMS } from './cancellation-copy';

interface SubscriptionCancelledModalProps {
  isOpen: boolean;
  endDate: string | null;
  /** The subscription carries a package, so it runs to `endDate`; without one it has already ended. */
  withPackage: boolean;
  onClose: () => void;
}

export function SubscriptionCancelledModal({ isOpen, endDate, withPackage, onClose }: SubscriptionCancelledModalProps) {
  return (
    <SimpleModal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[600px]"
      title="Subscription Cancelled"
      footer={
        <>
          <div className="flex-1" />
          <Button variant="accent" className="flex-1" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {withPackage ? (
        <p className="text-ods-text-primary text-h4">
          {`Your subscription will end on `}
          <span className="text-ods-warning">{formatDate(endDate)}</span>
          {`. ${PACKAGE_CANCELLATION_TERMS}`}
        </p>
      ) : (
        <p className="text-ods-text-primary text-h4">{PAYG_CANCELLED_TERMS}</p>
      )}
    </SimpleModal>
  );
}
