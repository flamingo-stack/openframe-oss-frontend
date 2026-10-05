/**
 * @generated SignedSource<<cba646bd4fdbd42d0bbd6f097eb75a04>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type BillingMetricType = "AI_TOKENS" | "MANAGED_DEVICES" | "%future added value";
export type useSeedTestUsageMutation$variables = {
  metricType: BillingMetricType;
  value: number;
};
export type useSeedTestUsageMutation$data = {
  readonly seedTestUsage: {
    readonly billingDate: string;
    readonly dayValue: number;
    readonly metricType: string;
  };
};
export type useSeedTestUsageMutation = {
  response: useSeedTestUsageMutation$data;
  variables: useSeedTestUsageMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "metricType"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "value"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "metricType",
        "variableName": "metricType"
      },
      {
        "kind": "Variable",
        "name": "value",
        "variableName": "value"
      }
    ],
    "concreteType": "TestUsageResult",
    "kind": "LinkedField",
    "name": "seedTestUsage",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "metricType",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "billingDate",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "dayValue",
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
    "name": "useSeedTestUsageMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useSeedTestUsageMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "9f9f29e66551b09e7394b705c288c82e",
    "id": null,
    "metadata": {},
    "name": "useSeedTestUsageMutation",
    "operationKind": "mutation",
    "text": "mutation useSeedTestUsageMutation(\n  $metricType: BillingMetricType!\n  $value: Int!\n) {\n  seedTestUsage(metricType: $metricType, value: $value) {\n    metricType\n    billingDate\n    dayValue\n  }\n}\n"
  }
};
})();

(node as any).hash = "55ff1a6565008c4eef7c5943c26e1eb8";

export default node;
