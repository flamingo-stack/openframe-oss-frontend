# Script Schedules — GraphQL Backend Gaps

Live status of what the OpenFrame GraphQL API (`/api/graphql`) does and does not
offer the Script Schedules pages (list, details, create/edit, edit-devices, run
details). Each **OPEN** item is backend work that would light up UI that is
otherwise ready; each **DELIVERED** item records what shipped and where the
frontend consumes it, because the shape that landed rarely matched the ask.

> Referenced from code comments (`script-schedules-table.tsx`,
> `edit-schedule-page.tsx`, the two spec docs next to it), so it lives at this
> path on purpose. The docs reorganisation in #97 removed it; it is back because
> those references are load-bearing and nothing in the new `docs/` layout took
> over the role.

## 1. Schedule timing & repeat — **DELIVERED**

`ScriptSchedule` carries `trigger` (`DATE_TIME` | `DEVICE_ONLINE`), `startAt`
(Instant, on a 30-minute boundary — required for `DATE_TIME`, null for
`DEVICE_ONLINE`), `repeat` (seconds), `nextRunAt` and `lastRunAt`; both inputs
write them. Frontend: `schedule-timing.ts` + the timing block of
`edit-schedule-page.tsx`.

Still open, both minor:

- **No `startAt` sort**, so the DATE & TIME column cannot be sorted.
- **No date-range filter** on `ScriptScheduleFilterInput` (`ScheduleRunFilterInput`
  has `dispatchedAtFrom`/`dispatchedAtTo`; the schedules list has no equivalent),
  so the logs-style date filter cannot be offered on the list.

Note for the UI, not the backend: `repeat` is seconds, but the form's unit
dropdown starts at Hour, so a sub-hour cadence authored elsewhere can only be
DISPLAYED rounded. `resolveRepeatSeconds` preserves the stored value unless the
user actually changes the recurrence.

## 2. `assignedDevices` resolver — **DELIVERED** (was a 504 hang)

The field is now a Relay `DeviceConnection` with `filter` / `search` / `sort` /
pagination, and it resolves. The original bug (two chained DataLoaders, batches
never dispatched, request dying at the LB timeout) is fixed.

Still open: **`Machine.organization` fans out one lookup per machine.** The
assigned-devices tab and the picker both select it (CUSTOMER is a column), which
is the first thing to suspect if these pages start timing out again. The fix is
a batched org resolver, not dropping the column.

## 3. Per-script overrides inside a schedule — **OPEN**

The legacy model stored per-action `timeout`, `script_args`, `env_vars`.
`CreateScriptScheduleInput` / `UpdateScriptScheduleInput` still take bare
`scriptIds`, so a schedule cannot override anything per script — every script
runs with its own defaults.

The edit form already renders these fields per script card (seeded from the
script's defaults) and **drops them on submit**; see the `TODO(backend)` in
`edit-schedule-page.tsx`. The input needs
`scriptEntries: [{ scriptId, timeoutSeconds, args, envVars }]`, and the type a
matching read shape.

## 4. Execution history & runs — **DELIVERED**

`scheduleExecutions(scheduleId:)` + `scheduleExecutionFilters(scheduleId:)`
(Option A of `script-schedules-v2-execution-history-spec.md`, under different
names than proposed), `ScriptExecutionFilterInput.dispatchedAtFrom`/`To`, and
`scheduleRuns(scheduleId:)` for the aggregate one-row-per-fire view.

Still open: **no `executionIds` filter on `ScriptExecutionFilterInput`.** The
run-details page therefore scopes its list by passing the run's `executionId`
through `search` — which assumes `scheduleExecutions(search:)` matches that
field. If it only matches machine/script text, the drill-down returns nothing
and the filter is needed.

## 5. Enable / pause toggle — **OPEN**

Legacy schedules had `enabled: boolean`; the model has only
`status: ACTIVE | ARCHIVED | DELETED`. Pausing a schedule without archiving it
is still not expressible.

## 6. Device assignment — **DELIVERED**

Incremental, and server-resolved in bulk:

- `addDevicesToSchedule(scheduleId, machineIds)` / `removeDevicesFromSchedule(...)`
  — idempotent deltas; OS mismatches rejected.
- `addAllDevicesToSchedule(scheduleId, filter, search)` /
  `removeAllDevicesFromSchedule(...)` — the set is resolved on the server from
  the same narrowing the list shows, so "all" means all rather than "all the
  ones paged in".
- `availableDevicesForSchedule(scheduleId, ...)` — the candidate list, already
  scoped to the schedule's `supportedPlatforms`.

This replaced `setScriptScheduleDevices`, whose replace-all shape meant the
editor had to hold the entire assignment or delete the part it never read.
Frontend: `schedule-devices-view.tsx` + `DeviceSelector`'s `server` contract.

Undocumented in the schema and worth confirming: **does
`availableDevicesForSchedule` exclude already-assigned devices?** The picker is
written not to care (every row offers add; the mutation is idempotent), but the
answer decides whether the Available tab should hide what is already assigned.

## 7. Criteria targeting — **DELIVERED (backend only)**

`ScriptSchedule.selectionMode` (`SPECIFIC` | `CRITERIA`),
`ScriptSchedule.deviceCriteria` and `setScheduleDeviceCriteria(scheduleId, criteria)`
with `ScheduleDeviceCriteriaInput { organizationIds, deviceTypes, osTypes }`.
Membership resolves live, so devices registered later that match are included
automatically.

**Not built in the UI yet** — the "Select Devices by Criteria" option in the
picker's mode block is still rendered disabled with a "Coming Soon" tag
(`device-selector.tsx`). This is now a frontend task, not a backend gap.

## 8. Sorting & search (minor) — **PARTLY DELIVERED**

- `scriptSchedules(sort:)` accepts `_id`, `name`, `createdAt`, `updatedAt`,
  `repeat` and `deviceCount`. The UI offers only REPEAT and clamps `?sortBy` to
  that, so a stale link cannot reach `SortInput.field` with anything else.
- Still no `statusChangedAt`, so the archive page cannot sort "recently archived
  first".
- `search` is a name-only substring match; the list also shows `description`,
  which is not searched.

## 9. `deviceCount` returns null for a non-null field — **BROKEN, frontend worked around**

`ScriptSchedule.deviceCount` is declared `Int!` and its resolver returns `null`.
GraphQL then nulls the parent, and because `node`, `edges` and the connection
are all non-null too, the violation bubbles until the entire payload is null:

```
No data returned for operation `scriptSchedulesTableRelayQuery`
The field at path '/scriptSchedules/edges[0]/node/deviceCount' was declared as a
non null type, but the code involved in retrieving data has wrongly returned a
null value. The non-nullable type is 'Int' within parent type 'ScriptSchedule'
```

One bad count therefore empties the whole schedules list — and would do the same
to the details page, the assigned-devices tab, the device picker and every
assignment mutation, all of which selected the field. Nothing on the client can
salvage it: the response arrives with `data: null`, so there is no partial
result for Relay to read (`@catch` included).

The contract did not change (`Int!` before and after the QA schema refresh), so
this is the resolver regressing. Prime suspect, unverified: the release that
added `selectionMode` / `deviceCriteria` — a CRITERIA schedule's count has to be
resolved by evaluating the rule, and legacy rows read as SPECIFIC.

**Frontend workaround, to be reverted when the resolver is fixed:** the field is
selected NOWHERE. Every site carries a comment pointing here.

| Consumer | Now reads |
|---|---|
| Schedules list, DEVICES column | nothing — renders `—` |
| Picker, "Selected Devices (N)" | `assignedDevices.filteredCount` (same number when nothing is narrowed) |
| Assignment mutations | `id` only; the picker re-reads the list after each commit |
| Detail / assigned-devices queries | dropped (nothing read it) |

Restoring it is a matter of putting `deviceCount` back in those selections and
undoing the two substitutions above.
