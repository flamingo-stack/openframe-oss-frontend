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

Notes for the UI, not the backend:

**No start in the past.** The date picker opens at today (`fromDate`), the Time
dropdown drops the slots of today that have already gone by, and the form schema
catches what neither can — a form left open long enough for its own slot to
pass. The rule lives in `utils/schedule-timing.ts` (`startOfToday`,
`getTimeSlotOptions(forDate)`, `isScheduleStartInPast`). One deliberate
exemption: a schedule ALREADY stored with a past start keeps it and saves
untouched (`startAtStored` in the form schema) — recurring schedules legitimately
started long ago, and without it renaming one would demand re-picking its date.
Changing the date or the time drops the exemption.

`repeat` is seconds, and the form's unit dropdown now goes down to Minute with a
floor of 30 — one slot of the runner's grid, so the finest cadence the backend
accepts is also the finest the form can author. Minute intervals are constrained to multiples of 30 (stepper + schema
rule); every coarser unit is a whole number of slots at any interval. Anything
off the minute grid entirely can still only be DISPLAYED rounded, and
`resolveRepeatSeconds` preserves the stored value unless the user actually
changes the recurrence.

## 2. `assignedDevices` resolver — **DELIVERED** (was a 504 hang)

The field is now a Relay `DeviceConnection` with `filter` / `search` / `sort` /
pagination, and it resolves. The original bug (two chained DataLoaders, batches
never dispatched, request dying at the LB timeout) is fixed.

Still open: **`Machine.organization` fans out one lookup per machine.** The
assigned-devices tab and the picker both select it (CUSTOMER is a column), which
is the first thing to suspect if these pages start timing out again. The fix is
a batched org resolver, not dropping the column.

## 3. Per-script overrides inside a schedule — **MOSTLY DELIVERED** (timeout still open)

The legacy model stored per-action `timeout`, `script_args`, `env_vars`. Two of
the three landed in the 2026-08-04 refresh, under a different shape than the
`scriptEntries` originally asked for:

- `ScriptSchedule.scriptCustomParams: [ScheduledScriptCustomParams!]!` — the read
  side, **sparse**: an entry exists only for a script the user customised.
- `scriptCustomParams: [ScheduledScriptCustomParamsInput!]` on both write inputs,
  `{ scriptId, args, envVars }`. PUT semantics on update — the array IS the
  stored set, and null/empty clears every override.

Frontend: `utils/schedule-script-params.ts` (the whole model — inheritance,
collection, `secret` preservation), consumed by `edit-schedule.types.ts` (seed),
`use-edit-schedule-form.ts` (submit) and `schedule-script-card.tsx` (the details
page shows what the SCHEDULE runs, not what the script defaults to).

Three properties of the shape that drive that code:

- **Inheritance is per field, not per script.** Both `args` and `envVars` are
  nullable, and null means "inherit this half". So the form writes an override
  only for the half that differs from the script's own default — otherwise
  customising the arguments would freeze a copy of the env vars beside them, and
  a later edit to the script would stop reaching the schedule.
- **The key is `scriptId`, not the run position.** A schedule may run the same
  script twice ("A, B, A"), and there is no per-entry id to hang an override on —
  both occurrences necessarily share one. The form rejects the case where two
  rows of the same script disagree rather than silently keeping one row's values.
- **`ScriptEnvVarInput.secret` is non-null and the form has no control for it.**
  Every pair would go out as `secret: false`, so an override carries the flag over
  from the script's default by variable name; a renamed or added variable has no
  default to inherit and stays non-secret.

**Still open: per-schedule `timeout`.** `ScheduledScriptCustomParamsInput` carries
args and env vars only. The Timeout field is still rendered per script card,
still seeded from the script's `defaultTimeoutSeconds` (which IS what the run
uses) and still dropped on submit — see the `TODO(backend)` in
`use-edit-schedule-form.ts`. One field on the input closes it:
`timeoutSeconds: Int`.

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
- `ScriptSchedule.availableDevices(...)` — the candidate list, already scoped to
  the schedule's `supportedPlatforms`.

This replaced `setScriptScheduleDevices`, whose replace-all shape meant the
editor had to hold the entire assignment or delete the part it never read.
Frontend: `schedule-devices-view.tsx` + `DeviceSelector`'s `server` contract.

**Answered by the 2026-07-29 schema refresh.** The old root-level
`availableDevicesForSchedule(scheduleId:)` is gone, replaced by
`ScriptSchedule.availableDevices` returning an `AvailableDeviceConnection` whose
edges carry `assigned: Boolean!`. So the list does NOT exclude already-assigned
devices — it marks them. Two consequences, both now implemented:

- The Available tab pre-checks assigned rows instead of offering to add what is
  already in, and clicking a checked row removes it.
- §7's criteria preview reads "devices the rule targets", not "devices the rule
  would add" — so re-editing an existing rule no longer risks an empty preview.

**Picker facets, added 2026-08-04.** `ScriptSchedule.assignedDeviceFilters(filter,
search)` and `ScriptSchedule.availableDeviceFilters(filter, search)` return the
same `DeviceFilters` shape as the root `deviceFilters`, resolved over the
schedule's own scoped sets. The picker read the ROOT field until now, which
answered a different question than the lists under it: a Windows-only schedule
was offered "macOS (14)", and filtering by it emptied the list. Frontend:
`hooks/use-schedule-device-filters.ts` — one query with `@include`/`@skip` on the
active tab, since a hook cannot choose between two query documents.

Still open on these two: **`tagKeys` comes back empty** from both (the backend
documents it as "currently always empty for the pickers"), so the picker's tag
chips have nothing to offer. The devices page's own filter panel has them.

## 7. Criteria targeting — **DELIVERED**

`ScriptSchedule.selectionMode` (`SPECIFIC` | `CRITERIA`),
`ScriptSchedule.deviceCriteria` and `setScheduleDeviceCriteria(scheduleId, criteria)`
with `ScheduleDeviceCriteriaInput { organizationIds, deviceTypes, osTypes }`.
Each list is a whitelist — empty means "no constraint on this dimension", and a
device matches when it satisfies every non-empty one. Membership resolves live,
so devices registered later that match are included automatically.

Frontend (design 460:85294): the mode radio in `device-selector.tsx` is now
controllable (`selectionMode` / `onSelectionModeChange`), and `criteriaContent`
replaces the whole bordered picker card — criteria mode has no card, the fields
and the table it previews sit straight on the page.
`schedule-criteria-fields.tsx` is that editor plus its read-only echo on the
details page; the rule model and its mappers are `utils/schedule-criteria.ts`;
the picker page branches on mode.

**"Custom Criteria" cannot be built.** The design puts a fourth, full-width
chip input under the three selects ("Press enter after each criteria"), and
`ScheduleDeviceCriteriaInput` has nowhere to put what it collects — the input is
closed at `{ organizationIds, deviceTypes, osTypes }`, with no tag or free-form
dimension. The field is rendered disabled and tagged "Coming Soon" rather than
dropped, so the gap stays visible. Unblocking it means adding
`tagKeys`/`tagValues` (the shape `DeviceFilterInput` already uses, which would
also let the preview keep answering the rule unchanged) or an explicit
free-term field.

Three notes on how the rest is wired, each a consequence of the schema:

- **The preview is the server's own answer.** `ScheduleDeviceCriteriaInput` is a
  strict subset of `DeviceFilterInput`, so the draft rule goes to the schedule's
  `availableDevices` as its `filter` and the matching devices come back already
  scoped to `supportedPlatforms`. Nothing client-side re-implements the matching,
  and since that field marks assigned devices rather than withholding them (§6),
  the count is what the rule targets.
- **Device types come from the schema, customers and OS from facets.** A rule is
  forward-looking, so offering only the device types some machine currently has
  would make "all servers" unwritable before the first server is enrolled; the
  `DeviceType` enum is enumerable, so it is used directly. `osType` is a
  free-form string and customers are entities, so both still come from
  `deviceFilters` — meaning a customer with no devices yet cannot be
  pre-targeted.
- **Saving is explicit.** Unlike the §6 deltas, the rule is one value the server
  replaces wholesale, and applying it re-points the schedule at a live set — so
  the page's primary action becomes Save Devices instead of Done.

Still open, and the reason the mode is one-way in the UI: see §10.

## 8. Sorting & search (minor) — **PARTLY DELIVERED**

- `scriptSchedules(sort:)` accepts `_id`, `name`, `createdAt`, `updatedAt`,
  `repeat` and `deviceCount`. The UI offers only REPEAT and clamps `?sortBy` to
  that, so a stale link cannot reach `SortInput.field` with anything else.
- Still no `statusChangedAt`, so the archive page cannot sort "recently archived
  first".
- `search` is a name-only substring match; the list also shows `description`,
  which is not searched.

## 9. `deviceCount` returned null for a non-null field — **FIXED, workaround reverted**

`ScriptSchedule.deviceCount` is declared `Int!` and its resolver returned
`null`. GraphQL then nulls the parent, and because `node`, `edges` and the
connection are all non-null too, the violation bubbled until the entire payload
was null:

```
No data returned for operation `scriptSchedulesTableRelayQuery`
The field at path '/scriptSchedules/edges[0]/node/deviceCount' was declared as a
non null type, but the code involved in retrieving data has wrongly returned a
null value. The non-nullable type is 'Int' within parent type 'ScriptSchedule'
```

One bad count therefore emptied the whole schedules list — and would have done
the same to the details page, the assigned-devices tab, the device picker and
every assignment mutation, all of which selected the field. Nothing on the
client could salvage it: the response arrived with `data: null`, so there was no
partial result for Relay to read (`@catch` included).

The frontend worked around it by selecting the field NOWHERE. That workaround is
**reverted**: `deviceCount` is selected again everywhere it belongs, and the two
substitutions it forced are undone.

| Consumer | Reads |
|---|---|
| Schedules list, DEVICES column | `node.deviceCount` |
| Picker, "Selected Devices (N)" | `scriptSchedule.deviceCount` — the whole assignment, not the narrowed `filteredCount` |
| Assignment mutations (4) | `{ id, deviceCount }`, so Relay updates the label and the column from the store with no refetch |
| `setScheduleDeviceCriteria` | `deviceCount` alongside the rule — how many devices it resolves to |
| Detail / assigned-devices queries | `deviceCount` |

**If the resolver regresses, this is the blast radius again** — every one of
those surfaces goes blank, not just the count. The failure is loud and
unmistakable (empty list, `data: null` in the response), so it needs no client
guard; it needs a backend test.

## 10. No way back from CRITERIA to SPECIFIC — **DELIVERED**

`setScheduleDeviceCriteria` switches a schedule to `CRITERIA` and stores its
rule; the 2026-08-04 refresh added the return trip as **`selectionMode` on
`UpdateScriptScheduleInput`** — the second of the two options this section asked
for (the alternative was a dedicated `setScheduleDeviceSelectionMode` mutation).
Its description also settles what the flip does to the data: it "leaves the join
rows/rule untouched; whichever mode is active is what the resolver reads". So a
schedule moved back to SPECIFIC keeps its criteria on file, and the assignment
survives a trip through CRITERIA.

Frontend: `hooks/use-schedule-selection-mode.ts`, wired into the Edit Devices
page. The switch commits **on the radio click**, not behind a Save button, and
that is forced by the observed semantics of `assigned`: on a CRITERIA schedule
`availableDevices` marks every device the RULE matches, not the ones in the
explicit list. Drawing the specific half before the mode lands therefore
pre-checks rows that are not assigned at all — and a click on one of them reads
as "remove" when the user meant "add". Committing first makes the list describe
the thing being edited. Both halves then behave consistently: the page exits
through Done, since every +/− commits as it happens.

The reverse direction stays behind Save Devices — it needs the rule, which the
user is still editing, and `setScheduleDeviceCriteria` carries both.

Both writes mark the schedule record invalid (`invalidateRecord`) so later reads
of any device connection go to the network, and the mode switch also re-reads the
two lists already on screen — invalidation governs the next read, not a query
that is already mounted.

**The mode rides the schedule's full PUT**, which is the one thing to be careful
with here: `updateScriptSchedule` overwrites every writable field and clears the
ones the input omits. So the switch has to send the schedule back unchanged
around that single field — which is why
`script-schedule-devices-settings-relay.ts` selects `scripts { id }` and
`scriptCustomParams` on a page that renders neither. Dropping them would empty
the schedule's recipe as a side effect of a targeting change.

**Observed 2026-08-05, still undocumented in the schema:** on a CRITERIA
schedule, `availableDevices` returns the full platform-scoped fleet (as
documented) but its per-edge `assigned` answers rule membership rather than the
explicit assignment. The UI no longer has to reconcile the two — it switches the
mode first — but the flag's meaning depending on `selectionMode` deserves to be
stated on the field.

Still undocumented, and still not guessed at by the UI: what
`assignedDevices` returns for a CRITERIA schedule — the resolved rule (which
`setScheduleDeviceCriteria`'s own description implies, "resolved live at dispatch
and display time") or a stored list that is no longer what fires. The picker
reads it as the stored list, which is what the specific half edits.

## 11. `scheduleRunFilters.initiators` has no matching filter input — **OPEN**

The 2026-07-29 refresh added `scheduleRunFilters(scheduleId, filter, search)`,
which returns `statuses`, `initiators` and `filteredCount`. `statuses` is wired
to the Status funnel on the Schedule Runs tab, and it is a real improvement over
the enum it replaced: it lists only the states this schedule's runs actually
reached, with live counts.

`initiators` cannot be used. `ScheduleRunFilterInput` is
`{ statuses, dispatchedAtFrom, dispatchedAtTo }` — there is no `initiatorIds`
(or equivalent) to send the selection back in, so an "Executed by" funnel built
from this facet could show options that narrow nothing. The column therefore
still has no filter, and the query does not select the facet.

The fix is one field on the input: `initiatorIds: [ID!]`, matching
`ScriptExecutionFilterInput`, which already has it. The column's `accessorKey`
is already `initiatorId` for exactly this.
