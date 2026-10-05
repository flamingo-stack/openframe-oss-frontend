/**
 * @generated SignedSource<<9745f97493a641d8e1be024530f6a5ce>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type deleteNotificationMutation$variables = {
  id: string;
};
export type deleteNotificationMutation$data = {
  readonly deleteNotification: boolean;
};
export type deleteNotificationMutation = {
  response: deleteNotificationMutation$data;
  variables: deleteNotificationMutation$variables;
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
        "name": "notificationId",
        "variableName": "id"
      }
    ],
    "kind": "ScalarField",
    "name": "deleteNotification",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "deleteNotificationMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "deleteNotificationMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "68305756b2b2c4c4378e346748e443e4",
    "id": null,
    "metadata": {},
    "name": "deleteNotificationMutation",
    "operationKind": "mutation",
    "text": "mutation deleteNotificationMutation(\n  $id: ID!\n) {\n  deleteNotification(notificationId: $id)\n}\n"
  }
};
})();

(node as any).hash = "f30f8366233de38a3f01dcd24bdb4690";

export default node;
