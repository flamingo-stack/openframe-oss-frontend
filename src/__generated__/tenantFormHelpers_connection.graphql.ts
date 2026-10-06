/**
 * @generated SignedSource<<f75447fd7e7d8da5015a44e8f8d5b167>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
export type DirectoryProvider = "GOOGLE_WORKSPACE" | "MICROSOFT_365" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type tenantFormHelpers_connection$data = {
  readonly connectedAt: Instant | null | undefined;
  readonly consentUrl: string | null | undefined;
  readonly domain: string | null | undefined;
  readonly id: string;
  readonly name: string;
  readonly organization: {
    readonly " $fragmentSpreads": FragmentRefs<"customerOption_organization">;
  };
  readonly organizationId: string;
  readonly provider: DirectoryProvider;
  readonly " $fragmentType": "tenantFormHelpers_connection";
};
export type tenantFormHelpers_connection$key = {
  readonly " $data"?: tenantFormHelpers_connection$data;
  readonly " $fragmentSpreads": FragmentRefs<"tenantFormHelpers_connection">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "tenantFormHelpers_connection"
};

(node as any).hash = "64deab054912167eafef0429b0b2564b";

export default node;
