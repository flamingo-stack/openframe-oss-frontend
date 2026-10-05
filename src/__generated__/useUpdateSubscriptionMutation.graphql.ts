/**
 * @generated SignedSource<<dd038ca51e7241cc3786a5787a820cff>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type OpenframeProduct = "AI_ASSISTANCE" | "MANAGED_DEVICES" | "%future added value";
export type SubscriptionStatus = "ACTIVE" | "CANCELED" | "PAST_DUE" | "PENDING_CANCELLATION" | "SUSPENDED" | "TRIAL" | "TRIAL_EXPIRED" | "%future added value";
export type UpdateAction = "ADD" | "CANCEL" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { LocalDate } from "../lib/graphql-scalars";
export type UpdateSubscriptionInput = {
  discountCode?: string | null | undefined;
  packageUpdates?: ReadonlyArray<PackageUpdateInput> | null | undefined;
};
export type PackageUpdateInput = {
  action: UpdateAction;
  packageOptionId: string;
  productName: OpenframeProduct;
  quantity?: number | null | undefined;
};
export type useUpdateSubscriptionMutation$variables = {
  input: UpdateSubscriptionInput;
};
export type useUpdateSubscriptionMutation$data = {
  readonly updateSubscription: {
    readonly errors: ReadonlyArray<{
      readonly code: string;
      readonly field: string | null | undefined;
      readonly message: string;
    }>;
    readonly subscription: {
      readonly cancellationEffectiveAt: LocalDate | null | undefined;
      readonly currentPeriodEnd: LocalDate | null | undefined;
      readonly id: string;
      readonly pendingInvoices: ReadonlyArray<{
        readonly createdAt: Instant;
        readonly hostedInvoiceUrl: string;
        readonly id: string;
      }>;
      readonly startDate: LocalDate | null | undefined;
      readonly status: SubscriptionStatus;
    };
  };
};
export type useUpdateSubscriptionMutation = {
  response: useUpdateSubscriptionMutation$data;
  variables: useUpdateSubscriptionMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "UpdateSubscriptionResult",
    "kind": "LinkedField",
    "name": "updateSubscription",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "SubscriptionDetail",
        "kind": "LinkedField",
        "name": "subscription",
        "plural": false,
        "selections": [
          (v1/*: any*/),
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
            "name": "startDate",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "currentPeriodEnd",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "cancellationEffectiveAt",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "PendingInvoice",
            "kind": "LinkedField",
            "name": "pendingInvoices",
            "plural": true,
            "selections": [
              (v1/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "hostedInvoiceUrl",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "createdAt",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "UserError",
        "kind": "LinkedField",
        "name": "errors",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "code",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "message",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "field",
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
    "name": "useUpdateSubscriptionMutation",
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useUpdateSubscriptionMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "7e8d510bcc0dd70555a14f6276ae0f48",
    "id": null,
    "metadata": {},
    "name": "useUpdateSubscriptionMutation",
    "operationKind": "mutation",
    "text": "mutation useUpdateSubscriptionMutation(\n  $input: UpdateSubscriptionInput!\n) {\n  updateSubscription(input: $input) {\n    subscription {\n      id\n      status\n      startDate\n      currentPeriodEnd\n      cancellationEffectiveAt\n      pendingInvoices {\n        id\n        hostedInvoiceUrl\n        createdAt\n      }\n    }\n    errors {\n      code\n      message\n      field\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "07d9f161e0f59ca4bf9a21a6c31638bd";

export default node;
