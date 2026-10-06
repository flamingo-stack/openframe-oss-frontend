/**
 * @generated SignedSource<<d0a32c07449f38c109e94c347bb7739c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type deleteAllReadNotificationsMutation$variables = Record<PropertyKey, never>;
export type deleteAllReadNotificationsMutation$data = {
  readonly deleteAllReadNotifications: number;
};
export type deleteAllReadNotificationsMutation = {
  response: deleteAllReadNotificationsMutation$data;
  variables: deleteAllReadNotificationsMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "deleteAllReadNotifications",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "deleteAllReadNotificationsMutation",
    "selections": (v0/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "deleteAllReadNotificationsMutation",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "3641b1b4179206e6910a31b0c0d55236",
    "id": null,
    "metadata": {},
    "name": "deleteAllReadNotificationsMutation",
    "operationKind": "mutation",
    "text": "mutation deleteAllReadNotificationsMutation {\n  deleteAllReadNotifications\n}\n"
  }
};
})();

(node as any).hash = "bb46b029a6729eda2f8130e71d664425";

export default node;
