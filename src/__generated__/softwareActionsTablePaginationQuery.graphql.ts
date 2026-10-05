/**
 * @generated SignedSource<<541e985d58d025d7c64401345cb5d923>>
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
export type softwareActionsTablePaginationQuery$variables = {
  after?: string | null | undefined;
  filter?: SoftwareActionFilterInput | null | undefined;
  first?: number | null | undefined;
  search?: string | null | undefined;
};
export type softwareActionsTablePaginationQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"softwareActionsTable_query">;
};
export type softwareActionsTablePaginationQuery = {
  response: softwareActionsTablePaginationQuery$data;
  variables: softwareActionsTablePaginationQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "after"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "filter"
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "softwareActionsTablePaginationQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "softwareActionsTable_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "softwareActionsTablePaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
        "args": (v1/*: any*/),
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
    "cacheID": "eb699bbf29336eb3632ad9743200050d",
    "id": null,
    "metadata": {},
    "name": "softwareActionsTablePaginationQuery",
    "operationKind": "query",
    "text": "query softwareActionsTablePaginationQuery(\n  $after: String\n  $filter: SoftwareActionFilterInput\n  $first: Int = 20\n  $search: String\n) {\n  ...softwareActionsTable_query_2zR4qx\n}\n\nfragment softwareActionEngineCell_action on SoftwareActionRun {\n  engine\n}\n\nfragment softwareActionProcessedCell_action on SoftwareActionRun {\n  respondedMachineCount\n  totalMachineCount\n}\n\nfragment softwareActionStatusCell_action on SoftwareActionRun {\n  status\n  scheduledAt\n}\n\nfragment softwareActionTypeCell_action on SoftwareActionRun {\n  action\n}\n\nfragment softwareActionsTable_query_2zR4qx on Query {\n  softwareActions(filter: $filter, search: $search, first: $first, after: $after) {\n    filteredCount\n    edges {\n      node {\n        id\n        software\n        action\n        engine\n        status\n        ...softwareActionTypeCell_action\n        ...softwareActionEngineCell_action\n        ...softwareActionStatusCell_action\n        ...softwareActionProcessedCell_action\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "233395c5851fe90bd3bf9105ff0a212a";

export default node;
