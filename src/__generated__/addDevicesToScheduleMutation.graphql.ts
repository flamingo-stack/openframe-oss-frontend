/**
 * @generated SignedSource<<95a2624ddac0944d8b3e6e8ee3ff207d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type DeviceType = "CONTAINER_HOST" | "DESKTOP" | "IOT_DEVICE" | "LAPTOP" | "MOBILE_DEVICE" | "NETWORK_DEVICE" | "OTHER" | "SERVER" | "TABLET" | "VIRTUAL_MACHINE" | "%future added value";
export type ScheduleDeviceSelectionMode = "CRITERIA" | "SPECIFIC" | "%future added value";
export type addDevicesToScheduleMutation$variables = {
  machineIds: ReadonlyArray<string>;
  scheduleId: string;
};
export type addDevicesToScheduleMutation$data = {
  readonly addDevicesToSchedule: {
    readonly deviceCriteria: {
      readonly deviceTypes: ReadonlyArray<DeviceType> | null | undefined;
      readonly organizationIds: ReadonlyArray<string> | null | undefined;
      readonly osTypes: ReadonlyArray<string> | null | undefined;
    } | null | undefined;
    readonly id: string;
    readonly selectionMode: ScheduleDeviceSelectionMode;
  };
};
export type addDevicesToScheduleMutation = {
  response: addDevicesToScheduleMutation$data;
  variables: addDevicesToScheduleMutation$variables;
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
    "name": "addDevicesToSchedule",
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
    "name": "addDevicesToScheduleMutation",
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
    "name": "addDevicesToScheduleMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "c772988946a7d5f01fa8565f3a19a424",
    "id": null,
    "metadata": {},
    "name": "addDevicesToScheduleMutation",
    "operationKind": "mutation",
    "text": "mutation addDevicesToScheduleMutation(\n  $scheduleId: ID!\n  $machineIds: [ID!]!\n) {\n  addDevicesToSchedule(scheduleId: $scheduleId, machineIds: $machineIds) {\n    id\n    selectionMode\n    deviceCriteria {\n      organizationIds\n      deviceTypes\n      osTypes\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "7c6b135ef844720665728a06e09913a9";

export default node;
