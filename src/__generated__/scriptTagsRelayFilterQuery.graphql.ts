/**
 * @generated SignedSource<<6b5bf34cf0e9e0473bfa5255b2b53ede>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type scriptTagsRelayFilterQuery$variables = {
  archived?: boolean | null | undefined;
};
export type scriptTagsRelayFilterQuery$data = {
  readonly scriptsTags: ReadonlyArray<{
    readonly id: string;
    readonly key: string;
  }>;
};
export type scriptTagsRelayFilterQuery = {
  response: scriptTagsRelayFilterQuery$data;
  variables: scriptTagsRelayFilterQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "archived"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "archived",
        "variableName": "archived"
      }
    ],
    "concreteType": "Tag",
    "kind": "LinkedField",
    "name": "scriptsTags",
    "plural": true,
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
        "name": "key",
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
    "name": "scriptTagsRelayFilterQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "scriptTagsRelayFilterQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "a8cffb1ff37c0dad6e7da0a382ba4987",
    "id": null,
    "metadata": {},
    "name": "scriptTagsRelayFilterQuery",
    "operationKind": "query",
    "text": "query scriptTagsRelayFilterQuery(\n  $archived: Boolean\n) {\n  scriptsTags(archived: $archived) {\n    id\n    key\n  }\n}\n"
  }
};
})();

(node as any).hash = "470c36733098c77e4bbb81a213d9f34a";

export default node;
