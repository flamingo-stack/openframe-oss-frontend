/**
 * @generated SignedSource<<01c8ef759f3f6cec27e83e120080bda1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type MutationDeleteInput = {
  id: string;
};
export type useArticleTempAttachmentsDeleteAttachmentMutation$variables = {
  input: MutationDeleteInput;
};
export type useArticleTempAttachmentsDeleteAttachmentMutation$data = {
  readonly deleteKnowledgeBaseAttachment: {
    readonly userErrors: ReadonlyArray<{
      readonly field: ReadonlyArray<string> | null | undefined;
      readonly message: string;
    }>;
  };
};
export type useArticleTempAttachmentsDeleteAttachmentMutation = {
  response: useArticleTempAttachmentsDeleteAttachmentMutation$data;
  variables: useArticleTempAttachmentsDeleteAttachmentMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "MutationDeletePayload",
    "kind": "LinkedField",
    "name": "deleteKnowledgeBaseAttachment",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "MutationError",
        "kind": "LinkedField",
        "name": "userErrors",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "field",
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
    "name": "useArticleTempAttachmentsDeleteAttachmentMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useArticleTempAttachmentsDeleteAttachmentMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "d684096405d2d0e7070d37eac1cd69ee",
    "id": null,
    "metadata": {},
    "name": "useArticleTempAttachmentsDeleteAttachmentMutation",
    "operationKind": "mutation",
    "text": "mutation useArticleTempAttachmentsDeleteAttachmentMutation(\n  $input: MutationDeleteInput!\n) {\n  deleteKnowledgeBaseAttachment(input: $input) {\n    userErrors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "3abcfd03d5a36c0240f694947c17a80b";

export default node;
