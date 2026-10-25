# Architecture

The entry point delegates to `src/bootstrap.js`. The core has separate modules for each responsibility rather than a single large plugin handler.

| Area                                          | Responsibility                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/core/config/`                            | Environment, defaults, split YAML loading, schema validation, guild directory               |
| `src/core/plugins/`                           | Files, guild scope, export validation, indexes, lifecycle, cache cleanup, watching, loading |
| `src/core/interactions/`                      | Routing, permission checks, cooldown execution, safe error responses                        |
| `src/core/registration/`                      | Payload normalization, target scopes, REST queue/retry, scope history                       |
| `src/core/ui/`                                | Shared embed API, theme, message/form structure checks, per-interaction response guards     |
| `src/core/runtime/`                           | Client construction, Gateway/REST errors, shutdown                                          |
| `src/core/logging/`, `health/`                | Diagnostic logging and lightweight runtime counters                                         |
| `src/features/help/`                          | Command catalog, bounded sessions, Components V2 view, navigation actions                   |
| `src/features/feedback/`                      | Form construction and destination delivery                                                  |
| `src/features/calendar/`                      | Timezone-explicit date validation and native scheduled-event creation                       |
| `src/features/voice/`                         | Persistent ownership registry, serial voice transitions, room creation and reconciliation   |
| `src/features/profiles/`, `polls/`, `system/` | Reusable profile, poll, and owner views/actions                                             |
| `src/services/economy/`                       | Serialized persistence, user normalization, job definitions API                             |

Public plugin exports retain the familiar CommonJS `data` / `name` / `customId` plus `execute()` structure. Existing command rules, game mechanics, balances, and personal guild automation are retained. Guild-dependent commands now explicitly declare their server-only execution context.

UI validation is performed before outgoing reply/update/modal SDK calls, including interactions later handled by message collectors. It does not modify SDK prototypes, suppress Discord API errors, or replace command-specific permission logic. Direct sends use `client.ui.message()` or a notice helper to apply the same style and validation. Native V2/poll payloads keep their own presentation.

The reported help bug was caused by using the destination page as the complete identity of a navigation control. With one page, Previous and Next both targeted zero and therefore had identical custom IDs. Actions now have independent identifiers; tests validate all generated IDs and send a select update through the real SDK response serializer with a local REST double.

No web dashboard, external HTTP service, monetization, or public interaction endpoint is required by this runtime.

The larger built-ins separate entry points from feature code: blackjack has cards, table view, and play flow; job browsing has a dedicated view; giveaways separate platform matching, rendering, polling, and the timer event. Development scripts, templates, and tests share `tools/`, while human-readable guides and reports share `docs/`.

The interaction guard formats replies before validating them. It is installed per incoming interaction, including collector-owned controls. `src/shared/collectors.js` adds an explicit queue and error boundary to local callbacks; SDK prototypes and global event emitters are not patched.
