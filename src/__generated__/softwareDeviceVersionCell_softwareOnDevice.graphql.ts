/**
 * @generated SignedSource<<1ef77cff2dce3a048062b5c047cda590>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type SoftwareOnDeviceStatus = "OUTDATED" | "SCHEDULED_UNINSTALL" | "SCHEDULED_UPDATE" | "UNINSTALLING" | "UP_TO_DATE" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type softwareDeviceVersionCell_softwareOnDevice$data = {
  readonly softwareVersion: string | null | undefined;
  readonly status: SoftwareOnDeviceStatus | null | undefined;
  readonly " $fragmentType": "softwareDeviceVersionCell_softwareOnDevice";
};
export type softwareDeviceVersionCell_softwareOnDevice$key = {
  readonly " $data"?: softwareDeviceVersionCell_softwareOnDevice$data;
  readonly " $fragmentSpreads": FragmentRefs<"softwareDeviceVersionCell_softwareOnDevice">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "softwareDeviceVersionCell_softwareOnDevice",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "softwareVersion",
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
  "type": "SoftwareOnDevice",
  "abstractKey": null
};

(node as any).hash = "5d18a7c2823f6f00c1860671a3869530";

export default node;
