/**
 * @generated SignedSource<<858cba1c64c6c958484433ecda00668c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type relayItemsVulnerabilitiesPaginationQuery$variables = {
  after?: string | null | undefined;
  first?: number | null | undefined;
  search?: string | null | undefined;
};
export type relayItemsVulnerabilitiesPaginationQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"relayItemsVulnerabilities_query">;
};
export type relayItemsVulnerabilitiesPaginationQuery = {
  response: relayItemsVulnerabilitiesPaginationQuery$data;
  variables: relayItemsVulnerabilitiesPaginationQuery$variables;
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
v1 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "after"
  },
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "relayItemsVulnerabilitiesPaginationQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "relayItemsVulnerabilities_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "relayItemsVulnerabilitiesPaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
        "args": (v1/*: any*/),
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
    "cacheID": "6905dabb7ac067c5e39857812d2c711a",
    "id": null,
    "metadata": {},
    "name": "relayItemsVulnerabilitiesPaginationQuery",
    "operationKind": "query",
    "text": "query relayItemsVulnerabilitiesPaginationQuery(\n  $after: String\n  $first: Int = 10\n  $search: String\n) {\n  ...relayItemsVulnerabilities_query_1Ozsmw\n}\n\nfragment relayItemsVulnerabilities_query_1Ozsmw on Query {\n  vulnerabilities(search: $search, first: $first, after: $after) {\n    edges {\n      node {\n        cveId\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "fdb35d7bc060c0a258cab8b43103f0f6";

export default node;
