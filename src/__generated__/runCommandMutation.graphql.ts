/**
 * @generated SignedSource<<083bce8f90264bb2284fe3c7d95a2e02>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type PrivilegeLevel = "ADMIN" | "ELEVATED_USER" | "USER" | "%future added value";
export type ScriptShell = "BASH" | "CMD" | "NUSHELL" | "POWERSHELL" | "PYTHON" | "SHELL" | "%future added value";
export type RunCommandInput = {
  command: string;
  machineId: string;
  privilegeLevel: PrivilegeLevel;
  shell: ScriptShell;
  timeoutSeconds?: number | null | undefined;
};
export type runCommandMutation$variables = {
  input: RunCommandInput;
};
export type runCommandMutation$data = {
  readonly runCommand: {
    readonly executionId: string;
  };
};
export type runCommandMutation = {
  response: runCommandMutation$data;
  variables: runCommandMutation$variables;
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
    "name": "runCommand",
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
    "name": "runCommandMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "runCommandMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "26e90b98aa0311f48a5fef6569cdaf50",
    "id": null,
    "metadata": {},
    "name": "runCommandMutation",
    "operationKind": "mutation",
    "text": "mutation runCommandMutation(\n  $input: RunCommandInput!\n) {\n  runCommand(input: $input) {\n    executionId\n  }\n}\n"
  }
};
})();

(node as any).hash = "c15d5484a0c4f2d6f321dba501219820";

export default node;
