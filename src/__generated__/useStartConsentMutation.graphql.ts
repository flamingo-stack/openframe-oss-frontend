/**
 * @generated SignedSource<<469fe502d98e7e2f84af54987755b98a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type useStartConsentMutation$variables = {
  connectionId: string;
};
export type useStartConsentMutation$data = {
  readonly startDirectoryConsent: {
    readonly connection: {
      readonly consentUrl: string | null | undefined;
      readonly id: string;
    } | null | undefined;
    readonly userErrors: ReadonlyArray<{
      readonly code: string;
      readonly message: string;
    }>;
  };
};
export type useStartConsentMutation = {
  response: useStartConsentMutation$data;
  variables: useStartConsentMutation$variables;
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
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "connectionId",
        "variableName": "connectionId"
      }
    ],
    "concreteType": "DirectoryConnectionPayload",
    "kind": "LinkedField",
    "name": "startDirectoryConsent",
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "consentUrl",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
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
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useStartConsentMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useStartConsentMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "9f6eb98cd1ddf7cb745c81e7b3587f12",
    "id": null,
    "metadata": {},
    "name": "useStartConsentMutation",
    "operationKind": "mutation",
    "text": "mutation useStartConsentMutation(\n  $connectionId: ID!\n) {\n  startDirectoryConsent(connectionId: $connectionId) {\n    connection {\n      id\n      consentUrl\n    }\n    userErrors {\n      code\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "febf10d04b411f4c3bebc975ff237256";

export default node;
