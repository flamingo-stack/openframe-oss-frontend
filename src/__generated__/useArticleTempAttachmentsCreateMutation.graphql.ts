/**
 * @generated SignedSource<<dc9230f99fcf5c713cb644c87e1f31de>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { Instant } from "../lib/graphql-scalars";
import type { Long } from "../lib/graphql-scalars";
export type CreateKnowledgeBaseTempAttachmentInput = {
  contentType?: string | null | undefined;
  fileName: string;
  fileSize?: Long | null | undefined;
};
export type useArticleTempAttachmentsCreateMutation$variables = {
  input: CreateKnowledgeBaseTempAttachmentInput;
};
export type useArticleTempAttachmentsCreateMutation$data = {
  readonly createKnowledgeBaseTempAttachmentUploadUrl: {
    readonly tempAttachment: {
      readonly contentType: string | null | undefined;
      readonly createdAt: Instant | null | undefined;
      readonly fileName: string;
      readonly fileSize: Long | null | undefined;
      readonly id: string;
      readonly uploadUrl: string;
    } | null | undefined;
    readonly userErrors: ReadonlyArray<{
      readonly field: ReadonlyArray<string> | null | undefined;
      readonly message: string;
    }>;
  };
};
export type useArticleTempAttachmentsCreateMutation = {
  response: useArticleTempAttachmentsCreateMutation$data;
  variables: useArticleTempAttachmentsCreateMutation$variables;
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
    "concreteType": "KnowledgeBaseTempAttachmentPayload",
    "kind": "LinkedField",
    "name": "createKnowledgeBaseTempAttachmentUploadUrl",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "TempAttachment",
        "kind": "LinkedField",
        "name": "tempAttachment",
        "plural": false,
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
            "name": "fileName",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "contentType",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "fileSize",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "uploadUrl",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "createdAt",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
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
    "name": "useArticleTempAttachmentsCreateMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useArticleTempAttachmentsCreateMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "75dfee8a88e80f4d03c83c8163e18b02",
    "id": null,
    "metadata": {},
    "name": "useArticleTempAttachmentsCreateMutation",
    "operationKind": "mutation",
    "text": "mutation useArticleTempAttachmentsCreateMutation(\n  $input: CreateKnowledgeBaseTempAttachmentInput!\n) {\n  createKnowledgeBaseTempAttachmentUploadUrl(input: $input) {\n    tempAttachment {\n      id\n      fileName\n      contentType\n      fileSize\n      uploadUrl\n      createdAt\n    }\n    userErrors {\n      field\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "63f1bef9ceda889b078e604ccd1b790d";

export default node;
