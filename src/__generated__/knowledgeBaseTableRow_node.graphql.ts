/**
 * @generated SignedSource<<682f50202eaa2a094a2ba2878fa956c4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
export type KnowledgeBaseArticleStatus = "ARCHIVED" | "DRAFT" | "PUBLISHED" | "%future added value";
export type KnowledgeBaseItemType = "ARTICLE" | "FOLDER" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { FragmentRefs } from "relay-runtime";
export type knowledgeBaseTableRow_node$data = {
  readonly createdAt: Instant | null | undefined;
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null | undefined;
  readonly status: KnowledgeBaseArticleStatus | null | undefined;
  readonly summary: string | null | undefined;
  readonly tags: ReadonlyArray<{
    readonly color: string | null | undefined;
    readonly id: string;
    readonly key: string;
  }>;
  readonly type: KnowledgeBaseItemType;
  readonly updatedAt: Instant | null | undefined;
  readonly " $fragmentType": "knowledgeBaseTableRow_node";
};
export type knowledgeBaseTableRow_node$key = {
  readonly " $data"?: knowledgeBaseTableRow_node$data;
  readonly " $fragmentSpreads": FragmentRefs<"knowledgeBaseTableRow_node">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "knowledgeBaseTableRow_node"
};

(node as any).hash = "645e4128d8385e828508fa681a42fc91";

export default node;
