/**
 * @generated SignedSource<<9606df1df492d1388efa7ba9fc2f75b9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type useTagValueSuggestions_valueSuggestionsRefetchQuery$variables = {
  limit?: number | null | undefined;
  search?: string | null | undefined;
  tagKey: string;
};
export type useTagValueSuggestions_valueSuggestionsRefetchQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"useTagValueSuggestions_valueSuggestions">;
};
export type useTagValueSuggestions_valueSuggestionsRefetchQuery = {
  response: useTagValueSuggestions_valueSuggestionsRefetchQuery$data;
  variables: useTagValueSuggestions_valueSuggestionsRefetchQuery$variables;
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
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "tagKey"
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
  },
  {
    "kind": "Variable",
    "name": "tagKey",
    "variableName": "tagKey"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useTagValueSuggestions_valueSuggestionsRefetchQuery",
    "selections": [
      {
        "args": (v1/*: any*/),
        "kind": "FragmentSpread",
        "name": "useTagValueSuggestions_valueSuggestions"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useTagValueSuggestions_valueSuggestionsRefetchQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "kind": "ScalarField",
        "name": "tagValueSuggestions",
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "16449f8de6becf8e4512d6c58b9e85de",
    "id": null,
    "metadata": {},
    "name": "useTagValueSuggestions_valueSuggestionsRefetchQuery",
    "operationKind": "query",
    "text": "query useTagValueSuggestions_valueSuggestionsRefetchQuery(\n  $limit: Int\n  $search: String\n  $tagKey: String!\n) {\n  ...useTagValueSuggestions_valueSuggestions_1qqOj0\n}\n\nfragment useTagValueSuggestions_valueSuggestions_1qqOj0 on Query {\n  tagValueSuggestions(tagKey: $tagKey, search: $search, limit: $limit)\n}\n"
  }
};
})();

(node as any).hash = "b852578a2588fac3b8be5a336026926f";

export default node;
