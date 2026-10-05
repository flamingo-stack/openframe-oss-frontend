/**
 * @generated SignedSource<<523060e70d0758ce06a145430d022a04>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type useKnowledgeBaseItemsFoldersQuery$variables = Record<PropertyKey, never>;
export type useKnowledgeBaseItemsFoldersQuery$data = {
  readonly knowledgeBaseFolderTree: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly parentId: string | null | undefined;
  }>;
};
export type useKnowledgeBaseItemsFoldersQuery = {
  response: useKnowledgeBaseItemsFoldersQuery$data;
  variables: useKnowledgeBaseItemsFoldersQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "KnowledgeBaseItem",
    "kind": "LinkedField",
    "name": "knowledgeBaseFolderTree",
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
        "name": "name",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "parentId",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useKnowledgeBaseItemsFoldersQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "useKnowledgeBaseItemsFoldersQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "7a46755981eae4fc1da003ad075277cd",
    "id": null,
    "metadata": {},
    "name": "useKnowledgeBaseItemsFoldersQuery",
    "operationKind": "query",
    "text": "query useKnowledgeBaseItemsFoldersQuery {\n  knowledgeBaseFolderTree {\n    id\n    name\n    parentId\n  }\n}\n"
  }
};
})();

(node as any).hash = "ef6ce4bb707c5c411a3ccfe0dc12cc37";

export default node;
