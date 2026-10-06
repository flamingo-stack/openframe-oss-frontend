/**
 * @generated SignedSource<<83c00b9248d64944e1094db3a7ff7c7d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type KnowledgeBaseItemType = "ARTICLE" | "FOLDER" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type relayItemsKb_query$data = {
  readonly knowledgeBaseItems: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly name: string;
        readonly type: KnowledgeBaseItemType;
      };
    }>;
  };
  readonly " $fragmentType": "relayItemsKb_query";
};
export type relayItemsKb_query$key = {
  readonly " $data"?: relayItemsKb_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"relayItemsKb_query">;
};

import relayItemsKbPaginationQuery_graphql from './relayItemsKbPaginationQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "knowledgeBaseItems"
];
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": 10,
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
      "operation": relayItemsKbPaginationQuery_graphql
    }
  },
  "name": "relayItemsKb_query",
  "selections": [
    {
      "alias": "knowledgeBaseItems",
      "args": [
        {
          "kind": "Literal",
          "name": "filter",
          "value": {
            "type": "ARTICLE"
          }
        },
        {
          "kind": "Variable",
          "name": "search",
          "variableName": "search"
        }
      ],
      "concreteType": "KnowledgeBaseItemConnection",
      "kind": "LinkedField",
      "name": "__relayItemsKb_knowledgeBaseItems_connection",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "KnowledgeBaseItemEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "KnowledgeBaseItem",
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
                  "name": "type",
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
              "name": "endCursor",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "hasNextPage",
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

(node as any).hash = "37becdee3d4bc6d93d20a124b17fe247";

export default node;
