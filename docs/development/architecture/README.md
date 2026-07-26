# Architecture Overview

This document describes the high-level architecture of the OpenFrame OSS Frontend, its core components, data flow patterns, and key design decisions.

---

## High-Level Architecture

The OpenFrame OSS Frontend is a Next.js 16 (App Router) application that serves as the **presentation and orchestration layer** for the OpenFrame platform. It communicates with multiple backend services:

```mermaid
flowchart LR
    Browser["User Browser"] --> Frontend["OpenFrame OSS Frontend\n(Next.js 16 + React 19)"]

    Frontend -->|"GraphQL /api/graphql"| ApiService["API Service Core"]
    Frontend -->|"REST /chat/api"| ChatService["AI / Chat Service"]
    Frontend -->|"OAuth 2.0"| AuthService["Authorization Service"]
    Frontend -->|"/tools/fleetmdm-server"| Fleet["Fleet MDM"]
    Frontend -->|"/tools/meshcentral"| Mesh["MeshCentral"]

    ApiService --> DB["MongoDB / Cassandra / Apache Pinot"]
    ChatService --> Stream["Kafka / NATS"]
```

---

## Application Structure

The repository follows a domain-based file organization under Next.js App Router:

```mermaid
flowchart TD
    Root["src/"]
    Root --> App["app/ (Next.js routes)"]
    Root --> Components["components/ (shared cross-feature)"]
    Root --> GraphQL["graphql/ (mutations & queries)"]
    Root --> Lib["lib/ (infrastructure)"]
    Root --> Stores["stores/ (Zustand state)"]

    App --> AuthRoutes["(auth)/ — login, signup, password reset"]
    App --> AppRoutes["(app)/ — authenticated feature pages"]

    AppRoutes --> Customers["customers/"]
    AppRoutes --> Devices["devices/"]
    AppRoutes --> Tickets["tickets/"]
    AppRoutes --> KB["knowledge-base/"]
    AppRoutes --> Monitoring["monitoring/"]
    AppRoutes --> Scripts["scripts/ + scripts-v2/"]
    AppRoutes --> Logs["logs-page/"]
    AppRoutes --> Mingo["mingo/"]
    AppRoutes --> Settings["settings/"]
    AppRoutes --> Onboarding["onboarding/"]
```

---

## Core Components

### Feature Domain Structure

Every feature domain follows the same internal organization pattern:

```text
<domain>/
├── components/     # React components (UI, forms, tables, modals)
├── hooks/          # React hooks (data fetching, mutations, UI state)
├── queries/        # GraphQL query/mutation strings
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
└── page.tsx        # Next.js page entry point
```

### Key Infrastructure Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `ApiClient` | `src/lib/api-client.ts` | Centralized HTTP client with auth, token refresh |
| `AuthApiClient` | `src/lib/auth-api-client.ts` | Auth-specific endpoints (login, token exchange) |
| `FleetApiClient` | `src/lib/fleet-api-client.ts` | Fleet MDM REST API proxy client |
| Relay Environment | `src/lib/relay/environment.ts` | GraphQL Relay network layer |
| Query Client | `src/lib/query-client-provider.tsx` | TanStack Query configuration |
| Runtime Config | `src/lib/runtime-config.ts` | Typed `NEXT_PUBLIC_*` env var accessors |
| Navigation Config | `src/lib/routes.ts` | App route definitions |
| Token Store | `src/lib/token-store.ts` | Access/refresh token persistence |
| MeshCentral | `src/lib/meshcentral/` | Remote desktop, file manager WebSocket protocol |

---

## State Management Strategy

The application uses **three complementary state management approaches**:

```mermaid
flowchart TD
    State["Application State"]
    State --> RQ["TanStack Query\n(server state)"]
    State --> Relay["Relay\n(GraphQL fragments)"]
    State --> Zustand["Zustand\n(client UI state)"]

    RQ --> DevicesQ["Devices, Customers, Tickets\n(REST + GraphQL REST queries)"]
    Relay --> LogsR["Logs, Scripts, Notifications\n(Relay pagination/streaming)"]
    Zustand --> Stores["Feature Flags, Onboarding,\nMingo Messages, Device Filters"]
```

| Pattern | Technology | Used For |
|---------|-----------|---------|
| **Server state** | TanStack Query v5 | REST API calls, optimistic mutations, cursor pagination |
| **GraphQL fragments** | Relay v20 | Logs, scripts, notifications (streaming + pagination) |
| **Client UI state** | Zustand v5 | Feature flags, onboarding progress, Mingo chat state, device store |

### Zustand Stores

| Store | Location | Purpose |
|-------|----------|---------|
| `FeatureFlagsState` | `src/stores/feature-flags-store.ts` | Feature flag values |
| `OnboardingState` | `src/stores/onboarding-store.ts` | Onboarding progress tracking |
| `DevicesState` | `src/stores/devices-store.ts` | Device selection and filter state |
| `MingoMessagesStore` | `src/app/(app)/mingo/stores/` | Per-dialog chat messages |
| `MingoContextStore` | `src/app/(app)/mingo/stores/` | Context items sent with messages |
| `MingoLauncherStore` | `src/app/(app)/mingo/stores/` | Chat panel open/closed state |

---

## Data Flow: GraphQL Request

```mermaid
sequenceDiagram
    participant Component
    participant Hook
    participant ApiClient
    participant Backend

    Component->>Hook: Call useCustomers()
    Hook->>ApiClient: apiClient.post('/api/graphql', query)
    ApiClient->>ApiClient: Attach Authorization header
    ApiClient->>Backend: HTTP POST /api/graphql
    Backend-->>ApiClient: GraphQL response
    ApiClient-->>Hook: { data, error, ok }
    Hook-->>Component: customers[], isLoading, error
```

---

## Data Flow: Relay Fragment (Streaming)

```mermaid
sequenceDiagram
    participant Page
    participant RelayQuery
    participant Network
    participant Backend

    Page->>RelayQuery: useLazyLoadQuery(LogsTableQuery)
    RelayQuery->>Network: GraphQL query via Relay network
    Network->>Backend: /api/graphql (with Relay pagination)
    Backend-->>Network: Paginated response
    Network-->>RelayQuery: Fragment data
    RelayQuery-->>Page: Data + pagination controls
```

---

## Authentication Architecture

```mermaid
flowchart LR
    User["User"] --> Auth["Authorization Service\n(OAuth 2.0 / OIDC)"]
    Auth --> Token["Access Token (JWT)"]
    Token --> ApiClient["ApiClient"]
    ApiClient -->|"401 detected"| Refresh["Token Refresh\n(single-flight)"]
    Refresh --> NewToken["New Access Token"]
    NewToken --> ApiClient
    ApiClient -->|"Refresh failed"| Logout["Force Logout"]
```

Key behaviors:
- **Bearer mode:** Attaches `Authorization: Bearer <token>` header
- **Cookie mode:** Uses `credentials: 'include'` with HttpOnly cookies
- **Single-flight refresh:** Only one refresh request fires at a time (prevents multiple simultaneous 401s)
- **Force logout:** Triggered if token refresh fails or returns 401

---

## Mingo AI (Chat) Architecture

```mermaid
flowchart TD
    User["User Input"] --> SendMsg["useMingoDialog.sendMessage()"]
    SendMsg --> ChatAPI["/chat/api/v1/messages"]
    ChatAPI --> StreamChunks["Streaming Chunks (SSE/NATS)"]
    StreamChunks --> Store["MingoMessagesStore (Zustand)"]
    Store --> UI["Chat Message List"]

    Context["MingoContextStore"] --> SendMsg
    Context -.->|"Entity context (device, ticket)"| ChatAPI
```

The Mingo AI system:
- Streams responses via **Server-Sent Events (SSE)** or **NATS WebSocket**
- Maintains per-dialog message state in **Zustand**
- Sends structured **context items** (`{ type, id }`) representing currently viewed entities
- Handles **tool execution** and **approval workflows** via message segments

---

## MeshCentral Integration

The frontend includes a custom binary WebSocket protocol implementation for:
- **Remote Desktop** — binary frame decoding, tile rendering, keyboard/mouse events
- **Remote Shell** — xterm.js terminal connected via WebSocket
- **File Manager** — custom binary protocol for file operations (upload, download, delete)

Located in `src/lib/meshcentral/`.

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Next.js App Router** | Server components, streaming, file-based routing, layout nesting |
| **Relay for GraphQL streaming** | Optimal for logs/notifications with large datasets and cursor pagination |
| **TanStack Query for REST** | Better DX for REST APIs, optimistic mutations, refetch controls |
| **Zustand over Redux** | Minimal boilerplate, TypeScript-native, no provider nesting |
| **Biome over Prettier** | Significantly faster, single tool for lint + format |
| **Domain-based file organization** | Scales well, co-locates everything related to a feature |
| **Single ApiClient** | Centralized auth, error handling, and base URL resolution |

---

## Reference Documentation

For deeper dives into specific subsystems, see the generated reference docs:

- [openframe-oss-frontend reference](./reference/architecture/openframe-oss-frontend/openframe-oss-frontend.md)
- [frontend-core reference](./reference/architecture/frontend-core/frontend-core.md)
- [gateway-service-core reference](./reference/architecture/gateway-service-core/gateway-service-core.md)
