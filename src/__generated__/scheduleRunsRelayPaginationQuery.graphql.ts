/**
 * @generated SignedSource<<3eb6fe0578ccdbc669b8285e5740201a>>
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
export type scheduleRunsRelayPaginationQuery$variables = {
  after?: string | null | undefined;
  filter?: ScheduleRunFilterInput | null | undefined;
  first?: number | null | undefined;
  scheduleId: string;
  search?: string | null | undefined;
  sort?: SortInput | null | undefined;
};
export type scheduleRunsRelayPaginationQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"scheduleRunsRelay_query">;
};
export type scheduleRunsRelayPaginationQuery = {
  response: scheduleRunsRelayPaginationQuery$data;
  variables: scheduleRunsRelayPaginationQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
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
    "name": "scheduleId"
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
    "name": "scheduleId",
    "variableName": "scheduleId"
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
    "name": "scheduleRunsRelayPaginationQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "scheduleRunsRelay_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "scheduleRunsRelayPaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
                  (v2/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "executionId",
                    "storageKey": null
                  },
                  (v3/*: any*/),
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
                      (v2/*: any*/),
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
                      (v3/*: any*/),
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
        "args": (v1/*: any*/),
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
    "cacheID": "21714e0838673ddf9c094b7043701de7",
    "id": null,
    "metadata": {},
    "name": "scheduleRunsRelayPaginationQuery",
    "operationKind": "query",
    "text": "query scheduleRunsRelayPaginationQuery(\n  $after: String\n  $filter: ScheduleRunFilterInput\n  $first: Int = 20\n  $scheduleId: ID!\n  $search: String\n  $sort: SortInput\n) {\n  ...scheduleRunsRelay_query_DPxbZ\n}\n\nfragment scheduleRunsRelay_query_DPxbZ on Query {\n  scheduleRuns(scheduleId: $scheduleId, filter: $filter, search: $search, sort: $sort, first: $first, after: $after) {\n    filteredCount\n    edges {\n      node {\n        id\n        executionId\n        status\n        totalMachineCount\n        respondedMachineCount\n        dispatchedAt\n        initiator {\n          id\n          firstName\n          lastName\n          email\n          status\n          image {\n            imageUrl\n            hash\n          }\n        }\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "4fae6d798c7b88ef9f4042e9b511021c";

export default node;
