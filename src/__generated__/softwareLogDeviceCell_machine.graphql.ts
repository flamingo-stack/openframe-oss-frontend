/**
 * @generated SignedSource<<efd6d47a67c88be0d74f4a3d6042ad36>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderFragment } from 'relay-runtime';
export type DeviceStatus = "ACTIVE" | "ARCHIVED" | "DECOMMISSIONED" | "DELETED" | "INACTIVE" | "MAINTENANCE" | "OFFLINE" | "ONLINE" | "PENDING" | "PENDING_DELETION" | "%future added value";
export type DeviceType = "CONTAINER_HOST" | "DESKTOP" | "IOT_DEVICE" | "LAPTOP" | "MOBILE_DEVICE" | "NETWORK_DEVICE" | "OTHER" | "SERVER" | "TABLET" | "VIRTUAL_MACHINE" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type softwareLogDeviceCell_machine$data = {
  readonly displayName: string | null | undefined;
  readonly hostname: string | null | undefined;
  readonly lastSeen: Instant | null | undefined;
  readonly nickname: string | null | undefined;
  readonly status: DeviceStatus | null | undefined;
  readonly type: DeviceType | null | undefined;
  readonly " $fragmentType": "softwareLogDeviceCell_machine";
};
export type softwareLogDeviceCell_machine$key = {
  readonly " $data"?: softwareLogDeviceCell_machine$data;
  readonly " $fragmentSpreads": FragmentRefs<"softwareLogDeviceCell_machine">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "softwareLogDeviceCell_machine",
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
      "kind": "ScalarField",
      "name": "lastSeen",
      "storageKey": null
    }
  ],
  "type": "Machine",
  "abstractKey": null
};

(node as any).hash = "c7be11bfaace547633f38f880d6f0f74";

export default node;
