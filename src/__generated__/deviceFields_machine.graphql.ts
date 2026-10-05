/**
 * @generated SignedSource<<245421aa30281d53da2f74ae54a5b30e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
export type ConnectionStatus = "CONNECTED" | "DISCONNECTED" | "ERROR" | "%future added value";
export type ToolType = "FLEET_MDM" | "MESHCENTRAL" | "OPENFRAME_RMM" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type deviceFields_machine$data = {
  readonly agentVersion: string | null | undefined;
  readonly ip: string | null | undefined;
  readonly macAddress: string | null | undefined;
  readonly osBuild: string | null | undefined;
  readonly osUuid: string | null | undefined;
  readonly osVersion: string | null | undefined;
  readonly registeredAt: Instant | null | undefined;
  readonly timezone: string | null | undefined;
  readonly toolConnections: ReadonlyArray<{
    readonly agentToolId: string;
    readonly connectedAt: Instant | null | undefined;
    readonly disconnectedAt: Instant | null | undefined;
    readonly id: string;
    readonly machineId: string;
    readonly metadata: string | null | undefined;
    readonly status: ConnectionStatus;
    readonly toolType: ToolType;
  } | null | undefined> | null | undefined;
  readonly updatedAt: Instant | null | undefined;
  readonly " $fragmentSpreads": FragmentRefs<"deviceSelectorFields_machine">;
  readonly " $fragmentType": "deviceFields_machine";
};
export type deviceFields_machine$key = {
  readonly " $data"?: deviceFields_machine$data;
  readonly " $fragmentSpreads": FragmentRefs<"deviceFields_machine">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "deviceFields_machine"
};

(node as any).hash = "1cfd8ea2f2294aa9990b0e9e2681d7fd";

export default node;
