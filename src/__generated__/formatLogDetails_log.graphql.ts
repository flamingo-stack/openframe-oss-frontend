/**
 * @generated SignedSource<<a34082d39b49171331ac95f52e715f61>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
import type { Instant } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type formatLogDetails_log$data = {
  readonly details: string | null | undefined;
  readonly eventType: string;
  readonly message: string | null | undefined;
  readonly severity: string;
  readonly timestamp: Instant;
  readonly toolEventId: string;
  readonly toolType: string;
  readonly " $fragmentType": "formatLogDetails_log";
};
export type formatLogDetails_log$key = {
  readonly " $data"?: formatLogDetails_log$data;
  readonly " $fragmentSpreads": FragmentRefs<"formatLogDetails_log">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "formatLogDetails_log"
};

(node as any).hash = "d44b614f06c9627021fee5b6e48faf0b";

export default node;
