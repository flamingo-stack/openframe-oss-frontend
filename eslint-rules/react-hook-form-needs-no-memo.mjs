/**
 * Requires a module-level `'use no memo'` in files that drive react-hook-form state.
 *
 * The library mutates `control` in place and proxies `formState`; memoization on top of
 * that does not re-read what it cannot see change, so `watch()` goes stale inside
 * `useFormContext()` children and `register()` + `reset()` leaves the input empty.
 * https://github.com/orgs/react-hook-form/discussions/12524
 *
 * Module-scoped, not per-function: form state spans a hook file and the fields it feeds.
 * Type-only imports count when they name a handle on the live form (see
 * {@link FORM_STATE_CARRIER_TYPES}) — `use-seed-form.ts` imports types only and calls
 * `form.reset()`.
 *
 * Delete this rule and its directives on react-hook-form 7.75 + React 19.2.5, where the
 * discussion reports these cases fixed.
 */

/** Types that hand a file the live form object, so a type-only import still counts. */
const FORM_STATE_CARRIER_TYPES = new Set([
  'Control',
  'ControllerRenderProps',
  'FormState',
  'UseControllerReturn',
  'UseFieldArrayReturn',
  'UseFormGetValues',
  'UseFormRegister',
  'UseFormReset',
  'UseFormReturn',
  'UseFormSetValue',
  'UseFormStateReturn',
  'UseFormWatch',
]);

/** @type {import('eslint').Rule.RuleModule} */
export const reactHookFormNeedsNoMemo = {
  meta: {
    type: 'problem',
    docs: {
      description: "require a module-level 'use no memo' directive in files that use react-hook-form at runtime",
    },
    fixable: 'code',
    schema: [],
    messages: {
      missingDirective:
        "This file drives react-hook-form state, so it must opt out of the React Compiler with a module-level 'use no memo' directive (add it below 'use client', if present). react-hook-form mutates `control` and proxies `formState`, which the compiler's memoization cannot observe — see https://github.com/orgs/react-hook-form/discussions/12524.",
    },
  },

  create(context) {
    /** @type {import('estree').ImportDeclaration | null} */
    let offendingImport = null;

    return {
      ImportDeclaration(node) {
        if (offendingImport !== null || node.source.value !== 'react-hook-form') return;

        const isTypeOnlyDeclaration = node.importKind === 'type';
        // A bare `import 'react-hook-form'` is runtime; otherwise a specifier must survive erasure.
        const hasRuntimeSpecifier =
          !isTypeOnlyDeclaration &&
          (node.specifiers.length === 0 || node.specifiers.some(specifier => specifier.importKind !== 'type'));

        const carriesFormState = node.specifiers.some(
          specifier => specifier.imported != null && FORM_STATE_CARRIER_TYPES.has(specifier.imported.name),
        );

        if (hasRuntimeSpecifier || carriesFormState) offendingImport = node;
      },

      'Program:exit'(program) {
        if (offendingImport === null) return;

        // The directive prologue: leading string-literal statements, in order.
        const directives = [];
        for (const statement of program.body) {
          if (statement.type !== 'ExpressionStatement' || typeof statement.directive !== 'string') break;
          directives.push(statement);
        }
        if (directives.some(statement => statement.directive === 'use no memo')) return;

        context.report({
          node: offendingImport,
          messageId: 'missingDirective',
          fix(fixer) {
            const last = directives.at(-1);
            // After any existing directive: `'use client'` must stay first or Next stops
            // seeing it.
            return last === undefined
              ? fixer.insertTextBeforeRange([0, 0], "'use no memo';\n\n")
              : fixer.insertTextAfter(last, "\n'use no memo';");
          },
        });
      },
    };
  },
};

/** The plugin object `eslint.config.mjs` registers under the `openframe/` prefix. */
const openframePlugin = { rules: { 'react-hook-form-needs-no-memo': reactHookFormNeedsNoMemo } };

export default openframePlugin;
