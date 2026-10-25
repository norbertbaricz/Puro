# Upgrade to Puro 3.1

1. Stop your running bot and keep its current folder as a backup.
2. Extract Puro 3.1 into a **new folder**. Do not merge it over the previous source tree: retired handlers could otherwise remain active.
3. Copy your current `.env`, configured economy database (normally `database.json`), and current `data/` folder into the new project. These live files take priority over sample data in the archive.
4. If present, copy `.runtime/command-scopes.json` too, so obsolete command scopes can be removed correctly.
5. Install Node.js 26.12.1+ and npm 12.2.1+, then run `npm ci` in the new folder. Do not copy the old `node_modules` directory.
6. Configure your owner ID and server mappings. The supplied source keeps the previous The Lunar Pack mapping.
7. Run `npm run verify`, and then `npm start`.
8. On Discord, start a **new `/help` session**. Old session IDs expire and do not carry over to a restarted process.

The `.env` names `TOKEN` and `clientId` remain supported. `DISCORD_TOKEN`, `CLIENT_ID`, and `APPLICATION_ID` aliases also work. Database locations and user-record formats are unchanged.

The old long `config.yml` remains readable as an override. You may copy it initially to preserve local custom text, then move its per-command values gradually into `config/commands/`. Copying a complete old config overrides corresponding split-file values; remove a root-level override when you want the split file to take effect.

The previous temporary-voice handler stored its room IDs only in memory. Rooms created before the upgrade are not inferred from their names; clean up or recreate those rooms manually. Puro 3 persists new room tracking. If copying the old complete configuration, set `events.voiceConnect.lobby_channel_id` explicitly: the old blank value used a hard-coded fallback, while a blank value now disables creation.

The old `lib/` implementation has moved to `src/`. Included commands already use their new imports. For private custom commands, update helper imports as needed:

| Old helper                         | New location                                    |
| ---------------------------------- | ----------------------------------------------- |
| `lib/economy.js`                   | `src/services/economy/store.js`                 |
| `lib/jobs.js`                      | `src/services/economy/jobs.js`                  |
| `lib/utils.js`                     | `src/shared/utils.js`                           |
| `lib/interactionSafety.js`         | `src/core/interactions/safety.js`               |
| `lib/logger.js`                    | `src/core/logging/logger.js`                    |
| `lib/guildEventState.js`           | `src/services/guild-state.js`                   |
| `lib/guildGreetingEventFactory.js` | `src/features/greetings/createGreetingEvent.js` |

The existing module export style is unchanged. Keep your custom commands in the drop-in folders; restarting is required when changing imported service/helper files under `src/`.

Enable User Install in the Portal before opting into that feature. Configure the feedback destination before testing `/feedback`. The native calendar command requires Create Events permissions. Voice features still need suitable channel permissions and working network connectivity.

## Changes from 3.0

Command categories now use lowercase folder names. `templates/`, `tests/`, and `scripts/` are grouped under `tools/`; changelog and verification reports live under `docs/`. Avoid overlaying 3.0 source files, especially on a case-sensitive filesystem, because both old and new command paths could remain. The command names on Discord and the export contract are unchanged.

Preserve your current `config.yml` if it contains local customization. New UI defaults merge automatically when keys are absent; add `ui.footer`, `ui.timestamps`, and `ui.auto_embeds` when you want to override them. Do not copy an old package.json or package-lock.json over the new files.

Ordinary interaction text now becomes an embed automatically. Update custom event/channel/DM posts to `client.ui` to use the same style. Add Embed Links permission in those destinations. `/announce` and `/send` now default to embed mode; the explicit plain option remains available. Start new game/help sessions after restarting.
