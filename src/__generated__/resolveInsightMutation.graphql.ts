/**
 * @generated SignedSource<<1ba53689fde9a63726eabb59f305c9bc>>
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
export type resolveInsightMutation$variables = {
  input: InsightIdInput;
};
export type resolveInsightMutation$data = {
  readonly resolveInsight: {
    readonly id: string;
    readonly snoozedUntil: Instant | null | undefined;
    readonly status: InsightStatus;
  };
};
export type resolveInsightMutation = {
  response: resolveInsightMutation$data;
  variables: resolveInsightMutation$variables;
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
    "name": "resolveInsight",
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
    "name": "resolveInsightMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "resolveInsightMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "e0140d66154d522b2871ef7687cd5f66",
    "id": null,
    "metadata": {},
    "name": "resolveInsightMutation",
    "operationKind": "mutation",
    "text": "mutation resolveInsightMutation(\n  $input: InsightIdInput!\n) {\n  resolveInsight(input: $input) {\n    id\n    status\n    snoozedUntil\n  }\n}\n"
  }
};
})();

(node as any).hash = "0109415450e9341f0999f5ce11cb6b59";

export default node;
