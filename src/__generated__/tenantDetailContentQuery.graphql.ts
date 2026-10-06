/**
 * @generated SignedSource<<34b9d19a1c1841614b9f2316b798ed8e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type DirectoryAccessState = "CONSENT_REVOKED" | "DISCONNECTED" | "NOT_AUTHORISED" | "READ_ONLY" | "WRITE_AVAILABLE" | "WRITE_ENABLED" | "%future added value";
export type DirectoryProvider = "GOOGLE_WORKSPACE" | "MICROSOFT_365" | "%future added value";
export type tenantDetailContentQuery$variables = {
  id: string;
};
export type tenantDetailContentQuery$data = {
  readonly directoryConnection: {
    readonly access: {
      readonly state: DirectoryAccessState;
    };
    readonly consentUrl: string | null | undefined;
    readonly id: string;
    readonly name: string;
    readonly provider: DirectoryProvider;
    readonly " $fragmentSpreads": FragmentRefs<"tenantConsentAlert_connection" | "tenantConsentIssues_connection" | "tenantSummaryCard_connection">;
  } | null | undefined;
};
export type tenantDetailContentQuery = {
  response: tenantDetailContentQuery$data;
  variables: tenantDetailContentQuery$variables;
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
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "provider",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "consentUrl",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "DirectoryConnectionAccess",
  "kind": "LinkedField",
  "name": "access",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "state",
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
    "name": "tenantDetailContentQuery",
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
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "tenantSummaryCard_connection"
          },
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "tenantConsentAlert_connection"
          },
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "tenantConsentIssues_connection"
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
    "name": "tenantDetailContentQuery",
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "domain",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "userCount",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "connectedAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "lastSyncAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "Organization",
            "kind": "LinkedField",
            "name": "organization",
            "plural": false,
            "selections": [
              (v3/*: any*/),
              {
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
              (v2/*: any*/)
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "DirectoryConsentInfo",
            "kind": "LinkedField",
            "name": "lastConsentInfo",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "outcome",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "deniedTiers",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "DirectoryConsentIssue",
                "kind": "LinkedField",
                "name": "issues",
                "plural": true,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "__typename",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "tier",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "kind",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "providerCode",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "correlationId",
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
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "occurredAt",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "c2d610a2a83ff04b96e8356a10ddaa8f",
    "id": null,
    "metadata": {},
    "name": "tenantDetailContentQuery",
    "operationKind": "query",
    "text": "query tenantDetailContentQuery(\n  $id: ID!\n) {\n  directoryConnection(connectionId: $id) {\n    id\n    name\n    provider\n    consentUrl\n    access {\n      state\n    }\n    ...tenantSummaryCard_connection\n    ...tenantConsentAlert_connection\n    ...tenantConsentIssues_connection\n  }\n}\n\nfragment tenantConsentAlert_connection on DirectoryConnection {\n  domain\n  access {\n    state\n  }\n  lastConsentInfo {\n    outcome\n    deniedTiers\n    issues {\n      __typename\n    }\n  }\n}\n\nfragment tenantConsentIssues_connection on DirectoryConnection {\n  provider\n  domain\n  lastConsentInfo {\n    occurredAt\n    issues {\n      tier\n      kind\n      providerCode\n      correlationId\n      message\n    }\n  }\n}\n\nfragment tenantSummaryCard_connection on DirectoryConnection {\n  provider\n  domain\n  userCount\n  connectedAt\n  lastSyncAt\n  access {\n    state\n  }\n  organization {\n    name\n    image {\n      imageUrl\n      hash\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "999e2b510249486155c062d7440b91c5";

export default node;
