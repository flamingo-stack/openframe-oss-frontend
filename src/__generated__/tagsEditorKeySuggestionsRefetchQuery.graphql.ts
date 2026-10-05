/**
 * @generated SignedSource<<e2df0c25a1a0769964d72ee50733cc17>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type tagsEditorKeySuggestionsRefetchQuery$variables = {
  limit?: number | null | undefined;
  search?: string | null | undefined;
};
export type tagsEditorKeySuggestionsRefetchQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"tagsEditor_keySuggestions">;
};
export type tagsEditorKeySuggestionsRefetchQuery = {
  response: tagsEditorKeySuggestionsRefetchQuery$data;
  variables: tagsEditorKeySuggestionsRefetchQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "limit"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "search"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "limit",
    "variableName": "limit"
  },
  {
    "kind": "Variable",
    "name": "search",
    "variableName": "search"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "tagsEditorKeySuggestionsRefetchQuery",
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
    "name": "tagsEditorKeySuggestionsRefetchQuery",
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
    "cacheID": "35dbf1de52c9bf065c6b048cb04c3e1b",
    "id": null,
    "metadata": {},
    "name": "tagsEditorKeySuggestionsRefetchQuery",
    "operationKind": "query",
    "text": "query tagsEditorKeySuggestionsRefetchQuery(\n  $limit: Int\n  $search: String\n) {\n  ...tagsEditor_keySuggestions_n64eu\n}\n\nfragment tagsEditor_keySuggestions_n64eu on Query {\n  tagKeySuggestions(search: $search, limit: $limit) {\n    id\n    key\n    values\n  }\n}\n"
  }
};
})();

(node as any).hash = "e57ffc0ec485fc87da99610f2197c063";

export default node;
