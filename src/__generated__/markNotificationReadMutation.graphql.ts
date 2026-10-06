/**
 * @generated SignedSource<<659abe8f0e4fae5c84bf29bae900128a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type markNotificationReadMutation$variables = {
  id: string;
};
export type markNotificationReadMutation$data = {
  readonly markNotificationAsRead: boolean;
};
export type markNotificationReadMutation = {
  response: markNotificationReadMutation$data;
  variables: markNotificationReadMutation$variables;
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
    "name": "markNotificationAsRead",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "markNotificationReadMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "markNotificationReadMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "b4929cf463fdf938b9f3daf3d3e1ff84",
    "id": null,
    "metadata": {},
    "name": "markNotificationReadMutation",
    "operationKind": "mutation",
    "text": "mutation markNotificationReadMutation(\n  $id: ID!\n) {\n  markNotificationAsRead(notificationId: $id)\n}\n"
  }
};
})();

(node as any).hash = "ea2dbd13c23ac6130ffe9a3c3794e3ce";

export default node;
