/**
 * @generated SignedSource<<864fdabd9e61428bb9819d1cb6c98274>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type BrewPackageType = "CASK" | "FORMULA" | "%future added value";
export type PackageManagerType = "BREW" | "CHOCO" | "WINGET" | "%future added value";
export type packageSearchFieldQuery$variables = {
  first: number;
  list: boolean;
  packageManager: PackageManagerType;
  search: string;
};
export type packageSearchFieldQuery$data = {
  readonly searchPackages?: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly description: string | null | undefined;
        readonly id: string;
        readonly name: string;
        readonly packageType: BrewPackageType | null | undefined;
        readonly version: string | null | undefined;
      };
    }>;
  };
};
export type packageSearchFieldQuery = {
  response: packageSearchFieldQuery$data;
  variables: packageSearchFieldQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "first"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "list"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "packageManager"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "search"
},
v4 = [
  {
    "condition": "list",
    "kind": "Condition",
    "passingValue": true,
    "selections": [
      {
        "alias": null,
        "args": [
          {
            "kind": "Variable",
            "name": "first",
            "variableName": "first"
          },
          {
            "kind": "Variable",
            "name": "packageManager",
            "variableName": "packageManager"
          },
          {
            "kind": "Variable",
            "name": "search",
            "variableName": "search"
          }
        ],
        "concreteType": "PackageSearchConnection",
        "kind": "LinkedField",
        "name": "searchPackages",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "PackageSearchEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "PackageSearchItem",
                "kind": "LinkedField",
                "name": "node",
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
                    "name": "name",
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
                    "name": "version",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "packageType",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
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
    "name": "packageSearchFieldQuery",
    "selections": (v4/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v3/*: any*/),
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "packageSearchFieldQuery",
    "selections": (v4/*: any*/)
  },
  "params": {
    "cacheID": "af527082673b109970ab760b3edaefd0",
    "id": null,
    "metadata": {},
    "name": "packageSearchFieldQuery",
    "operationKind": "query",
    "text": "query packageSearchFieldQuery(\n  $packageManager: PackageManagerType!\n  $search: String!\n  $first: Int!\n  $list: Boolean!\n) {\n  searchPackages(packageManager: $packageManager, search: $search, first: $first) @include(if: $list) {\n    edges {\n      node {\n        id\n        name\n        description\n        version\n        packageType\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "040809f75ba2f4f52c33d8b9860b3ca8";

export default node;
