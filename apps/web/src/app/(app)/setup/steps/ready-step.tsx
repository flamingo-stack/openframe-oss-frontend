'use client';

import { AgentMark } from '@flamingo-stack/openframe-frontend-core/components';
import { ChatFaceIcon, CheckCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { SetupHeading } from '../components/setup-heading';
import { type FirstDevice, useFirstDeviceEnrollment } from '../hooks/use-first-device-enrollment';

const ASSISTANT_POINTS = [
  'Troubleshoots and fixes issues on the device',
  'Every conversation becomes a ticket you can track',
  'Lets users request a technician anytime',
];

/**
 * "You are ready to go": the first device is enrolled and its AI assistant is
 * live. The one action hands the admin over to Mingo.
 *
 * The device is the one the deploy screen watched come up; when that screen was
 * walked over (the device was enrolled on an earlier visit), the name is read
 * once from the same query instead.
 */
export function ReadyStep({
  device,
  onStart,
  starting,
}: {
  device: FirstDevice | null;
  onStart: () => void;
  starting: boolean;
}) {
  const known = useFirstDeviceEnrollment(false);
  const first = device ?? known;
  const deviceName = first?.name ?? 'your device';
  const online = first?.online ?? false;

  return (
    <>
      <SetupHeading
        title="You are ready to go"
        subtitle="Your device is connected and our AI assistant is live on it. Try chatting with it the way your users would. Your conversation will create a real ticket in OpenFrame."
      />
      <div className="flex w-full max-w-[600px] flex-col rounded-md border border-ods-border bg-ods-card">
        <div className="flex items-center gap-[var(--spacing-system-s)] border-b border-ods-border p-[var(--spacing-system-m)]">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ods-flamingo-pink text-ods-text-on-accent">
            <ChatFaceIcon className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate text-ods-text-primary text-h4">AI assistant running on {deviceName}</p>
            <p className="text-ods-text-secondary text-h6">Try chat with it to create first ticket</p>
          </div>
          <Tag label={online ? 'LIVE' : 'OFFLINE'} variant={online ? 'success' : 'grey'} />
        </div>
        <ul className="flex flex-col gap-[var(--spacing-system-xs)] p-[var(--spacing-system-m)]">
          {ASSISTANT_POINTS.map(point => (
            <li key={point} className="flex items-center gap-[var(--spacing-system-xs)] text-ods-text-primary text-h4">
              <CheckCircleIcon className="size-5 shrink-0 text-ods-flamingo-pink" />
              {point}
            </li>
          ))}
        </ul>
      </div>
      <Button
        variant="outline"
        leftIcon={<AgentMark agent="mingo" className="size-5 text-ods-flamingo-cyan" color="currentColor" />}
        onClick={onStart}
        loading={starting}
        disabled={starting}
        className="w-full sm:w-auto sm:min-w-[204px]"
      >
        Start with Mingo
      </Button>
    </>
  );
}
