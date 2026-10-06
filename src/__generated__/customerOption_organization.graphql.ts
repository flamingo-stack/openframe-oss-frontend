/**
 * @generated SignedSource<<b6bc583bccbd589649096f5587573637>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type customerOption_organization$data = {
  readonly image: {
    readonly hash: string | null | undefined;
    readonly imageUrl: string;
  } | null | undefined;
  readonly name: string;
  readonly organizationId: string;
  readonly " $fragmentType": "customerOption_organization";
};
export type customerOption_organization$key = {
  readonly " $data"?: customerOption_organization$data;
  readonly " $fragmentSpreads": FragmentRefs<"customerOption_organization">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "customerOption_organization"
};

(node as any).hash = "ce3a1a73adbff7f165820e775f1f041c";

export default node;
