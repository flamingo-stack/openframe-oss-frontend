/**
 * @generated SignedSource<<2c570976b87e3192dca695cedfcd3a29>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type useBillingPortalSessionMutation$variables = Record<PropertyKey, never>;
export type useBillingPortalSessionMutation$data = {
  readonly createBillingPortalSession: {
    readonly portalUrl: string;
  };
};
export type useBillingPortalSessionMutation = {
  response: useBillingPortalSessionMutation$data;
  variables: useBillingPortalSessionMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "BillingPortalResult",
    "kind": "LinkedField",
    "name": "createBillingPortalSession",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "portalUrl",
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
    "name": "useBillingPortalSessionMutation",
    "selections": (v0/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "useBillingPortalSessionMutation",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "c181137050bfd1f5083a1ea7d5363ff2",
    "id": null,
    "metadata": {},
    "name": "useBillingPortalSessionMutation",
    "operationKind": "mutation",
    "text": "mutation useBillingPortalSessionMutation {\n  createBillingPortalSession {\n    portalUrl\n  }\n}\n"
  }
};
})();

(node as any).hash = "807d46ec01e2180d128c2d570d459726";

export default node;
