/**
 * @generated SignedSource<<3d11104dfed0cb40b3f7d079d1767e68>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type cancelTimerMutation$variables = Record<PropertyKey, never>;
export type cancelTimerMutation$data = {
  readonly cancelTimer: boolean;
};
export type cancelTimerMutation = {
  response: cancelTimerMutation$data;
  variables: cancelTimerMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cancelTimer",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "cancelTimerMutation",
    "selections": (v0/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "cancelTimerMutation",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "4107db0101d7be5256a67698f711a81f",
    "id": null,
    "metadata": {},
    "name": "cancelTimerMutation",
    "operationKind": "mutation",
    "text": "mutation cancelTimerMutation {\n  cancelTimer\n}\n"
  }
};
})();

(node as any).hash = "221c0418b3d3b00921adea63f8f7cbc0";

export default node;
