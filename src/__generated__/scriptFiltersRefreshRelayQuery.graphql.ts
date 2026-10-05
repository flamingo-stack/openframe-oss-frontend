/**
 * @generated SignedSource<<989d91e47d5ac91b11f3569a3b4ca3b2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type OsType = "MAC_OS" | "WINDOWS" | "%future added value";
export type ScriptShell = "BASH" | "CMD" | "NUSHELL" | "POWERSHELL" | "PYTHON" | "SHELL" | "%future added value";
export type ScriptStatus = "ACTIVE" | "ARCHIVED" | "DELETED" | "%future added value";
export type ScriptFilterInput = {
  authorIds?: ReadonlyArray<string> | null | undefined;
  shells?: ReadonlyArray<ScriptShell> | null | undefined;
  statuses?: ReadonlyArray<ScriptStatus> | null | undefined;
  supportedPlatforms?: ReadonlyArray<OsType> | null | undefined;
  tagIds?: ReadonlyArray<string> | null | undefined;
};
export type scriptFiltersRefreshRelayQuery$variables = {
  filter?: ScriptFilterInput | null | undefined;
};
export type scriptFiltersRefreshRelayQuery$data = {
  readonly scriptFilters: {
    readonly authors: ReadonlyArray<{
      readonly count: number;
      readonly label: string;
      readonly value: string;
    }>;
    readonly platforms: ReadonlyArray<{
      readonly count: number;
      readonly label: string;
      readonly value: string;
    }>;
    readonly shells: ReadonlyArray<{
      readonly count: number;
      readonly label: string;
      readonly value: string;
    }>;
  };
};
export type scriptFiltersRefreshRelayQuery = {
  response: scriptFiltersRefreshRelayQuery$data;
  variables: scriptFiltersRefreshRelayQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "filter"
  }
],
v1 = [
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
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "filter",
        "variableName": "filter"
      }
    ],
    "concreteType": "ScriptFilters",
    "kind": "LinkedField",
    "name": "scriptFilters",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ScriptFilterOption",
        "kind": "LinkedField",
        "name": "shells",
        "plural": true,
        "selections": (v1/*: any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "ScriptFilterOption",
        "kind": "LinkedField",
        "name": "platforms",
        "plural": true,
        "selections": (v1/*: any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "ScriptFilterOption",
        "kind": "LinkedField",
        "name": "authors",
        "plural": true,
        "selections": (v1/*: any*/),
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "scriptFiltersRefreshRelayQuery",
    "selections": (v2/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "scriptFiltersRefreshRelayQuery",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "9abefbd43e70ee05ee89da8a519f108e",
    "id": null,
    "metadata": {},
    "name": "scriptFiltersRefreshRelayQuery",
    "operationKind": "query",
    "text": "query scriptFiltersRefreshRelayQuery(\n  $filter: ScriptFilterInput\n) {\n  scriptFilters(filter: $filter) {\n    shells {\n      value\n      label\n      count\n    }\n    platforms {\n      value\n      label\n      count\n    }\n    authors {\n      value\n      label\n      count\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "eec1940c5d3b5d0e0ae544fc8a09e387";

export default node;
