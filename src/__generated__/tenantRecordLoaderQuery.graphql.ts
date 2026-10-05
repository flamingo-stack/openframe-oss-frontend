/**
 * @generated SignedSource<<d34809962c43b74ba77fcd654bea6c40>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type tenantRecordLoaderQuery$variables = {
  id: string;
};
export type tenantRecordLoaderQuery$data = {
  readonly directoryConnection: {
    readonly " $fragmentSpreads": FragmentRefs<"tenantFormHelpers_connection" | "tenantSummaryCard_identity">;
  } | null | undefined;
};
export type tenantRecordLoaderQuery = {
  response: tenantRecordLoaderQuery$data;
  variables: tenantRecordLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "connectionId",
    "variableName": "id"
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "tenantRecordLoaderQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DirectoryConnection",
        "kind": "LinkedField",
        "name": "directoryConnection",
        "plural": false,
        "selections": [
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
          },
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "tenantSummaryCard_identity"
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "tenantRecordLoaderQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DirectoryConnection",
        "kind": "LinkedField",
        "name": "directoryConnection",
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
      }
    ]
  },
  "params": {
    "cacheID": "3fb9416c80261e7bef332d1d184fa107",
    "id": null,
    "metadata": {},
    "name": "tenantRecordLoaderQuery",
    "operationKind": "query",
    "text": "query tenantRecordLoaderQuery(\n  $id: ID!\n) {\n  directoryConnection(connectionId: $id) {\n    ...tenantFormHelpers_connection\n    ...tenantSummaryCard_identity\n    id\n  }\n}\n\nfragment customerOption_organization on Organization {\n  organizationId\n  name\n  image {\n    imageUrl\n    hash\n  }\n}\n\nfragment tenantFormHelpers_connection on DirectoryConnection {\n  id\n  provider\n  domain\n  name\n  organizationId\n  consentUrl\n  connectedAt\n  organization {\n    ...customerOption_organization\n    id\n  }\n}\n\nfragment tenantSummaryCard_identity on DirectoryConnection {\n  provider\n  domain\n}\n"
  }
};
})();

(node as any).hash = "495988eb56b0407f03316523a28dfb49";

export default node;
