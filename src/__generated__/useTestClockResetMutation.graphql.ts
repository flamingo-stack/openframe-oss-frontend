/**
 * @generated SignedSource<<a0c05f748295326489fcc56d06cb46bb>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type useTestClockResetMutation$variables = Record<PropertyKey, never>;
export type useTestClockResetMutation$data = {
  readonly resetTestClock: boolean;
};
export type useTestClockResetMutation = {
  response: useTestClockResetMutation$data;
  variables: useTestClockResetMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "resetTestClock",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useTestClockResetMutation",
    "selections": (v0/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "useTestClockResetMutation",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "4df8d6d4b85fa2dcc02cc946485d1d1d",
    "id": null,
    "metadata": {},
    "name": "useTestClockResetMutation",
    "operationKind": "mutation",
    "text": "mutation useTestClockResetMutation {\n  resetTestClock\n}\n"
  }
};
})();

(node as any).hash = "0a42f4934430d5b8b68962264181b069";

export default node;
