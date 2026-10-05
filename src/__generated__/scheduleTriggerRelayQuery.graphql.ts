/**
 * @generated SignedSource<<2bc080283512f144ea9f5c4b14337a83>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type ScriptScheduleTrigger = "DATE_TIME" | "DEVICE_ONLINE" | "%future added value";
export type scheduleTriggerRelayQuery$variables = {
  id: string;
};
export type scheduleTriggerRelayQuery$data = {
  readonly scriptSchedule: {
    readonly id: string;
    readonly trigger: ScriptScheduleTrigger;
  };
};
export type scheduleTriggerRelayQuery = {
  response: scheduleTriggerRelayQuery$data;
  variables: scheduleTriggerRelayQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
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
        "name": "trigger",
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
    "name": "scheduleTriggerRelayQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "scheduleTriggerRelayQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "d313dfbdc3df3b1b20b2f65bf3624f3a",
    "id": null,
    "metadata": {},
    "name": "scheduleTriggerRelayQuery",
    "operationKind": "query",
    "text": "query scheduleTriggerRelayQuery(\n  $id: ID!\n) {\n  scriptSchedule(id: $id) {\n    id\n    trigger\n  }\n}\n"
  }
};
})();

(node as any).hash = "fa291887d74610fe9094c19ff40c606e";

export default node;
