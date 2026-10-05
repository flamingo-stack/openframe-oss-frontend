/**
 * @generated SignedSource<<fc057ff216fa52615fd43cc57381176b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type useRemoveTagMutation$variables = {
  itemId: string;
  tagId: string;
};
export type useRemoveTagMutation$data = {
  readonly removeTagFromKnowledgeBaseItem: {
    readonly id: string;
    readonly tags: ReadonlyArray<{
      readonly color: string | null | undefined;
      readonly id: string;
      readonly key: string;
    }>;
  };
};
export type useRemoveTagMutation = {
  response: useRemoveTagMutation$data;
  variables: useRemoveTagMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "itemId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "tagId"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "itemId",
        "variableName": "itemId"
      },
      {
        "kind": "Variable",
        "name": "tagId",
        "variableName": "tagId"
      }
    ],
    "concreteType": "KnowledgeBaseItem",
    "kind": "LinkedField",
    "name": "removeTagFromKnowledgeBaseItem",
    "plural": false,
    "selections": [
      (v1/*: any*/),
      {
        "alias": null,
        "args": null,
        "concreteType": "Tag",
        "kind": "LinkedField",
        "name": "tags",
        "plural": true,
        "selections": [
          (v1/*: any*/),
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
            "name": "color",
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
    "name": "useRemoveTagMutation",
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useRemoveTagMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "c8b542c613029ee45e4a0c3c988fd6d9",
    "id": null,
    "metadata": {},
    "name": "useRemoveTagMutation",
    "operationKind": "mutation",
    "text": "mutation useRemoveTagMutation(\n  $itemId: ID!\n  $tagId: ID!\n) {\n  removeTagFromKnowledgeBaseItem(itemId: $itemId, tagId: $tagId) {\n    id\n    tags {\n      id\n      key\n      color\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "99bfe22a9f0e7d9bd8e43d1b4ff39c81";

export default node;
