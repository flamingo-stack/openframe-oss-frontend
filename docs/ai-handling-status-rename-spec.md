# Rename "AI Assistance" system status to "AI-Handling" — BE spec

> **Scope.** Display-name rename of the `AI_ASSISTANCE` system ticket status to **"AI-Handling"**
> across seeds, tenant data, and any backend-authored copy that names the status.
> ClickUp: [86ak3dvzt](https://app.clickup.com/t/86ak3dvzt) (parent: 86ajn8hmp).
>
> **Repos touched by this spec:** `openframe-oss-lib` (Java data/seed/migration modules),
> `openframe-saas-tenant` → `openframe-saas-ai-agent` (comments/prompt text only).
> Frontend/core-lib label work is a separate task (summarized in §6 for rollout ordering only).

---

## 0. Architecture decision this spec encodes

**The rename is display-level only. The wire/storage token `AI_ASSISTANCE` does NOT change.**

`TicketStatusKind.AI_ASSISTANCE` is load-bearing far beyond the label:

- persisted in Mongo on every ticket (`tickets.statusKind`) and in `ticket_statuses.kind`,
  including the unique index `tenant_kind_unique` partial filter
  (`openframe-data-mongo-common .../ticket/TicketStatusDefinition.java`);
- a value of the `/chat/graphql` enum `TicketStatusKind`
  (`openframe-saas-ai-agent src/main/resources/schema/ticket.graphqls`);
- carried in chat-protocol events (`targetStatusKind` on the REOPENED TICKET_EVENT) consumed by
  three frontends (admin FE, client chat, core-lib chat components);
- baked into FE alias maps, legacy-status mappings, and localStorage board caches.

Renaming the token would require a coordinated breaking deploy across BE + 3 frontends + a data
migration of every ticket document, for zero additional user-visible value. So: **token stays,
`name` changes.** (If a token rename is ever wanted, it is a separate project — not this task.)

**New display name: `AI-Handling`** (hyphenated, per the task title). The current seeded value is
`"AI Assistance"` (no hyphen) — `TicketStatusSeedCatalog.NAME_AI_ASSISTANCE`.
⚠️ Confirm final spelling ("AI-Handling" vs "AI Handling") with design before merging; every change
below is spelling-agnostic.

---

## 1. Current state (verified in code)

| Fact | Where |
|------|-------|
| System statuses live per tenant in `ticket_statuses`; `TicketStatusDefinition { kind, name, color, position }`; unique `(tenantId, kind)` for the 4 system kinds | `openframe-oss-lib/openframe-data-mongo-common/.../ticket/TicketStatusDefinition.java` |
| Seed name constant `NAME_AI_ASSISTANCE = "AI Assistance"` (color `#B39DDB`) used for new-tenant seeding and the lifecycle migration | `openframe-oss-lib/openframe-data-mongo-sync/.../seed/ticket/TicketStatusSeedCatalog.java:16` |
| Existing tenants got the status via Mongock change unit `migrate-ticket-status-model` (order `003`, currently `runAlways=true` behind the lifecycle flag) | `openframe-oss-lib/openframe-management-service-core/.../migration/MigrateTicketStatusesChangeUnit.java` |
| Tenants **cannot** rename or recolor system statuses — `ensureCustomStatus()` throws `SystemTicketStatusModificationException` | `openframe-saas-ai-agent/.../service/ticket/TicketStatusService.java` (`applyName`/`applyColor`) |
| Status-changed notification copy is `"Moved to {name} by {actor}"` — the **definition name** flows into user-visible notifications | `openframe-saas-ai-agent/.../notification/TicketNotificationDispatcher.java` |
| `ticketStatuses` query returns `{ id, name, color, position, kind, isSystem, systemKey }`; all frontends render board columns, status dropdowns, and detail tags from this `name` | `ticket.graphqls`; FE `GET_TICKET_STATUSES_QUERY` |
| Schema comments name the status in prose ("returns to AI Assistance") | `ticket.graphqls` (requestTicketReopen doc comment) |

Because system-status names are API-immutable, **every tenant currently holds exactly the seeded
name** — a blanket rename keyed on `kind` is safe.

---

## 2. Required changes — `openframe-oss-lib`

### 2.1 Seed catalog (new tenants + lifecycle seeding)

`openframe-data-mongo-sync/.../TicketStatusSeedCatalog.java`:

```java
public static final String NAME_AI_ASSISTANCE = "AI-Handling";   // was "AI Assistance"
```

Constant name (`NAME_AI_ASSISTANCE`) and everything else stays — it is keyed to the kind, not the
label. Color unchanged.

### 2.2 One-shot rename migration (existing tenants)

New Mongock change unit in `openframe-management-service-core` (same package as
`MigrateTicketStatusesChangeUnit`), next free `order`, **one-shot** (`runAlways = false` — unlike
the model migration, this needs no flag gating and must not re-fire):

```java
@ChangeUnit(id = "rename-ai-assistance-status", order = "0XX", author = "openframe")
public class RenameAiAssistanceStatusChangeUnit {

    @Execution
    public void execution(MongoTemplate mongoTemplate, TenantIdProvider tenantIdProvider) {
        Query query = new Query(Criteria.where("tenantId").is(tenantIdProvider.getTenantId())
                .and("kind").is(TicketStatusKind.AI_ASSISTANCE.name())
                .and("name").is("AI Assistance"));               // old seed name → idempotent
        Update update = new Update()
                .set("name", TicketStatusSeedCatalog.NAME_AI_ASSISTANCE)
                .set("updatedAt", Instant.now());
        mongoTemplate.updateMulti(query, update, "ticket_statuses");
    }

    @RollbackExecution
    public void rollback() { }
}
```

Rules encoded above:

- **Match on `kind`, guard on the old `name`.** The kind match is the real selector (unique per
  tenant); the old-name equality makes re-runs and already-renamed rows a no-op and leaves any
  hypothetically diverged row alone (log if the post-migration count for the tenant is 0 AND the
  kind row exists with an unexpected name).
- **Never touch `CUSTOM` rows** — a tenant may legitimately own a custom status with any name.
- **No document-shape change** — `tickets.statusKind` / `statusId` are untouched; nothing else
  denormalizes the name.
- Ordering vs `migrate-ticket-status-model` (`runAlways`, order 003): the rename unit must run
  **after** it in the same run (higher `order` suffices). Ship the §2.1 seed change in the same
  lib release so a re-run of the model migration can no longer re-seed the old name.

### 2.3 Name-collision note

Custom-status names are only uniqueness-checked in the mutation path (`ensureUniqueName`), not by
an index. If a tenant already created a **custom** status literally named "AI-Handling", the rename
produces two rows with the same display name. This does not break anything mechanically (ids/kinds
differ everywhere). Accepted; optionally log a warning when detected. Do not skip the rename for it.

---

## 3. Required changes — `openframe-saas-ai-agent`

No enum, resolver, or persistence changes. Text-level only:

1. `ticket.graphqls` — update prose comments naming the status
   ("a ticket the client closed through the assistant returns to AI Assistance" → "… AI-Handling").
2. AI prompt / tool descriptions (`TicketToolProvider` and any system prompts): they currently
   describe lifecycle buckets by **kind token** (`AI_ASSISTANCE`) — those stay. Grep for the display
   string `"AI Assistance"` and update only human-readable occurrences.
3. Notification copy needs **no change** — `TicketNotificationDispatcher` renders the definition
   `name`, so it emits "Moved to AI-Handling by …" as soon as the data is migrated.

---

## 4. Explicitly out of scope

- **`OpenframeProduct.AI_ASSISTANCE`** (billing product, rendered as "AI Assistant Add-on") — an
  unrelated enum in `/api/graphql`; do **not** touch it or any billing surface.
- The GraphQL enum value `TicketStatusKind.AI_ASSISTANCE`, `tickets.statusKind` values, chat
  protocol `targetStatusKind` tokens, FE alias maps — all stay (decision §0).
- Frontend fallback labels (core-lib `STATUS_CONFIG` / board `STATUS_DEFAULTS`) — separate FE task,
  see §6.
- Copy that describes the **assistant** rather than naming the **status** (e.g. reopen receipt
  "The AI assistant will continue helping you…", tooltips "The AI assistant manages the
  conversation here.") — unchanged unless design says otherwise.

---

## 5. Acceptance criteria

1. New tenant bootstrap seeds the AI system status with `name = "AI-Handling"`.
2. Existing tenants: `ticket_statuses` row with `kind = AI_ASSISTANCE` has `name = "AI-Handling"`;
   custom statuses untouched; re-running migrations is a no-op.
3. `ticketStatuses` via `/chat/graphql` returns the new name; board column header, ticket detail
   status tag, and status dropdowns show "AI-Handling" in admin FE and client chat **without any
   frontend deploy** (names are server-driven).
4. Status-change notification reads "Moved to AI-Handling by …".
5. No change to `kind` values anywhere: GraphQL enum, stored `statusKind`, chat events still say
   `AI_ASSISTANCE`; existing FE/chat builds keep working against the migrated backend.
6. Billing "AI Assistant Add-on" surfaces are unaffected.

---

## 6. Rollout order (cross-repo, for coordination)

| Step | Repo | What | User-visible effect |
|------|------|------|---------------------|
| 1 | `openframe-oss-lib` (Java) | §2 seed + migration, release; management service picks it up and runs the change unit per tenant | Board columns, dropdowns, detail tags, notifications, client chat all show "AI-Handling" — these are all server-driven |
| 2 | `openframe-oss-lib` (`openframe-frontend-core`) | Fallback labels `'AI Assistance'` → `'AI-Handling'` in `ticket-status-tag.tsx` `STATUS_CONFIG` and `board/types.ts` `STATUS_DEFAULTS`; stories/docs sweep; publish | Fixes the only surfaces not fed by BE data: dashboard ticket-stat card (`<TicketStatusTag status="AI_ASSISTANCE" />`) and the cold-profile board skeleton |
| 3 | `openframe-oss-frontend` + `clients/openframe-chat` | Bump `@flamingo-stack/openframe-frontend-core`; docs sweep | Lib fallbacks live everywhere |

There is **no hard deploy coupling**: an old frontend against the migrated backend already shows the
new name everywhere except the two lib-fallback surfaces in step 2, which lag until the bump.
LocalStorage board-column caches self-heal on the first statuses fetch.
