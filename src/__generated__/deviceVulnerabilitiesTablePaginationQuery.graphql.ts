/**
 * @generated SignedSource<<5d19eb9cbf0f5b7b4b191c6163029350>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type deviceVulnerabilitiesTablePaginationQuery$variables = {
  after?: string | null | undefined;
  first?: number | null | undefined;
  machineId: string;
  search?: string | null | undefined;
};
export type deviceVulnerabilitiesTablePaginationQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"deviceVulnerabilitiesTable_query">;
};
export type deviceVulnerabilitiesTablePaginationQuery = {
  response: deviceVulnerabilitiesTablePaginationQuery$data;
  variables: deviceVulnerabilitiesTablePaginationQuery$variables;
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
    "name": "machineId"
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "deviceVulnerabilitiesTablePaginationQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "deviceVulnerabilitiesTable_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "deviceVulnerabilitiesTablePaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
        "args": (v1/*: any*/),
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
    "cacheID": "7caee5815f9f5ed37de41c67c6482240",
    "id": null,
    "metadata": {},
    "name": "deviceVulnerabilitiesTablePaginationQuery",
    "operationKind": "query",
    "text": "query deviceVulnerabilitiesTablePaginationQuery(\n  $after: String\n  $first: Int = 20\n  $machineId: String!\n  $search: String\n) {\n  ...deviceVulnerabilitiesTable_query_3afdNg\n}\n\nfragment deviceVulnerabilitiesTable_query_3afdNg on Query {\n  deviceVulnerabilities(machineId: $machineId, search: $search, first: $first, after: $after) {\n    filteredCount\n    edges {\n      node {\n        ...vulnerabilityTable_vulnerability\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}\n\nfragment vulnerabilityDiscoveredCell_vulnerability on Vulnerability {\n  discoveredAt\n}\n\nfragment vulnerabilityTable_vulnerability on Vulnerability {\n  cveId\n  ...vulnerabilityDiscoveredCell_vulnerability\n}\n"
  }
};
})();

(node as any).hash = "bf80179026709f8404dbbf3214998645";

export default node;
