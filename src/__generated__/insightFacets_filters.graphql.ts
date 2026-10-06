/**
 * @generated SignedSource<<641dbc8b71541c84b9d6379eee272a49>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type insightFacets_filters$data = {
  readonly assigneeIds: ReadonlyArray<{
    readonly count: number;
    readonly label: string;
    readonly value: string;
  }>;
  readonly filteredCount: number | null | undefined;
  readonly organizationIds: ReadonlyArray<{
    readonly count: number;
    readonly label: string;
    readonly value: string;
  }>;
  readonly severities: ReadonlyArray<{
    readonly count: number;
    readonly label: string;
    readonly value: string;
  }>;
  readonly statuses: ReadonlyArray<{
    readonly count: number;
    readonly label: string;
    readonly value: string;
  }>;
  readonly types: ReadonlyArray<{
    readonly count: number;
    readonly label: string;
    readonly value: string;
  }>;
  readonly " $fragmentType": "insightFacets_filters";
};
export type insightFacets_filters$key = {
  readonly " $data"?: insightFacets_filters$data;
  readonly " $fragmentSpreads": FragmentRefs<"insightFacets_filters">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "insightFacets_filters"
};

(node as any).hash = "4f316f978f18037f74fac90c158f0580";

export default node;
