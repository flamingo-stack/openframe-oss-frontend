/**
 * @generated SignedSource<<a4e3569a96368cdc79f40829581db386>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type RemoteAccessMode = "APPROVAL_REQUIRED" | "DENY_ACCESS" | "NOTIFY_ONLY" | "SILENT_ACCESS" | "%future added value";
export type remoteAccessPolicyApiServiceSetOrganizationMutation$variables = {
  mode?: RemoteAccessMode | null | undefined;
  organizationId: string;
};
export type remoteAccessPolicyApiServiceSetOrganizationMutation$data = {
  readonly setOrganizationRemoteAccessMode: {
    readonly policy: {
      readonly " $fragmentSpreads": FragmentRefs<"remoteAccessPolicyApiService_organization">;
    } | null | undefined;
    readonly userErrors: ReadonlyArray<{
      readonly code: string;
      readonly message: string;
    }>;
  };
};
export type remoteAccessPolicyApiServiceSetOrganizationMutation = {
  response: remoteAccessPolicyApiServiceSetOrganizationMutation$data;
  variables: remoteAccessPolicyApiServiceSetOrganizationMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "mode"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "organizationId"
},
v2 = [
  {
    "kind": "Variable",
    "name": "mode",
    "variableName": "mode"
  },
  {
    "kind": "Variable",
    "name": "organizationId",
    "variableName": "organizationId"
  }
],
v3 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "mode",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "effectiveMode",
    "storageKey": null
  }
],
v4 = {
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
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "remoteAccessPolicyApiServiceSetOrganizationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "OrganizationRemoteAccessPolicyPayload",
        "kind": "LinkedField",
        "name": "setOrganizationRemoteAccessMode",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "OrganizationRemoteAccessPolicy",
            "kind": "LinkedField",
            "name": "policy",
            "plural": false,
            "selections": [
              {
                "kind": "InlineDataFragmentSpread",
                "name": "remoteAccessPolicyApiService_organization",
                "selections": (v3/*: any*/),
                "args": null,
                "argumentDefinitions": []
              }
            ],
            "storageKey": null
          },
          (v4/*: any*/)
        ],
        "storageKey": null
      }
    ],
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
    "name": "remoteAccessPolicyApiServiceSetOrganizationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "OrganizationRemoteAccessPolicyPayload",
        "kind": "LinkedField",
        "name": "setOrganizationRemoteAccessMode",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "OrganizationRemoteAccessPolicy",
            "kind": "LinkedField",
            "name": "policy",
            "plural": false,
            "selections": (v3/*: any*/),
            "storageKey": null
          },
          (v4/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "ebb38ff5c18d699cfc1f8c9f7559ff6b",
    "id": null,
    "metadata": {},
    "name": "remoteAccessPolicyApiServiceSetOrganizationMutation",
    "operationKind": "mutation",
    "text": "mutation remoteAccessPolicyApiServiceSetOrganizationMutation(\n  $organizationId: String!\n  $mode: RemoteAccessMode\n) {\n  setOrganizationRemoteAccessMode(organizationId: $organizationId, mode: $mode) {\n    policy {\n      ...remoteAccessPolicyApiService_organization\n    }\n    userErrors {\n      code\n      message\n    }\n  }\n}\n\nfragment remoteAccessPolicyApiService_organization on OrganizationRemoteAccessPolicy {\n  mode\n  effectiveMode\n}\n"
  }
};
})();

(node as any).hash = "a0fbe4464c78257e8b5268336e1cf880";

export default node;
