/**
 * @generated SignedSource<<fe3798542a19a6bfffad54a18cf44b8d>>
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
export type UpdateScriptScheduleInput = {
  description?: string | null | undefined;
  id: string;
  name: string;
  offlineBehavior?: ScheduleOfflineBehavior | null | undefined;
  reconnectWindowSeconds?: Long | null | undefined;
  repeat?: Long | null | undefined;
  scriptCustomParams?: ReadonlyArray<ScheduledScriptCustomParamsInput> | null | undefined;
  scriptIds?: ReadonlyArray<string> | null | undefined;
  selectionMode?: ScheduleDeviceSelectionMode | null | undefined;
  startAt?: Instant | null | undefined;
  supportedPlatforms?: ReadonlyArray<OsType> | null | undefined;
  timeReference?: ScheduleTimeReference | null | undefined;
  trigger: ScriptScheduleTrigger;
};
export type ScheduledScriptCustomParamsInput = {
  args?: ReadonlyArray<string> | null | undefined;
  envVars?: ReadonlyArray<ScriptEnvVarInput> | null | undefined;
  scriptId: string;
};
export type ScriptEnvVarInput = {
  name: string;
  secret: boolean;
  value?: string | null | undefined;
};
export type updateScriptScheduleMutation$variables = {
  input: UpdateScriptScheduleInput;
};
export type updateScriptScheduleMutation$data = {
  readonly updateScriptSchedule: {
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
export type updateScriptScheduleMutation = {
  response: updateScriptScheduleMutation$data;
  variables: updateScriptScheduleMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
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
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "ScriptSchedule",
    "kind": "LinkedField",
    "name": "updateScriptSchedule",
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
        "kind": "ScalarField",
        "name": "deviceCount",
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
    "name": "updateScriptScheduleMutation",
    "selections": (v5/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "updateScriptScheduleMutation",
    "selections": (v5/*: any*/)
  },
  "params": {
    "cacheID": "6488a43bcdf81aea4b3e7f5371420354",
    "id": null,
    "metadata": {},
    "name": "updateScriptScheduleMutation",
    "operationKind": "mutation",
    "text": "mutation updateScriptScheduleMutation(\n  $input: UpdateScriptScheduleInput!\n) {\n  updateScriptSchedule(input: $input) {\n    id\n    name\n    description\n    supportedPlatforms\n    status\n    deviceCount\n    trigger\n    offlineBehavior\n    reconnectWindowSeconds\n    timeReference\n    startAt\n    repeat\n    nextRunAt\n    lastRunAt\n    selectionMode\n    deviceCriteria {\n      organizationIds\n      deviceTypes\n      osTypes\n    }\n    scripts {\n      id\n      name\n      shell\n      supportedPlatforms\n      defaultTimeoutSeconds\n      defaultArgs\n      envVars {\n        name\n        value\n        secret\n      }\n    }\n    scriptCustomParams {\n      scriptId\n      args\n      envVars {\n        name\n        value\n        secret\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "91565bf0b998b4d322d3b2d17fdd90c9";

export default node;
