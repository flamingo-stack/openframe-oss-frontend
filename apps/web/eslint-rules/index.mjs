import { formLabelScale } from './form-label-scale.mjs';
import { reactHookFormNeedsNoMemo } from './react-hook-form-needs-no-memo.mjs';

/** The plugin object `eslint.config.mjs` registers under the `openframe/` prefix. */
const openframePlugin = {
  rules: {
    'form-label-scale': formLabelScale,
    'react-hook-form-needs-no-memo': reactHookFormNeedsNoMemo,
  },
};

export default openframePlugin;
