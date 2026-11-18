import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { buildSchema, introspectionFromSchema, parse, validate } from 'graphql';

const ROOT = resolve(import.meta.dirname, '..');
const CHAT_SOURCE = 'src/app/(app)/mingo/models/mingo-model-operations.ts';
const PREVIOUS_API = 'type Query { previousApi: String }';
const PREVIOUS_CHAT = 'type Query { previousChat: String }';
const API_SCHEMA = `
  type Query { currentUser: User }
  type User { id: ID!, displayName: String }
  enum AIProvider { ANTHROPIC OPENAI GOOGLE }
`;
const CHAT_SCHEMA = `
  interface Node { id: ID! }
  type Query { dialog(id: ID!): Dialog, currentUser: User }
  type Mutation { updateDialogModel(input: UpdateDialogModelInput!): DialogPayload! }
  type User { id: ID!, displayName: [String!]! }
  input DialogModelInput { provider: AIProvider!, modelName: String! }
  input UpdateDialogModelInput { id: ID!, model: DialogModelInput }
  type DialogModel { provider: AIProvider!, modelName: String!, displayName: String }
  type Dialog implements Node {
    id: ID!
    dialogId: String!
    agentType: AgentType
    status: DialogStatus!
    streamState: DialogStreamState!
    pendingApproval: PendingApproval
    modelTokenBudget: Int!
    model: DialogModel
    effectiveModel: DialogModel!
  }
  type PendingApproval { id: ID! }
  type DialogPayload { dialog: Dialog, userErrors: [ChatUserError!]! }
  type ChatUserError { field: [String!], message: String!, code: String }
  enum AIProvider { ANTHROPIC OPENAI GOOGLE }
  enum AgentType { ADMIN CLIENT }
  enum DialogStatus { ACTIVE ACTION_REQUIRED ON_HOLD RESOLVED ARCHIVED }
  enum DialogStreamState { IDLE STREAMING }
`;

function fixture(t, failure) {
  const directory = mkdtempSync(resolve(tmpdir(), 'openframe-schema-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(resolve(directory, 'scripts'));
  cpSync(resolve(ROOT, 'scripts/fetch-schema.mjs'), resolve(directory, 'scripts/fetch-schema.mjs'));
  cpSync(resolve(ROOT, 'scripts/generate-schema-enums.mjs'), resolve(directory, 'scripts/generate-schema-enums.mjs'));
  symlinkSync(resolve(ROOT, 'node_modules'), resolve(directory, 'node_modules'), 'dir');
  writeFileSync(resolve(directory, 'schema.graphql'), PREVIOUS_API);
  writeFileSync(resolve(directory, 'schema.chat.graphql'), PREVIOUS_CHAT);
  const responses = {
    'https://schema.test/api/graphql': { data: introspectionFromSchema(buildSchema(API_SCHEMA)) },
    'https://schema.test/chat/graphql': { data: introspectionFromSchema(buildSchema(CHAT_SCHEMA)) },
    'https://override.test/api/graphql': { data: introspectionFromSchema(buildSchema(API_SCHEMA)) },
    'https://override.test/chat/graphql': { data: introspectionFromSchema(buildSchema(CHAT_SCHEMA)) },
    'https://chat.test/custom/graphql': { data: introspectionFromSchema(buildSchema(CHAT_SCHEMA)) },
  };
  writeFileSync(resolve(directory, 'responses.json'), JSON.stringify(responses));
  writeFileSync(
    resolve(directory, 'fetch-fixture.mjs'),
    `import { readFileSync } from 'node:fs';
const responses = JSON.parse(readFileSync(new URL('./responses.json', import.meta.url), 'utf8'));
globalThis.fetch = async (endpoint, options) => {
  if (options.method !== 'POST' || !JSON.parse(options.body).query.includes('__schema')) {
    throw new Error('Expected an introspection POST');
  }
  if (endpoint.endsWith('/chat/graphql') && process.env.SCHEMA_TEST_FAILURE === 'network') {
    throw new Error('Chat endpoint unavailable');
  }
  if (endpoint.endsWith('/chat/graphql') && process.env.SCHEMA_TEST_FAILURE === 'http') {
    return { ok: false, status: 503, statusText: 'Service Unavailable' };
  }
  const body = endpoint.endsWith('/chat/graphql') && process.env.SCHEMA_TEST_FAILURE === 'malformed'
    ? { data: {} } : endpoint.endsWith('/chat/graphql') && process.env.SCHEMA_TEST_FAILURE === 'graphql'
    ? { errors: [{ message: 'Introspection forbidden' }] } : responses[endpoint];
  if (!body) throw new Error('Unexpected endpoint: ' + endpoint);
  if (endpoint.endsWith('/chat/graphql') && process.env.SCHEMA_TEST_FAILURE === 'invalid') {
    body.data.__schema.queryType = null;
  }
  return { ok: true, json: async () => body };
};
`,
  );
  return {
    directory,
    run: (...args) =>
      spawnSync(process.execPath, args, {
        cwd: directory,
        encoding: 'utf8',
        env: { ...process.env, NEXT_PUBLIC_TENANT_HOST_URL: 'https://schema.test', SCHEMA_TEST_FAILURE: failure ?? '' },
      }),
  };
}

test('default regeneration keeps API and Chat contracts independently compilable', t => {
  const { directory, run } = fixture(t);
  const fetched = run('--import', './fetch-fixture.mjs', 'scripts/fetch-schema.mjs');
  assert.equal(fetched.status, 0, fetched.stderr);
  const api = buildSchema(readFileSync(resolve(directory, 'schema.graphql'), 'utf8'));
  const chat = buildSchema(readFileSync(resolve(directory, 'schema.chat.graphql'), 'utf8'));
  assert.equal(api.getQueryType().getFields().dialog, undefined);
  assert.ok(chat.getQueryType().getFields().dialog);
  assert.equal(String(api.getType('User').getFields().displayName.type), 'String');
  assert.equal(String(chat.getType('User').getFields().displayName.type), '[String!]!');

  mkdirSync(resolve(directory, 'src/app/(app)/mingo/models'), { recursive: true });
  cpSync(resolve(ROOT, CHAT_SOURCE), resolve(directory, CHAT_SOURCE));
  writeFileSync(
    resolve(directory, 'src/schemaGenerationApi.ts'),
    "import { graphql } from 'react-relay';\nconst query = graphql`query schemaGenerationApiQuery { currentUser { id displayName } }`;\n",
  );
  const config = JSON.parse(readFileSync(resolve(ROOT, 'relay.config.json'), 'utf8'));
  writeFileSync(resolve(directory, 'relay.config.json'), JSON.stringify({ ...config, noSourceControl: true }));
  const compiled = run(resolve(ROOT, 'node_modules/relay-compiler/cli.js'));
  assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
  const recompiled = run(resolve(ROOT, 'node_modules/relay-compiler/cli.js'));
  assert.equal(recompiled.status, 0, recompiled.stdout + recompiled.stderr);
  const artifact = readFileSync(
    resolve(directory, 'src/chat/__generated__/mingoModelOperationsReadQuery.graphql.ts'),
    'utf8',
  );
  const queryText = JSON.parse(artifact.match(/"text": (".*")/)[1]);
  assert.match(queryText, /query mingoModelOperationsReadQuery/);
  assert.match(queryText, /modelTokenBudget/);
  assert.deepEqual(validate(chat, parse(queryText)), []);
  const mutation = readFileSync(
    resolve(directory, 'src/chat/__generated__/mingoModelOperationsUpdateMutation.graphql.ts'),
    'utf8',
  );
  const mutationText = JSON.parse(mutation.match(/"text": (".*")/)[1]);
  assert.match(mutationText, /mutation mingoModelOperationsUpdateMutation/);
  assert.match(mutationText, /updateDialogModel\(input:/);
  assert.deepEqual(validate(chat, parse(mutationText)), []);
  assert.ok(readFileSync(resolve(directory, 'src/__generated__/schemaGenerationApiQuery.graphql.ts'), 'utf8'));
  const checked = run(
    resolve(ROOT, 'node_modules/typescript/bin/tsc'),
    '--noEmit',
    '--skipLibCheck',
    '--target',
    'ES2022',
    '--moduleResolution',
    'node',
    'src/chat/__generated__/mingoModelOperationsReadQuery.graphql.ts',
    'src/chat/__generated__/mingoModelOperationsUpdateMutation.graphql.ts',
  );
  assert.equal(checked.status, 0, checked.stdout + checked.stderr);

  const enums = run('scripts/generate-schema-enums.mjs');
  assert.equal(enums.status, 0, enums.stderr);
  assert.match(
    readFileSync(resolve(directory, 'src/generated/chat-schema-enums.ts'), 'utf8'),
    /export const AgentType/,
  );
  assert.doesNotMatch(
    readFileSync(resolve(directory, 'src/generated/schema-enums.ts'), 'utf8'),
    /export const AgentType/,
  );
});

test('an API endpoint override also selects the Chat endpoint on that origin', t => {
  const { directory, run } = fixture(t);
  const result = run(
    '--import',
    './fetch-fixture.mjs',
    'scripts/fetch-schema.mjs',
    '--endpoint',
    'https://override.test/api/graphql',
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    readFileSync(resolve(directory, 'schema.chat.graphql'), 'utf8'),
    /# Source: https:\/\/override.test\/chat\/graphql/,
  );
});

test('a Chat endpoint override can select a separate service', t => {
  const { directory, run } = fixture(t);
  const result = run(
    '--import',
    './fetch-fixture.mjs',
    'scripts/fetch-schema.mjs',
    '--chat-endpoint',
    'https://chat.test/custom/graphql',
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    readFileSync(resolve(directory, 'schema.chat.graphql'), 'utf8'),
    /# Source: https:\/\/chat.test\/custom\/graphql/,
  );
});

['network', 'http', 'graphql', 'malformed', 'invalid'].forEach(failure => {
  test(`a Chat ${failure} failure preserves both previous schema files`, t => {
    const { directory, run } = fixture(t, failure);
    const result = run('--import', './fetch-fixture.mjs', 'scripts/fetch-schema.mjs');
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(resolve(directory, 'schema.graphql'), 'utf8'), PREVIOUS_API);
    assert.equal(readFileSync(resolve(directory, 'schema.chat.graphql'), 'utf8'), PREVIOUS_CHAT);
  });
});
