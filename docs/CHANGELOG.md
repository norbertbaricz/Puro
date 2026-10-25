# 3.1.0 — 2026-10-25

- Added one configurable embed style for ordinary interaction replies, errors, channel posts, DMs, greetings, and forum/thread starter messages; native Components V2 views and polls keep their presentation.
- Added the public `client.ui` API, live footer/accent settings, safe long-text splitting, preservation of existing media/fields/attribution, and per-field embed validation.
- Changed `/announce` and `/send` to default to embed mode, retaining explicit plain mode and requested announcement mention notifications.
- Serialized collector callbacks and their completion handlers; captured asynchronous failures and rejected queued confirmations after closure.
- Fixed blackjack double-click charging, expired-action charging, and refund handling when the initial table cannot be delivered.
- Split blackjack cards/view/play, job views, and giveaway filtering/view/polling from plugin entry points; job menus paginate beyond 25 jobs.
- Consolidated development files under `tools/`, reports under `docs/`, and command categories under lowercase names; added a English project map and shared formatting checks.
- Updated the tested runtime to Node.js 26.12.1 and npm 12.2.1, pinned direct dependencies, and added a read-only latest-version check.
- Removed an extra user fetch and unsupported invite attribution, bounded/cached optional hardware probes, added a missing joke API timeout, and handled invalid giveaway publication dates.

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2026-10-25

### Rebuilt

- Split startup, plugin lifecycle, configuration, routing, REST synchronization, and UI validation into focused modules under `src/core/`.
- Replaced the large root configuration with a small runtime file and per-command, per-event, per-guild, and per-job data files; preserved the original command and job data.
- Moved reusable business services and shared helpers into `src/services/` and `src/features/`.

### Fixed

- Corrected duplicate help navigation custom IDs, including single-page categories and disabled controls.
- Added outgoing payload checks and a regression test using the actual Discord SDK select-menu update path.
- Added CommonJS parent-cache cleanup so repeated hot reloads do not retain obsolete command exports.
- Kept healthy command instances during settings-only reloads; coalesced batches of YAML changes and handled removals before additions.
- Declared server contexts for guild-dependent commands and improved action/file labels in error diagnostics.
- Rebuilt temporary voice around persistent bot-owned room tracking, ordered state transitions, human ownership, startup reconciliation, safe creation rollback, and name-change throttling.
- Made guild-state read failures explicit, preserved corrupted data, and skipped unchanged JSON replacements in both stores.

### Added

- Components V2 help browser, native media-gallery avatars, user/message context actions, and poll result summaries.
- Feedback forms with native radio buttons, file uploads, and checkbox consent, with validated destination delivery.
- Native Discord calendar creation with explicit timezone/date validation.
- Owner-only `/system` controls and opt-in user-install contexts for explicitly portable commands.
- Migration and architecture guides and additional regression coverage.

### Dependencies

- Confirmed current stable discord.js 14.27.0 and voice 0.19.2.
- Updated dotenv to 18.0.9 and js-yaml to 5.5.0.

## [2.0.0] - 2026-10-25

### Added

- Drop-in command, event, button, select-menu, and modal files with automatic JS/CJS loading, editing, deletion, and nested-folder support.
- Last-working-version retention for invalid edits, duplicate validation, guarded asynchronous events, ready-task cleanup, and offline preflight checks.
- Discord command synchronization that skips unchanged schemas, coalesces saves, retries temporary errors, and cleans obsolete guild scopes.
- Context-menu routing, optional user-install/context templates, native `/poll`, Components V2 `/ping`, and owner-only `/diagnostics`.
- Working command/event/component templates, environment example, modern Node requirements, and automated regression coverage.

### Changed

- Upgraded discord.js to 14.27.0 and voice to 0.19.2; updated compatible dependencies and the lockfile.
- Configurable Gateway intents, bounded message caching, live YAML configuration, structured diagnostic logs, and explicit restart-only settings.
- Atomic economy and guild-state writes, consistent database paths, and rollback of aborted economy mutations.
- Preserved The Lunar Pack automations and moved voice-follow IDs into configuration.
- Updated Windows startup and replaced stale documentation with the actual implemented behavior.

### Removed

- Bot premium tiers, paid-access checks, unused premium logging settings, global event-emitter monkey patching, and full-process plugin reloads through nodemon.

## [1.2.16] - 2026-01-31

### Added

- Added `howl-greeting` command and greeting message event for The Lunar Pack.
- Added guild event logging (bans, channels, emojis, roles, messages, voice states).
- Added `bellyrub` command with GIF support and custom responses.
- Implemented sharding support and updated start script.

### Fixed

- Fixed stale interaction handling in `interactionCreate`.
- Fixed interaction defer errors in `bellyrub` and `fetch-e621`.

### Removed

- Removed unused dependencies from `package.json`.
- Removed sharding support and related configurations (after rollout adjustments).
- Removed `howl-greeting.js` and `greetingMessageCreate.js` from The Lunar Pack.
