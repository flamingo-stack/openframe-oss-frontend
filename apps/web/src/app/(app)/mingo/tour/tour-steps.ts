import {
  AlertCircleIcon,
  AlertOctagonIcon,
  AlertTriangleIcon,
  BookBookmarkIcon,
  BracketCurlyIcon,
  CalendarIcon,
  ClipboardListIcon,
  FolderPlusIcon,
  HardDriveIcon,
  MonitorIcon,
  PackageIcon,
  RadarIcon,
  RouteIcon,
  SearchIcon,
  ShieldLockIcon,
  TagIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ComponentType } from 'react';
import { UserOnboardingStep } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { CONTEXT_ENTITY_MARKER } from '../context/context-types';

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
  /**
   * What the chip sends to Mingo in the tour's conversation. A prompt about the
   * workspace's first device is a function of how that device is named in the
   * message: its `@device:<id>` mention when the device is known, else "my
   * device" (`tourPrompt`). Mingo does not resolve "my device" on its own.
   */
  prompt: string | ((device: string) => string);
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
  /** The step as the backend records it. */
  userStep: UserOnboardingStep;
  actions: TourAction[];
  /**
   * The step also offers "Open Fae": the client side of tickets, Fae, opened on
   * this machine (where the agent was just deployed) to send it a request.
   */
  opensFae?: boolean;
}

/** What the tour's chips depend on besides the design. */
export interface TourStepOptions {
  /**
   * The Software module (flag `software-management`): with it the second
   * Devices chip reads the installed software and its vulnerabilities;
   * without it the chip asks about disk space instead.
   */
  softwareManagement: boolean;
}

/**
 * The Getting Started tour: one step per section of the product, each with the
 * "try asking" chips. Titles, subtitles and descriptions are the design's; the
 * chip labels and the prompts they send are the product's (every prompt maps
 * to a tool Mingo has and answers on a workspace with one device and nothing
 * else yet).
 */
export function tourSteps({ softwareManagement }: TourStepOptions): readonly TourStep[] {
  return [
    {
      id: 'devices',
      title: 'Devices',
      subtitle: 'Machines running the agent',
      description:
        'Every machine running the OpenFrame agent. I read its hardware, software and health, and run commands on it once you approve.',
      Icon: MonitorIcon,
      userStep: UserOnboardingStep.DEVICES,
      actions: [
        {
          id: 'check-device',
          label: 'Check my device',
          prompt: device =>
            `Check ${device}: OS, uptime, CPU, memory and free disk. Tell me if anything needs attention.`,
          href: routes.devices.list,
          Icon: MonitorIcon,
        },
        softwareManagement
          ? {
              id: 'installed-software',
              label: "What's installed",
              prompt: device =>
                `List the software installed on ${device} and flag anything with known vulnerabilities.`,
              href: routes.devices.list,
              Icon: PackageIcon,
            }
          : {
              id: 'low-disk',
              label: 'Devices low on disk space',
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
        'Requests from your clients via their AI assistant. AI solves what it can and moves the rest to Tech required.',
      Icon: TagIcon,
      userStep: UserOnboardingStep.TICKETS,
      opensFae: true,
      actions: [
        {
          id: 'create-ticket',
          label: 'Create a ticket',
          prompt: device => `Create a ticket "Post-install check" for ${device} and assign it to me.`,
          href: routes.tickets.list,
          Icon: TagIcon,
        },
        {
          id: 'ticket-flow',
          label: 'How tickets flow',
          prompt:
            'Which ticket statuses does my workspace have, and which ones does the AI handle before a tech steps in?',
          href: routes.tickets.list,
          Icon: RouteIcon,
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
          id: 'flush-dns',
          label: 'Flush DNS cache',
          prompt: device =>
            `Write a script that flushes the DNS cache on ${device}, test it there and save it to the library.`,
          href: routes.scripts.list,
          Icon: BracketCurlyIcon,
        },
        {
          id: 'weekly-cleanup',
          label: 'Schedule a weekly cleanup',
          prompt: device =>
            `Save a temp-files cleanup script and schedule it to run on ${device} every Sunday at 3 AM in my timezone.`,
          href: routes.scripts.list,
          Icon: CalendarIcon,
        },
      ],
    },
    {
      id: 'monitoring',
      title: 'Monitoring',
      subtitle: 'Checks and alerts',
      description:
        'Checks that watch disk, CPU, services and uptime on every device. When one fails, I show it and start looking for the cause.',
      Icon: RadarIcon,
      userStep: UserOnboardingStep.MONITORING,
      actions: [
        {
          id: 'disk-encryption',
          label: 'Check disk encryption',
          prompt: device => `Create a policy that checks disk encryption is on and tell me whether ${device} passes.`,
          href: routes.monitoring.root({ tab: 'policies' }),
          Icon: ShieldLockIcon,
        },
        {
          id: 'free-disk-space',
          label: 'Watch free disk space',
          prompt: device => `Set up a scheduled query that records free disk space on ${device} every hour.`,
          href: routes.monitoring.root({ tab: 'queries' }),
          Icon: HardDriveIcon,
        },
      ],
    },
    {
      id: 'logs',
      title: 'Logs',
      subtitle: 'Device and platform activity',
      description:
        "What the agent logged on your devices: errors, warnings and events. Ask what happened and when, and I'll find it.",
      Icon: ClipboardListIcon,
      userStep: UserOnboardingStep.LOGGING,
      actions: [
        {
          id: 'errors-since-install',
          label: 'Errors since install',
          prompt: device => `Show any errors or warnings the agent logged on ${device} since it was installed.`,
          href: routes.logs.page,
          Icon: AlertCircleIcon,
        },
        {
          id: 'search-logs',
          label: 'Search the logs',
          prompt: device => `Search the logs of ${device} for "failed" in the last 24 hours and group what you find.`,
          href: routes.logs.page,
          Icon: SearchIcon,
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
      userStep: UserOnboardingStep.INCIDENTS,
      actions: [
        {
          id: 'incidents-on-device',
          label: 'Incidents on my device',
          prompt: device => `Are there open incidents on ${device}? Show severity and what you saw.`,
          href: routes.incidents.list,
          Icon: AlertTriangleIcon,
        },
        {
          id: 'critical-first',
          label: 'Critical first',
          prompt: 'Show all open incidents, critical and high first, and who owns them.',
          href: routes.incidents.list,
          Icon: AlertOctagonIcon,
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
          prompt:
            'Write a knowledge-base article on installing the OpenFrame agent on a new device, based on what I just did.',
          href: routes.knowledgeBase.list,
          Icon: BookBookmarkIcon,
        },
        {
          id: 'kb-folders',
          label: 'Set up KB folders',
          prompt: 'Create knowledge-base folders for my first client: Onboarding, Troubleshooting, Policies.',
          href: routes.knowledgeBase.list,
          Icon: FolderPlusIcon,
        },
      ],
    },
  ];
}

/** The tour with every module on - what the tests and a Software-enabled workspace see. */
export const TOUR_STEPS: readonly TourStep[] = tourSteps({ softwareManagement: true });

/** How a tour prompt names the device while the workspace has none to point at. */
export const TOUR_DEVICE_FALLBACK = 'my device';

/**
 * The text a chip sends: a prompt about the first device names it by its
 * `@device:<id>` mention (the token the composer's own @-mention commits, so
 * Mingo targets that exact machine), or by "my device" without one.
 */
export function tourPrompt(action: TourAction, device: { mentionId: string | null } | null): string {
  if (typeof action.prompt === 'string') return action.prompt;
  const id = device?.mentionId;
  return action.prompt(id ? `@${CONTEXT_ENTITY_MARKER.DEVICE}:${id}` : TOUR_DEVICE_FALLBACK);
}
