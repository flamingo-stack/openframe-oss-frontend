/**
 * @generated SignedSource<<c9dafeac655c918274d8ffb6a2896a75>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type OsType = "MAC_OS" | "WINDOWS" | "%future added value";
export type PrivilegeLevel = "ADMIN" | "ELEVATED_USER" | "USER" | "%future added value";
export type ScriptShell = "BASH" | "CMD" | "NUSHELL" | "POWERSHELL" | "PYTHON" | "SHELL" | "%future added value";
export type ScriptStatus = "ACTIVE" | "ARCHIVED" | "DELETED" | "%future added value";
export type UpdateScriptInput = {
  defaultArgs?: ReadonlyArray<string> | null | undefined;
  defaultTimeoutSeconds?: number | null | undefined;
  description?: string | null | undefined;
  envVars?: ReadonlyArray<ScriptEnvVarInput> | null | undefined;
  id: string;
  name: string;
  privilegeLevel: PrivilegeLevel;
  scriptBody: string;
  shell: ScriptShell;
  supportedPlatforms?: ReadonlyArray<OsType> | null | undefined;
  tagIds?: ReadonlyArray<string> | null | undefined;
};
export type ScriptEnvVarInput = {
  name: string;
  secret: boolean;
  value?: string | null | undefined;
};
export type updateScriptMutation$variables = {
  input: UpdateScriptInput;
};
export type updateScriptMutation$data = {
  readonly updateScript: {
    readonly defaultArgs: ReadonlyArray<string> | null | undefined;
    readonly defaultTimeoutSeconds: number | null | undefined;
    readonly description: string | null | undefined;
    readonly envVars: ReadonlyArray<{
      readonly name: string;
      readonly secret: boolean;
      readonly value: string | null | undefined;
    }> | null | undefined;
    readonly id: string;
    readonly name: string;
    readonly privilegeLevel: PrivilegeLevel;
    readonly scriptBody: string;
    readonly shell: ScriptShell;
    readonly status: ScriptStatus;
    readonly supportedPlatforms: ReadonlyArray<OsType> | null | undefined;
    readonly tags: ReadonlyArray<{
      readonly id: string;
      readonly key: string;
    }>;
  };
};
export type updateScriptMutation = {
  response: updateScriptMutation$data;
  variables: updateScriptMutation$variables;
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
v3 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "Script",
    "kind": "LinkedField",
    "name": "updateScript",
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
        "name": "shell",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "privilegeLevel",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "scriptBody",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "Tag",
        "kind": "LinkedField",
        "name": "tags",
        "plural": true,
        "selections": [
          (v1/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "key",
            "storageKey": null
          }
        ],
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
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "status",
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
    "name": "updateScriptMutation",
    "selections": (v3/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "updateScriptMutation",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "e1b34065c2025fbf80da3f54640bd904",
    "id": null,
    "metadata": {},
    "name": "updateScriptMutation",
    "operationKind": "mutation",
    "text": "mutation updateScriptMutation(\n  $input: UpdateScriptInput!\n) {\n  updateScript(input: $input) {\n    id\n    name\n    description\n    shell\n    privilegeLevel\n    scriptBody\n    tags {\n      id\n      key\n    }\n    supportedPlatforms\n    defaultTimeoutSeconds\n    defaultArgs\n    envVars {\n      name\n      value\n      secret\n    }\n    status\n  }\n}\n"
  }
};
})();

(node as any).hash = "a8b15f502b427c8a3461a3364d2d7ab2";

export default node;
