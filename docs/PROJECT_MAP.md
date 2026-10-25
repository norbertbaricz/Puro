# Project map

For everyday work, start with the plugin folders `commands/`, `events/`, and `components/`; settings in `config.yml` and `config/`; and examples in `tools/templates/`.

## Your plugins

| Folder                             | Contents                                           | Starting point                                   |
| ---------------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| `commands/`                        | One command or context-menu action per file        | Copy `tools/templates/command.js`                |
| `events/`                          | One Discord event handler per file                 | Copy `tools/templates/event.js`                  |
| `components/`                      | Persistent button, select-menu, and modal handlers | Copy the paired examples from `tools/templates/` |
| `config/commands/`                 | Messages and options for each command              | Match the Discord command name                   |
| `config/events/`, `config/guilds/` | Event settings and server-specific automations     | Write Discord IDs as quoted strings              |

The filename helps you locate a module. `setName()` defines its Discord command name. `category` defines its group in `/help`. Ordinary folders do not restrict a command to a server; use `commands/guilds/<slug>/` and the corresponding guild configuration for that purpose.

## The core

| Area                     | Responsibility                                      |
| ------------------------ | --------------------------------------------------- |
| `app.js`                 | Starts the application                              |
| `src/bootstrap.js`       | Creates and connects the services                   |
| `src/core/config/`       | Reads and validates configuration                   |
| `src/core/plugins/`      | Loads, reloads, and unloads plugins                 |
| `src/core/interactions/` | Selects handlers, checks access, and handles errors |
| `src/core/registration/` | Synchronizes commands with Discord                  |
| `src/core/ui/`           | Shared message style, embeds, and UI validation     |
| `src/core/runtime/`      | Discord client, runtime versions, and shutdown      |
| `src/features/`          | Behavior and presentation for larger features       |
| `src/services/`          | Access to persistent data                           |
| `src/shared/`            | Shared utilities and safe collector callbacks       |

For example, `commands/economy/blackjack.js` declares the command, while `src/features/blackjack/` separates cards, presentation, and game flow. The giveaway automation has its startup event under `events/`, with filtering, presentation, and API polling under `src/features/giveaways/`.

A small feature can remain in one plugin. Separate reusable behavior or a complex interface into `src/features/<name>/` when needed.

## Development files and data

| Location           | Purpose                                                                         |
| ------------------ | ------------------------------------------------------------------------------- |
| `tools/templates/` | Copyable examples; not loaded automatically                                     |
| `tools/tests/`     | Offline tests using temporary data instead of your bot's credentials or records |
| `tools/scripts/`   | Verification and version-reporting utilities                                    |
| `docs/`            | Guides, migration, architecture, and verification reports                       |
| `database.json`    | Economy data, unless another path is configured                                 |
| `data/`            | Persistent automation state                                                     |
| `logs/`            | Diagnostics generated while the bot runs                                        |

Restart after changes to `src/`, packages, or job definitions. Commands, events, components, and supported configuration settings reload automatically. Existing game sessions keep the collector and rules with which they started.

## Shared message style

Use `client.ui.info()`, `success()`, `warning()`, or `error()` for a notice with a title, color, and footer. Use `client.ui.message(payload)` for an existing payload containing embeds, files, or buttons. Complete examples are available in [MESSAGES.md](MESSAGES.md).

To show generated folders in VS Code again, edit the project's `files.exclude` settings. Explorer visibility does not change bot behavior.

All project documentation, comments, messages, and examples must be in English.
