/**
 * @generated SignedSource<<5cccf8b8b66e0b5d7a0c299837454942>>
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
export type ScriptShell = "BASH" | "CMD" | "NUSHELL" | "POWERSHELL" | "PYTHON" | "SHELL" | "%future added value";
export type ScriptStatus = "ACTIVE" | "ARCHIVED" | "DELETED" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { Long } from "../lib/graphql-scalars";
export type scriptScheduleDetailRelayQuery$variables = {
  id: string;
};
export type scriptScheduleDetailRelayQuery$data = {
  readonly scriptSchedule: {
    readonly author: {
      readonly email: string | null | undefined;
      readonly firstName: string | null | undefined;
      readonly id: string;
      readonly lastName: string | null | undefined;
    } | null | undefined;
    readonly description: string | null | undefined;
    readonly deviceCount: number;
    readonly deviceCriteria: {
      readonly deviceTypes: ReadonlyArray<DeviceType> | null | undefined;
      readonly organizationIds: ReadonlyArray<string> | null | undefined;
      readonly osTypes: ReadonlyArray<string> | null | undefined;
    } | null | undefined;
    readonly id: string;
    readonly lastRunAt: Instant | null | undefined;
    readonly name: string;
    readonly nextRunAt: Instant | null | undefined;
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
      readonly defaultArgs: ReadonlyArray<string> | null | undefined;
      readonly defaultTimeoutSeconds: number | null | undefined;
      readonly envVars: ReadonlyArray<{
        readonly name: string;
        readonly secret: boolean;
        readonly value: string | null | undefined;
      }> | null | undefined;
      readonly id: string;
      readonly name: string;
      readonly scriptBody: string;
      readonly shell: ScriptShell;
      readonly supportedPlatforms: ReadonlyArray<OsType> | null | undefined;
    }>;
    readonly selectionMode: ScheduleDeviceSelectionMode;
    readonly startAt: Instant | null | undefined;
    readonly status: ScriptStatus;
    readonly supportedPlatforms: ReadonlyArray<OsType> | null | undefined;
    readonly timeReference: ScheduleTimeReference;
    readonly trigger: ScriptScheduleTrigger;
  };
};
export type scriptScheduleDetailRelayQuery = {
  response: scriptScheduleDetailRelayQuery$data;
  variables: scriptScheduleDetailRelayQuery$variables;
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
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "supportedPlatforms",
  "storageKey": null
},
v4 = {
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
},
v5 = [
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
      (v3/*: any*/),
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
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "author",
        "plural": false,
        "selections": [
          (v1/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "firstName",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "lastName",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "email",
            "storageKey": null
          }
        ],
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
        "name": "nextRunAt",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "lastRunAt",
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
          (v1/*: any*/),
          (v2/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "shell",
            "storageKey": null
          },
          (v3/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "defaultTimeoutSeconds",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "defaultArgs",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "scriptBody",
            "storageKey": null
          },
          (v4/*: any*/)
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
          (v4/*: any*/)
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
    "name": "scriptScheduleDetailRelayQuery",
    "selections": (v5/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "scriptScheduleDetailRelayQuery",
    "selections": (v5/*: any*/)
  },
  "params": {
    "cacheID": "871349271d78424bcf02b030cdde32db",
    "id": null,
    "metadata": {},
    "name": "scriptScheduleDetailRelayQuery",
    "operationKind": "query",
    "text": "query scriptScheduleDetailRelayQuery(\n  $id: ID!\n) {\n  scriptSchedule(id: $id) {\n    id\n    name\n    description\n    supportedPlatforms\n    status\n    author {\n      id\n      firstName\n      lastName\n      email\n    }\n    deviceCount\n    selectionMode\n    deviceCriteria {\n      organizationIds\n      deviceTypes\n      osTypes\n    }\n    trigger\n    offlineBehavior\n    reconnectWindowSeconds\n    timeReference\n    startAt\n    repeat\n    nextRunAt\n    lastRunAt\n    scripts {\n      id\n      name\n      shell\n      supportedPlatforms\n      defaultTimeoutSeconds\n      defaultArgs\n      scriptBody\n      envVars {\n        name\n        value\n        secret\n      }\n    }\n    scriptCustomParams {\n      scriptId\n      args\n      envVars {\n        name\n        value\n        secret\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "0670e9f9e8bb216c401fcb1ab9e70343";

export default node;
