import { fetchQuery, graphql } from 'react-relay';
import type { IEnvironment } from 'relay-runtime';
import type { onboardingProgressRelayQuery as OnboardingProgressRelayQueryType } from '@/__generated__/onboardingProgressRelayQuery.graphql';
import type { TenantOnboardingStep, UserOnboardingStep } from '@/generated/schema-enums';
import {
  type TenantOnboardingProgress,
  type UserOnboardingProgress,
  useOnboardingStore,
} from '@/stores/onboarding-store';

export const onboardingProgressRelayQuery = graphql`
  query onboardingProgressRelayQuery {
    tenantOnboardingProgress {
      completedSteps
      completed
      completedAt
    }
    userOnboardingProgress {
      completedSteps
      completed
      completedAt
      skipped
      skippedAt
    }
  }
`;

type QueryResponse = OnboardingProgressRelayQueryType['response'];

/** Parsed progress pair — the backend's onboarding truth in store-ready shape. */
export interface OnboardingProgress {
  tenant: TenantOnboardingProgress;
  user: UserOnboardingProgress;
}

function parseProgress(data: {
  tenantOnboardingProgress: QueryResponse['tenantOnboardingProgress'];
  userOnboardingProgress: QueryResponse['userOnboardingProgress'];
}): OnboardingProgress {
  return {
    tenant: {
      completedSteps: [...data.tenantOnboardingProgress.completedSteps] as TenantOnboardingStep[],
      completed: data.tenantOnboardingProgress.completed,
      completedAt: data.tenantOnboardingProgress.completedAt ?? null,
    },
    user: {
      completedSteps: [...data.userOnboardingProgress.completedSteps] as UserOnboardingStep[],
      completed: data.userOnboardingProgress.completed,
      completedAt: data.userOnboardingProgress.completedAt ?? null,
      skipped: data.userOnboardingProgress.skipped,
      skippedAt: data.userOnboardingProgress.skippedAt ?? null,
    },
  };
}

/** Write a query/mutation response's progress objects into the onboarding store. */
export function syncOnboardingStore(data: {
  tenantOnboardingProgress: QueryResponse['tenantOnboardingProgress'];
  userOnboardingProgress: QueryResponse['userOnboardingProgress'];
}): OnboardingProgress {
  const progress = parseProgress(data);
  const { setTenant, setUser } = useOnboardingStore.getState();
  setTenant(progress.tenant);
  setUser(progress.user);
  return progress;
}

/**
 * Fetch onboarding progress fresh from the backend (network-only) and return it.
 * The backend is the source of truth: the returned value reflects the tenant/user
 * of the CURRENT session, so callers that switch tenants never act on a stale
 * client snapshot. Also mirrors the result into the Zustand store so the onboarding
 * chrome stays in sync. Resolves `null` on a null payload or a network error.
 */
export async function fetchOnboardingProgress(environment: IEnvironment): Promise<OnboardingProgress | null> {
  try {
    const data = await fetchQuery<OnboardingProgressRelayQueryType>(
      environment,
      onboardingProgressRelayQuery,
      {},
      { fetchPolicy: 'network-only' },
    ).toPromise();
    if (!data) {
      // Mark loaded so the (non-suspending) chrome degrades gracefully instead of
      // spinning forever on a null payload.
      useOnboardingStore.getState().setLoaded();
      return null;
    }
    return syncOnboardingStore(data);
  } catch {
    useOnboardingStore.getState().setLoaded();
    return null;
  }
}

/**
 * Fire-and-forget hydration of the onboarding store used by `OnboardingProgressHydrator`
 * on app-shell mount. Non-suspending; failures degrade gracefully (see `fetchOnboardingProgress`).
 */
export function refreshOnboardingProgress(environment: IEnvironment): void {
  void fetchOnboardingProgress(environment);
}
