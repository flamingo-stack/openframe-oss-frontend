'use client';

import { EyeIcon, EyeOffIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, ModalV2Title, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type ReactNode, useEffect, useState } from 'react';
import { SimpleModal } from '@/app/components/shared/simple-modal';

export interface SsoConfigurationDetails {
  provider: string;
  displayName: string;
  isEnabled: boolean;
  clientId?: string | null;
  clientSecret?: string | null;
  allowedDomains: string[];
}

interface SsoConfigurationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  details: SsoConfigurationDetails | null;
  isPending: boolean;
  /** Enabling needs no confirmation — fires directly. */
  onEnable: () => void;
  /** Disabling and deleting open their confirmation dialogs first. */
  onDisableRequest: () => void;
  onDeleteRequest: () => void;
}

/** Label ... leader line ... value — the key-value row treatment from the mockup. */
function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-2 w-full min-w-0">
      <span className="text-h4 text-ods-text-primary whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-ods-border min-w-4" />
      <span className="text-h4 text-ods-text-primary min-w-0 flex items-center gap-2 text-right">{value}</span>
    </div>
  );
}

export function SsoConfigurationDetailsModal({
  isOpen,
  onClose,
  details,
  isPending,
  onEnable,
  onDisableRequest,
  onDeleteRequest,
}: SsoConfigurationDetailsModalProps) {
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    if (isOpen) setShowSecret(false);
  }, [isOpen]);

  return (
    <SimpleModal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[600px] w-full"
      header={<ModalV2Title>Configuration Details</ModalV2Title>}
      footer={
        <div className="flex w-full gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending} className="flex-1">
            Cancel
          </Button>
          {details?.isEnabled ? (
            <Button variant="destructive" onClick={onDisableRequest} disabled={isPending} className="flex-1">
              Disable
            </Button>
          ) : (
            <Button variant="accent" onClick={onEnable} disabled={isPending} loading={isPending} className="flex-1">
              Enable
            </Button>
          )}
        </div>
      }
      contentClassName="flex flex-col gap-6"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-h3 text-ods-text-primary">{details?.displayName}</span>
        <Tag
          label={details?.isEnabled ? 'ACTIVE' : 'INACTIVE'}
          variant={details?.isEnabled ? 'success' : 'grey'}
          className="shrink-0"
        />
      </div>

      <div className="bg-ods-card border border-ods-border rounded-lg p-4 flex flex-col gap-3">
        <DetailRow label="OAuth Provider" value={<span className="truncate">{details?.displayName}</span>} />
        <DetailRow label="OAuth Client ID" value={<span className="truncate">{details?.clientId || 'none'}</span>} />
        <DetailRow
          label="Client Secret"
          value={
            details?.clientSecret ? (
              <>
                <span className="truncate">{showSecret ? details.clientSecret : '••••'}</span>
                <button
                  type="button"
                  aria-label={showSecret ? 'Hide client secret' : 'Show client secret'}
                  onClick={() => setShowSecret(prev => !prev)}
                  className="shrink-0 flex items-center text-ods-text-secondary"
                >
                  {showSecret ? (
                    <EyeOffIcon className="h-4 w-4 md:h-6 md:w-6" />
                  ) : (
                    <EyeIcon className="h-4 w-4 md:h-6 md:w-6" />
                  )}
                </button>
              </>
            ) : (
              'none'
            )
          }
        />
        <DetailRow
          label="Allowed Domains"
          value={
            <span className="truncate">
              {details?.allowedDomains?.length ? details.allowedDomains.join(', ') : 'none'}
            </span>
          }
        />
      </div>

      <Button
        variant="outline"
        onClick={onDeleteRequest}
        disabled={isPending}
        leftIcon={<TrashIcon className="h-6 w-6" />}
        className="w-full border-ods-error text-ods-error"
      >
        Delete Configuration
      </Button>
    </SimpleModal>
  );
}
