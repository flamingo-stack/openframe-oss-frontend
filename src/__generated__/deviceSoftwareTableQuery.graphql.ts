/**
 * @generated SignedSource<<49689169110d03b7314978613d0cd1bb>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type deviceSoftwareTableQuery$variables = {
  after?: string | null | undefined;
  first: number;
  machineId: string;
  search?: string | null | undefined;
};
export type deviceSoftwareTableQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"deviceSoftwareTable_query">;
};
export type deviceSoftwareTableQuery = {
  response: deviceSoftwareTableQuery$data;
  variables: deviceSoftwareTableQuery$variables;
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
    "name": "deviceSoftwareTableQuery",
    "selections": [
      {
        "args": (v4/*: any*/),
        "kind": "FragmentSpread",
        "name": "deviceSoftwareTable_query"
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
    "name": "deviceSoftwareTableQuery",
    "selections": [
      {
        "alias": null,
        "args": (v4/*: any*/),
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
        "args": (v4/*: any*/),
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
    "cacheID": "a274a7581738a02a4768952802bb4162",
    "id": null,
    "metadata": {},
    "name": "deviceSoftwareTableQuery",
    "operationKind": "query",
    "text": "query deviceSoftwareTableQuery(\n  $machineId: String!\n  $search: String\n  $first: Int!\n  $after: String\n) {\n  ...deviceSoftwareTable_query_3afdNg\n}\n\nfragment deviceSoftwareTable_query_3afdNg on Query {\n  deviceSoftware(machineId: $machineId, search: $search, first: $first, after: $after) {\n    filteredCount\n    edges {\n      node {\n        ...softwareTable_software\n        id\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}\n\nfragment softwareNameCell_software on Software {\n  name\n  publisher\n}\n\nfragment softwareTable_software on Software {\n  id\n  ...softwareNameCell_software\n  ...softwareVersionCell_software\n  ...softwareVulnerabilitiesCell_software\n}\n\nfragment softwareVersionCell_software on Software {\n  currentVersion\n  versionStatus\n  olderVersionsCount\n}\n\nfragment softwareVulnerabilitiesCell_software on Software {\n  cpeMatched\n  vulnerabilitySummary {\n    cveCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "9c3208a9e759545c277797bf5d91c5ef";

export default node;
