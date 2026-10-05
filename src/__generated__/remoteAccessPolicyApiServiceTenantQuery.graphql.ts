/**
 * @generated SignedSource<<b61f29dfc973cb521b94be6873f86980>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type remoteAccessPolicyApiServiceTenantQuery$variables = Record<PropertyKey, never>;
export type remoteAccessPolicyApiServiceTenantQuery$data = {
  readonly remoteAccessPolicy: {
    readonly " $fragmentSpreads": FragmentRefs<"remoteAccessPolicyApiService_tenant">;
  };
};
export type remoteAccessPolicyApiServiceTenantQuery = {
  response: remoteAccessPolicyApiServiceTenantQuery$data;
  variables: remoteAccessPolicyApiServiceTenantQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "mode",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "remoteAccessPolicyApiServiceTenantQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "TenantRemoteAccessPolicy",
        "kind": "LinkedField",
        "name": "remoteAccessPolicy",
        "plural": false,
        "selections": [
          {
            "kind": "InlineDataFragmentSpread",
            "name": "remoteAccessPolicyApiService_tenant",
            "selections": (v0/*: any*/),
            "args": null,
            "argumentDefinitions": []
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "remoteAccessPolicyApiServiceTenantQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "TenantRemoteAccessPolicy",
        "kind": "LinkedField",
        "name": "remoteAccessPolicy",
        "plural": false,
        "selections": (v0/*: any*/),
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "7849bbd509a6e2373c258c23fb44e40d",
    "id": null,
    "metadata": {},
    "name": "remoteAccessPolicyApiServiceTenantQuery",
    "operationKind": "query",
    "text": "query remoteAccessPolicyApiServiceTenantQuery {\n  remoteAccessPolicy {\n    ...remoteAccessPolicyApiService_tenant\n  }\n}\n\nfragment remoteAccessPolicyApiService_tenant on TenantRemoteAccessPolicy {\n  mode\n}\n"
  }
};
})();

(node as any).hash = "a8001e5e83aa50655d8b9c9074814939";

export default node;
