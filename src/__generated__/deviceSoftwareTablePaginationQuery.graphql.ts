/**
 * @generated SignedSource<<374c01302ff87b824b0469b96fe6f200>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type deviceSoftwareTablePaginationQuery$variables = {
  after?: string | null | undefined;
  first?: number | null | undefined;
  machineId: string;
  search?: string | null | undefined;
};
export type deviceSoftwareTablePaginationQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"deviceSoftwareTable_query">;
};
export type deviceSoftwareTablePaginationQuery = {
  response: deviceSoftwareTablePaginationQuery$data;
  variables: deviceSoftwareTablePaginationQuery$variables;
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
    "name": "deviceSoftwareTablePaginationQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "deviceSoftwareTable_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "deviceSoftwareTablePaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "SoftwareConnection",
        "kind": "LinkedField",
        "name": "deviceSoftware",
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
          "machineId",
          "search"
        ],
        "handle": "connection",
        "key": "deviceSoftwareTable_deviceSoftware",
        "kind": "LinkedHandle",
        "name": "deviceSoftware"
      }
    ]
  },
  "params": {
    "cacheID": "942c6aa1ee4fe26a42ffd84e2a14de51",
    "id": null,
    "metadata": {},
    "name": "deviceSoftwareTablePaginationQuery",
    "operationKind": "query",
    "text": "query deviceSoftwareTablePaginationQuery(\n  $after: String\n  $first: Int = 20\n  $machineId: String!\n  $search: String\n) {\n  ...deviceSoftwareTable_query_3afdNg\n}\n\nfragment deviceSoftwareTable_query_3afdNg on Query {\n  deviceSoftware(machineId: $machineId, search: $search, first: $first, after: $after) {\n    filteredCount\n    edges {\n      node {\n        ...softwareTable_software\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}\n\nfragment softwareNameCell_software on Software {\n  name\n  publisher\n}\n\nfragment softwareTable_software on Software {\n  id\n  ...softwareNameCell_software\n  ...softwareVersionCell_software\n  ...softwareVulnerabilitiesCell_software\n}\n\nfragment softwareVersionCell_software on Software {\n  currentVersion\n  versionStatus\n  olderVersionsCount\n}\n\nfragment softwareVulnerabilitiesCell_software on Software {\n  cpeMatched\n  vulnerabilitySummary {\n    cveCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "6eb64e3c000bd30e6a2e8915af7a6c96";

export default node;
