'use client';

/**
 * Centralized query key factory for dashboard React Query hooks
 */

export const dashboardQueryKeys = {
  // Root dashboard key
  all: ['dashboard'] as const,

  // Ticket statistics (SaaS mode only)
  ticketStats: () => [...dashboardQueryKeys.all, 'ticket-stats'] as const,

  // Organization statistics — `orgStatsAll` is the invalidation root across limits
  orgStatsAll: () => [...dashboardQueryKeys.all, 'org-stats'] as const,
  orgStats: (limit: number) => [...dashboardQueryKeys.orgStatsAll(), { limit }] as const,

  // SSO provider count (onboarding)
  ssoProviders: () => [...dashboardQueryKeys.all, 'sso-providers'] as const,

  // User statistics (onboarding)
  userStats: () => [...dashboardQueryKeys.all, 'user-stats'] as const,

  // Invalidate all dashboard queries
  invalidateAll: () => dashboardQueryKeys.all,
} as const;
