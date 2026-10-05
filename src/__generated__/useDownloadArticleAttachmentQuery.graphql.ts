/**
 * @generated SignedSource<<580da070277947f6ed96943a3cf54d51>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type useDownloadArticleAttachmentQuery$variables = {
  attachmentId: string;
};
export type useDownloadArticleAttachmentQuery$data = {
  readonly knowledgeBaseAttachmentDownloadUrl: string;
};
export type useDownloadArticleAttachmentQuery = {
  response: useDownloadArticleAttachmentQuery$data;
  variables: useDownloadArticleAttachmentQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "attachmentId"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "attachmentId",
        "variableName": "attachmentId"
      }
    ],
    "kind": "ScalarField",
    "name": "knowledgeBaseAttachmentDownloadUrl",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useDownloadArticleAttachmentQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useDownloadArticleAttachmentQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "a30386ac6fa85c6d7ad5baa800c01f14",
    "id": null,
    "metadata": {},
    "name": "useDownloadArticleAttachmentQuery",
    "operationKind": "query",
    "text": "query useDownloadArticleAttachmentQuery(\n  $attachmentId: ID!\n) {\n  knowledgeBaseAttachmentDownloadUrl(attachmentId: $attachmentId)\n}\n"
  }
};
})();

(node as any).hash = "e871ddb4c7640bb3a97054403d54ace1";

export default node;
