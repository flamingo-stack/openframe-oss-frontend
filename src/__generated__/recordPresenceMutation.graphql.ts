/**
 * @generated SignedSource<<212cc010bc75a4df11120ff2a8ddeed7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type recordPresenceMutation$variables = Record<PropertyKey, never>;
export type recordPresenceMutation$data = {
  readonly recordPresence: boolean;
};
export type recordPresenceMutation = {
  response: recordPresenceMutation$data;
  variables: recordPresenceMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "recordPresence",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "recordPresenceMutation",
    "selections": (v0/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "recordPresenceMutation",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "05c93328e3b1ced147d289f91f99650f",
    "id": null,
    "metadata": {},
    "name": "recordPresenceMutation",
    "operationKind": "mutation",
    "text": "mutation recordPresenceMutation {\n  recordPresence\n}\n"
  }
};
})();

(node as any).hash = "dc4abdfb6ee800d2de1ce23544474f26";

export default node;
