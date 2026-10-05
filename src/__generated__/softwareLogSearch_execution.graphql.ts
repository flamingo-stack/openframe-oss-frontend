/**
 * @generated SignedSource<<4d3c8bc46e75a797bbf9c2c8b1cf8aae>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
export type ScriptExecutionStatus = "FAILED" | "QUEUED" | "RUNNING" | "SUCCESS" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type softwareLogSearch_execution$data = {
  readonly error: string | null | undefined;
  readonly machine: {
    readonly displayName: string | null | undefined;
    readonly hostname: string | null | undefined;
    readonly nickname: string | null | undefined;
    readonly organization: {
      readonly contactInformation: {
        readonly contacts: ReadonlyArray<{
          readonly email: string | null | undefined;
        }>;
      } | null | undefined;
      readonly name: string;
    } | null | undefined;
  } | null | undefined;
  readonly status: ScriptExecutionStatus;
  readonly stderr: string | null | undefined;
  readonly stdout: string | null | undefined;
  readonly " $fragmentType": "softwareLogSearch_execution";
};
export type softwareLogSearch_execution$key = {
  readonly " $data"?: softwareLogSearch_execution$data;
  readonly " $fragmentSpreads": FragmentRefs<"softwareLogSearch_execution">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "softwareLogSearch_execution"
};

(node as any).hash = "210e341c32e23fd9be3b0cc7cea23a2d";

export default node;
