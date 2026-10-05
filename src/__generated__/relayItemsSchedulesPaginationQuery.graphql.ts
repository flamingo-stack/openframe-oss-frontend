/**
 * @generated SignedSource<<d220f63ebf40d5c60e30b8c3883dbcf8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type relayItemsSchedulesPaginationQuery$variables = {
  after?: string | null | undefined;
  first?: number | null | undefined;
  search?: string | null | undefined;
};
export type relayItemsSchedulesPaginationQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"relayItemsSchedules_query">;
};
export type relayItemsSchedulesPaginationQuery = {
  response: relayItemsSchedulesPaginationQuery$data;
  variables: relayItemsSchedulesPaginationQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "after"
  },
  {
    "defaultValue": 10,
    "kind": "LocalArgument",
    "name": "first"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "search"
  }
],
v1 = {
  "kind": "Variable",
  "name": "after",
  "variableName": "after"
},
v2 = {
  "kind": "Variable",
  "name": "first",
  "variableName": "first"
},
v3 = {
  "kind": "Variable",
  "name": "search",
  "variableName": "search"
},
v4 = [
  (v1/*: any*/),
  {
    "kind": "Literal",
    "name": "filter",
    "value": {
      "statuses": [
        "ACTIVE"
      ]
    }
  },
  (v2/*: any*/),
  (v3/*: any*/)
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "relayItemsSchedulesPaginationQuery",
    "selections": [
      {
        "args": [
          (v1/*: any*/),
          (v2/*: any*/),
          (v3/*: any*/)
        ],
        "kind": "FragmentSpread",
        "name": "relayItemsSchedules_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "relayItemsSchedulesPaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v4/*: any*/),
        "concreteType": "ScriptScheduleConnection",
        "kind": "LinkedField",
        "name": "scriptSchedules",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "ScriptScheduleEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "ScriptSchedule",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "id",
                    "storageKey": null
                  },
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
                    "kind": "ScalarField",
                    "name": "description",
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
                "name": "endCursor",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "hasNextPage",
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
        "args": (v4/*: any*/),
        "filters": [
          "filter",
          "search"
        ],
        "handle": "connection",
        "key": "relayItemsSchedules_scriptSchedules",
        "kind": "LinkedHandle",
        "name": "scriptSchedules"
      }
    ]
  },
  "params": {
    "cacheID": "2f7357c355a845bece463ef5773a1366",
    "id": null,
    "metadata": {},
    "name": "relayItemsSchedulesPaginationQuery",
    "operationKind": "query",
    "text": "query relayItemsSchedulesPaginationQuery(\n  $after: String\n  $first: Int = 10\n  $search: String\n) {\n  ...relayItemsSchedules_query_1Ozsmw\n}\n\nfragment relayItemsSchedules_query_1Ozsmw on Query {\n  scriptSchedules(filter: {statuses: [ACTIVE]}, search: $search, first: $first, after: $after) {\n    edges {\n      node {\n        id\n        name\n        description\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "3ad18c4ccd4db4163de99281e2eeb2d6";

export default node;
