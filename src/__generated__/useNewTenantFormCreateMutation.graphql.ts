/**
 * @generated SignedSource<<42764f95102a53b69ad0a21f3c5722b8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type DirectoryProvider = "GOOGLE_WORKSPACE" | "MICROSOFT_365" | "%future added value";
export type CreateDirectoryConnectionInput = {
  domain: string;
  name: string;
  organizationId: string;
  provider: DirectoryProvider;
};
export type useNewTenantFormCreateMutation$variables = {
  input: CreateDirectoryConnectionInput;
};
export type useNewTenantFormCreateMutation$data = {
  readonly createDirectoryConnection: {
    readonly connection: {
      readonly id: string;
      readonly " $fragmentSpreads": FragmentRefs<"tenantFormHelpers_connection">;
    } | null | undefined;
    readonly userErrors: ReadonlyArray<{
      readonly code: string;
      readonly message: string;
    }>;
  };
};
export type useNewTenantFormCreateMutation = {
  response: useNewTenantFormCreateMutation$data;
  variables: useNewTenantFormCreateMutation$variables;
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
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "provider",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "domain",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "organizationId",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "consentUrl",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "connectedAt",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "concreteType": "OrganizationImage",
  "kind": "LinkedField",
  "name": "image",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "imageUrl",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hash",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v10 = {
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
    "name": "useNewTenantFormCreateMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DirectoryConnectionPayload",
        "kind": "LinkedField",
        "name": "createDirectoryConnection",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DirectoryConnection",
            "kind": "LinkedField",
            "name": "connection",
            "plural": false,
            "selections": [
              (v2/*: any*/),
              {
                "kind": "InlineDataFragmentSpread",
                "name": "tenantFormHelpers_connection",
                "selections": [
                  (v2/*: any*/),
                  (v3/*: any*/),
                  (v4/*: any*/),
                  (v5/*: any*/),
                  (v6/*: any*/),
                  (v7/*: any*/),
                  (v8/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Organization",
                    "kind": "LinkedField",
                    "name": "organization",
                    "plural": false,
                    "selections": [
                      {
                        "kind": "InlineDataFragmentSpread",
                        "name": "customerOption_organization",
                        "selections": [
                          (v6/*: any*/),
                          (v5/*: any*/),
                          (v9/*: any*/)
                        ],
                        "args": null,
                        "argumentDefinitions": []
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "args": null,
                "argumentDefinitions": []
              }
            ],
            "storageKey": null
          },
          (v10/*: any*/)
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
    "name": "useNewTenantFormCreateMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DirectoryConnectionPayload",
        "kind": "LinkedField",
        "name": "createDirectoryConnection",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DirectoryConnection",
            "kind": "LinkedField",
            "name": "connection",
            "plural": false,
            "selections": [
              (v2/*: any*/),
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Organization",
                "kind": "LinkedField",
                "name": "organization",
                "plural": false,
                "selections": [
                  (v6/*: any*/),
                  (v5/*: any*/),
                  (v9/*: any*/),
                  (v2/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v10/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "667be1ac7eb28c397d3a626c0fddf501",
    "id": null,
    "metadata": {},
    "name": "useNewTenantFormCreateMutation",
    "operationKind": "mutation",
    "text": "mutation useNewTenantFormCreateMutation(\n  $input: CreateDirectoryConnectionInput!\n) {\n  createDirectoryConnection(input: $input) {\n    connection {\n      id\n      ...tenantFormHelpers_connection\n    }\n    userErrors {\n      code\n      message\n    }\n  }\n}\n\nfragment customerOption_organization on Organization {\n  organizationId\n  name\n  image {\n    imageUrl\n    hash\n  }\n}\n\nfragment tenantFormHelpers_connection on DirectoryConnection {\n  id\n  provider\n  domain\n  name\n  organizationId\n  consentUrl\n  connectedAt\n  organization {\n    ...customerOption_organization\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "da29ec77573cc9767ada308e8f3dc63a";

export default node;
