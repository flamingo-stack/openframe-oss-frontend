/**
 * @generated SignedSource<<66a2b27e78f0a24d44d643aea6b83aee>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type UpdateDirectoryConnectionInput = {
  domain?: string | null | undefined;
  name?: string | null | undefined;
  organizationId?: string | null | undefined;
};
export type useConnectTenantFormUpdateMutation$variables = {
  connectionId: string;
  input: UpdateDirectoryConnectionInput;
};
export type useConnectTenantFormUpdateMutation$data = {
  readonly updateDirectoryConnection: {
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
export type useConnectTenantFormUpdateMutation = {
  response: useConnectTenantFormUpdateMutation$data;
  variables: useConnectTenantFormUpdateMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "connectionId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "connectionId",
    "variableName": "connectionId"
  },
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
    "name": "useConnectTenantFormUpdateMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DirectoryConnectionPayload",
        "kind": "LinkedField",
        "name": "updateDirectoryConnection",
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
    "name": "useConnectTenantFormUpdateMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DirectoryConnectionPayload",
        "kind": "LinkedField",
        "name": "updateDirectoryConnection",
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
    "cacheID": "75586505215d739a0692121e1f3170b2",
    "id": null,
    "metadata": {},
    "name": "useConnectTenantFormUpdateMutation",
    "operationKind": "mutation",
    "text": "mutation useConnectTenantFormUpdateMutation(\n  $connectionId: ID!\n  $input: UpdateDirectoryConnectionInput!\n) {\n  updateDirectoryConnection(connectionId: $connectionId, input: $input) {\n    connection {\n      id\n      ...tenantFormHelpers_connection\n    }\n    userErrors {\n      code\n      message\n    }\n  }\n}\n\nfragment customerOption_organization on Organization {\n  organizationId\n  name\n  image {\n    imageUrl\n    hash\n  }\n}\n\nfragment tenantFormHelpers_connection on DirectoryConnection {\n  id\n  provider\n  domain\n  name\n  organizationId\n  consentUrl\n  connectedAt\n  organization {\n    ...customerOption_organization\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "cc431aa5702bd96fd6fa9e6c10cb8070";

export default node;
