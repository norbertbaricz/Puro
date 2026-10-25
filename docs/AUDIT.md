# Puro 3.1 source review and corrections

Reviewed on **2026-10-25**. The review covered plugin entry points, outgoing messages, component callbacks, configuration, registration/runtime boundaries, selected feature services, persistence behavior, dependency versions, and project layout. Automated preflight checks every JavaScript/CommonJS/ESM source file and loads every active plugin without Discord login.

## Findings addressed

| Finding                                                                                               | Change and verification                                                                                                                         |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary text responses, errors, greetings and DMs used inconsistent presentation                     | Added configurable `client.ui` embeds and automatic styling of ordinary interaction responses; SDK serialization and payload-preservation tests |
| `/announce` and `/send` defaulted to plain output                                                     | Default is embed mode; explicit plain mode retained; announcement notifications keep only explicitly requested mention tokens in content        |
| The UI guard checked combined embed size but omitted individual field/description limits              | Added per-embed title/description, footer/author, field count and field text checks                                                             |
| Async collector callbacks bypassed the command router's error boundary                                | Shared ordered collector callbacks, local diagnostics, and private error notices                                                                |
| Rapid actions could overlap while changing game state or balances                                     | Per-collector queue; closed confirmations do not execute queued actions; regression tests                                                       |
| Blackjack could charge an expired double action or retain a wager after initial table delivery failed | Acknowledge before charging; skip expired actions; refund unplayable initial tables; settle a hand once                                         |
| Large job catalogs exceeded Discord's 25-select-option limit                                          | Paginated job view with unique navigation IDs; 51-job regression                                                                                |
| Giveaway cards failed on invalid publication dates                                                    | Valid timestamp fallback and bounded source text; rendering regression                                                                          |
| User information fetched the same user twice and inferred an inviter from unrelated invite counters   | Reuse the fetched user; display that invite attribution was not recorded                                                                        |
| Server presence displayed zeroes when the presence intent was absent                                  | Explicit unavailable state; verification level zero is retained correctly                                                                       |
| Optional hardware commands could run repeatedly without a timeout                                     | Separate cached probes with bounded duration and no shell pipeline                                                                              |
| Joke API requests lacked a timeout                                                                    | Added a 10-second request timeout                                                                                                               |
| Large plugin files mixed declaration, rendering and feature behavior                                  | Split blackjack, job view and giveaway services into named responsibilities                                                                     |
| Development folders/reports and naming styles were scattered                                          | Consolidated `tools/`, moved reports to `docs/`, lowercase command folders, shared formatting, English project map                              |
| Runtime selection allowed older releases despite the current-version goal                             | Pinned Node 26.12.1 / npm 12.2.1, exact direct dependencies, shared runtime checks, read-only latest-version check                              |

## Preserved behavior and data

The command names, export contract, economy record format, bet payout rules, server mappings, original messages/settings, job definitions and job order are preserved. The 66 split configuration/job files were compared semantically with the previous source checkpoint. Persistent guild state was not changed.

Existing help duplicate-ID and temporary-voice regression coverage remains in place. Hot reload keeps the last valid implementation after an invalid save. New shared UI settings merge into old configurations when absent.

## Evidence and practical limits

See [VERIFICATION.md](VERIFICATION.md) for test counts, exact versions, and check results. The tests exercise real SDK payload serialization with local transport doubles; they do not prove live permissions, service availability, or the final appearance in every Discord client. After migration, start fresh sessions and check `/help`, an announcement, an event greeting, a DM, and a temporary voice room on your server.

This update does not change running bot files on your computer. Install the archive into a fresh folder, copy your current live configuration/data as described in [MIGRATION.md](MIGRATION.md), and run the verification before starting.
