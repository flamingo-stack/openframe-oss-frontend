/**
 * @generated SignedSource<<4e36c44f9f0890b12eb788e186c5b85c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type tagsEditorQuery$variables = {
  limit?: number | null | undefined;
};
export type tagsEditorQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"tagsEditor_keySuggestions">;
};
export type tagsEditorQuery = {
  response: tagsEditorQuery$data;
  variables: tagsEditorQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "limit"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "limit",
    "variableName": "limit"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "tagsEditorQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "tagsEditor_keySuggestions"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "tagsEditorQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Tag",
        "kind": "LinkedField",
        "name": "tagKeySuggestions",
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
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "values",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "4e8ef2a7800846445f0198d9ff5c8cac",
    "id": null,
    "metadata": {},
    "name": "tagsEditorQuery",
    "operationKind": "query",
    "text": "query tagsEditorQuery(\n  $limit: Int\n) {\n  ...tagsEditor_keySuggestions_1UvIyz\n}\n\nfragment tagsEditor_keySuggestions_1UvIyz on Query {\n  tagKeySuggestions(limit: $limit) {\n    id\n    key\n    values\n  }\n}\n"
  }
};
})();

(node as any).hash = "7456aa0f4457103abbf50704b6830683";

export default node;
