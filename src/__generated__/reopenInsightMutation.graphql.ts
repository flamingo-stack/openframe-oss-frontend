/**
 * @generated SignedSource<<ffb2bf0e360a6e1a7fbf8a06e0db3e07>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type InsightStatus = "ACKNOWLEDGED" | "ARCHIVED" | "NEW" | "RESOLVED" | "SNOOZED" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type InsightIdInput = {
  id: string;
};
export type reopenInsightMutation$variables = {
  input: InsightIdInput;
};
export type reopenInsightMutation$data = {
  readonly reopenInsight: {
    readonly id: string;
    readonly snoozedUntil: Instant | null | undefined;
    readonly status: InsightStatus;
  };
};
export type reopenInsightMutation = {
  response: reopenInsightMutation$data;
  variables: reopenInsightMutation$variables;
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
    "concreteType": "Insight",
    "kind": "LinkedField",
    "name": "reopenInsight",
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
        "name": "status",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "snoozedUntil",
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
    "name": "reopenInsightMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "reopenInsightMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "dc01f3723a6702a1462d65798d16062c",
    "id": null,
    "metadata": {},
    "name": "reopenInsightMutation",
    "operationKind": "mutation",
    "text": "mutation reopenInsightMutation(\n  $input: InsightIdInput!\n) {\n  reopenInsight(input: $input) {\n    id\n    status\n    snoozedUntil\n  }\n}\n"
  }
};
})();

(node as any).hash = "c648d0f817419e54b12a192b7ce14126";

export default node;
