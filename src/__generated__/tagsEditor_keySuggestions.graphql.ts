/**
 * @generated SignedSource<<efb501d2bfeb05267f8e22cc9fb61aad>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type tagsEditor_keySuggestions$data = {
  readonly tagKeySuggestions: ReadonlyArray<{
    readonly id: string;
    readonly key: string;
    readonly values: ReadonlyArray<string> | null | undefined;
  }>;
  readonly " $fragmentType": "tagsEditor_keySuggestions";
};
export type tagsEditor_keySuggestions$key = {
  readonly " $data"?: tagsEditor_keySuggestions$data;
  readonly " $fragmentSpreads": FragmentRefs<"tagsEditor_keySuggestions">;
};

import tagsEditorKeySuggestionsRefetchQuery_graphql from './tagsEditorKeySuggestionsRefetchQuery.graphql';

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
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": tagsEditorKeySuggestionsRefetchQuery_graphql
    }
  },
  "name": "tagsEditor_keySuggestions",
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
        }
      ],
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
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "e57ffc0ec485fc87da99610f2197c063";

export default node;
