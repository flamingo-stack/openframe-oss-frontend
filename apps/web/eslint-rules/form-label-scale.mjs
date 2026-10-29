/**
 * Every field label in the dashboard is on one scale: the lib's `large` (`text-h4`), as the script forms are.
 *
 * The lib's default field label is `text-h6`, kept small on purpose for the other Flamingo apps, and each control
 * opts into the large scale per call site (`labelVariant="large"`, `<Label variant="large">`). Without a check every new
 * form starts on the small default, which is how the policy and ticket forms ended up a size below the script forms
 * next to them. The fix is mechanical, so the rule fixes it.
 *
 * - A lib field control with a `label` (or `ScriptArguments` with a `titleLabel`) needs `labelVariant="large"`.
 * - A lib `<Label>` needs `variant="large"` unless it is a click surface (`variant="surface"`) or its `className`
 *   already states `text-h4`. A `className` stating another `text-h*` would win over the variant, so it is reported
 *   and left for a person.
 */

const LIB_SOURCE = /^@flamingo-stack\/openframe-frontend-core(\/|$)/;

/** The lib controls that draw their label through `FieldWrapper`, by the prop that carries the label text. */
const LIB_FIELD_CONTROLS = new Map([
  ['Autocomplete', 'label'],
  ['FieldWrapper', 'label'],
  ['Input', 'label'],
  ['ScriptArguments', 'titleLabel'],
  ['SearchableSelect', 'label'],
  ['SelectTrigger', 'label'],
  ['Textarea', 'label'],
]);

const LARGE = 'large';
const OTHER_TEXT_SCALE = /(^|\s)text-h(?!4\b)\d\b/;

function attribute(node, name) {
  return node.attributes.find(a => a.type === 'JSXAttribute' && a.name.name === name);
}

/** A string literal attribute's value (`a="x"` or `a={'x'}`), or `undefined` for anything computed. */
function literal(attr) {
  if (!attr || !attr.value) return undefined;
  if (attr.value.type === 'Literal') return attr.value.value;
  const expression = attr.value.type === 'JSXExpressionContainer' ? attr.value.expression : null;
  if (expression?.type === 'Literal') return expression.value;
  if (expression?.type === 'TemplateLiteral' && expression.expressions.length === 0)
    return expression.quasis[0].value.cooked;
  return undefined;
}

/** @type {import('eslint').Rule.RuleModule} */
export const formLabelScale = {
  meta: {
    type: 'suggestion',
    docs: { description: 'put every dashboard field label on the large (text-h4) scale' },
    fixable: 'code',
    schema: [],
    messages: {
      controlNeedsLarge:
        '`{{name}}` draws its label on the lib default (text-h6); the dashboard labels fields on the large scale. Add labelVariant="large".',
      labelNeedsLarge:
        'This `Label` is on the lib default (text-h6); the dashboard labels fields on the large scale. Use variant="large".',
      classNameOverridesScale:
        "This `className` sets a text scale other than text-h4, which wins over the label's variant. Drop it so the label stays on the large scale.",
    },
  },

  create(context) {
    /** Local binding → the prop that carries its label text. */
    const fieldControls = new Map();
    /** Local bindings of the lib's `Label`. */
    const labels = new Set();

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportSpecifier') continue;
          const imported = specifier.imported.name;
          if (!LIB_SOURCE.test(source)) continue;
          if (imported === 'Label') labels.add(specifier.local.name);
          const prop = LIB_FIELD_CONTROLS.get(imported);
          if (prop) fieldControls.set(specifier.local.name, prop);
        }
      },

      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier') return;
        const name = node.name.name;

        const labelProp = fieldControls.get(name);
        if (labelProp) {
          const labelAttr = attribute(node, labelProp);
          if (!labelAttr) return;
          const variant = attribute(node, 'labelVariant');
          if (variant) {
            if (literal(variant) !== LARGE)
              context.report({ node: variant, messageId: 'controlNeedsLarge', data: { name } });
            return;
          }
          context.report({
            node: labelAttr,
            messageId: 'controlNeedsLarge',
            data: { name },
            fix: fixer => fixer.insertTextAfter(labelAttr, ` labelVariant="${LARGE}"`),
          });
          return;
        }

        if (!labels.has(name)) return;
        const variant = attribute(node, 'variant');
        const variantValue = literal(variant);
        if (variantValue === 'surface') return;

        const className = literal(attribute(node, 'className'));
        if (typeof className === 'string' && OTHER_TEXT_SCALE.test(className)) {
          context.report({ node: attribute(node, 'className'), messageId: 'classNameOverridesScale' });
          return;
        }
        if (variantValue === LARGE) return;
        if (typeof className === 'string' && /(^|\s)text-h4\b/.test(className)) return;

        context.report({
          node,
          messageId: 'labelNeedsLarge',
          fix: variant
            ? variant.value && variantValue !== undefined
              ? fixer => fixer.replaceText(variant.value, `"${LARGE}"`)
              : null
            : fixer => fixer.insertTextAfter(node.name, ` variant="${LARGE}"`),
        });
      },
    };
  },
};
