/**
 * @generated SignedSource<<5a0f9a6c1c555747b1621b2ad6483e0d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type DirectoryProvider = "GOOGLE_WORKSPACE" | "MICROSOFT_365" | "%future added value";
export type reconnectTenantViewQuery$variables = {
  id: string;
};
export type reconnectTenantViewQuery$data = {
  readonly directoryConnection: {
    readonly consentUrl: string | null | undefined;
    readonly id: string;
    readonly provider: DirectoryProvider;
    readonly " $fragmentSpreads": FragmentRefs<"tenantSummaryCard_identity">;
  } | null | undefined;
};
export type reconnectTenantViewQuery = {
  response: reconnectTenantViewQuery$data;
  variables: reconnectTenantViewQuery$variables;
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
  "name": "consentUrl",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "reconnectTenantViewQuery",
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
    "name": "reconnectTenantViewQuery",
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "domain",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "6af2fb8509f57cadcb342fb98a0ae69e",
    "id": null,
    "metadata": {},
    "name": "reconnectTenantViewQuery",
    "operationKind": "query",
    "text": "query reconnectTenantViewQuery(\n  $id: ID!\n) {\n  directoryConnection(connectionId: $id) {\n    id\n    provider\n    consentUrl\n    ...tenantSummaryCard_identity\n  }\n}\n\nfragment tenantSummaryCard_identity on DirectoryConnection {\n  provider\n  domain\n}\n"
  }
};
})();

(node as any).hash = "156fa5578f7878fd989d8c490e3fb6bc";

export default node;
