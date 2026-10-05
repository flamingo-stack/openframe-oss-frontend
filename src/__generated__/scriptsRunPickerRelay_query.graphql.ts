/**
 * @generated SignedSource<<8cd8214cce9ddae84962658f350bda84>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type OsType = "MAC_OS" | "WINDOWS" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type scriptsRunPickerRelay_query$data = {
  readonly scripts: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly description: string | null | undefined;
        readonly id: string;
        readonly name: string;
        readonly supportedPlatforms: ReadonlyArray<OsType> | null | undefined;
      };
    }>;
  };
  readonly " $fragmentType": "scriptsRunPickerRelay_query";
};
export type scriptsRunPickerRelay_query$key = {
  readonly " $data"?: scriptsRunPickerRelay_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"scriptsRunPickerRelay_query">;
};

import scriptsRunPickerRelayPaginationQuery_graphql from './scriptsRunPickerRelayPaginationQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "scripts"
];
return {
  "argumentDefinitions": [
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
      "name": "tagIds"
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
      "operation": scriptsRunPickerRelayPaginationQuery_graphql
    }
  },
  "name": "scriptsRunPickerRelay_query",
  "selections": [
    {
      "alias": "scripts",
      "args": [
        {
          "fields": [
            {
              "kind": "Literal",
              "name": "statuses",
              "value": [
                "ACTIVE"
              ]
            },
            {
              "kind": "Variable",
              "name": "tagIds",
              "variableName": "tagIds"
            }
          ],
          "kind": "ObjectValue",
          "name": "filter"
        },
        {
          "kind": "Variable",
          "name": "search",
          "variableName": "search"
        }
      ],
      "concreteType": "ScriptConnection",
      "kind": "LinkedField",
      "name": "__scriptsRunPickerRelay_scripts_connection",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "ScriptEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "Script",
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
                  "name": "description",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "supportedPlatforms",
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

(node as any).hash = "81865a06c54f161867eb0d839bc9ee2a";

export default node;
