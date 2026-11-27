/**
 * `openframe/no-graphql-folder` — no new module in `src/graphql/`.
 *
 * Why: a query, fragment or mutation lives with the code that reads it: the component that runs a query, the component
 * or `@inline` reader that reads a fragment, the hook that owns a mutation. `relay/unused-fields` judges each file on
 * its own, so an operation parked in `src/graphql/` and read elsewhere hides over-fetching. The folder is frozen and
 * going away: the files it holds today are `LEGACY_GRAPHQL_FOLDER` (`backlog.mjs`), which only shrinks as they move.
 *
 * The rule reports every file the config hands it, once; the config hands it `src/graphql/**` minus that backlog.
 */
export const noGraphqlFolder = {
  meta: {
    type: 'problem',
    docs: { description: 'Keep GraphQL operations with their readers, not in src/graphql/.' },
    schema: [],
    messages: {
      folder:
        'src/graphql/ is frozen and going away: put this operation in the file that reads it (the component that runs ' +
        'the query, the reader of the fragment, the hook that owns the mutation). See CLAUDE.md, GraphQL with react-relay.',
    },
  },
  create(context) {
    return {
      Program(node) {
        context.report({ node, messageId: 'folder' });
      },
    };
  },
};
