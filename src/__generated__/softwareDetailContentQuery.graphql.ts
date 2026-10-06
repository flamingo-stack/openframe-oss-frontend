/**
 * @generated SignedSource<<bf92667897a9765d814989dd2a0ec98e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type softwareDetailContentQuery$variables = {
  id: string;
};
export type softwareDetailContentQuery$data = {
  readonly software: {
    readonly name: string;
    readonly " $fragmentSpreads": FragmentRefs<"softwareDetailHeader_software" | "softwareDetailSummary_software">;
  } | null | undefined;
};
export type softwareDetailContentQuery = {
  response: softwareDetailContentQuery$data;
  variables: softwareDetailContentQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "softwareDetailContentQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Software",
        "kind": "LinkedField",
        "name": "software",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "softwareDetailHeader_software"
          },
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "softwareDetailSummary_software"
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "softwareDetailContentQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Software",
        "kind": "LinkedField",
        "name": "software",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "publisher",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "latestVersion",
            "storageKey": null
          },
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
    "cacheID": "e6de9d3ae7e03437f0925178d38e4fbb",
    "id": null,
    "metadata": {},
    "name": "softwareDetailContentQuery",
    "operationKind": "query",
    "text": "query softwareDetailContentQuery(\n  $id: ID!\n) {\n  software(id: $id) {\n    name\n    ...softwareDetailHeader_software\n    ...softwareDetailSummary_software\n    id\n  }\n}\n\nfragment softwareDetailHeader_software on Software {\n  name\n}\n\nfragment softwareDetailSummary_software on Software {\n  publisher\n  latestVersion\n}\n"
  }
};
})();

(node as any).hash = "d9721132d2ba39162d0cdc0de39f8366";

export default node;
