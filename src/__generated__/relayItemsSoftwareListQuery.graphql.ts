/**
 * @generated SignedSource<<a3a42d3500aa049ab0f478de861011c3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type relayItemsSoftwareListQuery$variables = {
  first?: number | null | undefined;
  search?: string | null | undefined;
};
export type relayItemsSoftwareListQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"relayItemsSoftware_query">;
};
export type relayItemsSoftwareListQuery = {
  response: relayItemsSoftwareListQuery$data;
  variables: relayItemsSoftwareListQuery$variables;
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
v2 = [
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  },
  {
    "kind": "Variable",
    "name": "search",
    "variableName": "search"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "relayItemsSoftwareListQuery",
    "selections": [
      {
        "args": (v2/*: any*/),
        "kind": "FragmentSpread",
        "name": "relayItemsSoftware_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "relayItemsSoftwareListQuery",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "SoftwareConnection",
        "kind": "LinkedField",
        "name": "softwares",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "SoftwareEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Software",
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
                    "name": "publisher",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "currentVersion",
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
        "args": (v2/*: any*/),
        "filters": [
          "search"
        ],
        "handle": "connection",
        "key": "relayItemsSoftware_softwares",
        "kind": "LinkedHandle",
        "name": "softwares"
      }
    ]
  },
  "params": {
    "cacheID": "18a1849361014983b5a8fd36b3500782",
    "id": null,
    "metadata": {},
    "name": "relayItemsSoftwareListQuery",
    "operationKind": "query",
    "text": "query relayItemsSoftwareListQuery(\n  $search: String\n  $first: Int\n) {\n  ...relayItemsSoftware_query_1UbRgV\n}\n\nfragment relayItemsSoftware_query_1UbRgV on Query {\n  softwares(search: $search, first: $first) {\n    edges {\n      node {\n        id\n        name\n        publisher\n        currentVersion\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "64ca65f1188d8f8cfd39be21f4c3112f";

export default node;
