# Puro 3.2 command and event review

Reviewed on **2026-11-01**. All plugin definitions are loaded by the offline preflight. The runtime and affected command/event paths have regression tests using temporary data and local transport doubles.

| Finding                                                                                | Correction                                                                                           |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Initial identity rendering and rating/joke rerolls used detached asynchronous timers   | Awaited delays and renders so failures reach the router or collector error boundary                  |
| Deferred component errors could edit a public game instead of sending a private notice | Track acknowledgement mode and use ephemeral follow-ups after `deferUpdate()`                        |
| Completing a deferred V2 update could introduce legacy embeds                          | Preserve the original message format and render notices as native cards                              |
| Message and button collectors could mutate the same game concurrently                  | Shared collector queues for number guessing and hangman                                              |
| Invalid guesses such as `4abc` were accepted as integers                               | Require a complete safe integer within the configured range; invalid guesses do not consume attempts |
| Expired hint actions could still change state                                          | Acknowledge first and stop when the interaction token has expired                                    |
| Separate number-game timers could finalize the same timeout twice                      | Shared finalization guard and peer collector shutdown                                                |
| Job resignation waited for persistence before acknowledging                            | Defer the update before storage work and finish through an edit                                      |
| User text could exceed Discord message or resource limits                              | Added command option limits, including 32-character nicknames and embed metadata bounds              |
| A requested private thread could silently become public without the needed permission  | Check exact permissions and supported channel types for the requested thread type                    |
| Replacement file metadata could fail after the old event was detached                  | Read replacement metadata before changing the live listener                                          |
| A ready failure in one guild prevented later guilds from initializing                  | Isolate guild initialization errors; mark only successful guilds initialized                         |
| Voice connection error events lacked a local listener                                  | Log and record the connection error locally instead of allowing an unhandled error event             |
| Registry latest pointed to an alpha Node release                                       | Select released semantic versions and reject prerelease runtimes                                     |
| Custom status lacked the requested branding                                            | Send `Made by Skypixel Framework` first and retain it in rotation, including older configurations    |

The review also updated the SDK and supported runtime, applied patched transitive dependencies, and retained the previous command names, plugin folders, economy record format, and server configuration. Existing drop-in files still load through the same contracts. Everything in the project remains in English.

See [VERIFICATION.md](VERIFICATION.md) for test counts and exact versions. Offline tests cannot identify every server-specific failure without its actual log. For a remaining issue, capture the complete error stack, command or event name, and the actions that triggered it. The owner-only `/diagnostics` command and `logs/puro.log` provide framework diagnostics.
