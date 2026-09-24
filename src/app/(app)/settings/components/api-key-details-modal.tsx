'use client';

import { Button, Input, Label, ModalV2Title, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { formatDateTime } from '@/lib/format-date';
import { formatCount } from '@/lib/format-number';
import type { ApiKeyRecord } from '../hooks/use-api-keys';

interface ApiKeyDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: ApiKeyRecord | null;
}

export function ApiKeyDetailsModal({ isOpen, onClose, apiKey }: ApiKeyDetailsModalProps) {
  if (!apiKey) return null;

  return (
    <SimpleModal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-2xl"
      header={
        <>
          <ModalV2Title>API Key Details</ModalV2Title>
          <p className="mt-1 text-ods-text-secondary text-h6">View API key information and usage statistics</p>
        </>
      }
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {/* Name and Status */}
      <div className="flex items-center justify-between border-b border-ods-border pb-2">
        <div>
          <div className="font-semibold text-ods-text-primary text-h3">{apiKey.name}</div>
          <div className="mt-1 text-ods-text-secondary text-h6">{apiKey.description || EMPTY_VALUE}</div>
        </div>
        <Tag label={apiKey.enabled ? 'ACTIVE' : 'INACTIVE'} variant={apiKey.enabled ? 'success' : 'grey'} />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Key ID</Label>
          <Input value={apiKey.id} disabled className="bg-ods-card" />
        </div>

        <div className="space-y-2">
          <Label>Created</Label>
          <Input value={formatDateTime(apiKey.createdAt)} disabled className="bg-ods-card" />
        </div>

        <div className="space-y-2">
          <Label>Expires</Label>
          <Input value={formatDateTime(apiKey.expiresAt)} disabled className="bg-ods-card" />
        </div>

        <div className="space-y-2">
          <Label>Total Requests</Label>
          <Input value={formatCount(apiKey.totalRequests)} disabled className="bg-ods-card" />
        </div>

        <div className="space-y-2">
          <Label>Successful Requests</Label>
          <Input value={formatCount(apiKey.successfulRequests)} disabled className="bg-ods-card" />
        </div>

        <div className="space-y-2">
          <Label>Failed Requests</Label>
          <Input value={formatCount(apiKey.failedRequests)} disabled className="bg-ods-card" />
        </div>

        <div className="col-span-2 space-y-2">
          <Label>Last Used</Label>
          <Input value={formatDateTime(apiKey.lastUsed)} disabled className="bg-ods-card" />
        </div>
      </div>
    </SimpleModal>
  );
}
