/**
 * @generated SignedSource<<081e35ac7dc9eda9d851e2179b37685e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ReaderInlineDataFragment } from 'relay-runtime';
import type { FragmentRefs } from "relay-runtime";
export type deviceSelectorFields_machine$data = {
  readonly manufacturer: string | null | undefined;
  readonly model: string | null | undefined;
  readonly organization: {
    readonly contactInformation: {
      readonly contacts: ReadonlyArray<{
        readonly email: string | null | undefined;
      }>;
    } | null | undefined;
  } | null | undefined;
  readonly serialNumber: string | null | undefined;
  readonly " $fragmentSpreads": FragmentRefs<"deviceRowFields_machine">;
  readonly " $fragmentType": "deviceSelectorFields_machine";
};
export type deviceSelectorFields_machine$key = {
  readonly " $data"?: deviceSelectorFields_machine$data;
  readonly " $fragmentSpreads": FragmentRefs<"deviceSelectorFields_machine">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "deviceSelectorFields_machine"
};

(node as any).hash = "8368a174ea8f451b7cc7f80f97f8756c";

export default node;
