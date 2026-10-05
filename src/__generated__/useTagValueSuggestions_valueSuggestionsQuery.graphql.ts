/**
 * @generated SignedSource<<321d385f4beb0b52aa350d65c645dd15>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type useTagValueSuggestions_valueSuggestionsQuery$variables = {
  limit?: number | null | undefined;
  tagKey: string;
};
export type useTagValueSuggestions_valueSuggestionsQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"useTagValueSuggestions_valueSuggestions">;
};
export type useTagValueSuggestions_valueSuggestionsQuery = {
  response: useTagValueSuggestions_valueSuggestionsQuery$data;
  variables: useTagValueSuggestions_valueSuggestionsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "limit"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "tagKey"
},
v2 = [
  {
    "kind": "Variable",
    "name": "limit",
    "variableName": "limit"
  },
  {
    "kind": "Variable",
    "name": "tagKey",
    "variableName": "tagKey"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "useTagValueSuggestions_valueSuggestionsQuery",
    "selections": [
      {
        "args": (v2/*: any*/),
        "kind": "FragmentSpread",
        "name": "useTagValueSuggestions_valueSuggestions"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "useTagValueSuggestions_valueSuggestionsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "kind": "ScalarField",
        "name": "tagValueSuggestions",
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "5f3207043fa20631f9c4bc0106ca7261",
    "id": null,
    "metadata": {},
    "name": "useTagValueSuggestions_valueSuggestionsQuery",
    "operationKind": "query",
    "text": "query useTagValueSuggestions_valueSuggestionsQuery(\n  $tagKey: String!\n  $limit: Int\n) {\n  ...useTagValueSuggestions_valueSuggestions_3AuyLI\n}\n\nfragment useTagValueSuggestions_valueSuggestions_3AuyLI on Query {\n  tagValueSuggestions(tagKey: $tagKey, limit: $limit)\n}\n"
  }
};
})();

(node as any).hash = "f741c400545a8b5e93ff7cd1910ee1c5";

export default node;
