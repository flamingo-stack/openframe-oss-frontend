# OpenFrame OSS Frontend — Documentation

Welcome to the documentation for **OpenFrame OSS Frontend**, the primary web application powering the [OpenFrame](https://openframe.ai) platform — a unified, AI-driven interface for Managed Service Providers (MSPs).

---

## 📚 Table of Contents

- [Getting Started](#-getting-started)
- [Development](#-development)
- [Reference Architecture](#-reference-architecture)
- [Architecture Diagrams](#-architecture-diagrams)
- [Quick Links](#-quick-links)

---

## 🚀 Getting Started

New to the project? Start here:

- [Introduction](./getting-started/introduction.md) — What is OpenFrame OSS Frontend and who it's for
- [Prerequisites](./getting-started/prerequisites.md) — Required software, system requirements, and environment variables
- [Quick Start](./getting-started/quick-start.md) — Get the app running locally in under 5 minutes
- [First Steps](./getting-started/first-steps.md) — Explore the app, verify your setup, and understand key directories

---

## 🛠 Development

Guides for contributors and developers working in the codebase:

- [Development Overview](./development/README.md) — Common commands, key directories, and technology choices
- [Environment Setup](./development/setup/environment.md) — IDE configuration, editor extensions, recommended tools
- [Local Development](./development/setup/local-development.md) — Cloning, running locally, hot reload, debugging
- [Architecture Overview](./development/architecture/README.md) — High-level system design, data flow patterns, state management
- [Security Overview](./development/security/README.md) — Authentication patterns, input validation, secrets management
- [Testing Overview](./development/testing/README.md) — Test structure, running checks, writing testable code
- [Contributing Guidelines](./development/contributing/guidelines.md) — Code style, PR process, commit format, review checklist

---

## 📖 Reference Architecture

Technical reference documentation generated from source code analysis:

### Core Application

- [OpenFrame OSS Frontend](./reference/architecture/openframe-oss-frontend/openframe-oss-frontend.md) — Main application architecture, feature domains, design principles
- [Frontend Core](./reference/architecture/frontend-core/frontend-core.md) — Shared UI component library and design system
- [Frontend Core — Auth Context](./reference/architecture/frontend-core/auth-context/auth-context.md) — Authentication context providers
- [Frontend Core — Chat Components](./reference/architecture/frontend-core/chat-components/chat-components.md) — AI chat UI framework
- [Frontend Core — Chat Types](./reference/architecture/frontend-core/chat-types/chat-types.md) — Chat domain type definitions
- [Frontend Core — Chat Utils](./reference/architecture/frontend-core/chat-utils/chat-utils.md) — Chat utilities and helpers
- [Frontend Core — Docs Components](./reference/architecture/frontend-core/docs-components/docs-components.md) — Embeddable documentation surfaces
- [Frontend Core — Embeds Components](./reference/architecture/frontend-core/embeds-components/embeds-components.md) — Embed and iframe components
- [Frontend Core — Features Components](./reference/architecture/frontend-core/features-components/features-components.md) — AI enrichment and board systems
- [Frontend Core — Hooks](./reference/architecture/frontend-core/hooks/hooks.md) — Shared React hooks
- [Frontend Core — Icons Components](./reference/architecture/frontend-core/icons-components/icons-components.md) — Icon system
- [Frontend Core — Layout Components](./reference/architecture/frontend-core/layout-components/layout-components.md) — Page structure and chrome
- [Frontend Core — Navigation Components](./reference/architecture/frontend-core/navigation-components/navigation-components.md) — Header, sidebar, and mobile nav
- [Frontend Core — Platform Components](./reference/architecture/frontend-core/platform-components/platform-components.md) — Script, shell, and OS UI
- [Frontend Core — Schemas](./reference/architecture/frontend-core/schemas/schemas.md) — Zod runtime validation schemas
- [Frontend Core — Shared Components](./reference/architecture/frontend-core/shared-components/shared-components.md) — Roadmap, releases, onboarding, delivery
- [Frontend Core — Tickets Components](./reference/architecture/frontend-core/tickets-components/tickets-components.md) — Ticketing UI system
- [Frontend Core — Types](./reference/architecture/frontend-core/types/types.md) — Domain type definitions and contracts
- [Frontend Core — UI Components](./reference/architecture/frontend-core/ui-components/ui-components.md) — Design system primitives
- [Frontend Core — Utils](./reference/architecture/frontend-core/utils/utils.md) — Registries and configuration utilities
- [Frontend Core — Vendor Components](./reference/architecture/frontend-core/vendor-components/vendor-components.md) — Vendor identity layer
- [Feature Flags](./reference/architecture/fe-feature-flags/fe-feature-flags.md) — Frontend feature flag system
- [React Embedding Example](./reference/architecture/react-embedding-example/react-embedding-example.md) — How to embed OpenFrame in React apps

### Backend Services

- [API Service Core](./reference/architecture/api-service-core/api-service-core.md) — Primary GraphQL API service
- [API Service](./reference/architecture/api-service/api-service.md) — API service implementation
- [API Lib Service](./reference/architecture/api-lib-service/api-lib-service.md) — Shared API service libraries
- [API Lib DTO](./reference/architecture/api-lib-dto/api-lib-dto.md) — Data transfer object definitions
- [API Client](./reference/architecture/api-client/api-client.md) — HTTP client abstractions
- [External API Service Core](./reference/architecture/external-api-service-core/external-api-service-core.md) — External integrations API layer
- [Gateway Service Core](./reference/architecture/gateway-service-core/gateway-service-core.md) — API gateway and routing
- [Authorization Service Core](./reference/architecture/authorization-service-core/authorization-service-core.md) — OAuth 2.0 / OIDC authorization
- [Management Service Core](./reference/architecture/management-service-core/management-service-core.md) — Tenant and management operations
- [Stream Service Core](./reference/architecture/stream-service-core/stream-service-core.md) — Event streaming (Kafka / NATS)
- [Ticket Service](./reference/architecture/ticket-service/ticket-service.md) — Ticketing backend service
- [Client Core](./reference/architecture/client-core/client-core.md) — Client-side shared core
- [Core](./reference/architecture/core/core.md) — Foundational shared module
- [Config Core](./reference/architecture/config-core/config-core.md) — Configuration management

### Security & Identity

- [Security Core](./reference/architecture/security-core/security-core.md) — Core security patterns and authentication
- [Security OAuth](./reference/architecture/security-oauth/security-oauth.md) — OAuth 2.0 implementation
- [IDP Configuration](./reference/architecture/idp-configuration/idp-configuration.md) — Identity provider setup

### Notifications

- [Notification Push](./reference/architecture/notification-push/notification-push.md) — Push notification service
- [Notification Mail](./reference/architecture/notification-mail/notification-mail.md) — Email notification service

### Data Layer

- [Data Mongo Common](./reference/architecture/data-mongo-common/data-mongo-common.md) — Shared MongoDB utilities
- [Data Mongo Reactive](./reference/architecture/data-mongo-reactive/data-mongo-reactive.md) — Reactive MongoDB integration
- [Data Mongo Sync](./reference/architecture/data-mongo-sync/data-mongo-sync.md) — Synchronous MongoDB integration
- [Data Cassandra](./reference/architecture/data-cassandra/data-cassandra.md) — Apache Cassandra integration
- [Data Pinot](./reference/architecture/data-pinot/data-pinot.md) — Apache Pinot analytics integration
- [Data Redis](./reference/architecture/data-redis/data-redis.md) — Redis caching integration
- [Data Kafka](./reference/architecture/data-kafka/data-kafka.md) — Apache Kafka messaging integration
- [Data NATS](./reference/architecture/data-nats/data-nats.md) — NATS messaging integration
- [Data Device Aspect](./reference/architecture/data-device-aspect/data-device-aspect.md) — Device data modeling
- [Data Time Entry Aspect](./reference/architecture/data-timeentry-aspect/data-timeentry-aspect.md) — Time entry data modeling

### Tool Integrations & SDKs

- [SDK Fleet MDM](./reference/architecture/sdk-fleetmdm/sdk-fleetmdm.md) — Fleet MDM SDK integration
- [Tool Agent NATS Installation](./reference/architecture/tool-agent-nats-installation/tool-agent-nats-installation.md) — NATS-based tool agent installation

### Initializers

- [Pinot Initializer](./reference/architecture/pinot-initializer/pinot-initializer.md) — Apache Pinot schema initialization
- [Debezium Initializer](./reference/architecture/debezium-initializer/debezium-initializer.md) — Debezium CDC initialization

---

## 🗺 Architecture Diagrams

Visual architecture diagrams are available in the `docs/diagrams/architecture/` directory. Each module has one or more Mermaid diagram files (`.mmd`) covering different aspects of its architecture.

Key diagram sets:

- `openframe-oss-frontend.mmd` — Main application architecture
- `frontend-core.mmd` — Shared UI library structure
- `gateway-service-core.mmd` — Gateway routing and proxy
- `stream-service-core.mmd` — Event streaming topology
- `api-service-core.mmd` — API service internals
- `authorization-service-core.mmd` — Auth and OAuth flows
- `security-core.mmd` / `security-oauth.mmd` — Security patterns

View all diagrams in [`docs/diagrams/architecture/`](./diagrams/architecture/).

---

## 🔗 Quick Links

- [Project README](../README.md) — Main project overview and quick start
- [Contributing Guidelines](../CONTRIBUTING.md) — How to contribute
- [OpenFrame Website](https://openframe.ai) — Platform home
- [Flamingo Platform](https://flamingo.run) — Built by Flamingo
- [OpenMSP Slack Community](https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) — Primary support channel
- [GitHub Repository](https://github.com/flamingo-stack/openframe-oss-frontend) — Source code

---

*Documentation generated by [🦩 Flamingo AI Technical Writer](https://flamingo.run)*
