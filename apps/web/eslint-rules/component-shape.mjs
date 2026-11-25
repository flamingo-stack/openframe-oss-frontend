/**
 * `openframe/component-shape` — a component takes at most `maxProps` destructured props, and a component or hook runs
 * at most `maxEffects` effects of its own.
 *
 * Why: a component with dozens of props and a stack of effects is several components and several concerns glued
 * together (EmbeddableChat: 63 props, 24 effects). Past the limit, split the view (composition, slots) or move each
 * concern into its own named hook (hub rules SIZE-001 and SRP-001).
 *
 * What counts: a function named in PascalCase (a component, also when wrapped in `forwardRef` / `memo`) or `useXxx`
 * (a hook). Props are the properties of a destructured first parameter, a rest element not counted. Effects are calls
 * to `useEffect`, `useLayoutEffect` and `useInsertionEffect` (bare or as `React.useEffect`) in the function's own body,
 * not in a function nested inside it, which is counted on its own.
 */
const EFFECTS = new Set(['useEffect', 'useLayoutEffect', 'useInsertionEffect']);
const COMPONENT = /^[A-Z][A-Za-z0-9]*$/;
const HOOK = /^use[A-Z0-9]/;

/** The name a function is known by: its own id, or the variable it (or the `forwardRef`/`memo` call around it) is bound to. */
function nameOf(node) {
  if (node.id?.name) return node.id.name;
  let parent = node.parent;
  while (parent?.type === 'CallExpression') parent = parent.parent;
  if (parent?.type === 'VariableDeclarator' && parent.id.type === 'Identifier') return parent.id.name;
  return null;
}

function calleeName(call) {
  const { callee } = call;
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier')
    return callee.property.name;
  return null;
}

export const componentShape = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Limit the props of a component and the effects of a component or hook.' },
    schema: [
      {
        type: 'object',
        properties: { maxProps: { type: 'integer', minimum: 1 }, maxEffects: { type: 'integer', minimum: 0 } },
        additionalProperties: false,
      },
    ],
    messages: {
      props:
        '{{name}} takes {{count}} props (max {{max}}). Compose it (children, slots) or group related props into one ' +
        'typed object.',
      effects:
        '{{name}} runs {{count}} effects (max {{max}}). Give each concern its own named hook, or derive the value in ' +
        'render instead of syncing it in an effect.',
    },
  },
  create(context) {
    const { maxProps = 10, maxEffects = 3 } = context.options[0] ?? {};
    const stack = [];

    const enter = node => {
      const name = nameOf(node);
      stack.push({ node, name, effects: 0, tracked: !!name && (COMPONENT.test(name) || HOOK.test(name)) });
      if (!name || !COMPONENT.test(name)) return;
      const [first] = node.params;
      if (first?.type !== 'ObjectPattern') return;
      const count = first.properties.filter(p => p.type === 'Property').length;
      if (count > maxProps) context.report({ node: first, messageId: 'props', data: { name, count, max: maxProps } });
    };

    const exit = () => {
      const frame = stack.pop();
      if (frame.tracked && frame.effects > maxEffects) {
        context.report({
          node: frame.node,
          messageId: 'effects',
          data: { name: frame.name, count: frame.effects, max: maxEffects },
        });
      }
    };

    return {
      FunctionDeclaration: enter,
      FunctionExpression: enter,
      ArrowFunctionExpression: enter,
      'FunctionDeclaration:exit': exit,
      'FunctionExpression:exit': exit,
      'ArrowFunctionExpression:exit': exit,
      CallExpression(node) {
        const frame = stack.at(-1);
        if (frame && EFFECTS.has(calleeName(node))) frame.effects += 1;
      },
    };
  },
};
