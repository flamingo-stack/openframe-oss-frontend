/**
 * @generated SignedSource<<4ce32becad6be278eab015ff1a77de8f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
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
export type useBundleDeviceAssignmentRemoveAllMutation$variables = {
  bundleId: string;
  filter?: DeviceFilterInput | null | undefined;
  search?: string | null | undefined;
};
export type useBundleDeviceAssignmentRemoveAllMutation$data = {
  readonly removeAllDevicesFromSoftwareBundle: {
    readonly deviceCount: number;
    readonly id: string;
  };
};
export type useBundleDeviceAssignmentRemoveAllMutation = {
  response: useBundleDeviceAssignmentRemoveAllMutation$data;
  variables: useBundleDeviceAssignmentRemoveAllMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "bundleId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "filter"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "search"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "bundleId",
        "variableName": "bundleId"
      },
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
    "concreteType": "SoftwareBundle",
    "kind": "LinkedField",
    "name": "removeAllDevicesFromSoftwareBundle",
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
        "name": "deviceCount",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useBundleDeviceAssignmentRemoveAllMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useBundleDeviceAssignmentRemoveAllMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "53e6b420aae0f5d513cf25a01e75b315",
    "id": null,
    "metadata": {},
    "name": "useBundleDeviceAssignmentRemoveAllMutation",
    "operationKind": "mutation",
    "text": "mutation useBundleDeviceAssignmentRemoveAllMutation(\n  $bundleId: ID!\n  $filter: DeviceFilterInput\n  $search: String\n) {\n  removeAllDevicesFromSoftwareBundle(bundleId: $bundleId, filter: $filter, search: $search) {\n    id\n    deviceCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "92ce5bbcd4251b12d0c45d6867f38bb8";

export default node;
