# Plugin guide

Write all plugin comments, built-in responses, configuration descriptions, and documentation in English.

## Command contract

A command exports `data` and `execute(interaction, client)` in CommonJS. Use a Discord builder for `data`; valid plain API command objects also work.

```js
const { SlashCommandBuilder, MessageFlags } = require('discord.js');

// Configurable command settings.
const COMMAND_NAME = 'hello';
const COOLDOWN_SECONDS = 3;

module.exports = {
    category: 'Custom',
    cooldown: COOLDOWN_SECONDS,
    data: new SlashCommandBuilder().setName(COMMAND_NAME).setDescription('Say hello.'),
    async execute(interaction) {
        await interaction.reply(
            interaction.client.ui.info(`Hello, ${interaction.user.username}!`, {
                title: 'Welcome',
                flags: MessageFlags.Ephemeral,
            }),
        );
    },
};
```

Place the file anywhere below `commands/`, apart from reserved guild folders. Naming the file does not set the Discord command name; `data.setName()` does. `category` controls the help grouping. New command names require Discord registration/propagation; editing an already registered implementation takes effect locally after the file-save debounce.

## Optional metadata

| Field                           | Behavior                                                   |
| ------------------------------- | ---------------------------------------------------------- |
| `category`                      | Help category; at most 100 characters                      |
| `enabled: false`                | Disable the module                                         |
| `cooldown: 3`                   | Seconds between uses per action, user, and guild           |
| `ownerOnly: true`               | Only IDs in `runtime.owner_ids` can execute                |
| `guildOnly: true`               | Restricts execution and registration contexts to servers   |
| `userPermissions: [...]`        | Required member permissions                                |
| `botPermissions: [...]`         | Required application permissions in the current channel    |
| `defer: 'private'` / `'public'` | Acknowledge before slow work; finish with `editReply()`    |
| `portable: true`                | Eligible for user-install contexts when explicitly enabled |
| `feature: 'feedback'`           | Disable alongside `features.feedback.enabled: false`       |
| `cleanup(client)`               | Release resources when replaced or removed                 |

`commands.<name>.cooldown_seconds` overrides exported cooldowns. Cooldowns survive plugin replacement and failed executions release their cooldown. Autocomplete uses an optional `autocomplete(interaction, client)` function and always receives an acknowledgement.

Do not defer before `showModal()`: showing the form must be the initial response. Discord requires the first interaction acknowledgement within three seconds. Long operations should opt into deferral.

## Events

An event exports `name` (prefer the `Events` enum) and `execute(...discordArguments, client)`. Optional `once: true` runs it once. Guild-scoped once handlers are consumed only after a matching guild event.

A ready event added to a running bot initializes immediately. Guild-scoped ready events receive `(guild, client)` for matching guilds already joined, and initialize when the bot joins a matching guild later.

Return a cleanup function from a ready event that starts timers; `tools/templates/ready-event.js` shows the complete pattern. The loader waits for asynchronous ready initialization before cleanup. Other module-owned resources can be released in `cleanup(client)`.

Use the client or a data service for state that must survive replacement of a module object. Keep top-level module code free of timers, network work, and listeners. Existing message collectors finish with their original closures; unknown component IDs are left to those collectors.

## Components

A persistent component module exports `type`, `customId`, and `execute(interaction, client)`:

- `type: 'button'`
- `type: 'selectMenu'`
- `type: 'modal'`

Use `prefix: true` for a namespace such as `ticket:` that matches `ticket:<userId>`. Exact IDs take precedence over prefixes; longer prefixes take precedence within a scope. Keep IDs unique within each outgoing message or form, even for disabled buttons. An action such as Previous and Next must appear in its ID independently of its destination page.

Enforce ownership inside handlers for user-specific messages. See the help sessions and actions for an example. UI guards validate responses but do not infer your authorization rules or automatically acknowledge collector-owned buttons.

Templates include paired button, select-menu, and labeled-modal examples, plus ready events, context menus, and explicit user-install commands.

## Guild scopes and ignored files

`commands/guilds/<slug>/<file>.js`, `events/guilds/<slug>/<file>.js`, and `components/guilds/<slug>/<file>.js` target only that server. Add a `guild` entry in `config/guilds/<slug>.yml`, or use a numeric Discord guild ID as the folder name without any mapping. All IDs must be quoted strings. Named unknown guild folders are rejected rather than becoming global.

Files/folders beginning with `_` or `.` are ignored, as are `*.test.js`, `*.spec.js`, and matching CJS test files. Helpers belong in `src/` and require a restart when changed. Relative imports in a dropped file remain relative to that file's location.

The watcher uses atomic-save handling, write stability, a debounce, and a serial mutation queue. It removes listeners and clears old CommonJS cache-parent references so repeated reloads do not retain obsolete modules. Polling is available for network drives/hosting panels.

## Shared UI and collectors

Use `client.ui.info`, `success`, `warning`, or `error` for notices, and `client.ui.message(payload)` for existing embeds, controls, and attachments. Ordinary interaction text receives the default embed style automatically; custom channel/DM sends and event replies should call the UI API explicitly. See [Messages](MESSAGES.md).

Local collectors should register callbacks with `onCollect` / `onEnd` from `src/shared/collectors.js`. They serialize mutations and contain asynchronous failures. Existing collectors retain their closures through plugin replacement. Persistent components under `components/` are usually simpler when a handler does not need an in-memory game session.
