/**
 * @generated SignedSource<<f1adf2b84369a1e217a683c59dfc9b79>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type DeviceStatus = "ACTIVE" | "ARCHIVED" | "DECOMMISSIONED" | "DELETED" | "INACTIVE" | "MAINTENANCE" | "OFFLINE" | "ONLINE" | "PENDING" | "PENDING_DELETION" | "%future added value";
export type DeviceType = "CONTAINER_HOST" | "DESKTOP" | "IOT_DEVICE" | "LAPTOP" | "MOBILE_DEVICE" | "NETWORK_DEVICE" | "OTHER" | "SERVER" | "TABLET" | "VIRTUAL_MACHINE" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type softwareDeviceCell_machine$data = {
  readonly displayName: string | null | undefined;
  readonly hostname: string | null | undefined;
  readonly nickname: string | null | undefined;
  readonly organization: {
    readonly name: string;
  } | null | undefined;
  readonly status: DeviceStatus | null | undefined;
  readonly type: DeviceType | null | undefined;
  readonly " $fragmentType": "softwareDeviceCell_machine";
};
export type softwareDeviceCell_machine$key = {
  readonly " $data"?: softwareDeviceCell_machine$data;
  readonly " $fragmentSpreads": FragmentRefs<"softwareDeviceCell_machine">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "softwareDeviceCell_machine",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "nickname",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "displayName",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hostname",
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
      "name": "type",
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
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Machine",
  "abstractKey": null
};

(node as any).hash = "986a203c68c9b8f6785fadf3e3a9370d";

export default node;
