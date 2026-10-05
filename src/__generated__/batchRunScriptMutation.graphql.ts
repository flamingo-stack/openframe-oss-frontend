/**
 * @generated SignedSource<<f69dbce44e677a14f0a18f7616b82395>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type PrivilegeLevel = "ADMIN" | "ELEVATED_USER" | "USER" | "%future added value";
export type BatchRunScriptInput = {
  args?: ReadonlyArray<string> | null | undefined;
  envVars?: ReadonlyArray<ScriptEnvVarInput> | null | undefined;
  machineIds: ReadonlyArray<string>;
  privilegeLevel: PrivilegeLevel;
  scriptId: string;
  timeoutSeconds?: number | null | undefined;
};
export type ScriptEnvVarInput = {
  name: string;
  secret: boolean;
  value?: string | null | undefined;
};
export type batchRunScriptMutation$variables = {
  input: BatchRunScriptInput;
};
export type batchRunScriptMutation$data = {
  readonly batchRunScript: {
    readonly executionId: string;
  };
};
export type batchRunScriptMutation = {
  response: batchRunScriptMutation$data;
  variables: batchRunScriptMutation$variables;
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
    "name": "batchRunScript",
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
    "name": "batchRunScriptMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "batchRunScriptMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "f96cf90cd78271c92fdd8286d2415da2",
    "id": null,
    "metadata": {},
    "name": "batchRunScriptMutation",
    "operationKind": "mutation",
    "text": "mutation batchRunScriptMutation(\n  $input: BatchRunScriptInput!\n) {\n  batchRunScript(input: $input) {\n    executionId\n  }\n}\n"
  }
};
})();

(node as any).hash = "e23ed0bb32fc1aa32d60ae0ecc5a878b";

export default node;
