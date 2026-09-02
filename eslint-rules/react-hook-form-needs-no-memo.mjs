/**
 * Files that use react-hook-form AT RUNTIME must opt out of the React Compiler
 * with a module-level `'use no memo'` directive.
 *
 * Why: react-hook-form's core objects are interiorly mutable by design — `control`
 * is mutated in place, and `formState` is a Proxy that decides what to re-render
 * from which properties were touched. The compiler memoizes on the assumption that
 * values it has already seen do not change underneath it, so a mutation it cannot
 * observe is not re-read: `watch()` returns stale values inside `useFormContext()`
 * children, `formState` read through context stops triggering re-renders, and a
 * plain `register()` + `reset()` leaves the mount set empty so the input never
 * receives the restored value. See
 * https://github.com/orgs/react-hook-form/discussions/12524.
 *
 * None of that is a rule violation the compiler's own diagnostics can catch —
 * the mutation happens inside the library — so nothing else in the lint set
 * reports it. Hence this rule.
 *
 * The directive is module-scoped on purpose (the compiler honours it via
 * `hasModuleScopeOptOut`): the form state usually spans a hook file and the field
 * components it feeds, so opting out one function while its neighbours stay
 * compiled reintroduces the same split the bug lives in.
 *
 * Type-only imports are ignored — with one exception. A type erases at build time,
 * so a file that only names `FieldValues` runs no library code and de-optimizing it
 * would cost memoization for nothing. But some of these types are HANDLES on the
 * live form object: a file typed `UseFormReturn` or `Control` calls `reset()`,
 * reads the `formState` proxy and passes `control` on, which is the mutation this
 * rule exists for, whether or not the import survives compilation. Those names are
 * listed in {@link FORM_STATE_CARRIER_TYPES} and count like a runtime import.
 * `use-seed-form.ts` is the case that forced the distinction: type-only imports,
 * and it does nothing but `form.reset()` behind a `formState.isDirty` check.
 *
 * This is a workaround with an exit: the discussion reports most cases fixed on
 * react-hook-form 7.75 + React 19.2.5. When this repo is on those, re-test and
 * delete the rule plus the directives it required — a module-scope opt-out is
 * invisible once it is in place, so it will not remove itself.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
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
        // A bare `import 'react-hook-form'` has no specifiers and IS runtime;
        // otherwise at least one specifier has to survive erasure.
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
            // After the last existing directive so `'use client'` stays first —
            // Next reads it off the prologue and a displaced one silently turns
            // the file into a Server Component.
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
