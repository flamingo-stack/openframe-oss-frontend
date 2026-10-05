/**
 * @generated SignedSource<<5c799a4111cf9eb4b9c99370501234b2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type relayItemsVulnerabilitiesListQuery$variables = {
  first?: number | null | undefined;
  search?: string | null | undefined;
};
export type relayItemsVulnerabilitiesListQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"relayItemsVulnerabilities_query">;
};
export type relayItemsVulnerabilitiesListQuery = {
  response: relayItemsVulnerabilitiesListQuery$data;
  variables: relayItemsVulnerabilitiesListQuery$variables;
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
    "name": "relayItemsVulnerabilitiesListQuery",
    "selections": [
      {
        "args": (v2/*: any*/),
        "kind": "FragmentSpread",
        "name": "relayItemsVulnerabilities_query"
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
    "name": "relayItemsVulnerabilitiesListQuery",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "VulnerabilityConnection",
        "kind": "LinkedField",
        "name": "vulnerabilities",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "VulnerabilityEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Vulnerability",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "cveId",
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
        "key": "relayItemsVulnerabilities_vulnerabilities",
        "kind": "LinkedHandle",
        "name": "vulnerabilities"
      }
    ]
  },
  "params": {
    "cacheID": "57891789599c38bb5a085900cea20c59",
    "id": null,
    "metadata": {},
    "name": "relayItemsVulnerabilitiesListQuery",
    "operationKind": "query",
    "text": "query relayItemsVulnerabilitiesListQuery(\n  $search: String\n  $first: Int\n) {\n  ...relayItemsVulnerabilities_query_1UbRgV\n}\n\nfragment relayItemsVulnerabilities_query_1UbRgV on Query {\n  vulnerabilities(search: $search, first: $first) {\n    edges {\n      node {\n        cveId\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5b43c346078a98e1b0005aa3aad492ed";

export default node;
