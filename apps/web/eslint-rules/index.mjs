import { componentShape } from './component-shape.mjs';
import { formLabelScale } from './form-label-scale.mjs';
import { noGraphqlFolder } from './no-graphql-folder.mjs';
import { reactHookFormNeedsNoMemo } from './react-hook-form-needs-no-memo.mjs';

/** The plugin object `eslint.config.mjs` registers under the `openframe/` prefix. */
const openframePlugin = {
  rules: {
    'component-shape': componentShape,
    'form-label-scale': formLabelScale,
    'no-graphql-folder': noGraphqlFolder,
    'react-hook-form-needs-no-memo': reactHookFormNeedsNoMemo,
  },
};

export default openframePlugin;
