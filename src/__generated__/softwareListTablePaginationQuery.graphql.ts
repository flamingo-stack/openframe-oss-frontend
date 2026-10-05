/**
 * @generated SignedSource<<f1845425d6a2e887f3d38d2d828d3eaa>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type softwareListTablePaginationQuery$variables = {
  after?: string | null | undefined;
  first?: number | null | undefined;
  search?: string | null | undefined;
};
export type softwareListTablePaginationQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"softwareListTable_query">;
};
export type softwareListTablePaginationQuery = {
  response: softwareListTablePaginationQuery$data;
  variables: softwareListTablePaginationQuery$variables;
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
    "name": "softwareListTablePaginationQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "softwareListTable_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "softwareListTablePaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "SoftwareConnection",
        "kind": "LinkedField",
        "name": "softwares",
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
                    "name": "versionStatus",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "olderVersionsCount",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "cpeMatched",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "SoftwareVulnerabilitySummary",
                    "kind": "LinkedField",
                    "name": "vulnerabilitySummary",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "cveCount",
                        "storageKey": null
                      }
                    ],
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
          "search"
        ],
        "handle": "connection",
        "key": "softwareListTable_softwares",
        "kind": "LinkedHandle",
        "name": "softwares"
      }
    ]
  },
  "params": {
    "cacheID": "e9a1242f3a874a78ea14da38c987a2c8",
    "id": null,
    "metadata": {},
    "name": "softwareListTablePaginationQuery",
    "operationKind": "query",
    "text": "query softwareListTablePaginationQuery(\n  $after: String\n  $first: Int = 20\n  $search: String\n) {\n  ...softwareListTable_query_1Ozsmw\n}\n\nfragment softwareListTable_query_1Ozsmw on Query {\n  softwares(search: $search, first: $first, after: $after) {\n    filteredCount\n    edges {\n      node {\n        ...softwareTable_software\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}\n\nfragment softwareNameCell_software on Software {\n  name\n  publisher\n}\n\nfragment softwareTable_software on Software {\n  id\n  ...softwareNameCell_software\n  ...softwareVersionCell_software\n  ...softwareVulnerabilitiesCell_software\n}\n\nfragment softwareVersionCell_software on Software {\n  currentVersion\n  versionStatus\n  olderVersionsCount\n}\n\nfragment softwareVulnerabilitiesCell_software on Software {\n  cpeMatched\n  vulnerabilitySummary {\n    cveCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "928ce50fda109eab863cb85baea3c8c3";

export default node;
