/**
 * @generated SignedSource<<f21fd2ab66dc10e22c057ea4e944930e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
import type { JsonValue } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type insightFields_insight$data = {
  readonly description: string | null | undefined;
  readonly interval: number | null | undefined;
  readonly organization: {
    readonly image: {
      readonly hash: string | null | undefined;
      readonly imageUrl: string;
    } | null | undefined;
  } | null | undefined;
  readonly queryResult: ReadonlyArray<JsonValue> | null | undefined;
  readonly " $fragmentSpreads": FragmentRefs<"insightRowFields_insight">;
  readonly " $fragmentType": "insightFields_insight";
};
export type insightFields_insight$key = {
  readonly " $data"?: insightFields_insight$data;
  readonly " $fragmentSpreads": FragmentRefs<"insightFields_insight">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "insightFields_insight"
};

(node as any).hash = "4b53f759a33ea4d4a0bc2939defb03cd";

export default node;
