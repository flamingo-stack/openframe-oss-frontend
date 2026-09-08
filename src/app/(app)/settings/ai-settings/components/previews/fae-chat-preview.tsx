'use client';

import {
  ChatContent,
  ChatFooter,
  ChatHeader,
  ChatMessageList,
  ChatTypingIndicator,
  ModelDisplay,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { type CSSProperties, useMemo } from 'react';
import { useTenantInfo } from '../../../hooks/use-tenant-info';
import { buildFaeChatPreviewMessages } from './fae-chat-preview-messages';

interface FaeChatPreviewProps {
  assistantName: string;
  avatarUrl?: string;
  accentColor: string;
  mspName?: string;
  providerName?: string;
  modelDisplayName?: string;
  /** `thumbnail` scales the 650px source layout into a fixed-height card; `full` renders it 1:1. See `AiSettingsPreviews`. */
  variant?: 'thumbnail' | 'full';
}

export function FaeChatPreview({
  assistantName,
  avatarUrl,
  accentColor,
  mspName = 'TechFlow Solutions',
  providerName = 'google',
  modelDisplayName = 'Google Gemini 3.5',
  variant = 'thumbnail',
}: FaeChatPreviewProps) {
  const messages = useMemo(() => buildFaeChatPreviewMessages(assistantName, avatarUrl), [assistantName, avatarUrl]);

  // Header shows the MSP company name (from tenant info) in place of the tenant
  // domain; falls back to the sample name so the preview still reads well.
  const { data: tenantInfo } = useTenantInfo();
  const mspCompanyName = tenantInfo?.name || mspName;

  const isThumbnail = variant === 'thumbnail';

  const body = (
    <div
      style={
        {
          // accent re-points flamingo-pink so the lib's Fae name follows it.
          '--ods-flamingo-pink-base': accentColor,
          ...(isThumbnail && { transform: 'scale(var(--preview-scale))' }),
        } as CSSProperties
      }
      className={cn(
        'fae-chat-preview flex flex-col p-[var(--spacing-system-m)]',
        isThumbnail ? 'h-[1112px] w-[650px] max-w-none origin-top-left' : 'h-full w-full',
      )}
    >
      {/* `fullWidth` drops the lib's `max-w-ods-content-narrow` column. The real
          chat keeps it (600px, centered — see openframe-chat `ChatView`), so
          only the thumbnail opts out: its source box is a fixed 650px. */}
      <ChatHeader
        fullWidth={isThumbnail}
        userName={assistantName}
        userAvatar={avatarUrl}
        serverUrl={mspCompanyName}
        connectionStatus="connected"
        ticketInfo={{
          title: 'Slow Laptop',
          meta: '1002 • Hardware Issue • 8 hours',
          status: 'TECH_REQUIRED',
        }}
      />

      <ChatContent className="mt-[var(--spacing-system-s)]">
        <ChatMessageList fullWidth={isThumbnail} messages={messages} assistantType="fae" autoScroll={false} />
      </ChatContent>

      <div
        className={cn(
          'mt-[var(--spacing-system-s)] flex shrink-0 items-center justify-center gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-card px-[var(--spacing-system-m)] py-[var(--spacing-system-s)]',
          // Not a lib component, so it needs the content column applied by hand.
          !isThumbnail && 'mx-auto w-full max-w-ods-content-narrow',
        )}
      >
        <ChatTypingIndicator size="sm" dotClassName="bg-ods-text-secondary" />
        <span className="text-ods-text-secondary text-h6">Waiting for Technician Response</span>
      </div>

      <ChatFooter fullWidth={isThumbnail}>
        <ModelDisplay provider={providerName} displayName={modelDisplayName} />
      </ChatFooter>
    </div>
  );

  // `ChatMessageList` owns its own `overflow-y-auto`, so the 1:1 mode just
  // needs a height to flex against — no outer scroller.
  if (!isThumbnail) return body;

  return (
    <div className="grid h-[250px] w-full place-items-center overflow-hidden rounded-md border border-ods-border bg-ods-bg [--preview-scale:0.225] md:h-[296px] md:[--preview-scale:0.266] lg:h-[380px] lg:[--preview-scale:0.342]">
      {/* 1:1 content in a 1112px slot, transform-scaled (not zoom) to the per-breakpoint card
          height. zoom mis-renders text in Safari, so we scale via transform instead; the
          wrapper reserves the post-scale footprint so the card still centers the content. */}
      <div style={{ width: 'calc(650px * var(--preview-scale))', height: 'calc(1112px * var(--preview-scale))' }}>
        {body}
      </div>
    </div>
  );
}
