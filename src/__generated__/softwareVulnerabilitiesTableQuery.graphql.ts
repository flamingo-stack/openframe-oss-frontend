/**
 * @generated SignedSource<<dedf3fa8a3e1d2db56ea0df86e197a93>>
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
export type softwareVulnerabilitiesTableQuery$variables = {
  after?: string | null | undefined;
  first: number;
  search?: string | null | undefined;
  softwareId: string;
  sort?: SortInput | null | undefined;
};
export type softwareVulnerabilitiesTableQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"softwareVulnerabilitiesTable_query">;
};
export type softwareVulnerabilitiesTableQuery = {
  response: softwareVulnerabilitiesTableQuery$data;
  variables: softwareVulnerabilitiesTableQuery$variables;
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
  "name": "search"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "softwareId"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "sort"
},
v5 = [
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
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/),
      (v4/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "softwareVulnerabilitiesTableQuery",
    "selections": [
      {
        "args": (v5/*: any*/),
        "kind": "FragmentSpread",
        "name": "softwareVulnerabilitiesTable_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v3/*: any*/),
      (v2/*: any*/),
      (v4/*: any*/),
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "softwareVulnerabilitiesTableQuery",
    "selections": [
      {
        "alias": null,
        "args": (v5/*: any*/),
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
        "args": (v5/*: any*/),
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
    "cacheID": "7f8aa484a5240ffd6719f6f271de3ee0",
    "id": null,
    "metadata": {},
    "name": "softwareVulnerabilitiesTableQuery",
    "operationKind": "query",
    "text": "query softwareVulnerabilitiesTableQuery(\n  $softwareId: ID!\n  $search: String\n  $sort: SortInput\n  $first: Int!\n  $after: String\n) {\n  ...softwareVulnerabilitiesTable_query_2rY1dD\n}\n\nfragment softwareVulnerabilitiesTable_query_2rY1dD on Query {\n  softwareVulnerabilities(softwareId: $softwareId, search: $search, sort: $sort, first: $first, after: $after) {\n    filteredCount\n    edges {\n      node {\n        cveId\n        affectedVersion\n        ...softwareVulnerabilityVersionCell_vulnerability\n        ...softwareVulnerabilityDiscoveredCell_vulnerability\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}\n\nfragment softwareVulnerabilityDiscoveredCell_vulnerability on SoftwareVulnerability {\n  discoveredAt\n}\n\nfragment softwareVulnerabilityVersionCell_vulnerability on SoftwareVulnerability {\n  affectedVersion\n}\n"
  }
};
})();

(node as any).hash = "11f0fa84621f46e5218db7ab316b93be";

export default node;
