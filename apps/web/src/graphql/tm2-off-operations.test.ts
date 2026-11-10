/**
 * Tenant Management Phase 2 runs behind `tenant-management-v2`, and the backend serves its schema only while the flag
 * is on. schema.graphql is that ON schema, so relay-compiler cannot tell when an operation that runs with the flag off
 * selects something only phase 2 has: stage and prod would answer it with a validation error. This test derives the off
 * schema from schema.graphql by removing exactly what phase 2 added, and validates every compiled operation against it,
 * except the ones only a phase-2 screen sends. Delete it with the flag.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildASTSchema,
  type DefinitionNode,
  type DocumentNode,
  type FieldDefinitionNode,
  type InputValueDefinitionNode,
  Kind,
  parse,
  type TypeNode,
  validate,
} from 'graphql';
import { describe, expect, it } from 'vitest';

const APP = join(import.meta.dirname, '..', '..');

/** What phase 2 adds to main's schema (graphql-js breaking changes from the on schema to main's). */
const PHASE2_TYPES = new Set([
  'DeviceDirectory',
  'DirectoryAccount',
  'DirectoryConnectionCustomer',
  'DirectoryConnectionCustomerInput',
  'DirectoryConnectionFilterOption',
  'DirectoryConnectionFilters',
  'DirectoryConnectionImpact',
  'DirectoryConnectionOrderInput',
  'DirectoryConnectionRule',
  'DirectoryConnectionSortField',
  'DirectoryCustomerClaim',
  'DirectoryDeviceCard',
  'DirectoryDeviceLinkPayload',
  'DirectoryDeviceUser',
  'DirectoryDeviceUserLink',
  'DirectoryFeed',
  'DirectoryFilterOption',
  'DirectoryGroup',
  'DirectoryGroupConnection',
  'DirectoryGroupDependency',
  'DirectoryGroupEdge',
  'DirectoryGroupKind',
  'DirectoryGroupMember',
  'DirectoryGroupMemberConnection',
  'DirectoryGroupMemberEdge',
  'DirectoryGroupMemberSubject',
  'DirectoryGroupOrderInput',
  'DirectoryGroupRef',
  'DirectoryGroupSettings',
  'DirectoryGroupSortField',
  'DirectoryGroupVisibility',
  'DirectoryIntuneState',
  'DirectoryLicense',
  'DirectoryLicenseFilter',
  'DirectoryLicenseOrderInput',
  'DirectoryLicenseSortField',
  'DirectoryLicenseSummary',
  'DirectoryMachineLink',
  'DirectoryMachineLinkVia',
  'DirectoryMachineSuggestion',
  'DirectoryMatchKey',
  'DirectoryMembershipScope',
  'DirectoryPerson',
  'DirectoryPersonConnection',
  'DirectoryPersonEdge',
  'DirectoryReadOnlyReason',
  'DirectoryReadability',
  'DirectoryRuleInput',
  'DirectoryRuleKind',
  'DirectoryRuleValue',
  'DirectorySource',
  'DirectoryUserDevice',
  'DirectoryUserDevices',
  'DirectoryUserField',
  'DirectoryUserFilterInput',
  'DirectoryUserFilters',
  'DirectoryUserLicense',
  'DirectoryUserLink',
  'DirectoryUserLiveDetails',
  'DirectoryUserOrderInput',
  'DirectoryUserPayload',
  'DirectoryUserRef',
  'DirectoryUserSortField',
  'EntraDeviceCard',
  'EntraJoinType',
  'IntuneComplianceState',
  'IntuneDeviceCard',
  'IntuneManagementAgent',
  'IntuneOwnerType',
  'IntuneUnavailableReason',
  'LastSignInBucket',
  'LinkDirectoryDeviceInput',
  'OrgUserStatus',
  'OrgUserStatusReason',
  'SecondFactorState',
  'SetDirectoryUserSuspendedInput',
  'TopAdminState',
  'UpdateDirectoryUserInput',
]);
const PHASE2_FIELDS = new Set([
  'DeviceFilterInput.directorySources',
  'DeviceFilterInput.userLinks',
  'DeviceFilters.directorySources',
  'DeviceFilters.userLinks',
  'DirectoryConnection.customers',
  'DirectoryConnection.impact',
  'DirectoryConnection.intune',
  'DirectoryConnection.licenseSummary',
  'DirectoryConnection.licenses',
  'DirectoryConnection.syncPausedAt',
  'DirectoryConnection.syncPausedBy',
  'DirectoryConnection.unattributedUserCount',
  'DirectoryConnection.writeEnabled',
  'DirectoryConnectionFilterInput.accessStates',
  'DirectoryConnectionFilterInput.licenses',
  'DirectoryConnectionFilterInput.organizationIds',
  'DirectoryConnectionFilterInput.providers',
  'Machine.directorySources',
  'Machine.directoryUserIds',
  'Machine.directoryUserLink',
  'Machine.directoryUserName',
  'Mutation.disconnectDirectoryConnection',
  'Mutation.linkDirectoryDevice',
  'Mutation.pauseDirectoryConnection',
  'Mutation.resumeDirectoryConnection',
  'Mutation.setDirectoryUserSuspended',
  'Mutation.updateDirectoryUser',
  'OrgDevice.connection',
  'OrgDevice.customers',
  'OrgDevice.linkable',
  'OrgDevice.machineLink',
  'OrgDevice.serialNumber',
  'OrgDevice.suggestions',
  'OrgDevice.userLink',
  'Query.deviceDirectory',
  'Query.directoryAccount',
  'Query.directoryConnectionFilters',
  'Query.directoryGroup',
  'Query.directoryGroups',
  'Query.directoryRuleOptions',
  'Query.directoryUser',
  'Query.directoryUserFilters',
  'Query.directoryUsers',
  'UpdateDirectoryConnectionInput.customers',
  'UpdateDirectoryConnectionInput.writeEnabled',
]);
const PHASE2_ENUM_VALUES = new Set(['NotificationCategory.INTEGRATIONS', 'DirectoryConsentIssueKind.NOT_FINISHED']);
const PHASE2_ARGS = new Set(['Query.directoryConnections.orderBy']);
/** Optional while phase 2 is on, required while it is off. */
const REQUIRED_WHEN_OFF = new Set([
  'CreateDirectoryConnectionInput.organizationId',
  'DirectoryConnection.organization',
  'DirectoryConnection.organizationId',
]);

/** Operations only a phase-2 surface sends: each sits behind `useTenantManagementV2Gate` being 'on'. */
const PHASE2_OPERATIONS = new Set<string>([
  'connectTenantContentQuery',
  'devicesListRelayPaginationQuery',
  'devicesListRelayQuery',
  'directoryTabQuery',
  'directoryUsersTabQuery',
  'directoryUsersTablePaginationQuery',
  'directoryUsersTableQuery',
  'editUserRecordLoaderQuery',
  'endConnectionViewQuery',
  'groupDetailViewQuery',
  'groupMembersTablePaginationQuery',
  'groupMembersTableQuery',
  'groupsTablePaginationQuery',
  'groupsTableQuery',
  'linkDeviceModalMutation',
  'linkDeviceModalQuery',
  'managerFieldQuery',
  'needsYouTenantsSourceQuery',
  'reconnectTenantViewQuery',
  'ruleValuesFieldQuery',
  'tenantAttributionRulesQuery',
  'tenantDetailContentQuery',
  'tenantLicensesSectionQuery',
  'tenantRecordLoaderQuery',
  'tenantsTablePaginationQuery',
  'tenantsTableQuery',
  'useDirectoryFacetsQuery',
  'useEditUserFormMutation',
  'useEndConnectionDisconnectMutation',
  'useNewTenantFormCreateMutation',
  'useSaveIntegrationMutation',
  'useSuspendUserMutation',
  'useTenantFiltersQuery',
  'useTenantSyncPauseMutation',
  'useTenantSyncResumeMutation',
  'useUserFiltersQuery',
  'userDetailViewQuery',
  'userDevicesTabQuery',
  'userGroupsTabPaginationQuery',
  'userGroupsTabQuery',
  'userLicencesTabQuery',
]);

function required(type: TypeNode): TypeNode {
  return type.kind === Kind.NON_NULL_TYPE ? type : { kind: Kind.NON_NULL_TYPE, type };
}

const seen = new Set<string>();

function keepField<T extends FieldDefinitionNode | InputValueDefinitionNode>(owner: string, field: T): T | null {
  const key = `${owner}.${field.name.value}`;
  if (PHASE2_FIELDS.has(key)) {
    seen.add(key);
    return null;
  }
  let next = field;
  if (REQUIRED_WHEN_OFF.has(key)) {
    seen.add(key);
    // Phase 2 deprecated them; main's are plain required fields.
    const directives = next.directives?.filter(directive => directive.name.value !== 'deprecated');
    next = { ...next, type: required(next.type), directives };
  }
  if (next.kind === Kind.FIELD_DEFINITION && next.arguments) {
    const args = next.arguments.filter(arg => {
      const argKey = `${key}.${arg.name.value}`;
      if (!PHASE2_ARGS.has(argKey)) return true;
      seen.add(argKey);
      return false;
    });
    next = { ...next, arguments: args };
  }
  return next;
}

function offDefinition(definition: DefinitionNode): DefinitionNode | null {
  if (!('name' in definition) || !definition.name) return definition;
  const owner = definition.name.value;
  if (PHASE2_TYPES.has(owner)) {
    seen.add(owner);
    return null;
  }
  switch (definition.kind) {
    case Kind.OBJECT_TYPE_DEFINITION:
    case Kind.OBJECT_TYPE_EXTENSION:
    case Kind.INTERFACE_TYPE_DEFINITION:
    case Kind.INTERFACE_TYPE_EXTENSION:
      return { ...definition, fields: definition.fields?.flatMap(field => keepField(owner, field) ?? []) };
    case Kind.INPUT_OBJECT_TYPE_DEFINITION:
    case Kind.INPUT_OBJECT_TYPE_EXTENSION:
      return { ...definition, fields: definition.fields?.flatMap(field => keepField(owner, field) ?? []) };
    case Kind.ENUM_TYPE_DEFINITION:
    case Kind.ENUM_TYPE_EXTENSION:
      return {
        ...definition,
        values: definition.values?.filter(value => {
          const key = `${owner}.${value.name.value}`;
          if (!PHASE2_ENUM_VALUES.has(key)) return true;
          seen.add(key);
          return false;
        }),
      };
    default:
      return definition;
  }
}

const onSchema = parse(readFileSync(join(APP, 'schema.graphql'), 'utf8'));
const offDocument: DocumentNode = {
  ...onSchema,
  definitions: onSchema.definitions.flatMap(definition => offDefinition(definition) ?? []),
};

/** Every compiled operation, by name, with the text Relay sends. Fragments travel inside their operations. */
function compiledOperations(): Map<string, string> {
  const dir = join(APP, 'src', '__generated__');
  const operations = new Map<string, string>();
  for (const file of readdirSync(dir).filter(name => name.endsWith('.graphql.ts'))) {
    const text = /"text": ("(?:[^"\\]|\\.)*")/.exec(readFileSync(join(dir, file), 'utf8'))?.[1];
    if (text) operations.set(file.replace('.graphql.ts', ''), JSON.parse(text) as string);
  }
  return operations;
}

describe('operations with tenant-management-v2 off', () => {
  const offSchema = buildASTSchema(offDocument);
  const operations = compiledOperations();

  it('removes every listed phase-2 addition, so the list cannot rot', () => {
    const listed = [...PHASE2_TYPES, ...PHASE2_FIELDS, ...PHASE2_ENUM_VALUES, ...PHASE2_ARGS, ...REQUIRED_WHEN_OFF];
    expect(listed.filter(key => !seen.has(key))).toEqual([]);
  });

  it('names only operations that exist', () => {
    expect([...PHASE2_OPERATIONS].filter(name => !operations.has(name))).toEqual([]);
  });

  it('validates every operation a flag-off screen can send against the off schema', () => {
    const failures = [...operations]
      .filter(([name]) => !PHASE2_OPERATIONS.has(name))
      .flatMap(([name, text]) => validate(offSchema, parse(text)).map(error => `${name}: ${error.message}`));
    expect(failures).toEqual([]);
  });
});
