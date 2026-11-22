import { isSaasTenantMode } from '@/lib/app-mode';
import { pushSignupCompleted } from '@/lib/posthog/posthog-events';
import { runtimeEnv } from '@/lib/runtime-config';
import { getBearerTokenSync } from '@/lib/token-store';

interface SessionOwner {
  id?: string;
  tenantId?: string;
  email?: string;
  roles?: string[];
}

const WORKSPACE_OWNER_ROLE = 'OWNER';
const SIGNUP_COMPLETION_PATH = '/sas/oauth/signup-completion';
const CLAIMED_STATUS = 200;
const NO_PENDING_SIGNUP_STATUS = 204;

const pendingChecks = new Set<string>();
const finishedChecks = new Set<string>();

/** Checks for conversion only after the authenticated /me response resolves. */
export async function completePasswordSignup(user: SessionOwner): Promise<void> {
  const { id, tenantId, email, roles } = user;
  if (!isSaasTenantMode() || !runtimeEnv.gtmContainerId() || !id || !tenantId || !roles?.includes(WORKSPACE_OWNER_ROLE))
    return;

  const key = JSON.stringify([tenantId, id]);
  if (pendingChecks.has(key) || finishedChecks.has(key)) return;

  pendingChecks.add(key);
  try {
    await claimAndPublishSignupCompletion(id, tenantId, email, key);
  } catch {
    // Analytics must never refresh the token, sign the user out or block the dashboard.
  } finally {
    pendingChecks.delete(key);
  }
}

async function claimAndPublishSignupCompletion(
  id: string,
  tenantId: string,
  email: string | undefined,
  key: string,
): Promise<void> {
  const token = getBearerTokenSync();
  const base = runtimeEnv.sharedHostUrl();
  if (!base) return;

  const response = await fetch(new URL(SIGNUP_COMPLETION_PATH, base), {
    method: 'POST',
    credentials: token ? 'omit' : 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ userId: id, tenantId }),
    cache: 'no-store',
    redirect: 'error',
    keepalive: true,
  });

  if (response.status === NO_PENDING_SIGNUP_STATUS) {
    finishedChecks.add(key);
  } else if (response.status === CLAIMED_STATUS && (await response.json())?.claimed === true) {
    finishedChecks.add(key);
    pushSignupCompleted(id, email);
  }
}
