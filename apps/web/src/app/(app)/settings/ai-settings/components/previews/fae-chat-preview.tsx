'use client';

import {
  ChatInput,
  ChatListItem,
  ChatMessageList,
  ChatNavSidebar,
  type ChatNavSidebarItem,
  ChatTopNavigation,
  MspOrganizationCard,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import {
  ChatPlusIcon,
  ChatQuestionIcon,
  CheckCircleIcon,
  ClockHistoryIcon,
  HourglassClockIcon,
  MessageIndicatorIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useContentMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMemo, useState } from 'react';
import { getFullImageUrl } from '@/lib/image-url';
import { useTenantInfo } from '../../../hooks/use-tenant-info';
import { buildFaeChatPreviewMessages } from './fae-chat-preview-messages';
import { OpenFrameMark } from './openframe-mark';
import { previewAccentStyle } from './preview-accent';
import { ScaledPreviewFrame } from './scaled-preview-frame';

interface FaeChatPreviewProps {
  assistantName: string;
  avatarUrl?: string;
  accentColor: string;
  mspName?: string;
  /** `thumbnail` scales the 1024×800 window into the card; `full` renders it 1:1. See `AiSettingsPreviews`. */
  variant?: 'thumbnail' | 'full';
}

interface SampleChat {
  id: string;
  title: string;
  ticketNumber: number;
  status?: 'tech-required' | 'needs-action' | 'resolved';
}

// The open chat comes first; the others show the sidebar's status glyphs.
const SAMPLE_CHATS: SampleChat[] = [
  { id: 'slow-laptop', title: 'Slow Laptop', ticketNumber: 1932, status: 'tech-required' },
  { id: 'password', title: 'Forgot my password', ticketNumber: 1928 },
  { id: 'teams-mic', title: 'Teams mic not working', ticketNumber: 1925, status: 'needs-action' },
  { id: 'email-sync', title: 'Email not syncing on phone', ticketNumber: 1921 },
  { id: 'blue-screen', title: 'Blue screen on startup', ticketNumber: 1917, status: 'resolved' },
];

// Faces in the hand-off bar: the chat shows the workspace's technicians.
const SAMPLE_SUPPORT_TEAM = [{ name: 'Alex Morgan' }, { name: 'Sam Lee' }, { name: 'Jordan Reed' }];

const noop = () => undefined;

function trailingMark(status: SampleChat['status']) {
  if (status === 'tech-required') {
    return <HourglassClockIcon aria-label="Waiting for a technician" className="text-ods-accent" />;
  }
  if (status === 'needs-action') {
    return <MessageIndicatorIcon aria-label="Needs your action" className="text-ods-accent" />;
  }
  return undefined;
}

/**
 * The Fae window mid-conversation (openframe-chat `ChatViewV2`): the chat
 * sidebar, the top bar with the assistant's identity, and a thread that has
 * just been handed off to a technician. Static sample content; the assistant's
 * name, avatar and accent are the ones being configured.
 */
export function FaeChatPreview({
  assistantName,
  avatarUrl,
  accentColor,
  mspName = 'TechFlow Solutions',
  variant = 'thumbnail',
}: FaeChatPreviewProps) {
  const messages = useMemo(() => buildFaeChatPreviewMessages(assistantName, avatarUrl), [assistantName, avatarUrl]);

  // The sidebar footer names the MSP from the same tenant-info query the
  // /settings card uses (react-query-cached, so no extra request), with a sample
  // organization while none is configured.
  const { data: tenantInfo } = useTenantInfo();
  const orgName = tenantInfo?.name || mspName;
  const orgLogoUrl = tenantInfo?.name
    ? getFullImageUrl(tenantInfo.image?.imageUrl, tenantInfo.image?.hash)
    : '/assets/ai-settings/chat-preview-logo.svg';

  const isThumbnail = variant === 'thumbnail';

  // The Fae window hides its sidebar at 800px and below and lets the toggle
  // bring it back, keeping the wide-window choice apart. The full preview
  // follows the window the same way; the thumbnail is the 1024px window.
  const isWide = useContentMdUp();
  const [sidebarOpenWide, setSidebarOpenWide] = useState(true);
  const [sidebarOpenNarrow, setSidebarOpenNarrow] = useState(false);
  const isSidebarOpen = isThumbnail || (isWide ? sidebarOpenWide : sidebarOpenNarrow);
  const toggleSidebar = () => (isWide ? setSidebarOpenWide(open => !open) : setSidebarOpenNarrow(open => !open));

  const navItems: ChatNavSidebarItem[] = [
    { id: 'new-chat', label: 'Start New Chat', icon: <ChatPlusIcon /> },
    { id: 'archive', label: 'Chat Archive', icon: <ClockHistoryIcon /> },
    { id: 'guide', label: `What to ask ${assistantName}?`, icon: <ChatQuestionIcon /> },
  ];

  const screen = (
    <div
      data-surface="brand-tinted"
      style={previewAccentStyle(accentColor)}
      className="flex h-full w-full min-w-0 bg-ods-bg text-ods-text-primary"
    >
      {isSidebarOpen && (
        <ChatNavSidebar
          logo={<OpenFrameMark />}
          items={navItems}
          sectionLabel="Your Current Chats"
          footer={<MspOrganizationCard variant="footer" name={orgName} logoUrl={orgLogoUrl} onOpenWebsite={noop} />}
        >
          {SAMPLE_CHATS.map((chat, i) => {
            const isActive = i === 0;
            return (
              <ChatListItem
                key={chat.id}
                title={chat.title}
                subtitle={`Ticket Number: ${chat.ticketNumber}`}
                leading={
                  chat.status === 'resolved' ? (
                    <CheckCircleIcon aria-label="Resolved" className="text-ods-success" />
                  ) : undefined
                }
                trailing={trailingMark(chat.status)}
                active={isActive}
              />
            );
          })}
        </ChatNavSidebar>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <ChatTopNavigation
          name={assistantName}
          subtitle="Your AI Assistant"
          avatarUrl={avatarUrl}
          onToggleSidebar={toggleSidebar}
          sidebarOpen={isSidebarOpen}
          onOpenSettings={noop}
          actions={
            <Button variant="outline" size="small" disabled>
              Technician Requested
            </Button>
          }
        />

        <main className="ods-glow-accent-corner flex min-h-0 flex-1 flex-col gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] pb-[var(--spacing-system-m)] pt-[var(--spacing-system-mf)]">
          <ChatMessageList
            messages={messages}
            assistantType="fae"
            approvalVariant="client"
            appearance="v2"
            autoScroll
          />

          <div className="shrink-0">
            <p className="mb-[var(--spacing-system-xsf)] text-center text-ods-text-secondary text-h6">
              If you need help with something else, feel free to start a{' '}
              <span className="text-ods-accent underline">New Chat</span>.
            </p>
            <ChatInput
              fullWidth
              appearance="v2"
              onSend={noop}
              awaitingResponse
              awaitingTeam={SAMPLE_SUPPORT_TEAM}
              placeholder="Enter your request here..."
            />
          </div>
        </main>
      </div>
    </div>
  );

  if (!isThumbnail) return screen;

  return <ScaledPreviewFrame>{screen}</ScaledPreviewFrame>;
}
