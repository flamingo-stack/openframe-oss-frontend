/**
 * @generated SignedSource<<d62da2d5385069424f9a526bd8bfdc8f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type executionFacets_filters$data = {
  readonly initiators: ReadonlyArray<{
    readonly count: number;
    readonly label: string;
    readonly value: string;
  }>;
  readonly machines: ReadonlyArray<{
    readonly count: number;
    readonly label: string;
    readonly value: string;
  }>;
  readonly statuses: ReadonlyArray<{
    readonly count: number;
    readonly label: string;
    readonly value: string;
  }>;
  readonly " $fragmentType": "executionFacets_filters";
};
export type executionFacets_filters$key = {
  readonly " $data"?: executionFacets_filters$data;
  readonly " $fragmentSpreads": FragmentRefs<"executionFacets_filters">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "executionFacets_filters"
};

(node as any).hash = "3fc9cac675c58cdad9fcb9a205e7965d";

export default node;
