# Puro - Discord Bot

## Overview

Puro is a modern, feature-rich Discord bot designed for community engagement, moderation, and entertainment. Built with Node.js and Discord.js, Puro offers a wide range of slash commands, interactive games, and event-driven features, all fully customizable via a single `config.yml` file. Whether you want to manage your server, boost activity, or just have fun, Puro is ready to help!

Created by Skypixel Team. © Skypixel Team — all rights reserved. This project is open source under the ISC license; copyright remains with Skypixel Team.

---

## Features

### Slash Commands

Puro provides a comprehensive suite of slash commands, including:

- **/announce**: Send announcements to a channel (supports announcement channels).
- **/avatar**: Show a user's avatar (global or server-specific).
- **/clear**: Bulk delete messages, with optional user filter.
- **/coinflip**: Flip one or more coins (up to 10) with animated results.
- **/e621**: Fetch images from e621 with safe/explicit filtering (NSFW channel required for explicit).
- **/eightball**: Ask the magic 8-ball for answers.
- **/gender**: Randomly assign a fun gender/sexuality and percentage to a member.
- **/giveaway**: Start a giveaway and pick a winner from the most active members.
- **/guess**: Play a number guessing game.
- **/hangman**: Classic hangman game with Discord embeds.
- **/help**: Paginated help menu for all commands.
- **/hug**: Send a virtual hug to another member.
- **/info**: Display detailed bot and system info.
- **/joke**: Get a random joke.
- **/love**: Calculate love compatibility between two users.
- **/marry**: Propose marriage to another user.
- **/meme**: Fetch memes from Reddit, optionally by subreddit.
- **/pat**: Pat another user.
- **/rate**: Rate anything, just for fun.
- **/send**: Send a private DM to a user (requires Manage Messages).
- **/ship**: Ship two users together.
- **/timeout**: Timeout a member (requires Moderate Members).
- **/top**: Show a leaderboard of the most or least active members.
- **/tp**: "Teleport" to another member with a fun animation.
- **/tictactoe**: Play Tic-Tac-Toe against another user.
- **/truthordare**: Play Truth or Dare.
- **/userinfo**: Show detailed info about a user.
- **/divorce**: Divorce your in-bot partner.
- **/serverinfo**: Show server information.
- **/adopt**: Send a wholesome adoption request with accept/decline.

> **Note:** All commands are fully configurable via `config.yml` (colors, messages, limits, etc).

---

### Events

Puro listens and responds to various Discord events:

- **Ready**: Logs startup details and sets a custom status (from `config.yml`).
- **Interaction Create**: Handles slash commands and button interactions.
- **Message Create**: Responds to greetings (e.g., "hi", "hello") in a configured guild with customizable replies.
- **Custom Events**: Easily add your own event handlers.

> Optional AI moderation example: `events/ai.js` demonstrates an on-message moderation check using a local Ollama server. If you want to enable it, update `CHANNEL_ID`, `MODEL`, and `OLLAMA_API_URL` at the top of that file and ensure the server is running. If you don't need it, you can delete or ignore that file.

---

### Configuration

All commands and events are fully customizable via `config.yml`:

- Set custom colors for embeds (global and per-command).
- Define messages for success, errors, and interactions.
- Configure cooldowns, limits, and bot status.
- Customize greeting patterns, responses, and more.

---

## Installation

### Prerequisites

- **Node.js** v16.9+ (Node 18 LTS recommended)
- **npm** (comes with Node.js)
- A Discord bot token ([Discord Developer Portal](https://discord.com/developers/applications))
- Optional: e621 API credentials for `/e621`

### Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/username/puro-discord-bot.git
   cd puro-discord-bot
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory and add:
   ```
   TOKEN=your_discord_bot_token
   clientId=your_bot_client_id
   E621_USERNAME=your_e621_username
   E621_API_KEY=your_e621_api_key
   ```
   > `E621_USERNAME` and `E621_API_KEY` are only required for the `/e621` command.

4. **Configure the bot**:
   Edit `config.yml` to customize colors, messages, limits, and other settings. Example:
   ```yaml
   status:
     texts:
       - "Powered by Skypixel"
       - "Ready to help ❤️"
     type: "Custom"
     url: "https://example.com/"
   ```

5. **Run the bot**:
   ```bash
   npm start
   ```

---

## Usage

1. **Invite the bot**:
   - Use the bot's invite link (generate in the Discord Developer Portal).
   - Grant permissions to read/send messages, embed links, and manage messages.

2. **Use slash commands**:
   - Type `/` in any text channel to see available commands.
   - Example: `/help` for all commands, `/flip 5` to flip five coins.

3. **Interact with events**:
   - In the configured guild, send greetings like "hi" or "hello" for the configured reply.
   - The bot sets its status automatically on startup.

---

## Configuration Details

The `config.yml` file is the heart of Puro's customization. Key sections include:

- **colors**: Define global and per-command embed colors.
- **limits**: Set constraints like max message length, coin flips, etc.
- **commands**: Customize messages, colors, and settings for each command.
- **events**: Configure event-specific settings, such as greeting patterns.
- **status**: Set the bot's activity and status type.

Example command configuration:
```yaml
commands:
  love:
    color: '#FF69B4'
    messages:
      self_love: "💝 No self-love checks!"
      error: "❌ Error calculating love!"
```

### Command Registration

On startup, the bot automatically registers all valid slash commands it finds under `commands/` as global application commands. This can take a few minutes to propagate. If you prefer guild-only registration during development, adapt the call in `app.js` to use `Routes.applicationGuildCommands(clientId, guildId)`.

### Ephemeral Replies (Discord.js v14)

Discord.js deprecated the `ephemeral: true` option on interaction responses in favor of flags. The codebase now uses `flags: MessageFlags.Ephemeral` (or `64`) for ephemeral responses. If you add new commands, prefer:

```js
await interaction.reply({ content: 'Only you can see this', flags: 64 });
```

or, when deferring:

```js
await interaction.deferReply({ flags: isPrivate ? 64 : undefined });
```

---

## Contributing

We welcome contributions! To contribute:

1. **Fork the repository** and create a new branch:
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make your changes** and test thoroughly.

3. **Submit a pull request** with a clear description.

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md) and ensure your code adheres to the project's style (use ESLint if configured).

---

## Troubleshooting

- **Bot not responding**:
  - Check permissions.
  - Verify `TOKEN` and `clientId` in `.env`.
  - Ensure commands are registered (re-run `npm start`).
  - Note: environment variable is `TOKEN` in this project (not `DISCORD_TOKEN`).

- **e621 command failing**:
  - Confirm `E621_USERNAME` and `E621_API_KEY` in `.env`.
  - Channel must be NSFW for explicit content.

- **Greetings not working**:
  - Check the guild ID in `config.yml`.
  - Ensure the message matches a greeting pattern.

- **AsyncEventEmitter memory leak warnings**:
  - The project increases listener limits on the client and shards to suppress benign warnings from the Discord.js websocket layer. This is expected and safe.

- **database.json issues**:
  - On boot, `database.json` is auto-created if missing and auto-healed if empty/corrupted (a backup is written when possible).

---

## Changelog (recent)

- Migrate ephemeral responses to `flags: MessageFlags.Ephemeral` for Discord.js deprecation compliance.
- Raise max listeners on client/shards to avoid benign AsyncEventEmitter warnings.
- Auto-create/repair `database.json` on boot for smoother first-run and recovery.

For help, open an issue on GitHub or contact the maintainer.

---

## License

Puro is licensed under the ISC License. © Skypixel Team. All rights reserved.

---

## Acknowledgments

- Built with [Discord.js](https://discord.js.org/)
- Inspired by the furry and gaming communities
- Thanks to all contributors and users!

---

**Contact**: For questions or suggestions, open an issue on GitHub or reach out via Discord (username: MaxUltimat3).

Happy howling with Puro! 🐺✨
