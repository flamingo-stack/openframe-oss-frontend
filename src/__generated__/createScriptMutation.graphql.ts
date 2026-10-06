/**
 * @generated SignedSource<<00850e79d68247d94362ec0a03b647cb>>
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
export type CreateScriptInput = {
  defaultArgs?: ReadonlyArray<string> | null | undefined;
  defaultTimeoutSeconds?: number | null | undefined;
  description?: string | null | undefined;
  envVars?: ReadonlyArray<ScriptEnvVarInput> | null | undefined;
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
export type createScriptMutation$variables = {
  input: CreateScriptInput;
};
export type createScriptMutation$data = {
  readonly createScript: {
    readonly id: string;
    readonly name: string;
  };
};
export type createScriptMutation = {
  response: createScriptMutation$data;
  variables: createScriptMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
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
    "name": "createScript",
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
        "name": "name",
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
    "name": "createScriptMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "createScriptMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "f84dc5a930bfb00375523adc65050d4d",
    "id": null,
    "metadata": {},
    "name": "createScriptMutation",
    "operationKind": "mutation",
    "text": "mutation createScriptMutation(\n  $input: CreateScriptInput!\n) {\n  createScript(input: $input) {\n    id\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "80bb0d0dd7839470cb8c3955da136c3a";

export default node;
