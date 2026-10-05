/**
 * @generated SignedSource<<93f2035932012eaa3acec0415877cef1>>
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
export type useBundleDeviceAssignmentAddAllMutation$variables = {
  bundleId: string;
  filter?: DeviceFilterInput | null | undefined;
  search?: string | null | undefined;
};
export type useBundleDeviceAssignmentAddAllMutation$data = {
  readonly addAllDevicesToSoftwareBundle: {
    readonly deviceCount: number;
    readonly id: string;
  };
};
export type useBundleDeviceAssignmentAddAllMutation = {
  response: useBundleDeviceAssignmentAddAllMutation$data;
  variables: useBundleDeviceAssignmentAddAllMutation$variables;
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
    "name": "addAllDevicesToSoftwareBundle",
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
    "name": "useBundleDeviceAssignmentAddAllMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useBundleDeviceAssignmentAddAllMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "eb84831e02bc5593ba921c29241ec72c",
    "id": null,
    "metadata": {},
    "name": "useBundleDeviceAssignmentAddAllMutation",
    "operationKind": "mutation",
    "text": "mutation useBundleDeviceAssignmentAddAllMutation(\n  $bundleId: ID!\n  $filter: DeviceFilterInput\n  $search: String\n) {\n  addAllDevicesToSoftwareBundle(bundleId: $bundleId, filter: $filter, search: $search) {\n    id\n    deviceCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "be26ccee9ca8a39cb6c5fa3eb8b4893b";

export default node;
