import {
  Parcel02Icon,
  Refresh02HrIcon,
  ShieldCheckIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { routes } from '@/lib/routes';

/**
 * The three Software pages the section switcher moves between. The label is
 * both the switcher's tab and the page's own title.
 */
export const SOFTWARE_SECTIONS = {
  all: { label: 'All Software', href: routes.software.list, icon: Parcel02Icon },
  actions: { label: 'Software Actions', href: routes.software.actions, icon: Refresh02HrIcon },
  vulnerabilities: { label: 'Vulnerabilities', href: routes.software.vulnerabilities, icon: ShieldCheckIcon },
};

export type SoftwareSectionId = keyof typeof SOFTWARE_SECTIONS;
