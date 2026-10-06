/**
 * @generated SignedSource<<a1ed6bf0187a93092d226ef77514cc40>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type useSoftwareActionFiltersQuery$variables = Record<PropertyKey, never>;
export type useSoftwareActionFiltersQuery$data = {
  readonly softwareActionFilters: {
    readonly actions: ReadonlyArray<{
      readonly count: number;
      readonly label: string;
      readonly value: string;
    }>;
    readonly engines: ReadonlyArray<{
      readonly count: number;
      readonly label: string;
      readonly value: string;
    }>;
    readonly statuses: ReadonlyArray<{
      readonly count: number;
      readonly label: string;
      readonly value: string;
    }>;
  };
};
export type useSoftwareActionFiltersQuery = {
  response: useSoftwareActionFiltersQuery$data;
  variables: useSoftwareActionFiltersQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "value",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "label",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "count",
    "storageKey": null
  }
],
v1 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "SoftwareActionFilters",
    "kind": "LinkedField",
    "name": "softwareActionFilters",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ScriptFilterOption",
        "kind": "LinkedField",
        "name": "actions",
        "plural": true,
        "selections": (v0/*: any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "ScriptFilterOption",
        "kind": "LinkedField",
        "name": "engines",
        "plural": true,
        "selections": (v0/*: any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "ScriptFilterOption",
        "kind": "LinkedField",
        "name": "statuses",
        "plural": true,
        "selections": (v0/*: any*/),
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
    "name": "useSoftwareActionFiltersQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "useSoftwareActionFiltersQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "d170dd70b2669e0abe869d3662fef7a0",
    "id": null,
    "metadata": {},
    "name": "useSoftwareActionFiltersQuery",
    "operationKind": "query",
    "text": "query useSoftwareActionFiltersQuery {\n  softwareActionFilters {\n    actions {\n      value\n      label\n      count\n    }\n    engines {\n      value\n      label\n      count\n    }\n    statuses {\n      value\n      label\n      count\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a262531d667022f161c96fe9fe41a958";

export default node;
