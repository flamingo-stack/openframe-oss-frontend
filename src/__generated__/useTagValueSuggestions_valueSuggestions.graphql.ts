/**
 * @generated SignedSource<<90e2e8114192d69dd9ffe99d489f6e42>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type useTagValueSuggestions_valueSuggestions$data = {
  readonly tagValueSuggestions: ReadonlyArray<string>;
  readonly " $fragmentType": "useTagValueSuggestions_valueSuggestions";
};
export type useTagValueSuggestions_valueSuggestions$key = {
  readonly " $data"?: useTagValueSuggestions_valueSuggestions$data;
  readonly " $fragmentSpreads": FragmentRefs<"useTagValueSuggestions_valueSuggestions">;
};

import useTagValueSuggestions_valueSuggestionsRefetchQuery_graphql from './useTagValueSuggestions_valueSuggestionsRefetchQuery.graphql';

const node: ReaderFragment = {
  "argumentDefinitions": [
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
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": useTagValueSuggestions_valueSuggestionsRefetchQuery_graphql
    }
  },
  "name": "useTagValueSuggestions_valueSuggestions",
  "selections": [
    {
      "alias": null,
      "args": [
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
      ],
      "kind": "ScalarField",
      "name": "tagValueSuggestions",
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "b852578a2588fac3b8be5a336026926f";

export default node;
