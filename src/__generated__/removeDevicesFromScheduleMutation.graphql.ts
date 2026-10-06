/**
 * @generated SignedSource<<7c220859d89028549d7e21a50ad94879>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type DeviceType = "CONTAINER_HOST" | "DESKTOP" | "IOT_DEVICE" | "LAPTOP" | "MOBILE_DEVICE" | "NETWORK_DEVICE" | "OTHER" | "SERVER" | "TABLET" | "VIRTUAL_MACHINE" | "%future added value";
export type ScheduleDeviceSelectionMode = "CRITERIA" | "SPECIFIC" | "%future added value";
export type removeDevicesFromScheduleMutation$variables = {
  machineIds: ReadonlyArray<string>;
  scheduleId: string;
};
export type removeDevicesFromScheduleMutation$data = {
  readonly removeDevicesFromSchedule: {
    readonly deviceCriteria: {
      readonly deviceTypes: ReadonlyArray<DeviceType> | null | undefined;
      readonly organizationIds: ReadonlyArray<string> | null | undefined;
      readonly osTypes: ReadonlyArray<string> | null | undefined;
    } | null | undefined;
    readonly id: string;
    readonly selectionMode: ScheduleDeviceSelectionMode;
  };
};
export type removeDevicesFromScheduleMutation = {
  response: removeDevicesFromScheduleMutation$data;
  variables: removeDevicesFromScheduleMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "machineIds"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "scheduleId"
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "machineIds",
        "variableName": "machineIds"
      },
      {
        "kind": "Variable",
        "name": "scheduleId",
        "variableName": "scheduleId"
      }
    ],
    "concreteType": "ScriptSchedule",
    "kind": "LinkedField",
    "name": "removeDevicesFromSchedule",
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
        "name": "selectionMode",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "ScheduleDeviceCriteria",
        "kind": "LinkedField",
        "name": "deviceCriteria",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "organizationIds",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "deviceTypes",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "osTypes",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "removeDevicesFromScheduleMutation",
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "removeDevicesFromScheduleMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "8cb23a3351d26d4d7f1ab6a694d2e3ea",
    "id": null,
    "metadata": {},
    "name": "removeDevicesFromScheduleMutation",
    "operationKind": "mutation",
    "text": "mutation removeDevicesFromScheduleMutation(\n  $scheduleId: ID!\n  $machineIds: [ID!]!\n) {\n  removeDevicesFromSchedule(scheduleId: $scheduleId, machineIds: $machineIds) {\n    id\n    selectionMode\n    deviceCriteria {\n      organizationIds\n      deviceTypes\n      osTypes\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6e85506a71fd6741ff71e8ed5202d61a";

export default node;
