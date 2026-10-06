/**
 * @generated SignedSource<<9f271111811c6ccc10af67c0cb0e6605>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type cancelPendingPushMutation$variables = {
  notificationId: string;
};
export type cancelPendingPushMutation$data = {
  readonly cancelPendingPush: boolean;
};
export type cancelPendingPushMutation = {
  response: cancelPendingPushMutation$data;
  variables: cancelPendingPushMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "notificationId"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "notificationId",
        "variableName": "notificationId"
      }
    ],
    "kind": "ScalarField",
    "name": "cancelPendingPush",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "cancelPendingPushMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "cancelPendingPushMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "2eba4bd1283c0b69bc4095b7d295accb",
    "id": null,
    "metadata": {},
    "name": "cancelPendingPushMutation",
    "operationKind": "mutation",
    "text": "mutation cancelPendingPushMutation(\n  $notificationId: ObjectId!\n) {\n  cancelPendingPush(notificationId: $notificationId)\n}\n"
  }
};
})();

(node as any).hash = "5e91618441c85b87273be9b3fcb11dcb";

export default node;
