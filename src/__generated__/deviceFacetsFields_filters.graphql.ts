/**
 * @generated SignedSource<<d338b2604e0b17fda6287077aa2fb2b0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type deviceFacetsFields_filters$data = {
  readonly deviceTypes: ReadonlyArray<{
    readonly count: number;
    readonly label: string;
    readonly value: string;
  }>;
  readonly filteredCount: number;
  readonly organizationIds: ReadonlyArray<{
    readonly count: number;
    readonly label: string;
    readonly value: string;
  }>;
  readonly osTypes: ReadonlyArray<{
    readonly count: number;
    readonly label: string;
    readonly value: string;
  }>;
  readonly statuses: ReadonlyArray<{
    readonly count: number;
    readonly label: string;
    readonly value: string;
  }>;
  readonly tagKeys: ReadonlyArray<{
    readonly count: number;
    readonly key: string;
    readonly value: string;
  }>;
  readonly " $fragmentType": "deviceFacetsFields_filters";
};
export type deviceFacetsFields_filters$key = {
  readonly " $data"?: deviceFacetsFields_filters$data;
  readonly " $fragmentSpreads": FragmentRefs<"deviceFacetsFields_filters">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "deviceFacetsFields_filters"
};

(node as any).hash = "c91f3ceff4b49a201d491d96ff3dc3bf";

export default node;
