#!/usr/bin/env node
// Writes a minimal placeholder bundle into www/ so the native shell can be built
// and run on a device WITHOUT building the full openframe-frontend export. Use it
// to validate the device pipeline (signing, install, launch) first; swap in the
// real bundle later with `npm run build:web`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www');
mkdirSync(www, { recursive: true });

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
    <title>OpenFrame Mobile — dev shell</title>
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center;
             font: 16px/1.5 -apple-system, system-ui, sans-serif;
             background: #161616; color: #f5f5f5; padding: env(safe-area-inset-top) 24px; }
      .card { max-width: 30rem; text-align: center; }
      h1 { font-size: 1.5rem; margin: 0 0 .5rem; }
      code { background: #262626; padding: .1rem .4rem; border-radius: .3rem; }
      .ok { color: #4ade80; }
      pre { text-align: left; background: #0d0d0d; padding: 12px; border-radius: 8px; overflow:auto; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>OpenFrame Mobile</h1>
      <p class="ok">✓ Native shell is running on this device.</p>
      <p>This is the placeholder bundle. Run <code>npm run build:web</code> to ship the
         real openframe-frontend export instead.</p>
      <pre id="env">window.__ENV = (not injected)</pre>
    </div>
    <script>
      document.getElementById('env').textContent =
        'window.__ENV = ' + JSON.stringify(window.__ENV ?? null, null, 2);
    </script>
  </body>
</html>
`;

writeFileSync(join(www, 'index.html'), html);
console.log('▸ wrote placeholder www/index.html');
