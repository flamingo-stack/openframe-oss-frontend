/**
 * @generated SignedSource<<dbda969da22451a30d5e3bc53aee989d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
export type DeviceStatus = "ACTIVE" | "ARCHIVED" | "DECOMMISSIONED" | "DELETED" | "INACTIVE" | "MAINTENANCE" | "OFFLINE" | "ONLINE" | "PENDING" | "PENDING_DELETION" | "%future added value";
export type DeviceType = "CONTAINER_HOST" | "DESKTOP" | "IOT_DEVICE" | "LAPTOP" | "MOBILE_DEVICE" | "NETWORK_DEVICE" | "OTHER" | "SERVER" | "TABLET" | "VIRTUAL_MACHINE" | "%future added value";
export type OsType = "MAC_OS" | "WINDOWS" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type deviceRowFields_machine$data = {
  readonly displayName: string | null | undefined;
  readonly hostname: string | null | undefined;
  readonly id: string;
  readonly lastSeen: Instant | null | undefined;
  readonly machineId: string;
  readonly nickname: string | null | undefined;
  readonly organization: {
    readonly id: string;
    readonly image: {
      readonly hash: string | null | undefined;
      readonly imageUrl: string;
    } | null | undefined;
    readonly name: string;
    readonly organizationId: string;
  } | null | undefined;
  readonly osType: OsType;
  readonly status: DeviceStatus | null | undefined;
  readonly tags: ReadonlyArray<{
    readonly color: string | null | undefined;
    readonly createdAt: Instant | null | undefined;
    readonly description: string | null | undefined;
    readonly id: string;
    readonly key: string;
    readonly values: ReadonlyArray<string> | null | undefined;
  } | null | undefined> | null | undefined;
  readonly type: DeviceType | null | undefined;
  readonly " $fragmentType": "deviceRowFields_machine";
};
export type deviceRowFields_machine$key = {
  readonly " $data"?: deviceRowFields_machine$data;
  readonly " $fragmentSpreads": FragmentRefs<"deviceRowFields_machine">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "deviceRowFields_machine"
};

(node as any).hash = "c6d1f688dd7f599eab122f39f8bb59b7";

export default node;
