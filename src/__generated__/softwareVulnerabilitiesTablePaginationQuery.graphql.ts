/**
 * @generated SignedSource<<8f2e5ca0ffa24fd6999c18f16cf5fe0c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type SortDirection = "ASC" | "DESC" | "%future added value";
export type SortInput = {
  direction?: SortDirection | null | undefined;
  field?: string | null | undefined;
};
export type softwareVulnerabilitiesTablePaginationQuery$variables = {
  after?: string | null | undefined;
  first?: number | null | undefined;
  search?: string | null | undefined;
  softwareId: string;
  sort?: SortInput | null | undefined;
};
export type softwareVulnerabilitiesTablePaginationQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"softwareVulnerabilitiesTable_query">;
};
export type softwareVulnerabilitiesTablePaginationQuery = {
  response: softwareVulnerabilitiesTablePaginationQuery$data;
  variables: softwareVulnerabilitiesTablePaginationQuery$variables;
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
    "name": "softwareId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "sort"
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
  },
  {
    "kind": "Variable",
    "name": "softwareId",
    "variableName": "softwareId"
  },
  {
    "kind": "Variable",
    "name": "sort",
    "variableName": "sort"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "softwareVulnerabilitiesTablePaginationQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "softwareVulnerabilitiesTable_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "softwareVulnerabilitiesTablePaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "SoftwareVulnerabilityConnection",
        "kind": "LinkedField",
        "name": "softwareVulnerabilities",
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
            "concreteType": "SoftwareVulnerabilityEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "SoftwareVulnerability",
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
                    "name": "affectedVersion",
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
          "softwareId",
          "search",
          "sort"
        ],
        "handle": "connection",
        "key": "softwareVulnerabilitiesTable_softwareVulnerabilities",
        "kind": "LinkedHandle",
        "name": "softwareVulnerabilities"
      }
    ]
  },
  "params": {
    "cacheID": "902c2a2f711773333633efcb69f913fe",
    "id": null,
    "metadata": {},
    "name": "softwareVulnerabilitiesTablePaginationQuery",
    "operationKind": "query",
    "text": "query softwareVulnerabilitiesTablePaginationQuery(\n  $after: String\n  $first: Int = 20\n  $search: String\n  $softwareId: ID!\n  $sort: SortInput\n) {\n  ...softwareVulnerabilitiesTable_query_2rY1dD\n}\n\nfragment softwareVulnerabilitiesTable_query_2rY1dD on Query {\n  softwareVulnerabilities(softwareId: $softwareId, search: $search, sort: $sort, first: $first, after: $after) {\n    filteredCount\n    edges {\n      node {\n        cveId\n        affectedVersion\n        ...softwareVulnerabilityVersionCell_vulnerability\n        ...softwareVulnerabilityDiscoveredCell_vulnerability\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}\n\nfragment softwareVulnerabilityDiscoveredCell_vulnerability on SoftwareVulnerability {\n  discoveredAt\n}\n\nfragment softwareVulnerabilityVersionCell_vulnerability on SoftwareVulnerability {\n  affectedVersion\n}\n"
  }
};
})();

(node as any).hash = "489de72204e5decf4a6f7c4e426bd117";

export default node;
