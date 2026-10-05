/**
 * @generated SignedSource<<18b5a132e79e618f815845ad5fce70bb>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type PackageManagerType = "BREW" | "CHOCO" | "WINGET" | "%future added value";
export type SoftwareAction = "INSTALL" | "UPDATE" | "%future added value";
export type SoftwareActionStatus = "COMPLETED" | "FAILED" | "IN_PROGRESS" | "SCHEDULED" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type softwareActionsTable_query$data = {
  readonly softwareActions: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly action: SoftwareAction;
        readonly engine: PackageManagerType;
        readonly id: string;
        readonly software: string;
        readonly status: SoftwareActionStatus;
        readonly " $fragmentSpreads": FragmentRefs<"softwareActionEngineCell_action" | "softwareActionProcessedCell_action" | "softwareActionStatusCell_action" | "softwareActionTypeCell_action">;
      };
    }>;
    readonly filteredCount: number;
    readonly pageInfo: {
      readonly endCursor: string | null | undefined;
      readonly hasNextPage: boolean;
    };
  };
  readonly " $fragmentType": "softwareActionsTable_query";
};
export type softwareActionsTable_query$key = {
  readonly " $data"?: softwareActionsTable_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"softwareActionsTable_query">;
};

import softwareActionsTablePaginationQuery_graphql from './softwareActionsTablePaginationQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "softwareActions"
];
return {
  "argumentDefinitions": [
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
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v0/*: any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v0/*: any*/)
      },
      "fragmentPathInResult": [],
      "operation": softwareActionsTablePaginationQuery_graphql
    }
  },
  "name": "softwareActionsTable_query",
  "selections": [
    {
      "alias": "softwareActions",
      "args": [
        {
          "kind": "Variable",
          "name": "filter",
          "variableName": "filter"
        },
        {
          "kind": "Variable",
          "name": "search",
          "variableName": "search"
        }
      ],
      "concreteType": "SoftwareActionRunConnection",
      "kind": "LinkedField",
      "name": "__softwareActionsTable_softwareActions_connection",
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
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "softwareActionTypeCell_action"
                },
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "softwareActionEngineCell_action"
                },
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "softwareActionStatusCell_action"
                },
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "softwareActionProcessedCell_action"
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
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "233395c5851fe90bd3bf9105ff0a212a";

export default node;
