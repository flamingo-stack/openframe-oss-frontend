import { Chevron02RightIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';

/**
 * The header action of an overview section: "> {list}" on the right of its title, opening
 * the list the section counts. With an icon, a single header action collapses to its icon
 * below `content-md`.
 */
export function sectionListAction(label: string, href: string): PageActionButton[] {
  return [
    {
      label,
      ariaLabel: `Open ${label}`,
      href,
      variant: 'outline',
      icon: <Chevron02RightIcon className="h-5 w-5 text-ods-text-secondary" />,
    },
  ];
}
