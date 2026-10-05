/**
 * @generated SignedSource<<6253ed950eceb43d73ee7b3c2381bbf2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type PackageManagerType = "BREW" | "CHOCO" | "WINGET" | "%future added value";
export type ScriptExecutionStatus = "FAILED" | "QUEUED" | "RUNNING" | "SUCCESS" | "%future added value";
export type SoftwareAction = "INSTALL" | "UPDATE" | "%future added value";
export type SortDirection = "ASC" | "DESC" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type ScriptExecutionFilterInput = {
  dispatchedAtFrom?: Instant | null | undefined;
  dispatchedAtTo?: Instant | null | undefined;
  initiatorIds?: ReadonlyArray<string> | null | undefined;
  machineIds?: ReadonlyArray<string> | null | undefined;
  statuses?: ReadonlyArray<ScriptExecutionStatus> | null | undefined;
};
export type SortInput = {
  direction?: SortDirection | null | undefined;
  field?: string | null | undefined;
};
export type softwareLogsTablePaginationQuery$variables = {
  action: SoftwareAction;
  after?: string | null | undefined;
  filter?: ScriptExecutionFilterInput | null | undefined;
  first?: number | null | undefined;
  packageManager: PackageManagerType;
  packageName: string;
  search?: string | null | undefined;
  sort?: SortInput | null | undefined;
};
export type softwareLogsTablePaginationQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"softwareLogsTable_query">;
};
export type softwareLogsTablePaginationQuery = {
  response: softwareLogsTablePaginationQuery$data;
  variables: softwareLogsTablePaginationQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "action"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "after"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "filter"
  },
  {
    "defaultValue": 20,
    "kind": "LocalArgument",
    "name": "first"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "packageManager"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "packageName"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "search"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "sort"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "action",
    "variableName": "action"
  },
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "after"
  },
  {
    "kind": "Variable",
    "name": "filter",
    "variableName": "filter"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  },
  {
    "kind": "Variable",
    "name": "packageManager",
    "variableName": "packageManager"
  },
  {
    "kind": "Variable",
    "name": "packageName",
    "variableName": "packageName"
  },
  {
    "kind": "Variable",
    "name": "search",
    "variableName": "search"
  },
  {
    "kind": "Variable",
    "name": "sort",
    "variableName": "sort"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "softwareLogsTablePaginationQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "softwareLogsTable_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "softwareLogsTablePaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "ScriptExecutionConnection",
        "kind": "LinkedField",
        "name": "softwareExecutions",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "ScriptExecutionEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "ScriptExecution",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v2/*: any*/),
                  (v3/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Machine",
                    "kind": "LinkedField",
                    "name": "machine",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "nickname",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "displayName",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "hostname",
                        "storageKey": null
                      },
                      (v3/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "type",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "lastSeen",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "Organization",
                        "kind": "LinkedField",
                        "name": "organization",
                        "plural": false,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "name",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "OrganizationImage",
                            "kind": "LinkedField",
                            "name": "image",
                            "plural": false,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "imageUrl",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "hash",
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "ContactInformation",
                            "kind": "LinkedField",
                            "name": "contactInformation",
                            "plural": false,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "ContactPerson",
                                "kind": "LinkedField",
                                "name": "contacts",
                                "plural": true,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "email",
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          (v2/*: any*/)
                        ],
                        "storageKey": null
                      },
                      (v2/*: any*/)
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "dispatchedAt",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "stdout",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "stderr",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "error",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "__typename",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "cursor",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "PageInfo",
            "kind": "LinkedField",
            "name": "pageInfo",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "hasNextPage",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "endCursor",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v1/*: any*/),
        "filters": [
          "packageManager",
          "packageName",
          "action",
          "filter",
          "search",
          "sort"
        ],
        "handle": "connection",
        "key": "softwareLogsTable_softwareExecutions",
        "kind": "LinkedHandle",
        "name": "softwareExecutions"
      }
    ]
  },
  "params": {
    "cacheID": "4a15c0587046073a2f5f3592c2bb0f32",
    "id": null,
    "metadata": {},
    "name": "softwareLogsTablePaginationQuery",
    "operationKind": "query",
    "text": "query softwareLogsTablePaginationQuery(\n  $action: SoftwareAction!\n  $after: String\n  $filter: ScriptExecutionFilterInput\n  $first: Int = 20\n  $packageManager: PackageManagerType!\n  $packageName: String!\n  $search: String\n  $sort: SortInput\n) {\n  ...softwareLogsTable_query_1IPzHN\n}\n\nfragment softwareLogCustomerCell_machine on Machine {\n  organization {\n    name\n    image {\n      imageUrl\n      hash\n    }\n    contactInformation {\n      contacts {\n        email\n      }\n    }\n    id\n  }\n}\n\nfragment softwareLogDeviceCell_machine on Machine {\n  nickname\n  displayName\n  hostname\n  status\n  type\n  lastSeen\n}\n\nfragment softwareLogResultPanel_execution on ScriptExecution {\n  stdout\n  stderr\n  error\n}\n\nfragment softwareLogSearch_execution on ScriptExecution {\n  status\n  stdout\n  stderr\n  error\n  machine {\n    nickname\n    displayName\n    hostname\n    organization {\n      name\n      contactInformation {\n        contacts {\n          email\n        }\n      }\n      id\n    }\n    id\n  }\n}\n\nfragment softwareLogStatusCell_execution on ScriptExecution {\n  status\n  dispatchedAt\n}\n\nfragment softwareLogsTable_query_1IPzHN on Query {\n  softwareExecutions(packageManager: $packageManager, packageName: $packageName, action: $action, filter: $filter, search: $search, sort: $sort, first: $first, after: $after) {\n    edges {\n      node {\n        id\n        status\n        machine {\n          ...softwareLogDeviceCell_machine\n          ...softwareLogCustomerCell_machine\n          id\n        }\n        ...softwareLogStatusCell_execution\n        ...softwareLogResultPanel_execution\n        ...softwareLogSearch_execution\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6a94c7b6a8744e81127202972e885975";

export default node;
