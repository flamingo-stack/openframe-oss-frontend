/**
 * @generated SignedSource<<5d887f053f24735df329380196030c6e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type InsightStatus = "ACKNOWLEDGED" | "ARCHIVED" | "NEW" | "RESOLVED" | "SNOOZED" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
export type SnoozeInsightInput = {
  id: string;
  until: Instant;
};
export type snoozeInsightMutation$variables = {
  input: SnoozeInsightInput;
};
export type snoozeInsightMutation$data = {
  readonly snoozeInsight: {
    readonly id: string;
    readonly snoozedUntil: Instant | null | undefined;
    readonly status: InsightStatus;
  };
};
export type snoozeInsightMutation = {
  response: snoozeInsightMutation$data;
  variables: snoozeInsightMutation$variables;
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
    "name": "snoozeInsight",
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
    "name": "snoozeInsightMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "snoozeInsightMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "a127f589277c6f618626a436f41bd29d",
    "id": null,
    "metadata": {},
    "name": "snoozeInsightMutation",
    "operationKind": "mutation",
    "text": "mutation snoozeInsightMutation(\n  $input: SnoozeInsightInput!\n) {\n  snoozeInsight(input: $input) {\n    id\n    status\n    snoozedUntil\n  }\n}\n"
  }
};
})();

(node as any).hash = "dd94f85e1b252305545fe3723f9226e2";

export default node;
