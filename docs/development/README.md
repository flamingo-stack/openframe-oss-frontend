# Development Documentation

Welcome to the OpenFrame OSS Frontend development documentation. This section contains everything you need to contribute to, extend, and understand the codebase.

---

## Overview

The OpenFrame OSS Frontend is built on **Next.js 16 (App Router) + React 19 + TypeScript 5.8**. It uses Relay for GraphQL fragment management, TanStack Query for REST/server state, Zustand for client state, and Tailwind CSS for styling.

All development activities — setup, architecture questions, and collaboration — are coordinated through the [OpenMSP Slack community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA).

---

## Documentation Index

### Setup

| Guide | Description |
|-------|-------------|
| [Environment Setup](setup/environment.md) | IDE configuration, editor extensions, recommended tools |
| [Local Development](setup/local-development.md) | Cloning, running locally, hot reload, debugging |

### Architecture

| Guide | Description |
|-------|-------------|
| [Architecture Overview](architecture/README.md) | High-level system design, components, data flow |

### Security

| Guide | Description |
|-------|-------------|
| [Security Overview](security/README.md) | Authentication patterns, input validation, secrets management |

### Testing

| Guide | Description |
|-------|-------------|
| [Testing Overview](testing/README.md) | Test structure, running tests, writing new tests |

### Contributing

| Guide | Description |
|-------|-------------|
| [Contributing Guidelines](contributing/guidelines.md) | Code style, PR process, commit format, review checklist |

---

## Quick Reference

### Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm run start            # Start production server

# Code Quality
npm run type-check       # TypeScript type check
npm run lint             # ESLint
npm run lint:biome       # Biome linter
npm run format:fix       # Auto-fix formatting

# GraphQL
npm run relay            # Compile Relay fragments
npm run relay:watch      # Watch mode for Relay
npm run fetch-schema     # Fetch latest GraphQL schema
```

### Key Directories

```text
src/
├── app/               # Next.js App Router (pages, layouts, feature domains)
├── components/        # Shared cross-feature components
├── graphql/           # GraphQL mutations and query files
├── lib/               # Core infrastructure (API client, auth, Relay, MeshCentral)
└── stores/            # Zustand global state stores
```

### Technology Choices

| Technology | Role | Why |
|-----------|------|-----|
| Next.js 16 | SSR + routing | App Router, server components, file-based routing |
| React 19 | UI | Latest concurrent features |
| TypeScript 5.8 | Type safety | Strict typing across the entire codebase |
| Relay 20 | GraphQL fragments | Colocation, streaming, optimized pagination |
| TanStack Query 5 | REST + server state | Caching, pagination, optimistic updates |
| Zustand 5 | Client UI state | Lightweight, typesafe global state |
| Tailwind CSS 3 | Styling | Utility-first, consistent design tokens |
| Biome 2 | Linting + formatting | Fast, opinionated, replaces ESLint+Prettier for formatting |
| Zod 4 | Schema validation | Runtime-safe parsing and validation |

---

## Getting Help

- **Slack (primary):** https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA
- **GitHub:** https://github.com/flamingo-stack/openframe-oss-frontend
- **OpenFrame:** https://openframe.ai
