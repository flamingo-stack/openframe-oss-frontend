/*
 * The repo's mechanical conventions, as rule options `eslint.config.mjs` puts on app source. Each one is the lint half
 * of a hub review rule (named beside it): what a tool can check lives here, the reviewer judges the rest.
 */

/** The three places a spinner could come from; a page draws its own loading form instead (OFFE-013). */
export const NO_SPINNERS = [
  '@flamingo-stack/openframe-frontend-core',
  '@flamingo-stack/openframe-frontend-core/components/ui',
  '@/lib/openframe-core-ui',
].map(name => ({
  name,
  importNames: ['PageLoader', 'CompactPageLoader'],
  message:
    'No spinners: the page or component draws its own loading form in its own geometry, from its real controls ' +
    'disabled where it can (hub rule OFFE-013).',
}));

const PALETTE =
  String.raw`/(#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|(^|[\s:])(bg|text|border|ring|fill|stroke|from|to|via|outline|divide|shadow)-` +
  String.raw`(white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d{2,3})?\b)/`;

/** An internal page path: starts with one `/`, not `//` (protocol-relative) and not an `/api/` endpoint. */
const PAGE_PATH = String.raw`/^\/(?!api\/|\/)/`;
const NAVIGATES = String.raw`/^(push|replace|prefetch)$/`;

/**
 * `no-restricted-syntax` entries by convention. They are one rule, and a later block setting the rule replaces the
 * options of an earlier one, so a file that keeps one convention for a reason gets `restrictedSyntaxExcept(...)`.
 */
const SYNTAX = {
  /** `NEXT_PUBLIC_*` through `runtimeEnv`: a direct read is inlined at build time (OPENFRAM-007-2). */
  publicEnv: [
    {
      selector:
        "MemberExpression[object.type='MemberExpression'][object.object.name='process'][object.property.name='env'][property.name=/^NEXT_PUBLIC_/]",
      message:
        'Read NEXT_PUBLIC_* through runtimeEnv in src/lib/runtime-config.ts; a direct read is frozen at build time.',
    },
  ],
  /** ODS colour tokens in class strings (OFFE-004). */
  colours: [
    `JSXAttribute[name.name=/[cC]lassName$/] > Literal[value=${PALETTE}]`,
    `JSXAttribute[name.name=/[cC]lassName$/] > JSXExpressionContainer > Literal[value=${PALETTE}]`,
    `JSXAttribute[name.name=/[cC]lassName$/] > JSXExpressionContainer > TemplateLiteral > TemplateElement[value.raw=${PALETTE}]`,
    `CallExpression[callee.name=/^(cn|clsx|cva)$/] Literal[value=${PALETTE}]`,
    `CallExpression[callee.name=/^(cn|clsx|cva)$/] TemplateElement[value.raw=${PALETTE}]`,
  ].map(selector => ({
    selector,
    message: 'Use an ODS colour token (bg-ods-*, text-ods-*, border-ods-*), not a palette class, hex or rgb().',
  })),
  /** Internal URLs come from `routes` in src/lib/routes.ts (OPENFRAM-001-2). */
  routes: [
    `CallExpression[callee.property.name=${NAVIGATES}] > Literal.arguments:first-child[value=${PAGE_PATH}]`,
    `CallExpression[callee.property.name=${NAVIGATES}] > TemplateLiteral.arguments:first-child > TemplateElement:first-child[value.raw=${PAGE_PATH}]`,
    `CallExpression[callee.name=/^(redirect|permanentRedirect|useSafeBack)$/] > Literal[value=${PAGE_PATH}]`,
    `JSXAttribute[name.name='href'] > Literal[value=${PAGE_PATH}]`,
    `JSXAttribute[name.name='href'] > JSXExpressionContainer > TemplateLiteral > TemplateElement:first-child[value.raw=${PAGE_PATH}]`,
  ].map(selector => ({
    selector,
    message: 'Build internal URLs with routes.* from src/lib/routes.ts, never a raw path string (see ROUTES.md).',
  })),
  /** New GraphQL against /api/graphql is Relay; /chat/graphql stays raw-POST by design (OPENFRAM-002-2). */
  rawGraphql: [
    {
      selector: "CallExpression[callee.property.name='post'] > Literal.arguments:first-child[value='/api/graphql']",
      message: 'Query /api/graphql through react-relay (useLazyLoadQuery, useFragment, useMutation), not a raw POST.',
    },
  ],
};

/** Every convention's entries, minus the ones a file keeps for a stated reason. */
export function restrictedSyntaxExcept(...kept) {
  return Object.entries(SYNTAX).flatMap(([key, entries]) => (kept.includes(key) ? [] : entries));
}

/**
 * eslint-plugin-jsx-a11y 6.10's `recommended` set (A11Y-001), at `warn`: none of it is autofixable. Listed by name,
 * because the plugin is registered by `eslint-config-next` and is not a dependency of this app to import.
 * `no-autofocus` ignores components: autofocusing a dialog's first field through the lib's `Input` is focus
 * management, which is what the rule asks for.
 */
const A11Y_OPTIONS = {
  'interactive-supports-focus': [
    { tabbable: ['button', 'checkbox', 'link', 'searchbox', 'spinbutton', 'switch', 'textbox'] },
  ],
  'no-autofocus': [{ ignoreNonDOM: true }],
  'no-interactive-element-to-noninteractive-role': [{ tr: ['none', 'presentation'], canvas: ['img'] }],
  'no-noninteractive-element-interactions': [
    {
      handlers: ['onClick', 'onError', 'onLoad', 'onMouseDown', 'onMouseUp', 'onKeyPress', 'onKeyDown', 'onKeyUp'],
      alert: ['onKeyUp', 'onKeyDown', 'onKeyPress'],
      body: ['onError', 'onLoad'],
      dialog: ['onKeyUp', 'onKeyDown', 'onKeyPress'],
      iframe: ['onError', 'onLoad'],
      img: ['onError', 'onLoad'],
    },
  ],
  'no-noninteractive-element-to-interactive-role': [
    {
      ul: ['listbox', 'menu', 'menubar', 'radiogroup', 'tablist', 'tree', 'treegrid'],
      ol: ['listbox', 'menu', 'menubar', 'radiogroup', 'tablist', 'tree', 'treegrid'],
      li: ['menuitem', 'menuitemradio', 'menuitemcheckbox', 'option', 'row', 'tab', 'treeitem'],
      table: ['grid'],
      td: ['gridcell'],
      fieldset: ['radiogroup', 'presentation'],
    },
  ],
  'no-noninteractive-tabindex': [{ tags: [], roles: ['tabpanel'], allowExpressionValues: true }],
  'no-static-element-interactions': [
    {
      allowExpressionValues: true,
      handlers: ['onClick', 'onMouseDown', 'onMouseUp', 'onKeyPress', 'onKeyDown', 'onKeyUp'],
    },
  ],
};
export const A11Y_RECOMMENDED = Object.fromEntries(
  [
    'alt-text',
    'anchor-has-content',
    'anchor-is-valid',
    'aria-activedescendant-has-tabindex',
    'aria-props',
    'aria-proptypes',
    'aria-role',
    'aria-unsupported-elements',
    'autocomplete-valid',
    'click-events-have-key-events',
    'heading-has-content',
    'html-has-lang',
    'iframe-has-title',
    'img-redundant-alt',
    'interactive-supports-focus',
    'label-has-associated-control',
    'media-has-caption',
    'mouse-events-have-key-events',
    'no-access-key',
    'no-autofocus',
    'no-distracting-elements',
    'no-interactive-element-to-noninteractive-role',
    'no-noninteractive-element-interactions',
    'no-noninteractive-element-to-interactive-role',
    'no-noninteractive-tabindex',
    'no-redundant-roles',
    'no-static-element-interactions',
    'role-has-required-aria-props',
    'role-supports-aria-props',
    'scope',
    'tabindex-no-positive',
  ].map(rule => [`jsx-a11y/${rule}`, ['warn', ...(A11Y_OPTIONS[rule] ?? [])]]),
);

/**
 * One `no-restricted-syntax` block per set of conventions a group of files keeps off, from `{ convention: files }`. A
 * file on two lists gets one block that keeps both off, since a second block would replace the first.
 */
export function restrictedSyntaxExceptions(filesByConvention) {
  const kept = new Map();
  for (const [convention, files] of Object.entries(filesByConvention)) {
    for (const file of files) kept.set(file, [...(kept.get(file) ?? []), convention].sort());
  }
  const groups = new Map();
  for (const [file, conventions] of kept) {
    const key = conventions.join('+');
    groups.set(key, [...(groups.get(key) ?? []), file]);
  }
  return [...groups].map(([key, files]) => ({
    name: `openframe-frontend/restricted-syntax-keeps-${key}`,
    files,
    rules: { 'no-restricted-syntax': ['warn', ...restrictedSyntaxExcept(...key.split('+'))] },
  }));
}
