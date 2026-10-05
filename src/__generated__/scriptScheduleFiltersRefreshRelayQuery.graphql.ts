/**
 * @generated SignedSource<<76a4cd72dc6906bbbc6c637d0788b5af>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type OsType = "MAC_OS" | "WINDOWS" | "%future added value";
export type ScriptStatus = "ACTIVE" | "ARCHIVED" | "DELETED" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type ScriptScheduleFilterInput = {
  authorIds?: ReadonlyArray<string> | null | undefined;
  startAtFrom?: Instant | null | undefined;
  startAtTo?: Instant | null | undefined;
  statuses?: ReadonlyArray<ScriptStatus> | null | undefined;
  supportedPlatforms?: ReadonlyArray<OsType> | null | undefined;
};
export type scriptScheduleFiltersRefreshRelayQuery$variables = {
  filter?: ScriptScheduleFilterInput | null | undefined;
};
export type scriptScheduleFiltersRefreshRelayQuery$data = {
  readonly scriptScheduleFilters: {
    readonly platforms: ReadonlyArray<{
      readonly count: number;
      readonly label: string;
      readonly value: string;
    }>;
  };
};
export type scriptScheduleFiltersRefreshRelayQuery = {
  response: scriptScheduleFiltersRefreshRelayQuery$data;
  variables: scriptScheduleFiltersRefreshRelayQuery$variables;
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
    "args": [
      {
        "kind": "Variable",
        "name": "filter",
        "variableName": "filter"
      }
    ],
    "concreteType": "ScriptScheduleFilters",
    "kind": "LinkedField",
    "name": "scriptScheduleFilters",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ScriptFilterOption",
        "kind": "LinkedField",
        "name": "platforms",
        "plural": true,
        "selections": [
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
    "name": "scriptScheduleFiltersRefreshRelayQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "scriptScheduleFiltersRefreshRelayQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "97159ec0765a8e8a8e7f503385e8ac69",
    "id": null,
    "metadata": {},
    "name": "scriptScheduleFiltersRefreshRelayQuery",
    "operationKind": "query",
    "text": "query scriptScheduleFiltersRefreshRelayQuery(\n  $filter: ScriptScheduleFilterInput\n) {\n  scriptScheduleFilters(filter: $filter) {\n    platforms {\n      value\n      label\n      count\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e606a25d157b1959d87ae642d48edfde";

export default node;
