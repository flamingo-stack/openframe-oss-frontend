/**
 * @generated SignedSource<<9c7f637e492b9def6a159beab7d2fb21>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type markAllNotificationsReadMutation$variables = Record<PropertyKey, never>;
export type markAllNotificationsReadMutation$data = {
  readonly markAllNotificationsAsRead: number;
};
export type markAllNotificationsReadMutation = {
  response: markAllNotificationsReadMutation$data;
  variables: markAllNotificationsReadMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "markAllNotificationsAsRead",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "markAllNotificationsReadMutation",
    "selections": (v0/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "markAllNotificationsReadMutation",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "3826fcfbab99345040cdf622b2530400",
    "id": null,
    "metadata": {},
    "name": "markAllNotificationsReadMutation",
    "operationKind": "mutation",
    "text": "mutation markAllNotificationsReadMutation {\n  markAllNotificationsAsRead\n}\n"
  }
};
})();

(node as any).hash = "908023977251bbdbdc0b88a9f24702dd";

export default node;
