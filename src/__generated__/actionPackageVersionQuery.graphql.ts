/**
 * @generated SignedSource<<f435bcede34e3437d5a835218ee362f9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type BrewPackageType = "CASK" | "FORMULA" | "%future added value";
export type PackageManagerType = "BREW" | "CHOCO" | "WINGET" | "%future added value";
export type actionPackageVersionQuery$variables = {
  packageId: string;
  packageManager: PackageManagerType;
  packageType?: BrewPackageType | null | undefined;
};
export type actionPackageVersionQuery$data = {
  readonly packageDetails: {
    readonly versions: ReadonlyArray<{
      readonly version: string;
    }>;
  };
};
export type actionPackageVersionQuery = {
  response: actionPackageVersionQuery$data;
  variables: actionPackageVersionQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "packageId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "packageManager"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "packageType"
},
v3 = [
  {
    "kind": "Variable",
    "name": "packageId",
    "variableName": "packageId"
  },
  {
    "kind": "Variable",
    "name": "packageManager",
    "variableName": "packageManager"
  },
  {
    "kind": "Variable",
    "name": "packageType",
    "variableName": "packageType"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "concreteType": "PackageVersion",
  "kind": "LinkedField",
  "name": "versions",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "version",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "actionPackageVersionQuery",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": "PackageDetails",
        "kind": "LinkedField",
        "name": "packageDetails",
        "plural": false,
        "selections": [
          (v4/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Operation",
    "name": "actionPackageVersionQuery",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": "PackageDetails",
        "kind": "LinkedField",
        "name": "packageDetails",
        "plural": false,
        "selections": [
          (v4/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "8f0f7eb35d01a2cd2003d2d86738fc26",
    "id": null,
    "metadata": {},
    "name": "actionPackageVersionQuery",
    "operationKind": "query",
    "text": "query actionPackageVersionQuery(\n  $packageManager: PackageManagerType!\n  $packageId: ID!\n  $packageType: BrewPackageType\n) {\n  packageDetails(packageManager: $packageManager, packageId: $packageId, packageType: $packageType) {\n    versions {\n      version\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "658465ce1077306693a703c902156d2e";

export default node;
