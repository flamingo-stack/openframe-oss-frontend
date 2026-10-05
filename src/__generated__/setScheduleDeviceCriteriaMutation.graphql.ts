/**
 * @generated SignedSource<<5328183c10525589ab8638d6076f07f8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type DeviceType = "CONTAINER_HOST" | "DESKTOP" | "IOT_DEVICE" | "LAPTOP" | "MOBILE_DEVICE" | "NETWORK_DEVICE" | "OTHER" | "SERVER" | "TABLET" | "VIRTUAL_MACHINE" | "%future added value";
export type ScheduleDeviceSelectionMode = "CRITERIA" | "SPECIFIC" | "%future added value";
export type ScheduleDeviceCriteriaInput = {
  deviceTypes?: ReadonlyArray<DeviceType> | null | undefined;
  organizationIds?: ReadonlyArray<string> | null | undefined;
  osTypes?: ReadonlyArray<string> | null | undefined;
};
export type setScheduleDeviceCriteriaMutation$variables = {
  criteria: ScheduleDeviceCriteriaInput;
  scheduleId: string;
};
export type setScheduleDeviceCriteriaMutation$data = {
  readonly setScheduleDeviceCriteria: {
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
export type setScheduleDeviceCriteriaMutation = {
  response: setScheduleDeviceCriteriaMutation$data;
  variables: setScheduleDeviceCriteriaMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "criteria"
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
        "name": "criteria",
        "variableName": "criteria"
      },
      {
        "kind": "Variable",
        "name": "scheduleId",
        "variableName": "scheduleId"
      }
    ],
    "concreteType": "ScriptSchedule",
    "kind": "LinkedField",
    "name": "setScheduleDeviceCriteria",
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
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "setScheduleDeviceCriteriaMutation",
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
    "name": "setScheduleDeviceCriteriaMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "9f02a8c6ab92d7a62d802a5e5382699f",
    "id": null,
    "metadata": {},
    "name": "setScheduleDeviceCriteriaMutation",
    "operationKind": "mutation",
    "text": "mutation setScheduleDeviceCriteriaMutation(\n  $scheduleId: ID!\n  $criteria: ScheduleDeviceCriteriaInput!\n) {\n  setScheduleDeviceCriteria(scheduleId: $scheduleId, criteria: $criteria) {\n    id\n    deviceCount\n    selectionMode\n    deviceCriteria {\n      organizationIds\n      deviceTypes\n      osTypes\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "55bc7505381f5c5bafc3a4c07fc3b663";

export default node;
