/**
 * @generated SignedSource<<82972a116ca20330345ee00d0db8dcc5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
import type { Instant } from "../lib/graphql-scalars";
export type AddInsightNoteInput = {
  content: string;
  insightId: string;
};
export type addInsightNoteMutation$variables = {
  connections: ReadonlyArray<string>;
  input: AddInsightNoteInput;
};
export type addInsightNoteMutation$data = {
  readonly addInsightNote: {
    readonly author: {
      readonly " $fragmentSpreads": FragmentRefs<"insightUserFields_user">;
    } | null | undefined;
    readonly authorId: string;
    readonly content: string;
    readonly createdAt: Instant;
    readonly id: string;
  };
};
export type addInsightNoteMutation = {
  response: addInsightNoteMutation$data;
  variables: addInsightNoteMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connections"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "content",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "authorId",
  "storageKey": null
},
v6 = [
  (v3/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "firstName",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "lastName",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "email",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "status",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "UserImage",
    "kind": "LinkedField",
    "name": "image",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "imageUrl",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "hash",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
],
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "addInsightNoteMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "InsightNote",
        "kind": "LinkedField",
        "name": "addInsightNote",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          (v4/*: any*/),
          (v5/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "User",
            "kind": "LinkedField",
            "name": "author",
            "plural": false,
            "selections": [
              {
                "kind": "InlineDataFragmentSpread",
                "name": "insightUserFields_user",
                "selections": (v6/*: any*/),
                "args": null,
                "argumentDefinitions": []
              }
            ],
            "storageKey": null
          },
          (v7/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "addInsightNoteMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "InsightNote",
        "kind": "LinkedField",
        "name": "addInsightNote",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          (v4/*: any*/),
          (v5/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "User",
            "kind": "LinkedField",
            "name": "author",
            "plural": false,
            "selections": (v6/*: any*/),
            "storageKey": null
          },
          (v7/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v2/*: any*/),
        "filters": null,
        "handle": "prependNode",
        "key": "",
        "kind": "LinkedHandle",
        "name": "addInsightNote",
        "handleArgs": [
          {
            "kind": "Variable",
            "name": "connections",
            "variableName": "connections"
          },
          {
            "kind": "Literal",
            "name": "edgeTypeName",
            "value": "InsightNoteEdge"
          }
        ]
      }
    ]
  },
  "params": {
    "cacheID": "a2123fd87b69f898d21afb662e4c11d7",
    "id": null,
    "metadata": {},
    "name": "addInsightNoteMutation",
    "operationKind": "mutation",
    "text": "mutation addInsightNoteMutation(\n  $input: AddInsightNoteInput!\n) {\n  addInsightNote(input: $input) {\n    id\n    content\n    authorId\n    author {\n      ...insightUserFields_user\n      id\n    }\n    createdAt\n  }\n}\n\nfragment insightUserFields_user on User {\n  id\n  firstName\n  lastName\n  email\n  status\n  image {\n    imageUrl\n    hash\n  }\n}\n"
  }
};
})();

(node as any).hash = "c45f0639370e444cb36f7eca3c357873";

export default node;
