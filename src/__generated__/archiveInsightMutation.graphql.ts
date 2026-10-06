/**
 * @generated SignedSource<<ae3b6cddc1a6c66ed5146faea6e6bf6f>>
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
export type archiveInsightMutation$variables = {
  input: InsightIdInput;
};
export type archiveInsightMutation$data = {
  readonly archiveInsight: {
    readonly id: string;
    readonly snoozedUntil: Instant | null | undefined;
    readonly status: InsightStatus;
  };
};
export type archiveInsightMutation = {
  response: archiveInsightMutation$data;
  variables: archiveInsightMutation$variables;
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
    "name": "archiveInsight",
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
    "name": "archiveInsightMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "archiveInsightMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "e49e58f7e60d2c1554a15fe0ea04cf1d",
    "id": null,
    "metadata": {},
    "name": "archiveInsightMutation",
    "operationKind": "mutation",
    "text": "mutation archiveInsightMutation(\n  $input: InsightIdInput!\n) {\n  archiveInsight(input: $input) {\n    id\n    status\n    snoozedUntil\n  }\n}\n"
  }
};
})();

(node as any).hash = "2899868edab5c980405a9f1145495636";

export default node;
