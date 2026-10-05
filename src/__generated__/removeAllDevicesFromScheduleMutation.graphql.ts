/**
 * @generated SignedSource<<0e9668af08bd19888d26019f541e6f0c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type DeviceStatus = "ACTIVE" | "ARCHIVED" | "DECOMMISSIONED" | "DELETED" | "INACTIVE" | "MAINTENANCE" | "OFFLINE" | "ONLINE" | "PENDING" | "PENDING_DELETION" | "%future added value";
export type DeviceType = "CONTAINER_HOST" | "DESKTOP" | "IOT_DEVICE" | "LAPTOP" | "MOBILE_DEVICE" | "NETWORK_DEVICE" | "OTHER" | "SERVER" | "TABLET" | "VIRTUAL_MACHINE" | "%future added value";
export type ScheduleDeviceSelectionMode = "CRITERIA" | "SPECIFIC" | "%future added value";
export type DeviceFilterInput = {
  deviceTypes?: ReadonlyArray<DeviceType> | null | undefined;
  organizationIds?: ReadonlyArray<string> | null | undefined;
  osTypes?: ReadonlyArray<string> | null | undefined;
  statuses?: ReadonlyArray<DeviceStatus> | null | undefined;
  tagKeys?: ReadonlyArray<string> | null | undefined;
  tagValues?: ReadonlyArray<string> | null | undefined;
};
export type removeAllDevicesFromScheduleMutation$variables = {
  filter?: DeviceFilterInput | null | undefined;
  scheduleId: string;
  search?: string | null | undefined;
};
export type removeAllDevicesFromScheduleMutation$data = {
  readonly removeAllDevicesFromSchedule: {
    readonly deviceCount: number;
    readonly deviceCriteria: {
      readonly deviceTypes: ReadonlyArray<DeviceType> | null | undefined;
      readonly organizationIds: ReadonlyArray<string> | null | undefined;
      readonly osTypes: ReadonlyArray<string> | null | undefined;
    } | null | undefined;
    readonly id: string;
    readonly selectionMode: ScheduleDeviceSelectionMode;
  };
};
export type removeAllDevicesFromScheduleMutation = {
  response: removeAllDevicesFromScheduleMutation$data;
  variables: removeAllDevicesFromScheduleMutation$variables;
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
  "name": "scheduleId"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "search"
},
v3 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "filter",
        "variableName": "filter"
      },
      {
        "kind": "Variable",
        "name": "scheduleId",
        "variableName": "scheduleId"
      },
      {
        "kind": "Variable",
        "name": "search",
        "variableName": "search"
      }
    ],
    "concreteType": "ScriptSchedule",
    "kind": "LinkedField",
    "name": "removeAllDevicesFromSchedule",
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
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "removeAllDevicesFromScheduleMutation",
    "selections": (v3/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Operation",
    "name": "removeAllDevicesFromScheduleMutation",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "030f53c6683b15a790702a6d1acb3993",
    "id": null,
    "metadata": {},
    "name": "removeAllDevicesFromScheduleMutation",
    "operationKind": "mutation",
    "text": "mutation removeAllDevicesFromScheduleMutation(\n  $scheduleId: ID!\n  $filter: DeviceFilterInput\n  $search: String\n) {\n  removeAllDevicesFromSchedule(scheduleId: $scheduleId, filter: $filter, search: $search) {\n    id\n    deviceCount\n    selectionMode\n    deviceCriteria {\n      organizationIds\n      deviceTypes\n      osTypes\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "637676e22de664cd69af782ec774edd1";

export default node;
