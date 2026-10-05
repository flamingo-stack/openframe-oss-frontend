/**
 * @generated SignedSource<<400ee5a8295db9ad0e24b14b0ca80a12>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type PackageManagerType = "BREW" | "CHOCO" | "WINGET" | "%future added value";
export type SoftwareAction = "INSTALL" | "UPDATE" | "%future added value";
export type SoftwareActionStatus = "COMPLETED" | "FAILED" | "IN_PROGRESS" | "SCHEDULED" | "%future added value";
export type SoftwareActionFilterInput = {
  actions?: ReadonlyArray<SoftwareAction> | null | undefined;
  engines?: ReadonlyArray<PackageManagerType> | null | undefined;
  statuses?: ReadonlyArray<SoftwareActionStatus> | null | undefined;
};
export type softwareActionsTableQuery$variables = {
  after?: string | null | undefined;
  filter?: SoftwareActionFilterInput | null | undefined;
  first: number;
  search?: string | null | undefined;
};
export type softwareActionsTableQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"softwareActionsTable_query">;
};
export type softwareActionsTableQuery = {
  response: softwareActionsTableQuery$data;
  variables: softwareActionsTableQuery$variables;
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
  "name": "filter"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "first"
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
    "name": "filter",
    "variableName": "filter"
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
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "softwareActionsTableQuery",
    "selections": [
      {
        "args": (v4/*: any*/),
        "kind": "FragmentSpread",
        "name": "softwareActionsTable_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v3/*: any*/),
      (v2/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "softwareActionsTableQuery",
    "selections": [
      {
        "alias": null,
        "args": (v4/*: any*/),
        "concreteType": "SoftwareActionRunConnection",
        "kind": "LinkedField",
        "name": "softwareActions",
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
            "concreteType": "SoftwareActionRunEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "SoftwareActionRun",
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
                    "name": "software",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "action",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "engine",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "status",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "scheduledAt",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "respondedMachineCount",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "totalMachineCount",
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
          "filter",
          "search"
        ],
        "handle": "connection",
        "key": "softwareActionsTable_softwareActions",
        "kind": "LinkedHandle",
        "name": "softwareActions"
      }
    ]
  },
  "params": {
    "cacheID": "5bb4eef211e59b9039f2ba24f9284d73",
    "id": null,
    "metadata": {},
    "name": "softwareActionsTableQuery",
    "operationKind": "query",
    "text": "query softwareActionsTableQuery(\n  $filter: SoftwareActionFilterInput\n  $search: String\n  $first: Int!\n  $after: String\n) {\n  ...softwareActionsTable_query_2zR4qx\n}\n\nfragment softwareActionEngineCell_action on SoftwareActionRun {\n  engine\n}\n\nfragment softwareActionProcessedCell_action on SoftwareActionRun {\n  respondedMachineCount\n  totalMachineCount\n}\n\nfragment softwareActionStatusCell_action on SoftwareActionRun {\n  status\n  scheduledAt\n}\n\nfragment softwareActionTypeCell_action on SoftwareActionRun {\n  action\n}\n\nfragment softwareActionsTable_query_2zR4qx on Query {\n  softwareActions(filter: $filter, search: $search, first: $first, after: $after) {\n    filteredCount\n    edges {\n      node {\n        id\n        software\n        action\n        engine\n        status\n        ...softwareActionTypeCell_action\n        ...softwareActionEngineCell_action\n        ...softwareActionStatusCell_action\n        ...softwareActionProcessedCell_action\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "130cf1659e1ee7224e1729fd865a2421";

export default node;
