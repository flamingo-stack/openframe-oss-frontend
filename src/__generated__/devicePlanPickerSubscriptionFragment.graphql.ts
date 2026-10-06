/**
 * @generated SignedSource<<f59645f0ea09a1ec6f42a50deea5c80e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type BillingPeriod = "MONTHLY" | "YEARLY" | "%future added value";
export type SubscriptionProductStatus = "ACTIVE" | "EXPIRED" | "PENDING_ACTIVATION" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type devicePlanPickerSubscriptionFragment$data = {
  readonly packageOptions: ReadonlyArray<{
    readonly billingPeriod: BillingPeriod | null | undefined;
    readonly id: string;
    readonly packageOptionId: string;
    readonly quantity: number | null | undefined;
    readonly status: SubscriptionProductStatus | null | undefined;
  }>;
  readonly paygOnly: boolean;
  readonly " $fragmentType": "devicePlanPickerSubscriptionFragment";
};
export type devicePlanPickerSubscriptionFragment$key = {
  readonly " $data"?: devicePlanPickerSubscriptionFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"devicePlanPickerSubscriptionFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "devicePlanPickerSubscriptionFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "paygOnly",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "SubscriptionOptionDetail",
      "kind": "LinkedField",
      "name": "packageOptions",
      "plural": true,
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
          "name": "packageOptionId",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "billingPeriod",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "quantity",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "status",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "SubscriptionProductDetail",
  "abstractKey": null
};

(node as any).hash = "544d339989ee734aa9a07cd6252b5648";

export default node;
