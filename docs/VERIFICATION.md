# Puro 3.2 verification

Verified on **2026-11-01** with **Node.js 26.13.0 LTS**, **npm 12.2.1**, and **discord.js 14.28.0**.

| Check                | Result                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------- |
| Test suite           | 122 passing tests, zero failures                                                        |
| Offline preflight    | 164 scripts; 61 active modules; zero module errors                                      |
| ESLint               | Zero errors or warnings                                                                 |
| Prettier             | Shared formatting checks pass                                                           |
| Clean installation   | `npm ci` and `npm run verify` pass from a fresh source folder                           |
| npm audit            | Zero vulnerabilities, including development dependencies                                |
| Stable-version check | All direct dependencies, pinned overrides, Node, and npm match stable registry releases |

The active modules comprise 51 commands, 7 events, and 3 persistent component handlers. The tests do not use live Discord credentials or user databases.

## Exact versions

| Package or tool           | Version     |
| ------------------------- | ----------- |
| Node.js                   | 26.13.0 LTS |
| npm                       | 12.2.1      |
| discord.js                | 14.28.0     |
| @discordjs/voice          | 0.19.2      |
| @snazzah/davey            | 0.1.12      |
| Axios                     | 1.21.0      |
| chokidar                  | 6.0.0       |
| dotenv                    | 18.0.9      |
| js-yaml                   | 5.5.0       |
| @eslint/js                | 10.0.1      |
| ESLint                    | 10.14.0     |
| globals                   | 17.13.0     |
| Prettier                  | 3.9.10      |
| minimatch override        | 11.0.3      |
| follow-redirects override | 1.16.2      |

The minimatch override supplies the patched implementation to lint tooling; compatibility was checked both by linting the source and by confirming that an intentional undefined identifier is still detected. The redirect override supplies the patched dependency used by Axios. Production dependency versions remain exact, and installs use the lockfile.

## Coverage added in this release

- The installed Discord SDK serializes a Custom status with the exact text `Made by Skypixel Framework` into a Gateway presence packet. Rotation, deduplication, timer cleanup, and text limits are checked.
- Deferred component failures produce private follow-ups without overwriting a public game. Deferred V2 updates keep V2 presentation. Missing command targets still receive an error response.
- Related message/button collectors process session mutations through one queue. Normal deleted-response outcomes are contained; permission failures remain reported.
- Initial identity rendering is awaited; rating and joke reroll failures remain inside the asynchronous error boundary.
- Actual included command implementations are exercised with offline interactions and the real SDK message serializer. Tests include first renders, failed animations, job application/resignation, thread permissions, nickname bounds, malformed guesses, and expired hints.
- A failed replacement file metadata read preserves the previous live event listener. One guild's ready failure does not block another guild or consume a failed guild's retry.
- Version selection excludes alpha, beta, preview, and nightly strings even when a registry latest tag points at one.

Existing help duplicate-ID, voice-room ownership, atomic persistence, schema synchronization, watcher, cache, cooldown, permission, and modern UI regression coverage remains in place.

## Practical limits

No live Discord login, channel posts, DMs, voice connections, or soundboard actions were performed. Offline checks cannot establish the exact cause of an error seen only on an operator's server without its stack trace. Real channel permissions, external service availability, gateway connectivity, and Discord client appearance should be checked after startup. Keep the full error and action details when reporting a remaining issue.

Official references: [Node.js 26.13.0](https://nodejs.org/en/blog/release/v26.13.0), [discord.js 14.28.0](https://github.com/discordjs/discord.js/releases/tag/14.28.0), [Gateway activities](https://docs.discord.com/developers/events/gateway-events#activity-object), [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249), [redirect advisory](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p).
