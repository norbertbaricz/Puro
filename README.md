# Puro 3.1

A modular Discord bot by **MaxUltimat3 / Skypixel**. Commands, events, and components load automatically when their files are saved. Existing economy features, games, and server automations are preserved.

## Start

1. Install **Node.js 26.12.1 or newer** from the [Current release line](https://nodejs.org/en/download/current).
2. Update npm with `npm install -g npm@12.2.1`, then run `npm ci` in the project folder.
3. Copy `.env.example` to `.env` and fill in `TOKEN` and `clientId` from the [Discord Developer Portal](https://discord.com/developers/applications).
4. Enable **Server Members Intent** and **Message Content Intent** in the Portal, matching `runtime.intents` in `config.yml`.
5. Install the bot with the `bot` and `applications.commands` scopes. Grant the required permissions, including **Embed Links** in channels where it posts.
6. Run `npm start` or open `Start.bat` on Windows.

**Upgrading:** extract into a new folder and follow [Migration](docs/MIGRATION.md). Keep the current `.env`, economy database, and `data/` folder used by your running bot.

## Where to work

| I want to...                                | Open or add                                   |
| ------------------------------------------- | --------------------------------------------- |
| Add a command                               | `commands/<category>/command.js`              |
| Add an event                                | `events/<category>/event.js`                  |
| Add a button, menu, or form handler         | `components/`                                 |
| Change colors, the footer, or main settings | `config.yml`                                  |
| Change a command's messages                 | `config/commands/<name>.yml`                  |
| Configure a server or event                 | `config/guilds/`, `config/events/`            |
| Copy a working example                      | `tools/templates/`                            |
| Understand the core                         | [Project map](docs/PROJECT_MAP.md) and `src/` |

`tools/` groups examples, tests, and development utilities. Documentation and verification reports live under `docs/`. In VS Code, generated dependency and log folders are hidden from the explorer; source folders remain visible.

## Bot messages

Ordinary messages use embeds by default, with the accent and footer configured in `config.yml`. The same style is available for commands, greetings, notifications, direct messages, and channel posts.

```js
await interaction.reply(
    interaction.client.ui.success('The operation succeeded!', {
        title: 'Done',
    }),
);

await channel.send(client.ui.info('Welcome!', { title: 'Community' }));
```

A new command using `interaction.reply('Hello!')` automatically receives the shared style. Use `client.ui` for events and direct sends, as shown in the examples. `/announce` and `/send` default to embed mode.

`/help`, `/ping`, and galleries use native Components V2 cards. Polls and forms retain their native Discord interfaces. The [message guide](docs/MESSAGES.md) explains the options and limits.

## Drag and drop

Copy `tools/templates/command.js` to `commands/custom/hello.js`, choose a unique name in `setName()`, and save. New command names appear after Discord synchronization. Saving the implementation of an already registered command loads the new version after the short file-stability delay.

- Valid files replace the active implementation.
- Invalid saves retain the last working version and report the file and error.
- Deleting a file unloads its module and updates registered commands.
- Nested folders, `.js`, `.cjs`, and guild-scoped modules are supported.
- Changes to `src/`, packages, job definitions, or connection settings require a restart.

## Included features

| Feature                     | Purpose                                                         |
| --------------------------- | --------------------------------------------------------------- |
| `/help`                     | Categories, search, and pagination                              |
| `/avatar` / **View avatar** | Image galleries                                                 |
| `/poll` / **Poll results**  | Native polls and results                                        |
| `/feedback`                 | A form with text, selection, an attachment, and contact consent |
| `/event`                    | An event in the server calendar                                 |
| `/system`, `/diagnostics`   | Bot owner tools                                                 |
| Temporary voice rooms       | Persistent tracking, ownership transfer, and cleanup            |

Set `runtime.owner_ids` for owner tools and `features.feedback.channel_id` for feedback. Existing moderation, economy, game, and media commands remain available.

## Verification

```bash
npm run verify
npm run deps:check
```

`verify` checks syntax, modules, tests, lint, and formatting without Discord authentication. `deps:check` compares installed versions with current stable releases in the npm registry without changing project files. Tested versions are pinned in `package-lock.json`.

- [Project map](docs/PROJECT_MAP.md)
- [Messages and embeds](docs/MESSAGES.md)
- [Adding plugins](docs/PLUGINS.md)
- [Configuration](docs/CONFIGURATION.md)
- [Review and correction report](docs/AUDIT.md)
- [Verification results](docs/VERIFICATION.md)

## Project language

All project documentation, source comments, configuration descriptions, diagnostics, built-in messages, and examples must be written in **English**.
