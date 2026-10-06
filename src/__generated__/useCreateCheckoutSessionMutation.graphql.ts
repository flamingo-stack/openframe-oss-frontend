/**
 * @generated SignedSource<<152e10a4947cd4d28c27857def517399>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type OpenframeProduct = "AI_ASSISTANCE" | "MANAGED_DEVICES" | "%future added value";
export type CheckoutInput = {
  discountCode?: string | null | undefined;
  products: ReadonlyArray<ProductCheckoutInput>;
};
export type ProductCheckoutInput = {
  enabled?: boolean | null | undefined;
  packageOptionId?: string | null | undefined;
  payAsYouGoEnabled?: boolean | null | undefined;
  productName: OpenframeProduct;
  quantity?: number | null | undefined;
};
export type useCreateCheckoutSessionMutation$variables = {
  input: CheckoutInput;
};
export type useCreateCheckoutSessionMutation$data = {
  readonly createCheckoutSession: {
    readonly checkoutUrl: string;
  };
};
export type useCreateCheckoutSessionMutation = {
  response: useCreateCheckoutSessionMutation$data;
  variables: useCreateCheckoutSessionMutation$variables;
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
    "concreteType": "CheckoutResult",
    "kind": "LinkedField",
    "name": "createCheckoutSession",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "checkoutUrl",
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
    "name": "useCreateCheckoutSessionMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useCreateCheckoutSessionMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "17e5f2af70d2d93611403c76053f5bee",
    "id": null,
    "metadata": {},
    "name": "useCreateCheckoutSessionMutation",
    "operationKind": "mutation",
    "text": "mutation useCreateCheckoutSessionMutation(\n  $input: CheckoutInput!\n) {\n  createCheckoutSession(input: $input) {\n    checkoutUrl\n  }\n}\n"
  }
};
})();

(node as any).hash = "51a6c62f489ce4e7bf60b07aeadc199b";

export default node;
