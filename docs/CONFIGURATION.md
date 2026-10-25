# Configuration

`config.yml` contains the main settings. Command messages and settings live in `config/commands/<name>.yml`, event settings in `config/events/<name>.yml`, and server mappings/automations in `config/guilds/<slug>.yml`.

A command file is optional. A new command can read its settings through `interaction.client.config.commands.<name>`. For example, `config/commands/hello.yml` becomes `client.config.commands.hello`.

Guild files use:

```yaml
guild:
    name: My server
    id: '1217588804328620163'
    slug: my-server
events: {}
```

The file's basename supplies the slug when omitted. Existing The Lunar Pack IDs and configuration are included. Change them when using another server. Guild aliases and extra IDs use arrays named `aliases` and `ids`.

The loader merges built-in defaults, split settings, and finally `config.yml`. Old complete configurations therefore still work as overrides. Invalid YAML or invalid required settings keep the running configuration and produce a diagnostic. Valid edits reload automatically. Healthy ordinary command instances stay intact when only their messages/settings change; affected ready tasks are refreshed.

## Restart requirements

Restart for Gateway intents, cache limits, database settings, watcher settings, environment variables, package changes, `src/` helpers, or economy job data. Owner IDs can be changed live. Presence settings and guild scopes are refreshed live. A batch of settings saves triggers one configuration reload.

`config/jobs/` contains one JSON object per economy job. `index.json` preserves the original display order; additional files appear after the listed jobs. These are data definitions rather than command files and require a restart.

## Features

- **UI:** `ui.accent`, `ui.footer`, `ui.timestamps`, `ui.auto_embeds`, `ui.help_page_size` (1–10), `ui.session_minutes`, `ui.max_sessions`, `ui.validate_payloads`.
- **Feedback:** set `features.feedback.channel_id` to the destination channel's quoted ID. Grant View Channel, Send Messages, Embed Links, and Attach Files there. `max_file_bytes` limits optional uploads. No feedback is claimed delivered before a successful channel send.
- **Calendar:** `features.scheduled_events.enabled` controls `/event`. Dates need an explicit timezone, for example `2026-10-26T19:00+02:00`; the start must be at least one minute ahead.
- **User installs:** enable User Install in the Developer Portal, then set `features.user_install.enabled: true`. Only commands explicitly marked `portable: true` receive User Install and Private Channel contexts. Included portable actions are `/avatar` and View avatar. Do not expose server moderation commands through this flag.

## Temporary voice

`config/events/voiceConnect.yml` contains the lobby ID, bitrate, member limit, name pattern, and creation cooldown. The previously hard-coded lobby is now explicit in this file; an empty ID disables new room creation. Grant View Channel, Connect, Manage Channels, and Move Members in the lobby/category.

Puro records newly created room IDs and ownership in `data/guild-event-state.json`, with the creating bot's ID. Startup restores these records. Cleanup applies only to tracked voice channels belonging to this bot, never to the configured lobby or untracked channels. Bots do not receive ownership; bot-only rooms are cleaned up. Incomplete participant caches postpone cleanup instead of treating missing member data as an empty room. Name changes are throttled to avoid Discord's slow channel-name rate limit.

## Discord registration

Global mode is the default. For development, use `api.registration: guild` and a quoted `api.guild_id`. Puro coalesces saves and skips REST overwrites when schemas are unchanged. Temporary failures retry; permission/schema errors are reported for correction.

Puro manages the application's complete global command list and its configured guild command scopes. Bulk overwrite replaces other commands in those same scopes. Switching to guild mode clears the global list to avoid duplicate/stale global entries. Keep `.runtime/command-scopes.json` when changing hosting or modes so removed scopes can be cleared after restart.

## Data and diagnostics

The default economy path remains `database.json`; configure it under `database.path`. Writes are serialized through temporary files and atomic rename. Unchanged reads/polls skip file replacement, and loaded state is served from memory. Failed mutations do not change cached balances. Invalid data is backed up before repair when automatic repair is enabled. Use one running bot process per JSON data directory.

Keep `.env`, the configured economy database, and `data/` outside source control. Back up these files separately from source archives. `logs/puro.log` holds bounded diagnostic logs, with one rotated backup. The framework logger redacts environment secrets and interaction/webhook tokens in known URL forms; collector callbacks also have a shared error boundary. Some legacy command-specific logs still use the console.

## Message style and development tools

Ordinary interaction responses become embeds by default. Channel/DM sends and custom event replies use `client.ui`. See [Messages](MESSAGES.md) for the complete API. UI settings reload live. Grant Embed Links in posting destinations. `/announce` and `/send` default to embed mode; plain mode must be chosen explicitly.

The runtime minimum, pinned npm version, and exact dependency declarations are in `package.json`; `.node-version` selects the tested Node Current release. `npm run deps:check` reads the registry without changing files. `npm run format` applies the common source format; `npm run verify` includes a format check.
