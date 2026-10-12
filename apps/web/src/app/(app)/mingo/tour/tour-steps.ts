import {
  AlertTriangleIcon,
  BookBookmarkIcon,
  BracketCurlyIcon,
  ClipboardListIcon,
  HardDriveIcon,
  MonitorIcon,
  RadarIcon,
  TagIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ComponentType } from 'react';
import { UserOnboardingStep } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';

/** The conversation the tour lives in, as the chat list names it. */
export const TOUR_DIALOG_TITLE = 'Welcome to OpenFrame';

/** Mingo's first message in that conversation. Local - the server never sees it. */
export function tourGreeting(firstName: string | undefined): string {
  const hello = firstName ? `Hi ${firstName}, I'm Mingo.` : "Hi, I'm Mingo.";
  return `${hello} You tell me the outcome you want, I do the work, and you approve anything that touches a device.\n\nHere is what I work with. Pick a step to see how to work with it.`;
}

export type TourStepId = 'devices' | 'tickets' | 'scripting' | 'monitoring' | 'logs' | 'incidents' | 'knowledge';

type IconComponent = ComponentType<{ size?: number; className?: string }>;

export interface TourAction {
  id: string;
  /** The chip, as the design spells it. */
  label: string;
  /** What the chip sends to Mingo in the tour's conversation. */
  prompt: string;
  /** The section the chip opens beside the chat. */
  href: string;
  Icon: IconComponent;
}

export interface TourStep {
  id: TourStepId;
  title: string;
  subtitle: string;
  description: string;
  Icon: IconComponent;
  /** The step as the backend records it; null until `UserOnboardingStep` learns it. */
  userStep: UserOnboardingStep | null;
  actions: TourAction[];
}

/**
 * The Getting Started tour: one step per section of the product, each with the
 * "try asking" chips the design shows. Copy from the design; the prompts are
 * what a chip sends and are this file's to tune.
 */
export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'devices',
    title: 'Devices',
    subtitle: 'Machines running the agent',
    description:
      'Every machine running the OpenFrame agent. I read its hardware, software and health, and run commands on it once you approve.',
    Icon: MonitorIcon,
    userStep: null,
    actions: [
      {
        id: 'check-device',
        label: 'Check device',
        prompt: 'Check my devices: which ones need attention right now?',
        href: routes.devices.list,
        Icon: MonitorIcon,
      },
      {
        id: 'low-disk',
        label: 'Devices with low on disk space',
        prompt: 'Which devices are running low on disk space?',
        href: routes.devices.list,
        Icon: HardDriveIcon,
      },
    ],
  },
  {
    id: 'tickets',
    title: 'Tickets',
    subtitle: 'Tickets and time logs',
    description:
      'Requests from your clients via their AI assistant. AI solve what it can and move the rest to Tech required.',
    Icon: TagIcon,
    userStep: UserOnboardingStep.TICKETS,
    actions: [
      {
        id: 'create-ticket',
        label: 'Create a ticket',
        prompt: 'Create a ticket for me. Ask me for anything you need to know.',
        href: routes.tickets.list,
        Icon: TagIcon,
      },
    ],
  },
  {
    id: 'scripting',
    title: 'Scripting',
    subtitle: 'Scripts and schedules',
    description:
      'Reusable Bash, PowerShell and Python you run on one device or a whole client. I can write a new one, test it on one machine, then roll it out.',
    Icon: BracketCurlyIcon,
    userStep: UserOnboardingStep.SCRIPTING,
    actions: [
      {
        id: 'dns-cache-script',
        label: 'Script to clean the DNS cache',
        prompt: 'Write a script that cleans the DNS cache and show me how to test it on one device.',
        href: routes.scripts.list,
        Icon: BracketCurlyIcon,
      },
      {
        id: 'disk-usage-report',
        label: 'Run the disk usage report',
        prompt: 'Run a disk usage report across my devices.',
        href: routes.scripts.list,
        Icon: BracketCurlyIcon,
      },
    ],
  },
  {
    id: 'monitoring',
    title: 'Monitoring',
    subtitle: 'Checks and alerts',
    description:
      'Checks that watch disk, CPU, services and uptime on every device. When one fails, I alert you and start looking for the cause.',
    Icon: RadarIcon,
    userStep: UserOnboardingStep.MONITORING,
    actions: [
      {
        id: 'failing-policies',
        label: 'Show failing policies',
        prompt: 'Show me the monitoring policies that are failing right now.',
        href: routes.monitoring.root({ tab: 'policies' }),
        Icon: RadarIcon,
      },
      {
        id: 'monitor-service',
        label: 'Monitor a service',
        prompt: 'Help me set up a check that monitors a service on my devices.',
        href: routes.monitoring.root({ tab: 'policies' }),
        Icon: RadarIcon,
      },
    ],
  },
  {
    id: 'logs',
    title: 'Logs',
    subtitle: 'Device and platform activity',
    description:
      "Everything that happened on your devices and in OpenFrame, from script runs to logins. Ask what changed and when, and I'll find it.",
    Icon: ClipboardListIcon,
    userStep: UserOnboardingStep.LOGGING,
    actions: [
      {
        id: 'changed-today',
        label: 'What changed today',
        prompt: 'What changed on my devices today?',
        href: routes.logs.page,
        Icon: ClipboardListIcon,
      },
      {
        id: 'failed-script-runs',
        label: 'Failed script runs',
        prompt: 'Show me the script runs that failed recently.',
        href: routes.logs.page,
        Icon: ClipboardListIcon,
      },
    ],
  },
  {
    id: 'incidents',
    title: 'Incidents',
    subtitle: 'IT and Security findings',
    description:
      'Problems I detect on your devices, like repeated failed logins or a disk that is filling fast. Each one opens with what I saw, why it matters and a fix you can approve.',
    Icon: AlertTriangleIcon,
    userStep: null,
    actions: [
      {
        id: 'incidents-on-device',
        label: 'Incidents on device',
        prompt: 'Show me the incidents on my devices.',
        href: routes.incidents.list,
        Icon: AlertTriangleIcon,
      },
      {
        id: 'all-incidents',
        label: 'Check all incidents',
        prompt: 'Check all open incidents and tell me which to handle first.',
        href: routes.incidents.list,
        Icon: AlertTriangleIcon,
      },
    ],
  },
  {
    id: 'knowledge',
    title: 'Knowledge Management',
    subtitle: 'Articles for AI and team',
    description:
      'Articles that Fae and I use to answer clients and solve tickets. I can draft one from a resolved ticket for you to review.',
    Icon: BookBookmarkIcon,
    userStep: UserOnboardingStep.KNOWLEDGE_MANAGEMENT,
    actions: [
      {
        id: 'write-article',
        label: 'Write an article',
        prompt: 'Help me write a knowledge base article.',
        href: routes.knowledgeBase.list,
        Icon: BookBookmarkIcon,
      },
      {
        id: 'article-from-ticket',
        label: 'Article from a ticket',
        prompt: 'Draft a knowledge base article from one of my resolved tickets.',
        href: routes.knowledgeBase.list,
        Icon: BookBookmarkIcon,
      },
    ],
  },
];
