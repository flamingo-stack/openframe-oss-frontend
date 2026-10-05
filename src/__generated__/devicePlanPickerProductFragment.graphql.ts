/**
 * @generated SignedSource<<c7be8a538d943c7e1d8375b87c742998>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type BillingPeriod = "MONTHLY" | "YEARLY" | "%future added value";
export type OpenframeProduct = "AI_ASSISTANCE" | "MANAGED_DEVICES" | "%future added value";
import type { Long } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type devicePlanPickerProductFragment$data = {
  readonly id: string;
  readonly name: OpenframeProduct;
  readonly packageOptions: ReadonlyArray<{
    readonly billingPeriod: BillingPeriod | null | undefined;
    readonly id: string;
    readonly priceTiers: ReadonlyArray<{
      readonly from: number;
      readonly unitPrice: number;
      readonly upTo: number | null | undefined;
    }> | null | undefined;
  }>;
  readonly payAsYouGoOption: {
    readonly id: string;
    readonly price: number | null | undefined;
    readonly priceTiers: ReadonlyArray<{
      readonly from: number;
      readonly unitPrice: number;
      readonly upTo: number | null | undefined;
    }> | null | undefined;
  } | null | undefined;
  readonly unitSize: Long | null | undefined;
  readonly " $fragmentType": "devicePlanPickerProductFragment";
};
export type devicePlanPickerProductFragment$key = {
  readonly " $data"?: devicePlanPickerProductFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"devicePlanPickerProductFragment">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "concreteType": "PriceTier",
  "kind": "LinkedField",
  "name": "priceTiers",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "from",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "upTo",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "unitPrice",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "devicePlanPickerProductFragment",
  "selections": [
    (v0/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "unitSize",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "ProductOption",
      "kind": "LinkedField",
      "name": "packageOptions",
      "plural": true,
      "selections": [
        (v0/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "billingPeriod",
          "storageKey": null
        },
        (v1/*: any*/)
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "ProductOption",
      "kind": "LinkedField",
      "name": "payAsYouGoOption",
      "plural": false,
      "selections": [
        (v0/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "price",
          "storageKey": null
        },
        (v1/*: any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "Product",
  "abstractKey": null
};
})();

(node as any).hash = "d0de8260ed26b93feac4e779880a448d";

export default node;
