/**
 * @generated SignedSource<<504333ed13b34c23fae19be21906b272>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import type { ConcreteRequest } from 'relay-runtime';
export type BrewPackageType = "CASK" | "FORMULA" | "%future added value";
export type PackageManagerType = "BREW" | "CHOCO" | "WINGET" | "%future added value";
export type ScheduleOfflineBehavior = "RETRY_ON_RECONNECT" | "SKIP" | "%future added value";
export type ScheduleTimeReference = "DEVICE_LOCAL" | "SERVER" | "%future added value";
export type SoftwareAction = "INSTALL" | "UPDATE" | "%future added value";
import type { Instant } from "../lib/graphql-scalars";
import type { Long } from "../lib/graphql-scalars";
export type SubmitSoftwareBundleInput = {
  action: SoftwareAction;
  id: string;
  packages: ReadonlyArray<SoftwarePackageInput>;
  schedule?: SoftwareBundleScheduleInput | null | undefined;
};
export type SoftwarePackageInput = {
  brewPackageType?: BrewPackageType | null | undefined;
  packageManager: PackageManagerType;
  packageName: string;
  version?: string | null | undefined;
};
export type SoftwareBundleScheduleInput = {
  description?: string | null | undefined;
  name?: string | null | undefined;
  offlineBehavior?: ScheduleOfflineBehavior | null | undefined;
  reconnectWindowSeconds?: Long | null | undefined;
  repeat?: Long | null | undefined;
  startAt: Instant;
  timeReference?: ScheduleTimeReference | null | undefined;
};
export type useSoftwareActionSubmitMutation$variables = {
  input: SubmitSoftwareBundleInput;
};
export type useSoftwareActionSubmitMutation$data = {
  readonly submitSoftwareBundle: {
    readonly executionIds: ReadonlyArray<string> | null | undefined;
    readonly id: string;
  };
};
export type useSoftwareActionSubmitMutation = {
  response: useSoftwareActionSubmitMutation$data;
  variables: useSoftwareActionSubmitMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "SoftwareBundle",
    "kind": "LinkedField",
    "name": "submitSoftwareBundle",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "executionIds",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useSoftwareActionSubmitMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useSoftwareActionSubmitMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "65cb417f770e8df42e561daf1db5450d",
    "id": null,
    "metadata": {},
    "name": "useSoftwareActionSubmitMutation",
    "operationKind": "mutation",
    "text": "mutation useSoftwareActionSubmitMutation(\n  $input: SubmitSoftwareBundleInput!\n) {\n  submitSoftwareBundle(input: $input) {\n    id\n    executionIds\n  }\n}\n"
  }
};
})();

(node as any).hash = "fa8d829f2b385d18891dd7c9305c24ea";

export default node;
