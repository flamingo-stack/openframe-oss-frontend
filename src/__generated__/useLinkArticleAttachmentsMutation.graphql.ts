/**
 * @generated SignedSource<<590d0e32ab14cd9839ca3a07af0e4e6e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { Instant } from "../lib/graphql-scalars";
import type { Long } from "../lib/graphql-scalars";
export type LinkKnowledgeBaseTempAttachmentsInput = {
  articleId: string;
  tempIds: ReadonlyArray<string>;
};
export type useLinkArticleAttachmentsMutation$variables = {
  input: LinkKnowledgeBaseTempAttachmentsInput;
};
export type useLinkArticleAttachmentsMutation$data = {
  readonly linkKnowledgeBaseTempAttachmentsToArticle: ReadonlyArray<{
    readonly contentType: string | null | undefined;
    readonly createdAt: Instant | null | undefined;
    readonly fileName: string;
    readonly fileSize: Long | null | undefined;
    readonly id: string;
  }>;
};
export type useLinkArticleAttachmentsMutation = {
  response: useLinkArticleAttachmentsMutation$data;
  variables: useLinkArticleAttachmentsMutation$variables;
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
    "concreteType": "KnowledgeBaseItemAttachment",
    "kind": "LinkedField",
    "name": "linkKnowledgeBaseTempAttachmentsToArticle",
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
        "name": "fileName",
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
        "name": "contentType",
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
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useLinkArticleAttachmentsMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useLinkArticleAttachmentsMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "5f2fd50ce64261d912315c9262fb7dff",
    "id": null,
    "metadata": {},
    "name": "useLinkArticleAttachmentsMutation",
    "operationKind": "mutation",
    "text": "mutation useLinkArticleAttachmentsMutation(\n  $input: LinkKnowledgeBaseTempAttachmentsInput!\n) {\n  linkKnowledgeBaseTempAttachmentsToArticle(input: $input) {\n    id\n    fileName\n    fileSize\n    contentType\n    createdAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "57c2c4bdf1153a5072e37a85e0086c4b";

export default node;
