/**
 * @generated SignedSource<<4885b528eee6ae0642e61f8761ad4e7e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type useKnowledgeBaseTagsQuery$variables = {
  archived?: boolean | null | undefined;
  folderId?: string | null | undefined;
};
export type useKnowledgeBaseTagsQuery$data = {
  readonly knowledgeBaseTags: ReadonlyArray<{
    readonly color: string | null | undefined;
    readonly description: string | null | undefined;
    readonly id: string;
    readonly key: string;
  }>;
};
export type useKnowledgeBaseTagsQuery = {
  response: useKnowledgeBaseTagsQuery$data;
  variables: useKnowledgeBaseTagsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "archived"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "folderId"
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "archived",
        "variableName": "archived"
      },
      {
        "kind": "Variable",
        "name": "folderId",
        "variableName": "folderId"
      }
    ],
    "concreteType": "Tag",
    "kind": "LinkedField",
    "name": "knowledgeBaseTags",
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
        "name": "color",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "description",
        "storageKey": null
      }
    ],
    "storageKey": null
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
    "name": "useKnowledgeBaseTagsQuery",
    "selections": (v2/*: any*/),
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
    "name": "useKnowledgeBaseTagsQuery",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "e87a71ff589c38548fd3ccb9171827d9",
    "id": null,
    "metadata": {},
    "name": "useKnowledgeBaseTagsQuery",
    "operationKind": "query",
    "text": "query useKnowledgeBaseTagsQuery(\n  $folderId: ID\n  $archived: Boolean\n) {\n  knowledgeBaseTags(folderId: $folderId, archived: $archived) {\n    id\n    key\n    color\n    description\n  }\n}\n"
  }
};
})();

(node as any).hash = "cc27b87512c233d53e62f276594c0143";

export default node;
