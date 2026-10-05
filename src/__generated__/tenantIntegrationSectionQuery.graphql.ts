/**
 * @generated SignedSource<<f7256b5d9c7405d6e65b70a8bc76ffef>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type DirectoryCapability = "ADMIN_ROLES" | "AUDIT_LOGS" | "DEVICES" | "GROUPS" | "LICENSES" | "OAUTH_APPS" | "ORG_UNITS" | "USERS" | "%future added value";
export type DirectoryProvider = "GOOGLE_WORKSPACE" | "MICROSOFT_365" | "%future added value";
export type tenantIntegrationSectionQuery$variables = {
  id: string;
};
export type tenantIntegrationSectionQuery$data = {
  readonly directoryConnection: {
    readonly access: {
      readonly capabilities: ReadonlyArray<DirectoryCapability>;
    };
    readonly directoryId: string | null | undefined;
    readonly domain: string | null | undefined;
    readonly domains: ReadonlyArray<{
      readonly name: string;
      readonly primary: boolean | null | undefined;
    }>;
    readonly grantedBy: string | null | undefined;
    readonly provider: DirectoryProvider;
  } | null | undefined;
};
export type tenantIntegrationSectionQuery = {
  response: tenantIntegrationSectionQuery$data;
  variables: tenantIntegrationSectionQuery$variables;
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
  "name": "provider",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "domain",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "directoryId",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "grantedBy",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "DirectoryDomain",
  "kind": "LinkedField",
  "name": "domains",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "primary",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v7 = {
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
      "name": "capabilities",
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
    "name": "tenantIntegrationSectionQuery",
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
          (v7/*: any*/)
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
    "name": "tenantIntegrationSectionQuery",
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "a3bbd4b5bac19c11862999029e22a54c",
    "id": null,
    "metadata": {},
    "name": "tenantIntegrationSectionQuery",
    "operationKind": "query",
    "text": "query tenantIntegrationSectionQuery(\n  $id: ID!\n) {\n  directoryConnection(connectionId: $id) {\n    provider\n    domain\n    directoryId\n    grantedBy\n    domains {\n      name\n      primary\n    }\n    access {\n      capabilities\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "4e632038ada803623b9de4637b10ac91";

export default node;
