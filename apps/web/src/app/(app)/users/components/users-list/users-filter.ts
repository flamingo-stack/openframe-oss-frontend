import type { DirectoryUserFilterInput } from '@/__generated__/directoryUsersTableQuery.graphql';

/** The selection of each funnel, keyed by its column id — the shape the URL keeps. */
export interface UserSelections {
  tenant: string[];
  status: string[];
  license: string[];
}

/** The tenant funnel's option for users added in OpenFrame rather than synced from a directory (contract §1). */
const OPENFRAME_TENANT = 'OPENFRAME';

/** The licence funnel's option for users who hold no licence (contract §1). */
const NO_LICENSE = 'NO_LICENSE';

/**
 * The funnels' selection as `directoryUsers(filter:)` takes it — null when nothing is ticked, so the query and the
 * empty-state guard read "unfiltered" off one value. A ticked block always sends all of its fields: only "OpenFrame"
 * ticked is `connectionIds: []` with `includeOpenFrame: true`, only "No licence" is `skuIds: []` with `noLicense`.
 */
export function toFilter(selections: UserSelections): DirectoryUserFilterInput | null {
  if (selections.tenant.length === 0 && selections.status.length === 0 && selections.license.length === 0) {
    return null;
  }
  return {
    ...(selections.tenant.length > 0 && {
      connectionIds: selections.tenant.filter(value => value !== OPENFRAME_TENANT),
      includeOpenFrame: selections.tenant.includes(OPENFRAME_TENANT),
    }),
    ...(selections.status.length > 0 && { statuses: selections.status as DirectoryUserFilterInput['statuses'] }),
    ...(selections.license.length > 0 && {
      skuIds: selections.license.filter(value => value !== NO_LICENSE),
      noLicense: selections.license.includes(NO_LICENSE),
    }),
  };
}
