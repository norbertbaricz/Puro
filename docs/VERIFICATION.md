# Puro 3.1 verification

Verified locally on **2026-10-25** using **Node.js 26.12.1** and **npm 12.2.1**.

| Check                  | Result                                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `npm test`             | 93 passed, zero failures                                                                                  |
| `npm run check`        | 158 scripts checked; 61 active modules; zero module errors                                                |
| `npm run lint:check`   | Zero errors or warnings                                                                                   |
| `npm run format:check` | All matched files use the shared format                                                                   |
| `npm audit`            | Zero reported vulnerabilities, including development dependencies                                         |
| `npm run deps:check`   | All 11 direct dependencies/dev dependencies and both runtime tools match current stable registry versions |
| Package / lockfile     | Matching version, dependencies, development dependencies, and engines                                     |

The 61 active modules comprise 51 commands, 7 events, and 3 component handlers. Eleven copyable templates live under `tools/templates/`.

## Tested dependency versions

| Package          | Version |
| ---------------- | ------- |
| discord.js       | 14.27.0 |
| @discordjs/voice | 0.19.2  |
| @snazzah/davey   | 0.1.12  |
| axios            | 1.20.0  |
| chokidar         | 6.0.0   |
| dotenv           | 18.0.9  |
| js-yaml          | 5.5.0   |
| @eslint/js       | 10.0.1  |
| eslint           | 10.13.0 |
| globals          | 17.13.0 |
| prettier         | 3.9.10  |

Node uses the Current release line requested for this update; the SDK remains on its latest stable release. Discord REST registration uses API v10. Exact package versions and the lockfile make installs repeatable. `deps:check` performs a read-only registry comparison when checking future updates.

## Runtime coverage

The suite exercises filesystem watching, invalid-save retention, duplicate rejection, module removal, lifecycle cleanup, guild isolation, late guild joins, CommonJS cache cleanup, cooldowns, permissions, autocomplete, error handling, REST synchronization/retries/scope cleanup, settings reloads, atomic persistence, rollback, unchanged-write suppression, credentials validation, modern forms/polls, and temporary voice behavior.

Message tests cover all four response methods, existing custom embeds, nonmutation, files and controls, live styles, explicit plain mode, partial edits, V2 notices, Unicode-safe splitting, field limits, actual SDK attachment serialization, and a real slash interaction with a local REST double. The help regression still checks an actual select interaction update, including disabled controls and one-page categories.

Collector tests cover ordered actions/completion, asynchronous failures, closed confirmations, and the final event reaching an SDK collection limit. Blackjack tests cover deck/ace rules, double-click charging/payout, initial-delivery refunds, and expired actions. Catalog tests cover 51 jobs across 25-option pages and invalid giveaway dates.

All 66 original split configuration/job definition files remain semantically identical to the 3.0 checkpoint. Persistent guild state is unchanged. Tests use temporary data paths and do not authenticate the bot.

## Live verification

No Discord login or live server actions were performed. Verify channel permissions, actual rendered appearance, voice/soundboard connectivity, external API availability, DM privacy settings, and command propagation after configuring the bot on your server.

Official references: [Node 26.12.1](https://nodejs.org/en/blog/release/v26.12.1), [npm 12.2.1](https://github.com/npm/cli/releases/tag/v12.2.1), [discord.js 14.27.0](https://discord.js.org/docs/packages/discord.js/14.27.0), [Discord API](https://docs.discord.com/developers/reference), [components](https://docs.discord.com/developers/components/reference).
