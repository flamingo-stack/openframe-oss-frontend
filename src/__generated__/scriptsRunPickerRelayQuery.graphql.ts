/**
 * @generated SignedSource<<bc6a775906cecdbe9e82949c03e35efd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type scriptsRunPickerRelayQuery$variables = {
  first: number;
  search?: string | null | undefined;
  tagIds?: ReadonlyArray<string> | null | undefined;
};
export type scriptsRunPickerRelayQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"scriptsRunPickerRelay_query">;
};
export type scriptsRunPickerRelayQuery = {
  response: scriptsRunPickerRelayQuery$data;
  variables: scriptsRunPickerRelayQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "first"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "search"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "tagIds"
},
v3 = {
  "kind": "Variable",
  "name": "first",
  "variableName": "first"
},
v4 = {
  "kind": "Variable",
  "name": "search",
  "variableName": "search"
},
v5 = {
  "kind": "Variable",
  "name": "tagIds",
  "variableName": "tagIds"
},
v6 = [
  {
    "fields": [
      {
        "kind": "Literal",
        "name": "statuses",
        "value": [
          "ACTIVE"
        ]
      },
      (v5/*: any*/)
    ],
    "kind": "ObjectValue",
    "name": "filter"
  },
  (v3/*: any*/),
  (v4/*: any*/)
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "scriptsRunPickerRelayQuery",
    "selections": [
      {
        "args": [
          (v3/*: any*/),
          (v4/*: any*/),
          (v5/*: any*/)
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
    "argumentDefinitions": [
      (v1/*: any*/),
      (v2/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "scriptsRunPickerRelayQuery",
    "selections": [
      {
        "alias": null,
        "args": (v6/*: any*/),
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
        "args": (v6/*: any*/),
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
    "cacheID": "2829fa3e03827ffc9dd8ea4c9599191a",
    "id": null,
    "metadata": {},
    "name": "scriptsRunPickerRelayQuery",
    "operationKind": "query",
    "text": "query scriptsRunPickerRelayQuery(\n  $search: String\n  $tagIds: [ID!]\n  $first: Int!\n) {\n  ...scriptsRunPickerRelay_query_4Bmi0A\n}\n\nfragment scriptsRunPickerRelay_query_4Bmi0A on Query {\n  scripts(filter: {statuses: [ACTIVE], tagIds: $tagIds}, search: $search, first: $first) {\n    edges {\n      node {\n        id\n        name\n        description\n        supportedPlatforms\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "f840bf81dae91c83d8295136ee6356f3";

export default node;
