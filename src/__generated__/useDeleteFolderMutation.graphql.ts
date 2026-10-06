/**
 * @generated SignedSource<<8e410a80d65d190a860153efceb35ade>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type FolderChildrenAction = "ARCHIVE" | "MOVE" | "%future added value";
export type DeleteFolderInput = {
  childrenAction?: FolderChildrenAction | null | undefined;
  id: string;
  moveTargetFolderId?: string | null | undefined;
};
export type useDeleteFolderMutation$variables = {
  input: DeleteFolderInput;
};
export type useDeleteFolderMutation$data = {
  readonly deleteFolder: boolean;
};
export type useDeleteFolderMutation = {
  response: useDeleteFolderMutation$data;
  variables: useDeleteFolderMutation$variables;
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
    "kind": "ScalarField",
    "name": "deleteFolder",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useDeleteFolderMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useDeleteFolderMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "cfce8d458b2e59ed9662294e4a6740d4",
    "id": null,
    "metadata": {},
    "name": "useDeleteFolderMutation",
    "operationKind": "mutation",
    "text": "mutation useDeleteFolderMutation(\n  $input: DeleteFolderInput!\n) {\n  deleteFolder(input: $input)\n}\n"
  }
};
})();

(node as any).hash = "9bb0a81d681310ba9e7cdd07622e6f51";

export default node;
