# Development Environment Setup

This guide covers IDE configuration, recommended editor extensions, and development tools for contributing to the OpenFrame OSS Frontend.

---

## Recommended IDE: VS Code

[Visual Studio Code](https://code.visualstudio.com/) is the recommended editor for this project. It has excellent TypeScript, Next.js, and Tailwind CSS support.

### Recommended Extensions

Install these extensions for the best development experience:

| Extension | ID | Purpose |
|-----------|----|---------| 
| **TypeScript Vue Plugin** / TS Inlay Hints | built-in | TypeScript language support |
| **ESLint** | `dbaeumer.vscode-eslint` | Inline lint errors |
| **Prettier** | `esbenp.prettier-vscode` | Formatting |
| **Tailwind CSS IntelliSense** | `bradlc.vscode-tailwindcss` | Autocomplete for Tailwind classes |
| **GraphQL: Language Feature Support** | `GraphQL.vscode-graphql` | GraphQL schema awareness |
| **Relay** | `meta.relay` | Relay fragment support and autocomplete |
| **Pretty TypeScript Errors** | `yoavbls.pretty-ts-errors` | Readable TypeScript error messages |
| **Auto Import** | built-in TS feature | Automatic import resolution |

Install all at once via the terminal:

```bash
code --install-extension esbenp.prettier-vscode
code --install-extension bradlc.vscode-tailwindcss
code --install-extension GraphQL.vscode-graphql
code --install-extension meta.relay
code --install-extension yoavbls.pretty-ts-errors
code --install-extension dbaeumer.vscode-eslint
```

---

## VS Code Settings

The workspace already ships `.vscode/settings.json` and `.vscode/extensions.json`, so opening the
repo is enough. What they set, and what you'd want in user settings for other Flamingo repos:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  // Import order is an ESLint rule here (perfectionist/sort-imports), so
  // source.fixAll.eslint sorts them. Do NOT add source.organizeImports —
  // it uses the TS server's ordering and the two fight on every save.
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.useFlatConfig": true,
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "tailwindCSS.experimental.classRegex": [
    ["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ],
  "graphql-config.load.legacy": false,
  "relay.pathToRelay": "./node_modules/.bin/relay-compiler"
}
```

---

## Alternative IDEs

### JetBrains WebStorm / IntelliJ IDEA

WebStorm provides excellent TypeScript and Next.js support out of the box.

1. Open the project root directory
2. Enable the **GraphQL** plugin from Settings → Plugins
3. Install the **Prettier** plugin for formatting and enable ESLint
4. Set TypeScript version to the project's `node_modules/typescript` version

### Neovim / Vim

Use `nvim-lspconfig` with the TypeScript LSP (`tsserver` or `typescript-language-server`), plus `eslint` and `prettier` (via `none-ls`/`conform.nvim`) for linting and formatting.

---

## Node.js Version Management

We recommend using a version manager to handle Node.js versions:

### Using `nvm` (macOS/Linux)

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Install and use Node.js 20 LTS
nvm install 20
nvm use 20
nvm alias default 20
```

### Using `fnm` (macOS/Linux/Windows)

```bash
# Install fnm (fast node manager)
curl -fsSL https://fnm.vercel.app/install | bash

# Install and use Node.js 20
fnm install 20
fnm use 20
```

### Using `.nvmrc`

If an `.nvmrc` file exists in the project root, simply run:

```bash
nvm use
```

---

## Environment Variable Setup

Copy the example environment file and configure your local values:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your backend configuration. Key variables:

```bash
NEXT_PUBLIC_TENANT_HOST_URL=https://your-tenant.openframe.dev
NEXT_PUBLIC_SHARED_HOST_URL=https://api.openframe.dev
NEXT_PUBLIC_APP_MODE=oss-tenant
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> The `.env.local` file is gitignored. Never commit credentials to the repository.

---

## Husky Git Hooks

The project uses [Husky](https://typicode.github.io/husky/) for pre-commit hooks. These run automatically after installation via `npm install`:

```bash
# Hooks are set up via the prepare script
npm install  # This also runs prepare → husky
```

The pre-commit hook typically runs linting and type checking to prevent bad code from being committed.

---

## Lint and format configuration

ESLint owns the rules, Prettier owns the formatting. Neither rule set lives in this repo: both come
from the shared config shipped inside `@flamingo-stack/openframe-frontend-core` (`eslint-config/`),
so every Flamingo frontend lints the same way. `eslint.config.mjs` and `prettier.config.mjs` here
just compose the layers.

```bash
# Lint (fast pass — what the editor loads)
npm run lint

# Auto-fix all fixable issues
npm run lint:fix

# Format only (no lint checks)
npm run format:fix

# Type-aware pass — slow, needs an 8 GB heap; run it before pushing
npm run lint:types
```

`// eslint-disable` comments are inert (`noInlineConfig`) and are themselves reported as errors.

---

## GraphQL Schema Sync

When the backend GraphQL schema changes, you need to sync the schema locally for Relay compilation and IDE schema awareness:

```bash
npm run fetch-schema
```

After fetching, recompile Relay fragments:

```bash
npm run relay
```

---

## Summary Checklist

- [ ] VS Code installed with recommended extensions
- [ ] Node.js 20 LTS installed (via `nvm` or `fnm`)
- [ ] `.env.local` configured
- [ ] `npm install` completed (including Husky hooks)
- [ ] Prettier and ESLint extensions active with format-on-save enabled
- [ ] Relay extension installed for GraphQL fragment support
