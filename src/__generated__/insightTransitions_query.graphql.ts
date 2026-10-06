/**
 * @generated SignedSource<<31f1e3fa184d81334e897465e328c1da>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
export type InsightStatus = "ACKNOWLEDGED" | "ARCHIVED" | "NEW" | "RESOLVED" | "SNOOZED" | "%future added value";
import type { FragmentRefs } from "relay-runtime";
export type insightTransitions_query$data = {
  readonly insightStatusTransitions: ReadonlyArray<{
    readonly from: InsightStatus;
    readonly to: ReadonlyArray<InsightStatus>;
  }>;
  readonly " $fragmentType": "insightTransitions_query";
};
export type insightTransitions_query$key = {
  readonly " $data"?: insightTransitions_query$data;
  readonly " $fragmentSpreads": FragmentRefs<"insightTransitions_query">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "insightTransitions_query"
};

(node as any).hash = "0a17bfb11b7821152c00e18df8812ebe";

export default node;
