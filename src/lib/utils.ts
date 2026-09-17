import { getDeploymentUrl } from '@flamingo-stack/openframe-frontend-core/platform-domains';
import { runtimeEnv } from './runtime-config';

/**
 * Where this OpenFrame app is reachable, no trailing slash.
 *
 * The rule lives once in openframe-frontend-core (`getDeploymentUrl`), shared with every
 * other app: the page's origin in the browser; this install's runtime `NEXT_PUBLIC_APP_URL`
 * (a self-hosted install's own address); a Vercel preview's own URL; the OpenFrame
 * dashboard's registry URL in production; localhost in development. This app only
 * supplies its platform and its configured URL.
 */
export function getAppUrl(): string {
  return getDeploymentUrl({ platform: 'openframe-dashboard', configuredUrl: runtimeEnv.appUrl() });
}
