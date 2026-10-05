/**
 * @generated SignedSource<<5cec82fba0f675036c4a276fe9c444ee>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type RemoteAccessMode = "APPROVAL_REQUIRED" | "DENY_ACCESS" | "NOTIFY_ONLY" | "SILENT_ACCESS" | "%future added value";
export type remoteAccessPolicyApiServiceSetTenantMutation$variables = {
  mode: RemoteAccessMode;
};
export type remoteAccessPolicyApiServiceSetTenantMutation$data = {
  readonly setTenantRemoteAccessMode: {
    readonly policy: {
      readonly " $fragmentSpreads": FragmentRefs<"remoteAccessPolicyApiService_tenant">;
    } | null | undefined;
    readonly userErrors: ReadonlyArray<{
      readonly code: string;
      readonly message: string;
    }>;
  };
};
export type remoteAccessPolicyApiServiceSetTenantMutation = {
  response: remoteAccessPolicyApiServiceSetTenantMutation$data;
  variables: remoteAccessPolicyApiServiceSetTenantMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "mode"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "mode",
    "variableName": "mode"
  }
],
v2 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "mode",
    "storageKey": null
  }
],
v3 = {
  "alias": null,
  "args": null,
  "concreteType": "UserError",
  "kind": "LinkedField",
  "name": "userErrors",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "code",
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "remoteAccessPolicyApiServiceSetTenantMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "TenantRemoteAccessPolicyPayload",
        "kind": "LinkedField",
        "name": "setTenantRemoteAccessMode",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "TenantRemoteAccessPolicy",
            "kind": "LinkedField",
            "name": "policy",
            "plural": false,
            "selections": [
              {
                "kind": "InlineDataFragmentSpread",
                "name": "remoteAccessPolicyApiService_tenant",
                "selections": (v2/*: any*/),
                "args": null,
                "argumentDefinitions": []
              }
            ],
            "storageKey": null
          },
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "remoteAccessPolicyApiServiceSetTenantMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "TenantRemoteAccessPolicyPayload",
        "kind": "LinkedField",
        "name": "setTenantRemoteAccessMode",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "TenantRemoteAccessPolicy",
            "kind": "LinkedField",
            "name": "policy",
            "plural": false,
            "selections": (v2/*: any*/),
            "storageKey": null
          },
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "a0db5ee131af5235d0942af36722177a",
    "id": null,
    "metadata": {},
    "name": "remoteAccessPolicyApiServiceSetTenantMutation",
    "operationKind": "mutation",
    "text": "mutation remoteAccessPolicyApiServiceSetTenantMutation(\n  $mode: RemoteAccessMode!\n) {\n  setTenantRemoteAccessMode(mode: $mode) {\n    policy {\n      ...remoteAccessPolicyApiService_tenant\n    }\n    userErrors {\n      code\n      message\n    }\n  }\n}\n\nfragment remoteAccessPolicyApiService_tenant on TenantRemoteAccessPolicy {\n  mode\n}\n"
  }
};
})();

(node as any).hash = "ab2b648446b41447ccfc81f904cc205a";

export default node;
