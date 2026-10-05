/**
 * @generated SignedSource<<6ec88c3143c89ff4ebf7e92b4269943d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type scriptsRunPickerRelayPaginationQuery$variables = {
  after?: string | null | undefined;
  first?: number | null | undefined;
  search?: string | null | undefined;
  tagIds?: ReadonlyArray<string> | null | undefined;
};
export type scriptsRunPickerRelayPaginationQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"scriptsRunPickerRelay_query">;
};
export type scriptsRunPickerRelayPaginationQuery = {
  response: scriptsRunPickerRelayPaginationQuery$data;
  variables: scriptsRunPickerRelayPaginationQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "after"
  },
  {
    "defaultValue": 20,
    "kind": "LocalArgument",
    "name": "first"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "search"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "tagIds"
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
v4 = {
  "kind": "Variable",
  "name": "tagIds",
  "variableName": "tagIds"
},
v5 = [
  (v1/*: any*/),
  {
    "fields": [
      {
        "kind": "Literal",
        "name": "statuses",
        "value": [
          "ACTIVE"
        ]
      },
      (v4/*: any*/)
    ],
    "kind": "ObjectValue",
    "name": "filter"
  },
  (v2/*: any*/),
  (v3/*: any*/)
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "scriptsRunPickerRelayPaginationQuery",
    "selections": [
      {
        "args": [
          (v1/*: any*/),
          (v2/*: any*/),
          (v3/*: any*/),
          (v4/*: any*/)
        ],
        "kind": "FragmentSpread",
        "name": "scriptsRunPickerRelay_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "scriptsRunPickerRelayPaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v5/*: any*/),
        "concreteType": "ScriptConnection",
        "kind": "LinkedField",
        "name": "scripts",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "ScriptEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Script",
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
                    "name": "supportedPlatforms",
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
        "args": (v5/*: any*/),
        "filters": [
          "filter",
          "search"
        ],
        "handle": "connection",
        "key": "scriptsRunPickerRelay_scripts",
        "kind": "LinkedHandle",
        "name": "scripts"
      }
    ]
  },
  "params": {
    "cacheID": "4b246b00f8b224fa9a2d2d73dabc4dfe",
    "id": null,
    "metadata": {},
    "name": "scriptsRunPickerRelayPaginationQuery",
    "operationKind": "query",
    "text": "query scriptsRunPickerRelayPaginationQuery(\n  $after: String\n  $first: Int = 20\n  $search: String\n  $tagIds: [ID!]\n) {\n  ...scriptsRunPickerRelay_query_3za0JU\n}\n\nfragment scriptsRunPickerRelay_query_3za0JU on Query {\n  scripts(filter: {statuses: [ACTIVE], tagIds: $tagIds}, search: $search, first: $first, after: $after) {\n    edges {\n      node {\n        id\n        name\n        description\n        supportedPlatforms\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "81865a06c54f161867eb0d839bc9ee2a";

export default node;
