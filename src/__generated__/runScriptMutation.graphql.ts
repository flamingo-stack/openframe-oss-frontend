/**
 * @generated SignedSource<<3a8c37dd25a1e7c658d0dfb402b83864>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type PrivilegeLevel = "ADMIN" | "ELEVATED_USER" | "USER" | "%future added value";
export type RunScriptInput = {
  args?: ReadonlyArray<string> | null | undefined;
  envVars?: ReadonlyArray<ScriptEnvVarInput> | null | undefined;
  machineId: string;
  privilegeLevel: PrivilegeLevel;
  scriptId: string;
  timeoutSeconds?: number | null | undefined;
};
export type ScriptEnvVarInput = {
  name: string;
  secret: boolean;
  value?: string | null | undefined;
};
export type runScriptMutation$variables = {
  input: RunScriptInput;
};
export type runScriptMutation$data = {
  readonly runScript: {
    readonly executionId: string;
  };
};
export type runScriptMutation = {
  response: runScriptMutation$data;
  variables: runScriptMutation$variables;
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
    "concreteType": "DispatchResponse",
    "kind": "LinkedField",
    "name": "runScript",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "executionId",
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
    "name": "runScriptMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "runScriptMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "44181e53e4593ab7ec961c1db76ece36",
    "id": null,
    "metadata": {},
    "name": "runScriptMutation",
    "operationKind": "mutation",
    "text": "mutation runScriptMutation(\n  $input: RunScriptInput!\n) {\n  runScript(input: $input) {\n    executionId\n  }\n}\n"
  }
};
})();

(node as any).hash = "f1b2a004d6cc3b869a264687f3268053";

export default node;
