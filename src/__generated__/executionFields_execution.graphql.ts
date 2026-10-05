/**
 * @generated SignedSource<<1e922bdd40379b414b09120ba0c431d9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
export type ExecutionSource = "AI_ASSISTANT" | "MANUAL" | "SCHEDULED" | "%future added value";
export type ScriptExecutionStatus = "FAILED" | "QUEUED" | "RUNNING" | "SUCCESS" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type executionFields_execution$data = {
  readonly dispatchedAt: Instant;
  readonly error: string | null | undefined;
  readonly executionId: string;
  readonly id: string;
  readonly initiator: {
    readonly email: string | null | undefined;
    readonly firstName: string | null | undefined;
    readonly id: string;
    readonly image: {
      readonly hash: string | null | undefined;
      readonly imageUrl: string | null | undefined;
    } | null | undefined;
    readonly lastName: string | null | undefined;
    readonly status: string | null | undefined;
  } | null | undefined;
  readonly machine: {
    readonly displayName: string | null | undefined;
    readonly hostname: string | null | undefined;
    readonly id: string;
    readonly machineId: string;
    readonly nickname: string | null | undefined;
    readonly organization: {
      readonly id: string;
      readonly name: string;
    } | null | undefined;
  } | null | undefined;
  readonly source: ExecutionSource;
  readonly status: ScriptExecutionStatus;
  readonly stderr: string | null | undefined;
  readonly stdout: string | null | undefined;
  readonly " $fragmentType": "executionFields_execution";
};
export type executionFields_execution$key = {
  readonly " $data"?: executionFields_execution$data;
  readonly " $fragmentSpreads": FragmentRefs<"executionFields_execution">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "executionFields_execution"
};

(node as any).hash = "7579f86b58a262fdc398eb83dffe620e";

export default node;
