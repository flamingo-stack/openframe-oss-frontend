/**
 * @generated SignedSource<<7b97675c0930dec1c03933162a3fb230>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type DeviceType = "CONTAINER_HOST" | "DESKTOP" | "IOT_DEVICE" | "LAPTOP" | "MOBILE_DEVICE" | "NETWORK_DEVICE" | "OTHER" | "SERVER" | "TABLET" | "VIRTUAL_MACHINE" | "%future added value";
export type OsType = "MAC_OS" | "WINDOWS" | "%future added value";
export type ScheduleDeviceSelectionMode = "CRITERIA" | "SPECIFIC" | "%future added value";
export type ScheduleOfflineBehavior = "RETRY_ON_RECONNECT" | "SKIP" | "%future added value";
export type ScheduleTimeReference = "DEVICE_LOCAL" | "SERVER" | "%future added value";
export type ScriptScheduleTrigger = "DATE_TIME" | "DEVICE_ONLINE" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { Long } from "../lib/graphql-scalars";
export type scriptScheduleDevicesSettingsRelayQuery$variables = {
  id: string;
};
export type scriptScheduleDevicesSettingsRelayQuery$data = {
  readonly scriptSchedule: {
    readonly description: string | null | undefined;
    readonly deviceCriteria: {
      readonly deviceTypes: ReadonlyArray<DeviceType> | null | undefined;
      readonly organizationIds: ReadonlyArray<string> | null | undefined;
      readonly osTypes: ReadonlyArray<string> | null | undefined;
    } | null | undefined;
    readonly id: string;
    readonly name: string;
    readonly offlineBehavior: ScheduleOfflineBehavior;
    readonly reconnectWindowSeconds: Long | null | undefined;
    readonly repeat: Long | null | undefined;
    readonly scriptCustomParams: ReadonlyArray<{
      readonly args: ReadonlyArray<string> | null | undefined;
      readonly envVars: ReadonlyArray<{
        readonly name: string;
        readonly secret: boolean;
        readonly value: string | null | undefined;
      }> | null | undefined;
      readonly scriptId: string;
    }>;
    readonly scripts: ReadonlyArray<{
      readonly id: string;
    }>;
    readonly selectionMode: ScheduleDeviceSelectionMode;
    readonly startAt: Instant | null | undefined;
    readonly supportedPlatforms: ReadonlyArray<OsType> | null | undefined;
    readonly timeReference: ScheduleTimeReference;
    readonly trigger: ScriptScheduleTrigger;
  };
};
export type scriptScheduleDevicesSettingsRelayQuery = {
  response: scriptScheduleDevicesSettingsRelayQuery$data;
  variables: scriptScheduleDevicesSettingsRelayQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
      }
    ],
    "concreteType": "ScriptSchedule",
    "kind": "LinkedField",
    "name": "scriptSchedule",
    "plural": false,
    "selections": [
      (v1/*: any*/),
      (v2/*: any*/),
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
        "name": "trigger",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "offlineBehavior",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "reconnectWindowSeconds",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "timeReference",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "startAt",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "repeat",
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
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "Script",
        "kind": "LinkedField",
        "name": "scripts",
        "plural": true,
        "selections": [
          (v1/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "ScheduledScriptCustomParams",
        "kind": "LinkedField",
        "name": "scriptCustomParams",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "scriptId",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "args",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "ScriptEnvVar",
            "kind": "LinkedField",
            "name": "envVars",
            "plural": true,
            "selections": [
              (v2/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "value",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "secret",
                "storageKey": null
              }
            ],
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "scriptScheduleDevicesSettingsRelayQuery",
    "selections": (v3/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "scriptScheduleDevicesSettingsRelayQuery",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "8ebbbd9fb0ed0bda7e71b56db3a228b4",
    "id": null,
    "metadata": {},
    "name": "scriptScheduleDevicesSettingsRelayQuery",
    "operationKind": "query",
    "text": "query scriptScheduleDevicesSettingsRelayQuery(\n  $id: ID!\n) {\n  scriptSchedule(id: $id) {\n    id\n    name\n    description\n    supportedPlatforms\n    trigger\n    offlineBehavior\n    reconnectWindowSeconds\n    timeReference\n    startAt\n    repeat\n    selectionMode\n    deviceCriteria {\n      organizationIds\n      deviceTypes\n      osTypes\n    }\n    scripts {\n      id\n    }\n    scriptCustomParams {\n      scriptId\n      args\n      envVars {\n        name\n        value\n        secret\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "0791591f4c37e352fe211a545d7e486b";

export default node;
