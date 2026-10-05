/**
 * @generated SignedSource<<f52ef842ddb07fafd9fa80d81a512d3b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type DeviceStatus = "ACTIVE" | "ARCHIVED" | "DECOMMISSIONED" | "DELETED" | "INACTIVE" | "MAINTENANCE" | "OFFLINE" | "ONLINE" | "PENDING" | "PENDING_DELETION" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type relayItemsDevices_query$data = {
  readonly devices: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly displayName: string | null | undefined;
        readonly hostname: string | null | undefined;
        readonly id: string;
        readonly machineId: string;
        readonly nickname: string | null | undefined;
        readonly status: DeviceStatus | null | undefined;
      };
    }>;
  };
  readonly " $fragmentType": "relayItemsDevices_query";
};
export type relayItemsDevices_query$key = {
  readonly " $data"?: relayItemsDevices_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"relayItemsDevices_query">;
};

import relayItemsDevicesPaginationQuery_graphql from './relayItemsDevicesPaginationQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "devices"
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
      "operation": relayItemsDevicesPaginationQuery_graphql
    }
  },
  "name": "relayItemsDevices_query",
  "selections": [
    {
      "alias": "devices",
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
      "concreteType": "DeviceConnection",
      "kind": "LinkedField",
      "name": "__relayItemsDevices_devices_connection",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "DeviceEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "Machine",
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
                  "name": "machineId",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "hostname",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "displayName",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "nickname",
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

(node as any).hash = "ac4dae0890579a630e12dc063380b874";

export default node;
