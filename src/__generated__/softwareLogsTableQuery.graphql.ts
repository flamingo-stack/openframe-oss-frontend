/**
 * @generated SignedSource<<86dbe30610233fa804da16868985ad72>>
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
export type softwareLogsTableQuery$variables = {
  action: SoftwareAction;
  after?: string | null | undefined;
  filter?: ScriptExecutionFilterInput | null | undefined;
  first: number;
  packageManager: PackageManagerType;
  packageName: string;
  search?: string | null | undefined;
  sort?: SortInput | null | undefined;
};
export type softwareLogsTableQuery$data = {
  readonly softwareExecutionFilters: {
    readonly statuses: ReadonlyArray<{
      readonly count: number;
      readonly value: string;
    }>;
  };
  readonly " $fragmentSpreads": FragmentRefs<"softwareLogsTable_query">;
};
export type softwareLogsTableQuery = {
  response: softwareLogsTableQuery$data;
  variables: softwareLogsTableQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "action"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "after"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filter"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "first"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "packageManager"
},
v5 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "packageName"
},
v6 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "search"
},
v7 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "sort"
},
v8 = {
  "kind": "Variable",
  "name": "action",
  "variableName": "action"
},
v9 = {
  "kind": "Variable",
  "name": "filter",
  "variableName": "filter"
},
v10 = {
  "kind": "Variable",
  "name": "packageManager",
  "variableName": "packageManager"
},
v11 = {
  "kind": "Variable",
  "name": "packageName",
  "variableName": "packageName"
},
v12 = {
  "kind": "Variable",
  "name": "search",
  "variableName": "search"
},
v13 = [
  (v8/*: any*/),
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "after"
  },
  (v9/*: any*/),
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  },
  (v10/*: any*/),
  (v11/*: any*/),
  (v12/*: any*/),
  {
    "kind": "Variable",
    "name": "sort",
    "variableName": "sort"
  }
],
v14 = {
  "alias": null,
  "args": [
    (v8/*: any*/),
    (v9/*: any*/),
    (v10/*: any*/),
    (v11/*: any*/),
    (v12/*: any*/)
  ],
  "concreteType": "ScriptExecutionFilters",
  "kind": "LinkedField",
  "name": "softwareExecutionFilters",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "ScriptFilterOption",
      "kind": "LinkedField",
      "name": "statuses",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "value",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "count",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/),
      (v4/*: any*/),
      (v5/*: any*/),
      (v6/*: any*/),
      (v7/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "softwareLogsTableQuery",
    "selections": [
      {
        "args": (v13/*: any*/),
        "kind": "FragmentSpread",
        "name": "softwareLogsTable_query"
      },
      (v14/*: any*/)
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v4/*: any*/),
      (v5/*: any*/),
      (v0/*: any*/),
      (v2/*: any*/),
      (v6/*: any*/),
      (v7/*: any*/),
      (v3/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "softwareLogsTableQuery",
    "selections": [
      {
        "alias": null,
        "args": (v13/*: any*/),
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
                  (v15/*: any*/),
                  (v16/*: any*/),
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
                      (v16/*: any*/),
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
                          (v15/*: any*/)
                        ],
                        "storageKey": null
                      },
                      (v15/*: any*/)
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
        "args": (v13/*: any*/),
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
      },
      (v14/*: any*/)
    ]
  },
  "params": {
    "cacheID": "c62fa678a08448f53b013ba439df3aeb",
    "id": null,
    "metadata": {},
    "name": "softwareLogsTableQuery",
    "operationKind": "query",
    "text": "query softwareLogsTableQuery(\n  $packageManager: PackageManagerType!\n  $packageName: String!\n  $action: SoftwareAction!\n  $filter: ScriptExecutionFilterInput\n  $search: String\n  $sort: SortInput\n  $first: Int!\n  $after: String\n) {\n  ...softwareLogsTable_query_1IPzHN\n  softwareExecutionFilters(packageManager: $packageManager, packageName: $packageName, action: $action, filter: $filter, search: $search) {\n    statuses {\n      value\n      count\n    }\n  }\n}\n\nfragment softwareLogCustomerCell_machine on Machine {\n  organization {\n    name\n    image {\n      imageUrl\n      hash\n    }\n    contactInformation {\n      contacts {\n        email\n      }\n    }\n    id\n  }\n}\n\nfragment softwareLogDeviceCell_machine on Machine {\n  nickname\n  displayName\n  hostname\n  status\n  type\n  lastSeen\n}\n\nfragment softwareLogResultPanel_execution on ScriptExecution {\n  stdout\n  stderr\n  error\n}\n\nfragment softwareLogSearch_execution on ScriptExecution {\n  status\n  stdout\n  stderr\n  error\n  machine {\n    nickname\n    displayName\n    hostname\n    organization {\n      name\n      contactInformation {\n        contacts {\n          email\n        }\n      }\n      id\n    }\n    id\n  }\n}\n\nfragment softwareLogStatusCell_execution on ScriptExecution {\n  status\n  dispatchedAt\n}\n\nfragment softwareLogsTable_query_1IPzHN on Query {\n  softwareExecutions(packageManager: $packageManager, packageName: $packageName, action: $action, filter: $filter, search: $search, sort: $sort, first: $first, after: $after) {\n    edges {\n      node {\n        id\n        status\n        machine {\n          ...softwareLogDeviceCell_machine\n          ...softwareLogCustomerCell_machine\n          id\n        }\n        ...softwareLogStatusCell_execution\n        ...softwareLogResultPanel_execution\n        ...softwareLogSearch_execution\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6de6f67efabdb59e7d9547aa9db749d6";

export default node;
