/**
 * @generated SignedSource<<afc366f149cfd296bfebec7727547fde>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type DeviceStatus = "ACTIVE" | "ARCHIVED" | "DECOMMISSIONED" | "DELETED" | "INACTIVE" | "MAINTENANCE" | "OFFLINE" | "ONLINE" | "PENDING" | "PENDING_DELETION" | "%future added value";
export type DeviceType = "CONTAINER_HOST" | "DESKTOP" | "IOT_DEVICE" | "LAPTOP" | "MOBILE_DEVICE" | "NETWORK_DEVICE" | "OTHER" | "SERVER" | "TABLET" | "VIRTUAL_MACHINE" | "%future added value";
export type DeviceFilterInput = {
  deviceTypes?: ReadonlyArray<DeviceType> | null | undefined;
  organizationIds?: ReadonlyArray<string> | null | undefined;
  osTypes?: ReadonlyArray<string> | null | undefined;
  statuses?: ReadonlyArray<DeviceStatus> | null | undefined;
  tagKeys?: ReadonlyArray<string> | null | undefined;
  tagValues?: ReadonlyArray<string> | null | undefined;
};
export type relayItemsDevicesListQuery$variables = {
  filter?: DeviceFilterInput | null | undefined;
  first?: number | null | undefined;
  search?: string | null | undefined;
};
export type relayItemsDevicesListQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"relayItemsDevices_query">;
};
export type relayItemsDevicesListQuery = {
  response: relayItemsDevicesListQuery$data;
  variables: relayItemsDevicesListQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filter"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "first"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "search"
},
v3 = [
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
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "relayItemsDevicesListQuery",
    "selections": [
      {
        "args": (v3/*: any*/),
        "kind": "FragmentSpread",
        "name": "relayItemsDevices_query"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v2/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "relayItemsDevicesListQuery",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": "DeviceConnection",
        "kind": "LinkedField",
        "name": "devices",
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
      },
      {
        "alias": null,
        "args": (v3/*: any*/),
        "filters": [
          "filter",
          "search"
        ],
        "handle": "connection",
        "key": "relayItemsDevices_devices",
        "kind": "LinkedHandle",
        "name": "devices"
      }
    ]
  },
  "params": {
    "cacheID": "6c2a00a4a74baba88768525fcaeae701",
    "id": null,
    "metadata": {},
    "name": "relayItemsDevicesListQuery",
    "operationKind": "query",
    "text": "query relayItemsDevicesListQuery(\n  $filter: DeviceFilterInput\n  $search: String\n  $first: Int\n) {\n  ...relayItemsDevices_query_Dmzkx\n}\n\nfragment relayItemsDevices_query_Dmzkx on Query {\n  devices(filter: $filter, search: $search, first: $first) {\n    edges {\n      node {\n        id\n        machineId\n        hostname\n        displayName\n        nickname\n        status\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5ae839acb513ca60d3de9afb9bd9a0e3";

export default node;
