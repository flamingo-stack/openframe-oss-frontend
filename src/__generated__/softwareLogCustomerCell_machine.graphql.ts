/**
 * @generated SignedSource<<d9c7ae3ae014983b6f197af53ae3e9a0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type softwareLogCustomerCell_machine$data = {
  readonly organization: {
    readonly contactInformation: {
      readonly contacts: ReadonlyArray<{
        readonly email: string | null | undefined;
      }>;
    } | null | undefined;
    readonly image: {
      readonly hash: string | null | undefined;
      readonly imageUrl: string;
    } | null | undefined;
    readonly name: string;
  } | null | undefined;
  readonly " $fragmentType": "softwareLogCustomerCell_machine";
};
export type softwareLogCustomerCell_machine$key = {
  readonly " $data"?: softwareLogCustomerCell_machine$data;
  readonly " $fragmentSpreads": FragmentRefs<"softwareLogCustomerCell_machine">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "softwareLogCustomerCell_machine",
  "selections": [
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
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "ContactInformation",
          "kind": "LinkedField",
          "name": "contactInformation",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "ContactPerson",
              "kind": "LinkedField",
              "name": "contacts",
              "plural": true,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "email",
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Machine",
  "abstractKey": null
};

(node as any).hash = "fad854aa5bf2b64f4c586b6389dec07f";

export default node;
