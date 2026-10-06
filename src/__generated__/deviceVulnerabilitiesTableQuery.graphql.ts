/**
 * @generated SignedSource<<c97c9e353ca1c3baea3777b223c1cccb>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type deviceVulnerabilitiesTableQuery$variables = {
  after?: string | null | undefined;
  first: number;
  machineId: string;
  search?: string | null | undefined;
};
export type deviceVulnerabilitiesTableQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"deviceVulnerabilitiesTable_query">;
};
export type deviceVulnerabilitiesTableQuery = {
  response: deviceVulnerabilitiesTableQuery$data;
  variables: deviceVulnerabilitiesTableQuery$variables;
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
  "name": "first"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "machineId"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "search"
},
v4 = [
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
    "name": "machineId",
    "variableName": "machineId"
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
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "deviceVulnerabilitiesTableQuery",
    "selections": [
      {
        "args": (v4/*: any*/),
        "kind": "FragmentSpread",
        "name": "deviceVulnerabilitiesTable_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v3/*: any*/),
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "deviceVulnerabilitiesTableQuery",
    "selections": [
      {
        "alias": null,
        "args": (v4/*: any*/),
        "concreteType": "VulnerabilityConnection",
        "kind": "LinkedField",
        "name": "deviceVulnerabilities",
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
                    "name": "discoveredAt",
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
        "args": (v4/*: any*/),
        "filters": [
          "machineId",
          "search"
        ],
        "handle": "connection",
        "key": "deviceVulnerabilitiesTable_deviceVulnerabilities",
        "kind": "LinkedHandle",
        "name": "deviceVulnerabilities"
      }
    ]
  },
  "params": {
    "cacheID": "31fa785d94d8203bf56229dad2f76864",
    "id": null,
    "metadata": {},
    "name": "deviceVulnerabilitiesTableQuery",
    "operationKind": "query",
    "text": "query deviceVulnerabilitiesTableQuery(\n  $machineId: String!\n  $search: String\n  $first: Int!\n  $after: String\n) {\n  ...deviceVulnerabilitiesTable_query_3afdNg\n}\n\nfragment deviceVulnerabilitiesTable_query_3afdNg on Query {\n  deviceVulnerabilities(machineId: $machineId, search: $search, first: $first, after: $after) {\n    filteredCount\n    edges {\n      node {\n        ...vulnerabilityTable_vulnerability\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}\n\nfragment vulnerabilityDiscoveredCell_vulnerability on Vulnerability {\n  discoveredAt\n}\n\nfragment vulnerabilityTable_vulnerability on Vulnerability {\n  cveId\n  ...vulnerabilityDiscoveredCell_vulnerability\n}\n"
  }
};
})();

(node as any).hash = "5a09610eca67f336abf6a08ed3e98ffa";

export default node;
