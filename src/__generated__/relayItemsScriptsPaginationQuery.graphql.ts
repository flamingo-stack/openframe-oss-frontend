/**
 * @generated SignedSource<<08ec59b9d299aaaaf0f19cb79010d41f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type relayItemsScriptsPaginationQuery$variables = {
  after?: string | null | undefined;
  first?: number | null | undefined;
  search?: string | null | undefined;
};
export type relayItemsScriptsPaginationQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"relayItemsScripts_query">;
};
export type relayItemsScriptsPaginationQuery = {
  response: relayItemsScriptsPaginationQuery$data;
  variables: relayItemsScriptsPaginationQuery$variables;
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
    "name": "relayItemsScriptsPaginationQuery",
    "selections": [
      {
        "args": [
          (v1/*: any*/),
          (v2/*: any*/),
          (v3/*: any*/)
        ],
        "kind": "FragmentSpread",
        "name": "relayItemsScripts_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "relayItemsScriptsPaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v4/*: any*/),
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
        "key": "relayItemsScripts_scripts",
        "kind": "LinkedHandle",
        "name": "scripts"
      }
    ]
  },
  "params": {
    "cacheID": "ef4dcaf5d8d16fb0a888f3e3070c2015",
    "id": null,
    "metadata": {},
    "name": "relayItemsScriptsPaginationQuery",
    "operationKind": "query",
    "text": "query relayItemsScriptsPaginationQuery(\n  $after: String\n  $first: Int = 10\n  $search: String\n) {\n  ...relayItemsScripts_query_1Ozsmw\n}\n\nfragment relayItemsScripts_query_1Ozsmw on Query {\n  scripts(filter: {statuses: [ACTIVE]}, search: $search, first: $first, after: $after) {\n    edges {\n      node {\n        id\n        name\n        description\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e1ba357b89afb18874eb858bbbd831e4";

export default node;
