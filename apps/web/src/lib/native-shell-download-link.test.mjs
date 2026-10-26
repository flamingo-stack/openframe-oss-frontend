// The desktop shell's half of the "Open the app" link, as the page sees it: the command that
// hands over the download id once, and the event that says one arrived while the page was open.
// Node's built-in test module, like the other src/lib suites; the Tauri globals are faked, since
// they only exist inside the shell.

import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import './test-module-resolve.mjs';

let invoke;
let listeners;

globalThis.window = {
  __TAURI_INTERNALS__: {},
  __TAURI__: {
    core: { invoke: (command, args) => invoke(command, args) },
    event: {
      listen: async (event, handler) => {
        listeners.push({ event, handler });
        return () => {};
      },
    },
  },
};

const S = await import('./native-shell.ts');

beforeEach(() => {
  invoke = async () => null;
  listeners = [];
});

test('the download id is taken through the shell command', async () => {
  const calls = [];
  invoke = async command => {
    calls.push(command);
    return '0f8fad5b-d9cb-469f-a165-70867728950e';
  };
  assert.equal(await S.takeDesktopDownloadId(), '0f8fad5b-d9cb-469f-a165-70867728950e');
  assert.deepEqual(calls, ['take_pending_download_id']);
});

test('nothing waiting reads as null', async () => {
  assert.equal(await S.takeDesktopDownloadId(), null);
});

test('an answer that is not a string reads as null', async () => {
  invoke = async () => ({ id: 'x' });
  assert.equal(await S.takeDesktopDownloadId(), null);
});

test('a command that never ran reads as null instead of failing the page', async () => {
  invoke = async () => {
    throw new Error('command take_pending_download_id not allowed');
  };
  const logged = console.error;
  console.error = () => {};
  try {
    assert.equal(await S.takeDesktopDownloadId(), null);
  } finally {
    console.error = logged;
  }
});

test('the arrival signal is the shell event the page subscribes to', async () => {
  let signalled = 0;
  assert.equal(
    await S.onDesktopDownloadLink(() => {
      signalled += 1;
    }),
    true,
  );
  assert.deepEqual(
    listeners.map(l => l.event),
    ['download-link:received'],
  );
  listeners[0].handler({ payload: null });
  assert.equal(signalled, 1);
});
