/**
 * @generated SignedSource<<ed2b2b92b50fd048c1518eef96c3a2d5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type BillingProvisioningState = "PENDING" | "READY" | "%future added value";
export type useBillingProvisioningStatusQuery$variables = Record<PropertyKey, never>;
export type useBillingProvisioningStatusQuery$data = {
  readonly billingProvisioningStatus: {
    readonly message: string;
    readonly state: BillingProvisioningState;
  };
};
export type useBillingProvisioningStatusQuery = {
  response: useBillingProvisioningStatusQuery$data;
  variables: useBillingProvisioningStatusQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "BillingProvisioningStatus",
    "kind": "LinkedField",
    "name": "billingProvisioningStatus",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "state",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "message",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useBillingProvisioningStatusQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "useBillingProvisioningStatusQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "fe6caf0e1b76c862a77061ebba383cbd",
    "id": null,
    "metadata": {},
    "name": "useBillingProvisioningStatusQuery",
    "operationKind": "query",
    "text": "query useBillingProvisioningStatusQuery {\n  billingProvisioningStatus {\n    state\n    message\n  }\n}\n"
  }
};
})();

(node as any).hash = "e8206403b0119f6b8bc28a3dfd42a123";

export default node;
