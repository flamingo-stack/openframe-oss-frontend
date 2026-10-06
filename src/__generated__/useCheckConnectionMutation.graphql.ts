/**
 * @generated SignedSource<<f900865d6384ab9c0a62ef2f8f4a9229>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type DirectoryAccessState = "CONSENT_REVOKED" | "DISCONNECTED" | "NOT_AUTHORISED" | "READ_ONLY" | "WRITE_AVAILABLE" | "WRITE_ENABLED" | "%future added value";
export type DirectoryCapability = "ADMIN_ROLES" | "AUDIT_LOGS" | "DEVICES" | "GROUPS" | "LICENSES" | "OAUTH_APPS" | "ORG_UNITS" | "USERS" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type useCheckConnectionMutation$variables = {
  connectionId: string;
};
export type useCheckConnectionMutation$data = {
  readonly checkDirectoryConnection: {
    readonly connection: {
      readonly access: {
        readonly capabilities: ReadonlyArray<DirectoryCapability>;
        readonly state: DirectoryAccessState;
      };
      readonly connectedAt: Instant | null | undefined;
      readonly id: string;
      readonly " $fragmentSpreads": FragmentRefs<"tenantConsentAlert_connection" | "tenantConsentIssues_connection">;
    } | null | undefined;
    readonly userErrors: ReadonlyArray<{
      readonly code: string;
      readonly message: string;
    }>;
  };
};
export type useCheckConnectionMutation = {
  response: useCheckConnectionMutation$data;
  variables: useCheckConnectionMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "connectionId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "connectionId",
    "variableName": "connectionId"
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
  "name": "connectedAt",
  "storageKey": null
},
v4 = {
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
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "capabilities",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "message",
  "storageKey": null
},
v6 = {
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
    (v5/*: any*/)
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useCheckConnectionMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DirectoryConnectionPayload",
        "kind": "LinkedField",
        "name": "checkDirectoryConnection",
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
          },
          (v6/*: any*/)
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
    "name": "useCheckConnectionMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DirectoryConnectionPayload",
        "kind": "LinkedField",
        "name": "checkDirectoryConnection",
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
                      (v5/*: any*/)
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
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "provider",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v6/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "f4d4f51e5db64f6d00d9de2c79463fc6",
    "id": null,
    "metadata": {},
    "name": "useCheckConnectionMutation",
    "operationKind": "mutation",
    "text": "mutation useCheckConnectionMutation(\n  $connectionId: ID!\n) {\n  checkDirectoryConnection(connectionId: $connectionId) {\n    connection {\n      id\n      connectedAt\n      access {\n        state\n        capabilities\n      }\n      ...tenantConsentAlert_connection\n      ...tenantConsentIssues_connection\n    }\n    userErrors {\n      code\n      message\n    }\n  }\n}\n\nfragment tenantConsentAlert_connection on DirectoryConnection {\n  domain\n  access {\n    state\n  }\n  lastConsentInfo {\n    outcome\n    deniedTiers\n    issues {\n      __typename\n    }\n  }\n}\n\nfragment tenantConsentIssues_connection on DirectoryConnection {\n  provider\n  domain\n  lastConsentInfo {\n    occurredAt\n    issues {\n      tier\n      kind\n      providerCode\n      correlationId\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "7a0ec6cfed719f21781ffc6974c3c7f3";

export default node;
