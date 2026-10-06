/**
 * @generated SignedSource<<aa338fa40fe3a6e70877828f4da7057f>>
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
export type scriptExecutionsRelayQuery$variables = {
  after?: string | null | undefined;
  filter?: ScriptExecutionFilterInput | null | undefined;
  first: number;
  scriptId: string;
  search?: string | null | undefined;
  sort?: SortInput | null | undefined;
};
export type scriptExecutionsRelayQuery$data = {
  readonly scriptExecutionFilters: {
    readonly " $fragmentSpreads": FragmentRefs<"executionFacets_filters">;
  };
  readonly " $fragmentSpreads": FragmentRefs<"scriptExecutionsRelay_query">;
};
export type scriptExecutionsRelayQuery = {
  response: scriptExecutionsRelayQuery$data;
  variables: scriptExecutionsRelayQuery$variables;
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
  "name": "scriptId"
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
  "name": "scriptId",
  "variableName": "scriptId"
},
v8 = {
  "kind": "Variable",
  "name": "search",
  "variableName": "search"
},
v9 = [
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
v10 = [
  (v6/*: any*/),
  (v7/*: any*/),
  (v8/*: any*/)
],
v11 = [
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
v12 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "ScriptFilterOption",
    "kind": "LinkedField",
    "name": "statuses",
    "plural": true,
    "selections": (v11/*: any*/),
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "ScriptFilterOption",
    "kind": "LinkedField",
    "name": "initiators",
    "plural": true,
    "selections": (v11/*: any*/),
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "ScriptFilterOption",
    "kind": "LinkedField",
    "name": "machines",
    "plural": true,
    "selections": (v11/*: any*/),
    "storageKey": null
  }
],
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v14 = {
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
    "name": "scriptExecutionsRelayQuery",
    "selections": [
      {
        "args": (v9/*: any*/),
        "kind": "FragmentSpread",
        "name": "scriptExecutionsRelay_query"
      },
      {
        "alias": null,
        "args": (v10/*: any*/),
        "concreteType": "ScriptExecutionFilters",
        "kind": "LinkedField",
        "name": "scriptExecutionFilters",
        "plural": false,
        "selections": [
          {
            "kind": "InlineDataFragmentSpread",
            "name": "executionFacets_filters",
            "selections": (v12/*: any*/),
            "args": null,
            "argumentDefinitions": []
          }
        ],
        "storageKey": null
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
    "name": "scriptExecutionsRelayQuery",
    "selections": [
      {
        "alias": null,
        "args": (v9/*: any*/),
        "concreteType": "ScriptExecutionConnection",
        "kind": "LinkedField",
        "name": "scriptExecutions",
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
                  (v13/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "executionId",
                    "storageKey": null
                  },
                  (v14/*: any*/),
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
                    "name": "source",
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
                    "concreteType": "Machine",
                    "kind": "LinkedField",
                    "name": "machine",
                    "plural": false,
                    "selections": [
                      (v13/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "machineId",
                        "storageKey": null
                      },
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
                        "name": "hostname",
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
                        "concreteType": "Organization",
                        "kind": "LinkedField",
                        "name": "organization",
                        "plural": false,
                        "selections": [
                          (v13/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "name",
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
                    "concreteType": "User",
                    "kind": "LinkedField",
                    "name": "initiator",
                    "plural": false,
                    "selections": [
                      (v13/*: any*/),
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
                      (v14/*: any*/),
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
        "args": (v9/*: any*/),
        "filters": [
          "scriptId",
          "filter",
          "search",
          "sort"
        ],
        "handle": "connection",
        "key": "scriptExecutionsRelay_scriptExecutions",
        "kind": "LinkedHandle",
        "name": "scriptExecutions"
      },
      {
        "alias": null,
        "args": (v10/*: any*/),
        "concreteType": "ScriptExecutionFilters",
        "kind": "LinkedField",
        "name": "scriptExecutionFilters",
        "plural": false,
        "selections": (v12/*: any*/),
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "a1755c23ed1c782877c7755e1706cc08",
    "id": null,
    "metadata": {},
    "name": "scriptExecutionsRelayQuery",
    "operationKind": "query",
    "text": "query scriptExecutionsRelayQuery(\n  $scriptId: ID!\n  $filter: ScriptExecutionFilterInput\n  $search: String\n  $sort: SortInput\n  $first: Int!\n  $after: String\n) {\n  ...scriptExecutionsRelay_query_2Xwk6K\n  scriptExecutionFilters(scriptId: $scriptId, filter: $filter, search: $search) {\n    ...executionFacets_filters\n  }\n}\n\nfragment executionFacets_filters on ScriptExecutionFilters {\n  statuses {\n    value\n    label\n    count\n  }\n  initiators {\n    value\n    label\n    count\n  }\n  machines {\n    value\n    label\n    count\n  }\n}\n\nfragment executionFields_execution on ScriptExecution {\n  id\n  executionId\n  status\n  dispatchedAt\n  source\n  stdout\n  stderr\n  error\n  machine {\n    id\n    machineId\n    nickname\n    hostname\n    displayName\n    organization {\n      id\n      name\n    }\n  }\n  initiator {\n    id\n    firstName\n    lastName\n    email\n    status\n    image {\n      imageUrl\n      hash\n    }\n  }\n}\n\nfragment scriptExecutionsRelay_query_2Xwk6K on Query {\n  scriptExecutions(scriptId: $scriptId, filter: $filter, search: $search, sort: $sort, first: $first, after: $after) {\n    filteredCount\n    edges {\n      node {\n        ...executionFields_execution\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "f75cb8690ac5c6adf09ef2f91438bca2";

export default node;
