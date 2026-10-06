/**
 * @generated SignedSource<<d5f8eda3c24e2f973a782a83173ac304>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type insightUserFields_user$data = {
  readonly email: string | null | undefined;
  readonly firstName: string | null | undefined;
  readonly id: string;
  readonly image: {
    readonly hash: string | null | undefined;
    readonly imageUrl: string | null | undefined;
  } | null | undefined;
  readonly lastName: string | null | undefined;
  readonly status: string | null | undefined;
  readonly " $fragmentType": "insightUserFields_user";
};
export type insightUserFields_user$key = {
  readonly " $data"?: insightUserFields_user$data;
  readonly " $fragmentSpreads": FragmentRefs<"insightUserFields_user">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "insightUserFields_user"
};

(node as any).hash = "ea10356e414f4f32dbc7fc8b0082f140";

export default node;
