# Prerequisites

Before setting up the OpenFrame OSS Frontend, make sure your local environment meets the requirements below. This guide covers all software, access, and environment configuration needed to run and develop the application.

---

## Required Software

| Software | Minimum Version | Recommended | Notes |
|----------|----------------|-------------|-------|
| **Node.js** | 18.x | 20.x LTS or 22.x | Required for Next.js 16 |
| **npm** | 9.x | 10.x | Comes with Node.js |
| **Git** | 2.x | Latest | For cloning the repo |
| **TypeScript** | 5.8+ | bundled via devDeps | Installed automatically |

> **Note:** The project uses npm as the package manager. Do not use `yarn` or `pnpm` — the lockfile is `package-lock.json`.

---

## System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 4 GB | 8 GB+ |
| Disk Space | 2 GB free | 5 GB free |
| CPU | 2 cores | 4+ cores |
| OS | macOS 12+, Ubuntu 20.04+, Windows 10+ (WSL2) | macOS or Linux |

> **Windows Users:** We strongly recommend using [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install) with Ubuntu for the best development experience.

---

## Verifying Your Setup

Run the following commands to confirm your tools are correctly installed:

```bash
# Verify Node.js version
node --version

# Verify npm version
npm --version

# Verify Git version
git --version
```

Expected output (example):

```text
v20.14.0
10.7.0
git version 2.45.1
```

---

## Backend Services

The OpenFrame OSS Frontend is a frontend-only repository. To have full functionality locally, you also need access to the OpenFrame backend services. These include:

| Service | Purpose |
|---------|---------|
| **API Service Core** | Primary GraphQL API (devices, tickets, scripts, etc.) |
| **Authorization Service** | OAuth / JWT authentication |
| **Chat / AI Service** | Mingo AI streaming endpoints |
| **Fleet MDM** | Device policy management (optional) |
| **MeshCentral** | Remote desktop / file manager (optional) |

> **For development against a remote environment:** You can point the frontend at an existing OpenFrame deployment using environment variables. See the [Local Development Guide](../development/setup/local-development.md) for details on configuring environment variables.

---

## Environment Variables

The application reads runtime configuration from `NEXT_PUBLIC_*` environment variables. You will need at minimum:

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_TENANT_HOST_URL` | Base URL of the tenant API/gateway | `https://your-tenant.openframe.dev` |
| `NEXT_PUBLIC_SHARED_HOST_URL` | Shared platform API host | `https://api.openframe.dev` |
| `NEXT_PUBLIC_APP_MODE` | Application mode | `oss-tenant` |
| `NEXT_PUBLIC_APP_URL` | Public URL of this frontend app | `http://localhost:3000` |

Optional variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_GTM_CONTAINER_ID` | Google Tag Manager ID | _(none)_ |
| `NEXT_PUBLIC_AUTH_CHECK_INTERVAL` | Auth token check interval (ms) | `300000` |

Create a `.env.local` file in the project root (this file is gitignored):

```bash
cp .env.example .env.local
# Then edit .env.local with your values
```

> Refer to your environment configuration or team lead for actual values. Do not hardcode credentials.

---

## Knowledge Prerequisites

To contribute effectively, familiarity with the following is recommended:

| Topic | Level |
|-------|-------|
| React (hooks, context, suspense) | Intermediate |
| TypeScript | Intermediate |
| Next.js App Router | Beginner–Intermediate |
| GraphQL (queries, mutations, fragments) | Beginner |
| Relay (fragments, pagination) | Beginner |
| Tailwind CSS | Beginner |
| React Query / TanStack Query | Beginner |

---

## Checking Node.js Version Compatibility

The project targets Node.js 18+ due to Next.js 16 requirements. If you use a version manager like `nvm`:

```bash
# Install and use the correct Node version
nvm install 20
nvm use 20

# Verify
node --version
```

---

## Summary Checklist

Before proceeding to the Quick Start, confirm:

- [ ] Node.js 18+ is installed
- [ ] npm 9+ is installed
- [ ] Git is installed
- [ ] You have access to an OpenFrame backend environment (or environment variable values)
- [ ] You have `.env.local` configured with at minimum `NEXT_PUBLIC_TENANT_HOST_URL`

Once all items are checked, proceed to the [Quick Start Guide](quick-start.md).
