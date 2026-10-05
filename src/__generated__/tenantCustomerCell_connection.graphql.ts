/**
 * @generated SignedSource<<cbc3909d111ec2a8e45964544ee194da>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type tenantCustomerCell_connection$data = {
  readonly organization: {
    readonly image: {
      readonly hash: string | null | undefined;
      readonly imageUrl: string;
    } | null | undefined;
    readonly name: string;
  };
  readonly userCount: number | null | undefined;
  readonly " $fragmentType": "tenantCustomerCell_connection";
};
export type tenantCustomerCell_connection$key = {
  readonly " $data"?: tenantCustomerCell_connection$data;
  readonly " $fragmentSpreads": FragmentRefs<"tenantCustomerCell_connection">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "tenantCustomerCell_connection",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "userCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "Organization",
      "kind": "LinkedField",
      "name": "organization",
      "plural": false,
      "selections": [
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
          "concreteType": "OrganizationImage",
          "kind": "LinkedField",
          "name": "image",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "imageUrl",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "hash",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "DirectoryConnection",
  "abstractKey": null
};

(node as any).hash = "d33d921423a6ad2971fd6b4f8475ef33";

export default node;
