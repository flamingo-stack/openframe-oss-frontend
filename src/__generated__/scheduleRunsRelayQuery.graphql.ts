/**
 * @generated SignedSource<<b671caca09ea1118acf9ea713bcd2acb>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type ScriptExecutionStatus = "FAILED" | "QUEUED" | "RUNNING" | "SUCCESS" | "%future added value";
export type SortDirection = "ASC" | "DESC" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type ScheduleRunFilterInput = {
  dispatchedAtFrom?: Instant | null | undefined;
  dispatchedAtTo?: Instant | null | undefined;
  statuses?: ReadonlyArray<ScriptExecutionStatus> | null | undefined;
};
export type SortInput = {
  direction?: SortDirection | null | undefined;
  field?: string | null | undefined;
};
export type scheduleRunsRelayQuery$variables = {
  after?: string | null | undefined;
  filter?: ScheduleRunFilterInput | null | undefined;
  first: number;
  scheduleId: string;
  search?: string | null | undefined;
  sort?: SortInput | null | undefined;
};
export type scheduleRunsRelayQuery$data = {
  readonly scheduleRunFilters: {
    readonly statuses: ReadonlyArray<{
      readonly count: number;
      readonly label: string;
      readonly value: string;
    }>;
  };
  readonly " $fragmentSpreads": FragmentRefs<"scheduleRunsRelay_query">;
};
export type scheduleRunsRelayQuery = {
  response: scheduleRunsRelayQuery$data;
  variables: scheduleRunsRelayQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "after"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filter"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "first"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "scheduleId"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "search"
},
v5 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "sort"
},
v6 = {
  "kind": "Variable",
  "name": "filter",
  "variableName": "filter"
},
v7 = {
  "kind": "Variable",
  "name": "scheduleId",
  "variableName": "scheduleId"
},
v8 = {
  "kind": "Variable",
  "name": "search",
  "variableName": "search"
},
v9 = {
  "alias": null,
  "args": [
    (v6/*: any*/),
    (v7/*: any*/),
    (v8/*: any*/)
  ],
  "concreteType": "ScheduleRunFilters",
  "kind": "LinkedField",
  "name": "scheduleRunFilters",
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
          "name": "label",
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
v10 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "after"
  },
  (v6/*: any*/),
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  },
  (v7/*: any*/),
  (v8/*: any*/),
  {
    "kind": "Variable",
    "name": "sort",
    "variableName": "sort"
  }
],
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v12 = {
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
      (v5/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "scheduleRunsRelayQuery",
    "selections": [
      (v9/*: any*/),
      {
        "args": (v10/*: any*/),
        "kind": "FragmentSpread",
        "name": "scheduleRunsRelay_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v3/*: any*/),
      (v1/*: any*/),
      (v4/*: any*/),
      (v5/*: any*/),
      (v2/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "scheduleRunsRelayQuery",
    "selections": [
      (v9/*: any*/),
      {
        "alias": null,
        "args": (v10/*: any*/),
        "concreteType": "ScheduleRunConnection",
        "kind": "LinkedField",
        "name": "scheduleRuns",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "filteredCount",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "ScheduleRunEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "ScheduleRun",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v11/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "executionId",
                    "storageKey": null
                  },
                  (v12/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "totalMachineCount",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "respondedMachineCount",
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
                    "concreteType": "User",
                    "kind": "LinkedField",
                    "name": "initiator",
                    "plural": false,
                    "selections": [
                      (v11/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "firstName",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "lastName",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "email",
                        "storageKey": null
                      },
                      (v12/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "UserImage",
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
                      }
                    ],
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
        "args": (v10/*: any*/),
        "filters": [
          "scheduleId",
          "filter",
          "search",
          "sort"
        ],
        "handle": "connection",
        "key": "scheduleRunsRelay_scheduleRuns",
        "kind": "LinkedHandle",
        "name": "scheduleRuns"
      }
    ]
  },
  "params": {
    "cacheID": "0ebeddc74b7f99668a34cc4ff57475b6",
    "id": null,
    "metadata": {},
    "name": "scheduleRunsRelayQuery",
    "operationKind": "query",
    "text": "query scheduleRunsRelayQuery(\n  $scheduleId: ID!\n  $filter: ScheduleRunFilterInput\n  $search: String\n  $sort: SortInput\n  $first: Int!\n  $after: String\n) {\n  scheduleRunFilters(scheduleId: $scheduleId, filter: $filter, search: $search) {\n    statuses {\n      value\n      label\n      count\n    }\n  }\n  ...scheduleRunsRelay_query_DPxbZ\n}\n\nfragment scheduleRunsRelay_query_DPxbZ on Query {\n  scheduleRuns(scheduleId: $scheduleId, filter: $filter, search: $search, sort: $sort, first: $first, after: $after) {\n    filteredCount\n    edges {\n      node {\n        id\n        executionId\n        status\n        totalMachineCount\n        respondedMachineCount\n        dispatchedAt\n        initiator {\n          id\n          firstName\n          lastName\n          email\n          status\n          image {\n            imageUrl\n            hash\n          }\n        }\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "76c265eecb22c34077c2ff3f990ea1a9";

export default node;
