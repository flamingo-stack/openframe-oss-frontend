/**
 * @generated SignedSource<<9f0a9513c0f65ab2315e301d03df2199>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
import type { Instant } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type deviceLogsList_query$data = {
  readonly deviceLogs: {
    readonly edges: ReadonlyArray<{
      readonly cursor: string;
      readonly node: {
        readonly timestamp: Instant;
        readonly " $fragmentSpreads": FragmentRefs<"deviceLogRow_entry">;
      };
    }>;
  };
  readonly " $fragmentType": "deviceLogsList_query";
};
export type deviceLogsList_query$key = {
  readonly " $data"?: deviceLogsList_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"deviceLogsList_query">;
};

import deviceLogsListPaginationQuery_graphql from './deviceLogsListPaginationQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "deviceLogs"
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
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "first"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "machineId"
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
      "operation": deviceLogsListPaginationQuery_graphql
    }
  },
  "name": "deviceLogsList_query",
  "selections": [
    {
      "alias": "deviceLogs",
      "args": [
        {
          "kind": "Variable",
          "name": "filter",
          "variableName": "filter"
        },
        {
          "kind": "Variable",
          "name": "machineId",
          "variableName": "machineId"
        }
      ],
      "concreteType": "DeviceLogConnection",
      "kind": "LinkedField",
      "name": "__deviceLogsList_deviceLogs_connection",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "DeviceLogEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "cursor",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "DeviceLogEntry",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "timestamp",
                  "storageKey": null
                },
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "deviceLogRow_entry"
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

(node as any).hash = "38b978cd8d6840016a03d29c2286c159";

export default node;
