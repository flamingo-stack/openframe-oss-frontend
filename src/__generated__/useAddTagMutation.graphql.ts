/**
 * @generated SignedSource<<ed5609fb57d7dfba73fd499c7c87eda8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type useAddTagMutation$variables = {
  itemId: string;
  tagId: string;
};
export type useAddTagMutation$data = {
  readonly addTagToKnowledgeBaseItem: {
    readonly id: string;
    readonly tags: ReadonlyArray<{
      readonly color: string | null | undefined;
      readonly id: string;
      readonly key: string;
    }>;
  };
};
export type useAddTagMutation = {
  response: useAddTagMutation$data;
  variables: useAddTagMutation$variables;
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
    "name": "addTagToKnowledgeBaseItem",
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
    "name": "useAddTagMutation",
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useAddTagMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "7a49fd49b54fc5e1c35328d2ad540394",
    "id": null,
    "metadata": {},
    "name": "useAddTagMutation",
    "operationKind": "mutation",
    "text": "mutation useAddTagMutation(\n  $itemId: ID!\n  $tagId: ID!\n) {\n  addTagToKnowledgeBaseItem(itemId: $itemId, tagId: $tagId) {\n    id\n    tags {\n      id\n      key\n      color\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "db61d315762d2017eeb0a7791a0443f0";

export default node;
