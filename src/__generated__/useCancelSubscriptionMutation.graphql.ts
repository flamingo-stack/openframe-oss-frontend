/**
 * @generated SignedSource<<c002947f640b94e35acf6fb60ee1000d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type CancelSubscriptionInput = {
  description?: string | null | undefined;
  reason?: string | null | undefined;
};
export type useCancelSubscriptionMutation$variables = {
  input?: CancelSubscriptionInput | null | undefined;
};
export type useCancelSubscriptionMutation$data = {
  readonly cancelSubscription: boolean;
};
export type useCancelSubscriptionMutation = {
  response: useCancelSubscriptionMutation$data;
  variables: useCancelSubscriptionMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "kind": "ScalarField",
    "name": "cancelSubscription",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useCancelSubscriptionMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useCancelSubscriptionMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "10983ab21616b7923b4b0f095b785c52",
    "id": null,
    "metadata": {},
    "name": "useCancelSubscriptionMutation",
    "operationKind": "mutation",
    "text": "mutation useCancelSubscriptionMutation(\n  $input: CancelSubscriptionInput\n) {\n  cancelSubscription(input: $input)\n}\n"
  }
};
})();

(node as any).hash = "101832f7913668b963bcd3a2b166d0f4";

export default node;
