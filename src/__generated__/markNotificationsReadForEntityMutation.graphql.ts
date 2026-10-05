/**
 * @generated SignedSource<<aacaf596649dd20c31356475cc0c2e77>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type NotificationEntityType = "DIALOG" | "TICKET" | "%future added value";
export type markNotificationsReadForEntityMutation$variables = {
  entityId: string;
  entityType: NotificationEntityType;
};
export type markNotificationsReadForEntityMutation$data = {
  readonly markNotificationsReadForEntity: number;
};
export type markNotificationsReadForEntityMutation = {
  response: markNotificationsReadForEntityMutation$data;
  variables: markNotificationsReadForEntityMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "entityId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "entityType"
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "entityId",
        "variableName": "entityId"
      },
      {
        "kind": "Variable",
        "name": "entityType",
        "variableName": "entityType"
      }
    ],
    "kind": "ScalarField",
    "name": "markNotificationsReadForEntity",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "markNotificationsReadForEntityMutation",
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "markNotificationsReadForEntityMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "ccabb1d1b12d75d2f94355ba5e93f00f",
    "id": null,
    "metadata": {},
    "name": "markNotificationsReadForEntityMutation",
    "operationKind": "mutation",
    "text": "mutation markNotificationsReadForEntityMutation(\n  $entityType: NotificationEntityType!\n  $entityId: ID!\n) {\n  markNotificationsReadForEntity(entityType: $entityType, entityId: $entityId)\n}\n"
  }
};
})();

(node as any).hash = "8ab73a4e59874d5bacf5d37e10f4af78";

export default node;
