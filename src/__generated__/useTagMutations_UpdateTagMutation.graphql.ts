/**
 * @generated SignedSource<<350c00a9e58a10f8946075d08bba9190>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type TagEntityType = "DEVICE" | "KNOWLEDGE_ARTICLE" | "SCRIPT" | "TICKET" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type useTagMutations_UpdateTagMutation$variables = {
  color?: string | null | undefined;
  description?: string | null | undefined;
  id: string;
  key?: string | null | undefined;
};
export type useTagMutations_UpdateTagMutation$data = {
  readonly updateTag: {
    readonly color: string | null | undefined;
    readonly createdAt: Instant | null | undefined;
    readonly description: string | null | undefined;
    readonly entityType: TagEntityType | null | undefined;
    readonly id: string;
    readonly key: string;
  };
};
export type useTagMutations_UpdateTagMutation = {
  response: useTagMutations_UpdateTagMutation$data;
  variables: useTagMutations_UpdateTagMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "color"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "description"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "key"
},
v4 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "color",
        "variableName": "color"
      },
      {
        "kind": "Variable",
        "name": "description",
        "variableName": "description"
      },
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
      },
      {
        "kind": "Variable",
        "name": "key",
        "variableName": "key"
      }
    ],
    "concreteType": "Tag",
    "kind": "LinkedField",
    "name": "updateTag",
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
        "name": "key",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "description",
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
        "name": "entityType",
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
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "useTagMutations_UpdateTagMutation",
    "selections": (v4/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v3/*: any*/),
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "useTagMutations_UpdateTagMutation",
    "selections": (v4/*: any*/)
  },
  "params": {
    "cacheID": "3a62462106f77f0fc19246b178d62641",
    "id": null,
    "metadata": {},
    "name": "useTagMutations_UpdateTagMutation",
    "operationKind": "mutation",
    "text": "mutation useTagMutations_UpdateTagMutation(\n  $id: ID!\n  $key: String\n  $description: String\n  $color: String\n) {\n  updateTag(id: $id, key: $key, description: $description, color: $color) {\n    id\n    key\n    description\n    color\n    entityType\n    createdAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "8cad79a6f8d782d1a45a25259140d085";

export default node;
