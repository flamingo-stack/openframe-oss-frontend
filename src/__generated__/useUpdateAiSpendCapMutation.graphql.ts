/**
 * @generated SignedSource<<61c2b23b92122cfa2b0141c365c546b9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type useUpdateAiSpendCapMutation$variables = {
  amountUsd?: number | null | undefined;
};
export type useUpdateAiSpendCapMutation$data = {
  readonly updateAiSpendCap: {
    readonly aiSpendCapUsd: number | null | undefined;
    readonly id: string;
  };
};
export type useUpdateAiSpendCapMutation = {
  response: useUpdateAiSpendCapMutation$data;
  variables: useUpdateAiSpendCapMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "amountUsd"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "amountUsd",
        "variableName": "amountUsd"
      }
    ],
    "concreteType": "SubscriptionDetail",
    "kind": "LinkedField",
    "name": "updateAiSpendCap",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "aiSpendCapUsd",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useUpdateAiSpendCapMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useUpdateAiSpendCapMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "3fe4430357e9701bdbb0f7ba4f5dae41",
    "id": null,
    "metadata": {},
    "name": "useUpdateAiSpendCapMutation",
    "operationKind": "mutation",
    "text": "mutation useUpdateAiSpendCapMutation(\n  $amountUsd: Float\n) {\n  updateAiSpendCap(amountUsd: $amountUsd) {\n    id\n    aiSpendCapUsd\n  }\n}\n"
  }
};
})();

(node as any).hash = "ddb98f8eb5c654fde235cc296f75fedb";

export default node;
