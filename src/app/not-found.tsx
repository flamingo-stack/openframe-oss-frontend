'use client';

import { ContentPageContainer } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Pre-static-export path-param routes (PR #2061 moved them to `?id=` query
 * params). Bookmarks, browser history, and links shared before the migration
 * still use the old shape and land here — remap them instead of dead-ending.
 * Only consulted for paths the router already failed to match, so an entry can
 * never shadow a real route. `{id}` marks where the path-param id lived.
 */
const LEGACY_ID_ROUTES = [
  '/customers/details/{id}',
  '/customers/edit/{id}',
  '/devices/details/{id}',
  '/devices/details/{id}/file-manager',
  '/devices/details/{id}/remote-desktop',
  '/devices/details/{id}/remote-shell',
  '/knowledge-base/details/{id}',
  '/knowledge-base/edit/{id}',
  '/knowledge-base/folders/{id}',
  '/monitoring/policy/{id}',
  '/monitoring/policy/edit/{id}',
  '/monitoring/query/{id}',
  '/monitoring/query/edit/{id}',
  '/scripts/details/{id}',
  '/scripts/details/{id}/run',
  '/scripts/edit/{id}',
  '/scripts/executions/{id}',
  '/scripts/schedules/{id}',
  '/scripts/schedules/{id}/edit',
  '/scripts/schedules/{id}/devices',
  '/settings/employees/details/{id}',
];

/**
 * Routes that moved or were removed outright. The `/edit/new` entries
 * catch pre-migration path-param create links directly — without them those
 * would match the `{id}` patterns below with id='new' and depend on the edit
 * pages' `?id=new` compat redirect, adding a hop and coupling this table to
 * that sentinel.
 */
const LEGACY_RENAMED_ROUTES: Record<string, string> = {
  // Second step of the old two-step signup. Signup is one screen now and the route is gone; a
  // direct visit already bounced to /auth back when it existed, since it needed org details a
  // previous screen had put in sessionStorage.
  '/auth/signup': '/auth',
  '/scripts/create': '/scripts/new',
  '/scripts/schedules/create': '/scripts/schedules/new',
  '/customers/edit/new': '/customers/new',
  '/monitoring/policy/edit/new': '/monitoring/policy/new',
  '/monitoring/query/edit/new': '/monitoring/query/new',
};

/**
 * `/scripts-v2` is where the Scripts module sat while it was behind the
 * `scripts-v2` feature flag. The flag is gone and the module IS `/scripts` now,
 * so everything under the old prefix moves across unchanged.
 */
function dropV2Prefix(path: string): string {
  return path === '/scripts-v2' || path.startsWith('/scripts-v2/') ? path.replace('/scripts-v2', '/scripts') : path;
}

/**
 * Corrections for the two patterns the rename made ambiguous.
 *
 * `target` — `/scripts/schedules` used to BE the schedule detail page; it is the
 * LIST now, so the derived target would drop the reader on a list instead of the
 * record they linked to.
 *
 * `reserved` — a `{id}` pattern matches by SEGMENT COUNT, so once `dropV2Prefix`
 * strips the prefix, `/scripts-v2/schedules/edit?id=abc` normalizes onto
 * `/scripts/schedules/{id}` and reads "edit" as the id, losing the record. These
 * segments are sub-routes, never ids.
 */
const LEGACY_ID_OVERRIDES: Record<string, { target?: string; reserved?: readonly string[] }> = {
  '/scripts/details/{id}': { reserved: ['run'] },
  '/scripts/schedules/{id}': {
    target: '/scripts/schedules/details',
    reserved: ['archived', 'details', 'devices', 'edit', 'new', 'run'],
  },
};

function remapLegacyPath(pathname: string, search: string): string | null {
  const strippedPath = pathname.replace(/\/+$/, '');
  // Before the tables, so a pre-rename path-param link (`/scripts-v2/details/abc`)
  // reaches `/scripts/details/?id=abc` in ONE redirect instead of bouncing through
  // an intermediate `/scripts-v2` -> `/scripts` hop.
  const normalizedPath = dropV2Prefix(strippedPath);

  const renamed = LEGACY_RENAMED_ROUTES[normalizedPath];
  if (renamed) return `${renamed}/${search}`;

  const pathSegments = normalizedPath.split('/');
  for (const pattern of LEGACY_ID_ROUTES) {
    const patternSegments = pattern.split('/');
    if (patternSegments.length !== pathSegments.length) continue;
    let id: string | null = null;
    const targetSegments: string[] = [];
    let matches = true;
    for (let i = 0; i < patternSegments.length; i++) {
      if (patternSegments[i] === '{id}') {
        // pathname segments arrive percent-encoded; URLSearchParams re-encodes
        // on set, so decode first or the id round-trips double-encoded.
        try {
          id = decodeURIComponent(pathSegments[i]);
        } catch {
          id = pathSegments[i];
        }
      } else if (patternSegments[i] === pathSegments[i]) {
        targetSegments.push(pathSegments[i]);
      } else {
        matches = false;
        break;
      }
    }
    if (!matches || !id) continue;
    const override = LEGACY_ID_OVERRIDES[pattern];
    if (override?.reserved?.includes(id)) continue;
    const params = new URLSearchParams(search);
    params.set('id', id);
    return `${override?.target ?? targetSegments.join('/')}/?${params.toString()}`;
  }

  // No id pattern matched, but the path itself moved — send it to its new home.
  return normalizedPath === strippedPath ? null : `${normalizedPath}/${search}`;
}

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    const target = remapLegacyPath(window.location.pathname, window.location.search);
    if (target) router.replace(target + window.location.hash);
  }, [router]);

  return (
    <ContentPageContainer title="Page Not Found" subtitle="The page you're looking for doesn't exist.">
      <div />
    </ContentPageContainer>
  );
}
